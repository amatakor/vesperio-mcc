/**
 * Task 15: deterministic merge of VERIFIED timeline events into registry
 * profiles. Only events with verdict pass/fix merge; format checks mirror
 * scripts/lib/validate.ts checkTimeline. Writes profile.events sorted by
 * date; refuses to overwrite an existing non-empty events array unless
 * --append is set (2026-07-12 timeline top-up crawl: append keeps every
 * existing row untouched, drops candidates that duplicate one by date +
 * same source or same headline, and adds the rest).
 *
 * Usage: bun merge-events.ts --verified <dir> --repo <root> [--append]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeJsonAtomic } from "../lib/write-json-atomic";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const verifiedDir = arg("verified")!;
const repo = arg("repo") ?? process.cwd();
const append = process.argv.includes("--append");

const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const FULL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DASH_RE = /[–—]/;
const DIRS: Record<string, string> = {
  constellation: "constellations",
  organization: "organizations",
  vehicle: "vehicles",
  spaceport: "spaceports",
};

let merged = 0;
const rejected: string[] = [];
for (const file of readdirSync(verifiedDir).filter((f) => f.endsWith(".json")).sort()) {
  const cand = JSON.parse(readFileSync(join(verifiedDir, file), "utf8"));
  const dir = DIRS[cand.entity_type];
  if (!dir) { rejected.push(`${cand.slug}: bad entity_type ${cand.entity_type}`); continue; }
  const profilePath = join(repo, "src/data/registry", dir, `${cand.slug}.json`);
  const profile = JSON.parse(readFileSync(profilePath, "utf8"));
  const existing: Array<{ date: string; headline: string; source: string }> = Array.isArray(profile.events)
    ? profile.events
    : [];
  if (existing.length > 0 && !append) {
    rejected.push(`${cand.slug}: profile already has events, left untouched (use --append)`);
    continue;
  }
  const asOf: string = cand.as_of;
  if (!FULL_DATE_RE.test(asOf ?? "")) { rejected.push(`${cand.slug}: bad as_of`); continue; }
  const fetched = new Set<string>([...(cand.fetched_urls ?? []), ...(cand.verified_urls ?? [])]);

  const keep: Array<{ date: string; headline: string; source: string; as_of: string }> = [];
  for (const e of cand.events ?? []) {
    const tag = `${cand.slug} "${String(e.headline).slice(0, 40)}"`;
    if (e.verdict !== "pass" && e.verdict !== "fix") { rejected.push(`${tag}: verdict ${e.verdict ?? "missing"}`); continue; }
    if (typeof e.date !== "string" || !DATE_RE.test(e.date)) { rejected.push(`${tag}: bad date ${e.date}`); continue; }
    if (typeof e.headline !== "string" || e.headline.length === 0 || e.headline.length > 110) { rejected.push(`${tag}: bad headline length`); continue; }
    if (DASH_RE.test(e.headline) || e.headline.includes("!")) { rejected.push(`${tag}: dash or exclamation`); continue; }
    if (typeof e.source !== "string" || !/^https?:\/\//.test(e.source)) { rejected.push(`${tag}: bad source`); continue; }
    if (!fetched.has(e.source)) { rejected.push(`${tag}: source not in fetched/verified URLs`); continue; }
    if (/wikipedia\.org/i.test(e.source)) { rejected.push(`${tag}: Wikipedia is never citable`); continue; }
    const dupe = existing.find(
      (x) =>
        x.date === e.date &&
        (x.source === e.source || x.headline.trim().toLowerCase() === e.headline.trim().toLowerCase()),
    );
    if (dupe) { rejected.push(`${tag}: duplicates an existing event (${dupe.date})`); continue; }
    keep.push({ date: e.date, headline: e.headline, source: e.source, as_of: asOf });
  }
  if (keep.length === 0) { console.log(`${cand.slug}: nothing merged`); continue; }
  const combined = [...existing, ...keep];
  combined.sort((a, b) => a.date.localeCompare(b.date));
  profile.events = combined;
  writeJsonAtomic(profilePath, profile);
  merged += keep.length;
  console.log(`${cand.slug}: +${keep.length} events (${existing.length} kept)`);
}
console.log(`\n== merged ${merged} events`);
if (rejected.length) console.log(`== rejected:\n  ${rejected.join("\n  ")}`);
