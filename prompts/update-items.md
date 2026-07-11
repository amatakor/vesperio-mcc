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
2. **Discovery.** The window is always the full gap since `lastSweep`;
   never narrow it to a fixed number of hours. Two legs, in order:

   **Queue first.** Read `src/data/candidates.json`. The deterministic
   harvester (`scripts/harvest.ts`, runs before you) has already fetched
   every feed-capable source (feed_type `rss_atom` / `api_json`) and
   normalized the entries. Work through the queue: filter against the
   CLAUDE.md scope, discard out-of-scope candidates silently. Each
   entry's `raw_excerpt` is verbatim feed text: quoted numbers and
   figures must come from `raw_excerpt` or from a direct fetch of the
   entry's source page, NEVER from a WebFetch summary (summaries
   paraphrase; paraphrased numbers are fabrication risks). When the
   excerpt is too thin to draft from, fetch the entry's URL directly.
   Do not re-fetch feeds the harvester already covered; its per-source
   results are in the queue file's `health` block, and it maintains
   `fail_count`/status flips for feed sources in code.

   **Direct fetch for HTML-only sources.** Then work through
   `src/data/sources.json` and fetch only the sources with feed_type
   `html`, status `verified` or `unverified`, and NO `fetch_note`
   (a `fetch_note` marks a source our tools cannot read: JS shells,
   hard bot-blocks, stale mirrors; skip those without burning fetches).
   Collect candidates newer than `lastSweep`, same scope filter. Record
   source health for the sources YOU fetched, as before (first success
   flips `unverified` to `verified`; third consecutive failure flips to
   `dead` with a dated note and `fail_count`).

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
   whitelist rules in step 6. Factual claims draft as events. A
   substantive on-scope take, analysis, or video from a whitelisted
   person's channel drafts as a commentary item BY DEFAULT (Florian,
   2026-07-08): do not skip it for being opinion; that is what the
   commentary kind is for. For video channels, draft from the video's
   title and description as published (never assert what is said in
   the video beyond what the title/description state; "discusses X" is
   honest). Only jokes, one-liners, reposts, and off-topic content are
   discarded silently. Record the outcome in the draft's `signalsPass`
   block (required whenever `fetchableCount > 0`): `checked` = the
   fetchable channel URLs you fetched this run, `xAttempted` = how many
   X handles you searched, `note` = one line on what was found (or why
   `checked` is empty: rotation, all unreachable). finalize-sweep
   rejects a draft that omits it or lists a URL that is not a fetchable
   channel.
   **Discovery pass (open web, after the source list; ATTESTED AND
   GATED).** Run at least **6-8 WebSearch queries** this sweep for
   on-scope stories the source list missed. Every sweep's queries must
   cover the full matrix, at least one query each from:
   (1) launch/vehicle, (2) financial (funding, valuation, M&A,
   bankruptcy), (3) incident/debris/regulatory, (4) non-US (rotate
   China / India / Japan / Europe terms), plus 2-4 rotating free
   slots. Record the pass in the draft's `discoveryPass` block
   (queries actually run, verbatim; how many candidates they surfaced;
   one line on the outcome). finalize-sweep REJECTS a draft without it
   or with fewer than 6 queries; a thin discovery pass is a rejection,
   not a silent gap. Candidates found here follow the normal pipeline
   (scope filter, dedup, corroboration, honest classes). When a story
   leads to an outlet or feed not in sources.json, add it as a new
   source with status "unverified" so the harvester picks it up next
   run. Publishing an early signal at SNR 1-2 with honest scoring is
   the model working; the gate is attribution, not confidence. Low-SNR
   items from this pass are a feature, not a defect.
   If discovery (or the queue) surfaces an important event, one that
   would class notable or seismic, whose event date predates the sweep
   window, do NOT drop it as stale (Florian, 2026-07-08): chase the
   original event, find a dateable fetchable source, and publish it
   dated on the actual event date. Dedup and corroboration rules apply
   as usual.

   **Google News queue entries (mainstream trigger).** The harvester
   queues entries from Google News query feeds (sources.json category
   mainstream_triggers). Their URLs are news.google.com REDIRECTS and
   their titles end with " - Outlet". Before drafting from one: follow
   the redirect with WebFetch (fetch the news.google.com URL; it
   resolves or reports the redirect target) to the PUBLISHER page,
   fetch that page, and use the publisher URL as the lead source,
   classed by the
   publisher's domain (mainstream / trade / first_party per the normal
   rules). news.google.com is NEVER cited as a source. Several query
   feeds may carry the same story: one story, one candidate (the
   wire-rewrite rule applies).

   **Bluesky search queue entries (open social discovery).** The
   harvester also queues recent Bluesky posts matching fixed keyword
   searches. raw_excerpt is the verbatim post text. A post from a
   non-whitelisted account is an attributable `informal` source
   (publishable at its honest low SNR, "per @handle on Bluesky");
   whitelisted authors keep their floors per the normal rules. Jokes,
   opinions without a factual claim, and off-topic posts are discarded
   silently; a substantive take from a whitelisted person may draft as
   commentary.

   **Deep sweep (mode: "deep" in candidates.json).** The harvester
   escalates automatically after 2 consecutive zero-add sweeps (or a
   forced run): the queue then covers 7 DAYS, not the normal gap.
   When the mode is deep: re-examine the ENTIRE queue including
   candidates earlier sweeps dismissed (dedup against `existing[]`
   still applies); check EVERY fetchable signals channel (budget
   lifted to 30 fetches, no rotation skips); run 10-12 discovery
   queries covering the whole matrix at once; and name the deep sweep
   and its trigger in the draft summary. Quiet honesty is unchanged: a
   deep sweep that finds nothing ships zero items and says so.

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
   **WebSearch, on the open web**: run AT LEAST 2 searches per event,
   and one of them MUST be the item's headline (or the source's own
   headline) as an exact quoted phrase; add actor + the event's
   distinguishing noun and the program or contract name as variants.
   Then fetch the strongest distinct hits. Also check the
   candidates.json queue itself for the same story from other outlets
   before concluding anything: the Google News feeds routinely carry
   one event from several publishers, and queue corroboration is free.
   The bar for "found_none": a reader repeating your quoted-headline
   search 20 seconds later must find nothing you did not. A found_none
   that a trivial search contradicts is a published falsehood about
   the web and the exact failure the calibration ledger exists to
   catch (the 2026-07-08 NSSL Lane 1 case: two majors covered it,
   the item shipped claiming none did). The
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
   near-identical URLs to farm corroboration. This is now also
   code-enforced at finalize: URL variants of one article (tracking
   params, www/amp hosts), multiple pages on one domain, and sources
   whose titles near-match collapse into ONE corroboration unit before
   scoring, and every collapse is logged to /log. To make the title
   collapse work, include each scoring source's page headline VERBATIM
   as an optional `"title"` field (see the contract below); a source
   without a title still counts, it just cannot be recognized as a
   rewrite.
5. **Registry crossfeed check (attested, code-enforced).** For each NEW
   item whose claims touch a registry fact (counts, statuses, dates,
   figures on a constellation/vehicle/spaceport/organization profile),
   compare like-for-like FIRST: cataloged-on-orbit, operates, launched,
   and announced are different metrics, and computed/orbital figures are
   authoritative ONLY for "cataloged on orbit, as_of date" (they never
   contradict "operational" or "announced" claims;
   `sats_active_verified` is machine-computed and never crossfed).

   Commentary items are exempt: they never feed the registry, so omit
   the crossfeed block entirely (the gate rejects commentary carrying
   facts). For event items, you attest the extraction and the
   like-for-like judgment in a `crossfeed` block (see the draft format
   below); the
   deterministic gate runs `reconcile()` on your inputs, writes the
   outcomes to `src/data/registry-candidates.json` for the weekly
   registry run, applies the dispute downgrade when a canonical fact
   wins, and queues genuine ties for Florian. The gate REJECTS a draft
   whose item companies map to registry entities at SNR >= 3 with no
   crossfeed block: an honest "no like-for-like metric in this item" is
   `"crossfeed": { "facts": [], "note": "..." }`, silence is not. On a
   genuine same-metric contradiction, still state the tension in the
   item copy, attributing both sides; the score math is the gate's.
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
         "kind": "event|commentary (omit for event; see Commentary below)",
         "tags": [], "category": "...", "impact": "seismic|major|notable|noise",
         "companies": [],
         "source_url": "lead source, must equal scoring.sources[0].url",
         "secondary_urls": [],
         "scoring": {
           "sources": [
             { "url": "...", "outlet": "SpaceNews", "class": "trade", "title": "page headline, verbatim (optional but include it whenever you saw the page)" },
             { "url": "...", "outlet": "Reuters", "class": "mainstream", "via": "corroboration", "title": "..." }
           ],
           "extraordinary": false,
           "crawl": "found_some|found_none|not_attempted",
           "whitelist": null
         },
         "crossfeed": {
           "facts": [
             {
               "entity_slug": "iceye",
               "field": "sats_launched_total",
               "value": 52,
               "metric": "cumulative ICEYE satellites launched, as stated by the operator",
               "same_metric": true
             }
           ],
           "note": "required when facts is empty: why no registry metric is touched"
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
     "discoveryPass": {
       "queries": ["spacex launch this week", "space company funding round", "satellite incident debris", "china commercial launch", "earth observation contract award", "launch vehicle test failure"],
       "found": 2,
       "note": "matrix covered; 2 candidates surfaced (both already known to MCC)"
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

## Commentary items (kind: "commentary")

A take, analysis, or position from a named voice is publishable as a
first-class feed item, visibly tagged. Rules, enforced by the gate where
mechanical and by you where editorial:

- Source: a signals.json whitelisted person, or a named outlet/author.
  Anonymous takes never publish, at any SNR.
- Analyst research notes / price targets on a tracked company (e.g. a
  bank's SpaceX secondary-market valuation, a broker downgrade) are
  commentary, not a `financial` event: attribute the call in the
  tagline ("Per Morgan Stanley: ..."), never state the target as fact.
- The tagline quotes the take or tightly paraphrases it WITH attribution
  ("Per @handle: ..."). `what_happened` states who said what, where, and
  when. `why_it_matters` may engage with the argument on the merits.
- SNR scores the attribution ("this person said this"), never the
  opinion's truth. Whitelist floors apply as observers. Corroboration
  means confirming the person actually said it, not agreeing with it.
- Commentary never feeds the registry crossfeed and never reinforces or
  corroborates a factual (event) item. An opinion repeated is still one
  opinion.
- Impact caps at `notable` (the gate rejects seismic commentary).
- Category: use the category the take is about.

## Inclusion bar

An item ships when all are true:
- In scope per CLAUDE.md
- Tagged with its domain tag (`eo`, `connectivity`, `launch`,
  `human-spaceflight`) where one applies, per the CLAUDE.md tag tiers
- Every source URL was fetched this run and every stated fact appears
  in a linked source; numbers copied exactly or omitted
- The copy attributes claims ("ICEYE says", "per the FCC filing",
  "per SpaceNews", "per @handle on X") and never claims more certainty
  than the sources support. The HEADLINE never names the outlet
  (Florian, 2026-07-08): cards display events, not articles; keep the
  headline actor-first and put the attribution in the tagline or
  what_happened when the lead is not first-party
- New information, not a rewrite of an existing item (use `updates` for
  developments on an existing story)
- A commercial director at an operator, reseller, or investor would
  want to know — even as an early, low-SNR signal

## Importance calibration (impact field)

Four tiers since 2026-07-10 (the old scale marked 78% of the feed
notable; the bar is now deliberately higher). The test for `major` is
concrete: does a commercial director at an operator, reseller, or
investor ACT on this or brief their team the SAME DAY? The test for
`notable` is weaker: worth knowing, skimmed in the morning read. If
nobody changes a plan, a price, or a pitch because of it, it is
`noise`. When torn between two levels, ALWAYS pick the lower one.

- `seismic`: reshapes competitive dynamics; you would interrupt
  someone's Monday for this. Examples: a major M&A between tracked
  operators (Rocket Lab/Iridium); an operator failure or bankruptcy;
  the first flight of a new orbital vehicle.
- `major`: a director acts or briefs the team today. Examples: a
  contract award or funding round with a STATED value that changes the
  actor's trajectory (nine figures, or the actor's largest to date); a
  regulatory grant or denial that changes what an operator may sell or
  where (an FCC license modification, a NOAA imaging waiver); a
  demonstrated first-of-kind capability offered on commercial terms.
  The stated-value test is hard: the money or market access must be in
  the source, never inferred.
- `notable`: worth knowing, skimmed and moved past. Examples: a
  contract award of routine size or without a stated value; an
  ordinary funding round; a batch order or new generation announced
  with numbers but no market shift; a program milestone arriving on
  schedule; a partnership with named scope but unstated money. A
  senior government or political figure joining a tracked company
  (board or advisory) stays notable: it is a commercial-access signal
  (the Wolfgang Schmidt/Planet case).
- `noise`: belongs in the record, not the push. Examples: a scheduled
  launch succeeding on schedule; a routine product update or minor
  partnership without stated money, capacity, or regulatory effect; a
  routine executive hire (CFO, CAO, SVP), which stays below the
  inclusion bar entirely per standing precedent.

Default for routine product updates, minor partnerships, and scheduled
successes is `noise`, even when the press release is long. Commentary
still caps at `notable`. Importance and SNR are independent axes: a
seismic rumour is seismic AND low-SNR, and the gate automatically
queues seismic items at SNR 1-2 for Florian's review while they
publish.

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
