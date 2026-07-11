/**
 * Validates the Orbits data files under public/data/orbits/ against the
 * schema: elements-*.json, spaceports.json, facilities.json. Cross-checks
 * that elements files belong to registry constellations and that facility
 * pins link to existing registry profiles. Exits 1 on any violation.
 *
 * A mapped constellation without an elements file is a warning, not an
 * error: the first fetch may legitimately not have run yet, and a build
 * must not fail because CelesTrak had nothing for one operator.
 */

import { existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { loadJson, report } from "./lib/run-checks";
import {
  validateElementsFile,
  validateSpaceportsFile,
  validateFacilitiesFile,
  validateGroundStationsFile,
  validateStatsFile,
} from "./lib/validate";

const DATA_DIR = "public/data/orbits";
const errors: string[] = [];

const registrySlugs = new Set<string>();
const mappedSlugs = new Set<string>();
for (const dir of [
  "src/data/registry/constellations",
  "src/data/registry/organizations",
]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    registrySlugs.add(basename(f, ".json"));
    if (dir.endsWith("constellations")) {
      const p = loadJson(join(dir, f), errors) as { orbits?: unknown } | undefined;
      if (p?.orbits) mappedSlugs.add(basename(f, ".json"));
    }
  }
}

let elementsCount = 0;
if (existsSync(DATA_DIR)) {
  for (const f of readdirSync(DATA_DIR).filter((f) => f.startsWith("elements-")).sort()) {
    elementsCount++;
    const slug = basename(f, ".json").replace(/^elements-/, "");
    if (!registrySlugs.has(slug)) {
      errors.push(`${f}: no registry constellation "${slug}"`);
    }
    const data = loadJson(join(DATA_DIR, f), errors);
    if (data !== undefined) {
      errors.push(...validateElementsFile(data, f));
      const con = (data as { constellation?: unknown }).constellation;
      if (typeof con === "string" && con !== slug) {
        errors.push(`${f}: constellation "${con}" does not match filename`);
      }
    }
    mappedSlugs.delete(slug);
  }
}
for (const slug of [...mappedSlugs].sort()) {
  console.warn(`check-orbits: warning: mapped constellation "${slug}" has no elements file yet`);
}

const spaceportsPath = join(DATA_DIR, "spaceports.json");
const spaceports = loadJson(spaceportsPath, errors);
if (spaceports !== undefined) errors.push(...validateSpaceportsFile(spaceports));

const statsPath = join(DATA_DIR, "stats.json");
const stats = loadJson(statsPath, errors);
if (stats !== undefined) errors.push(...validateStatsFile(stats));

const facilitiesPath = join(DATA_DIR, "facilities.json");
const facilities = loadJson(facilitiesPath, errors);
if (facilities !== undefined) {
  errors.push(...validateFacilitiesFile(facilities));
  const list = (facilities as { facilities?: unknown }).facilities;
  if (Array.isArray(list)) {
    list.forEach((f, i) => {
      const slug = (f as { operator_slug?: unknown }).operator_slug;
      if (typeof slug === "string" && !registrySlugs.has(slug)) {
        errors.push(`facilities[${i}].operator_slug: no registry profile "${slug}"`);
      }
    });
  }
}

const groundStationsPath = join(DATA_DIR, "ground-stations.json");
const groundStations = loadJson(groundStationsPath, errors);
if (groundStations !== undefined) errors.push(...validateGroundStationsFile(groundStations));

console.log(
  `check-orbits: ${elementsCount} elements files + spaceports + facilities + ground stations`,
);
report("check-orbits", errors);
