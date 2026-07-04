/**
 * Validates every profile under src/data/registry/{constellations,vehicles}.
 * Missing directories mean zero profiles, which is valid (pre-Task 4 state).
 * Exits 1 on any violation.
 */

import { existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { loadJson, report } from "./lib/run-checks";
import { validateRegistryProfile } from "./lib/validate";

const errors: string[] = [];
let count = 0;

const kinds = [
  { dir: "src/data/registry/constellations", type: "constellation" as const },
  { dir: "src/data/registry/vehicles", type: "vehicle" as const },
];

for (const { dir, type } of kinds) {
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    count++;
    const slug = basename(file, ".json");
    const data = loadJson(join(dir, file), errors);
    if (data !== undefined) errors.push(...validateRegistryProfile(data, type, slug));
  }
}

console.log(`check-registry: ${count} profile${count === 1 ? "" : "s"} found`);
report("check-registry", errors);
