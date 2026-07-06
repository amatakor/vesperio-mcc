/** Validates items.json, held.json, state.json, sources.json, source_ledger.json, and signals_suggestions.json. Exits 1 on any violation. */

import { loadJson, report } from "./lib/run-checks";
import {
  validateItemsFile,
  validateHeldFile,
  validateStateFile,
  validateSourcesFile,
  validateSourceLedgerFile,
  validateSignalsSuggestionsFile,
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

const ledger = loadJson("src/data/source_ledger.json", errors);
if (ledger !== undefined) errors.push(...validateSourceLedgerFile(ledger));

const suggestions = loadJson("src/data/signals_suggestions.json", errors);
if (suggestions !== undefined) errors.push(...validateSignalsSuggestionsFile(suggestions));

report("check-feed", errors);
