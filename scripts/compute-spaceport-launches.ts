/**
 * Fills launches_total on every spaceport profile that carries an
 * ll2_location_id, from the committed Orbits spaceports file
 * (public/data/orbits/spaceports.json), which the Orbits pipeline already
 * fetches from Launch Library 2 (fetch-spaceports.ts, twice daily).
 *
 * This makes launches_total a COMPUTED field (plan Phase 8, should-fix 10),
 * the exact mirror of sats_active_verified in compute-fleet-counts.ts: the
 * value is authoritative only for what it measures (LL2's cumulative launch
 * count for that location), stamped with the location's LL2 record as source
 * and the spaceports fetch date as as_of. It is no longer LLM-maintained;
 * launches_total is dropped from the crawl's fillable spaceport fields.
 *
 * The field is machine-owned once computed from LL2/Orbits data: this script
 * refreshes it when it is null or was previously set from an LL2/Orbits
 * source. When a profile instead carries a value from some OTHER source (a
 * genuine claim), the computed count does NOT silently clobber it; the
 * divergence is logged and the claim is left in place, matching the registry
 * rule that a computed figure never overwrites a claim (it only annotates).
 *
 * Belongs in the Orbits workflow (update-orbits.yml) right after
 * fetch-spaceports.ts, the same slot compute-fleet-counts.ts occupies after
 * fetch-elements.ts.
 *
 * Usage: bun scripts/compute-spaceport-launches.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrbitsSpaceportsFile } from "../src/data/schema";
import { writeJsonAtomic } from "./lib/write-json-atomic";

const SPACEPORTS = "src/data/registry/spaceports";
const ORBITS_FILE = "public/data/orbits/spaceports.json";

/** True when a source URL is an LL2 / Orbits-derived record (machine-owned). */
function isLl2Source(source: unknown): boolean {
  return typeof source === "string" && /(?:^|\.)thespacedevs\.com\//i.test(source);
}

if (!existsSync(ORBITS_FILE)) {
  console.error(`compute-spaceport-launches: ${ORBITS_FILE} missing, run fetch-spaceports.ts first`);
  process.exit(1);
}

const orbits = JSON.parse(readFileSync(ORBITS_FILE, "utf8")) as OrbitsSpaceportsFile;
const asOf = orbits.fetched_at.slice(0, 10);
// Deep-linked LL2 location record: the exact page the count is read from.
const base = orbits.source.endsWith("/") ? orbits.source : `${orbits.source}/`;
const byId = new Map(orbits.spaceports.map((s) => [s.ll2_id, s.total_launch_count]));

let filled = 0;
let skipped = 0;
let annotated = 0;
for (const file of readdirSync(SPACEPORTS).filter((f) => f.endsWith(".json")).sort()) {
  const path = join(SPACEPORTS, file);
  const profile = JSON.parse(readFileSync(path, "utf8"));

  const ll2Id = profile.ll2_location_id?.value;
  if (typeof ll2Id !== "number") {
    skipped++;
    continue; // no LL2 mapping: not ours to compute
  }
  if (!byId.has(ll2Id)) {
    console.error(`${profile.slug}: LL2 location ${ll2Id} not in orbits spaceports (inactive site), left unchanged`);
    skipped++;
    continue;
  }

  const next = {
    value: byId.get(ll2Id)!,
    source: `${base}locations/${ll2Id}/`,
    as_of: asOf,
  };
  const cur = profile.launches_total;

  // A non-LL2 claim is never silently overwritten by the computed count.
  if (cur && cur.value !== null && !isLl2Source(cur.source)) {
    if (cur.value !== next.value) {
      console.warn(
        `${profile.slug}: claimed launches_total ${cur.value} (${cur.source}) differs from computed ${next.value}, claim kept`,
      );
      annotated++;
    }
    continue;
  }

  if (cur && cur.value === next.value && cur.source === next.source && cur.as_of === next.as_of) {
    continue; // already current
  }
  profile.launches_total = next;
  writeJsonAtomic(path, profile);
  filled++;
  console.log(`${profile.slug}: ${next.value} launches (as of ${next.as_of})`);
}
console.log(
  `\ncompute-spaceport-launches: ${filled} updated, ${annotated} claim(s) kept, ${skipped} skipped`,
);
