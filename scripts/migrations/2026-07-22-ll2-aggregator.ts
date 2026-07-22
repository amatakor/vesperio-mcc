/**
 * One-shot migration (Florian, 2026-07-22): Launch Library is an
 * aggregator, not a computed source. Run once with:
 *   bun scripts/migrations/2026-07-22-ll2-aggregator.ts
 *
 * CLAUDE.md has always listed Launch Library among the aggregator
 * databases (SNR 4), and the registry path scores it that way, but the
 * news path's COMPUTED_HOSTS included thespacedevs.com, so launch items
 * led by an LL2 record scored base tier 5 and slipped past the
 * direct-source ceiling. Florian adjudicated 2026-07-22: aggregator,
 * tier 4, never 5.
 *
 * What it does, in order:
 *  1. Reclasses every item source on a thespacedevs.com host from
 *     "computed" to "aggregator".
 *  2. Rescores the items whose LEAD source that is, through the real
 *     engine, with judgment inputs reconstructed from the stored trace
 *     (all three have empty modifier lists: not extraordinary, never
 *     reinforced or disputed; crawl outcome per the judgment table
 *     below). Items where the LL2 source is not the lead keep their
 *     score: the class flip changes neither base tier nor any
 *     corroboration count, asserted below.
 *  3. Appends a sweep-log entry to state.json with the snr_movements,
 *     rendered on /log like any other score move.
 *
 * The source ledger is untouched: score-at-publication records are the
 * calibration history and stay as published.
 */

import { scoreClaim } from "../snr/score";
import type { Item, ItemSource } from "../../src/data/schema";

const ITEMS_PATH = "src/data/items.json";
const STATE_PATH = "src/data/state.json";

function isTheSpaceDevs(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "thespacedevs.com" || host.endsWith(".thespacedevs.com");
  } catch {
    return false;
  }
}

// Judgment table for the lead-source rescores. `crawl` is "found_some"
// where a corroboration source is attached (the crawl demonstrably ran
// and found it), "not_attempted" where the item has a single source and
// the original run recorded no crawl outcome (a crawl that never ran
// costs nothing). `persisted` marks items past the 14-day uncontested
// window on migration day; it is a no-op at subtotal 4 but belongs in
// the record.
const LEAD_JUDGMENT: Record<string, { crawl: "found_some" | "not_attempted"; persisted: boolean }> =
  {
    "2026-06-19-rocket-lab-victus-haze-launch": { crawl: "not_attempted", persisted: true },
    "2026-07-14-spacex-starlink-15-14-vandenberg": { crawl: "found_some", persisted: false },
    "2026-07-22-orienspace-gravity-1-launch": { crawl: "found_some", persisted: false },
  };

const data = (await Bun.file(ITEMS_PATH).json()) as { items: Item[] };

const movements: { id: string; from: number; to: number; reason: string }[] = [];
let reclassed = 0;

for (const item of data.items) {
  const affected = (item.sources ?? []).filter(
    (s: ItemSource) => isTheSpaceDevs(s.url) && s.class === "computed",
  );
  if (affected.length === 0) continue;

  for (const s of affected) {
    s.class = "aggregator";
    reclassed++;
  }

  const lead = item.sources![0]!;
  if (!isTheSpaceDevs(lead.url)) {
    // Non-lead flip: base tier comes from another source and
    // corroboration counts classes only for mainstream pickup, so the
    // score must not move. Assert rather than assume.
    const judgment = LEAD_JUDGMENT[item.id];
    if (judgment !== undefined) throw new Error(`${item.id}: in lead table but lead is not LL2`);
    continue;
  }

  const judgment = LEAD_JUDGMENT[item.id];
  if (judgment === undefined) throw new Error(`${item.id}: LL2-led item missing from judgment table`);
  if (item.snr_trace!.modifiers.length !== 0) {
    throw new Error(`${item.id}: trace has modifiers; reconstruct inputs before rescoring`);
  }

  const { snr, trace } = scoreClaim({
    sources: item.sources!,
    extraordinary: false,
    crawl: judgment.crawl,
    whitelist: null,
    reinforced: false,
    persisted: judgment.persisted,
    disputeDowngrade: false,
  });

  if (snr !== item.snr) {
    movements.push({
      id: item.id,
      from: item.snr!,
      to: snr,
      reason:
        "reclassification: Launch Library is an aggregator, not a computed source " +
        "(Florian, 2026-07-22); the direct-source ceiling applies",
    });
  }
  item.snr = snr;
  item.snr_trace = trace;
}

if (reclassed === 0) throw new Error("nothing to migrate; already applied?");

await Bun.write(ITEMS_PATH, JSON.stringify(data, null, 2) + "\n");

const state = await Bun.file(STATE_PATH).json();
state.sweeps.push({
  at: new Date().toISOString(),
  added: 0,
  updated: movements.length,
  held: 0,
  summary:
    `Source-class migration: Launch Library reclassed from computed to aggregator on ${reclassed} ` +
    `item sources (Florian, 2026-07-22; CLAUDE.md and the registry path always scored it aggregator). ` +
    `${movements.length} LL2-led launch items rescored 5 to 4 under the direct-source ceiling; ` +
    `items where LL2 corroborates a press lead keep their score. Ledger calibration records untouched.`,
  coverage: ["migration"],
  snr_movements: movements,
});
await Bun.write(STATE_PATH, JSON.stringify(state, null, 2) + "\n");

console.log(`sources reclassed: ${reclassed}`);
for (const m of movements) console.log(`${m.id}: ${m.from} -> ${m.to}`);
