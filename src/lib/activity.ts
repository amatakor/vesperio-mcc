/**
 * Feed recency (Florian, 2026-07-13, rebuilt 2026-09-23). Items sit in
 * their honest EVENT slot and never move. An update the reader can name
 * (the copy changed with new facts, or the score moved) becomes its OWN
 * feed row, dated by the update and carrying the sweep's one-sentence
 * note. Attaching corroboration alone is recorded on the item but makes
 * no row (three stock-forum pages had floated a June M&A story to the
 * top of the feed). Persistence bumps never count either.
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

// Day-month, never month-day (Florian, 2026-07-13): "updated 07-12"
// reads as 7 December to a European; "updated 12 Jul" is unambiguous
// in every locale. Hand-rolled, no locale APIs: the server prerender
// and client hydration must produce identical bytes.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export function dayMonth(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

/** One sentence, at most 160 characters, for a card; the full note is on the item page. */
export function cardNote(note: string): string {
  // A sentence ends at terminal punctuation followed by a capital or a
  // quote; "Sept. 22" and "Jr. ruled" stay whole.
  const first = note.match(/^.*?[.!?](?=\s+[A-Z"(\u201c]|$)/)?.[0] ?? note;
  return first.length > 160 ? `${first.slice(0, 157).trimEnd()}...` : first;
}

/**
 * Feed rows (Florian, 2026-09-23: "leave the original card alone; an
 * update gets its own card on top"). Every item is one row in its event
 * slot, and every resurfacing update is a second row dated by the update,
 * carrying the item and the note. Rows sort by date, newest first; on the
 * same day an update row precedes item rows. Pure and deterministic.
 */
export type FeedRow =
  | { kind: "item"; date: string; item: Item }
  | { kind: "update"; date: string; item: Item; update: UpdateEntry };

export function feedRows(items: Item[]): FeedRow[] {
  const rows: FeedRow[] = [];
  for (const item of items) {
    rows.push({ kind: "item", date: item.date, item });
    for (const update of updateEntries(item)) {
      if (update.date > item.date) rows.push({ kind: "update", date: update.date, item, update });
    }
  }
  return rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.kind !== b.kind) return a.kind === "update" ? -1 : 1;
    return a.item.date < b.item.date ? 1 : a.item.date > b.item.date ? -1 : 0;
  });
}

/** Stable React key for a feed row. */
export function feedRowKey(row: FeedRow): string {
  return row.kind === "item" ? row.item.id : `${row.item.id}@${row.date}`;
}
