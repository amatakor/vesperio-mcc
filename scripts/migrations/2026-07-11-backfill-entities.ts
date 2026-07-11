/**
 * One-off migration (plan Phase 7, entity linking): stamps `entities` on
 * every existing item by resolving companies[] through the registry alias
 * index, exactly as finalize-sweep now does for new items. Deterministic,
 * idempotent (re-running recomputes the same refs), touches nothing else
 * on the item. Items whose companies match no profile stay unstamped.
 *
 * Run: bun scripts/migrations/2026-07-11-backfill-entities.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRegistryIndex, matchCompanyRefs } from "../lib/crossfeed";
import { validateItemsFile } from "../lib/validate";
import type { ItemsFile } from "../../src/data/schema";

const DATA_DIR = "src/data";

function main(): void {
  const itemsPath = join(DATA_DIR, "items.json");
  const items = JSON.parse(readFileSync(itemsPath, "utf8")) as ItemsFile;
  const index = loadRegistryIndex(DATA_DIR);

  let stamped = 0;
  let unmatched = 0;
  for (const item of items.items) {
    const refs = matchCompanyRefs(index, item.companies);
    if (refs.length > 0) {
      item.entities = refs;
      stamped++;
    } else {
      delete item.entities;
      unmatched++;
    }
  }

  const errors = validateItemsFile(items);
  if (errors.length > 0) {
    console.error("migration aborted, nothing written:");
    for (const e of errors) console.error("  " + e);
    process.exit(1);
  }
  writeFileSync(itemsPath, JSON.stringify(items, null, 2) + "\n");
  console.log(
    `backfill-entities: ${stamped} items stamped, ${unmatched} with no registry match (of ${items.items.length}).`,
  );
}

if (import.meta.main) main();
