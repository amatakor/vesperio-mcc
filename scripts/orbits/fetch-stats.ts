/**
 * Builds public/data/orbits/stats.json, the live-HUD metrics (6A design):
 * 30-day launched/failed/scheduled totals with weekly flow buckets from
 * Launch Library 2, 30-day deorbits from the CelesTrak SATCAT, the
 * 6-month launch ranking per vehicle family, and the next few upcoming
 * launches for the countdown.
 *
 * Budget: ~3 LL2 requests (previous 180d paginated + upcoming) inside
 * the 15/hour free tier, plus one CelesTrak SATCAT CSV download.
 */

import { mkdirSync } from "node:fs";
import { writeJsonAtomic } from "../lib/write-json-atomic";
import { join } from "node:path";
import type { OrbitsStatsFile } from "../../src/data/schema";
import { buildStats, satcatDecays, type Ll2Launch } from "./lib";

const LL2 = "https://ll.thespacedevs.com/2.3.0";
const SATCAT_URL = "https://celestrak.org/pub/satcat.csv";
const OUT_PATH = join("public/data/orbits", "stats.json");
const USER_AGENT = "mcc-orbits/1.0 (+https://mcc.vesperio.ai)";
const MAX_PAGES = 5;
const RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let requestCount = 0;

async function fetchWithBackoff(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    requestCount++;
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (res.status === 429 && attempt < RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 4 ** attempt;
      console.warn(`  429, backing off ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res;
  }
}

interface Paginated<T> {
  next: string | null;
  results: T[];
}

async function fetchAllPages<T>(firstUrl: string): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = firstUrl;
  for (let page = 0; url !== null && page < MAX_PAGES; page++) {
    const data = (await (await fetchWithBackoff(url)).json()) as Paginated<T>;
    if (!Array.isArray(data.results)) throw new Error(`unexpected page shape for ${url}`);
    out.push(...data.results);
    url = data.next;
  }
  return out;
}

const now = new Date();
const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 3600 * 1000).toISOString();

// mode=normal so configurations carry the families array (list mode
// drops it, which would split Long March variants in the ranking).
const previous = await fetchAllPages<Ll2Launch>(
  `${LL2}/launches/previous/?net__gte=${encodeURIComponent(sixMonthsAgo)}&limit=100&mode=normal`,
);
const upcoming = ((await (
  await fetchWithBackoff(`${LL2}/launches/upcoming/?limit=100`)
).json()) as Paginated<Ll2Launch>).results;

const satcatCsv = await (await fetchWithBackoff(SATCAT_URL)).text();
const decays = satcatDecays(satcatCsv);

const stats = buildStats({ now, previous, upcoming, decays });
const file: OrbitsStatsFile = {
  fetched_at: now.toISOString(),
  source: `${LL2}/ + ${SATCAT_URL}`,
  ...stats,
};
mkdirSync("public/data/orbits", { recursive: true });
writeJsonAtomic(OUT_PATH, file);

console.log(
  `fetch-stats: ${previous.length} past launches (180d), ` +
    `${stats.launched_30d.total} launched/30d (${stats.launched_30d.failed} failed), ` +
    `${stats.scheduled_30d.total} scheduled/30d, ${stats.deorbited_30d.total} deorbited/30d, ` +
    `${stats.vehicles_6mo.length} vehicle families, ${requestCount} requests`,
);
