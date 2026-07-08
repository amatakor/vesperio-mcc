# EXECUTION_LOG — Data Engine Overhaul run of 2026-07-08

Executor: Claude (unattended session). Plan: EXECUTION_PLAN.md. Audit: reports/2026-07-08-data-engine-audit.md.

## Step 0 — Sanity check against live repo (2026-07-08)

Synced `main` (already up to date). No open PRs, no open issues. Commits since the plan snapshot are design/UI PRs (#90-#98), scheduled ingest sweeps, and orbits/stocks refreshes; none overlap the plan.

Premises verified against the live tree, all still hold:

- `_audit_analysis.py` exists at repo root (empty, untracked).
- The three `example.com` fixture items are still in `src/data/items.json` (9 example.com URLs).
- No `scripts/harvest.ts`, no `src/data/candidates.json`, no `src/data/registry-candidates.json`.
- `update-items.yml` still has the 14-source `SCHEDULED_SOURCES` allowlist and the hourly `17 * * * *` cron.
- The feedback-loop functions (`reconcile`, `resolveClaim`, `calibration`, `promotionCandidates`, `effectiveClass`, `matchDecision`) still have zero call sites outside `scripts/snr/` and tests.
- Items have no `kind` field; `youtube` is not in `FETCHABLE_CHANNEL_TYPES` (`scripts/lib/signals.ts`).

Conclusion: the audited findings still describe the codebase. All four phases proceed as planned.

Operational note: the local working tree on `main` has uncommitted changes in `src/orbits/` and `.claude/launch.json` (someone's work in progress, unrelated to this plan). Each phase branch is built in an isolated git worktree from `origin/main` so those changes are never touched or committed.

## Completion checklist (2026-07-08, end of run)

- [x] 4 PRs open, none merged, each with build+tests green and a review summary: #99 (Phase 1), #100 (Phase 2), #102 (Phase 3), #101 (Phase 4)
- [x] feed-verification.md written (116 rows; committed in #99 and copied beside the annexes here); every sources.json entry points at a live-verified URL or carries a fetch_note
- [x] harvest.ts ran live: 40/40 feed sources OK, 75 candidates queued from 21 distinct sources
- [x] resolve-claims ran live on the real ledger: 26 claims examined, 0 resolved (all real claims are under the 14-day maturity bar; output in #100)
- [x] enrichment ran live: GCAT leg clean (0 fills, honest: no exact name matches for the 5 null-founded orgs); LL2 leg blocked by HTTP 429 the whole session (our own research agents consumed the shared hourly budget); first clean fill lands on the weekly CI runner. Fields filled by the delegated gap-fill pass instead: 30
- [x] Entity backfill: 42 added, 1 skipped (Hyperbola-1, verified but not on the authorized list), per-field skips logged in #102
- [x] Stop conditions listed (per phase above; none blocked a phase)

## Stop conditions hit

(recorded as they occur; see also per-phase sections)

## Phase 1 — hygiene + fetch layer

DONE. PR #99 (audit/phase-1-fetch-layer), build + 203 tests green, not merged.

- 1.1: fixture items removed (no references anywhere); _audit_analysis.py was untracked, deleted locally without a commit.
- 1.2: 116 URLs verified; report at reports/audit-2026-07-08/feed-verification.md (committed in the PR and copied here). Feed discovery delegated to a sonnet agent; all its finds re-verified deterministically.
- 1.3: sources.json now 86 sources; 20 new feed sources; every stale SWEEP_MEMORY URL fixed after live checks; new fetch_note field marks the 9 unfetchable sources plus the banned fcc.report mirror.
- 1.4: scripts/harvest.ts + 27 tests; live run 40/40 sources OK, 75 candidates queued; workflow + prompt wired queue-first.
- 1.5: allowlist retired, cron 0 5,17 * * *, full-gap window.
- Stop conditions hit (logged per feed in the report): Business Wire (403 WAF), PR Newswire (Cloudflare reset), fcc.gov (blocked env), The Space Review / ISRO / NextSpaceflight / 9 IR feeds (no feed found). None blocked the phase.
- Judgment call for review: ESA Telecom, RFA, Telesat feeds parse but fail the 30-day freshness rule; left as noted exclusions rather than bending the rule.

## Phase 2 — feedback loop wiring

DONE. PR #100 (audit/phase-2-feedback-loop), build + 201 tests green (176 pre-existing unchanged), not merged.

- 2.1: scripts/resolve-claims.ts + 16 tests; wired as a pre-agent step in maintain-registry.yml. Live run on the real ledger: 26 claims examined, 0 resolved, correct because all real claims are 1-2 days old (14-day maturity bar). New "expired" resolution value in schema.
- 2.2: effectiveClass() resolves every attested class before scoring (new items, attaches, rescores); strikes/credits emitted by resolve-claims per SNR_PLAN A4.
- 2.3: promotionCandidates() writes signals_suggestions.json after resolution; /log renders calibration() (verified in the prerender output).
- 2.4: matchDecision() gate in finalize-sweep; same-event matches reject unless the draft attests dedup_distinct: [{ id, reason }] per matched item. Design call for Florian: the attestation escape hatch exists because distinct events legally share company+category inside 7 days (Starlink cadence).
- No stop conditions hit.

## Phase 3 — registry

Committed on audit/phase-3-registry; PR opens after one more LL2 enrichment retry (below).

- 3.1: crossfeed as code via a per-item attested `crossfeed` block; reconcile() computes outcomes into src/data/registry-candidates.json; dispute downgrades and tie-queues wired through scoreClaim/held; gate mirrors the corroboration gate. 16 tests.
- 3.2: scripts/enrich-registry.ts (LL2 bulk queries + GCAT orgs, null-fill only, 10 tests); GCAT CC-BY attribution renders on profile pages; wired pre-agent into maintain-registry.yml.
- 3.3: gap-fill pass landed 30 fields across existing profiles (3 delegated research agents; every value re-checked as literally stated; every skip logged in the agents' reports, preserved in the scratchpad and summarized in the PR). crewed-vehicles stub documented as an intentional Orbits grouping rather than fake-filled. GCAT founded matches: none (the 5 null-founded orgs are division-style names GCAT does not carry). LL2 leg: rate-limited (HTTP 429) all afternoon because the research agents consumed the shared hourly budget; the script degrades gracefully and will fill on the weekly cron; one more manual retry before the PR.
- 3.4: 42 new profiles added (all four types), verify-then-add via 6 delegated batches; every field literally stated by its cited page; SNR stamping deterministic (aggregator 4 canonical, single-press 3 provisional (first uses of the provisional tier), Wikipedia/first-party unscored). Skipped: Hyperbola-1 (verified but not on the authorized candidate list; suggested as a future addition). Iridium/Globalstar etc. got ticker fields but NOT stock_symbol (enabling the stocks cron for them is Florian's call).
- Note for Florian: one gap-fill agent (connectivity/IoT) edited the main working tree directly instead of reporting; its edits were reverted and re-applied cleanly in the branch from its report. No data was lost or double-applied.
- Skips of note from the research (full lists in the PR): OneWeb counts (only stale 2023 figures stated anywhere), Kuiper total ("375+" never a bare number), AST SpaceMobile totals (no stated cumulative), Spire ("more than 140" is a floor, not a number), fleet parents (Airbus EO, BlackSky, WorldView legacy: no stated fleet-level figures), jilin-1-early (two sources state conflicting scopes, flagged not picked).

## Phase 4 — editorial

Committed on audit/phase-4-editorial; PR opens after the signals-channel research lands.

- 4.1: kind event|commentary shipped end to end (schema, migration on 48 items, finalize default + seismic-commentary rejection, badge, /kind/commentary/ page, prompts, CLAUDE.md policy edit flagged for word-by-word review).
- 4.2: discovery pass added to the sweep prompt (3-5 rotating WebSearch queries, off-list sources feed sources.json as unverified).
- 4.3: notable bar rewritten around "a commercial director would act or brief", 3 examples per tier, in CLAUDE.md and the prompt.
- 4.4: youtube added to FETCHABLE_CHANNEL_TYPES (fetched via keyless per-channel RSS; requires the rss field). Bluesky/YouTube handle research delegated to 3 agents with a hard identity bar (linked-from-known-property or verified domain; name matches rejected). Note: the harvester (Phase 1) reads sources.json only; bluesky/youtube signal channels are NOT trivially compatible and stay with the per-sweep signals pass, as the plan anticipated.

## Phase 4 — editorial

(pending)
