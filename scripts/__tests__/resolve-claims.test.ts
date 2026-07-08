/**
 * Unit tests for the claim resolution job (scripts/resolve-claims.ts):
 * the deterministic decision rules, the floor-independence computation,
 * and the full run against a temp data dir (ledger writes via
 * resolveClaim, strike/credit events, promotion suggestions).
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decideClaim,
  floorIndependentSnr,
  suggestionId,
  runResolution,
} from "../resolve-claims";
import type {
  Item,
  ItemsFile,
  HeldFile,
  LedgerClaim,
  SourceLedgerFile,
  SignalsSuggestionsFile,
  SnrValue,
  SnrModifier,
} from "../../src/data/schema";

const TODAY = "2026-07-08";

function makeItem(over: Partial<Item> & { snrOver?: SnrValue; modifiers?: SnrModifier[] }): Item {
  const baseTier = (over.snr_trace?.base.tier ?? 1) as SnrValue;
  const modifiers = over.modifiers ?? [];
  const final = (over.snrOver ??
    Math.min(5, Math.max(1, baseTier + modifiers.reduce((n, m) => n + m.delta, 0)))) as SnrValue;
  return {
    id: "2026-06-20-testco-event",
    date: "2026-06-20",
    headline: "TestCo does a thing",
    explainer: {
      tagline: "TestCo did a thing worth logging.",
      what_happened: "TestCo announced a thing. The announcement is linked.",
      why_it_matters: "Things change markets; resellers care about this one.",
    },
    tags: ["eo"],
    category: "constellation",
    impact: "notable",
    companies: ["TestCo"],
    source_url: "https://example-informal.com/post",
    secondary_urls: [],
    snr: final,
    snr_trace: {
      base: { tier: baseTier, source: "https://example-informal.com/post", reason: "test" },
      modifiers,
      final,
      scorer_version: 2,
    },
    publishDate: "2026-06-20T12:00:00.000Z",
    ...over,
  } as Item;
}

function claim(over: Partial<LedgerClaim> = {}): LedgerClaim {
  return {
    claim: "2026-06-20-testco-event",
    date: "2026-06-20", // 18 days before TODAY
    snr_at_publication: 2,
    resolution: "unresolved",
    ...over,
  };
}

const NO_HELD = new Set<string>();

describe("floorIndependentSnr", () => {
  test("strips the whitelist floor, keeps everything else", () => {
    const item = makeItem({
      snr_trace: {
        base: { tier: 3, source: "u", reason: "whitelist" },
        modifiers: [{ type: "whitelist_floor", delta: 1, reason: "observer floor" }],
        final: 4,
        scorer_version: 2,
      },
      snr: 4,
    });
    expect(floorIndependentSnr(item)).toBe(3);
  });

  test("corroboration counts", () => {
    const item = makeItem({
      modifiers: [
        { type: "corroboration_2plus", delta: 1, reason: "2 sources" },
        { type: "corroboration_4plus", delta: 1, reason: "4 sources" },
        { type: "mainstream_pickup", delta: 1, reason: "Reuters" },
      ],
    });
    expect(item.snr).toBe(4);
    expect(floorIndependentSnr(item)).toBe(4);
  });
});

describe("decideClaim", () => {
  test("claims younger than 14 days are left alone", () => {
    const d = decideClaim(claim({ date: "2026-07-01" }), makeItem({}), NO_HELD, TODAY);
    expect(d.resolution).toBeNull();
    expect(d.adjudicate).toBeUndefined();
  });

  test("unknown claim ids go to adjudication, untouched", () => {
    const d = decideClaim(claim({ claim: "iceye-gen4.sats_launched_total" }), undefined, NO_HELD, TODAY);
    expect(d.resolution).toBeNull();
    expect(d.adjudicate).toContain("not a published item id");
  });

  test("floor-independent SNR >= 4 confirms; published at <= 2 earns a credit", () => {
    const item = makeItem({
      modifiers: [
        { type: "corroboration_2plus", delta: 1, reason: "2 sources" },
        { type: "corroboration_4plus", delta: 1, reason: "4 sources" },
        { type: "mainstream_pickup", delta: 1, reason: "Reuters" },
      ],
    });
    const d = decideClaim(claim({ snr_at_publication: 2 }), item, NO_HELD, TODAY);
    expect(d.resolution).toBe("confirmed");
    expect(d.event?.kind).toBe("credit");
    expect(d.event?.reason).toContain("early, not wrong");
  });

  test("a claim that published high confirms without a credit", () => {
    const item = makeItem({
      snr_trace: {
        base: { tier: 4, source: "u", reason: "wire" },
        modifiers: [],
        final: 4,
        scorer_version: 2,
      },
      snr: 4,
    });
    const d = decideClaim(claim({ snr_at_publication: 4 }), item, NO_HELD, TODAY);
    expect(d.resolution).toBe("confirmed");
    expect(d.event).toBeUndefined();
  });

  test("a direct source attached later confirms even below SNR 4", () => {
    const item = makeItem({
      modifiers: [{ type: "corroboration_2plus", delta: 1, reason: "2 sources" }],
      sources: [
        {
          url: "https://example-informal.com/post",
          outlet: "informal account",
          class: "informal",
          added: "2026-06-20",
          via: "initial",
        },
        {
          url: "https://testco.example/press",
          outlet: "TestCo",
          class: "first_party",
          added: "2026-06-25",
          via: "corroboration",
        },
      ],
    });
    expect(item.snr).toBe(2);
    const d = decideClaim(claim({}), item, NO_HELD, TODAY);
    expect(d.resolution).toBe("confirmed");
    expect(d.event?.kind).toBe("credit");
  });

  test("the whitelist floor alone never confirms", () => {
    const item = makeItem({
      snr_trace: {
        base: { tier: 3, source: "u", reason: "whitelist" },
        modifiers: [{ type: "whitelist_floor", delta: 1, reason: "observer floor" }],
        final: 4,
        scorer_version: 2,
      },
      snr: 4,
    });
    const d = decideClaim(claim({ snr_at_publication: 4 }), item, NO_HELD, TODAY);
    expect(d.resolution).toBeNull();
  });

  test("a disputed item not queued for Florian debunks with a strike", () => {
    const item = makeItem({
      modifiers: [{ type: "dispute", delta: -1, reason: "lost same-metric contradiction" }],
    });
    const d = decideClaim(claim({}), item, NO_HELD, TODAY);
    expect(d.resolution).toBe("debunked");
    expect(d.event?.kind).toBe("strike");
  });

  test("a disputed item queued in held.json waits for Florian", () => {
    const item = makeItem({ disputed: true });
    const d = decideClaim(claim({}), item, new Set([item.id]), TODAY);
    expect(d.resolution).toBeNull();
    expect(d.adjudicate).toContain("held.json");
  });

  test("no signal either way past 90 days expires the claim", () => {
    const d = decideClaim(claim({ date: "2026-03-01" }), makeItem({}), NO_HELD, TODAY);
    expect(d.resolution).toBe("expired");
  });

  test("no signal inside 90 days stays unresolved", () => {
    const d = decideClaim(claim({}), makeItem({}), NO_HELD, TODAY);
    expect(d.resolution).toBeNull();
    expect(d.adjudicate).toBeUndefined();
  });
});

describe("suggestionId", () => {
  test("kebab-cases domains", () => {
    expect(suggestionId("Space-Enthusiast.example.co.uk")).toBe("space-enthusiast-example-co-uk");
  });
});

describe("runResolution (integration)", () => {
  let dir: string;
  let dataDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mcc-resolve-test-"));
    dataDir = join(dir, "data");
    mkdirSync(dataDir);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function seed(ledger: SourceLedgerFile, items: Item[]): void {
    const itemsFile: ItemsFile = { items };
    const held: HeldFile = { held: [] };
    const suggestions: SignalsSuggestionsFile = { version: "0.1", suggestions: [] };
    writeFileSync(join(dataDir, "items.json"), JSON.stringify(itemsFile, null, 2));
    writeFileSync(join(dataDir, "held.json"), JSON.stringify(held, null, 2));
    writeFileSync(join(dataDir, "source_ledger.json"), JSON.stringify(ledger, null, 2));
    writeFileSync(join(dataDir, "signals_suggestions.json"), JSON.stringify(suggestions, null, 2));
  }

  test("resolves matured claims, records events, leaves young claims alone", () => {
    const confirmedItem = makeItem({
      modifiers: [
        { type: "corroboration_2plus", delta: 1, reason: "2 sources" },
        { type: "corroboration_4plus", delta: 1, reason: "4 sources" },
        { type: "mainstream_pickup", delta: 1, reason: "Reuters" },
      ],
    });
    const ledger: SourceLedgerFile = {
      version: "0.1",
      updated: null,
      sources: [
        {
          domain: "example-informal.com",
          events: [],
          claims: [
            claim({}),
            claim({ claim: "too-young", date: "2026-07-05" }),
          ],
        },
      ],
    };
    seed(ledger, [confirmedItem]);
    const r = runResolution(dataDir, TODAY, `${TODAY}T12:00:00.000Z`);
    expect(r.examined).toBe(2);
    expect(r.confirmed).toBe(1);
    const written = JSON.parse(
      readFileSync(join(dataDir, "source_ledger.json"), "utf8"),
    ) as SourceLedgerFile;
    const src = written.sources[0]!;
    expect(src.claims.find((c) => c.claim === confirmedItem.id)!.resolution).toBe("confirmed");
    expect(src.claims.find((c) => c.claim === confirmedItem.id)!.resolved_on).toBe(TODAY);
    expect(src.claims.find((c) => c.claim === "too-young")!.resolution).toBe("unresolved");
    expect(src.events.length).toBe(1);
    expect(src.events[0]!.kind).toBe("credit");
    expect(written.updated).toBe(`${TODAY}T12:00:00.000Z`);
  });

  test("a qualifying source becomes a promotion suggestion with evidence", () => {
    // 5 already-confirmed claims spanning 31 days, zero strikes.
    const dates = ["2026-05-20", "2026-05-28", "2026-06-05", "2026-06-12", "2026-06-20"];
    const items = dates.map((d, i) =>
      makeItem({
        id: `${d}-testco-event-${i}`,
        date: d,
        modifiers: [
          { type: "corroboration_2plus", delta: 1, reason: "2 sources" },
          { type: "corroboration_4plus", delta: 1, reason: "4 sources" },
          { type: "mainstream_pickup", delta: 1, reason: "Reuters" },
        ],
        sources: [
          {
            url: "https://example-informal.com/post",
            outlet: "informal",
            class: "informal",
            added: d,
            via: "initial",
          },
          {
            url: `https://trade.example/${i}`,
            outlet: "Trade",
            class: "trade",
            added: d,
            via: "corroboration",
          },
        ],
      }),
    );
    const ledger: SourceLedgerFile = {
      version: "0.1",
      updated: null,
      sources: [
        {
          domain: "example-informal.com",
          name: "Example Informal",
          events: [],
          claims: dates.map((d, i) =>
            claim({
              claim: `${d}-testco-event-${i}`,
              date: d,
              resolution: "confirmed",
              resolved_on: "2026-07-01",
            }),
          ),
        },
      ],
    };
    seed(ledger, items);
    const r = runResolution(dataDir, TODAY, `${TODAY}T12:00:00.000Z`);
    expect(r.suggestionsAdded).toEqual(["example-informal-com"]);
    const written = JSON.parse(
      readFileSync(join(dataDir, "signals_suggestions.json"), "utf8"),
    ) as SignalsSuggestionsFile;
    expect(written.suggestions.length).toBe(1);
    const s = written.suggestions[0]!;
    expect(s.name).toBe("Example Informal");
    expect(s.status).toBe("pending");
    expect(s.evidence.length).toBe(5);
    expect(s.evidence[0]!.corroborating_sources).toEqual(["https://trade.example/0"]);

    // idempotent: a second run does not duplicate the suggestion.
    const r2 = runResolution(dataDir, TODAY, `${TODAY}T13:00:00.000Z`);
    expect(r2.suggestionsAdded).toEqual([]);
  });

  test("a source with a windowed strike never becomes a suggestion", () => {
    const dates = ["2026-05-20", "2026-05-28", "2026-06-05", "2026-06-12", "2026-06-20"];
    const items = dates.map((d, i) => makeItem({ id: `${d}-testco-event-${i}`, date: d }));
    const ledger: SourceLedgerFile = {
      version: "0.1",
      updated: null,
      sources: [
        {
          domain: "example-informal.com",
          events: [{ date: "2026-06-25", kind: "strike", claim: "x", reason: "lost contradiction" }],
          claims: dates.map((d, i) =>
            claim({
              claim: `${d}-testco-event-${i}`,
              date: d,
              resolution: "confirmed",
              resolved_on: "2026-07-01",
            }),
          ),
        },
      ],
    };
    seed(ledger, items);
    const r = runResolution(dataDir, TODAY, `${TODAY}T12:00:00.000Z`);
    expect(r.suggestionsAdded).toEqual([]);
  });
});
