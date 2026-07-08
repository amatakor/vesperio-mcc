/**
 * Unit tests for the registry crossfeed plumbing (scripts/lib/crossfeed.ts)
 * and its wiring in finalize-sweep: entity resolution, fact validation,
 * reconcile outcomes, the queue file, the dispute downgrade, and the
 * attestation gate.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadRegistryIndex,
  matchCompanies,
  validateFact,
  decideFact,
} from "../lib/crossfeed";
import type { RegistryCandidatesFile } from "../lib/crossfeed";
import { finalizeSweep } from "../finalize-sweep";
import type { ItemsFile, HeldFile, StateFile, SourcesFile, SourceLedgerFile } from "../../src/data/schema";

let dir: string;
let dataDir: string;
let draftPath: string;

const ICEYE_PROFILE = {
  slug: "iceye",
  name: "ICEYE",
  entity_type: "constellation",
  domain: "eo",
  overview: { value: "ICEYE operates a SAR constellation.", source: "https://www.iceye.com", as_of: "2026-07-05" },
  operator: { value: "ICEYE", source: "https://www.iceye.com", as_of: "2026-07-05" },
  country: { value: "Finland", source: "https://www.iceye.com", as_of: "2026-07-05" },
  sensor_types: { value: ["sar"], source: "https://www.iceye.com", as_of: "2026-07-05" },
  sats_launched_total: { value: null, source: null, as_of: null },
  sats_active_claimed: {
    value: 40,
    source: "https://space.skyrocket.de/doc_sdat/iceye.htm",
    as_of: "2026-07-05",
    snr: 4,
    snr_trace: {
      base: { tier: 4, source: "https://space.skyrocket.de/doc_sdat/iceye.htm", reason: "aggregator" },
      modifiers: [],
      final: 4,
      scorer_version: 1,
    },
    tier: "canonical",
  },
  sats_active_verified: { value: null, source: null, as_of: null },
  sats_planned: { value: null, source: null, as_of: null },
  orbit: { value: null, source: null, as_of: null },
  first_launch_date: { value: null, source: null, as_of: null },
  latest_launch_date: { value: null, source: null, as_of: null },
  status: {
    value: "operational",
    source: "https://spacenews.com/some-report",
    as_of: "2026-07-05",
    snr: 3,
    snr_trace: {
      base: { tier: 3, source: "https://spacenews.com/some-report", reason: "single press source" },
      modifiers: [],
      final: 3,
      scorer_version: 1,
    },
    tier: "provisional",
  },
  website: { value: "https://www.iceye.com", source: "https://www.iceye.com", as_of: "2026-07-05" },
  notes: null,
};

function seed(): void {
  const items: ItemsFile = { items: [] };
  const held: HeldFile = { held: [] };
  const state: StateFile = { lastSweep: "2026-07-01T12:00:00.000Z", sweeps: [] };
  const sources: SourcesFile = {
    version: "0.1",
    categories: {
      eo_operators: [
        { name: "ICEYE", url: "https://www.iceye.com/press", feed_type: "html", rss: null, cadence: "weekly", language: "en", tier: 1, status: "verified" },
      ],
    },
  };
  const ledger: SourceLedgerFile = { version: "0.1", updated: null, sources: [] };
  writeFileSync(join(dataDir, "items.json"), JSON.stringify(items, null, 2));
  writeFileSync(join(dataDir, "held.json"), JSON.stringify(held, null, 2));
  writeFileSync(join(dataDir, "state.json"), JSON.stringify(state, null, 2));
  writeFileSync(join(dataDir, "sources.json"), JSON.stringify(sources, null, 2));
  writeFileSync(join(dataDir, "source_ledger.json"), JSON.stringify(ledger, null, 2));
  mkdirSync(join(dataDir, "registry", "constellations"), { recursive: true });
  writeFileSync(
    join(dataDir, "registry", "constellations", "iceye.json"),
    JSON.stringify(ICEYE_PROFILE, null, 2),
  );
  writeFileSync(
    join(dataDir, "aliases.json"),
    JSON.stringify({ entities: [{ name: "ICEYE Oy", org: "iceye", aliases: ["ICEYE US"] }] }, null, 2),
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mcc-crossfeed-test-"));
  dataDir = join(dir, "data");
  mkdirSync(dataDir);
  seed();
  draftPath = join(dir, "sweep-draft.json");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("registry index", () => {
  test("resolves profile names, slugs, and curated aliases", () => {
    const index = loadRegistryIndex(dataDir);
    expect(matchCompanies(index, ["ICEYE"])).toEqual(["iceye"]);
    expect(matchCompanies(index, ["iceye us"])).toEqual(["iceye"]);
    expect(matchCompanies(index, ["Umbra"])).toEqual([]);
  });
});

describe("decideFact", () => {
  const index = () => loadRegistryIndex(dataDir);

  test("null target field at SNR >= 3 is a null_fill", () => {
    const entity = index().bySlug.get("iceye")!;
    const fact = { entity_slug: "iceye", field: "sats_launched_total", value: 54, metric: "cumulative launched", same_metric: true };
    expect(decideFact(fact, entity, 4)).toBe("null_fill");
  });

  test("null target below the entry bar is recorded, not landed", () => {
    const entity = index().bySlug.get("iceye")!;
    const fact = { entity_slug: "iceye", field: "sats_launched_total", value: 54, metric: "cumulative launched", same_metric: true };
    expect(decideFact(fact, entity, 2)).toBe("below_entry_bar");
  });

  test("metric mismatch annotates, never disputes", () => {
    const entity = index().bySlug.get("iceye")!;
    const fact = { entity_slug: "iceye", field: "sats_active_claimed", value: 30, metric: "operational satellites", same_metric: false };
    expect(decideFact(fact, entity, 5)).toBe("annotate_mismatch");
  });

  test("canonical fact outranks a weaker same-metric claim", () => {
    const entity = index().bySlug.get("iceye")!;
    const fact = { entity_slug: "iceye", field: "sats_active_claimed", value: 30, metric: "active satellites", same_metric: true };
    expect(decideFact(fact, entity, 3)).toBe("downgrade_incoming");
  });

  test("a stronger claim against a canonical fact flags a refresh", () => {
    const entity = index().bySlug.get("iceye")!;
    const fact = { entity_slug: "iceye", field: "sats_active_claimed", value: 44, metric: "active satellites", same_metric: true };
    expect(decideFact(fact, entity, 5)).toBe("flag_refresh");
  });

  test("equal SNR on a canonical fact queues both as disputed", () => {
    const entity = index().bySlug.get("iceye")!;
    const fact = { entity_slug: "iceye", field: "sats_active_claimed", value: 41, metric: "active satellites", same_metric: true };
    expect(decideFact(fact, entity, 4)).toBe("both_disputed_queue");
  });

  test("provisional facts never adjudicate", () => {
    const entity = index().bySlug.get("iceye")!;
    const fact = { entity_slug: "iceye", field: "status", value: "degraded", metric: "operational status", same_metric: true };
    expect(decideFact(fact, entity, 2)).toBe("no_registry_change");
    expect(decideFact(fact, entity, 4)).toBe("flag_refresh");
  });

  test("unscored first-party facts count as canonical SNR 5", () => {
    const entity = index().bySlug.get("iceye")!;
    const fact = { entity_slug: "iceye", field: "country", value: "Sweden", metric: "country of operation", same_metric: true };
    expect(decideFact(fact, entity, 4)).toBe("downgrade_incoming");
  });
});

describe("validateFact", () => {
  test("rejects unknown slugs, non-crossfeedable fields, and missing judgment", () => {
    const index = loadRegistryIndex(dataDir);
    expect(validateFact({ entity_slug: "nope", field: "status", value: 1, metric: "m", same_metric: true }, index, "p").errors.join("\n")).toContain("not a registry entity slug");
    expect(validateFact({ entity_slug: "iceye", field: "sats_active_verified", value: 1, metric: "m", same_metric: true }, index, "p").errors.join("\n")).toContain("not a crossfeedable");
    expect(validateFact({ entity_slug: "iceye", field: "status", value: "x", metric: "m" }, index, "p").errors.join("\n")).toContain("same_metric");
  });
});

describe("finalize-sweep crossfeed wiring", () => {
  function draftItem(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "2026-07-04-iceye-gen4-order",
      date: "2026-07-04",
      headline: "ICEYE orders 12 more Gen4 satellites",
      explainer: {
        tagline: "ICEYE grows the Gen4 fleet with a new batch order.",
        what_happened: "ICEYE ordered more satellites. The order is described in the linked report.",
        why_it_matters: "SAR capacity growth changes tasking availability for resellers.",
      },
      tags: ["sar"],
      category: "constellation",
      impact: "notable",
      companies: ["ICEYE"],
      source_url: "https://spacenews.com/iceye-gen4-order",
      secondary_urls: [],
      scoring: {
        sources: [
          { url: "https://spacenews.com/iceye-gen4-order", outlet: "SpaceNews", class: "trade" },
          { url: "https://payloadspace.com/iceye-order", outlet: "Payload", class: "trade", via: "corroboration" },
        ],
        extraordinary: false,
        crawl: "found_some",
        whitelist: null,
      },
      ...over,
    };
  }
  function writeDraft(items: Record<string, unknown>[]): void {
    writeFileSync(
      draftPath,
      JSON.stringify({
        newItems: items,
        updates: [],
        held: [],
        sourceHealth: [],
        summary: "t",
        coverage: ["constellation"],
        discoveryPass: {
          queries: ["a", "b", "c", "d", "e", "f"].map((x) => `test query ${x}`),
          found: 0,
          note: "crossfeed test default",
        },
      }),
    );
  }
  function readQueue(): RegistryCandidatesFile {
    return JSON.parse(readFileSync(join(dataDir, "registry-candidates.json"), "utf8")) as RegistryCandidatesFile;
  }

  test("an SNR >= 3 item naming a registry entity without a crossfeed block is rejected", () => {
    writeDraft([draftItem()]);
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("no crossfeed block");
  });

  test("an empty facts list with a note passes the gate", () => {
    writeDraft([draftItem({ crossfeed: { facts: [], note: "contract order, no like-for-like registry metric yet" } })]);
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
  });

  test("a null-fill fact lands in the queue and the block is stripped from the item", () => {
    writeDraft([
      draftItem({
        crossfeed: {
          facts: [
            { entity_slug: "iceye", field: "sats_launched_total", value: 54, metric: "cumulative ICEYE satellites launched, as stated", same_metric: true },
          ],
        },
      }),
    ]);
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const queue = readQueue();
    expect(queue.candidates.length).toBe(1);
    expect(queue.candidates[0]!.id).toBe("2026-07-04-iceye-gen4-order:iceye.sats_launched_total");
    expect(queue.candidates[0]!.action).toBe("null_fill");
    expect(queue.candidates[0]!.status).toBe("pending");
    const items = JSON.parse(readFileSync(join(dataDir, "items.json"), "utf8")) as ItemsFile;
    expect((items.items[0] as unknown as Record<string, unknown>).crossfeed).toBeUndefined();
  });

  test("losing a same-metric conflict with a canonical fact applies the dispute downgrade", () => {
    writeDraft([
      draftItem({
        scoring: {
          sources: [{ url: "https://spacenews.com/iceye-gen4-order", outlet: "SpaceNews", class: "trade" }],
          extraordinary: false,
          crawl: "found_none",
          whitelist: null,
        },
        crossfeed: {
          facts: [
            { entity_slug: "iceye", field: "sats_active_claimed", value: 30, metric: "active satellites", same_metric: true },
          ],
        },
      }),
    ]);
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const items = JSON.parse(readFileSync(join(dataDir, "items.json"), "utf8")) as ItemsFile;
    const item = items.items[0]!;
    // trade 3, found_none -1 = 2, dispute -1 = 1
    expect(item.snr).toBe(1);
    expect(item.disputed).toBe(true);
    expect(item.snr_trace.modifiers.some((m) => m.type === "dispute")).toBe(true);
    expect(readQueue().candidates[0]!.action).toBe("downgrade_incoming");
  });

  test("an equal-SNR tie queues the item for Florian and marks it disputed", () => {
    writeDraft([
      draftItem({
        scoring: {
          sources: [
            { url: "https://spacenews.com/iceye-gen4-order", outlet: "SpaceNews", class: "trade" },
            { url: "https://payloadspace.com/iceye-order", outlet: "Payload", class: "trade", via: "corroboration" },
          ],
          extraordinary: false,
          crawl: "found_some",
          whitelist: null,
        },
        crossfeed: {
          facts: [
            { entity_slug: "iceye", field: "sats_active_claimed", value: 41, metric: "active satellites", same_metric: true },
          ],
        },
      }),
    ]);
    // trade 3 + corroboration_2plus = 4, equal to the canonical fact's 4.
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const held = JSON.parse(readFileSync(join(dataDir, "held.json"), "utf8")) as HeldFile;
    expect(held.held.some((h) => h.reason.includes("same-metric SNR tie"))).toBe(true);
    const items = JSON.parse(readFileSync(join(dataDir, "items.json"), "utf8")) as ItemsFile;
    expect(items.items[0]!.disputed).toBe(true);
    expect(readQueue().candidates[0]!.action).toBe("both_disputed_queue");
  });

  test("queue entries persist across sweeps and dedup by id", () => {
    const cf = {
      crossfeed: {
        facts: [
          { entity_slug: "iceye", field: "sats_launched_total", value: 54, metric: "cumulative launched", same_metric: true },
        ],
      },
    };
    writeDraft([draftItem(cf)]);
    expect(finalizeSweep({ dataDir, draftPath }).ok).toBe(true);
    // second sweep, different item, same target field
    writeDraft([
      draftItem({
        ...cf,
        id: "2026-07-05-iceye-follow-up",
        date: "2026-07-05",
        headline: "ICEYE order gains a second confirmation",
        source_url: "https://payloadspace.com/iceye-order-2",
        scoring: {
          sources: [{ url: "https://payloadspace.com/iceye-order-2", outlet: "Payload", class: "trade" }],
          extraordinary: false,
          crawl: "found_none",
          whitelist: null,
        },
        dedup_distinct: [
          { id: "2026-07-04-iceye-gen4-order", reason: "distinct follow-up event for the integration test" },
        ],
      }),
    ]);
    const second = finalizeSweep({ dataDir, draftPath });
    expect(second.ok).toBe(true);
    const queue = readQueue();
    expect(queue.candidates.length).toBe(2);
    expect(new Set(queue.candidates.map((c) => c.id)).size).toBe(2);
  });
});
