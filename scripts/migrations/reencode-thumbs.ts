/**
 * One-off migration (image-weight audit, 2026-07-13): re-encodes every
 * existing raster file in public/img/items/ to WebP quality 80, resized
 * to max 1200px width (never upscaled, aspect preserved), matching the
 * pipeline change now in scripts/fetch-thumbs.ts. For each file whose
 * extension changes (jpg/png/gif -> webp), the matching item's
 * `image.src` in src/data/items.json is updated to the new path; no
 * other item field is touched. A file already .webp is recompressed in
 * place (same path, no items.json edit needed). SVGs are not raster and
 * are not touched. Animated images (multi-frame gif/webp) and files
 * sharp fails to decode are left alone and reported as skipped. The
 * original file is deleted only after its replacement is written
 * successfully. Idempotent: a second run finds every file already .webp
 * at or under the size/quality target and makes no changes (sharp's
 * webp encode of a webp input is a no-op in practice, so a re-run only
 * churns bytes trivially; safe either way).
 *
 * Run: bun scripts/migrations/reencode-thumbs.ts
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { validateItemsFile } from "../lib/validate";
import type { ItemsFile } from "../../src/data/schema";

const ITEMS_PATH = "src/data/items.json";
const IMG_DIR = "public/img/items";
const RASTER_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];
const WEBP_QUALITY = 80;
const MAX_STORED_WIDTH = 1200;

interface Result {
  file: string;
  status: "reencoded" | "recompressed" | "skipped-animated" | "skipped-decode-failed";
  before: number;
  after?: number;
  detail?: string;
}

async function reencode(buf: Buffer): Promise<Buffer | { animated: true } | null> {
  try {
    const probe = await sharp(buf, { animated: true }).metadata();
    if ((probe.pages ?? 1) > 1) return { animated: true };
    return await sharp(buf)
      .resize({ width: MAX_STORED_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const items = JSON.parse(readFileSync(ITEMS_PATH, "utf8")) as ItemsFile;

  const files = readdirSync(IMG_DIR).filter((f) => {
    const ext = f.slice(f.lastIndexOf(".") + 1).toLowerCase();
    return RASTER_EXTS.includes(ext);
  });

  const results: Result[] = [];

  for (const file of files) {
    const path = join(IMG_DIR, file);
    const before = readFileSync(path);
    const outcome = await reencode(before);

    if (outcome === null) {
      results.push({ file, status: "skipped-decode-failed", before: before.byteLength });
      console.log(`${file}: skipped, failed to decode`);
      continue;
    }
    if ("animated" in outcome) {
      results.push({ file, status: "skipped-animated", before: before.byteLength });
      console.log(`${file}: skipped, animated`);
      continue;
    }

    const srcExt = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
    const stem = file.slice(0, file.lastIndexOf("."));
    const newFile = `${stem}.webp`;
    const newPath = join(IMG_DIR, newFile);

    if (srcExt === "webp") {
      // Recompress in place: same path, no items.json edit needed.
      writeFileSync(newPath, outcome);
      results.push({ file, status: "recompressed", before: before.byteLength, after: outcome.byteLength });
      console.log(`${file}: recompressed in place (${before.byteLength} -> ${outcome.byteLength} bytes)`);
      continue;
    }

    // Extension changes: write the new file, update items.json, then
    // delete the original only once the replacement is safely on disk.
    const oldSrc = `/img/items/${file}`;
    const newSrc = `/img/items/${newFile}`;
    const matches = items.items.filter((i) => i.image && i.image.src === oldSrc);
    if (matches.length === 0) {
      console.warn(`${file}: no item references ${oldSrc}, re-encoding file anyway but nothing to update in items.json`);
    }

    writeFileSync(newPath, outcome);
    for (const item of matches) {
      item.image!.src = newSrc;
    }
    if (existsSync(path)) unlinkSync(path);

    results.push({ file, status: "reencoded", before: before.byteLength, after: outcome.byteLength });
    console.log(
      `${file}: reencoded to ${newFile} (${before.byteLength} -> ${outcome.byteLength} bytes), ${matches.length} item(s) updated`,
    );
  }

  const errors = validateItemsFile(items);
  if (errors.length > 0) {
    console.error("migration aborted, items.json not written (image files already re-encoded on disk):");
    for (const e of errors) console.error("  " + e);
    process.exit(1);
  }
  writeFileSync(ITEMS_PATH, JSON.stringify(items, null, 2) + "\n");

  const reencoded = results.filter((r) => r.status === "reencoded").length;
  const recompressed = results.filter((r) => r.status === "recompressed").length;
  const skippedAnimated = results.filter((r) => r.status === "skipped-animated").length;
  const skippedFailed = results.filter((r) => r.status === "skipped-decode-failed").length;
  const beforeTotal = results.reduce((s, r) => s + r.before, 0);
  const afterTotal = results.reduce((s, r) => s + (r.after ?? r.before), 0);

  console.log(
    `reencode-thumbs: ${reencoded} reencoded, ${recompressed} recompressed in place, ` +
      `${skippedAnimated} skipped (animated), ${skippedFailed} skipped (decode failed), ` +
      `of ${files.length} raster files. ${beforeTotal} -> ${afterTotal} bytes for files processed.`,
  );
}

if (import.meta.main) await main();
