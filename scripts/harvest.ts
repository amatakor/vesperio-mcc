/**
 * Deterministic feed harvester. Runs BEFORE the sweep agent (update-items.yml).
 *
 * Reads sources.json, fetches every source whose feed_type is rss_atom or
 * api_json (legacy "rss" accepted as rss_atom) and whose status is verified
 * or unverified, and normalizes the entries into src/data/candidates.json.
 * The sweep agent consumes that queue first and only fetches directly for
 * HTML-only sources and corroboration.
 *
 * Health bookkeeping moves from agent memory into code, matching the
 * CLAUDE.md contract: first successful fetch flips unverified -> verified,
 * consecutive failures increment the persisted fail_count, the third flips
 * the source to dead. Notes are appended only on state transitions so the
 * notes field does not grow on every quiet run.
 *
 * No LLM, no dependencies beyond bun built-ins. Exit code is non-zero only
 * on catastrophic failure (cannot read inputs or write the queue);
 * individual source failures are logged and recorded, never fatal.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Source, SourcesFile, StateFile } from "../src/data/schema";

const UA = "VesperioMCC-Sweep contact@vesperio.ai";
const FETCH_TIMEOUT_MS = 25_000;
const EXCERPT_MAX_CHARS = 2000;
/** Queue keeps entries newer than lastSweep minus this overlap. */
const OVERLAP_HOURS = 48;
/** Window used when state.lastSweep is null (first run). */
const FIRST_RUN_WINDOW_DAYS = 7;
const DEAD_AT_FAILURES = 3;

export interface Candidate {
  /** sha256 of the entry URL, first 16 hex chars. */
  id: string;
  source_name: string;
  url: string;
  title: string;
  published_at: string | null;
  /** Verbatim text from the feed entry (tags stripped, entities decoded), untruncated up to ~2000 chars. */
  raw_excerpt: string;
  fetched_at: string;
}

export interface SourceHealthResult {
  source_name: string;
  ok: boolean;
  http_status: number | null;
  entry_count: number;
  newest_entry: string | null;
  detail: string;
}

export interface CandidatesFile {
  $comment: string;
  generated_at: string;
  window_start: string;
  health: SourceHealthResult[];
  candidates: Candidate[];
}

// ------------------------------------------------------------ parsing

export function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Strips markup but keeps the text content verbatim; numbers survive exactly. */
export function excerptText(raw: string): string {
  const noCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const noTags = noCdata.replace(/<[^>]+>/g, " ");
  return decodeEntities(noTags).replace(/\s+/g, " ").trim().slice(0, EXCERPT_MAX_CHARS);
}

function tagContent(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(block);
  return m ? m[1].trim() : null;
}

function isoDate(raw: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

export interface FeedEntry {
  url: string;
  title: string;
  published_at: string | null;
  raw_excerpt: string;
}

/**
 * Fallback for feeds without per-item dates (JAXA's RSS 1.0 press feed):
 * a date the publisher put in the entry's own URL, /2026/07/06/ or
 * _20260706_ shaped. Returns null rather than guessing.
 */
export function urlDate(url: string): string | null {
  const slash = /\/(20\d{2})\/(\d{2})\/(\d{2})(?:\/|$)/.exec(url);
  const compact = /(?:^|[/_-])(20\d{2})(\d{2})(\d{2})(?:[/_.-]|$)/.exec(url);
  const m = slash ?? compact;
  if (!m) return null;
  const [, y, mo, d] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${mo}-${d}T00:00:00.000Z`;
}

/** Parses RSS 2.0, Atom, and RSS 1.0/RDF payloads. Returns [] when nothing parses. */
export function parseFeed(xml: string): FeedEntry[] {
  const blocks = xml.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  const entries: FeedEntry[] = [];
  for (const block of blocks) {
    // Atom link is an attribute; RSS link is element text.
    let url: string | null = null;
    const atomLink =
      /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(block) ??
      /<link[^>]*href=["']([^"']+)["']/i.exec(block);
    const rssLink = tagContent(block, "link");
    if (rssLink && /^https?:\/\//i.test(excerptText(rssLink))) url = excerptText(rssLink);
    else if (atomLink) url = decodeEntities(atomLink[1]);
    if (!url) {
      const guid = tagContent(block, "guid");
      if (guid && /^https?:\/\//i.test(excerptText(guid))) url = excerptText(guid);
    }
    if (!url) continue;

    const title = excerptText(tagContent(block, "title") ?? "");
    const published_at =
      isoDate(
        tagContent(block, "pubDate") ??
          tagContent(block, "published") ??
          tagContent(block, "updated") ??
          tagContent(block, "dc:date"),
      ) ?? urlDate(url);
    const body =
      tagContent(block, "content:encoded") ??
      tagContent(block, "description") ??
      tagContent(block, "summary") ??
      tagContent(block, "content") ??
      "";
    entries.push({ url, title, published_at, raw_excerpt: excerptText(body) });
  }
  return entries;
}

/**
 * Normalizes known JSON API shapes ({ results: [...] }: Launch Library 2,
 * Federal Register). Unknown shapes return [] rather than guessing.
 */
export function parseJsonApi(text: string): FeedEntry[] {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof j !== "object" || j === null || !Array.isArray((j as { results?: unknown }).results)) return [];
  const entries: FeedEntry[] = [];
  for (const r of (j as { results: Record<string, unknown>[] }).results) {
    const url =
      (typeof r.url === "string" && r.url) ||
      (typeof r.html_url === "string" && r.html_url) ||
      null;
    if (!url) continue;
    const title =
      (typeof r.name === "string" && r.name) || (typeof r.title === "string" && r.title) || "";
    const published_at = isoDate(
      (typeof r.last_updated === "string" && r.last_updated) ||
        (typeof r.publication_date === "string" && r.publication_date) ||
        (typeof r.net === "string" && r.net) ||
        (typeof r.window_start === "string" && r.window_start) ||
        null,
    );
    const missionDesc =
      typeof r.mission === "object" && r.mission !== null
        ? (r.mission as Record<string, unknown>).description
        : null;
    const body =
      (typeof r.abstract === "string" && r.abstract) ||
      (typeof missionDesc === "string" && missionDesc) ||
      (typeof r.description === "string" && r.description) ||
      "";
    entries.push({ url, title: title.trim(), published_at, raw_excerpt: excerptText(body) });
  }
  return entries;
}

// ------------------------------------------------------------ queue merge

export function windowStart(lastSweep: string | null, now: Date): string {
  if (lastSweep === null) {
    return new Date(now.getTime() - FIRST_RUN_WINDOW_DAYS * 86_400_000).toISOString();
  }
  return new Date(Date.parse(lastSweep) - OVERLAP_HOURS * 3_600_000).toISOString();
}

/**
 * Merges freshly harvested entries into the existing queue. Dedup is by URL
 * hash; an already-queued entry keeps its original fetched_at. Entries with
 * no parseable date are dropped (they cannot pass the freshness window),
 * as is anything older than the window.
 */
export function mergeQueue(
  existing: Candidate[],
  incoming: { entry: FeedEntry; source_name: string }[],
  cutoffIso: string,
  fetchedAt: string,
): Candidate[] {
  const byId = new Map<string, Candidate>();
  for (const c of existing) {
    if (c.published_at !== null && c.published_at >= cutoffIso) byId.set(c.id, c);
  }
  for (const { entry, source_name } of incoming) {
    if (entry.published_at === null || entry.published_at < cutoffIso) continue;
    const id = urlHash(entry.url);
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      source_name,
      url: entry.url,
      title: entry.title,
      published_at: entry.published_at,
      raw_excerpt: entry.raw_excerpt,
      fetched_at: fetchedAt,
    });
  }
  return [...byId.values()].sort(
    (a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? "") || a.id.localeCompare(b.id),
  );
}

// ------------------------------------------------------------ source health

/**
 * Applies one fetch outcome to a source in place. Returns a transition
 * description when the source changed state (for the notes field), else null.
 */
export function applyHealth(source: Source, ok: boolean, dateStamp: string): string | null {
  if (ok) {
    const wasFailing = (source.fail_count ?? 0) > 0;
    source.fail_count = 0;
    if (source.status === "unverified") {
      source.status = "verified";
      return `[${dateStamp}] harvest: first successful fetch, flipped to verified.`;
    }
    if (wasFailing) return `[${dateStamp}] harvest: fetch recovered, fail_count reset.`;
    return null;
  }
  source.fail_count = (source.fail_count ?? 0) + 1;
  if (source.fail_count >= DEAD_AT_FAILURES && source.status !== "dead") {
    source.status = "dead";
    return `[${dateStamp}] harvest: ${DEAD_AT_FAILURES} consecutive failures, flipped to dead.`;
  }
  return null;
}

export function isHarvestable(source: Source): boolean {
  if (source.fetch_note !== undefined) return false;
  const feedish =
    source.feed_type === "rss_atom" || source.feed_type === "api_json" || source.feed_type === "rss";
  return feedish && (source.status === "verified" || source.status === "unverified");
}

// ------------------------------------------------------------ IO main

async function fetchSource(url: string): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/rss+xml, application/atom+xml, application/json, text/xml, */*;q=0.5",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const root = new URL("..", import.meta.url).pathname;
  const sourcesPath = `${root}src/data/sources.json`;
  const statePath = `${root}src/data/state.json`;
  const queuePath = `${root}src/data/candidates.json`;

  const sources = JSON.parse(readFileSync(sourcesPath, "utf8")) as SourcesFile;
  const state = JSON.parse(readFileSync(statePath, "utf8")) as StateFile;
  let existingQueue: Candidate[] = [];
  try {
    existingQueue = (JSON.parse(readFileSync(queuePath, "utf8")) as CandidatesFile).candidates;
  } catch {
    // first run: no queue yet
  }

  const now = new Date();
  const fetchedAt = now.toISOString();
  const dateStamp = fetchedAt.slice(0, 10);
  const cutoff = windowStart(state.lastSweep, now);

  const targets: Source[] = [];
  for (const list of Object.values(sources.categories)) {
    for (const s of list) if (isHarvestable(s)) targets.push(s);
  }

  const health: SourceHealthResult[] = [];
  const incoming: { entry: FeedEntry; source_name: string }[] = [];

  for (const source of targets) {
    const feedUrl = source.rss ?? source.url;
    let ok = false;
    let status: number | null = null;
    let entries: FeedEntry[] = [];
    let detail = "";
    try {
      const res = await fetchSource(feedUrl);
      status = res.status;
      if (res.status === 200) {
        entries =
          source.feed_type === "api_json" ? parseJsonApi(res.text) : parseFeed(res.text);
        ok = entries.length > 0;
        detail = ok ? `${entries.length} entries` : "200 but no entries parsed";
      } else {
        detail = `HTTP ${res.status}`;
      }
    } catch (e) {
      detail = e instanceof Error && e.name === "AbortError" ? "timeout" : String(e);
    }
    const transition = applyHealth(source, ok, dateStamp);
    if (transition) source.notes = source.notes ? `${source.notes} | ${transition}` : transition;
    const newest = entries
      .map((e) => e.published_at)
      .filter((d): d is string => d !== null)
      .sort()
      .at(-1);
    health.push({
      source_name: source.name,
      ok,
      http_status: status,
      entry_count: entries.length,
      newest_entry: newest ?? null,
      detail,
    });
    for (const entry of entries) incoming.push({ entry, source_name: source.name });
    console.log(`${ok ? "ok  " : "FAIL"} ${source.name}: ${detail}`);
    // stay polite: one fetch at a time, small gap between hosts
    await new Promise((r) => setTimeout(r, 500));
  }

  const candidates = mergeQueue(existingQueue, incoming, cutoff, fetchedAt);
  const out: CandidatesFile = {
    $comment:
      "Machine-written by scripts/harvest.ts (deterministic, pre-agent). The sweep agent reads this queue first; raw_excerpt is verbatim feed text and is the only legal basis for quoted numbers besides a direct fetch of the source page.",
    generated_at: fetchedAt,
    window_start: cutoff,
    health,
    candidates,
  };
  writeFileSync(queuePath, JSON.stringify(out, null, 2) + "\n");
  writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + "\n");
  console.log(
    `harvest: ${targets.length} sources fetched, ${candidates.length} candidates in queue (window >= ${cutoff})`,
  );
}

if (import.meta.main) {
  main().catch((e) => {
    console.error("harvest: catastrophic failure:", e);
    process.exit(1);
  });
}
