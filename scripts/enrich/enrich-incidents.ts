/**
 * Deterministic typed-incident enrichment: appends launch-failure events to
 * vehicle profile history timelines from Launch Library 2 (aggregator).
 *
 * Source query: /launch/?status=4 (Launch Failure), then status=7 (Partial
 * Failure) if the request budget allows, ordered newest-first (-net) so the
 * modern vehicles we track surface within budget. Normal mode carries the
 * rocket configuration id (for matching), the launch status, and failreason.
 *
 * Budget: at most 8 HTTP requests per run, shared across both status queries.
 *
 * Matching reuses enrich-registry.ts's approach: a launch belongs to one of
 * our vehicles when its rocket.configuration.id equals the LL2 config id read
 * off that vehicle profile (ll2ConfigId). Vehicles without a config id are
 * unreachable here, as everywhere else in the pipeline.
 *
 * Each appended event is a schema TimelineEvent (src/data/schema.ts):
 *   { date, headline, type: "incident", outcome, cause?, source, as_of }
 * NB: the schema/validator names the sentence field `headline` (not `text`);
 * this script writes `headline` so check-registry passes. Dedup is on
 * date + headline: an event already present is never re-appended.
 *
 * Exit 0 even when LL2 is down (logged, skipped). If the status-filtered
 * endpoint does not answer the expected shape, stop after the first probe
 * rather than burning the budget experimenting.
 */

import { readdirSync, readFileSync } from "node:fs";
import { writeJsonAtomic } from "../lib/write-json-atomic";
import { join } from "node:path";
import { LL2, type Obj, fetchJson, isoDay, ll2ConfigId, pause, today } from "./lib";

const MAX_REQUESTS = 8;
/** Leave this many requests for status=7 after the failure sweep. */
const STATUS4_SOFT_CAP = 6;

interface FailedLaunch {
  configId: number;
  date: string;
  mission: string;
  statusName: string;
  failreason: string | null;
  /** The exact paginated query URL this record was read from. */
  source: string;
}

/** Strip em/en dashes from a generated headline (house rule: none on site). */
function cleanHeadline(s: string): string {
  return s.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

function missionName(launch: Obj): string {
  const m = launch.mission;
  if (m && typeof m === "object" && typeof (m as Obj).name === "string") {
    return (m as Obj).name as string;
  }
  const name = launch.name;
  if (typeof name === "string") {
    // LL2 launch name is "Vehicle | Mission"; prefer the mission half.
    const parts = name.split("|");
    return (parts[parts.length - 1] ?? name).trim();
  }
  return "";
}

/**
 * Fetch failed launches for one status, following `next`, respecting a shared
 * request counter. Returns the collected launches plus the updated counter.
 * On the first page, verifies the response has the expected results/status
 * shape; if not, stops (returns what it has) rather than paging blindly.
 */
async function fetchStatus(
  status: number,
  startReqs: number,
  hardCap: number,
): Promise<{ launches: FailedLaunch[]; reqs: number; probeFailed: boolean }> {
  const launches: FailedLaunch[] = [];
  let reqs = startReqs;
  let url: string | null = `${LL2}/launch/?status=${status}&limit=100&ordering=-net`;
  let firstPage = true;
  while (url !== null && reqs < hardCap) {
    const res: Obj = await fetchJson(url);
    reqs++;
    const results = res.results;
    if (!Array.isArray(results)) {
      if (firstPage) return { launches, reqs, probeFailed: true };
      break;
    }
    for (const l of results as Obj[]) {
      const cfg = ((l.rocket as Obj)?.configuration as Obj)?.id;
      const day = isoDay(l.net);
      const statusName = ((l.status as Obj)?.name as string) ?? "";
      if (typeof cfg !== "number" || day === null) continue;
      const failraw = l.failreason;
      launches.push({
        configId: cfg,
        date: day,
        mission: missionName(l),
        statusName,
        failreason: typeof failraw === "string" && failraw.trim() !== "" ? failraw.trim() : null,
        source: url,
      });
    }
    firstPage = false;
    const next = res.next;
    url = typeof next === "string" && next.length > 0 ? next : null;
    if (url !== null && reqs < hardCap) await pause(4000);
  }
  return { launches, reqs, probeFailed: false };
}

async function main(): Promise<void> {
  const root = new URL("../..", import.meta.url).pathname;
  const dir = join(root, "src/data/registry/vehicles");
  const asOf = today();

  // Map every LL2 config id we track to its vehicle file.
  const byConfig = new Map<number, string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const profile = JSON.parse(readFileSync(join(dir, file), "utf8")) as Obj;
    const id = ll2ConfigId(profile);
    if (id !== null) byConfig.set(id, file);
  }
  console.log(`enrich-incidents: ${byConfig.size} tracked vehicle config id(s)`);

  let launches: FailedLaunch[] = [];
  let reqs = 0;
  try {
    const s4 = await fetchStatus(4, reqs, STATUS4_SOFT_CAP);
    reqs = s4.reqs;
    if (s4.probeFailed) {
      console.error("enrich-incidents: status=4 probe returned an unexpected shape, stopping");
      return;
    }
    launches = s4.launches;
    if (reqs < MAX_REQUESTS) {
      await pause(4000);
      const s7 = await fetchStatus(7, reqs, MAX_REQUESTS);
      reqs = s7.reqs;
      if (!s7.probeFailed) launches = launches.concat(s7.launches);
    }
  } catch (e) {
    console.error(`enrich-incidents: LL2 unavailable this run, incidents skipped: ${String(e)}`);
    return; // exit 0
  }
  console.log(`enrich-incidents: ${reqs} request(s) used; ${launches.length} failed launch(es) fetched`);

  // Group matched failures by vehicle file.
  const perFile = new Map<string, FailedLaunch[]>();
  for (const l of launches) {
    const file = byConfig.get(l.configId);
    if (file === undefined) continue;
    const arr = perFile.get(file) ?? [];
    arr.push(l);
    perFile.set(file, arr);
  }

  let appended = 0;
  for (const [file, fails] of [...perFile.entries()].sort()) {
    const path = join(dir, file);
    const profile = JSON.parse(readFileSync(path, "utf8")) as Obj;
    const events = Array.isArray(profile.events) ? (profile.events as Obj[]) : [];
    const seen = new Set(events.map((e) => `${String(e.date)}|${String(e.headline)}`));
    let fileAppended = 0;

    for (const f of fails) {
      const verb = /partial/i.test(f.statusName) ? "partial launch failure" : "launch failure";
      const subject = f.mission !== "" ? `${f.mission} ${verb}` : verb.charAt(0).toUpperCase() + verb.slice(1);
      const headline = cleanHeadline(subject);
      const key = `${f.date}|${headline}`;
      if (seen.has(key)) continue;
      const event: Obj = {
        date: f.date,
        headline,
        type: "incident",
        outcome: f.statusName !== "" ? f.statusName : "Launch Failure",
        source: f.source,
        as_of: asOf,
      };
      if (f.failreason !== null) event.cause = f.failreason;
      events.push(event);
      seen.add(key);
      fileAppended++;
    }

    if (fileAppended > 0) {
      // Keep timelines chronological for stable rendering and diffs.
      events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      profile.events = events;
      writeJsonAtomic(path, profile);
      appended += fileAppended;
      console.log(`enrich-incidents: ${file}: ${fileAppended} incident event(s) appended`);
    }
  }

  console.log(`enrich-incidents: ${appended} incident event(s) appended across ${perFile.size} matched vehicle(s)`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error("enrich-incidents: catastrophic failure:", e);
    process.exit(1);
  });
}
