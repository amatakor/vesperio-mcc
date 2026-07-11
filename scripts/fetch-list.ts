/**
 * HTML fetch list (plan Phase 6): prints the direct-fetch pass targets the
 * agent previously derived by reading sources.json whole (112KB of notes
 * history for a handful of names and URLs). Deterministic, read-only.
 *
 * The emitted list is exactly what prompts/update-items.md tells the agent
 * to fetch: feed_type "html", status verified or unverified, no fetch_note.
 * Skipped counts are reported so nothing disappears silently.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Source, SourcesFile } from "../src/data/schema";

export interface FetchListEntry {
  name: string;
  url: string;
  status: string;
}

export interface FetchList {
  htmlSources: FetchListEntry[];
  /** Registered html sources excluded from the pass, by reason. */
  skipped: { fetch_note: number; stale: number; dead: number };
}

export function buildFetchList(sources: SourcesFile): FetchList {
  const all: Source[] = Object.values(sources.categories).flat();
  const html = all.filter((s) => s.feed_type === "html");
  const skipped = { fetch_note: 0, stale: 0, dead: 0 };
  const htmlSources: FetchListEntry[] = [];
  for (const s of html) {
    if (s.fetch_note !== undefined) skipped.fetch_note++;
    else if (s.status === "stale") skipped.stale++;
    else if (s.status === "dead") skipped.dead++;
    else htmlSources.push({ name: s.name, url: s.url, status: s.status });
  }
  return { htmlSources, skipped };
}

if (import.meta.main) {
  const sources = JSON.parse(
    readFileSync(join("src/data", "sources.json"), "utf8"),
  ) as SourcesFile;
  console.log(JSON.stringify(buildFetchList(sources), null, 2));
}
