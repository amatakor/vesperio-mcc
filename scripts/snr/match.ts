/**
 * "Known to MCC" window logic (SNR_SPEC.md §3.1, SNR_PLAN.md §A2).
 *
 * Pure, deterministic, date-only. Same actor + same event-class matching
 * is the agent's judgment upstream; this module decides only, given that
 * a candidate matches an existing item, whether it is the same event, a
 * reinforcement, or a genuinely new item, using the dedup/reinforcement
 * windows and the existing item's SNR.
 */

import type { SnrTrace, SnrHistoryEntry, SnrValue } from "../../src/data/schema";
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
 * Convenience for the reinforcement/dispute rescore path: given a trace
 * and a new final value, return a NEW trace whose `final` is updated and
 * whose history records the from/to move. The caller is expected to have
 * recomputed the trace's modifiers via scoreClaim; this helper is for the
 * common case where only the final and a history line change (e.g. a
 * persistence bump recorded on the live item). It never mutates.
 */
export function rescoreWithFinal(
  trace: SnrTrace,
  to: SnrValue,
  date: string,
  reason: string,
): SnrTrace {
  const from = trace.final;
  const next = applyHistory({ ...trace, final: to }, { date, from, to, reason });
  return next;
}
