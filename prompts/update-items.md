---
prompt-id: mcc.update-items
prompt-version: 0.3.0
output-target: src/data/items.json (via scripts/finalize-sweep.ts)
schema: src/data/schema.ts
---

# MCC — Master Crawler Sweep

Single source of truth for refreshing the news feed and feeding the
registry crossfeed. Invoked on cron (twice daily) and manually. You
write a draft; deterministic scripts compute every SNR score, validate,
and merge. You do NOT edit `items.json`, `held.json`, `state.json`, or
`source_ledger.json` directly under any circumstance, and you never
hand-write an `snr`, `snr_trace`, or `sources` field.

CLAUDE.md governs editorial policy (scope, the SNR model, hard rules,
writing style). This file governs procedure. Read SWEEP_MEMORY.md before
starting and apply its lessons.

## Mission

Cast a wide net over the new space economy: EO, connectivity, launch,
commercial human spaceflight, and the regulatory, financial,
procurement, and geopolitical events that move them. Everything
on-scope publishes; the SNR score, not withholding, carries the
uncertainty. A single informal source is a publishable SNR-1 item when
it is on scope and honestly labelled. Zero items is still a valid sweep
result when nothing on-scope happened; padding is still the bug.

## The loop, per detected event

1. **Briefing.** Run `bun scripts/sweep-context.ts`. It prints
   `{ now, lastSweep, feedSize, existing[] }` where `existing[i]` is
   `{ id, normId, source_url, headline }`.
2. **Discovery.** Work through `src/data/sources.json`: fetch every
   source with status `verified` or `unverified`, collect candidates
   newer than `lastSweep`, filter against the CLAUDE.md scope, discard
   out-of-scope candidates silently. Record source health as before
   (first success flips `unverified` to `verified`; third consecutive
   failure flips to `dead` with a dated note and `fail_count`).

   **Signals pass (part of discovery, exempt from the source filter).**
   Run `bun scripts/signals-context.ts`. It prints
   `{ lastSweep, fetchable[], xSearch[], fetchableCount, xCount }` from
   `signals.json` (read-only; you never edit it). The `fetchable`
   channels (`site`, `substack`, `beehiiv`, `bluesky`) are the reliable
   leg and are MANDATORY: fetch each one (use its `rss` when present)
   and collect on-scope factual posts newer than `lastSweep` as
   candidates like any other source. The `xSearch` handles are the
   best-effort leg: run targeted WebSearch for recent posts, and note
   that an X post is usable only when its exact text was actually
   retrieved this run via the public syndication endpoint
   (`https://cdn.syndication.twimg.com/tweet-result?id=<status_id>&token=a`
   returns a post's verbatim text) or another working rendering; a
   search snippet alone never supports a fact. Budget: at most **15
   fetches per sweep**; if `fetchableCount` exceeds what the budget
   allows, rotate so every fetchable channel is covered at least
   weekly and say so in the note. Channel finds are classed per the
   whitelist rules in step 6; jokes, opinions, and off-topic posts are
   discarded silently. Record the outcome in the draft's `signalsPass`
   block (required whenever `fetchableCount > 0`): `checked` = the
   fetchable channel URLs you fetched this run, `xAttempted` = how many
   X handles you searched, `note` = one line on what was found (or why
   `checked` is empty: rotation, all unreachable). finalize-sweep
   rejects a draft that omits it or lists a URL that is not a fetchable
   channel.
3. **Known to MCC?** Match each candidate against `existing[]` by actor
   and event class:
   - Same event within **7 days** → it is an update, never a new item.
     Attach the new source (`updates[].attach`) and, when it genuinely
     adds corroboration, set the matching `bump`. When the new source is
     better than the current lead, also switch `source_url` in the
     patch (the upgrade path; the id never changes).
   - Match at **8-30 days** against an existing item at **SNR 1-2** →
     reinforcement: `updates[].attach` plus `bump: "reinforcement"`.
   - Anything else → a new item, cross-linked in `secondary_urls` when
     an older related item exists.
4. **Corroboration crawl.** MANDATORY for every NEW candidate: actively
   search for other coverage of the same claim. The mechanism is
   **WebSearch, on the open web**: run 1-2 searches per event (actor +
   the event's distinguishing noun; add the program or contract name
   when there is one), then fetch the strongest distinct hits. The
   run's source filter NEVER constrains this step: the filter governs
   discovery (which feeds you walk for candidates), not corroboration
   (verifying a claim you already found). Cross-checking the run's own
   fetched feeds does not count as a search; `found_none` is a claim
   about the web, not about your source list. Budget: at most **5
   fetches per event, 40 per sweep** (a WebSearch call counts as one
   fetch); when two candidates compete, seismic ones get the budget
   first. The budget covers 8 events per sweep, so `"not_attempted"`
   is only legal when the draft has more than 8 new items and the
   budget genuinely ran out; finalize-sweep REJECTS drafts that skip
   crawls the budget covered. Direct-source leads (first-party,
   official record, computed) take no penalty when nothing is found,
   but the crawl still runs: readers get every source that exists
   attached to the card. Outcomes:
   - Coverage found → attach each additional source to the item's
     `scoring.sources` with `"via": "corroboration"` and set
     `"crawl": "found_some"`.
   - You searched and found nothing → `"crawl": "found_none"` (this
     costs the item one SNR level; a claim nothing else mentions is
     weaker than its source suggests).
   - Budget exhausted before this event → `"crawl": "not_attempted"`
     (no penalty; never claim `found_none` for a search you did not run).
   Sources are distinct only if independent: wire rewrites and
   syndicated copies of one story count as ONE source. Do not stack
   near-identical URLs to farm corroboration.
5. **Registry crossfeed check.** For each claim that touches a registry
   fact (counts, statuses, dates), compare like-for-like FIRST:
   cataloged-on-orbit, operates, launched, and announced are different
   metrics, and computed/orbital figures are authoritative ONLY for
   "cataloged on orbit, as_of date" — they never contradict
   "operational" or "announced" claims. On a genuine same-metric
   contradiction with a registry fact: state the tension explicitly in
   the item copy (attributing both sides) and add an edit-queue entry
   to `held` describing the conflict for Florian. Do not silently pick
   a side; automated dispute mechanics land with the registry sink.
6. **Classify sources honestly.** Every source you attach carries a
   `class`; the deterministic gate scores from it, so misclassification
   is the cardinal sin of this pipeline:
   - `first_party`: the actor itself, on its own domain (or its
     official corporate account). The gate verifies the domain against
     the registry and rejects fakes; press-wire copies (BusinessWire,
     GlobeNewswire, PR Newswire) are `wire_pr`, not first party.
   - `official_record`: regulator, court, procurement register, SEC —
     official domains only.
   - `computed`: CelesTrak, Space-Track, Launch Library records.
   - `trade`: SpaceNews, Payload, European Spaceflight, and peers.
   - `mainstream`: general press (Reuters, FT, NYT ...). Their pickup
     of a space story is a corroboration signal.
   - `whitelist`: a signals.json person with `whitelist: "yes"` via a
     `verified_active` channel, honoring `ingest_rules`. Set
     `scoring.whitelist` to `"self"` when the concerned party speaks
     about itself, `"observer"` for a whitelisted third party — and
     ONLY for on-topic factual claims; jokes, opinions, and off-topic
     posts get `null` and class `informal`.
   - `informal`: everything else that is still attributable. Anonymous
     rumours stay out entirely.
   Flag `scoring.extraordinary: true` for out-of-pattern or
   extraordinary claims; the gate also forces it for any seismic item
   whose lead is not first-party/official/computed.
7. **Draft.** Write `sweep-draft.json` at the repo root:
   ```json
   {
     "newItems": [
       {
         "id": "YYYY-MM-DD-actor-slug",
         "date": "YYYY-MM-DD",
         "headline": "...",
         "explainer": { "tagline": "...", "what_happened": "...", "why_it_matters": "..." },
         "tags": [], "category": "...", "impact": "seismic|notable|noise",
         "companies": [],
         "source_url": "lead source, must equal scoring.sources[0].url",
         "secondary_urls": [],
         "scoring": {
           "sources": [
             { "url": "...", "outlet": "SpaceNews", "class": "trade" },
             { "url": "...", "outlet": "Reuters", "class": "mainstream", "via": "corroboration" }
           ],
           "extraordinary": false,
           "crawl": "found_some|found_none|not_attempted",
           "whitelist": null
         }
       }
     ],
     "updates": [
       {
         "id": "existing-id",
         "patch": { },
         "note": "what changed and why",
         "attach": [ { "url": "...", "outlet": "...", "class": "...", "via": "corroboration" } ],
         "bump": "reinforcement"
       }
     ],
     "held": [ { "candidate": { }, "reason": "edit-queue reason, one line" } ],
     "sourceHealth": [ { "name": "...", "status": "verified|dead", "note": "..." } ],
     "signalsPass": {
       "checked": ["https://spacepolicyonline.com/feed/"],
       "xAttempted": 6,
       "note": "3 fetchable channels checked, nothing new in window; searched 6 X handles, no on-scope first-party post retrievable"
     },
     "summary": "1-2 sentence sweep summary",
     "coverage": ["launch", "regulatory"]
   }
   ```
   `held` is an EDIT QUEUE, not a sourcing quarantine: schema conflicts,
   same-metric contradictions, and open editorial decisions for Florian.
   Never hold an item just because its sourcing is weak; that is what
   low SNR is for.

   Check the queue for rulings: a held entry carrying
   `decision: { verdict: "publish" }` has been approved by Florian. Draft
   it as a new item THIS SWEEP (normal copy rules, honest scoring block,
   corroboration crawl included) and list its exact candidate.headline in
   the draft's top-level `"resolveHeld": [...]` so the entry leaves the
   queue in the same merge. Never resolve an entry without a decision.
8. **Finalize.** Run `bun scripts/finalize-sweep.ts`. It computes each
   item's SNR and trace from your scoring block (the math is code, your
   inputs are attested judgment), verifies first-party domains, applies
   the automatic 14-day persistence bumps, records calibration claims
   in the source ledger, logs every SNR movement, stamps publish dates,
   and merges. If it rejects the draft, its message says exactly what
   to fix; fix the draft and rerun. Never bypass it.
9. **Memory.** If this run taught you something durable (a source
   changed structure, a corroboration trap, a metric-mismatch case
   worth remembering), append a short dated entry to `SWEEP_MEMORY.md`.
   Skip routine runs.

## Inclusion bar

An item ships when all are true:
- In scope per CLAUDE.md
- Tagged with its domain tag (`eo`, `connectivity`, `launch`,
  `human-spaceflight`) where one applies, per the CLAUDE.md tag tiers
- Every source URL was fetched this run and every stated fact appears
  in a linked source; numbers copied exactly or omitted
- The copy attributes claims ("ICEYE says", "per the FCC filing",
  "per SpaceNews", "per @handle on X") and never claims more certainty
  than the sources support. When the lead is not first-party, the
  headline names the sourcing ("SpaceNews: ...", "Per @handle: ...")
- New information, not a rewrite of an existing item (use `updates` for
  developments on an existing story)
- A commercial director at an operator, reseller, or investor would
  want to know — even as an early, low-SNR signal

## Importance calibration (impact field)

- `seismic`: reshapes competitive dynamics; you would interrupt
  someone's Monday for this (major M&A, operator failure, flagship
  cancellation, first flight of a new vehicle)
- `notable`: belongs in their weekly read
- `noise`: belongs in the record
Appointments: routine executive hires (CFO, CAO, SVP) stay below the
inclusion bar, per standing precedent. The exception is a senior
government or political figure joining a tracked company (board,
advisory board, executive role): that is a commercial-access signal
and ships as `notable` (the Wolfgang Schmidt/Planet case).
When torn between two levels, pick the lower one. Importance and SNR
are independent axes: a seismic rumour is seismic AND low-SNR, and the
gate automatically queues seismic items at SNR 1-2 for Florian's
review while they publish.

## Hard reminders

- Zero fabricated URLs, figures, or dates. Ever.
- Source classes are attested judgment; the SNR math is not yours to
  run. Never write `snr`, `snr_trace`, or `sources` yourself.
- One story rewritten by five outlets is one source, not five.
- `found_none` means you searched and found nothing, never that you
  ran out of budget. `not_attempted` is only legal past the 8-event
  budget; the gate rejects anything else. A one-source card for a story
  other outlets covered is a defect (the Telesat Venezuela case).
- Do not commit or push; the workflow handles it.
- Do not edit the Signals data, registry entries, or site code in a
  sweep. Promotion-worthy sources go to `signals_suggestions.json`
  ONLY when they meet the SNR_PLAN A5 thresholds; you never touch
  `signals.json`.
