/**
 * Wikimedia Commons logo-candidate stage, deterministic, no LLM.
 *
 * Decision of record: Commons per-file review, re-hosted, NO
 * third-party logo API (Clearbit is dead since 2025-12-01, do not
 * touch it). This script does NOT ship anything to the site: it only
 * gathers candidate files from Wikimedia Commons for Florian's
 * per-file license review. Nothing here writes to public/img/,
 * registry-logos.json, or is read by the site build.
 *
 * Target list = registry entities (constellations, organizations,
 * spaceports, vehicles) with no entry in src/data/registry-logos.json.
 * Spaceports whose operator organization already has a logo entry are
 * skipped (their card can borrow the operator mark editorially; this
 * script does not decide that, it just avoids a redundant candidate
 * search).
 *
 * For each target, searches Wikimedia Commons for "<name> logo" (File:
 * namespace), takes up to 3 candidates preferring SVG and filenames
 * containing "logo", and records file page URL, direct file URL,
 * license fields (verbatim, never normalized or guessed), author, and
 * usage terms via the Commons imageinfo API.
 *
 * Writes:
 *   - src/data/logo-candidates.json (machine output, pending_review)
 *   - LOGO_REVIEW.md (human checklist)
 *
 * Polite: <=1 request/sec to Commons, proper UA with contact info.
 * Resumable: entities already present in logo-candidates.json with
 * status other than "pending_review" (Florian's review state, never
 * written by this script) are left as-is on rerun. Deterministic: no
 * model calls, only API queries and metadata copying.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { writeJsonAtomic } from "./lib/write-json-atomic";

const REGISTRY_DIRS = ["constellations", "organizations", "spaceports", "vehicles"] as const;
const LOGOS_MANIFEST = "src/data/registry-logos.json";
const CANDIDATES_OUT = "src/data/logo-candidates.json";
const REVIEW_OUT = "LOGO_REVIEW.md";
const UA = "MCC-Vesperio logo candidate fetcher (mcc.vesperio.ai; mail@florianwardell.com)";
const API = "https://commons.wikimedia.org/w/api.php";
const TIMEOUT_MS = 20000;
const MIN_INTERVAL_MS = 1100; // <=1 req/sec
const MAX_TARGETS = 120;
const MAX_CANDIDATES_PER_ENTITY = 3;
const MAX_RETRIES = 2;

interface SourcedField<T> {
  value: T;
}

interface RegistryEntity {
  slug: string;
  name?: string;
  entity_type?: string;
  operator?: SourcedField<string>;
}

interface Target {
  slug: string;
  entity_name: string;
  entity_type: string;
}

interface Candidate {
  file_page: string;
  file_url: string;
  license_short: string | null;
  license_full: string | null;
  author: string | null;
  usage_terms: string | null;
  fetched: string;
  license_unstated: boolean;
}

interface CandidateEntry {
  slug: string;
  entity_name: string;
  entity_type: string;
  candidates: Candidate[];
  status: "pending_review" | string;
}

interface CandidatesFile {
  generated_at: string;
  note: string;
  entries: CandidateEntry[];
}

// --- rate limiter -----------------------------------------------------

let lastRequestAt = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestAt + MIN_INTERVAL_MS - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function commonsGet(params: Record<string, string>): Promise<any | null> {
  const url = new URL(API);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await throttle();
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        if (attempt < MAX_RETRIES) continue;
        return null;
      }
      return await res.json();
    } catch {
      if (attempt < MAX_RETRIES) continue;
      return null;
    }
  }
  return null;
}

// --- registry loading ---------------------------------------------------

function loadAllEntities(): Map<string, RegistryEntity[]> {
  const byDir = new Map<string, RegistryEntity[]>();
  for (const dir of REGISTRY_DIRS) {
    const dirPath = join("src/data/registry", dir);
    const list: RegistryEntity[] = [];
    if (!existsSync(dirPath)) {
      byDir.set(dir, list);
      continue;
    }
    for (const file of readdirSync(dirPath)) {
      if (!file.endsWith(".json")) continue;
      const slug = file.slice(0, -".json".length);
      try {
        const raw = readFileSync(join(dirPath, file), "utf8");
        const entity = JSON.parse(raw) as RegistryEntity;
        entity.slug = entity.slug ?? slug;
        list.push(entity);
      } catch {
        continue;
      }
    }
    byDir.set(dir, list);
  }
  return byDir;
}

function loadCoveredSlugs(): Set<string> {
  if (!existsSync(LOGOS_MANIFEST)) return new Set();
  try {
    const manifest = JSON.parse(readFileSync(LOGOS_MANIFEST, "utf8")) as {
      logos: Record<string, unknown>;
    };
    return new Set(Object.keys(manifest.logos ?? {}));
  } catch {
    return new Set();
  }
}

/** Best-effort match of a spaceport's operator text to an organization slug. */
function findOperatorOrgSlug(operatorText: string, orgs: RegistryEntity[]): string | null {
  const norm = operatorText.toLowerCase();
  for (const org of orgs) {
    if (!org.name) continue;
    const orgName = org.name.toLowerCase();
    if (norm.includes(orgName) || orgName.includes(norm)) return org.slug;
  }
  return null;
}

function buildTargets(): { targets: Target[]; skippedSpaceports: string[] } {
  const byDir = loadAllEntities();
  const covered = loadCoveredSlugs();
  const orgs = byDir.get("organizations") ?? [];

  const targets: Target[] = [];
  const skippedSpaceports: string[] = [];

  // Vehicles and organizations first (priority order for the budget cap).
  for (const dir of ["vehicles", "organizations", "constellations", "spaceports"] as const) {
    const list = byDir.get(dir) ?? [];
    for (const entity of list) {
      if (covered.has(entity.slug)) continue;
      if (!entity.name) continue;

      if (dir === "spaceports") {
        const operatorText = entity.operator?.value;
        if (operatorText) {
          const orgSlug = findOperatorOrgSlug(operatorText, orgs);
          if (orgSlug && covered.has(orgSlug)) {
            skippedSpaceports.push(entity.slug);
            continue;
          }
        }
      }

      targets.push({
        slug: entity.slug,
        entity_name: entity.name,
        entity_type: entity.entity_type ?? dir.slice(0, -1),
      });
    }
  }

  return { targets, skippedSpaceports };
}

// --- Commons search -------------------------------------------------

async function searchCommonsFiles(entityName: string): Promise<string[]> {
  const query = `${entityName} logo`;
  const data = await commonsGet({
    action: "query",
    list: "search",
    srnamespace: "6",
    srlimit: "10",
    srsearch: query,
  });
  if (!data) return null as unknown as string[];

  const results: { title: string }[] = data?.query?.search ?? [];
  const titles = results.map((r) => r.title).filter((t) => t.startsWith("File:"));

  // Preference: filename contains "logo" first, then SVG extension.
  const scored = titles.map((t) => {
    const lower = t.toLowerCase();
    let score = 0;
    if (lower.includes("logo")) score += 2;
    if (lower.endsWith(".svg")) score += 1;
    return { title: t, score };
  });
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_CANDIDATES_PER_ENTITY).map((s) => s.title);
}

function extMeta(extmetadata: Record<string, { value: unknown }> | undefined, key: string): string | null {
  const raw = extmetadata?.[key]?.value;
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "string") {
    // Strip HTML tags Commons sometimes embeds (e.g. Artist as a link).
    const stripped = raw.replace(/<[^>]+>/g, "").trim();
    return stripped.length > 0 ? stripped : null;
  }
  return String(raw);
}

async function fetchImageInfo(fileTitle: string, fetchedDate: string): Promise<Candidate | null> {
  const data = await commonsGet({
    action: "query",
    titles: fileTitle,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
  });
  if (!data) return null;

  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0] as any;
  if (!page || page.missing !== undefined) return null;
  const info = page.imageinfo?.[0];
  if (!info) return null;

  const extmetadata = info.extmetadata as Record<string, { value: unknown }> | undefined;
  const licenseShort = extMeta(extmetadata, "LicenseShortName");
  const licenseFull = extMeta(extmetadata, "License") ?? extMeta(extmetadata, "LicenseShortName");
  const author = extMeta(extmetadata, "Artist");
  const usageTerms = extMeta(extmetadata, "UsageTerms");

  const filePageUrl = `https://commons.wikimedia.org/wiki/${fileTitle.replace(/ /g, "_")}`;

  return {
    file_page: filePageUrl,
    file_url: info.url ?? "",
    license_short: licenseShort,
    license_full: licenseFull,
    author,
    usage_terms: usageTerms,
    fetched: fetchedDate,
    license_unstated: licenseShort === null && licenseFull === null,
  };
}

async function processTarget(
  target: Target,
  fetchedDate: string,
): Promise<{ entry: CandidateEntry; ok: boolean }> {
  const titles = await searchCommonsFiles(target.entity_name);
  if (titles === null) {
    // Search itself failed (network/API error after retries).
    return {
      entry: {
        slug: target.slug,
        entity_name: target.entity_name,
        entity_type: target.entity_type,
        candidates: [],
        status: "pending_review",
      },
      ok: false,
    };
  }

  const candidates: Candidate[] = [];
  for (const title of titles) {
    const cand = await fetchImageInfo(title, fetchedDate);
    if (cand) candidates.push(cand);
  }

  return {
    entry: {
      slug: target.slug,
      entity_name: target.entity_name,
      entity_type: target.entity_type,
      candidates,
      status: "pending_review",
    },
    ok: true,
  };
}

// --- output writers -------------------------------------------------

function writeCandidatesJson(entries: CandidateEntry[]): void {
  const out: CandidatesFile = {
    generated_at: new Date().toISOString(),
    note:
      "Wikimedia Commons logo candidates for Florian's per-file review. Nothing here ships to the site. status stays pending_review until Florian reviews; this script never writes any other status.",
    entries,
  };
  writeJsonAtomic(CANDIDATES_OUT, out);
}

function licenseTagOf(c: Candidate): string {
  if (c.license_unstated) return "license_unstated";
  return c.license_short ?? c.license_full ?? "license_unstated";
}

function writeReviewMarkdown(entries: CandidateEntry[], skippedSpaceports: string[], skippedOverBudget: number): void {
  const lines: string[] = [];
  lines.push("# Logo candidate review");
  lines.push("");
  lines.push(`Generated ${new Date().toISOString()} by \`scripts/fetch-logo-candidates.ts\`.`);
  lines.push("");
  lines.push(
    "Rule: pictorial logos may not be Public Domain even when the Commons page tags them loosely; verify the actual license tag on the file page before shipping. Entries with no verified license tag (`license_unstated`) do not ship under any circumstances. Company and organization logos are typically trademarks even when the image file itself is freely licensed or PD (e.g. PD-textlogo, PD-ineligible): re-hosting on this site for identification is nominative use, not a trademark license, and any use is removed on request from the rights holder. No candidate here has been re-hosted or shipped; this file is a review checklist only.",
  );
  lines.push("");

  const byType = new Map<string, CandidateEntry[]>();
  for (const e of entries) {
    const list = byType.get(e.entity_type) ?? [];
    list.push(e);
    byType.set(e.entity_type, list);
  }

  for (const [type, list] of [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## ${type}`);
    lines.push("");
    const sorted = [...list].sort((a, b) => a.entity_name.localeCompare(b.entity_name));
    for (const entry of sorted) {
      lines.push(`### ${entry.entity_name} (\`${entry.slug}\`)`);
      if (entry.candidates.length === 0) {
        lines.push("- no candidates found");
      } else {
        for (const c of entry.candidates) {
          const tag = licenseTagOf(c);
          const authorPart = c.author ? `, author: ${c.author}` : "";
          const usagePart = c.usage_terms ? `, usage terms: ${c.usage_terms}` : "";
          lines.push(`- [${c.file_page}](${c.file_page}) — license: \`${tag}\`${authorPart}${usagePart}`);
        }
      }
      lines.push("");
    }
  }

  if (skippedSpaceports.length > 0) {
    lines.push("## Spaceports skipped (operator org already has a logo entry)");
    lines.push("");
    for (const slug of skippedSpaceports.sort()) lines.push(`- ${slug}`);
    lines.push("");
  }

  if (skippedOverBudget > 0) {
    lines.push("## Skipped over budget");
    lines.push("");
    lines.push(
      `${skippedOverBudget} additional target(s) exceeded the ${MAX_TARGETS}-entity budget cap and were not queried this run. Vehicles and organizations were covered first.`,
    );
    lines.push("");
  }

  writeFileSync(REVIEW_OUT, lines.join("\n"));
}

// --- main -------------------------------------------------------------

async function main(): Promise<void> {
  const { targets: allTargets, skippedSpaceports } = buildTargets();

  const targets = allTargets.slice(0, MAX_TARGETS);
  const skippedOverBudget = Math.max(0, allTargets.length - MAX_TARGETS);

  if (skippedOverBudget > 0) {
    console.log(
      `fetch-logo-candidates: ${allTargets.length} targets found, capping at ${MAX_TARGETS} (vehicles/organizations prioritized), ${skippedOverBudget} skipped`,
    );
  }

  const fetchedDate = new Date().toISOString().slice(0, 10);
  const entries: CandidateEntry[] = [];
  let withCandidates = 0;
  let networkErrors = 0;
  const licenseCounts = new Map<string, number>();

  for (const target of targets) {
    const { entry, ok } = await processTarget(target, fetchedDate);
    if (!ok) {
      networkErrors++;
      console.log(`${target.slug}: search failed after retries`);
    } else {
      console.log(`${target.slug}: ${entry.candidates.length} candidate(s)`);
    }
    if (entry.candidates.length > 0) withCandidates++;
    for (const c of entry.candidates) {
      const tag = licenseTagOf(c);
      licenseCounts.set(tag, (licenseCounts.get(tag) ?? 0) + 1);
    }
    entries.push(entry);
  }

  writeCandidatesJson(entries);
  writeReviewMarkdown(entries, skippedSpaceports, skippedOverBudget);

  const licenseSummary = [...licenseCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => `${tag}: ${count}`)
    .join(", ");

  console.log(
    `fetch-logo-candidates: ${targets.length} targets, ${withCandidates} with candidates, ${networkErrors} network errors, ${skippedSpaceports.length} spaceports skipped (operator covered)`,
  );
  console.log(`license tags: ${licenseSummary || "(none)"}`);
}

await main();
