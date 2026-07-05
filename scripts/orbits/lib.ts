/**
 * Pure helpers for the Orbits data pipeline: no network, no filesystem.
 * The fetch scripts wire these to CelesTrak and Launch Library 2; the
 * unit tests in scripts/__tests__ exercise them against fixtures.
 */

import {
  OMM_STRING_FIELDS,
  OMM_NUMBER_FIELDS,
  type ConstellationProfile,
  type OmmRecord,
  type OrbitsSpaceport,
} from "../../src/data/schema";

// ------------------------------------------------------------- elements

export interface ElementTarget {
  slug: string;
  /** OBJECT_NAME must match; null keeps every record of the query. */
  pattern: string | null;
}

export interface ElementQuery {
  /** gp.php query fragment, e.g. "GROUP=planet" or "NAME=ICEYE". */
  query: string;
  targets: ElementTarget[];
}

/**
 * Deduplicates the per-constellation CelesTrak mappings into one fetch
 * plan: a shared group (e.g. planet) is fetched once and split locally.
 */
export function planElementQueries(
  profiles: Pick<ConstellationProfile, "slug" | "orbits">[],
): ElementQuery[] {
  const byQuery = new Map<string, ElementTarget[]>();
  for (const p of profiles) {
    const o = p.orbits;
    if (!o) continue;
    const query = o.celestrak_group
      ? `GROUP=${encodeURIComponent(o.celestrak_group)}`
      : `NAME=${encodeURIComponent(o.celestrak_name!)}`;
    const targets = byQuery.get(query) ?? [];
    targets.push({ slug: p.slug, pattern: o.name_pattern });
    byQuery.set(query, targets);
  }
  return [...byQuery.entries()]
    .map(([query, targets]) => ({
      query,
      targets: targets.slice().sort((a, b) => a.slug.localeCompare(b.slug)),
    }))
    .sort((a, b) => a.query.localeCompare(b.query));
}

/**
 * Whitelists one raw GP/OMM record down to the json2satrec field set.
 * Returns an error string instead when a required field is missing or
 * mistyped, so a format change upstream fails loudly, not silently.
 */
export function stripOmm(raw: unknown): { record: OmmRecord } | { error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { error: "record is not an object" };
  }
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of OMM_STRING_FIELDS) {
    if (typeof r[key] !== "string" || r[key] === "") {
      return { error: `${String(r.OBJECT_NAME ?? "?")}: missing string field ${key}` };
    }
    out[key] = r[key];
  }
  for (const key of OMM_NUMBER_FIELDS) {
    if (typeof r[key] !== "number" || !Number.isFinite(r[key])) {
      return { error: `${String(r.OBJECT_NAME ?? "?")}: missing numeric field ${key}` };
    }
    out[key] = r[key];
  }
  return { record: out as unknown as OmmRecord };
}

/**
 * Splits one query's records across its target constellations by
 * OBJECT_NAME pattern, sorted by catalog number for stable diffs.
 */
export function splitRecords(
  records: OmmRecord[],
  targets: ElementTarget[],
): Map<string, OmmRecord[]> {
  const out = new Map<string, OmmRecord[]>();
  for (const t of targets) {
    const re = t.pattern === null ? null : new RegExp(t.pattern);
    const mine = records
      .filter((r) => re === null || re.test(r.OBJECT_NAME))
      .slice()
      .sort((a, b) => a.NORAD_CAT_ID - b.NORAD_CAT_ID);
    out.set(t.slug, mine);
  }
  return out;
}

// ----------------------------------------------------------- spaceports

/** The LL2 fields the pipeline reads; everything else is ignored. */
export interface Ll2Location {
  id: number;
  name: string;
  country?: { name?: string | null } | null;
  country_code?: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  total_launch_count?: number;
}

export interface Ll2Pad {
  active?: boolean;
  location?: { id?: number } | null;
  wiki_url?: string | null;
  info_url?: string | null;
}

export interface Ll2Launch {
  name?: string;
  net?: string | null;
  status?: { abbrev?: string | null } | null;
  rocket?: {
    configuration?: {
      name?: string;
      full_name?: string;
      /** LL2 2.3.0: broadest family first, e.g. [Long March, Long March 8]. */
      families?: { name?: string }[];
    } | null;
  } | null;
  pad?: (Ll2Pad & { name?: string; location?: { id?: number } | null }) | null;
}

function vehicleName(l: Ll2Launch): string | null {
  const c = l.rocket?.configuration;
  return c?.full_name ?? c?.name ?? null;
}

function locId(l: Ll2Launch): number | null {
  const id = l.pad?.location?.id;
  return typeof id === "number" ? id : null;
}

/** LL2 serializes coordinates as numbers or strings; null/"" must not become 0. */
function toCoord(v: number | string | null | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return NaN;
}

/**
 * Merges LL2 locations, pads, and launches into the spaceports list.
 * Active means at least one active pad or at least one upcoming launch
 * (ORBITS_SPEC.md 5.2); vehicles served come from upcoming launches,
 * supplemented by recent past launches when upcoming is sparse.
 */
export function buildSpaceports(args: {
  locations: Ll2Location[];
  pads: Ll2Pad[];
  upcoming: Ll2Launch[];
  previous: Ll2Launch[];
}): { spaceports: OrbitsSpaceport[]; errors: string[] } {
  const errors: string[] = [];

  const activePadLocs = new Set<number>();
  const padInfo = new Map<number, string>();
  for (const pad of args.pads) {
    const id = pad.location?.id;
    if (typeof id !== "number") continue;
    if (pad.active) activePadLocs.add(id);
    const url = pad.wiki_url ?? pad.info_url;
    if (url && !padInfo.has(id)) padInfo.set(id, url);
  }

  const upcomingByLoc = new Map<number, Ll2Launch[]>();
  for (const l of args.upcoming) {
    const id = locId(l);
    if (id === null) continue;
    const list = upcomingByLoc.get(id) ?? [];
    list.push(l);
    upcomingByLoc.set(id, list);
  }

  const previousVehicles = new Map<number, Set<string>>();
  const lastByLoc = new Map<number, Ll2Launch>();
  for (const l of args.previous) {
    const id = locId(l);
    if (id === null) continue;
    const v = vehicleName(l);
    if (v !== null) {
      const set = previousVehicles.get(id) ?? new Set<string>();
      set.add(v);
      previousVehicles.set(id, set);
    }
    if (l.net && !Number.isNaN(new Date(l.net).getTime())) {
      const cur = lastByLoc.get(id);
      if (!cur || new Date(l.net).getTime() > new Date(cur.net!).getTime()) {
        lastByLoc.set(id, l);
      }
    }
  }

  const spaceports: OrbitsSpaceport[] = [];
  for (const loc of args.locations) {
    const upcoming = upcomingByLoc.get(loc.id) ?? [];
    if (!activePadLocs.has(loc.id) && upcoming.length === 0) continue;

    const lat = toCoord(loc.latitude);
    const lon = toCoord(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      errors.push(`location ${loc.id} (${loc.name}): unusable lat/lon, skipped`);
      continue;
    }

    const dated = upcoming
      .filter((l) => l.net && !Number.isNaN(new Date(l.net).getTime()))
      .sort((a, b) => new Date(a.net!).getTime() - new Date(b.net!).getTime());
    const next = dated[0];

    const vehicles = new Set<string>();
    for (const l of upcoming) {
      const v = vehicleName(l);
      if (v !== null) vehicles.add(v);
    }
    for (const v of previousVehicles.get(loc.id) ?? []) vehicles.add(v);

    spaceports.push({
      ll2_id: loc.id,
      name: loc.name,
      country: loc.country?.name ?? loc.country_code ?? "",
      lat,
      lon,
      total_launch_count: loc.total_launch_count ?? 0,
      upcoming_count: upcoming.length,
      next_launch: next
        ? { name: next.name ?? "", vehicle: vehicleName(next) ?? "", net: next.net! }
        : null,
      last_launch: (() => {
        const last = lastByLoc.get(loc.id);
        return last
          ? { name: last.name ?? "", vehicle: vehicleName(last) ?? "", net: last.net! }
          : null;
      })(),
      vehicles: [...vehicles].sort(),
      info_url: padInfo.get(loc.id) ?? null,
    });
  }

  spaceports.sort((a, b) => a.name.localeCompare(b.name));
  return { spaceports, errors };
}

// ---------------------------------------------------------------- stats

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;
const WINDOW_MS = 30 * DAY_MS;

/** Launch statuses that count as failures in the flow chart. */
const FAILURE_ABBREVS = new Set(["Failure", "Partial Failure"]);

function netMs(l: Ll2Launch): number | null {
  if (!l.net) return null;
  const t = new Date(l.net).getTime();
  return Number.isNaN(t) ? null : t;
}

/** UTC-midnight ISO date for a bucket start. */
function bucketStartIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export interface StatsInputs {
  now: Date;
  /** Past launches, roughly the last 180 days (net in the past). */
  previous: Ll2Launch[];
  /** Future launches (net in the future). */
  upcoming: Ll2Launch[];
  /** Decay timestamps (ms epoch) of catalog objects, any range. */
  decays: number[];
}

export type OrbitsStats = Omit<
  import("../../src/data/schema").OrbitsStatsFile,
  "fetched_at" | "source"
>;

/**
 * Computes the 6A HUD metrics: 30-day launched/failed/scheduled/
 * deorbited totals with 4 weekly buckets each side of now, the 6-month
 * per-family launch ranking, and the next few upcoming launches.
 */
export function buildStats({ now, previous, upcoming, decays }: StatsInputs): OrbitsStats {
  const nowMs = now.getTime();

  const launchedWeekly = [3, 2, 1, 0].map((w) => ({
    start: bucketStartIso(nowMs - (w + 1) * WEEK_MS),
    launched: 0,
    failed: 0,
  }));
  let launchedTotal = 0;
  let failedTotal = 0;
  const families = new Map<string, number>();

  for (const l of previous) {
    const t = netMs(l);
    if (t === null || t > nowMs) continue;
    const age = nowMs - t;
    if (age <= 180 * DAY_MS) {
      const c = l.rocket?.configuration;
      const family = c?.families?.[0]?.name || c?.name || "Unknown";
      families.set(family, (families.get(family) ?? 0) + 1);
    }
    if (age <= WINDOW_MS) {
      launchedTotal++;
      const failed = FAILURE_ABBREVS.has(l.status?.abbrev ?? "");
      if (failed) failedTotal++;
      const bucket = 3 - Math.min(3, Math.floor(age / WEEK_MS));
      const slot = launchedWeekly[bucket];
      if (slot) {
        slot.launched++;
        if (failed) slot.failed++;
      }
    }
  }

  const scheduledWeekly = [0, 1, 2, 3].map((w) => ({
    start: bucketStartIso(nowMs + w * WEEK_MS),
    count: 0,
  }));
  let scheduledTotal = 0;
  const dated = upcoming
    .map((l) => ({ l, t: netMs(l) }))
    .filter((x): x is { l: Ll2Launch; t: number } => x.t !== null && x.t >= nowMs)
    .sort((a, b) => a.t - b.t);
  for (const { t } of dated) {
    const ahead = t - nowMs;
    if (ahead > WINDOW_MS) continue;
    scheduledTotal++;
    const bucket = Math.min(3, Math.floor(ahead / WEEK_MS));
    scheduledWeekly[bucket]!.count++;
  }

  const deorbitWeekly = [3, 2, 1, 0].map((w) => ({
    start: bucketStartIso(nowMs - (w + 1) * WEEK_MS),
    count: 0,
  }));
  let deorbitTotal = 0;
  for (const t of decays) {
    const age = nowMs - t;
    if (age < 0 || age > WINDOW_MS) continue;
    deorbitTotal++;
    const bucket = 3 - Math.min(3, Math.floor(age / WEEK_MS));
    deorbitWeekly[bucket]!.count++;
  }

  return {
    launched_30d: { total: launchedTotal, failed: failedTotal, weekly: launchedWeekly },
    scheduled_30d: { total: scheduledTotal, weekly: scheduledWeekly },
    deorbited_30d: { total: deorbitTotal, weekly: deorbitWeekly },
    vehicles_6mo: [...families.entries()]
      .map(([family, count]) => ({ family, count }))
      .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family)),
    upcoming: dated.slice(0, 5).map(({ l }) => ({
      name: l.name ?? "",
      vehicle: l.rocket?.configuration?.full_name ?? l.rocket?.configuration?.name ?? "",
      pad: l.pad?.name ?? "",
      net: l.net!,
    })),
  };
}

/**
 * Parses the CelesTrak SATCAT CSV and returns decay timestamps (ms).
 * Handles quoted fields; keys columns by header name so column-order
 * drift upstream cannot corrupt the result.
 */
export function satcatDecays(csv: string): number[] {
  const lines = csv.split("\n");
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]!);
  const decayIdx = header.indexOf("DECAY_DATE");
  if (decayIdx === -1) return [];
  const out: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line) continue;
    const cols = splitCsvLine(line);
    const decay = cols[decayIdx];
    if (!decay) continue;
    const t = new Date(decay + "T00:00:00Z").getTime();
    if (!Number.isNaN(t)) out.push(t);
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else if (ch !== "\r") cur += ch;
  }
  out.push(cur);
  return out;
}
