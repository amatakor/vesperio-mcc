/**
 * Task 13 registry fill: deterministic merge of VERIFIED candidate files into
 * registry profiles. Fills only fields whose current value is null; never
 * overwrites. Accepts only verdict "pass" or "fix". Rejects em/en dashes,
 * malformed dates, type mismatches, and sources not recorded as fetched.
 *
 * Usage: bun merge.ts --type organization --verified <dir> [--repo <root>]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Kind = "string" | "number" | "boolean" | "string[]";

const TYPES: Record<string, { dir: string; fields: Record<string, Kind> }> = {
  organization: {
    dir: "organizations",
    fields: {
      overview: "string", country: "string", founded: "number",
      focus: "string", status: "string", website: "string",
    },
  },
  constellation: {
    dir: "constellations",
    fields: {
      overview: "string", operator: "string", country: "string",
      sensor_types: "string[]", sats_launched_total: "number",
      sats_active_claimed: "number", sats_planned: "number",
      orbit: "string", first_launch_date: "string", latest_launch_date: "string",
      status: "string", website: "string",
    },
  },
  spaceport: {
    dir: "spaceports",
    fields: {
      overview: "string", country: "string", operator: "string",
      first_launch_date: "string", launches_total: "number",
      status: "string", website: "string",
    },
  },
  vehicle: {
    dir: "vehicles",
    fields: {
      overview: "string", provider: "string", country: "string",
      vehicle_class: "string", payload_leo_kg: "number", reusable: "boolean",
      first_flight_date: "string", flights_total: "number",
      flights_successful: "number", last_flight_date: "string",
      next_flight_date: "string", status: "string", price_per_launch_usd: "number",
    },
  },
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const type = arg("type") ?? "";
const verifiedDir = arg("verified") ?? "";
const repo = arg("repo") ?? process.cwd();
const spec = TYPES[type];
if (!spec || !verifiedDir) {
  console.error("usage: bun merge.ts --type <organization|constellation|spaceport|vehicle> --verified <dir> [--repo <root>]");
  process.exit(2);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DASH_RE = /[–—]/; // en dash, em dash
const HTTP_RE = /^https?:\/\//;

function kindOk(value: unknown, kind: Kind): boolean {
  if (kind === "string[]") return Array.isArray(value) && value.every((x) => typeof x === "string");
  return typeof value === kind;
}

let filled = 0;
const rejected: string[] = [];
const conflicts: string[] = [];

const files = readdirSync(verifiedDir).filter((f) => f.endsWith(".json")).sort();
for (const file of files) {
  const cand = JSON.parse(readFileSync(join(verifiedDir, file), "utf8"));
  const slug: string = cand.slug;
  const profilePath = join(repo, "src/data/registry", spec.dir, `${slug}.json`);
  let profile: Record<string, any>;
  try {
    profile = JSON.parse(readFileSync(profilePath, "utf8"));
  } catch {
    rejected.push(`${slug}: profile not found at ${profilePath}`);
    continue;
  }
  if (cand.entity_type !== type) {
    rejected.push(`${slug}: entity_type "${cand.entity_type}" != ${type}`);
    continue;
  }
  const asOf: string = cand.as_of;
  if (typeof asOf !== "string" || !DATE_RE.test(asOf)) {
    rejected.push(`${slug}: bad as_of "${asOf}"`);
    continue;
  }
  const fetched = new Set<string>([...(cand.fetched_urls ?? []), ...(cand.verified_urls ?? [])]);

  let touched = 0;
  const perField: string[] = [];
  for (const [field, entry] of Object.entries<any>(cand.fields ?? {})) {
    const kind = spec.fields[field];
    if (!kind) { rejected.push(`${slug}.${field}: not a fillable field for ${type}`); continue; }
    if (entry.verdict !== "pass" && entry.verdict !== "fix") {
      rejected.push(`${slug}.${field}: verdict "${entry.verdict ?? "missing"}" (${entry.reason ?? "no reason"})`);
      continue;
    }
    const value = entry.value;
    if (value === null || value === undefined) { rejected.push(`${slug}.${field}: null/missing value`); continue; }
    if (!kindOk(value, kind)) { rejected.push(`${slug}.${field}: value type != ${kind}`); continue; }
    if (field.endsWith("_date") && !(typeof value === "string" && DATE_RE.test(value))) {
      rejected.push(`${slug}.${field}: date must be YYYY-MM-DD, got "${value}"`); continue;
    }
    const strings = kind === "string[]" ? (value as string[]) : kind === "string" ? [value as string] : [];
    if (strings.some((s) => DASH_RE.test(s))) { rejected.push(`${slug}.${field}: contains em/en dash`); continue; }
    if (strings.some((s) => s.includes("!"))) { rejected.push(`${slug}.${field}: contains exclamation mark`); continue; }
    const source = entry.source;
    if (typeof source !== "string" || !HTTP_RE.test(source)) { rejected.push(`${slug}.${field}: bad source URL`); continue; }
    if (!fetched.has(source)) { rejected.push(`${slug}.${field}: source not in fetched/verified URLs`); continue; }

    const target = profile[field];
    if (!target || typeof target !== "object" || !("value" in target)) {
      rejected.push(`${slug}.${field}: profile field is not a SourcedField`); continue;
    }
    if (target.value !== null) {
      conflicts.push(`${slug}.${field}: already has value, left untouched`); continue;
    }
    profile[field] = { value, source, as_of: asOf };
    touched++;
    perField.push(field);
  }

  if (touched > 0) {
    if (typeof profile.notes === "string" && profile.notes.includes("pending")) profile.notes = null;
    writeFileSync(profilePath, JSON.stringify(profile, null, 2) + "\n");
    filled += touched;
    console.log(`${slug}: filled ${touched} (${perField.join(", ")})`);
  } else {
    console.log(`${slug}: nothing merged`);
  }
}

console.log(`\n== merged ${filled} fields across ${files.length} candidate files`);
if (conflicts.length) console.log(`== conflicts (untouched):\n  ${conflicts.join("\n  ")}`);
if (rejected.length) console.log(`== rejected:\n  ${rejected.join("\n  ")}`);
