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

    item.image = image; // may be null: generated tile, and we stop retrying
    stamped++;
    console.log(`${item.id}: ${image ? image.src : "no image, tile"}`);
  }

  if (stamped > 0) {
    writeFileSync(itemsPath, JSON.stringify(data, null, 2) + "\n");
  }
  console.log(`fetch-thumbs: ${stamped} item(s) stamped`);
}

await main();
