/**
 * /log KPIs and lead-source presence (Phase 7). Pure, client-safe:
 * types and constants only, no dataset imports, so it computes the same
 * way in the prerender bundle and in tests. The /log page renders these
 * numbers; nothing here is stored as a fact.
 *
 * Every measure is windowed to the trailing WINDOW_DAYS from a caller-
 * supplied `now` (the build moment), so the module is deterministic
 * given (data, now).
 */

import type { Item, LedgerSource } from "../data/schema";

const DAY_MS = 86_400_000;

/** Default reporting window: the trailing 30 days from the build moment. */
export const KPI_WINDOW_DAYS = 30;

/** Registrable-ish host of a URL: the hostname minus a leading www. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Minimal shape of a registry crossfeed candidate this module needs. */
export interface CrossfeedCandidateRef {
  proposed_on: string;
  status: string;
}

/** The six headline numbers the /log KPI row shows, each labelled honestly. */
export interface LogKpis {
  windowDays: number;
  /** Published items in the window (context for the rates). */
  itemCount: number;
  /** Window items divided by windowDays, kept to one decimal. */
  itemsPerDay: number;
  /** Distinct lead-source domains among the window's items. */
  leadDomains: number;
  /** Share of window items scored SNR 1 or 2, as an integer percent. */
  pctLowSnr: number;
  /** Registry crossfeed candidates still queued, proposed in the window. */
  crossfeedQueued: number;
  /** Calibration claims that resolved (confirmed or debunked) in the window. */
  claimsResolved: number;
  /** Window items floored by a signals-list whitelist source. */
  signalsSourced: number;
}

/** One lead-source domain and how many of the window's items it led. */
export interface PresenceRow {
  domain: string;
  count: number;
}

function cutoffDay(now: Date, windowDays: number): string {
  return new Date(now.getTime() - windowDays * DAY_MS).toISOString().slice(0, 10);
}

/** Items whose event date falls in the trailing window. */
export function itemsInWindow(items: Item[], now: Date, windowDays = KPI_WINDOW_DAYS): Item[] {
  const cut = cutoffDay(now, windowDays);
  return items.filter((i) => i.date >= cut);
}

/** True when the item carries a whitelist-floor modifier in its stored trace. */
function isSignalsSourced(item: Item): boolean {
  return (item.snr_trace?.modifiers ?? []).some((m) => m.type === "whitelist_floor");
}

export function computeLogKpis(
  items: Item[],
  ledgerSources: LedgerSource[],
  candidates: CrossfeedCandidateRef[],
  now: Date,
  windowDays = KPI_WINDOW_DAYS,
): LogKpis {
  const cut = cutoffDay(now, windowDays);
  const win = itemsInWindow(items, now, windowDays);

  const itemsPerDay = Math.round((win.length / windowDays) * 10) / 10;
  const leadDomains = new Set(win.map((i) => hostOf(i.source_url))).size;
  const lowSnr = win.filter((i) => i.snr <= 2).length;
  const pctLowSnr = win.length === 0 ? 0 : Math.round((lowSnr / win.length) * 100);
  const signalsSourced = win.filter(isSignalsSourced).length;

  const crossfeedQueued = candidates.filter(
    (c) => c.status === "pending" && c.proposed_on >= cut,
  ).length;

  // A claim counts as resolved only when a real resolution landed in the
  // window: confirmed and debunked carry resolved_on; unresolved and
  // expired do not, so they are excluded honestly.
  let claimsResolved = 0;
  for (const src of ledgerSources) {
    for (const claim of src.claims) {
      if (
        (claim.resolution === "confirmed" || claim.resolution === "debunked") &&
        claim.resolved_on &&
        claim.resolved_on >= cut
      ) {
        claimsResolved++;
      }
    }
  }

  return {
    windowDays,
    itemCount: win.length,
    itemsPerDay,
    leadDomains,
    pctLowSnr,
    crossfeedQueued,
    claimsResolved,
    signalsSourced,
  };
}

/**
 * Lead-source presence: one row per lead-source domain with its item
 * count in the window, sorted by count descending then domain ascending
 * for a stable order. Returns the full list; the caller caps the display.
 */
export function leadSourcePresence(
  items: Item[],
  now: Date,
  windowDays = KPI_WINDOW_DAYS,
): PresenceRow[] {
  const counts = new Map<string, number>();
  for (const i of itemsInWindow(items, now, windowDays)) {
    const d = hostOf(i.source_url);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}
