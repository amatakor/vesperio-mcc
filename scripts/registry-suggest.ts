/**
 * Registry coverage-gap suggestions (CLAUDE.md "Registry rules": entries
 * are created only via reviewed @claude issues, never by a scheduled
 * run). Half the feed names companies with no registry profile, so
 * those items can never feed the registry and nobody sees the gap. This
 * script SUGGESTS, deterministically, over src/data/items.json: for
 * every company name in an item's companies[] that resolves to NO
 * registry entity, aggregate by normalized name and flag it once it
 * appears on 2+ items within the last 90 days.
 *
 * Company resolution is imported, never reimplemented: loadRegistryIndex
 * + matchCompanies from scripts/lib/crossfeed.ts are the exact functions
 * finalize-sweep uses to stamp Item.entities (registry index +
 * aliases.json). A name matchCompanies resolves is out of scope here
 * entirely, whatever the aggregation would otherwise say.
 *
 * Idempotent (src/data/registry_suggestions.json): rerunning recomputes
 * every count fresh, but an existing entry's status survives when it is
 * "dismissed" or "created" (Florian's decisions are never overwritten),
 * and a "pending" entry that no longer qualifies is dropped. The agent
 * never creates registry entries from this file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeJsonAtomic } from "./lib/write-json-atomic";
import { loadRegistryIndex, matchCompanies } from "./lib/crossfeed";
import type { RegistryIndex } from "./lib/crossfeed";
import { daysBetween } from "./snr/match";
import { validateRegistrySuggestionsFile } from "./lib/validate";
import type { Item, ItemsFile, RegistrySuggestion, RegistrySuggestionsFile } from "../src/data/schema";

export const WINDOW_DAYS = 90;
export const MIN_ITEM_COUNT = 2;
export const MAX_ITEM_IDS = 10;

const SUFFIX_RE = /\s+(?:inc\.?|ltd\.?|pbc|sa|gmbh|corp\.?)$/i;

/**
 * trim, collapse whitespace, strip one trailing corporate-suffix token
 * ("Inc."/"Ltd"/"PBC"/"SA"/"GmbH"/"Corp."). `key` is the case-insensitive
 * merge key ("Planet Labs" and "Planet Labs PBC" both key to "planet
 * labs"); `display` keeps the source casing, suffix stripped.
 */
export function normalizeCompanyName(raw: string): { key: string; display: string } {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  const display = collapsed.replace(SUFFIX_RE, "");
  return { key: display.toLowerCase(), display };
}

function withinWindow(itemDate: string, today: string): boolean {
  const d = daysBetween(itemDate, today);
  return d >= 0 && d <= WINDOW_DAYS;
}

interface AggEntry {
  /** display-string variant -> mention count, to pick the majority casing. */
  displayCounts: Map<string, number>;
  /** item id -> the fields the suggestion needs from that item. */
  items: Map<string, { date: string; category: string }>;
}

/**
 * Scans items[] within the 90-day window for companies that resolve to
 * no registry entity, aggregates by normalized name, and returns fresh
 * suggestions for every name on 2+ qualifying items. Every returned
 * suggestion carries status "pending"; status preservation across runs
 * is mergeSuggestions()'s job, not this function's.
 */
export function computeSuggestions(
  items: Item[],
  registryIndex: RegistryIndex,
  today: string,
): RegistrySuggestion[] {
  const agg = new Map<string, AggEntry>();
  for (const item of items) {
    if (!withinWindow(item.date, today)) continue;
    for (const company of item.companies ?? []) {
      if (matchCompanies(registryIndex, [company]).length > 0) continue; // resolves; not a gap
      const { key, display } = normalizeCompanyName(company);
      if (key === "") continue;
      let entry = agg.get(key);
      if (!entry) {
        entry = { displayCounts: new Map(), items: new Map() };
        agg.set(key, entry);
      }
      entry.displayCounts.set(display, (entry.displayCounts.get(display) ?? 0) + 1);
      if (!entry.items.has(item.id)) {
        entry.items.set(item.id, { date: item.date, category: item.category });
      }
    }
  }

  const suggestions: RegistrySuggestion[] = [];
  for (const entry of agg.values()) {
    if (entry.items.size < MIN_ITEM_COUNT) continue;

    // Majority-vote the display casing; tie-break alphabetically so the
    // pick is deterministic regardless of items.json's row order.
    let bestDisplay = "";
    let bestCount = -1;
    for (const [display, count] of [...entry.displayCounts.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      if (count > bestCount) {
        bestCount = count;
        bestDisplay = display;
      }
    }

    const itemList = [...entry.items.entries()].map(([id, v]) => ({ id, ...v }));
    // Newest first (date desc, id desc as a stable tiebreak) for item_ids.
    itemList.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.id.localeCompare(a.id)));

    const dates = itemList.map((i) => i.date).sort();
    const categories: Record<string, number> = {};
    for (const i of itemList) categories[i.category] = (categories[i.category] ?? 0) + 1;

    suggestions.push({
      name: bestDisplay,
      item_count: itemList.length,
      first_seen: dates[0]!,
      last_seen: dates[dates.length - 1]!,
      item_ids: itemList.slice(0, MAX_ITEM_IDS).map((i) => i.id),
      categories,
      status: "pending",
    });
  }

  return sortSuggestions(suggestions);
}

function sortSuggestions(list: RegistrySuggestion[]): RegistrySuggestion[] {
  return list
    .slice()
    .sort(
      (a, b) =>
        b.item_count - a.item_count ||
        b.last_seen.localeCompare(a.last_seen) ||
        a.name.localeCompare(b.name),
    );
}

/**
 * Merges a fresh scan against the previous file's suggestions:
 *   - a fresh (still-qualifying) entry inherits the previous entry's
 *     status when that status is "dismissed" or "created" (Florian's
 *     decision survives a recompute); otherwise it stays "pending".
 *   - a previous "dismissed"/"created" entry that no longer qualifies is
 *     carried over unchanged (the historical record is not deleted just
 *     because the gap closed or the count moved out of window).
 *   - a previous "pending" entry that no longer qualifies is dropped.
 * Matched by normalized name, not exact string, so a display-name shift
 * (a new majority variant) does not orphan a prior decision.
 */
export function mergeSuggestions(
  fresh: RegistrySuggestion[],
  previous: RegistrySuggestion[],
): RegistrySuggestion[] {
  const prevByKey = new Map<string, RegistrySuggestion>();
  for (const s of previous) prevByKey.set(normalizeCompanyName(s.name).key, s);

  const freshKeys = new Set<string>();
  const out: RegistrySuggestion[] = [];
  for (const s of fresh) {
    const key = normalizeCompanyName(s.name).key;
    freshKeys.add(key);
    const prev = prevByKey.get(key);
    if (prev && (prev.status === "dismissed" || prev.status === "created")) {
      out.push({ ...s, status: prev.status });
    } else {
      out.push(s);
    }
  }
  for (const [key, prev] of prevByKey) {
    if (freshKeys.has(key)) continue;
    if (prev.status === "dismissed" || prev.status === "created") out.push(prev);
    // status "pending" and no longer qualifying: dropped.
  }
  return sortSuggestions(out);
}

export interface RegistrySuggestResult {
  suggestions: RegistrySuggestion[];
  added: string[];
  dropped: string[];
}

const SUGGESTIONS_COMMENT =
  'Deterministic registry coverage gaps (CLAUDE.md "Registry rules"): company names on published items that resolve to no registry entity (scripts/lib/crossfeed.ts matchCompanies over the registry index + aliases.json, the exact resolution finalize-sweep uses), aggregated by normalized name and flagged once a name appears on 2+ items within the last 90 days. Suggestions only; registry entries are created only via reviewed @claude issues that Florian reviews. Set an entry\'s status to "dismissed" or "created" by hand; that decision survives every rerun. Written by scripts/registry-suggest.ts.';

export function runRegistrySuggest(dataDir: string, today: string): RegistrySuggestResult {
  const items = (JSON.parse(readFileSync(join(dataDir, "items.json"), "utf8")) as ItemsFile).items;
  const registryIndex = loadRegistryIndex(dataDir);
  const suggestionsPath = join(dataDir, "registry_suggestions.json");

  let previous: RegistrySuggestion[] = [];
  try {
    const raw = readFileSync(suggestionsPath, "utf8");
    const prevFile = JSON.parse(raw) as RegistrySuggestionsFile;
    const errs = validateRegistrySuggestionsFile(prevFile);
    if (errs.length > 0) {
      throw new Error(
        `existing registry_suggestions.json invalid, refusing to run:\n  ${errs.join("\n  ")}`,
      );
    }
    previous = prevFile.suggestions;
  } catch (e) {
    if (!(e instanceof Error) || (e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  const fresh = computeSuggestions(items, registryIndex, today);
  const merged = mergeSuggestions(fresh, previous);

  const file: RegistrySuggestionsFile = {
    $comment: SUGGESTIONS_COMMENT,
    version: "0.1",
    suggestions: merged,
  };
  writeJsonAtomic(suggestionsPath, file);

  const prevKeys = new Set(previous.map((s) => normalizeCompanyName(s.name).key));
  const mergedByKey = new Map(merged.map((s) => [normalizeCompanyName(s.name).key, s]));
  const added = merged
    .filter((s) => !prevKeys.has(normalizeCompanyName(s.name).key))
    .map((s) => s.name);
  const dropped = previous
    .filter((s) => !mergedByKey.has(normalizeCompanyName(s.name).key))
    .map((s) => s.name);

  return { suggestions: merged, added, dropped };
}

if (import.meta.main) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = runRegistrySuggest("src/data", today);
    console.log(
      `registry-suggest: ${r.suggestions.length} suggestion(s) on file ` +
        `(${r.added.length} new, ${r.dropped.length} dropped)`,
    );
    if (r.added.length > 0) console.log(`  new: ${r.added.join(", ")}`);
    if (r.dropped.length > 0) console.log(`  dropped: ${r.dropped.join(", ")}`);
  } catch (e) {
    console.error("registry-suggest: catastrophic failure:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
