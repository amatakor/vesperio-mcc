/**
 * Item artwork pipeline, deterministic, no LLM. For every item without
 * an image field:
 *
 *   1. Fetch the item's own source_url page and use its og:image /
 *      twitter:image (the image the publisher designates for link
 *      previews), re-hosted under public/img/items/{id}.{ext} with a
 *      credit naming the source host and a link to the source page.
 *   2. Otherwise fall back to the curated freely licensed stock map in
 *      src/data/stock-images.json, keyed by source hostname suffix.
 *   3. Otherwise stamp image: null; the site renders a generated tile.
 *
 * Never image search, never generated imagery, never agency seals.
 * Runs in the sweep workflow between the agent and the build.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ItemsFile, ItemImage } from "../src/data/schema";

const UA = "MCC-Vesperio thumbnail fetcher (mcc.vesperio.ai; mail@florianwardell.com)";
const MAX_BYTES = 3 * 1024 * 1024;
const OUT_DIR = "public/img/items";

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

async function downloadImage(url: string, id: string): Promise<string | null> {
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
    mkdirSync(OUT_DIR, { recursive: true });
    const file = `${id}.${ext}`;
    writeFileSync(join(OUT_DIR, file), buf);
    return `/img/items/${file}`;
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

async function main(): Promise<void> {
  const itemsPath = "src/data/items.json";
  const data = JSON.parse(readFileSync(itemsPath, "utf8")) as ItemsFile;
  const stock = JSON.parse(readFileSync("src/data/stock-images.json", "utf8")) as StockMap;

  let stamped = 0;
  for (const item of data.items) {
    if (item.image !== undefined) continue; // already decided, even if null

    let image: ItemImage | null = null;

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

    if (!image) {
      const html = await fetchText(item.source_url);
      const metaImage = html ? findMetaImage(html) : null;
      if (metaImage) {
        const src = await downloadImage(metaImage, item.id);
        if (src) {
          image = {
            src,
            credit: `Image: ${new URL(item.source_url).hostname}`,
            origin_url: item.source_url,
          };
        }
      }
    }

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
    console.log(`${item.id}: ${image ? image.src : "no image, tile"}`);
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
