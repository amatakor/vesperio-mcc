# 30-Day News Backfill - mission file (written 2026-07-08, session handoff)

Florian's instruction: populate the feed with at least 30 days of news (events back to ~2026-06-08), run the crawl autonomously, and use the baked-in acceptance test below to judge success. If the test fails, diagnose the pipeline, fix it, and re-run. This document is Florian's explicit sanction for the backfill: the "older than ~7 days is stale" precedent (SWEEP_MEMORY 2026-07-05-F) is WAIVED for this run and this run only.

## The baked-in acceptance test (do not read past this lightly)

**SpaceX IPO'd on Nasdaq in June 2026 (ticker SPCX, valuation around $2 trillion at listing).** Florian knows this event; it is deliberately unpublished because it predates MCC's coverage. The backfill MUST surface and publish it correctly, unprompted, as:
- its own item, dated on the actual IPO date (June 2026, exact date from sources),
- category `financial`, impact `seismic` (this is the definitional seismic event),
- lead source first-party or official record where possible (SpaceX files with SEC EDGAR now; an S-1/424B/8-K on sec.gov is official_record; the whole world also covered it, so corroboration should be trivial),
- expected SNR 4-5. If it lands at SNR <= 2 it will auto-queue to held for Florian (that is the mechanism working, but with this sourcing it would mean the crawl or classing failed).

**Known complication, intentional:** the published item `2026-07-07-spacex-nasdaq-100-inclusion` already REFERENCES the IPO in its copy. The IPO is a distinct event weeks earlier, outside the 7-day dedup window, so the dedup gate will not block it. The test is whether the agent publishes the IPO as its own event anyway. Do not delete or edit the Nasdaq-100 item to make the test easier.

If after the first full crawl pass the IPO item does not exist (or exists wrongly dated/classed/scored): treat it as a pipeline defect. Diagnose which stage failed (harvest window? discovery queries? scope misjudgment? dedup misfire? source classing?), fix that stage (code fix on a branch + tests if it is a gate/harvester bug; prompt fix if editorial), and re-run the affected window. Log the diagnosis in this file under "Run log".

## How to run it (recommended shape)

1. **Add a window override to the harvester first.** scripts/harvest.ts has no 30-day mode (normal = lastSweep-48h, deep = 7 days via FORCE_DEEP). Add a `HARVEST_WINDOW_DAYS` env override (integer, wins over both modes), with a unit test, wired as an optional workflow input if trivial. Small, tested change; everything else builds on it.
2. **Backfill in week-sized windows, oldest first** (Jun 8-14, 15-21, 22-28, Jun 29-Jul 5). Per window: `HARVEST_WINDOW_DAYS=… bun scripts/harvest.ts` locally, then run the sweep procedure (prompts/update-items.md) against the queue, draft sweep-draft.json, `bun scripts/finalize-sweep.ts`, `bun run build`, commit `ingest: N new, ... (backfill week of YYYY-MM-DD)`, push. Local runs, not CI: you need to supervise and re-run windows.
   - The Google News query feeds accept date operators inside q: append `+after:2026-06-08+before:2026-06-15` to the existing query feeds for per-week harvests (one-off URLs fetched by the harvester via a temporary sources entry, or fetch them directly and merge by hand into the queue with the same shape; keep it deterministic either way).
   - Feed archives are shallow (SpaceNews RSS holds ~24 entries): for older weeks, expect the DISCOVERY side (date-scoped Google News + WebSearch + outlet archive pages) to carry more weight than the feed queue. That is fine; the gates do not care where candidates came from.
3. **Item dates are event dates.** publishDate stamps itself as now (correct). Numbers copied from fetched pages only, never search snippets.

## Gates and behaviors that WILL fire (this session built them; do not fight them)

- **discoveryPass**: every finalize run requires >= 6 attested queries covering the matrix (launch / financial / incident-regulatory / non-US). For backfill windows, date-scope the queries and say so in the note.
- **signalsPass**: required block; for backfill windows an empty `checked` with an honest note ("backfill window, signals channels have no archive relevance") is legal.
- **Crossfeed attestation**: any event item whose companies match a registry entity at SNR >= 3 must carry a crossfeed block (empty facts + note is honest). Commentary items are exempt and must NOT carry facts.
- **Dedup gate**: same company + category within 7 days rejects unless the draft attests `dedup_distinct: [{ id, reason }]` per matched item. Expect this on launch-cadence actors (Starlink batches); acks are legitimate there.
- **Corroboration discipline** (SWEEP_MEMORY 2026-07-08-A, born from Florian falsifying two claims): quoted-headline search is mandatory per event; check the queue itself for cross-outlet copies; a found_none that a 20-second search contradicts is a published falsehood. Before declaring the backfill done, batch-audit every found_none item the backfill produced (delegate to a Sonnet agent writing to .frugal-fable/, verify its findings yourself before rescoring).
- **Persistence pass**: finalize bumps uncontested items 14+ days old by +1 (capped at 4) on every merge. Backfilled June items will earn it immediately; that is correct semantics (uncontested since the event), not a bug. Expect /log movements.
- **Seismic + SNR <= 2 auto-holds** for Florian while publishing. Leave those entries alone.

## Frugal-fable routing (the session runs with /frugal-fable active)

- Fable: window orchestration, all drafting judgment, scope calls, integration, final review, anything touching finalize-sweep or policy.
- Sonnet agents: corroboration verification batches, archive scanning per outlet, found_none audits. Always: write findings to .frugal-fable/<task>.json, return path + 3-line summary only. Waves of 3-5 agents max (SWEEP_MEMORY 2026-07-05-U: ~25 concurrent = rate-limit deaths).
- Haiku: log reduction, CI output summaries.
- LL2 (ll.thespacedevs.com) rate limit is ~15/hr SHARED per IP: agents must not poll it; one bulk fetch per window if needed.
- Do not launch autonomous gap-fill research rounds beyond the plan; widen only if Florian asks.

## Hard boundaries (unchanged)

- Never edit signals.json people, snr math (scripts/snr/score.ts, match.ts), or items.json except through finalize-sweep.
- held.json is for genuine scope questions; weak sourcing publishes at low SNR instead.
- Quiet windows are valid: if a week genuinely has little on-scope news, say so in the sweep entry; never pad.
- No em dashes anywhere. Headlines actor-first, no outlet prefixes (2026-07-08 rule).
- The site is NOT deployed (no Cloudflare hook); "live" means pushed to GitHub main + local preview.

## Done means

- [ ] Feed carries on-scope items covering ~2026-06-08 through today with no unexplained week-sized gaps
- [ ] The SpaceX IPO item exists, correctly dated June 2026, financial/seismic, SNR >= 4, first-party/official-record or wide-mainstream sourced
- [ ] Every backfill window has its own /log sweep entry with honest attestations
- [ ] found_none batch audit ran; any falsifiable claims fixed with movements on /log
- [ ] Build + all tests green after every commit; all pushed to main
- [ ] Run log below filled in (what ran, what failed, what was fixed)

## Run log

(the backfill session appends here)

- **2026-07-08 ~13:00 UTC, tooling (commit b8a9a9c).** Added `HARVEST_WINDOW_DAYS` env override to scripts/harvest.ts (positive integer, wins over normal/deep; garbage aborts) with unit tests, wired as optional workflow input. Added scripts/backfill-harvest.ts: scopes the Google News query feeds with `after:/before:` operators and merges into candidates.json without touching sources.json health. Tests + build green.
- **2026-07-08 ~15:30 UTC, window 1 (Jun 8-14, commit c3d3dea).** `HARVEST_WINDOW_DAYS=31` harvest (797 candidates) + scoped Google News for the week (queue 1065; 290 in-window). Sonnet triage (26 story clusters) then 5 Sonnet research batches to .frugal-fable/; Fable drafted all 20 items. finalize-sweep rejected the draft 4 times, all headline-length overruns (91-97 chars), fixed and merged clean; no gate logic failures. Build + tests green, pushed.
  - **ACCEPTANCE TEST PASSED on first pass:** `2026-06-12-spacex-nasdaq-ipo` published unprompted: dated June 12 (Nasdaq debut; pricing June 11, both from sources), category financial, impact seismic, SNR 5, lead = SEC 424B4 on sec.gov (official_record), CNBC + TechCrunch mainstream corroboration, Nasdaq-100 item untouched. Orbital-data-center S-1 disclosure folded into the IPO item ("as early as 2028" per prospectus); the single-source Data Center Dynamics "2027" claim conflicted with the prospectus and was not published.
  - Findings for Florian (no action taken): (1) Plan line "backfilled June items will earn persistence immediately" does not match the code: finalize-sweep starts the persistence clock at publishDate by design ("a late-discovered old event has not survived any exposure yet", SNR_PLAN A1). Movements will come 14 days after publication, not immediately. Treated the code as correct. (2) Anti-spoof official-host list has no path for non-US government domains: canada.ca / asc-csa.gc.ca (CSA RADARSAT+ award) and inspace.gov.in (LVM3 EOI) cannot class official_record; items led with gate-safe trade/informal sources and linked the government pages unscored. Consider adding CSA/IN-SPACe registry profiles or widening the fixed list. (3) Google News RSS redirect URLs no longer resolve server-side (JS interstitial); publisher URLs were re-located via WebSearch/direct fetch instead. (4) LVM3 published at SNR 1: IN-SPACe's EOI portal is a JS shell and the fetchable Indian coverage is one wire-derived cluster; honest low-SNR early signal, flagged for later upgrade when trade press covers it.
- **2026-07-08 ~17:45 UTC, window 2 (Jun 15-21, pushed).** Same shape as window 1 (scoped harvest 267 in-window, Sonnet triage + 4 research batches, Fable drafting): 16 items, merged on the gate's first run. Highlights: SpaceX/Cursor $60B all-stock deal (SEC 8-K lead, dedup_distinct attested vs the IPO item), MDA/Blue Canyon $620M, Ariane 6 P160C debut with the European payload record, Landspace Zhuque-2E upper-stage breakup (incident, SNR 2, Ars-only sourcing), Jio sovereign-LEO evaluation (copy held at "evaluating" per the RIL AGM statement; satellite-count figures attributed to the Economic Times report, not stated as fact). Skipped despite verification: Dhruva/ICEYE MoU (no gate-safe fetchable source: dhruvaspace.com not in registry, every mirror unfetchable), Xona Pulsar (in-window dating unverifiable), Pakistan "6 satellites" (16-month retrospective narrative, no dateable event), Satellogic CFO exit and EchoStar 8-K (below bar / out of scope), Jilin-1 Kinetica-1 batch (routine cadence precedent).
- **2026-07-08 ~19:00 UTC, TOKEN-CONSTRAINED MODE.** Florian nearly out of tokens mid-run; agreed to finish lean: no more subagents, Fable works the queue directly, ~10 fetches per window, notable+ bar, found_none audit deferred.
- **2026-07-08 ~19:30 UTC, window 3 (Jun 22-28, lean, pushed).** 339 in-window queue entries scanned by title directly; 7 items: Starfall first flight (June 23, SpaceNews), SpaceX $25B bond pricing (own 8-K lead, five tranches verbatim), Starmind constellation naming, reported Starlink US retail-mobile plan (published at honest low confidence per Ars/FT anonymous-roadshow sourcing; note tension with seed lesson 2026-07-05-B "hold until on the record", resolved in favor of the current publish-at-honest-SNR model), SpaceSail funding round (Reuters wire copy), Synspective StriX-10 (first-party; registry already carried the 10-count from this release), Firefly/Space-ng. Dropped for want of fetchable sources: CGTN China-Central Asia constellation (JS shell), NGSO trade association, Suhora/ISRO pre-award. MDA C$688M turned out to be June 30 and moved to window 4.
- **2026-07-08 ~19:50 UTC, window 4 (Jun 29-Jul 5, gap check, pushed).** Week already carried 30+ items from regular sweeps; scoped harvest (456 in-window entries) surfaced exactly two genuine gaps, both published: MDA C$688M RADARSAT replenishment build contract (SpaceQ lead) and AgniKul/ICEYE India SAR MoU (informal lead, noise). Hongqing $191M and Katalyst Swift reboost verified already published. COVERAGE GAP FLAGGED FOR FLORIAN, not drafted: the Airbus/Thales/Leonardo "Project Bromo" space merger and its antitrust opposition (OHB legal threat, ~E900M OHB placement context) has never been covered by MCC; the announcement predates the backfill window and no clean in-window dateable event had a fetchable source. The next Bromo development should be picked up by the regular sweep.
- **DEFERRED (needs a future session): found_none batch audit.** Per this plan's corroboration-discipline requirement, every backfill found_none item needs an adversarial re-check (quoted-headline search) before the claims can be called calibrated. Backfill found_none items: `2026-06-09-redwire-500m-atm` (no penalty, official-record lead), `2026-06-15-axelspace-nsg-up42` (no penalty, first-party lead), `2026-06-15-zhuque-2e-upper-stage-breakup` (penalized to SNR 2; if independent non-mirror coverage of the breakup exists, rescore to found_some via updates[].rescore). Also worth an in-passing check: window-1 LVM3 item (SNR 1) for later trade-press coverage to upgrade.

## Done means (final status, 2026-07-08)

- [x] Feed carries on-scope items covering 2026-06-08 through today; 45 backfill items added across 4 windows; no unexplained week-sized gaps (thin days Jun 24-25 / Jul 3-4 reflect genuinely quiet legs or already-covered stories, per sweep entries)
- [x] SpaceX IPO item exists: `2026-06-12-spacex-nasdaq-ipo`, financial/seismic, SNR 5, SEC 424B4 official-record lead, published unprompted on window 1's first pass
- [x] Every backfill window has its own /log sweep entry with honest attestations (signalsPass empty+note per plan; discoveryPass 6-7 queries each)
- [x] found_none batch audit: ran 2026-07-08 (see reports/found-none-audit-2026-07-08.md); axelspace + LVM3 stamps stand; Redwire and Zhuque-2E rescores queued for the next sweep as verify-then-rescore (SWEEP_MEMORY 2026-07-08-J2)
- [x] Build + tests green after every commit; all pushed to main
- [x] Run log filled in
