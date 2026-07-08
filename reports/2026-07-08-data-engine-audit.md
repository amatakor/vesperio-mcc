# MCC Data Engine Audit — 2026-07-08

Scope: full data engine (News, Registry, Signals, SNR, feedback loops), Orbits only where it crosses into the other surfaces. Policy was in scope. Research budget frame: free to ~$100/mo.

Method: four delegated analysis passes (data state, pipeline code, registry completeness, external research), with the highest-impact claims independently re-verified against the repo (call-site greps, workflow YAML, SNR distributions). Full working reports are preserved separately; this document is the synthesis and the plan.

---

## 1. Verdict

The engine's scoring core is real and well built. The self-reinforcing loop around it does not exist yet. Specifically:

1. **The "crawler" is not a program.** Discovery, corroboration, and the signals pass are all the sweep agent's own WebFetch/WebSearch/curl calls. There is no JS rendering, and WebFetch returns *summarized* text, which structurally conflicts with the "numbers are copied, not paraphrased" rule. 53 of 66 sources are plain HTML scrape targets, and SWEEP_MEMORY is dominated by Cloudflare/JS-shell failures.
2. **The entire feedback layer is dead code.** `reconcile()` (registry crossfeed), `resolveClaim()`, `calibration()`, `promotionCandidates()`, `effectiveClass()`/`demotionInEffect()` (ledger demotion), and `matchDecision()` (dedup arithmetic) are pure, tested functions that are never called from any production path. Verified by grep: zero call sites outside `scripts/snr/` and tests. Consequences: all 23 ledger claims are permanently `unresolved`, zero strikes/credits ever, `signals_suggestions.json` can never populate, calibration reporting has no data, and the registry crossfeed has landed **zero** traceable instances.
3. **Discovery is throttled by design and by tooling.** The scheduled sweep walks a hard-coded 14-source subset of the 66 registered sources (the "soft launch" allowlist in `update-items.yml` was never widened). The cron is hourly with narrow since-last-sweep windows, so most runs find nothing. 28 of 48 "verified" sources (58%) have never produced a single item, including Planet, Maxar, Spire, ULA, Arianespace, and every regulatory feed.
4. **The stale feel is measurable.** 18 of 33 calendar days (55%) have zero items. 83% of all items landed in one 10-day burst. spacenews.com leads 48% of the feed; the top 3 domains lead 69%; only 12 distinct domains have ever led an item.
5. **The "boring press release" bias is a discovery problem, not a scoring problem.** The SNR math would happily publish an SNR-1 hot take; none exists because the pipeline never sees one. X is deliberately excluded from the enforced fetchable set, YouTube is not modeled as a channel type at all, zero items have ever cited any of the 44 curated Signals people, and the only content the crawler can reach is corporate newsrooms and one trade outlet. Result: 74% of items sit at SNR 4-5, zero items at SNR 1, and 83% of items are rated "notable" (the impact tier barely discriminates).
6. **Registry: 139 entities, 77.9% filled, three days old.** Constellations are worst (70.2%); `sats_launched_total` is null on 73% of them, `next_flight_date` null on 77% of vehicles. The SNR-3 "provisional" tier is used by exactly zero fields. Entities explicitly implied by CLAUDE.md scope are absent: Boeing, Axiom Space, Sierra Space, JAXA, plus Iridium, Guowang, Qianfan, and the Chinese commercial launchers (Zhuque-2, Ceres-1, etc.) despite the equal-weight-China policy (candidate list, model-knowledge, verify before adding).
7. **Trust surface gaps.** `state.json`'s sweep log covers only 2026-07-05 to 07-07, while items go back to 06-05: most of the feed's history has no audit trail for /log to render. Three `example.com` fixture items sit in production `items.json`. A stray empty `_audit_analysis.py` at repo root (audit accident, safe to `rm`).

The product promise ("self-reinforcing, self-fact-checking, self-improving") currently describes the architecture diagram, not the running system. The good news: the hard part (the scoring engine, the gates, the schemas) is done and correct. What is missing is mostly wiring and a proper fetch layer.

---

## 2. Root-cause analysis

### 2.1 Why News feels stale

Ranked by contribution:

1. **Fetch layer mismatch.** LLM WebFetch against JS-heavy corporate newsrooms is the worst possible tool for this job: it is slow, expensive, blocked by Cloudflare, silently blind between failure 1 and 3, and returns paraphrase where verbatim is required. Meanwhile the industry's actual firehose (trade press RSS, wire RSS, SEC EDGAR Atom, ESA RSS, YouTube channel RSS, Bluesky) is machine-readable and free, and mostly absent from sources.json (only 11 of 66 sources are RSS/Atom).
2. **The 14-source allowlist.** Even a perfect fetcher would be blind to 79% of the registered sources on scheduled runs. The YAML comment says to remove it; it was never removed.
3. **Narrow windows + hourly cadence.** Each run's candidate pool is capped by how little time has elapsed, while budgets stay flat. Quiet re-checks then dominate the sweep log (13 of 29 sweeps added zero).
4. **No discovery beyond the source list.** WebSearch is used only for corroboration. Nothing detects a story that broke somewhere off-list. Techmeme-style aliveness comes precisely from cross-outlet detection, which MCC already has the scoring machinery for but never runs as a discovery pass.
5. **No commentary surface.** The item schema admits only events. Hot takes, analysis, and commentary (the content that makes a feed feel alive between events) have no home, so even a perfect crawl of the Signals list would have nothing to publish into.

### 2.2 Why Registry stays incomplete

1. **The crossfeed is prose, not code.** Step 5 of the sweep prompt asks the agent to remember to check; `reconcile()` is never invoked; nothing verifies the step happened. Zero instances have landed.
2. **Null-fill depends on a weekly LLM run** doing field-by-field work that a deterministic job could do in seconds from Launch Library 2, GCAT, and CelesTrak (the emptiest fields: `next_flight_date`, `sats_launched_total`, `first/latest_launch_date`, flight counts, are exactly the fields those APIs carry).
3. **Entity coverage was one bulk load** (2026-07-05/06) with no mechanism to add entities discovered via news flow (new entities require an @claude issue, which is correct for structure but has no feeder producing the candidate list).

### 2.3 Why the self-improving loop never started

Every mechanism that would make the system learn is scaffolded but unwired: claims are recorded but never resolved, so nothing can be credited or struck, so no source can be demoted or promoted, so signals_suggestions stays empty, so calibration has nothing to show. One missing job (claim resolution) blocks the entire chain downstream.

---

## 3. What the external research found

Verified highlights (full source-by-source detail in the research annex; items marked unverified there need a one-time curl check before wiring in):

**Free and immediately usable**
- **Trade/wire RSS:** SpaceNews `/feed/`, NASASpaceflight, Via Satellite category feeds, SpaceflightNow, The Space Review, Business Wire aerospace RSS, PR Newswire aerospace/defense RSS. (Most exact URLs still need a one-time verification pass.)
- **Official feeds:** ESA RSS program (confirmed, per-programme feeds), SEC EDGAR full-text search + submissions APIs (free, no key, User-Agent required, first-party tier for 8-K/S-1 events), Federal Register JSON API + RSS (NOAA/FCC/FAA actions).
- **Structured data for Registry/Orbits:** Launch Library 2 (free), CelesTrak OMM JSON/CSV every 2h (computed tier), Space-Track (free, 30/min 300/hr), **GCAT (CC-BY, TSV, actively maintained, the cleanest license in the field, covers orgs/vehicles/sites history)**, SatNOGS DB (CC BY-SA, RF metadata), r-spacex API (free SpaceX cross-check). UCS database is ~3 years stale; do not use.
- **YouTube:** per-channel RSS (`youtube.com/feeds/videos.xml?channel_id=`) is free and keyless; Data API 10k units/day free for anything RSS can't do. YouTube is currently not even a channel type in the signals schema.
- **Bluesky:** entirely free API, no gatekeeping, 5,000 points/hr read limits, Jetstream endpoint for lightweight polling. Documented journalist migration trend (Pew: news-influencer presence 21%→43% post-2024; not space-specific). Only 1 of 44 signals people currently has a Bluesky channel recorded; worth an audit.

**Constrained or dead ends**
- **X API:** pure pay-per-use since 2026, $0.005/post read, no free tier. $100/mo buys ~20k reads: enough for scheduled polling of the ~33-person whitelist a few times daily, not for open discovery. The free syndication-endpoint workaround the prompt already uses remains the zero-cost path, but is fragile.
- **Reddit:** commercial API from ~$12k/mo. Dead end.
- **GDELT:** free 15-min global event feed; useful only as an early-warning trigger with a custom keyword layer, never as a citable source.
- **Orbital Index discontinued Jan 2026** (archive on GitHub, useful for style/method reference only).
- **Conflict to resolve:** the research pass suggests fcc.report's IBFS mirror for FCC filings RSS, but SWEEP_MEMORY documents that mirror serving 2020-2023 filings as if live. Treat fcc.report as unusable until independently re-verified; prefer the Federal Register API + FCC Daily Digest for regulatory flow.

**How the comparables stay alive (Techmeme, HN, GDELT):** a continuously reacting scoring loop keyed on cross-outlet corroboration, a visible update cadence, and a thin named human layer. MCC already has all three designed (SNR corroboration, /log, held.json + Florian). The difference is that theirs run.

---

## 4. Action plan

### P0 — hygiene and the fetch layer (this week)

1. **Housekeeping:** delete `_audit_analysis.py` (repo root, empty, audit accident). Remove or build-exclude the three `example.com` fixture items from `items.json`.
2. **Build a deterministic feed harvester** (`scripts/harvest.ts`, bun, no LLM): pulls every RSS/Atom/API source on schedule, normalizes to a `candidates.json` queue with raw title/body/date/URL. The sweep agent then classifies, dedups, and writes from the queue instead of fetching. This fixes, at once: Cloudflare/JS blindness for feed-capable sources, paraphrased numbers (raw feed text, not WebFetch summaries), silent fetch failures (harvester logs per-source HTTP status deterministically), and most of the sweep's token cost.
3. **Convert sources.json to feed-first.** One-time verification pass over the RSS URLs from the research annex (curl each, record exact path). Add: SpaceNews, NASASpaceflight (use `content:encoded`, already proven in SWEEP_MEMORY), Via Satellite, SpaceflightNow, Business Wire + PR Newswire aerospace, ESA RSS set, SEC EDGAR Atom per tracked ticker, Federal Register API queries for NOAA/FCC/FAA. Fix the stale URLs SWEEP_MEMORY already identified. Mark JS-shell-only sources (spacex.com, starlink.com, ghgsat.com, he360.com) as unfetchable-by-feed and stop burning sweep budget on them; their events arrive via trade/wire/LL2 anyway.
4. **Widen the throttles:** replace the 14-source `SCHEDULED_SOURCES` allowlist with the full list (the harvester makes this cheap), and move the cron to the intended `0 5,17 * * *` twice-daily, with the sweep window sized to the gap. Two real sweeps beat 24 empty re-checks, and match the published cadence promise.

### P1 — wire the loops (next 2 weeks)

5. **Claim resolution job** (new script or a finalize-sweep phase, weekly): for each `unresolved` ledger claim older than N days, re-run a bounded corroboration check; call `resolveClaim()` with confirmed/debunked/expired. This single job unblocks the whole feedback chain.
6. **Turn on the ledger:** call `effectiveClass()` inside the scoring path so demotion actually lowers base tiers (CLAUDE.md already claims it does); call `promotionCandidates()` after resolution and write `signals_suggestions.json`; render `calibration()` output on /log. The trust product ("whether the scores are honest is itself measured") starts existing at this point.
7. **Wire the registry crossfeed as code:** finalize-sweep emits like-for-like facts from stamped items (SNR ≥ 3) into a `registry-candidates.json` queue via `reconcile()`; the weekly registry run consumes the queue instead of relying on agent memory. Add a gate so a skipped crossfeed check fails the run, matching how corroboration skips are already policed.
8. **Deterministic registry enrichment:** scheduled jobs filling the emptiest fields from LL2 (`next_flight_date`, flight counts, first/latest launch dates), GCAT (org/vehicle/site history; CC-BY attribution string), CelesTrak (active counts, already partly done via compute-fleet-counts). These fields should never depend on an LLM run.
9. **Registry backfill batch (one-off):** add the missing entities after verification: Boeing, Axiom Space, Sierra Space, JAXA, Iridium, Globalstar, Guowang, Qianfan, LandSpace/Zhuque-2, Galactic Energy/Ceres-1, Space Pioneer, Skyroot, Agnikul, Terran R, plus the smaller EO names (Wyvern, Orbital Sidekick, Albedo, Axelspace, EarthDaily). Then fill the 10 emptiest existing profiles ("Crewed vehicles" at 1/14 fields is a stub).
10. **Signals on Bluesky:** audit all 44 people for Bluesky handles, add them as fetchable channels (free, enforced leg, unlike X). Add `youtube` as a channel type using per-channel RSS. This is the cheapest path to the whitelist actually producing items.
11. **Wire `matchDecision()` into finalize-sweep** so dedup windows are code-checked, not prose-recalled.

### P2 — product and policy (this month)

12. **Give commentary a home.** Policy change: either a new item kind (`commentary`/`analysis`: whitelisted person or named outlet takes a position; scored for attribution, tagline quotes the take, never enters the registry) or a rendered Signals feed showing recent posts from the whitelist. Without this, "engine favors boring press releases" stays true no matter how good discovery gets, because the schema only admits events.
13. **Add a discovery pass, not just corroboration:** 3-5 WebSearch queries per sweep per category window ("EO constellation news", "launch contract", China/India/Japan terms in English), feeding the same candidate queue. Optionally a GDELT keyword trigger later. This is what catches off-list stories and makes low-SNR early signals exist.
14. **Decide the X budget:** $0 (keep the fragile syndication workaround), or ~$50/mo API polling of the whitelist a few times daily (~10k reads). Recommendation: try the Bluesky+YouTube expansion first, then decide with data on what X uniquely still carries.
15. **Rebalance non-US coverage:** current window ran Europe 15 tags vs China 2. Add CGTN/Xinhua keyword-filtered feeds and an ISRO press-page diff job; the state-media SNR rules already exist and are correct.
16. **Recalibrate impact:** 83% "notable" makes the tier meaningless. Tighten the notable bar or add sub-weighting so push/ranking has signal.
17. **Model cascade** per SNR_PLAN: Haiku for harvest-queue triage/dedup prefilter, Sonnet for drafting/adjudication. Only worth doing once volume rises after P0.
18. **Measure the fix:** add weekly KPIs to /log: items/day, distinct lead domains, % items at SNR ≤ 2 (should be > 0 in a healthy engine), crossfeed facts landed, claims resolved, signals-sourced items. The audit's core numbers become the dashboard.

---

## 5. What to leave alone

- The SNR math, gates, and anti-spoof logic: code matches spec, the ceiling and floor logic is correct (implemented twice, in score.ts and match.ts; consolidate someday, but they agree today).
- The zero-padding policy for quiet days: quiet-day honesty is a differentiator; the problem was never the policy, it was that the engine made every day quiet.
- Orbits: deterministic, right sources (CelesTrak/LL2), right cadence. Its data should flow outward (counts into Registry stat blocks, launch events as news triggers), which P1 items 7-8 cover.
- held.json semantics and the seismic auto-queue: working as designed.

## Annexes

Working reports with full detail are in `reports/audit-2026-07-08/`: `data-state.md` (all feed/sweep/source/ledger numbers), `pipeline-review.md` (as-implemented flow, budgets, dead-code inventory), `registry-audit.md` (per-field completeness tables, gap candidates), `external-research.md` (source-by-source API/feed facts with verification flags).
