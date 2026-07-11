/**
 * Tests for the sweep's context emitters (plan Phase 6):
 * candidates-context (consumed filter, junk prefilter, syndication
 * collapse, deep-mode re-inclusion), fetch-list, and sweep-memory
 * rotation. The acceptance property: no candidate is presented in two
 * consecutive normal sweeps' context files.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCandidatesContext,
  collapseSyndication,
  junkReason,
} from "../candidates-context";
import { buildFetchList } from "../fetch-list";
import { rotateSweepMemory, splitSections, ROTATION_KEEP_DAYS } from "../rotate-sweep-memory";
import type { Candidate, CandidatesFile } from "../harvest";
import type { SourcesFile } from "../../src/data/schema";

function cand(overrides: Partial<Candidate> & { id: string }): Candidate {
  return {
    source_name: "SpaceNews",
    url: `https://example.com/${overrides.id}`,
    title: `Story ${overrides.id}`,
    published_at: "2026-07-11T06:00:00.000Z",
    raw_excerpt: "Verbatim body text.",
    fetched_at: "2026-07-11T06:30:00.000Z",
    ...overrides,
  };
}

function writeQueue(dir: string, candidates: Candidate[], mode: "normal" | "deep" = "normal"): void {
  const queue: CandidatesFile = {
    $comment: "test",
    generated_at: "2026-07-11T06:30:00.000Z",
    window_start: "2026-07-09T06:00:00.000Z",
    mode,
    health: [{ source_name: "SpaceNews", ok: true, http_status: 200, entry_count: 2, newest_entry: null, detail: "2 entries" }],
    candidates,
  };
  writeFileSync(join(dir, "candidates.json"), JSON.stringify(queue, null, 2));
}

describe("junk prefilter", () => {
  test("rejects only the hard-coded no-judgment classes", () => {
    expect(junkReason({ title: "Here's What a $10,000 Investment in SpaceX Would Be Worth Today" })).toBe("investment-clickbait");
    expect(junkReason({ title: "If you'd invested $1,000 in Rocket Lab five years ago" })).toBe("investment-clickbait");
    expect(junkReason({ title: "Your daily horoscope: Mars enters retrograde" })).toBe("horoscope");
    expect(junkReason({ title: "Wordle answer today" })).toBe("puzzle");
  });

  test("analyst price targets and ordinary space news are NOT junk (commentary-eligible)", () => {
    expect(junkReason({ title: "Morgan Stanley raises SpaceX valuation to $350 billion" })).toBeNull();
    expect(junkReason({ title: "SpaceX Stock Just Received Its Highest Price Target Yet" })).toBeNull();
    expect(junkReason({ title: "ICEYE orders 12 Gen4 satellites" })).toBeNull();
  });
});

describe("syndication collapse", () => {
  test("near-identical titles group under one entry with alt variants; the real feed beats Google News as representative", () => {
    const a = cand({ id: "a1", source_name: "Google News: launch", title: "SpaceX Falcon 9 rocket launches for 35th time, hauls Starlink satellites to orbit - Yahoo" });
    const b = cand({ id: "b2", source_name: "Space.com", title: "SpaceX Falcon 9 rocket launches for 35th time, hauls Starlink satellites to orbit" });
    const c = cand({ id: "c3", source_name: "SpaceNews", title: "ESA selects two providers for Moonlight navigation constellation" });
    const { candidates, collapsed } = collapseSyndication([a, b, c]);
    expect(candidates.length).toBe(2);
    expect(collapsed).toBe(1);
    const rep = candidates.find((x) => x.alt !== undefined)!;
    expect(rep.source_name).toBe("Space.com");
    expect(rep.alt!.map((x) => x.id)).toEqual(["a1"]);
  });

  test("bluesky posts collapse on post text, not on their all-alike titles", () => {
    const p1 = cand({ id: "p1", source_name: "Bluesky search: spacex launch", title: "@bot-a.bsky.social on Bluesky", raw_excerpt: "SpaceX launches 24 Starlink satellites from Vandenberg on Falcon 9" });
    const p2 = cand({ id: "p2", source_name: "Bluesky search: spacex launch", title: "@bot-b.bsky.social on Bluesky", raw_excerpt: "SpaceX launches 24 Starlink satellites from Vandenberg on Falcon 9" });
    const p3 = cand({ id: "p3", source_name: "Bluesky search: spacex launch", title: "@human.bsky.social on Bluesky", raw_excerpt: "Watched the ULA Vulcan static fire today, gorgeous plume physics" });
    const { candidates, collapsed } = collapseSyndication([p1, p2, p3]);
    expect(candidates.length).toBe(2);
    expect(collapsed).toBe(1);
  });
});

describe("consumed filter and deep-mode re-inclusion", () => {
  test("normal mode: consumed entries stay out and are counted", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-"));
    writeQueue(dir, [cand({ id: "old1", consumed: true }), cand({ id: "new1", title: "Fresh unrelated story about Kuiper" })]);
    const ctx = buildCandidatesContext(dir, new Date("2026-07-11T07:00:00Z"));
    expect(ctx.candidates.map((c) => c.id)).toEqual(["new1"]);
    expect(ctx.filtered.consumed).toBe(1);
  });

  test("deep mode re-emits consumed entries flagged previously_presented", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-"));
    writeQueue(dir, [cand({ id: "old1", consumed: true }), cand({ id: "new1", title: "Fresh unrelated story about Kuiper" })], "deep");
    const ctx = buildCandidatesContext(dir, new Date("2026-07-11T07:00:00Z"));
    expect(ctx.candidates.length).toBe(2);
    const old = ctx.candidates.find((c) => c.id === "old1")!;
    expect(old.previously_presented).toBe(true);
    expect(ctx.candidates.find((c) => c.id === "new1")!.previously_presented).toBeUndefined();
  });

  test("ACCEPTANCE: no candidate appears in two consecutive normal sweeps' context files", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-"));
    writeQueue(dir, [cand({ id: "s1" }), cand({ id: "s2", title: "Second distinct story about Vega C" })]);
    const first = buildCandidatesContext(dir, new Date("2026-07-11T07:00:00Z"));
    expect(first.candidates.length).toBe(2);

    // finalize-sweep's stamp after a successful merge:
    const queue = JSON.parse(readFileSync(join(dir, "candidates.json"), "utf8")) as CandidatesFile;
    for (const c of queue.candidates) c.consumed = true;
    // the next harvest merges one genuinely new entry into the same window
    queue.candidates.push(cand({ id: "s3", title: "Third story, a new Ariane 6 booking" }));
    writeFileSync(join(dir, "candidates.json"), JSON.stringify(queue, null, 2));

    const second = buildCandidatesContext(dir, new Date("2026-07-11T19:00:00Z"));
    const secondIds = new Set(second.candidates.map((c) => c.id));
    expect(secondIds).toEqual(new Set(["s3"]));
    for (const c of first.candidates) expect(secondIds.has(c.id)).toBe(false);
  });
});

describe("fetch-list", () => {
  test("emits exactly the prompt's html rule and accounts for every exclusion", () => {
    const sources = {
      version: "0.1",
      categories: {
        a: [
          { name: "Fetchable", url: "https://x.com/news", feed_type: "html", rss: null, cadence: "daily", language: "en", tier: 1, status: "verified" },
          { name: "New", url: "https://y.com/news", feed_type: "html", rss: null, cadence: "daily", language: "en", tier: 1, status: "unverified" },
          { name: "Noted", url: "https://z.com", feed_type: "html", rss: null, cadence: "daily", language: "en", tier: 1, status: "verified", fetch_note: "JS shell" },
          { name: "Stale", url: "https://s.com", feed_type: "html", rss: null, cadence: "daily", language: "en", tier: 1, status: "stale" },
          { name: "Dead", url: "https://d.com", feed_type: "html", rss: null, cadence: "daily", language: "en", tier: 1, status: "dead" },
          { name: "Feed", url: "https://f.com", feed_type: "rss_atom", rss: "https://f.com/rss", cadence: "daily", language: "en", tier: 1, status: "verified" },
        ],
      },
    } as unknown as SourcesFile;
    const list = buildFetchList(sources);
    expect(list.htmlSources.map((s) => s.name)).toEqual(["Fetchable", "New"]);
    expect(list.skipped).toEqual({ fetch_note: 1, stale: 1, dead: 1 });
  });
});

describe("sweep-memory rotation", () => {
  const MEMORY = `# SWEEP_MEMORY.md heading

Preamble line kept as is.

## Standing rules (hand-curated, 2026-01-01)

Never do the bad thing.

## Seed lessons (2026-07-05, pre-launch)

Seed lesson body.

## Old session (2026-05-01)

Should be archived.

## Recent session (2026-07-10)

Should be kept.

## Undated notes

Kept: no date in the heading.
`;

  test("standing, seed, recent, and undated sections stay; old dated sections archive", () => {
    const { kept, archived } = rotateSweepMemory(MEMORY, new Date("2026-07-11T00:00:00Z"));
    expect(kept).toContain("## Standing rules");
    expect(kept).toContain("## Seed lessons");
    expect(kept).toContain("## Recent session (2026-07-10)");
    expect(kept).toContain("## Undated notes");
    expect(kept).not.toContain("## Old session (2026-05-01)");
    expect(archived.map((s) => s.heading)).toEqual(["## Old session (2026-05-01)"]);
  });

  test("standing rules survive even when their date is ancient (kept verbatim)", () => {
    const { kept } = rotateSweepMemory(MEMORY, new Date("2027-06-01T00:00:00Z"));
    expect(kept).toContain("## Standing rules (hand-curated, 2026-01-01)");
    expect(kept).toContain("Never do the bad thing.");
    expect(kept).toContain("## Seed lessons (2026-07-05, pre-launch)");
  });

  test("rotation is lossless: kept plus archived reconstruct every section", () => {
    const { kept, archived } = rotateSweepMemory(MEMORY, new Date("2026-07-11T00:00:00Z"));
    const total = splitSections(MEMORY).sections.length;
    expect(splitSections(kept).sections.length + archived.length).toBe(total);
    for (const s of archived) expect(MEMORY).toContain(`${s.heading}\n${s.body}`);
  });

  test(`the boundary is ${ROTATION_KEEP_DAYS} days: a section exactly at the cutoff stays`, () => {
    const now = new Date("2026-07-11T00:00:00Z");
    const atCutoff = new Date(now.getTime() - ROTATION_KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    const doc = `# H\n\n## Session (${atCutoff})\n\nbody\n`;
    const { archived } = rotateSweepMemory(doc, now);
    expect(archived.length).toBe(0);
  });

  test("nothing old means no changes (idempotent quiet path)", () => {
    const doc = `# H\n\n## Session (2026-07-10)\n\nbody\n`;
    const { archived } = rotateSweepMemory(doc, new Date("2026-07-11T00:00:00Z"));
    expect(archived).toEqual([]);
  });
});
