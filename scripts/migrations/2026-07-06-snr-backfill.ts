/**
 * One-shot SNR migration (SNR_PLAN.md §A6, slice 3). Run once with:
 *   bun scripts/migrations/2026-07-06-snr-backfill.ts
 *
 * What it does, in order:
 *  1. Scores all existing items through the real engine (scripts/snr/),
 *     using the judgment table below (source classes adjudicated by the
 *     reviewing agent on 2026-07-06). Adds snr, snr_trace, sources;
 *     renames impact critical->seismic and routine->noise. The legacy
 *     confidence field stays until the UI slice switches over.
 *  2. Releases the single held.json entry: the Rocket Lab-Iridium press
 *     release attaches as a source to the already-published SEC-sourced
 *     item (same actor + same event class within 7 days = same event).
 *  3. Backfills registry SourcedFields by source class per Florian's
 *     decisions: aggregators (LL2, Gunter's, NextSpaceflight, eoPortal)
 *     SNR 4 canonical; press SNR 4 canonical (grandfathered: the
 *     adversarial collector/verifier pipeline is credited as
 *     corroboration); CelesTrak/Space-Track SNR 5 canonical with the
 *     scope annotation; Wikipedia, corporate, and government pages stay
 *     unscored (source link only, SNR_SPEC §2.3).
 *  4. Appends a migration entry to the state.json sweep log.
 *
 * Deterministic given the tables below; safe to re-run only on a clean
 * pre-migration tree (it does not check for prior runs).
 */

import { readdirSync } from "fs";
import { scoreClaim, type ScoreInput } from "../snr/score";
import type {
  Item,
  ItemSource,
  SourceClass,
  SnrTrace,
  SnrValue,
  SourcedField,
} from "../../src/data/schema";

const TODAY = "2026-07-06";

// ------------------------------------------------------------- item table
//
// Judgment table: per item id, the distinct sources (deduped by outlet,
// lead first) used for scoring, plus flags. Adjudicated field-by-field
// against items.json on 2026-07-06.

interface ItemJudgment {
  /** Distinct sources for scoring (dedup by outlet is done here). */
  scored: { url: string; outlet: string; class: SourceClass }[];
  /** PERSISTENCE_DAYS uncontested by migration day (SNR_PLAN.md §A1). */
  persisted?: boolean;
  /** Replaces the generated base reason (fixtures, LL2 observational note). */
  baseReason?: string;
  /** Extra sources to attach to the stored sources array (not scored twice). */
  attach?: ItemSource[];
}

const SEC = (url: string) => ({ url, outlet: "SEC", class: "official_record" as const });
const ICEYE = { url: "https://www.iceye.com", outlet: "ICEYE", class: "first_party" as const };
const SPACENEWS = { url: "https://spacenews.com", outlet: "SpaceNews", class: "trade" as const };
const ESF = {
  url: "https://europeanspaceflight.com",
  outlet: "European Spaceflight",
  class: "trade" as const,
};

const FIXTURE_REASON =
  "fixture item (removed at launch, Task 6): mechanical backfill from the retired 'confirmed' tier";
const LL2_REASON =
  "Launch Library 2 launch record: direct observational data for launch-occurrence facts";

/**
 * Keyed by item id. `scored[i].url` is replaced by the item's actual
 * source_url for the lead entry at runtime, so the table only fixes
 * outlet and class; literal URLs are given only for attached extras.
 */
const ITEM_JUDGMENTS: Record<string, ItemJudgment> = {
  "2026-06-28-fixture-spacex-falcon-9-starlink-group": {
    scored: [{ url: "", outlet: "fixture", class: "official_record" }],
    baseReason: FIXTURE_REASON,
  },
  "2026-07-01-fixture-iceye-esa-sar-contract": {
    scored: [{ url: "", outlet: "fixture", class: "official_record" }],
    baseReason: FIXTURE_REASON,
  },
  "2026-07-02-fixture-fcc-ast-spacemobile-modification": {
    scored: [{ url: "", outlet: "fixture", class: "official_record" }],
    baseReason: FIXTURE_REASON,
  },
  "2026-06-29-iceye-iberdrola-grid-pilot": { scored: [ICEYE] },
  "2026-07-01-iceye-wildfire-canada": { scored: [ICEYE] },
  "2026-06-29-rocket-lab-acquires-iridium": {
    // Lead: the 8-K. The held rocketlabcorp.com release (headline and date
    // verified on the /updates/ listing 2026-07-05; article body behind a
    // Cloudflare challenge) attaches as a distinct first-party source.
    scored: [
      SEC(""),
      {
        url: "https://rocketlabcorp.com/updates/rocket-lab-to-acquire-iridium-in-historic-deal-creating-a-fully-vertically-integrated-space-powerhouse-primed-for-growth/",
        outlet: "Rocket Lab",
        class: "first_party",
      },
    ],
    attach: [
      {
        url: "https://rocketlabcorp.com/updates/rocket-lab-to-acquire-iridium-in-historic-deal-creating-a-fully-vertically-integrated-space-powerhouse-primed-for-growth/",
        outlet: "Rocket Lab",
        class: "first_party",
        added: TODAY,
        via: "corroboration",
      },
    ],
  },
  "2026-06-05-planet-labs-atm-offering": { scored: [SEC("")] },
  "2026-06-15-iceye-liberty-parametric-wildfire-insurance": { scored: [ICEYE] },
  "2026-06-17-iceye-portugal-additional-sar-satellites": { scored: [ICEYE] },
  "2026-06-18-iceye-norway-nve-flood-monitoring": { scored: [ICEYE] },
  "2026-06-19-rocket-lab-victus-haze-launch": {
    scored: [{ url: "", outlet: "Launch Library 2", class: "computed" }],
    baseReason: LL2_REASON,
  },
  // 14 uncontested days by migration day (published 2026-06-22).
  "2026-06-22-ohb-capital-raise": { scored: [ESF], persisted: true },
  "2026-06-30-firefly-ssc-space-esrange-sweden-2028": { scored: [SPACENEWS] },
  "2026-07-01-vantor-worldview-3d": { scored: [SPACENEWS] },
  "2026-07-01-fcc-satellite-licensing-overhaul-vote": { scored: [SPACENEWS] },
  "2026-06-30-nasa-lunar-lander-awards": { scored: [SPACENEWS] },
  "2026-07-02-hongqing-technology-funding-round": { scored: [SPACENEWS] },
  "2026-07-02-atlas-v-final-amazon-leo-launch": {
    scored: [
      SPACENEWS,
      { url: "", outlet: "Launch Library 2", class: "computed" },
    ],
  },
  "2026-07-02-isar-aerospace-planet-germany-launch-deal": {
    scored: [ESF, { url: "", outlet: "SpaceNews", class: "trade" }],
  },
  "2026-07-01-latitude-oman-launch-loi": { scored: [SPACENEWS] },
  "2026-07-01-blue-origin-new-glenn-pad-conops": { scored: [SPACENEWS] },
  "2026-07-06-nasa-sba-strategic-capital-partnership": { scored: [SPACENEWS] },
};

const IMPACT_RENAME: Record<string, string> = { critical: "seismic", routine: "noise" };

// -------------------------------------------------------- registry tables

const COMPUTED_HOSTS = ["celestrak.org", "space-track.org"];
const AGGREGATOR_HOSTS = [
  "ll.thespacedevs.com",
  "thespacedevs.com",
  "space.skyrocket.de",
  "nextspaceflight.com",
  "eoportal.org",
];
const PRESS_HOSTS = [
  "spacenews.com",
  "payloadspace.com",
  "europeanspaceflight.com",
  "nasaspaceflight.com",
  "reuters.com",
  "viasatellite.com",
  "satellitetoday.com",
  "cnbc.com",
  "techcrunch.com",
  "arstechnica.com",
  "spaceflightnow.com",
  "spaceconnectonline.com.au",
  "texastribune.org",
  "muscatdaily.com",
  // Xinhua: state media, press class per the state-media handling rule.
  "english.news.cn",
];

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

type Bucket = "computed" | "aggregator" | "press" | "unscored";

function classify(url: string): Bucket {
  const h = host(url);
  if (h.includes("wikipedia")) return "unscored";
  if (COMPUTED_HOSTS.some((x) => h.endsWith(x))) return "computed";
  if (AGGREGATOR_HOSTS.some((x) => h.endsWith(x))) return "aggregator";
  if (PRESS_HOSTS.some((x) => h.endsWith(x))) return "press";
  // Default: corporate and government/institutional pages = first-party
  // family, unscored (SNR_SPEC 2.3), current rendering unchanged.
  return "unscored";
}

function registryTrace(bucket: Exclude<Bucket, "unscored">, source: string): { snr: SnrValue; trace: SnrTrace } {
  if (bucket === "computed") {
    return {
      snr: 5,
      trace: {
        base: {
          tier: 5,
          source,
          reason:
            "direct observational data (CelesTrak/Space-Track), scoped to what it measures: cataloged on orbit as of the field's as_of date",
        },
        modifiers: [],
        final: 5,
        scorer_version: 1,
      },
    };
  }
  if (bucket === "aggregator") {
    return {
      snr: 4,
      trace: {
        base: { tier: 4, source, reason: "established aggregator, single reference (migration backfill 2026-07-06)" },
        modifiers: [],
        final: 4,
        scorer_version: 1,
      },
    };
  }
  return {
    snr: 4,
    trace: {
      base: { tier: 3, source, reason: "reputable outlet, single reference" },
      modifiers: [
        {
          type: "corroboration_2plus",
          delta: 1,
          reason:
            "grandfathered: verified by the adversarial collector/verifier crawl pipeline, credited as corroboration (migration 2026-07-06, Florian's call in SNR_PLAN A6)",
        },
      ],
      final: 4,
      scorer_version: 1,
    },
  };
}

// ------------------------------------------------------------------ items

const itemsFile = await Bun.file("src/data/items.json").json();
let scoredCount = 0;

for (const item of itemsFile.items as (Item & Record<string, unknown>)[]) {
  const judgment = ITEM_JUDGMENTS[item.id];
  if (judgment === undefined) throw new Error(`no judgment table entry for ${item.id}`);

  // Lead entry gets the item's actual source_url; other scored entries
  // keep their table URL or fall back to the first secondary_url.
  const scored = judgment.scored.map((s, i) => ({
    ...s,
    url: i === 0 ? item.source_url : s.url !== "" ? s.url : item.secondary_urls[0] ?? item.source_url,
  }));

  const input: ScoreInput = {
    sources: scored.map((s) => ({ ...s, added: item.date, via: "initial" as const })),
    extraordinary: false,
    crawl: "not_attempted",
    whitelist: null,
    reinforced: false,
    persisted: judgment.persisted ?? false,
    disputeDowngrade: false,
  };
  const { snr, trace } = scoreClaim(input);
  if (judgment.baseReason !== undefined) trace.base.reason = judgment.baseReason;

  // Stored sources: lead + every distinct secondary URL + explicit attaches.
  const sources: ItemSource[] = [
    { url: item.source_url, outlet: scored[0]!.outlet, class: scored[0]!.class, added: item.date, via: "initial" },
  ];
  for (const u of item.secondary_urls) {
    const match = scored.find((s) => s.url === u);
    sources.push({
      url: u,
      outlet: match?.outlet ?? scored[0]!.outlet,
      class: match?.class ?? scored[0]!.class,
      added: item.date,
      via: "initial",
    });
  }
  for (const extra of judgment.attach ?? []) {
    sources.push(extra);
    if (!item.secondary_urls.includes(extra.url)) item.secondary_urls.push(extra.url);
  }

  item.snr = snr;
  item.snr_trace = trace;
  item.sources = sources;
  if (IMPACT_RENAME[item.impact] !== undefined) item.impact = IMPACT_RENAME[item.impact] as never;
  scoredCount++;
}

await Bun.write("src/data/items.json", JSON.stringify(itemsFile, null, 2) + "\n");

// ------------------------------------------------------------------- held

await Bun.write(
  "src/data/held.json",
  JSON.stringify({ held: [] }, null, 2) + "\n",
);

// --------------------------------------------------------------- registry

const dirs = ["constellations", "organizations", "spaceports", "vehicles"];
const counts = { computed: 0, aggregator: 0, press: 0, unscored: 0 };

for (const dir of dirs) {
  for (const file of readdirSync(`src/data/registry/${dir}`)) {
    if (!file.endsWith(".json")) continue;
    const path = `src/data/registry/${dir}/${file}`;
    const profile = await Bun.file(path).json();
    let changed = false;
    for (const [, value] of Object.entries(profile)) {
      if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        !("value" in value) ||
        !("source" in value) ||
        !("as_of" in value)
      ) {
        continue;
      }
      const field = value as SourcedField<unknown> & Record<string, unknown>;
      if (field.value === null || field.source === null) continue;
      const bucket = classify(field.source);
      counts[bucket]++;
      if (bucket === "unscored") continue;
      const { snr, trace } = registryTrace(bucket, field.source);
      field.snr = snr;
      field.snr_trace = trace;
      field.tier = "canonical";
      changed = true;
    }
    if (changed) await Bun.write(path, JSON.stringify(profile, null, 2) + "\n");
  }
}

// ------------------------------------------------------------------ state

const state = await Bun.file("src/data/state.json").json();
state.sweeps.push({
  at: new Date().toISOString(),
  added: 0,
  updated: scoredCount,
  held: 0,
  summary:
    `SNR migration (SNR_SPEC.md): scored all ${scoredCount} items through the engine and retired the ` +
    `confidence ladder; released the held Rocket Lab-Iridium press release as a source attach to the ` +
    `SEC-sourced item; backfilled registry SNR badges (${counts.aggregator} aggregator and ${counts.press} ` +
    `press fields at 4 canonical, ${counts.computed} computed fields at 5; ${counts.unscored} ` +
    `Wikipedia/first-party fields stay unscored per SNR_SPEC 2.3).`,
  coverage: ["migration"],
});
await Bun.write("src/data/state.json", JSON.stringify(state, null, 2) + "\n");

console.log(`items scored: ${scoredCount}`);
console.log(`registry fields:`, counts);
