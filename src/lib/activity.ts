/**
 * Feed recency (Florian, 2026-07-13, revised 2026-09-23). Items sort by
 * their honest EVENT date; a late-discovered story files straight into
 * its date slot (the reader's archive stays chronological). What DOES
 * resurface an item is an update the reader can name: the copy changed
 * (new facts) or the score moved, each carrying the sweep's one-sentence
 * note of what changed. Attaching corroboration alone is recorded on the
 * item but never resurfaces it (2026-09-23: three stock-forum pages had
 * floated a June M&A story to the top of the feed). Persistence bumps
 * never count either.
 *
 * Pure functions on item data only (no clock): the server prerender
 * and client hydration must agree byte for byte.
 */

import type { Item } from "../data/schema";

/** Reason string of the automatic persistence bump (scripts/snr): scheduled
    aging, not news; it never counts as activity. */
const PERSISTENCE_REASON = "persistence window";

export interface UpdateEntry {
  /** YYYY-MM-DD of the change. */
  date: string;
  /** What changed, the sweep's own sentence. */
  note: string;
  /** Present when the score moved that day. */
  score?: { from: number; to: number };
}

/**
 * The resurfacing updates, newest first: copy and score updates stamped
 * by finalize-sweep, plus, for items updated before updates[] existed,
 * score movements from the trace history (their reason is the same
 * agent note). Attach-only updates are left out on purpose.
 */
export function updateEntries(i: Item): UpdateEntry[] {
  const pub = (i.publishDate ?? i.date).slice(0, 10);
  const out: UpdateEntry[] = [];
  const seen = new Set<string>();
  for (const u of i.updates ?? []) {
    if (u.kind === "attach" || u.date <= pub) continue;
    out.push({ date: u.date, note: u.note, ...(u.score ? { score: u.score } : {}) });
    seen.add(`${u.date}|${u.note}`);
  }
  for (const h of i.snr_trace.history ?? []) {
    if (h.reason.includes(PERSISTENCE_REASON) || h.date <= pub) continue;
    if (seen.has(`${h.date}|${h.reason}`)) continue;
    if (out.some((e) => e.date === h.date && e.score)) continue;
    out.push({ date: h.date, note: h.reason, score: { from: h.from, to: h.to } });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * The item's feed-order date: its event date, unless a resurfacing
 * update happened after its publication day.
 */
export function activityAt(i: Item): string {
  const [latest] = updateEntries(i);
  return latest && latest.date > i.date ? latest.date : i.date;
}

// Day-month, never month-day (Florian, 2026-07-13): "updated 07-12"
// reads as 7 December to a European; "updated 12 Jul" is unambiguous
// in every locale. Hand-rolled, no locale APIs: the server prerender
// and client hydration must produce identical bytes.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export function dayMonth(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

/** The "updated <d Mon>" chip, or null for items sitting in their own
    event-date slot (the common case). */
export function freshnessChip(i: Item): string | null {
  const act = activityAt(i);
  return act > i.date ? `updated ${dayMonth(act)}` : null;
}

/** The latest resurfacing update for cards: its day and the sweep's note. */
export function latestUpdateNote(i: Item): { day: string; note: string } | null {
  const [latest] = updateEntries(i);
  if (!latest || latest.date <= i.date) return null;
  return { day: dayMonth(latest.date), note: latest.note };
}
