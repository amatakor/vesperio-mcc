/**
 * Deterministic date-scoped backfill harvester (BACKFILL_PLAN.md, 2026-07-08).
 *
 * Feed archives are shallow (SpaceNews RSS holds ~24 entries), so week-sized
 * backfill windows lean on Google News query feeds, which accept after:/before:
 * date operators inside the q parameter. This script rewrites every
 * news.google.com/rss/search feed in sources.json with the window's date
 * operators, fetches the scoped one-off URLs, and merges the entries into
 * src/data/candidates.json (same Candidate shape, same mergeQueue dedup).
 *
 * It never touches sources.json: health bookkeeping belongs to the real
 * configured feeds (scripts/harvest.ts), not to temporary scoped URLs.
 *
 * Usage: bun scripts/backfill-harvest.ts 2026-06-08 2026-06-15
 * (after: inclusive, before: exclusive, per Google News operators; the merge
 * cutoff is the window start, so already-queued newer entries survive.)
 */

import { readFileSync } from "node:fs";
import { writeJsonAtomic } from "./lib/write-json-atomic";
import type { SourcesFile } from "../src/data/schema";
import type { CandidatesFile, FeedEntry } from "./harvest";
import { mergeQueue, parseFeed } from "./harvest";

const UA = "VesperioMCC-Sweep contact@vesperio.ai";
const FETCH_TIMEOUT_MS = 25_000;

/**
 * Appends after:/before: operators to a Google News query feed's q param.
 * Returns null for anything that is not a news.google.com/rss/search URL:
 * only query feeds accept date operators, and the caller must skip the rest.
 */
export function scopeGoogleNewsUrl(feedUrl: string, after: string, before: string): string | null {
  let u: URL;
  try {
    u = new URL(feedUrl);
  } catch {
    return null;
  }
  if (u.hostname !== "news.google.com" || !u.pathname.startsWith("/rss/search")) return null;
  const q = u.searchParams.get("q");
  if (q === null || q.trim() === "") return null;
  u.searchParams.set("q", `${q} after:${after} before:${before}`);
  return u.toString();
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, text/xml, */*;q=0.5" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const [after, before] = process.argv.slice(2);
  if (!after || !before || !DATE_RE.test(after) || !DATE_RE.test(before) || after >= before) {
    console.error("usage: bun scripts/backfill-harvest.ts <after YYYY-MM-DD> <before YYYY-MM-DD>");
    process.exit(1);
  }

  const root = new URL("..", import.meta.url).pathname;
  const sources = JSON.parse(readFileSync(`${root}src/data/sources.json`, "utf8")) as SourcesFile;
  const queuePath = `${root}src/data/candidates.json`;
  const queue = JSON.parse(readFileSync(queuePath, "utf8")) as CandidatesFile;

  const scoped: { name: string; url: string }[] = [];
  for (const list of Object.values(sources.categories)) {
    for (const s of list) {
      const url = scopeGoogleNewsUrl(s.rss ?? s.url, after, before);
      if (url !== null) scoped.push({ name: s.name, url });
    }
  }
  if (scoped.length === 0) {
    console.error("backfill-harvest: no Google News query feeds found in sources.json");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const cutoff = `${after}T00:00:00.000Z`;
  const incoming: { entry: FeedEntry; source_name: string }[] = [];
  for (const { name, url } of scoped) {
    try {
      const entries = parseFeed(await fetchText(url));
      console.log(`ok   ${name} [${after}..${before}): ${entries.length} entries`);
      for (const entry of entries) incoming.push({ entry, source_name: name });
    } catch (e) {
      console.log(`FAIL ${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const candidates = mergeQueue(queue.candidates, incoming, cutoff, now);
  const out: CandidatesFile = {
    ...queue,
    generated_at: now,
    window_start: cutoff,
    candidates,
  };
  writeJsonAtomic(queuePath, out);
  console.log(
    `backfill-harvest: ${scoped.length} scoped feeds, ${candidates.length} candidates in queue (window >= ${cutoff})`,
  );
}

if (import.meta.main) {
  main().catch((e) => {
    console.error("backfill-harvest: catastrophic failure:", e);
    process.exit(1);
  });
}
