/**
 * Unit tests for the deterministic SNR scoring engine (scripts/snr/):
 * score.ts, match.ts, ledger.ts, reconcile.ts. Mirrors the style of
 * validate-snr.test.ts. Covers every rule in SNR_PLAN.md §A/§B, asserts
 * every scoreClaim output passes validateSnrTrace, and exercises the
 * match windows, ledger thresholds, calibration, promotion, and every
 * reconcile branch.
 */

import { describe, expect, test } from "bun:test";
import { scoreClaim, BASE_TIER_BY_CLASS } from "../snr/score";
import type { ScoreInput } from "../snr/score";
import { matchDecision, applyHistory, applyModifier, daysBetween } from "../snr/match";
import {
  windowEvents,
  windowClaims,
  netStrikes,
  netCredits,
  demotionInEffect,
  recoveryEligible,
  effectiveClass,
  recordClaim,
  resolveClaim,
  calibration,
  promotionCandidates,
} from "../snr/ledger";
import { reconcile } from "../snr/reconcile";
import { validateSnrTrace } from "../lib/validate";
import type { ItemSource, SnrTrace, LedgerSource, SourceClass } from "../../src/data/schema";

// ------------------------------------------------------------- helpers

function src(cls: SourceClass, n = 1): ItemSource {
  return {
    url: `https://example-${cls}-${n}.com/x`,
    outlet: `${cls}-${n}`,
    class: cls,
    added: "2026-07-01",
    via: "initial",
  };
}

function baseInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    sources: [src("trade")],
    extraordinary: false,
    crawl: "not_attempted",
    whitelist: null,
    reinforced: false,
    persisted: false,
    disputeDowngrade: false,
    ...overrides,
  };
}

function traceErrors(trace: SnrTrace, snr: number): string[] {
  const errors: string[] = [];
  validateSnrTrace(trace, snr, "snr_trace", errors);
  return errors;
}

// ---------------------------------------------------------- base tiers

describe("scoreClaim base tiers", () => {
  // Every class scores at its base when alone; mainstream_pickup only
  // fires for coverage BEYOND the lead, so a lone mainstream source is
  // just base 3.
  const cases: Array<[SourceClass, number]> = [
    ["first_party", 5],
    ["official_record", 5],
    ["computed", 5],
    ["wire_pr", 4],
    ["aggregator", 4],
    ["trade", 3],
    ["mainstream", 3],
    ["whitelist", 3],
    ["informal", 1],
  ];
  for (const [cls, tier] of cases) {
    test(`${cls} -> base ${tier}`, () => {
      const { snr, trace } = scoreClaim(baseInput({ sources: [src(cls)] }));
      expect(trace.base.tier).toBe(tier as never);
      expect(snr).toBe(tier as never);
      expect(traceErrors(trace, snr)).toEqual([]);
    });
  }

  test("lone mainstream source gets no pickup bonus (pickup = beyond the lead)", () => {
    const { snr, trace } = scoreClaim(baseInput({ sources: [src("mainstream")] }));
    expect(trace.base.tier).toBe(3 as never);
    expect(snr).toBe(3 as never);
    expect(trace.modifiers).toEqual([]);
  });

  test("BASE_TIER_BY_CLASS matches the fixed contract map", () => {
    expect(BASE_TIER_BY_CLASS).toEqual({
      first_party: 5,
      official_record: 5,
      computed: 5,
      wire_pr: 4,
      aggregator: 4,
      trade: 3,
      mainstream: 3,
      whitelist: 3,
      informal: 1,
    });
  });

  test("throws when no lead source", () => {
    expect(() => scoreClaim(baseInput({ sources: [] }))).toThrow();
  });
});

// --------------------------------------------------------- corroboration

describe("corroboration modifiers", () => {
  test("2+ sources add +1 once", () => {
    const { snr, trace } = scoreClaim(
      baseInput({ sources: [src("trade", 1), src("trade", 2)] }),
    );
    expect(snr).toBe(4 as never);
    const types = trace.modifiers.map((m) => m.type);
    expect(types).toEqual(["corroboration_2plus"]);
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("4+ sources add both corroboration bumps below the ceiling", () => {
    const { snr, trace } = scoreClaim(
      baseInput({
        sources: [src("informal", 1), src("informal", 2), src("informal", 3), src("informal", 4)],
      }),
    );
    // base 1 + 1 (2plus) + 1 (4plus) = 3
    expect(snr).toBe(3 as never);
    const types = trace.modifiers.map((m) => m.type);
    expect(types).toContain("corroboration_2plus");
    expect(types).toContain("corroboration_4plus");
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("a trade lead with 4+ sources stops at the direct-source ceiling (4)", () => {
    const { snr, trace } = scoreClaim(
      baseInput({
        sources: [src("trade", 1), src("trade", 2), src("trade", 3), src("trade", 4)],
      }),
    );
    // base 3 + 1 (2plus) = 4; the 4plus bump would exceed the ceiling and is skipped
    expect(snr).toBe(4 as never);
    expect(trace.modifiers.map((m) => m.type)).toEqual(["corroboration_2plus"]);
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("each corroboration type fires at most once", () => {
    const many = Array.from({ length: 8 }, (_, i) => src("informal", i));
    const { trace } = scoreClaim(baseInput({ sources: many }));
    const twoPlus = trace.modifiers.filter((m) => m.type === "corroboration_2plus");
    const fourPlus = trace.modifiers.filter((m) => m.type === "corroboration_4plus");
    expect(twoPlus.length).toBe(1);
    expect(fourPlus.length).toBe(1);
  });

  test("mainstream pickup adds +1 when a non-lead source is mainstream", () => {
    const { snr, trace } = scoreClaim(
      baseInput({ sources: [src("informal", 1), src("mainstream", 2)] }),
    );
    // base 1 + 1 (2plus) + 1 (mainstream pickup) = 3
    expect(snr).toBe(3 as never);
    expect(trace.modifiers.map((m) => m.type)).toContain("mainstream_pickup");
    expect(traceErrors(trace, snr)).toEqual([]);
  });
});

// ------------------------------------------------------ corroboration_none

describe("corroboration_none penalty", () => {
  test("applied when crawl found_none", () => {
    const { snr, trace } = scoreClaim(baseInput({ crawl: "found_none" }));
    // base 3 - 1 = 2
    expect(snr).toBe(2 as never);
    expect(trace.modifiers.map((m) => m.type)).toEqual(["corroboration_none"]);
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("NOT applied when crawl not_attempted", () => {
    const { snr, trace } = scoreClaim(baseInput({ crawl: "not_attempted" }));
    expect(snr).toBe(3 as never);
    expect(trace.modifiers.map((m) => m.type)).not.toContain("corroboration_none");
  });

  test("NOT applied when crawl found_some", () => {
    const { trace } = scoreClaim(baseInput({ crawl: "found_some" }));
    expect(trace.modifiers.map((m) => m.type)).not.toContain("corroboration_none");
  });
});

// -------------------------------------------------------------- reinforcement

describe("reinforcement", () => {
  test("adds +1 once", () => {
    const { snr, trace } = scoreClaim(baseInput({ reinforced: true }));
    expect(snr).toBe(4 as never);
    expect(trace.modifiers.filter((m) => m.type === "reinforcement").length).toBe(1);
    expect(traceErrors(trace, snr)).toEqual([]);
  });
});

// ---------------------------------------------------------------- persistence

describe("persistence cap at 4", () => {
  test("bumps +1 when below 4", () => {
    const { snr, trace } = scoreClaim(
      baseInput({ sources: [src("trade")], persisted: true }),
    );
    // base 3 + 1 = 4
    expect(snr).toBe(4 as never);
    expect(trace.modifiers.some((m) => m.type === "persistence")).toBe(true);
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("never pushes above 4 (from base 4 it is a no-op)", () => {
    const { snr, trace } = scoreClaim(
      baseInput({ sources: [src("wire_pr")], persisted: true }),
    );
    expect(snr).toBe(4 as never);
    // no persistence modifier emitted since it would exceed the cap
    expect(trace.modifiers.some((m) => m.type === "persistence")).toBe(false);
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("never pushes a first_party 5 above 4 (no-op, stays 5)", () => {
    const { snr } = scoreClaim(baseInput({ sources: [src("first_party")], persisted: true }));
    expect(snr).toBe(5 as never);
  });
});

// -------------------------------------------------------------------- dispute

describe("dispute downgrade", () => {
  test("subtracts 1", () => {
    const { snr, trace } = scoreClaim(baseInput({ disputeDowngrade: true }));
    expect(snr).toBe(2 as never);
    expect(trace.modifiers.some((m) => m.type === "dispute")).toBe(true);
    expect(traceErrors(trace, snr)).toEqual([]);
  });
});

// --------------------------------------------------------------- extraordinary

describe("extraordinary", () => {
  test("forces 1 with a single source", () => {
    const { snr, trace } = scoreClaim(
      baseInput({ sources: [src("first_party")], extraordinary: true }),
    );
    expect(snr).toBe(1 as never);
    expect(trace.modifiers[0]?.type).toBe("extraordinary");
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("forces 1 then climbs with corroboration", () => {
    const { snr, trace } = scoreClaim(
      baseInput({
        sources: [src("first_party", 1), src("trade", 2), src("trade", 3), src("mainstream", 4)],
        extraordinary: true,
      }),
    );
    // reset to 1, +1 (2plus), +1 (4plus), +1 (mainstream) = 4
    expect(snr).toBe(4 as never);
    const types = trace.modifiers.map((m) => m.type);
    expect(types[0]).toBe("extraordinary");
    expect(types).toContain("corroboration_2plus");
    expect(types).toContain("corroboration_4plus");
    expect(types).toContain("mainstream_pickup");
    expect(traceErrors(trace, snr)).toEqual([]);
  });
});

// ------------------------------------------------------------ whitelist floor

describe("whitelist floor", () => {
  test("observer floors at 4", () => {
    const { snr, trace } = scoreClaim(
      baseInput({ sources: [src("informal")], whitelist: "observer" }),
    );
    expect(snr).toBe(4 as never);
    expect(trace.modifiers.some((m) => m.type === "whitelist_floor")).toBe(true);
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("self floors at 5", () => {
    const { snr, trace } = scoreClaim(
      baseInput({ sources: [src("informal")], whitelist: "self" }),
    );
    expect(snr).toBe(5 as never);
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("floor does not lower an already-higher score", () => {
    const { snr, trace } = scoreClaim(
      baseInput({ sources: [src("first_party")], whitelist: "observer" }),
    );
    // base 5, observer floor 4 must not pull it down
    expect(snr).toBe(5 as never);
    expect(trace.modifiers.some((m) => m.type === "whitelist_floor")).toBe(false);
  });

  test("self floor applies even when extraordinary is set", () => {
    // first_party lead so the extraordinary reset produces a real delta
    // (from base 5 down to 1) and is the first emitted modifier.
    const { snr, trace } = scoreClaim(
      baseInput({ sources: [src("first_party")], extraordinary: true, whitelist: "self" }),
    );
    // extraordinary resets to 1, self floor lifts to 5
    expect(snr).toBe(5 as never);
    expect(trace.modifiers[0]?.type).toBe("extraordinary");
    expect(trace.modifiers.some((m) => m.type === "whitelist_floor")).toBe(true);
    expect(traceErrors(trace, snr)).toEqual([]);
  });
});

// ------------------------------------------------------ direct-source ceiling

describe("direct-source ceiling (SNR 5 requires a direct source)", () => {
  test("wire_pr with corroboration caps at 4", () => {
    const { snr, trace } = scoreClaim(
      baseInput({
        sources: [src("wire_pr", 1), src("trade", 2), src("trade", 3), src("mainstream", 4)],
      }),
    );
    // base 4, all upward climbs clamp to the ceiling 4
    expect(snr).toBe(4 as never);
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("wire_pr self-floor overrides the ceiling to 5", () => {
    const { snr, trace } = scoreClaim(
      baseInput({
        sources: [src("wire_pr", 1), src("trade", 2)],
        whitelist: "self",
      }),
    );
    expect(snr).toBe(5 as never);
    expect(trace.modifiers.some((m) => m.type === "whitelist_floor")).toBe(true);
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("no indirect lead reaches 5, however wide the reporting", () => {
    const { snr, trace } = scoreClaim(
      baseInput({
        sources: [
          src("trade", 1),
          src("trade", 2),
          src("mainstream", 3),
          src("trade", 4),
          src("mainstream", 5),
        ],
        reinforced: true,
        persisted: true,
      }),
    );
    // base 3 + 1 (2plus) = 4; 4plus, pickup, reinforcement, persistence
    // are all skipped at the ceiling: wide reporting IS tier 4
    expect(snr).toBe(4 as never);
    expect(traceErrors(trace, snr)).toEqual([]);
  });

  test("a direct-source lead keeps its 5", () => {
    const { snr } = scoreClaim(
      baseInput({ sources: [src("first_party", 1), src("trade", 2)] }),
    );
    expect(snr).toBe(5 as never);
  });

  test("an extraordinary claim with a direct-source lead can climb back to 5", () => {
    const many = [
      src("first_party", 1),
      src("trade", 2),
      src("trade", 3),
      src("mainstream", 4),
    ];
    const { snr } = scoreClaim(
      baseInput({ sources: many, extraordinary: true, reinforced: true }),
    );
    // reset 1, +1 (2plus), +1 (4plus), +1 (pickup), +1 (reinforcement) = 5;
    // allowed because the lead IS the concerned party
    expect(snr).toBe(5 as never);
  });
});

// ------------------------------------------- validateSnrTrace across cases

describe("every scoreClaim output passes validateSnrTrace", () => {
  const diverse: Array<[string, ScoreInput]> = [
    ["lone informal", baseInput({ sources: [src("informal")] })],
    ["trade + crawl none", baseInput({ crawl: "found_none" })],
    [
      "extraordinary climbs",
      baseInput({
        sources: [src("first_party", 1), src("trade", 2), src("trade", 3), src("trade", 4)],
        extraordinary: true,
      }),
    ],
    ["self floor over reset", baseInput({ sources: [src("informal")], whitelist: "self", extraordinary: true })],
    ["wire_pr capped", baseInput({ sources: [src("wire_pr", 1), src("trade", 2)] })],
    ["persistence on trade", baseInput({ persisted: true })],
    [
      "everything at once",
      baseInput({
        sources: [src("trade", 1), src("trade", 2), src("mainstream", 3), src("trade", 4)],
        crawl: "found_none",
        reinforced: true,
        persisted: true,
        disputeDowngrade: true,
        whitelist: "observer",
      }),
    ],
  ];
  for (const [name, input] of diverse) {
    test(name, () => {
      const { snr, trace } = scoreClaim(input);
      expect(traceErrors(trace, snr)).toEqual([]);
    });
  }
});

// -------------------------------------------------------------- match windows

describe("matchDecision windows", () => {
  const existing = { id: "2026-07-01-x", date: "2026-07-01", snr: 4 };

  test("day 7 -> same_event (boundary)", () => {
    expect(matchDecision(existing, "2026-07-08")).toBe("same_event");
  });
  test("day 8 -> not same_event (high SNR -> new)", () => {
    expect(matchDecision(existing, "2026-07-09")).toBe("new");
  });

  const lowSnr = { id: "2026-07-01-y", date: "2026-07-01", snr: 2 };
  test("day 8 with snr<=2 -> reinforcement", () => {
    expect(matchDecision(lowSnr, "2026-07-09")).toBe("reinforcement");
  });
  test("day 30 with snr<=2 -> reinforcement (boundary)", () => {
    expect(matchDecision(lowSnr, "2026-07-31")).toBe("reinforcement");
  });
  test("day 31 with snr<=2 -> new (past reinforcement window)", () => {
    expect(matchDecision(lowSnr, "2026-08-01")).toBe("new");
  });

  test("snr 2 within window -> reinforcement, snr 3 -> new", () => {
    const at2 = { id: "a", date: "2026-07-01", snr: 2 };
    const at3 = { id: "b", date: "2026-07-01", snr: 3 };
    expect(matchDecision(at2, "2026-07-20")).toBe("reinforcement");
    expect(matchDecision(at3, "2026-07-20")).toBe("new");
  });

  test("daysBetween counts whole UTC days", () => {
    expect(daysBetween("2026-07-01", "2026-07-08")).toBe(7);
    expect(daysBetween("2026-07-01", "2026-06-30")).toBe(-1);
  });
});

describe("applyHistory / applyModifier are non-mutating and invariant-safe", () => {
  const trace: SnrTrace = {
    base: { tier: 3, source: "https://spacenews.com/x", reason: "trade" },
    modifiers: [{ type: "corroboration_2plus", delta: 1, reason: "two sources" }],
    final: 4,
    scorer_version: 1,
  };

  test("applyHistory returns a new trace, input untouched", () => {
    const next = applyHistory(trace, {
      date: "2026-07-10",
      from: 4,
      to: 5,
      reason: "first-party upgrade",
    });
    expect(next).not.toBe(trace);
    expect(trace.history).toBeUndefined();
    expect(next.history?.length).toBe(1);
    expect(next.modifiers).not.toBe(trace.modifiers);
  });

  test("applyModifier appends the modifier, recomputes final, records history", () => {
    const next = applyModifier(
      trace,
      { type: "dispute", delta: -1, reason: "lost a same-metric contradiction" },
      "2026-07-15",
    );
    // base 3 + 1 - 1 = 3
    expect(next.final).toBe(3 as never);
    expect(next.modifiers.length).toBe(2);
    expect(next.history?.[0]).toEqual({
      date: "2026-07-15",
      from: 4,
      to: 3,
      reason: "lost a same-metric contradiction",
    });
    expect(trace.final).toBe(4 as never);
    expect(trace.modifiers.length).toBe(1);
    // the result still satisfies the validator invariant
    expect(traceErrors(next, next.final)).toEqual([]);
  });

  test("applyModifier throws on a saturated modifier type", () => {
    expect(() =>
      applyModifier(
        trace,
        { type: "corroboration_2plus", delta: 1, reason: "again" },
        "2026-07-15",
      ),
    ).toThrow(/saturate/);
  });

  test("applyModifier honors the direct-source ceiling: upward no-op at 4", () => {
    // trace is base 3 (trade) already at 4; reinforcement cannot lift an
    // indirect lead to 5, so the trace comes back unchanged
    const next = applyModifier(
      trace,
      { type: "reinforcement", delta: 1, reason: "matching event attached" },
      "2026-07-15",
    );
    expect(next).toBe(trace);
  });

  test("applyModifier lets a direct-source lead climb to 5", () => {
    const direct: SnrTrace = {
      base: { tier: 5, source: "https://testco.example/pr", reason: "first-party" },
      modifiers: [{ type: "extraordinary", delta: -4, reason: "out of pattern" }],
      final: 1,
      scorer_version: 1,
    };
    const next = applyModifier(
      direct,
      { type: "corroboration_2plus", delta: 1, reason: "second source" },
      "2026-07-15",
    );
    expect(next.final).toBe(2 as never);
    expect(traceErrors(next, next.final)).toEqual([]);
  });

  test("applyModifier caps persistence at 4 even for direct-source leads", () => {
    const direct: SnrTrace = {
      base: { tier: 5, source: "https://testco.example/pr", reason: "first-party" },
      modifiers: [{ type: "extraordinary", delta: -4, reason: "out of pattern" }],
      final: 1,
      scorer_version: 1,
    };
    let t = applyModifier(direct, { type: "corroboration_2plus", delta: 1, reason: "x" }, "2026-07-10");
    t = applyModifier(t, { type: "corroboration_4plus", delta: 1, reason: "x" }, "2026-07-11");
    t = applyModifier(t, { type: "persistence", delta: 1, reason: "uncontested" }, "2026-07-25");
    expect(t.final).toBe(4 as never);
    const final = t;
    expect(() =>
      applyModifier(final, { type: "persistence", delta: 1, reason: "again" }, "2026-08-10"),
    ).toThrow(/saturate/);
  });

  test("appends to existing history without rewriting", () => {
    const once = applyHistory(trace, { date: "2026-07-10", from: 4, to: 3, reason: "dispute" });
    const twice = applyHistory(once, { date: "2026-07-12", from: 3, to: 4, reason: "recovered" });
    expect(twice.history?.length).toBe(2);
    expect(twice.history?.[0]?.reason).toBe("dispute");
  });
});

// -------------------------------------------------------------------- ledger

function ledgerSource(over: Partial<LedgerSource> = {}): LedgerSource {
  return { domain: "example.com", events: [], claims: [], ...over };
}

describe("ledger windowing", () => {
  const today = "2026-07-01";
  const source = ledgerSource({
    events: [
      { date: "2026-06-15", kind: "strike", claim: "a", reason: "wrong" }, // in window
      { date: "2026-01-01", kind: "strike", claim: "b", reason: "old" }, // out of window (>90d)
    ],
    claims: [
      { claim: "a", date: "2026-06-15", snr_at_publication: 3, resolution: "debunked" },
      { claim: "b", date: "2026-01-01", snr_at_publication: 3, resolution: "debunked" },
    ],
  });

  test("windowEvents drops events older than 90 days", () => {
    expect(windowEvents(source, today).length).toBe(1);
  });
  test("windowClaims drops claims older than 90 days", () => {
    expect(windowClaims(source, today).length).toBe(1);
  });
});

describe("net strikes / credits", () => {
  const today = "2026-07-01";
  test("net strikes subtract credits", () => {
    const s = ledgerSource({
      events: [
        { date: "2026-06-01", kind: "strike", claim: "a", reason: "" },
        { date: "2026-06-02", kind: "strike", claim: "b", reason: "" },
        { date: "2026-06-03", kind: "credit", claim: "c", reason: "" },
      ],
    });
    expect(netStrikes(s, today)).toBe(1);
    expect(netCredits(s, today)).toBe(-1);
  });
});

describe("demotionInEffect needs BOTH thresholds", () => {
  const today = "2026-07-01";

  test("3 net strikes AND rate >= 1/3 -> demoted", () => {
    const s = ledgerSource({
      events: [
        { date: "2026-06-01", kind: "strike", claim: "a", reason: "" },
        { date: "2026-06-02", kind: "strike", claim: "b", reason: "" },
        { date: "2026-06-03", kind: "strike", claim: "c", reason: "" },
      ],
      claims: [
        { claim: "a", date: "2026-06-01", snr_at_publication: 3, resolution: "debunked" },
        { claim: "b", date: "2026-06-02", snr_at_publication: 3, resolution: "debunked" },
        { claim: "c", date: "2026-06-03", snr_at_publication: 3, resolution: "debunked" },
      ],
    });
    // 3 strikes / 3 claims = rate 1.0 >= 1/3
    expect(demotionInEffect(s, today)).toBe(true);
  });

  test("3 net strikes but low rate (prolific source) -> NOT demoted", () => {
    const claims = Array.from({ length: 30 }, (_, i) => ({
      claim: `c${i}`,
      date: "2026-06-10",
      snr_at_publication: 3 as const,
      resolution: "confirmed" as const,
    }));
    const s = ledgerSource({
      events: [
        { date: "2026-06-01", kind: "strike", claim: "a", reason: "" },
        { date: "2026-06-02", kind: "strike", claim: "b", reason: "" },
        { date: "2026-06-03", kind: "strike", claim: "c", reason: "" },
      ],
      claims, // 3 / 30 = 0.1 < 1/3
    });
    expect(netStrikes(s, today)).toBe(3);
    expect(demotionInEffect(s, today)).toBe(false);
  });

  test("fewer than 3 net strikes -> NOT demoted", () => {
    const s = ledgerSource({
      events: [
        { date: "2026-06-01", kind: "strike", claim: "a", reason: "" },
        { date: "2026-06-02", kind: "strike", claim: "b", reason: "" },
      ],
      claims: [
        { claim: "a", date: "2026-06-01", snr_at_publication: 3, resolution: "debunked" },
        { claim: "b", date: "2026-06-02", snr_at_publication: 3, resolution: "debunked" },
      ],
    });
    expect(demotionInEffect(s, today)).toBe(false);
  });

  test("zero windowed claims -> NOT demoted (rate guard)", () => {
    const s = ledgerSource({
      events: [
        { date: "2026-06-01", kind: "strike", claim: "a", reason: "" },
        { date: "2026-06-02", kind: "strike", claim: "b", reason: "" },
        { date: "2026-06-03", kind: "strike", claim: "c", reason: "" },
      ],
      claims: [],
    });
    expect(demotionInEffect(s, today)).toBe(false);
  });
});

describe("recoveryEligible", () => {
  const today = "2026-07-01";

  test("not eligible when no demotion in place", () => {
    const s = ledgerSource({ class_override: null });
    expect(recoveryEligible(s, today)).toBe(false);
  });

  test("3 net credits in window -> eligible", () => {
    const s = ledgerSource({
      class_override: "informal",
      events: [
        { date: "2026-06-01", kind: "credit", claim: "a", reason: "" },
        { date: "2026-06-02", kind: "credit", claim: "b", reason: "" },
        { date: "2026-06-03", kind: "credit", claim: "c", reason: "" },
      ],
    });
    expect(recoveryEligible(s, today)).toBe(true);
  });

  test("zero strikes across the window while demoted -> eligible", () => {
    const s = ledgerSource({
      class_override: "informal",
      events: [{ date: "2026-06-01", kind: "credit", claim: "a", reason: "" }],
    });
    expect(recoveryEligible(s, today)).toBe(true);
  });

  test("strikes present and fewer than 3 credits -> not eligible", () => {
    const s = ledgerSource({
      class_override: "informal",
      events: [
        { date: "2026-06-01", kind: "strike", claim: "a", reason: "" },
        { date: "2026-06-02", kind: "credit", claim: "b", reason: "" },
      ],
    });
    expect(recoveryEligible(s, today)).toBe(false);
  });
});

describe("effectiveClass", () => {
  const today = "2026-07-01";
  const demoted = ledgerSource({
    events: [
      { date: "2026-06-01", kind: "strike", claim: "a", reason: "" },
      { date: "2026-06-02", kind: "strike", claim: "b", reason: "" },
      { date: "2026-06-03", kind: "strike", claim: "c", reason: "" },
    ],
    claims: [
      { claim: "a", date: "2026-06-01", snr_at_publication: 3, resolution: "debunked" },
      { claim: "b", date: "2026-06-02", snr_at_publication: 3, resolution: "debunked" },
      { claim: "c", date: "2026-06-03", snr_at_publication: 3, resolution: "debunked" },
    ],
  });

  test("trade demotes to informal when demotionInEffect", () => {
    expect(effectiveClass("trade", demoted, today)).toBe("informal");
  });
  test("other classes never demote", () => {
    expect(effectiveClass("first_party", demoted, today)).toBe("first_party");
    expect(effectiveClass("mainstream", demoted, today)).toBe("mainstream");
  });
  test("stored class_override wins", () => {
    const s = ledgerSource({ class_override: "informal" });
    expect(effectiveClass("trade", s, today)).toBe("informal");
  });
  test("no demotion -> natural class", () => {
    expect(effectiveClass("trade", ledgerSource(), today)).toBe("trade");
  });
});

describe("recordClaim / resolveClaim are non-mutating", () => {
  test("recordClaim appends a new claim", () => {
    const s = ledgerSource();
    const next = recordClaim(s, {
      claim: "x",
      date: "2026-07-01",
      snr_at_publication: 3,
      resolution: "unresolved",
    });
    expect(next).not.toBe(s);
    expect(s.claims.length).toBe(0);
    expect(next.claims.length).toBe(1);
  });

  test("resolveClaim updates the matching claim and can append an event", () => {
    const s = ledgerSource({
      claims: [{ claim: "x", date: "2026-07-01", snr_at_publication: 2, resolution: "unresolved" }],
    });
    const next = resolveClaim(s, "x", "confirmed", "2026-07-10", {
      date: "2026-07-10",
      kind: "credit",
      claim: "x",
      reason: "reached 4",
    });
    expect(next.claims[0]?.resolution).toBe("confirmed");
    expect(next.claims[0]?.resolved_on).toBe("2026-07-10");
    expect(next.events.length).toBe(1);
    // input untouched
    expect(s.claims[0]?.resolution).toBe("unresolved");
    expect(s.events.length).toBe(0);
  });
});

describe("calibration bucket math", () => {
  test("buckets by snr_at_publication with resolution counts", () => {
    const sources: LedgerSource[] = [
      ledgerSource({
        claims: [
          { claim: "a", date: "2026-06-01", snr_at_publication: 2, resolution: "confirmed" },
          { claim: "b", date: "2026-06-01", snr_at_publication: 2, resolution: "debunked" },
          { claim: "c", date: "2026-06-01", snr_at_publication: 2, resolution: "unresolved" },
        ],
      }),
      ledgerSource({
        domain: "two.com",
        claims: [{ claim: "d", date: "2026-06-01", snr_at_publication: 5, resolution: "confirmed" }],
      }),
    ];
    const buckets = calibration(sources);
    expect(buckets.map((b) => b.snr)).toEqual([2, 5]);
    const two = buckets.find((b) => b.snr === 2)!;
    expect(two).toEqual({ snr: 2, total: 3, confirmed: 1, debunked: 1, unresolved: 1 });
    const five = buckets.find((b) => b.snr === 5)!;
    expect(five.total).toBe(1);
    expect(five.confirmed).toBe(1);
  });

  test("empty ledger -> no buckets", () => {
    expect(calibration([ledgerSource()])).toEqual([]);
  });
});

describe("promotionCandidates requires all three criteria", () => {
  const today = "2026-07-01";

  function claimsSpanning(): LedgerSource {
    // 5 distinct claims at SNR>=4, spanning >=30 days, zero strikes.
    return ledgerSource({
      claims: [
        { claim: "c1", date: "2026-05-25", snr_at_publication: 4, resolution: "confirmed" },
        { claim: "c2", date: "2026-06-01", snr_at_publication: 4, resolution: "confirmed" },
        { claim: "c3", date: "2026-06-10", snr_at_publication: 5, resolution: "confirmed" },
        { claim: "c4", date: "2026-06-20", snr_at_publication: 4, resolution: "confirmed" },
        { claim: "c5", date: "2026-06-25", snr_at_publication: 4, resolution: "confirmed" },
      ],
    });
  }

  test("all three met -> candidate", () => {
    const out = promotionCandidates([claimsSpanning()], today);
    expect(out.length).toBe(1);
    expect(out[0]?.claims.length).toBe(5);
  });

  test("fewer than 5 qualifying claims -> no candidate", () => {
    const s = claimsSpanning();
    s.claims = s.claims.slice(0, 4);
    expect(promotionCandidates([s], today)).toEqual([]);
  });

  test("span shorter than 30 days -> no candidate", () => {
    const s = ledgerSource({
      claims: [
        { claim: "c1", date: "2026-06-20", snr_at_publication: 4, resolution: "confirmed" },
        { claim: "c2", date: "2026-06-21", snr_at_publication: 4, resolution: "confirmed" },
        { claim: "c3", date: "2026-06-22", snr_at_publication: 4, resolution: "confirmed" },
        { claim: "c4", date: "2026-06-23", snr_at_publication: 4, resolution: "confirmed" },
        { claim: "c5", date: "2026-06-24", snr_at_publication: 4, resolution: "confirmed" },
      ],
    });
    expect(promotionCandidates([s], today)).toEqual([]);
  });

  test("an unresolved claim does not count", () => {
    const s = claimsSpanning();
    s.claims[2] = { claim: "c3", date: "2026-06-10", snr_at_publication: 4, resolution: "unresolved" };
    // now only 4 qualifying claims
    expect(promotionCandidates([s], today)).toEqual([]);
  });

  test("claims published low but later confirmed qualify (the whole point)", () => {
    // an informal account publishes at 1-2; promotion must still see it
    // once its claims resolve confirmed via floor-independent corroboration
    const s = ledgerSource({
      claims: [
        { claim: "c1", date: "2026-05-25", snr_at_publication: 1, resolution: "confirmed", resolved_on: "2026-06-05" },
        { claim: "c2", date: "2026-06-01", snr_at_publication: 2, resolution: "confirmed", resolved_on: "2026-06-10" },
        { claim: "c3", date: "2026-06-10", snr_at_publication: 2, resolution: "confirmed", resolved_on: "2026-06-20" },
        { claim: "c4", date: "2026-06-20", snr_at_publication: 1, resolution: "confirmed", resolved_on: "2026-06-28" },
        { claim: "c5", date: "2026-06-25", snr_at_publication: 2, resolution: "confirmed", resolved_on: "2026-06-30" },
      ],
    });
    const out = promotionCandidates([s], today);
    expect(out.length).toBe(1);
    expect(out[0]?.claims.length).toBe(5);
  });

  test("a strike in window disqualifies", () => {
    const s = claimsSpanning();
    s.events = [{ date: "2026-06-15", kind: "strike", claim: "c3", reason: "wrong" }];
    expect(promotionCandidates([s], today)).toEqual([]);
  });
});

// ----------------------------------------------------------------- reconcile

describe("reconcile branches", () => {
  test("metric mismatch -> annotate_mismatch", () => {
    expect(reconcile({ snr: 5 }, { snr: 3, tier: "provisional" }, false)).toEqual({
      action: "annotate_mismatch",
    });
  });

  test("provisional fact never downgrades incoming; higher incoming -> flag_refresh", () => {
    expect(reconcile({ snr: 5 }, { snr: 3, tier: "provisional" }, true)).toEqual({
      action: "flag_refresh",
    });
  });

  test("provisional fact, equal/lower incoming -> no_registry_change", () => {
    expect(reconcile({ snr: 3 }, { snr: 3, tier: "provisional" }, true)).toEqual({
      action: "no_registry_change",
    });
    expect(reconcile({ snr: 2 }, { snr: 3, tier: "provisional" }, true)).toEqual({
      action: "no_registry_change",
    });
  });

  test("canonical fact higher than incoming -> downgrade_incoming (disputed)", () => {
    expect(reconcile({ snr: 3 }, { snr: 5, tier: "canonical" }, true)).toEqual({
      action: "downgrade_incoming",
      markDisputed: true,
    });
  });

  test("incoming higher than canonical fact -> flag_refresh", () => {
    expect(reconcile({ snr: 5 }, { snr: 4, tier: "canonical" }, true)).toEqual({
      action: "flag_refresh",
    });
  });

  test("equal SNR same metric -> both_disputed_queue", () => {
    expect(reconcile({ snr: 4 }, { snr: 4, tier: "canonical" }, true)).toEqual({
      action: "both_disputed_queue",
    });
  });

  test("unscored fact counts as canonical SNR 5", () => {
    expect(reconcile({ snr: 4 }, { unscored: true }, true)).toEqual({
      action: "downgrade_incoming",
      markDisputed: true,
    });
    expect(reconcile({ snr: 5 }, { unscored: true }, true)).toEqual({
      action: "both_disputed_queue",
    });
  });

  test("computed fact (canonical SNR 5) beats a lower incoming", () => {
    expect(reconcile({ snr: 3 }, { snr: 5, tier: "canonical" }, true)).toEqual({
      action: "downgrade_incoming",
      markDisputed: true,
    });
  });
});
