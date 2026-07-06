# BUILD_PLAN.md — MCC scaffold, ordered tasks for Claude Code

Execute in order. One task per session or PR. Do not start a task until
the previous task's acceptance criteria pass. CLAUDE.md is the canonical
spec for schema, scope, routes, and design rules; when this file and
CLAUDE.md disagree, CLAUDE.md wins.

Repo state at start: CLAUDE.md, SWEEP_MEMORY.md, prompts/, src/data/
(sources, empty items/held/state, signals placeholder, registry dirs),
.github/workflows/ (present but INERT until Task 5; do not enable cron).

---

## Task 1 — Project skeleton and schema

Build: Vite + React + TypeScript project using Bun. No extra frameworks,
no CSS libraries, no state libraries.

- `src/data/schema.ts`: TypeScript types for the item schema exactly as
  defined in CLAUDE.md (explainer block, categories, impact, confidence,
  tags), plus types for sources.json, signals.json, held.json, state.json,
  and registry entries (constellation and vehicle profile shapes, every
  field nullable with `source` and `as_of`).
- `scripts/check-feed.ts`, `scripts/check-registry.ts`,
  `scripts/check-signals.ts`: validate the JSON files against the schema,
  exit non-zero on any violation.
- `bun run build` = typecheck + all check scripts + vite build.

Out of scope: UI beyond a placeholder page, prerender, sweep scripts.

Accept when: `bun run build` passes on the empty data files; corrupting
any data file makes it fail.

## Task 2 — Sweep helper scripts

Build the deterministic half of the ingestion pipeline that
`prompts/update-items.md` references:

- `scripts/sweep-context.ts`: prints JSON `{ now, lastSweep, feedSize,
  existing: [{ id, normId, source_url, headline }] }` from state.json
  and items.json.
- `scripts/finalize-sweep.ts`: reads `sweep-draft.json` from repo root;
  validates every newItem against the schema and the hard rules that are
  mechanically checkable (source_url present and well-formed, category
  and impact in enum, headline length, id format, dedup against
  existing ids); stamps publishDate; merges into items.json, held.json,
  sources.json (source health), state.json (sweep log entry); deletes
  the draft on success; exits non-zero with a precise reason on any
  rejection, leaving all data files untouched.

Out of scope: anything that calls an LLM or fetches the web. These
scripts are deterministic; the agent does the fetching.

Accept when: a hand-written valid draft merges correctly; drafts with a
missing source_url, a duplicate id, and an invalid category are each
rejected with the data files unchanged (write these three fixtures as
tests under `scripts/__tests__/`).

## Task 3 — Site: feed, routes, prerender

- Routes exactly as CLAUDE.md's surfaces define: `/`, `/item/{id}/`,
  `/news/{category}/`, `/registry/`, `/registry/constellations/{slug}/`,
  `/registry/vehicles/{slug}/`, `/signals/`, `/stats/`, `/about/`.
- `scripts/prerender.ts`: emits a static HTML file per route with
  correct title, meta description, and canonical URL for
  https://mcc.vesperio.ai. Runs as the last build step.
- Design rules from CLAUDE.md apply: no border-radius, no transform
  hovers, mono type for structural elements, dark background, one
  accent colour. Use a neutral placeholder accent (`--acc: #9aa4ab`)
  behind a single CSS variable; Florian supplies the palette later.
- /about/ contains the verification policy as an extractable Q&A block.
- /stats/ renders basic indices computed at build time from items.json
  and registry data, each block with an anchor id and a citation string
  with retrieval date, and the build emits `/stats.json`. With empty
  data it renders zeros, not errors.

Out of scope: Learn section, paid features, analytics.

Accept when: `bun run build` emits all routes; feed renders seeded test
items (add 3 realistic fixtures, clearly marked as fixtures, removed in
Task 6); every page passes the design rules on visual inspection.

## Task 4 — Registry seed

Create initial profiles as JSON files, schema from Task 1, every filled
field with a real source URL and as_of date, unknown fields null:

- Constellations (EO): Planet (Dove/SkySat), ICEYE, BlackSky, Maxar
  Legion, Capella, Umbra, Satellogic, Synspective, Pixxel, GHGSat,
  Jilin-1.
- Constellations (connectivity): Starlink, OneWeb, Kuiper, AST
  SpaceMobile, O3b mPOWER, Lightspeed.
- Vehicles: Falcon 9, Falcon Heavy, Starship, Electron, Neutron,
  Ariane 6, Vega-C, New Glenn, Vulcan, Alpha, Spectrum, RFA One,
  Nova, PSLV, SSLV, GSLV/LVM3, H3, Long March 2D/5/6/8/11 (as one file
  per variant only where data supports it, otherwise family-level).

Facts must be verified by web fetch during the task, not recalled from
training data. A profile with mostly nulls and correct sources beats a
complete profile with guessed numbers.

Accept when: check-registry passes; spot-checking 5 random filled fields
against their source URLs confirms each.

## Task 5 — Wire the automation

- Reconcile `.github/workflows/*.yml` and `prompts/*.md` against the
  scripts as actually built in Task 2 (names, arguments, paths).
- Run one manual sweep via workflow_dispatch against a reduced source
  set (6 sources: Planet, ICEYE, SpaceX, Rocket Lab, SEC EDGAR PL,
  Launch Library). Human-review every produced item against its source.
- Fix editorial gaps by editing CLAUDE.md or prompts, never by
  hand-editing items.json.

Accept when: two consecutive manual sweeps produce zero factual errors
and zero rule violations. Only then enable the cron schedules.

## Task 6 — Launch prep

- Remove fixture items. Activate the full source list.
- Cloudflare Pages: build `bun run build`, output `dist/`, custom
  domain mcc.vesperio.ai.
- Populate signals.json (Florian, by hand).
- Apply the real palette (Florian supplies tokens).
- First week: read every sweep. Log lessons to SWEEP_MEMORY.md.

---

## Phase 2 — ai-tldr.dev parity (agreed with Florian, 2026-07-05)

Derived from a full first-hand UX audit of ai-tldr.dev (feed, detail
overlays, /log/, /stats/, /models/ to version-page depth, /influencers/,
Learn to article depth). Same rules: one task per PR, CLAUDE.md wins.
Frugal routing: policy text, decomposition, integration, and review stay
with the top model; bounded page builds go to cheaper agents gated on
`bun run build` + tests passing.

## Task 7 — /log/: public sweep changelog

- `/log/` route rendering `state.json` sweeps newest first: UTC
  timestamp, +added / ~updated / held counters as chips, the sweep
  summary sentence, coverage chips. Header carries aggregate counters
  (N sweeps, X added, Y updated, Z held). Add "log" to the site nav.
- update-items.yml: commit the state.json log entry on zero-activity
  sweeps too (rule 9 as amended in CLAUDE.md); feed content still never
  padded.

Accept when: /log/ prerenders with correct meta, renders the real sweep
history, and a zero-add sweep produces a log-only commit.

## Task 8 — Feed v2

- Tag tiers per CLAUDE.md (domain/modality/geography/theme), `eo` added
  to the seed set; sweep prompt requires a domain tag where applicable.
- Tags on cards (2-3, after category chip), prerendered `/tag/{tag}/`
  pages, counts on category and tag chips, domain views (EO,
  Connectivity, Launch) in the nav.
- Client-side search over the feed with a live "N / total" tally, "/"
  keyboard shortcut, and a mono empty state.
- Masonry feed layout (CSS columns); visited-card highlight on return;
  timestamps show time, not just date, where available.
- finalize-sweep logs newly coined tags in the sweep log entry.
- Presentation spec for non-confirmed items per CLAUDE.md: sourcing
  named in the headline, UNVERIFIED banner on card/item media,
  evidence block on the item page (who said it, on what basis, what
  would confirm or deny it and when, if stated).

Accept when: tag pages prerender, counts are correct at build time,
search filters live, and a signal-tier fixture renders with banner,
headline attribution, and evidence block.

## Task 9 — Stats v2

- Prose hero with inline bold figures over big-number tiles; UPDATED
  badge (exists).
- Question-titled blocks with a one-line answer pull-quote, methodology
  footnote, and CITE THIS expander producing a claim-sentence citation
  (quotable sentence + anchor URL + retrieval date). Keep /stats.json.
- New blocks: shipping velocity (items per week, trailing windows,
  momentum vs prior window), launch cadence per provider (avg days
  between launch items, min 3 items), impact mix, confidence mix.

Accept when: every block has anchor, question, answer line, method
line, and citation; zero data still renders zeros.

## Task 10 — Signals shell

- /signals/ in the influencers-page mould: role-grouped sections with
  per-section counts, platform chip, follower-scale badge (optional
  field), one-line why-follow, topic chips, header count line.
- signals.json schema extended accordingly (role, platform, followers
  band, topics); stays hand-curated, agent never edits, and doubles as
  the signal-tier whitelist.

Accept when: renders the extended schema; empty list still renders the
curation note.

## Task 11 — Registry v2

- Profiles become destination pages: on-page numbered TOC, sourced
  overview prose (per amended CLAUDE.md registry rules), spec table
  (exists), event history pulled from items.json mentions, lineage /
  variants table (vehicle families, constellation generations), FAQ
  block, aggregated source-links list, siblings row.
- Typed source labels site-wide: source links labelled by kind (press
  release, 8-K filing, FCC grant, webcast, API record, coverage).
- Type-adaptive quick-facts panel on item pages (launch items surface
  vehicle/orbit facts; financial items surface deal terms) where the
  drafting agent supplied them; never derived from memory.

Accept when: check-registry passes with the extended schema; five
random profiles spot-check against sources; every filled field still
carries source + as_of.

Deliberately skipped from the audit: 3D city, monetization widgets,
share/star buttons, ASK AI row (optional later), Learn (parked per
CLAUDE.md).

---

## Session rules for Claude Code

- Read CLAUDE.md at the start of every session.
- One task per PR. Do not bundle tasks.
- If a task needs something out of its scope, stop and ask; do not
  improvise scope.
- Never commit directly to main; PRs only, Florian merges.
- Model economy: mechanical slices (fixtures, boilerplate, test
  scaffolds) can go to cheaper subagents; schema design, finalize-sweep
  logic, and anything in Task 2's validation path stay with the top
  model. Final review of every diff stays with the orchestrator.

## Task 13 — Registry fill crawl (one-off, orchestrated)

Goal: fill the 92 profiles' null fields with sourced values in one
supervised research session, before launch. Frugal routing: cheap
agents collect candidate field values TO FILES (never into the
orchestrator's context), a verify pass checks each claim against its
single source, a deterministic merge script writes profiles, and
check-registry gates every batch. One PR per batch, orchestrator
reviews diffs, Florian spot-checks 5 fields per batch.

Batches, in order:
1. Ecosystem organizations (20, currently all-null): website, country,
   founded, focus, overview from each org's own site (about pages;
   institutions from official pages). 1-2 fetches per org.
2. Constellations: IoT/RF seeds (6), Planet children (4), and null
   fields on existing profiles. Bases: operator sites, Gunter's Space
   Page deep links (single-page facts only, exact URL, attribution
   renders automatically), Launch Library.
3. Spaceports (23): operator, status, website, first launch, overview.
   Bases: official spaceport/agency pages, Launch Library location
   records (mind the ~15 req/hr unauthenticated rate limit; bulk
   endpoints first).
4. Vehicles (light pass): last/next flight from Launch Library bulk
   queries; vehicle_class only where a source states a class.

Hard rules (unchanged, repeated because agents drift): one source per
field with as_of; numbers copied exactly or left null; no summing
across Gunter's pages; no estimates, no training-data recall; em
dashes normalized out of prose; polite user agents (SEC-style
etiquette everywhere); every fetched URL recorded.

Accept when: check-registry passes; each batch PR reviewed; Florian
spot-checks 5 filled fields per batch against sources; the registry
index shows meaningfully fewer "unknown" values.

---

## Sourcing note for registry crawls (Florian, 2026-07-05)

Wikipedia is allowed as DISCOVERY ONLY: use it to find that an event or
figure exists and to locate the primary source (usually the press
release, filing, or agency page its footnotes cite), then fetch and cite
that source. Wikipedia itself never appears in a `source` field; the
ladder in CLAUDE.md is unchanged. Gunter's Space Page remains citable
under the existing deep-link rules.

## Task 14 — Constellation fleet-count fields (Florian, 2026-07-05)

Replace the single `sats_on_orbit` with three SourcedFields:

- `sats_launched_total`: cumulative satellites launched for the
  constellation. Cumulative statements qualify ("has put 161 Jilin-1
  satellites into orbit across 30 launches" fits here, not in active
  counts).
- `sats_active_claimed`: the operator's stated current active/on-orbit
  count. Existing `sats_on_orbit` values migrate here unchanged
  (they are operator/Gunter's claims).
- `sats_active_verified`: count of tracked objects attributed to the
  constellation in CelesTrak data, computed by script from the Orbits
  element pipeline (Task: orbits PR1's celestrak_group/name_pattern
  mappings), source = the exact CelesTrak query URL, refreshed by the
  registry cron. Label the row's methodology on the profile page
  (tracked objects, not a claim about operational health).

Migration script + validate.ts + check-registry + facts-table UI in one
PR. SEQUENCE AFTER orbits PR1/PR2 merge: both touch schema.ts and the
constellation JSONs; doing this first would conflict.

Accept when: check-registry passes with the new fields; no old
sats_on_orbit key remains; at least the constellations with orbits
mappings show a verified count with a CelesTrak source URL.

## Task 15 — Operator history timelines (Florian, 2026-07-05)

For organizations, constellation operators, and launch providers: a
sourced event timeline (roughly the past 10 years, plus founding-era
anchors) rendered as a numbered timeline block on registry profile
pages. Example shape: Planet founded 2010, first Flock launch 2014,
RapidEye acquisition 2015, SkySat acquisition 2017, IPO 2021, first
Pelican launch 2023.

- Schema: `events: Array<{date, headline, source, as_of}>` where date
  may be YYYY, YYYY-MM, or YYYY-MM-DD (timeline dates are
  precision-flexible, unlike SourcedField date fields; render what the
  source states).
- Headlines: actor-first, plain declarative, max ~90 chars, no hype.
- Sourcing: primary sources per the ladder (company newsrooms, filings,
  agency pages, Gunter's deep links); Wikipedia as discovery only (see
  sourcing note above). Where only trade press records an event, the
  headline names the outlet ("per SpaceNews"), mirroring the news
  ladder's reported tier.
- Crawl runs batched per the Task 13 pattern (collectors to files,
  adversarial verify pass, deterministic merge, one PR per batch),
  starting with the highest-traffic profiles (Planet, SpaceX, Rocket
  Lab, ICEYE, Eutelsat/OneWeb, Airbus, Thales Alenia).

Accept when: check-registry validates the events array; profile pages
render the timeline; every event click-throughs to a source that states
it.

## Task 16 — Complete launch-provider vehicle rosters (Florian, 2026-07-05)

The `status: active` tag on vehicles is meaningless while the registry
only contains active vehicles. Two parts:

1. Add retired/historical orbital vehicles of tracked providers as
   registry entries (Falcon 1, Ariane 5, Vega, Antares, Delta IV Heavy,
   Atlas V, earlier Long March variants, H-IIA/B, PSLV predecessors as
   applicable). Seed from Launch Library config pages, which state a
   vehicle status ("Active"/"Retired") and are citable; enrich per the
   standard rules.
2. Provider/LSP profile pages list their full vehicle roster, active
   and retired, with status shown per vehicle.

Accept when: the tracked LSPs' rosters include their retired orbital
vehicles with sourced status; provider pages render the roster;
check-registry passes.

## Backlog noted 2026-07-06 (Florian)

Parked items, in his words, to be specced before work starts:

- **Stock ticker / chart styling.** The live tickers and daily stock
  charts on company profiles need a styling and UX pass. Not urgent.
- **News engine rework.** Revise the scraping / aggregator / news
  collection approach from a different angle: the current rules are
  too strict and are not helping the project. Needs a sit-down on
  what to relax and how, without giving up the no-overclaim promise.
- **Menu and taxonomy review.** Review the site menu structure and
  the tags / categories system together.
