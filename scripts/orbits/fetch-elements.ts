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
 * A run-level time budget stops the remaining queries well inside the
 * workflow step timeout when CelesTrak is slow, so a slow source ends
 * the run gracefully instead of as a timed-out step.
 *
 * Exit code (Florian, 2026-09-09): a run where every query failed is
 * still a success while the kept element sets are fresher than
 * STALE_ALERT_MS (a transient CelesTrak outage keeps prior data, the
 * client shows its age). It exits non-zero, filing the ops alert, only
 * when every query failed AND no element set is younger than that: a
 * multi-day outage, or a broken fetcher.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { writeJsonAtomic } from "../lib/write-json-atomic";
import { fetchCapped } from "../lib/fetch-capped";
import { join, basename } from "node:path";
import type { ConstellationProfile, OmmRecord, OrbitsElementsFile } from "../../src/data/schema";
import { planElementQueries, splitRecords, stripOmm } from "./lib";

const GP_BASE = "https://celestrak.org/NORAD/elements/gp.php";
const REGISTRY_DIR = "src/data/registry/constellations";
const OUT_DIR = "public/data/orbits";
const USER_AGENT = "mcc-orbits/1.0 (+https://vesperio.ai)";
const DELAY_MS = 1500;
const RETRIES = 2;
/** Stop issuing queries past this run age (the workflow step allows 5 min). */
const RUN_BUDGET_MS = 150_000;
/** Every-query-failed runs alert only once the kept data is older than this. */
const STALE_ALERT_MS = 3 * 86_400_000;
const runStart = Date.now();

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
      const res = await fetchCapped(url, { headers: { "user-agent": USER_AGENT } });
      // CelesTrak 404s NAME queries with no match; that is an empty
      // result (bad mapping surfaces as a "0 records" warning), not an
      // outage worth retrying.
      if (res.status === 404) return [];
      if (!res.ok) throw new CelestrakHttpError(`HTTP ${res.status}`);
      const text = res.text;
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
  const elapsed = Date.now() - runStart;
  if (elapsed > RUN_BUDGET_MS) {
    console.error(
      `  BUDGET: ${Math.round(elapsed / 1000)}s elapsed; stopping the remaining ` +
        `${queries.length - i} CelesTrak queries this run, previous files kept.`,
    );
    failedQueries += queries.length - i;
    kept += queries.slice(i).reduce((n, rest) => n + rest.targets.length, 0);
    break;
  }
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
    writeJsonAtomic(outPath, file, 0);
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
  const newest = newestFetchedAt();
  const ageMs = newest === null ? Number.POSITIVE_INFINITY : Date.now() - Date.parse(newest);
  if (ageMs > STALE_ALERT_MS) {
    console.error(
      `fetch-elements: every query failed and the kept element sets are ` +
        `${newest === null ? "absent" : `${(ageMs / 86_400_000).toFixed(1)} days old`}; alerting.`,
    );
    process.exit(1);
  }
  console.warn(
    `fetch-elements: every query failed (CelesTrak unreachable or slow); previous element sets ` +
      `kept, newest ${(ageMs / 3_600_000).toFixed(1)}h old. Not an alert until ${STALE_ALERT_MS / 86_400_000} days stale.`,
  );
}

/** Newest fetched_at across the kept element files, null when there are none. */
function newestFetchedAt(): string | null {
  let newest: string | null = null;
  for (const f of existsSync(OUT_DIR) ? readdirSync(OUT_DIR) : []) {
    if (!f.startsWith("elements-") || !f.endsWith(".json")) continue;
    try {
      const at = (JSON.parse(readFileSync(join(OUT_DIR, f), "utf8")) as OrbitsElementsFile).fetched_at;
      if (typeof at === "string" && (newest === null || at > newest)) newest = at;
    } catch {
      // unreadable file: ignore, it cannot vouch for freshness
    }
  }
  return newest;
}
