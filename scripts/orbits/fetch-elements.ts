/**
 * Fetches orbital element sets from CelesTrak as OMM JSON and writes one
 * elements-<constellation-slug>.json per registry constellation with an
 * orbits mapping, under public/data/orbits/ (ORBITS_SPEC.md 5.1).
 *
 * Politeness: one request per distinct group/name query (shared groups
 * fetched once), sequential with a delay, on the 12-hour cron only.
 * CelesTrak updates at most every 2 hours and asks not to poll faster.
 *
 * Failure mode: on a failed query or an empty result the previous file
 * is kept; the client's fetched_at staleness check surfaces old data.
 * Exits non-zero only when every query fails.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import type { ConstellationProfile, OmmRecord, OrbitsElementsFile } from "../../src/data/schema";
import { planElementQueries, splitRecords, stripOmm } from "./lib";

const GP_BASE = "https://celestrak.org/NORAD/elements/gp.php";
const REGISTRY_DIR = "src/data/registry/constellations";
const OUT_DIR = "public/data/orbits";
const USER_AGENT = "mcc-orbits/1.0 (+https://mcc.vesperio.ai)";
const DELAY_MS = 1500;
const RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A non-200 HTTP answer from CelesTrak. Per its usage policy (reviewed
 * 2026-07-11, ruling in reports/source-terms-2026-07.md): "M2M software
 * should immediately stop querying when it receives any non-HTTP 200
 * responses", so this is never retried, and the run stops its remaining
 * CelesTrak queries, keeping every previous file. The 404 no-match answer
 * on NAME queries is CelesTrak's documented empty result, not an error.
 */
class CelestrakHttpError extends Error {}

async function fetchGp(url: string): Promise<OmmRecord[] | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      // CelesTrak 404s NAME queries with no match; that is an empty
      // result (bad mapping surfaces as a "0 records" warning), not an
      // outage worth retrying.
      if (res.status === 404) return [];
      if (!res.ok) throw new CelestrakHttpError(`HTTP ${res.status}`);
      const text = await res.text();
      // CelesTrak answers "No GP data found" as plain text on empty matches.
      if (!text.trimStart().startsWith("[")) return [];
      const raw = JSON.parse(text) as unknown[];
      const records: OmmRecord[] = [];
      for (const entry of raw) {
        const stripped = stripOmm(entry);
        if ("error" in stripped) throw new Error(`unexpected GP record shape: ${stripped.error}`);
        records.push(stripped.record);
      }
      return records;
    } catch (e) {
      // HTTP error responses are never retried (see CelestrakHttpError);
      // only network-level failures (timeouts, resets) get the backoff.
      if (e instanceof CelestrakHttpError) throw e;
      if (attempt >= RETRIES) {
        console.error(`  FAIL ${url}: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
      await sleep(5000 * (attempt + 1));
    }
  }
}

// `--only slug1,slug2` limits the run to those constellations (dev use:
// refresh one layer without re-polling every CelesTrak query).
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > -1 ? new Set(process.argv[onlyArg + 1]?.split(",") ?? []) : null;

const profiles: Pick<ConstellationProfile, "slug" | "orbits">[] = readdirSync(REGISTRY_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(REGISTRY_DIR, f), "utf8")) as ConstellationProfile)
  .map((p) => ({ slug: p.slug, orbits: p.orbits ?? null }))
  .filter((p) => only === null || only.has(p.slug));

const queries = planElementQueries(profiles);
mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
let kept = 0;
let failedQueries = 0;

for (const [i, q] of queries.entries()) {
  if (i > 0) await sleep(DELAY_MS);
  const url = `${GP_BASE}?${q.query}&FORMAT=JSON`;
  let records: OmmRecord[] | null;
  try {
    records = await fetchGp(url);
  } catch (e) {
    // Non-200 from CelesTrak: stop ALL remaining queries this run per the
    // usage policy; previous files stay in place, staleness surfaces to
    // the client via fetched_at.
    console.error(
      `  HALT ${url}: ${e instanceof Error ? e.message : String(e)}; ` +
        "stopping remaining CelesTrak queries this run per the usage policy.",
    );
    failedQueries += queries.length - i;
    kept += queries.slice(i).reduce((n, rest) => n + rest.targets.length, 0);
    break;
  }
  if (records === null) {
    failedQueries++;
    kept += q.targets.length;
    continue;
  }
  const split = splitRecords(records, q.targets);
  for (const t of q.targets) {
    const mine = split.get(t.slug) ?? [];
    const outPath = join(OUT_DIR, `elements-${t.slug}.json`);
    if (mine.length === 0) {
      console.warn(
        `  ${t.slug}: 0 of ${records.length} records matched ${q.query}` +
          `${t.pattern ? ` pattern ${t.pattern}` : ""}; kept previous file`,
      );
      kept++;
      continue;
    }
    const file: OrbitsElementsFile = {
      fetched_at: new Date().toISOString(),
      source: url,
      constellation: t.slug,
      records: mine,
    };
    writeFileSync(outPath, JSON.stringify(file) + "\n");
    console.log(`  ${t.slug}: ${mine.length} records (${q.query})`);
    written++;
  }
}

// Orphaned files mean a mapping was removed; flag them for cleanup.
// Skipped under --only, where most slugs are deliberately absent.
if (only === null) {
  const expected = new Set(profiles.filter((p) => p.orbits).map((p) => `elements-${p.slug}.json`));
  for (const f of existsSync(OUT_DIR) ? readdirSync(OUT_DIR) : []) {
    if (f.startsWith("elements-") && !expected.has(f)) {
      console.warn(`  orphan: ${OUT_DIR}/${f} has no mapped constellation (${basename(f)})`);
    }
  }
}

console.log(
  `fetch-elements: ${queries.length} queries, ${written} files written, ${kept} kept, ${failedQueries} failed`,
);
if (queries.length > 0 && failedQueries === queries.length) {
  console.error("fetch-elements: every query failed");
  process.exit(1);
}
