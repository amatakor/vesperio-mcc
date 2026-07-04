/** Validates signals.json (hand-curated; the agent never edits it). Exits 1 on any violation. */

import { loadJson, report } from "./lib/run-checks";
import { validateSignalsFile } from "./lib/validate";

const errors: string[] = [];

const signals = loadJson("src/data/signals.json", errors);
if (signals !== undefined) errors.push(...validateSignalsFile(signals));

report("check-signals", errors);
