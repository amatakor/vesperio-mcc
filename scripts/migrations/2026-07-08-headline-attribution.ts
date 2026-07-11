/**
 * One-off migration (Florian, 2026-07-08): outlet attribution leaves the
 * HEADLINE. Cards display events, not articles; the sourcing lives in the
 * copy ("per SpaceNews"), the sources list, and the SNR trace. Strips a
 * leading "<Outlet>: " prefix from existing headlines when the prefix is
 * a known outlet name (never an actor). Touches nothing else on the item.
 *
 * Usage: bun scripts/migrations/2026-07-08-headline-attribution.ts
 */
import { readFileSync } from "node:fs";
import { writeJsonAtomic } from "../lib/write-json-atomic";

const OUTLETS = new Set([
  "SpaceNews",
  "Via Satellite",
  "Payload",
  "European Spaceflight",
  "Space.com",
  "Euronews",
  "Business Standard",
  "Converge Digest",
  "SpaceflightNow",
  "NASASpaceflight",
  "SpacePolicyOnline",
  "Ars Technica",
  "Reuters",
  "CNBC",
  "BBC",
]);

const PATH = "src/data/items.json";
const data = JSON.parse(readFileSync(PATH, "utf8")) as { items: { headline: string; id: string }[] };
let changed = 0;
for (const item of data.items) {
  const m = /^([A-Za-z .&'@]+?):\s+(.+)$/.exec(item.headline);
  if (m && OUTLETS.has(m[1]!)) {
    item.headline = m[2]!;
    changed++;
    console.log(`  ${item.id}: dropped "${m[1]}:" prefix`);
  }
}
writeJsonAtomic(PATH, data);
console.log(`headline-attribution migration: ${changed} headline(s) cleaned`);
