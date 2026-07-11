/** Validates items.json, held.json, state.json, sources.json, source_ledger.json, and signals_suggestions.json. Exits 1 on any violation. */

import { loadJson, report } from "./lib/run-checks";
import {
  validateItemsFile,
  validateHeldFile,
  validateStateFile,
  validateSourcesFile,
  validateSourceLedgerFile,
  validateSignalsSuggestionsFile,
  validateRegistryCandidatesFile,
} from "./lib/validate";

const errors: string[] = [];

const items = loadJson("src/data/items.json", errors);
if (items !== undefined) {
  errors.push(...validateItemsFile(items));
  // Future-date bound (plan Phase 8): items report things that happened.
  // Two days of slack absorbs timezone edges; anything past that is a
  // typo or a fabricated date.
  const limit = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const list = (items as { items?: { id?: string; date?: string }[] }).items ?? [];
  for (const it of list) {
    if (typeof it.date === "string" && it.date > limit) {
      errors.push(`items.${it.id ?? "?"}: event date ${it.date} is in the future (limit ${limit})`);
    }
  }
}

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

const registryCandidates = loadJson("src/data/registry-candidates.json", errors);
if (registryCandidates !== undefined) errors.push(...validateRegistryCandidatesFile(registryCandidates));

report("check-feed", errors);
