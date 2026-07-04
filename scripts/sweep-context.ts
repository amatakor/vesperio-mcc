/**
 * Sweep briefing: prints the context the ingestion agent needs before a
 * run as JSON: { now, lastSweep, feedSize, existing[] }, where existing
 * carries { id, normId, source_url, headline } for the no-add-twice check.
 * normId is the id without its date prefix, for spotting the same story
 * re-announced on a different day.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ItemsFile, StateFile } from "../src/data/schema";

export interface SweepContext {
  now: string;
  lastSweep: string | null;
  feedSize: number;
  existing: Array<{ id: string; normId: string; source_url: string; headline: string }>;
}

export function buildSweepContext(dataDir: string, now: Date = new Date()): SweepContext {
  const items = JSON.parse(readFileSync(join(dataDir, "items.json"), "utf8")) as ItemsFile;
  const state = JSON.parse(readFileSync(join(dataDir, "state.json"), "utf8")) as StateFile;
  return {
    now: now.toISOString(),
    lastSweep: state.lastSweep,
    feedSize: items.items.length,
    existing: items.items.map((item) => ({
      id: item.id,
      normId: item.id.replace(/^\d{4}-\d{2}-\d{2}-/, ""),
      source_url: item.source_url,
      headline: item.headline,
    })),
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(buildSweepContext("src/data"), null, 2));
}
