/**
 * Florian-directed source attach (2026-09-29). Attaches a page Florian names
 * to an existing item, through the same gate a sweep uses: finalize-sweep
 * validates the class against the registry (anti-spoof), re-scores the
 * item from the engine, records the calibration claim, and stamps the
 * update record, so nothing here is hand-set. The page is fetched first;
 * an unreachable URL is never linked (CLAUDE.md rule 7).
 *
 * Usage:
 *   bun scripts/attach-source.ts --item <id> --url <page> --outlet "<name>" \
 *     --class <first_party|official_record|wire_pr|aggregator|trade|mainstream|informal> \
 *     --note "<one reader-facing sentence: what this source adds>" [--lead]
 *
 * --lead makes the page the item's lead source (a rescore with the new
 * lead first; the old lead stays attached as corroboration). Without it
 * the page attaches as corroboration and the score is recomputed the
 * same way. Scheduled agents never run this (not in any workflow allowlist).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { finalizeSweep } from "./finalize-sweep";
import { fetchSafeText } from "./lib/fetch-safe";
import type { Item, ItemsFile } from "../src/data/schema";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? null) : null;
}
const id = arg("item");
const url = arg("url");
const outlet = arg("outlet");
const cls = arg("class");
const note = arg("note");
const lead = process.argv.includes("--lead");
if (!id || !url || !outlet || !cls || !note) {
  console.error("usage: bun scripts/attach-source.ts --item <id> --url <page> --outlet <name> --class <class> --note <sentence> [--lead]");
  process.exit(2);
}

const ITEMS = "src/data/items.json";
const file = JSON.parse(readFileSync(ITEMS, "utf8")) as ItemsFile;
const item = file.items.find((i) => i.id === id);
if (!item) {
  console.error(`attach-source: no item "${id}"`);
  process.exit(2);
}
const existing = item.sources ?? [];
if (existing.some((s) => s.url === url) || item.source_url === url || item.secondary_urls.includes(url)) {
  console.error("attach-source: that URL is already attached");
  process.exit(2);
}

// Rule 7: only link what was fetched.
let fetched: { status: number; text: string };
try {
  fetched = await fetchSafeText(url, { maxBytes: 3 * 1024 * 1024 });
} catch (e) {
  console.error(`attach-source: could not fetch ${url}: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
if (fetched.status < 200 || fetched.status >= 300) {
  console.error(`attach-source: ${url} answered HTTP ${fetched.status}; not linking it`);
  process.exit(1);
}
console.log(`attach-source: fetched ${url} (HTTP ${fetched.status}, ${fetched.text.length} chars)`);

const attach = { url, outlet, class: cls, via: lead ? "upgrade" : "corroboration" };
const rescoreSources = lead
  ? [
      { url, outlet, class: cls, via: "upgrade" },
      ...existing.map((s) => ({ url: s.url, outlet: s.outlet, class: s.class, via: s.via === "initial" ? "corroboration" : s.via })),
    ]
  : [
      ...existing.map((s) => ({ url: s.url, outlet: s.outlet, class: s.class, via: s.via })),
      { url, outlet, class: cls, via: "corroboration" },
    ];
const patch: Record<string, unknown> = lead
  ? { source_url: url, secondary_urls: [item.source_url, ...item.secondary_urls].filter((u) => u !== url) }
  : {};
const draft = {
  newItems: [],
  updates: [
    {
      id,
      patch,
      note,
      attach: [attach],
      rescore: { sources: rescoreSources, extraordinary: false, crawl: "found_some", whitelist: null },
    },
  ],
  held: [],
  sourceHealth: [],
  summary: `Interactive source attach (Florian): ${outlet} attached to ${id}${lead ? " as the lead" : ""}. ${note}`,
  coverage: [item.category],
};
const draftPath = ".attach-source-draft.json";
writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`);
const result = finalizeSweep({ dataDir: "src/data", draftPath, interactive: true });
if (!result.ok) {
  console.error("attach-source: rejected by the gate:\n  " + result.errors.join("\n  "));
  process.exit(1);
}
const after = (JSON.parse(readFileSync(ITEMS, "utf8")) as ItemsFile).items.find((i) => i.id === id) as Item;
console.log(`attach-source: merged. snr ${item.snr} -> ${after.snr}; lead ${after.source_url}; sources ${after.sources?.length ?? 0}`);
