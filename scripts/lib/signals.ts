/**
 * Signal-channel selectors, shared by signals-context (the collector the
 * agent reads at briefing) and finalize-sweep (the gate that enforces the
 * signals pass). Keeping the "what counts as fetchable" logic in one place
 * stops the collector and the gate from drifting: if the gate demands a
 * channel be checked, the collector must have listed it, and vice versa.
 */

import type { SignalsFile } from "../../src/data/schema";

/**
 * Channel types we can retrieve directly with curl/WebFetch (an HTML page
 * or an RSS feed). X is deliberately excluded: it is login-walled to our
 * fetch tools and only reachable best-effort via WebSearch plus the public
 * syndication endpoint, so it is never part of the enforced "reliable leg".
 */
/**
 * youtube (audit Phase 4, 2026-07-08): fetched via the keyless per-channel
 * feed https://www.youtube.com/feeds/videos.xml?channel_id=<ID>, recorded
 * in the channel's `rss` field. A youtube channel without an rss value is
 * not yet fetchable and stays out of the enforced leg.
 */
export const FETCHABLE_CHANNEL_TYPES = new Set(["site", "substack", "beehiiv", "bluesky", "youtube"]);

export interface FetchableSignalChannel {
  personId: string;
  name: string;
  org: string;
  type: string;
  /** The URL the card links; also the identity used by the gate. */
  url: string;
  /** A dedicated feed URL when the channel declares one (prefer for fetching). */
  rss: string | null;
}

export interface XSignalChannel {
  personId: string;
  name: string;
  org: string;
  handle: string;
  url: string;
}

/** True for a person eligible to source items via the whitelist floor. */
function isWhitelisted(p: SignalsFile["people"][number]): boolean {
  return p.whitelist === "yes";
}

/**
 * The reliable leg: every whitelisted person's directly-fetchable,
 * verified-active channels. These are what the signals-pass gate requires
 * the sweep to account for.
 */
export function fetchableSignalChannels(signals: SignalsFile): FetchableSignalChannel[] {
  const out: FetchableSignalChannel[] = [];
  for (const p of signals.people) {
    if (!isWhitelisted(p)) continue;
    for (const c of p.channels) {
      if (c.status !== "verified_active") continue;
      if (!FETCHABLE_CHANNEL_TYPES.has(c.type)) continue;
      // youtube is fetchable only through its feed URL; without one the
      // watch page is a JS shell our tools cannot read.
      if (c.type === "youtube" && !c.rss) continue;
      out.push({
        personId: p.id,
        name: p.name,
        org: p.org,
        type: c.type,
        url: c.url,
        rss: c.rss ?? null,
      });
    }
  }
  return out;
}

/**
 * The best-effort leg: whitelisted people's verified-active X handles.
 * Surfaced to the agent for WebSearch + syndication retrieval, but never
 * enforced (X can be unreachable through no fault of the sweep).
 */
export function xSignalChannels(signals: SignalsFile): XSignalChannel[] {
  const out: XSignalChannel[] = [];
  for (const p of signals.people) {
    if (!isWhitelisted(p)) continue;
    for (const c of p.channels) {
      if (c.status !== "verified_active") continue;
      if (c.type !== "x") continue;
      out.push({
        personId: p.id,
        name: p.name,
        org: p.org,
        handle: c.handle ?? "",
        url: c.url,
      });
    }
  }
  return out;
}
