/**
 * One-off migration (audit Phase 4, 2026-07-08): stamp kind: "event" on
 * every existing item. Touches no other item content; new drafts default
 * to "event" in finalize-sweep and may declare "commentary" explicitly.
 *
 * Usage: bun scripts/migrations/2026-07-08-item-kind.ts
 */
import { readFileSync } from "node:fs";
import { writeJsonAtomic } from "../lib/write-json-atomic";

const PATH = "src/data/items.json";
const data = JSON.parse(readFileSync(PATH, "utf8")) as { items: Record<string, unknown>[] };
let stamped = 0;
for (const item of data.items) {
  if (item.kind === undefined) {
    // keep field order readable: rebuild with kind after explainer
    item.kind = "event";
    stamped++;
  }
}
writeJsonAtomic(PATH, data);
console.log(`item-kind migration: ${stamped} item(s) stamped kind: "event"`);
