/**
 * One-off generator for the Orbits star background: fetches the Yale
 * Bright Star Catalog (public domain; via brettonw/YaleBrightStarCatalog's
 * JSON transcription) and writes public/data/orbits/stars.json with the
 * stars brighter than magnitude 5.5 as [ra_deg, dec_deg, vmag] triples.
 * The output is committed; this script only reruns on manual request.
 * The catalog is epoch J2000 and effectively static, so there is no
 * scheduled refresh.
 */

import { mkdirSync, writeFileSync } from "node:fs";

const SOURCE = "https://raw.githubusercontent.com/brettonw/YaleBrightStarCatalog/master/bsc5-short.json";
const OUT = "public/data/orbits/stars.json";
const MAG_LIMIT = 5.5;

interface BscEntry {
  RA?: string; // "00h 05m 09.9s"
  Dec?: string; // "+45° 13′ 45″"
  V?: string; // "6.70"
}

function raToDeg(ra: string): number | null {
  const m = ra.match(/^(\d+)h (\d+)m ([\d.]+)s$/);
  if (!m) return null;
  return (Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600) * 15;
}

function decToDeg(dec: string): number | null {
  const m = dec.match(/^([+-])(\d+)° (\d+)′ ([\d.]+)″$/);
  if (!m) return null;
  const v = Number(m[2]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
  return m[1] === "-" ? -v : v;
}

const res = await fetch(SOURCE);
if (!res.ok) {
  console.error(`build-stars: HTTP ${res.status} from ${SOURCE}`);
  process.exit(1);
}
const raw = (await res.json()) as BscEntry[];

const stars: [number, number, number][] = [];
let skipped = 0;
for (const e of raw) {
  if (!e.RA || !e.Dec || !e.V) continue;
  const mag = Number(e.V);
  if (!Number.isFinite(mag) || mag > MAG_LIMIT) continue;
  const ra = raToDeg(e.RA);
  const dec = decToDeg(e.Dec);
  if (ra === null || dec === null) {
    skipped++;
    continue;
  }
  stars.push([Math.round(ra * 100) / 100, Math.round(dec * 100) / 100, Math.round(mag * 10) / 10]);
}

if (stars.length < 1000) {
  console.error(`build-stars: only ${stars.length} stars parsed; refusing to write`);
  process.exit(1);
}

mkdirSync("public/data/orbits", { recursive: true });
const file = {
  fetched_at: new Date().toISOString(),
  source: SOURCE,
  attribution: "Yale Bright Star Catalog 5 (Hoffleit & Warren), public domain",
  mag_limit: MAG_LIMIT,
  stars,
};
writeFileSync(OUT, JSON.stringify(file) + "\n");
console.log(`build-stars: ${stars.length} stars (mag <= ${MAG_LIMIT}), ${skipped} unparsable entries skipped`);
