/**
 * Builds public/data/orbits/spaceports.json from Launch Library 2
 * (ORBITS_SPEC.md 5.2): all active launch sites globally, with total
 * launches, upcoming count, next launch, and vehicles served.
 *
 * Budget: locations (1 page) + pads (paginated, ~4) + upcoming (1) +
 * previous (1), about 7 requests per run, twice daily. The free tier
 * allows 15/hour (verified 2026-07-05, thespacedevs.com/llapi).
 * Exponential backoff on 429.
 */

import { mkdirSync } from "node:fs";
import { writeJsonAtomic } from "../lib/write-json-atomic";
import { join } from "node:path";
import type { OrbitsSpaceportsFile } from "../../src/data/schema";
import { buildSpaceports, type Ll2Launch, type Ll2Location, type Ll2Pad } from "./lib";

const BASE = "https://ll.thespacedevs.com/2.3.0";
const OUT_PATH = join("public/data/orbits", "spaceports.json");
const USER_AGENT = "mcc-orbits/1.0 (+https://vesperio.ai)";
const MAX_PAGES = 10;
const RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let requestCount = 0;

async function fetchJson(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    requestCount++;
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (res.status === 429 && attempt < RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2000 * 4 ** attempt;
      console.warn(`  429 from LL2, backing off ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
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
    const data = (await fetchJson(url)) as Paginated<T>;
    if (!Array.isArray(data.results)) throw new Error(`unexpected page shape for ${url}`);
    out.push(...data.results);
    url = data.next;
  }
  return out;
}

const locations = await fetchAllPages<Ll2Location>(`${BASE}/locations/?limit=100`);
const pads = await fetchAllPages<Ll2Pad>(`${BASE}/pads/?limit=100`);
// Launches deliberately capped at one page of 100 each (spec 5.2).
const upcoming = ((await fetchJson(`${BASE}/launches/upcoming/?limit=100`)) as Paginated<Ll2Launch>)
  .results;
const previous = ((await fetchJson(`${BASE}/launches/previous/?limit=100`)) as Paginated<Ll2Launch>)
  .results;

const { spaceports, errors } = buildSpaceports({ locations, pads, upcoming, previous });
for (const e of errors) console.warn(`  ${e}`);

const file: OrbitsSpaceportsFile = {
  fetched_at: new Date().toISOString(),
  source: `${BASE}/`,
  spaceports,
};
mkdirSync("public/data/orbits", { recursive: true });
writeJsonAtomic(OUT_PATH, file);

console.log(
  `fetch-spaceports: ${spaceports.length} active sites from ${locations.length} locations, ` +
    `${requestCount} requests`,
);
