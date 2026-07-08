/**
 * Item artwork pipeline, deterministic, no LLM. For every item without
 * an image field (or listed via --redo):
 *
 *   1. Rank ALL the item's sources press-first (trade > mainstream >
 *      aggregator > informal > first-party > official record): editorial
 *      artwork beats press-release and filing pages (Florian, 2026-07-08).
 *      Social platform pages never contribute their own og:image (it is a
 *      profile picture); a Bluesky post instead resolves to the article it
 *      embeds, via the public API, and that page joins the candidates.
 *      PDFs are skipped.
 *   2. Fetch each candidate page's og:image / twitter:image in rank order.
 *      Reject junk (tiny images, banner/skyscraper ad shapes). Prefer the
 *      first photo; a logo-shaped image is kept only as a fallback if no
 *      candidate yields a photo.
 *   3. Otherwise fall back to the curated freely licensed stock map in
 *      src/data/stock-images.json, keyed by source hostname suffix.
 *   4. Otherwise stamp image: null; the site renders a generated tile.
 *
 * Credit always names the page the image actually came from.
 * Never image search, never generated imagery, never agency seals.
 * Runs in the sweep workflow between the agent and the build.
 *
 * Usage: bun scripts/fetch-thumbs.ts [--redo id1,id2,...]
 *   --redo deletes the listed items' downloaded files and re-decides their
 *   image from scratch (also re-decides items currently stamped null).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { ItemsFile, ItemImage } from "../src/data/schema";

const UA = "MCC-Vesperio thumbnail fetcher (mcc.vesperio.ai; mail@florianwardell.com)";
const MAX_BYTES = 3 * 1024 * 1024;
const OUT_DIR = "public/img/items";

/** Image sanity gates: reject favicons/trackers and banner/skyscraper ad
    shapes. Applied only when the header yields dimensions. */
const MIN_DIMENSION = 200;
const MAX_ASPECT = 3; // reject wider than 3:1 or taller than 1:3

/** Social platforms whose own og:image is branding, never event artwork. */
const SOCIAL_HOSTS = ["bsky.app", "twitter.com", "x.com", "youtube.com", "youtu.be", "linkedin.com", "facebook.com", "t.me"];

/** Press-first candidate order (Florian, 2026-07-08): trade press artwork
    over press releases and investor-relations pages, filings last. A source
    class not listed ranks with informal. */
const CLASS_RANK: Record<string, number> = {
  trade: 0,
  mainstream: 1,
  aggregator: 2,
  informal: 3,
  social_resolved: 3, // article a whitelisted post links to
  first_party: 4,
  official_record: 5,
};

interface StockMap {
  by_domain: Record<string, ItemImage>;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Pixel dimensions of an encoded image, header-only, no dependency.
 * Handles the four formats this pipeline stores (png, gif, webp, jpeg);
 * returns null on anything it cannot parse (treated as a photo).
 */
function imageSize(buf: Uint8Array): { w: number; h: number } | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const at = (i: number) => buf[i]!;
  // PNG: IHDR width/height are big-endian at offsets 16 and 20.
  if (buf.length >= 24 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  // GIF: little-endian width/height at offsets 6 and 8.
  if (buf.length >= 10 && at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46) {
    return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
  }
  // WEBP (RIFF....WEBP): VP8 lossy, VP8L lossless, or VP8X extended.
  if (
    buf.length >= 30 &&
    at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
    at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50
  ) {
    const fmt = String.fromCharCode(at(12), at(13), at(14), at(15));
    if (fmt === "VP8 ") {
      return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
    }
    if (fmt === "VP8L") {
      const b0 = at(21), b1 = at(22), b2 = at(23), b3 = at(24);
      return {
        w: 1 + (((b1 & 0x3f) << 8) | b0),
        h: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
    if (fmt === "VP8X") {
      return {
        w: 1 + (at(24) | (at(25) << 8) | (at(26) << 16)),
        h: 1 + (at(27) | (at(28) << 8) | (at(29) << 16)),
      };
    }
    return null;
  }
  // JPEG: scan for a start-of-frame marker (SOF0-SOF15, excluding the
  // non-frame C4/C8/CC markers) and read its 16-bit height/width.
  if (buf.length >= 4 && at(0) === 0xff && at(1) === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (at(o) !== 0xff) {
        o++;
        continue;
      }
      const marker = at(o + 1);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: dv.getUint16(o + 7), h: dv.getUint16(o + 5) };
      }
      const len = dv.getUint16(o + 2);
      if (len < 2) break;
      o += 2 + len;
    }
    return null;
  }
  return null;
}

/**
 * "contain" for square, small sources (logos): shown whole on a tile
 * rather than cover-cropped into an abstract shape. Undefined (cover)
 * for everything else, including tall portrait photos. Threshold: near
 * 1:1 and no dimension over 900px, the shape og:image logos take.
 */
function fitFor(dim: { w: number; h: number } | null): "contain" | undefined {
  if (!dim || dim.w <= 0 || dim.h <= 0) return undefined;
  const ratio = dim.w / dim.h;
  return ratio >= 0.85 && ratio <= 1.18 && Math.max(dim.w, dim.h) <= 900 ? "contain" : undefined;
}

/** Reads the on-disk file for a re-hosted image src and returns its fit. */
function fitForLocalSrc(src: string): "contain" | undefined {
  if (!src.startsWith("/img/items/")) return undefined; // external/stock: leave as cover
  try {
    return fitFor(imageSize(readFileSync(join("public", src))));
  } catch {
    return undefined;
  }
}

/** Reads the on-disk file for a re-hosted image src and returns its pixel size,
    so the card can size its media box to the image's own aspect ratio (shown
    whole, never cropped). Any local /img/ path, stock images included. */
function dimsForLocalSrc(src: string): { w: number; h: number } | null {
  if (!src.startsWith("/img/")) return null;
  try {
    return imageSize(readFileSync(join("public", src)));
  } catch {
    return null;
  }
}

function findMetaImage(html: string): string | null {
  for (const prop of ["og:image", "twitter:image"]) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']|` +
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      "i",
    );
    const m = html.match(re);
    const url = m?.[1] ?? m?.[2];
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isSocial(url: string): boolean {
  const h = hostOf(url);
  return h !== null && SOCIAL_HOSTS.some((s) => h === s || h.endsWith("." + s));
}

/** A Bluesky post's own og:image is the author's avatar; the artwork lives on
    the article the post embeds. Resolve that article via the public API. */
async function resolveBskyArticle(postUrl: string): Promise<string | null> {
  const m = postUrl.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/);
  if (!m) return null;
  const at = `at://${m[1]}/app.bsky.feed.post/${m[2]}`;
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(at)}&depth=0`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      thread?: { post?: { record?: { embed?: { external?: { uri?: string } } } } };
    };
    const uri = data.thread?.post?.record?.embed?.external?.uri;
    return uri && /^https?:\/\//i.test(uri) ? uri : null;
  } catch {
    return null;
  }
}

interface Candidate {
  url: string;
  rank: number;
}

/** All of an item's source pages, press first, social resolved to the page
    it links, PDFs and unresolved social pages dropped. */
async function candidatesFor(item: {
  source_url: string;
  secondary_urls?: string[];
  sources?: { url: string; class: string }[];
}): Promise<Candidate[]> {
  const entries: { url: string; cls: string }[] =
    item.sources && item.sources.length > 0
      ? item.sources.map((s) => ({ url: s.url, cls: s.class }))
      : [item.source_url, ...(item.secondary_urls ?? [])].map((u, i) => ({
          url: u,
          cls: i === 0 ? "first_party" : "informal",
        }));

  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const e of entries) {
    let url = e.url;
    let cls = e.cls;
    if (isSocial(url)) {
      const article = url.includes("bsky.app/") ? await resolveBskyArticle(url) : null;
      if (!article || isSocial(article)) continue; // platform og:image is branding, never artwork
      url = article;
      cls = "social_resolved";
    }
    if (/\.pdf(?:[?#]|$)/i.test(url)) continue; // no og:image in a PDF
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, rank: CLASS_RANK[cls] ?? CLASS_RANK.informal! });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

interface Download {
  src: string;
  file: string;
  dim: { w: number; h: number } | null;
}

/** Download an og:image; reject unknown formats, oversized payloads, tiny
    images, and ad shapes (banners/skyscrapers). Writes {id}.{ext}; the
    caller cleans up rejected/unused files. */
async function downloadImage(url: string, id: string): Promise<Download | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    const ext = EXT_BY_TYPE[type];
    if (!ext) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    const dim = imageSize(buf);
    if (dim) {
      if (Math.min(dim.w, dim.h) < MIN_DIMENSION) return null; // favicon/tracker
      const aspect = dim.w / dim.h;
      if (aspect > MAX_ASPECT || aspect < 1 / MAX_ASPECT) return null; // ad banner shape
    }
    mkdirSync(OUT_DIR, { recursive: true });
    const file = `${id}.${ext}`;
    writeFileSync(join(OUT_DIR, file), buf);
    return { src: `/img/items/${file}`, file, dim };
  } catch {
    return null;
  }
}

function stockFor(sourceUrl: string, stock: StockMap): ItemImage | null {
  let host: string;
  try {
    host = new URL(sourceUrl).hostname;
  } catch {
    return null;
  }
  for (const [suffix, img] of Object.entries(stock.by_domain)) {
    if (host === suffix || host.endsWith("." + suffix)) return { ...img };
  }
  return null;
}

/** Walk the ranked candidates; first photo wins, a logo-shaped image is held
    as fallback only. Every trial file except the winner's is deleted. */
async function imageFromSources(
  item: { id: string; source_url: string; secondary_urls?: string[]; sources?: { url: string; class: string }[] },
): Promise<ItemImage | null> {
  const written = new Set<string>();
  let logoFallback: (ItemImage & { file: string }) | null = null;

  const finish = (winner: (ItemImage & { file: string }) | null): ItemImage | null => {
    for (const f of written) {
      if (!winner || f !== winner.file) rmSync(join(OUT_DIR, f), { force: true });
    }
    if (!winner) return null;
    const { file: _file, ...img } = winner;
    return img;
  };

  for (const cand of await candidatesFor(item)) {
    const html = await fetchText(cand.url);
    const metaImage = html ? findMetaImage(html) : null;
    if (!metaImage) continue;
    const dl = await downloadImage(metaImage, item.id);
    if (!dl) continue;
    written.add(dl.file);
    const host = hostOf(cand.url) ?? cand.url;
    const img: ItemImage & { file: string } = {
      src: dl.src,
      credit: `Image: ${host}`,
      origin_url: cand.url,
      file: dl.file,
    };
    if (fitFor(dl.dim)) {
      // Logo-shaped: usable, but keep looking for a real photo first.
      if (!logoFallback) logoFallback = img;
      continue;
    }
    return finish(img);
  }
  return finish(logoFallback);
}

async function main(): Promise<void> {
  const itemsPath = "src/data/items.json";
  const data = JSON.parse(readFileSync(itemsPath, "utf8")) as ItemsFile;
  const stock = JSON.parse(readFileSync("src/data/stock-images.json", "utf8")) as StockMap;

  // --redo id1,id2,...: forget these items' current decision and files.
  const redoArg = process.argv.find((a) => a.startsWith("--redo"));
  const redoIds = new Set(
    (redoArg?.includes("=") ? redoArg.split("=")[1]! : process.argv[process.argv.indexOf("--redo") + 1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  for (const id of redoIds) {
    const item = data.items.find((i) => i.id === id);
    if (!item) {
      console.warn(`--redo: no item ${id}`);
      continue;
    }
    delete (item as { image?: unknown }).image;
    for (const f of readdirSync(OUT_DIR)) {
      if (f.startsWith(id + ".")) rmSync(join(OUT_DIR, f), { force: true });
    }
  }

  let stamped = 0;
  for (const item of data.items) {
    if (item.image !== undefined) continue; // already decided, even if null

    let image: ItemImage | null = null;

    // A file dropped in by hand keeps working as a manual override.
    const existing = ["jpg", "png", "webp", "gif"]
      .map((e) => `${item.id}.${e}`)
      .find((f) => existsSync(join(OUT_DIR, f)));
    if (existing) {
      image = {
        src: `/img/items/${existing}`,
        credit: `Image: ${new URL(item.source_url).hostname}`,
        origin_url: item.source_url,
      };
    }

    if (!image) image = await imageFromSources(item);
    if (!image) image = stockFor(item.source_url, stock);

    if (image) {
      const fit = fitForLocalSrc(image.src);
      if (fit) image.fit = fit;
      const dims = dimsForLocalSrc(image.src);
      if (dims) {
        image.width = dims.w;
        image.height = dims.h;
      }
    }

    item.image = image; // may be null: generated tile, and we stop retrying
    stamped++;
    console.log(`${item.id}: ${image ? `${image.src} (from ${image.origin_url ?? "stock"})` : "no image, tile"}`);
  }

  // Backfill fit on images stamped before this pass existed. Idempotent:
  // re-evaluates each item's re-hosted file and only rewrites on a real
  // change, so a settled feed produces no diff.
  let refit = 0;
  let sized = 0;
  for (const item of data.items) {
    if (!item.image) continue;
    const want = fitForLocalSrc(item.image.src);
    if (want !== item.image.fit) {
      if (want) item.image.fit = want;
      else delete item.image.fit;
      refit++;
    }
    const dims = dimsForLocalSrc(item.image.src);
    if (dims && (item.image.width !== dims.w || item.image.height !== dims.h)) {
      item.image.width = dims.w;
      item.image.height = dims.h;
      sized++;
    }
  }

  if (stamped > 0 || refit > 0 || sized > 0) {
    writeFileSync(itemsPath, JSON.stringify(data, null, 2) + "\n");
  }
  console.log(`fetch-thumbs: ${stamped} item(s) stamped, ${refit} refit, ${sized} sized`);
}

await main();
