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
 * youtube left this set 2026-07-11 (plan Phase 5): its keyless per-channel
 * feed (https://www.youtube.com/feeds/videos.xml?channel_id=<ID>, recorded
 * in the channel's `rss` field) is now fetched by the deterministic
 * harvester (scripts/harvest.ts) like any other feed, so the agent's
 * enforced signals leg no longer covers it; youtube finds arrive via the
 * candidate queue instead. See youtubeSignalChannels below.
 */
export const FETCHABLE_CHANNEL_TYPES = new Set(["site", "substack", "beehiiv", "bluesky"]);

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

export interface YoutubeSignalChannel {
  personId: string;
  name: string;
  /** The channel page the person is whitelisted under. */
  url: string;
  /** The keyless per-channel Atom feed the harvester fetches. */
  rss: string;
  status: string;
}

/**
 * Whitelisted people's youtube channels with a recorded feed URL, for the
 * deterministic harvester. Includes "stale" channels alongside
 * "verified_active": fetching a public feed is cheap and a channel that
 * resumes posting should surface without waiting for a manual re-review.
 * The whitelist FLOOR still applies only per the normal rules at classing
 * time (verified_active, ingest_rules honored); harvesting is discovery,
 * not classing. signals.json is read-only here, always: harvest never
 * writes health state back to it.
 */
export function youtubeSignalChannels(signals: SignalsFile): YoutubeSignalChannel[] {
  const out: YoutubeSignalChannel[] = [];
  for (const p of signals.people) {
    if (!isWhitelisted(p)) continue;
    for (const c of p.channels) {
      if (c.type !== "youtube") continue;
      if (c.status !== "verified_active" && c.status !== "stale") continue;
      if (!c.rss) continue;
      out.push({ personId: p.id, name: p.name, url: c.url, rss: c.rss, status: c.status });
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
