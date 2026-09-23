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

/** Registrable-ish host of a URL for update notes ("stocktwits.com"). */
function hostOfUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface UpdateEntry {
  /** YYYY-MM-DD of the change. */
  date: string;
  /** Plain-English one-liner: what happened to the item that day. */
  text: string;
  /** The same without score reasons, for cards ("2 sources attached (...) · score 4 to 5"). */
  brief: string;
  /** Sources attached that day (hosts, deduplicated), for linking. */
  sources: { host: string; url: string }[];
}

/**
 * Every substantive post-publication change, newest day first, one entry
 * per day (Florian, 2026-09-23: a resurfaced item must say WHAT changed,
 * not only that it did). Sources attached after the publication day and
 * score movements other than the persistence bump count; initial sourcing
 * and scoring on the publication day do not.
 */
export function updateEntries(i: Item): UpdateEntry[] {
  const pub = (i.publishDate ?? i.date).slice(0, 10);
  const byDay = new Map<string, { sources: { host: string; url: string }[]; moves: string[]; briefs: string[] }>();
  const day = (d: string) => {
    let e = byDay.get(d);
    if (!e) {
      e = { sources: [], moves: [], briefs: [] };
      byDay.set(d, e);
    }
    return e;
  };
  for (const s of i.sources ?? []) {
    if (s.added <= pub) continue;
    const host = hostOfUrl(s.url);
    if (!host) continue;
    const e = day(s.added);
    if (!e.sources.some((x) => x.host === host)) e.sources.push({ host, url: s.url });
  }
  for (const h of i.snr_trace.history ?? []) {
    if (h.reason.includes(PERSISTENCE_REASON) || h.date <= pub) continue;
    const e = day(h.date);
    e.moves.push(`score ${h.from} to ${h.to}: ${h.reason}`);
    e.briefs.push(`score ${h.from} to ${h.to}`);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, e]) => {
      const parts: string[] = [];
      if (e.sources.length > 0) {
        parts.push(
          `${e.sources.length} source${e.sources.length === 1 ? "" : "s"} attached (${e.sources.map((s) => s.host).join(", ")})`,
        );
      }
      const brief = [...parts, ...e.briefs].join(" · ");
      parts.push(...e.moves);
      return { date, text: parts.join(" · "), brief, sources: e.sources };
    });
}

/** The latest update as one line for cards: "23 Sep · 3 sources attached (...)". */
export function latestUpdateNote(i: Item): string | null {
  const [latest] = updateEntries(i);
  if (!latest || latest.date <= i.date) return null;
  return `${dayMonth(latest.date)} · ${latest.brief}`;
}
