/** Validates items.json, held.json, state.json, and sources.json. Exits 1 on any violation. */

import { loadJson, report } from "./lib/run-checks";
import {
  validateItemsFile,
  validateHeldFile,
  validateStateFile,
  validateSourcesFile,
} from "./lib/validate";

const errors: string[] = [];

const items = loadJson("src/data/items.json", errors);
if (items !== undefined) errors.push(...validateItemsFile(items));

const held = loadJson("src/data/held.json", errors);
if (held !== undefined) errors.push(...validateHeldFile(held));

const state = loadJson("src/data/state.json", errors);
if (state !== undefined) errors.push(...validateStateFile(state));

const sources = loadJson("src/data/sources.json", errors);
if (sources !== undefined) errors.push(...validateSourcesFile(sources));

report("check-feed", errors);
