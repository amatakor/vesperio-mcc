/**
 * Feed recency (Florian, 2026-07-13, revised same day). Items sort by
 * their honest EVENT date; a late-discovered story files straight into
 * its date slot (the reader's archive stays chronological). What DOES
 * resurface an item is a substantive post-publication update: a new
 * corroborating source attached or a score movement. Those float the
 * item back up wearing an "updated MM-DD" chip next to its event date,
 * so the feed never implies an old event just happened.
 *
 * Pure functions on item data only (no clock): the server prerender
 * and client hydration must agree byte for byte.
 */

import type { Item } from "../data/schema";

/** Reason string of the automatic persistence bump (scripts/snr): scheduled
    aging, not news; it never counts as activity. */
const PERSISTENCE_REASON = "persistence window";

/**
 * The item's feed-order date: its event date, unless something happened
 * TO the item after its publication day (initial sourcing and scoring
 * happen ON the publication day and do not count).
 */
export function activityAt(i: Item): string {
  const pub = (i.publishDate ?? i.date).slice(0, 10);
  let a = i.date;
  for (const s of i.sources ?? []) {
    if (s.added > pub && s.added > a) a = s.added;
  }
  for (const h of i.snr_trace.history ?? []) {
    if (h.reason.includes(PERSISTENCE_REASON)) continue;
    if (h.date > pub && h.date > a) a = h.date;
  }
  return a;
}

// Day-month, never month-day (Florian, 2026-07-13): "updated 07-12"
// reads as 7 December to a European; "updated 12 Jul" is unambiguous
// in every locale. Hand-rolled, no locale APIs: the server prerender
// and client hydration must produce identical bytes.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
function dayMonth(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

/** The "updated <d Mon>" chip, or null for items sitting in their own
    event-date slot (the common case). */
export function freshnessChip(i: Item): string | null {
  const act = activityAt(i);
  return act > i.date ? `updated ${dayMonth(act)}` : null;
}
