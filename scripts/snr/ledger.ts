/**
 * Source reliability ledger math (SNR_SPEC.md §7.1/§7.2, SNR_PLAN.md
 * §A4/§A5).
 *
 * Pure, deterministic, date-only. All functions read a LedgerSource and a
 * `today` parameter; none mutate their inputs. recordClaim/resolveClaim
 * return NEW LedgerSource objects (the ledger is append-only). Decisions
 * use only events inside LEDGER_WINDOW_DAYS.
 */

import type {
  LedgerSource,
  LedgerEvent,
  LedgerClaim,
  SourceClass,
  SnrValue,
  ClaimResolution,
} from "../../src/data/schema";
import {
  LEDGER_WINDOW_DAYS,
  LEDGER_DEMOTION_NET_STRIKES,
  LEDGER_DEMOTION_MIN_STRIKE_RATE,
  LEDGER_RECOVERY_NET_CREDITS,
  PROMOTION_MIN_CLAIMS,
  PROMOTION_WINDOW_DAYS,
} from "../../src/data/schema";

function daysAgo(date: string, today: string): number {
  const a = Date.parse(date + "T00:00:00Z");
  const b = Date.parse(today + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/** True when `date` is within LEDGER_WINDOW_DAYS on or before `today`. */
function inWindow(date: string, today: string): boolean {
  const d = daysAgo(date, today);
  return d >= 0 && d <= LEDGER_WINDOW_DAYS;
}

/** Events within the rolling ledger window (SNR_PLAN.md §A4). */
export function windowEvents(source: LedgerSource, today: string): LedgerEvent[] {
  return source.events.filter((e) => inWindow(e.date, today));
}

/** Claims first scored within the rolling ledger window. */
export function windowClaims(source: LedgerSource, today: string): LedgerClaim[] {
  return source.claims.filter((c) => inWindow(c.date, today));
}

function countStrikes(events: LedgerEvent[]): number {
  return events.filter((e) => e.kind === "strike").length;
}
function countCredits(events: LedgerEvent[]): number {
  return events.filter((e) => e.kind === "credit").length;
}

/** Strikes minus credits within the window. */
export function netStrikes(source: LedgerSource, today: string): number {
  const ev = windowEvents(source, today);
  return countStrikes(ev) - countCredits(ev);
}

/** Credits minus strikes within the window. */
export function netCredits(source: LedgerSource, today: string): number {
  const ev = windowEvents(source, today);
  return countCredits(ev) - countStrikes(ev);
}

/**
 * Demotion in effect (SNR_PLAN.md §A4): needs BOTH
 *   - net strikes >= LEDGER_DEMOTION_NET_STRIKES, AND
 *   - strike rate >= LEDGER_DEMOTION_MIN_STRIKE_RATE of the source's
 *     windowed claims (rate guard: prolific sources are not demoted on
 *     absolute count alone).
 * With zero windowed claims the rate guard cannot be met, so no demotion.
 */
export function demotionInEffect(source: LedgerSource, today: string): boolean {
  const net = netStrikes(source, today);
  if (net < LEDGER_DEMOTION_NET_STRIKES) return false;
  const claims = windowClaims(source, today).length;
  if (claims === 0) return false;
  const strikes = countStrikes(windowEvents(source, today));
  const rate = strikes / claims;
  return rate >= LEDGER_DEMOTION_MIN_STRIKE_RATE;
}

/**
 * Recovery eligible (SNR_PLAN.md §A4): a demoted source climbs back with
 * either LEDGER_RECOVERY_NET_CREDITS net credits in the window, OR zero
 * strikes across the whole window while demoted. Only meaningful when a
 * class_override (demotion) is in effect.
 */
export function recoveryEligible(source: LedgerSource, today: string): boolean {
  if (source.class_override === undefined || source.class_override === null) return false;
  if (netCredits(source, today) >= LEDGER_RECOVERY_NET_CREDITS) return true;
  return countStrikes(windowEvents(source, today)) === 0;
}

/**
 * The class a source's next claim scores at (SNR_PLAN.md §A4). A stored
 * class_override (a live demotion) wins. Otherwise, only `trade` demotes,
 * and only to `informal`, when demotionInEffect holds; every other class
 * is unaffected by the ledger.
 */
export function effectiveClass(
  naturalClass: SourceClass,
  source: LedgerSource,
  today: string,
): SourceClass {
  if (source.class_override !== undefined && source.class_override !== null) {
    return source.class_override;
  }
  if (naturalClass === "trade" && demotionInEffect(source, today)) return "informal";
  return naturalClass;
}

/**
 * Append a reliability event, returning a NEW LedgerSource (no mutation).
 */
export function recordClaim(
  source: LedgerSource,
  claim: LedgerClaim,
): LedgerSource {
  return { ...source, claims: [...source.claims, claim] };
}

/**
 * Resolve an existing calibration claim, returning a NEW LedgerSource.
 * The matching claim (by `claim` id) is replaced with a new object
 * carrying the resolution and resolved_on date; all others are untouched.
 * Optionally appends the reliability event the resolution implies (a
 * strike or credit) when `event` is provided.
 */
export function resolveClaim(
  source: LedgerSource,
  claimId: string,
  resolution: ClaimResolution,
  resolvedOn: string,
  event?: LedgerEvent,
): LedgerSource {
  const claims = source.claims.map((c) =>
    c.claim === claimId ? { ...c, resolution, resolved_on: resolvedOn } : c,
  );
  const events = event === undefined ? source.events : [...source.events, event];
  return { ...source, claims, events };
}

export interface CalibrationBucket {
  snr: SnrValue;
  total: number;
  confirmed: number;
  debunked: number;
  unresolved: number;
}

/**
 * Calibration report (SNR_PLAN.md §A4): for each SNR-at-publication, how
 * many claims resolved which way. Buckets are keyed by snr_at_publication
 * across all supplied sources; returned sorted by snr ascending. Only
 * SNR values that actually occur get a bucket.
 */
export function calibration(sources: LedgerSource[]): CalibrationBucket[] {
  const bySnr = new Map<SnrValue, CalibrationBucket>();
  for (const source of sources) {
    for (const c of source.claims) {
      let bucket = bySnr.get(c.snr_at_publication);
      if (bucket === undefined) {
        bucket = { snr: c.snr_at_publication, total: 0, confirmed: 0, debunked: 0, unresolved: 0 };
        bySnr.set(c.snr_at_publication, bucket);
      }
      bucket.total += 1;
      if (c.resolution === "confirmed") bucket.confirmed += 1;
      else if (c.resolution === "debunked") bucket.debunked += 1;
      else bucket.unresolved += 1;
    }
  }
  return [...bySnr.values()].sort((a, b) => a.snr - b.snr);
}

export interface PromotionCandidate {
  domain: string;
  name?: string;
  claims: LedgerClaim[];
}

/**
 * Signals promotion candidates (SNR_PLAN.md §A5). A source qualifies when
 * ALL THREE hold within the window:
 *   - at least PROMOTION_MIN_CLAIMS distinct qualifying claims,
 *   - the qualifying claims span at least PROMOTION_WINDOW_DAYS,
 *   - zero strikes in the window.
 * A claim qualifies by RESOLUTION, not by its publication score: it must
 * have resolved "confirmed" (the resolver marks confirmed when the claim
 * reached PROMOTION_MIN_SNR via floor-independent corroboration, or was
 * confirmed first-party). Filtering on snr_at_publication would exclude
 * exactly the sources promotion exists for: informal accounts publish at
 * 1-2 by definition, and "started low, ended confirmed" is the credit
 * pattern we are looking for.
 */
export function promotionCandidates(
  sources: LedgerSource[],
  today: string,
): PromotionCandidate[] {
  const out: PromotionCandidate[] = [];
  for (const source of sources) {
    if (countStrikes(windowEvents(source, today)) > 0) continue;
    const windowed = windowClaims(source, today);
    const qualifying = windowed.filter((c) => c.resolution === "confirmed");
    const distinct = new Set(qualifying.map((c) => c.claim));
    if (distinct.size < PROMOTION_MIN_CLAIMS) continue;
    const days = qualifying.map((c) => Date.parse(c.date + "T00:00:00Z"));
    const span = Math.round((Math.max(...days) - Math.min(...days)) / 86_400_000);
    if (span < PROMOTION_WINDOW_DAYS) continue;
    const cand: PromotionCandidate = { domain: source.domain, claims: qualifying };
    if (source.name !== undefined) cand.name = source.name;
    out.push(cand);
  }
  return out;
}
