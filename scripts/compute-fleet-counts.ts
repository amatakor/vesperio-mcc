/**
 * Fills sats_active_verified on every constellation profile that has an
 * Orbits CelesTrak mapping, by counting the records in the committed
 * element set (public/data/orbits/elements-<slug>.json).
 *
 * The value is a tracking count: objects currently listed in CelesTrak's
 * catalog for the constellation's query, not an operator claim about
 * satellite health. Source = the exact CelesTrak query URL recorded in
 * the element file; as_of = the element fetch date. The field is
 * machine-owned: this script overwrites it on every run and the cron
 * that refreshes element sets should run it afterwards.
 *
 * Usage: bun scripts/compute-fleet-counts.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeJsonAtomic } from "./lib/write-json-atomic";

const CONSTELLATIONS = "src/data/registry/constellations";
const ELEMENTS = "public/data/orbits";

let filled = 0;
let skipped = 0;
for (const file of readdirSync(CONSTELLATIONS).filter((f) => f.endsWith(".json")).sort()) {
  const path = join(CONSTELLATIONS, file);
  const profile = JSON.parse(readFileSync(path, "utf8"));
  if (!profile.orbits) continue;

  const elementsPath = join(ELEMENTS, `elements-${profile.slug}.json`);
  if (!existsSync(elementsPath)) {
    console.error(`${profile.slug}: orbits mapping but no element file, left unchanged`);
    skipped++;
    continue;
  }
  const elements = JSON.parse(readFileSync(elementsPath, "utf8"));
  if (typeof elements.source !== "string" || typeof elements.fetched_at !== "string") {
    console.error(`${profile.slug}: element file missing source/fetched_at, left unchanged`);
    skipped++;
    continue;
  }
  const next = {
    value: Array.isArray(elements.records) ? elements.records.length : 0,
    source: elements.source,
    as_of: elements.fetched_at.slice(0, 10),
  };
  const cur = profile.sats_active_verified;
  if (cur && cur.value === next.value && cur.source === next.source && cur.as_of === next.as_of) {
    continue;
  }
  profile.sats_active_verified = next;
  writeJsonAtomic(path, profile);
  filled++;
  console.log(`${profile.slug}: ${next.value} tracked (as of ${next.as_of})`);
}
console.log(`\ncompute-fleet-counts: ${filled} updated, ${skipped} skipped`);
