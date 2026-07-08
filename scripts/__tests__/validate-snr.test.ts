/**
 * Validation tests for the SNR schema additions (SNR_SPEC.md / SNR_PLAN.md):
 * transitional item rules (snr XOR legacy confidence), trace invariants
 * (saturation, arithmetic), registry field tiers, and the new stores.
 */

import { describe, expect, test } from "bun:test";
import {
  validateItem,
  validateRegistryProfile,
  validateStateFile,
  validateSourceLedgerFile,
  validateSignalsSuggestionsFile,
} from "../lib/validate";

function itemErrors(item: unknown): string[] {
  const errors: string[] = [];
  validateItem(item, "items[0]", errors);
  return errors;
}

const legacyItem = {
  id: "2026-07-01-testco-contract",
  date: "2026-07-01",
  headline: "TestCo wins imaging contract",
  explainer: {
    tagline: "TestCo won a contract.",
    what_happened: "TestCo won a contract for imagery.",
    why_it_matters: "It shifts imagery supply.",
  },
  kind: "event",
  tags: ["eo"],
  category: "contract",
  impact: "notable",
  companies: ["TestCo"],
  source_url: "https://example.com/pr",
  secondary_urls: [],
};

const validTrace = {
  base: { tier: 3, source: "https://spacenews.com/testco", reason: "trade press (SpaceNews)" },
  modifiers: [
    {
      type: "corroboration_2plus",
      delta: 1,
      reason: "second source found by the corroboration crawl",
      source: "https://payloadspace.com/testco",
    },
  ],
  final: 4,
  scorer_version: 1,
};

const snrItem = {
  ...legacyItem,
  id: "2026-07-02-testco-snr",
  snr: 4,
  snr_trace: validTrace,
  sources: [
    {
      url: "https://spacenews.com/testco",
      outlet: "SpaceNews",
      class: "trade",
      added: "2026-07-02",
      via: "initial",
    },
    {
      url: "https://payloadspace.com/testco",
      outlet: "Payload",
      class: "trade",
      added: "2026-07-02",
      via: "corroboration",
    },
  ],
};

describe("item: snr requirements", () => {
  test("snr item validates", () => {
    expect(itemErrors(snrItem)).toEqual([]);
  });

  test("item without snr fails", () => {
    const errors = itemErrors(legacyItem);
    expect(errors.some((e) => e.includes("snr: required"))).toBe(true);
  });

  test("snr without snr_trace fails", () => {
    const errors = itemErrors({ ...snrItem, snr_trace: undefined });
    expect(errors.some((e) => e.includes("snr_trace"))).toBe(true);
  });

  test("snr_trace alone does not satisfy the snr requirement", () => {
    const errors = itemErrors({ ...legacyItem, snr_trace: validTrace });
    expect(errors.some((e) => e.includes("snr: required"))).toBe(true);
  });

  test("disputed must be boolean", () => {
    const errors = itemErrors({ ...snrItem, disputed: "yes" });
    expect(errors.some((e) => e.includes("disputed"))).toBe(true);
  });

  test("sources entries are shape-checked", () => {
    const errors = itemErrors({
      ...snrItem,
      sources: [{ url: "not-a-url", outlet: "", class: "gossip", added: "yesterday", via: "osmosis" }],
    });
    expect(errors.some((e) => e.includes(".url"))).toBe(true);
    expect(errors.some((e) => e.includes(".class"))).toBe(true);
    expect(errors.some((e) => e.includes(".added"))).toBe(true);
    expect(errors.some((e) => e.includes(".via"))).toBe(true);
  });
});

describe("item: impact enum", () => {
  test("new names validate", () => {
    for (const impact of ["seismic", "notable", "noise"]) {
      expect(itemErrors({ ...snrItem, impact })).toEqual([]);
    }
  });

  test("retired legacy names fail", () => {
    for (const impact of ["critical", "routine"]) {
      const errors = itemErrors({ ...snrItem, impact });
      expect(errors.some((e) => e.includes(".impact"))).toBe(true);
    }
  });

  test("unknown impact fails", () => {
    const errors = itemErrors({ ...snrItem, impact: "urgent" });
    expect(errors.some((e) => e.includes(".impact"))).toBe(true);
  });
});

describe("snr_trace invariants", () => {
  test("final must match the stored snr", () => {
    const errors = itemErrors({ ...snrItem, snr: 5 });
    expect(errors.some((e) => e.includes("does not match the stored snr"))).toBe(true);
  });

  test("final must equal clamp(base + modifier deltas)", () => {
    const errors = itemErrors({
      ...snrItem,
      snr: 5,
      snr_trace: { ...validTrace, final: 5 },
    });
    expect(errors.some((e) => e.includes("clamps to"))).toBe(true);
  });

  test("clamping is honored at the top of the range", () => {
    const errors = itemErrors({
      ...snrItem,
      snr: 5,
      snr_trace: {
        base: { tier: 5, source: "https://testco.example/pr", reason: "first-party, domain-verified" },
        modifiers: [
          { type: "corroboration_2plus", delta: 1, reason: "second source" },
        ],
        final: 5,
        scorer_version: 1,
      },
    });
    expect(errors).toEqual([]);
  });

  test("the same modifier type twice violates saturation", () => {
    const errors = itemErrors({
      ...snrItem,
      snr: 5,
      snr_trace: {
        ...validTrace,
        modifiers: [
          { type: "corroboration_2plus", delta: 1, reason: "two sources" },
          { type: "corroboration_2plus", delta: 1, reason: "same reason again" },
        ],
        final: 5,
      },
    });
    expect(errors.some((e) => e.includes("saturate"))).toBe(true);
  });

  test("history entries are shape-checked", () => {
    const errors = itemErrors({
      ...snrItem,
      snr_trace: {
        ...validTrace,
        history: [{ date: "last week", from: 0, to: 9, reason: "" }],
      },
    });
    expect(errors.some((e) => e.includes("history[0].date"))).toBe(true);
    expect(errors.some((e) => e.includes("history[0].from"))).toBe(true);
    expect(errors.some((e) => e.includes("history[0].to"))).toBe(true);
  });
});

// ------------------------------------------------------------- registry

const nullField = { value: null, source: null, as_of: null };

function orgProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "testorg",
    name: "TestOrg",
    entity_type: "organization",
    kind: "manufacturer",
    overview: { ...nullField },
    country: { ...nullField },
    founded: { ...nullField },
    focus: { ...nullField },
    status: { ...nullField },
    website: { ...nullField },
    ...overrides,
  };
}

const aggregatorTrace = {
  base: {
    tier: 4,
    source: "https://space.skyrocket.de/doc_sdat/testsat.htm",
    reason: "established aggregator, single reference",
  },
  modifiers: [],
  final: 4,
  scorer_version: 1,
};

describe("registry fields: snr and tiers", () => {
  test("unscored field (Wikipedia/first-party model) validates as before", () => {
    expect(validateRegistryProfile(orgProfile(), "organization", "testorg")).toEqual([]);
  });

  test("canonical snr-4 field with trace validates", () => {
    const profile = orgProfile({
      country: {
        value: "Finland",
        source: "https://space.skyrocket.de/doc_sdat/testsat.htm",
        as_of: "2026-07-06",
        snr: 4,
        tier: "canonical",
        snr_trace: aggregatorTrace,
      },
    });
    expect(validateRegistryProfile(profile, "organization", "testorg")).toEqual([]);
  });

  test("provisional requires snr 3 exactly", () => {
    const profile = orgProfile({
      country: {
        value: "Finland",
        source: "https://space.skyrocket.de/doc_sdat/testsat.htm",
        as_of: "2026-07-06",
        snr: 4,
        tier: "provisional",
        snr_trace: aggregatorTrace,
      },
    });
    const errors = validateRegistryProfile(profile, "organization", "testorg");
    expect(errors.some((e) => e.includes("provisional requires snr 3"))).toBe(true);
  });

  test("canonical requires snr 4-5", () => {
    const profile = orgProfile({
      country: {
        value: "Finland",
        source: "https://spacenews.com/testorg",
        as_of: "2026-07-06",
        snr: 3,
        tier: "canonical",
        snr_trace: { ...aggregatorTrace, base: { ...aggregatorTrace.base, tier: 3 }, final: 3 },
      },
    });
    const errors = validateRegistryProfile(profile, "organization", "testorg");
    expect(errors.some((e) => e.includes("canonical requires snr 4-5"))).toBe(true);
  });

  test("snr without tier fails", () => {
    const profile = orgProfile({
      country: {
        value: "Finland",
        source: "https://space.skyrocket.de/doc_sdat/testsat.htm",
        as_of: "2026-07-06",
        snr: 4,
        snr_trace: aggregatorTrace,
      },
    });
    const errors = validateRegistryProfile(profile, "organization", "testorg");
    expect(errors.some((e) => e.includes("tier: required when snr is present"))).toBe(true);
  });

  test("snr on a null value fails", () => {
    const profile = orgProfile({
      country: {
        value: null,
        source: null,
        as_of: null,
        snr: 4,
        tier: "canonical",
        snr_trace: aggregatorTrace,
      },
    });
    const errors = validateRegistryProfile(profile, "organization", "testorg");
    expect(errors.some((e) => e.includes("snr present on a null value"))).toBe(true);
  });

  test("disputed competing claims are shape-checked", () => {
    const profile = orgProfile({
      country: {
        value: "Finland",
        source: "https://space.skyrocket.de/doc_sdat/testsat.htm",
        as_of: "2026-07-06",
        snr: 4,
        tier: "canonical",
        snr_trace: aggregatorTrace,
        disputed: {
          competing: [{ value: "Estonia", source: "not-a-url", as_of: "recently", snr: 7 }],
        },
      },
    });
    const errors = validateRegistryProfile(profile, "organization", "testorg");
    expect(errors.some((e) => e.includes("competing[0].source"))).toBe(true);
    expect(errors.some((e) => e.includes("competing[0].as_of"))).toBe(true);
    expect(errors.some((e) => e.includes("competing[0].snr"))).toBe(true);
  });
});

// ----------------------------------------------------------- new stores

describe("source_ledger.json", () => {
  test("empty ledger validates", () => {
    expect(validateSourceLedgerFile({ version: "0.1", updated: null, sources: [] })).toEqual([]);
  });

  test("full ledger entry validates", () => {
    const ledger = {
      version: "0.1",
      updated: "2026-07-06T05:00:00Z",
      sources: [
        {
          domain: "spacenews.com",
          name: "SpaceNews",
          class_override: null,
          events: [
            { date: "2026-07-06", kind: "credit", claim: "2026-06-01-x", reason: "entered at 2, confirmed first-party" },
          ],
          claims: [
            {
              claim: "2026-06-01-x",
              date: "2026-06-01",
              snr_at_publication: 2,
              resolution: "confirmed",
              resolved_on: "2026-07-06",
            },
          ],
        },
      ],
    };
    expect(validateSourceLedgerFile(ledger)).toEqual([]);
  });

  test("bad event kind and duplicate domain fail", () => {
    const ledger = {
      version: "0.1",
      updated: null,
      sources: [
        { domain: "x.com", events: [{ date: "2026-07-06", kind: "penalty", claim: "a", reason: "b" }], claims: [] },
        { domain: "x.com", events: [], claims: [] },
      ],
    };
    const errors = validateSourceLedgerFile(ledger);
    expect(errors.some((e) => e.includes(".kind"))).toBe(true);
    expect(errors.some((e) => e.includes("duplicate"))).toBe(true);
  });
});

describe("signals_suggestions.json", () => {
  test("empty queue validates", () => {
    expect(validateSignalsSuggestionsFile({ version: "0.1", suggestions: [] })).toEqual([]);
  });

  test("suggestion requires non-empty evidence", () => {
    const errors = validateSignalsSuggestionsFile({
      version: "0.1",
      suggestions: [
        {
          id: "jane-doe",
          name: "Jane Doe",
          channel_url: "https://x.com/janedoe",
          proposed_on: "2026-07-06",
          evidence: [],
          status: "pending",
        },
      ],
    });
    expect(errors.some((e) => e.includes("evidence: required non-empty"))).toBe(true);
  });
});

describe("state.json: snr_movements", () => {
  test("sweep entry with movements validates", () => {
    const state = {
      lastSweep: "2026-07-06T05:00:00Z",
      sweeps: [
        {
          at: "2026-07-06T05:00:00Z",
          added: 0,
          updated: 1,
          held: 0,
          summary: "One reinforcement upgrade.",
          coverage: ["eo"],
          snr_movements: [
            { id: "2026-07-01-testco-contract", from: 2, to: 3, reason: "reinforcement: matching event attached" },
          ],
        },
      ],
    };
    expect(validateStateFile(state)).toEqual([]);
  });

  test("malformed movement fails", () => {
    const state = {
      lastSweep: null,
      sweeps: [
        {
          at: "2026-07-06T05:00:00Z",
          added: 0,
          updated: 0,
          held: 0,
          summary: "x",
          coverage: [],
          snr_movements: [{ id: "", from: 0, to: 6, reason: "" }],
        },
      ],
    };
    const errors = validateStateFile(state);
    expect(errors.some((e) => e.includes("snr_movements[0]"))).toBe(true);
  });
});
