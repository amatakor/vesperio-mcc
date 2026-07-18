# SNR_SPEC.md — Signal-to-Noise Rework (v1.0)

*Brief for Claude Code. Supersedes the confirmed / reported / signal source ladder and the "no primary source, no publish" gate in CLAUDE.md. Those sections of CLAUDE.md must be rewritten as part of this work. Decisions below are locked; VERIFY flags mark the few points to resolve during planning, before any code is written.*

---

## 1. Philosophy change

Old model: withhold until a primary source exists. New model: **cast a wide net, publish, and quantify reliability.** Nothing on-scope is held back for sourcing reasons; instead every item and every registry fact carries a visible SNR score. The platform's credibility now rests on SNR calibration being honest, not on gatekeeping.

Consequences:
- `held.json` is no longer a sourcing quarantine. It survives only for genuine edit-queue cases (schema conflicts, open editorial decisions for Florian). Items previously held for "below ladder" now publish at low SNR.
- The confirmed / reported / signal tags are **removed everywhere**: schema, copy templates, UI. Do not map them 1:1 onto SNR values in copy; SNR replaces the concept, not the label.
- Importance tags change: `critical` → **`seismic`** (major industry shifts only), `notable` (medium), `noise` (small stuff). Importance and SNR are independent axes (see §7.4).

## 2. SNR definition

SNR is an integer 1–5, displayed as bars (radio-receiver style). Meaning:

| SNR | Meaning |
|---|---|
| 1 | Low confidence. Single source, rumor, out of pattern, extraordinary claim with little evidence. |
| 2 | Same as 1 but with more than one source, OR from a usually-reliable / whitelisted source, OR another signal confirming a prior 1. |
| 3 | Multiple informal sources (opinion pieces, X posts), or a few reputable sources (legacy media, industry papers, industry-leader social accounts). |
| 4 | Wide reporting: multiple sources, media + social, or a long-standing signal that hasn't faded or been debunked. |
| 5 | Quasi-certainty. Direct source from the concerned party: press release, first-party site or social account, official filing. |

### 2.1 Scoring mechanics

SNR is computed, clamped to [1, 5]:

- **Base tier** = tier of the best source attached to the claim (per the table above).
- **Corroboration:** each additional source raises confidence. Multiple sources is a good signal in this industry; do **not** collapse rewrites into "independent origins." Count sources. Bonus weight when a claim is picked up by **non-trade outlets** (general/mainstream press covering a space story).
- **Extraordinary claims start low.** Out-of-pattern or extraordinary claims enter at 1 regardless of source count and must climb via corroboration or persistence.
- **Persistence:** a claim that survives uncontested over time (not debunked, not faded) can rise toward 4. Define the window in planning (VERIFY: suggested 14 days uncontested = +1, once).
- **Reinforcement:** if a new event matches an existing low-SNR item in MCC, the existing item's SNR improves by one level (and the new source attaches to the existing card; see §4).
- **Contradiction:** handled by reconciliation, not blanket downgrade (see §6).
- Saturation: no modifier applies twice for the same reason. A claim cannot ping-pong upward from repeated copies of the same story.

### 2.2 Whitelist floor (scoped)

Sources in `signals.json` (the Signals whitelist) produce **SNR 4 minimum**, with two scope limits:
1. The floor applies only to **on-topic factual claims** (CLAUDE.md scope). Jokes, opinions, off-topic posts get no floor. (This is why the Musk keyword-filter note in SIGNALS.md matters; a whitelisted account is not a blank check.)
2. **Concerned party speaking about itself = SNR 5**, not 4. A whitelisted observer reporting on a third party gets the 4 floor.

### 2.3 First-party and Wikipedia in the registry

Registry facts sourced from **Wikipedia or first-party websites carry no SNR score**. They are treated as equal; the UI simply links the source (current behavior, unchanged). Everything else in the registry carries an SNR badge.

## 3. Master crawler / aggregator

Replace the separate news-sweep and registry-crawl ingestion with **one master crawler** feeding both surfaces.

Per detected event, the engine runs this loop:
1. **Known to MCC?** Match against `items.json` and registry facts (same actor + same event class; the old 7-day dedup window is the starting heuristic, VERIFY whether it still fits).
   - Known + reinforces a low-SNR fact → bump that fact's SNR by one, attach the new source to the existing card. No new item.
   - Unknown → score fresh per §2.1.
2. **Corroboration crawl:** actively search for other sources confirming the claim. Found → crawl them, attach to the news card, apply corroboration. Not found → reduce SNR by one (a claim nothing else mentions is weaker than its source tier suggests).
3. **Registry crossfeed check** (§6).
4. Route to sinks (§4, §5).

Cost discipline: keep the model cascade. Cheap model (Sonnet or below) for fetch, dedup, provenance extraction, base tiering. Expensive model only for adjudication: contradictions, extraordinary claims, anything tagged seismic. This engine is heavier than the old filter; the corroboration crawl in particular must be budgeted (VERIFY: cap corroboration fetches per event, suggested 5).

## 4. News feed sink

- Every card shows an **SNR icon**: 5 bars, N glowing/colored.
- Clicking the icon opens a small popover explaining the calculation for that item: base source tier, each modifier applied, and the sources behind it. This explanation must be generated and stored at scoring time (a `snr_trace` field on the item), not reconstructed on demand.
- Cards accumulate sources over their life: reinforcing events attach rather than duplicate.
- Importance tag (`seismic` / `notable` / `noise`) displayed independently of SNR.

## 5. Registry sink — two tiers

- A fact reaching **SNR ≥ 3** enters the registry **if the field is missing or the claim does not contradict a higher-SNR fact**.
- **Provisional tier (SNR 3):** visible, badged, clearly marked provisional. Provisional facts **do not adjudicate** other claims (excluded from the crossfeed in §6).
- **Canonical tier:** SNR 4–5 facts, first-party facts, Wikipedia facts, and computed/orbital data. Only canonical facts adjudicate.
- Registry facts carry the same clickable SNR badge + trace as news cards (except the no-SNR Wikipedia/first-party facts, which just link the source).
- Existing merge discipline stays: null-fill only, never overwrite silently, one source per field, unknown stays null.

## 6. Registry crossfeed: reconciliation, not blanket −1

When a new claim contradicts a registry fact:

1. **Compare like-for-like first.** Many "contradictions" are metric mismatches. Canonical example: orbital data says 22 ICEYE satellites on orbit (cataloged, as_of date); a claim says ICEYE "operates 49." On-orbit-cataloged and operates are different metrics, and catalogs lag launches. Metric mismatch → no downgrade; annotate the relationship instead.
2. Genuine same-metric contradiction → **higher SNR side leads.** The lower-SNR claim is downgraded by 1 and marked disputed; the losing side stays visible with its badge.
3. If the new claim wins (e.g., SNR 5 first-party vs an SNR 3 provisional fact), the registry fact is flagged for refresh, not silently overwritten. Refresh goes through the normal merge gates.
4. Same-metric clash at equal SNR → both marked **disputed**, both shown, item queued for Florian.
5. Provisional (SNR 3) registry facts never trigger downgrades of incoming claims.
6. **Monotonic counters are superseded in time, never contradicted** (2026-07-18, from the Vikram-1 first flight: the registry's pre-launch "0 flights, as_of 2026-07-08" dispute-downgraded the launch item; both values were true on their own dates). For cumulative count fields that only ever grow (`flights_total`, `flights_successful`, `sats_launched_total`, `launches_total`), an incoming count **greater than or equal to** the registry value, from an item dated **on or after** the fact's `as_of`, is a refresh proposal (entry bar permitting), never a dispute. A count LOWER than a past snapshot remains a genuine conflict and reconciles normally. Fields that can go down (`sats_active_claimed`) are excluded. Code: `MONOTONIC_COUNT_FIELDS` in `scripts/lib/crossfeed.ts`.

## 7. Feedback loops

### 7.1 Source reliability ledger (platform memory)

New store (suggest `source_ledger.json`): rolling reliability score per source.
- Repeated SNR downgrades of a source's claims → source demoted (reputable → informal), which lowers the base tier of its future claims.
- **Decay and recovery:** demotion is not permanent. Old strikes decay (VERIFY window: suggested 90-day rolling), and a demoted source that produces claims later confirmed at high SNR climbs back. Distinguish "was wrong" from "was early and later confirmed": a claim that starts at 1 and ends at 4+ is a **credit**, not a strike.
- Ledger updates happen in scheduled runs; the ledger is machine-owned but human-auditable (render a page or report from it).

### 7.2 Signals promotion: suggestion queue only

- A source repeatedly producing high-SNR facts becomes a **promotion suggestion**, written to a queue (suggest `signals_suggestions.json`).
- **The agent never writes to `signals.json`.** Florian reviews and approves. This preserves the existing hard rule and prevents the self-reinforcing loop (auto-promoted source → SNR 4 floor → more "high-SNR" output → looks even better).
- Promotion criteria: high-SNR facts that were **corroborated independently of the floor**, over a sustained period. VERIFY thresholds in planning.

### 7.3 Orbital / computed data

- Computed figures (CelesTrak-derived counts, LL2, SATCAT) are canonical registry inputs and feed the crossfeed, but **scoped to what they actually measure**: "N on orbit, cataloged, as_of DATE." They are authoritative for cataloged on-orbit counts only. They cannot distinguish operational / deployed / test, so they must never be used to contradict "operational" or "announced" claims (see §6.1).

### 7.4 Seismic + low SNR

The most dangerous card: huge if true, barely sourced. Rules:
- It publishes (wide-net principle) but the UI must make low confidence unmissable at the seismic display size.
- It cannot enter the registry (below SNR 3 anyway) and cannot be auto-amplified (no pinning, no digest lead) without human review.
- Anything tagged seismic at SNR ≤ 2 also lands in Florian's review queue.

## 8. What Florian owns (revised)

- `signals.json` (approves suggestions from the queue; agent never writes)
- Disputed same-metric parity cases (§6.4)
- Seismic items at SNR ≤ 2 (§7.4)
- Scope changes, structural/schema edits, outlet-policy changes (unchanged)
- Periodic audit of the source ledger

## 9. Migration notes

- Strip `confirmed` / `reported` / `signal` from item schema and all copy templates. Backfill existing items with an SNR derived from their old tier (suggested mapping for backfill only: confirmed→5, reported→3, signal→2; VERIFY).
- Rename `critical` → `seismic` in schema, copy, and UI.
- Release `held.json` items that were held purely for sourcing; score and publish them.
- Rewrite the CLAUDE.md editorial section: replace the ladder with §2 of this spec; keep scope rules, merge gates, and the agent-never-edits-signals rule.
- SWEEP_MEMORY.md keeps working as the lessons store; source-level lessons now also flow into the ledger.

## 10. VERIFY flags (resolve in planning, before code)

1. Persistence window and bump size (§2.1).
2. Dedup/match window for "known to MCC" (§3.1).
3. Corroboration-crawl fetch cap per event (§3.2).
4. Ledger decay window and demotion/recovery thresholds (§7.1).
5. Signals promotion thresholds (§7.2).
6. Backfill mapping for existing items (§9).
7. UI treatment of "disputed" (badge? strikethrough? side-by-side?) — needs a design pass.

---

*End of SNR_SPEC v1.0.*
