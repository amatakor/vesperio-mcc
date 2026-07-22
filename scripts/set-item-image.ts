/**
 * Florian-directed thumbnail override (2026-07-13). The deterministic
 * pipeline takes a page's og:image, which is sometimes a publisher's
 * generic header graphic while a better photograph sits in the article
 * body (the ESA 2026 Space Economy Report's glowing-hands header vs its
 * Ariane 6 liftoff figure). This tool swaps an item's artwork for a
 * SPECIFIC image chosen by Florian (or an interactive session on his
 * instruction), under the same policy the pipeline enforces:
 *
 *  - the image must live on one of the item's OWN linked source pages'
 *    registrable domains (never image search, never an unrelated host);
 *  - the same gates apply: minimum dimensions, no ad shapes, WebP
 *    re-encode at the pipeline's quality/size caps;
 *  - the credit names and links the origin, and removal-on-request
 *    still works by nulling the item's image.
 *
 * Scheduled agents never run this (not in any workflow allowlist);
 * drafting agents still never choose images.
 *
 * Usage: bun scripts/set-item-image.ts --item <id> --url <image-url> [--page <origin-page-url>] [--no-trim]
 *
 * Near-white letterbox borders are shaved automatically (see
 * trimWhiteBorders in fetch-thumbs.ts); --no-trim keeps the image
 * exactly as the source serves it.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { writeJsonAtomic } from "./lib/write-json-atomic";
import { fetchSafe } from "./lib/fetch-safe";
import { registrableDomain } from "./lib/urls";
import { imageSize, reencodeForStorage, decodesAsQr, MIN_DIMENSION, MAX_ASPECT } from "./fetch-thumbs";
import type { ItemsFile, Item } from "../src/data/schema";

const OUT_DIR = "public/img/items";
const ITEMS_PATH = "src/data/items.json";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? null) : null;
}

function fail(msg: string): never {
  console.error(`set-item-image: ${msg}`);
  process.exit(1);
}

const itemId = arg("item") ?? fail("--item <id> required");
const imageUrl = arg("url") ?? fail("--url <image-url> required");

const data = JSON.parse(readFileSync(ITEMS_PATH, "utf8")) as ItemsFile;
const item: Item | undefined = data.items.find((i) => i.id === itemId);
if (!item) fail(`no item with id "${itemId}"`);

/**
 * Known source-media CDNs, exact host -> the source's registrable
 * domain (Florian, 2026-07-22). Some sources serve their own images
 * from a bucket host (Launch Library's TheSpaceDevs media bucket), so
 * the registrable-domain proxy for "lives on a source page" fails on
 * exactly those images. Exact hosts only, never a shared CDN's
 * registrable domain: allowing digitaloceanspaces.com wholesale would
 * admit every tenant's bucket.
 */
const CDN_HOST_ALIASES: Record<string, string> = {
  "thespacedevs-prod.nyc3.digitaloceanspaces.com": "thespacedevs.com",
};

function imageDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const alias = CDN_HOST_ALIASES[host];
    if (alias) return alias;
  } catch {
    return null;
  }
  return registrableDomain(url);
}

// The image must come from one of the item's own linked source pages.
const linked = [item.source_url, ...item.secondary_urls, ...(item.sources ?? []).map((s) => s.url)];
const allowed = new Set(linked.map((u) => registrableDomain(u)).filter(Boolean));
const imgDomain = imageDomain(imageUrl);
if (!imgDomain || !allowed.has(imgDomain)) {
  fail(
    `"${imageUrl}" is not on any of the item's linked source domains [${[...allowed].join(", ")}]; ` +
      `the policy allows overrides only from the item's own sources`,
  );
}
const page = arg("page") ?? linked.find((u) => registrableDomain(u) === imgDomain)!;

const ext = imageUrl.split("?")[0]!.split(".").pop()!.toLowerCase();
if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
  fail(`unsupported image extension ".${ext}" (raster formats only, never svg)`);
}

const res = await fetchSafe(imageUrl);
const buf = res.bytes;
const dim = imageSize(buf);
if (!dim) fail("could not parse image dimensions");
if (dim.w < MIN_DIMENSION || dim.h < MIN_DIMENSION) fail(`too small: ${dim.w}x${dim.h}`);
const aspect = dim.w / dim.h;
if (aspect > MAX_ASPECT || aspect < 1 / MAX_ASPECT) fail(`ad-shaped aspect: ${dim.w}x${dim.h}`);
if (await decodesAsQr(buf)) fail("image decodes as a QR code; never artwork");

const reencoded = await reencodeForStorage(buf, ext, {
  trim: !process.argv.includes("--no-trim"),
});
const outExt = reencoded ? "webp" : ext;
const outBuf = reencoded ?? Buffer.from(buf);
const meta = await sharp(outBuf).metadata();

mkdirSync(OUT_DIR, { recursive: true });
const file = `${itemId}.${outExt}`;
writeFileSync(join(OUT_DIR, file), outBuf);

item.image = {
  src: `/img/items/${file}`,
  credit: `Image: ${new URL(page).hostname.replace(/^www\./, "")}`,
  origin_url: page,
  ...(meta.width && meta.height ? { width: meta.width, height: meta.height } : {}),
} as Item["image"];

writeJsonAtomic(ITEMS_PATH, data);
console.log(`set-item-image: ${itemId} -> ${file} (${meta.width}x${meta.height}, from ${imgDomain})`);
