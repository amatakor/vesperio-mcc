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
