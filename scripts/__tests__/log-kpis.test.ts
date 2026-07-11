/**
 * Unit tests for the /log KPI + lead-source presence module
 * (src/lib/log-kpis.ts). A hand-computed fixture pins the exact values.
 */

import { describe, expect, test } from "bun:test";
import {
  computeLogKpis,
  leadSourcePresence,
  itemsInWindow,
  hostOf,
  type CrossfeedCandidateRef,
} from "../../src/lib/log-kpis";
import type { Item, LedgerSource, SnrModifierType } from "../../src/data/schema";

/** Minimal Item stub carrying only the fields the KPI module reads. */
function item(
  date: string,
  source_url: string,
  snr: number,
  modTypes: SnrModifierType[] = [],
): Item {
  return {
    id: `${date}-x`,
    date,
    headline: "h",
    explainer: { tagline: "t", what_happened: "w", why_it_matters: "y" },
    kind: "event",
    tags: [],
    category: "launch",
    impact: "notable",
    companies: [],
    source_url,
    secondary_urls: [],
    snr: snr as Item["snr"],
    snr_trace: {
      base: { tier: 3, source: source_url, reason: "r" },
      modifiers: modTypes.map((type) => ({ type, delta: 0, reason: type })),
      final: snr as Item["snr"],
      scorer_version: 2,
    },
  } as Item;
}

// now = 2026-07-15; the trailing-30-day window opens at 2026-06-15.
const NOW = new Date("2026-07-15T00:00:00.000Z");

const ITEMS: Item[] = [
  item("2026-07-14", "https://www.spacenews.com/a", 5),
  item("2026-07-10", "https://spacenews.com/b", 2, ["whitelist_floor"]),
  item("2026-07-01", "https://payloadspace.com/c", 1),
  item("2026-06-20", "https://www.iceye.com/d", 4),
  item("2026-06-01", "https://old.example.com/e", 1), // before the window: excluded
];

const CANDIDATES: CrossfeedCandidateRef[] = [
  { proposed_on: "2026-07-05", status: "pending" }, // in window, pending
  { proposed_on: "2026-06-01", status: "pending" }, // before window
  { proposed_on: "2026-07-06", status: "consumed" }, // not pending
];

const LEDGER: LedgerSource[] = [
  {
    domain: "spacenews.com",
    events: [],
    claims: [
      { claim: "c1", date: "2026-06-20", snr_at_publication: 2, resolution: "confirmed", resolved_on: "2026-07-10" },
      { claim: "c2", date: "2026-05-20", snr_at_publication: 3, resolution: "debunked", resolved_on: "2026-06-10" },
      { claim: "c3", date: "2026-07-01", snr_at_publication: 1, resolution: "unresolved" },
      { claim: "c4", date: "2026-06-01", snr_at_publication: 1, resolution: "expired" },
      { claim: "c5", date: "2026-07-02", snr_at_publication: 2, resolution: "confirmed", resolved_on: "2026-07-14" },
    ],
  },
];

describe("hostOf", () => {
  test("strips a leading www.", () => {
    expect(hostOf("https://www.spacenews.com/a")).toBe("spacenews.com");
  });
  test("keeps other subdomains", () => {
    expect(hostOf("https://ir.example.com/x")).toBe("ir.example.com");
  });
  test("returns the raw string on an unparseable url", () => {
    expect(hostOf("not a url")).toBe("not a url");
  });
});

describe("itemsInWindow", () => {
  test("keeps items on or after the cutoff day and drops older ones", () => {
    const ids = itemsInWindow(ITEMS, NOW).map((i) => i.date);
    expect(ids).toEqual(["2026-07-14", "2026-07-10", "2026-07-01", "2026-06-20"]);
  });
});

describe("computeLogKpis", () => {
  const k = computeLogKpis(ITEMS, LEDGER, CANDIDATES, NOW);

  test("item count and rate", () => {
    expect(k.itemCount).toBe(4);
    expect(k.itemsPerDay).toBe(0.1); // 4 / 30 = 0.133 -> 0.1
    expect(k.windowDays).toBe(30);
  });
  test("distinct lead domains (www collapses)", () => {
    expect(k.leadDomains).toBe(3); // spacenews.com, payloadspace.com, iceye.com
  });
  test("low-SNR share as an integer percent", () => {
    expect(k.pctLowSnr).toBe(50); // 2 of 4 at snr <= 2
  });
  test("crossfeed counts only pending candidates proposed in window", () => {
    expect(k.crossfeedQueued).toBe(1);
  });
  test("claims resolved counts confirmed/debunked with resolved_on in window", () => {
    expect(k.claimsResolved).toBe(2); // c1 + c5
  });
  test("signals-sourced counts whitelist-floored window items", () => {
    expect(k.signalsSourced).toBe(1);
  });

  test("empty input yields zeroed rates, not NaN", () => {
    const z = computeLogKpis([], [], [], NOW);
    expect(z.itemsPerDay).toBe(0);
    expect(z.pctLowSnr).toBe(0);
    expect(z.leadDomains).toBe(0);
  });
});

describe("leadSourcePresence", () => {
  test("counts per domain, sorted by count desc then domain asc", () => {
    expect(leadSourcePresence(ITEMS, NOW)).toEqual([
      { domain: "spacenews.com", count: 2 },
      { domain: "iceye.com", count: 1 },
      { domain: "payloadspace.com", count: 1 },
    ]);
  });
});
