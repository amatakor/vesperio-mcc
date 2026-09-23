/**
 * One-off backfill (2026-09-23): reconstruct each item's post-publication
 * updates[] from the git history of src/data/items.json, so items updated
 * before finalize-sweep stamped update records carry an honest, dated
 * account of what changed. Per sweep commit and item: the copy changed
 * (headline or explainer) -> "copy" with the first NEW sentence as the
 * note (the agent's own words from that sweep); the score moved (other
 * than the persistence bump) -> "score" with the trace reason; only
 * sources grew -> "attach". Changes on the publication day are initial
 * sourcing, not updates. Existing records are kept; a (date, kind) already
 * present is never duplicated. Deterministic, no network.
 *
 * Usage: bun scripts/backfill-item-updates.ts [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { Item, ItemUpdate, ItemsFile } from "../src/data/schema";

const PATH = "src/data/items.json";
const dry = process.argv.includes("--dry");
const PERSISTENCE = "persistence window";

const log = Bun.spawnSync(["git", "log", "--format=%H|%cI", "--reverse", "--", PATH]).stdout.toString().trim();
const commits = log.split("\n").map((l) => {
  const [sha, at] = l.split("|");
  return { sha: sha!, date: at!.slice(0, 10) };
});

function itemsAt(sha: string): Map<string, Item> {
  const raw = Bun.spawnSync(["git", "show", `${sha}:${PATH}`]).stdout.toString();
  const parsed = JSON.parse(raw) as ItemsFile | Item[];
  const list = Array.isArray(parsed) ? parsed : parsed.items;
  return new Map(list.map((i) => [i.id, i]));
}

// Sentence boundary: terminal punctuation followed by whitespace and a
// capital or an opening quote/bracket; "Jr. ruled" and "Sept. 22" stay whole.
const sentences = (s: string): string[] =>
  s
    .split(/(?<=[.!?])\s+(?=[A-Z"(\u201c])/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
function newSentence(before: Item, after: Item): string | null {
  const oldSet = new Set(
    [before.headline, before.explainer.tagline, before.explainer.what_happened, before.explainer.why_it_matters, before.explainer.for_who ?? ""]
      .flatMap(sentences),
  );
  // The body first: a new fact reads as a sentence there; the headline last.
  for (const field of [after.explainer.what_happened, after.explainer.tagline, after.explainer.why_it_matters, after.headline]) {
    for (const s of sentences(field)) {
      if (oldSet.has(s) || s.length < 40) continue;
      return s.length > 240 ? `${s.slice(0, 237).trimEnd()}...` : s;
    }
  }
  return null;
}

const records = new Map<string, ItemUpdate[]>();
let prev = itemsAt(commits[0]!.sha);
for (let c = 1; c < commits.length; c++) {
  const { sha, date } = commits[c]!;
  const cur = itemsAt(sha);
  for (const [id, after] of cur) {
    const before = prev.get(id);
    if (!before) continue;
    const pub = (after.publishDate ?? after.date).slice(0, 10);
    if (date <= pub) continue;
    const copyChanged =
      before.headline !== after.headline || JSON.stringify(before.explainer) !== JSON.stringify(after.explainer);
    // Items from before the scoring engine carry no snr; a score appearing
    // is initial scoring, not a move.
    const scoreChanged = typeof before.snr === "number" && typeof after.snr === "number" && before.snr !== after.snr;
    const attached = (after.sources?.length ?? 0) > (before.sources?.length ?? 0);
    if (!copyChanged && !scoreChanged && !attached) continue;
    const hist = (after.snr_trace.history ?? []).find((h) => h.date === date && h.from === before.snr && h.to === after.snr);
    const persistenceOnly = scoreChanged && hist !== undefined && hist.reason.includes(PERSISTENCE) && !copyChanged;
    if (persistenceOnly) continue;
    const kind: ItemUpdate["kind"] = scoreChanged && !(hist?.reason.includes(PERSISTENCE)) ? "score" : copyChanged ? "copy" : "attach";
    const note =
      kind === "score"
        ? (hist?.reason ?? newSentence(before, after) ?? `Score moved from ${before.snr} to ${after.snr}.`)
        : kind === "copy"
          ? (newSentence(before, after) ?? "Copy updated.")
          : "Corroborating sources attached; no new facts.";
    const rec: ItemUpdate = { date, kind, note, ...(kind === "score" ? { score: { from: before.snr, to: after.snr } } : {}) };
    const list = records.get(id) ?? [];
    if (!list.some((r) => r.date === date && r.kind === kind)) list.push(rec);
    records.set(id, list);
  }
  prev = cur;
}

const file = JSON.parse(readFileSync(PATH, "utf8")) as ItemsFile;
let touched = 0;
const counts = { copy: 0, score: 0, attach: 0 };
for (const it of file.items) {
  const recs = records.get(it.id);
  if (!recs) continue;
  const have = new Set((it.updates ?? []).map((u) => `${u.date}|${u.kind}`));
  const add = recs.filter((r) => !have.has(`${r.date}|${r.kind}`));
  if (add.length === 0) continue;
  it.updates = [...(it.updates ?? []), ...add].sort((a, b) => (a.date < b.date ? -1 : 1));
  touched++;
  for (const r of add) counts[r.kind]++;
}
console.log(`backfill-item-updates: ${commits.length} commits scanned, ${touched} items updated, records added: ${JSON.stringify(counts)}`);
if (!dry) writeFileSync(PATH, `${JSON.stringify(file, null, 2)}\n`);
