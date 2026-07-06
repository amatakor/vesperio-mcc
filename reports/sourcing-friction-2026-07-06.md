# Sourcing friction report — 2026-07-06

Input for the data-sourcing rework brief. Written from live experience
running the crawl and sweep pipeline; every example below actually
happened. The point is to name what each rule costs and what it
protects, so the brief can renegotiate deliberately instead of
rediscovering the pain.

## The three data surfaces have different risk profiles

1. **News items**: the product promise surface. Strict ladder
   (confirmed / reported / signal), zero tolerance. Nobody is asking to
   relax this.
2. **Registry reference fields**: already relaxed once (2026-07-05:
   Wikipedia + reputable press citable). Still governed by news-grade
   phrasing rules (verbatim quote, stated-not-derived) that produce most
   of the friction below.
3. **Computed figures**: CelesTrak tracking counts, fleet sums, stats
   page. Machine-owned, self-sourced, no crawling needed. The fleet-sum
   pattern (PR #65: computed at render time from sourced atoms, labeled
   "computed") solved a whole class of "unknown" complaints without
   touching sourcing policy. Extending this class is cheap.

## Observed friction, concrete cases

- **No-derivation blocks single-page entailment.** eoPortal states
  Pleiades Neo "comprises four identical satellites" and that "the
  final two were unsuccessfully launched". Four-launched follows
  necessarily, but combining two sentences is derivation, so the field
  stays null and the Airbus EO fleet sum stays dark. Same shape: a
  Gunter's page listing every launch of a series cannot source a
  launched-total because counting rows is derivation. Decision needed:
  is single-page entailment (or single-page row-counting, disclosed as
  such) acceptable for REGISTRY fields? A middle option exists: allow
  it but label the value "structured-data extraction" the way LL
  boolean/config extractions were disclosed.
- **One source per field.** A fleet total needs five source URLs;
  schema allows one. Worked around with render-time computed sums, but
  any future multi-source fact (a count corroborated by two pages, a
  date from a filing plus a webcast) has nowhere to put the second URL.
- **Closed outlet list vs. reputation judgment.** Wamda and Startup
  Daily events were collected, adversarially verified as factually
  accurate, then dropped in editorial review because the outlets are
  not on the named trade-press list. Meanwhile Via Satellite and
  Spaceflight Now were accepted without being on the original list.
  The list needs an owner and a documented extension procedure, or a
  reputation rubric agents can apply.
- **Verifiers check facts, not eligibility.** The Wamda/Startup Daily
  events passed adversarial verification because the verify rules say
  "does the page state the fact", not "is the outlet allowed". Fixed in
  prompts going forward (SWEEP_MEMORY 2026-07-06-A), but the rules
  files should encode it.
- **WebFetch summarization vs. verbatim quotes.** Fetches return
  model-summarized text, so collector "verbatim" quotes are sometimes
  paraphrase, which verification then has to re-litigate against the
  live page (SWEEP_MEMORY 2026-07-05-Q). Any workflow that depends on
  exact quotes needs raw-HTML fetching (curl) or must drop the verbatim
  requirement for low-risk fields.
- **Anti-bot walls are volatile.** fcc.gov, rocketlabusa.com,
  spaceforce.mil, SEC EDGAR (without contact UA), ghgsat.com blocked;
  but kineis.com and astrocast.com, unreachable on 07-05, fetched fine
  on 07-06. The fetchable-outlet map (SWEEP_MEMORY 2026-07-05-S) goes
  stale in days. Lesson encoded: always try the primary once. Structured
  APIs (Launch Library 2.3.0 agencies/config records) proved the best
  route around walls and should be preferred wherever they exist.
- **Dedup and upgrade loops are manual.** The upgrade rule (re-check
  reported/signal items against primary sources in later sweeps) exists
  on paper; nothing schedules it. held.json review is likewise manual.
- **Batch targeting from stale views wastes agent waves.** Two entities
  were collected and verified this morning although their data already
  existed (SWEEP_MEMORY 2026-07-06-B). Any new workflow should start
  from a machine-generated gap report (nulls, zero-event profiles,
  stale as_of dates), not from a human or model recalling what is
  missing. The gap scan is one bun script away from being a build
  artifact.

## What already works, keep it

- Collector -> adversarial verifier -> deterministic merge, with hard
  gates in the merge scripts (verdicts, fetched-URL allowlists, dash and
  date checks, never-overwrite). ~50 fabrications/derivations were
  caught across batches; none reached the site.
- Context firewall: agents write files, return summaries; waves of 3-5.
- SWEEP_MEMORY.md as the operational lessons ledger; rules files in
  prompts/crawl/ handed verbatim to agents.
- The relaxed registry policy (Wikipedia citable for reference fields)
  roughly doubled fill rate with no observed quality cost.

## Suggestions for the brief itself

- Declare which rules are sacred (no fabrication, no overclaim in news
  copy, visible confidence labels) vs. negotiable (entailment,
  row-counting, outlet list, quote verbatimness for registry fields).
- Specify the pipeline per data surface, not one pipeline for all three.
- Include the failure paths in the Figma flow (source unreachable,
  conflict between sources, held item aging out), not just the happy
  path. Most engineering effort lives there.
- Define who/what closes the loop on held items and upgrades, and on
  what schedule.
- State the target metric: fields filled per agent-hour, sweep items per
  day, or reader-visible completeness. The rework should be measurable
  against 2026-07-06 baselines: registry 139 profiles, 81% reference
  fields filled, 261 documented nulls, 55/139 profiles with history,
  ~20 feed items.
