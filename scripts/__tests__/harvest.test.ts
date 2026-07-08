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
  parseBlueskyPosts,
} from "../harvest";
import type { Candidate } from "../harvest";
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
    expect(merged[0].id).toBe(urlHash(fresh.url));
    expect(merged[0].fetched_at).toBe(fetchedAt);
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
