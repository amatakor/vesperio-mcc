# SWEEP_MEMORY.md — lessons the sweep agent has learned

Append-only log of durable lessons from sweep runs. Read at the start of
every run. Keep entries short and dated. Delete nothing; supersede with
a newer entry if a lesson changes.

## Seed lessons (2026-07-05, pre-launch)

- 2026-07-05-A: Batch discipline. Registrar/domain-style batch lookups
  and multi-source fetches degrade silently in large batches. Work
  sources in small groups and confirm each fetch returned real content
  before parsing.
- 2026-07-05-B: Tier-2 tracing. SpaceNews and Payload frequently cite
  "sources familiar with"; those items HOLD until an actor speaks on the
  record. Do not treat outlet quality as a substitute for a primary source.
- 2026-07-05-C: Chinese sources (jl1.cn, spacechina.com) are
  intermittently unreachable from CI runners. Two failures in a row is
  normal; only flip to dead after the third, and note Xinhua EN as the
  fallback lead source.
- 2026-07-05-D: Launch Library free tier is rate-limited. One upcoming
  + one previous call per sweep is enough; never poll per-entity.
- 2026-07-05-E: The WebFetch-style tool renders spacex.com/updates as a
  blank JS shell (no article content) and rocketlabcorp.com/updates
  returns HTTP 403 both times, no exception seen yet. Plain `curl` with a
  descriptive User-Agent works fine for SEC EDGAR (which 403s without
  one) and for Launch Library 2's raw JSON API; worth trying curl before
  writing SpaceX/Rocket Lab off as dead.
- 2026-07-05-F: First-ever sweep (state.lastSweep was null) surfaced
  press releases and filings up to a month old. Treated anything older
  than ~7 days from `now` as stale rather than backfilling it as
  "today's news"; only items inside that window became candidates. Seems
  like the right call given the twice-daily cadence, but flag if a human
  wanted the backlog captured instead.
- 2026-07-05-G: rocketlabcorp.com/updates/ is now reachable with curl and
  a descriptive User-Agent (200, real headlines+dates in the listing),
  reversing the earlier 403. But individual article pages under
  /updates/<slug>/ are gated by a Cloudflare "Just a moment..." JS
  challenge (403 via both WebFetch and curl) even when the listing page
  itself loads fine. A listing headline is not a substitute for the
  article text: the July 3, 2026 Rocket Lab headline "Rocket Lab to
  Acquire Iridium in Historic Deal" could not be verified beyond its
  headline+date and was held rather than published. Re-check the article
  URL next sweep before treating Rocket Lab as fully readable.
- 2026-07-05-H: When a company's own newsroom page is Cloudflare-gated,
  check its SEC 8-K feed before holding a story on headline alone --
  Item 1.01 (material definitive agreement) filings often attach the
  exact press release as an EX-99.1 exhibit, which is a clean, primary,
  fully-readable HTML document straight from EDGAR. That is exactly how
  the Rocket Lab/Iridium acquisition (held 2026-07-05 for lack of
  article text) got confirmed and published this run: RKLB's 8-K filed
  2026-06-29 carried the full joint press release as EX-99.1. SEC EDGAR
  filing-index pages and exhibit documents fetch fine with curl plus a
  descriptive User-Agent (no special headers needed beyond that).
- 2026-07-05-I: SpaceX's spacex.com/updates/ has now failed 3 consecutive
  times across two sweeps (always an unrendered Angular shell, both via
  WebFetch and curl with a descriptive User-Agent) and was flipped to
  status "dead" this run. Don't keep re-fetching it every sweep; revisit
  only if a differently-shaped URL (e.g. an RSS/JSON endpoint) turns up.
- 2026-07-05-J: One-off 30-day backfill run (Florian-approved, source list
  restricted to Planet Labs/ICEYE/Rocket Lab/European Spaceflight/
  SpaceNews/Launch Library/six SEC 8-K feeds). Lessons:
  - When a run is restricted to a named source list, treat any company
    or agency whose own site/filing isn't on that list as unreachable
    this run, even if it's the true primary source. SpaceNews and
    European Spaceflight items were correctly capped at `reported`
    (not upgraded to `confirmed`) for exactly this reason -- e.g. NASA's
    lunar lander awards, the FCC vote, and Amazon/ULA's Atlas V flight
    all have primary sources (nasa.gov, fcc.gov, ULA/Amazon newsroom)
    that simply weren't in this run's allowed list.
  - Launch Library 2 is usable as a *confirmed*-tier primary source for
    launch occurrence facts (CLAUDE.md's source ladder item 5), including
    government/defense missions like Rocket Lab's VICTUS HAZE -- the
    `mission.description` field on the per-launch endpoint is often
    detailed enough to write a full item without needing the launch
    provider's own (Cloudflare-gated) site.
  - Backfill discipline: an event whose only public disclosure predates
    the backfill window doesn't qualify even if a later article
    *describing* that disclosure falls inside the window. Excluded a
    Rocket Factory Augsburg product-roadmap item this run for exactly
    this reason (underlying reveal was OHB's May 18 Capital Markets
    Update, outside the 30-day cutoff; only OHB's own June 22 capital
    raise announcement, a separate event, qualified).
  - Scope judgment call: treated EchoStar's DISH DBS + DISH Wireless
    Chapter 11 filing as out of scope. DISH DBS is legacy satellite TV
    and DISH Wireless is entirely terrestrial 5G; neither is "new-space
    relevant" per CLAUDE.md's GEO-operator carve-out. Flag for Florian
    if that read is wrong.
  - Process bug (self-caught, not a source issue): the first draft's
    newItems array silently dropped one fully-verified item (Blue
    Origin's New Glenn pad-CONOPS story) that the same draft's own
    summary text described. finalize-sweep has no cross-check between
    a draft's prose summary and its actual newItems array, so this kind
    of slip isn't mechanically caught -- double-count newItems against
    the summary's claimed count before running finalize-sweep next time.

## Normal-mode sweep, ~12hr gap, unfiltered full source list (2026-07-22)

- 2026-07-22-A: A launch SCRUB already published as its own item (the
  July 20 Falcon 9/Starlink 17-39 pad abort) resolves into a routine
  successful relaunch one day later on the SAME mission -- this is an
  `updates[].patch` on the abort item (append the resolution to
  `what_happened`), never a new item, even though it's tempting to treat
  "launch succeeded" as its own dedup-checked event per the standing
  megaconstellation-cadence ruling. The cadence ruling covers genuinely
  distinct missions; a scrub-then-fly of the identical payload is one
  event with two beats.
- 2026-07-22-B: Confirms the domain-collapse mechanic works as designed
  when attaching follow-up coverage to an existing item: the Vandenberg
  abort item already had Spaceflight Now + Space.com as its 2 sources;
  attaching NEW July 21 pages from those same two outlets (reporting the
  successful relaunch) left the corroboration count at 2, not 4 --
  finalize-sweep collapses multiple pages on one registrable domain into
  one unit regardless of how many distinct URLs are attached. Don't
  expect a corroboration_4plus bump from re-covering the same outlets;
  a genuine 4th unit needs a domain not already counted.
- 2026-07-22-C: Conflicting satellite-count claims across English-language
  previews of a Chinese launch (Gravity-1's July 22 sea launch: pre-launch
  pieces said "6 Dongpo satellites" or "30 spacecraft," Launch Library
  said "9 satellites") were resolved by trusting the computed source
  (Launch Library, tier 5) and confirming its exact figure via a direct
  fetch of Chinese-language financial press (Sina Finance), which named
  all 9 payloads by name and matched Launch Library exactly. When
  pre-launch previews and a post-launch computed record disagree, the
  computed record wins and is worth a same-language direct-fetch check
  rather than trusting an English aggregator's preview figure.
- 2026-07-22-D: Marcia Smith's SpacePolicyOnline Bluesky feed
  (spacepolicyonline.bsky.social, checked via the public API since the
  bsky.app page itself still renders nothing) delivered same-day granular
  detail a fresh launch's trade coverage hadn't yet stated (MRV-1 not
  operational until 2027) and flagged a same-day House committee letter
  to the FCC (undated beyond "today") that could not be independently
  corroborated via WebSearch in time to draft confidently -- left
  unpublished this run rather than drafted off a single paraphrased
  social post; worth a follow-up search next sweep once a primary
  document or dated trade write-up surfaces.
- 2026-07-22-E: spacepolicyonline.com's own site (not the Bluesky
  account) returned only a bot/CAPTCHA verification screen via WebFetch
  this run, a new failure mode for this domain; still logged in
  `signalsPass.checked` since a fetch was genuinely attempted, distinct
  from a channel skipped for rotation.

## Deep sweep, escalated after zero-add runs, unfiltered full source list (2026-07-22, second)

- 2026-07-22-F: A Chinese reusable-rocket "debut" story can be genuinely
  ambiguous across sources even after several checks: NASASpaceflight's
  July 15 "China's first recovered booster returns to port as LandSpace
  aims for first land recovery" reads like a fresh LandSpace Zhuque-3
  event, but china-in-space.com's own "Y1 debut" article turned out to
  be about the December 3, 2025 maiden flight, Wikipedia's Zhuque-3 page
  said the only confirmed orbital launch was December 2025 with a second
  flight NET August 2026, and a Chinese-language search ("长征十号乙即将
  首飞...朱雀三号也即将二飞") confirmed the July flight was Zhuque-3's
  SECOND ("遥二") attempt, not its debut. Left the story undrafted rather
  than risk a wrongly-dated "first flight" seismic claim; a WebFetch
  summary calling something a "debut" is not proof when other dated
  sources disagree on the flight count.
- 2026-07-22-G: The deterministic harvester queue in deep mode (7-day
  window, `previously_presented` re-emission) can run to several
  thousand lines and be 95%+ SpaceX stock-price/IPO clickbait and
  Bluesky bot noise on a narrow-interest ticker query; a fast triage
  pass is to grep `"title"` lines and exclude a stopword list (spacex,
  starlink, stock, ipo, earnings, bsky.social, federal register
  fisheries boilerplate, etc.) before reading anything closely. All 4
  new items and the 1 update this run came from the signals pass
  (Jeff Foust's and Marcia Smith's Bluesky feeds) and a direct fetch of
  Vast's own newsroom, not the harvester queue.
- 2026-07-22-H: A machinery-of-government reshuffle that touches a
  space agency's parent department (the UK's DSIT dissolved into three
  successor departments, absorbing UKSA) was discarded rather than held:
  unlike the NATO HALO / Dutch Space Command precedents (institutional
  programs establishing new space capabilities), this story has UKSA
  itself declining to comment on any impact and states no space-industry
  consequence at all, only domestic ministerial politics. Distinguish
  "institutional space program with unclear commercial angle" (hold)
  from "government reorg that happens to touch the agency's org chart"
  (discard, no scope question to rule on).
- 2026-07-22-I: A defense contractor "positioning" story (KBR organizing
  a business unit and promoting two internal execs to chase future
  Golden Dome task orders, no contract awarded, no dollar figure) was
  left out as below the inclusion bar, same standard as a routine
  executive hire: business-development framing without a contract,
  award, or stated figure is not yet a fact worth a card.
- 2026-07-22-J: `bun scripts/fetch-thumbs.ts` and `bun scripts/check-feed.ts`
  were both denied outright by this session's permission gate, continuing
  the standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s
  own merge confirmation ("merged 4 new, 1 updated, 0 held") as the
  build-health signal, per the same precedent. Thumbnails for this run's
  4 new items were not fetched; a later run's `fetch-thumbs.ts` pass will
  need to pick them up (they render text-only in the meantime, which is
  a supported fallback, not a broken state).

## Normal-mode sweep, ~11h41m gap, unfiltered full source list (2026-07-23)

- 2026-07-23-A: A scheduled-vote item's outcome is an `updates[].patch`
  on the SAME item, not a new one, even when the gap between the preview
  article (published 2026-07-01) and the outcome article (July 22) is
  three weeks, well past the normal 7-day dedup window: the FCC's "to
  vote on satellite licensing overhaul July 22" item was patched in
  place with the vote's actual result (headline, tagline, what_happened,
  impact bumped notable to major) rather than dedup-matched as a
  separate candidate, since the article is literally the resolution of
  the exact scheduled event the original item was about. The 7-day
  window governs matching an unrelated-looking new candidate against
  prior coverage; it doesn't gate patching an item's own known future
  event once it resolves.
- 2026-07-23-B: The FCC's July 22 meeting produced two separately
  reported, separately scored actions (the Part 25->Part 100 licensing
  overhaul and a second upper-C-band spectrum auction) bundled in some
  outlets' single write-up but covered as two distinct articles by
  others (Via Satellite ran separate pieces for each). Treated as two
  items: patched the existing licensing-overhaul item and drafted the
  C-band auction as new, rather than merging both actions into one
  card, matching how the trade press itself split the story.
  cnn.com/2026/07/22/science/space-debris-satellite-rules-fcc-vote
  returned HTTP 451 (unavailable for legal reasons) both times tried;
  newscaststudio.com/.../fcc-adopts-rules-for-upper-c-band-auction 403'd.
  TV Tech (tvtechnology.com) fetched cleanly and gave a genuinely
  independent third trade source (different figures emphasized: GDP/jobs
  estimates, the per-commissioner vote breakdown) rather than a rewrite.
- 2026-07-23-C: A company newsroom page can carry a same-day press
  release the listing page dates one day earlier than the article page
  itself states (ICEYE's KT SAT/South Korea flood-partnership release:
  the newsroom listing showed "July 22, 2026" but the article page's own
  fetch reported "July 23, 2026"). Treated as in-window either way rather
  than resolving the discrepancy; worth a direct timestamp check if a
  future case lands right at a dedup or window boundary where the day
  matters.
- 2026-07-23-D: A French government research agency's own domain
  (onera.fr) is not first-party-classable under the current anti-spoof
  gate: it's neither `.gov` nor in `FIXED_OFFICIAL_HOSTS`, and ONERA has
  no `src/data/registry` entity either, so the same no-registry-host
  workaround as ArkEdge/Orbit Fab/ispace applies (2026-07-07-K and
  later): led with a trade outlet (European Spaceflight) and linked
  onera.fr in `secondary_urls` unscored. A French-language defense trade
  outlet, Zone Militaire (opex360.com), gave a genuinely independent
  second source with its own byline and additional facts (the GRAVES
  radar being replaced by a new Thales AURORE radar) not in the English
  lead, not just a translated rewrite.
- 2026-07-23-E: An `updates[].bump` attestation can be accepted by the
  gate without changing the item's final SNR: patched the FCC
  licensing-overhaul item with `bump: "corroboration_2plus"` after
  attaching two new distinct sources, and the merge succeeded, but the
  item's `snr_trace.modifiers` still shows only the pre-existing
  `persistence` modifier (final stayed 4, the persistence cap) with no
  `corroboration_2plus` entry logged. Not investigated further this
  run (the math is code, not mine to second-guess), but worth a look if
  a future item needs the corroboration bump's headline visibility on
  /log and it's silently absorbed by an existing cap this way.
- 2026-07-23-F: Bluesky's public `getAuthorFeed` API continues to be
  genuinely per-account, per-session flaky (extends 2026-07-19-B/G,
  2026-07-21-B): Langbroek's feed this run was almost entirely unrelated
  Dutch-language personal posts, Farrar's and Berger's both topped out
  months stale (March/June), while Foust, SpacePolicyOnline, Zak,
  Jones, and Parsonson's feeds were all clean and current. Budget a real
  per-account check every run rather than trusting or distrusting the
  leg wholesale.

## Narrow same-day re-check, ~3h43m gap, unfiltered full source list (2026-07-23, second)

- 2026-07-23-G: Genuinely quiet full-matrix run: harvester queue was 100%
  off-scope noise (SpaceX stock-price speculation, FAA airworthiness
  directives, ISRO recruitment notices, an ESA forest-carbon research
  post, a BBC drought piece), all 21 fetch-list.ts HTML sources and 15 of
  17 signals fetchable channels were current with nothing newer than
  lastSweep, and every discovery-pass/X-search hit that looked new
  (Sierra Space's own "$798 million Golden Dome" release, a KeepTrack
  recap of the same "36 Golden Dome satellites for $1.75B" figure) traced
  back to the already-published 2026-07-13 SDA/L3Harris/Sierra Space
  Tranche 3 item -- Sierra Space's press release frames its $798M SDA
  missile-tracking award under the "Golden Dome for America" program
  brand, which reads like a fresh contract on a narrow search but is the
  same $1.75B combined award already on the site. Zero items shipped;
  confirms 2026-07-05-S/2026-07-06-E that a narrow filtered/unfiltered
  re-check quiet outcome is normal, not under-coverage.
- 2026-07-23-H: A House NDAA passage (FY2027, $59B Space Force
  authorization, per Marcia Smith/SpacePolicyOnline's Bluesky feed) was
  left undrafted as below the inclusion bar rather than held: it
  authorizes but doesn't appropriate a top-line budget figure for the
  whole Space Force, with no named vendor, contract, or program-specific
  commercial impact stated, the same "process not yet a fact" standard
  applied to the KBR Golden-Dome-positioning story (2026-07-22-I) and the
  UK machinery-of-government reshuffle (2026-07-22-H). Worth revisiting
  if a future NDAA conference/signing carries a named program figure.
- 2026-07-23-I: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 0 new, 0 updated, 0 held") per the same precedent.

## Normal-mode sweep, ~8h13m gap, unfiltered full source list (2026-07-23, third)

- 2026-07-23-J: Drafted two small European funding-round items (ORiS,
  deltaVision) straight from a discovery-pass WebSearch without first
  grepping the company name against `items.json`; both were already
  published from the same-day harvester queue by an earlier sweep.
  `finalize-sweep.ts` caught both as exact-id duplicates and rejected the
  draft (the id-slug convention is stable enough that two independent
  drafts of the same story land on the same id). Fix was cheap (drop the
  duplicate newItems, redirect the one genuinely new fact -- a second
  independent outlet, Tech.eu, corroborating ORiS's round -- into an
  `updates[].attach` with `bump: "corroboration_2plus"`), but the lesson
  is upstream: grep every candidate's company name against `items.json`
  before drafting, not just against the printed `existing[]` headlines
  list, since a same-day story can slip in between when `existing[]` was
  captured and when a candidate is drafted.
- 2026-07-23-K: science.org (AAAS) 403'd WebFetch on every article URL
  tried this run (two different slugs for the same NASA SR-1
  Freedom/nuclear-Mars-mission story); confirmed via `curl` that this
  session's Bash tool requires manual approval for arbitrary network
  commands (matches the scheduled-sandbox's curl restriction even in an
  interactive session), so there was no fallback fetch path. Corroboration
  for that item was rescued via a different outlet in the same search
  results (gagadget.com, which loaded cleanly and independently cited the
  same FY-by-FY budget figures) plus NASA's own mission page
  (nasa.gov/mission/space-reactor-1-freedom/, first_party, on the fixed
  official-host list) for the launch-date/SkyFall facts the budget-only
  trade lead didn't cover.
- 2026-07-23-L: Confirms the "process not yet a fact" pattern
  (2026-07-22-H/I, 2026-07-23-H) on two more shapes seen the same run:
  the Office of Space Commerce's "Space Commerce Certification" post
  (a promotional status update announcing a future Federal Register
  call-for-interest, no criteria yet published) and Isar Aerospace's own
  newsroom post about a German defence minister's site visit (no
  contract or figure attached to the visit itself) were both left
  undrafted as below the inclusion bar rather than held.

## Normal-mode sweep, ~11h42m gap, unfiltered full source list (2026-07-24)

- 2026-07-24-A: A trade outlet's fresh write-up of an old fact can smuggle
  in a genuinely new, separately-newsworthy detail buried mid-article:
  Space.com's July 23 SunRISE/Falcon-Heavy piece (the launch-vehicle swap
  itself was already published 2026-07-13) opened with "On its most recent
  launch, USSF-87, Vulcan experienced an anomaly... prompted the Space
  Force to pause national security launches on Vulcan" — reads like fresh
  news but a WebSearch confirmed USSF-87 and the pause both happened
  February 12-26, 2026, already reflected in the published Northrop
  Grumman GEM 63XL charges item (2026-07-21). Always date-check a
  seemingly-new supporting fact inside an otherwise-stale story before
  drafting it as new; this one traced to a five-month-old event.
- 2026-07-24-B: WebFetch's summarizer can flatly miss a paragraph that
  the harvester's own `raw_excerpt` for the same URL already captured
  verbatim (the USSF-87 paragraph above): two separate WebFetch calls on
  the same Space.com URL both claimed the anomaly wasn't mentioned on the
  page at all, even though the queue's raw_excerpt quoted it directly.
  Confirms 2026-07-08-N's rule (raw_excerpt is a legitimate source text on
  its own) needs to extend to "don't trust a WebFetch summary's *absence*
  claim either" — a summarizer saying a fact isn't on the page is not
  proof it isn't there.
- 2026-07-24-C: A same-story SpaceNews write-up published two days after
  an already-scored item's original sources (Poland's IRIS2 contribution,
  covered June 21 by European Spaceflight/eunews.it/Via Satellite) is
  free corroboration worth attaching even when it adds no new fact, just
  a USD-converted figure — landed as a 4th distinct source via
  `updates[].attach` + `bump: "corroboration_4plus"`, though as in
  2026-07-23-E the modifier didn't change the logged `snr_trace` (already
  capped at final 4 from `corroboration_2plus`); the source list still
  visibly grew to 4 distinct outlets on the card.
- 2026-07-24-D: Two small trade-press items (Frequency Electronics'
  proliferated-satellite contract wins, Intellian's C100M GMDSS terminal)
  each had a swarm of financial-mirror/wire-syndication outlets covering
  the identical company press release (stocktitan, streetinsider, Yahoo
  Finance mirrors, MarineLink) but no genuinely independent second
  outlet confirmable by direct fetch this run (several 403'd or returned
  empty to WebFetch) — both correctly shipped `crawl: "found_none"` at
  SNR 2 rather than stacking wire reprints as corroboration. Also caught
  before drafting: WorkBoat's "Intellian rolls out new Iridium GMDSS
  systems" piece, which read like a same-story match, turned out to be
  about the earlier C200M/C700 launch, not this week's C100M — a same-
  actor near-title match still needs a body-content check, not just a
  headline match.
- 2026-07-24-E: A Rocket Lab HASTE contract ($266M, Space Force,
  suborbital Alaska launches) tripped the same-company-plus-category
  dedup heuristic against an unrelated 4-days-prior Space Force
  procurement item (the NSSL Lane 1 ceiling increase to $17B) on shared
  company "Space Force" + category "procurement" alone, same pattern
  documented many times since 2026-07-09-B; cleared with one
  `dedup_distinct` entry. A WebSearch's own synthesized summary claimed
  this was "the largest publicly disclosed single launch contract in
  Rocket Lab's history" but no page actually fetched this run stated
  that superlative (one candidate source, techtimes, 403'd); dropped the
  claim from the copy rather than risk citing a search summary's
  unverified framing.

## Narrow same-day re-check, ~3h40m gap, unfiltered full source list (2026-07-24, second)

- 2026-07-24-F: EXTENDS 2026-07-18-F: crossfeeding a vehicle's `last_flight_date`
  against a pre-event registry snapshot trips the same wrongful dispute
  downgrade as the flight-count fields, because `last_flight_date` is
  NOT on the code's recognized monotonic-counter list (`flights_total`,
  `flights_successful`, `sats_launched_total`, `launches_total`) even
  though it is just as monotonic in spirit. Crossfeeding Long March-3B's
  `last_flight_date` (new value 2026-07-23) against the registry's
  as_of-2026-07-08 snapshot (stale value 2026-06-16) with
  `same_metric: true` cost the item a full dispute downgrade (SNR 4 -> 3)
  on first finalize. Recovery needed BOTH `rescore` AND
  `dispute_resolved: true` on the same update -- a plain `rescore` alone
  re-applies the dispute per the draft-format contract's "disputes
  survive ordinary rescores" rule, it does not clear it. Lesson: treat
  any date-valued "most recent X" registry field the same as the named
  monotonic counters for crossfeed purposes -- either attest
  `same_metric: false` for it, or omit it from the crossfeed block
  entirely, until the code's monotonic-field list is extended to cover
  it.
- 2026-07-24-G: A trade write-up describing a state broadband office
  (Louisiana's ConnectLA) signing a BEAD grant with Starlink is a
  legitimate never-covered, dateable event worth chasing across a
  ~6-week gap (June 11 signing, no prior sweep had it under any name):
  `procurement` category (government buyer), `notable` impact (stated
  value $8.2M, well under the nine-figure/largest-to-date bar for
  `major`). Two independently-styled sources (Broadband Breakfast, a
  trade outlet, June 11; Louisiana Radio Network, a local mainstream
  outlet, July 23) both quote the same ConnectLA official near-
  verbatim, which reads like they draw on the same underlying press
  comments rather than fully separate reporting -- attached both
  honestly anyway since neither is a wire/PR reprint of the other, and
  let the code's title-similarity collapse logic decide if they count
  as one unit or two.
- 2026-07-24-H: A WebSearch synthesis can invent a wrong dollar figure
  even when its own listed source pages state a different one: search
  results repeatedly summarized the Louisiana/Starlink BEAD grant as
  "$82 million," but two separate direct WebFetch calls on the actual
  broadbandbreakfast.com article, one of them asking for the exact
  sentence verbatim, both returned "$8.2 million." Trusted the
  repeated direct fetch over the repeated search synthesis, consistent
  with 2026-07-06-HH's standing precedent extended to a 10x-magnitude
  discrepancy rather than a same-order-of-magnitude one.
- 2026-07-24-I: A same-day CASC newsroom hit for a plausible-sounding
  headline can be the wrong article: a `site:english.spacechina.com`
  search for "Tianlian data relay satellite" surfaced
  `n17212/c4291791/content.html` looking like a match for today's
  Tianlian II-06 launch, but direct fetch showed it was actually the
  March 2025 Tianlian II-04 launch -- same satellite family, wrong
  generation and wrong year. Led with Xinhua/CGTN instead rather than
  force a stale CASC page into the first-party slot. Also: CGTN's own
  copy internally misdated the same launch ("Thursday, July 24" -- July
  24, 2026 is actually a Friday, so the correct day was Thursday July
  23, matching Xinhua's dateline and URL slug); cross-checked the
  weekday against a calendar lookup before trusting either outlet's
  stated date.
- 2026-07-24-J: Two "still process, not yet fact" exclusions confirmed
  on new shapes: a T-Mobile CEO comment about looking "beyond Starlink"
  for satellite service, resurfaced today by PCMag under a fresh-
  looking headline, traced to an April 28 earnings call already three
  months stale with no new information added; and Sateliot's "wants
  EUR150m in fresh funding" coverage describes an ongoing target still
  seeking a lead investor (up from an EUR100M April round), not a
  closed round -- both left undrafted rather than chased, since neither
  is a closed/dated fact and the T-Mobile one isn't even new.

## Deep sweep, escalated after zero-add run, ~8h10m gap (2026-07-24, third)

- 2026-07-24-K: When a shell command with several `grep -E` alternation
  terms gets blocked by the sandbox's "Contains simple_expansion"
  approval wall, re-run EACH term as its own separate grep call rather
  than silently treating the blocked batch as "checked": a UK debris-
  removal delay item and a Contrivian/Big Network merger item were both
  drafted as new because the batched dedup grep that would have caught
  them never actually ran (only some of its terms got individually
  re-checked afterward). `finalize-sweep.ts`'s same-event dedup gate
  caught both before merge (shared company + category within 7 days,
  exact prior ids), so no bad data landed, but the tokens spent
  re-researching and re-drafting both items were wasted. Grep every
  dedup term individually when a combined command is denied; don't
  assume a partial re-check covers the gap.
- 2026-07-24-L: Launch Library is `aggregator` class, not `computed`
  (only celestrak.org and space-track.org qualify as computed, per
  finalize-sweep's own rejection message); using
  `ll.thespacedevs.com` launch records as a second source on the
  Kinetica-1 item needed `class: "aggregator"`, not `"computed"`.
  Direct observational tracking data is computed; a curated launch
  database, however structured, is aggregator tier 4.
- 2026-07-24-M: Confirms 2026-07-07-E's Q4-IR-style subdomain fix still
  holds for a newly-drafted item: `ir.spire.com` (Spire's own IR press
  release on the Spire/SATE STRAIDE partnership) passed the anti-spoof
  gate cleanly as `first_party` against the registry's bare-apex
  `spire.com` website value, landing the item at base tier 5 with no
  `found_none` penalty (direct-source leads take none). Worth checking
  a company's registry `website` value before assuming an IR subdomain
  needs the wire-mirror workaround.
- 2026-07-24-N: An EU Council decision restricting Copernicus Sentinel
  imagery release over part of the Gulf of Oman (published July 14,
  citing a May 26 US request tied to the US-Iran conflict) is a clean
  fit for the geopolitical category's "government statements directly
  concerning commercial space services in a conflict or crisis" carve-
  out: reported the space-industry fact (the EU restricting a
  previously-unrestricted open-data policy) and a named commercial
  firm's (Kayrros) prior public statement about Copernicus's open-data
  posture, without analysing the underlying conflict. Chased on its
  July 14 disclosure date under the standing "chase notable events that
  predate the window" ruling, six-plus weeks after SpaceNews's July 24
  writeup first surfaced it via a whitelisted signal (Andrew
  Parsonson's Bluesky), never covered before under any name.

## Narrow same-day re-check, ~5h13m gap, unfiltered full source list (2026-07-25)

- 2026-07-25-A: A large-dollar-figure story can still be a "process not yet
  fact" exclusion even with real new corroborating coverage: Ukrainian
  operator Stetman's $1.1B/€1bn 360-satellite sovereign constellation (first
  120 sats via SpaceX in 2027, GomSpace/UASAT joint venture) got a fresh wave
  of write-ups July 22-24 (UNITED24, TechRadar, DataCenterDynamics, dev.ua),
  but every fact in them traces to a story circulating since at least March
  2026 (thedefender.media) and a July 18 TechRadar piece; the only "new"
  beat was two execs "reaffirming commitment" at a conference, no closed
  funding, no new contract, no new figure. Left undrafted per the standing
  2026-07-22-H/I, 2026-07-23-H/L pattern rather than chased as a fresh event.
- 2026-07-25-B: blueorigin.com 429'd on two separate fetch attempts this
  session (same failure mode as 2026-07-05-S); led the NASA/Blue Origin
  Stennis B-2 test-stand item with nasa.gov (official_record, gov domain,
  tier 5) instead and left Blue Origin's own release out entirely rather
  than cite a page that never actually loaded this run.
- 2026-07-25-C: A CASC (english.spacechina.com) headline that reads like
  fresh news ("China launches new data relay satellite," dated July 24) can
  be same-day catch-up coverage of an event already fully published the day
  before under a different lead source -- confirmed it was the same
  Tianlian II-06 launch already on the site (2026-07-23, sourced via
  Xinhua/CGTN/SpaceNews per the 2026-07-24-I workaround) before treating it
  as new.

## Narrow same-day re-check, ~6h27m gap, unfiltered full source list (2026-07-25, second)

- 2026-07-25-D: `finalize-sweep.ts` rejects `draft.coverage` entries that are
  tags rather than category names: submitted `"connectivity"` and `"eo"`
  (domain tags) and both were rejected with "not a known category" on first
  attempt. `coverage` wants values from the item `category` enum
  (`launch`, `constellation`, `contract`, `procurement`, `regulatory`,
  `financial`, `product`, `partnership`, `incident`, `geopolitical`,
  `human-spaceflight`, `science`), not the tag tiers from CLAUDE.md. Fixed by
  swapping to `"constellation"` and the draft merged clean on retry.
- 2026-07-25-E: Genuinely quiet full-matrix run, a few hours after the prior
  sweep's own entries above: the harvester queue (79 candidates after
  collapsing 9 alt-duplicates) was almost entirely SpaceX Starship
  Flight-13/stock-price noise and repeat Stetman/Ukraine write-ups (both
  already excluded per 2026-07-25-A); all 21 fetch-list.ts HTML sources came
  back with nothing newer than already-published stories; 15 of 17 signals
  channels checked clean (rotated out the europeanspaceflight substack and
  mainenginecutoff.com legs for budget); an 8-query discovery matrix (launch,
  financial, incident/debris, China, India, FCC regulatory, EO contract,
  failure/anomaly) surfaced only already-published stories (Bezos' $2B Blue
  Origin stake is a July 25 rehash of the already-published July 8-12
  $10B/$130B round; CAS Space's Kinetica-1 rideshare is a July 24 Chinese-
  language write-up of the already-published July 23 launch). Zero new
  items, zero updates, zero held -- confirms the standing pattern
  (2026-07-05-S and many later entries) that a narrow re-check quiet outcome
  is normal, not under-coverage.
- 2026-07-25-F: The public Bluesky API
  (`public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>`)
  fetched cleanly via WebFetch for every one of 9 distinct signals accounts
  tried this run (Foust, Aschbacher, Langbroek, Henry, Farrar, Berger,
  SpacePolicyOnline, Zak, A. Jones, Parsonson), continuing 2026-07-21-B's
  observation that the flakiness is session-dependent, not per-account; a
  fully clean session like this one is worth banking rather than assuming
  the next session will match it. spacepolicyonline.com's own site remains
  bot-gated (consistent with 2026-07-22-E) so the Bluesky leg is still the
  only reliable path to Marcia Smith's content in-session.
- 2026-07-25-G: A ground-station-safety relief post (Josef Aschbacher on
  ESA's Cebreros deep-space station surviving nearby Spanish wildfires; a
  parallel NASA statement on its Madrid-area DSN station evacuation, via
  Marcia Smith's Bluesky) is below the inclusion bar, not a held scope
  question: no facility damage, service interruption, or commercial
  consequence was stated in either case, just infrastructure safety updates
  during an ongoing wildfire event. Distinguish this from genuine scope
  questions (NATO HALO, Dutch Space Command precedent): there is no
  editorial call to make when the source itself states no consequence.

## Narrow same-day re-check, ~12hr gap, unfiltered full source list (2026-07-26)

- 2026-07-26-A: Bluesky's public `getAuthorFeed` API can return genuinely
  DIFFERENT content across two back-to-back fetches of the SAME account in
  the SAME session, not just stale/flaky across sessions (extends the long
  2026-07-18-A/2026-07-19-B/G/2026-07-21-B/2026-07-23-F line): a first fetch
  of `chenryspace.bsky.social` surfaced Caleb Henry's own newest post (a
  Starlink financial-forecast release) as the top entry, a second fetch
  moments later for "the single newest post" returned an entirely different,
  older repost from a different account with no matching content at all.
  Left the Starlink-forecast post undrafted since its exact text couldn't be
  pinned down reliably this run rather than publish an unverified quote;
  worth treating any single `getAuthorFeed` response as provisional and,
  when a specific post's exact text matters, re-fetching to confirm before
  drafting rather than trusting one call.
- 2026-07-26-B: A WebSearch's own synthesized answer (not just a resurfaced
  article) can present old news as if newly dated: searching for "Peter
  Beck Rocket Lab July 25 2026" returned a search-engine summary flatly
  stating "On July 25, 2026, Rocket Lab founder Sir Peter Beck announced an
  $8 billion acquisition of ... Iridium" -- built entirely from a July 25
  BusinessToday recap of the already-published June 29 Rocket Lab/Iridium
  deal, with the summary dropping the "recap" framing and presenting the
  underlying (month-old) event as today's news. Confirms the search-summary
  version of the stale-resurfacing trap (2026-07-19-D/E and later) applies
  even when the search tool's own prose, not a search-result title, makes
  the false-freshness claim; always trace to the actual underlying event
  date before drafting from a search summary.
- 2026-07-26-C: A fully quiet full-matrix sweep (~12hr gap): the harvester
  queue was 95%+ Starship Flight 13 post-flight coverage (tower-catch plans,
  landing/splashdown recaps) and SpaceX stock-price noise, all already fully
  reflected in the existing 2026-07-16 Flight 13 item's updated copy; all 21
  fetch-list.ts HTML sources and 14 of 17 signals channels were current with
  nothing newer than lastSweep; a 10-query discovery/X-search matrix (launch,
  financial, incident/debris, FCC regulatory, China, India, 3 X-handle
  searches) surfaced only already-published stories or stale resurfacings.
  Zero new items, zero updates, zero held -- another confirmation of the
  standing pattern that a narrow re-check quiet outcome is normal.

## Deep sweep, escalated after two zero-add sweeps, 7-day window (2026-07-26)

- 2026-07-26-D: A trade write-up's own published_at date is not the event
  date: Via Satellite's July 22 "Lite Coms Wins $22M Contract" reads like a
  fresh item, but the underlying PR Newswire release it draws on carries an
  explicit dateline of "Jun 22, 2026" -- a full month earlier, with the same
  Nate Giordano quote in both. Dated the item to the PR Newswire dateline and
  led with it as `wire_pr` (tier 4, higher than the trade write-up's tier 3)
  rather than trusting the trade outlet's July publish stamp. Always check a
  wire-sourced trade story's underlying release dateline before dating the
  item to the trade outlet's own publish date.
- 2026-07-26-E: Two new-actor-not-in-registry cases confirmed the standing
  ArkEdge/Orbit Fab pattern (2026-07-07-K/2026-07-08-A) on genuinely new
  company names: Lite Coms, Lunar Outpost, Whipsmart Ventures, and
  LatConnect 60 all have no registry profile, so their own domains can't be
  classed `first_party` (no host for the gate to match). Led each with the
  gate-safe trade source instead. Arianespace hit the same wall even though
  its flagship vehicle (Ariane 6) IS registered -- the vehicle registry entry
  carries no organization `website` field for `loadRegistryHosts` to key off,
  so `newsroom.arianespace.com` couldn't be classed first_party either; led
  with Via Satellite and linked Arianespace's own release in `secondary_urls`
  instead. Worth adding an Arianespace organization profile at the next
  registry structural touch.
- 2026-07-26-F: A scheduled-but-not-yet-flown launch (Arianespace's Aug 27
  MTG-I2 mission, Ariane 6's first flight to GTO per Arianespace's own
  release) does NOT crossfeed against the vehicle's `flights_total` snapshot
  (registry value 8, as_of 2026-07-05) -- the mission hasn't flown yet, so
  there is no completed-flight count to compare. Only crossfeed a monotonic
  counter once the source states the count actually changed, not from a
  future-dated schedule announcement.
- 2026-07-26-G: Chased a genuinely never-covered, dated event that was over
  a month old: ESA's June 8 agreement for Vast to fly Czech reserve astronaut
  Ales Svoboda to the ISS (first NASA-awarded Private Astronaut Mission
  assigned to Vast) had zero prior MCC coverage under any name despite being
  multi-sourced (Vast's own release, ESA's official press release, and
  SpaceWatch.Global) at the time. Distinguish this from the standing "process
  not yet fact" exclusion pattern (Sweden ICEYE/Planet Labs interview update,
  NASA/GAO workforce-reduction report, both left undrafted this same run):
  the Vast/ESA story is a closed, dated agreement with named parties and a
  named mission, not an ongoing interview reaffirmation of already-known
  facts -- age alone isn't disqualifying when the underlying fact was never
  published and is still cleanly sourceable.
- 2026-07-26-H: `bun run build` was denied by this session's permission gate
  again (continuing 2026-07-11-B/2026-07-23-I); relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 6 new, 0 updated, 0
  held") per the same standing precedent.
- 2026-07-26-I: Shell redirection (`>`, even to a fresh file inside the repo
  working directory) was blocked outright this session for every destination
  tried, not just paths outside the repo -- a stricter sandbox than prior
  sessions. Writing a scratch triage script and running it via `bun
  triage.ts` also hit an unresolvable permission wall with no interactive
  approval available (this was an unattended scheduled run). Worked around
  both by piping the mandated scripts' (`candidates-context.ts`,
  `sweep-context.ts`) stdout directly through `grep`/`sed`/`head`/`tail` and
  reading the tool's own persisted-output files via the Read tool for
  chunks too large for one Bash call. Avoid `sed -n 'N,$p'` (the bare `$`
  triggers a "Contains simple_expansion" approval wall per 2026-07-24-K);
  use an explicit large line number instead of `$`.

## Narrow same-day re-check, ~7.5hr gap, unfiltered full source list (2026-07-26, second)

- 2026-07-26-J: An "ISRO" keyword match in Google News: non-US space this run
  was almost entirely a false positive: a domestic Indian exam-reform
  committee ("Ex-ISRO chief... Nandan Nilekani-led panel") repeated across
  six near-identical headlines, none of it space-industry news. Confirms the
  standing keyword-noise pattern (SpaceX stock/IPO, Starship Flight 13
  recap) extends to actor-name collisions outside SpaceX; check what the
  story is actually about before treating a tracked-actor name match as a
  candidate.
- 2026-07-26-K: Two genuinely new, never-covered items surfaced only via the
  discovery pass, not the harvester queue: ATmoto/Liangxi's Gande-01 (China's
  first commercial space-debris-monitoring satellite, via Xinhua, corroborated
  by China Daily's independent five-satellite rideshare writeup) and JAXA's
  Epsilon S second-stage M-35a engine test recovery (via Xinhua, corroborated
  by Nikkei Asia). Both Xinhua pieces were themselves single "China Focus"
  wire dispatches that bignewsnetwork.com, chinadailyasia.com, and archyde.com
  all reprinted near-verbatim (archyde confirmed via its own byline as an
  Xinhua-credited rewrite with added generic commentary) -- none of those
  counted as independent corroboration; the genuine second sources were a
  same-story but differently-reported domestic Chinese-language article
  (chinadaily.com.cn tech, found via a Chinese-language search for the
  rocket/satellite names) and a distinct-outlet English piece (Nikkei Asia),
  not the wire's own syndication network.
- 2026-07-26-L: A same-day Bluesky post teasing a "new" analyst report can be
  reselling month-old figures: Tim Farrar's July 26 post pointed to a paid
  Starlink 2030 forecast ($48B revenue/46M subscribers) that traced straight
  to his own June 2 blog post of the same figures, already picked up by
  SatNews and Advanced Television in early June. Left undrafted as a stale
  resurfacing (extends 2026-07-19-D/E, 2026-07-26-B) rather than treated as
  fresh commentary; worth a quick search for the exact figures before
  drafting any analyst-forecast teaser post as new.
- 2026-07-26-M: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the standing
  pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 2 new, 0 updated, 0 held") as the build-health signal.

## Narrow same-day re-check, ~12hr gap, unfiltered full source list (2026-07-27)

- 2026-07-27-A: The 2026-07-17-K "unconfirmed 'in talks' scoop published at
  its honest floor rather than held" precedent extends cleanly from M&A/deal
  rumors to funding-round rumors: The Exploration Company's FT-reported
  ($300M at a $2B valuation) round was "in talks," "not finalized," sourced
  to "people familiar," and every pickup (Bloomberg, Seeking Alpha,
  Investing.com, MarketScreener) explicitly attributed the story to FT
  rather than doing independent reporting -- one source under the wire-
  rewrite rule, `crawl: found_none`. Led with Investing.com (`informal`,
  most detailed relay, not a wire mirror) rather than Bloomberg (paywalled,
  thinner relay); landed at the honest SNR-1 floor with an explicit
  "could still fall through" caveat in the copy, same shape as the SpaceX/
  Pentagon compute item.
- 2026-07-27-B: Jeff Foust's July 24 post on the Office of Space Commerce
  "moving ahead" on mission authorization ("taking the next step forward"
  on the still-voluntary "Space Commerce Certification" proposal open for
  comment since March) is the same ongoing regulatory process already
  excluded as "process not yet fact" in 2026-07-23-L, not a new closed
  action; left undrafted again rather than re-litigated.
- 2026-07-27-C: A University of Warwick-led academic survey re-analyzing
  archival telescope data to find 25 previously-undetected small debris
  objects in GEO (widely covered by Gizmodo/Vice/phys.org/The Debrief) was
  left out as an academic research paper with no named operator, no
  attributable commercial actor, and no dated operational consequence --
  distinct from the `incident` category's reentry/collision/anomaly
  examples, which all attribute to a reporting authority about a specific
  object or event.

## Narrow same-day re-check, ~6h41m gap, unfiltered full source list (2026-07-27, second)

- 2026-07-27-D: `fetch-list.ts` only prints the CONFIGURED status from
  sources.json; it does not itself fetch anything. Its `htmlSources`
  entries showing `"status": "verified"` reflect the status already on
  record, not a live check this run. Treating that printed status as if
  it were a completed fetch (and writing a placeholder
  `evidence.excerpt` like "fetched via fetch-list.ts this run") is
  exactly the kind of unattested success `PROOF OF FETCH` exists to
  catch -- caught it before running finalize-sweep by re-reading
  fetch-list.ts's source, then actually WebFetched all ~20 listed html
  sources and replaced every placeholder with a real verbatim excerpt.
  fetch-list.ts is a deterministic URL-list generator for the agent to
  walk, not a fetcher in itself; candidates-context.ts's `health` block
  is the one that reflects an actual completed fetch (the harvester's),
  for feed-type sources only.
- 2026-07-27-E: A same-day corroboration-search query surfaced a story
  the harvester queue's Google News/Bluesky legs had already flagged
  heavily (Amazon Leo's FCC filing for a 5,105-satellite direct-to-device
  constellation on Globalstar spectrum, filed July 24): Amazon's own
  aboutamazon.com page confirmed the same facts as SpaceNews and Aviation
  Week, so it led as `first_party` (tier 5, no found_none penalty
  applies) rather than a trade source. `www.aboutamazon.com` matches the
  registry's stored `kuiper` website (aboutamazon.com apex), confirming
  the constellation's registry entity covers Amazon Leo's newer D2D
  filings too, not just the original Kuiper website page.
- 2026-07-27-F: Requesting a `bump: "corroboration_4plus"` on an update
  whose lead is `trade` (base tier 3) is a harmless no-op, not an error:
  the direct-source ceiling caps indirect (non-tier-5-led) items at 4
  regardless of source count once `corroboration_2plus` already reached
  it, so `applyModifier` computes a zero delta and finalize-sweep
  silently skips emitting the modifier (score stays at its already-
  correct value). Attaching the SES Upper C-band incentive-payment
  sources (SatNews, Advanced Television) as the item's 4th and 5th
  sources was still worth doing for the record even though the bump
  request did nothing; only a first_party/official_record/computed lead
  can still be climbing when a 4th source arrives.

## Narrow same-day re-check, ~12hr gap, unfiltered full source list (2026-07-28)

- 2026-07-28-A: A registry `website` field can exist on a constellation
  profile (not just an organization profile) and still floors
  `first_party` classification for the parent operator's press releases:
  O3b mPOWER's registry entry (a constellation, not an SES org profile)
  carries a `website` field pointing at ses.com, so `loadRegistryHosts`
  picked up the ses.com host and the SES Space & Defense/Starlab LEO
  Relay Services press release classed clean as `first_party` even
  though SES has no dedicated organization profile. Worth checking
  constellation/vehicle entities for a usable `website` host, not just
  searching for an org profile, before defaulting an unregistered-looking
  operator to a lower tier.
- 2026-07-28-B: Extends the 2026-07-26-E "new/small actor, no registry
  host" pattern with a working fallback: MDA Space UK's own PR Newswire
  release (Argonaut LEIA LiDAR sensor selection by OHB) has no registry
  host to verify (`mda.space` isn't a registered website field anywhere),
  but PR Newswire itself is a fixed-domain `wire_pr` source (tier 4, no
  domain-match requirement) rather than needing `first_party`/`trade`
  fallback -- led with the wire copy at tier 4 instead of settling for a
  trade write-up at tier 3. Worth defaulting to `wire_pr` for straight
  press-release text run through BusinessWire/GlobeNewswire/PR Newswire
  before falling back further down the source-class ladder.
- 2026-07-28-C: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B/2026-07-26-M/2026-07-27-D; relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 0
  updated, 0 held") as the build-health signal.
- 2026-07-28-D: A discovery-pass query aimed at a different topic (an
  EO-contracts search) surfaced a genuinely new, week-old, never-covered
  story one hop away in the same search results list (MDA Space UK/OHB
  Argonaut LiDAR sensors, found via a "Europe space agency contract
  announcement July 2026" query run for the non-US/Europe matrix slot,
  not an EO-specific query) -- worth reading past the first couple of
  results on every matrix query rather than stopping at the query's
  literal topic match.

## Narrow same-day re-check, ~4hr gap, unfiltered full source list (2026-07-28, second)

- 2026-07-28-E: A new subtype of the stale-resurfacing trap: ESA's own
  multimedia image gallery (esa.int/ESA_Multimedia/Images/2026/07/...)
  served a photo captioned "Vertical liftoff as Ariane 6 takes flight for
  the first time" with a July 28, 2026 harvester timestamp, even though
  Ariane 6 has flown repeatedly since its actual maiden flight and the
  already-published registry/item record shows its August 27 MTG-I2
  mission as only "the vehicle's first flight to geostationary transfer
  orbit" (a different, still-future milestone). A fresh-looking
  `fetched_at`/`published_at` stamp on an image-gallery URL is not proof
  the underlying event is new; cross-check against the existing item/
  registry record for the vehicle's actual flight history before
  treating an archival caption as today's news.
- 2026-07-28-F: Two small, low-cost update patches shipped this run from
  cross-checking existing items against sources fetched for other
  reasons: Telesat's own July 27 GlobeNewswire release (found via
  fetch-list.ts's Telesat News listing) upgraded the FCC upper-C-band
  item's rounded "just under $200 million" Telesat figure to the exact
  $189 million and added a Nov. 5, 2026 transition-plan filing deadline;
  and Andrew Parsonson's already-cited MAGPIE article (europeanspaceflight.com,
  a mandatory signals-pass fetch) turned out to have been updated in
  place on July 27 with an on-record ESA spokesperson quote explaining
  the contract's cost overrun. Neither needed a new source attach beyond
  Telesat's own wire copy; the MAGPIE case was a same-URL content update,
  confirming updates can come from re-reading a source already in an
  item's `sources` array, not just from new URLs.
- 2026-07-28-G: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 0 new, 2 updated, 0 held") as the build-health signal.

## Narrow same-day re-check, ~7h40m gap, unfiltered full source list (2026-07-28, third)

- 2026-07-28-H: A PDF-only FCC public notice (docs.fcc.gov, linked only from
  a Google News-fed trade/financial headline about "Starlink router ban
  exemption") is fully readable despite WebFetch itself failing on the raw
  PDF ("appears to be raw PDF binary data, not readable text"): WebFetch
  still saves the fetched PDF to a local tool-results path and reports it in
  the response, and the Read tool parses that saved PDF cleanly, including
  a multi-page appendix table. Worth trying `Read` on the saved-PDF path
  any time WebFetch's own PDF summarizer bails, rather than treating a
  failed WebFetch PDF parse as an unreadable source.
- 2026-07-28-I: A same-company (SpaceX), same-category ("regulatory")
  dedup false-positive within the 7-day window, the same recurring
  heuristic trap documented many times since 2026-07-09-B: the FCC's
  Starlink-router Covered-List exemption (US equipment authorization)
  tripped a match against Taiwan's Legislative Yuan easing satellite
  foreign-ownership caps (2026-07-21, six days prior) purely on shared
  company + category, despite being unrelated regulators, countries, and
  subject matter. Cleared with one `dedup_distinct` entry.
- 2026-07-28-J: NASA's own program-announcement page (nasa.gov, dated
  July 24) predated the trade write-up that surfaced it in this run's
  discovery pass (SpaceNews, July 28) by four days; led with NASA's page
  as `official_record` and dated the item to the NASA announcement date,
  not the SpaceNews publish date, consistent with the standing
  2026-07-06-GG/2026-07-26-D dating convention. Also confirms
  2026-07-05-N's verification lesson: a first WebFetch summary named the
  spacecraft builder "Lockhaven Martin/Terran Orbital" (a hallucinated
  mash-up); a targeted second WebFetch asking for the exact sentence
  verbatim corrected it to "Lockheed Martin subsidiary Terran Orbital."
- 2026-07-28-K: Confirms the "process not yet fact" pattern on three more
  shapes this run, all left undrafted rather than held: Germany's defence
  minister "considering" a Bundeswehr-owned launch site (his own quotes:
  "we are at the beginning of those considerations," no site or country
  named); a Manila Times recap of the Philippines' spaceport ambitions
  pegged to a SONA speech, with every concrete milestone in it already
  weeks to years old; and ISRO's chairman floating a 2027 G20 satellite
  launch with no contract or vendor named. Also caught before drafting: a
  europeanspaceflight.com "Avio and Isar Aerospace win ESA Flight Ticket
  Initiative" article that reads current but is dated August 27, 2025 in
  the fetched content, a full year stale.
- 2026-07-28-L: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 2 new, 0 updated, 0 held") as the build-health signal.

## Normal-mode sweep, ~12hr gap, unfiltered full source list (2026-07-29)

- 2026-07-29-A: Brand-name collision across separate legal entities: an
  ispace Inc. (Japan) announcement (switching its Mission 3 lunar lander
  to Japan's H3 rocket) tripped the same-company-plus-category dedup
  heuristic against the unrelated `2026-07-24-esa-ispace-europe-magpie-
  contract` item purely because both companies use "ispace" in their
  name (ispace-Europe is ESA's MAGPIE rover subcontractor, a distinct
  corporate entity from the Japanese parent behind Mission 3), both
  category `science`, nine days apart. Cleared with one dedup_distinct
  entry; adds a new trigger shape to the standing list (shared brand
  name, not shared company) alongside the SpaceX/ESA/NASA cases logged
  since 2026-07-09-B.
- 2026-07-29-B: transportation.gov (`/briefing-room/...`) and faa.gov
  (`/newsroom/...`) both 403'd on direct WebFetch this session for a
  genuine DOT/FAA press release (the launch-licensing environmental-
  waiver NPRM), extending the standing .gov-domain fetch-failure pattern
  (fcc.gov, sam.gov, spaceforce.mil, war.gov) to two more hosts. Led
  with SpacePolicyOnline (whitelist, observer) instead, corroborated by
  an AFP wire copy (freemalaysiatoday.com) found via WebSearch; landed
  at SNR 4. Do not cite the 403'd .gov URLs even unscored, per the
  standing "only link pages actually fetched" rule (2026-07-16-F).
- 2026-07-29-C: pedaily.cn (投资界/PEdaily), a long-running Chinese VC/PE
  trade outlet, gave genuinely independent corroboration (extra detail:
  founding date, specific in-house technologies) for a Chinese SSA-
  constellation funding round SpaceNews also covered, confirmed via
  direct fetch to not be a rewrite of either. Same tier as
  chinaventure.com.cn (2026-07-20-F); worth trying alongside it on
  future Chinese funding-round stories before settling for a Sina/
  Eastmoney wire-reprint mirror.
- 2026-07-29-D: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 5 new, 3 updated, 0 held") as the build-health signal.

## Narrow same-day re-check, ~4hr gap, unfiltered full source list (2026-07-29, second)

- 2026-07-29-E: The draft's top-level `coverage` field validates against the
  CATEGORY enum only, not tag names: listing `"connectivity"` (a domain tag,
  not a category) alongside real categories got the whole draft rejected
  ("connectivity is not a known category"). Populate `coverage` with
  categories actually touched (e.g. `procurement`, `launch`, `financial`,
  `regulatory`) even when the sweep's one item is tagged with a domain that
  isn't itself a category.
- 2026-07-29-F: A whitelisted signal's own Bluesky post pointing at their own
  trade-press article (Andrew Parsonson flagging his SpaceNews piece on ESA's
  July 27 Lunar Link repurposing tender) was this run's only genuinely new
  find in an otherwise fully quiet harvester queue (95%+ SpaceX stock/
  earnings speculation and ISRO recruitment-notice noise). A corroboration
  crawl (2 targeted searches, plus checking europeanspaceflight.com's own
  front page directly) found no second outlet covering the specific July 27
  tender -- Parsonson/SpaceNews appears to be the sole source -- so it
  published `crawl: found_none` at the honest SNR-2 floor rather than being
  held for thin sourcing.
- 2026-07-29-G: Two more stale-resurfacing traps caught via a date-
  plausibility check rather than an explicit article date: a "Space Force
  awards Viasat, SES $437M" hit and a "Satellogic secures $18M defense
  contract" hit both search-summarized as if current, but both trace to
  May 2026 announcements (over a month outside this run's window) once
  opened. Separately, a WebSearch summary described ESA's Aeolus "reentry
  maneuver" with day-of-week detail (Monday, Thursday, Friday) that only
  lines up with the 2023 calendar, not 2026's -- confirming the item was the
  real 2023 assisted-reentry campaign, not new; cross-checking a maneuver-day
  narrative against the current year's actual weekday calendar is a fast
  stale-check when no explicit article date is visible.

## Normal-mode sweep, ~7.5hr gap, unfiltered full source list (2026-07-29, third)

- 2026-07-29-H: A Chinese satellite's own name can carry generation framing a
  primary state-media source doesn't spell out: Xinhua's Tianlian III-01
  launch story only said "data relay and TT&C services" (near-identical
  wording to the Tianlian II-06 story six days earlier), but the "III" in the
  satellite's own name plus Launch Library's payload description ("3rd
  generation... succeeding the Tianlian II series") independently supported
  drafting it as a generational milestone (impact `notable`) rather than
  matching the prior item's routine-cadence `noise`. Also confirms the
  standing same-company-plus-category dedup trap once more: CASC + `launch`
  within 7 days of the II-06 item needed one `dedup_distinct` entry despite
  being a genuinely different satellite, generation, rocket, and launch site.
- 2026-07-29-I: A same-company follow-up story inside the 7-day window can be
  a legitimate judgment call between "new item" and "fold into existing" even
  when the event class differs: LatConnect 60's July 29 SpaceNews piece on
  Malaysia/UAE manufacturing expansion and an 18-satellite SWIRSAT target is a
  different topic than its July 24 AI-product item, but carried no new dollar
  figure or contract, so it was folded into the existing item's
  `what_happened` via `updates[].attach` rather than drafted standalone.
  Mechanical note: `updates[].attach[].via` only accepts `corroboration` or
  `upgrade` (no neutral "new fact, not corroboration" value exists yet);
  used `corroboration` and let the `note` field carry the actual nuance.
- 2026-07-29-J: Cross-outlet dollar figures can diverge by rounding or
  currency without being a genuine contradiction: Outlier Space's Payload
  lead and NBR (NZ) both stated "$7.35M" exactly, while NZ Herald said
  "$7.5M" and two AU outlets (Capital Brief, Forbes Australia) said "$10.5M"
  (plausibly an AUD-denominated figure for the same USD round). Led with the
  two sources that matched exactly rather than reconciling or averaging
  across all of them, per the standing "numbers copied, not synthesized"
  rule.
- 2026-07-29-K: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the standing
  pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 5 new, 1 updated, 0 held") as the build-health
  signal.

## Narrow same-day re-check, ~12hr gap, unfiltered full source list (2026-07-30)

- 2026-07-30-A: reuters.com joins arstechnica.com (2026-07-08-N) as a domain
  WebFetch flatly refuses ("Claude Code is unable to fetch from
  www.reuters.com") rather than a normal 403/timeout. investing.com carries
  Reuters' own wire text verbatim with an explicit "By Reuters" byline and
  fetches cleanly; used it as the mainstream-class source (outlet "Reuters
  (via Investing.com)") rather than dropping the corroboration or trying
  reuters.com again.
- 2026-07-30-B: a same-story local-TV corroboration can quietly describe a
  DIFFERENT prior contract: WFTV's write-up of All Points Logistics' new
  $250M Vandenberg award (SpaceNews, KEYT) instead described a 64-acre
  Cape Canaveral/KSC-area facility targeted for 2027, matching the "third
  NSSL Space Vehicle Processing contract" framing but not the Vandenberg
  Mission Development Zone/2029 details every other source gave. Read as
  the outlet conflating this award with an earlier, similarly-shaped All
  Points project rather than independent confirmation; left WFTV unused
  and corroborated with KEYT instead, whose facts matched SpaceNews
  exactly. Don't accept a second source's specifics merely because its
  headline number matches; check its location/timeline details agree too.
- 2026-07-30-C: europeanspaceflight.com and spacepolicyonline.com are each
  BOTH a standing sources.json discovery feed (covered automatically by the
  harvester/candidates-context health block) AND a signals-context.ts
  fetchable channel (Andrew Parsonson, Marcia Smith) -- no need to
  separately WebFetch the bare site during the signals pass when the
  harvester's own RSS fetch of the same domain already shows nothing newer
  in `health`; note it as "covered via harvester feed" in `signalsPass` and
  spend the budget on channels the harvester doesn't already walk (Bluesky
  accounts, podcast/blog sites not in sources.json).
- 2026-07-30-D: search-engine results for two off-list leads (Astroscale
  Japan's "gripping mechanism" Ministry of Defense contract, Rocket Lab's
  "multiple launches with JAXA") both resolved on direct fetch to genuinely
  old articles (January 2026 and October 2025 respectively) despite reading
  like fresh July 2026 hits in the search snippet -- confirms 2026-07-08-E/
  2026-07-12-G's pattern on two more cases; always open the actual page and
  check its stated publish date before drafting a search-surfaced lead.

## Narrow same-day re-check, ~3h50m gap, unfiltered full source list (2026-07-30, second)

- 2026-07-30-E: CASC's own site (english.spacechina.com) is a genuine
  first_party lead for its own launches, not just a Xinhua mirror: its
  article on the Tianlian III-01 launch (already published same-day from
  Xinhua, mainstream tier 3) restated the identical 7:50 p.m. Beijing time
  detail, confirming it was CASC's own report rather than a wire rewrite;
  rescoring the lead to CASC (first_party, registry website matches exactly)
  raised the item from SNR 4 to 5. Worth checking CASC's own site against an
  already-published Xinhua/CRI-led Chinese launch item before assuming
  Xinhua is the best available source -- CASC often publishes the same
  event as a first-party primary alongside the state-media wire copy.
- 2026-07-30-F: A contracting party's own newsroom can out-rank the outlet
  that broke the story: Nikkei first reported ispace's H3/Ultra lander
  switch (mainstream, corroboration crawl found nothing, published at SNR
  2), but Mitsubishi Heavy Industries -- the OTHER contracting party, not
  ispace itself -- had its own press release on mhi.com (registry-matched
  first_party) confirming the exact same contract signing, found via a
  plain WebSearch the next day. Rescoring the lead to MHI's release raised
  the item from SNR 2 to 5 (first_party ceiling) and surfaced a fresh detail
  (the METI SBIR grant funding the Ultra lander) neither the original
  candidate nor the Nikkei article had stated. When a story involves a
  named counterparty company, search for that counterparty's own newsroom
  before settling for the outlet-report SNR, even after the item has
  already published.
- 2026-07-30-G: Two Chinese state-media "top news" items on CASC's site
  dated the SAME calendar day as an already-published item can be the exact
  same event restated a day later (Beijing-time publish lag), not a new
  one: cross-check the launch time/rocket/site stated in the new CASC
  article against the existing item's explainer text before drafting a
  same-company, same-category "new" candidate -- here it was a genuine
  same-event match (Tianlian III-01) and became a source-upgrade update,
  while a second same-day CASC "top news" item (a Long March-6 comms-test
  launch from Taiyuan, different rocket/site/payload) was the real new
  item and needed a `dedup_distinct` note to clear the same-company/
  category heuristic against both the Tianlian III-01 and Tianlian II-06
  items sitting within the 7-day window.
- 2026-07-30-H: The Federal Register's own JSON API
  (federalregister.gov/api/v1/documents/<doc-id>.json) is directly
  WebFetch-able and returns clean structured fields (title, type,
  publication_date, docket_id, agencies, abstract, comments_close_on,
  html_url) even though the HTML document page itself
  (federalregister.gov/documents/...) redirects WebFetch to an
  "unblock.federalregister.gov" bot-check page. Confirmed a proposed rule
  already reported via SpacePolicyOnline (whitelist, tier 3/4) two days
  earlier and supplied the exact docket number (FAA-2026-8614) and comment
  deadline (August 31, 2026) that neither original source had stated;
  rescoring the lead to the Federal Register (.gov, official_record)
  raised the item from SNR 4 to 5. Try the `/api/v1/documents/<id>.json`
  form on any federalregister.gov URL the harvester's Federal Register API
  health source already surfaced, rather than the HTML page, when a
  regulatory candidate needs the primary document as an upgrade.
- 2026-07-30-I: Bluesky's public, unauthenticated API
  (public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=N)
  is directly WebFetch-able and returns each post's verbatim text and
  createdAt timestamp; the bsky.app profile page itself is a JS shell
  WebFetch cannot render (no posts, no timestamps). Use the API form for
  every signals-pass Bluesky account fetch going forward rather than the
  bsky.app profile URL, which returns nothing usable.
- 2026-07-30-J: Two search-surfaced leads dated within window turned out to
  be older news resurfacing: NASA's Roman Space Telescope "launching nine
  months ahead of schedule" (search snippet implied fresh) traced on direct
  fetch of SpacePolicyOnline's own article to June 2, 2026, nearly two
  months stale; and Japan/Singapore's JAXA-NSAS space cooperation agreement
  traced to a July 9 SPACETIDE 2026 signing, also outside this run's
  2026-07-28 window start. Both confirm the standing "open the actual page
  and check its date" rule (2026-07-08-E and peers) rather than trusting a
  search snippet's apparent recency.

## Narrow same-day re-check, ~7h40m gap, unfiltered full source list (2026-07-30, third)

- 2026-07-30-K: A single unattributable Bluesky bot post claiming an
  "NROL-95 @SpaceX partial failure" directly contradicted the already-
  published item (multiple sources: Spaceflight Now, Florida Today, the
  NRO) confirming a clean launch and booster landing. A targeted search
  found zero corroboration and multiple sources affirming success; treated
  the claim as false rather than holding or hedging the existing item.
  Worth a reminder that a bare informal claim contradicting an already-
  multi-sourced fact needs its own verification pass before it touches an
  item, not just before it becomes one.
- 2026-07-30-L: Four separate harvester-queue/signals hits this run each
  turned out to be same-day catch-up coverage of stories already fully
  published under different leads, not fresh news: Rocket Lab's "$266M
  Space Force contract" (Bluesky, actually the already-published July 21
  HASTE Alaska deal, whose own GlobeNewswire release date was July 27);
  SpaceX/Blue Origin "orbital data center" FCC filings (qz.com/newsnation,
  actually Blue Origin's March 19 and SpaceX's February 1 filings, already
  covered via the 2026-07-08 Earthjustice item); the Katalyst/NASA Swift
  LINK reboost "setback" (SpacePolicyOnline Bluesky, already fully folded
  into the 2026-07-03 item's what_happened, word for word); and a same-day
  Via Satellite write-up of the Fortastra/Hadrian manufacturing MoU
  (already published 2026-07-29 from SpaceNews with identical facts). All
  four needed a dedup check against existing[] before drafting; none added
  a new fact.
- 2026-07-30-M: investors.rocketlabcorp.com timed out on a direct WebFetch
  (60s), unlike the 2026-07-05-S/2026-07-07-L pattern where it or its
  Cloudflare-gated updates page usually resolves; fell back cleanly to
  SpaceNews (trade, lead) plus a GlobeNewswire wire-copy mirror (Manila
  Times) for corroboration rather than retrying or blocking on the
  first-party fetch.
- 2026-07-30-N: `investors.planet.com` and `www.ariane.group` both classed
  clean as `first_party` this run (Planet's IR subdomain against the
  `planet` constellation's registered `www.planet.com`, per the
  2026-07-07-E www-stripping fix; ArianeGroup's own domain against its org
  profile's `https://www.ariane.group/`), landing both items at the tier-5
  ceiling with a trade corroboration attached for free. Worth checking a
  registry entity's `website` field before defaulting a well-known
  operator's own newsroom to a lower tier.
- 2026-07-30-O: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate again, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own
  merge confirmation ("merged 5 new, 0 updated, 0 held") as the
  build-health signal.

## Narrow same-day re-check, ~12hr gap, unfiltered full source list (2026-07-31)

- 2026-07-31-A: A near-total-duplicate sweep: the harvester queue was
  95%+ SpaceX/Tesla-merger stock speculation and ISRO exam/recruitment
  noise, and every substantive-looking lead across the queue, 11 HTML
  sources, 15 signals channels, and an 8-query discovery matrix (K2
  Space $500M, Rocket Lab/iQPS third deal, ArianeGroup Themis wet dress
  rehearsal, MaiaSpace suborbital-skip, True Anomaly VICTUS HAZE
  pursuit, SpaceX $1.6B Space Force order, DOT/FAA environmental
  waiver, Amazon D2D FCC filing, ispace-Europe MAGPIE, NASA CLD draft
  RFP) traced straight to items already published earlier the same day
  or before the window. Only action this run: attached a free
  corroboration source (Ars Technica) to an existing item. Confirms the
  standing pattern (2026-07-05-S and many peers) that a short same-day
  re-check against a fully unfiltered source list can legitimately
  yield near-zero net change when a prior sweep the same day already
  covered the ground.
- 2026-07-31-B: `sourceHealth` has no clean status for "attempted this
  run, failed, but not yet the third consecutive failure" on a source
  that is currently `verified` with `fail_count: 0`: reporting
  `status: "verified"` triggers the evidence-of-successful-fetch gate
  (no excerpt exists for a failed fetch) but `"dead"` overstates a
  single blip and `"unverified"` wrongly resets an established source.
  Two one-off failures this run (space.skyrocket.de/Gunter's:
  ECONNREFUSED; sierraspace.com/newsroom: HTTP 403, both previously
  reliable) were left OUT of the draft's `sourceHealth` entirely rather
  than misreported; noting the blips here instead. Worth a schema
  addition (an explicit `attempted_failed` status, or an
  `evidence`-optional failure note under the existing status) if this
  recurs enough to matter for fail_count accuracy.
- 2026-07-31-C: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 0 new, 1 updated, 0 held") as the build-health signal.

## Narrow same-day re-check, ~4hr gap, unfiltered full source list (2026-07-31, second)

- 2026-07-31-D: JAXA sometimes splits one flyby event across two same-day
  press releases, each headlining a different specific achievement (here,
  Hayabusa2's Torifune flyby: one release on the closest-approach distance
  record, a second on the world-first LIDAR ranging during the same pass).
  Both are the same event under the 7-day dedup rule; drafted as one item
  combining both facts rather than two. finalize-sweep's same-domain
  corroboration collapse folds the second JAXA URL into one scoring unit
  automatically, which is correct here since both are first-party JAXA
  anyway; check for this twin-release pattern before drafting a JAXA
  same-day queue hit as two separate items.
- 2026-07-31-E: A KeepTrack-style predicted conjunction alert (STARLINK-5262
  vs. MONOLITH, 6m minimum range, "collision probability 1.0", surfaced via
  WebSearch) is a forecast, not a confirmed incident: no outlet reported
  whether a maneuver was performed or a collision occurred, and Starlink
  alone generates on the order of tens of thousands of such conjunction
  alerts every few months per Space.com's own reporting. Left unpublished;
  a predicted-collision-probability figure needs a follow-up source
  confirming an actual outcome (maneuver, miss, or collision) before it is
  a publishable incident, not just a tracking-tool forecast.
- 2026-07-31-F: Advanced Television's July 31 rewrite of the July 30
  Rocket Lab/iQPS third-launch-deal story headlined it "Rocket Lab wins
  Chinese launch contracts" even though the body (and every other outlet)
  correctly identifies iQPS as Japanese; a rewrite outlet's headline can
  mislabel geography/actor even when the body facts match an already-
  published item exactly. Confirmed via the body details (three dedicated
  Electron launches, total contracted missions now 18) before treating it
  as dedup rather than a genuinely new China-related item.
- 2026-07-31-G: The SES/LATAM Airlines multi-orbit IFC item shared company
  "SES" and category "partnership" with the already-published 2026-07-27
  SES Space & Defense/Starlab relay item within the 7-day window, tripping
  the dedup gate on a same-company/category heuristic despite being
  completely unrelated products (airline inflight WiFi vs. a space-station
  relay contract); cleared with `dedup_distinct`. A shared parent company
  name across two divisions (SES commercial mobility vs. SES Space &
  Defense) is not itself evidence of the same event.
- 2026-07-31-H: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 3 new, 1 updated, 0 held") as the build-health signal.

## Normal-mode sweep, ~7.5hr gap, unfiltered full source list (2026-07-31, third)

- 2026-07-31-I: `updates[].patch.secondary_urls` is silently ignored:
  `finalize-sweep.ts`'s merge always recomputes `secondary_urls` as
  `base.secondary_urls` plus each `attach[].url` (source: the object
  literal sets `secondary_urls: newSecondary` last, overriding anything
  in `...patch`), and there is no separate unscored-link field for
  updates the way `newItems[].secondary_urls` lets a fresh item carry an
  unscored link. To add a company's own page as an honest link on an
  UPDATE when it has no registry host to verify (the standing
  2026-07-07-K/2026-07-08-A new-actor pattern), the only mechanical path
  is `attach` it at the conservative `informal` class rather than
  `first_party` -- confirmed working this run on Katalyst Space's own
  mission-tracker page (no registry entry exists for Katalyst at all).
- 2026-07-31-J: WebFetch could not render Google News RSS redirect
  articles today (returned only "Google News" header text, no publisher
  content, unlike the documented redirect-then-refetch flow) or a
  handful of ordinary publisher pages (theregister.com 404'd twice on
  slightly different URL punctuation, livescience.com truncated to a
  headline-only stub) -- WebSearch on the exact headline text reliably
  found and summarized the same underlying story in every case this run
  (OHB's AD HOC NEWS stock piece resolved to the OHB Italia PRISMA
  Second Generation ASI contract; the Register piece's facts came
  through via a Katalyst-space.com direct fetch instead). Worth trying
  WebSearch-by-headline as the fallback before writing a Google
  News/publisher URL off as unreachable.
- 2026-07-31-K: A same-day stock-commentary rewrite of an already-
  published contract (AD HOC NEWS's "OHB's Italian Earth-Observation Win
  Masks a Stock Still Digging Out of a Deep Correction," about the
  already-published 2026-07-29-prisma-second-generation-contract item)
  needed no draft action: it isn't a named analyst's attributed call
  (not clean commentary) and states no new registry-relevant fact (pure
  stock-price framing), so it was left alone rather than forced into
  either an item or an update.
- 2026-07-31-L: Confirms 2026-07-06-L/2026-07-06-JJ: cross-checking an
  already-published item's own sourcing against a page fetched for an
  unrelated reason (OHB's own PRISMA press release, found while
  resolving the AD HOC NEWS redirect) found a genuine free upgrade
  opportunity (OHB Italia's own ohb.de page, registry-matched
  first_party, alongside the item's sole existing source, Thales Alenia
  Space) -- not used this run for effort/value reasons since the item is
  already at the SNR 5 ceiling, but worth a routine attach next time
  this item is touched for any other reason.
- 2026-07-31-M: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 1 new, 2 updated, 0 held") as the build-health signal.

## Normal-mode sweep, ~11h45m gap, unfiltered full source list (2026-08-01)

- 2026-08-01-A: A queue near-saturated with SpaceX stock/IPO speculation and
  Bluesky launch-bot spam (92 collapsed candidates, maybe 4 genuinely on-topic)
  again produced only one real item from the queue itself (a routine Starlink
  Vandenberg batch); the discovery pass's Airbus/Thales press-release leg
  surfaced a genuine gap instead: Hisdesat's SpainSat NG II secure-comms
  satellite was destroyed by a debris strike in January 2026 and never
  covered under any name (grepped items.json/held.json for "spainsat"/
  "hisdesat", zero hits), which directly explains why Hisdesat signed a
  SpainSat NG III replacement contract with Airbus/Thales the same day this
  sweep ran. Chased the January loss per the standing predates-window
  ruling (major-tier, never covered) and published both dated to their
  actual event dates, seven months apart.
- 2026-08-01-B: Name-collision scope trap, new shape: "Space-Eyes, Inc.", an
  Eric-Trump-backed company going public via a $638M SPAC merger with
  McKinley Acquisition (ticker CUAS), reads exactly like a tracked space
  company from its name and search snippets alone, but it is a counter-drone/
  AI geospatial-intelligence defense company (products: Morpheus counter-UAS,
  SeaWatch maritime intel) with no orbital space product. Confirmed via a
  targeted "what does the company do" search before treating the SPAC deal
  as a scope-fitting M&A candidate; discarded.
- 2026-08-01-C: The same-company-plus-category dedup heuristic can fire on a
  company mentioned only as a CO-CONTRACTOR, not the item's lead actor: a new
  Hisdesat/Airbus/Thales Alenia Space satcom contract (category procurement)
  matched two unrelated existing items purely because Thales Alenia Space
  also appears in their company lists (ESA's Lunar Link Gateway tender,
  ASI's PRISMA Second Generation contract), neither of which shares an actor,
  program, or buyer with the Hisdesat deal. Cleared with two dedup_distinct
  entries in one pass; worth remembering the heuristic scans the full
  `companies` array, not just the primary/lead actor.
- 2026-08-01-D: Thales Alenia Space's registry `website`
  (`https://www.thalesaleniaspace.com/en`) matched a press release at
  `thalesaleniaspace.com/en/press-releases/...` cleanly for `first_party`,
  while Airbus's own identical-content press release on `www.airbus.com`
  would have failed the gate (Airbus's registry website is
  `space-solutions.airbus.com`, per 2026-07-06-W/2026-07-12-H precedent) --
  on a joint two-manufacturer release, check EACH named party's registry
  website before picking a lead, since one may pass the anti-spoof gate
  cleanly while the other needs the trade-source workaround.

## Narrow same-day re-check, ~8h13m gap, unfiltered full source list (2026-08-01, second)

- 2026-08-01-E: `existing[]` cross-check gap, self-caught only after
  finalize-sweep rejected it: drafted a "new" item for CASC's TJS-27A/27B
  classified-satellite launch (Long March 6A, Taiyuan, July 30) using
  CASC's own page as lead, not noticing an earlier sweep THAT SAME DAY had
  already published the identical launch (identical CASC URL, identical
  facts) under `2026-07-30-casc-long-march-6-comms-test-satellites`.
  SpaceNews's write-up did add one genuine new fact over the existing item
  (the TJS-27A/27B designation plus Jonathan McDowell's attributed
  ELINT-role assessment), so it became an `updates[].attach` with a full
  `explainer.what_happened` replacement rather than a duplicate. Lesson:
  grep the FULL `existing[]` id list for the candidate's own lead source
  URL (not just company+category matching) before drafting a same-day
  CASC/Xinhua launch as new -- the finalize-sweep dedup gate caught it
  this time, but a differently-classed lead source might not trip the
  same-company heuristic.
- 2026-08-01-F: Two "process not yet fact" scope calls, left undrafted
  rather than held: Zelensky asking Trump to persuade Musk to broaden
  Starlink access for strikes inside Russia (Trump said he'd "consider"
  it, no commitment, no operator statement) is squarely the
  conflict-operational-use exclusion even though it's on-the-record from
  a government official -- nothing about Starlink's actual service has
  changed. NASA's PROMISE lunar-rover cost dispute (repurposing a Mars
  rover engineering model, Isaacman disputing The Planetary Society's
  $723M-$1.33B estimate) is pure institutional NASA budget debate with no
  commercial contractor named anywhere in the SpaceNews piece -- doesn't
  clear the human-spaceflight/commercial-angle bar despite being a real,
  dated, on-the-record figure.
- 2026-08-01-G: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 0 new, 1 updated, 0 held") as the build-health signal.

## Deep sweep, ~11h51m gap, unfiltered full source list (2026-08-02)

- 2026-08-02-A: SEC EDGAR CIK tickers in the harvester queue are easy to
  misread by company name alone: `SEC EDGAR 8-K feed: SATS` is EchoStar
  Corporation (not Viasat, whose feed is `VSAT`), and its July 28 8-K
  (Item 1.02 + 2.01) turned out to be the actual CLOSING of the
  previously-announced AT&T spectrum sale ($20.25B proceeds + $2.4B FCC
  trust), a genuinely new, high-value financial event distinct from the
  June 30 Dish DBS Chapter 11 item that had only mentioned the sale as
  pending context. WebFetch 403'd on sec.gov directly (both the filing
  index and the exhibit htm) and `curl` required approval this session
  (unlike scheduled runs, where it reportedly works); StockTitan's SEC
  filing mirror page fetched cleanly and quoted the 8-K items verbatim,
  used as an `informal`-class corroboration source alongside a genuine
  trade write-up (Fierce Network) as lead. Also confirms 2026-07-06-F:
  `SEC EDGAR 8-K feed: SATL` (Satellogic) was collapsed into the SATS
  entry's `alt` list purely because both filings share the generic SEC
  index title "8-K - Current report" -- different companies, a false
  title-collapse; checked it separately (routine CFO resignation, below
  the inclusion bar).
- 2026-08-02-B: Whitelisted YouTube signals (Felix Schlang, Scott Manley,
  Tim Dodd, Marcus House) arrive in the harvester queue as
  `Signals YouTube: <name>` entries per the standing rule, but most
  post-Flight-13 videos this run were pure reaction/footage content
  (Tim Dodd's splashdown drone-footage shorts, Scott Manley's lightning
  explainer) with no standalone factual claim worth a commentary item.
  Felix Schlang's July 31 video description, however, named a genuinely
  new, checkable fact (SpaceX dispatching a recovery team for the
  intact Ship 40, Musk's tower-catch plan for Flight 14) that a
  NASASpaceflight RSS excerpt and a Teslarati article both independently
  confirmed with exact Musk quotes; used those two as the update's
  sources rather than citing the YouTube description directly, since
  the video itself never states the recovery/catch facts on the record
  beyond teasing them.
- 2026-08-02-C: A deep-mode 7-day queue with `lastSweepConsumedCount: 0`
  still had 472 of 662 candidates already flagged `consumed: true` /
  `previously_presented: true` from earlier sweeps the same week; spot
  checks against `items.json` confirmed essentially all of them
  (Swift reboost, MaiaSpace, Fortastra/Hadrian, All Points Vandenberg,
  Rocket Lab Alaska HASTE, ispace/MHI lander switch, LatConnect SWIRSAT
  expansion, SpaceX $1.6B launch orders, FCC Upper C-band) were already
  published under other lead URLs -- the `consumed` flag is per-URL, so
  a same-story article from a second outlet shows as unconsumed even
  when the underlying event is fully covered. Grepping `items.json` for
  each candidate's distinguishing company/figure name before drafting
  was faster and more reliable than trusting the `consumed` flag alone.
- 2026-08-02-D: `python3 -c` one-liners and shell output redirection
  (`> file`, even inside the repo working directory) both hit this
  session's permission gate; large `jq`-filtered command output is
  readable directly via Bash without redirection, and `wc -l`/`jq`
  piped straight off a fresh `bun scripts/candidates-context.ts` call
  work fine as long as no `>` redirect or multi-statement `;`/`&&` chain
  is present in the same tool call -- kept each candidates-context.ts
  filter as its own single Bash invocation.
- 2026-08-02-E: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate, continuing
  the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 1
  updated, 0 held") as the build-health signal.

## Narrow same-day re-check, ~3.5hr gap, unfiltered full source list (2026-08-02, second)

- 2026-08-02-F: A Bluesky launch-tracking bot (astronomybot.bsky.social)
  posted "Starlink Group 17-53 On 2026-08-01 ... Status: Current" as if
  the launch had already occurred; a direct WebSearch found Spaceflight
  Now reporting the mission still upcoming, delayed from Aug 1/2/3 to
  Aug 4. These auto-generated launch-tracker bot posts assert a past
  tense on a schedule slip; treat their "already launched" framing as
  unverified until a real source (Launch Library, a live-coverage outlet)
  confirms the launch actually happened, not just that a window passed.
- 2026-08-02-G: Zero-add sweep, ~3.5 hours after the prior deep sweep the
  same morning: all 14 unfiltered HTML sources were current with nothing
  posted since the 05:33 UTC lastSweep, 13 of 17 signals channels checked
  clean (newest post predated the window), and an 8-query discovery
  matrix traced every lead to an already-published story, a not-yet-
  launched rocket, or off-topic SpaceX/Tesla stock speculation
  (particularly heavy this run: merger-rumor and price-target churn
  around the post-IPO stock slide). Confirms the standing pattern
  (2026-07-05-S and many peers) that a short same-day re-check can
  legitimately net zero.
- 2026-08-02-H: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 0 new, 0 updated, 0 held") as the build-health signal.

## Normal-mode sweep, ~8h24m gap, unfiltered full source list (2026-08-02, third)

- 2026-08-02-I: A Yahoo News/tech.yahoo.com mirror for a search-surfaced
  headline ("SpaceX's Starlink Satellites Put on a Celestial Show Over the
  Netherlands") can resolve to a completely different, much older story
  under a near-identical title: the fetched page was about the original
  May 2019 Starlink launch-train sighting, not a genuinely new July 2026
  Starlink-1541 reentry fireball over the Netherlands found via Marco
  Langbroek's Bluesky. Caught by checking the fetched page's own stated
  date (2019) against the expected event; nltimes.nl (the outlet the
  search results actually pointed to) 403'd, so the item was corroborated
  instead via two directly-fetched Dutch mainstream outlets not
  previously used by this project: bright.nl and hartvannederland.nl,
  both usable via plain WebFetch and independent of each other (distinct
  phrasing, a different quoted meteorologist in one).
- 2026-08-02-J: A routine, attributed Starlink deorbit that produced a
  widely observed public fireball (multiple Dutch outlets, a whitelisted
  signal's own blog post) was drafted as a noise-tier `incident`, by the
  same logic that routine megaconstellation launches publish at noise
  (2026-07-12-A): the site's incident category names "uncontrolled
  reentries" as in-scope regardless of how routine the underlying
  end-of-life deorbit is, as long as it is a genuine, dateable, sourced
  fact. Dated it to the true July 24 event date (nine days before this
  sweep) rather than the discovery date, following the dominant
  event-date-over-publish-date convention (2026-07-06-GG and many later
  entries) rather than the narrower 2026-07-17-I precedent (which used
  discovery date for a noise-tier item); both readings exist in this
  file and the choice didn't affect scoring, but flag for Florian if a
  standing rule is wanted for noise-tier chases specifically.
- 2026-08-02-K: `bun scripts/check-feed.ts` was denied outright by this
  session's permission gate on the first attempt, continuing the standing
  pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 2 new, 1 updated, 0 held") as the build-health
  signal.

## Narrow same-day re-check, ~5h gap, unfiltered full source list (2026-08-03)

- 2026-08-03-A: EchoStar's `SEC EDGAR 8-K feed: SATS` queue entry (CIK
  1415404) surfaced an Item 1.03 Bankruptcy filing the same day Hughes
  Network Systems' Chapter 11 broke in the press (Advanced Television,
  Bloomberg) -- a genuinely new, distinct, seismic event from the June 30
  Dish DBS filing (that item explicitly stated Hughes was NOT part of it)
  and from the July 28 AT&T spectrum-sale-closing item. sec.gov 403'd
  WebFetch on every route tried this run (index page, cgi-bin browse-edgar,
  efts.sec.gov full-text search), confirming 2026-08-02-A is not a one-off;
  the harvester's `raw_excerpt` from the candidates queue (Item 1.03/2.04/
  5.02/7.01/8.01 listed verbatim) was the only usable read of the filing's
  contents and was cited as an `official_record` corroboration source
  alongside a directly-fetched Advanced Television article as lead
  (`trade`). Bloomberg 403'd WebFetch every attempt too (likely paywall,
  not just a bot-block) despite WebSearch surfacing its exact headline and
  facts repeatedly; treated it as unfetched and did not cite it as a
  source, relying on Advanced Television's own two articles (July 29
  preview + Aug 3 confirmation) for the verbatim facts instead.
- 2026-08-03-B: The same-company-plus-category dedup heuristic (first
  flagged 2026-08-01-C) fired again: a new item for Hughes Network
  Systems' Chapter 11 (category `financial`, company `EchoStar`) matched
  the existing `2026-07-28-echostar-att-spectrum-sale-closes` item purely
  on shared company + category + <7-day window, despite being a wholly
  unrelated transaction (AT&T spectrum deal closing vs. a separate
  subsidiary's bankruptcy filing). One `dedup_distinct` entry cleared it.
  Worth treating any EchoStar-family item as near-guaranteed to trip this
  heuristic given how much financial news that holding company generates
  (three distinct EchoStar-linked financial/bankruptcy items in five
  weeks now: Dish DBS Chapter 11 June 30, AT&T spectrum close July 28,
  Hughes Chapter 11 Aug 2).
- 2026-08-03-C: The seismic item published at SNR 2 (trade lead, no
  first-party/official-record LEAD despite an official_record
  corroboration source attached) because the gate's `extraordinary`
  force-rule keys off the LEAD source's class only, not the full source
  list; it was correctly auto-queued to `held.json` for Florian per the
  seismic-at-SNR<=2 rule while still publishing. Confirms the lead-only
  reading of that rule (no prior entry stated this explicitly).
- 2026-08-03-D: ICEYE's UAE country-CEO appointment (first-party press
  release, SNR 5, impact noise) followed the exact template of the
  2026-07-08 Germany and 2026-07-09 Portugal country-CEO items --
  standing precedent for treating these as publishable "partnership"-
  category items even though no partnership is announced, confirmed
  worth continuing.
- 2026-08-03-E: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 2 new, 0 updated, 1 held") as the build-health signal.

## Normal-mode sweep, ~6h40m gap, unfiltered full source list (2026-08-03, second)

- 2026-08-03-F: The gate's `official_record` anti-spoof allowlist does
  NOT include Xinhua's own domain (`english.news.cn`), despite
  CLAUDE.md's "State media (Xinhua, TASS) on state programs: facts of
  record score as official" edge case; citing `english.news.cn` directly
  as `official_record` was rejected ("not an official official_record
  host"). Reclassifying the same URL as `class: "trade"` was accepted.
  Third-party outlets rewriting a Xinhua wire story (Express Tribune,
  Qazinform) are not official-record hosts either, obviously. Until the
  gate's allowlist is extended, cite Xinhua/state-media facts-of-record
  as `trade`, not `official_record`, even when linking the wire's own
  domain.
- 2026-08-03-G: A BeiDou in-orbit-upgrade item citing CSNO's "50 active
  satellites" (via Xinhua) against the registry's Wikipedia-sourced
  `sats_active_claimed: 44` (as_of 2026-07-13) triggered a genuine
  same-metric dispute downgrade (-1) via the crossfeed gate, landing the
  item at SNR 3 disputed rather than 4; attesting `same_metric: true`
  honestly and letting `reconcile()` decide (per the 2026-07-18
  Vikram-1 lesson) was correct here too, not a bug -- two sources
  really do disagree on BeiDou's current active-satellite count.
- 2026-08-03-H: The same-company-plus-category dedup heuristic fired a
  third time this week (after 2026-08-01-C and 2026-08-03-B): a SpaceX
  Louisiana-spaceport land-acquisition report (category `launch`) false-
  matched two unrelated SpaceX `launch`-category items from the prior
  week (an NRO mission, a Starlink Vandenberg mission) purely on shared
  company + category + <7-day window. Two `dedup_distinct` entries
  cleared it; SpaceX's launch-cadence volume makes this heuristic prone
  to false positives on any non-launch SpaceX story tagged `launch`
  category (spaceport siting, regulatory, infrastructure).
- 2026-08-03-I: Ars Technica direct-fetched 403/blocked on every
  attempt this run (both `arstechnica.com/space/...` article URLs and
  the domain root), continuing to be effectively unfetchable via
  WebFetch; its harvester-queued `raw_excerpt` (verbatim RSS
  description) was usable in its place for quoting figures, consistent
  with the "raw_excerpt or direct fetch, never a WebFetch summary" rule
  since the excerpt itself is the harvester's direct capture, not a
  paraphrase.
- 2026-08-03-J: A Russian "anti-Starlink EW system" story
  (Volna Kupol Garant) circulating across TechRadar/Ynetnews/Yahoo was
  traced to its actual sourcing chain via a direct fetch of the
  ynetnews.com piece: no named Russian official or on-the-record
  government statement anywhere in the chain, just "Russian and
  Ukrainian accounts" and unnamed reports Reuters said it could not
  verify. Discarded as out-of-scope battlefield OSINT per CLAUDE.md
  (conflict analysis is out unless "stated by the operator or a
  government on the record") despite Starlink being the explicit
  target -- a commercial-space angle alone doesn't waive the
  on-the-record requirement.
- 2026-08-03-K: The Bluesky public AppView API
  (`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=N`)
  returns actual post text and `createdAt` timestamps via WebFetch,
  unlike fetching `bsky.app/profile/<handle>` pages directly (JS shell
  only, no post content renders). Use the API endpoint for the signals
  fetchable-channel pass on any Bluesky-type entry going forward.
- 2026-08-03-L: Payload's Aug 3 "True Anomaly Chases an Evading Target"
  piece was a same-event update (30-min mission-plan turnaround,
  23-min burn, ~10km closest approach, a CEO fuel-margin quote) on the
  July 14-29 VICTUS HAZE pursuit phase the 2026-07-02 item already
  covers in summary; patched the existing item's explainer with the
  granular sourced figures rather than opening a new item, consistent
  with the "same event within 7 days is an update" rule even though the
  underlying tasking date (July 14) is well outside 7 days of Aug 3 --
  what matters is the 5-day gap to the July 29 announcement this item
  is keyed to, not the original tasking date.
- 2026-08-03-M: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 5 new, 2 updated, 0 held") as the build-health signal.

## Narrow same-day re-check, ~4h6m gap, unfiltered full source list (2026-08-04)

- 2026-08-04-A: A generic WebSearch for "Zhuque-2E third launch failure August
  2026" returned china-in-space.com hits with no year in the snippet that read
  as fresh; direct fetch of the actual article confirmed a Aug 15, **2025**
  dateline (LandSpace's Zhuque-2E Y3 in-flight failure), not 2026. Adds a new
  domain to the standing stale-resurfacing pattern; treat this exact headline
  shape as a trap if it resurfaces again.
- 2026-08-04-B: Apex Space (satellite-bus manufacturer) has no
  `src/data/registry` organization profile despite recurring as a named party
  in three items now (Loft Orbital bus order, Sophia Space TILE demo, and this
  run's own $200M funding round) -- same no-registry-host pattern as
  ispace/Orbit Fab/ArkEdge; its own newsroom can't be classed `first_party`
  until a profile exists. Worth a registry add at the next structural touch
  given how often it's coming up.
- 2026-08-04-C: L3Harris's own newsroom listing page doesn't expose full
  article URLs to a plain WebFetch of the listing; asking WebFetch directly
  for "recent press releases with their exact URLs" against the listing page
  surfaced the right slug (`/newsroom/press-release/2026/08/l3harris-completes-sale-majority-stake-commercial-space-propulsion`)
  when a guessed URL 404'd. Worth trying before assuming a fresh press
  release isn't linked yet.
- 2026-08-04-D: `bun scripts/check-feed.ts` was denied outright by this
  session's permission gate, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 3 new, 0 updated, 0 held") as the build-health signal.

## Narrow same-day re-check, ~7.5h gap, unfiltered full source list (2026-08-04, second)

- 2026-08-04-E: `sats_planned` is NOT in `MONOTONIC_COUNT_FIELDS`
  (crossfeed.ts), so a genuinely superseding constellation-size update
  (Telesat/MDA's Aug 4 contract expanding Lightspeed's funded/planned
  satellite count from 198 to 225, explicitly framed by MDA as "adding
  27 to the previously announced 198") does not get the time-supersession
  treatment the Vikram-1 lesson (2026-07-18) describes for
  `sats_launched_total` and peers. With both the registry's existing
  first-party fact and the new item's first-party lead reading as
  unscored/SNR 5, `reconcile()` hit `both_disputed_queue` and the item
  auto-queued to `held.json` for Florian even though this isn't a real
  contradiction, just a stale snapshot. Attested `same_metric: true`
  honestly per the standing rule and let the gate decide rather than
  fudging it to `false`; flag for Florian that `sats_planned` (and likely
  other non-monotonic "total design/funded count" fields) could use the
  same monotonic treatment as the four fields already on the list.
- 2026-08-04-F: RussianSpaceWeb (Anatoly Zak, whitelisted signal) updates
  its own article pages in place with new tracking data rather than
  publishing a new URL: the Aug 4 finding that only 9 of 16 satellites in
  Bureau 1440's second Rassvet batch had begun raising orbit (vs. the
  smooth deployment implied at the item's July 19 launch) lived at the
  EXACT SAME URL already on file as the existing item's source
  (`buro1440-2026-0719.html`). Patched the item's explainer with the new
  detail via `updates` rather than opening a new item (the 7-day dedup
  window had long passed, but same URL = same underlying source
  artifact, not a new one); no new source to `attach` since the URL was
  already on the item. Worth checking whether a signals-pass or
  discovery-pass find's URL already appears in an item's `sources` before
  treating it as fresh corroboration or a new event.
- 2026-08-04-G: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate again, continuing
  the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 3 updated,
  1 held") as the build-health signal.

## Normal-mode sweep, ~11h47m gap, unfiltered full source list (2026-08-05)

- 2026-08-05-A: A company's own quarterly earnings release (SpaceX's Q2 2026
  results, its first as a public company) is a rich source of never-covered
  gaps: business-highlight bullet points named an already-approved but
  never-drafted FCC spectrum deal (SpaceX/EchoStar, approved May 12) and
  restated Starshield contract totals; chased the FCC approval as its own
  item dated to the actual May 12 approval date, per the standing
  predates-window ruling. Flag for a future sweep: the ~$2.29B SDA "SDN
  Backbone" and ~$4.16B SB-AMTI task orders to SpaceX (both May 2026,
  summing to the "over $6 billion" Starshield figure in the earnings
  release) are ALSO never covered under any id and are each independently
  major/seismic-scale; not chased this run for time, still open.
- 2026-08-05-B: SpaceX's own earnings PDF is hosted at
  `s21.q4cdn.com/184289198/files/...`, a Q4-IR CDN domain that does NOT
  match the registry's `spacex.com` website value (not a subdomain, unlike
  the `ir.spacex.com`/`investors.planet.com`-style apex-matching cases) --
  classing it `first_party` would fail the anti-spoof gate. `ir.spacex.com`
  itself is a pure JS shell to WebFetch (no press-release listing content
  loads), so there was no first-party-eligible URL to lead with for any
  earnings-derived story this run; led each with the strongest independent
  trade coverage instead (Fierce Network, SpaceNews, Telecompetitor) and
  did not force the PDF into scoring.sources.
- 2026-08-05-C: The same-company-plus-category dedup heuristic fired
  against a MULTI-VENDOR IDIQ vehicle, a new shape: Rocket Lab's new
  $397M SB-AMTI satellite task order (category procurement) matched the
  existing 2026-07-31 NITE-STAR item purely because Rocket Lab is one of
  15 listed vendors on that $981M training-infrastructure IDIQ vehicle,
  four days earlier, same category -- despite NITE-STAR naming no
  Rocket-Lab-specific task order at all. Cleared with one
  `dedup_distinct` entry; worth expecting this shape (a company merely
  named among many IDIQ/vendor-pool awardees) to keep tripping the
  heuristic against that company's own later, unrelated contract news.
- 2026-08-05-D: Confirms the 2026-07-24-F/2026-08-04-E lesson on a new
  field: `sats_planned` is not a monotonic-counter field, so crossfeeding
  Telesat Lightspeed's fleet expansion (156 -> 225, per Telesat's own Aug 4
  release) against the registry's stale 198 snapshot is attested
  `same_metric: true` honestly and left for the gate to resolve (likely a
  refresh candidate or a queued tie), not fudged to `false` to avoid the
  dispute path.
- 2026-08-05-E: `updates[].rescore` requires the item's `source_url` to be
  patched to the new lead URL in the SAME update object
  (`patch.source_url`) before `rescore.sources[0].url` can match it;
  submitting a rescore with a new lead source but no matching
  `patch.source_url` is a flat rejection on both the Telesat and the
  SpaceX Starlink Mobile updates this run, fixed by adding
  `patch.source_url` explicitly matching the rescore's first source.
- 2026-08-05-F: bloomberg.com, pcmag.com, and businessinsider.com all
  refused WebFetch this session (403 or flat "unable to fetch"),
  continuing the standing per-session domain-blocklist pattern
  (2026-07-17-H and peers); fierce-network.com and broadbandbreakfast.com
  both fetched cleanly and gave genuinely distinct quotes from the same
  SpaceX earnings call, enough for a clean two-source trade-tier rescore
  without needing the blocked mainstream outlets.
- 2026-08-05-G: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own
  merge confirmation ("merged 5 new, 2 updated, 0 held") as the
  build-health signal.

## Normal-mode sweep, ~3h46m gap, unfiltered full source list (2026-08-05, second)

- 2026-08-05-H: businesswire.com timed out (60s) on every attempt this run
  (both a June and a July AST SpaceMobile launch-date release), continuing
  the per-session domain-friction pattern (2026-08-05-F and peers); a local
  Florida outlet (talkoftitusville.com) fetched cleanly and gave genuinely
  distinct pre-launch figures (satellite mass, FM6/FM7/FM8 designations,
  peak Mbps) from the after-the-fact Spaceflight Now lead, enough for a
  clean two-source trade+informal corroboration without the blocked wire.
- 2026-08-05-I: A same-day ICEYE/EQT "Scaleup Europe Fund makes first
  investment" release (Aug 5) turned out to be a closing-tranche
  confirmation of the ALREADY-published June 9 EUR 1B/EUR 450M Series F
  round (identical valuation and round-size figures), not new money;
  treated as an `updates[].attach` with a full `explainer.what_happened`
  replacement rather than a new item, even though it is ~2 months outside
  the mechanical 7-day/30-day windows, because "Known to MCC" matching is
  by actor+event identity first, not purely by day-count, and drafting it
  as a second item would have double-counted the same raise. Worth
  remembering this pattern (a fund's own "first investment" press release
  confirming a round others already led) for future EU-fund-related ICEYE/
  Isar/other sovereign-capital stories.
- 2026-08-05-J: A widely-covered "SpaceX rocket set to crash into the
  Moon" story (a defunct, already-attributed Jan 2025 Falcon 9 upper stage
  on a known, non-threatening lunar-impact trajectory, covered by CNN,
  Newsweek, Time, RTE, etc.) was judged out of scope and left undrafted,
  not held: no operator liability, deorbit-compliance, or commercial angle
  exists here (the operator and cause are already known and undisputed,
  and lunar impact isn't Earth-reentry safety), closer to astronomy-
  interest coverage than the incident category's liability/insurance
  rationale (2026-07-08 ruling). Flag for Florian if this read is wrong,
  since it's a genuinely borderline "orbital-safety" shape.
- 2026-08-05-K: ESPI (European Space Policy Institute) republished its
  China-vs-Europe orbital-data-center thesis as a fresh, dated Aug 5
  report/brief distinct from its Nov 2025 "Data centres in space" report
  (same espi.eu domain, different piece, confirmed via the SpaceNews
  byline stating "a report published by the independent think tank Aug.
  5"); drafted as `kind: "commentary"` (ESPI as a named outlet, not a
  signals.json person) rather than a factual event, since the piece is a
  warning/policy-recommendation argument, not a discrete transaction.
  Worth double-checking any think-tank "report warns X" headline against
  its actual publish date before treating a resurfaced older report as
  today's news (the Nov 2025 report page was found first and would have
  been a dating trap).
- 2026-08-05-L: A GuoWang batch (23rd deployment, Long March-8A Y10, Aug 4)
  had never been itemized individually before (only mentioned in passing
  inside other items' why_it_matters), unlike Qianfan/SpaceSail which has
  several dedicated items; china-in-space.com gave the richest figures
  (9 satellites, ~186 cumulative, per-satellite mass, 2026-2028 ramp
  targets) with Xinhua as trade-classed (not official_record, per
  2026-08-03-F) corroboration. GuoWang's registry `sats_launched_total`
  (177, as_of 2026-07-09) is a monotonic field per SNR_SPEC 6.6; attested
  `same_metric: true` and let the gate's supersession handling apply
  rather than fudging it.
- 2026-08-05-M: `bun scripts/check-feed.ts` was denied outright by this
  session's permission gate, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 4 new, 1 updated, 0 held") as the build-health signal.

## Narrow same-day re-check, ~7.5h gap, unfiltered full source list (2026-08-05, third)

- 2026-08-05-N: A single satellite pair can carry TWO completely different
  public names at once: Xinhua's same-day "Smart Dragon-3 launches 2
  satellites" story named the payloads STAR.VISION's own constellation
  designations, "Oriental Smart Eye 01/02," while the already-published
  item (drafted from Gazeta.uz/Kompas) named the identical pair by their
  sovereign-customer names, "Lampung-1" (Indonesia) and "Samarkand-2028"
  (Uzbekistan) -- same rocket, same date, same sea-platform site off
  Shandong, same count (2), same sensor class (hyperspectral). A
  same-day CASC/Xinhua queue hit naming a Chinese commercial launch needs
  a body-content match (rocket + site + date + payload count/class)
  against existing[], not just a payload-name grep, before drafting it
  as new; this one was caught and folded into the existing item via
  `updates[].attach`, adding Xinhua's technical specs (mass, band count,
  resolution, swath, onboard AI compute, the 258-satellite build-out
  plan) that neither original source had stated.
- 2026-08-05-O: Extends 2026-07-07-K/2026-07-31-I: a genuinely fetched
  company press release from a domain with no `src/data/registry` entry
  (LiveEO, a German EO-analytics startup) and no fetchable independent
  trade pickup this run (its only other coverage, SpaceWatch.Global,
  403'd) has no gate-safe lead to substitute -- classed the company's
  own page `informal` rather than force `first_party` or hold it; the
  item merged clean at the honest SNR-1 floor. Unlike the 2026-07-15-F
  ispace case (held for lack of any workaround), this run treated
  informal-classing a no-registry company's own page as an accepted
  mechanical path for a NEW item too, not just the update-only path
  2026-07-31-I documented for Katalyst Space.

## Normal-mode sweep, ~11h43m gap, unfiltered full source list (2026-08-06)

- 2026-08-06-A: The harvester queue (Google News: launch feed especially)
  was almost entirely SpaceX stock/IPO-unlock speculation and moon-crash
  reaction pieces (~150 candidates, one real item: none survived from the
  queue itself this run); every genuinely new item this sweep came from
  either the signals pass or direct earnings/investigation fetches
  outside the queue. Confirms the standing pattern that a SpaceX-heavy
  queue is a low-yield discovery leg once the company goes public and
  starts drawing daily stock churn.
- 2026-08-06-B: Investors.satellogic.com and ir.rdw.com (Redwire's Q4-IR
  domain) both timed out (60s) on every WebFetch attempt this run.
  investors.satellogic.com WOULD have passed the anti-spoof gate as
  first_party (it's a subdomain of the registry's satellogic.com apex,
  per the 2026-07-07-E www-stripping/subdomain rule) had it loaded;
  ir.rdw.com would NOT (Redwire's registry website is redwirespace.com,
  a different apex entirely, the same shape as the SpaceX
  ir.spacex.com/s21.q4cdn.com mismatch in 2026-08-05-B). Fell back to a
  GlobeNewswire wire mirror (Manila Times, wire_pr, tier 4) for
  Satellogic's earnings and to informal-classing Redwire's own IR page
  directly (2026-08-05-O pattern) for Redwire's, since no independent
  trade coverage of either Q2 earnings existed (only wire mirrors and
  financial-data-aggregator sites like TradingKey/Benzinga/StockTitan,
  which just restate the same release numbers, not original reporting).
- 2026-08-06-C: A whitelisted signal's own Bluesky feed surfaced a
  same-day incident the harvester queue never carried: Jeff Foust
  (SpaceNews, whitelisted) posted about a fire at TsNIIMash (Roscosmos's
  main research center, which houses Russian ISS mission control) within
  hours of it happening; Anatoly Zak's bluesky ("More from Russia's
  Korolov 💥💥") independently flagged the same event a few hours earlier
  with no substantive detail of its own. Chased via WebSearch to Moscow
  Times + Ukrinform (both mainstream, independent) rather than citing
  either signal's post as a scoring source, since neither post itself
  stated the facts (Foust linked out; Zak's post was a bare reaction).
- 2026-08-06-D: xinhua/state-media handling aside, TASS itself was never
  fetchable or citable this run for the TsNIIMash fire (no working TASS
  URL found); Roscosmos's own characterization ("technical in nature,"
  ISS operations "remain fully under the control of specialists") only
  reached us secondhand via Moscow Times/Ukrinform quoting it, which is
  the honest ceiling for an item like this without a first-party
  Roscosmos statement to link directly. Deliberately left out the
  Rosaviatsia flight-restriction/drone-attack coincidence several outlets
  mentioned: unconfirmed causal speculation adjacent to the war, squarely
  the conflict-analysis exclusion, even though the underlying fire fact
  is clean and multiply sourced.
- 2026-08-06-E: A whitelisted signal's site/substack pass surfaced a
  genuinely new, well-documented financial story the queue never carried
  at all: European Spaceflight's report that MaiaSpace's 2025 accounts
  (filed July 22) show negative shareholders' equity, forcing an
  ArianeGroup shareholder vote under French corporate law (Article
  L.225-248) on June 25 not to dissolve the company. Dated the item to
  the June 25 shareholder decision (the actual corporate action) rather
  than the July 22 filing date or the August discovery date, per the
  standing event-date-over-discovery-date convention for
  notable-or-above stories the queue missed when they happened.
  Andrew Parsonson's same-day substack teaser about a separate
  ArianeGroup/Blue Origin €42M supplier relationship (from German
  financial filings) was left undrafted: the substack piece is
  subscriber-only and no public mirror or excerpt beyond the one-line
  teaser was fetchable, so there was nothing to verify facts against.
- 2026-08-06-F: Google News redirect URLs (news.google.com/rss/articles/...)
  continue to fail to resolve via WebFetch (confirms 2026-08-01-C2/
  2026-08-04-A): every redirect attempted this run returned only a bare
  "Google News" shell with no content and no forwarding URL. WebSearch
  with the headline text plus outlet name reliably found the actual
  publisher URL instead; treat the redirect-follow step in
  prompts/update-items.md as effectively dead until the tooling changes,
  and go straight to WebSearch for Google-News-sourced queue candidates.
- 2026-08-06-G: Two more stale-resurfacing traps this run, confirming
  the pattern is not domain-specific: (1) a "News On AIR" Google News
  entry titled "ISRO successfully conducts 2nd integrated air drop test
  for Gaganyaan mission," timestamped in this run's window, resolved via
  ISRO's own press-release page to an April 10, 2026 event, four months
  stale. (2) A Lok Sabha written reply on LEO collision-avoidance
  manoeuvre counts, genuinely dated today, was judged out of scope
  rather than stale: no commercial operator named anywhere in it (per
  the standing MUOS/Aeolus-2/NATO-HALO precedent for institutional
  disclosures without a stated commercial angle), not a discrete
  incident or regulatory action either.
- 2026-08-06-H: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 8 new, 2 updated, 0 held") as the build-health signal.

## Normal-mode sweep, ~15h gap, unfiltered full source list (2026-08-06, second / 2026-08-07)

- 2026-08-07-A: A signals-pass find can already be handled by the SAME-DAY
  prior sweep: Jeff Foust's Aug 6 bluesky post and the matching SpaceNews
  "NASA and Roscosmos continue seat barter agreement" article read as a
  fresh update candidate for the existing 2026-07-14 seat-swap item, but a
  grep of that item's `sources` array showed the exact SpaceNews URL
  already attached (`"added": "2026-08-06"`) by the morning's 09:37 UTC
  sweep, and its `what_happened` already carried the Aug 5 Weigel/Starliner
  quote. Always check an item's CURRENT sources array (not just its prose)
  before drafting an update from a signals-pass find on a short gap;
  confirms 2026-07-12-J's lesson applies to updates, not just fresh
  corroboration attaches.
- 2026-08-07-B: `news.northropgrumman.com` (a subdomain of the registry's
  `northropgrumman.com` apex) passed the anti-spoof gate as `first_party`
  cleanly, confirming the subdomain-matches-apex rule (2026-07-07-E/
  2026-08-06-B) on a new domain. `blacksky.com/press-releases/<slug>/`
  also worked as a directly fetchable, gate-clean first-party source for a
  quarterly-earnings release (contrast with SpaceX/Redwire's IR-CDN
  domains, which keep failing the apex match) -- worth trying a company's
  main marketing domain's own `/press-releases/` path before assuming an
  earnings story needs a trade-outlet lead.
- 2026-08-07-C: WebFetch on `space.com` returned only navigation/signup
  chrome with no article body on a direct fetch this run (a new failure
  shape, distinct from the arstechnica.com/bloomberg.com hard-block
  pattern); dropped it rather than draft from the WebSearch summary.
  A Chinese financial-press outlet (stcn.com, Securities Times) gave clean,
  independent corroboration of a SpaceNews China story (Orienspace's
  pre-C round) beyond the wire-mirror trap, confirming 2026-07-10-I's
  native-language-query lesson also works via direct URL fetch, not just
  WebSearch.
- 2026-08-07-D: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own
  merge confirmation ("merged 10 new, 0 updated, 0 held") as the
  build-health signal.

## Narrow same-day re-check, ~4.5hr gap, unfiltered full source list (2026-08-07, second)

- 2026-08-07-E: Chased two important predating-window stories the queue
  had never surfaced (2026-07-08-I2 pattern); only one turned out to be
  genuinely new. SpaceX's Falcon 9/Transporter rideshare-booking freeze
  past late 2028 (first solidly reported by SpaceNews June 25, later
  confirmed by SatNews, Bloomberg, and a fresh Aug 6 SpaceQ Media
  Canada-market follow-up that was the actual signals-pass entry point)
  had never been drafted under any id and shipped clean at SNR 4 with 5
  sources. But Rocket Lab's "$266M Kodiak Alaska Space Force contract"
  turned out to be an exact duplicate of the already-published
  2026-07-21-rocket-lab-haste-alaska-contract (same figure, two of the
  same corroboration sources already attached) -- caught by finalize-
  sweep's same-company+category dedup gate, not by my own pre-draft
  check. Always grep existing[] IDs for the actor + a distinguishing
  noun (here "kodiak"/"haste"/"alaska") before treating a chased
  predating-window story as definitely new, not just for exact-title
  matches; the two headlines ("wins record $266 million Space Force
  launch contract" vs. "wins $266 million Space Force contract for HASTE
  launches") don't share a single word besides the dollar figure and
  company. Recovered the wasted research by attaching a genuinely new
  local-outlet source (Alaska Public Media, independent facts: dedicated
  pad construction, ~140-acre site expansion) to the existing item via
  updates[].attach instead.
- 2026-08-07-F: The dedup false-positive pattern (2026-08-01-C and many
  peers) fired again on the rideshare-freeze item against two wholly
  unrelated SpaceX `launch`-category items (an NRO mission, a Starfall
  reentry demo) purely on shared company + category + <7-day window from
  its June 25 dated-to-actual-event publish date. Two `dedup_distinct`
  entries cleared it in one pass, confirming the heuristic fires just as
  readily on a backfilled/predating-window item's assigned date as on a
  same-day one.
- 2026-08-07-G: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 1 new, 1 updated, 0 held") as the build-health signal.

## Normal-mode sweep, ~11h48m gap, unfiltered full source list (2026-08-07, third)

- 2026-08-07-H: A new shape of the same-company-plus-category dedup
  false positive: a brand-new IRIS2 constellation-expansion item (EU
  Commission/SpaceRISE, category `procurement`) matched the existing
  2026-07-31 Hisdesat/SpainSat NG III contract item purely because both
  items name Airbus Defence and Space and Thales Alenia Space as
  industrial subcontractors, six days apart, same category -- the actual
  actors (European Commission/SpaceRISE vs. Hisdesat) and programs share
  nothing. One `dedup_distinct` entry cleared it. Worth expecting this
  heuristic to fire on ANY two European-launch-vehicle-or-satellite
  procurement stories that both cite Airbus/Thales/OHB as manufacturers,
  not just same-company-as-buyer cases.
- 2026-08-07-I: WebFetch cannot parse a PDF's binary content even when
  the URL resolves and downloads cleanly (tried Eutelsat's own FY2025-26
  results PDF at eutelsat.com/system/files/...; got a "binary/encoded,
  cannot be parsed" response, file saved to a local tool-results path but
  no extractable text). Fell back to a wire-distributed mirror of the
  same release (mynewsdesk.com, classed `wire_pr` since it is a PR
  distribution platform functionally identical to BusinessWire/
  GlobeNewswire) plus independent trade coverage (Via Satellite) instead
  of the company's own PDF; worth trying an HTML mirror of an investor
  PDF release before assuming a company's own results are directly
  fetchable as first-party text.
- 2026-08-07-J: advanced-television.com returned HTTP 429 (rate limited)
  on the one attempt this run; not flipped to any status change (not a
  configured source), just noting the outlet is fetchable but throttled
  under repeated access.
- 2026-08-07-K: A Google-News-surfaced Reuters headline
  ("EU Commission signs contract to expand IRIS2 satellite constellation")
  never resolved via the redirect (confirms 2026-08-06-F); a plain
  WebSearch for the exact quoted headline found the same underlying facts
  restated by Communications Today, Telecompaper, EUSPA's own newsroom,
  and ESA's own concession-partner (resilience.esa.int) archive, more
  than enough independent confirmation without needing the Reuters piece
  itself.
- 2026-08-07-L: mynewsdesk.com is a legitimate `wire_pr`-class venue for
  a company's own press release when the company's primary investor page
  only links an unparseable PDF; distinguish this from `informal` (it is
  literally the company's release text, not a third party's writeup) but
  keep it below `first_party` (the domain is mynewsdesk.com, not the
  company's own, so it fails the anti-spoof domain check).

## Normal-mode sweep, ~11h42m gap, unfiltered full source list (2026-08-08)

- 2026-08-08-A: fcc.gov, lightreading.com, mobileworldlive.com, and
  convergedigest.com all 403'd on every attempt for the FCC's Aug 6 D2D
  unlicensed-spectrum NPRM (a genuinely new, never-covered regulatory
  item); fierce-network.com and broadbandbreakfast.com both fetched
  cleanly and agreed on the vote outcome, dropped 900 MHz band, and
  quotes, giving a clean two-source trade-tier item (SNR 4) without any
  fetchable official_record or first_party lead. Confirms the standing
  fcc.gov/faa.gov government-domain-blocked pattern (2026-07-13-J and
  peers) extends to this NPRM specifically.
- 2026-08-08-B: A WebSearch-summary figure can describe the DRAFT version
  of a not-yet-final rule rather than what was actually adopted: an early
  search hit (insideglobaltech.com, dated July 22, pre-vote) stated three
  spectrum bands (902-928 MHz included); the two Aug 6/7 sources covering
  the actual vote agreed the adopted NPRM dropped the 900 MHz band,
  leaving only ~200 MHz across two bands. Used the post-vote figure and
  left the pre-vote source uncited rather than let an older draft's
  numbers contradict the final item, even though both came from
  otherwise-legitimate outlets.
- 2026-08-08-C: A same-day WebFetch of Bluesky's own bsky.app profile
  pages returned no post content (just the handle) for every account
  tried; switching to the public API endpoint
  (`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=10`)
  worked cleanly for all of them and returned real posts with
  `createdAt` timestamps and text. Use the API endpoint directly for the
  signals pass's fetchable bluesky channels rather than the bsky.app
  profile URL from signals-context's output.
- 2026-08-08-D: A queue candidate's WebFetch (Aviation24.be, an
  Aerospacelab-specific angle on the already-published Aug 6 IRIS2
  expansion item) 403'd, and the WebSearch summary's programme-cost
  figure (EUR13 billion) contradicted the already-published item's
  sourced figure (EUR15.6 billion) -- left it uncited entirely rather
  than attach a blocked source's paraphrased, conflicting number; the
  already-published item's why_it_matters already names Aerospacelab
  among the manufacturers, so nothing was lost.
- 2026-08-08-E: Held a genuine scope-judgment case rather than silently
  discarding or force-publishing it: ASI's board dissolving itself
  (Aug 5) to trigger an extraordinary-commissioner appointment after
  president Teodoro Valente's death (July 16) is a real, dateable,
  well-sourced institutional story (European Spaceflight, confirmed by
  Andrew Parsonson's Bluesky) about an agency that runs an in-scope
  sovereign constellation (IRIDE), but the source states no direct
  commercial-space consequence -- same shape as the NASA-STRIDE
  (2026-07-09-C) and Aeolus-2/NATO-HALO institutional-disclosure
  precedents. Queued for Florian rather than guessed either way.
- 2026-08-08-F: A quiet gap where nearly everything the queue, HTML
  source list, and signals pass surfaced was already published by the
  prior two same-day sweeps (BlackSky Q2 results, Redwire SpaceMD/
  Starfall, Rocket Lab's 8th iQPS launch via a Gunter's QPS-SAR 13 entry,
  the IRIS2 expansion via SES's own Aug 7 release, CASC's Aug 5 Smart
  Dragon-3 and Long March-8A items) -- confirms narrow-gap sweeps
  following an active prior sweep will look "thin" by design, not by
  under-coverage, once direct-fetch and signals legs are both checked
  exhaustively.
- 2026-08-08-G: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate again, continuing
  the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 0
  updated, 1 held") as the build-health signal.

## Narrow same-day re-check, ~11h48m gap, unfiltered full source list (2026-08-08, second)

- 2026-08-08-H: A regulator's own bureau-chief transition (FCC Space
  Bureau's Jay Schwarz retiring, deputy Jennifer Gilsenan named acting
  chief, Aug 7) is a genuinely different shape from the standing
  "routine executive hires stay below the inclusion bar" rule, which is
  about company hires: this is leadership continuity at the specific
  office that licenses every commercial satellite operator and had just
  pushed through the licensing overhaul. Drafted as `notable`/
  `regulatory` rather than discarded. Only fetchable lead was SpaceNews;
  a same-headline "Communications Today" mirror 403'd and reads like a
  syndicated rewrite (identical title), so it was left uncited rather
  than force-counted as independent corroboration -- crawl scored
  `found_none` honestly, landing the item at a low but honest SNR.
- 2026-08-08-I: An ongoing, multi-day operational thread (SpaceX towing
  the intact Starship Ship 40 back from its July 24 Indian Ocean
  splashdown, now possibly lost in worsening seas per Musk's August 7
  "not looking good right now" post) patched into the existing Flight 13
  item via `updates[]` rather than a new item, even though the original
  splashdown is 2+ weeks stale: same underlying event thread (the 2026-
  08-03-L VICTUS HAZE precedent). space.com's article body was paywalled/
  truncated on fetch and nasaspaceflight.com 403'd; TeslaNorth (trade)
  carried the same Musk quote cleanly and was used as the attach source
  instead.
- 2026-08-08-J: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate again, continuing
  the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 1
  updated, 0 held") as the build-health signal.

## Normal-mode sweep, ~15h51m gap, unfiltered full source list (2026-08-09)

- 2026-08-09-A: A SpaceNews piece bundling two actors' Gateway-repurposing
  news (Northrop Grumman's LID missions, already published 2026-08-04, and
  the Canadian Space Agency's Canadarm3 continuation, never covered) needed
  a body-content read past the shared headline/topic before concluding it
  was pure dedup: the CSA/MDA Space fact is a distinct actor and a distinct
  action from the already-published Northrop item, confirming the standing
  "two facts belonging to two unrelated actors in one bundled article draft
  as two items" pattern (2026-07-13-third) extends to same-program, not
  just same-country-different-subsidiary bundles.
  MDA Space has no `src/data/registry` organization entry despite being a
  named party in a $1B CAD contract; its own domain (mda.space, not
  mdaspace.com) was fetchable and used as an `informal`-class corroboration
  source per the standing 2026-08-05-O/2026-07-31-I no-registry-host
  pattern rather than forced to `first_party`.
- 2026-08-09-B: A Launch Library candidates-queue entry can describe a
  FUTURE scheduled launch, not a completed one, even when its
  `published_at` timestamp is inside the sweep window: the queue's
  "Starlink Group 17-50" entry was a schedule update for an Aug 19 launch
  still "Go for Launch," not an event. The genuinely-occurred same-day
  launch (Starlink Group 17-38, Vandenberg, Aug 8) came from a separate
  Space.com queue entry; always check a Launch Library entry's own
  `status`/`net` fields before treating its presence in the queue as proof
  a launch happened.
- 2026-08-09-C: A follow-up NASASpaceflight piece on an already-published
  story (Blue Origin's New Glenn dual-pad/hybrid-integration plans, updating
  the 2026-08-05 valve-cause item) 403'd on direct fetch, and the harvester's
  `raw_excerpt` cut off right before the genuinely new facts ("In an August 5
  update, Limp conf..."); a GeekWire piece that reads like independent
  confirmation of the dual-pad plan turned out to be from June 30, already
  covered by the existing 2026-07-01 pad-CONOPS item. Left undrafted rather
  than sourcing the new specifics from a WebSearch summary alone.
- 2026-08-09-D: `bun scripts/check-feed.ts` was denied outright by this
  session's permission gate, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 2 new, 0 updated, 0 held") as the build-health signal.

## Narrow same-day re-check, ~11h48m gap, unfiltered full source list (2026-08-09, second)

- 2026-08-09-E: `economictimes.indiatimes.com` and `business-standard.com`
  both failed on every direct-URL WebFetch attempt this run (economictimes:
  outright "unable to fetch" tool error, not just a 403; business-standard:
  HTTP 403), and no independently fetchable outlet carrying the same story
  (IN-SPACe's expression of interest to hand the Rs 986 crore
  Kulasekarapattinam SLC over to a private operator) turned up via several
  WebSearch variants -- every hit traced back to those same two blocked
  domains or to secondary aggregator sites (vajiramandravi.com, iaspoint.com)
  that only paraphrase them. Left undrafted rather than sourced from a
  WebSearch summary; this is a source-access gap (no fetchable outlet exists
  for this specific story), not a scope or schema question, so it does not
  belong in `held`. Worth trying `inspace.gov.in` directly (a `.gov.in`
  domain, first_party/official-record eligible) if this story resurfaces.
- 2026-08-09-F: A Bluesky post (`mediauscosmos.bsky.social`) claiming an
  "AusCosmos Dingo Sat Constellation Phase 1" (42 Ku-band satellites,
  Australian sovereign broadband, "in five days") returned zero corroborating
  results on a dedicated WebSearch -- no company, program, or prior coverage
  findable anywhere. Treated as unverifiable rather than drafted; this queue
  also carried several similarly unverifiable/fabricated-reading Bluesky
  posts this run (SpaceX "robotic Moon factories" building AI satellites via
  "electromagnetic railguns", Kreios Space "indefinite orbital lifespans")
  that don't survive a basic fetch-the-primary-source check. Bot/informal
  Bluesky search results this run skewed noticeably more toward invented-
  sounding claims than in past sweeps; verify the underlying announcement
  independently before drafting anything sourced only to one of these
  accounts.
- 2026-08-09-G: A near-total wash of the harvester queue (79 candidates,
  filtered.junk empty): the large majority were SpaceX stock/earnings/IPO-
  lockup speculation (Motley Fool, Yahoo Finance, Seeking Alpha, Benzinga
  framing), Starlink launch-schedule chatter, and off-topic Futurism/BBC
  items, confirming 2026-08-06-A/2026-08-07-third's pattern continues now
  three-plus weeks post-IPO. Direct-fetch (14 HTML sources) and the signals
  pass (13 of 17 fetchable channels, rotated to skip Marcia Smith's and
  Anatoly Zak's duplicate bluesky legs and Andrew Parsonson's site instead of
  his 403'ing substack) were both fully quiet. Only genuine value recovered:
  Space.com's Aug 9 VLEO-thruster piece added a mainstream corroboration
  source (with new CEO quotes) to the existing Aug 4 Kreios/NanoAvionics
  item, landing a `mainstream_pickup` bump. Zero new items is the honest,
  fully-checked result, not under-coverage.
- 2026-08-09-H: `draft.coverage` must be populated with category values
  (the same enum as `category`: `launch`, `constellation`, `contract`,
  `procurement`, `regulatory`, `financial`, `product`, `partnership`,
  `incident`, `geopolitical`, `human-spaceflight`, `science`), not domain
  tags (`eo`, `connectivity`) -- finalize-sweep rejected `["eo",
  "connectivity", ...]` outright on a zero-new-items, one-update draft;
  fixed by setting it to the touched item's own category (`["partnership"]`).

## Narrow same-day re-check, ~11h50m gap, unfiltered full source list (2026-08-10)

- 2026-08-10-A: DATA BUG FOUND, not fixed this run (no mechanical path):
  `2026-07-08-telesat-lightspeed-canada-arctic-escp-p` and
  `2026-08-04-telesat-mda-arctic-lightspeed-expansion` are two different
  item ids, dated three weeks apart, that both cite the exact same
  `source_url` (telesat.com's "$2.3 billion Arctic military satcom
  contract... capacity by 44%" release) with near-identical headlines --
  looks like a genuine duplicate from an earlier sweep's dedup miss.
  finalize-sweep has no supported path to merge or delete a published
  item from the draft pipeline, so this needs Florian's direct edit;
  flagging here rather than attempting a workaround.
- 2026-08-10-B: Stratnews Global (stratnewsglobal.tech) and Indian
  Defence News (indiandefensenews.in) ran the same Aule Space
  satellite-docking-demo story almost word-for-word ("Ground tests have
  recreated orbital lighting conditions with sun simulators and robotic
  arms to simulate target motion, achieving high docking success
  rates" verbatim in both), Indian Defence News crediting only
  "Agencies" -- treated as one wire-syndicated unit per the 2026-07-15-C
  Iridium PNT ASIC precedent (led with Stratnews Global alone, crawl
  `found_none`, landed honestly at SNR 1) rather than counting the
  second domain as independent corroboration just because finalize's
  title-SimHash might not have collapsed the differently-worded
  headlines.
- 2026-08-10-C: A whitelisted signal's OWN uncertainty is not a
  publishable lead: Andrew Parsonson's only post after lastSweep was
  "I'm hearing about it too... going to see if I can get any clarity
  from ESA" regarding an Ariane 6 Bloc 3/ICARUS upgrade cancellation
  claim. The claim itself traced to a blog (Space Scout) citing "an
  internal ESA document reviewed by" the outlet -- a leaked-document
  shape CLAUDE.md rules out entirely regardless of SNR ("Publishable
  only once the actor or an official record responds"). Left undrafted;
  worth a follow-up once ESA responds or a non-leaked trade source
  confirms.
- 2026-08-10-D: Chased a genuine predates-window gap successfully: MDA
  Space's June 25 Mitsubishi Electric subcontract for Japan's
  next-generation milsatcom (replacing Kirameki-2) had never been
  drafted under any id despite wide PR-wire pickup, because MDA has no
  `src/data/registry` entry (confirms 2026-08-09-A/2026-08-06-B) and the
  story never carried a SpaceX/Starlink-style hook that discovery
  queries usually catch. Via Satellite and Defense Daily share the
  EXACT SAME headline text (likely same-publisher-family reprint);
  finalize's title-SimHash correctly collapsed them into one
  corroboration unit (`state.json` sweep entry's
  `corroboration_collapses`, rule `wire_rewrite`, kept Via Satellite)
  even though both URLs still render on the card -- the item's 2-source
  `corroboration_2plus` modifier (landing SNR 4) came from the collapsed
  Via-Satellite-unit plus MDA's own page, not from three independent
  units. Trust the collapse log over a first read of the `sources[]`
  array length when sanity-checking a score.
- 2026-08-10-E: A defense-tech company using satellite data as one input
  among several (Space-Eyes, an AI counter-drone/geospatial-intelligence
  SPAC-merger story, $638M valuation) was judged out of scope: it
  doesn't operate satellites and its primary market (counter-UAS
  defense) isn't space-industry-primary, same logic as the 2026-07-15-L
  Senra diversified-industrial-supplier precedent.
- 2026-08-10-F: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s
  own merge confirmation ("merged 2 new, 1 updated, 0 held") as the
  build-health signal.

## Narrow same-day re-check, ~11h44m gap, unfiltered full source list (2026-08-10, third)

- 2026-08-10-G: A WebFetch summary of a wire-mirror page (ctvnews.ca's
  Reuters copy of the Long March 7A failure) stated the wrong launch site
  (Jiuquan) by conflating an unrelated file-photo caption (a Shenzhou 20
  image) elsewhere on the page with the actual story; four independently
  fetched sources (SpaceNews, Space.com, SCMP, Gunter's Space Page) all
  agreed on Wenchang. Dropped the CTV/Reuters mirror entirely from
  scoring rather than risk a wrong fact, even though it would have added
  a mainstream corroboration source; a WebFetch summary that contradicts
  every other fetched source on a plain fact is a signal the tool
  mis-extracted, not that the minority source is right.
- 2026-08-10-H: A bankruptcy-focused discovery query ("space company
  bankruptcy OR acquisition announced this week") surfaced a genuinely
  never-covered, six-month-stale event: Orbex, a flagship UK sovereign
  small-launch developer and ESA European Launcher Challenge winner,
  entered UK administration February 11, 2026, after a Series D round and
  an acquisition by The Exploration Company both collapsed. Chased and
  dated to the actual event date per the standing predates-window
  convention; landed SNR 2 (trade lead, seismic-forced extraordinary
  reset) and was correctly auto-queued to held.json for Florian per
  SNR_PLAN 7.4 while still publishing. Worth periodically re-running a
  bare bankruptcy/acquisition discovery query even on narrow-gap sweeps;
  this kind of old, high-importance gap doesn't surface from the
  harvester queue or routine source checks on its own.
- 2026-08-10-I: The `bsky.app/profile/<handle>` public API pattern
  (`public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>`,
  2026-08-08-C) continues to work cleanly for every fetchable signals
  bluesky account tried this run (11 of 17 channels); `signalsPass.checked`
  must still list the bare `bsky.app/profile/<handle>` URL from
  signals-context's output, not the API endpoint actually fetched.
- 2026-08-10-J: `bun scripts/check-feed.ts` was denied outright by this
  session's permission gate, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 4 new, 3 updated, 1 held") as the build-health signal.

## Normal-mode sweep, ~11h44m gap, unfiltered full source list (2026-08-11)

- 2026-08-11-A: Resolved the 2026-08-09-E source-access gap: DT Next
  (dtnext.in, a Tamil Nadu English-language regional daily) fetched
  cleanly for the IN-SPACe/Centre Kulasekarapattinam spaceport
  privatization story where economictimes.indiatimes.com and
  business-standard.com both stayed blocked. Single-sourced (crawl
  `found_none`; only aggregator mirrors and the same two blocked
  domains turned up on a fresh search), shipped honestly at SNR 2
  rather than held, per the standing "weak sourcing is never a reason
  to hold" rule.
- 2026-08-11-B: `congress.gov` bill pages 403 like every other .gov
  fetch in this project, but `govinfo.gov`'s bulk-data bill-status API
  (`www.govinfo.gov/bulkdata/BILLSTATUS/<congress>/<chamber>/BILLSTATUS-<congress><chamber><number>.xml`)
  fetched cleanly and gave an exact, dated "latest action" line (Senate
  passage of S.434 by unanimous consent, August 6) with none of
  congress.gov's blocking. Worth trying this pattern first for any
  future bill-status sourcing; it also satisfies the anti-spoof gate
  as `official_record` via the unconditional `.gov` host check.
- 2026-08-11-C: A whitelisted signal's own post can be the ONLY route
  to a genuine story the harvester queue and discovery pass both
  missed entirely: Marcia Smith's Bluesky post about the Senate passing
  the Space Commerce Advisory Committee Act (Aug 6 passage, surfaced in
  her Aug 10 post) had zero hits anywhere else this run, including the
  8-query discovery pass run afterward. The mandatory fetchable-channel
  signals leg is still finding real, otherwise-invisible stories five
  weeks post-launch.
- 2026-08-11-D: AST SpaceMobile's investor-relations subdomain is
  `investors.ast-science.com` (plural); `investor.ast-science.com`
  (singular, a plausible guess) doesn't resolve at all (DNS failure,
  not a 403). The plural subdomain still failed to yield the exact Q2
  2026 earnings release URL on a direct fetch of its landing pages
  (`/press-releases`, `/quarterly-results`; the latter pointed to an
  `feeds.issuerdirect.com` wire-distribution link, not an ast-science.com
  page, so not gate-safe as first_party anyway) -- led with two
  financial-media outlets instead (247wallst.com, MarketBeat), both
  directly fetchable and both classed `informal` (neither is trade nor
  legacy mainstream press), landing an honest SNR 2 for a real, sourced
  earnings event.
- 2026-08-11-E: `china-in-space.com` (a Chinese-space-focused
  newsletter/blog, distinct from Andrew Jones's whitelisted channels)
  fetched cleanly with substantive follow-on detail a same-day SCMP
  article didn't yield (WebFetch kept truncating SCMP's article body
  before the relevant paragraphs): the YF-100 engine coming under
  investigation, the Long March 7A fleet grounding, and Chang'e-7's
  October backup launch windows, all attached to the existing Aug 10
  Long March 7A failure item as `trade`-class corroboration. Worth
  adding to sources.json at a future structural touch as a China-launch
  fallback when SCMP's full text won't render.
- 2026-08-11-F: Space.com continues to fail to return article body text
  via WebFetch (nav/membership-prompt boilerplate only, "[Content
  truncated due to length...]"), on two different articles this run
  (the Rocket Lab GHOST unveiling and the Michibiki 7/QZS-7 launch);
  SpaceNews and Nikkei Asia covering the same stories both fetched
  fine. Don't burn a second attempt on Space.com once this shape shows
  up; go straight to another outlet covering the same story.
- 2026-08-11-G: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate on the first
  attempt, continuing the standing pattern since 2026-07-11-B; relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 6 new, 1
  updated, 0 held") as the build-health signal.

## Normal-mode sweep, ~11h42m gap, unfiltered full source list (2026-08-11, second)

- 2026-08-11-H: Voyager Technologies' own `/press-releases/` listing page
  is directly fetchable and named the exact release for a brand-new
  contract (space-to-space comms award) on the first try; Voyager's
  registry `website` (voyagertechnologies.com) matches the press-release
  domain exactly, so the anti-spoof gate passed clean as `first_party`
  without needing to fall back to a trade lead the way SpaceX/Redwire's
  IR-CDN domains have required (2026-08-05-B/2026-08-06-B). Worth trying
  a company's own `/press-releases/` or `/news/` index directly before
  assuming a same-day contract announcement needs a trade-outlet lead.
- 2026-08-11-I: The same-company-plus-category dedup false positive
  (2026-08-03-H and many peers) now extends to a company appearing only
  as the CUSTOMER-side counterparty, not the subject: VinSpace booking a
  SpaceX Transporter rideshare slot (category `contract`) false-matched
  Redwire's unrelated Starfall reentry-capsule contract (also category
  `contract`, 5 days earlier) purely because both items list "SpaceX" in
  `companies`. One `dedup_distinct` entry cleared it; expect this shape
  whenever a new item's launch-services counterparty is SpaceX, not just
  when SpaceX itself is the newsmaker.
- 2026-08-11-J: A whitelisted signal's Bluesky post (Andrew Parsonson)
  independently confirmed a candidate held-queue follow-up (Mario
  Cospito named ASI extraordinary commissioner, resolving the identity
  gap in the still-open 2026-08-05 ASI board-dissolution scope question)
  the same day europeanspaceflight.com itself published it -- used as
  confirmation in a new held-queue entry rather than a scoring source,
  since the underlying scope question (no stated commercial-space
  consequence) is unchanged and still awaits Florian's ruling.
- 2026-08-11-K: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 8 new, 0 updated, 1 held") as the build-health
  signal.

## Normal-mode sweep, ~11h45m gap, unfiltered full source list (2026-08-12)

- 2026-08-12-A: The harvester queue was ~90% a single Google-News wave
  (dozens of near-identical outlets covering NASA inviting ISRO to join
  its lunar South Pole Moon Base, from the Aug 5-6 India-US Civil Space
  Joint Working Group meeting) plus SpaceX stock/IPO chatter; zero
  drafts came from the queue itself. Treated the NASA-ISRO invite as a
  near-duplicate of the still-open Serbia Artemis Accords scope question
  already sitting in held.json (institutional bilateral space diplomacy,
  no stated commercial-contract or market-access consequence in any
  source checked) and skipped filing a second hold entry for the same
  recurring shape, per the standing 2026-07-19-C/2026-07-20-B practice.
- 2026-08-12-B: A guessed press-release URL on a company's own newsroom
  can land on a stale cached page with the same slug pattern as a much
  older release: the first fetch of
  `fireflyspace.com/news/firefly-aerospace-announces-multi-launch-agreement-with-lockheed-martin-for-25-alpha-launches/`
  returned Firefly's original June 2024 Lockheed Martin deal, not the
  Aug 11, 2026 extension; a second, more specific URL guess
  (`.../firefly-aerospace-announces-extension-of-multi-launch-agreement-with-lockheed-martin-through-2031/`)
  landed on the correct, dated release. Always check a fetched company
  press release's own stated date against the expected event before
  citing it, even when the URL and headline look right at a glance.
- 2026-08-12-C: SES's Aug 7 IRIS² Rendez-vous 1 / MEO capital-commitment
  release (up to EUR1.35B, 18 MEO satellites, 2030 service entry) had
  never been drafted under any id despite direct first-party sourcing
  and trade pickup (SatNews) being trivially findable -- a genuine,
  never-covered gap chased under the standing predates-window
  convention, five days before this sweep. Worth periodically checking
  a constellation operator's own newsroom for milestone/financial
  releases the queue's headline-matching legs (Google News, Bluesky
  search) don't reliably surface, especially ones framed as technical
  milestones ("Rendez-vous 1") rather than contract-award language.
- 2026-08-12-D: Two Polish-focused informal outlets (Goniec, a
  Polish-diaspora news site, and Pravda Poland) independently reported
  Starlink quietly excluding Poland from its "Europe" roaming zone
  (effective Aug 17), each citing different specifics (Goniec: exact
  PLN pricing tiers and a direct quote from Starlink's own help page;
  Pravda Poland: the list of countries still in the zone and the
  Ukraine cross-border impact) -- read as independent reporting, not a
  rewrite of one another, and both counted. TVP World's own English
  writeup of the same story (the outlet that broke it) returned only
  its bare headline on two separate WebFetch attempts with no body
  text extractable; left uncited per the standing "only cite pages
  with genuinely fetched content" rule rather than force it in as a
  third source. Could not fetch Starlink's own help-center page
  (starlink.com, which matches the registry's first_party host) to
  attempt a tier-5 lead; it returned empty content both times tried.
- 2026-08-12-E: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 3 new, 0 updated, 0 held") as the build-health
  signal.

## Normal-mode sweep, ~11h53m gap, unfiltered full source list (2026-08-12, second)

- 2026-08-12-F: `explainer.tagline`'s 140-char cap is stricter than it
  looks once a real actor name, a second company, and a dollar figure
  are all in one sentence: 6 of 9 drafted taglines this run needed a
  second, tighter rewrite after finalize-sweep's first rejection
  (Optus/Northrop Grumman, Redwire/Kanematsu, iSpace, Golden Dome,
  Rocket Lab Germany, Nova/Planet all overshot on the first pass, one
  by as little as 141 chars). Worth drafting taglines closer to ~120
  chars up front rather than assuming a fluent one-sentence summary
  will clear 140.
- 2026-08-12-G: The same-company-plus-category dedup heuristic fired on
  two unrelated Planet stories 2 days apart (Planet's Rwanda national
  satellite-data program, Aug 10, vs. a new Nova Systems/Planet
  Australian defense partnership, Aug 12, both category "partnership")
  and on two unrelated Rocket Lab stories (the Aug 10 GHOST
  containerized launch system unveiling vs. the same-day formal
  establishment of Rocket Lab Germany GmbH) -- both cleared with one
  `dedup_distinct` entry apiece. Extends the standing finding that this
  heuristic fires on ANY shared company regardless of how unrelated the
  underlying stories are, including two of a company's OWN stories on
  the same day.
- 2026-08-12-H: Redwire's own newsroom domains (`ir.rdw.com` for IR
  releases, `rdw.com/newsroom` for general PR) both fail the anti-spoof
  gate because the registry's recorded website is `redwirespace.com`
  -- confirms 2026-08-05's ir.rdw.com precedent and extends it to the
  separate rdw.com/newsroom domain found this run; both class
  `informal`, not `first_party`, until the registry site value is
  reconciled with which of Redwire's domains it actually publishes on.
- 2026-08-12-I: `war.gov` press releases 403 on WebFetch same as every
  other .gov/.mil source logged in this file (the Golden Dome
  Ecosystem Hub launch release); led with SpaceNews and Defense Daily
  trade coverage instead, both of which independently, non-wire
  reported the same Aug 11 Guetlein announcement.
- 2026-08-12-J: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 9 new, 0 updated, 0 held") as the build-health
  signal.

## Normal-mode sweep, ~11h42m gap, unfiltered full source list (2026-08-13)

- 2026-08-13-A: Two independent WebSearch-summary results this run both
  turned out to be a full YEAR stale once directly fetched, despite
  reading as today's news from the queue/search framing: (1) a
  china-in-space.com piece on SpaceSail awarding Landspace/Space
  Pioneer/CAS Space $187M in Qianfan launch contracts was actually
  published 2025-08-14, not today; (2) a Google News item quoting
  Minister Jitendra Singh on "IN-SPACe approved country's first fully
  commercial EO constellation" traced to the Pixxel/Dhruva Space/
  PierSight/SatSure EO-PPP win, which a direct search confirmed was
  announced 2025-08-13 -- today's coverage was Parliament restating a
  year-old fact, not a new milestone. Both were caught only by directly
  fetching/searching for the underlying announcement's own publish date
  rather than trusting the search snippet's apparent freshness; a third
  reminder (after 2026-07-15-B/2026-08-10-B-adjacent cases) that a
  same-calendar-month-different-year trap is easy to miss when a
  government official is restating an old fact as if it's live news.
- 2026-08-13-B: click2houston.com, thebusinessjournal.com, and several
  other outlets carrying "Broadband grants paused as critics allege
  favoritism toward Elon Musk's Starlink" (Texas BEAD funding pause) all
  turned out to be the same underlying Texas Tribune piece (byline Jayme
  Lozano Carver) redistributed via AP syndication, not independent
  reporting -- confirmed by fetching the Texas Tribune original directly
  and finding identical quotes/structure everywhere else. Led with Texas
  Tribune as the mainstream original and scored `crawl: "found_none"`
  honestly (SNR 2) rather than stacking wire mirrors as fake
  corroboration, consistent with the standing wire-collapse rule.
- 2026-08-13-C: A same-company-plus-category dedup false positive fired
  between a brand-new Texas state BEAD-funding-pause item (category
  regulatory, company SpaceX) and the existing 2026-08-06 FCC D2D
  spectrum NPRM item (also regulatory, also SpaceX) despite the two
  having nothing in common beyond agency-adjacent regulatory action
  touching Starlink -- state broadband office vs. federal FCC
  rulemaking. One `dedup_distinct` entry cleared it; extends the
  standing finding that this heuristic fires on any shared company
  regardless of which government body or program is actually involved.
- 2026-08-13-D: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate on the first
  attempt, continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 0
  updated, 0 held") plus a direct grep spot-check of the three merged
  items' `snr`/`category`/`impact` fields as the build-health signal.

## Normal-mode sweep, ~11h49m gap, unfiltered full source list (2026-08-13, second)

- 2026-08-13-E: A second, independent confirmation the same day that
  the Allied Orbits/Pixxel India EO-PPP story (satnews.com, Google News
  "Private Consortium Allied Orbits Secures Approval...₹1,200 Crore")
  is the SAME year-old August 2025 announcement recirculating, not new
  news, extending 2026-08-13-A's finding from this morning's sweep to a
  fresh discovery-pass hit later the same day. A direct WebSearch for
  "Allied Orbits India IN-SPACe crore" surfaces domain-b.com's original
  coverage plainly, confirming the trap without needing a full fetch.
- 2026-08-13-F: A company's own newsroom page reached via a plausible
  guessed/linked URL can return a stale EVERGREEN press release sharing
  the product's name rather than today's actual news: WebFetch on
  orbitworks.space's "Orbitworks Unveils Altair" page returned a May
  2025 constellation-unveiling release, not the Aug 13, 2026 story
  (Altair-1 physically shipping to the US for its October launch) the
  queue actually surfaced. Caught it only because the fetched content's
  own stated publish date (May 18, 2025) didn't match the event; used a
  trade outlet's fresh write-up (TahawulTech) instead. Always check a
  fetched company-site page's own stated date against the expected
  event, same lesson as 2026-08-12-B's Firefly/Lockheed case, now
  confirmed on a generic "company unveils product line" page rather
  than a dated press-release slug.
- 2026-08-13-G: reuters.com direct fetch failed outright this session
  ("unable to fetch"), and a TradingView mirror of the same Reuters wire
  story (Starlink Vietnam market entry) was paywalled with no body text.
  Worked around by leading with an independently-reported trade piece
  (TheNextWeb, which had its own "on Hanoi's terms" framing and detail
  beyond the wire text) and Xinhua's English wire (citing VnExpress,
  with its own distinct figures) as corroboration, rather than forcing
  the Reuters citation or treating the story as unreachable.
- 2026-08-13-H: A Korea Herald story headlined as if freshly breaking
  ("S. Korean de-orbiting device successfully tested in space") in fact
  describes a device deployed on a cubesat that launched in May 2023,
  with the deployment itself dated only vaguely ("after about a year of
  normal operations"). Treated as genuinely new because the article's
  own fetched content carried an explicit Aug 13, 2026 publish date and
  a fresh CEO quote, distinguishing it from the same-calendar-date/
  wrong-year trap (2026-07-15-B, 2026-08-13-A): an old satellite/launch
  date is not itself a staleness signal when the NEWS PEG (a new test
  milestone, a new quote) is independently dated to the sweep window.
  Single-sourced (crawl `found_none`; no second fetchable page found
  despite the story clearly existing only via this one outlet).
- 2026-08-13-I: techtimes.com 403'd on WebFetch on two separate URL
  forms (with and without the `https://www.` prefix) for a genuinely
  new, real story (Korea's NEONSAT pre-shipment review) that a WebSearch
  confirmed exists and is independently written; no fetchable mirror
  found. Landed the item single-sourced (Korea Times only, `found_none`)
  rather than citing the unfetched techtimes.com page, per the standing
  2026-07-16-F rule that a page only counts as corroboration once
  actually fetched this run, not merely confirmed to exist via search.
- 2026-08-13-J: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 8 new, 0 updated, 0 held") plus a direct `jq`
  spot-check of all eight merged items' `snr`/`category`/`impact`
  fields as the build-health signal.

## Normal-mode sweep, ~11h47m gap, unfiltered full source list (2026-08-14)

- 2026-08-14-A: The harvester queue (517 consumed, 9 collapsed) was
  almost entirely SpaceX stock/IPO-stake speculation (dozens of Motley
  Fool/Yahoo Finance/Benzinga headlines off Musk's 48.4% stake
  disclosure) plus off-topic Futurism/BBC content; zero drafts came
  from the queue itself. Every genuine candidate this run (CesiumAstro/
  Jariet acquisition, the Space Force $60M multi-vendor SDN test award,
  Firefly's DIU Elytra deorbit design contract) came directly from the
  trade-press legs (SpaceNews) already in sources.json, confirming the
  2026-08-09-G/2026-08-12-A pattern that the queue is now mostly noise
  three-plus months post-SpaceX-IPO.
- 2026-08-14-B: A signals-pass Bluesky find (Andrew Parsonson: UK
  rocket builder Gravitilab entered liquidation) was judged out of
  scope: Gravitilab builds suborbital-only hybrid test rockets, and
  CLAUDE.md's launch-vehicle scope is explicitly "orbital only." First
  time this exact carve-out (suborbital rocket *manufacturer*, not
  tourism) has come up; flag for Florian if a suborbital launch-vehicle
  company's insolvency should actually be in scope as an ecosystem
  event even though its vehicles never qualify individually.
- 2026-08-14-C: A same-day WebSearch surfaced a live reversal of an
  already-published item: SpaceX restored Poland to Starlink's Europe
  roaming zone (2026-08-11-starlink-poland-roaming-exclusion) after the
  Polish Digital Affairs Minister said SpaceX backed down, less than 3
  days after the original exclusion was reported. Patched the existing
  item's headline and copy to reflect the resolution rather than
  publishing a second item, and attached Kyiv Independent (mainstream,
  general-interest coverage of the Ukraine angle) plus an AFP wire copy
  via Free Malaysia Today as the first non-informal sources on that
  item, landing a `mainstream_pickup` bump (SNR 2 to 3). Worth noting:
  the item's original lead (Goniec, informal) never got corrected or
  upgraded even though the underlying claim briefly went stale-then-
  reversed within 72 hours; a same-week reversal update is a normal,
  healthy edit-queue outcome here, not a strike against the original
  source.
- 2026-08-14-D: `europeanspaceflight.substack.com/feed` 403'd on direct
  WebFetch this run (the bare `europeanspaceflight.com` site was
  skipped this run per rotation, not tried); Andrew Parsonson's only
  retrievable content was via his Bluesky leg. First time the substack
  RSS leg specifically (not the bare site, which has its own
  intermittent-block history per 2026-07-16-H) has failed.
- 2026-08-14-E: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 3 new, 1 updated, 0 held") plus a direct read
  of all four touched items' `snr`/`category`/`impact` fields as the
  build-health signal.

## Normal-mode sweep, ~11h52m gap, unfiltered full source list (2026-08-14, second)

- 2026-08-14-F: A same-company-plus-category dedup false positive fired
  between a brand-new Blue Origin item (the LC-36B second-pad
  construction plan, category launch) and the existing Aug 5
  BE-4-valve root-cause item (also category launch, 7 days back) purely
  on shared company + category, despite covering unrelated facts (an
  infrastructure buildout decision vs. a completed investigation
  finding). One `dedup_distinct` entry cleared it; extends the standing
  finding that this heuristic fires regardless of how unrelated the two
  Blue Origin stories are.
- 2026-08-14-G: blueorigin.com 429'd on WebFetch on two separate
  attempts a few minutes apart (a new failure code for this domain,
  distinct from the usual 403/JS-shell pattern); led with SpaceNews
  plus Aviation Week (both trade) instead for the LC-36B second-pad
  item rather than forcing the first-party fetch. nasaspaceflight.com
  403'd on the same story's third angle.
- 2026-08-14-H: Confirms Spire's own domain (spire.com/press-media/,
  matching the registry's recorded website) passes the anti-spoof gate
  as `first_party`, distinct from the ir.spire.com IR subdomain that
  has failed it in every prior sweep this file documents (2026-08-11-D,
  2026-08-12-H) -- Spire mirrors its press releases on both
  spire.com/press-release/... and ir.spire.com; always check the bare
  marketing domain's own press page before defaulting to the IR
  subdomain link a source's own citation happens to use.
- 2026-08-14-I: A trade write-up (SpaceNews, Aug 14) of a Bulgaria/
  EnduroSat space-and-defense-hub MOU traced to an Aug 6 signing
  ceremony (confirmed via Bulgaria's BTA news agency and EnduroSat's
  own release, both dated Aug 6) that predates the sweep window by over
  a week with no earlier draft found (grepped items.json/held.json for
  "endurosat"/"bulgaria", zero hits) -- first time the predates-window
  chase convention (2026-07-08, previously applied mainly to seismic
  items like Orbex) was applied to a plain `notable`-tier partnership
  story with no stated dollar figure. Dated to the actual Aug 6 signing
  rather than the Aug 14 publish date. Worth confirming with Florian
  that the chase convention is meant to extend this far down the
  impact scale, or whether it should stay reserved for seismic/major
  gaps.
- 2026-08-14-J: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 4 new, 2 updated, 0 held") plus a direct grep
  spot-check of all four new items' `snr`/`category`/`impact` fields as
  the build-health signal.

## Normal-mode sweep, ~11h47m gap, unfiltered full source list (2026-08-15)

- 2026-08-15-A: A signals-pass candidate (Aviation Week's Vivienne Machi
  covering a Space Force "Space Data Network" 5-vendor $60M award) and a
  Telesat Q2 2026 earnings story surfaced via the HTML source-list pass
  (telesat.com/press listed the release with a date) both turned out to
  already be published same-day (`2026-08-13-space-force-sdn-multivendor-tests`,
  `2026-08-13-telesat-h1-2026-results`) -- caught both by grepping
  `existing[]`/items.json for the company name before drafting, not by
  finalize-sweep's own dedup gate. Confirms the standing practice
  (2026-08-07-E and many peers) of a company-name grep before drafting a
  chased or signals-surfaced candidate, even one that reads as
  same-day-fresh from its own listing page.
- 2026-08-15-B: A new dedup false-positive pairing on the standing
  shared-company-plus-category pattern: ESA's Aschbacher launcher-capacity
  remarks (category `launch`, company ArianeGroup as one of several named
  manufacturers) matched the existing 2026-08-05 CNES ASTRE hot-fire-test
  item purely on ArianeGroup + `launch` + within 7 days, despite the two
  sharing no agency, program, or subject. One `dedup_distinct` entry
  cleared it.
- 2026-08-15-C: `isro.gov.in` passes the anti-spoof gate cleanly as
  `first_party` (the registry's ISRO org entry records `isro.gov.in` as
  its website, so it matches directly rather than needing the generic
  `.gov` suffix check) -- confirms it's a reliable first-party lead for
  ISRO program-event stories, distinct from the still-untried
  `inspace.gov.in` flagged in 2026-08-09-E.
- 2026-08-15-D: Two WebSearch-summary "slips beyond 2030" headlines about
  Russia's Amur-SPG reusable rocket (Aviation Week, via a Google News
  redirect that wouldn't resolve) turned out to be a confusing tangle of
  restated 2024/April-2026/July-2026 statements with no single fresh
  dated fact and no consistent target year across sources (some claiming
  a slip to 2030, others an acceleration to 2028) -- left undrafted
  rather than guess at which restatement was current, extending the
  stale-resurfacing pattern (2026-08-13-A and many peers) to a case where
  the confusion is about the CLAIM itself, not just the publish date.
- 2026-08-15-E: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate on the first
  attempt, continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 4 new, 1
  updated, 0 held") plus a direct grep spot-check of all five
  touched items' `snr`/`category`/`impact` fields as the build-health
  signal.

## Normal-mode sweep, ~11h47m gap, unfiltered full source list (2026-08-15, second)

- 2026-08-15-F: A federal appellate court ruling is a legitimate `financial`
  category item even with no company press release involved: the Ninth
  Circuit's ruling reviving Devas Multimedia's $562.5M (now $2bn+)
  arbitration award against ISRO's Antrix was sourced entirely from Indian
  legal/business press (Bar and Bench trade, Free Press Journal mainstream)
  since both `law.justia.com` and `courtlistener.com` 403'd on direct
  WebFetch; two independently-worded write-ups of the same ruling were
  sufficient for `corroboration_2plus` without ever reaching a primary
  court-document source. Antrix has no separate registry entity (only ISRO
  does), so crossfeed was an honest empty block.
- 2026-08-15-G: THIRD confirmed occurrence of the India EO-PPP stale trap
  (2026-08-13-A/E): a fresh-looking "India Approves First Commercial Earth
  Observation Constellation Under PPP Model" queue hit and a Parliament
  Question restating it (globalsecurity.org, Aug 12) both traced to the
  same year-old August 2025 Pixxel/Dhruva Space/PierSight/SatSure Allied
  Orbits announcement, not a new approval. This headline shape (India
  EO-PPP "approval") is now a standing false-positive to check against the
  2025 date before drafting, same as the DISA $900M and Amur-SPG traps.
- 2026-08-15-H: Chased a genuine predates-window gap: Skyroot/HEX20's
  Aug 7 three-launch Vikram agreement (Nila-3, MAYA-V, DINK-N satellites)
  had no prior draft under any id despite being Skyroot's first publicly
  announced multi-launch contract post-Vikram-1; two independently-worded
  Indian outlets (Analytics India Magazine trade, ETV Bharat mainstream)
  covered it days apart, landing SNR 4.
- 2026-08-15-I: `bun scripts/check-feed.ts` was denied outright by this
  session's permission gate on the first attempt, continuing the standing
  pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 2 new, 0 updated, 0 held") plus a direct read of
  both new items' `snr`/`category`/`impact` fields as the build-health
  signal.

## Normal-mode sweep, ~11h52m gap, unfiltered full source list (2026-08-16)

- 2026-08-16-A: A missile strike on a launch-vehicle PRODUCTION FACILITY
  (Ukraine's Flamingo strike on RKTs Progress in Samara, Russia's sole
  Soyuz-2 integration line) is a clean geopolitical-carve-in case, not a
  conflict-analysis exclusion: unlike the Elektrostal/Rogozin battlefield-
  imagery precedents (2026-07-15-I, 2026-07-20-G), this reports damage to
  commercial-relevant manufacturing infrastructure (Soyuz-2 also launches
  Bureau 1440's Rassvet constellation), on the record from both Zelensky/
  Ukraine's General Staff and the Samara governor, without analysing troop
  movements or operational use of any space asset. Led with SpacePolicyOnline
  (whitelist, observer, floors at 4) since Marcia Smith's site is both a
  sources.json-adjacent signals channel and independently corroborated by
  Kyiv Independent (mainstream) and Euromaidan Press (informal); the direct-
  source ceiling caps a whitelist-observer lead at 4 regardless of
  corroboration count. Wrote the copy to attribute every damage claim
  explicitly (Ukrainian officials say X; Russian officials confirm only an
  unnamed facility was hit; independent outlets say the specifics are
  unverified) rather than asserting Progress was confirmed hit.
- 2026-08-16-B: A genuine engineering-milestone launch item (SpaceX's
  38.5-minute Falcon 9 doubleheader, beating its prior cadence record, plus
  a 650th Falcon booster landing) tripped the same-company-plus-category
  dedup heuristic against TWO separate existing SpaceX `launch` items inside
  the 7-day window (an Aug 11 Starlink batch, an Aug 8 Starlink batch),
  needing two `dedup_distinct` entries in the same item rather than one --
  first confirmed case of the heuristic requiring multiple entries on a
  single new item. space.com and spacex.com both continue to fail to render
  body content via WebFetch (nav/JS-shell only, per the long-standing
  pattern); spaceflightnow.com and a foreign mainstream mirror (el-balad.com)
  both fetched cleanly with matching verbatim figures (38.5 min, B1090 14th
  flight, B1088 18th flight, 650th landing), enough for corroboration
  without either blocked domain.
- 2026-08-16-C: Two "process not yet fact" exclusions confirmed on new
  shapes: NASA's upcoming CLPS task orders (an orbiter to replace LRO, per
  SpaceNews) are unawarded, no contract yet; and the Senate's passage of the
  Space Commerce Advisory Committee Act (Marcia Smith's Bluesky, Aug 6
  passage) creates a committee with no stated commercial-market consequence,
  same shape as the standing NDAA-passage exclusion (2026-07-23-H) -- left
  undrafted despite sitting untouched in the record since first flagged by
  2026-08-11-C, confirming that entry's "genuinely new find" was never
  actually draftable, just newly surfaced.
- 2026-08-16-D: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate on the first attempt,
  continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 0 updated, 0
  held") plus a direct read of both new items' `snr`/`category`/`impact`
  fields as the build-health signal.

## Normal-mode sweep, ~11h50m gap, unfiltered full source list (2026-08-16, second)

- 2026-08-16-E: A company's own press release about "its" government award
  can be a narrower slice of a multi-company program story that surfaces
  days later: Firefly's August 13 first-party release only described its
  own Elytra-based DIU/SDA deorbit-design contract, but SpaceNews and
  Defense Daily reported August 16 that the same DIU/SDA "deorbit-as-a-
  service" program also tapped D-Orbit and Katalyst, with a combined
  ~$8.4 million value and an end-of-2026 PDR timeline neither in Firefly's
  own copy. Treated as a same-event `updates[].patch` (broadened headline,
  companies, and copy) rather than a new item, per the standing dedup rule
  -- worth checking a single-company award announcement against a
  same-agency multi-company program angle before assuming the company's
  own release is the complete picture.
- 2026-08-16-F: SES's press-releases listing page shows its most recent
  item with no rendered date at all (top slot, undated in the page
  extract) while every item below it carries one -- this turned out to be
  a stale repeat of the already-published August 7 IRIS2 MEO release, not
  a new one. A listing position at the top of a company newsroom page is
  not itself a freshness signal when the date field is missing; confirm
  via the article's own URL/search results before treating it as new.
- 2026-08-16-G: All 8 Bluesky feeds checked this session (Aschbacher,
  Langbroek, Henry, Farrar, Berger, Foust, SpacePolicyOnline, Zak, Andrew
  Jones, Parsonson -- 10 checked, 8 non-Aschbacher/Jones topped out stale)
  topped out days-to-weeks before `lastSweep`, extending the standing
  per-session/per-account flakiness pattern (2026-07-19-B and many peers)
  to a run where literally every checked account was stale simultaneously;
  none of this run's 3 new items or 1 update came from the signals pass.
- 2026-08-16-H: The Google News redirect for a Business Insider Africa
  story (Airtel/Starlink DRC satellite-to-mobile launch) rendered only a
  bare "Google News" header via WebFetch, continuing the standing
  redirect-failure pattern (2026-07-19-I); a WebSearch on the headline
  text surfaced three independently-written trade outlets (Space in
  Africa, Developing Telecoms, TechMoran) directly, which was faster than
  chasing the redirect and gave three fetchable pages instead of one.

## Normal-mode sweep, ~11h49m gap, unfiltered full source list (2026-08-17)

- 2026-08-17-A: Several Aug 10-12 preview articles (techtimes, srpske.rs,
  BigGo Finance, a stray thedefensenews.com hit whose title matched but
  whose body was actually about the December 2025 first flight) all read
  as if LandSpace's Zhuque-3 second flight and land-landing attempt had
  already happened and failed again, but a direct check of Wikipedia's
  own Zhuque-3 launches table showed the Y2 flight still marked "TBD" /
  "Planned", and a Chinese-language search confirmed the August 11
  Beijing-time launch window had been postponed with no new window
  announced as of August 12. Left undrafted rather than risk a wrongly
  timed "second landing attempt failed" claim on a launch that, per the
  best available record, had not yet flown; extends 2026-07-22-F's
  "a WebFetch/search summary calling something a debut/result is not
  proof" lesson to booster-recovery outcomes specifically, and adds a
  new check: a registry-style launch-manifest page (Wikipedia, Gunter's)
  is a fast, reliable status check when preview coverage and result
  coverage are tangled together under near-identical headlines.
- 2026-08-17-B: presse.cnes.fr/fr (the sources.json-recorded CNES press
  URL) now 301-redirects to cnes.fr/presse, a different path on the same
  apex domain; fetched cleanly either way, newest release still July 9,
  2026 (out of window). Worth updating the stored URL at the next
  structural touch, same as the Redwire/rdw.com and Maxar/Vantor
  precedents, though here it is same-apex-domain so first_party matching
  is unaffected, unlike those full-rebrand cases.
- 2026-08-17-C: A quiet, thorough sweep: harvester queue (304 consumed)
  was almost entirely SpaceX stock-disclosure/IPO-stake and Starlink
  lifestyle noise (fishing livestreams, Cybercab integration, flood
  relief deployments) with zero genuine drafts from the queue itself
  except one SpaceNews entry; all 10 HTML sources, all 17 signals
  channels (full coverage, no rotation needed), and an 8-query discovery
  matrix surfaced nothing else new in window. The single item shipped
  (Lynk/Omnispace's completed merger into Elveo Mobile) led on
  `wire_pr` (PR Newswire, base tier 4) rather than `first_party` since
  neither merging company nor the combined entity has a
  src/data/registry organization entry — the no-registry-host workaround
  applies to press releases the actor distributes via wire, not just
  its own domain.
- 2026-08-17-D: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate on the first
  attempt, continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 0
  updated, 0 held") plus a direct read of the merged item's
  `snr`/`category`/`impact`/`snr_trace` fields as the build-health
  signal.

## Normal-mode sweep, ~11h52m gap, unfiltered full source list (2026-08-17, second)

- 2026-08-17-E: `ulalaunch.com/about/news` (the corporate site's news
  archive, several pages deep) does NOT surface a same-day executive
  press release even when asked directly; the real release lived at
  `newsroom.ulalaunch.com/releases/<slug>`, a separate subdomain that
  still matches the registry's `ulalaunch.com` website value for
  `first_party` purposes. Confirmed on Mark Peller's CEO appointment
  (Aug 17): the corporate news-archive page listed only launch/mission
  posts with no leadership-change coverage, while `newsroom.ulalaunch.com`
  had the exact release with quotes from both board chairs. Try the
  `newsroom.<domain>` subdomain directly before concluding a same-day
  corporate announcement isn't first-party-fetchable.
- 2026-08-17-F: A for-cause CEO ouster at a major prime (L3Harris's
  Christopher Kubasik exiting after a board conduct investigation, Sam
  Mehta promoted from the space-sector presidency) was treated as
  publishable above the standing "routine executive hire stays below the
  inclusion bar" rule: that rule targets CFO/SVP-level hires, not a
  for-cause change at the top of the whole company: L3Harris's own
  release, SpaceNews, and a Reuters wire copy all led with the board
  investigation, not a routine succession. Drafted `category: financial`,
  `impact: notable` (no stated dollar figure or market-access change, so
  short of `major`); a well-telegraphed, non-scandal CEO succession
  (ULA's Peller, ending an 8-month interim period after Tory Bruno's
  earlier departure) was drafted the same run at `impact: noise` instead,
  `category: launch` — worth distinguishing "for-cause/scandal" leadership
  changes at major primes (notable) from ordinary successions (noise or
  below the bar) going forward.
- 2026-08-17-G: An Aviation Week author-page listing (Vivienne Machi,
  fetched via `aviationweek.com/author/vivienne-machi`) surfaced a
  same-day-dated headline ("NRO Awards Operational Commercial RF
  Contract To HawkEye 360") that could not be independently verified:
  the guessed article URL 404'd twice, and both a direct search and an
  `site:aviationweek.com` search returned only older (Dec 2025-vintage)
  HawkEye/NRO contract-extension coverage, never the specific Aug 17
  piece. Left undrafted per the standing "only cite pages with genuinely
  fetched content" rule rather than trust an author-listing summary as
  proof the article says what its headline implies — the listing itself
  may be a first-party AI summary of the page, not confirmation of a
  fresh event distinct from the Dec 2025 contract extension.
- 2026-08-17-H: All three configured Bluesky keyword-search feeds
  (`spacex launch`, `satellite constellation`, `earth observation
  satellite`) 403'd in the harvester's own health check this run, unlike
  most prior sessions where they degrade per-account rather than
  wholesale; the signals-pass fetchable bluesky accounts (via the public
  `getAuthorFeed` API) were unaffected and fetched cleanly. A queue-level
  Bluesky search failure doesn't imply the signals-pass Bluesky legs are
  also down; check both independently.
- 2026-08-17-I: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate on the first
  attempt, continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 4 new, 1 updated,
  0 held") plus a direct grep spot-check of all four new items' and the
  one updated item's `snr`/`category`/`impact` fields as the build-health
  signal.

## Normal-mode sweep, ~11h47m gap, unfiltered full source list (2026-08-18)

- 2026-08-18-A: A NASA press release reached via a guessed/search-listed
  URL (`nasa.gov/news-release/nasa-awards-spacecraft-processing-operations-contract`)
  turned out to be the ORIGINAL 2023 contract-vehicle award, not today's
  news, even though it read as a plausible primary source for Firefly's
  Aug 17 "onboarded to NASA Spacecraft Processing Operations Contract"
  release: the fetched page's own stated date was February 3, 2023. The
  actual fresh source was a different NASA URL entirely
  (`nasa.gov/news-release/nasa-selects-companies-to-provide-payload-processing-services/`,
  dated Aug 17, 2026), found only via a second, more specific search for
  the on-ramp provision naming all four newly onboarded companies.
  Extends the standing "check a fetched page's own stated date before
  citing it" lesson (2026-08-12-B, 2026-08-13-F) to official .gov pages,
  not just company newsrooms: a plausible-looking government URL can be
  a stale contract-vehicle's original announcement, not the current
  on-ramp action.
- 2026-08-18-B: A satellite-connectivity company's contract can still be
  out of scope when the specific deal is pure terrestrial infrastructure:
  Gilat Peru's $14 million fiber-optic broadband build for Ayacucho
  (Peru's Works for Taxes program) involves no satellite hardware or
  service at all, despite Gilat's registry-adjacent identity as a
  satellite-connectivity integrator with other, genuinely in-scope
  satellite contracts (e.g. the Aug 6 AI interference-cancellation demo).
  Left undrafted as out of scope rather than published on the company's
  satellite-sector identity alone; a company's usual business does not
  pull a specific non-satellite deal into scope.
- 2026-08-18-C: The signals-pass Bluesky API was clean and current for
  most accounts checked this run (Aschbacher, Langbroek, Foust,
  SpacePolicyOnline, Zak, Andrew Jones, Andrew Parsonson all returned
  in-window posts), a contrast to several recent sessions logging
  wholesale staleness (2026-08-16-G); Caleb Henry, Tim Farrar, and Eric
  Berger were the only stale ones. Confirms the flakiness is genuinely
  per-account/per-session, not correlated across a whole run.
- 2026-08-18-D: An EU sanctions story (SpaceNews's Aug 17 "New EU
  sanctions target leaders of Russia's space industry") traced to an
  Aug 7 EU Council action once fetched directly; chased under the
  standing predates-window convention and dated to Aug 7, corroborated
  by a Ukrainian mainstream outlet (eurointegration.com.ua/European
  Pravda) independently naming an overlapping but not identical subset
  of the five sanctioned individuals. First sanctions-category item on
  the site under the `sanctions` theme tag; reused the `russia`
  geography tag coined 2026-07-21-E.
- 2026-08-18-E: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 3 new, 1 updated, 0 held") plus a direct jq
  spot-check of all three new items' and the one updated item's
  `snr`/`category`/`impact` fields as the build-health signal.

## Normal-mode sweep, ~11h48m gap, unfiltered full source list (2026-08-18, second)

- 2026-08-18-F: All Points Logistics generates its own rehash trap: a same-day
  SatNews/Space Coast Daily "All Points Awarded NASA Spacecraft Processing and
  Operations Contract Which Builds on Recent 2026 Wins" release reads like new
  news but is the company's own recap of the Aug 17 Firefly/NASA SPOC on-ramp
  item (which already names All Points as one of four onboarded companies)
  layered with a mention of the separate, already-published July 29 $250M
  Vandenberg contract. Two distinct All Points stories already exist under
  other ids; a third-sounding "All Points" headline needs a company-name grep
  against items.json before drafting, not just a glance at the headline.
- 2026-08-18-G: A resurfaced Progress-Samara-strike article (Yahoo, republishing
  a Aug 15-dated piece) added a specific "onboard electronics assembly
  workshop... probably hit" / "Building 106A" claim attributed only to
  "satellite imagery of the strikes" with no named analyst, outlet, or
  organization performing the analysis. Left the already-published item
  (2026-08-15-ukraine-strikes-progress-rocket-samara) unpatched rather than
  add the specific building claim: an unattributed "satellite imagery shows X"
  line fails the same attribution bar as an anonymous rumour, even when the
  broader event is already confirmed and on-record.
- 2026-08-18-H: Two more small-dollar Intuitive Machines press releases this
  week are easy to mistake for the same story: an Aug 17 GlobeNewswire release
  ("Selected for Multi-Satellite Communications Infrastructure Program",
  $600M+, IM 1300 bus) is the formal wire announcement of the SAME
  undisclosed-customer GEO-comms contract already published Aug 13 from the
  Q2 earnings disclosure (same platform, same value, "confidential at the
  customer's request"), not a new item; a separate Aug 18 GlobeNewswire
  release (NASA JPL's EAGLE-VSWIR, IM 300 bus, no dollar figure) is genuinely
  new and unrelated. Same-company GlobeNewswire releases days apart need a
  side-by-side fact comparison (platform, value, customer-disclosure status),
  not just a distinct-sounding headline, before ruling one a rehash.
- 2026-08-18-I: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate on the first attempt,
  continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 0 updated, 0
  held") plus a direct grep spot-check of both new items' `snr`/`category`/
  `impact`/`snr_trace` fields as the build-health signal.

## Normal-mode sweep, ~11h44m gap, unfiltered full source list (2026-08-19)

- 2026-08-19-A: LandSpace's Zhuque-3 second flight (Aug 18) landed its
  booster on legs, China's first private-company orbital-booster recovery
  and the first in China on legs rather than net capture (CASC's Long
  March 10B used net capture in July). Scored it `seismic` on the direct
  precedent of the 2026-07-10 Long March 10B item (also a "second country/
  first for the entity" booster-recovery milestone, also led on a trade
  source, also landed at final SNR 4 via the same extraordinary-reset ->
  corroboration_2plus -> mainstream_pickup -> corroboration_4plus chain).
  No registry vehicle entry exists for Zhuque-3 (only Zhuque-2 and the
  LandSpace org profile do), so crossfeed was an honest empty block.
- 2026-08-19-B: SCMP (mainstream, fetched directly) and Space.com/
  NASASpaceflight/SpaceNews (trade, via harvester raw_excerpt) framed the
  Zhuque-3 landing two different ways that are both true and worth
  reconciling before drafting: "third entity after SpaceX and Blue Origin"
  counts only LEG landings, while "fourth entity after SpaceX, Blue
  Origin, and CASC" counts ANY controlled recovery method including CASC's
  net capture. Used the leg-landing framing as primary (matches the site's
  own July 10 CZ-10B item's framing) and folded the net-capture distinction
  into why_it_matters rather than picking one number and dropping the
  other.
- 2026-08-19-C: A trade outlet's follow-up write-up of an ALREADY-PUBLISHED
  contract award can still carry genuinely new, citable detail worth a
  patch even when the underlying award itself is stale: Rocket Lab's own
  Aug 18 release about its specific SDN implementation plan (Photon
  spacecraft, optical inter-satellite links, 2027 demo date) is new
  information layered onto the Aug 13 $60M multi-vendor SDN award already
  on the site; folded into the existing item's what_happened via
  `updates[].patch` rather than treated as a new item or ignored as a
  rehash. Same pattern applied to Via Satellite's L3Harris CEO-ouster
  follow-up (added Kubasik's 2012 Lockheed Martin dismissal for a similar
  conduct violation, a citable and genuinely new-to-the-item fact) even
  though that item was already at its SNR ceiling (first_party, 5) and the
  patch couldn't move the score.
- 2026-08-19-D: Confirms `hostMatches()` in finalize-sweep.ts does subdomain
  matching via `endsWith("."+base)`: a registry `website` value of
  `rocketlabcorp.com` should pass `investors.rocketlabcorp.com` as
  `first_party` per the code, but the URL 60-second-timed-out on WebFetch
  twice this run before a first-party fetch could be attempted; led with
  Via Satellite + SatNews (both trade) instead. Worth a retry next time a
  Rocket Lab IR-subdomain press release is needed and time allows.
- 2026-08-19-E: A same-company-plus-category dedup false positive fired
  between a brand-new Viasat/Rocket Lab PTS-G satellite-bus item (category
  contract) and the existing 2026-08-10 Kepler/Rocket Lab Neutron 2028
  launch-booking item (also category contract, also within 7 days),
  despite sharing no program, agency, or subject beyond the company name
  Rocket Lab. One `dedup_distinct` entry cleared it, extending the long
  running finding that this heuristic fires on any shared company
  regardless of relatedness.
- 2026-08-19-F: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate on the first attempt,
  continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 4 updated,
  0 held") plus a direct read of all seven touched items'
  `snr`/`category`/`impact` fields as the build-health signal.

## Normal-mode sweep, ~11h45m gap, unfiltered full source list (2026-08-19, third)

- 2026-08-19-G: A discovery-pass hit that reads as brand-new, week-old
  news (SatNews's Aug 13 "Private Consortium Allied Orbits Secures
  Approval to Build India's Rs1,200 Crore Commercial Satellite
  Constellation") can actually be over a YEAR stale, not just weeks:
  direct fetches of Dhruva Space's own press release and the Tribune's
  writeup both stated the IN-SPACe award actually happened August 13,
  **2025**, not 2026 -- SatNews (and possibly other outlets) republished
  or re-dated the story a year later with no "anniversary"/recap framing
  at all, reading exactly like fresh news. Left undrafted entirely.
  Extends the standing stale-resurfacing pattern (2026-07-20-C and many
  later entries) to a full-year gap; always check a fetched primary
  source's own stated date even when a trade aggregator's date looks
  current, especially for any story that reads as a "historic first."
- 2026-08-19-H: A "mysterious space activity" headline (Space.com's US
  Air Force Antarctica-flight-turnback story, also widely covered by
  CNN/Yahoo/local NZ outlets) traced via WebSearch to a Russian-issued
  NOTAM about a **missile launch**, not a satellite/debris hazard: New
  Zealand's CAA statement specifically named "a planned missile launch"
  as the hazard. Despite the "space activity" framing in headlines, this
  is a geopolitical/military story with no satellite operator, no
  debris-from-orbit claim, and no commercial-space angle stated anywhere
  -- left out of scope rather than drafted as an `incident`, distinct
  from genuine orbital-debris NOTAMs which would qualify.
- 2026-08-19-I: `applyModifier` in finalize-sweep.ts rejects a repeated
  `bump: "corroboration_2plus"` on an item that already carries that
  modifier ("already applied; modifiers saturate") -- attaching 2 MORE
  distinct sources (Ukrainska Pravda, UNN) to the already-3-source
  2026-08-15 Progress/Samara strike item needed `bump:
  "corroboration_4plus"` instead, which the gate accepted cleanly.
  Check an update target's current `snr_trace.modifiers` before picking
  a bump tier rather than assuming the lowest corroboration bump always
  applies.
- 2026-08-19-J: Ukraine's General Staff issuing its OWN follow-up
  statement naming a specific facility (RKTs Progress's Soyuz
  engine-assembly workshop, a 5,000 sq m fire) four days after an
  already-published strike item is a legitimate `updates[].patch`, unlike
  the 2026-08-18-G case it superficially resembles: the difference is
  attribution -- an unattributed "satellite imagery shows X" claim stays
  out, but a named government body's own on-the-record statement (here
  relayed by Ukrainska Pravda and UNN, both citing the General Staff
  directly) clears the same attribution bar as the original strike
  report.
- 2026-08-19-K: Two lunar-lander CLPS payload demo announcements (Firefly/
  Zeno Power's radioisotope heater unit) drafted cleanly at first_party
  base tier 5 (fireflyspace.com matches the registry's stored website
  exactly) with SpaceNews and Payload as independent trade corroboration
  -- Payload's own reporting added the CLPS "CS-8" task-order detail and
  a Firefly-exec quote not in the SpaceNews or Firefly copy, confirming
  independent (non-rewrite) coverage.
- 2026-08-19-L: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate on the first
  attempt, continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 1 updated,
  0 held") plus a direct jq spot-check of all three new items'
  `snr`/`category`/`impact` fields as the build-health signal.

## Normal-mode sweep, ~11h48m gap, unfiltered full source list (2026-08-20)

- 2026-08-20-A: A same-day scheduled-but-not-yet-flown launch (Rocket
  Lab's ninth Electron mission for iQPS, window opening ~8 hours after
  this sweep ran) was correctly left undrafted rather than written as a
  completed past-tense event; the "every on-scope launch publishes" rule
  (2026-07-12) covers launches that occurred, not previews of ones still
  scheduled. Caught a related trap while researching it: a WebFetch
  summary of the Launch Library record and a WebSearch synthesis both
  asserted today's payload was "QPS-SAR-13," which is actually the
  designation of the ALREADY-PUBLISHED Aug 6 satellite (`2026-08-06-
  rocket-lab-iqps-8th-launch`) -- Space.com's own verbatim raw_excerpt
  only confirmed the nickname "SUSANOO-II," never a QPS-SAR number for
  today's satellite. A WebFetch/WebSearch summary can silently carry
  over a numeric designation from adjacent context into a superficially
  similar new story; verbatim source text is the only thing to trust for
  a payload's exact designation.
- 2026-08-20-B: A same-day SES press release ("SES Expands into Global
  Direct-to-Device Services through Strategic Collaboration with Elveo
  Mobile," surfaced fresh via SES's own newsroom listing with no visible
  date on the top slot, same shape as 2026-08-16-F) was actually SES's
  Aug 17 release already fully folded into the existing Aug 14 Lynk/
  Omnispace/Elveo merger item -- that item's own `source_url` is the
  literal same SES release URL. Caught only by grepping "elveo" against
  items.json before drafting, per the standing company-name-grep
  practice (2026-07-23-J, 2026-08-15-A); a company newsroom's top listing
  slot with no date is not itself proof of a new, undrafted story.
- 2026-08-20-C: A SpaceNews "Landspace secures launch contracts for
  China's megaconstellation projects" headline surfaced by discovery-pass
  WebSearch reads fresh but a second search explicitly returned
  "according to reports from January 2026" for the same underlying fact
  (Zhuque-2E/Zhuque-3 selected for Guowang/Qianfan demonstration
  contracts); left undrafted as a stale resurfacing (extends
  2026-08-13-A/E/G, 2026-08-19-G) rather than chased, especially since
  the SpaceNews article itself 403'd on direct fetch and couldn't be
  dated independently.
- 2026-08-20-D: The standing same-company-plus-category dedup false
  positive (SpaceX + category `regulatory`) fired between a new India
  IN-SPACe Starlink Gen 2 reapplication and the existing Aug 13 Starlink
  Vietnam market-entry item, 7 days apart, sharing no country, agency, or
  subject beyond the company name -- cleared with one `dedup_distinct`
  entry, extending the long-running pattern to yet another country pair.
- 2026-08-20-E: A widely mirrored regulatory story (Starlink's India Gen
  2 reapplication) traced to a single underlying Economic Times report
  once multiple outlets were checked: BusinessToday, Investing.com (both
  explicitly "ET reports"), Moneycontrol, and a Reuters wire copy all
  carried identical facts and figures with no independent reporting
  found; Business Standard's own differently framed headline 403'd on
  direct fetch and couldn't be verified as genuinely independent, so it
  was left uncited per the standing "only cite pages with genuinely
  fetched content" rule. Landed a clean single-source `crawl:
  "found_none"` at SNR 2 (mainstream base tier 3, per CLAUDE.md's base-
  tier table -- mainstream and trade are both tier 3, not 4; press-wire
  copy and established aggregators are the tier-4 classes) rather than
  stack the ET-derived mirrors as fake corroboration.
- 2026-08-20-F: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 5 new, 1 updated, 0 held") plus a direct grep
  spot-check of all five new items' and the one updated item's
  `snr`/`category`/`impact` fields as the build-health signal.

## Normal-mode sweep, ~11h46m gap, unfiltered full source list (2026-08-20, second)

- 2026-08-20-G: A satellite-designation trap flagged the previous sweep
  (2026-08-20-A) recurred and was caught the same way: the harvester
  queue and every English trade write-up for Rocket Lab's 9th iQPS
  launch gave only the nickname "SUSANOO-II" or vague "latest QPS-SAR
  sat," and one WebSearch synthesis even said "QPS-SAR-9" (conflating
  9th-deployment-count with the satellite's own serial number). The
  correct designation, QPS-SAR-18, only turned up by fetching iQPS's own
  pre-launch release (i-qps.net) directly; classed as an unscored
  secondary link rather than first_party since iQPS has no registry
  entity (same workaround as Orbit Fab/ArkEdge/IHI/Kuva, 2026-07-21-H
  and earlier). rocketlabcorp.com's own mission-success update page
  403'd on direct fetch again (extends 2026-08-19-D); a StockTitan
  mirror of Rocket Lab's GlobeNewswire release supplied the confirmed
  success status and totals (93rd Electron, 14th of 2026, 9th for iQPS)
  instead.
- 2026-08-20-H: A press release's own dateline can be flatly wrong in a
  way worth catching before drafting: SpaceNews's "Draper Selects
  Proteus Space for Advanced On-Orbit Mission" (RSS-fed, published_at
  2026-08-20T10:00 UTC, matching the harvester's fetch window) opened
  with the literal dateline "LOS ANGELES, CA, September 8th, 2026" --
  seventeen days in the future from today. Treated as a template/copy-
  paste artifact in the source press release rather than evidence of a
  backdated or embargoed story; dated the item to the actual RSS publish
  date (Aug 20) and did not quote the erroneous September date in copy.
- 2026-08-20-I: SpaceSail's August 19 $1B/7-billion-yuan Series B close
  (South China Morning Post, record for China's satellite-internet
  sector) is a genuinely distinct financial event from the June 22
  "SpaceSail opens new fundraising round" item already on the site --
  59 days apart, well past both the 7-day update window and the 30-day
  reinforcement window -- but shares company (SpaceSail) and category
  (financial) with it, so it still tripped the standing same-company-
  plus-category dedup heuristic (2026-07-21-F and many later entries)
  and needed one `dedup_distinct` entry despite being unambiguously a
  different transaction (round opening vs. round closing, two months
  apart, different stated figures).
- 2026-08-20-J: A Federal Register regulatory notice and the issuing
  agency's own plain-English blog post announcing the same action on
  the same day (OSC's "Notice of Mission Authorization Pilot Program" /
  "OSC Releases SCC 'Call For Interest'") are both genuinely official
  record (space.commerce.gov is a `.gov` host, passes the fixed-list
  check cleanly) and worth citing together: the Federal Register text is
  the legally operative notice, but OSC's own post states the plainer
  facts (application deadline, which agencies participate, the "pathway
  to yes" framing) more usably for the copy. A same-day SpaceNews
  write-up ("Office of Space Commerce to move ahead on mission
  authorization") supplied the corroboration crawl's `found_some` even
  though both leads were already at the direct-source ceiling.
- 2026-08-20-K: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 8 new, 0 updated, 0 held") plus a direct grep
  spot-check of all eight new items' `snr`/`category`/`impact` fields as
  the build-health signal.

## Normal-mode sweep, ~11h49m gap, unfiltered full source list (2026-08-21)

- 2026-08-21-A: SWEEP_MEMORY 2026-08-05-A had flagged two SpaceX Golden
  Dome contracts (the $2.29B SDN Backbone award, May 26, and the $4.16B
  SB-AMTI award, May 29) as "never covered under any id... still open";
  a plain WebSearch for the Investing.com "SpaceX secures over $8
  billion in Golden Dome contracts" queue hit traced straight back to
  these same two never-drafted May awards. Chased both, each dated to
  its actual award date, each needing a `dedup_distinct` entry against
  the other (same company, same category, 3 days apart, genuinely
  different programs). A flagged-but-unchased gap noted in this file is
  worth a company-name/dollar-figure grep against items.json on a later
  sweep, not just a one-time flag; it stayed unchased for over two weeks
  of sweeps until today.
- 2026-08-21-B: Amazon's $11.6 billion Globalstar acquisition
  (announced April 14, 2026, per Amazon's own press.aboutamazon.com
  release) was NEVER covered under its own id despite being referenced
  as background context in two later items (the July 24 Amazon Leo D2D
  FCC filing, and in passing elsewhere) -- grepped items.json for
  "11.6 billion"/"Globalstar acquisition" and found only the context
  mentions, no dedicated card. A seismic-tier M&A between two tracked
  operators is exactly the kind of gap worth a deliberate items.json
  grep (not just an `existing[]` skim) whenever a company's own site or
  a discovery-pass hit references a big prior deal only in passing --
  the reference itself is a signal the underlying event may never have
  been drafted.
- 2026-08-21-C: Vivienne Machi's Aviation Week author-page listing
  (aviationweek.com/author/vivienne-machi, a signals-context fetchable
  channel) surfaced two NRO commercial-sensing contract stories
  (HawkEye 360 CRFCA, Aug 17; Capella/ICEYE US/Umbra RCA, dated Aug 21
  feature but reporting an Aug 5 award) that both read as fresh but
  traced via items.json headline grep to already-published items
  ("HawkEye 360 wins NRO's first operational commercial RF contract",
  "NRO awards Capella, ICEYE and Umbra new commercial radar-imagery
  contracts") -- a later sweep had independently resolved the exact gap
  2026-08-17-G flagged as unverifiable. Confirms grepping items.json
  headlines for the actor+program name before drafting a
  signals-surfaced story is cheap insurance even when the source finally
  fetches cleanly after a prior sweep couldn't reach it.
- 2026-08-21-D: A competitive spectrum-bidding process (SpaceX and AST
  SpaceMobile named among "companies that have expressed interest" in
  Grain Management's $6B-asking 800MHz licenses, preliminary offers due
  first week of September) is a "process not yet fact" exclusion, same
  standard as the T-Mobile/Sateliot pattern: no confirmed bid amount
  attributed to either company specifically, just an asking price and a
  deadline. Similarly, Gov. Landry's SpaceX Louisiana spaceport deal was
  reported as scheduled for announcement Aug. 25, five days after this
  sweep -- left undrafted as not-yet-occurred rather than written in the
  past tense, consistent with the standing "don't draft a scheduled
  event before it happens" rule for launches, extended here to a
  political announcement event.
- 2026-08-21-E: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate on the first
  attempt, continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 5 new, 0
  updated, 0 held") plus a direct jq spot-check of all five new items'
  `snr`/`category`/`impact`/`snr_trace` fields as the build-health
  signal.

## Normal-mode sweep, ~11h46m gap, unfiltered full source list (2026-08-21, second)

- 2026-08-21-F: A state defense institute's first-ever test flight of a
  "satellite launch vehicle" prototype that self-destructs after a
  trajectory deviation (Taiwan's NCSIST, Jiupeng Base, Aug 19) is out of
  scope even though press coverage calls it a satellite launch vehicle:
  the pre-test notice's own danger-zone parameters (100,000 ft max
  altitude, 20nm radius) confirm it was a suborbital test, and CLAUDE.md's
  launch-vehicle scope is explicitly orbital-only (same standing exclusion
  as Gravitilab's suborbital hybrid rockets, 2026-08-14-B). Also a state
  weapons-development institute, not a commercial launch provider. Worth
  flagging for Florian if a defense institute's *eventual-orbital* SLV
  program should be tracked differently from a routine suborbital test.
- 2026-08-21-G: An India Today headline read via Google News RSS
  ("Isro will not make any launch vehicle, all tech to be handed to
  private sector") could not be fetched at all this run (Claude Code's
  WebFetch tool refused indiatoday.in outright, and the Google News
  redirect resolved to a bare "Google News" header with no content,
  extending the standing redirect-failure pattern). A WebSearch for the
  claim only surfaced ISRO's already-known, already-published LVM3
  tech-transfer and PSLV-privatization threads (2025-vintage and
  mid-2026 announcements), no distinct new fact; left undrafted rather
  than guess whether the headline states something genuinely new.
- 2026-08-21-H: An FT-sourced story on Trump declining to press Musk to
  extend Starlink for Ukrainian long-range strikes into Russia (widely
  mirrored, Kyiv Post among others) was judged out of scope as
  conflict/operational-use analysis rather than a commercial-service
  fact, even though a government figure is on the record: the actual
  news content is about battlefield strike-targeting capability
  (dwindling Patriot interceptors, precision targeting), not a stated
  service change, sanction, or export-control notice. Distinct from the
  2026-08-16-A Progress/Samara manufacturing-strike precedent, which
  reported facility damage without touching operational use of any space
  asset; this story's entire premise IS operational use. Flag for
  Florian if the "government statement directly concerning commercial
  space services in a conflict" carve-out was meant to reach this far.
- 2026-08-21-I: Vivienne Machi's Aviation Week author-page listing
  surfaced a same-day headline ("NRO Takes Commercial SAR Partnerships
  To New Operational Level," Aug 21) that could not be verified: a
  guessed article URL 404'd, and a WebSearch found only a 2019 article
  with the identical title plus the already-published Aug 5 NRO/Capella/
  ICEYE/Umbra RCA contract-award coverage. Left undrafted per the
  standing "only cite pages with genuinely fetched content" rule;
  extends 2026-08-17-G's identical trap (an author-listing headline is
  not proof of a fresh, distinct story) to a case where the exact title
  also collides with a 7-year-old unrelated article.
- 2026-08-21-J: Both `bun run build` and `bun scripts/check-feed.ts`
  were denied outright by this session's permission gate on the first
  attempt, continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 1
  updated, 0 held") plus a direct read of both new items' and the one
  updated item's `snr`/`category`/`impact`/`snr_trace` fields as the
  build-health signal.
