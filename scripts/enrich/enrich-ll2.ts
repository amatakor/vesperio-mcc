/**
 * Deterministic vehicle-spec enrichment from Launch Library 2 (aggregator,
 * SNR 4 canonical). Null-fills ONLY the registry v2 performance/dimension
 * fields that are structurally absent from the vehicle JSON files:
 *
 *   payload_gto_kg <- gto_capacity   (kg, as LL2 states)
 *   height_m       <- length         (metres, as LL2 states)
 *   diameter_m     <- diameter       (metres, as LL2 states)
 *   mass_kg        <- launch_mass    (LL2 states TONNES; x1000, verified F9 549 t)
 *   price_per_launch_usd <- launch_cost (plain USD string, verified F9 = 52,000,000)
 *
 * payload_leo_kg is also v2-eligible but is already filled on the committed
 * profiles; the null-fill guard leaves it untouched.
 *
 * NOT filled: payload_sso_kg. LL2 2.2.0 config/launcher carries no
 * sso_capacity (nor geo_capacity) field, so there is nothing to copy;
 * inventing it would violate the never-estimate rule. Skipped for every
 * vehicle and reported.
 *
 * NOT touched: first_flight_date / flights_* / last_flight_date /
 * next_flight_date (owned by enrich-registry.ts; variant-scoped dates are a
 * known trap and stay out of this script).
 *
 * Matching reuses enrich-registry.ts's approach exactly: the LL2 launcher
 * config id is read off any existing field source URL on the profile
 * (ll2ConfigId). Vehicles with no such id are skipped, as there.
 *
 * Bulk-only, no per-entity polling: the launcher-config list is paginated
 * (limit=100, follow `next`), ~6 requests for the full catalog, well under
 * the ~15 req/hr free tier. Each field's source is the exact page URL the
 * config record was read from. Exit 0 even when LL2 is down (logged, skipped).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LL2, type Obj, fetchJson, fillV2, ll2ConfigId, ll2SearchName, pause, today } from "./lib";
import { writeJsonAtomic } from "../lib/write-json-atomic";

/** A finite number strictly greater than zero, else null (rejects 0 / null / NaN). */
function posNum(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number(raw) : raw;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

interface MatchedConfig {
  cfg: Obj;
  /** The exact paginated query URL this config record was read from. */
  url: string;
}

/**
 * Paginate the launcher-config list (detailed mode carries the capacity and
 * dimension fields) and index configs by id, remembering the page each came
 * from so a field's source is the literal URL that returned the value.
 */
async function fetchConfigs(): Promise<Map<number, MatchedConfig>> {
  const out = new Map<number, MatchedConfig>();
  let url: string | null = `${LL2}/config/launcher/?limit=100&mode=detailed`;
  let page = 0;
  while (url !== null) {
    const res: Obj = await fetchJson(url);
    for (const c of (res.results as Obj[]) ?? []) {
      if (typeof c.id === "number") out.set(c.id, { cfg: c, url });
    }
    const next = res.next;
    url = typeof next === "string" && next.length > 0 ? next : null;
    page++;
    if (url !== null) await pause(4000); // stay clear of the free-tier rate limit
  }
  console.log(`enrich-ll2: fetched ${out.size} launcher configs across ${page} page(s)`);
  return out;
}

async function main(): Promise<void> {
  const root = new URL("../..", import.meta.url).pathname;
  const dir = join(root, "src/data/registry/vehicles");
  const asOf = today();
  const reason = "Launch Library 2 record, deterministic v2 spec enrichment (null-fill only)";

  let configs: Map<number, MatchedConfig>;
  try {
    configs = await fetchConfigs();
  } catch (e) {
    console.error(`enrich-ll2: LL2 unavailable this run, vehicle specs skipped: ${String(e)}`);
    return; // exit 0: fields stay absent this run, not fatal
  }

  let totalFilled = 0;
  let ssoSkipped = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const path = join(dir, file);
    const profile = JSON.parse(readFileSync(path, "utf8")) as Obj;
    let id = ll2ConfigId(profile);
    if (id === null) {
      // Search-shaped source URLs carry no numeric id; resolve by exact
      // name against the catalog already fetched (zero extra requests).
      const name = ll2SearchName(profile);
      if (name !== null) {
        const norm = name.trim().toLowerCase();
        const hits = [...configs.entries()].filter(([, m]) => {
          const c = m.cfg as Obj;
          return (
            String(c.name ?? "").trim().toLowerCase() === norm ||
            String(c.full_name ?? "").trim().toLowerCase() === norm
          );
        });
        if (hits.length === 1) {
          id = hits[0][0];
          console.log(`enrich-ll2: ${file}: resolved search-name "${name}" to config ${id}`);
        } else {
          console.log(
            `enrich-ll2: ${file}: search-name "${name}" matched ${hits.length} configs, skipped`,
          );
        }
      }
    }
    if (id === null) {
      console.log(`enrich-ll2: ${file}: no LL2 config id on any field source, skipped`);
      continue;
    }
    const matched = configs.get(id);
    if (matched === undefined) {
      console.log(`enrich-ll2: ${file}: LL2 config ${id} not in catalog, skipped`);
      continue;
    }
    const { cfg, url } = matched;
    const filledFields: string[] = [];

    // payload_sso_kg has no LL2 source field; never invented.
    ssoSkipped++;

    if (fillV2(profile, "payload_leo_kg", posNum(cfg.leo_capacity), url, asOf, reason)) filledFields.push("payload_leo_kg");
    if (fillV2(profile, "payload_gto_kg", posNum(cfg.gto_capacity), url, asOf, reason)) filledFields.push("payload_gto_kg");
    if (fillV2(profile, "height_m", posNum(cfg.length), url, asOf, reason)) filledFields.push("height_m");
    if (fillV2(profile, "diameter_m", posNum(cfg.diameter), url, asOf, reason)) filledFields.push("diameter_m");

    // launch_mass is documented in tonnes (verified: F9 = 549 t = 549,000 kg).
    const massT = posNum(cfg.launch_mass);
    if (massT !== null && fillV2(profile, "mass_kg", Math.round(massT * 1000), url, asOf, reason)) {
      filledFields.push("mass_kg");
    }

    // launch_cost is a plain-USD string (verified: F9 = "52000000" = $52M).
    if (fillV2(profile, "price_per_launch_usd", posNum(cfg.launch_cost), url, asOf, reason)) {
      filledFields.push("price_per_launch_usd");
    }

    // variant: a plain rendering qualifier (NOT a SourcedField). Written only
    // when LL2's full_name adds a genuine qualifier BEYOND the config name
    // (e.g. "Falcon 9" -> "Falcon 9 Block 5" yields "Block 5"). LL2's own
    // `variant` field is unreliable here: it repeats the family name ("Heavy",
    // "Vulcan", "One") or a "N/A" placeholder, none of which is a real
    // qualifier. The full_name-remainder test rejects all of those and the
    // known trap (variant-scoped naming like Nuri/KSLV-2, where full_name does
    // not start with the config name). Written only when the profile has none.
    let variantWritten = false;
    const cName = typeof cfg.name === "string" ? cfg.name.trim() : "";
    const cFull = typeof cfg.full_name === "string" ? cfg.full_name.trim() : "";
    if (
      profile.variant === undefined &&
      cName !== "" &&
      cFull.toLowerCase().startsWith(cName.toLowerCase())
    ) {
      const qualifier = cFull.slice(cName.length).trim();
      if (qualifier !== "" && qualifier.toUpperCase() !== "N/A") {
        profile.variant = qualifier;
        variantWritten = true;
      }
    }

    if (filledFields.length > 0 || variantWritten) {
      writeJsonAtomic(path, profile);
      totalFilled += filledFields.length;
      const parts = [...filledFields];
      if (variantWritten) parts.push(`variant="${String(profile.variant)}"`);
      console.log(`enrich-ll2: ${file}: ${parts.join(", ")}`);
    } else {
      console.log(`enrich-ll2: ${file}: nothing to fill (all present or unavailable)`);
    }
  }

  console.log(
    `enrich-ll2: ${totalFilled} field(s) filled (null-fill only); payload_sso_kg skipped for ${ssoSkipped} matched vehicle(s) (no LL2 source field)`,
  );
}

if (import.meta.main) {
  main().catch((e) => {
    console.error("enrich-ll2: catastrophic failure:", e);
    process.exit(1);
  });
}
