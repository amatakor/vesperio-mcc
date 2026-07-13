/**
 * Feed recency (Florian, 2026-07-13). Items wear their honest EVENT
 * date, so a late-discovered story (published today about a July 6
 * arrival) used to sink straight to its slot in the date-sorted feed:
 * the sweep log said "+2" while the feed's top looked unchanged.
 *
 * The feed now orders by LAST ACTIVITY: the day the item was published
 * or last substantively updated (a new source attached, a score moved).
 * The card still shows the event date; when activity trails the event
 * by 3+ days, a chip says why the item sits where it does ("tracked
 * 07-13" for late discoveries, "updated 07-13" for resurfaced items),
 * so the feed never implies an old event just happened.
 *
 * Pure functions on item data only (no clock): the server prerender
 * and client hydration must agree byte for byte.
 */

import type { Item } from "../data/schema";

/** Reason string of the automatic persistence bump (scripts/snr): scheduled
    aging, not news; it never counts as activity. */
const PERSISTENCE_REASON = "persistence window";

/** The last day something happened TO the item: publication, a source
    attached, or a score movement (except the persistence bump). */
export function activityAt(i: Item): string {
  let a = (i.publishDate ?? i.date).slice(0, 10);
  for (const s of i.sources ?? []) {
    if (s.added > a) a = s.added;
  }
  for (const h of i.snr_trace.history ?? []) {
    if (h.reason.includes(PERSISTENCE_REASON)) continue;
    if (h.date > a) a = h.date;
  }
  return a;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

/**
 * The recency chip, or null for items whose activity matches their
 * event date (the common case: published the day it happened).
 * "tracked MM-DD": late discovery, published well after the event.
 * "updated MM-DD": resurfaced by post-publication activity.
 */
export function freshnessChip(i: Item): string | null {
  const act = activityAt(i);
  if (daysBetween(i.date, act) < 3) return null;
  const pub = (i.publishDate ?? i.date).slice(0, 10);
  return act > pub ? `updated ${act.slice(5)}` : `tracked ${act.slice(5)}`;
}
