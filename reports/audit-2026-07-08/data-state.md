# MCC data-state audit — 2026-07-08

Scope: `src/data/items.json`, `state.json`, `sources.json`, `source_ledger.json`, `held.json`, `signals.json`, `signals_suggestions.json`, `SWEEP_MEMORY.md`. No other files touched, nothing fetched from the web, repo untouched (read-only).

Note on fixtures: `items.json` contains 45 entries, 3 of which are explicitly tagged `fixture` (`2026-06-28-fixture-spacex-falcon-9-starlink-group`, `2026-07-01-fixture-iceye-esa-sar-contract`, `2026-07-02-fixture-fcc-ast-spacemobile-modification`, all sourced from `example.com`). All stats below use the **42 real items** unless marked "incl. fixtures."

---

## 1. Items (`items.json`)

**Volume:** 42 real items total, spanning **2026-06-05 to 2026-07-07** (33 calendar days).

**Per-day distribution — this is the core "stale feed" finding:**
- Only **15 of 33 days (45%) have any item at all**; **18 days (55%) have zero items.**
- The feed is not evenly spread twice-daily as the editorial policy intends: it is bimodal. From 2026-06-05 to 2026-06-23 (19 days), there are only **7 items on 7 separate single-item days**, then a **16-day gap with nothing between 2026-06-05 and 2026-06-29** other than those scattered singles (gap days: 06-06 through 06-14, 06-16, 06-20, 06-21, 06-24 through 06-28 — 18 gap days total, listed in full below).
- Then a dense cluster from 06-29 to 07-07 (10 days) carries **35 of the 42 items (83%)**, with single-day spikes of 6, 7, and 9 items (2026-06-30: 6, 2026-07-01: 7, 2026-07-02: 9) that read like backfill/catch-up bursts, not steady twice-daily publishing.
- Gap days (0 real items): `2026-06-06, 07, 08, 09, 10, 11, 12, 13, 14, 16, 20, 21, 24, 25, 26, 27, 28`, plus `2026-07-05` (the one gap inside the dense period).
- **Confirms the "twice-daily" promise is not being met in this data**: 15 covered days out of 33, with most real coverage compressed into a 10-day late-June/early-July burst.

**Category counts (real items):** launch 10, product 9, financial 6, partnership 5, procurement 5, human-spaceflight 3, contract 2, regulatory 1, constellation 1. (`geopolitical` and `incident` categories: zero items ever.)

**Impact counts:** notable 35 (83%), noise 6 (14%), seismic 1 (2%). Category × impact cross-tab shows `noise` items cluster in `launch` (1) and `product` (4)/`partnership` (1); virtually everything else auto-lands at `notable`, suggesting the impact tier may be under-discriminating (83% of the feed rated the same importance).

**SNR distribution (real items):** 5 → 17 (40%), 4 → 14 (33%), 3 → 6 (14%), 2 → 5 (12%), 1 → 0, 0 → 0. Mean roughly 4.0. So a large majority of published items already sit at "canonical" confidence (SNR ≥ 4 = 31/42, 74%); very few items sit at the low, honest end the SNR system is designed to surface (SNR 1 never appears at all in the current feed).

**Lead-source domain concentration (source_url, real items) — this is the "press-release/wire-heavy, narrow-sourcing" finding:**
Only **12 distinct lead domains** across 42 items:
| domain | count |
|---|---|
| spacenews.com | 20 (48%) |
| iceye.com | 6 (14%) |
| payloadspace.com | 3 |
| sec.gov | 2 |
| europeanspaceflight.com | 2 |
| myriota.com | 2 |
| investors.planet.com | 2 |
| ll.thespacedevs.com | 1 |
| isaraerospace.com | 1 |
| jl1.cn | 1 |
| telesat.com | 1 |
| ir.blacksky.com | 1 |

Top 3 domains alone account for **29/42 items (69%)**. **Spacenews.com is the lead source for essentially half the entire feed (20/42, 48%)** — one trade outlet's editorial judgment is effectively setting half the site's news agenda. The next-largest slice (iceye.com, 6 items = 14%) is entirely first-party ICEYE corporate press.

**Lead-source *class* (via=initial, not just domain):** trade 25 (60%), first_party 14 (33%), official_record 2 (5%), computed 1 (2%). So a majority of leads are trade-press rewrites rather than press releases directly — the "press-release-heavy" feel comes less from the lead class and more from (a) the extreme domain concentration on one outlet, and (b) heavy corroboration reliance on first-party/official sources once attached (see below), and (c) only 12 working domains total against 66 configured sources.

**Multi-sourcing:** 21/42 items (50%) have more than one entry in `sources[]`; 18/42 have a non-empty `secondary_urls`. Average `len(sources)` per item = **1.67**. So roughly half the feed is still single-sourced.

**Reinforcement / rescoring activity (`snr_trace.modifiers` non-empty):** 20/42 items (48%) were touched by a modifier after initial scoring — but almost all of this is **corroboration bookkeeping done same-day or within a few days during active editorial/audit sessions**, not organic reinforcement over time:
- 13 `corroboration_2plus` (+1) events
- 6 `corroboration_none` (-1) events (crawl ran, found nothing)
- 1 `persistence` (+1) event (only one item, `2026-06-22-ohb-capital-raise`, ever survived long enough uncontested to earn the 14-day persistence bump)
- 0 `reinforcement` events (the 30-day "matching event within 30 days" bump has never fired on any item)

Source class counts across **all** source entries (lead + corroboration, real items): trade 41, first_party 16, official_record 7, computed 2, wire_pr 2, informal 1, mainstream 1 (total 70 entries across 42 items). Base-tier distribution: tier 3 (trade) → 25 items, tier 5 (first-party/official/computed) → 17 items, tier 4 → 0 items at initial scoring (the wire-copy/aggregator tier is essentially unused as a *base* tier; it only shows up via corroboration attaches).

**Tag frequency (top, real items):** europe 15, eo 13, launch 11, us-gov 9, funding 7, sar 6, smallsat-launch 5, human-spaceflight 5, connectivity 4, optical 4, china 2, reusability 2, iot 2, then a long tail of 1s (wildfire, m-and-a, direct-to-device, mena, heavy-lift, commercial-crew, hyperspectral, spaceport, rideshare). `iot` and `china` tags each appear only twice despite the editorial policy's stated equal-weight commitment to China/India/Japan/Europe coverage — Europe (15) outweighs China (2) roughly 7.5:1 in this window.

**Top companies (real items):** ICEYE 6, NASA 5, Rocket Lab 4, Planet Labs 4, then a long tail of 1-2. No company dominates catastrophically, but ICEYE alone is both the #2 lead-source domain and the #1 company tag — a single vendor's own newsroom is doing a lot of the site's EO coverage.

---

## 2. Sweeps (`state.json`)

**29 sweeps total**, all falling between **2026-07-05T06:04Z and 2026-07-07T17:35Z** — i.e., a **~2.5-day window**, even though `items.json` contains real items dated back to 2026-06-05. This is a significant finding on its own: **the entire sweep log only covers the last ~60 hours of a ~33-day item history.** Everything before 2026-07-05 was evidently seeded/backfilled outside of (or before) the current `state.json` tracking — there is no sweep-log record explaining or attributing the 06-05 through 06-23 items at all. The audit trail the "Log" page is supposed to render (per CLAUDE.md's product promise of "honest calibration, visible") does not actually cover most of the feed's own history.

**Cadence:** gaps between consecutive sweeps range from **35 seconds to ~14.9 hours**, averaging ~2.1 hours — but this is misleading because many sweeps are clustered interactive/audit sessions (multiple sweeps a few minutes apart) rather than the twice-daily scheduled cadence CLAUDE.md describes. The log reads as one intensive manual bring-up session (2026-07-05 through 2026-07-07), not a steady-state scheduled operation yet.

**Added-per-sweep distribution:** 0 → 13 sweeps, 1 → 10, 2 → 2, 3 → 2, 9 → 1, 14 → 1. Total added across all sweeps = 43 (close to but not exactly the 42 real items + fixtures reconciliation, consistent with edits/removals along the way). Total updated = 37. Total held = 4 (but `held.json` currently holds only 1 — 3 were resolved/released, e.g. the Rocket Lab/Iridium item explicitly released in the 2026-07-06T11:41Z SNR-migration sweep summary).

**Zero-add sweeps: 13/29 (45%).** Stated reasons, quoted:
- *2026-07-05T06:16Z*: "...Rocket Lab's own /updates/ page surfaced a striking 'Rocket Lab to Acquire Iridium' headline dated July 3, 2026, but the underlying press release is blocked by a Cloudflare challenge on every fetch attempt, so it was held pending verification instead of published on headline alone."
- *2026-07-05T18:12Z*: "All but one source had no content newer than the last sweep... Zero items added, updated, or held this run."
- *2026-07-06T11:41Z*: not a discovery sweep — an internal "SNR migration" backfill/rescoring pass.
- *2026-07-06T12:27Z*: "Narrow same-day re-check (~3h16m)... All sources fetched cleanly... Zero items shipped."
- *2026-07-06T12:53Z*: supervised correction pass (rescoring two existing items), not discovery.
- *2026-07-06T13:07Z*: "Filtered 14-source regulatory/financial/procurement backfill... none carried a filing, procurement notice, or press item dated inside the window... a genuinely quiet sweep."
- *2026-07-06T14:13Z, 15:34Z, 17:59Z*: supervised copy/attribution corrections, not discovery sweeps.
- *2026-07-06T17:25Z*: "Crawl-engine audit repair pass" — rescoring 6 previously-penalized items, not new discovery.
- *2026-07-06T22:41Z, 2026-07-07T00:25Z, 2026-07-07T05:10Z*: three consecutive narrow re-checks (~1.5h, ~99min, ~4h40m windows) each stating "every named source... returned unchanged or pre-window content. Zero items, a legitimate quiet outcome."

So of the 13 zero-add sweeps, only about 5 are genuine "checked everything, found nothing new" discovery sweeps; the other ~8 are interactive audit/correction/rescoring passes that never attempted discovery at all, which somewhat inflates the "sweep count" relative to actual news-gathering attempts.

**`coverage` field:** empty (unpopulated) in **6/29 sweeps (21%)** — SWEEP_MEMORY.md itself flags this as a bug (2026-07-06-D note: "Fill coverage with the categories genuinely searched; the 12:27 and 12:46 runs left it empty, which makes zero-add sweeps unauditable").

**`snr_movements` logged:** only **6/29 sweeps** carry this key, totaling **6 individual item rescores** (all discovered/fixed during the 2026-07-06 audit session): `2026-06-30-nasa-lunar-lander-awards` 3→4, `2026-07-04-gao-space-force-satellite-portfolio` 2→4, `2026-07-02-isar-aerospace-planet-germany-launch-deal` 4→5, `2026-07-02-true-anomaly-victus-haze-imaging` 2→4, `2026-07-06-planet-wolfgang-schmidt-advisory-board` 3→5, `2026-07-07-isar-aerospace-maritime-launch-nova-scotia` 2→3. Every one of these was a score going *up* after a bug fix or missed corroboration — i.e. the movements on record are all corrections of earlier under-scoring, not organic evidence accrual over time. No downward movement is on record.

**`signals` pass logged:** 9/29 sweeps record a signals-channel check; typical note: "5 of 6 fetchable channels checked... Nothing published inside this run's window." The signals pass has never (in any of the 9 logged instances, or anywhere in items.json — see §5) actually produced a sourced item.

---

## 3. Sources (`sources.json`)

**66 configured source entries** across 11 categories (eo_operators 14, launch_providers 11, iot_rf_operators 6, connectivity_operators 6, financial 6, regulatory 4, procurement 4, aggregators_crosscheck 4, non_english 5, human_spaceflight 3, launch_tracking 3).

**Status:** verified 48 (73%), unverified 17 (26%), dead 1 (SpaceX, `spacex.com/updates/`, flipped dead after 3 consecutive unrendered-JS-shell failures).

**Feed type:** html 53 (80%), rss_atom 6, rss 5, api_json 2 — the source list is overwhelmingly scrape-a-webpage rather than structured feeds, which is consistent with the huge volume of SWEEP_MEMORY.md notes about pages being JS shells, Cloudflare-gated, 403/404/redirected, or stale mirrors.

**Never-productive verified sources — the clearest evidence of a narrow, output-poor pipeline:** joining sources.json domains against every domain that appears anywhere in items.json (lead + secondary + corroboration), **28 of the 48 "verified" sources (58%) have never produced a single item**, including major named operators the site is explicitly supposed to track: Planet Labs, BlackSky, Maxar, Airbus D&S, Satellogic, Capella, Umbra, Synspective, Pixxel, Spire (all of `eo_operators`' non-ICEYE roster), Arianespace, ULA, RFA, Stoke Space (all of `launch_providers`), all 5 of the regulatory/procurement feeds (FCC IBFS, ITU SNL, NOAA CRSRA, EUSPA, NGA), CASC and CNES (non-English), Amazon/Kuiper and SES (connectivity), Axiom and Sierra Space (human spaceflight), and Kineis/Astrocast/Unseenlabs (IoT/RF). "Verified" here appears to mean "fetched successfully at least once," not "ever yielded a publishable story" — a source can be verified and still be structurally useless for the news pipeline (SWEEP_MEMORY documents many of these as JS-shell/Cloudflare/stale-listing failures even after being marked verified).

**Failure notes (from SWEEP_MEMORY, corroborated in sources.json's free-text notes field):** spacex.com dead (JS shell); rocketlabcorp.com listing page works via curl+UA but individual article pages are Cloudflare-gated; blueorigin.com 429s; starlink.com, ghgsat.com, he360.com, oqtec unreachable/JS shells; fcc.gov and spaceforce.mil time out or 403; SAM.gov and ESA esa-star are unrendered Angular shells requiring a keyed API neither run has had; several government URLs (NOAA CRSRA, EUSPA, NGA) had moved and needed a manual redirect chase; fcc.report/IBFS returns 200 but every filing is dated 2020-2023 (stale mirror masquerading as live).

---

## 4. Source reliability ledger (`source_ledger.json`)

The feedback loop exists structurally but **has not accumulated any real calibration data yet**:
- 10 distinct domains tracked, **23 total claims recorded**, **0 "events"** (i.e., zero strikes and zero credits have ever been logged for any source).
- **All 23 claims are `resolution: "unresolved"`** — not one has yet been confirmed, contradicted, or otherwise resolved. Given the dataset's 2026-07-08 "current date" and the fact almost every claim was logged within the last 1-2 days, this is expected at this stage, but it means **the ledger cannot yet demote or credit any source** — the "repeated strikes demote a source" and "confirmed early claims become signals_suggestions" mechanisms described in CLAUDE.md are entirely dormant. Spacenews.com alone carries 11 of the 23 claims (48%), again reflecting its outsized share of the lead-sourcing.

---

## 5. Signals (`signals.json`, `signals_suggestions.json`)

- **44 people** curated (33 whitelist=yes, 9 review, 2 no), plus 4 outlets and 12 excluded entries.
- Channel status across all people: verified_active 45, exists_activity_unverified 14, stale 1 (0 flagged fully dead).
- **All 33 whitelist=yes people have at least one verified_active channel** (33/33) — the whitelist itself looks well-maintained.
- Channel types: X/Twitter 38 (dominant), site 13, substack 3, LinkedIn 2, Bluesky 1, Beehiiv 1, podcast 1, YouTube 1.
- **Despite this, zero items in items.json cite any signals-tier or X-sourced claim** — no `class: "signal"`/`whitelist"` source, and no source URL on x.com or twitter.com anywhere in the 42 real items' `sources[]`. The 9 logged sweep signals-passes all report checking channels and finding nothing new; the signals discovery surface is being dutifully checked but has produced zero publishable stories to date.
- `signals_suggestions.json` is **structurally present but has an empty `suggestions: []` array** — the "source repeatedly produces confirmed claims → suggest for signals promotion" feedback loop has never fired, consistent with the ledger having zero resolved claims (§4) to trigger it.

---

## 6. `held.json`

Only **1 currently-held item**: the IRIDE (Italy/ASI Earth-observation) scope question (2026-07-06), flagged as a genuine scope judgment call for Florian rather than a sourcing problem. `state.json`'s cumulative `held` counter across sweeps is 4, meaning 3 earlier held items were resolved and released (the Rocket Lab/Iridium acquisition item, held 2026-07-05 for a Cloudflare-blocked press release, was released once the SEC 8-K exhibit was found — see SWEEP_MEMORY 2026-07-05-H).

---

## 7. SWEEP_MEMORY.md — recurring themes

637 lines, 2026-07-05 through 2026-07-07 (all entries fall in the same ~2.5-day bring-up window as the sweep log itself — no lessons predate or postdate that window).

1. **Fetch reliability / JS-shell & Cloudflare blocking (recurs constantly, 07-05 through 07-07).** spacex.com (dead), rocketlabcorp.com article pages, blueorigin.com (429), starlink.com, ghgsat.com, he360.com, oqtec, DLR, AST SpaceMobile (ast-science.com), Eutelsat media centre, SAM.gov, esa-star all return either unrendered JS/Angular shells or hard blocks. Workarounds found piecemeal: curl with a descriptive User-Agent unblocks several (SEC EDGAR, Launch Library, rocketlabcorp.com's listing page, NASASpaceflight's RSS `content:encoded` field bypassing article-page 403s).
2. **Wrong/stale configured source URLs (07-05 D, 07-06 H/M/N/V/Z, part-B backfill).** Over half of one backfill run's sources had wrong or stale newsroom paths (ULA, Isar Aerospace, Stoke Space, Arianespace all had real feeds one hop away from the configured URL); NOAA CRSRA, EUSPA, NGA URLs had moved; iceye.com/press needed `-L` to follow a redirect; fcc.report/IBFS returns 200 but with filings dated 2020-2023 (a stale mirror, not a live feed) — a "clean fetch" is not proof of current data.
3. **Corroboration-crawl scope bug (07-06-CC, the single most consequential fix logged).** The crawl was originally wrongly confined to a run's named-source filter, causing `found_none` penalties that were really just "not on this run's short list" rather than "not on the web" — this incorrectly docked at least 3 items (True Anomaly/VICTUS HAZE, Sybilla Technologies, Verde Technologies) to SNR 2 before a same-day audit caught and rescored them.
4. **Anti-spoof host-matching bug for IR subdomains (07-06-W/FF, fixed 07-07-E via PR #82).** `investors.planet.com` / `ir.blacksky.com` initially failed to match their companies' registered apex domains as first-party, forcing a `wire_pr` workaround for company press releases that should have scored as first-party; fixed by stripping `www.` before the host comparison.
5. **Dedup/reconciliation judgment (07-06-II/JJ, 07-06-L).** Same-story developments inside the 7-day window must be patched as updates, not new items (Iridium/Aireon vs. the original Rocket Lab/Iridium item); several runs found free corroboration already sitting unused in already-fetched feeds simply because no one cross-checked existing items against the full fetched set, not just new candidates.
6. **Summarizer/date-trust traps (07-05-Q second entry, 07-06-HH, 07-07-F/G, recurs across nearly every session).** WebFetch's summarized text produces paraphrased "quotes" and wrong or ambiguous dates (byline-relative dates, publish-date-vs-event-date confusion, an old press release resurfacing under an near-identical title a year later); the recurring fix is to trust the primary/first-party timestamp over a trade summarizer's stated date, and to re-fetch live pages before treating summarizer text as verbatim.
7. **Backfill/discovery-window discipline (07-05-J, 07-06-F).** On a source-list-restricted run, do not fetch any domain outside the list even to upgrade an existing claim's classification; this rule was nearly broken once (07-06-F) but caught before publishing.
8. **Chinese-language collection risk (07-06-R).** Chinese proper nouns from a summarizing fetch are a hallucination risk; mitigated by requesting raw (untranslated) text a second time and publishing the English gloss alongside the original characters.
9. **Process/tooling friction, not sourcing (07-05-U, 07-07-C).** High sub-agent concurrency (~25 at once) triggered rate-limiting that killed a fan-out (fixed by capping waves at 3-5, banning sub-agent spawning in collectors); the sandbox in one session blocked `rm`/`mkdir` entirely, leaving orphaned scratch files.

---

## Summary of the most damning numbers

- 18 of the last 33 calendar days (55%) have **zero** published items; 83% of all items landed in one 10-day burst (06-29 to 07-07), not a steady twice-daily cadence.
- **spacenews.com is the lead source for 20 of 42 items (48%)**; the top 3 domains cover 69% of the feed, and only 12 distinct domains have ever led an item despite 66 configured sources.
- **28 of 48 "verified" sources (58%) — including Planet Labs, Maxar, Spire, ULA, Arianespace, and every regulatory feed — have never produced a single item.**
- The sweep log (`state.json`) only covers **2026-07-05 to 2026-07-07** (2.5 days), even though items go back to 2026-06-05 — most of the feed's own history has no audit trail.
- The source-reliability ledger has logged 23 claims and **zero resolved claims, zero strikes, zero credits** — the calibration feedback loop CLAUDE.md describes is not yet running. `signals_suggestions.json` is still empty, and none of the 42 items are sourced from any of the 44 curated Signals people despite 9 logged signals passes.

**Confidence: high** for all counted/derived statistics (all computed directly from the JSON files with Python, cross-checked by re-running key aggregations). **Moderate** for interpretive framing (e.g., which zero-add sweeps "count" as genuine discovery attempts vs. audit passes) since that required reading free-text `summary` fields rather than a structured flag.
