# Execution Plan — Data Engine Overhaul (from audit 2026-07-08)

Source: `reports/2026-07-08-data-engine-audit.md` plus annexes in `reports/audit-2026-07-08/`. Read the main report before starting; read the relevant annex before each phase (pipeline-review.md for Phases 1-2, registry-audit.md for Phase 3, external-research.md for Phases 1 and 4).

This plan is designed for unattended execution. Florian has already made the decisions; do not re-open them. When a task hits a stop condition, record it in `EXECUTION_LOG.md` (create at repo root), skip the task, and continue with the next independent task. Never improvise around a stop condition.

## Step 0 — Sanity-check this plan against the live repo (do this first)

This plan was written from a local snapshot of the repo taken 2026-07-08 around 00:17 local time. The repo is under active development (scheduled sweeps commit continuously, PRs land daily), so before executing anything:

1. Sync to the latest `main` and check what has changed since the snapshot: recent commits, merged PRs, open PRs, and open issues (use `git log` and `gh pr list` / `gh issue list` if available).
2. For each phase and task in this plan, verify the premise still holds. Examples of what would invalidate a task: the fixture items were already removed, a harvester or feed-first source list already exists, the feedback-loop functions have since been wired in, the cron or SCHEDULED_SOURCES allowlist was already changed, registry entities on the backfill list were already added, or an open PR already covers the same ground.
3. Where a task is already done or superseded, skip it and record in `EXECUTION_LOG.md`: what the plan assumed, what you found instead, and why you skipped or adapted. Where a task partially overlaps with existing work, do only the missing part and say so in the PR description.
4. If something fundamental has changed (the audited findings in `reports/2026-07-08-data-engine-audit.md` no longer describe the codebase, or an open PR conflicts head-on with a whole phase), do not force the plan through. Execute the phases that are still valid, and write a short note at the top of `EXECUTION_LOG.md` telling Florian which parts of the plan need re-deciding and why, in plain language he can act on without reading code.

The decisions in the next section remain binding either way; Step 0 lets you adapt the HOW, never the WHAT.

## Decisions already taken (do not revisit)

1. **Commentary:** becomes a first-class item kind in the news feed, visibly tagged as commentary/hot take/subjective. Not a separate Signals-page stream.
2. **X access:** no paid API. Keep the free syndication-endpoint workaround. Expand Bluesky and YouTube channels instead. Do not write X API polling code.
3. **Impact tier:** tighten the `notable` bar via prompt/policy wording. No schema change, no 4th tier.
4. **Registry backfill:** full candidate list, verify-then-add. Every skipped candidate logged with a reason.

## Global rules (apply to every phase)

- **Branching:** each phase is one branch and one PR. Branch names: `audit/phase-1-fetch-layer`, `audit/phase-2-feedback-loop`, `audit/phase-3-registry`, `audit/phase-4-editorial`. Phases are independent of each other's merges; branch each from `main`. Open the PR at the end of the phase with a description listing what was done, what was skipped and why, and what Florian must check. **Do not merge any PR.** Florian reviews in the morning.
- **Gates:** `bun run build` (includes check-feed, check-registry, check-signals, check-orbits) and `bun test` must pass before every commit. A commit that breaks the build is worse than a skipped task.
- **Tests:** every newly wired code path gets a unit test. The existing pure functions in `scripts/snr/` already have tests; wiring them in must not change their test results.
- **Never touch:** `src/data/signals.json` (the curated list itself; adding channel entries to existing people is allowed in Phase 4 only as specified there), items.json history (edit only as specified in Phase 1 hygiene), the SNR math in `scripts/snr/score.ts` and `match.ts` (you wire callers, you do not change scoring semantics), `SWEEP_MEMORY.md` (append-only, and only if you learn something a future sweep needs).
- **House style:** no em dashes anywhere (code comments, prompts, UI copy, PR text). No border-radius, no transform hovers, mono type for structural elements. No marketing language.
- **Sourcing discipline:** every registry value must be stated by its cited page. No estimates, no summing, no memory. Numbers copied, not paraphrased.
- **Web fetching:** verify every feed URL with a real fetch before adding it to sources.json. `fcc.report` is banned until independently re-verified live (SWEEP_MEMORY documented it serving 2020-2023 filings as current). UCS satellite database is stale; never use it.
- If a task needs a secret, credential, or account that does not exist, stop condition: log and skip.

---

## Phase 1 — Hygiene + fetch layer (branch `audit/phase-1-fetch-layer`)

### 1.1 Hygiene
- Delete `_audit_analysis.py` (repo root, empty, audit artifact).
- Remove the three `example.com` fixture items from `src/data/items.json` (ids contain `fixture`). If any test or script references them, move the fixtures into a test fixtures file under `scripts/__tests__/` and update references.
- Verify: build green, no `example.com` URLs remain in items.json.

### 1.2 Feed verification pass
- For every candidate feed in `reports/audit-2026-07-08/external-research.md` section 1 (trade press, wires, ESA, Federal Register, SEC EDGAR per tracked ticker) plus every existing sources.json entry: fetch it, record HTTP status, whether it parses as RSS/Atom/JSON, and the date of the newest entry.
- Output: `reports/audit-2026-07-08/feed-verification.md` with one row per feed (URL, status, format, newest-entry date, verdict).
- A feed is usable only if it returns 200, parses, and its newest entry is less than 30 days old (guards against stale mirrors).
- Stop condition per feed: two failed attempts, mark unusable, move on.

### 1.3 sources.json feed-first conversion
- Add every usable feed from 1.2 as a source with `feed_type` reflecting reality (rss_atom / api_json).
- Fix the stale URLs already documented in SWEEP_MEMORY (ULA, Isar, Stoke, Arianespace, NOAA CRSRA, EUSPA, NGA newsroom paths).
- Mark JS-shell-only sources (spacex.com, starlink.com, ghgsat.com, he360.com, and any others SWEEP_MEMORY names) with a new `fetch_note` field explaining they are unreachable without JS rendering, and set them so the harvester skips them. Do not delete them.
- Verify: check-feed passes; every source has a valid status; no source points at a URL that failed verification in 1.2.

### 1.4 Deterministic harvester
- New file `scripts/harvest.ts` (bun, no LLM, no external deps beyond what package.json already has unless strictly necessary):
  - Reads sources.json, fetches every source whose feed_type is rss_atom or api_json and status is verified/unverified.
  - Normalizes entries to a queue file `src/data/candidates.json`: `{id (hash of url), source_name, url, title, published_at, raw_excerpt (verbatim, untruncated up to ~2000 chars), fetched_at}`.
  - Deduplicates queue entries by URL hash; keeps entries newer than the last sweep timestamp in state.json minus 48h; drops older.
  - Writes per-source health results (HTTP status, entry count, newest date) into the existing sourceHealth conventions: on success flip unverified to verified, count consecutive failures in a new persisted `fail_count` field, flip to dead at 3 (this moves failure counting from agent memory into code, matching CLAUDE.md's stated behavior).
  - Exit non-zero only on catastrophic failure (cannot write queue); individual source failures are logged, not fatal.
- Unit tests: normalization from a fixture RSS payload, dedup, fail-count transitions.
- Wire into `.github/workflows/update-items.yml` as a step BEFORE the agent runs, so the sweep agent consumes `src/data/candidates.json` first and only fetches directly for HTML-only sources and corroboration.
- Update `prompts/update-items.md`: discovery step now reads the candidate queue first; direct WebFetch discovery only for HTML-only sources; verbatim numbers must come from `raw_excerpt` or a direct fetch of the source page, never from WebFetch summaries.
- Verify: run `bun scripts/harvest.ts` live once; queue populates; build green.

### 1.5 Widen the throttles
- In `update-items.yml`: remove the 14-source `SCHEDULED_SOURCES` allowlist fallback so scheduled runs use the full source list (keep the `source_filter` workflow_dispatch input for manual runs).
- Switch the cron from hourly `17 * * * *` to the intended `0 5,17 * * *` twice daily, per the workflow's own comment.
- Update the sweep-window logic/prompt so each run covers the full gap since the last sweep.
- Verify: YAML valid, comments updated to reflect the new state.

---

## Phase 2 — Feedback loop wiring (branch `audit/phase-2-feedback-loop`)

This phase touches the scoring path. Highest review bar: keep diffs minimal, wire existing tested functions, change no scoring semantics. PR description must include before/after examples.

### 2.1 Claim resolution job
- New `scripts/resolve-claims.ts` (bun): for each `unresolved` claim in source_ledger.json older than 14 days, check resolution deterministically where possible: the item's current SNR and snr_trace (corroboration arrived later, dispute recorded, item updated) decide confirmed/debunked; claims with no signal either way past 90 days expire. Call the existing `resolveClaim()`; never hand-write ledger state.
- Where resolution genuinely needs judgment (contradiction vs metric mismatch), do NOT guess: leave unresolved and list it in the job's output for the weekly registry agent (or Florian) to adjudicate.
- Add to `maintain-registry.yml` (weekly cadence is fine) as a step, or a small separate workflow if cleaner.
- Unit tests for the resolution decision rules.

### 2.2 Ledger demotion live
- In the finalize path, resolve each draft source's class through `effectiveClass()` before `scoreClaim()` (this makes CLAUDE.md's "a ledger demotion lowers a trade source to informal" true).
- Strikes/credits: emit ledger events from the places SNR_SPEC defines them (same-metric contradiction loss = strike; SNR 1-2 claim later confirmed = credit) inside resolve-claims/finalize as applicable.
- Tests: a demoted source scores at demoted tier; an undemoted source is untouched; existing snr tests unchanged.

### 2.3 Promotion + calibration surfaced
- After resolution runs, call `promotionCandidates()` and write qualifying entries to `signals_suggestions.json` (agent never edits signals.json itself).
- Render `calibration()` output on the /log page (score-at-publication vs resolution, per the product promise). Keep the UI addition minimal and in house style.

### 2.4 Dedup as code
- Call `matchDecision()` from finalize-sweep to validate the agent's known-to-MCC decisions: if the draft says "new" but matchDecision finds a same-event match inside 7 days (same company + category), reject the draft with a clear error (same pattern as the existing corroboration gate).
- Tests included.

---

## Phase 3 — Registry crossfeed, enrichment, backfill (branch `audit/phase-3-registry`)

### 3.1 Crossfeed as code
- finalize-sweep: after stamping items, extract like-for-like facts (SNR ≥ 3) whose metric maps to a registry field, run them through the existing `reconcile()`, and write outcomes to a new queue `src/data/registry-candidates.json` (annotations, accepted null-fills, conflicts for held.json per spec).
- `maintain-registry.yml` prompt: consume the queue as the first step; every consumed entry either lands (with the news item's URL as `source`), is rejected with a reason, or is queued for Florian. Queue entries are removed only when consumed.
- Gate: a sweep that produced scoreable registry-relevant facts but wrote no queue entries fails finalize (mirrors the corroboration-skip gate).

### 3.2 Deterministic enrichment jobs
- New `scripts/enrich-registry.ts`: fills ONLY null fields (never overwrites) from:
  - Launch Library 2: `next_flight_date`, `flights_total`, `flights_successful`, `first/last_flight_date` for vehicles; launch counts for spaceports. Aggregator tier, SNR 4 canonical, deep-link URL per field.
  - CelesTrak: `sats_active_verified` (computed tier; compute-fleet-counts.ts may already cover part of this; extend, do not duplicate).
  - GCAT (planet4589.org, CC-BY): `founded`, historical first/last launch dates, org/site history. Attribution string exactly: "data from GCAT (J. McDowell, planet4589.org/space/gcat)". Add visible attribution wherever GCAT fields render.
- Respect rate limits: Space-Track 30/min if used; CelesTrak polled once per run; LL2 modest paging. Every field gets `source` + `as_of`.
- Wire into maintain-registry.yml before the agent step. Tests on the merge logic (null-fill only).

### 3.3 Null-fill pass on existing 139 profiles
- Run enrichment live. Then a bounded agent pass for the remaining top gaps listed in `reports/audit-2026-07-08/registry-audit.md` section 2 (constellation `sats_launched_total`, `sats_active_claimed`, `sensor_types`, `status`; spaceport `website`, `first_launch_date`), using the registry sourcing rules (primary > aggregator > Wikipedia/press; SNR 3 single-press fields marked provisional; that tier currently has zero uses, use it where honest).
- Fix the near-stub profiles flagged in the annex, starting with "Crewed vehicles" (1/14 fields).

### 3.4 Entity backfill (verify-then-add, full list)
- Candidates (from registry-audit.md section 5, model-knowledge, so each MUST be verified against live sources before adding): Boeing, Axiom Space, Sierra Space, JAXA, Voyager Space, Vast, Relativity Space (org + Terran R), Lockheed Martin Space, L3Harris, Redwire; Iridium, Globalstar, Guowang, Qianfan; LandSpace (+ Zhuque-2), Galactic Energy (+ Ceres-1), Space Pioneer (+ Tianlong), OrienSpace (+ Gravity-1), iSpace; Skyroot (+ Vikram-1), Agnikul (+ Agnibaan); Nuri (KSLV-II), Long March 3B, Long March 7; EarthDaily, Axelspace, Wyvern, Orbital Sidekick, Albedo, SI Imaging Services; Naro Space Center, Pacific Spaceport Complex Alaska, Alcantara, Hainan commercial spaceport.
- Per candidate: confirm the entity exists, is in scope per CLAUDE.md, and has at least a first-party or aggregator source for its core fields. Add with the standard profile shape. If verification fails or scope is doubtful, skip and log the reason in EXECUTION_LOG.md. Structural note: this plan constitutes Florian's explicit instruction for these entries; the PR is his review.
- Verify: check-registry green; every new field sourced and dated.

---

## Phase 4 — Editorial: commentary, discovery, signals channels (branch `audit/phase-4-editorial`)

### 4.1 Commentary item kind
- Schema: add `kind: "event" | "commentary"` to items (default `event`, migration touches no existing item content beyond adding the field via script in `scripts/migrations/`).
- Commentary rules, encode in schema comments + prompts + CLAUDE.md draft edit:
  - Source must be a signals.json whitelisted person or a named outlet/author; anonymous takes never publish.
  - The take is quoted or tightly paraphrased with attribution in the tagline; `what_happened` states who said what where; `why_it_matters` may engage with the argument.
  - SNR scores the attribution ("this person said this"), not the opinion's truth. Whitelist floors apply as observers. Commentary never feeds the registry and never triggers reinforcement of factual items.
  - Impact for commentary caps at `notable`.
- UI: visible tag/badge on cards and item pages reading `commentary` (mono, house style, clearly distinct from category). Filtered feed page per kind if trivial with the existing category-page machinery.
- check-feed validates the new field. Prompts updated (update-items.md: the signals pass and discovery may now yield commentary items).
- CLAUDE.md edit: add commentary to the item format and writing-style sections. Mark the diff clearly in the PR; this is the one policy file change, and Florian reviews it word by word.

### 4.2 Discovery pass in the sweep
- Add to prompts/update-items.md: after the candidate queue, run 3-5 WebSearch discovery queries per sweep across scope categories, rotating (EO/connectivity/IoT/launch/regulatory/financial; China/India/Japan terms included). Candidates found off-list follow the normal pipeline; their sources get added to sources.json as unverified for future harvesting.
- Explicitly restate in the prompt: publishing an early signal at SNR 1-2 with honest scoring is the model working. The gate is attribution, not confidence.

### 4.3 Tighten `notable`
- Rewrite the impact guidance in CLAUDE.md and prompts: notable requires that a commercial director at an operator/reseller would plausibly act or brief on it (contract awards with numbers, funding, regulatory grants, constellation-scale changes). Routine product updates, minor partnerships, and scheduled successes default to noise. Add 3 concrete examples per tier. No schema change.

### 4.4 Signals channels: Bluesky + YouTube
- Add `youtube` to the channel types in `scripts/lib/signals.ts` FETCHABLE set, fetched via `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>` (keyless).
- For each of the 44 signals people: search for a Bluesky account and a YouTube channel. Add a channel entry ONLY when identity is certain (linked from their known site/X profile, or verified handle). Uncertain matches are logged, not added. This is the one permitted edit to signals.json: appending channel entries to existing people. No people added, removed, or reordered.
- Harvester (Phase 1) picks up bluesky/youtube channels if trivially compatible; otherwise the signals pass fetches them per sweep.

---

## Completion checklist (write results into EXECUTION_LOG.md)

- [ ] 4 PRs open, none merged, each with build+tests green and a review summary for Florian
- [ ] feed-verification.md written; every sources.json entry points at a verified-live URL or is marked unfetchable
- [ ] harvest.ts runs live and populates candidates.json
- [ ] resolve-claims runs live once on the real ledger (on its branch) and its output is in the PR description
- [ ] enrichment runs live once; count of fields filled reported
- [ ] Entity backfill: added / skipped counts with reasons
- [ ] Any stop conditions hit, listed with context
