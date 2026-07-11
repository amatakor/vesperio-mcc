/**
 * Registry logo pipeline, deterministic, no LLM. For each registry
 * profile (constellations, organizations, spaceports, vehicles) that
 * carries a `website` field, fetch that page's own favicon/touch-icon,
 * re-host it under public/img/registry/logos/{slug}.{ext}, and write
 * the manifest src/data/registry-logos.json. Entities with no
 * fetchable icon keep the generated initials tile. No third-party
 * resolver services: icons come only from the entity's own recorded
 * website.
 *
 * Idempotent: existing files are kept; delete a file to refresh it.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fetchSafe, fetchSafeText } from "./lib/fetch-safe";
import { sanitizeSvg, svgNeedsSanitizing } from "./lib/sanitize-svg";
import { writeJsonAtomic } from "./lib/write-json-atomic";

const REGISTRY_DIRS = ["constellations", "organizations", "spaceports", "vehicles"];
const OUT_DIR = "public/img/registry/logos";
const MANIFEST = "src/data/registry-logos.json";
const UA = "MCC-Vesperio logo fetcher (vesperio.ai; mail@florianwardell.com)";
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 20000;
const CONCURRENCY = 4;

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/svg+xml": "svg",
};

interface SourcedField<T> {
  value: T;
}

interface RegistryEntity {
  slug: string;
  website?: SourcedField<string>;
}

interface LogoEntry {
  file: string;
  origin: string;
  fetched_at: string;
}

interface Manifest {
  generated_at: string;
  logos: Record<string, LogoEntry>;
}

interface IconCandidate {
  href: string;
  rel: string;
  sizes: number;
}

function loadEntities(): { slug: string; website: string }[] {
  const out: { slug: string; website: string }[] = [];
  for (const dir of REGISTRY_DIRS) {
    const dirPath = join("src/data/registry", dir);
    if (!existsSync(dirPath)) continue;
    for (const file of readdirSync(dirPath)) {
      if (!file.endsWith(".json")) continue;
      const slug = file.slice(0, -".json".length);
      const raw = readFileSync(join(dirPath, file), "utf8");
      let entity: RegistryEntity;
      try {
        entity = JSON.parse(raw) as RegistryEntity;
      } catch {
        continue;
      }
      const website = entity.website?.value;
      if (typeof website === "string" && website.trim().length > 0) {
        out.push({ slug, website: website.trim() });
      }
    }
  }
  return out;
}

function parseSizes(sizes: string | null): number {
  if (!sizes) return 0;
  if (sizes.toLowerCase() === "any") return 9999;
  let max = 0;
  for (const part of sizes.split(/\s+/)) {
    const m = part.match(/^(\d+)x\d+$/i);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return max;
}

function extractLinkTags(html: string): { rel: string; href: string; sizes: string | null }[] {
  const tags: { rel: string; href: string; sizes: string | null }[] = [];
  const linkRe = /<link\b[^>]*>/gi;
  const matches = html.match(linkRe) ?? [];
  for (const tag of matches) {
    const relMatch = tag.match(/\brel\s*=\s*["']([^"']+)["']/i);
    if (!relMatch) continue;
    const rel = relMatch[1]!.toLowerCase().trim();
    if (!rel.includes("icon")) continue;
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const sizesMatch = tag.match(/\bsizes\s*=\s*["']([^"']+)["']/i);
    tags.push({ rel, href: hrefMatch[1]!, sizes: sizesMatch ? sizesMatch[1]! : null });
  }
  return tags;
}

function pickIcon(html: string, pageUrl: string): string | null {
  const tags = extractLinkTags(html);
  const candidates: IconCandidate[] = [];
  for (const tag of tags) {
    if (tag.href.startsWith("data:")) continue;
    let resolved: string;
    try {
      resolved = new URL(tag.href, pageUrl).toString();
    } catch {
      continue;
    }
    candidates.push({ href: resolved, rel: tag.rel, sizes: parseSizes(tag.sizes) });
  }

  const appleTouch = candidates.filter((c) => c.rel.includes("apple-touch-icon"));
  if (appleTouch.length > 0) {
    appleTouch.sort((a, b) => b.sizes - a.sizes);
    return appleTouch[0]!.href;
  }

  const icons = candidates.filter((c) => c.rel === "icon" || c.rel.endsWith(" icon") || c.rel.includes("shortcut icon"));
  if (icons.length > 0) {
    icons.sort((a, b) => b.sizes - a.sizes);
    return icons[0]!.href;
  }

  try {
    const origin = new URL(pageUrl).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
}

async function fetchIconUrl(website: string): Promise<{ iconUrl: string; finalUrl: string } | null> {
  try {
    const res = await fetchSafeText(website, { timeoutMs: TIMEOUT_MS, headers: { "User-Agent": UA } });
    if (res.status < 200 || res.status >= 300) return null;
    const finalUrl = res.finalUrl || website;
    const iconUrl = pickIcon(res.text, finalUrl);
    if (!iconUrl) return null;
    return { iconUrl, finalUrl };
  } catch (e) {
    console.error(`fetch-logos: page fetch failed for ${website}: ${String(e)}`);
    return null;
  }
}

async function download(url: string, slug: string): Promise<string | null> {
  try {
    // Through the shared safe fetcher: SSRF guard on the URL and each
    // redirect hop, body capped at MAX_BYTES. Nothing is written on
    // failure, unchanged; only the previously-silent error is now logged.
    const res = await fetchSafe(url, {
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
      headers: { "User-Agent": UA },
    });
    if (res.status < 200 || res.status >= 300) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    let ext = EXT_BY_TYPE[type];
    if (!ext) {
      // Some servers mis-serve favicon.ico without a proper content-type;
      // fall back to the URL's own extension when it's one we accept.
      const urlExt = extname(new URL(url).pathname).slice(1).toLowerCase();
      if (urlExt === "ico" || urlExt === "png" || urlExt === "jpg" || urlExt === "jpeg" || urlExt === "svg" || urlExt === "gif" || urlExt === "webp") {
        ext = urlExt === "jpeg" ? "jpg" : urlExt;
      } else {
        return null;
      }
    }
    const buf = res.bytes;
    if (buf.byteLength === 0) return null;
    // SVGs are documents, not images: sanitize the script/external-reference
    // surface (should-fix 9) before re-hosting a file the site renders.
    let body: Uint8Array | string = buf;
    if (ext === "svg") {
      const svg = new TextDecoder().decode(buf);
      if (svgNeedsSanitizing(svg)) {
        console.warn(`fetch-logos: ${slug}: sanitized SVG from ${url} (stripped script/external refs)`);
        body = sanitizeSvg(svg);
      } else {
        body = svg;
      }
    }
    writeFileSync(join(OUT_DIR, `${slug}.${ext}`), body);
    return `/img/registry/logos/${slug}.${ext}`;
  } catch (e) {
    console.error(`fetch-logos: ${slug}: icon download failed for ${url}: ${String(e)}`);
    return null;
  }
}

async function processEntity(
  entity: { slug: string; website: string },
  manifest: Record<string, LogoEntry>,
): Promise<"kept" | "fetched" | "failed"> {
  const existing = readdirSync(OUT_DIR).find((f) => f.startsWith(entity.slug + "."));
  if (existing) {
    if (!manifest[entity.slug]) {
      manifest[entity.slug] = {
        file: `/img/registry/logos/${existing}`,
        origin: entity.website,
        fetched_at: new Date().toISOString(),
      };
    }
    console.log(`${entity.slug}: kept ${existing}`);
    return "kept";
  }

  const found = await fetchIconUrl(entity.website);
  if (!found) {
    console.log(`${entity.slug}: page fetch/parse failed, initials tile`);
    return "failed";
  }

  const path = await download(found.iconUrl, entity.slug);
  if (path) {
    manifest[entity.slug] = {
      file: path,
      origin: entity.website,
      fetched_at: new Date().toISOString(),
    };
    console.log(`${entity.slug}: ${path}`);
    return "fetched";
  }
  console.log(`${entity.slug}: icon download failed, initials tile`);
  return "failed";
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  async function next(): Promise<void> {
    while (idx < items.length) {
      const item = items[idx++]!;
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  let existingManifest: Manifest | null = null;
  if (existsSync(MANIFEST)) {
    try {
      existingManifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
    } catch {
      existingManifest = null;
    }
  }
  const manifest: Record<string, LogoEntry> = { ...(existingManifest?.logos ?? {}) };

  const entities = loadEntities();
  let fetched = 0;
  let kept = 0;
  let failed = 0;

  await runPool(entities, CONCURRENCY, async (entity) => {
    const result = await processEntity(entity, manifest);
    if (result === "kept") kept++;
    else if (result === "fetched") fetched++;
    else failed++;
  });

  // Drop manifest entries whose file no longer exists on disk.
  for (const slug of Object.keys(manifest)) {
    const entry = manifest[slug]!;
    const filename = entry.file.split("/").pop()!;
    if (!existsSync(join(OUT_DIR, filename))) {
      delete manifest[slug];
    }
  }

  const out: Manifest = {
    generated_at: new Date().toISOString(),
    logos: manifest,
  };
  writeJsonAtomic(MANIFEST, out);
  console.log(
    `fetch-logos: ${entities.length} scanned, ${kept} kept, ${fetched} fetched, ${failed} failed/skipped, ${Object.keys(manifest).length} total in manifest`,
  );
}

await main();
