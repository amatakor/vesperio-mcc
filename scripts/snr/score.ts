/**
 * Deterministic SNR scoring (SNR_SPEC.md §2, SNR_PLAN.md §B).
 *
 * Pure function, no I/O, no network, no Date(). Every "today" or dated
 * input is passed in by the caller. The judgment inputs (source class,
 * extraordinary flag, crawl outcome, whitelist status, reinforcement,
 * persistence, dispute) are attested by the agent upstream; this module
 * only does the arithmetic and emits the trace.
 *
 * The math contract (validator-enforced, scripts/lib/validate.ts):
 *   final === clamp(base.tier + sum(modifier deltas), 1, 5)
 * so every effect (the extraordinary reset, the whitelist floor, the
 * persistence cap) is expressed as an integer delta and the running
 * subtotal is what the deltas add up to.
 */

import type { SnrValue, SnrTrace, SnrModifier, ItemSource, SourceClass } from "../../src/data/schema";
import { SCORER_VERSION } from "../../src/data/schema";

/**
 * The base-tier map (SNR_PLAN.md §B1, fixed by contract). A ledger
 * class_override replaces the natural class before this map is applied.
 */
export const BASE_TIER_BY_CLASS: Record<SourceClass, SnrValue> = {
  first_party: 5,
  official_record: 5,
  computed: 5,
  wire_pr: 4,
  aggregator: 4,
  trade: 3,
  mainstream: 3,
  whitelist: 3,
  informal: 1,
};

/**
 * The direct-source ceiling (SNR_SPEC.md §2 table): SNR 5 means "direct
 * source from the concerned party", so a claim whose lead source is not
 * tier 5 (first_party / official_record / computed) cannot climb above 4
 * via corroboration, reinforcement, or persistence, however wide the
 * reporting; the table's tier 4 IS "wide reporting". This subsumes the
 * wire_pr anti-spoof cap (SNR_PLAN.md §B1). Only the whitelist self
 * floor lifts past it, because the actor speaking about itself is a
 * direct source.
 */
const INDIRECT_CEILING = 4;

export interface ScoreInput {
  /**
   * Distinct, agent-deduped sources attached to the claim. The first
   * entry is the lead (best) source whose class sets the base tier.
   */
  sources: ItemSource[];
  /** Out-of-pattern claim: forces the base to 1 before it can climb (§2.1). */
  extraordinary: boolean;
  /**
   * Corroboration-crawl outcome for this event (SNR_PLAN.md §A3):
   * "found_none" applies the -1 penalty; "not_attempted" (budget
   * exhausted, or no crawl) never does.
   */
  crawl: "found_none" | "found_some" | "not_attempted";
  /**
   * Whitelist floor (§2.2), null when it does not apply: "self" =
   * concerned party about itself (floor 5), "observer" = whitelisted
   * account reporting a third party (floor 4). The caller sets this
   * non-null only for on-topic factual claims that earn the floor.
   */
  whitelist: "self" | "observer" | null;
  /** A matching later event attached (reinforcement, SNR_PLAN.md §A2). */
  reinforced: boolean;
  /** PERSISTENCE_DAYS elapsed uncontested (SNR_PLAN.md §A1); caps at 4. */
  persisted: boolean;
  /** Lost a same-metric contradiction (SNR_SPEC.md §6). */
  disputeDowngrade: boolean;
}

export interface ScoreResult {
  snr: SnrValue;
  trace: SnrTrace;
}

function clamp(n: number): SnrValue {
  return Math.min(5, Math.max(1, n)) as SnrValue;
}

/**
 * scoreClaim computes the SNR and its trace deterministically.
 *
 * Conceptual order (each step clamps into [1,5], and each modifier's
 * emitted delta is the difference between the running subtotal before
 * and after that step, so the deltas sum exactly to the final):
 *   1. base tier (lead source class -> BASE_TIER_BY_CLASS)
 *   2. extraordinary: reset subtotal to 1
 *   3. corroboration_2plus / corroboration_4plus / mainstream_pickup,
 *      all capped by the direct-source ceiling
 *   4. corroboration_none (only when crawl === "found_none")
 *   5. reinforcement (ceiling-capped)
 *   6. persistence (never above 4)
 *   7. dispute
 *   8. whitelist_floor (applied last; lifts to 4 observer / 5 self;
 *      the self floor is the one way past the direct-source ceiling)
 */
export function scoreClaim(input: ScoreInput): ScoreResult {
  const lead = input.sources[0];
  if (lead === undefined) {
    throw new Error("scoreClaim: sources must contain at least the lead source");
  }

  const naturalClass = lead.class;
  const baseTier = BASE_TIER_BY_CLASS[naturalClass];
  const baseReason = `base tier ${baseTier} from lead source class "${naturalClass}" (${lead.outlet})`;

  const modifiers: SnrModifier[] = [];
  // The running subtotal the deltas must reproduce. Starts at the base
  // and is clamped after every conceptual step.
  let subtotal: number = baseTier;

  // Emit a modifier whose delta moves the running subtotal to `target`
  // (target already clamped by the caller). Skips zero-delta no-ops so
  // the trace stays clean, except where the caller wants the record.
  const push = (
    type: SnrModifier["type"],
    target: number,
    reason: string,
    source?: string,
  ): void => {
    const delta = target - subtotal;
    if (delta === 0) return;
    const mod: SnrModifier = { type, delta, reason };
    if (source !== undefined) mod.source = source;
    modifiers.push(mod);
    subtotal = target;
  };

  const distinct = input.sources.length;
  // Pickup means coverage beyond the lead: a lone mainstream lead is
  // "a few reputable sources" (tier 3, spec §2 table), not a bonus.
  const pickup = input.sources.slice(1).find((s) => s.class === "mainstream");

  // 1. Direct-source ceiling (see INDIRECT_CEILING above): upward climbs
  //    are clamped to it; downgrades and the self-floor bypass it.
  const climbCeiling = baseTier >= 5 ? 5 : INDIRECT_CEILING;
  const up = (n: number): number => Math.min(climbCeiling, clamp(n));

  // 2. Extraordinary reset: force the pre-corroboration subtotal to 1.
  if (input.extraordinary) {
    push("extraordinary", 1, "extraordinary claim: reset to 1, must climb via corroboration");
  }

  // 3. Corroboration and mainstream pickup.
  if (distinct >= 2) {
    push(
      "corroboration_2plus",
      up(subtotal + 1),
      `${distinct} distinct sources (>=2)`,
    );
  }
  if (distinct >= 4) {
    push(
      "corroboration_4plus",
      up(subtotal + 1),
      `${distinct} distinct sources (>=4)`,
    );
  }
  if (pickup !== undefined) {
    push(
      "mainstream_pickup",
      up(subtotal + 1),
      "picked up by a mainstream (non-trade) outlet",
      pickup.url,
    );
  }

  // 4. Nothing-found penalty: only when the crawl actually ran.
  if (input.crawl === "found_none") {
    push("corroboration_none", clamp(subtotal - 1), "corroboration crawl ran and found nothing");
  }

  // 5. Reinforcement.
  if (input.reinforced) {
    push("reinforcement", up(subtotal + 1), "a matching later event reinforced this claim");
  }

  // 6. Persistence: +1 but never pushes the result above 4 (and never
  //    above the wire_pr ceiling either). It only ever raises, so when
  //    the subtotal is already at or above 4 it is a no-op, never a
  //    downgrade.
  if (input.persisted && subtotal < 4) {
    const target = Math.min(4, up(subtotal + 1));
    push("persistence", target, "survived uncontested past the persistence window (caps at 4)");
  }

  // 7. Dispute.
  if (input.disputeDowngrade) {
    push("dispute", clamp(subtotal - 1), "lost a same-metric contradiction");
  }

  // 8. Whitelist floor (last). Lifts the subtotal up to the floor only
  //    when it is below; the self floor (5) overrides the wire_pr cap.
  if (input.whitelist !== null) {
    const floor = input.whitelist === "self" ? 5 : 4;
    if (subtotal < floor) {
      push(
        "whitelist_floor",
        floor,
        input.whitelist === "self"
          ? "whitelist floor: concerned party about itself (5)"
          : "whitelist floor: whitelisted observer (4)",
      );
    }
  }

  const final = clamp(subtotal);
  const trace: SnrTrace = {
    base: { tier: baseTier, source: lead.url, reason: baseReason },
    modifiers,
    final,
    scorer_version: SCORER_VERSION,
  };
  return { snr: final, trace };
}
