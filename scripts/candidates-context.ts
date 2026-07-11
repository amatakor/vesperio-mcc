/**
 * Sweep candidate briefing (plan Phase 6): prints the slice of
 * src/data/candidates.json the agent actually needs this run, instead of
 * the agent reading the whole growing queue file. Deterministic, read-only;
 * the sweep prompt consumes this script's stdout.
 *
 * Three reductions, all mechanical:
 *  1. Consumed filter: finalize-sweep stamps `consumed` on every queue
 *     entry after a successful merge, so the 48h window overlap stops
 *     re-feeding the same entries to consecutive sweeps. A DEEP sweep
 *     re-includes consumed entries, flagged `previously_presented`, per
 *     the deep-sweep re-examination rule in prompts/update-items.md.
 *  2. Junk prefilter: a short hard-coded list of title patterns that are
 *     safe to reject without judgment (retail-investment clickbait,
 *     horoscopes, puzzles). Anything needing editorial judgment stays in;
 *     analyst price targets are commentary-eligible and are NOT junk.
 *     Rejected counts are reported in `filtered`, never silently dropped.
 *  3. Syndication collapse: titles within SimHash Hamming distance 3
 *     (after outlet-suffix stripping) group into one entry with `alt`
 *     variants, so one story carried by six Google News outlets reads
 *     once. Alt URLs stay listed: queue corroboration is free and the
 *     alts are exactly what the corroboration step wants.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hammingDistance, simhash64 } from "./lib/simhash";
import type { Candidate, CandidatesFile, SourceHealthResult } from "./harvest";

/** Hamming distance at or below which two titles are the same story. */
const COLLAPSE_DISTANCE = 3;

/**
 * Title patterns rejected without judgment. Deliberately tiny and
 * conservative: every pattern here must be something no on-scope item
 * could ever match. Growing this list happens in reviewed PRs only.
 */
export const JUNK_TITLE_PATTERNS: { reason: string; re: RegExp }[] = [
  { reason: "investment-clickbait", re: /what a \$?[\d,]+ investment .* (would|could) be worth/i },
  { reason: "investment-clickbait", re: /if you('d| had) invested \$?[\d,]+/i },
  { reason: "horoscope", re: /\b(horoscope|zodiac|astrology|tarot)\b/i },
  { reason: "puzzle", re: /\b(wordle|crossword|sudoku|quiz of the (day|week))\b/i },
];

/** Returns the junk reason, or null for anything needing judgment. */
export function junkReason(c: Pick<Candidate, "title">): string | null {
  for (const p of JUNK_TITLE_PATTERNS) if (p.re.test(c.title)) return p.reason;
  return null;
}

export interface ContextAlt {
  id: string;
  url: string;
  title: string;
  source_name: string;
}

export interface ContextCandidate extends Candidate {
  /** Deep sweeps only: this entry was already presented to an earlier sweep. */
  previously_presented?: boolean;
  /** Near-identical titles collapsed under this entry (syndicated variants). */
  alt?: ContextAlt[];
}

export interface CandidatesContext {
  now: string;
  queue_generated_at: string;
  window_start: string;
  mode: "normal" | "deep";
  lastSweepConsumedCount: number;
  health: SourceHealthResult[];
  candidates: ContextCandidate[];
  /** Nothing is dropped silently: every reduction is counted here. */
  filtered: { consumed: number; junk: Record<string, number>; collapsed: number };
}

/**
 * Collapse key: bluesky posts all share "@handle on Bluesky"-shaped titles,
 * so their post TEXT is the identity; everything else collapses on title
 * (simhash normalization strips the Google News outlet suffix).
 */
function collapseText(c: Candidate): string {
  return c.title.endsWith(" on Bluesky") ? c.raw_excerpt : c.title;
}

/** Prefer a real feed's entry over a Google News redirect as the representative. */
function representativeRank(c: Candidate): number {
  return c.source_name.startsWith("Google News") ? 1 : 0;
}

/**
 * Groups near-duplicate candidates (SimHash distance <= COLLAPSE_DISTANCE
 * on the collapse text). Pairwise over the fresh slice: the queue is a few
 * hundred entries, well inside O(n^2) comfort.
 */
export function collapseSyndication(fresh: Candidate[]): {
  candidates: ContextCandidate[];
  collapsed: number;
} {
  const hashes = fresh.map((c) => simhash64(collapseText(c)));
  const groupOf = new Map<number, number>();
  for (let i = 0; i < fresh.length; i++) {
    if (groupOf.has(i)) continue;
    groupOf.set(i, i);
    for (let j = i + 1; j < fresh.length; j++) {
      if (groupOf.has(j)) continue;
      if (hammingDistance(hashes[i]!, hashes[j]!) <= COLLAPSE_DISTANCE) groupOf.set(j, i);
    }
  }
  const groups = new Map<number, Candidate[]>();
  fresh.forEach((c, i) => {
    const g = groupOf.get(i)!;
    const list = groups.get(g) ?? [];
    list.push(c);
    groups.set(g, list);
  });
  let collapsed = 0;
  const out: ContextCandidate[] = [];
  for (const members of groups.values()) {
    const sorted = [...members].sort(
      (a, b) =>
        representativeRank(a) - representativeRank(b) ||
        (a.published_at ?? "").localeCompare(b.published_at ?? "") ||
        a.id.localeCompare(b.id),
    );
    const rep: ContextCandidate = { ...sorted[0]! };
    const alts = sorted.slice(1);
    if (alts.length > 0) {
      rep.alt = alts.map((a) => ({
        id: a.id,
        url: a.url,
        title: a.title,
        source_name: a.source_name,
      }));
      collapsed += alts.length;
    }
    out.push(rep);
  }
  out.sort(
    (a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? "") || a.id.localeCompare(b.id),
  );
  return { candidates: out, collapsed };
}

export function buildCandidatesContext(dataDir: string, now: Date = new Date()): CandidatesContext {
  const queue = JSON.parse(
    readFileSync(join(dataDir, "candidates.json"), "utf8"),
  ) as CandidatesFile;
  const deep = queue.mode === "deep";

  const junk: Record<string, number> = {};
  let consumedCount = 0;
  const fresh: Candidate[] = [];
  for (const c of queue.candidates) {
    const consumed = (c as { consumed?: boolean }).consumed === true;
    if (consumed && !deep) {
      consumedCount++;
      continue;
    }
    const reason = junkReason(c);
    if (reason !== null) {
      junk[reason] = (junk[reason] ?? 0) + 1;
      continue;
    }
    fresh.push(c);
  }

  const { candidates, collapsed } = collapseSyndication(fresh);
  if (deep) {
    for (const c of candidates) {
      if ((c as { consumed?: boolean }).consumed === true) c.previously_presented = true;
    }
  }

  return {
    now: now.toISOString(),
    queue_generated_at: queue.generated_at,
    window_start: queue.window_start,
    mode: queue.mode,
    lastSweepConsumedCount: consumedCount,
    health: queue.health,
    candidates,
    filtered: { consumed: consumedCount, junk, collapsed },
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(buildCandidatesContext("src/data"), null, 2));
}
