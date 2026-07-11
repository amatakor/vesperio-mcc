/**
 * Unit tests for the deterministic feed harvester (scripts/harvest.ts):
 * feed normalization from fixture RSS/Atom/JSON payloads, queue merge and
 * dedup, freshness window, and source-health fail-count transitions.
 */

import { describe, expect, test } from "bun:test";
import {
  parseFeed,
  parseJsonApi,
  excerptText,
  mergeQueue,
  windowStart,
  applyHealth,
  isHarvestable,
  urlHash,
  urlDate,
  sweepMode,
  deepWindowStart,
  overrideWindowStart,
  parseBlueskyPosts,
} from "../harvest";
import type { Candidate } from "../harvest";
import { canonicalizeUrl } from "../lib/urls";
import type { Source } from "../../src/data/schema";

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Example Trade Press</title>
  <item>
    <title>ICEYE orders 12 Gen4 satellites for &#8364;120 million</title>
    <link>https://example-press.com/iceye-gen4-order/</link>
    <pubDate>Tue, 07 Jul 2026 14:30:00 +0000</pubDate>
    <description><![CDATA[<p>ICEYE signed a &#8364;120 million contract for <b>12</b> Gen4 SAR satellites, with 25 cm resolution.</p>]]></description>
  </item>
  <item>
    <title>Undated legacy entry</title>
    <link>https://example-press.com/undated/</link>
    <description>No date on this one.</description>
  </item>
  <item>
    <title>Old entry outside every window</title>
    <link>https://example-press.com/old/</link>
    <pubDate>Mon, 05 Jan 2026 09:00:00 +0000</pubDate>
    <content:encoded><![CDATA[Body via content:encoded wins over description.]]></content:encoded>
    <description>Should not be used.</description>
  </item>
</channel>
</rss>`;

const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>SEC EDGAR 8-K feed</title>
  <entry>
    <title>8-K - Current report</title>
    <link rel="alternate" type="text/html" href="https://www.sec.gov/Archives/edgar/data/0001234/000123.htm"/>
    <updated>2026-07-06T18:02:11-04:00</updated>
    <summary>Item 1.01 Entry into a Material Definitive Agreement, value $75,000,000.</summary>
  </entry>
</feed>`;

const LL2_FIXTURE = JSON.stringify({
  count: 1,
  results: [
    {
      name: "Falcon 9 Block 5 | Starlink Group 11-3",
      url: "https://ll.thespacedevs.com/2.2.0/launch/abc-123/",
      net: "2026-07-09T02:04:00Z",
      last_updated: "2026-07-07T22:00:00Z",
      mission: { description: "A batch of 27 satellites for the Starlink mega-constellation." },
    },
  ],
});

const FEDREG_FIXTURE = JSON.stringify({
  count: 1,
  results: [
    {
      title: "NOAA licensing action",
      html_url: "https://www.federalregister.gov/documents/2026/07/07/noaa-thing",
      publication_date: "2026-07-07",
      abstract: "NOAA issues a commercial remote sensing license modification.",
    },
  ],
});

describe("parseFeed (RSS 2.0)", () => {
  const entries = parseFeed(RSS_FIXTURE);

  test("extracts every item with a URL", () => {
    expect(entries.length).toBe(3);
    expect(entries[0].url).toBe("https://example-press.com/iceye-gen4-order/");
  });

  test("copies numbers verbatim into the excerpt, tags stripped, entities decoded", () => {
    expect(entries[0].raw_excerpt).toContain("€120 million");
    expect(entries[0].raw_excerpt).toContain("12");
    expect(entries[0].raw_excerpt).toContain("25 cm resolution");
    expect(entries[0].raw_excerpt).not.toContain("<p>");
  });

  test("decodes entities in titles", () => {
    expect(entries[0].title).toBe("ICEYE orders 12 Gen4 satellites for €120 million");
  });

  test("parses pubDate to ISO, leaves undated entries null", () => {
    expect(entries[0].published_at).toBe("2026-07-07T14:30:00.000Z");
    expect(entries[1].published_at).toBeNull();
  });

  test("prefers content:encoded over description", () => {
    expect(entries[2].raw_excerpt).toBe("Body via content:encoded wins over description.");
  });
});

describe("parseFeed (Atom)", () => {
  const entries = parseFeed(ATOM_FIXTURE);

  test("extracts href links and updated dates", () => {
    expect(entries.length).toBe(1);
    expect(entries[0].url).toBe("https://www.sec.gov/Archives/edgar/data/0001234/000123.htm");
    expect(entries[0].published_at).toBe("2026-07-06T22:02:11.000Z");
    expect(entries[0].raw_excerpt).toContain("$75,000,000");
  });
});

describe("parseJsonApi", () => {
  test("normalizes Launch Library 2 results", () => {
    const entries = parseJsonApi(LL2_FIXTURE);
    expect(entries.length).toBe(1);
    expect(entries[0].title).toBe("Falcon 9 Block 5 | Starlink Group 11-3");
    expect(entries[0].published_at).toBe("2026-07-07T22:00:00.000Z");
    expect(entries[0].raw_excerpt).toContain("27 satellites");
  });

  test("normalizes Federal Register results", () => {
    const entries = parseJsonApi(FEDREG_FIXTURE);
    expect(entries.length).toBe(1);
    expect(entries[0].url).toContain("federalregister.gov");
    expect(entries[0].published_at).toBe("2026-07-07T00:00:00.000Z");
  });

  test("returns [] on unknown shapes and invalid JSON rather than guessing", () => {
    expect(parseJsonApi('{"data": [1,2,3]}')).toEqual([]);
    expect(parseJsonApi("not json")).toEqual([]);
  });
});

describe("urlDate fallback", () => {
  test("reads JAXA-style compact slugs and blog-style /YYYY/MM/DD/ paths", () => {
    expect(urlDate("https://global.jaxa.jp/press/2026/07/20260706-1_j.html")).toBe(
      "2026-07-06T00:00:00.000Z",
    );
    expect(urlDate("https://example.com/2026/07/06/story/")).toBe("2026-07-06T00:00:00.000Z");
  });

  test("returns null instead of guessing", () => {
    expect(urlDate("https://example.com/story-1234567/")).toBeNull();
    expect(urlDate("https://example.com/20261399-bad/")).toBeNull();
  });

  test("undated feed items fall back to the URL date", () => {
    const xml = `<rss><channel><item><title>t</title><link>https://global.jaxa.jp/press/2026/07/20260706-1_j.html</link><description>d</description></item></channel></rss>`;
    expect(parseFeed(xml)[0].published_at).toBe("2026-07-06T00:00:00.000Z");
  });
});

describe("excerptText", () => {
  test("caps at 2000 chars", () => {
    expect(excerptText("x".repeat(5000)).length).toBe(2000);
  });
});

describe("windowStart", () => {
  const now = new Date("2026-07-08T12:00:00Z");

  test("lastSweep minus 48h", () => {
    expect(windowStart("2026-07-07T21:45:40.931Z", now)).toBe("2026-07-05T21:45:40.931Z");
  });

  test("first run: now minus 7 days", () => {
    expect(windowStart(null, now)).toBe("2026-07-01T12:00:00.000Z");
  });
});

describe("mergeQueue", () => {
  const cutoff = "2026-07-05T00:00:00.000Z";
  const fetchedAt = "2026-07-08T12:00:00.000Z";
  const fresh = {
    url: "https://example-press.com/iceye-gen4-order/",
    title: "t",
    published_at: "2026-07-07T14:30:00.000Z",
    raw_excerpt: "e",
  };

  test("adds fresh entries, drops old and undated ones", () => {
    const merged = mergeQueue(
      [],
      [
        { entry: fresh, source_name: "Example" },
        { entry: { ...fresh, url: "https://x.com/old", published_at: "2026-01-05T09:00:00.000Z" }, source_name: "Example" },
        { entry: { ...fresh, url: "https://x.com/undated", published_at: null }, source_name: "Example" },
      ],
      cutoff,
      fetchedAt,
    );
    expect(merged.length).toBe(1);
    // New entries are keyed by the CANONICAL form of their URL.
    expect(merged[0].id).toBe(urlHash(canonicalizeUrl(fresh.url)));
    expect(merged[0].fetched_at).toBe(fetchedAt);
  });

  test("a utm variant of an already-queued article does not queue twice", () => {
    const merged = mergeQueue(
      [],
      [
        { entry: fresh, source_name: "Example" },
        {
          entry: { ...fresh, url: `${fresh.url}?utm_source=rss&utm_medium=feed` },
          source_name: "Example",
        },
        {
          entry: { ...fresh, url: "https://www.example-press.com/iceye-gen4-order/" },
          source_name: "Example",
        },
      ],
      cutoff,
      fetchedAt,
    );
    expect(merged.length).toBe(1);
  });

  test("a variant of an entry queued under the OLD raw hash still dedups (transition)", () => {
    const existing: Candidate[] = [
      {
        // Pre-canonicalization queue entry: id is the raw-URL hash of a
        // utm-bearing URL, kept valid (history never rewritten).
        id: urlHash(`${fresh.url}?utm_source=rss`),
        source_name: "Example",
        url: `${fresh.url}?utm_source=rss`,
        title: "t",
        published_at: fresh.published_at,
        raw_excerpt: "e",
        fetched_at: "2026-07-07T00:00:00.000Z",
      },
    ];
    const merged = mergeQueue(existing, [{ entry: fresh, source_name: "Example" }], cutoff, fetchedAt);
    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe(urlHash(`${fresh.url}?utm_source=rss`));
  });

  test("dedups by URL hash and keeps the first-seen entry", () => {
    const existing: Candidate[] = [
      {
        id: urlHash(fresh.url),
        source_name: "Example",
        url: fresh.url,
        title: "t",
        published_at: fresh.published_at,
        raw_excerpt: "e",
        fetched_at: "2026-07-07T00:00:00.000Z",
      },
    ];
    const merged = mergeQueue(existing, [{ entry: fresh, source_name: "Example" }], cutoff, fetchedAt);
    expect(merged.length).toBe(1);
    expect(merged[0].fetched_at).toBe("2026-07-07T00:00:00.000Z");
  });

  test("expires queued entries that fell behind the window", () => {
    const existing: Candidate[] = [
      {
        id: urlHash("https://x.com/expired"),
        source_name: "Example",
        url: "https://x.com/expired",
        title: "t",
        published_at: "2026-07-01T00:00:00.000Z",
        raw_excerpt: "e",
        fetched_at: "2026-07-02T00:00:00.000Z",
      },
    ];
    expect(mergeQueue(existing, [], cutoff, fetchedAt).length).toBe(0);
  });

  test("sorts newest first", () => {
    const merged = mergeQueue(
      [],
      [
        { entry: { ...fresh, url: "https://x.com/a", published_at: "2026-07-06T00:00:00.000Z" }, source_name: "s" },
        { entry: { ...fresh, url: "https://x.com/b", published_at: "2026-07-07T00:00:00.000Z" }, source_name: "s" },
      ],
      cutoff,
      fetchedAt,
    );
    expect(merged[0].url).toBe("https://x.com/b");
  });
});

describe("applyHealth fail-count transitions", () => {
  function src(over: Partial<Source>): Source {
    return {
      name: "T",
      url: "https://t.example/feed",
      feed_type: "rss_atom",
      cadence: "daily",
      language: "en",
      tier: 2,
      status: "verified",
      ...over,
    };
  }

  test("first success flips unverified to verified", () => {
    const s = src({ status: "unverified" });
    const note = applyHealth(s, true, "2026-07-08");
    expect(s.status).toBe("verified");
    expect(s.fail_count).toBe(0);
    expect(note).toContain("flipped to verified");
  });

  test("success on a healthy verified source is silent", () => {
    const s = src({});
    expect(applyHealth(s, true, "2026-07-08")).toBeNull();
    expect(s.fail_count).toBe(0);
  });

  test("success resets a running fail count and says so", () => {
    const s = src({ fail_count: 2 });
    const note = applyHealth(s, true, "2026-07-08");
    expect(s.fail_count).toBe(0);
    expect(note).toContain("recovered");
  });

  test("failures increment; the third flips to dead", () => {
    const s = src({});
    expect(applyHealth(s, false, "2026-07-08")).toBeNull();
    expect(s.fail_count).toBe(1);
    expect(applyHealth(s, false, "2026-07-08")).toBeNull();
    expect(s.fail_count).toBe(2);
    const note = applyHealth(s, false, "2026-07-08");
    expect(s.status).toBe("dead");
    expect(note).toContain("flipped to dead");
  });

  test("an already-dead source stays dead without new notes", () => {
    const s = src({ status: "dead", fail_count: 3 });
    expect(applyHealth(s, false, "2026-07-08")).toBeNull();
    expect(s.status).toBe("dead");
    expect(s.fail_count).toBe(4);
  });
});

describe("isHarvestable", () => {
  function src(over: Partial<Source>): Source {
    return {
      name: "T",
      url: "https://t.example/",
      feed_type: "rss_atom",
      cadence: "daily",
      language: "en",
      tier: 2,
      status: "verified",
      ...over,
    };
  }

  test("rss_atom, legacy rss, and api_json sources qualify", () => {
    expect(isHarvestable(src({}))).toBe(true);
    expect(isHarvestable(src({ feed_type: "rss" }))).toBe(true);
    expect(isHarvestable(src({ feed_type: "api_json" }))).toBe(true);
  });

  test("html and dead sources are skipped", () => {
    expect(isHarvestable(src({ feed_type: "html" }))).toBe(false);
    expect(isHarvestable(src({ status: "dead" }))).toBe(false);
  });

  test("sources marked unfetchable via fetch_note are skipped", () => {
    expect(isHarvestable(src({ fetch_note: "JS-rendered shell, unreachable without a browser" }))).toBe(false);
  });
});

describe("sweepMode (deep-sweep fallback)", () => {
  const entry = (added: number, mode?: "deep") => ({
    at: "2026-07-08T05:00:00.000Z",
    added,
    updated: 0,
    held: 0,
    summary: "s",
    coverage: ["launch"],
    ...(mode ? { mode } : {}),
  });

  test("two consecutive zero-add sweeps trigger deep", () => {
    expect(sweepMode([entry(2), entry(0), entry(0)])).toBe("deep");
  });

  test("a single zero stays normal", () => {
    expect(sweepMode([entry(2), entry(0)])).toBe("normal");
  });

  test("an added item resets the streak", () => {
    expect(sweepMode([entry(0), entry(0), entry(3), entry(0)])).toBe("normal");
  });

  test("cooldown: a prior deep sweep resets the streak even at zero", () => {
    expect(sweepMode([entry(0), entry(0), entry(0, "deep")])).toBe("normal");
    // two fresh zeros after the deep one re-trigger
    expect(sweepMode([entry(0, "deep"), entry(0), entry(0)])).toBe("deep");
  });

  test("short history stays normal", () => {
    expect(sweepMode([])).toBe("normal");
    expect(sweepMode([entry(0)])).toBe("normal");
  });

  test("threshold is configurable", () => {
    expect(sweepMode([entry(0), entry(0), entry(0)], 3)).toBe("deep");
    expect(sweepMode([entry(0), entry(0)], 3)).toBe("normal");
  });
});

describe("deepWindowStart", () => {
  test("seven days back from now", () => {
    expect(deepWindowStart(new Date("2026-07-08T12:00:00Z"))).toBe("2026-07-01T12:00:00.000Z");
  });
});

describe("overrideWindowStart (HARVEST_WINDOW_DAYS)", () => {
  const now = new Date("2026-07-08T12:00:00Z");

  test("unset or empty means no override", () => {
    expect(overrideWindowStart(undefined, now)).toBeNull();
    expect(overrideWindowStart("", now)).toBeNull();
    expect(overrideWindowStart("  ", now)).toBeNull();
  });

  test("a positive integer wins as N days back from now", () => {
    expect(overrideWindowStart("30", now)).toBe("2026-06-08T12:00:00.000Z");
    expect(overrideWindowStart("7", now)).toBe("2026-07-01T12:00:00.000Z");
  });

  test("garbage aborts instead of silently harvesting the wrong window", () => {
    expect(() => overrideWindowStart("thirty", now)).toThrow();
    expect(() => overrideWindowStart("0", now)).toThrow();
    expect(() => overrideWindowStart("-3", now)).toThrow();
    expect(() => overrideWindowStart("2.5", now)).toThrow();
  });
});

describe("parseBlueskyPosts (searchPosts shape)", () => {
  const PAYLOAD = JSON.stringify({
    posts: [
      {
        uri: "at://did:plc:abc123/app.bsky.feed.post/3mq4rofcbts2p",
        author: { handle: "reporter.bsky.social", displayName: "A Reporter" },
        record: {
          text: "SpaceX just launched 27 satellites, per the webcast. Cost: $67 million.",
          createdAt: "2026-07-07T18:00:00.000Z",
        },
        indexedAt: "2026-07-07T18:00:05.000Z",
      },
      { uri: "at://did:plc:x/app.bsky.feed.post/", author: {}, record: {} },
    ],
  });

  test("maps posts to web URLs with verbatim text and dates", () => {
    const direct = parseBlueskyPosts(JSON.parse(PAYLOAD).posts);
    const entries = parseJsonApi(PAYLOAD);
    expect(entries).toEqual(direct);
    expect(entries.length).toBe(1);
    expect(entries[0]!.url).toBe("https://bsky.app/profile/reporter.bsky.social/post/3mq4rofcbts2p");
    expect(entries[0]!.title).toBe("@reporter.bsky.social on Bluesky");
    expect(entries[0]!.published_at).toBe("2026-07-07T18:00:05.000Z");
    expect(entries[0]!.raw_excerpt).toContain("$67 million");
  });

  test("unknown shapes still return []", () => {
    expect(parseJsonApi('{"data": []}')).toEqual([]);
  });
});

describe("Google News RSS entries", () => {
  const GN = `<rss version="2.0"><channel><title>"spacex" - Google News</title><item><title>SpaceX just launched the 1st-ever nuclear-powered commercial satellite - Space</title><link>https://news.google.com/rss/articles/CBMiabc?oc=5</link><pubDate>Mon, 07 Jul 2026 14:00:00 GMT</pubDate><description>&lt;a href="https://www.space.com/x"&gt;SpaceX just launched...&lt;/a&gt;</description></item></channel></rss>`;

  test("harvested verbatim: redirect link kept, outlet suffix kept (resolution is the agent's step)", () => {
    const entries = parseFeed(GN);
    expect(entries.length).toBe(1);
    expect(entries[0]!.url).toContain("news.google.com/rss/articles/");
    expect(entries[0]!.title).toContain(" - Space");
    expect(entries[0]!.published_at).toBe("2026-07-07T14:00:00.000Z");
  });
});

// ---------------------------------------------------------------- Phase 5

import {
  applyFreshness,
  applyReprobe,
  conditionalHeaders,
  isDeadReprobeDay,
  isReprobeTarget,
  parseHtmlListing,
  STALE_AFTER_SWEEPS,
} from "../harvest";
import { youtubeSignalChannels } from "../lib/signals";
import type { SignalsFile } from "../../src/data/schema";

function src(overrides: Partial<Source> = {}): Source {
  return {
    name: "Example",
    url: "https://example.com/feed",
    feed_type: "rss_atom",
    rss: null,
    cadence: "daily",
    language: "en",
    tier: 1,
    status: "verified",
    ...overrides,
  };
}

describe("applyFreshness (stale detector)", () => {
  const now = new Date("2026-07-11T12:00:00Z");

  test("fresh entry resets the streak and records the high-water mark", () => {
    const s = src({ stale_streak: 4 });
    const note = applyFreshness(s, "2026-07-10T00:00:00.000Z", now, "2026-07-11");
    expect(note).toBeNull();
    expect(s.stale_streak).toBe(0);
    expect(s.newest_entry_at).toBe("2026-07-10T00:00:00.000Z");
    expect(s.status).toBe("verified");
  });

  test("an old newest entry increments the streak but does not flip early", () => {
    const s = src();
    const note = applyFreshness(s, "2026-05-01T00:00:00.000Z", now, "2026-07-11");
    expect(note).toBeNull();
    expect(s.stale_streak).toBe(1);
    expect(s.status).toBe("verified");
  });

  test(`flips verified to stale at exactly ${STALE_AFTER_SWEEPS} consecutive not-fresh fetches`, () => {
    const s = src({ stale_streak: STALE_AFTER_SWEEPS - 1 });
    const note = applyFreshness(s, "2026-05-01T00:00:00.000Z", now, "2026-07-11");
    expect(s.status).toBe("stale");
    expect(note).toContain("flipped to stale");
  });

  test("a fresh entry flips a stale source back to verified", () => {
    const s = src({ status: "stale", stale_streak: 9 });
    const note = applyFreshness(s, "2026-07-11T01:00:00.000Z", now, "2026-07-11");
    expect(s.status).toBe("verified");
    expect(s.stale_streak).toBe(0);
    expect(note).toContain("recovered from stale");
  });

  test("null newestSeen (a 304) is judged from the stored high-water mark", () => {
    const fresh = src({ newest_entry_at: "2026-07-10T00:00:00.000Z", stale_streak: 2 });
    applyFreshness(fresh, null, now, "2026-07-11");
    expect(fresh.stale_streak).toBe(0);
    const old = src({ newest_entry_at: "2026-04-01T00:00:00.000Z", stale_streak: 1 });
    applyFreshness(old, null, now, "2026-07-11");
    expect(old.stale_streak).toBe(2);
  });

  test("a source that has never shown a dated entry is never judged", () => {
    const s = src();
    const note = applyFreshness(s, null, now, "2026-07-11");
    expect(note).toBeNull();
    expect(s.stale_streak).toBeUndefined();
    expect(s.newest_entry_at).toBeNull();
  });

  test("the high-water mark never regresses to an older entry", () => {
    const s = src({ newest_entry_at: "2026-07-09T00:00:00.000Z" });
    applyFreshness(s, "2026-06-01T00:00:00.000Z", now, "2026-07-11");
    expect(s.newest_entry_at).toBe("2026-07-09T00:00:00.000Z");
  });

  test("unverified sources count streaks but only verified ones flip", () => {
    const s = src({ status: "unverified", stale_streak: STALE_AFTER_SWEEPS - 1 });
    applyFreshness(s, "2026-01-01T00:00:00.000Z", now, "2026-07-11");
    expect(s.status).toBe("unverified");
    expect(s.stale_streak).toBe(STALE_AFTER_SWEEPS);
  });
});

describe("conditional GET headers", () => {
  test("stored validators round-trip into request headers", () => {
    expect(conditionalHeaders({ etag: '"abc123"', last_modified: "Tue, 07 Jul 2026 14:30:00 GMT" })).toEqual({
      "If-None-Match": '"abc123"',
      "If-Modified-Since": "Tue, 07 Jul 2026 14:30:00 GMT",
    });
  });

  test("null, empty, and absent validators send nothing", () => {
    expect(conditionalHeaders({})).toEqual({});
    expect(conditionalHeaders({ etag: null, last_modified: null })).toEqual({});
    expect(conditionalHeaders({ etag: "", last_modified: "" })).toEqual({});
  });
});

describe("dead-source weekly re-probe", () => {
  test("probe day is Monday UTC only", () => {
    expect(isDeadReprobeDay(new Date("2026-07-13T05:00:00Z"))).toBe(true);
    expect(isDeadReprobeDay(new Date("2026-07-12T05:00:00Z"))).toBe(false);
    expect(isDeadReprobeDay(new Date("2026-07-14T05:00:00Z"))).toBe(false);
  });

  test("re-probe success resurrects to unverified, not verified", () => {
    const s = src({ status: "dead", fail_count: 4 });
    const note = applyReprobe(s, true, "2026-07-13");
    expect(s.status).toBe("unverified");
    expect(s.fail_count).toBe(0);
    expect(note).toContain("resurrected");
  });

  test("re-probe failure leaves the source dead without growing fail_count", () => {
    const s = src({ status: "dead", fail_count: 3 });
    const note = applyReprobe(s, false, "2026-07-13");
    expect(note).toBeNull();
    expect(s.status).toBe("dead");
    expect(s.fail_count).toBe(3);
  });

  test("only dead feed-type sources without a fetch_note are re-probe targets", () => {
    expect(isReprobeTarget(src({ status: "dead" }))).toBe(true);
    expect(isReprobeTarget(src({ status: "dead", feed_type: "html" }))).toBe(false);
    expect(isReprobeTarget(src({ status: "dead", fetch_note: "JS shell" }))).toBe(false);
    expect(isReprobeTarget(src({ status: "verified" }))).toBe(false);
  });
});

describe("stale and html_listing sources in the harvest set", () => {
  test("stale feed sources keep being fetched (recovery path)", () => {
    expect(isHarvestable(src({ status: "stale" }))).toBe(true);
  });
  test("html_listing joins the harvester; plain html never does", () => {
    expect(isHarvestable(src({ feed_type: "html_listing", status: "unverified" }))).toBe(true);
    expect(isHarvestable(src({ feed_type: "html", status: "verified" }))).toBe(false);
  });
});

describe("parseHtmlListing (UNIS Vienna pattern)", () => {
  const UNIS = `<div class="tab-content archive__container">
    <div class="arch__item" data-iso-date="2026-06-10T09:46:08.487">
      <div class="item__date"><span class="std-item-date">10/06/2026</span></div>
      <div class="item__title"><a href="/unis/en/pressrels/2026/unisos611.html">UNOOSA and JAXA select teams from El Salvador and Thailand for satellite deployment
        from the International Space Station</a></div>
    </div>
    <div class="arch__item" data-iso-date="2026-06-08T12:05:19.034">
      <div class="item__date"><span class="std-item-date">08/06/2026</span></div>
      <div class="item__title"><a href="https://unis.unvienna.org/unis/en/pressrels/2026/unisos610.html">UN Office for Outer Space Affairs and Italian Space Agency partner to advance space law in Africa</a></div>
    </div>
  </div>`;
  const BASE = "https://unis.unvienna.org/unis/en/pr/press-releases-unoosa.html";

  test("extracts dated entries and resolves relative links", () => {
    const entries = parseHtmlListing(UNIS, BASE);
    expect(entries.length).toBe(2);
    expect(entries[0]!.url).toBe("https://unis.unvienna.org/unis/en/pressrels/2026/unisos611.html");
    expect(entries[0]!.title).toContain("UNOOSA and JAXA select teams");
    expect(entries[0]!.title).not.toContain("\n");
    expect(entries[0]!.published_at).not.toBeNull();
    expect(entries[1]!.url).toBe("https://unis.unvienna.org/unis/en/pressrels/2026/unisos610.html");
  });

  test("a page without data-iso-date entries yields [] (counts as a failed parse)", () => {
    expect(parseHtmlListing("<html><body><a href='/x'>Nav</a></body></html>", BASE)).toEqual([]);
  });
});

describe("youtube signals channels join the harvest", () => {
  const signals = {
    meta: {},
    outlets: [],
    excluded: [],
    people: [
      {
        id: "creator-a", name: "Creator A", whitelist: "yes",
        channels: [
          { type: "youtube", url: "https://youtube.com/@a", rss: "https://www.youtube.com/feeds/videos.xml?channel_id=AAA", status: "verified_active" },
          { type: "x", handle: "a", url: "https://x.com/a", status: "verified_active" },
        ],
      },
      {
        id: "creator-b", name: "Creator B", whitelist: "yes",
        channels: [
          { type: "youtube", url: "https://youtube.com/@b", rss: "https://www.youtube.com/feeds/videos.xml?channel_id=BBB", status: "stale" },
        ],
      },
      {
        id: "creator-c", name: "Creator C", whitelist: "no",
        channels: [
          { type: "youtube", url: "https://youtube.com/@c", rss: "https://www.youtube.com/feeds/videos.xml?channel_id=CCC", status: "verified_active" },
        ],
      },
      {
        id: "creator-d", name: "Creator D", whitelist: "yes",
        channels: [
          { type: "youtube", url: "https://youtube.com/@d", rss: null, status: "verified_active" },
          { type: "youtube", url: "https://youtube.com/@d2", rss: "https://www.youtube.com/feeds/videos.xml?channel_id=DDD", status: "retired" },
        ],
      },
    ],
  } as unknown as SignalsFile;

  test("whitelisted verified_active and stale channels with a feed URL qualify; others never do", () => {
    const chans = youtubeSignalChannels(signals);
    expect(chans.map((c) => c.name).sort()).toEqual(["Creator A", "Creator B"]);
  });

  test("Sanity Content Lake answers ({ result: [...] }, pre-projected) parse; junk rows are skipped", () => {
    const SANITY = JSON.stringify({
      query: "...",
      result: [
        {
          url: "https://vantor.com/blog/esri-extend-partnership-arcgis-basemaps",
          title: "Vantor and Esri extend partnership ",
          published_at: "2026-07-08",
          raw_excerpt: "Vantor and Esri extend their partnership to keep ArcGIS basemaps current.",
        },
        { url: "not-a-url", title: "Broken row", published_at: "2026-07-01", raw_excerpt: "" },
        { url: "https://vantor.com/blog/untitled", title: "  ", published_at: null, raw_excerpt: "" },
      ],
      ms: 12,
    });
    const entries = parseJsonApi(SANITY);
    expect(entries.length).toBe(1);
    expect(entries[0]!.url).toBe("https://vantor.com/blog/esri-extend-partnership-arcgis-basemaps");
    expect(entries[0]!.title).toBe("Vantor and Esri extend partnership");
    expect(entries[0]!.published_at).toBe("2026-07-08T00:00:00.000Z");
    expect(entries[0]!.raw_excerpt).toContain("ArcGIS basemaps");
  });

  test("youtube Atom entries surface the video description as the excerpt", () => {
    const YT = `<feed xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Starship Flight 12 explained</title>
        <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
        <published>2026-07-09T15:00:00+00:00</published>
        <media:group><media:title>Starship Flight 12 explained</media:title>
        <media:description>Covering the flight profile, 3 engine relights, and the booster catch.</media:description></media:group>
      </entry>
    </feed>`;
    const entries = parseFeed(YT);
    expect(entries.length).toBe(1);
    expect(entries[0]!.url).toBe("https://www.youtube.com/watch?v=abc123");
    expect(entries[0]!.raw_excerpt).toContain("3 engine relights");
  });
});
