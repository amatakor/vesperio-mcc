# MCC ingestion pipeline — as-implemented architecture review

Scope: `.github/workflows/`, `prompts/`, `scripts/crawl/`, `scripts/snr/`,
`scripts/finalize-sweep.ts`, `scripts/sweep-context.ts`,
`scripts/signals-context.ts`, `scripts/review-queue.ts`,
`scripts/compute-fleet-counts.ts`, `scripts/lib/`, plus `SNR_SPEC.md` /
`SNR_PLAN.md` as the scoring contract and CLAUDE.md as the claimed
behavior. Read-only audit; nothing in the repo was modified.

---

## 1. End-to-end flow (as implemented)

```
GitHub Actions cron (code)
  update-items.yml: "17 * * * *" (HOURLY, temporary tuning mode —
    comment says restore to "0 5,17 * * *" twice-daily at launch)
  maintain-registry.yml: "0 6 * * 1" (weekly)
  update-orbits.yml: "30 4,16 * * *" (every 12h, fully deterministic,
    no agent)
  update-stocks.yml: daily 22:30 UTC weekdays, deterministic
        |
        v
claude-code-action invokes a Claude agent (LLM-prompt-driven)
  reads CLAUDE.md + SWEEP_MEMORY.md + prompts/update-items.md
  allowedTools: Bash(bun:*), Bash(curl:*), Read, Write, Edit,
    WebFetch, WebSearch  <-- no dedicated crawler binary; the LLM's
    own WebFetch/WebSearch/curl calls ARE the fetcher
        |
        v
1. bun scripts/sweep-context.ts (code)         -> { lastSweep, existing[] }
2. Discovery: agent walks src/data/sources.json entries matching the
   run's source_filter (LLM fetches each via WebFetch/curl)         (LLM)
   Scheduled runs use env.SCHEDULED_SOURCES, a HARD-CODED 14-source
   subset of the 66 registered sources ("soft launch... cautious
   source set"), not the full list.
2b. Signals pass: bun scripts/signals-context.ts (code) -> fetchable[]
   (mandatory, curl/WebFetch-able channels) + xSearch[] (best-effort,
   WebSearch only). Budget: 15 fetches/sweep.               (LLM+code gate)
        |
        v
3. Known-to-MCC dedup match (LLM judgment; date-window arithmetic is
   code in scripts/snr/match.ts::matchDecision, NOT called from
   finalize-sweep — the agent applies the 7-day/30-day rule itself
   in prose; matchDecision/daysBetween exist only as helpers
   finalize-sweep re-imports for its own persistence-bump pass)  (LLM)
        |
        v
4. Corroboration crawl (LLM: WebSearch + fetch). Budget: 5
   fetches/event, 40/sweep (schema.ts constants). Enforcement of the
   budget-honesty rule ("not_attempted only legal past 8-event cap")
   IS code, inside finalize-sweep.                        (LLM + code gate)
        |
        v
5. Registry crossfeed check — 100% prose (prompts step 5). No code
   path calls scripts/snr/reconcile.ts from any script; it is a
   dead/unwired pure function (see §4).                          (LLM)
        |
        v
6. Source classification (LLM judgment) -> sweep-draft.json at
   repo root                                                     (LLM)
        |
        v
7. bun scripts/finalize-sweep.ts (code, the ONLY writer of
   items.json / held.json / state.json / sources.json /
   source_ledger.json):
   - schema/shape validation, anti-spoof domain check
   - scoreClaim() (scripts/snr/score.ts) computes snr + snr_trace
   - applies update bumps / rescores (scripts/snr/match.ts::applyModifier)
   - automatic 14-day persistence pass over ALL items every run
   - records a ledger claim per new item (scripts/snr/ledger.ts::recordClaim)
   - writes all 5 data files atomically-ish, deletes the draft
   - REJECTS (exit 1, nothing written) on any violation           (code)
        |
        v
8. Workflow step: fails the job if state.json wasn't touched (every
   run, incl. zero-add, must log a sweep entry)                  (code)
9. bun scripts/fetch-thumbs.ts (og:image/stock-image harvest)     (code)
10. bun run build (typecheck + check:feed + check:registry +
    check:signals + check:orbits + vite build + prerender)       (code)
11. git commit "ingest: N new, M updated, K held (...)"; rebase +
    push (concurrency group "data-writes" serializes with the other
    3 workflows)                                                 (code)
```

Budgets/limits and where they live:
- `SCHEDULED_SOURCES` env var in `update-items.yml` — 14 named sources
  hard-coded in the workflow YAML, overridable via `workflow_dispatch`
  input only.
- `CORROBORATION_FETCHES_PER_EVENT = 5`, `CORROBORATION_FETCHES_PER_SWEEP
  = 40` — `src/data/schema.ts`, enforced by `finalize-sweep.ts`
  (`crawlCapacity = floor(40/5) = 8` events/sweep may legally skip
  crawl beyond that).
- Signals pass fetch budget: 15/sweep — stated only in
  `prompts/update-items.md` prose, NOT a schema constant, NOT enforced
  numerically by finalize-sweep (finalize only checks that `checked`
  URLs are real fetchable channels and that a note exists, not a
  15-fetch ceiling).
- `PERSISTENCE_DAYS = 14`, `DEDUP_WINDOW_DAYS = 7`,
  `REINFORCEMENT_WINDOW_DAYS = 30`, `REINFORCEMENT_MAX_SNR = 2` —
  `src/data/schema.ts`.
- `LEDGER_WINDOW_DAYS = 90`, demotion/recovery/promotion thresholds —
  `src/data/schema.ts`, but see §4: most of the ledger logic they
  gate is unwired.
- GitHub Actions job timeouts: 45 min (news sweep), 30 min (registry),
  20 min (orbits) — workflow YAML `timeout-minutes`.

---

## 2. Source fetching

There is no dedicated fetcher script/library for news ingestion.
`scripts/crawl/` contains only `merge-events.ts` and `merge-fields.ts`
— deterministic *mergers* for a one-off, already-completed registry
backfill batch (per `prompts/crawl/README.md`, "the pipeline that
filled the registry on 2026-07-05/06"), not a general crawler and not
invoked by any scheduled workflow. Discovery, corroboration, and the
signals pass are all done by the Claude Code agent's own tool calls
(`WebFetch`, `WebSearch`, `Bash(curl:*)`) during the sweep — the
"crawler" is the LLM's browsing behavior, not a program.

- `src/data/sources.json`: 66 sources across categories (eo_operators,
  launch_providers, launch_tracking, SEC EDGAR feeds, etc.), mostly
  plain HTML newsroom/press pages, a few IR RSS feeds
  (investors.planet.com/rss, ir.blacksky.com/rss). Status field:
  48 verified, 17 unverified, 1 dead (as of this snapshot; spacex.com
  is the dead one).
- No JS rendering. SWEEP_MEMORY.md documents repeated failures where
  WebFetch/curl return an unrendered Angular/React "Loading" shell
  (spacex.com/updates, starlink.com) or a Cloudflare "Just a moment…"
  challenge (individual Rocket Lab article pages, europeanspaceflight
  Substack feed, others) — both tools hit the same wall since neither
  executes JS.
- WebFetch does not return raw HTML: SWEEP_MEMORY 2026-07-05-Q records
  that "WebFetch returns summarized page text; 'verbatim' quotes
  drawn from it can be paraphrase" — a documented tension with
  CLAUDE.md rule 3 ("Numbers are copied, not paraphrased"), worked
  around only by discipline (agents told to re-check quote fields
  against the live page), not by tooling.
- On fetch failure: sourceHealth entries in the draft flip a source
  `unverified -> verified` on first success, `-> dead` after 3
  consecutive failures (per CLAUDE.md/prompt). This bookkeeping is
  agent-attested prose fed into `finalize-sweep`'s `sourceHealth`
  validation, not detected by code (the agent has to remember to
  count failures itself; there's no persisted fail counter the code
  increments automatically beyond accepting whatever `fail_count` the
  draft supplies).
- Social/newsletter sources: X/Twitter is explicitly NOT part of the
  "fetchable" (enforced) leg — `scripts/lib/signals.ts` hard-excludes
  type `"x"` from `FETCHABLE_CHANNEL_TYPES` ("X is deliberately
  excluded: it is login-walled to our fetch tools"). X posts are only
  retrievable best-effort via `WebSearch` to find a status URL, then
  the public syndication endpoint
  `cdn.syndication.twimg.com/tweet-result?id=<id>&token=a` for exact
  text — unenforced, uncounted against any hard budget beyond the
  prose "15 fetches/sweep, xAttempted" self-report. Substack/Beehiiv/
  Bluesky/plain sites ARE in the enforced fetchable set (their RSS or
  page is curl/WebFetch-reachable). No YouTube channel type exists in
  the schema at all — YouTube is simply not modeled as a signal source.

---

## 3. The SNR engine

`scripts/snr/score.ts::scoreClaim` is a pure function; inputs it needs
from the agent (via the draft's `scoring` block):
`sources[] {url, outlet, class, via}`, `extraordinary: boolean`,
`crawl: "found_none"|"found_some"|"not_attempted"`,
`whitelist: "self"|"observer"|null`. `reinforced`, `persisted`,
`disputeDowngrade` are supplied by finalize-sweep itself (not the
agent) for the update/persistence code paths.

Code logic (matches SNR_PLAN.md §B closely — no material mismatch
found in the base/modifier math):
- Base tier by class: `first_party/official_record/computed = 5`,
  `wire_pr/aggregator = 4`, `trade/mainstream/whitelist = 3`,
  `informal = 1`.
- Order of modifiers: extraordinary reset to 1 -> +1 at ≥2 distinct
  sources -> +1 at ≥4 distinct sources -> +1 mainstream pickup
  (non-lead mainstream source) -> −1 `corroboration_none` (only if
  crawl ran AND base tier < 5 — the "direct source proves its own
  statement" carve-out) -> +1 reinforcement -> +1 persistence (never
  above 4) -> −1 dispute -> whitelist floor applied last (4 observer,
  5 self, the only modifier allowed to cross the ceiling).
- **Direct-source ceiling**: all upward modifiers clamp to 4 unless
  `baseTier >= 5`; codified as `climbCeiling` / `up()` in score.ts and
  again independently in `match.ts::applyModifier`'s `ceiling` logic
  for the update/rescore/persistence path — i.e. the ceiling rule is
  implemented twice, in two files, with separate logic (risk: the two
  could drift if one is edited without the other; today they agree).
- Anti-spoof: `isOfficialHost()` in finalize-sweep.ts checks
  first_party/official_record hosts against a fixed list
  (sec.gov, fcc.gov, sam.gov, ted.europa.eu, esa.int, nasa.gov,
  noaa.gov, itu.int, unoosa.org, europa.eu, any `*.gov`) plus hosts
  scraped live from every registry profile's `website` field
  (`loadRegistryHosts`); `computed` class is restricted to
  celestrak.org / space-track.org / thespacedevs.com. This matches
  SNR_PLAN §B1.
- Seismic + SNR ≤2 auto-queue: implemented (`autoHeld` push in
  finalize-sweep when `stamped.impact === "seismic" && stamped.snr <=
  2`), matches SNR_PLAN §7.4/A6.
- 14-day persistence: implemented as a pass over **all** items on
  **every** sweep run (not just weekly registry maintenance), matches
  A1, using `daysBetween(publishedOn, today) >= PERSISTENCE_DAYS`.

**Mismatch/gap vs spec**: the ledger's demotion mechanism
(`effectiveClass`/`demotionInEffect` in `scripts/snr/ledger.ts`) is
never called from `scoreClaim` or `finalize-sweep`. CLAUDE.md states
flatly "A ledger demotion lowers a trade source to informal" as part
of the base-tier mechanic — in the actual code path, base tier comes
straight from the agent-attested class with **no** ledger lookup at
all. See §4 for the fuller picture; this is the single clearest
spec-vs-code divergence found.

---

## 4. Registry crossfeed and signals promotion

**Registry crossfeed (news facts -> registry)**: no code path exists.
`scripts/snr/reconcile.ts::reconcile()` implements the metric-mismatch
/ same-metric-contradiction rules from SNR_SPEC §6 correctly as a pure
function, but `grep` across the whole repo shows it is called from
nowhere except its own test file. Step 5 of `prompts/update-items.md`
("Registry crossfeed check") is entirely prose: the agent is asked to
compare like-for-like by memory/judgment and hand-write a `held.json`
entry for genuine conflicts. There is no gate that would catch an
agent skipping this step, and no automated mechanism that ever writes
a registry fact from a scored news item — registry updates only ever
come from the separate weekly `maintain-registry.yml` agent run,
which is instructed to pull from "a published item in items.json" as
one of several allowed bases, again by prose, not by any crossfeed
script.

**Signals promotion (source -> signals_suggestions.json)**: same
pattern. `scripts/snr/ledger.ts::promotionCandidates()` correctly
implements the A5 thresholds (≥5 distinct claims resolved "confirmed"
spanning ≥30 days, zero strikes in window) as a pure function, but it
is never invoked outside tests. `src/data/signals_suggestions.json`
exists (schema-validated by `check-feed.ts`) but ships empty
(`"suggestions": []`) and nothing populates it automatically — the
sweep prompt tells the agent to write entries there "ONLY when they
meet the SNR_PLAN A5 thresholds," meaning an LLM has to manually
recompute a 30-day/5-claim/zero-strike window from `source_ledger.json`
by hand each sweep, with no code checking whether it did so correctly
or completely.

**The deeper gap underneath both**: `scripts/snr/ledger.ts::
resolveClaim()` — the function that would ever mark a recorded claim
`confirmed` or `debunked` — is also never called in production code.
`finalize-sweep.ts` only ever calls `recordClaim` (append a new
`unresolved` claim). Nothing in the repo ever transitions a claim out
of `unresolved`. Consequences:
- `promotionCandidates()` can never return anything (it filters on
  `resolution === "confirmed"`), even if someone wired it up, because
  no claim is ever resolved.
- `calibration()` (the SNR_PLAN A4 "of claims published at SNR 2, N%
  were later confirmed" report) has no real data to report on —
  every claim in `source_ledger.json` is permanently `unresolved`.
- The ledger's demotion/recovery math (`demotionInEffect`,
  `recoveryEligible`) is reachable in principle from `netStrikes`/
  `netCredits` over recorded events, but since nothing ever writes a
  `strike` or `credit` event either (only `recordClaim`, never an
  event-appending call), `windowEvents` is always empty and
  `demotionInEffect` can never return true.

Net: the entire "feedback loop" layer (SNR_SPEC §7.1/§7.2 — ledger
demotion, calibration reporting, promotion suggestions) is fully
scaffolded (types, pure functions, unit tests, schema, an empty JSON
store) but **not wired into any executable path**. It is dead code
sitting behind live infrastructure, not a mismatch of intent so much
as an unfinished build slice (SNR_PLAN.md §D lists "Master crawler"
as slice 4 and describes ledger upkeep as part of it, but the actual
crawler prompt never invokes it).

---

## 5. Cadence and cost controls

- News sweep: **hourly** right now (`17 * * * *`), explicitly marked
  TEMPORARY in the workflow's own header comment for "gather
  scoring/signals data for engine tuning," with instructions to
  revert to twice-daily (`0 5,17 * * *`) at launch. As of this
  snapshot it has not been reverted — `state.json` shows 29 logged
  sweeps in roughly the last day+, most only 1.5–5 hours apart.
- Registry maintenance: weekly, Monday 06:00 UTC.
- Orbits refresh: every 12h, fully deterministic (CelesTrak/LL2 only,
  no LLM).
- Stocks refresh: daily after US market close, deterministic.
- Model: `claude-sonnet-5` for both the news sweep and registry
  maintenance agents (`claude_args: --model claude-sonnet-5` in both
  workflow YAMLs). No cheap/expensive model cascade is actually wired
  despite SNR_SPEC §3 / SNR_PLAN §D calling for "cheap model for
  fetch/dedup/extraction, expensive for adjudication" — both jobs run
  a single flat model.
- Caps on candidate volume: the 14-source `SCHEDULED_SOURCES`
  allowlist (vs. 66 registered), the 15-fetch signals-pass budget, the
  40-fetch/8-event corroboration budget, and the 45-minute job
  timeout are the hard constraints; none of them scale with how much
  news actually happened, so a busy day and a quiet day get the same
  ceiling.
- `concurrency: group: data-writes, cancel-in-progress: false` is
  shared across update-items, maintain-registry, and update-orbits —
  they serialize rather than race, so an hourly news sweep can queue
  behind a 12-hourly orbits run or a weekly registry run without
  overlap corruption, but also means a slow run pushes the next
  scheduled trigger's actual start later than its cron time.

---

## 6. Frank list of gaps and volume-suppression risks

**Promised but unimplemented / unwired:**
1. Ledger-based source demotion (CLAUDE.md: "A ledger demotion lowers
   a trade source to informal") never fires — `effectiveClass` /
   `demotionInEffect` are dead code; `scoreClaim` reads the agent's
   raw class with no ledger lookup.
2. Claim resolution (`resolveClaim`) is never invoked anywhere — every
   ledger claim is permanently `unresolved`, which cascades into:
3. Automatic signals promotion suggestions (`promotionCandidates`) can
   never fire in practice (depends on resolved="confirmed" claims that
   never exist); `signals_suggestions.json` will stay empty unless an
   LLM manually computes and writes an entry correctly by hand.
4. Calibration reporting (`calibration()`) has no real data; the
   promised "of claims published at SNR 2, N% were later confirmed"
   metric cannot exist yet.
5. Registry crossfeed reconciliation (`reconcile()`) is dead code; the
   "registry crossfeed check" is 100% agent prose with no deterministic
   gate, so a skipped or careless comparison is invisible to the build.
6. `matchDecision()` (the 7-day/30-day dedup arithmetic) exists as a
   pure, tested function but is not called from finalize-sweep for the
   agent's own "known-to-MCC" step — the agent re-derives the windows
   in prose from the prompt text rather than the code being the source
   of truth for that decision (finalize-sweep only reuses `daysBetween`
   internally for its own persistence pass).
7. Model cascade (cheap-model fetch/dedup, expensive-model adjudication)
   from SNR_SPEC §3 / SNR_PLAN §D is not implemented — both scheduled
   workflows pin a single `claude-sonnet-5` model for everything.

**Mechanisms likely to suppress item volume:**
1. `SCHEDULED_SOURCES` hard-codes 14 of 66 registered sources into the
   workflow YAML as a "cautious... soft launch" measure, with a
   comment saying to remove the fallback and go to the full list —
   still cautious as of this read.
2. Hourly cadence with a narrow "since-last-sweep" window means most
   runs have almost nothing new to find; `state.json`'s recent sweep
   log is dominated by `added=0` entries explicitly logged as "Narrow
   same-day re-check (~1.5–5hr window)" — the tuning-mode cadence is
   presently working against volume, not for it, because each run's
   candidate pool is capped by how little time elapsed, while the
   source list is also capped.
3. Fetch failures are common and appear to be silently absorbed as
   "no candidates from that source" rather than surfaced: SWEEP_MEMORY
   documents persistent Cloudflare/JS-shell failures on SpaceX,
   Starlink, Rocket Lab article pages, GHGSat, HawkEye 360, ESA,
   nasaspaceflight.com, and others. These don't corrupt data (the
   source-health mechanism flips them toward `dead` over 3 failures),
   but between fails-1-and-2 a real story on a temporarily-gated site
   is invisible to that sweep with no retry-later signal beyond the
   next scheduled run.
4. Corroboration budget (5/event, 40/sweep, 8-event capacity) can
   throttle scoring quality (more `found_none` −1 penalties or
   `not_attempted` on busy days) but does not throttle whether an item
   publishes at all — items still ship at whatever SNR the budget
   produces (working as designed per SNR_SPEC's "wide net" philosophy,
   not a hidden suppressor, but worth naming since it does suppress
   *score*, and a persistent string of low scores could read as "the
   pipeline found nothing" even when items did ship).
5. `signalsPass` gate is enforceable only for the `fetchable` leg
   (site/substack/beehiiv/bluesky); the X leg — likely the highest-
   volume signal source for a fast-moving industry — is entirely
   best-effort/unenforced by design, so real signals-tier scoops on X
   can be missed sweep after sweep with no gate ever catching it.
6. `matchDecision`'s dedup width (7 days "same event") combined with
   an LLM doing the actual actor+event-class matching from prose (not
   the tested pure function) is a plausible source of dedup false
   positives/negatives that would never surface as a build failure —
   there's no code check that an item the agent decided was "known"
   was actually the same normalized event as an existing item beyond
   the id/source_url equality checks in finalize-sweep.

**Dead code / scaffolding not yet load-bearing** (see §4 for detail):
`scripts/snr/reconcile.ts` (whole file), `scripts/snr/ledger.ts`'s
`effectiveClass`, `demotionInEffect`, `recoveryEligible`,
`resolveClaim`, `calibration`, `promotionCandidates`, and
`scripts/snr/match.ts::matchDecision` (used only by tests /
theoretically available, not wired into the live finalize path for
the known-to-MCC decision itself).

**Confidence note**: all findings above are grounded in direct reads
of the workflow YAML, prompt files, and TypeScript source, plus
`grep`-verified call-site absence for every function named "dead" or
"unwired," plus live inspection of `src/data/state.json`,
`items.json`, `held.json`, and `signals_suggestions.json` at their
current committed contents. No web access was used and no repo files
were modified.
