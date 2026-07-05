/**
 * Validates every profile under src/data/registry/{constellations,vehicles}.
 * Missing directories mean zero profiles, which is valid (pre-Task 4 state).
 * Exits 1 on any violation.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { loadJson, report } from "./lib/run-checks";
import { validateRegistryProfile } from "./lib/validate";

const errors: string[] = [];
let count = 0;

const kinds = [
  { dir: "src/data/registry/constellations", type: "constellation" as const },
  { dir: "src/data/registry/vehicles", type: "vehicle" as const },
  { dir: "src/data/registry/spaceports", type: "spaceport" as const },
  { dir: "src/data/registry/organizations", type: "organization" as const },
];

// Constellation parent links must point at an existing constellation.
{
  const dir = "src/data/registry/constellations";
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    const slugs = new Set(files.map((f) => basename(f, ".json")));
    for (const file of files) {
      try {
        const p = JSON.parse(readFileSync(join(dir, file), "utf8")) as { parent?: string | null };
        if (p.parent && !slugs.has(p.parent)) {
          errors.push(`constellations/${file}: parent "${p.parent}" does not exist`);
        }
      } catch {
        /* parse errors surface in the main loop */
      }
    }
  }
}

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
