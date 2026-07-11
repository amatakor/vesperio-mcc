/**
 * Deterministic registry enrichment (weekly, runs before the maintenance
 * agent in maintain-registry.yml). Fills ONLY null fields, never
 * overwrites, from:
 *
 *  - Launch Library 2 (aggregator, SNR 4 canonical): vehicle
 *    first_flight_date / flights_total / flights_successful /
 *    last_flight_date / next_flight_date. Three bulk queries total
 *    (launcher configs, upcoming launches, previous launches); the free
 *    tier allows ~15 requests/hour, so per-entity polling is forbidden
 *    (SWEEP_MEMORY 2026-07-05-D). Each field's source is the exact bulk
 *    query URL fetched, which literally contains the value.
 *  - GCAT (J. McDowell, planet4589.org, CC-BY; aggregator, SNR 4
 *    canonical): organization founded years from the orgs table, matched
 *    by exact name only. Attribution is rendered on every profile page
 *    that cites a planet4589.org source (src/pages.tsx).
 *
 * CelesTrak-derived sats_active_verified is owned by
 * scripts/compute-fleet-counts.ts (machine-computed from committed
 * element sets); this script does not touch it.
 *
 * Exit non-zero only on catastrophic failure; an upstream API being down
 * means those fields stay null this week, logged, not fatal.
 */

import { readdirSync, readFileSync } from "node:fs";
import { writeJsonAtomic } from "./lib/write-json-atomic";
import { join } from "node:path";
import { ll2ConfigId as ll2ConfigIdShared, ll2SearchName } from "./enrich/lib";

const UA = "VesperioMCC-Sweep contact@vesperio.ai";
const LL2 = "https://ll.thespacedevs.com/2.2.0";
const GCAT_ORGS_URL = "https://planet4589.org/space/gcat/tsv/tables/orgs.tsv";
export const GCAT_ATTRIBUTION = "data from GCAT (J. McDowell, planet4589.org/space/gcat)";

type Obj = Record<string, unknown>;

interface SourcedFieldShape {
  value: unknown;
  source: string | null;
  as_of: string | null;
  snr?: number;
  snr_trace?: Obj;
  tier?: string;
}

/** True when the profile's field is fillable: absent value or null/[] value. */
export function isNull(profile: Obj, field: string): boolean {
  const f = profile[field] as SourcedFieldShape | undefined;
  if (f === undefined || f === null) return false; // structurally absent: not ours to add
  const v = f.value;
  return v === null || v === undefined || (Array.isArray(v) && v.length === 0);
}

/**
 * Null-fill a field in place with an aggregator-tier (SNR 4 canonical)
 * value. Returns false (and changes nothing) when the field already has
 * a value: this function never overwrites.
 */
export function fillAggregator(
  profile: Obj,
  field: string,
  value: unknown,
  source: string,
  asOf: string,
  reason: string,
): boolean {
  if (!isNull(profile, field)) return false;
  if (value === null || value === undefined) return false;
  profile[field] = {
    value,
    source,
    as_of: asOf,
    snr: 4,
    snr_trace: {
      base: { tier: 4, source, reason },
      modifiers: [],
      final: 4,
      scorer_version: 1,
    },
    tier: "canonical",
  };
  return true;
}

/** LL2 launcher-config id from any field source URL already on the profile.
    Delegates to the shared v2 helper so both enrichers accept both LL2 URL
    shapes (config/launcher and launcher_configurations). */
export function ll2ConfigId(profile: Obj): number | null {
  return ll2ConfigIdShared(profile);
}

/** YYYY-MM-DD from an ISO datetime; null when unparseable. */
export function isoDay(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * GCAT orgs.tsv parse: header line starts with "#", tab-separated.
 * Returns Name/ShortEName/EName (lowercased) -> founding year from TStart
 * (leading 4-digit year; GCAT dates carry precision suffixes we drop).
 */
export function parseGcatOrgs(tsv: string): Map<string, number> {
  const lines = tsv.split("\n");
  if (lines.length === 0) return new Map();
  const header = (lines[0] ?? "").replace(/^#\s*/, "").split("\t");
  const col = (name: string): number => header.indexOf(name);
  const tstart = col("TStart");
  const nameCols = [col("Name"), col("ShortEName"), col("EName")].filter((i) => i >= 0);
  const out = new Map<string, number>();
  if (tstart < 0 || nameCols.length === 0) return out;
  for (const line of lines.slice(1)) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const cells = line.split("\t");
    const m = /^\s*(\d{4})/.exec(cells[tstart] ?? "");
    if (!m) continue;
    const year = Number(m[1]);
    for (const i of nameCols) {
      const n = (cells[i] ?? "").trim().toLowerCase();
      // "-" is GCAT's empty marker; skip it and blanks.
      if (n !== "" && n !== "-" && !out.has(n)) out.set(n, year);
    }
  }
  return out;
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string): Promise<Obj> {
  return JSON.parse(await fetchText(url)) as Obj;
}

const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface Ll2Bulk {
  configs: Map<number, Obj>;
  configsUrl: string;
  nextByConfig: Map<number, string>;
  nextUrl: string;
  lastByConfig: Map<number, string>;
  lastUrl: string;
}

/** Three bulk LL2 queries; per-entity polling is deliberately impossible here. */
async function fetchLl2(): Promise<Ll2Bulk> {
  const configsUrl = `${LL2}/config/launcher/?limit=100&mode=detailed`;
  const configsRes = await fetchJson(configsUrl);
  const configs = new Map<number, Obj>();
  for (const c of (configsRes.results as Obj[]) ?? []) {
    if (typeof c.id === "number") configs.set(c.id, c);
  }
  await pause(4000);

  const nextUrl = `${LL2}/launch/upcoming/?limit=100`;
  const nextRes = await fetchJson(nextUrl);
  const nextByConfig = new Map<number, string>();
  for (const l of (nextRes.results as Obj[]) ?? []) {
    const cfg = ((l.rocket as Obj)?.configuration as Obj)?.id;
    const day = isoDay(l.net);
    // upcoming list is soonest-first; keep the first (nearest) per config
    if (typeof cfg === "number" && day !== null && !nextByConfig.has(cfg)) {
      nextByConfig.set(cfg, day);
    }
  }
  await pause(4000);

  const lastUrl = `${LL2}/launch/previous/?limit=100`;
  const lastRes = await fetchJson(lastUrl);
  const lastByConfig = new Map<number, string>();
  for (const l of (lastRes.results as Obj[]) ?? []) {
    const cfg = ((l.rocket as Obj)?.configuration as Obj)?.id;
    const day = isoDay(l.net);
    // previous list is latest-first; keep the first (most recent) per config
    if (typeof cfg === "number" && day !== null && !lastByConfig.has(cfg)) {
      lastByConfig.set(cfg, day);
    }
  }
  return { configs, configsUrl, nextByConfig, nextUrl, lastByConfig, lastUrl };
}

async function main(): Promise<void> {
  const root = new URL("..", import.meta.url).pathname;
  const registry = join(root, "src/data/registry");
  const today = new Date().toISOString().slice(0, 10);
  let filled = 0;

  // ---- vehicles from LL2 ----------------------------------------------------
  let ll2: Ll2Bulk | null = null;
  try {
    ll2 = await fetchLl2();
  } catch (e) {
    console.error(`enrich: LL2 unavailable this run, vehicle fields skipped: ${String(e)}`);
  }
  if (ll2 !== null) {
    const dir = join(registry, "vehicles");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const path = join(dir, file);
      const profile = JSON.parse(readFileSync(path, "utf8")) as Obj;
      let id = ll2ConfigId(profile);
      if (id === null) {
        // Search-shaped source URLs carry no numeric id; resolve by exact
        // name against the bulk catalog already fetched (zero extra requests).
        const name = ll2SearchName(profile);
        if (name !== null) {
          const norm = name.trim().toLowerCase();
          const hits = [...ll2.configs.entries()].filter(
            ([, c]) =>
              String(c.name ?? "").trim().toLowerCase() === norm ||
              String(c.full_name ?? "").trim().toLowerCase() === norm,
          );
          if (hits.length === 1) {
            id = hits[0][0];
            console.log(`enrich: ${file}: resolved search-name "${name}" to config ${id}`);
          } else {
            console.log(`enrich: ${file}: search-name "${name}" matched ${hits.length} configs, skipped`);
          }
        }
      }
      if (id === null) {
        console.log(`enrich: ${file}: no LL2 config id on any field source, skipped`);
        continue;
      }
      const cfg = ll2.configs.get(id);
      let changed = 0;
      const reason = "Launch Library 2 record, deterministic weekly enrichment (null-fill only)";
      if (cfg !== undefined) {
        if (fillAggregator(profile, "first_flight_date", isoDay(cfg.maiden_flight), ll2.configsUrl, today, reason)) changed++;
        if (typeof cfg.total_launch_count === "number" && fillAggregator(profile, "flights_total", cfg.total_launch_count, ll2.configsUrl, today, reason)) changed++;
        if (typeof cfg.successful_launches === "number" && fillAggregator(profile, "flights_successful", cfg.successful_launches, ll2.configsUrl, today, reason)) changed++;
      }
      const next = ll2.nextByConfig.get(id);
      if (next !== undefined && fillAggregator(profile, "next_flight_date", next, ll2.nextUrl, today, reason)) changed++;
      const last = ll2.lastByConfig.get(id);
      if (last !== undefined && fillAggregator(profile, "last_flight_date", last, ll2.lastUrl, today, reason)) changed++;
      if (changed > 0) {
        writeJsonAtomic(path, profile);
        filled += changed;
        console.log(`enrich: ${file}: ${changed} field(s) filled from LL2`);
      }
    }
  }

  // ---- organization founded years from GCAT ----------------------------------
  try {
    const orgsDir = join(registry, "organizations");
    const needsFounded = readdirSync(orgsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ f, p: JSON.parse(readFileSync(join(orgsDir, f), "utf8")) as Obj }))
      .filter(({ p }) => isNull(p, "founded"));
    if (needsFounded.length > 0) {
      const gcat = parseGcatOrgs(await fetchText(GCAT_ORGS_URL));
      for (const { f, p } of needsFounded) {
        const year = gcat.get(String(p.name ?? "").toLowerCase());
        if (year === undefined) {
          console.log(`enrich: ${f}: no exact GCAT name match for founded, skipped`);
          continue;
        }
        if (
          fillAggregator(
            p,
            "founded",
            year,
            GCAT_ORGS_URL,
            today,
            `${GCAT_ATTRIBUTION}; orgs table TStart year, exact name match`,
          )
        ) {
          writeJsonAtomic(join(orgsDir, f), p);
          filled++;
          console.log(`enrich: ${f}: founded filled from GCAT`);
        }
      }
    }
  } catch (e) {
    console.error(`enrich: GCAT unavailable this run, founded fields skipped: ${String(e)}`);
  }

  console.log(`enrich-registry: ${filled} field(s) filled (null-fill only, nothing overwritten)`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error("enrich-registry: catastrophic failure:", e);
    process.exit(1);
  });
}
