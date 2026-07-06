/**
 * "Known to MCC" window logic (SNR_SPEC.md §3.1, SNR_PLAN.md §A2).
 *
 * Pure, deterministic, date-only. Same actor + same event-class matching
 * is the agent's judgment upstream; this module decides only, given that
 * a candidate matches an existing item, whether it is the same event, a
 * reinforcement, or a genuinely new item, using the dedup/reinforcement
 * windows and the existing item's SNR.
 */

import type { SnrTrace, SnrHistoryEntry, SnrModifier, SnrValue } from "../../src/data/schema";
import {
  DEDUP_WINDOW_DAYS,
  REINFORCEMENT_WINDOW_DAYS,
  REINFORCEMENT_MAX_SNR,
} from "../../src/data/schema";

export type MatchDecision = "same_event" | "reinforcement" | "new";

/** Whole days between two YYYY-MM-DD dates (candidate - existing), UTC. */
export function daysBetween(existingDate: string, candidateDate: string): number {
  const a = Date.parse(existingDate + "T00:00:00Z");
  const b = Date.parse(candidateDate + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/**
 * Decide how a matching candidate relates to an existing item:
 *   - within DEDUP_WINDOW_DAYS -> same_event (attach source, corroborate)
 *   - else within REINFORCEMENT_WINDOW_DAYS and existing SNR <=
 *     REINFORCEMENT_MAX_SNR -> reinforcement (attach source, bump +1)
 *   - else -> new (cross-link, do not merge)
 *
 * Windows are inclusive at their boundary day (day 7 is still same_event,
 * day 30 still reinforcement). Uses the absolute day gap so an
 * out-of-order candidate date is handled symmetrically.
 */
export function matchDecision(
  existing: { id: string; date: string; snr: number },
  candidateDate: string,
): MatchDecision {
  const gap = Math.abs(daysBetween(existing.date, candidateDate));
  if (gap <= DEDUP_WINDOW_DAYS) return "same_event";
  if (gap <= REINFORCEMENT_WINDOW_DAYS && existing.snr <= REINFORCEMENT_MAX_SNR) {
    return "reinforcement";
  }
  return "new";
}

/**
 * Return a NEW trace with the history entry appended. Never mutates the
 * input trace or its arrays (traces are append-only over an item's life,
 * SNR_PLAN.md §B6). Earlier history entries are preserved verbatim.
 */
export function applyHistory(trace: SnrTrace, entry: SnrHistoryEntry): SnrTrace {
  return {
    ...trace,
    modifiers: trace.modifiers.slice(),
    history: [...(trace.history ?? []), entry],
  };
}

/**
 * Apply a post-publication modifier (reinforcement, persistence, dispute,
 * mainstream pickup found in a later sweep) to a live trace. Appends the
 * modifier, recomputes final so the validator invariant
 * final === clamp(base.tier + sum(deltas), 1, 5) keeps holding, and
 * records the move in history. Never mutates its inputs.
 *
 * Rules enforced here so callers cannot store an invalid trace:
 *  - Saturation (SNR_SPEC §2.1): throws if the modifier type is already
 *    present on the trace.
 *  - Direct-source ceiling (SNR_SPEC §2 table): an upward move never
 *    lifts the final above 4 unless the trace's base tier is 5 or the
 *    modifier is the whitelist self floor; persistence additionally
 *    never lifts above 4 at all. When the ceiling reduces the requested
 *    delta to zero, the trace is returned unchanged: no modifier, no
 *    history entry.
 */
export function applyModifier(trace: SnrTrace, modifier: SnrModifier, date: string): SnrTrace {
  if (trace.modifiers.some((m) => m.type === modifier.type)) {
    throw new Error(`applyModifier: "${modifier.type}" already applied; modifiers saturate`);
  }
  const priorSum = trace.modifiers.reduce((n, m) => n + m.delta, 0);
  const from = trace.final;
  const clamp = (n: number): SnrValue => Math.min(5, Math.max(1, n)) as SnrValue;

  let ceiling = 5;
  if (modifier.delta > 0 && modifier.type !== "whitelist_floor" && trace.base.tier < 5) ceiling = 4;
  if (modifier.type === "persistence") ceiling = Math.min(ceiling, 4);

  const requested = clamp(trace.base.tier + priorSum + modifier.delta);
  const target = modifier.delta > 0 ? (Math.min(ceiling, requested) as SnrValue) : requested;
  const delta = target - from;
  if (delta === 0) return trace;

  return {
    ...trace,
    modifiers: [...trace.modifiers, { ...modifier, delta }],
    final: target,
    history: [...(trace.history ?? []), { date, from, to: target, reason: modifier.reason }],
  };
}
