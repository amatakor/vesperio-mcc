# SNR_PLAN.md — Implementation plan for SNR_SPEC v1.0

*Planning output, 2026-07-06. All SNR_SPEC §10 VERIFY flags resolved below (numeric defaults confirmed with Florian where they were his call). No code yet; this document is the contract for the build PRs.*

## A. VERIFY flag resolutions

### A1. Persistence (§2.1)
- **+1, applied once, after 14 uncontested days** from first publication. Cap at 4 (persistence alone never makes quasi-certainty).
- "Uncontested" = not disputed, not downgraded, no contradicting claim seen by the crawler, and the item's sources took no ledger strikes in the interim.
- Deterministic (age check in code), applied during scheduled sweeps, recorded in the trace as `persistence_14d: +1`.
- Deliberate non-feature: published SNR does **not** decay downward over time. "Faded" only matters as the absence of the persistence bump; downgrades happen through contradiction/reconciliation only.

### A2. Dedup / "known to MCC" match window (§3.1)
- Same actor + same event class within **7 days** → same event. Attach the new source to the existing card, apply corroboration. No new item.
- Items still at **SNR ≤ 2** get an extended **30-day reinforcement window**: a matching claim inside it attaches and bumps +1 (the §2.1 reinforcement rule). Rationale: low-SNR claims resurface slowly; 7 days would orphan the confirmation.
- Beyond both windows → new item, cross-linked to the old one in `secondary_urls`.
- Registry facts match by (entity, field), no time window.

### A3. Corroboration crawl budget (§3.2) — Florian: standard
- **5 fetches per event**, early exit once SNR reaches 5.
- **40 corroboration fetches per sweep** total; seismic candidates go first in the queue.
- Calibration rule: the "nothing found → −1" penalty applies **only when the crawl actually ran** for that event. Budget exhaustion is not evidence of absence; the trace then records `corroboration: not attempted (budget)` and no penalty.

### A4. Source ledger decay / thresholds (§7.1)
- Store: `src/data/source_ledger.json`. Rolling **90-day window**; events older than 90 days are ignored for decisions (kept for audit until pruned at 365 days).
- Event types per source: **strike** (a claim downgraded by genuine same-metric contradiction or debunk), **credit** (a claim that entered at ≤2 and later reached ≥4, or was later first-party-confirmed — "early, not wrong"), neutral otherwise.
- **Demotion** (one reliability class down, e.g. reputable → informal): ≥3 net strikes in window **and** strikes ≥ 1/3 of that source's scored claims in window (rate guard: prolific sources are not demoted on absolute count).
- **Recovery** (one class up): ≥3 net credits in window, or 90 consecutive days with zero strikes.
- Ledger updates run in scheduled sweeps; machine-owned; rendered to a human-auditable report page.
- **Calibration tracking (from day one):** every scored claim records its `snr_at_publication` and, when the ledger later resolves it, a `resolution` (`confirmed` / `debunked` / `unresolved`). This enables the calibration report ("of claims published at SNR 2, N% were later confirmed") — internal first, publishable once the sample is meaningful. Impossible to reconstruct retroactively, so it ships with the engine, not later.

### A5. Signals promotion thresholds (§7.2)
- A non-whitelisted source earns a suggestion in `src/data/signals_suggestions.json` when, over a window of **≥30 days**, it produced **≥5 distinct claims that each reached SNR ≥4 through corroboration independent of any whitelist floor**, with zero ledger strikes in the window.
- The suggestion carries the evidence list (claims, final SNRs, corroborating sources). Agent never writes `signals.json` (unchanged hard rule).
- Implementation note (engine review fix, 2026-07-06): the ledger qualifies claims by **resolution `confirmed`**, not by publication score. An informal account publishes at 1-2 by definition; "started low, ended confirmed" is exactly the pattern promotion looks for. The resolver marks `confirmed` when a claim reached SNR ≥4 floor-independently or was confirmed first-party.

### A6. Backfill of existing items (§9)
- Only 22 published items exist → **re-score all of them through the real engine**, generating genuine `snr_trace` values, rather than a mechanical stamp. The spec mapping (confirmed→5, reported→3, signal→2) is used only as the base-tier prior; existing `secondary_urls` count as corroboration.
- Impact rename across schema, data, copy, UI: `critical` → `seismic`, `routine` → `noise`, `notable` unchanged. (Current data: 1 critical, 19 notable, 2 routine.)
- `held.json`: the single held item (Rocket Lab–Iridium acquisition, held only for a Cloudflare-blocked article body) **releases and publishes**: first-party press release = base 5, body-unfetchable noted in the trace, trade coverage attached by the corroboration crawl. Likely `seismic` at SNR ≥4, which needs no review gate.
- Registry backfill by source class (Florian's calls):
  - Wikipedia + first-party (incl. agency sites for their own programs): **unscored**, link only (§2.3). ~914 fields.
  - Launch Library + Gunter's (aggregators): **canonical, SNR 4 badge**, trace reason "established aggregator, single reference". 538 fields.
  - CelesTrak / computed: **canonical, SNR 5 badge**, always with the §7.3 scope annotation ("cataloged on-orbit, as_of DATE"). 44 fields.
  - Press-sourced fields: **canonical, SNR 4** (grandfathered: they passed the adversarial collector/verifier pipeline; that is credited as corroboration in the trace). 37 fields.

### A7. Disputed UI (§6 / §10.7) — Florian: inline, house style
- **DISPUTED tag in `--warn`** rendered beside the SNR bars. No strikethrough (contested ≠ dead).
- Registry disputed fields show **both claims stacked**, higher SNR first, each with its own SNR badge and source link.
- News cards mark disputed state on the card and explain it in the trace popover.
- Seismic + SNR ≤ 2 (§7.4): card renders with the low-SNR state visually dominant at seismic display size (exact treatment iterated on the live preview with Florian's product review, per house workflow).

## B. Scoring math (concrete, for the deterministic engine)

`score(claim) → {snr, trace}`, pure function, clamped [1, 5]:

1. **Base** = tier of best attached source per the §2 table. Source class comes from: signals whitelist (floor rules), `sources.json` class, first-party detection, minus any ledger demotion in effect.
   - **First-party domain verification (anti-spoof):** a source earns tier 5 only when its domain matches the actor's registry-recorded official website (or a corporate/executive account listed in `signals.json`). Press-wire hosts (businesswire.com, globenewswire.com, prnewswire.com, prweb.com) cap at 4 until the actor's own domain confirms. Rationale: fake press releases are a documented attack (Walmart/Litecoin, Kroger), and wide-net publishing removes the hold reflex that used to catch them.
2. **Extraordinary-claim override**: flagged out-of-pattern claims force base to 1 regardless of source count (§2.1); they climb only via modifiers.
   - **Deterministic guardrail (code, not judgment):** any claim that would carry `seismic` whose best source is below verified first-party is automatically extraordinary. The model may flag more claims as extraordinary, never fewer.
3. **Modifiers**, each applied at most once (saturation rule):
   - `+1` if ≥2 total distinct sources
   - `+1` if ≥4 total distinct sources
   - `+1` if a **non-lead** source is a non-trade/mainstream outlet (pickup = coverage beyond the lead; a lone mainstream source is just tier 3 per the §2 table)
   - `−1` if the corroboration crawl ran and found nothing
   - `+1` reinforcement when a matching later event attaches (per A2)
   - `+1` persistence (per A1)
   - **Direct-source ceiling (engine review fix, 2026-07-06):** upward modifiers never lift a claim above 4 unless the lead source is tier 5 (first-party, official record, computed) or the whitelist self floor applies. SNR 5 is definitionally a direct source (the §2 table's tier 4 IS "wide reporting"), so no amount of indirect corroboration reaches it. Subsumes the wire-PR cap in B1.
4. **Distinctness**: sources are deduped by outlet; verbatim wire rewrites collapse to one source. (Deciding "rewrite vs independent report" is agent judgment; the code just counts what the agent attests.)
5. **Whitelist floor** (§2.2): on-topic factual claims only; third-party reporting floors at 4, concerned party about itself = 5.
6. Every step appends to `snr_trace`; the trace is stored at scoring time, never reconstructed. Traces are **append-only over the item's life**: later changes (reinforcement, persistence, dispute) append `history` entries `{date, from, to, reason}` and never rewrite earlier entries. Every trace carries a `scorer_version` so future tuning of the math never makes old and new scores silently incomparable.
7. **Scoring unit**: SNR scores "the actor stated this / this happened", not the truth of the content. First-party puffery ("world's largest constellation") is attributed in copy, never scored as fact.

Division of labor: the **math is code** (`scripts/snr/`), fully unit-tested; the **judgment inputs** (source class attestation, extraordinary flag, metric-mismatch vs genuine contradiction, rewrite vs independent) come from the agent, cheap model where possible, expensive model for adjudication (contradictions, extraordinary claims, seismic) per §3 cost discipline.

## C. Schema changes

**Item** (`items.json`):
- Remove `confidence`. Add `snr` (int 1–5), `snr_trace` (`{base: {tier, source, reason}, modifiers: [{type, delta, reason, source?}], final}`), `disputed` (bool, default absent).
- Add `sources`: array of `{url, outlet, class, added, via}` accumulating over the card's life. `source_url` stays as the lead source (best tier) for compatibility with prerender/feed/thumbs; `secondary_urls` is absorbed into `sources` by the migration.
- `impact` enum → `seismic | notable | noise`.

**Registry field** (sourced-field shape):
- Optional `snr`, `snr_trace`, `tier: "canonical" | "provisional"`, `disputed: {competing: [{value, source, as_of, snr}]}`. Absent SNR = unscored (Wikipedia/first-party), current rendering unchanged.
- Merge gates unchanged: null-fill only, one source per field, never overwrite silently; SNR ≥3 required to enter at all, provisional facts never adjudicate.

**New stores**: `source_ledger.json`, `signals_suggestions.json`. `held.json` survives for genuine edit-queue cases only (schema conflicts, Florian decisions: disputed parity §6.4, seismic ≤2 §7.4).

**Validators**: `check-feed` / `check-registry` updated (snr range, trace present iff snr present, impact enum, disputed shape); new invariant checks: seismic+SNR≤2 must exist in the review queue; provisional facts must be SNR 3 exactly.

## D. Build slices (order, PR-per-slice, frugal-fable routing)

1. **Schema + validators** — schema.ts, check scripts, tests. High stakes, small: Fable directly.
2. **Scoring engine** — `scripts/snr/` (score.ts, match.ts, ledger.ts, reconcile.ts) + unit tests covering every §2/§6 rule incl. saturation and the budget-exhaustion no-penalty rule. Correctness-critical: Opus-or-better candidates against this plan's contracts, Fable reviews diffs.
3. **Migration (one-shot script)** — re-score 22 items, impact renames, release held item, registry SNR backfill per A6, stamp traces. Runs once, output reviewed field-by-field before commit.
4. **Master crawler** — rewrite `prompts/update-items.md` into the §3 loop (known-to-MCC → corroboration crawl → crossfeed → sinks); update `update-items.yml`; `maintain-registry.yml` shrinks to computed-data maintenance + persistence bumps + ledger upkeep. Cascade: cheap model for fetch/dedup/extraction/base-tier, expensive for adjudication. Sweep log entries in `state.json` list **SNR movements** (upgrades, downgrades, disputes) alongside the counters; the public /log page renders them — the Log becomes "the machine's calibration, visible".
5. **UI** — SNRBars component + trace popover, replace confidence chips and the UNVERIFIED banner, seismic-low-SNR treatment, registry badges + disputed stacking, ledger report page, /log counters. Bounded components as Sonnet candidates against fixed contracts (orbits-PR3 pattern), Fable integrates; verified on live preview.
6. **CLAUDE.md rewrite** — replace the source ladder + hard-rule-1 sections with §2 of the spec; keep scope, merge gates, agent-never-edits-signals; SWEEP_MEMORY note that source-level lessons now also flow to the ledger. Two style rules survive the ladder's death explicitly: **attribution in copy** ("per SpaceNews", "ICEYE says", "per @handle on X") stays mandatory, and **puffery is attributed, never scored as fact** (B7).

Each PR: `bun run build` + tests green before merge (standing delegation applies). Order matters: UI (5) needs migrated data (3); the crawler (4) must not run against the old schema, so the cron prompt swap lands after 1–3 are on main. Slice 1 keeps validators transitionally accepting both old and new item shapes so every merge builds green; slice 3 flips enforcement to new-only.

**Rollout: first week supervised.** After the crawler goes live, Florian eyeballs the output of the first several sweeps before it is declared autonomous (same playbook as the original supervised sweeps). Riskiest window: empty ledger + unproven corroboration behavior against real anti-bot walls.

## F. Amendments (accepted by Florian, 2026-07-06)

Seven additions folded into the sections above: (1) first-party domain verification via registry website fields (B1); (2) deterministic extraordinary-claim guardrail for sub-first-party seismic claims (B2); (3) calibration outcome tracking from day one (A4); (4) append-only trace history + scorer_version, SNR movements rendered in /log (B6, D4); (5) attribution-in-copy survives (D6); (6) supervised first week (D, rollout); (7) SNR scores statements, not puffery (B7, D6).

## E. Cost / feasibility annotations (risks to watch)

- **Corroboration crawl is the cost center**: caps per A3; the no-penalty-on-budget-exhaustion rule prevents the cap from silently deflating scores.
- **Anti-bot walls** (Rocket Lab, fcc.gov, Stooq — see SWEEP_MEMORY): corroboration fetches will fail on some hosts; a failed fetch consumes budget but is logged as unreachable, not as "no corroboration exists" — the crawler should prefer the fetchable-outlet map.
- **Self-reinforcement loops** are closed by design: promotion is suggestion-only, floor-independent corroboration required, ledger credits require floor-independent confirmation.
- **Trace bloat**: `snr_trace` on every item and hundreds of registry fields grows JSON size; traces are capped to structured entries (no prose paragraphs) and the popover renders from structure.
- **Metric-mismatch detection** (§6.1) is the highest-judgment step in the pipeline; it stays with the expensive model and every mismatch annotation is logged for Florian's ledger audit.

*End of SNR_PLAN.*
