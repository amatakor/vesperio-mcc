/**
 * Signals-pass briefing: prints the whitelisted channels the sweep must
 * check, so the pass runs against a concrete list instead of the agent's
 * memory of signals.json. Output JSON:
 *   { lastSweep, fetchable[], xSearch[], fetchableCount, xCount }
 * where `fetchable` is the enforced reliable leg (sites, Substack, beehiiv,
 * Bluesky, retrievable with curl/WebFetch) and `xSearch` is the best-effort
 * leg (X handles, reachable only via WebSearch + the public syndication
 * endpoint). finalize-sweep's gate requires the draft to account for every
 * `fetchable` channel; `xSearch` is never enforced.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SignalsFile, StateFile } from "../src/data/schema";
import {
  fetchableSignalChannels,
  xSignalChannels,
  type FetchableSignalChannel,
  type XSignalChannel,
} from "./lib/signals";

export interface SignalsContext {
  lastSweep: string | null;
  fetchable: FetchableSignalChannel[];
  xSearch: XSignalChannel[];
  fetchableCount: number;
  xCount: number;
}

export function buildSignalsContext(dataDir: string): SignalsContext {
  const signals = JSON.parse(readFileSync(join(dataDir, "signals.json"), "utf8")) as SignalsFile;
  const state = JSON.parse(readFileSync(join(dataDir, "state.json"), "utf8")) as StateFile;
  const fetchable = fetchableSignalChannels(signals);
  const xSearch = xSignalChannels(signals);
  return {
    lastSweep: state.lastSweep,
    fetchable,
    xSearch,
    fetchableCount: fetchable.length,
    xCount: xSearch.length,
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(buildSignalsContext("src/data"), null, 2));
}
