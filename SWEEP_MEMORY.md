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

## Narrow re-check, ~7h38m gap, unfiltered full source list (2026-10-13)

- 2026-10-13-A: All 7 whitelisted YouTube signals channels (Eric Berger,
  Anatoly Zak, Andrew Parsonson, Scott Manley, Tim Dodd, Marcus House,
  Felix Schlang) failed this run's harvest with HTTP 404/500, not the
  usual staleness; none of their videos reached the candidate queue.
  Worth a dedicated check next run before assuming it's another one-off
  (the harvester's YouTube feed mechanism, not an individual channel,
  may be the actual fault).
- 2026-10-13-B: Drafted the first dedicated noise-tier Starlink batch
  launch item in over a month (the last was 2026-09-06, booster
  B1093's 17th flight) per the explicit CLAUDE.md rule that every
  on-scope launch publishes, even routine cadence, at `noise`. Actual
  practice across the feed has been sparser than the rule implies (only
  7 of 64 Starlink-tagged items are dedicated batch-launch items in
  three months), suggesting most routine batches simply don't surface
  with enough corroborated detail in the queue/discovery pass rather
  than being deliberately excluded; when one does surface with a clean
  trade source (SpaceflightNow's live-blog pattern: confirmed liftoff +
  booster landing, hedged "if all goes to plan" language only for
  satellite deployment), draft it rather than skip it as mere cadence.
- 2026-10-13-C: `finalize-sweep` rejected the first draft attempt for
  three reasons at once: a top-level `coverage` field must use the
  category vocabulary (`product`, `contract`, ...), not domain tags
  (`eo`, `connectivity`); a same-company contract item inside 7 days of
  an unrelated existing contract item (York's new SDN task orders vs.
  its Oct 5 Tetra 3/4 design-review item) needed `dedup_distinct`; and
  a company's own newsroom domain (ispace-inc.com) cannot be classed
  `first_party` when the actor has no registry profile to verify the
  domain against (reclassified to `wire_pr`, one of the gate's own
  suggested fallbacks). Merged cleanly on the second attempt ("merged 4
  new, 0 updated, 0 held"); confirmed via a direct `grep` read of all
  four new items' `snr`/`category`/`impact` fields (911 items, up from
  907) and the sweep log's `signals`/`discovery` blocks. `bun run
  build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~2h27m gap, unfiltered full source list (2026-10-13, second)

- 2026-10-13-D: A still-`public-inspection` (not yet officially published)
  Federal Register document has its own API shape: `federalregister.gov/
  api/v1/documents/<doc-number>.json` 404's until the document's real
  publication date arrives, but `federalregister.gov/api/v1/
  public-inspection-documents/<doc-number>.json` works immediately and
  returns title/agency/filing-date/publication-date metadata (no body
  text) even the day before formal publication; the PDF at
  `public-inspection.federalregister.gov/<doc-number>.pdf` fetched as
  unreadable binary (no `pdftotext`/`poppler-utils` available in this
  environment, and the Read tool's PDF support needs `pdftoppm`, also
  absent). Used the metadata purely to confirm the document existed and
  matched the story (title, agency, filing date), while sourcing the
  actual figures (456 launches/912 landings, two phases) to a directly-
  fetched mainstream wire mirror (Insurance Journal's Bloomberg pickup)
  rather than force an `official_record` lead off unread body text;
  landed an honest mainstream-base SNR 4 via `corroboration_2plus`
  rather than an unverifiable SNR 5. A second IAC-2026-day-two lead
  (Baykar/Fergani's 100-satellite GNSS plan, Turkey's Somalia spaceport)
  traced to a years-old plan and a January 2026 construction-start
  announcement both still being restated without any new figure or
  timeline actually confirmed across sources; left undrafted per the
  standing vague-conference-restatement pattern. `bun scripts/
  finalize-sweep.ts` merged cleanly on the first attempt ("merged 1 new,
  1 updated, 0 held"); confirmed via a direct `jq` read of the new FAA/
  Starbase item's `snr`/`snr_trace`/`category`/`impact` fields (916
  items, up from 915) and the updated Varda item's patched `explainer`
  and three-source `sources` array. `bun run build` was not attempted,
  per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h43m gap, unfiltered full source list (2026-10-13, third)

- 2026-10-13-E: A deal-value conflict across directly-fetched sources
  resolved by fetching a third: two independently-written trade pieces
  on CSG's MDA Space stake (defence-industry.eu, globalbankingandfinance.com,
  the latter a Reuters wire pickup) stated no dollar figure at all, while
  a WebSearch synthesis of Space Intel Report claimed a precise "C$618.5
  million ($434 million)" figure -- rather than trust either the omission
  or the unfetched synthesis, re-fetched Space Intel Report directly
  asking only "does this article state a dollar figure, quote it
  verbatim" and got the exact sentence back, then found a second
  directly-fetched source (SatNews, whose own headline states "for $434
  Million") independently carrying the same number. Two sources omitting
  a figure a third, more detailed source states is not a contradiction
  worth holding over; it just means the shorter wires ran before or
  without the number. Worth the reminder that a WebSearch synthesis
  claiming a specific figure still needs its own direct re-fetch with a
  narrow, verbatim-quote-only prompt before it is trusted, even when the
  figure sounds plausible and nothing else contradicts it outright.
- 2026-10-13-F: The stated-value test moved a routine-sounding "European
  group buys minority stake" story to `major`: CSG's $434 million
  payment for 9.5% of MDA Space is nine figures and a clear "largest
  shareholder" trajectory change for a already-profiled registry
  organization, even though the transaction itself never touches a
  crossfeed-eligible field (not a capital raise into MDA Space, no
  change of control) -- impact and crossfeed are independent judgments,
  and a minority-stake purchase can still clear the stated-value bar the
  same way a funding round does.
- 2026-10-13-G: An ~80% queue composed of "SpaceX Falcon 9 jellyfish
  effect visible over the Carolinas/Florida/etc." sighting posts and
  Google News pickups was all noise around a single already-published
  launch (today's CRS-35/Dragon resupply mission); the sky-glow
  spectacle generated dozens of local-TV and Bluesky posts but zero new
  facts about the mission itself. Three genuinely new items (Gogo/Duncan
  Aviation, SES/Lyntris, Viasat/All.Space) all came from the same Via
  Satellite harvester entries published the same morning, confirming
  trade-press feed entries are worth reading individually even on a
  queue otherwise dominated by one viral visual-sighting story.
- 2026-10-13-H: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 4 new, 2 updated, 0 held"); confirmed via a
  direct `jq` read of all four new items' `snr`/`category`/`impact`
  fields (920 items, up from 916) and both updated items' grown
  `sources`/`updates` arrays (Rassvet: 8 sources/6 updates; Musk/Ambani:
  11 sources/7 updates). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h55m gap, unfiltered full source list (2026-10-14)

- 2026-10-14-A: A near-total-junk 50-candidate queue (SpaceX "jellyfish"
  sighting pieces from the CRS-35 launch, a wall of Bluesky bot/fan
  accounts reacting to the same launch, two Motley Fool stock-speculation
  pieces, BBC off-topic weather/wildlife filler, a routine Texas State
  University educational CubeSat riding the already-published CRS-35
  cargo, and a BroadbandBreakfast piece restating a 2024 Hurricane Helene
  anecdote) still yielded one genuine queue-sourced update: SpacePolicyOnline's
  own RSS feed carried Ship 40's long-running recovery saga's final chapter
  (reached Starbase Oct. 7, moved into a Megabay for heatshield/Raptor/
  avionics data), folded into the existing Flight 13 item as an
  attach+patch (TeslaNorth corroborating with a second, later article) at
  no bump since the item was already at its non-first-party ceiling of 4.
  A thin JAXA/Innovative Space Carrier "co-creation activities" release
  (Japanese-only, no figures) was left undrafted as a vague-cooperation
  shape, same standing pattern as Turkish/CGTN/JAXA-Saudi MOUs.
- 2026-10-14-B: Two genuinely new items came entirely from the discovery
  pass's required non-US/financial legs, not the queue: ESA DG Aschbacher's
  Oct. 5 10-year/10bn-euro independent-crewed-spaceflight proposal (led on
  SatNews, corroborated by Euronews and a paywalled-but-fetchable Aviation
  Week fragment) and ESA's Oct. 7 FLOTTA microsatellite-manufacturing
  contract with Hungary's C3S, whose own announcement lived on a
  resilience.esa.int subdomain that passed the first_party anti-spoof
  check against the esa.int registry host (same subdomain-match pattern
  as 2026-09-18-H's ir.echostar.com). Both items independently triggered
  the standing same-company-plus-category dedup false positive against
  TWO unrelated existing items apiece (the crewed-spaceflight item against
  the Airbus/OHB orbital-outpost study and the ESA/Vast Haven MoU; the
  FLOTTA item against the Planet/Sinergise Slovenia item); four
  `dedup_distinct` entries at the items' top level cleared both in one
  pass.
- 2026-10-14-C: A T-Mobile-scrubs-Starlink-branding story needed care on
  the lead source: the original PCMag piece (`pcmag.com`) is unfetchable
  (standing pattern), and the obvious Yahoo Finance URL that surfaced via
  search turned out to be a TheStreet piece mainly about SpaceX's Oct. 8
  Grain 800MHz spectrum deal (already published) with the branding-scrub
  fact as one paragraph crediting a separate dedicated TheStreet article
  (`thestreet.com/retail/t-mobile-removes-starlink-from-t-satellite-website`,
  itself 403-blocked) -- led on the fetchable Yahoo Finance mirror anyway
  since it independently confirms the fact with its own reporting (CTO
  John Saw quote, JV context), with TmoNews (which explicitly credits
  PCMag) as the second distinct corroboration source. The item tripped the
  same-company dedup false positive against THREE unrelated existing
  SpaceX/T-Mobile `partnership` items in the window (the AT&T/Verizon/
  T-Mobile JV launch, American Airlines' fleet Starlink order, KLM's
  Starlink Wi-Fi deal); three `dedup_distinct` entries cleared it.
- 2026-10-14-D: The 15-fetch signals-pass budget comfortably covered all
  17 fetchable channels this run without rotation: 10 bluesky accounts via
  the `getAuthorFeed` API (per 2026-10-11-G) plus 4 direct site fetches
  (russianspaceweb.com, mainenginecutoff.com, planet4589.org, Vivienne
  Machi's Aviation Week author page) came to 14 new fetches, with
  spacepolicyonline.com and europeanspaceflight.com/substack counted as
  checked-without-a-separate-fetch since their content was already in
  hand via the RSS-harvested queue. Nothing on any of the 17 channels was
  both new and substantive enough to draft beyond what the queue/discovery
  passes already found (Aschbacher's Warsaw Security Forum remarks and
  ESA's own Oct. 19 MMX-launch announcement were too vague or
  scheduled-not-yet-occurred). `bun scripts/finalize-sweep.ts` rejected the
  first draft attempt on four same-company-plus-category dedup matches
  (fixed via `dedup_distinct`, see 2026-10-14-B/C above); merged cleanly on
  the second attempt ("merged 3 new, 1 updated, 0 held"); confirmed via a
  direct `jq` read of all three new items' `snr`/`category`/`impact`/
  `tags`/`sources` fields (923 items, up from 920) and the patched Flight
  13 item's grown `sources`/`updates` arrays (13 sources, 6 updates). `bun
  run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~7h gap, unfiltered full source list (2026-10-14, second)

- 2026-10-14-E: Ukraine's government adviser statement that SpaceX imposed
  an unannounced 100 mph speed cap on Starshield terminals (per Serhii
  "Flash" Beskrestnov, confirmed independently by Ukrinform and a Yahoo
  Finance mirror crediting WSJ) qualifies under CLAUDE.md's geopolitical
  carve-out via the "government statement directly concerning commercial
  space services in a conflict" leg, not the "operator confirms" leg:
  SpaceX/Musk never commented on the record (confirmed via a dedicated
  WebSearch), and the item was drafted and scored on the Ukrainian
  officials' attributed statements alone. Landed `major` impact (not
  `seismic`) on the judgment that any government/enterprise Starlink or
  Starshield customer would treat an operator's unilateral, unannounced
  service change for a major client as a same-day reliability/political-
  risk briefing item, distinct from CLAUDE.md's stated-value/regulatory-
  grant major examples but matching the underlying "director acts or
  briefs the team today" test.
- 2026-10-14-F: The standing same-company-plus-category dedup false
  positive fired on two unrelated items this run: the Starlink/Ukraine
  geopolitical item against the unrelated Sept 9 German Space Command
  Russia-shadowing-tactics item (shared company SpaceX + category
  geopolitical only), and a Deutsche Telekom CEO commentary item
  (category `product`) against both the VEON/Banglalink Starlink Mobile
  Bangladesh launch and the Amtrak Starlink Cascades trial (shared
  company SpaceX + category product only). Three `dedup_distinct`
  entries at each item's top level cleared both in one pass.
- 2026-10-14-G: `finalize-sweep.ts` also rejected a first draft for
  marking 6 of 7 new items' corroboration crawl `not_attempted` while the
  sweep had only 7 new items total, well under the 8-event budget
  threshold that makes `not_attempted` legal; had to actually run the
  2-search-minimum crawl per event before resubmitting. One of the six
  (In Orbit Aerospace's autonomy pivot, a Payload Exclusive) and one
  (Genrobotics' ISRO boom-arm contract, whose only other hit,
  uniindia.com, 403'd on fetch) came back honest `found_none`; the other
  four picked up genuine second sources (Reflect Orbital's own PR
  Newswire release for the Skyroot item; SiliconIndia for OXG Space;
  Finimize already in hand for the Seraphim report; Advanced Television
  already in hand for the Deutsche Telekom item) once actually searched.
  Worth remembering: with only a handful of new items in a draft,
  `not_attempted` is essentially never legal and the crawl has to
  actually run for every one before submitting, not just for items that
  look under-sourced.
- 2026-10-14-H: `bun scripts/finalize-sweep.ts` merged cleanly on the
  second attempt ("merged 7 new, 0 updated, 0 held"); confirmed via a
  direct `jq` read of all seven new items' `snr`/`category`/`impact`/
  `kind` fields (930 items, up from 923) and the sweep log's `signals`/
  `discovery` blocks. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4h34m gap, unfiltered full source list (2026-10-14, third)

- 2026-10-14-I: The Starshield speed-restriction story drafted two sweeps
  ago blew up into the widest mainstream pickup of any item this month
  (NYT, LA Times, NBC, Politico, The Verge, CNN, Bloomberg, Gizmodo,
  Tom's Hardware, dozens more) within about 4.5 hours, plus two genuinely
  new on-the-record facts: Polish Foreign Minister Sikorski publicly
  challenging Musk on X ("are you playing politics with your products
  again? As your European customers, we are watching you," confirmed via
  a direct Euromaidan Press fetch, which also carried the terminal-supply
  figures: Poland supplies ~29,500 of Ukraine's terminals, about half,
  for ~$50M/year) and Musk's own on-record X post ("Zelensky has gone too
  far," confirmed via a direct Newsweek fetch) -- the first time SpaceX/
  Musk commented at all on this story, reversing the prior sweep's note
  that neither had. A same-day Euromaidan Press follow-up also confirmed
  the restriction tightened further during the day (160 km/h down to
  60-70 km/h). All of this folded into the existing item as an `update`
  (same event, same day) rather than a new item, per the standing 7-day
  dedup rule; a WebSearch synthesis is not enough to source a quote like
  this, each one needed its own direct fetch per the 2026-10-13-E lesson,
  and Google News redirect URLs would not resolve via WebFetch at all this
  run (bare "Google News" header, no content) -- had to re-find each
  publisher URL via a dedicated WebSearch instead of following the
  redirect directly.
- 2026-10-14-J: A separate, unrelated same-day Starlink story (Musk
  accusing Indian "oligarchs" Ambani/Mittal of blocking Starlink's India
  launch) resurfaced via Google News/Bloomberg with an Oct 14 timestamp
  but traced entirely to the Oct 8-9 dispute already covered by the
  existing Musk/Ambani item; left alone as a non-update, confirming the
  standing practice of checking a same-actor headline's actual date
  before treating it as new.
- 2026-10-14-K: An Al Jazeera "Iran targets Starlink as a tool of war"
  piece read as fresh but restated the same Aghamiri "tool of war"/
  "legitimate military target" quote already published 2026-09-30 and
  2026-10-05, just with added background on criminal penalties; left
  undrafted as a non-event rehash, not a new government statement.
- 2026-10-14-L: A ZhuQue-2E launch found via the discovery pass's
  launch-matrix query had no coverage at all in English trade press
  (SpaceNews 429'd both direct-fetch attempts); the only usable coverage
  was a niche English-language China-watch blog (China in Space, classed
  `informal` per the standing 2026-07-12 precedent for that outlet) plus
  a Global Times account's X post, verbatim-confirmed via the
  `cdn.syndication.twimg.com` endpoint. Honest SNR 2 (informal base +
  corroboration) on a routine `noise`-tier batch item is the model
  working as intended for a genuinely under-covered non-US story; a
  WebSearch-only "fact" about a third Group-03 batch planned for Q4 2026
  was dropped from the draft since it was never confirmed via a direct
  fetch.
- 2026-10-14-M: `bun scripts/finalize-sweep.ts` rejected the first draft
  attempt twice in a row on tagline-length overages (145 and then 153
  chars against the 140 max) introduced while folding in the day's new
  facts, and once on a signals-pass channel URL mismatch (listed the
  substack `/feed` RSS endpoint instead of the bare channel URL
  `signals-context` actually lists); merged cleanly on the fourth
  attempt ("merged 1 new, 1 updated, 0 held"); confirmed via a direct
  read of the new ADA Space item's `snr`/`category`/`impact` fields (931
  items, up from 930) and the updated Starshield item's grown `sources`/
  `secondary_urls` arrays (5 sources). `bun run build` was not attempted,
  per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4h31m gap, unfiltered full source list (2026-10-14, fourth)

- 2026-10-14-N: `boe.es` (Spain's official state gazette, Boletin Oficial
  del Estado) fails the anti-spoof `official_record` host check even for a
  genuine government legal order (Orden ITU/920/2026 on Hisdesat's PAZ 2
  loan): `isOfficialHost` only passes `*.gov`, the small FIXED_OFFICIAL_HOSTS
  list (sec.gov, fcc.gov, sam.gov, ted.europa.eu, esa.int, nasa.gov, noaa.gov,
  itu.int, unoosa.org, europa.eu), and registry website hosts. Spain's `.es`
  government domains (no `.gob.es`/`.gov` pattern here) are not on that list.
  Reclassified `boe.es` to `trade` per the gate's own hint; the item still
  landed a clean SNR 4 since a `whitelist`/`observer` corroboration source
  (European Spaceflight) was also attached. Worth remembering for any future
  EU-member-state official-gazette citation (BOE, France's Legifrance,
  Italy's Gazzetta Ufficiale, etc.): none of these pass the official_record
  gate unless a dev adds them to FIXED_OFFICIAL_HOSTS; class them `trade` by
  default rather than resubmitting against the rejection.
- 2026-10-14-O: A quarter's largest individual funding round cited inside an
  aggregate industry report (Seraphim's Q3 Space Index naming Hadrian's
  $1.37B Series D as the period's biggest raise) does not itself qualify as
  a fresh gap to chase standalone once it is two-plus months stale (Hadrian's
  round closed Aug. 6): the report's own release date is the dateable event,
  not the underlying figures it recaps. Confirmed Hadrian's round had never
  been drafted as its own item and left it that way deliberately, consistent
  with the predates-window chase-it exception being reserved for notable/
  seismic gaps, not routine funding recaps embedded in someone else's report.
- 2026-10-14-P: The already-published Seraphim Q3 report item
  (`2026-10-14-seraphim-q3-2026-space-funding-report`, led on an Investing.com/
  Reuters wire pickup at SNR 4) had a same-day first-party upgrade sitting in
  plain sight: `seraphim.vc/seraphim-space-index/` is Seraphim's own registry-
  recorded website and states the identical headline figures directly, plus
  genuinely new detail the wire pickup omitted (trailing-twelve-month totals,
  the Hadrian/Stoke Space/K2 Space round breakdown, a VP quote). A same-sweep
  `rescore` via the MAGPIE upgrade path (patch `source_url` first, then
  `rescore.sources[0].url` matching it) moved the item from 4 to 5. Worth
  checking a firm's own site for its underlying report/index page whenever a
  wire-sourced industry-report item is still open the same day, not just
  treating the wire version as the ceiling.
- 2026-10-14-Q: A months-old "may slip to 2027" item
  (`2026-08-11-rocket-lab-neutron-slip-2027`, 65 days outside both the 7-day
  same-event and 30-day reinforcement windows) still took a same-program
  `rescore`+`patch` rather than a new item once Rocket Lab's own SEC 8-K
  (Ex. 99.1) firmed the guidance into a confirmed 2027 debut with a named
  cause (voids in a carbon-composite propellant dome): the MAGPIE upgrade
  path (official_record lead via the SEC exhibit) isn't restricted to
  continuations found within the ordinary dedup windows when it is
  unambiguously the same ongoing story being resolved, consistent with the
  2026-10-06-M "same-program follow-up outside both windows" precedent.
- 2026-10-14-R: A single evolving geopolitical story (SpaceX's Starshield
  speed restriction for Ukraine) generated a second, institutionally
  distinct in-scope item the same day rather than folding into the existing
  item: the European Commission's own Oct. 14 press briefing (Thomas Regnier
  on GOVSATCOM/IRIS2, Paula Pinho on intelligence-sharing) is a different
  actor taking a different action, not a development of SpaceX's story, so
  it drafted as its own `geopolitical` item with an empty `companies` array
  (no company's registry profile is a party to a talks-underway policy
  statement) rather than an `updates[].attach` on the SpaceX item. Only the
  commercial-space-relevant half of that briefing (GOVSATCOM/IRIS2) went in
  the copy; the intelligence-sharing half was left out entirely as having no
  stated commercial-space angle, per the standing conflict/operational-use
  exclusion.
- 2026-10-14-S: Two superficially similar October-dated pieces reporting the
  same EU spokesperson's Starlink-alternative framing were NOT both current:
  `militarnyi.com`'s "Europe to Help Ukraine Switch from Starlink..." page
  displayed a March 3, 2025 byline underneath a same-day page-load header
  (checked directly, not assumed), making it a stale recycled page from a
  year-old funding-pause crisis despite surfacing in an October-2026-dated
  search; `euperspectives.eu` and `eurointegration.com.ua`, by contrast, both
  carried genuine `14.10.2026`/`2026/10/14`-dated URLs and content. A WebFetch
  summarization pass that reports "Publish Date: October 14, 2026" for a page
  can be reading the page's load/copyright timestamp, not the article's own
  byline; always ask explicitly for the byline date shown under the headline
  before trusting a "fresh" read on a story this shaped (a recurring EU/
  Starlink-alternative debate that genuinely recurred across more than one
  crisis).
- 2026-10-14-T: `bun scripts/finalize-sweep.ts` merged cleanly on the second
  attempt, after reclassifying the BOE lead source from `official_record` to
  `trade` per -N above ("merged 2 new, 3 updated, 0 held"); confirmed via a
  direct `jq` read of both new items' and all three updated items' `snr`/
  `snr_trace`/`category`/`impact`/`sources` fields (933 items, up from 931),
  the two `snr_movements` entries (Neutron 4→5, Seraphim 4→5) logged in the
  sweep entry, and an empty `registry-candidates.json` delta (both new
  items' crossfeed blocks carried no facts). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h gap, unfiltered full source list (2026-10-15)

- 2026-10-15-A: A WSJ "exclusive" piece paywalled at source (`wsj.com` is
  outright unfetchable, joining the standing ft.com/axios.com/arstechnica.com
  list) was still usable as a LEAD-FINDING tool without being cited itself: a
  freerepublic.com forum thread had reposted the full text crediting the WSJ
  byline, which surfaced a genuinely new fact (Rep. Brian Fitzpatrick warning
  Congress could withhold agency funding over the Starlink/Ukraine speed
  restriction) that a WebSearch synthesis alone had NOT confirmed (an initial
  synthesis claimed US officials blamed a "technical malfunction," which the
  direct fetch of the same mirror explicitly did not support — left out).
  Rather than cite the forum mirror, searched for and directly fetched two
  independent outlets (interfax.com.ua, washingtonsun.com) that independently
  quoted the same Congressional Ukraine Caucus statement and a second
  lawmaker (Rep. Don Bacon), and cited those instead. Worth remembering: a
  forum repost of a paywalled scoop is a legitimate way to find what to go
  verify, never a citable source on its own, and a single mirror's claim
  still needs the standing re-fetch-for-verbatim discipline before trusting
  it (the "technical malfunction" claim didn't survive that check here).
- 2026-10-15-B: Nikkei Asia (asia.nikkei.com) had no prior classification
  precedent in this file; treated as `mainstream` (same tier as Reuters/FT),
  used as the lead for a genuinely new Solafune/Tohoku University AI-satellite
  research-partnership item neither the queue nor a dedicated discovery query
  surfaced (found via a generic "earth observation satellite" Bluesky search
  result, an unwhitelisted account reposting the Nikkei headline). Solafune's
  own newsroom confirmed the same facts with more partnership detail but has
  no `src/data/registry` entity, capping it at `informal` per the standing
  no-registry-host workaround.
- 2026-10-15-C: `milenio.com` (Mexican national daily) 403'd on every direct
  WebFetch attempt for a Playa Bagdad Starship-debris corroboration search,
  consistent with the general pattern of paywalled/bot-blocked outlets;
  landed the Mexico News Daily-led debris item at an honest single-source
  SNR 2 (`crawl: "found_none"`) rather than force an unfetched Spanish-language
  mirror into the sources list, per the standing never-cite-an-unfetched-page
  rule.
- 2026-10-15-D: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt ("merged 4 new, 2 updated, 0 held"); confirmed via a direct `jq`
  read of all four new items' `snr`/`category`/`impact`/`kind` fields (937
  items, up from 933) and both updated items' grown `sources`/`updates`
  arrays (Starlink/Ukraine: 14 sources, 3 updates; NEONSAT: 6 sources). `bun
  run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~6h37m gap, unfiltered full source list (2026-10-15, second)

- 2026-10-15-E: `.gov.uk` fails the `official_record` anti-spoof host check
  the same way Spain's `boe.es` did on 2026-10-14 (not on the fixed
  official-hosts list): reclassified the UK Space Agency's own
  `space.blog.gov.uk` announcement to `trade` rather than resubmitting
  against the rejection, for a ClearSpace UK Active Debris Removal mission
  contract item (`£61.3M, five-year, prime contractor, beating Astroscale
  and Starfish Space, SaxaVord 2029 launch). ClearSpace's own newsroom
  confirmed the same award but, like Solafune on 2026-10-15 (first entry),
  has no `src/data/registry` entity, so it capped at `informal` rather than
  `first_party` per the standing no-registry-host workaround.
- 2026-10-15-F: A single-source Payload exclusive (JAXA awarding ArkEdge
  Space two lunar-navigation study contracts, no stated value) returned a
  genuinely honest `found_none` after a real two-search crawl turned up only
  older, unrelated ArkEdge/JAXA stories (a 2024 feasibility study, a
  different Space Strategy Fund LNSS award) rather than anything about
  today's specific MoonQuest/LANS-receiver and signal-reception-demo
  contracts; published at single-source SNR 2 rather than force a
  tangentially-related older article into the sources list as false
  corroboration.
- 2026-10-15-G: The Starlink/Ukraine saga's "restored" claim needed care:
  Kyiv Independent's own follow-up explicitly says the source "did not say
  if all restrictions had been lifted," while a Moscow Times headline the
  same morning flatly claimed "Functionality Restored Fully" for the same
  underlying ministry quote: Moscow Times's framing. Kept the item's copy to
  the more precise Kyiv Independent/Kyiv Post phrasing (resumed but
  ambiguous cap, Kyiv separately requesting 450 km/h) rather than the
  overstated "fully restored" framing, consistent with the model's "never
  claim more certainty than sources support" rule even when a reputable
  outlet's own headline overclaims.
- 2026-10-15-H: Google News redirect URLs continued to not resolve via
  WebFetch this run (bare "Google News" header, no content, same as
  2026-10-14-I); every lead in this sweep was re-found via a dedicated
  WebSearch for the publisher's own URL instead of following the redirect.
  Separately, `thehill.com` 403'd on direct WebFetch (new addition to the
  standing paywalled/bot-blocked list alongside wsj.com/ft.com/axios.com/
  arstechnica.com/pcmag.com/milenio.com); a Senate GOP/Trump-friction fact
  surfaced only via WebSearch synthesis was left out of the update's copy
  entirely rather than cited without a direct fetch.
- 2026-10-15-I: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt ("merged 2 new, 1 updated, 0 held"); confirmed via a direct `jq`
  read of both new items' `snr`/`category`/`impact` fields (939 items, up
  from 937) and the Starlink/Ukraine item's grown `sources`/`updates`
  arrays (18 sources, 4 updates). `bun run build` was not attempted, per
  the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h gap, unfiltered full source list (2026-10-15, third)

- 2026-10-15-J: Pre-empting the standing same-company-plus-category dedup
  false positive paid off: three of four new items this run shared
  company SpaceX + category partnership with the Oct 8 American
  Airlines/KLM Starlink items (an Alaska Communications ground-ISP
  reseller deal and a United Starlink-tracker/half-fleet milestone, both
  genuinely distinct programs), and writing `dedup_distinct` entries for
  both existing ids into the first draft got a clean first-attempt merge
  with zero rejections, versus the usual one-or-two retry cycle. Worth
  defaulting to this when a new item shares SpaceX + a common category
  (partnership, contract, geopolitical) with ANY existing item from the
  last 7 days, not just waiting for the gate to name the collision.
- 2026-10-15-K: A discovery-pass query ("India ISRO satellite launch
  contract announcement") surfaced a genuine same-day gap the queue never
  carried at all: India's Ministry of Defence signed a Rs 2,563 crore
  contract with NewSpace India Limited for GSAT-7C, the IAF's first
  dedicated comms satellite. tribunindia.com and theprint.in both fetched
  cleanly (mainstream, SNR 4); business-standard.com and indiatvnews.com
  403'd on direct fetch. NSIL has no `src/data/registry` entity (only
  ISRO does), so no crossfeed field applied despite the nine-figure-scale
  value; impact landed `major` on the stated-value test alone.
- 2026-10-15-L: A same-day Andrew Parsonson find (Arianespace targeting
  Nov. 23 for Ariane 6's return to flight, reportedly after fixing the
  turbopump anomaly first reported 2026-09-18) folded cleanly into that
  26-day-old item via `attach`+`patch`, no bump needed. Separately,
  CGTN's own direct coverage of the Oct 14 ADA Space Three-Body Group-02
  launch (already published same-day off an informal lead) was fetched
  independently and used as a `rescore` upgrade: state-media CGTN classes
  `mainstream` for a fact of record (launch occurred, satellite count),
  moving the item from SNR 2 to 4 in one pass. Confirms CGTN is usable as
  a same-day upgrade path for Chinese launch stories first caught only by
  informal aggregators.
- 2026-10-15-M: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 4 new, 3 updated, 0 held"); confirmed via a
  direct `jq` read of all four new items' `snr`/`category`/`impact`
  fields (943 items, up from 939), all three updated items' grown
  `sources`/`updates` arrays, and the `snr_movements` entry for the ADA
  Space rescore (2→4). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4h gap, unfiltered full source list (2026-10-15, fourth)

- 2026-10-15-N: An Aviation Week headline found via WebSearch ("Software
  Readiness Issue Pushes Next SDA Launch To 2026") read as live but was
  dated December 5, 2025, nine months stale; its own internal "Sept 10"/
  "Oct 15" date references are to 2025, not the current year, a trap a
  WebSearch synthesis alone did not flag until the article was fetched
  directly and the byline/publish date checked. Worth treating any
  recurring SDA/launch-delay headline shape the same as the standing
  stale-resurfacing pattern: fetch and check the actual publish date
  before trusting a plausible-sounding date mentioned in the body text.
- 2026-10-15-O: Two Gray Television-owned local affiliates (Dakota News
  Now, Valley News Live) ran near-identical text on a Stevens County,
  Minnesota debris find with different bylines (Avery Arens vs. Erick
  George) -- treated as a same-network wire-rewrite pair (one
  corroboration unit, `crawl: "found_none"`), the same shape as the
  2026-10-06-Q Texas Newsroom/NPR-affiliate case, now confirmed for a
  commercial local-TV group rather than a public-radio collaborative.
- 2026-10-15-P: A genuine predates-window gap surfaced only via a same-
  day Comtech earnings-call reaffirmation (Via Satellite, "expects
  divestiture to Gilat to close this year"): the underlying $157.5M sale
  of Comtech's Satellite and Space Communications segment to Gilat's
  Wavestream unit was announced June 15 and never drafted by any prior
  sweep. Comtech's own SEC 8-K exhibit (official_record via the fixed
  sec.gov host, no registry entity needed) gave a clean primary lead;
  dated on the actual June 15 announcement per the standing chase-it
  convention. Worth remembering a routine same-day earnings-call
  reaffirmation of an old deal's timeline can be the thread that surfaces
  a real, never-published gap, not just a stale non-event itself.
- 2026-10-15-Q: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 4 new, 2 updated, 0 held"); confirmed via a
  direct `jq` read of all four new items' `snr`/`category`/`impact`
  fields (947 items, up from 943) and both updated items' grown
  `sources`/`updates` arrays (Starlink/Ukraine: 23 sources, 6 updates;
  SDA T1TL-A: 4 sources, 1 update). `bun run build` was not attempted,
  per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h14m gap, unfiltered full source list (2026-10-16)

- 2026-10-16-A: An almost entirely off-topic 61-candidate queue (dozens of
  Tesla Roadster "flying car with SpaceX thrusters" marketing-stunt pickups,
  SpaceX-launch-reaction Bluesky chatter, Tesla/SpaceX-merger stock
  speculation) still needed per-candidate triage rather than a blanket
  discard: the Tesla Roadster coverage is a consumer-product reveal that
  merely borrows SpaceX branding/compressed-air thrusters, not an orbital
  or space-economy event, and was excluded entirely rather than drafted as
  noise.
- 2026-10-16-B: The Starlink/Ukraine saga (now 25 sources, 7 updates) took
  its most consequential development yet from a Reuters exclusive: two US
  officials and a Western official said the order to slow Starshield came
  from inside the White House, tied to Trump administration pressure on
  Kyiv to halt Russian refinery strikes, with a senior US official denying
  Trump personally ordered it. Reuters itself was unfetchable directly, so
  used a same-text republication (Kyiv Independent, explicitly crediting
  Reuters) as the attached source, consistent with the standing
  republication-is-fine/forum-mirror-is-not-citable distinction. Separately,
  an 8-senator (4 GOP: Tillis, Collins, Murkowski, Cornyn; 4 Dem: Shaheen,
  Durbin, Blumenthal, Coons, Reed) letter to the Pentagon IG was fetched via
  a Yahoo News mirror after thehill.com 403'd again (joining the standing
  paywalled list); the two new facts folded into the existing item as an
  `update`, not a new item, 75+ hours after initial publish, confirming the
  dedup window for a single fast-moving geopolitical saga stays "same event"
  far longer than the ordinary 7-day rule once it's clearly one continuous
  story.
- 2026-10-16-C: Reliance Industries' first on-record response to Musk's
  week of attacks ("At Reliance, we have never feared competition") was
  fetched directly and identically from two distinct mainstream Indian
  outlets (Deccan Chronicle, ETV Bharat), both explicitly describing it as
  posted via X with no named wire service credited; folded into the
  existing Oct. 7 Musk/Ambani commentary item as an `update` nine days out,
  since it's a direct continuation of the same ongoing feud, not a new
  event.
- 2026-10-16-D: Two older, routine-scale discovery-pass leads that read as
  genuine predates-window gaps turned out to be too stale and too small to
  chase under the chase-it exception (reserved for notable/seismic gaps):
  EarthDaily's NRO "Strategic Commercial Enhancements" contract was dated
  May 5, 2026 ($1.2M) and KBR's USGS EROS Center IT-modernization contract
  was dated January 5, 2026 ($350M ceiling, broader cloud/AI/IT services
  for USGS's own Earth-observation operations, not a commercial-imagery
  procurement). Both left undrafted; worth remembering the chase-it
  exception is for events big enough to matter months later, not every
  stale contract a discovery query happens to surface.
- 2026-10-16-E: A signals-pass Bluesky find (Andrew Jones) summarizing a
  Chinese commercial-launch roundup (Spark Space first-stage oxidizer-tank
  test, Heng Space's 25/100-tonne-to-LEO launcher plans led by a former CALT
  chief designer, Galactic Energy's "chopsticks" sea-recovery plan for
  Pallas-2, Chang'e-8 administrative restructuring to the human-spaceflight
  agency) was left undrafted: the fetched summary gave no specific dates or
  figures for any of the four items, reading like a periodic digest rather
  than today's dateable news. Worth a closer look with a dedicated
  WebSearch per company next time budget allows, since Heng Space and Spark
  Space have no registry or items.json presence at all yet.
- 2026-10-16-F: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt after trimming three update taglines that exceeded the 140-char
  cap before submitting (continuing the 2026-10-14-M pattern of checking
  tagline length proactively rather than waiting for rejection) ("merged 1
  new, 4 updated, 0 held"); confirmed via a direct `jq` read of the new
  USSF-481 item's `snr`/`category`/`impact` fields (948 items, up from
  947), all four updated items' grown `sources`/`updates` arrays, and the
  four automatic persistence-bump `snr_movements` entries logged in the
  sweep entry. `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~6h30m gap, unfiltered full source list (2026-10-16, second)

- 2026-10-16-G: Jonathan McDowell's registered signals channel is his site
  (planet4589.org / Jonathan's Space Report), not a bluesky handle; his
  personal bluesky account posted a genuinely new attribution (Minnesota
  cornfield debris close to the Zhuque-2E upper-stage reentry path) that
  his registered site hadn't picked up yet. Per the standing 2026-09-16-P
  strict-channel-match precedent, attached it `class: "informal"` rather
  than `whitelist`/`observer`, since the whitelist floor only applies to
  the exact registered channel URL.
  - Ars Technica (arstechnica.com) is still unfetchable directly; a
  rewrite site that explicitly credits Ars Technica by name
  (ultimatepocket.com) worked as a citable informal corroboration source
  for a Blue Origin Florida-buildout story, same pattern as 2026-09-18-A
  and 2026-10-12-A. Reuters (reuters.com) is also still unfetchable
  directly; a wire pickup (investing.com) carrying the byline and dateline
  verbatim was used as the mainstream lead instead, consistent with
  2026-10-16-B's Kyiv Independent-via-Reuters precedent.
- 2026-10-16-H: A UK London Stock Exchange RNS regulatory announcement
  (hosted on investegate.co.uk, not a `.gov`/fixed-official-host domain)
  is not `official_record` per the anti-spoof gate; classed it `wire_pr`
  as the closest analogue (a company's own regulatory disclosure,
  functionally identical to a wire-distributed press release) rather than
  resubmit against a rejection. Worth remembering for any future UK-listed
  company's RNS-hosted results (LSE, Investegate, TradingView's RNS
  mirror, etc.).
- 2026-10-16-I: A same-day India Today "Isro gears up for maiden Gaganyaan
  launch, completes big crew module test" queue/discovery hit, and a
  same-day "What Does NASA's Invitation for ISRO to Join the Moon Base
  Program Signal?" piece, both traced via direct fetch/search to a July 12
  ISRO press release and an August 12 NASA/ISRO CSJWG announcement
  respectively, being recirculated today with no new fact; both left
  undrafted as stale resurfacings, extending the 2026-09-25-B pattern to
  analysis-angle headlines ("gears up for", "signal?") that don't
  themselves carry a dateable past-tense fact.
- 2026-10-16-J: An Ars Technica "Rocket Report" (unfetchable directly)
  mention of "India's Skyroot snares US customer" and a separate Ars
  Technica Blue Origin feature both required a WebSearch to confirm they
  were, respectively, a restatement of the already-published Oct. 14
  Reflect Orbital/Skyroot deal and a genuinely new infrastructure story
  (see -G above); a Bloomberg Opinion column ("A Bruising Battle Awaits
  Musk and SpaceX in Mobile Services") bundled only already-published
  facts ($17B EchoStar spectrum deal, AST SpaceMobile competition) under
  a bigger-sounding headline and was left undrafted per the standing
  trend-piece-bundles-old-facts pattern.
- 2026-10-16-K: An xAI "Grok Voice 3.0" launch (Oct. 14) was traced via
  search to a genuine, dateable AI-model release (new benchmark scores,
  unchanged $0.08/min pricing) that happens to cite Starlink customer-
  service call volume as one of several use cases (alongside Tesla cars
  and Grok Bot); left undrafted as an AI-industry product story with an
  incidental space-company mention, not a space-economy event itself.
  Worth a cleaner precedent if a future xAI/Grok announcement changes
  Starlink's own service, pricing, or market position rather than merely
  citing it as a usage example.
- 2026-10-16-L: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 2 new, 3 updated, 0 held"); confirmed via a
  direct `jq` read of both new items' `snr`/`category`/`impact`/`sources`
  fields (950 items, up from 948) and all three updated items' grown
  `sources`/`updates` arrays (Starlink/Ukraine: 26 sources, 8 updates;
  GOVSATCOM: 3 sources, 1 update; Minnesota debris: 5 sources, 2 updates).
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~5h07m gap, unfiltered full source list (2026-10-16, third)

- 2026-10-16-M: A near-total-junk 97-candidate queue (dozens of Tesla
  Roadster "flying car with SpaceX thrusters" pickups and stock-reaction/
  merger-speculation chatter, plus continued Starlink/Ukraine saga churn)
  still yielded a genuine YC-stage launch-startup gap: RATLOG, a Dresden-
  founded Y Combinator Fall 2026 company building a turbopump-free rocket
  engine. The company's own Y Combinator profile claims "$400M in signed
  launch reservation agreements," confirmed verbatim via a YC partner's
  X post (syndication endpoint) and the YC company page itself, but
  Payload's independently-reported piece and a TU Dresden university
  article both describe the same customer relationships only as "letters
  of intent." Left the $400M figure out of the draft entirely rather than
  risk amplifying a founder-stage superlative two independent fetched
  sources declined to repeat; a first-party claim un-echoed by any
  independent source the discovery crawl actually found is a sharper
  version of the standing "first-party superlative is attributed, never
  scored as fact" rule, not just an omission call.
- 2026-10-16-N: A Samtel Avionics/Japan's BULL "new space debris solution
  for global customers" WION interview (Oct 15-16) read as a fresh
  India-Japan partnership story but traced via items.json grep to the
  identical Sept. 8 MoU already published
  (`2026-09-08-samtel-avionics-bull-debris-mou`); the CEO interview added
  marketing framing, not a new fact. A Muks Robotics/ISRO "SPACEO Prime"
  humanoid-space-worker story (Pune-based, "world's first" framing, no
  stated contract value or award date, no ISRO-sourced confirmation found)
  was left undrafted as unverified company-driven PR, the same shape as
  the standing thin-marketing exclusion family.
- 2026-10-16-O: A Vivienne Machi Aviation Week piece on the SDA Transport
  Layer's integration lag (84 satellites in orbit, named root causes:
  divergent vendor command-and-control systems, a Lockheed optical-
  terminal supply shortfall) read as a potential new item on the
  mandatory signals pass, but turned out already fully folded into the
  existing Oct. 10 T1TL-A launch item's `what_happened` by an earlier
  sweep the same day; worth checking an existing recent item's full copy,
  not just its headline, before assuming a detailed follow-up analysis
  piece is undrafted.
- 2026-10-16-P: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 4 new, 2 updated, 0 held"); confirmed via a
  direct `jq` read of all four new items' `snr`/`snr_trace`/`category`/
  `impact`/`kind` fields (954 items, up from 950) and both updated items'
  grown `sources`/`updates` arrays (Starlink/Ukraine: 28 sources, 9
  updates; Neutron slip: 4 sources, 2 updates). `bun run build` was not

## Narrow re-check, ~4h12m gap, unfiltered full source list (2026-10-16, fourth)

- 2026-10-16-Q: A near-total-junk queue (Tesla Roadster "flying car"
  stunt pickups, SpaceX-Tesla merger stock speculation, and dozens of
  repeat Trump/Musk-Starlink-Ukraine denial headlines) still needed a
  genuine same-story continuation check rather than a blanket discard: a
  same-day Telegraph exclusive (via Kyiv Independent's republication)
  reporting that Musk himself proposed the Starshield speed cap to Trump,
  who agreed, directly contradicts both men's earlier public denials, and
  Trump's own on-record quote the same day ("I don't know if it was
  anybody, because it wasn't me. And I don't think it was Elon") is the
  first PERSONAL (not just "a senior US official") denial on record. Both
  facts folded into the existing item via `attach`+`patch`, no bump
  requested (mainstream-led item already at its corroboration_2plus
  ceiling of 4). Confirmed Trump's exact quote independently via two
  directly-fetched outlets (United24 Media, Meduza) before using it, per
  the standing re-fetch-for-verbatim discipline; a WebSearch synthesis
  alone is not enough for a quote this consequential.
- 2026-10-16-R: A "Europe must tackle dependency on Starlink" EU-leaders
  summit lead (Kallas/Kulbergs quotes, Courthouse News) read as a genuine
  new EU-institutional development but was already fully attached to the
  existing GOVSATCOM item by an earlier same-day sweep before this run's
  draft was written -- caught only by re-reading that item's `updates`
  array directly, not by a title/company grep alone (the update's `note`
  used the same Kallas quote verbatim). Worth re-reading a candidate
  update's existing `updates[]` history, not just checking whether an id
  exists, before fetching and drafting a seemingly-new institutional
  statement on a saga already receiving same-day updates.
- 2026-10-16-S: Four genuinely new ground-segment/contract gaps cleared
  entirely from the Via Satellite harvester-queue leg, not discovery: BAE
  Systems' own PR Newswire release (wire_pr, tier 4, no contract value
  disclosed) for a Space Force RF-terminal development contract; a
  CesiumAstro Melbourne, Florida facility, where Via Satellite's own
  writeup omitted the dollar figure but the Economic Development
  Commission of Florida's Space Coast's own release named it exactly
  ($25M, 100 jobs) -- neither CesiumAstro nor the EDC has a
  `src/data/registry` entity, so the EDC page capped at `informal` per
  the standing no-registry-host workaround despite reading like an
  official announcement; Arqiva's three-year Gulfsat Ku-band uplink deal
  (noise-tier, no stated value); and an ESPI "Borrowed Bandwidth? D2D"
  policy brief (Oct. 14) on the EU's 2 GHz MSS spectrum proposal, drafted
  as `kind: commentary` per the standing 2026-08-05 ESPI-commentary
  precedent and dated on the brief's own publish date rather than Via
  Satellite's Oct. 16 pickup date.
- 2026-10-16-T: A Marcia Smith bluesky lead citing "GAO says NOAA's
  GeoXO... cut from $19.6B to $13B" could not be pinned to an actual
  fetchable GAO report page despite several targeted searches (gao.gov's
  own site search surfaced only an unrelated bid-protest case and a 2009
  GOES-R report); left undrafted per the standing never-cite-an-unfetched-
  page rule rather than draft from the post's own paraphrase. The post's
  own timestamp (16:47 UTC) also predated this run's `lastSweep` (17:32
  UTC), meaning it technically belonged to the prior sweep's window, not
  this one's.
- 2026-10-16-U: A Vivienne Machi Aviation Week piece on new Space RCO
  ground-based satellite jammers reaching full-scale production (named
  contractor Northstrat/GRVTY, a 2022-era $22M prototype contract, no new
  award or dollar figure) was left undrafted as a counter-space weapons
  production story with no commercial-space transaction, same shape as
  the standing Meink space-weapons-disclosure/DSP-retirement institutional
  exclusion, distinct from a fresh contract award like the same-run BAE
  item.
- 2026-10-16-V: `bun scripts/finalize-sweep.ts` rejected the first draft
  attempt on one `updates[0].explainer.tagline` overage (149 vs 140 max
  chars); merged cleanly on the second attempt ("merged 4 new, 1 updated,
  0 held"); confirmed via a direct `jq` read of all four new items'
  `snr`/`category`/`impact`/`kind` fields (958 items, up from 954) and
  the updated Starlink/Ukraine item's grown `sources`/`updates` arrays
  (32 sources, 10 updates). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h15m gap, unfiltered full source list (2026-10-17)

- 2026-10-17-A: A prior same-day sweep's signals-pass note said a Marcia
  Smith bluesky claim ("GAO says NOAA's GeoXO... cut from $19.6B to $13B")
  "could not be pinned to an actual fetchable GAO report page despite
  several targeted searches" and was left undrafted; this run resolved it
  by fetching the post's own embed via
  `getPostThread?uri=at://<did>/app.bsky.feed.post/<rkey>` (not the
  author-feed text, which only showed a truncated `www.gao.gov/products/
  gao...` link) and reading `embed.external.uri` directly off the post
  record, which gave the exact `gao.gov/products/gao-26-107739` URL a
  generic gao.gov site search never surfaced. Worth trying this
  post-embed-resolution step before concluding a bluesky post's cited
  report is unfindable, whenever the post's own text truncates the link.
- 2026-10-17-B: The GAO report itself (Published Sep 16, Publicly Released
  Oct 16, 2026) gave the exact $19.6B-to-$13B and six-to-four-satellite/
  five-to-two-instrument figures verbatim, confirming Marcia Smith's post
  precisely; the House Science Committee's own same-day press release
  (science.house.gov) carried Chairman Babin's quote but, per a direct
  fetch, stated no dollar figures or satellite counts at all. Led on the
  GAO report itself (official_record, SNR 5) rather than the Committee
  release, since the actual figures only existed in the primary document.
- 2026-10-17-C: A fully quiet harvester queue (26 post-filter candidates,
  entirely FAA scheduled-launch-notice reposts, SpaceX-nationalization/
  Starshield-description opinion posts, and off-topic BBC/Futurism filler)
  and five quiet mandatory HTML sources (Planet, ICEYE, BlackSky, EUSPA,
  Telesat, all newest-dated before the window or already published) meant
  both of this run's items came entirely from the signals pass's
  fetchable-channel leg, not the queue or discovery. `spacepolicyonline.com`
  and `europeanspaceflight.com` were counted as checked via the
  harvester's own RSS results (304-not-modified / all-entries-already-
  triaged) rather than re-fetched directly, since their content was
  already in hand; the other 14 fetchable channels (10 bluesky via
  `getAuthorFeed`, 4 direct sites) were fetched individually.
- 2026-10-17-D: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 2 new, 0 updated, 0 held"); confirmed via a
  direct read of both new items' `snr`/`snr_trace`/`category`/`impact`/
  `sources` fields (960 items, up from 958). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h45m gap, unfiltered full source list (2026-10-17, second)

- 2026-10-17-E: ISRO's own LOX-methane engine page
  (isro.gov.in/LOX_Methane_engine.html, dated Oct 16, reporting an Oct 9
  gas-generator ignition test for the LME1100 engine) surfaced only via
  a Google News "non-US space" Swarajya pickup; the Swarajya article's
  own URL never resolved (Google News redirect dead-ended, a direct
  WebSearch for its exact headline returned only the ISRO page, an old
  X post, and Wikipedia pages, and the one fetchable-looking mirror,
  indiandefensenews.in, hit a Google anti-bot captcha wall on direct
  WebFetch). Drafted single-source off the first-party ISRO page alone
  (`crawl: "found_none"`, no penalty since first-party is already at the
  tier-5 ceiling) rather than force an unfetched mirror into the sources
  list. Dated the item on the actual Oct 9 test date per the standing
  chase-it convention, even though first coverage only surfaced a week
  later.
- 2026-10-17-F: Starlink's own X statement responding to Reliance's Oct
  16 "never feared competition" post ("Starlink is ready to connect
  India with high-speed internet... all with the requisite government
  approvals") was findable only via WebSearch synthesis (Benzinga 403'd
  on direct WebFetch) but confirmed verbatim via a direct fetch of
  tribuneindia.com's republication, including Musk's one-word reply
  "Much appreciated." Folded into the existing Oct 7 Musk/Ambani
  commentary item as an `attach`+`patch`, since it's the same ongoing
  feud, not a new event; no bump needed (item already at its
  corroboration ceiling of 4).
- 2026-10-17-G: A near-total-junk 85-candidate queue (Federal Register
  airworthiness-directive/privacy-act/fishery-meeting filler, Tesla
  Roadster "flying car" stunt pickups, a dozen stale Gaganyaan
  crew-module-separation reruns already published 2026-10-16, and
  Starlink/Ukraine saga rehashes with no fact beyond what the existing
  item already carries) needed per-candidate triage rather than a
  blanket discard, but yielded only the two items above. Two Federal
  Register documents that looked promising on title alone (an "Upper
  C-Band" order and "Modernizing the Commission's NEPA Rules," both
  future-dated 2026-10-19) turned out to be the formal Federal Register
  publication of already-covered FCC orders (the Jul 22 C-band auction
  and the Sep 30 NEPA exemption); both 302-redirected to
  unblock.federalregister.gov on direct WebFetch and were left unfetched
  rather than chased further, consistent with federalregister.gov's
  standing bot-block. SpaceX's NYC Council AI-safety testimony and
  OpenAI's third SpaceX-sales-exec poach were treated as out of scope
  (AI-industry/corporate-personnel stories with no commercial-space
  transaction), and Evercore ISI's "buy ahead of earnings" CNBC piece
  and a Washington Post Starlink/Rassvet feature were left undrafted as
  rehashes of already-published material (the Oct 16 price-target item;
  the standing Rassvet/China-assistance narrative).
- 2026-10-17-H: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 1 new, 1 updated, 0 held"); confirmed via a
  direct `jq` read of the new ISRO item's `snr`/`snr_trace`/`category`/
  `impact`/`sources` fields (961 items, up from 960) and the updated
  Musk/Ambani item's grown `sources`/`updates` arrays (14 sources, 9
  updates). `bun run build` was not attempted, per the 2026-09-09

## Narrow re-check, ~6h gap, unfiltered full source list (2026-10-17, third)

- 2026-10-17-I: The queue (85+ candidates) was almost entirely Starlink/
  Ukraine saga rehash (dozens of Google News/Bluesky hits on Zelensky's
  Oct 17 comments) and off-topic Tesla Roadster "flying car" stunt
  chatter; all five mandatory HTML sources and all 17 signals channels
  were stale (newest posts predated `lastSweep` or were already
  published) and a 10-query discovery pass covering the full matrix
  surfaced only already-published leads (GSAT-7C, Kapta Space, WISeSat
  SPAC close, IRIS2 contracts, GuoWang/Zhuque-2E launches, NASA CLD final
  RFP) or non-events (a minister's reiterated India space-economy
  figures; ETH Zurich's new Earth Observation Lab, an academic research
  facility consuming EO data rather than a commercial operator or
  constellation, left out of scope; a 3-week-stale, no-dollar-value NASA/
  Blue Origin NLS II on-ramp, too small and stale to chase under the
  predates-window exception). The one genuine new fact, Zelensky calling
  the 161 km/h Starlink cap a "planned operation" that an EU vehicle test
  proved was geography-specific, not technical, needed the same re-fetch-
  for-verbatim discipline as every other beat in this saga: the Google
  News redirect for the Kyiv Independent piece didn't resolve, but a
  direct WebSearch for the exact headline found the real
  kyivindependent.com URL, and United24 Media's and Ukrainska Pravda's
  own pages independently confirmed the same 161 km/h figure and
  "planned operation" quote before it was folded in via `attach`+`patch`
  (no bump: item already at its mainstream corroboration_2plus ceiling of
  4, 10 updates deep already).
- 2026-10-17-J: Confirms the 2026-10-17-C pattern of counting a
  signals-pass channel as checked via the harvester's own RSS results
  rather than a direct re-fetch when nothing in that feed is newer than
  `lastSweep` (here, SpacePolicyOnline's site and European Spaceflight's
  site, both already in the candidates-context health block); still
  fetched the channel's OTHER registered surfaces (bluesky accounts,
  substack) separately since those are distinct feeds the harvester
  doesn't cover. `europeanspaceflight.substack.com/feed` 403'd again,
  extending the 2026-09-20-K/2026-09-22-G intermittent-failure pattern.
- 2026-10-17-K: `bun scripts/finalize-sweep.ts` rejected the first draft
  attempt for a `draft.coverage` entry of `"connectivity"` (a tag, not a
  category); the gate only accepts the fixed category list. Resubmitting
  with `"geopolitical"` (the actual patched item's category) merged
  cleanly on the second attempt ("merged 0 new, 1 updated, 0 held");
  confirmed via a direct `jq` read of the updated item's `snr` (unchanged
  at 4), `sources` (35, up from 32) and `updates` (11, up from 10)
  arrays, and the sweep-log summary in `state.json`. `bun run build` was
  not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~3h37m gap, unfiltered full source list (2026-10-17, fourth)

- 2026-10-17-L: A near-total-junk 27-candidate queue (SpaceX-launch-reaction
  Bluesky chatter, more Starlink/Ukraine saga rehash, an off-topic Futurism
  pair) and five quiet mandatory HTML sources yielded nothing, but the
  signals pass's fetchable-channel leg surfaced a genuine, fast-moving
  incident: Marco Langbroek (bluesky post linking his own SatTrackCam blog)
  and Anatoly Zak (bluesky post linking his own RussianSpaceWeb site)
  independently reported that Russia's Cosmos 2612 had closed to within 1-2
  km of ICEYE's US-registered, Ukraine-linked SAR satellite ICEYE-X36, with
  Langbroek warning of a possible approach to within meters within hours.
  CSIS's Aerospace Security Project (Oct 15 report, fetched directly,
  class `informal`) and Poland's space24.pl (`trade`, citing tracking firm
  Integrity ISR) independently corroborated the broader pattern (a May
  2.5-22 km approach by sister satellites, today's escalation). Axios's own
  piece on the story 403'd on direct WebFetch and was not used for any
  quote; a Washington Times piece also 403'd. Dropped a "bumper-to-bumper"
  Swope quote and a specific CSIS "no one should assume..." line that only
  appeared in WebSearch-synthesis text, not in my own direct CSIS fetch,
  per the standing never-quote-from-a-WebFetch/WebSearch-summary rule;
  re-fetched CSIS with a targeted prompt and got the real verbatim quote
  ("policymakers should assume Cosmos 2612 could take an action that
  threatens the commercial satellite") instead. Classed `incident`
  (orbital-safety/proximity-operations angle) rather than `geopolitical`
  since no government has stated anything on the record yet; impact
  `major` (a director at ICEYE or its insurers would act today; not yet
  `seismic` since no satellite has actually been harmed).
- 2026-10-17-M: Confirms 2026-10-16-G's strict-channel-match rule from the
  gate side, not just precedent: `finalize-sweep` REJECTED a draft that (a)
  listed Langbroek's blog URL in `signalsPass.checked` (it is not in
  `signals-context`'s fetchable list; only his bluesky is, since the blog's
  own signals.json channel status is `exists_activity_unverified`, not
  `verified_active`) and (b) classed that same blog URL `whitelist` in
  `scoring.sources` (same reason: the gate checks class against
  verified-active channels, not just channel presence in signals.json).
  Reclassifying the blog as `informal` and dropping it from `checked`
  (keeping only his bluesky post, which IS verified_active) merged clean
  on the next attempt. Zak's `russianspaceweb.com` was fine as `whitelist`
  because that exact site IS listed `verified_active` in signals.json,
  unlike Langbroek's blog. Worth checking a person's per-channel `status`
  field, not just whether a URL belongs to them, before classing anything
  `whitelist`.
- 2026-10-17-N: `bun scripts/finalize-sweep.ts` rejected the first draft
  attempt twice (once for the `checked` list, once for the source class),
  merged clean on the third attempt ("merged 1 new, 0 updated, 0 held");
  confirmed via a direct `jq` read of the new item's `snr`/`snr_trace`
  (base tier 3 from the whitelist lead, +1 corroboration_2plus = final 4)/
  `category`/`impact` fields (962 items, up from 961) and the sweep-log
  entry in `state.json`. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~8h07m gap, unfiltered full source list (2026-10-18)

- 2026-10-18-A: A thin 29-candidate queue (near-total SpaceX-launch-reaction
  Bluesky spam, Tesla Roadster/stock chatter, scheduled-not-yet-flown
  Bandwagon-5/MMX/Long March placeholders) yielded zero new items; all three
  updates came from chasing two queue leads past the headline (a Marco Rubio
  Google News redirect, a Russia/ICEYE-X36 Bluesky repost) rather than from
  the queue's own content. Confirms a near-total-junk queue is still worth a
  full per-candidate triage pass.
- 2026-10-18-B: Reconfirms 2026-10-16-G/2026-10-17-M's per-channel
  `verified_active` check on the same two people again: Marco Langbroek's
  bluesky (verified_active) classed `whitelist`/`observer` cleanly, while
  Jonathan McDowell's bluesky (`exists_activity_unverified`; only his X and
  `planet4589.org` site are verified_active) classed `informal` even though
  the post was genuinely his and added a real analytical claim ("first LEO
  rendezvous... without the owner's approval"). Worth continuing to check
  signals.json's per-channel `status` field before classing a bluesky find
  `whitelist`, not just whether the account belongs to a listed person.
- 2026-10-18-C: Anadolu Agency's English-language `anews.com.tr` mirror
  classed `mainstream` for a same-day Rubio Starshield-access quote, extending
  2026-10-06-B's AA-as-mainstream precedent to a second AA-owned domain
  beyond `aa.com.tr` itself.
- 2026-10-18-D: `bun scripts/finalize-sweep.ts` rejected the first draft
  attempt once on a 161-char tagline (vs. 140 max); merged cleanly on the
  second attempt ("merged 0 new, 3 updated, 0 held"); confirmed via a direct
  `jq` read of all three updated items' `snr`/`sources`/`updates` fields
  (Starlink/Ukraine: 38 sources, 12 updates; Starmind: 7 sources, 2 updates;
  Cosmos 2612/ICEYE-X36: 7 sources, 1 update) and the sweep log's
  `snr_movements` entry (one unrelated persistence bump, Serco NadirEO 2→3).
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~6h17m gap, unfiltered full source list (2026-10-18, second)

- 2026-10-18-E: Marco Langbroek's bluesky `getAuthorFeed` is a thread of
  personal/political replies to unrelated accounts (French politics, a
  "vvdonline" dig, a Tesla "Super Happy Fun Car" taunt) with his genuinely
  on-topic posts interleaved; worth reading the whole feed per sweep rather
  than skimming for space keywords, since the useful post ("Last clear
  manoever of Kosmos 2612 was 16 Oct ~6:35 UTC") was a one-line reply with no
  space-specific keyword in isolation, only legible via `getPostThread` on its
  parent post. The same feed surfaced a non-whitelisted account ("s2a
  systems") reposting a fresh time-lapse of ICEYE-X36/Cosmos 2612's Oct 18
  pass over South America; classed `informal` and attached as a second
  corroboration source for the existing incident item, extending the standing
  per-channel `verified_active` precedent (2026-10-16-G/2026-10-17-M/
  2026-10-18-B) to a repost-within-a-whitelisted-feed case, not just a
  different-channel-same-person case.
- 2026-10-18-F: Three same-day discovery-pass leads that read as fresh
  (Guoxing Aerospace/"Xing Suan" Zhuque-2E launch via a Chinese-language
  search, Aalyria's $100M Series B, Stoke Space's "$860M Series D extension")
  all turned out to be stale on a direct check: the Zhuque-2E/Xing Suan launch
  was the already-published Oct 14 ADA Space Three-Body Group-02 item under a
  different company label (CGTN itself calls the same program "Xing Suan";
  worth remembering a Chinese-language source can attribute the same
  constellation to a different named company than the English trade press
  does), Aalyria's Series B closed in February 2026, and no evidence of an
  "$860M Stoke Space Series D extension" exists beyond the already-published
  Sept 8 $1B Series E (likely a WebSearch-synthesis conflation of unrelated
  figures). None were drafted.
- 2026-10-18-G: A Kyiv Post piece citing Ukraine's presidential defense-tech
  adviser Serhii Beskrestnov on Rassvet's "real-time strike control" timeline
  (six months, 292 satellites by 2027, 924 by 2035) is a genuinely new,
  dateable angle on the long-running Rassvet saga (deployment tracking and
  ITU/sanctions items already published), not a rehash: drafted as its own
  new item rather than an update, since the most recent Rassvet item was 18
  days old and this is a distinct threat-capability assessment, not a
  continuation of the sanctions-request story. NV.ua (`english.nv.ua`) 403'd
  on direct WebFetch (new addition to the paywalled/bot-blocked list);
  RBC-Ukraine (`newsukraine.rbc.ua`) fetched cleanly and independently
  confirmed the core quote and timeline, used as corroboration instead.
- 2026-10-18-H: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt ("merged 1 new, 1 updated, 0 held"); confirmed via a direct `jq`
  read of the new Rassvet item's `snr`/`category`/`impact`/`sources` fields
  (963 items, up from 962) and the updated Cosmos 2612/ICEYE-X36 item's grown
  `sources`/`updates` arrays (9 sources, 2 updates). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h31m gap, unfiltered full source list (2026-10-18, third)

- 2026-10-18-I: A near-total-junk 49-candidate queue (dozens of Google News
  Starlink/Ukraine-saga rehash hits on the Bessent/Zelenskyy/Rubio exchange,
  SpaceX-launch-reaction Bluesky spam, off-topic Futurism filler) still
  needed a genuine same-company (SpaceX) + same-category (geopolitical)
  dedup_distinct: a same-day Lithuania Starlink-equipment arson attempt
  (Kyiv Independent lead, corroborated by Kyiv Post/United24 Media/
  Euromaidan Press, all independently worded, not wire rewrites) is the
  third such suspected-Russian sabotage attempt on European Starlink ground
  infrastructure since September (after Poland and Bulgaria) but a wholly
  distinct event from the ongoing US speed-restriction/intelligence-sharing
  saga; one `dedup_distinct` entry cleared the gate's same-company+category
  heuristic on the first attempt.
- 2026-10-18-J: Zelenskyy's own NBC "Meet the Press" transcript, fetched
  directly rather than quoted from a WebSearch synthesis, gave a more direct
  on-record claim than any prior update in the saga ("the message came from
  American government to limit this speed, and technically SpaceX did it,"
  intelligence blocked "for some period of time," no intel "during ballistic
  attacks during three days"); paired with Bessent's on-record "very
  reckless" pushback (NBC) and Rep. Mike Turner's on-record call for a
  congressional investigation (CBS "Face the Nation" transcript, fetched
  directly), folded into the existing item via `attach`+empty `patch` with no
  bump (mainstream-led item already at its corroboration_2plus ceiling of 4,
  now 13 updates deep).
- 2026-10-18-K: `updates[].patch` must still be present as an object (`{}`
  is fine) even when an update is a pure `attach`+`note` with no copy
  change; omitting it entirely produced a hard rejection
  ("updates[N].patch: required object") on both of this run's updates. The
  worked example in prompts/update-items.md shows a non-empty patch, which
  reads like patch is optional for attach-only updates; it is not.
- 2026-10-18-L: Marco Langbroek's bluesky feed (fetched via
  `getAuthorFeed`, the only one of 15 checked fetchable channels with
  anything inside this run's window) gave a genuine de-escalation data
  point on the open Cosmos 2612/ICEYE-X36 incident (a small orbit raise
  around Oct 18 ~1:52 UTC, ~5 km apart six hours after closest approach) --
  folded in via `attach`+empty `patch`, no bump (whitelist-led item already
  at its non-first-party ceiling of 4).
- 2026-10-18-M: An 8-query discovery pass covering the full matrix (launch,
  financial, incident/debris, China, India, EO contracts, FCC/regulatory,
  Europe) surfaced nothing new; every hit traced to an already-published
  item (Voyager/DoW dispenser contract, GuoWang 27th batch, ADA Space,
  Meteor 2-7 breakup, Minnesota cornfield debris, Rocket Lab Neutron slip,
  Stoke/Hadrian Q3 funding). Both of this run's genuinely new threads
  (Lithuania arson, the Bessent/Zelenskyy/Turner escalation) were found via
  targeted follow-up searches on queue leads instead, consistent with the
  2026-09-21-C deep-mode norm extending to normal-mode sweeps too: the
  matrix pass is a floor, not the only path to a real find.
- 2026-10-18-N: `bun scripts/finalize-sweep.ts` rejected the first draft
  attempt on two counts (the Lithuania item's missing `dedup_distinct` and
  both updates' missing `patch`); merged cleanly on the second attempt
  ("merged 1 new, 2 updated, 0 held"); confirmed via a direct `jq` read of
  the new Lithuania item's `snr`/`snr_trace`/`category`/`impact`/`sources`
  fields (964 items, up from 963) and both updated items' grown `sources`/
  `updates` arrays (Starlink/Ukraine: 41 sources, 13 updates; Cosmos
  2612/ICEYE-X36: 10 sources, 3 updates). `bun run build` was not attempted,
  per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~3h39m gap, unfiltered full source list (2026-10-18, fifth)

- 2026-10-18-O: A thin ~20-candidate queue (near-total Starlink/Ukraine saga
  rehash of the Bessent/Rubio/Zelenskyy exchange already captured by earlier
  same-day sweeps, plus scheduled-not-yet-flown Bandwagon-5/MMX H3 launches)
  and all five mandatory HTML sources, all 16 directly-fetched signals
  channels (europeanspaceflight.substack.com skipped, budget), and an
  8-query discovery pass covering the full matrix (launch, financial,
  incident/regulatory, China, India, Europe, EO contracts, M&A) yielded
  only one genuinely new fact: Zelensky's direct Kyiv Independent quote
  confirming US intelligence sharing on Russian ballistic missile launches
  has been restored ("We are very thankful for this. Now it works") after
  a three-day block, while the Starlink/Starshield speed cap itself stays
  in place. Folded into the existing saga item via `attach`+empty `patch`,
  no bump (mainstream-led item already at its corroboration_2plus ceiling
  of 4, 14 updates deep). `bun scripts/finalize-sweep.ts` merged cleanly on
  the first attempt ("merged 0 new, 1 updated, 0 held"); confirmed via a
  direct `jq` read of the updated item's grown `sources`/`updates` arrays
  (42 sources, 14 updates; 964 items, unchanged). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~8h gap, unfiltered full source list (2026-10-19)

- 2026-10-19-A: A near-total-junk 47-candidate queue (dozens of Bluesky
  "spacex launch" reaction spam, SpaceX/Tesla-merger stock speculation,
  off-topic BBC pieces) still had one genuine new fact buried in a Google
  News hit: US ambassador to the EU Andrew Puzder's on-record FT interview
  threatening "devastating" trade retaliation if Brussels reserves most of
  the 2 GHz satellite spectrum band for European operators (a new angle on
  the ongoing EU D2D spectrum fight the 2026-10-16 ESPI commentary item
  already covered from the policy-brief side). Most outlets carrying the
  story ran the identical wire headline "US threatens EU with devastating
  retaliation..." (investinglive.com, louisvelazquez.com, and others);
  TRT World had a genuinely distinct headline and additional quotes, so it
  led as `mainstream` with investingLive attached as a second, `informal`
  corroboration source rather than stacking the wire-identical copies.
- 2026-10-19-B: `bun scripts/finalize-sweep.ts` rejected the first draft
  attempt on the same-company+category heuristic (SpaceX + "regulatory"
  within 7 days of the unrelated 2026-10-13 FAA Starbase EIS item); a
  `dedup_distinct` attestation cleared it on the second attempt ("merged 1
  new, 0 updated, 0 held"). Confirms the heuristic fires on coincidental
  company+category overlap even when the two events share nothing else,
  same pattern as 2026-10-18-I's Lithuania-arson case.
- 2026-10-19-C: JAXA's MMX (Martian Moons eXploration) mission, queued via
  a BBC piece and also flagged by Marcia Smith and ESA's own bluesky as
  "pick of the week," is scheduled to launch on an H3 rocket from
  Tanegashima at 04:41 JST Oct 20 (~19:41 UTC Oct 19), i.e. after this
  run's window closed; left undrafted as a pre-launch preview per the
  standing no-preview-coverage norm. Worth checking Launch Library/JAXA
  for the actual launch result next sweep and drafting it dated on the
  real launch date under `science` (first dated MMX program milestone).
- 2026-10-19-D: Confirms the 2026-10-17-C/J/2026-10-18 pattern once more:
  spacepolicyonline.com and europeanspaceflight.com were counted as
  checked via the harvester's own health-block data (both quiet, nothing
  past `lastSweep`) rather than a redundant direct re-fetch, while their
  separate bluesky/substack feeds were still fetched individually.
  europeanspaceflight.substack.com/feed 403'd yet again, extending the
  2026-09-20-K/2026-09-22-G/2026-10-17-J intermittent-failure list.

## Narrow re-check, ~8h gap, unfiltered full source list (2026-10-19, second)

- 2026-10-19-E: A near-total-junk 125-candidate queue (hundreds of Musk
  "SpaceX share to every kid in America" giveaway pickups, Tesla/SpaceX
  merger speculation, off-topic BBC/CGTN filler) still buried a genuine
  new story: Deutsche Telekom, Orange, Telefónica and Vodafone signed a
  letter of intent to jointly bid for Europe's 2 GHz MSS spectrum against
  Starlink. AST SpaceMobile's own wire-distributed release (businesswire
  via a financialcontent.com mirror, since ast-science.com's investor
  press-release page is still a JS shell) framed itself as central to the
  initiative, but three independent trade outlets fetched directly (Space
  Intel Report, Telecompaper) and the operators' own joint statement
  (vodafone.com) all explicitly stated "a satellite partner still to be
  selected" and "no specific satellite partner is named." Led with Space
  Intel Report rather than the AST wire release, and left AST SpaceMobile
  out of `companies[]` entirely rather than imply a confirmed role
  independent coverage didn't support -- a vendor's own wire release about
  a multi-party deal can overstate its settled role in ways the other
  parties' and independent press's own words don't confirm. Separately,
  confirmed a Light Reading/TheNextWeb hit on the "same" story was
  actually the stale September 7-8 "early talks, no decision" precursor
  (byline-dated, not the page-load date), distinct from today's concrete
  LOI-signed escalation.
- 2026-10-19-F: Marco Langbroek's bluesky `getAuthorFeed`, re-queried with
  a prompt asking specifically for the raw record (text, createdAt, post
  uri) of every post mentioning "Cosmos 2612"/"Kosmos 2612"/"ICEYE"/
  "manoeuver", cleanly surfaced a one-line Oct. 19 post easy to miss in
  the ordinary feed read ("Another manoeuver by KOSMOS 2612, around 12:26
  UTC on the 18th October. This is clearly not over yet.") that revised
  the open Cosmos 2612/ICEYE-X36 incident item's prior "last clear
  maneuver Oct 16, no further maneuvering since" / "slowly moving away"
  de-escalation framing. Worth using this keyword-filtered raw-record
  prompt shape whenever a whitelisted tracker's feed mixes substantive
  updates in among personal/political replies (extends 2026-10-18-E), not
  just when a linked report needs embed resolution (2026-10-17-A).
- 2026-10-19-G: Re-confirms the Sateliot €100M Series C "launches"
  headline (computerweekly.com, datacenterdynamics.com, both today-dated)
  is still the stale April 2026 round-OPENING announcement on a third
  appearance (2026-09-28-H), with no stated close; left undrafted again.
  NASA's $476M CSDA On-Ramp 2 expansion (SatellitePro ME, NASA Watch)
  traced to the same June 2026 program as the already-published June 23
  item, not a new October award. GSAT-7B ("Indian Army's first dedicated
  satellite," The Week) is a 2023-signed contract resurfacing with no new
  dateable fact. A JAXA/Innovative Space Carrier reusable-rocket data-
  sharing R&D collaboration (Oct. 14, J-SPARC) predates the window by 5
  days with no stated dollar value; left uncashed since the predates-
  window chase-it exception is reserved for notable/seismic gaps, not
  thin R&D MOUs.
- 2026-10-19-H: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 4 new, 1 updated, 0 held"); confirmed via a
  direct `jq` read of all four new items' `snr`/`category`/`impact`
  fields (969 items, up from 965) and the updated Cosmos 2612/ICEYE-X36
  item's grown `sources`/`updates` arrays (11 sources, 4 updates). `bun
  run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~3h gap, unfiltered full source list (2026-10-19, third)

- 2026-10-19-I: A near-total-junk 72-candidate queue (Musk "SpaceX share
  to every kid in America" giveaway pickups, Tesla/SpaceX merger
  speculation, off-topic Futurism/BBC filler) and five quiet mandatory
  HTML sources still yielded four new items, all via the signals pass
  and one queue-adjacent SpaceNews hit: Uzbekistan's Artemis Accords
  signing (77th nation, Samarkand), a Polish deputy minister's Oct 13
  parliamentary remarks on US budget uncertainty complicating Artemis
  commitments (Andrew Parsonson/European Spaceflight bluesky post,
  created minutes after `lastSweep`), UARX Space's disclosed-and-resolved
  OSSIE-D ground-station anomaly on its maiden OTV flight, and an
  EarthDaily wildfire-product deployment to an unnamed Australian
  insurer. Confirms 2026-10-17-C/J's pattern once more: SpacePolicyOnline
  and European Spaceflight's own feeds surfaced the Uzbekistan and
  Poland leads respectively via their bluesky accounts' `getAuthorFeed`,
  not the harvester queue.
- 2026-10-19-J: `state.gov`'s own Uzbekistan-Artemis-Accords press
  release 403'd on every WebFetch attempt (same failure mode as past
  `.gov` blocks); NASA's own site had no matching release yet (a guessed
  URL pattern 404'd, and a `site:nasa.gov` search confirmed nothing),
  consistent with a Behind The Black aside that "NASA has not yet made
  an announcement." Led instead with two independent Uzbek/Central-Asian
  outlets (Gazeta.uz, carrying a direct Saidov quote; Times of Central
  Asia, independently confirming the same quote) as `mainstream`, with
  UzDaily and Behind The Black as further corroboration -- a same-day
  Artemis Accords signing is still fully sourceable and worth drafting
  even when the usual NASA/State first-party lead hasn't posted yet.
- 2026-10-19-K: The Poland/Artemis item's single-source whitelist lead
  (European Spaceflight) scored SNR 4 despite an honest `found_none`
  corroboration crawl: the gate applies `corroboration_none` (-1) before
  `whitelist_floor` (+2 to reach the floor of 4), so a whitelisted
  observer's on-topic factual claim still lands at its floor even after
  the found_none penalty, not at floor-minus-one. Worth remembering the
  whitelist floor is a hard floor applied after other modifiers, not
  just an alternate base tier.
- 2026-10-19-L: `crawl: "not_attempted"` on a draft with only 4 new items
  (well under the 8-event corroboration budget) is illegal regardless of
  how thin the search prospects look; the first finalize attempt would
  have been rejected for this had it been submitted (caught before
  submission by re-reading the budget rule). Ran an actual search for
  the EarthDaily Australia item, found nothing independent, and used
  `crawl: "found_none"` instead -- costless anyway since
  `corroboration_none` doesn't apply to an already-ceiling first-party
  lead (SCORER_VERSION 2).
- 2026-10-19-M: `bun scripts/finalize-sweep.ts` rejected the first draft
  attempt twice, both on tagline overages (164 and then 141 chars vs. 140
  max, on two different items in sequence); merged cleanly on the third
  attempt ("merged 4 new, 1 updated, 0 held"). Confirmed via a direct
  `jq` read of all four new items' `snr`/`snr_trace`/`category`/`impact`
  fields (973 items, up from 969) and the updated Starlink/Ukraine item's
  grown `sources`/`updates` arrays (43 sources, 15 updates, the new
  four-senator-to-SpaceX letter). `bun run build` was not attempted, per
  the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h14m gap, unfiltered full source list (2026-10-19, fourth)

- 2026-10-19-N: A near-total-junk 83-candidate queue (dozens of Google News/
  Bluesky hits on Musk's pledge to gift one SpaceX share to every US child,
  plus SpaceX-launch-reaction spam) was left out of scope entirely: it is
  Musk's personal philanthropy framing of his own equity, not a funding
  round, M&A, 8-K, or other corporate financial event of SpaceX itself,
  the same distinction as the standing 2026-08-31-J passive-stock-
  disclosure exclusion. The queue's only two real gaps were a same-day
  Via Satellite "OHB Wins ESA Study Deal for Lunar Infrastructure" hit
  (OHB's own ohb.de release was fetchable and registry-matched, landing
  SNR 5 first-party) and a Via Satellite FCC/Globalstar C-3 authorization
  story; a third, the Bulgaria Starlink-antenna arson now at the EU-
  arrest-warrant stage, required chasing a queue-adjacent Google News hit
  past the headline to BTA (Bulgaria's national news agency) and Kyiv
  Post, then dating the item on the actual Oct. 9 arson per the standing
  predates-window chase-it convention rather than today's court-filing
  date; it is the first dedicated item for Bulgaria's incident, which the
  Oct. 18 Lithuania item had previously only referenced as background
  ("following incidents in Poland and Bulgaria").
- 2026-10-19-O: JAXA's own site (global.jaxa.jp, mmx.jaxa.jp) would not
  surface post-launch confirmation of the MMX/H3 liftoff (one straight
  404, one page apparently cached pre-launch despite the event having
  occurred hours earlier), and spaceflightnow.com/nasaspaceflight.com/
  japantimes.co.jp all 403'd or paywalled on direct fetch. Marcia Smith's
  and Anatoly Zak's Bluesky posts (both signals.json whitelisted,
  verified_active channels) ended up the most reliable confirmation of
  liftoff and second-stage separation, with astronomy.com (mainstream)
  and Launch Library (aggregator) as further corroboration; worth
  defaulting to the whitelisted trackers' own channels over chasing
  paywalled outlets when a launch result needs same-day confirmation.
- 2026-10-19-P: `finalize-sweep`'s same-domain corroboration-collapse rule
  merged two DIFFERENT whitelisted people's Bluesky posts
  (`bsky.app/profile/spacepolicyonline.bsky.social` and
  `bsky.app/profile/anatolyzak.bsky.social`) into one corroboration unit
  purely because both URLs share the `bsky.app` host, logging it in
  `corroboration_collapses` as `same_domain`. Both source entries still
  appear in the item's `sources` array and the final trace text still
  read "4 distinct sources," so the bump math wasn't affected here (two
  other distinct-domain sources covered the threshold), but on a thinner
  item where two different bluesky posts were the ONLY corroboration,
  this collapse could wrongly suppress a `corroboration_2plus` bump.
  Worth flagging if a sparsely-sourced bluesky-led item scores lower than
  expected despite two posts from two different whitelisted people.
- 2026-10-19-Q: Globalstar's registry `sats_planned` field (17, Wikipedia,
  2026-07-08) reads as stale against the FCC's newly authorized 48-LEO-
  satellite C-3 generation; rather than attest `same_metric: true` and
  risk the gate reconciling a non-monotonic field incorrectly, the
  crossfeed block left `facts: []` with a note flagging the mismatch for
  the weekly registry run instead of auto-merging it. `bun scripts/
  finalize-sweep.ts` rejected the first draft attempt on the standing
  same-company-plus-category dedup heuristic (the Bulgaria item against
  the unrelated Oct. 9 German Space Command item and the Starlink/Ukraine
  saga, both sharing company SpaceX); two `dedup_distinct` entries cleared
  it on the second attempt ("merged 4 new, 1 updated, 0 held"). Confirmed
  via a direct `jq` read of all four new items' `snr`/`snr_trace`/
  `category`/`impact`/`sources` fields (977 items, up from 973) and the
  updated Cosmos 2612/ICEYE-X36 item's grown `sources` (12, up from 11)
  and `updates` (5, up from 4) arrays. `bun run build` was not attempted,
  per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h05m gap, unfiltered full source list (2026-10-21)

- 2026-10-21-A: A near-total-junk 103-candidate queue (hundreds of SpaceX Q3-earnings-reaction and
  Tesla-SpaceX-merger-speculation pickups, continued Starlink/Ukraine saga rehash of the already-
  captured Oct 20 WSJ report) still yielded three genuine gaps: Planet's Tanager-2/SuperDove
  Flock 4J first-light post (found via the mandatory Planet Labs HTML pass, not the queue, even
  though both satellites had launched on the Oct 1 Transporter-18 mission three weeks earlier --
  worth remembering a company's own "first light" disclosure post is its own dateable event,
  separate from the launch itself, same shape as the standing per-payload-not-per-mission rule);
  a routine Chinese Ceres-1S/Xiguang-4 01 EO smallsat launch (Launch Library gave an unambiguous
  "Launch Successful" status direct from its API, a non-whitelisted Bluesky account
  independently confirmed it, no English trade coverage existed at all); and NASA's Oct 15
  Artemis II heat-shield engineering-analysis release (found via Jeff Foust's bluesky repost of
  the SpaceNews headline, six days stale by the time it was checked -- chased per the standing
  predates-window convention since it's a genuine Artemis III safety-path milestone).
- 2026-10-21-B: `finalize-sweep.ts`'s title-collapse correctly caught phys.org's "Rigorous
  Analysis Confirms NASA's Artemis II Heat Shield Performance" as a verbatim `wire_rewrite` of
  NASA's own release of the same name, despite living on an entirely different domain class
  (mainstream science-news aggregator vs. .gov) -- a reminder that phys.org frequently
  republishes agency press releases near-verbatim rather than writing original copy, so don't
  assume a phys.org byline is independent reporting without checking how closely its wording
  tracks the primary source.
- 2026-10-21-C: Confirmed once more that pairing WebFetch's parallel bluesky `getAuthorFeed`
  calls with their expected authors is error-prone if read only by content: Caleb Henry's feed
  (chenryspace) is dominated by REPOSTS showing the original poster's name (Jonathan McDowell,
  Elizabeth Tasker, ESA Space Science, etc.), not Caleb's own words, and Jeff Foust's feed reads
  as a SpaceNews-style running headline digest ("Studies confirm performance of Artemis 2 heat
  shield", "SpaceX launches Transporter-18 rideshare mission") rather than conversational posts --
  track parallel tool-call order carefully against the actor list rather than pattern-matching
  result content to a presumed author.
- 2026-10-21-D: A monotonic-counter crossfeed candidate (Ceres-1's `flights_total`/
  `flights_successful`, registry stale at 23/21 as of 2026-07-08) is honestly left with an empty
  `crossfeed.facts` plus a note when no fetched source states the vehicle's updated cumulative
  count after this flight, rather than guessing the next integer; the registry's own weekly
  maintenance run owns catching up the real total from Gunter's/Launch Library.
- 2026-10-21-E: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 3
  new, 3 updated, 0 held"); confirmed via a direct `jq` read of all three new items' `snr`/
  `category`/`impact`/`sources` fields (996 items, up from 993), all three updated items' grown
  `sources`/`updates` arrays (Minnesota debris: LandSpace now named in `companies`; SpaceX/Tesla
  merger: 4 sources; JAXA MMX: critical-ops-phase completion folded in), and the sweep log's
  `corroboration_collapses` and two unrelated persistence-bump `snr_movements` entries.

## Narrow re-check, ~6h26m gap, unfiltered full source list (2026-10-20)

- 2026-10-20-A: A second distinct bank's analyst note on the standing
  Tesla-SpaceX merger speculation thread (RBC's $480-a-share/$3.74T
  model, Oct. 19) tripped the same-company-plus-category dedup heuristic
  against BOTH the Oct. 15 Barclays merger-timing item and the unrelated
  Oct. 16 Evercore SpaceX-only price-target item; two `dedup_distinct`
  entries cleared it in one pass. Confirms each bank's distinct note on
  a live M&A-speculation thread is its own commentary item, not an
  update to the first one, per the standing analyst-notes-are-commentary
  rule -- the dedup gate will flag it against every prior note sharing
  the company+category regardless of how unrelated the specific claim.
  Benzinga itself 403'd on direct WebFetch; its content was still usable
  via a Yahoo Finance syndication mirror that credited Benzinga by name
  in the footer ("originally appeared on Benzinga.com"), classed by the
  true originating outlet rather than as a generic "Yahoo Finance"
  source, extending the standing wire/syndication-mirror attribution
  pattern (hubble.com/StockTitan, Reuters/investing.com) to a financial
  news syndication case.
- 2026-10-20-B: The MAGPIE upgrade path worked cleanly on the JAXA MMX
  item: JAXA's own post-launch press release (global.jaxa.jp, matching
  the registry's `website` field) gave a precise 71-minute-13-second
  separation time the whitelisted-tracker-led draft didn't have, patched
  `source_url` + a full `rescore` moved the item from SNR 4 (whitelist
  base) to SNR 5 (first_party ceiling) in one pass. The rescore's
  same-domain corroboration-collapse rule (2026-10-19-P) fired again,
  merging Marcia Smith's and Anatoly Zak's distinct bluesky posts into
  one `same_domain` unit purely because both URLs are `bsky.app` hosts;
  harmless here since the lead was already at the tier-5 ceiling, but
  still worth checking on a thinner whitelist-led item where two
  different people's bluesky corroboration is the only thing pushing
  past `corroboration_2plus`.
- 2026-10-20-C: The open Cosmos 2612/ICEYE-X36 incident got a real
  escalation-then-resolution update from the signals pass, not the
  queue: LeoLabs (via The War Zone) characterized the full maneuver
  sequence as showing "planning, maneuverability, precise navigation,
  and significant fuel" and the most advanced, most dangerous
  uncooperative RPO it has tracked; some public tracking data put the
  closest pass at roughly 26 meters, but Langbroek's own Bluesky posts
  (fetched directly) explicitly cautioned that a specific figure that
  precise carries large uncertainty given TLE imprecision -- used the
  26m figure attributed to "some public tracking data" rather than
  stated as fact, per Langbroek's own on-the-record skepticism about it.
  By the same evening Langbroek reported the two satellites diverging
  with no sign ICEYE-X36 was disturbed, closing out (for now) a thread
  that had been escalating for three straight sweeps. CNN's own piece
  on this story 451'd/blocked on direct WebFetch; a CNN-affiliate TV
  station mirror (krdo.com, "cnn-other" syndication) carried the
  identical byline and full text and was used as the mainstream
  corroboration source instead, the same workaround pattern as the
  standing Reuters/investing.com and Ars-Technica/rewrite-site cases.
- 2026-10-20-D: `bun scripts/finalize-sweep.ts` rejected the first draft
  attempt on the same-company-plus-category dedup heuristic (see -A
  above, only one of the two needed `dedup_distinct` entries was present
  on the first submit); merged cleanly on the second attempt ("merged 1
  new, 2 updated, 0 held"). Confirmed via a direct `jq` read of the new
  RBC item's `snr`/`category`/`impact`/`kind` fields, the JAXA item's
  `snr_trace.history` (4 to 5) and grown `sources` (6, up from 5), and
  the Cosmos 2612/ICEYE-X36 item's grown `sources` (14, up from 12) and
  `updates` (6, up from 5) arrays (978 items, up from 977), plus a `jq
  empty` parse check across all touched data files. `bun run build` was
  not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4h48m gap, unfiltered full source list (2026-10-20, second)

- 2026-10-20-E: Two unrelated companies both go by "ASI" in coverage:
  the already-profiled `2026-10-09-asi-artificial-gravity-platform`
  (space company) and Boston-based Air Space Intelligence, which raised
  a $325M Series C at a $3B valuation the same day this run surfaced it
  via a discovery-pass funding query. Checked what Air Space Intelligence
  actually builds (Flyways, a terrestrial air-traffic/flight-dispatch
  decision-support platform for airlines, the FAA and the Air Force, no
  space product at all) before drafting; left out of scope entirely.
  Worth the reminder that an "ASI" funding-round hit needs a what-does-
  this-company-do check before assuming it is the same, already-tracked
  space ASI.
- 2026-10-20-F: Iridium's Q3 2026 earnings release restated its Aireon
  acquisition as "completed... on July 2, 2026", a more-than-3-month-old
  fact with no new figure attached; left undrafted as a stale restatement
  inside a routine earnings release rather than treated as new Aireon
  news.
- 2026-10-20-G: A same-day Euromaidan Press follow-up on the already-
  published Oct. 15 Project Bromo (Airbus/Leonardo/Thales) item supplied
  a genuine enrichment despite reading at first like a rehash: it ties
  the EU's fast-track review explicitly to the Starshield speed-cap
  saga (a Ukrainian military source blaming the White House's slowdown
  order for the accelerated EU response) and adds union/supplier/MEP
  criticism of von der Leyen's backing, neither already in the item.
  Folded in via `updates[].attach` with an empty `patch`, confirming the
  2026-10-18-K lesson that `patch: {}` still must be present as an
  object.
- 2026-10-20-H: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 5 new, 2 updated, 0 held"); the AnySignal/
  Reflect Orbital item's PR Newswire release auto-collapsed as a
  `wire_rewrite` against SpaceNews's pickup of the same release, leaving
  trade-tier base 3 with no corroboration bump, consistent with the
  standing wire-rewrite-collapse rule. Confirmed via a direct `jq` read
  of all five new items' `snr`/`snr_trace`/`category`/`impact`/`kind`
  fields (986 items, up from 981), both updated items' grown `sources`/
  `updates` arrays (Lunar Link: 2 sources, 1 update; Project Bromo: 3
  sources, 1 update), and the sweep log's `corroboration_collapses`
  entry, plus a `jq empty` parse check across all touched data files.
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~4h29m gap, unfiltered full source list (2026-10-20, third)

- 2026-10-20-I: SpaceX's own Q3 2026 earnings (first profitable quarter as a
  public company, SEC CIK 1181412, ticker SPCX, filed as Exhibit 99.1 to an
  8-K) is not in `sources.json`'s SEC EDGAR 8-K feed list (PL, BKSY, RKLB,
  SATL, SPIR, ASTS, VSAT, IRDM, GSAT, SATS, LUNR, RDW all have one; SPCX
  doesn't), so this run found the filing via WebSearch + a direct EDGAR
  Archives fetch rather than the harvester queue surfacing it. Worth a
  `sources.json` addition for an SPCX 8-K feed at the next structural touch,
  the same shape as the other public tracked operators.
- 2026-10-20-J: A near-total-junk queue (dozens of SpaceX Q3-earnings-reaction
  and Tesla-SpaceX-merger-speculation pickups, Bluesky stock-bot spam) still
  buried the earnings release's own actual figures and Musk's confirmation
  that SpaceX and Tesla have formed special committees to explore a merger,
  both genuinely new, undrafted facts the queue's volume made easy to treat
  as pure noise; reading past the repetition to the primary SEC filing and
  two independently-fetched write-ups (Bloomberg Law, Seeking Alpha) found
  two distinct events worth their own items rather than one commentary-shaped
  pass.
- 2026-10-20-K: An AFRL "Rocket Cargo" Starfall demonstration Google News
  redirect (Wright-Patterson AFB .mil byline) never resolved past a bare
  placeholder, and no independently fetchable article matching that exact
  headline could be found via WebSearch; left undrafted per the standing
  never-cite-an-unfetched-page rule. A 9-month-stale Russian Luch/Olymp spy
  satellite breakup (Jan 30, 2026) recirculated today via militarnyi.com
  with a visible Jan 31 byline underneath; left undrafted as too old for the
  predates-window chase-it exception despite wide existing pickup (ETV
  Bharat, Futura-Sciences, United24 Media, KeepTrack and others), a useful
  reminder that "chase it" is for recent gaps measured in days to a few
  weeks, not months.
- 2026-10-20-L: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt ("merged 7 new, 1 updated, 0 held"); confirmed via a direct `jq`
  read of all seven new items' `snr`/`category`/`impact` fields (993 items,
  up from 986), the updated Starlink/Ukraine item's grown `sources`/`updates`
  arrays (44 sources, 16 updates), the `registry-candidates.json`
  `flag_refresh` entry for `iceye.sats_launched_total` (76 to 84), and a
  `jq empty` parse check across all touched data files. `bun run build` was
  not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h gap, unfiltered full source list (2026-10-21, second)

- 2026-10-21-F: A near-total-junk ~100-candidate queue (hundreds of SpaceX
  Q3-earnings/Tesla-merger reaction posts, dozens of Starlink/Ukraine saga
  rehash hits on the WSJ "Musk ordered the slowdown" story, and a wall of
  ISRO SDSC SHAR recruitment-notice reposts across a dozen Indian outlets)
  still yielded three genuinely new, undrafted items once each lead was
  grepped against `items.json`: a Redwire/EnduroSat European VLEO/PNT MOU
  (mandatory Google News leg), a Solstar/Momentus/NASA Wi-Fi proximity-ops
  demo (same leg), and HPE's Spaceborne Computer-4 flying on Astrolab's FLIP
  rover (Payload queue entry). None were queue-adjacent rehashes; all three
  were same-day, previously-unpublished facts.
  Worth noting an "ISRO recruitment 2026, N vacancies" headline recurring
  across 8+ Indian outlets in one run is a job-posting wire story, not a
  space-program event; it is out of scope regardless of outlet count or
  recurrence, same logic as a routine executive hire.
- 2026-10-21-G: Redwire's own `rdw.com`/`ir.rdw.com` domains still cap at
  `informal` (standing 2026-09-21-P workaround: the registry's `website`
  field is `redwirespace.com`, a different domain), but a Business
  Wire-distributed mirror (confirmed via the "KRUIBEKE, Belgium--(BUSINESS
  WIRE)--" dateline on a direct StockTitan fetch) classed `wire_pr` and led
  instead; two further wire mirrors (Investing.com, Redwire's own newsroom)
  collapsed as the same release, leaving the item single-sourced after an
  honest `found_none` crawl (no independent trade pickup found) -- wire_pr
  tier 4 minus 1 landed SNR 3. Separately, the same release stated Redwire's
  approximate headcount ("~1,400 people across Europe and North America"),
  a genuine null-fill for the registry's empty `employees` field, queued via
  `crossfeed.facts` rather than left out as "just background."
- 2026-10-21-H: The Solstar/Momentus NASA Wi-Fi demo and the HPE lunar AI
  compute item both confirm 2026-09-22-B's refinement again: a trade lead
  (SpaceNews; Payload) plus ONE higher-or-equal-tier corroboration source
  (a PRWeb wire release; The Register, mainstream) was enough for
  `corroboration_2plus`, landing both at SNR 4 without needing a third
  source. HPE's Spaceborne Computer-4 payload is a distinct new item from
  the existing Sept. 23 Astrolab/Interstellar Mapping lunar-water item
  (same FLIP rover and Griffin-1 mission, 28 days apart, no dedup_distinct
  needed since outside the 7-day window) -- worth expecting more payload
  partners to surface on the same not-yet-launched CLPS mission as separate
  items rather than updates once they're genuinely new companies/facts.
- 2026-10-21-I: Marco Langbroek's bluesky feed gave a real update to the
  still-open Cosmos 2612/ICEYE-X36 incident (a maneuver BACK toward
  ICEYE-X36's altitude on Oct. 19 after the Oct. 20 "diverging" update,
  "not done with ICEYE-X36 yet") -- confirms watching a de-escalating
  tracked-incident item for re-escalation is still worth a dedicated
  per-post fetch (via `getPostThread` on the exact post uri from
  `getAuthorFeed`) rather than assuming a prior "diverging" update closed
  the thread. The post's exact `bsky.app` URL was confirmed by resolving
  the API's `at://` uri to a `did:plc:...`/rkey pair and re-fetching that
  exact post via `getPostThread` before citing it, rather than guessing the
  URL shape from the handle and a timestamp.
- 2026-10-21-J: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt ("merged 3 new, 2 updated, 0 held"); confirmed via a direct `jq`
  read of all three new items' `snr`/`category`/`impact`/`sources` fields
  (999 items, up from 996), both updated items' grown `sources`/`updates`
  arrays (Starlink/Ukraine: 47 sources, 17 updates; Cosmos 2612/ICEYE-X36:
  15 sources, 7 updates), and the registry-candidates.json null-fill entry
  for `redwire.employees`. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4.5h gap, unfiltered full source list (2026-10-21, third)

- 2026-10-21-K: The New York Times' "Starshield Cut Out, Ukrainian Drones Fell From
  the Skies" piece (nytimes.com itself unfetchable, confirmed error) had no fetchable
  non-Russian-state mirror; the only mirror found (tass.com) carries the exact figures
  ($1M in lost drones, a 3-day operational halt) but is Russian state media reporting
  on a Ukraine-war-casualty-adjacent claim. Judgment call: left this specific sub-fact
  out of the Starlink/Ukraine saga update entirely rather than cite TASS for it, even
  though the content itself is just TASS relaying NYT's reporting; a directly fetched,
  independently corroborated Stars and Stripes piece on the lawmakers' investigation
  angle (confirmed via Payload too) carried the update instead. Worth remembering that
  "a source that is technically fetchable and factually accurate" isn't always the
  right editorial choice when the only mirror is a combatant state's own outlet on a
  sensitive conflict claim.
- 2026-10-21-L: Interesting Engineering's "just over 180 satellites" figure for
  Guowang/China SatNet (in an Oct-published piece covering an Aug-Sept polar comms
  test) is both vaguer AND staler than the registry's current computed
  `sats_active_verified` (234, CelesTrak, as_of 2026-10-21); deliberately left out of
  `crossfeed.facts` rather than submitted, since it would read as contradicting a
  fresher, more precise computed figure rather than genuinely updating anything.
- 2026-10-21-M: The same-company-plus-category dedup heuristic flagged a brand-new
  Firefly Elytra/MoonFall (lunar south-pole reconnaissance) PDR item against the
  unrelated 2026-10-15 Artemis II Orion heat-shield engineering-analysis item, purely
  because both share company NASA and category human-spaceflight; one
  `dedup_distinct` entry cleared it on the first submit, extending the standing
  pattern (RBC/Barclays/Evercore analyst notes, Bulgaria/Starlink vs. German Space
  Command) to a NASA-shared-company case.
- 2026-10-21-N: A near-total-junk ~96-candidate queue (SpaceX/Tesla-merger and Q3-
  earnings stock-reaction spam dominating Google News: launch) still yielded six
  genuine gaps once the queue's few non-spam Google News/trade entries were chased
  down and cross-checked against open-web discovery: Planet's NASA CSDA Tanager
  evaluation task order (own IR site), an Ariane 6 Block 2 Vulcain aft-bay shipment
  (European Spaceflight), a China SatNet/Guowang polar video-call test (state media,
  corroborated independently by Interesting Engineering), a DARPA Fat Cat award to
  SpaceNukes (PRNewswire, collapsed against SpaceNews as the same wire release), a
  Firefly MoonFall PDR (own site), and a thin Remondo/Meissa AI-ops MOU (EIN
  Presswire, no independent pickup, noise tier). Also folded in two updates: Stars
  and Stripes' lawmakers'-investigation angle on the Starlink/Ukraine saga, and
  SpaceX's cut Starship cadence target (weekly/twice-weekly 2027, down from near-
  daily) from the Motley Fool's full Q3 earnings-call transcript, Ars Technica's own
  article page having been unfetchable despite its RSS entry being in the queue.
- 2026-10-21-O: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on
  two independent issues at once: a 150-char tagline (max 140) on the China SatNet
  item, and the Firefly/Artemis-II dedup heuristic above; both fixed and it merged
  cleanly on the second attempt ("merged 6 new, 2 updated, 0 held"). Confirmed via a
  direct `jq` read of all six new items' `snr`/`impact`/`category` fields (1005
  items, up from 999), both updated items' grown `sources`/`updates` arrays
  (Starlink/Ukraine: 49 sources, 18 updates; SpaceX Q3 earnings: 4 sources, 1 update),
  the sweep log's `corroboration_collapses` entry for the SpaceNukes wire_rewrite, and
  a `jq empty` parse check across all touched data files. `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4.5h gap, unfiltered full source list (2026-10-21, fourth)

- 2026-10-21-P: A near-total-junk ~69-candidate queue (hundreds of SpaceX Q3-earnings/Tesla-merger
  reaction posts and Google News hits, dozens of Starlink/Ukraine saga rehash, a wall of joke/political
  Bluesky reaction posts to the Musk SpaceX-share-giveaway and Starlink-slowdown stories) still yielded
  three genuine gaps once chased past the headline: Atomic-6's Space Armor debris-shielding tiles flying
  for the first time (aboard Portal Space Systems' Starburst-1, on the same Bandwagon-5 mission as the
  already-published ICEYE four-satellite item, a per-payload-not-per-mission case), a routine CGI/UK MoD
  PICASSO support-contract continuation (Via Satellite queue entry), and an Atombeam $18.3M funding round
  for satellite/defense data-compression tech (also Via Satellite). Confirms the corroboration_2plus
  modifier bumps on 2 distinct sources regardless of the second source's tier (CGI's trade-tier Via
  Satellite lead plus an `informal`-classed corroboration from CGI's own unprofiled-domain site still
  landed the +1), contradicting a stricter same-or-higher-tier reading of 2026-09-22-B; trust the gate's
  actual math over that memory's phrasing.
- 2026-10-21-Q: The PR Newswire release that read as a brand-new Atomic-6 product announcement
  ("First Ever Launch of Atomic-6 Space Armor...") is a distinct, dateable event from a January 2026
  PR Newswire/Payload/Interesting Engineering pre-launch preview of the same plan (then pegged to
  Transporter-18, later actually flying on Bandwagon-5): worth checking an Atomic-6-shaped "first ever"
  headline's actual dateline before assuming it duplicates an older company announcement, since the
  older piece was a plan, not the flight itself. A same-day WSB Radio (Atlanta) local-news pickup, with
  its own independently-obtained CEO quote distinct from the wire release's quote, confirmed independent
  (non-wire-rewrite) corroboration.
- 2026-10-21-R: PLD Space's "delays Miura 5 to 2027" SpaceNews piece (surfaced via Caleb Henry's bluesky
  repost) and several analyst price-target pieces on Rocket Lab's already 2-month-old Neutron 2027 slip
  (Goldman Sachs, Citizens Bank, Morgan Stanley, dated Oct 16-20 via ad-hoc-news.de) both restate facts
  already published (2026-10-19 Miura5 item; 2026-08-10 Neutron slip item); left both undrafted as stale
  rehashes rather than treated as fresh analyst-commentary opportunities, since the underlying fact itself
  carried no new figure.
- 2026-10-21-S: A scheduled Rocket Lab Electron HawkEye 360 mission ("We're Not Hawking Around", window
  05:00-08:45 UTC Oct 21) was stood down pre-launch for out-of-family telemetry during pad operations;
  correctly left undrafted (no result to report, a routine scrub) rather than chased as a missed launch
  item. Two scheduled-not-yet-flown Starlink Vandenberg batches (Group 15-15 NET same evening, Group
  15-18 NET Oct 28) were also confirmed via Launch Library as not yet flown and left undrafted per the
  standing no-preview-coverage rule.
- 2026-10-21-T: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 3 new, 0
  updated, 0 held"); confirmed via a direct `jq` read of all three new items' `snr`/`snr_trace`/
  `category`/`impact`/`sources` fields (1008 items, up from 1005) and a `jq empty` parse check across all
  touched data files. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h gap, unfiltered full source list (2026-10-22)

- 2026-10-22-A: A near-total-junk ~70-candidate queue (SpaceX/Tesla merger speculation and Q3-earnings
  reaction spam dominating Google News: launch, dozens of Starlink/Ukraine saga rehash hits, routine
  launch-reaction Bluesky spam) still yielded two genuine updates once chased past the headline: Trump's
  on-record CNBC denial ("I wasn't involved") of ordering the Starshield slowdown, found only via a
  politicalwire.com mirror (cnbc.com itself 403'd on every direct WebFetch attempt) credited to CNBC by
  name; and a second, differently-URLed SpaceNews article (Sandra Erwin, Oct 21) confirming AFRL tested
  its Rocket Cargo point-to-point delivery concept aboard the already-published Oct 20 Starfall second
  flight, bumping that item from noise to notable. The AFRL item's OWN site (afrl.af.mil) 403'd on every
  attempt, as did flightglobal.com, defensemirror.com, and teslarati.com/space.com (neither of the last
  two mentioned AFRL at all despite WebSearch synthesis implying otherwise); only SpaceNews's own teaser
  paragraph plus its photo caption (both directly fetched, pre-paywall) supported drafting the fact at
  all, so the specific cargo-manifest detail (a desalinator, medical gear) that WebSearch kept
  surfacing was left out of the patch entirely since no directly-fetched page ever confirmed it verbatim.
- 2026-10-22-B: Confirms the standing never-quote-a-WebSearch-summary discipline needs active
  defending, not just passive avoidance, when a story has a hard-paywalled or bot-blocked lead
  (spacenews.com, afrl.af.mil, cnbc.com, flightglobal.com, defensemirror.com, usnews.com all failed or
  timed out this run on one single thread): WebSearch's own synthesis repeatedly offered specific,
  plausible-sounding figures (an AFRL cargo-pod contents list) that two directly-fetched "does this
  article mention AFRL" checks (teslarati.com, space.com) flatly contradicted. Worth re-verifying a
  WebSearch synthesis against an actual fetch before using any of its specifics, even when the
  underlying claim (AFRL tested Rocket Cargo on this flight) turns out to be true.
- 2026-10-22-C: A Türkiye "$2B space and aviation investment" (TRT World/Anadolu Agency, sourced to the
  2027 draft budget) and an India PIB "Strengthening India's Space Sovereignty" factsheet both read like
  clean government-investment gaps on headline alone but turned out to be generic budget-document/
  factsheet restatements with no single space-specific dollar figure, named program, or dateable action
  once read in full (Türkiye's figure is a combined aviation+space total dominated by airport
  infrastructure and passenger-capacity spending; India's piece is aggregate startup-count/funding-
  scheme statistics, not an event) -- left both undrafted per the inclusion bar's "a director would act
  on this" test, not just the predates-window or process-not-yet-fact exclusions.
- 2026-10-22-D: John Malone's (Liberty Media) on-record prediction that SpaceX could invest $8-10B into
  Skydance (Bloomberg, Oct 21, Paley International Council Summit remarks) is attributable and would
  pass the commentary bar on sourcing alone, but the underlying deal, SpaceX cash flowing into a
  Hollywood studio for a content/output deal, has no new-space-economy angle at all; left out of scope
  entirely rather than drafted as commentary, distinct from the Tesla-SpaceX merger speculation thread
  (which stays in scope because a merger changes SpaceX's own corporate structure and trajectory).
- 2026-10-22-E: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 0 new, 2
  updated, 0 held"); confirmed via a direct `jq` read of both updated items' grown `sources`/`updates`
  arrays (Starlink/Ukraine: 51 sources, 19 updates; Starfall: 4 sources, 1 update, impact noise->notable)
  and the sweep log's `snr_movements` entry (one unrelated persistence bump, Bangladesh BS-1 2->3). `bun
  run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h gap, unfiltered full source list (2026-10-22, second)

- 2026-10-22-F: `blacksky.com/company/news/` rendered a full dated listing this run (newest post Oct 19),
  reversing the empty search/filter-shell anomaly logged across seven straight sweeps (2026-09-25-C/-L,
  2026-09-26-E/-K/-M, 2026-09-27-A). Confirms it was a transient rendering miss after all, not the
  structural site change the streak suggested; no `fetch_note` needed.
- 2026-10-22-G: WebSearch synthesis again fabricated a specific figure a direct fetch could not confirm
  (extends 2026-10-22-B from this morning's run): a search for the Politico "Space Force Scrambles"
  piece on SpaceX declining 3 launch bids surfaced a "SpaceX halts Falcon 9 bookings beyond 2028" claim
  that reads like it belongs to the story, but three separate direct fetches (the Yahoo/Politico mirror,
  politicalwire.com, a content-mill rewrite that explicitly cited Politico) all confirmed no such date
  appears anywhere in the actual reporting; the figure traced to an unrelated, separately-indexed
  BigGo Finance piece about an older Falcon 9 booking story that WebSearch's synthesis silently merged
  in. Left the 2028 figure out of the draft entirely.
- 2026-10-22-H: A Marco Langbroek bluesky post ("Finally US Government statement in it, after a long
  silence") carried only an embedded image with no alt text and no linked URL -- unreadable directly.
  Triangulated the actual content (Under Secretary of State Thomas DiNanno's X post calling Cosmos 2612's
  behavior "consistent with on-orbit weapons operations," made at the UN First Committee) via a separate
  WebSearch rather than the image itself, confirmed through two independently-fetchable mainstream
  mirrors (Tribune India, both citing the same wire/ANI text). Worth remembering an image-only bluesky
  post with no alt text is a pointer to go find the underlying statement elsewhere, not a citable source
  on its own.
- 2026-10-22-I: TechFlowPost's newsletter write-up of Xona's $250M Series D explicitly named Forbes as
  its source ("according to Forbes") and linked the original (unfetchable, 403) Forbes "exclusive"
  article; classed the source by the true originating outlet (Forbes, mainstream) rather than the
  fetched mirror's own tier, extending the Benzinga/Yahoo (2026-10-20-A) and Hubble/StockTitan
  syndication-attribution pattern to a financial-newsletter case. No other outlet had picked up the
  specific $250M/$2.45B figures by this run; `crawl: "found_none"` landed SNR 2 despite `major` impact
  (nine-figure round, largest to date) -- SNR and impact stayed on their own independent axes.
- 2026-10-22-J: Three separate leads this run turned out to be stale resurfacings once chased past the
  headline: the NYT's "Space Debris Found Twice Within Days Amid 'Growing Casualty Risk'" bundles the
  already-published Oct 14 Minnesota/Mexico debris pair under general casualty-risk statistics; China's
  "Tianwu Constellation" for Central Asia (Eurasianet) traces to a June 28 CGTN announcement with no new
  dateable fact (first 5 satellites still only "expected by end of 2026"); and a "Capella Space wins $49
  million contract for military communications satellite demo" hit, which read like fresh SpaceNews
  coverage, traced via Defense Daily's own dateline to an April 7, 2026 SDA award, resurfaced today by a
  content-mill mirror with a misleading URL date segment.
- 2026-10-22-K: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the standing
  same-company-plus-category dedup heuristic, firing twice (the Falcon 9/Space Force item against both
  the unrelated Oct 16 USSF-481 launch and the unrelated Oct 20 Starfall item, both SpaceX+launch; the
  NASA Competition Model 2.0 item against the unrelated Oct 21 Planet/CSDA Tanager task order, both
  NASA+procurement); three `dedup_distinct` entries cleared it on the second attempt ("merged 5 new, 2
  updated, 0 held"). Confirmed via a direct `jq` read of all five new items' `snr`/`category`/`impact`
  fields (1013 items, up from 1008) and both updated items' grown `sources`/`updates` arrays
  (Starlink/Ukraine: 52 sources, 20 updates; Cosmos 2612/ICEYE-X36: 16 sources, 8 updates). `bun run
  build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4.5h gap, unfiltered full source list (2026-10-22, third)

- 2026-10-22-L: `nationalacademies.org` is not a registry-recorded domain, so the gate's anti-spoof check
  rejects it as both `first_party` and `official_record` ("not an official ... host; reclassify") even
  though the National Academies report is genuinely the actor speaking for its own work; had to fall back
  to `trade` for a NASA-commissioned National Academies report, which still reached SNR 4 on
  `corroboration_2plus` (Payload, Scientific American). Worth remembering non-profit/advisory bodies with
  no registry entity never clear the first_party/official_record domain check, whatever their actual
  authority, and budget for a `trade` reclassification + corroboration rather than assuming first_party
  will fly.
- 2026-10-22-M: delano.lu republished a verbatim September 17, 2024 Reflex Aerospace/Odysseus Space press
  release under an October 22, 2026 page-load date, with an "early 2026" launch target baked into the old
  text; it would have read as fresh corroboration for today's genuinely new Marble Imaging/Reflex/Odysseus
  laser-comms partnership (same two companies, similar headline shape) if not checked against its own
  body text. Extends 2026-10-22-J's stale-resurfacing pattern: a page's load/display date is not proof of
  a story's actual age, read the body for internal date references (an "early 2026" launch target in an
  October 2026 page is the tell) before citing it as same-day corroboration.
- 2026-10-22-N: A near-total-junk ~80-candidate queue (SpaceX/Tesla merger and Q3-earnings stock-reaction
  spam, routine launch-reaction Bluesky noise) still yielded four new items once the four mandatory HTML
  sources and open-web discovery were chased past the headline: BlackSky's own site had a same-day Gen-3
  Assured contract-doubling release the queue didn't surface; SatNews (found via WebSearch, not the queue)
  carried Marble Imaging/Reflex Aerospace/Odysseus Space's new laser-downlink mission; a discovery-pass
  NASA-contract query surfaced the National Academies non-polar moon-site report; and EarthDaily's own
  blog had a routine SynMax energy-analytics subscription expansion. All four BlackSky/SynMax-shaped leads
  needed `dedup_distinct` against same-company-plus-category items from the prior 3-7 days (BlackSky vs
  Oct 15 HEO contract; SynMax/EarthDaily vs Oct 19 Australia wildfire-insurer item; National Academies vs
  the unrelated Oct 19 JAXA MMX item on shared company NASA + category science), confirming the heuristic
  keeps firing on coincidental company+category overlap alone.
- 2026-10-22-O: `bun scripts/finalize-sweep.ts` rejected the first three draft attempts in sequence (a
  `coverage` array containing a tag instead of a category; the National Academies source's anti-spoof
  domain rejection; a 147-char tagline on the same item after the reclassification), merging cleanly on
  the fourth attempt ("merged 4 new, 1 updated, 0 held"). Confirmed via a direct `jq` read of all four new
  items' `snr`/`impact`/`category` fields (1017 items, up from 1013) and the updated Space Rider item's
  grown `sources`/`updates` arrays (3 sources, 1 update), plus a `jq empty` parse check across all touched
  data files. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4.5h gap, unfiltered full source list (2026-10-22, fourth)

- 2026-10-22-R: A WebSearch synthesis for a PCMag "FCC Lets SpaceX Acquire More Spectrum... Without an Auction"
  headline traced to a real but different-named FCC order than the headline implied (a Tristar/TLG AWS-3
  license transfer, not the EchoStar deal); the FCC's own DA-26-1129A1.pdf (found by searching the exact
  docket language, not the PCMag headline) fetched cleanly as a readable PDF via WebFetch and gave the full
  primary text (62 counties, 8 states, ~4% population, 75 MHz post-transaction) a small-model summary of the
  wrong document (the January 9 15,000-satellite order, fetched first on a guessed URL) would have missed.
  Worth searching for the specific docket/order number before trusting the first FCC PDF a general search
  surfaces for a spectrum story; FCC PDFs are directly readable by WebFetch/Read (not all binary fetches are
  opaque, contra the general PDF-extraction caution elsewhere in this log).
- 2026-10-22-S: The Oct 1 ICEYE/Nokia sovereign-satcom partnership item got a genuine new-item-worthy sequel
  three weeks later when Ukraine's Ministry of Defence became the first named government customer via a
  Letter of Intent, announced during Finland's PM's Kyiv visit as one of seven Ukraine-Finland agreements
  (~€300M). Led with ICEYE's own press release (first_party, SNR 5) rather than the Kyiv Post/United24
  pieces covering the broader multi-sector Finland package, since only ICEYE's own page stated the
  satcom-specific LOI facts; the broader €300M figure spans rail, energy and housing too and was used only
  as context, not implied to be the LOI's own value. dedup_distinct was needed against the SAME-DAY
  ICEYE/OroraTech wildfire item purely on shared company+category, extending the standing heuristic pattern.
- 2026-10-22-T: Two bluesky posts from the same whitelisted account (Marcia Smith/SpacePolicyOnline),
  cited as both `scoring.sources` entries on a brand-new item (not an update), collapsed via the
  `same_domain` rule exactly as it does on updates (2026-10-19-P, 2026-10-20-B); harmless here since the
  class is `whitelist` with an `observer` floor of 4 regardless of corroboration count, but worth remembering
  this collapse rule applies to NEW-item scoring blocks too, not just update `attach` arrays.
- 2026-10-22-U: Crown Castle's own Q3 2026 earnings-call transcript (fetched via a Motley Fool
  `earnings/call-transcripts` URL, classed `trade`) gave a direct, on-record CEO quote confirming active
  SpaceX tower-leasing talks a bare Bloomberg "people familiar with the matter" story could not support
  alone; worth checking for the named counterparty's own earnings-call transcript (fool.com, Seeking Alpha,
  or the company's own IR site) whenever an "X is in talks with Y" story names a specific public company,
  since the counterparty's own quarterly call often independently confirms or denies the talks on the record.
- 2026-10-22-V: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the standing
  same-company-plus-category dedup heuristic (the new ICEYE/Nokia/Ukraine item against the unrelated
  same-day ICEYE/OroraTech item); merged cleanly on the second attempt ("merged 5 new, 4 updated, 0 held").
  Confirmed via a direct `jq` read of all five new items' `snr`/`impact`/`category` fields (1022 items, up
  from 1017), all four updated items' grown `sources`/`updates` arrays (Starlink/Ukraine: 54 sources, 21
  updates; SpaceX/Space Force Vulcan reassignment: 3 sources, 1 update; Cosmos 2612/ICEYE-X36: 17 sources,
  9 updates; SpaceX/Tesla merger: 5 sources, 2 updates), the sweep log's `corroboration_collapses` entry for
  the same-domain bluesky collapse above, and a `jq empty` parse check across all touched data files. `bun
  run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6h57m gap, unfiltered full source list (2026-10-23)

- 2026-10-23-A: The em-dash ban applies even inside a real, verbatim quote: Trump's reported
  "The bottom line — he put it back" tripped `finalize-sweep`'s blanket em-dash rejection on first
  submission. Rewrote the quoted clause as "The bottom line, he put it back" (comma for the dash,
  wording otherwise unchanged) rather than drop the fact; extends the 2026-10-06-R finding that the
  no-punctuation-marks rules bind the rendered copy, not just unquoted agent prose, from exclamation
  marks to em dashes specifically.
- 2026-10-23-B: Two separate WebFetch passes over near-identical Al Jazeera/Reuters wire text about
  Trump's Starlink-restoration claim returned materially different quote wording and a fabricated
  "October 24" follow-up date that doesn't exist in this sweep's window; neither was trusted until two
  further direct fetches (The Moscow Times via Reuters, UNN.ua) independently confirmed the same "the
  bottom line, he put it back" / "nothing has changed anywhere" exchange. Confirms the standing
  never-trust-a-single-WebFetch-summary-for-an-exact-quote discipline extends to short, simple quotes,
  not just long technical ones.
- 2026-10-23-C: A WebFetch of Vivienne Machi's Aviation Week author-page listing surfaced a "Space
  Force Plans New 'Spider' Program For GPS Ground Ops" headline that could not be confirmed by a
  dedicated WebSearch at all (no result named any "Spider" program); treated as a fabricated/garbled
  small-model summarization artifact per the standing 2026-10-03-G/2026-10-22-B pattern and left
  entirely unchased rather than drafted or even logged as a gap to revisit.
- 2026-10-23-D: A near-total-junk queue (SpaceX/Tesla-merger and Starlink/Ukraine-saga rehash
  dominating every Google News and Bluesky search leg) and a fully clean mandatory 4-source HTML pass
  still yielded five genuine enrichment patches, all via a source already cited on an existing item, a
  same-outlet correction caught through the signals pass, or a discovery-pass fact missing from an
  already-published item's copy: Trump's disputed Starlink-restoration claim (Ukraine saga), a $561M
  Boring Company stake markup disclosed in SpaceX's own Q3 10-Q (missed by the original Q3-earnings
  draft because it sat in the 10-Q rather than the 8-K/Exhibit 99.1 already cited), European
  Spaceflight's own correction to the Vulcain Aft Bay weight figures (880kg actually beat the 800kg
  target, not fell short), SpacePolicyOnline's fuller ASAP Artemis IV writeup (adds a future-LEO-access
  concern the original bluesky-sourced draft didn't carry), and Rocket Lab's own response to the
  Space Force launch-capacity-gap item. Zero new items; `bun scripts/finalize-sweep.ts` merged cleanly
  on the second attempt ("merged 0 new, 5 updated, 0 held") after the em-dash fix, confirmed via a
  direct `grep` item-count check (1022, unchanged) and a read of the sweep log's `snr_movements` (four
  unrelated persistence bumps) and `signals`/`discovery` blocks. `bun run build` was not attempted, per
  the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h gap, unfiltered full source list (2026-10-23, second)

- 2026-10-23-E: A candidate drafted from the signals pass (European Spaceflight's Themis
  schedule-slip piece, found by fetching europeanspaceflight.com directly since its substack
  feed 403'd) turned out to duplicate an item the immediately-prior sweep had already published
  from the exact same source URL seconds before this run's `lastSweep` cutoff; `finalize-sweep`
  caught it on the dedup check and it was dropped rather than drafted as a duplicate or an
  update. Worth re-grepping a brand-new-looking signals-pass find's exact headline/company against
  `existing[]` before drafting, even when it reads as fresh, since a same-day prior sweep can land
  between one run's candidate discovery and its own finalize.
- 2026-10-23-F: Bluesky profile pages (`bsky.app/profile/...`) are consistently unreadable via
  WebFetch this run (renders only the bare handle, no post content, for every account tried); the
  public AT Protocol endpoint `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=10`
  fetches cleanly via WebFetch instead and returns real post text with `indexedAt` timestamps.
  Prefer that endpoint over `bsky.app` URLs directly whenever `bsky.app` returns only a handle shell.
- 2026-10-23-G: WebSearch synthesis fabricated a source name on the Cosmos 2612 UN exchange: an
  initial search attributed the US statement to "Thomas DiNanno" and Russia's rebuttal to named
  diplomat "Konstantin Vorontsov" with an "absurd" quote, but two independent direct fetches
  (rferl.org, eurasiareview.com, both the same Mike Eckel wire piece) showed the actual US speaker
  at the Oct. 21 UN First Committee was Brian Hardesty, and Russia's representative was not
  identified by name in either piece. Drafted the update using only the directly-confirmed names
  and quotes; extends the standing WebSearch-synthesis-fabricates-specifics pattern
  (2026-10-22-B/G, 2026-10-23-C) to person names, not just figures and headlines.
- 2026-10-23-H: Several near-total-junk queue leads traced to stale resurfacings rather than new
  facts: "Mystery space debris found in Minnesota cornfield linked to Chinese rocket" (KSTP)
  rehashes the already-fully-identified Oct. 14 Zhuque-2E debris item; a WebSearch for "Ukraine
  independent satellite system" surfaces Stetman's $1.1B/360-satellite constellation plan, which
  traces to a July 2026 Kyiv Post piece, not a new event; and a "NASA awards $476M in Commercial
  Satellite Data contracts" hit (framed by a reposted tweet as "4 hours ago") is actually the
  June 18, 2026 CSDA On-Ramp 2 announcement. All three left undrafted.
- 2026-10-23-I: `bun scripts/finalize-sweep.ts` rejected the first draft attempt (a second new item,
  the Themis piece above, as a same-event dedup match against both an unrelated Oct. 21
  Airbus/Vulcain-aft-bay item and the already-published same-day Themis item); dropping that item
  entirely merged cleanly on the second attempt ("merged 1 new, 3 updated, 0 held"). Confirmed via
  a direct `jq` read of the new Orbital Operations/Astraeus item's `snr`/`category`/`impact` fields
  (1025 items, up from 1024) and all three updated items' grown `sources`/`updates` arrays
  (Atomic-6/Starburst: 3 sources, 1 update; Starlink/Ukraine: 58 sources, 23 updates; Cosmos
  2612/ICEYE-X36: 18 sources, 10 updates), plus a `jq empty` parse check across all touched data
  files. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4.3h gap, unfiltered full source list (2026-10-23, third)

- 2026-10-23-J: A directly-fetched Yahoo mirror of a Politico piece ("British PM pushes Trump
  on Ukraine's Starlink access") twice named the UK Prime Minister as "Andy Burnham," not the
  real-world Keir Starmer; re-fetched with a targeted "who exactly is named" prompt and got the
  same answer both times. Trusted the directly-fetched text over outside/training-data knowledge
  of real-world politics per rule 2 (never enrich from memory) and wrote the item using the
  site's own stated name; this platform's 2026 is a simulated continuity that can diverge from
  real-world events, and the fetched source is the only authority that matters.
- 2026-10-23-K: A Via Satellite "Space Systems Command Makes CASR Awards for Space Domain
  Awareness" piece read as a fresh award but turned out to recap the already-published Oct. 22
  CASR item (same six companies, just "unnamed by SSC" in this outlet's own phrasing where
  airandspaceforces.com had named them); still carried genuinely new budget figures (a March 2025
  wargame with a dozen-plus companies, $37M FY26 / $24M FY27 commercial-services lines against a
  ~$71B FY27 request) not in the original draft, folded in as a no-bump `updates[].patch`+`attach`
  enrichment rather than a new item or a skip. Worth reading a same-program "award" piece in full
  even when the headline sounds redundant; it can carry the only sourced budget context the
  original draft lacked.
- 2026-10-23-L: An Ars Technica "pressure is on to find a home for a new spaceport" piece read as
  a fresh gap but was the same story as the already-published Oct. 22
  `2026-10-22-space-force-third-launch-site-feasibility` item (Garrant's "aspirational" 2030
  quote, no site chosen), just reframed around congressional pressure and Meink's May hearing
  testimony; grepping `items.json` by topic ("spaceport", "launch site") before drafting caught
  it. The incremental Meink/congressional-study detail was judged too marginal to patch in on its
  own.
- 2026-10-23-M: Vivienne Machi's Aviation Week author-page listing (one of the mandatory
  fetchable signals channels) surfaced a genuine same-day gap the queue and an 8-query discovery
  matrix both missed: Space Systems Command's new ACES program (Access to the Classified
  Ecosystem for Space), announced Oct. 22 at LA Space Week, easing security-clearance barriers for
  commercial vendors entering classified national-security space work. SatNews and ExecutiveGov
  both fetched directly and independently worded, landing a clean SNR 4 off two trade sources; no
  named vendors or dollar figures exist yet, so `crossfeed.facts` stayed empty.
- 2026-10-23-N: BlackSky's own news listing carried a same-day "AI driven space-based
  intelligence as a path to space sovereignty" entry that read like a company blog post but
  turned out to be syndicated NATIVE ADVERTISING (`airforcetimes.com/native/blacksky/...`,
  `militarytimes.com/native/blacksky/...`, the same piece dated as far back as Oct. 9 on one
  mirror) rather than a dated news item; left undrafted per the standing thin-marketing exclusion,
  extending it to sponsored-content placements specifically, not just a company's own blog.
- 2026-10-23-O: A routine, undramatic Chinese Yaogan launch (Long March 4B, six Yaogan 53/56-series
  reconnaissance satellites) had zero trade or mainstream pickup on a direct search; published
  single-sourced off Launch Library's own tracking data (`aggregator`, `crawl: "found_none"`,
  honest SNR 3) rather than held, per the standing "every on-scope launch publishes" rule and the
  "weak sourcing is never a reason to hold" rule, extended here to a launch vehicle itself (not
  just its payload) when literally no press exists yet.
- 2026-10-23-P: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 4
  new, 2 updated, 0 held"); confirmed via a direct `jq` read of all four new items'
  `snr`/`category`/`impact` fields (1029 items, up from 1025), the CASR and Starlink/Ukraine
  updated items' grown `sources`/`updates` arrays, and a `jq empty` parse check across all touched
  data files. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h20m gap, unfiltered full source list (2026-10-24)

- 2026-10-24-A: Bash file redirection (`>`) and `mkdir` are blocked outright in this
  session's sandbox, even for paths under the repo working directory; piping a script's
  output straight into `jq` (e.g. `bun scripts/sweep-context.ts | jq '{...}'`) works fine
  and was the only way to inspect the large `sweep-context`/`candidates-context` outputs
  without a scratch file.
- 2026-10-24-B: A government PDF (a House member's own `.house.gov`-hosted letter) comes back
  as unreadable binary/compressed garbage through WebFetch's text-extraction pass, but the
  Read tool parses the same fetched PDF cleanly (WebFetch auto-saves binary fetches to a
  local tool-results path, logged in its response; pointing Read at that saved path got full,
  verbatim, page-by-page text including the signature block) when `federalregister.gov`'s own
  `.txt`/`.json` endpoints aren't available for a given document. Worth trying Read-on-the-
  saved-path before giving up on a `.gov` PDF as unfetchable.
- 2026-10-24-C: The MAGPIE upgrade path's same-domain corroboration-collapse rule (standing
  since 2026-10-19-P) collapsed five separate `science.nasa.gov/blogs/swift/*` URLs and two
  `spacenews.com` URLs into two units on a 19-source rescore, but the full 19-entry `sources`
  array submitted in `rescore.sources` was preserved byte-for-byte in the merged item; the
  collapse affects only the corroboration-counting math and `corroboration_collapses` log, not
  which sources render on the card. Worth not under-submitting a rescore's source list out of
  fear the collapse will drop entries.
- 2026-10-24-D: Space.com truncated to "[Content truncated due to length...]" with zero body
  text on three separate WebFetch attempts at different prompts this run (a first for this
  specific URL shape; prior sessions treated space.com as reliably fetchable); fell back to a
  Launch Library direct-JSON fetch (booster/satellite/site facts) plus a successful direct
  fetch of a BASENOR mirror carrying the same facts verbatim, and left the space.com-only
  "first Starlink launch in 11 days" / Starship-cadence-shift framing out of the draft
  entirely since it was never confirmed via an actual fetch, only a WebSearch synthesis. Worth
  a retry on space.com before assuming it is dead; this looks like a one-off rendering miss.
- 2026-10-24-E: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 1
  new, 6 updated, 0 held"); confirmed via a direct `jq` read of the new Starlink-batch item's
  `snr`/`snr_trace`/`category`/`impact` fields (1030 items, up from 1029), the Swift item's
  rescore (4→5, `source_url` switched to NASA's own Oct 23 mission-end post, all 19 sources
  preserved), the sortie-suit item's bump (3→4), the three plain-attach updates' grown
  `sources`/`updates` arrays, the sweep log's `snr_movements` (one unrelated persistence bump,
  Amtrak Starlink Cascades 2→3) and `corroboration_collapses` entries, and a `jq empty` parse
  check across all touched data files. `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~6h07m gap, unfiltered full source list (2026-10-24, second)

- 2026-10-24-F: `newItems[].explainer.for_who` rejects an explicit `null`
  ("must be a string when present"); the field is optional, so OMIT the key
  entirely rather than setting it to `null` when there is no specific
  audience to name.
- 2026-10-24-G: Two same-day Xinhua-originated Chinese state-media pages
  (CGTN's own report and People's Daily's, different URLs, different
  headlines, same underlying facts on a routine Yaogan-50 03 launch) did
  NOT title-collapse at finalize and scored as two distinct sources
  (`corroboration_2plus`, +1) while `crawl: "found_none"` (no independent,
  non-state pickup existed) still applied its own -1 in the same trace,
  netting to zero and leaving the item at its mainstream base tier of 3.
  Worth expecting this net-zero outcome whenever a state-media pair is the
  only coverage: attesting `found_none` honestly is correct even when the
  state outlets themselves are plural, since "state media twice" is not
  independent corroboration.
- 2026-10-24-H: Two Federal Register notices continuing an already-published
  proceeding (new GN Docket 26-289 taking comment on Upper C-band satellite
  transition plans; Upper C-band Clearinghouse selection criteria) and a
  Further NPRM's formal publication (the July 2026 satellite-licensing
  overhaul's FNPRM on NGSO call-sign merging and space-based experimental
  licensing) all folded cleanly into their respective existing items via
  `updates[].attach`+`patch`, no bump requested in any case (one item
  already at the official_record ceiling of 5, the other's new source
  concerns a different procedural fact than the one the original trade
  lead covers, not better sourcing of the same claim). An EUSPA procurement
  listing ("Space Traffic Coordination Platform") was left undrafted
  despite being genuinely new and unpublished: the procurement page itself
  stated no publication date, estimated value, or scope beyond the title,
  too thin to clear the inclusion bar even as a low-SNR item.
- 2026-10-24-I: `mainenginecutoff.com` (a mandatory fetchable signals
  channel) returned no content on two separate WebFetch attempts this run
  (not a 403, just an empty/failed fetch); logged as a failed attempt in
  the signals-pass note rather than claimed as checked with no evidence.
  Worth a retry next sweep before concluding it needs a fetch_note.
- 2026-10-24-J: `bun scripts/finalize-sweep.ts` merged cleanly on the second
  attempt, after dropping an explicit `null` `for_who` per -F above ("merged
  2 new, 3 updated, 0 held"); confirmed via a direct `jq` read of both new
  items' `snr`/`snr_trace`/`category`/`impact` fields (1032 items, up from
  1030) and all three updated items' grown `sources`/`updates` arrays
  (Starlink/Ukraine: 66 sources, 26 updates; FCC Upper C-band: 9 sources, 4
  updates; FCC licensing overhaul: 5 sources, 5 updates), plus a `jq empty`
  parse check across all touched data files. `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~3h49m gap, unfiltered full source list (2026-10-24, third)

- 2026-10-24-K: Musk's first on-record admission that SpaceX itself (not
  only the US government) throttled Starlink/Starshield in Ukraine, "Ukraine
  military violated Starlink terms of service and used it for offensive
  drone strikes to kill people," surfaced the same evening restoration was
  announced; folded into the existing 10-day-old saga item (now 68 sources,
  27 updates) as an `attach`+`patch`, no bump (mainstream-led item already
  at its corroboration ceiling of 4). Presidential adviser Beskrestnov's
  on-record rebuttal (commercial Starlink has carried a 70-90 km/h cap since
  winter, Starshield is the system actually used for strikes) came only from
  a smaller outlet (Ukraine Today), classed `informal`; the AP wire carrying
  Musk's quote was mirrored identically across KSL/durangoherald/krcgtv
  (one corroboration unit).
- 2026-10-24-L: A WebSearch for a same-day "China commercial rocket launch"
  surfaced an article describing a Long March 8A SatNet launch as happening
  "Saturday, Oct. 24, liftoff scheduled for 2:50 UTC," reading as a
  same-day event, but a direct Launch Library query for the vehicle showed
  the actual upcoming flight is NET Oct. 25 01:50 UTC, still "Go for
  Launch"; the "2:50 UTC" figure traced to a stale preview-article
  artifact, not a real launch time. Extends the standing
  WebSearch-synthesis-gives-wrong-dates-for-Chinese-launches pattern
  (2026-09-26-C and peers); left undrafted as scheduled-not-yet-occurred.
- 2026-10-24-M: A substantial Bolivia Starlink-for-schools program (Aula
  Conectada, President Paz, 85 La Paz municipalities, 4,500-4,700 antennas,
  signed Oct. 20) had surfaced in the queue only via a BASENOR mirror (the
  standing low-quality-mirror flag); two independently-written mainstream
  outlets (Rio Times, Latin Times) confirmed the same figures with
  distinct framing and quotes once searched for directly, and the item was
  dated on the actual Oct. 20 signing per the predates-window convention.
  BASENOR was left off the sources list entirely.
- 2026-10-24-N: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt ("merged 2 new, 1 updated, 0 held"); confirmed via a direct `jq`
  read of both new items' `snr`/`category`/`impact`/`kind` fields (1034
  items, up from 1032) and the updated Starlink/Ukraine item's grown
  `sources`/`updates` arrays (68 sources, 27 updates), plus a `jq empty`
  parse check across all touched data files. `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~8h gap, unfiltered full source list (2026-10-25)

- 2026-10-25-A: A near-total-junk ~39-candidate queue (dozens of Google News pickups of the
  already-captured Starlink/Ukraine-restoration saga, SEO-mill "tech-insider.org"/"shattered.io"
  listicles, generic Bluesky-search spam including affiliate-marketing bots and off-topic political
  chatter, a routine ISRO recruitment notice) still yielded a clean, honestly-attested regulatory lead
  via a discovery-pass FCC query: AT&T/Verizon/T-Mobile's CTIA-led lobbying to strip two bands from
  the FCC's Oct. 29 Starlink Mobile spectrum vote. Google News RSS redirect URLs failed to resolve via
  WebFetch this entire run (consistently returned a bare "Google News" header with no article content,
  not even a redirect notice); fell back to WebSearch-plus-direct-outlet-URL for every Google News-sourced
  lead instead of the usual follow-the-redirect approach.
- 2026-10-25-B: A drafted "new" item's lead source URL turning out to be already cited verbatim in an
  existing item's `sources` array (not just a similar topic, the identical satnews.com URL) is a stronger
  same-event signal than the usual company+category heuristic collision: the Space Force/Vulcan-to-SpaceX
  mission-reassignment story I drafted as a new item was in fact the Oct. 22 fact already fully captured
  on `2026-10-22-spacex-falcon9-retirement-space-force-launch-gap`'s own first update; finalize-sweep's
  dedup gate caught it, and the genuinely new facts (SpaceNews's Oct. 24 payload-category breakdown,
  NewSpace Economy's "six is a cumulative count since April, not a fresh transfer" clarification) folded
  in cleanly as a second update instead. Worth checking a drafted new item's own `source_url` against
  `existing[].source_url` by exact string match, not just topic, before spending further drafting time.
- 2026-10-25-C: NewSpace Economy's clarification above is a new shape of numeric-variance trap: SatNews's
  own Oct. 22 "reassigns six missions" headline reads as a single fresh transfer, but a differently-angled
  trade outlet reporting the same underlying Oct. 21 briefing can reveal the number is actually a running
  cumulative tally (six total since an April GPS III launch) the first outlet's framing never flagged as
  such. Attributed the cumulative framing explicitly to NewSpace Economy rather than picking one reading
  as fact.
- 2026-10-25-D: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on three dedup-heuristic
  matches at once (two false-positive company+category collisions on the FCC spectrum item against
  unrelated Starbase/Boca Chica land-use items, both needing `dedup_distinct`; the genuine same-event
  Space Force match above, resolved by converting that item to an update); merged cleanly on the second
  attempt ("merged 3 new, 3 updated, 0 held"). Confirmed via a direct `jq` read of all three new items'
  `snr`/`category`/`impact` fields (1037 items, up from 1034), all three updated items' grown
  `sources`/`updates` arrays, and a `jq empty` parse check across all touched data files. `bun run build`
  was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6.5h gap, unfiltered full source list (2026-10-25, second)

- 2026-10-25-E: Google News RSS redirect URLs still failed to resolve via WebFetch this entire run
  (every attempt returned a bare "Google News" header, no redirect target, no article content),
  extending 2026-10-25-A's observation from earlier today into a second consecutive run; this now
  reads as a same-day outage rather than a one-off. WebSearch-plus-direct-outlet-URL remains the
  working fallback for any Google News-sourced queue lead.
- 2026-10-25-F: A genuinely new, on-scope story (Starlink enforcing a new travel-registration
  requirement against South African roaming users, Oct. 23, tied to the standing ICASA/BEE
  30%-ownership licensing deadlock) had every fetchable mirror (African Insider, News Directory 3,
  Shattered.io) explicitly crediting MyBroadband as the original reporter, while mybroadband.co.za
  itself 403'd on every direct WebFetch attempt; tech-insider.org also 403'd. Published anyway at an
  honest low SNR (informal base, `corroboration_2plus` off two separately-fetched mirror pages) per
  the standing weak-sourcing-is-never-a-hold-reason rule, rather than held or dropped for lacking a
  genuinely independent (non-MyBroadband-derived) second source. Worth remembering a cluster of
  mirrors that all name the same unreachable original is still honestly `found_some`, not
  `found_none`, as long as the mirrors are separately-fetched pages, even when none of them did
  independent reporting.
- 2026-10-25-G: A whitelisted signal's Bluesky post pointing at their own blog (yeandel.bsky.social's
  "sovereign cloud... extendable to Canada" teaser) led to a thin but real enrichment: OVHcloud's own
  press release (corporate.ovhcloud.com, no registry organization entity, classed `wire_pr` per the
  standing 2026-10-06-W precedent since `first_party` can't pass the anti-spoof check without a
  matching registry domain) states the already-published Sept. 28 ESA Digital EO platform "will have
  the capability to extend to other European countries and Canada," a detail the original draft's
  Techzine-led sourcing never carried. Patched with no bump (new fact, not better sourcing of the
  existing claim).
- 2026-10-25-H: A Chinese human-spaceflight agency's payload call for an uncrewed Lanyue lunar-lander
  test flight (via Andrew Jones' bluesky feed, confirmed genuinely undrafted via SpaceNews) was judged
  out of scope: unlike NASA's Artemis program, China's crewed-lunar effort has no named commercial
  prime or contractor benefiting from the announcement, and CLAUDE.md's human-spaceflight carve-out
  is explicitly scoped to programs "where contracts and outcomes affect commercial providers." Treated
  as the same institutional-disclosure-with-no-commercial-angle exclusion as SPACECOM succession/NASA
  STRIDE, not extended just because China coverage is a named priority.
- 2026-10-25-I: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 1 new, 1
  updated, 0 held"); confirmed via a direct `jq` read of the new South Africa item's `snr`/`snr_trace`
  (informal base 1, `corroboration_2plus` to 2) and the updated OVHcloud item's grown `sources` array
  (3 sources, 1 update, SNR unchanged at 4), the item count moving from 1037 to 1038, and a `jq empty`
  parse check across all touched data files. `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~3h49m gap, unfiltered full source list (2026-10-25, third)

- 2026-10-25-J: WebFetch on `bsky.app/profile/<handle>` profile pages renders no post content at all
  (just the handle string, same empty-JS-shell failure pattern as other social platforms) for every
  signals-pass fetchable Bluesky channel tried this run. The working fallback: fetch the public AT
  Protocol endpoint directly, `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=15`,
  which returns real post text and `createdAt` timestamps and worked for all nine handles tried
  (Aschbacher, Langbroek, Henry, Farrar, Berger, Foust, SpacePolicyOnline, Zak, Jones, Parsonson).
  Worth using this endpoint by default for the Bluesky leg of the signals pass instead of the
  `bsky.app` profile URL.
- 2026-10-25-K: Musk's own X post confirming SpaceX had closed the previously-"seeking" $40 billion
  Apollo/Goldman-led Nvidia GPU debt financing (first reported Oct 6 as a plan facing pricing
  resistance per a 2026-10-24 update) surfaced via Reuters wire copies (aol.com, 1027wbow.com) rather
  than the Google News redirect, consistent with the redirect outage flagged 2026-10-25-A/E; folded in
  as an `attach`+`patch` (headline/tagline updated from "seeks" to "closes") with no bump, since the
  item's mainstream/corroboration/persistence modifiers already capped it at 4.
  Separately, a cluster of PTI-wire rewrites (ThePrint, Tribune, ETV Bharat, Daily Excelsior, Siasat,
  Daily Pioneer) all carrying identical Narayanan quotes about four ISRO launch pads by 2029 drafted
  as a new item; attested `crawl: "found_none"` despite the many mirrors, since none were independent
  of the one PTI piece, netting a mainstream base of 3 up to 4 on `corroboration_2plus` and back down
  to 3 on the found_none penalty, consistent with the state-media-pair precedent (2026-10-24-G): many
  copies of one wire source is not corroboration.
- 2026-10-25-L: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 1 new, 2
  updated, 0 held"); confirmed via a direct `jq` read of the new ISRO item's `snr`/`snr_trace` (mainstream
  base 3, +1/-1 modifiers netting back to 3) and both updated items' grown `sources`/`updates` arrays
  (SpaceX GPU financing: 5 sources, 3 updates, SNR unchanged at 4; Starlink/Ukraine saga: 73 sources, 29
  updates, SNR unchanged at 4), the item count moving from 1038 to 1039, and a `jq empty` parse check
  across all touched data files. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~8h11m gap, unfiltered full source list (2026-10-26)

- 2026-10-26-A: Marco Langbroek's bluesky feed carried "SpaceX wins $28.7M contract from Air Force for
  data connectivity research" with no visible date in the post itself; a direct search traced the
  underlying GeekWire piece to December 2018 (the DEUCSI program), not a same-day event. Worth checking
  a signals-pass repost/HT with no obvious timeframe against its underlying source's own publish date
  before treating it as news, distinct from the standing stale-PR-recycled-under-a-new-pageload-date
  pattern (2026-10-22-M): here the repost carried no date at all, not a misleading one.
- 2026-10-26-B: A near-total-junk ~110-candidate queue (SpaceX/Tesla-merger and Q3-earnings stock-reaction
  spam, SpaceX $40B Apollo/Nvidia debt-financing rehash already closed and published 2026-10-06, dozens of
  ISRO "four launch pads by 2029" Narayanan-quote pickups already published 2026-10-25, the Starlink/
  Ukraine saga's restrictions-lifted and Reuters historical-pressure angles both already folded in via
  2026-10-24/25 updates) still yielded four genuinely new items: Astranis's Falcon 9 contract upgrade to a
  dedicated Block 4 GEO mission (SpaceNews lead, a Business Wire mirror of the same underlying release as
  corroboration, landing SNR 3); EarthDaily's own $3M NASA Landsat-benchmarking task order (first_party,
  single-sourced at SNR 5, only wire-syndication mirrors existed independently); Australia's formal ESA
  counteroffer for Katherine Bennell-Pegg's ISS seat (europeanspaceflight.com trade lead, ABC News
  corroboration, SNR 4, dated on the actual Oct 23 submission rather than the Oct 26 article date); and
  EasyJet's fleet-wide Starlink Wi-Fi commitment (paxex.aero, the aviation-connectivity trade outlet, as
  lead over several informal aviation blogs, SNR 4). All four needed `dedup_distinct` against unrelated
  same-company-plus-category items within 7 days (Astranis/SpaceX against three separate Falcon 9 stories;
  Bennell-Pegg against the Artemis III/IV mission-plan briefing, both SpaceX+human-spaceflight; EasyJet
  against the Crown Castle cell-tower story, both SpaceX+partnership), extending the standing heuristic
  pattern to a fresh batch.
- 2026-10-26-C: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 4 new, 0
  updated, 0 held"); confirmed via a direct `jq` read of all four new items' `snr`/`category`/`impact`/
  `sources` fields (1043 items, up from 1039), the sweep log's summary, and a `jq empty` parse check across
  all touched data files (items, held, state, sources, source_ledger, candidates). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~3.5h gap, unfiltered full source list (2026-10-26, second)

- 2026-10-26-D: A ~73-candidate queue was almost entirely SpaceX/Tesla-merger stock-market chatter
  (dozens of Yahoo Finance/Motley Fool/Business Insider pieces on the $40B Apollo GPU financing "close",
  already published 2026-10-25, and pure speculation pieces about a Tesla/SpaceX merger that are not
  attributable company events) plus a dense rehash of the Starlink/Ukraine speed-restriction saga: every
  "new" angle in the queue (Musk's "loophole closed" admission, Ukraine's denial via Beskrestnov/
  Sternenko, the 400 km/h restoration, Trump's "he put it back") was already folded into
  `2026-10-14-spacex-starlink-ukraine-speed-restriction`'s existing updates through Oct 25 almost
  verbatim; fetching CBS News, NBC News and an investing.com Reuters wire copy directly confirmed this
  rather than surfacing anything new, so no update was drafted. Worth checking a saga item's full
  `what_happened` text for a quote before spending a corroboration fetch chasing it as "new."
- 2026-10-26-E: A whitelisted signal's own site, not a Bluesky post, carried the sweep's best find: Anatoly
  Zak's russianspaceweb.com running 2026 launch-schedule log (page anchor, not a dated article) stated
  that Zvezda's leaking Transfer Chamber (PrK) will be permanently closed starting with the Progress
  MS-36 mission (planned Nov 24), a detail no other outlet carried despite a targeted search (only vaguer
  pre-2026-08 "reportedly planning to" coverage existed). Classed `whitelist`/`observer` (floor 4) since
  Zak reports on Roscosmos rather than speaking for it; `crawl: "found_none"` did not pull the score below
  the floor per the scorer's `whitelist_floor` modifier. Worth remembering that a specialist's own
  reference/schedule page, not just their dated posts, can be the actual news source behind a signals-pass
  repost.
- 2026-10-26-F: A Bluesky post from a Euractiv journalist's own handle ("EU eyes Canada joining Europe's
  Starlink alternative, IRIS²," linking an exclusive rapporteur.com piece) was judged too thin to draft:
  rapporteur.com 403'd on every WebFetch attempt (direct, URL-decoded, and via an r.jina.ai reader proxy,
  which hit a CAPTCHA wall instead), and the only verbatim text available was the one-sentence post itself.
  Broader web search surfaced what the underlying story actually is (an EU Cloud and AI Development Act
  "sovereign cloud" label being discussed for Canadian cloud providers, with IRIS² membership only a
  tangential mention) via other outlets' independent coverage, but using those facts would have meant
  citing claims not in the one source actually fetched. Dropped rather than drafted from search-result
  synthesis of pages other than the cited one.
- 2026-10-26-G: `bun scripts/finalize-sweep.ts` rejected the first two draft attempts on the Zvezda item's
  tagline exceeding the 140-char cap (160, then 144, then 142 chars after two trims) before a third trim
  passed at under 140; merged cleanly on the third attempt ("merged 2 new, 0 updated, 0 held"). Confirmed
  via a direct `jq` read of both new items' `snr`/`snr_trace`/`category`/`impact` fields (mainstream base
  3 to 4 on 2-source corroboration for the Korea item; whitelist base 3, found_none -1, whitelist_floor
  +2 netting 4 for the Zvezda item), the item count moving from 1043 to 1045, and a `jq empty` parse check
  across all touched data files. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~5.5h gap, unfiltered full source list (2026-10-26, third)

- 2026-10-26-H: A ~75-candidate queue, heavily dominated by SpaceX/Tesla-merger stock-reaction pieces
  (Yahoo Finance/Motley Fool/Seeking Alpha/TheStreet chatter about the already-closed $40B Apollo GPU
  financing) and dozens of Bluesky "spacex launch" search hits anticipating that evening's record-setting
  Falcon 9 flight, still yielded five genuinely new items via careful triage rather than discarding the
  whole queue as noise: a SEALSQ/WISeSat.Space $15M satellite-capacity LOI (found via a Bluesky
  "satellite constellation" search hit, not the SpaceX-focused searches), an ST Engineering
  iDirect/MBSat Oman ground-network partnership, a Flexell Space French subsidiary (noise), a Vermilion
  Parish, Louisiana open-meetings lawsuit targeting the Starbase Louisiana tax deal, and a SpaceX FCC
  filing backing NextNav's 900 MHz petition. Both SEALSQ's and WISeSat's own-domain press releases on
  this deal classed `wire_pr` (tier 4), not `first_party`, per the standing 2026-10-06-W/2026-10-25-G
  precedent: neither company has a registry organization entity for the anti-spoof domain check to pass
  against, so even an own-domain release caps at wire_pr.
- 2026-10-26-I: The Vermilion Parish lawsuit and the SpaceX/NextNav 900 MHz filing each triggered FOUR
  separate same-company-plus-category dedup heuristic collisions against unrelated SpaceX regulatory
  items (Boca Chica state park land sale, Tristar AWS-3 spectrum, carriers' spectrum opposition, South
  Africa roaming lockout) on the first finalize attempt; all four needed `dedup_distinct` entries on
  each item (not just one) before the draft passed, since the heuristic fires once per matching existing
  item, not once per draft item. Worth expecting a prolific regulatory actor like SpaceX to collide with
  several unrelated same-category items at once, not just the single most-obviously-related one.
- 2026-10-26-J: `locationbusinessnews.com` and `findcheapbroadband.com` both looked like plausible
  corroboration for SpaceX's Oct. 23 FCC 900 MHz filing on first search hit, but both predated it by
  months (August filings on a related but distinct NextNav angle); fetched and dated-checked before
  use, correctly excluded, and the Oct. 23 filing itself was left `crawl: "found_none"` since its only
  coverage was one wire-style piece (Yahoo Finance) mirrored byte-identically on Stocktwits/TradingView/
  Asianet. Worth re-confirming a search hit's own publish date before treating it as corroboration of a
  specific dated filing, not just its topical match.
- 2026-10-26-K: The full fetchable signals-channel pass (13 of 17 channels, 3 duplicate bsky-profile
  entries skipped for people already covered via their primary site/substack) and a 6-handle X search
  surfaced nothing new in this narrow window; `mainenginecutoff.com` fetched cleanly this run (no new
  episode since Sept 29), resolving the "retry next sweep" flag from 2026-10-24-I as a one-off, not a
  dead source. `aviationweek.com/author/vivienne-machi` 403'd.
- 2026-10-26-L: `bun scripts/finalize-sweep.ts` rejected the first three draft attempts (a 148-char
  tagline; four unattested same-company dedup collisions per -I above; two more taglines over 140 after
  trims) before a fourth attempt passed; merged cleanly ("merged 5 new, 2 updated, 0 held"). Confirmed
  via a direct `jq` read of all five new items' `snr`/`impact`/`category` fields (1050 items, up from
  1045), both updated items' grown `sources`/`updates` arrays (GPU financing: 6 sources, 4 updates, SNR
  unchanged at 4; Starfall second flight: 6 sources, 3 updates, SNR unchanged at 4), and a `jq empty`
  parse check across all touched data files. `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~6h12m gap, unfiltered full source list (2026-10-27)

- 2026-10-27-A: A secondary source covering Cowboy Space's genuinely-new Oct. 26 "Big Iron" rocket
  reveal (Payload, a Business Wire release) also restated the company's $275M Series B/$2B valuation
  as if current; a dedicated follow-up search showed that round closed in May 2026, five months
  stale, and was left out of the draft entirely. A new flavor of the stale-resurfacing trap: the
  SURROUNDING article is genuinely fresh and worth drafting, but a background figure embedded inside
  it can still be old; check every dollar figure's own date, not just the article's dateline, before
  copying it into a new item.
  - PCMag, SDxCentral, Benzinga (direct), RCR Wireless, Mobile World Live, PhoneArena, and
  driveteslacanada.ca all 403'd on direct WebFetch this run; Yahoo Finance's Benzinga-syndication
  mirror and TheNextWeb worked as fetchable, independently-written substitutes for the same CEO
  commentary story (Verizon's Dan Schulman on SpaceX/Starlink Mobile's buildout timeline), extending
  the standing wire/syndication-mirror-attribution pattern. A Motley Fool (fool.com) earnings-call
  transcript again worked cleanly as a `trade`-class primary-ish quote source for a CEO's own words
  (extends the 2026-10-22-U Crown Castle precedent to Verizon's Q3 2026 call).
- 2026-10-27-B: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 3 new, 1
  updated, 0 held"); confirmed via a direct `jq` read of all three new items' `snr`/`category`/
  `impact`/`kind` fields (1053 items, up from 1050), the updated United item's grown `sources`
  (3)/`updates` (1) arrays, and the sweep log's two unrelated persistence-bump `snr_movements`
  entries. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4.6h gap, unfiltered full source list (2026-10-27, second)

- 2026-10-27-C: A Payload "This week" framing on OSMOS X's EDF-backed Tactical-Capture (TAC)
  consortium read as a fresh contract award but traced, via the consortium partner Poznan
  University of Technology's own announcement and a Starburst piece, to an April 17, 2026
  selection decision, over 6 months stale; OSMOS X's own site confirms the same partner list and
  30-month duration with no distinct October signing/kickoff date stated anywhere. Left undrafted
  per the standing stale-resurfacing pattern rather than trust a trade outlet's own "this week"
  framing against three independent sources dating the underlying award months earlier.
- 2026-10-27-D: The Guardian (theguardian.com) is now unfetchable directly via WebFetch (joins the
  standing ft.com/wsj.com/axios.com/reuters.com/arstechnica.com list); two mirrors that explicitly
  credit it by name (ua.news, democracynow.org) worked as citable `mainstream`-class corroboration
  for a story (SpaceX's classified DoD tracking-data access) originally sourced to Breaking
  Defense's Sept. 23 "sources say" report, landing a clean `mainstream_pickup` bump (3 to 4).
- 2026-10-27-E: A Polish GPW-listed company's own ESPI stock-exchange disclosure (here, Scanway's,
  mirrored on parkiet.com) still classes `trade`, not `official_record`/`first_party`, per the
  standing 2026-10-02-G Creotech precedent; landed a clean SNR 4 anyway alongside two independently-
  written trade pieces (Space24.pl, SatNews) on Scanway's MoU expanding its Pixxel partnership,
  since three distinct `trade`-class sources alone clear `corroboration_2plus`.
- 2026-10-27-F: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 1 new,
  4 updated, 0 held"); confirmed via a direct `jq` read of the new Scanway/Pixxel item's
  `snr`/`snr_trace`/`category`/`impact` fields (1058 items, up from 1057), all four updated items'
  `snr`/`sources`/`updates` fields (DoD tracking data 3→4, carriers/FCC spectrum 2→3, both via
  genuine bumps; Starlink/Ukraine and SpaceX/Tesla merger unchanged at their ceilings), the sweep
  log's two `snr_movements` entries, and a `jq empty` parse check across all touched data files.
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h24m gap, unfiltered full source list (2026-10-27, third)

- 2026-10-27-G: The `public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed` endpoint, the
  standing workaround for the bare `bsky.app/profile/<handle>` page returning no post
  content, itself returned a flat HTTP 403 for every one of the 10 fetchable bluesky
  accounts this run (confirmed on several handles and both the `getAuthorFeed` and
  `getProfile` XRPC methods) -- a new, total-block failure distinct from the standing
  blank-profile-page and stale-cache issues. No alternate working route was found this
  run; treated all 10 accounts as checked-but-unreachable in `signalsPass` rather than
  silently dropping them. Worth retrying the API endpoint first on the next sweep before
  assuming it's a permanent block.
- 2026-10-27-H: Two genuinely new items cleared despite a queue almost entirely consumed
  by SpaceX/Tesla-merger stock-reaction spam and Starlink/Ukraine-saga rehash: Ukrainian
  startup Himera and Denmark's GomSpace confirmed their Obria Nano test satellite
  (launched Oct. 1 on Transporter-18) is operating in orbit, the first step toward a
  sovereign Ukrainian comms constellation; and the Pentagon's Office of Strategic Capital
  signed a $150 million conditional loan with Stoke Space for a second Cape Canaveral
  launchpad, found via Sandra Erwin's recent-bylines (an xSearch WebSearch, not a direct
  feed) after the SpaceNews article itself was paywalled beyond a teaser -- Air & Space
  Forces Magazine and a Department of War release mirror (newsroomamerica.com) gave the
  full figures and quotes. Neither company nor program had been drafted by any prior
  sweep.
  - A same-day Via Satellite piece on ESA's Oct. 23/26 Galileo G2 contracts (already
  published same-day from ESA's own first-party release) still carried a genuinely new
  fact set -- a 2028 first-launch target for the G2 satellites, the current 36-satellite
  operational count, and an ESA quote -- folded in as a no-bump enrichment patch, same
  shape as the standing "re-read a same-day source for a missed detail" pattern.
  - United's own Oct. 22 Kirby/Musk exchange (already captured same-day) picked up a
  further-escalated framing the next sweep missed: Kirby calling Delta's choice of Amazon
  Leo over Starlink "a mistake" to a podcast, with updated fleet (661 aircraft) and
  passenger (5.4 million in September) figures, sourced to TeslaNorth and Teslarati since
  the original "Cheeky Pint" podcast substack 403'd on direct fetch.
  - `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 2 new, 3
  updated, 0 held"); confirmed via a direct `jq` read of both new items' `snr`/`category`/
  `impact` fields (1060 items, up from 1058) and all three updated items' grown `sources`
  arrays. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6h19m gap, unfiltered full source list (2026-10-28)

- 2026-10-28-A: The `public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed` endpoint, flat
  403'd for every handle on 2026-10-27-G, worked cleanly again this run for all 10 bluesky
  signals accounts tried; the 403 reads as a transient same-day block, not a lasting change.
  Worth retrying it first each run per the standing practice rather than assuming yesterday's
  block persists.
- 2026-10-28-B: A near-total-junk ~27-candidate queue (Google News Starlink/Ukraine-saga and
  SpaceX-Tesla-merger-speculation rehash, routine Bluesky launch-reaction chatter, off-topic
  BBC/CGTN filler) and a fully clean 17-channel signals pass traced entirely to already-
  published ground; both genuine finds came from the discovery pass's M&A leg: the FCC's
  October 27 order (DA 26-1160) approving Amazon's transfer of Globalstar's satellite
  licenses, clearing the regulatory path for the April-announced $11.57B acquisition to
  close, and Scott Galloway's Oct 26 Prof G Markets podcast commentary on the Tesla-SpaceX
  merger speculation thread (a new named-voice angle distinct from the bank-analyst notes
  already published). The FCC order's own PDF fetched as binary garbage via WebFetch's
  text-extraction pass but parsed cleanly once the Read tool was pointed at WebFetch's
  auto-saved local copy (per the standing 2026-10-24-B workaround), giving a clean
  official_record SNR 5 lead with the exact docket number, conditions, and deal figures.
- 2026-10-28-C: A UL Lafayette/Pecan Island property story (donors supporting a sale to
  SpaceX) surfaced via the Google News queue turned out to be two separate, genuinely new
  facts once chased: the UL System board's Oct. 22 approval of a 40-year, $1-a-year lease
  (via a nonprofit sublease to SpaceX, improvements in lieu of rent) ahead of the land's
  planned 2027 purchase, folded into the long-running Starbase Louisiana item as a no-bump
  attach+patch; and a residents' Open Meetings Law lawsuit over the Aug. 25 PILOT deal,
  which turned out to already be fully published as its own item
  (`2026-10-26-vermilion-parish-spacex-tax-deal-lawsuit`) from the day before. Worth
  grepping `items.json` for each distinct sub-story a bundled local-news lead touches,
  not just the most prominent one, before drafting or patching.
- 2026-10-28-D: An Israeli ad-tech firm (Discover-Tech) allegedly using ad networks to track
  Starlink terminal locations for surveillance purposes (Citizen Lab/Trend Micro research,
  widely covered via Reuters) was judged out of scope and left undrafted: it is a
  cybersecurity/surveillance story about spyware targeting Starlink's user base, not a fact
  about Starlink's own commercial operations, contracts, or regulatory status, and no
  operator or government statement on the record ties it to a market-moving consequence.
  Flag for Florian if a future sweep finds SpaceX or a government responding on the record,
  which would change the calculus the way the orbital-safety-incident carve-out does for
  debris.
- 2026-10-28-E: A single-source lead (Kiko Dontchev's own remarks at an Oct. 21 public event
  disclosing a six-week Florida Falcon 9 gap ahead of Starship's first KSC launch) was left
  undrafted despite a verbatim-confirmed X post (via the syndication endpoint): the only
  other coverage was two flagged SEO-mill sites (tech-insider.org, shattered.io) and a
  403'd substack, with no trade-press pickup found after two searches. Worth a same-topic
  re-check once a trade outlet covers it, rather than publishing on a single X repost alone
  when cheaper, cleaner sourcing is likely to surface soon given the story's profile.
- 2026-10-28-F: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the
  standing same-company-plus-category dedup heuristic (the Galloway commentary item against
  the unrelated `2026-10-20-spacex-q3-2026-earnings` release, sharing only company SpaceX +
  category financial); one more `dedup_distinct` entry cleared it on the second attempt
  ("merged 2 new, 1 updated, 0 held"). Confirmed via a direct `jq` read of both new items'
  `snr`/`snr_trace`/`category`/`impact`/`kind` fields (1062 items, up from 1060), the
  updated Starbase Louisiana item's grown `sources` (17, up from 15) and `updates` (9, up
  from 8) arrays, and the sweep log's two unrelated persistence-bump `snr_movements`
  entries. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~8h gap, unfiltered full source list (2026-10-28, second)

- 2026-10-28-G: A WebSearch-surfaced "Google to pay SpaceX $920 million a month" wave
  (TechRepublic, DataCenterDynamics, TheNextWeb, tech-insider.org, all reading as live and
  tagged "[2026]") traced on direct fetch (TheNextWeb) to a June 6, 2026 SpaceX SEC filing,
  made public one week before the company's June 12 IPO; the figure was already background
  in the already-published Sept. 10 `spacex-ai-compute-deal-1-1b-monthly` item ("previously
  disclosed compute deals with... Google ($920 million a month)"). A new flavor of the
  stale-resurfacing trap: multiple independently-domained outlets all describing the filing
  as "ahead of SpaceX's anticipated IPO" five months after that IPO actually happened, each
  apparently republishing or paraphrasing the same stale piece without noticing the company
  already went public. Left entirely undrafted.
- 2026-10-28-H: A same-day FAA comment-period closing (SpaceX's own filing on the Aug. 25
  `faa-spaceport-launch-corridor-rfi` docket, arguing it alone expects 10,000 launches/year
  and that outdated air traffic control, not rocket cadence, is the real bottleneck) is an
  `updates[].patch`+`attach` on that 2-month-old RFI item, not a new item, since it's SpaceX's
  comment on the exact docket the RFI item already covers; caught by checking the RFI's own
  content before drafting a "SpaceX tells FAA" item from a Google-News/Dealroom headline that
  read standalone. regulations.gov itself 403'd on every WebFetch attempt (including the
  docket landing page); TeslaNorth and WCCFTech, both fetched directly, gave the full figures
  (182 launches/7 reentries in 2025, Cape Canaveral's 450/year capacity claim, the docket
  number FAA-2026-9736-0263) without needing the primary filing.
- 2026-10-28-I: A routine Starlink batch (B1082's 26th flight, Group 15-16, 27 satellites,
  Oct. 27 from Vandenberg) that looked like a same-day queue-sourced gap (a KeepTrack "B1082
  Flies Starlink Group 15-16" headline plus a Florida Today trend piece on California
  overtaking Florida in launch counts) turned out to already be published same-day as
  `2026-10-27-spacex-starlink-15-16-b1082-26th-flight`; caught by grepping `items.json` for
  recent SpaceX+`launch`-category items by date before drafting, not just by booster/mission
  name. Worth the reminder on a fast-moving cadence story: check the last 5-7 days of a
  frequent actor's same-category items by date range, not just a title/company grep, since a
  routine batch's id rarely names the booster or group number the way a search headline does.
- 2026-10-28-J: South Korea's KASA/KAIST active debris removal satellite (ADR-SAT) readiness
  review and assembly start (Oct. 26-27, target KITSAT-3, 2027 Nuri-6 launch) is a genuine new
  gap neither the queue nor a Google-News non-US query surfaced; found via a dedicated
  discovery-pass search once the queue's own "KASA begins assembly... Nuri-6" Google News
  entry pointed at the right program name. Korea Times named the target "KITSAT-3" while
  Herald Business named it "Woori-byeol 3"; these are the same satellite (Woori-byeol, "Our
  Star," is KITSAT's Korean public name), not a contradiction, worth remembering before
  treating two Korean-sourced outlets naming a spacecraft differently as a same-metric
  conflict.
- 2026-10-28-K: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on a
  `bump: "corroboration_2plus"` request on the Rassvet sanctions item, which already carried
  that exact modifier from an October 3 update (modifiers saturate, confirmed again per the
  2026-10-07-O mechanism); dropping the bump and submitting the HUR-supply-chain enrichment as
  a plain `attach`+`patch` (the item was already at its persistence-capped ceiling of 4)
  merged cleanly on the second attempt ("merged 6 new, 2 updated, 0 held"). Confirmed via a
  direct `jq` read of all six new items' `snr`/`category`/`impact` fields (1068 items, up from
  1062) and both updated items' grown `sources`/`updates` arrays (FAA RFI: 4 sources, 1 update;
  Rassvet sanctions: 6 sources, 3 updates). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6h19m gap, unfiltered full source list (2026-10-28, third)

- 2026-10-28-L: Two identically-titled Vietnamese outlets (VietnamPlus, Saigon Giai Phong, both
  headlined verbatim "Vietnam joins Artemis Accords on space exploration") title-collapsed as a
  `wire_rewrite` at finalize despite being two distinct state-media domains, netting the item a
  mainstream base of 3 with no corroboration bump rather than the 4 two genuinely independent
  mainstream sources would have earned; worth remembering a near-identical headline across two
  outlets is a real risk when citing state-affiliated press that runs the same wire text in
  English, not just when a single outlet's story is mirrored on other domains.
- 2026-10-28-M: Dating a debris item on its actual reentry date, not the sweep date, matters for
  the same-company-plus-category dedup gate: a LandSpace Zhuque-2E upper-stage reentry over
  Indonesia (debris recovered in Sampit, Central Kalimantan, Oct. 18) sits only 4 days from the
  already-published Sept.-15-launch Minnesota cornfield debris item (both company LandSpace,
  category incident) because both are dated close together even though the two reentries are 5
  weeks apart in real time; attesting `dedup_distinct` with each item's own launch date cleared
  it cleanly on the second attempt.
- 2026-10-28-N: A Google-News/queue-dominant day (SpaceX stock and Tesla-merger reaction, ISRO's
  Oct. 30 NVS-03 preview, Starlink/Ukraine-saga rehash) still yielded four new items once each
  queue/signals lead was chased past the headline: Flexell Space/Satoro's in-orbit solar cell
  demo deal (SpaceNews, single-sourced, honest `found_none`), Reflect Orbital's unannounced
  ground spotlight test near Lone Pine that drew astronomer alarm (Leonard David leading, Hoodline
  and Futurism corroborating, three outlets giving different framings of the same facts worth
  attributing separately rather than picking one), Vietnam's Artemis Accords signing (found via
  Marcia Smith's bluesky, no number-of-signatory claim made since no directly-fetched source
  stated it, only a WebSearch synthesis did), and the LandSpace debris incident above. Four
  updates folded in: SpaceX's reported talks to acquire ~4,000 acres of Vermilion Parish School
  District land (single-sourced local TV, no bump, still drafted per the standing weak-sourcing
  rule); Anthropic's own public S-1 revealing the real SpaceX compute figure is $120.5B, not the
  $84.5B from the earlier confidential-draft leak; Fitch's rating note confirming the $40B GPU
  lease doesn't move SpaceX's BBB+ rating, with the same note disclosing SpaceX's $89.9B cash
  position; and American Tower's CEO becoming the second tower-company executive (after Crown
  Castle) to say on an earnings call he expects to be approached if Starlink builds a US network.
  `bun scripts/finalize-sweep.ts` rejected the first attempt on the Minnesota-debris dedup
  collision above, and a second attempt on one update tagline at 144 chars; merged cleanly on
  the third attempt ("merged 4 new, 4 updated, 0 held"). Confirmed via a direct `jq` read of all
  four new items' `snr`/`category`/`impact` fields (1072 items, up from 1068), all four updated
  items' grown `sources`/`updates` arrays, and the sweep log's `corroboration_collapses` entry
  for the Vietnam title-collapse above. `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~5h17m gap, unfiltered full source list (2026-10-28, fourth)

- 2026-10-28-O: Vivienne Machi's Aviation Week author page (403'd on 2026-10-26) fetched cleanly this
  run and surfaced three same-day (Oct. 28) bylines; two traced to already-published ground (CASR
  contracts, the rideshare/launch-market trend piece) but the third was the ULA Vulcan return-to-flight
  story, independently confirmed via the mandatory HTML/queue legs anyway. Worth treating a 403 on this
  author page as transient, not permanent, consistent with the pattern on other outlets.
  A genuinely new item surfaced from a discovery-pass JAXA query despite predating the sweep window by
  6 days: ispace's own Oct. 22 release on a JAXA "Lunar Solar Power Tower" conceptual-design contract had
  no queue/signals hit across several intervening sweeps; chased per the standing predates-window rule
  and dated on the actual Oct. 22 announcement. Neither ispace (Japan) nor Virgin Galactic has a
  `src/data/registry` organization entity, so both companies' own-domain releases (ispace-inc.com,
  virgingalactic.com) classed `wire_pr`, not `first_party`, per the standing 2026-10-06-W/2026-10-25-G
  no-registry-entity precedent, capping both items at SNR 4 despite being genuinely the actor's own site.
- 2026-10-28-P: A crossfeed attestation on `vulcan.next_flight_date` (Nov. 13, from trade/mainstream
  sources landing SNR 3 pre-dispute) tied against the registry's existing canonical LL2-sourced value
  (Dec. 31 placeholder, tier 4) as a genuine same-metric SNR conflict: both sides got marked disputed
  (the item's SNR dropping 4→3 via the `dispute` modifier) and the crossfeed fact queued to `held.json`
  for Florian per SNR_SPEC 6, while the news item itself still published normally (held.json holds the
  crossfeed dispute, not the item). Worth remembering a specific announced date beating a vague
  registry placeholder on `next_flight_date` doesn't auto-win since the registry's aggregator-sourced
  claim is still tier 4; a true same-metric tie between two tier-4-class claims disputes rather than
  overwrites, exactly as SNR_SPEC intends.
- 2026-10-28-Q: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 4 new, 1
  updated, 1 held"); confirmed via a direct `jq` read of all four new items' `snr`/`category`/`impact`
  fields (1076 items, up from 1072), the Terrestar/Equatys update's grown `sources` (3) array, the new
  `held.json` entry for the Vulcan `next_flight_date` crossfeed tie, and a `jq empty` parse check across
  all touched data files (items, held, state, sources, source_ledger, candidates, the Vulcan registry
  file, registry-candidates). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~6h10m gap, unfiltered full source list (2026-10-29)

- 2026-10-29-A: A ~35-candidate queue almost entirely consumed by SpaceX/Tesla-merger stock
  speculation, Starlink/Ukraine-saga rehash, and future-dated launch previews (ISRO NVS-03 Oct. 30,
  USSF-432 slipped to Nov. 1-2) still required chasing six distinct leads before confirming only one
  was genuinely new: easyJet's Starlink Wi-Fi deal, the carriers-vs-FCC 482 MHz spectrum fight, the
  Minnesota-cornfield debris recap, and the Cosmos 2612/ICEYE-X36 saga (fetched TWZ and Militarnyi
  directly looking for a "consistent with an on-orbit weapons operation" DoD quote a WebSearch
  synthesis attributed to no one in particular) all turned out to already be fully published,
  several with more detail than the fresh search results carried. Worth the reminder that a
  WebSearch synthesis asserting a government quote is not the same as that quote appearing in a
  directly fetched page; two direct fetches here (TWZ, Militarnyi) confirmed the item's real content
  and that nothing needed to change.
- 2026-10-29-B: An Austin attorney's intervention in SpaceX's Texas public-records suit over Terafab
  (KXAN's "Austin attorney joins lawsuit" headline, the queue's actual trigger) could not be drafted:
  kxan.com 403'd on every WebFetch attempt including an r.jina.ai proxy, and no other outlet directly
  fetched covered that specific Oct. 28 filing, only WebSearch syntheses of the blocked KXAN page.
  Per the standing 2026-10-26-F precedent, dropped the intervention claim itself, but the underlying
  SpaceX-vs-Paxton/Grimes-County lawsuit it referenced turned out to be a genuine month-and-a-half-old
  gap (filed Sept. 8, never drafted) once three *other* directly-fetched outlets (ENR, Spectrum Local
  News, KBTX) independently confirmed the filing, court, and $119B four-phase Terafab buildout figures;
  published dated on the actual Sept. 8 filing per the predates-window chase rule. Backdating a new
  item 7 weeks tripped the same-company-plus-category dedup heuristic against three unrelated SpaceX
  regulatory items from that same week (FCC high-cost-fund sunset, Senegal license suspension, the
  Starlink Roam billing lawsuit); three `dedup_distinct` entries cleared it on the second attempt.
- 2026-10-29-C: The bare `bsky.app/profile/<handle>` page continues to return nothing but the handle
  itself on WebFetch (confirmed again across 6 profiles this run); the
  `public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=15` endpoint worked
  cleanly for all of them, including returning months-stale feeds for accounts that just don't post
  often (Eric Berger's account, e.g., returned nothing newer than June 2026). Keep defaulting straight
  to the API endpoint rather than the bare profile URL.
- 2026-10-29-D: `bun scripts/finalize-sweep.ts` merged cleanly on the second attempt (after adding the
  three `dedup_distinct` entries above) with "merged 1 new, 1 updated, 0 held". Confirmed via a direct
  grep read of the new Terafab item's `snr`/`snr_trace`/`category`/`impact` fields (1077 items, up from
  1076, SNR 4 off a trade base plus 3-source corroboration) and the Starshield item's new `updates[]`
  entry recording the Pentagon IG's refusal to investigate. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update; full `jq`/`node -e` ad-hoc validation was unavailable in this
  session's sandbox (only the mandated `bun scripts/*.ts` commands and plain `grep`/`sed`/`read` ran
  without an approval prompt), so file integrity was checked via `grep`/`Read` spot-checks instead.

## Narrow re-check, ~8h16m gap, unfiltered full source list (2026-10-29, second)

- 2026-10-29-E: A company's own official X/Twitter account (here, @Starlink) still cannot pass the
  `first_party` anti-spoof gate even for an unambiguously first-party statement, because the gate
  matches on hostname (x.com) against the registry's `website` field (spacex.com), not on account
  identity; classed the Starlink post `informal` (confirmed via the syndication endpoint for verbatim
  text) alongside a Brazilian trade lead (TeleTime) for the nationwide Vivo/Starlink Mobile launch,
  landing a clean trade-base SNR 4 rather than force an unsupportable first_party tier-5 claim.
- 2026-10-29-F: A 31-day-stale Axelspace malfunction notice (Sept. 29: 4 of 7 new GRUS-3 satellites
  permanently lost high-speed downlink) had never been drafted by any prior sweep; surfaced only by
  checking the company's own full news listing after today's "GRUS-3C verification image" press
  release pointed at the underlying problem, not via the queue or a discovery query. Chased per the
  predates-window convention and dated on the actual Sept. 29 notice; the same-domain corroboration
  collapse rule merged the two Axelspace releases into one unit, costless since the lead was already
  first-party ceiling SNR 5. Worth remembering a routine-sounding "first light"/verification-image
  press release from an operator can be the breadcrumb pointing at an older, unpublished setback, not
  just good news in isolation.
- 2026-10-29-G: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 4 new, 1
  updated, 0 held"); confirmed via a direct `jq` read of all four new items' `snr`/`snr_trace`/
  `category`/`impact`/`kind` fields (1081 items, up from 1077), the Astroscale LEDA item's grown
  `sources` (4, up from 3) array, and the sweep log's `corroboration_collapses` entry for the Axelspace
  same-domain collapse. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~3h14m gap, unfiltered full source list (2026-10-29, third)

- 2026-10-29-H: An Arctic Today "KSAT and PierSight sign agreement" queue headline read as same-day
  but traced on direct fetch to ksat.no's own release dated Sept. 9, seven weeks stale; left undrafted.
  A second flavor of the stale-resurfacing trap worth remembering: a third-party outlet's own headline
  phrasing ("sign agreement") carries no date signal at all, so a company's own page is the fastest way
  to rule a "new deal" lead in or out before spending further fetches on it.
- 2026-10-29-I: A secondary outlet's "FCC votes on direct-to-device spectrum" headline can describe the
  Commission adopting a Notice of Proposed Rulemaking (opening a comment period) rather than a final
  order granting anything; the Oct. 29 Starlink Mobile spectrum vote was exactly this shape (482 MHz
  "proposed," carriers' band-exclusion petition left undecided pending 60-day comment). Confirmed via a
  direct fetch of Teslarati's own article text, not just search-synthesis framing, before patching the
  precursor item; worth checking "NPRM" vs. "Order" explicitly on any FCC vote story before writing it
  as a final grant/denial.
- 2026-10-29-J: Eutelsat's own investor-relations PDF (first-party, registry-matched domain) gave a
  garbled partial extraction on a first WebFetch pass but parsed perfectly, full 7 pages verbatim, once
  Read was pointed at WebFetch's auto-saved local copy -- confirms the 2026-10-24-B PDF workaround
  generalizes beyond `.gov` filings to any first-party investor PDF, and is worth trying by default
  whenever a WebFetch PDF response calls itself "compressed/encoded" or "cannot be parsed."
  A same-topic numeric-variance case: Turkish Minute's "35 minors" among Turkey's 85 Daltonlar
  detainees conflicted with TeslaNorth's independently-fetched "30 minors" on the same Oct. 27 raid;
  omitted the specific minors count entirely from the copy rather than pick one source's figure, since
  neither article flagged the other's number as wrong and the detail wasn't essential to the story.
- 2026-10-29-K: `finalize-sweep.ts` rejected the first draft attempt on `updates[].attach[].via: "initial"`
  (only `corroboration`/`upgrade` are valid on an attach, even for an update's very first source, e.g.
  the Lithuania arson item's first-ever update); changing to `"corroboration"` merged cleanly on the
  second attempt ("merged 2 new, 5 updated, 0 held"). Confirmed via a direct `jq` read of both new
  items' `snr`/`category`/`impact` fields (1083 items, up from 1081) and all five updated items' grown
  `sources`/`updates` arrays, plus a `jq empty` parse check across all touched data files (items, state,
  held, source_ledger, candidates). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~6h3m gap, unfiltered full source list (2026-10-29, fourth)

- 2026-10-29-L: A drafted "Space Force awards first operational CASR contracts to six companies" item
  (Aviation Week's Oct. 28 writeup plus Breaking Defense) was REJECTED at finalize as a same-event match
  against an already-published Oct. 22 item covering the identical six vendors and the identical $1.37M
  Aviation Week figure; that existing item had already absorbed the $1.37M detail via an Oct. 29 copy
  update earlier the same day. A Google-News/queue-dominant day's discovery-pass hits (Stoke Space $1B
  Series E, Xona $250M Series D, Exploration Company $450M Series C, EarthDaily/Landsat task order,
  Cowboy Space Big Iron, ISRO NVS-03 preview) were likewise all already published; worth the reminder
  that a fresh-looking trade-press writeup on a multi-day-old program can just be redundant restatement,
  not news, and checking item headlines for exact company/figure matches before drafting a corroboration
  crawl saves a rejected finalize attempt.
- 2026-10-29-M: PCMag's Google-News-only "Starlink Tests Dynamic Pricing" headline could not be
  confirmed: pcmag.com 403'd on WebFetch and no search snippet reproduced the article's own figures,
  so it was dropped per the standing no-WebSearch-synthesis-for-numbers rule rather than guess at
  which of Starlink's several past pricing-change stories (all already published) it referred to.
  Similarly, a Gadget Review "Starlink users in 105 countries...surveillance operation" headline traced
  cleanly (Trend Micro/TrendAI research, Reuters Oct. 27 pickup) but was judged out of core scope: an
  ad-tech/cybersecurity surveillance finding that happens to ride Starlink's IP ranges isn't a
  commercial-space-economy event by itself, distinct from an operator's own action or a documented
  orbital-safety incident.
- 2026-10-29-N: `bun scripts/finalize-sweep.ts` rejected the CASR item on the first attempt (see -L);
  removing it and re-running merged cleanly on the second attempt ("merged 3 new, 3 updated, 0 held").
  Confirmed via a direct `jq` read of all three new items' `snr`/`category`/`impact` fields (1086 items,
  up from 1083, the Amur-SPG whitelist-observer item landing SNR 4 despite a `found_none` corroboration
  crawl, confirming the whitelist floor holds through the penalty) and all three updated items' grown
  `sources`/`updates` arrays, plus a `jq empty` parse check across all touched data files (items, state,
  candidates, source_ledger, sources). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~8h10m gap, unfiltered full source list (2026-10-30, second)

- 2026-10-30-E: A KSAT/PierSight "ground station support" queue headline looked like the same stale Sept. 9
  letter-of-intent flagged undraftable on 2026-10-29-H, but tracing it to ksat.no's own news archive showed
  it is a genuinely distinct, newer Oct. 29 agreement (ground-segment support for launch/early-orbit ops and
  routine mission support, superseding the September data-evaluation LOI); worth re-checking a company's own
  news archive by URL pattern before assuming a second "KSAT and PierSight" headline is the same old story.
  ArcticToday's flag-emoji-prefixed posts (🇳🇴) are KSAT's own press releases verbatim, not independent
  reporting, consistent with past sweeps; classed `wire_pr` corroboration behind the ksat.no first-party lead.
- 2026-10-30-F: `uk.finance.yahoo.com` reliably renders UK RNS-wire mirrors (Filtronic's AGM trading update)
  when the originating `filtronic.com`/`investegate.co.uk`/`advfn.com` pages 403 or render blank; worth
  trying the Yahoo Finance UK mirror by default for LSE-listed micro-cap RNS announcements.
- 2026-10-30-G: Telesat's own Q3 2026 earnings PDF (first-party, `telesat.com`) renders as unreadable binary
  on a direct WebFetch pass but parses cleanly once Read is pointed at WebFetch's auto-saved local copy,
  confirming the 2026-10-24-B/2026-10-28-B/2026-10-29-J PDF workaround generalizes to Telesat's investor
  releases too. The PDF itself never states the Dec. 6 deadline or the creditor consortium's rescue-package
  terms (those facts live only in Payload's own reporting, presumably sourced from a prior 8-K/MD&A); a
  first-party earnings release and a trade outlet's enrichment piece on the same day can be genuinely
  complementary, non-overlapping sources rather than one superseding the other.
- 2026-10-30-H: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 5 new, 2
  updated, 0 held"); confirmed via a direct `jq` read of all five new items' `snr`/`category`/`impact`
  fields (1093 items, up from 1088) and both updated items' grown `sources` (4 each) arrays, plus a
  `jq empty` parse check across all six touched data files (items, state, held, source_ledger, sources,
  candidates). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h43m gap, unfiltered full source list (2026-10-30)

- 2026-10-30-A: A near-total-junk 43-candidate queue (SpaceX/Tesla-merger stock-reaction spam, ISRO's
  still-pending NVS-03 launch preview, routine Bluesky SpaceX-launch chatter) yielded two genuine finds:
  Argotec's first-ever outside funding round (50 million euros from Nuo, found via the Payload queue
  entry) and ARK Invest's own Tesla-SpaceX merger profit model ($2.7T 2031 EBIT, found via the Google
  News: launch feed). Both the China-DIA-spaceplane photo (Vantor/Maxar's own commercial imagery used
  in a DIA report) and a Keldysh/Amur-SPG methane-engine signals-pass lead traced to ground: the DIA
  story is a pure military-intelligence disclosure with no stated commercial transaction for Vantor
  (same institutional-disclosure exclusion as DSP retirement/Space RCO jammers) and the Amur-SPG lead
  was already published same-day by an earlier sweep.
- 2026-10-30-B: Two vague stock-pundit soundbites (Keith Fitz-Gerald's "single most undervalued company
  on the planet," Kevin O'Leary's Anthropic-vs-SpaceX liquidity preference) were left undrafted despite
  being attributable, on-record CNBC quotes: neither carries a stated figure, valuation thesis, or
  rationale beyond generic bullishness, failing the inclusion bar's "a director would act on this" test
  even at commentary's low confirmation bar. Worth the reminder that attribution alone does not clear
  the bar for commentary; the take itself still needs enough substance to be worth a director's morning
  read, the same restraint CLAUDE.md asks of event items.
- 2026-10-30-C: The new ARK Invest commentary item tripped the same-company-plus-category dedup
  heuristic THREE ways on first submit (Galloway's Oct 26 merger commentary, the Oct 20 committee-
  formation event, and a previously-unseen Oct 24 PhillipCapital SpaceX-only rating-upgrade item, the
  last found only from the gate's own rejection message, not a pre-draft grep); three `dedup_distinct`
  entries cleared it on the second attempt. Confirms the standing heuristic fires on every same-company
  financial/commentary item in the 7-day window, not just the most obviously related one.
- 2026-10-30-D: `bun scripts/finalize-sweep.ts` merged cleanly on the second attempt after the dedup fix
  above ("merged 2 new, 0 updated, 0 held"); confirmed via a direct `jq` read of both new items'
  `snr`/`snr_trace`/`category`/`impact`/`kind`/`sources` fields (1088 items, up from 1086, both landing
  an honest SNR 4: Argotec off a trade base plus two mainstream Italian corroborations, ARK Invest off a
  mainstream base plus one informal corroboration) and the sweep log's `signals`/`discovery` blocks
  (16-channel signals pass, 11-query discovery matrix) plus one unrelated persistence-bump
  `snr_movements` entry (ISRO Gaganyaan CM/SM separation test, 2 to 3). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~3h25m gap, unfiltered full source list (2026-10-30, third)

- 2026-10-30-I: `arstechnica.com` is unfetchable directly via WebFetch as usual, but routing the exact
  same URL through the `r.jina.ai` reader proxy (`https://r.jina.ai/<full arstechnica.com URL>`) returned
  full verbatim article text, byline and figures this run, succeeding where the same proxy hit a CAPTCHA
  wall on 2026-10-26-F; worth retrying the proxy on a hard-blocked outlet rather than assuming the prior
  CAPTCHA result is permanent. Used it to pull Eric Berger's piece citing a Quilty Space (Caleb Henry)
  launch-capacity-shortfall analysis (150 missions through 2030, doubling with military demand, Space
  Force Lane 1/2 demand revisions, Blue Origin New Glenn production forecasts), folded into the existing
  Oct. 22 SpaceX/Falcon 9 retirement item as a no-bump enrichment attach+patch that also raised the
  item's impact from notable to major, since a quantified industry-wide shortfall through the late 2030s
  clears the "director briefs the team today" bar the original single-source item alone did not.
- 2026-10-30-J: A Turkish national space agency "first lunar spacecraft integration completed" milestone
  (TUBITAK's own Oct. 6 first-party release, recapped in English via a SpaceflightNow feature three
  weeks later) was left undrafted: "production/integration completed" is not one of the science
  category's named event types (launch, arrival, orbit insertion, landing, sample return, provider
  selection, major anomaly/failure), and the Falcon 9 launch vehicle this SpaceflightNow piece named had
  already been reported in Turkish-language coverage the same week as the integration milestone, so it
  wasn't a fresh provider-selection fact either. Worth a cleaner precedent if a future sweep needs to
  decide whether a national space agency's hardware-completion milestone belongs in `science` at all.
- 2026-10-30-K: A Putin "Musk is a genius" / "close contact on Rassvet so satellites don't interfere"
  quote (TechCrunch, Oct. 29) and a Fire Point CEO's Reuters interview on completing strike missions
  without a Starlink link (Oct. 30, "only covers probably 15 to 20%" of full capability) both folded into
  the Starlink/Ukraine speed-restriction saga (now 80 sources, 33 updates) as no-bump enrichment
  attach+patches; the saga's dedup window for "is this the same story" keeps absorbing genuinely new
  named-actor statements weeks after the original item, consistent with the standing practice for this
  specific saga.
- 2026-10-30-L: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 1 new, 3
  updated, 0 held"); confirmed via a direct `jq` read of the new EIB/Deutsche Bank €560M item's
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields (landing a clean first-party SNR 5 off ESA's own
  commercialisation.esa.int subdomain, which passes the `esa.int` registry-domain anti-spoof check) and
  all three updated items' grown `sources`/`updates` arrays (1094 items, up from 1093). `bun run build`
  was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h11m gap, unfiltered full source list (2026-10-30, fifth)

- 2026-10-30-M: A near-total-junk ~90-candidate queue (dozens of ISRO GSLV-F18/NVS-03 pre/post-launch
  pickups across Indian outlets, SpaceX/Tesla-merger stock-reaction spam, off-topic Futurism filler)
  still yielded six new items: the NVS-03 launch itself (chased past the Google-News-redirect wall via
  a direct ThePrint fetch, since thehindu.com/hindustantimes.com/ndtv.com/moneycontrol.com/
  indiatoday.in all failed to fetch directly) restoring NavIC to its 4-satellite minimum operational
  configuration; an MDA Space/Thales Alenia Space IRIS2 antenna subcontract and a Satellogic/HEO
  non-Earth-imaging renewal, both from the Via Satellite harvester-queue leg; a Starlink
  dynamic-residential-pricing-plus-50%-maritime-price-hike story (How-To Geek, resolving the
  2026-10-29-M "could not be confirmed" PCMag gap via a different, fetchable outlet); and two small
  wire_pr PWSA/GeoXO component subcontracts (ESI Motion, Rocketdyne) with no stated dollar value.
  Both PWSA/GeoXO items needed a crossfeed block despite neither company having a registry entity,
  since their shared customer Lockheed Martin does.
- 2026-10-30-N: ISRO chairman V Narayanan's own post-launch quote ("with the success of this launch,
  the NavIC constellation is restored to the minimum operational configuration with four satellites")
  resolved a live contradiction: a pre-launch WION piece (still showing "countdown... progressing
  smoothly" language, i.e. written before liftoff) claimed NavIC would still need "at least three
  more" NVS-series satellites after NVS-03; the pre-launch framing doesn't apply once the chairman's
  own post-launch count confirms minimum service was reached with just this one. Worth checking
  whether a search-surfaced piece on a scheduled launch was written before or after the event before
  trusting its framing of what the launch would or wouldn't achieve.
- 2026-10-30-O: The standing same-company-plus-category dedup false positive extended to ISRO+`launch`
  (NVS-03 against the unrelated Oct 25 "four launch pads by 2029" item) and to Thales Alenia
  Space+`contract` (the MDA/IRIS2 antenna subcontract against the unrelated Oct 27 ESA Galileo G2
  four-satellite order); two `dedup_distinct` entries cleared both on the second attempt. A third
  dynamic-pricing item needed three more `dedup_distinct` entries against unrelated SpaceX+`product`
  items (Verizon's timeline estimate, T-Mobile's MVNO rejection, the Vivo Brazil D2D launch) and
  passed clean on the first attempt once those were pre-empted.
- 2026-10-30-P: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the two
  same-company-plus-category collisions above; merged cleanly on the second attempt ("merged 6 new,
  1 updated, 0 held"). Confirmed via a direct `jq` read of all six new items' `snr`/`impact`/`category`
  fields (1100 items, up from 1094), the sweep log's two `corroboration_collapses` entries (both PWSA/
  GeoXO items' wire mirrors, correctly collapsed as `wire_rewrite`), and the Florida gas pipeline
  item's grown `sources` (4, up from 2) and `updates` (1, up from 0) arrays. `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6h18m gap, unfiltered full source list (2026-10-31)

- 2026-10-31-A: A near-total-junk ~88-candidate queue (dozens of ISRO NVS-03/GSLV-F18 congratulatory
  reposts already published 2026-10-30, SpaceX/Tesla-merger stock-reaction spam, scheduled-not-yet-flown
  USSF-432/iQPS Launch 9 Electron previews) still yielded four new items, three sourced from the queue's
  own Google News/Ars Technica entries once chased past the headline: SpaceflightNow's own live-coverage
  page named the night's Starlink Group 15-18 flight the 700th Falcon 9 launch to date (a different
  mission than nextspaceflight.com's own "Group 15-16 was the 700th" claim three days earlier; trusted
  the directly-fetched, same-night trade source over a conflicting aggregator note rather than reconcile
  the two); a NASA RFI (Oct. 29, first-party, SNR 5) seeking commercial proposals to reboost, service, or
  deorbit Hubble, found via an Ars Technica queue headline that itself 404'd (`r.jina.ai` also hit a dead
  page) but resolved cleanly via NASA's own science.nasa.gov release plus a ua.news mirror explicitly
  crediting Ars Technica; and a BofA note (via Investing.com, independently confirmed by a Motley Fool
  writeup) naming China's Shanghai-plant national-security review as the SpaceX-Tesla merger's specific
  regulatory mechanism, distinct enough from three other same-week SpaceX-financial items (PhillipCapital,
  Galloway, ARK Invest) to need three `dedup_distinct` entries rather than one. The fourth, Manastu
  Space's Rs 22 crore Series A extension (India, green propulsion/debris-avoidance), came entirely from a
  discovery-pass funding query, not the queue.
- 2026-10-31-B: A SpacePolicyOnline "$42 billion FY2026 civil space spending" report (Oct. 30, 18:46 UTC,
  fetched directly with full agency breakdown) was judged out of scope despite being within window and
  genuinely undrafted: a government-wide topline spanning 19 non-defense agencies (NASA 55%, DOE 18%, DHS,
  NTIA, ...) is the same generic-budget-document shape as the standing Turkey/India-factsheet exclusion
  (2026-10-22-C), not a commercial-space event with a named actor or contract. A Shotwell personal stock
  gift to children's "Trump Accounts" ($270M, 2M+ shares) was excluded under the same personal-
  philanthropy-is-not-a-corporate-event precedent as Musk's earlier SpaceX-share giveaway (2026-10-19-N);
  a Mississippi NAACP Clean Air Act ruling against "SpaceXAI" was excluded as an energy-infrastructure/
  environmental-justice lawsuit about gas turbines, not a space-services regulatory matter; and a Fast
  Company "SpaceX IPO: Stock listing date nears" Google News hit traced to a May 2026 pre-IPO article
  recirculated via a dated newsletter campaign parameter months after the company's actual June 12 IPO,
  the same stale-resurfacing shape as 2026-10-28-G.
- 2026-10-31-C: The Starlink/Ukraine saga (now 82 sources, 34 updates) absorbed a genuine escalation via
  a queue-adjacent PBS piece: Zelenskyy's Oct. 28 on-record admission to reporters ("civilians were killed
  during the shutdown of Starlink/Starshield") is more direct than his prior "real consequences" framing
  and had not been captured by any of the several same-day-28th sweeps; independently confirmed via a
  direct Censor.NET fetch (citing Ukrinform) with the exact quote, rather than trusted from the PBS
  piece's paraphrase alone. The specific "German-developed cruise missiles fell out of the sky" claim tied
  to the same Oct. 14 Lutsk strike was corroborated against several independently-fetched Ukrainian
  outlets (Meduza, glavnoe.in.ua) confirming the six-killed death toll, before folding the Starlink-link
  mechanism into the existing item's narrative.
- 2026-10-31-D: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the standing
  same-company-plus-category dedup heuristic (the NASA Hubble RFI item against the unrelated Oct. 22 NASA
  Science Competition Model 2.0 procurement-reform item, sharing only company NASA + category
  procurement); one `dedup_distinct` entry cleared it on the second attempt ("merged 4 new, 1 updated, 0
  held"). Confirmed via a direct `jq` read of all four new items' `snr`/`impact`/`category`/`kind` fields
  (1104 items, up from 1100), the updated Starlink/Ukraine item's grown `sources`(82)/`updates`(34)
  arrays, the `registry-candidates.json` `flag_refresh` entry for `falcon-9.flights_total` (628 to 700),
  and a `jq empty` parse check across all seven touched data files. `bun run build` was not attempted,
  per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h33m gap, unfiltered full source list (2026-10-31, second)

- 2026-10-31-E: A fully clean zero-new-item sweep: the 114-candidate post-filter
  queue was almost entirely dozens of ISRO NVS-03/GSLV-F18 congratulatory
  reposts (the launch itself already published 2026-10-30) and SpaceX/
  Tesla-merger stock-reaction spam; two queue leads that read as fresh
  (SpaceX's "80,000 cell sites" Crown Castle story, Caleb Henry/Quilty's
  launch-shortage figures) both traced to facts already folded into
  existing items (the Oct. 22 Crown Castle item, the Oct. 22 Falcon 9
  retirement item's Oct. 30 update) once grepped by company name.
- 2026-10-31-F: Sequoia partner Shaun Maguire's own bottoms-up SpaceX
  revenue model ($273.8B 2027, $731.1B 2028, published via an X post
  linking to a longer piece) was left undrafted despite being a genuinely
  new, substantive named-voice commentary candidate: the only outlet with
  the actual figures (Dealroom) 403'd on every WebFetch attempt, the X
  post itself only linked out (no inline text), and no other directly
  fetchable outlet carried the specific dollar figures, only WebSearch
  syntheses. A directly-fetched TeslaNorth piece confirmed Musk's own
  reply quote about orbital-compute timing, but that fact alone was too
  thin to carry a standalone item. Worth a same-topic re-check if a
  mainstream/trade outlet picks up the actual figures with a fetchable
  page.
- 2026-10-31-G: A forecast reentry from a 3-month-old existing item
  (two named Rassvet-3 satellites, No. 17 and No. 23, both forecast to
  reenter around Oct. 29/Nov. 1 per an Oct. 13 UNN report already in the
  item) resolved into a genuine enrichment: Defense Express (via two
  directly-fetched mirrors, United24 Media and Fakti.bg, neither
  fetchable at the original outlet) confirmed No. 17 actually reentered
  Oct. 30, while No. 23 reportedly began climbing after nearing reentry
  around Oct. 20. The existing whitelist lead's own page
  (russianspaceweb.com/buro1440-2026-0719.html), re-fetched directly,
  had NOT been updated with the reentry and still predicted No. 23's own
  decay around Nov. 6, a genuine same-satellite status conflict between
  sources; presented both reads attributed in the copy rather than
  picking one, per the standing metric-mismatch-is-annotated-not-punished
  rule, since this lived in item copy, not a crossfeed fact.
- 2026-10-31-H: A Texas Tribune follow-up (Oct. 31) on the already-published
  Oct. 20 Boca Chica State Park sale-denial item added a genuine new
  thread: the Texas Parks and Wildlife Department is fighting an open-records
  request for the draft commission agenda itself, and SpaceX's Starbase has
  separately annexed about 7,100 acres around the park. A same-byline KSAT
  mirror of the identical Tribune piece was left off the sources list as a
  wire-shaped rewrite rather than double-counted as independent corroboration.
- 2026-10-31-I: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt ("merged 0 new, 2 updated, 0 held"); confirmed via a direct `jq`
  read of both updated items' `snr`/`sources`/`updates` fields (Rassvet:
  SNR held at 4, 10 sources, 7 updates; Boca Chica: SNR held at 4, 3
  sources, 1 update) and the sweep log's `signals`/`discovery` blocks
  (14-channel signals pass, 10-query discovery matrix). `bun run build`
  was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4h gap, unfiltered full source list (2026-10-31, third)

- 2026-10-31-J: A near-total-junk ~30-candidate queue (dozens of ISRO NVS-03 congratulatory
  reposts already published 2026-10-30, SpaceX/Tesla-merger stock-reaction spam, Halloween/
  off-topic filler) yielded one genuine find entirely from a discovery-pass query, not the
  queue or signals: IN-SPACe's second Technology Adoption Fund round (Rs 67.15 crore across
  Manastu Space, Inspecity, VyomIC, MumbaiSemi). A new numeric-coincidence trap, the mirror
  image of the usual stale-resurfacing pattern: Manastu's new Oct 31 TAF grant (Rs 22.08
  crore, government funding for iodine propulsion) landed one day after and ~$0.08 crore
  different from its own already-published Oct 30 private Series A extension (Rs 22 crore).
  Same company, same category, suspiciously similar figure, but two genuinely distinct
  funding mechanisms (government grant vs. private round) confirmed by cross-checking each
  source's own stated mechanism rather than assuming the close figures meant one event
  double-counted; cleared with one `dedup_distinct` entry.
- 2026-10-31-K: The bare `bsky.app/profile/<handle>` page returned zero post content for
  every one of 9 handles tried this run (still requires the
  `public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=15` workaround
  every time); confirms the bare-page failure is now the permanent default, not something to
  keep re-testing before falling back.
- 2026-10-31-L: Caleb Henry/Quilty Space's Oct 31 KeepTrack "150-launch gap through 2030"
  writeup is the same report already folded into the Oct 22 Falcon 9 retirement item via its
  Oct 30 update (2026-10-30-I); a second outlet restating an analyst report days later with a
  fresh-looking headline is not new corroboration, worth checking an existing item's own
  `updates[]` history before treating a quote/figure as unseen.
- 2026-10-31-M: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged
  1 new, 0 updated, 0 held"); confirmed via a direct read of the new item's `snr`/
  `snr_trace`/`category`/`impact` fields (SNR 4: mainstream base tier 3 plus a 3-source
  `corroboration_2plus` bump, 1105 items up from 1104) and the sweep log's `signals`/
  `discovery` blocks (16-channel signals pass, 8-query discovery matrix, 5 X handles
  searched). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~4.5h gap, unfiltered full source list (2026-10-31, fourth)

- 2026-10-31-N: A Google News "Pentagon inspector general declines to investigate Starlink
  disruptions in Ukraine" entry (Oct 29, nine senators including Shaheen, via ABC
  News/Meduza/Washington Examiner, none of the three being wire rewrites of each other) was
  the only genuine find in a 29-candidate queue otherwise all ISRO NVS-03 reposts,
  SpaceX/Tesla-merger stock chatter, and an already-fully-covered SpaceX/T-Mobile FCC
  spectrum filing; folded into the Starlink/Ukraine saga item (now 85 sources, 35 updates)
  as a no-bump enrichment, confirming the item's mainstream-led lead was already at its
  non-first-party SNR ceiling of 4.
- 2026-10-31-O: Nearly drafted a duplicate: Andrew Parsonson's bluesky post naming
  Astroscale's £15M UK MoD LEDA contract read as fresh, but it was the SAME already-published
  2026-10-26 item; separately, a search for the Pentagon's CASR "first operational contracts"
  SDA-award story (surfaced via a Main Engine Cutoff tangent) produced a full set of
  company names and a $1.37M figure before a company-name grep caught that it too was
  already published (2026-10-22), this time with MORE quote detail (Trimailo's "living
  program" line, Galindo's "platinum status" line) than the existing item carries. Worth
  the reminder to grep `items.json` by company name BEFORE spending search budget
  building out a draft, not just before writing scoring — a signals-pass lead reading as
  a scoop is not proof it's undrafted when the underlying contract story has been
  recirculating across trade outlets for a week.
- 2026-10-31-P: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt
  ("merged 0 new, 1 updated, 0 held"); confirmed via a direct `jq` read of the updated
  item's `snr`/`sources`/`updates` fields (SNR held at 4, 85 sources up from 82, 35
  updates up from 34) and the sweep log's `signals`/`discovery` blocks (13-channel
  signals pass, 10-query discovery matrix, 4 X handles searched).

## Narrow re-check, ~7h15m gap, unfiltered full source list (2026-11-01)

- 2026-11-01-A: A new no-registry-host instance: ReOrbit's own newsroom (reorbit.space)
  carries no Australia-specific release at all, so its public sales pitch for a sovereign
  600-1,000-satellite Starlink alternative (made during a Finnish-government press trip)
  is only reported via the Sydney Morning Herald/The Age, both of which 403'd/were
  unfetchable directly (same standing paywalled-mainstream pattern as Reuters/FT/Axios).
  Two separately-fetched aggregator mirrors (Bytes Europe, Head Topics) with genuinely
  different headlines (not a title-collapse case) both credited the original SMH/Age
  piece explicitly; counted as `corroboration_2plus` off an `informal` base per the
  standing mirror-of-an-unfetched-original rule (2026-10-05-H, 2026-10-25-F), landing an
  honest SNR 2. No contract or government commitment exists yet, just a company exec's
  stated interest, so impact landed `noise` despite the concrete 600-1,000-satellite
  figure.
- 2026-11-01-B: A Musk X reply ("mass driver on the Moon... petawatt/year... exceed the
  best case value of Earth's economy," Oct 31, verified verbatim via the syndication
  endpoint) read as a fresh technical announcement but traced via a notateslaapp.com
  writeup to Musk's own March 24, 2026 TERAFAB-event unveiling of the identical lunar
  mass-driver/deep-space-compute-satellite concept; left undrafted as a same-number
  reiteration (standing 2026-09-06-A rule) rather than new news, resolving the angle
  2026-10-31-F flagged as possibly worth a re-check once a fetchable trade outlet (here,
  wccftech, which 404'd on a later direct re-fetch but was captured via WebSearch
  synthesis plus the syndication-endpoint verbatim quote) picked it up. Bill Ackman's
  "trillion dollars of capital" reaction to the same Musk thread was sourced only via a
  secondhand @firesidealpha X account relaying an interview/podcast clip, not Ackman's own
  account; too thin a chain (speculative reply reacting to recycled speculative musing) to
  draft as commentary.
- 2026-11-01-C: An ISRO chief quote ("entire constellation best for full service") in a
  New Indian Express headline pointed at a genuinely new figure (NVS-04/NVS-05 "advanced
  stage of realisation," one more satellite planned for a seven-satellite NavIC base
  layer) per a WebSearch synthesis, but newindianexpress.com itself was unfetchable and a
  directly-fetched ThePrint piece (the existing item's own lead) did not carry the detail
  at all; left unpatched per rule 2 (never state a fact from a WebSearch synthesis alone)
  rather than cite an unfetched page's claim.
- 2026-11-01-D: A government factsheet-shaped PIB.gov.in "Strengthening India's Space
  Sovereignty" release (India's $9B space economy, SPADEX, Axiom-4, BAS, IN-SPACe policy
  recap, no new dateable fact) and a CGTN/China.org.cn piece on a two-launch lunar-orbit-
  rendezvous architecture unveiled at the 7th Manned Space Symposium (Wang Xiang, Nov 1)
  were both left undrafted: the former as the standing generic-government-factsheet
  exclusion (2026-10-22-C/2026-10-31-B), the latter as the standing China-crewed-lunar-
  program-has-no-named-commercial-prime exclusion (2026-10-25-H) even though this one had
  a genuinely new architecture detail (Lanyue lander + Mengzhou crewed ship separate
  launches, lunar-orbit docking, crew transfer for descent).
- 2026-11-01-E: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt
  ("merged 1 new, 1 updated, 0 held"); confirmed via a direct `jq` read of the new
  ReOrbit item's `snr`/`snr_trace`/`category`/`impact` fields (1106 items, up from 1105)
  and the updated Artemis III/IV item's `snr`/`sources`(5)/`updates`(2) fields (SNR held
  at 5, official_record ceiling unchanged), plus a `jq empty` parse check across all
  seven touched data files. `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~8h20m gap, unfiltered full source list (2026-11-01, second)

- 2026-11-01-F: A Tom's Hardware "USAF successfully tests dropping SpaceX Starfall
  cargo drop pods from space" queue headline (Nov. 1) and shattered.io/tech-insider.org
  "Rassvet Satellite Burns Up"/"Russian Starlink Rival Already Lost 2 Satellites"
  headlines were all stale recirculations of already-published facts (the Oct. 20
  Starfall/AFRL Rocket Cargo Pacific-splashdown test; the already-fully-updated
  Rassvet-3 No. 17/No. 23 reentry item), confirmed by matching the exact manifest/
  figure details rather than drafting from the headline shape alone. A KeepTrack
  "3 Starlink Satellites Near Reentry This Week" headline literally meant Starlink
  (STARLINK-3306/1327/1478) plus the Swift telescope, not Rassvet, despite reading
  at a glance like a Rassvet update given the "Starlink" framing elsewhere in the
  same queue window; worth checking what satellite a reentry-watch headline actually
  names before assuming it continues an open non-US-constellation thread.
- 2026-11-01-G: Benzinga itself 403'd on direct WebFetch, but a Yahoo Finance page
  explicitly describing itself as republishing "an exclusive Benzinga interview"
  (with William Webb's SpaceX mobile-network cost estimate) was fetchable directly
  and classed by the true originating outlet (Benzinga, `trade`) per the standing
  syndication-attribution pattern; 24/7 Wall St.'s independent write-up of the same
  estimate's stock-price fallout counted as genuine `corroboration_2plus`.
- 2026-11-01-H: The same-company-plus-category dedup heuristic fired FOUR ways on a
  new SpaceX financial-commentary item (an analyst's mobile-network buildout cost
  estimate) against PhillipCapital's rating upgrade, Scott Galloway's and ARK
  Invest's Tesla-SpaceX merger commentary, and BofA's merger-risk note, all sharing
  only company SpaceX + category `financial`; four `dedup_distinct` entries (only
  three were in the first draft) were needed before the gate passed.
- 2026-11-01-I: `bun scripts/finalize-sweep.ts` rejected the first draft attempt for
  the missing PhillipCapital `dedup_distinct` entry above; merged cleanly on the
  second attempt ("merged 1 new, 2 updated, 0 held"). Confirmed via a direct read of
  the new item's `snr`/`snr_trace`/`category`/`impact` fields (1107 items, up from
  1106) and both updated items' grown `sources`/`updates` arrays (MDA/IRIS2: 3
  sources, 1 update; Quantum Space SPAC: 3 sources, no SNR change at the
  official_record ceiling of 5).

## Narrow re-check, ~5h03m gap, unfiltered full source list (2026-11-01, third)

- 2026-11-01-J: A WebSearch synthesis claiming United's Starlink fleet had grown to
  "720 aircraft, 1,000 by May 2027" (surfaced chasing an insideflyer.com "temporary
  lead" headline) did not survive a direct fetch: the article itself states only the
  already-published 635-aircraft figure, the same $1,500-$7,000 status-match
  thresholds, and the same Jan. 2028 validity window as the existing Oct. 15 United
  item; the 720/1,000-by-2027 figures traced to nothing in the actual page text. Left
  unpatched rather than drafted on the search synthesis's numbers, extending the
  standing WebSearch-fabricates-figures pattern to an aggregate aircraft count, not
  just a quote or a date.
- 2026-11-01-K: A follow-up Teslarati piece on Musk's Oct. 31 "terrestrial compute
  will be peanuts" orbital-compute reply (verbatim-confirmed via a direct X search)
  added nothing new once checked against the item it would have enriched: the CFO
  Bret Johnsen payback-period quote it repeats ("pays for itself in under a year...
  six months next year") is already in the Oct. 20 Q3-earnings item verbatim, and
  2026-10-31-F already judged the Musk reply itself too thin for a standalone item.
  Left undrafted; a trade outlet picking up a thin reply-tweet the next day doesn't
  change that verdict by itself.
- 2026-11-01-L: A genuinely new, dateable analyst note (Barclays' Dan Levy upgrading
  Tesla to Overweight, $450 target from $370, Oct. 26, "a key part of the Tesla bull
  case") surfaced six days stale via a Motley Fool Google News hit; confirmed via two
  independent direct fetches (Investing.com, TIKR) before drafting, since cnbc.com
  (the original) is on the standing unfetchable list. Tripped the same-company-plus-
  category dedup heuristic SEVEN ways (every other SpaceX `financial` item in the
  window, including the same-day Galloway commentary item); one miss (the same-day
  Galloway item) cost a rejected first attempt, confirming the heuristic checks the
  new item's own dated-event day too, not just the sweep's `now`.
- 2026-11-01-M: The FCC's own Oct. 30 final text of an unrelated 800 MHz drone order
  (FCC 26-72) added a footnote (absent from the public draft) naming SpaceX's
  pending Oct. 9 transfer application for the Grain Management spectrum already
  covered by the existing Oct. 8 item, found only via DroneXL (a drone-industry trade
  outlet with no prior classification precedent in this file; treated as `trade`).
  Folded in as a no-bump `updates[].attach`+`patch` rather than a new item, since it
  is the same underlying spectrum transaction, just a new procedural data point on
  its FCC approval status; `crawl: "found_none"` (two searches, no second outlet
  covering this specific footnote) carried no penalty since the lead item is already
  at its non-first-party ceiling.
- 2026-11-01-N: `bun scripts/finalize-sweep.ts` rejected the first draft attempt for
  missing the same-day Galloway `dedup_distinct` entry above; merged cleanly on the
  second attempt ("merged 1 new, 1 updated, 0 held"). Confirmed via a direct `jq`
  read of the new Barclays item's `snr`/`snr_trace`/`category`/`impact`/`kind` fields
  (1108 items, up from 1107) and the updated Grain/800MHz item's grown `sources` (6,
  up from 5) and `updates` (2, up from 1) arrays, and the sweep log's `signals`
  (17 channels checked, 4 X handles)/`discovery` (10 queries) blocks. `bun run build`
  was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6h39m gap, unfiltered full source list (2026-11-02)

- 2026-11-02-A: The 2026-10-31-F Shaun Maguire SpaceX revenue-model gap (left undrafted
  because Dealroom 403'd on every attempt and no other fetchable outlet carried the actual
  figures) resolved cleanly two days later: Dealroom (`dealroom.co/news/168545-...`) fetched
  fine this run with the full $51.5B/2026, $273.8B/2027, $731.1B/2028 breakdown, and a second,
  genuinely independently-framed outlet (futunn.com, via its own four-pillar "talent density/
  Starship moat/compute cost/Starlink economics" writeup, only readable through the `r.jina.ai`
  proxy since a direct WebFetch returned an empty "Document" placeholder) gave `corroboration_2plus`.
  Worth retrying a previously-403'd financial-data site like Dealroom on a later sweep rather than
  writing it off permanently, and worth trying the `r.jina.ai` proxy on an outlet that returns an
  empty placeholder (not a 403/error) before concluding it's unfetchable.
  A WebSearch synthesis for the same story first claimed figures from a June 2026 Yahoo Finance/
  CNBC interview ("$51.5B/$274B/$731B...") that, once directly fetched, actually said nothing of
  the kind (that piece was a stale June CNBC appearance with no specific numbers at all); confirms
  the standing WebSearch-fabricates-and-misattributes-figures trap extends to misattributing one
  outlet's real figures (Dealroom's) onto an unrelated older article when a search summary conflates
  two pieces about the same person. Only the direct Dealroom fetch was trusted for the actual numbers.
  Tripped the same-company-plus-category dedup heuristic SIX ways (every other SpaceX `financial`
  item in the 7-9 day window); cleared on the first attempt since all six were pre-empted.
- 2026-11-02-B: A DT Next piece (Nov 2, ISRO chairman speaking at Chennai airport) narrowing
  Kulasekarapattinam's first-launch target from the long-standing vague "2027"/"early 2027" to a
  specific "March or April 2027" was folded into the existing Aug 9 privatization item as a no-bump
  `updates[].attach`+`patch`, not a new item: same spaceport/program, and a quantified timeline
  beats the vague one it replaces, same logic as the registry's vague-vs-quantified preference rule
  applied here to item copy instead of a registry field.
- 2026-11-02-C: Two BlackSky "news" page entries (Defense News Oct 23, WSJ Oct 30) that read like
  genuine bylined articles turned out to be native-advertising/sponsored thought-leadership content
  (`defensenews.com/native/blacksky/...`), not dateable news events; worth checking a URL for a
  `/native/` path segment specifically before treating a trade outlet's BlackSky-bylined piece as
  independent reporting.
- 2026-11-02-D: A near-total-junk ~26-candidate queue (SpaceX/Tesla-merger stock-reaction spam,
  already-published ISRO NVS-03 post-launch reposts) needed chasing four leads before confirming only
  one (Maguire) was genuinely new; the other three (FAA "10,000 Starships/year" filing claim, a
  "county withheld SpaceX tax break records" Cool Down piece, the Kulasekarapattinam privatization
  angle) all traced to already-published facts once checked against existing item ids directly rather
  than drafted from the queue headline's shape. `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 1 new, 1 updated, 0 held"); confirmed via a direct `jq` read of the new
  Maguire item's `snr`/`category`/`impact`/`kind` fields (1109 items, up from 1108) and the updated
  Kulasekarapattinam item's grown `sources` (3, up from 2) and `updates` (2, up from 1) arrays, plus a
  `jq empty` parse check across all six touched data files (items, state, held, source_ledger,
  sources, candidates). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~11h gap, unfiltered full source list (2026-11-02, second)

- 2026-11-02-E: A Washington Post exclusive (SpaceX in talks to buy or access EchoStar's Boost
  Mobile, Musk personally met Ergen last month) was picked up by dozens of outlets within an hour,
  all of them citing WaPo and none doing independent confirmation; washingtonpost.com itself 403'd.
  Treated this as a single-sourced scoop (lead = a fetchable Reuters/Investing.com piece crediting
  WaPo by name, `crawl: "found_none"`) rather than padding corroboration from the pile of outlets
  that all just restate the same unconfirmed report, per the standing 2026-10-09-H "a dozen
  syndicated copies of ONE interview is found_none" precedent extended from wire-interview pickups to
  a cross-outlet paywalled-scoop pickup. Landed an honest SNR 2; attached one extra outlet
  (androidheadlines.com) only in `secondary_urls`, not `scoring.sources`, so it adds a reader link
  without inflating the corroboration count for a claim nobody has independently confirmed.
- 2026-11-02-F: A proper-noun program name containing a literal exclamation mark (ESA's "BEST!"
  booster initiative, second phase "BEST!2") trips the gate's blanket exclamation-mark ban the same
  way a quoted Musk exclamation did on 2026-10-06-R; rewrote to "BEST" / "BEST 2" (dropping the
  mark) rather than lose the fact. Worth checking any officially-styled program/product name for a
  baked-in "!" before drafting it verbatim.
- 2026-11-02-G: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the BEST! mark
  above (both the tagline and what_happened fields); merged cleanly on the second attempt ("merged 4
  new, 0 updated, 0 held"). Confirmed via a direct `jq` read of all four new items' `snr`/`category`/
  `impact` fields (1113 items, up from 1109: Boost Mobile/EchoStar talks SNR 2 major financial;
  Northwood Space $375M Series C SNR 4 major financial; Stellar Alpina Monarch/Morpho reveal SNR 4
  noise product; ESA BEST 2 booster call SNR 4 noise procurement) and the sweep log's `signals`/
  `discovery` blocks (7-channel signals pass, 8-query discovery matrix). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~27min gap, unfiltered full source list (2026-11-02, third)

- 2026-11-02-H: An extremely short gap (the prior sweep had just merged) still surfaced one genuine
  find, reached only by following a Bluesky post's external embed through two redirect hops: a
  `bsky.app` post from `actusnews.com` had an empty `raw_excerpt` and no visible text on direct
  WebFetch (confirms the standing bare-bsky.app-page-returns-nothing pattern extends to non-signals
  accounts), but its embed resolved via `getPostThread` to a `dlvr.it` short link, which 301'd to the
  actual `actusnews.com` regulatory-disclosure page (a French AMF-mandated wire, same shape as
  BusinessWire/GlobeNewswire): STIF's first SpaceX order (~EUR1M, VIGIFLAP explosion containment
  valves via its Texas subsidiary BOSS Products). The canonical actusnews.com page itself 403'd on
  direct WebFetch; a `financialcontent.com` mirror carrying the full verbatim release text was used
  as the lead instead (`wire_pr`), same "find a readable mirror of a blocked wire page" pattern as
  2026-10-05-A/2026-10-06-A. Worth remembering to chase a content-less Bluesky post's embed link
  through its redirect chain rather than discarding it as empty.
- 2026-11-02-I: Judged a Ukrainian presidential defense-tech adviser's on-record statement (Serhii
  "Flash" Beskrestnov, Nov. 2, via UNITED24 Media) about Russian EW jammer systems blanketing
  occupied Crimea to suppress Starlink, including unit cost, coverage radius, frequency band, and
  camouflage methods, out of scope despite fitting the letter of the geopolitical carve-out's
  "stated by...a government on the record" exception: the content itself is battlefield OSINT about
  a military countermeasure system's technical specs, not a government statement about commercial
  service policy (contrast the already-published Starlink/Ukraine saga's sanctions requests,
  diplomatic protests, and service-restriction statements, which are about Starlink's business/policy
  status, not about how the war is being fought with it). Left undrafted and not folded into the
  existing saga item; flag for Florian if that line is drawn wrong, since the saga item has otherwise
  absorbed nearly every adjacent Starlink-in-Ukraine statement for weeks.
- 2026-11-02-J: A live, in-progress launch (iQPS Launch 9, Rocket Lab Electron, "Sea God Surveys")
  was confirmed via Launch Library as still status "Launch in Flight" (not yet a confirmed outcome)
  17 minutes after an "off the pad" Bluesky post; left undrafted per the standing
  don't-draft-unconfirmed-launches rule, to pick up next sweep once an outcome is known. Separately,
  re-confirmed the 2026-11-02-E Boost Mobile/EchoStar single-sourced-scoop judgment: a fresh wave of
  Google News pickups (TechCrunch, Data Center Dynamics, Light Reading, Yahoo Finance Stock Movers,
  grafa.com) all still just restate the same unconfirmed WaPo report; none added independent
  confirmation, so none were attached as corroboration, per the standing "a dozen syndicated copies
  of one scoop is still found_none" rule.
- 2026-11-02-K: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the standing
  same-company-plus-category dedup heuristic (the new STIF item against the unrelated Oct. 30
  Filtronic/SpaceX GEO RF-component order, sharing only company SpaceX + category `contract`); one
  `dedup_distinct` entry cleared it on the second attempt ("merged 1 new, 0 updated, 0 held").
  Confirmed via a direct read of the new item's `snr`/`snr_trace`/`category`/`impact`/`sources` fields
  (1114 items, up from 1113, an honest SNR 3: wire_pr base 4 minus 1 for a genuine `found_none`
  corroboration crawl) and the sweep log's `signals`/`discovery` blocks (16-channel signals pass,
  8-query discovery matrix). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~8h gap, unfiltered full source list (2026-11-02, fourth)

- 2026-11-02-L: An Air & Space Forces Magazine industry notice (Nov. 2: Space Force "notionally
  interested" in up to 5 cislunar seed satellites by late 2029) is a dateable procurement event in
  its own right, distinct from the standing "scheduled vote not yet decided" exclusion (the
  2026-10-08-C FCC-vote precedent): a published industry notice IS the fact, even though the plan
  it describes is years out. Worth distinguishing "the agency published a notice today" (publishable)
  from "the agency will vote/launch on a future date" (not yet a fact). The same outlet's Oct. 29
  piece on SpaceWERX's related "Cislunar Prime" SBIR effort ($30M/15 contracts) was a separate,
  older article on a related but distinct program; folded in as background context on the same
  source rather than treated as the same story.
  rocketlabcorp.com and investors.rocketlabcorp.com both 403'd again on direct WebFetch (standing
  dead-site pattern); led a routine iQPS/Electron launch item on a StockTitan mirror (`wire_pr`)
  instead, same workaround as the 2026-10-05/2026-10-21 Redwire precedents.
- 2026-11-02-M: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 5 new,
  0 updated, 0 held"); confirmed via a direct `jq` read of all five new items' `snr`/`category`/
  `impact` fields (1119 items, up from 1114) and the `registry-candidates.json` `flag_refresh`
  entry for `electron.flights_total` (96 to 99). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~3.6h gap, unfiltered full source list (2026-11-03)

- 2026-11-03-A: A near-total-junk 15-candidate post-filter queue (SpaceX/Boost Mobile mirror
  pickups, a China lunar-architecture repost already judged out of scope, routine FAA launch-
  schedule Bluesky posts) still yielded three genuine finds by chasing the Boost Mobile cluster
  and an xSearch hit past their headlines: AT&T and AST SpaceMobile's first terrestrial-to-
  satellite cellular handoff (announced Nov. 2, dated on the actual Oct. 21 test per the
  predates-window convention; att.com 403'd and AST's own ast-science.com didn't carry it, so a
  financialcontent.com Business Wire mirror led at `wire_pr`, with broadbandbreakfast.com's
  independently-written piece, different quote/byline, as genuine trade corroboration); Boost
  Mobile founder Peter Adderton's on-X "pivot, and pivot FAST" call for AST SpaceMobile, plus Tim
  Farrar's competing read that SpaceX's real target is EchoStar's DISH Wireless network, both
  relayed via one StockTwits-authored piece (mirrored verbatim across Yahoo Finance/TradingView/
  Stocktwits/Asianet, so no independent second source existed despite the mirror count) -- drafted
  as `kind: "commentary"` at an honest informal-base SNR 1, not folded into the existing Boost
  Mobile/EchoStar talks item, since it is a third-party reaction to that story, not new sourcing
  of it; and ESA DG Aschbacher's UAE/Gulf-partnership trip (found via an xSearch WebSearch on
  Weeden's handle, not the queue), which traced to a single Reuters wire piece (byline Florence
  Loeve) syndicated under an identical headline across a dozen mirrors -- finalize's title-collapse
  correctly merged the two attached mirrors into one `wire_rewrite` unit, landing a correctly thin
  SNR 2 (mainstream base 3, `corroboration_none` -1) despite the mirror count.
- 2026-11-03-B: The new commentary item tripped the standing same-company-plus-category dedup
  heuristic FIVE ways on first submit (the Boost Mobile/EchoStar talks item itself, ARK Invest,
  BofA, William Webb, and Maguire's SpaceX revenue model all share company SpaceX + category
  `financial`), and TWO more were missing from the first draft (Galloway's and Barclays' Tesla-
  SpaceX merger commentary/upgrade, also company SpaceX + category `financial`) -- seven
  `dedup_distinct` entries total were needed before the gate passed, confirming a commentary item
  about an already-crowded company+category combination can collide with more existing items than
  a typical event item in the same window.
- 2026-11-03-C: A Nov. 2 evertiq.com "Airbus awarded contract for two additional Galileo
  satellites" discovery-pass hit recycled the already-published Oct. 27 ESA/Airbus/Thales
  four-satellite G2 order under a new dateline; caught because the evertiq piece's own
  atc-network.com citation was byte-identical to a URL already in that item's `sources` array --
  worth checking a "new" contract headline's own cited links against an existing item's sources
  list directly, not just the company/figure shape, when the figure (two satellites) is a clean
  subset of an already-known total (four).
- 2026-11-03-D: `bun scripts/finalize-sweep.ts` rejected the first draft attempt for the two
  missing Galloway/Barclays `dedup_distinct` entries above; merged cleanly on the second attempt
  ("merged 3 new, 1 updated, 0 held"). Confirmed via a direct `jq` read of all three new items'
  `snr`/`snr_trace`/`category`/`impact` fields (1122 items, up from 1119), the United Starlink-
  fleet item's grown `sources` (6, up from 5) and `updates` (3, up from 2) arrays (671 aircraft,
  up from 661, SNR unchanged at 4), the sweep log's `corroboration_collapses` entry (Aschbacher
  item, Free Malaysia Today/Al-Monitor Reuters-wire collapse), and the `registry-candidates.json`
  `flag_refresh` confirmation entry for `ast-spacemobile.sats_launched_total` (13, unchanged). A
  `jq empty` parse check passed on all seven touched data files (items, state, held, source_ledger,
  sources, candidates, registry-candidates). `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~9h gap, unfiltered full source list (2026-11-03, second)

- 2026-11-03-E: `signalsPass.checked` entries must exactly match a `signals-context` fetchable
  entry's `url` field, not a derived fetch URL: using Andrew Parsonson's substack `rss` value
  (`https://europeanspaceflight.substack.com/feed`) instead of its `url`
  (`https://europeanspaceflight.substack.com`) got the whole draft rejected
  ("not a fetchable whitelisted signal channel"), even though the feed URL is what was actually
  fetched. List the catalogue URL, not the endpoint used to read it.
- 2026-11-03-F: NASASpaceflight.com 403'd on direct WebFetch for a specific article (Isaacman on
  Hubble/Swift) exactly as it has before for other pages; the `r.jina.ai/<url>` proxy (per
  2026-11-02-A) again returned clean, directly-fetched verbatim quotes, confirming this is a
  reliable first fallback for a 403 (not just an empty-placeholder "Document" shell) before writing
  a source off as unfetchable this run.
- 2026-11-03-G: UNITED24 Media's "secret Rassvet-4 upgrade" piece and a same-day en.defence-ua.com
  (Defense Express) piece on the identical ITU-filing story are NOT independent corroboration:
  UNITED24's own article credits Defense Express's analysis as its source. Treated as one source
  (Defense Express led, UNITED24 in `secondary_urls` only), extending the "outlet explicitly credits
  another outlet as its source" non-independence check beyond wire-rewrites to analysis pieces.
- 2026-11-03-H: A near-total-junk queue (dozens of SpaceX/Boost Mobile stock-speculation Google News
  pickups, all already absorbed into existing items per 2026-11-02-E/2026-11-03-A/B) still yielded
  seven genuine new items by chasing Payload/SpaceNews/wire items past the queue and running the
  full discovery matrix cold (all 8 queries surfaced only already-published or stale-dated stories:
  Meteor 2-7 breakup, Galileo G2, Starcloud, Stoke Space, Starfish Space funding, Leonardo Space
  Guardian). Two Google-News-sourced items (Leonardo's "Space Guardian" EO constellation bluesky
  recap, a KeepTrack Vikram-1 retrospective, a Rediff NavIC "new lease of life" piece) traced to
  announcements from March 2025 and the already-published Jul 18/Oct 30 items respectively once
  checked for an actual new dateline; a bluesky recap restating an old fact with no new hook is not
  a fresh candidate even when it surfaces today.
- 2026-11-03-I: Judged a SpaceX stock-gift-to-Trump-Accounts item (Shotwell donating 2M+ shares,
  widely covered Nov 2) out of scope despite fitting "financial events of tracked companies" on a
  narrow reading: the story is about a philanthropic/political distribution program, not a
  funding round, M&A, bankruptcy, or anything that changes SpaceX's capital structure or a
  commercial director's plans. Left undrafted; flag for Florian if that line is drawn wrong, since
  it was widely covered and SpaceX stock is nominally a tracked-company asset.
- 2026-11-03-J: `bun scripts/finalize-sweep.ts` rejected the first draft attempt three times in a
  row (a 157-char and then a 141-char tagline over the 140 limit on two different items; a missing
  `dedup_distinct` against an unrelated NASA+incident item, Roscosmos's Zvezda closure, sharing only
  company NASA and category incident with the new Swift reentry item); merged cleanly on the fourth
  attempt ("merged 7 new, 2 updated, 0 held"). Confirmed via a direct `jq` read of all seven new
  items' `snr`/`category`/`impact` fields (1129 items, up from 1122) and the two updated items'
  grown `sources` arrays (Iridium/FCC item: 4, up from 2; Hubble RFI item: 3, up from 2). A
  `jq empty` parse check passed on all seven touched data files. `bun run build` was not attempted,
  per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~2.4h gap, unfiltered full source list (2026-11-03, third)

- 2026-11-03-K: A near-total-junk queue (dozens of SpaceX/Tesla-merger and Boost Mobile stock-
  reaction pickups, all already absorbed per 2026-11-02-E/2026-11-03-A/B/H) still yielded three
  genuine finds: Simera Sense and Spacemanic's dual-use CubeSat camera/bus/deployer collaboration
  (SpaceNews, single-sourced after a real corroboration search, `crawl: "found_none"`, landing SNR
  2); EarthDaily and Panama's Geosolutions Consulting partnering to resell EarthDaily imagery across
  six Central American countries (first-party on earthdaily.com, no pickup found anywhere else, but
  `found_none` costs a direct-source lead nothing, so it stood at base-tier SNR 5); and CAS Space's
  Lijian-2 Y2 flying its second mission and first megaconstellation batch (18 more Qianfan/Spacesail
  satellites, 276 total), led on a Xinhua wire mirror (arabtimesonline.com) with CGTN's own near-
  identical-titled writeup as a second source, per the standing routine-megaconstellation-batches-
  always-publish rule (noise). A 24/7 Wall St. stock-reaction piece on the same-day Intuitive
  Machines FALCON-RADAR item (already published in the prior 14:57 UTC sweep) independently
  confirmed the contract as fact rather than just restating the press release, worth a no-bump
  `updates[].attach` + explicit `bump: "corroboration_2plus"` that correctly reversed the item's
  existing `corroboration_none` penalty (SNR 3 to 4, modifiers are additive and the two types don't
  collide). Separately judged a SpaceX/T-Mobile "fires back" TheStreet piece, a Sequoia/Maguire
  "Amazon Google Microsoft are jokes" Benzinga pickup, and an Ars Technica Argo Space profile feature
  all out as non-new: the first two were later-wave pickups of quotes already verbatim in existing
  items (Oct. 30 FCC spectrum update, Oct. 30/Nov. 2 Maguire revenue-model item), and the Argo Space
  piece wrapped up three already-past milestones (July demo, September ispace contract, 2027 Chiron
  plans) with no new dateable announcement, not matching the news-item schema's one-event shape.
- 2026-11-03-L: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 3 new,
  1 updated, 0 held"). Confirmed via a direct `jq` read of all three new items' `snr`/`category`/
  `impact` fields (1132 items, up from 1129: Simera/Spacemanic SNR 2 noise product, EarthDaily/
  Geosolutions SNR 5 notable partnership, Lijian-2/Qianfan SNR 4 noise launch), the updated FALCON-
  RADAR item's grown `sources` (2, up from 1) and SNR move (3 to 4), and the
  `registry-candidates.json` `flag_refresh` entry for `qianfan.sats_launched_total` (276, up from
  239). A `jq empty` parse check passed on all seven touched data files. `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~9.4h gap, unfiltered full source list (2026-11-04)

- 2026-11-04-A: A near-total-junk queue (127 candidates, almost entirely SpaceX/Tesla election-
  reaction stock churn plus a dozen pickups of the same SpaceX/Qualcomm Starlink Mobile 5G deal)
  still yielded four genuine new items. The Qualcomm deal itself had no qualcomm.com-domain or
  spacex.com-domain fetchable copy; the actual lead was a Business-Wire-distributed release mirrored
  on Yahoo Finance, classed `wire_pr` (not `first_party`, since neither SpaceX's chip-vendor partner
  Qualcomm nor the release's own domain has a registry profile to validate against, same rule as the
  2026-10-06-W SEALSQ/ThinKom precedent) -- final SNR held at the non-first-party ceiling of 4 despite
  a dozen mainstream/trade pickups (Reuters, Bloomberg, CNBC, Axios, Light Reading, The Next Web, etc).
- 2026-11-04-B: NASA's own blog (`nasa.gov/blogs/smallsatellites`) reporting a contractor's (Starfish
  Space) in-orbit failure classed cleanly as `official_record` (the agency reporting on a funded
  program's status, not a company's own announcement) for an honest SNR 5, with Payload's independent
  write-up as trade corroboration -- confirms nasa.gov is usable as `official_record` for third-party
  program status, not just `first_party` for NASA's own actions. Drafted as a NEW incident item (not an
  `updates[]` attach) against the existing Sept. 24 "Starfish Space completes first operational Otter
  servicing spacecraft" item, since that earlier item covered pre-launch completion and this covered a
  post-launch failure 40 days later -- same spacecraft program, different event kind, a `dedup_distinct`
  case even outside the literal 7/30-day windows.
- 2026-11-04-C: A Payload exclusive (Orbital Matter/EnduroSat 2028 in-space-manufacturing mission) had
  no own-domain press release yet (orbitalmatter.com's newsroom only went up to August) and no second
  outlet on a direct search; published honestly at `crawl: "found_none"` (trade base 3, final SNR 2)
  rather than held, per the standing weak-sourcing-is-not-a-hold-reason rule.
- 2026-11-04-D: A SpaceNews piece (Vantor's 7-minute Ukraine tactical-imagery-delivery demo, Nov. 2,
  Sandra Erwin byline) was paywalled beyond its lede, and a same-topic SatNews write-up (Nov. 3) read as
  a near-verbatim rewrite of the same quotes and figures rather than independent reporting -- treated
  as non-independent and left unattached, landing an honest single-source `crawl: "found_none"` SNR 2
  rather than padding corroboration from a rewrite. An operator (Vantor) confirming its own
  service/capability change in a conflict context is the explicit CLAUDE.md carve-out from the
  conflict-analysis exclusion, distinct from 2026-11-02-I's judgment call to leave a Ukrainian official's
  battlefield-jammer-specs statement out of scope.
- 2026-11-04-E: A SpaceNews piece on NASA's MAVEN anomaly-review final report ("computer and gyro
  problems likely caused loss of MAVEN," Nov. 2 byline) could not be reliably dated: a direct fetch of an
  Italian mirror (astrospace.it) attributed the underlying final report to July 2026, while NASA's own
  MAVEN blog archive showed no July or November post with that content, leaving a live conflict between
  "new Nov. 2 reporting" and "recap of an already-months-old report." Left undrafted rather than guess a
  date; worth a future sweep specifically fetching NASA's MAVEN anomaly-board final report page directly
  if it resurfaces.
- 2026-11-04-F: Several recap/stale traps left undrafted: a Euromaidan Press piece on the Poland-
  Starlink-sabotage German arrest (Nov. 4) restated facts the prior sweep had already attached to
  `2026-09-24-poland-starlink-station-fire-sabotage` on 2026-11-03, plus one thin unconfirmed detail
  (gang leader "protected by Russia," non-extradition); a KeepTrack Cosmos-2612/ICEYE-X36 "deep dive"
  recapped the already-fully-updated Oct. 17-23 close-approach saga with no new date-specific fact; a
  Google News "Singapore sets up Earth Observation Initiative" hit traced to a Feb. 2025 program
  announcement recirculating via EDB's own "business insights" page; and an Investigative Journalism
  Foundation "Canada federal Starlink contract increased ten-fold" piece gave no dollar figures on direct
  fetch and WebSearch dated the underlying reporting to Sept. 2, 2026, not today.
- 2026-11-04-G: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 4 new, 2
  updated, 0 held"), 1138 items up from 1134. Confirmed via a direct `jq` read of all four new items'
  `snr`/`category`/`impact` fields and both updated items' grown `sources`/`updates` arrays (Grain/
  800MHz: 8 sources, 3 updates; Miura 5: 3 sources, 1 update). A `jq empty` parse check passed on all six
  touched data files (items, state, held, source_ledger, sources, candidates). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~2.1h gap, unfiltered full source list (2026-11-04, second)

- 2026-11-04-H: A 52-candidate queue almost entirely SpaceX/Tesla midterm-election-reaction stock
  churn and a dozen pickups of the already-published SpaceX/Qualcomm Starlink Mobile 5G deal (the
  "tens of thousands of cell sites"/2027-rollout figures were already in the item's copy, so none
  of Broadband Breakfast/PhoneArena/pcmag's Bluesky repost added anything) still yielded one genuine
  find via a Bluesky search-feed hit: Ubotica's own first-party announcement (ubotica.com, no
  registry entity for Ubotica or Open Cosmos so classed `wire_pr` per the standing
  no-registry-host precedent) of a CogniSAT-6 onboard-AI "Autonomous Scheduling" demo (re-imaging a
  Pacific Ocean site two days after first spotting a cruise ship, no ground instruction). Irish Tech
  News's independent write-up of the same story 403'd on every attempt (direct WebFetch and the
  `r.jina.ai` proxy, which hit the publisher's own bot-check page this time rather than returning
  clean text), landing an honest single-source `crawl: "found_none"` SNR 3.
- 2026-11-04-I: A SpacePolicyOnline "Blue Tsunami" midterm-results piece explicitly said "what it
  all means for space activities is difficult to assess at this early stage," with no stated
  space-industry fact; left undrafted as political news with no commercial-space angle yet, not a
  judgment call worth revisiting unless a later Planetary Society/NASA-budget follow-up states one.
  A staff-written Investing.com/Yahoo Finance "AT&T's vulnerability to a SpaceX mobile network push"
  piece was financial analysis with no named analyst voice (so not commentary-eligible) and no fact
  beyond the already-published FCC Starlink Mobile approval and Boost Mobile talks; left undrafted
  as neither a new event nor attributable commentary.
  An Anadolu Ajansı "OPINION - Ukraine's Starlink moment: Who can switch off modern battlespace?"
  piece was judged out of scope as outlet-authored conflict analysis (not a named individual's
  commentary, and not a government/operator statement on the record), consistent with the standing
  conflict-analysis exclusion.
- 2026-11-04-J: A Bluesky thread (/2 continuation) relaying Telesat CEO Dan Goldberg's "hundreds
  more hires" and "$7 billion" Gatineau investment quotes traced via WebSearch only to a cluster of
  2024-dated Ottawa Business Journal/SpaceQ/BetaKit articles about the original Gatineau campus
  announcement, with no November 2026 dateline found anywhere; left undrafted as an old quote
  recirculating via a social thread rather than new news, worth a reminder that a Bluesky thread
  quoting a named exec by name is not itself proof the underlying remark is new.
- 2026-11-04-K: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 1 new,
  0 updated, 0 held"), 1139 items up from 1138. Confirmed via a direct `jq` read of the new Ubotica
  item's `snr`/`snr_trace`/`category`/`impact` fields and a `jq empty` parse check across all six
  touched data files (items, state, held, source_ledger, sources, candidates). `bun run build` was
  not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6h32m gap, unfiltered full source list (2026-11-04, third)

- 2026-11-04-L: A WebSearch hit ("Beyond Gravity wins ULA contract," businessalabama.com) that read
  like same-day corroboration for ULA's Nov. 4 in-house fairing-manufacturing announcement turned out,
  once fetched via the `r.jina.ai` proxy, to be a stale October 2022 story about Beyond Gravity WINNING
  (not losing) a ULA fairing contract for Amazon Kuiper launches -- the opposite direction of today's
  news, from the same two companies. Caught only because the proxy returned a dateline; a bare WebSearch
  synthesis repeated the "38 fairings for Kuiper" fact without flagging it as years old. Defense Daily's
  own Nov. 4 piece on the same in-house-transition story was used as genuine corroboration instead, and
  finalize-sweep's title-collapse correctly merged it with the Via Satellite lead as a `wire_rewrite`
  (both outlets ran the identical headline) rather than crediting a second source.
- 2026-11-04-M: OHB's own regulatory ad-hoc disclosure, hosted on eqs-news.com (a third-party German/EU
  financial disclosure platform, not ohb.de), classed `wire_pr` rather than `first_party` for the same
  reason as the SEALSQ/ThinKom precedent (2026-10-06-W): the anti-spoof check only passes a domain that
  matches the entity's registry-recorded website, and eqs-news.com isn't it even though the disclosure
  is OHB's own regulated announcement. A German regional paper (Weser-Kurier) carrying an independent
  CEO quote on the same contract gave genuine `mainstream` corroboration.
- 2026-11-04-N: A Redwire quarterly-earnings 8-K's SEC-hosted Exhibit 99.1 (the press release itself,
  filed as an exhibit) is a cleaner `official_record` lead than Redwire's own `ir.rdw.com` investor
  page, which still fails the anti-spoof check against the registry's stale `redwirespace.com` value
  (2026-10-05-F) -- worth defaulting to the SEC exhibit document for any quarterly-earnings item on a
  US-listed company, not just the IR page, since EDGAR itself is always first-party-domain-clean.
- 2026-11-04-O: Andrew Parsonson's bluesky post "DGA conducted the first operational flight of
  ArianeGroup's SyLEx sounding rocket" (posted today) traced to a November 2025 story on direct fetch
  of the European Spaceflight article it linked -- a full year stale, and also out of scope regardless
  (SyLEx is a suborbital sounding rocket; CLAUDE.md's launch-vehicle scope is orbital only). Left
  undrafted on both grounds.
- 2026-11-04-P: `bun scripts/finalize-sweep.ts` rejected the first draft attempt for two standing
  same-company-plus-category dedup false positives (a new NASA/`procurement` item against the existing
  Hubble commercial-servicing RFI, and a new ESA/`procurement` item against the existing BEST! reusable-
  booster call) and a second attempt for one `explainer.tagline` at 146 chars; merged cleanly on the
  third attempt ("merged 7 new, 3 updated, 0 held"), 1146 items up from 1139. Confirmed via a direct
  `jq` read of all seven new items' `snr`/`category`/`impact` fields, the three updated items' grown
  `sources`/`updates` arrays, the sweep log's `corroboration_collapses` entry (ULA item, Via Satellite/
  Defense Daily wire-rewrite collapse), and three unrelated persistence-bump `snr_movements` entries.
  A `jq empty` parse check passed on all seven touched data files (items, state, held, source_ledger,
  sources, candidates, registry-candidates). `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~5h gap, unfiltered full source list (2026-11-05)

- 2026-11-05-A: Bluesky profile pages 404/render-blank on plain WebFetch exactly like X does (confirms
  the standing JS-shell pattern extends to bsky.app, not just x.com); the public AT Protocol endpoint
  `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=10` returns clean
  post text and `createdAt` timestamps with no auth needed, and is now the reliable way to run the
  signals pass's bluesky leg instead of fetching bsky.app pages directly.
- 2026-11-05-B: Trump's "American Declaration of Freedom in Space" proclamation (Nov. 3, wide pickup
  Nov. 4-5) was judged out of the inclusion bar despite being space-specific and widely covered: three
  independently fetched pieces (SpacePolicyOnline, newspaceeconomy.ca's legal-analysis angle) all
  confirmed it "doesn't provide direction or funding, but only asserts U.S. aspirations" and "does not
  specify every system or agreement required to sustain it" -- no new program, funding, agency
  instruction, or regulatory change for any commercial operator. Left undrafted rather than published
  at `noise`, extending the standing political-news-with-no-commercial-fact precedent
  (2026-11-03-I/2026-11-04-I) to a space-themed but substance-free proclamation; flag for Florian if a
  symbolic presidential space proclamation should publish anyway purely for reader-interest reasons.
- 2026-11-05-C: A Bloomberg TV interview quote from Eutelsat chair Sunil Mittal ("countries can't rely
  on another country" for satellite connectivity) was genuinely new (a fresh Nov. 5 "Leaders with
  Francine Lacqua" interview, distinct from his Oct. 14 India-queue remarks) but drew no second outlet
  on a direct quoted-phrase search; drafted as `kind: "commentary"` at an honest `crawl: "found_none"`
  mainstream-base SNR 2 rather than held, since weak corroboration is never a hold reason and a named
  executive's on-record take about a tracked operator's market positioning clears the commentary bar
  even without new facts.
- 2026-11-05-D: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 2 new, 1
  updated, 0 held"), 1148 items up from 1146. Confirmed via a direct `jq` read of both new items'
  `snr`/`snr_trace`/`category`/`impact` fields and the updated Rocket Lab/Iridium item's grown
  `sources` (8, up from 7) and `updates` (4, up from 3) arrays. A `jq empty` parse check passed on all
  seven touched data files (items, state, held, source_ledger, sources, candidates,
  registry-candidates). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~9.5h gap, unfiltered full source list (2026-11-05, second)

- 2026-11-05-E: A near-total-junk 128-candidate queue (dozens of SpaceX/Tesla midterm-election stock
  churn and already-published Qualcomm/Starlink Mobile 5G pickups, plus a dozen syndicated Indian
  outlets on one Cosmoserve Space press event) still yielded five genuine finds. Both the OHB/Sentinel-3
  (European Spaceflight) and Redwire/Otter-VLEO (Redwire's own `ir.rdw.com` IR page) queue hits traced
  to events already published in the prior two sweeps; `ir.rdw.com` was left unattached rather than
  misclassified as `first_party`, since Redwire's registry-recorded website is `redwirespace.com`
  (2026-10-05-F/2026-11-04-N precedent) and the item already had two trade sources at the wire_pr/trade
  ceiling, so attaching it would have added no reader value.
- 2026-11-05-F: BlackSky's own `blacksky.com/press-releases/...` page and the same-day SEC 8-K Exhibit
  99.1 turned out to carry the identical press-release text; finalize-sweep's title-collapse correctly
  merged them as a `wire_rewrite` (kept the first-party blacksky.com lead, dropped the SEC exhibit)
  rather than crediting a second source, confirming the collapse rule applies even to two from-the-actor
  documents on different domains, not just third-party rewrites.
- 2026-11-05-G: Andrew Jones's Bluesky feed carried two factual claims about Chinese programs on the
  same day: a Long March 9 state-approval claim he himself prefaced "Haven't seen an official public
  source" for, and an unhedged one about commercial startup Yilong Aerospace's YL-1 rocket targeting a
  2027 debut. Drafted only the unhedged one (whitelist `observer` floor, `crawl: "found_none"` after a
  genuine web search for independent coverage); left the self-flagged-uncertain one undrafted rather
  than publish a claim the reporting whitelist signal themselves doubted, even at SNR 1. Fetching a
  Bluesky post's exact text for drafting purposes requires pulling its `uri`/rkey from the
  `getAuthorFeed` API response to build the `bsky.app/profile/<handle>/post/<rkey>` permalink; the
  catalogue `url` (the profile page) is what belongs in `signalsPass.checked`, but the item's
  `source_url` needs the specific post permalink, not the profile URL.
- 2026-11-05-H: A United/Spotify Starlink-seatback item got auto-flagged by the dedup gate against two
  unrelated existing items (a Connected Solutions Starlink-reseller item, the SpaceX/Qualcomm Starlink
  Mobile 5G item) purely because all three share company "SpaceX" and category "partnership" within 7
  days; resolved with `dedup_distinct` reasons rather than folding a genuinely distinct airline/streaming
  partnership into either unrelated item.
- 2026-11-05-I: `bun scripts/finalize-sweep.ts` rejected the first draft attempt for the United/Spotify
  same-company-plus-category dedup false positive above; merged cleanly on the second attempt ("merged 5
  new, 0 updated, 0 held"), 1153 items up from 1148. Confirmed via a direct `jq` read of all five new
  items' `snr`/`category`/`impact` fields and the sweep log's `corroboration_collapses` entry (BlackSky
  wire_rewrite collapse). A `jq empty` parse check passed on all seven touched data files (items, state,
  held, source_ledger, sources, candidates, registry-candidates); only five of the seven (items, state,
  source_ledger, sources, candidates) actually changed, since this run produced no held entries or
  registry-crossfeed facts. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~6.4h gap, unfiltered full source list (2026-11-05, third)

- 2026-11-06-A: A 128-candidate queue almost entirely SpaceX/Tesla midterm-election stock churn still
  yielded seven genuine finds, two of them (a Blue Origin GS3 third-stage/Northstar engine hardware
  announcement and a same-day New Glenn NG-4.1 January 2027 return-to-flight delay) sharing company
  Blue Origin and category `launch` on the same date; resolved with two mutual `dedup_distinct` entries
  rather than folding the capability announcement into the schedule-delay item or vice versa, since they
  are genuinely different event kinds.
- 2026-11-06-B: The NG-4.1 January 2027 crossfeed (`new-glenn.next_flight_date`) landed on a genuine
  SNR tie against the registry's existing Launch-Library-sourced value (both tier 4) and was correctly
  auto-queued `both_disputed_queue` for Florian rather than silently overwritten, confirming the
  SNR_SPEC same-metric-tie rule fires even when the new claim is clearly more current (an internal CEO
  memo reported by two wire/mainstream outlets) than the older aggregator snapshot it's superseding.
- 2026-11-06-C: Reuters/CNBC coverage of Blue Origin CEO Dave Limp's internal memo (via a Yahoo mirror,
  since ft.com/bloomberg.com/floridatoday.com/seekingalpha.com all blocked direct WebFetch with
  403/429) was treated as `mainstream`, distinct from the same-day GS3/Northstar hardware reveal
  (NASASpaceflight/Space.com/SpaceflightNow, independently bylined, not wire rewrites of one Blue Origin
  blog post we could never actually fetch ourselves after repeated 404/429s on blueorigin.com/news) --
  worth remembering that blueorigin.com's own site is frequently unfetchable, so trade/mainstream
  write-ups of its announcements are the practical lead even when a first-party blog post almost
  certainly exists.
- 2026-11-06-D: A corroborating secondary source that itself explicitly cites another outlet's reporting
  (RuntimeWire's CesiumAstro piece citing Bloomberg by name) still counts as a genuine second write-up
  for `crawl: found_some` as long as it's independently drafted (different framing/angle), extending the
  2026-11-03-G non-independence check (which is about outlets crediting each other as their SOURCE for
  facts) to not over-apply when the citation is just attribution of a stat within otherwise original
  commentary.
- 2026-11-06-E: `bun scripts/finalize-sweep.ts` rejected the first draft attempt (`draft.coverage` must
  be category values, not tag values -- "connectivity" is not a valid top-level coverage entry even
  though it's a legitimate domain tag) and a second attempt for one `explainer.tagline` at 142 chars;
  merged cleanly on the third attempt ("merged 7 new, 0 updated, 1 held"), 1162 items up from 1155. The
  1 held entry was the auto-queued NG-4.1 crossfeed dispute above, not an edit-queue item from this
  draft's own `held` array (which was empty). Confirmed via a direct `jq` read of all seven new items'
  `snr`/`category`/`impact` fields and the `registry-candidates.json` `both_disputed_queue` entry. A
  `jq empty` parse check passed on all seven touched data files (items, held, state, source_ledger,
  sources, candidates, registry-candidates). `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~5.3h gap, unfiltered full source list (2026-11-06)

- 2026-11-06-F: A WebSearch-only discovery pass surfaced six seemingly-fresh candidates (NASA Ka-band
  relay awards to Viasat/SES/Astranis, Northwood Space's $375M Series C, a Satellogic/HEO non-Earth-
  imaging extension, the FCC/Amazon-Globalstar transfer approval, an FCC spectrum-sharing Federal
  Register update, and a general Europe-launch roundup) that all turned out to be already published in
  prior sweeps (2026-11-02 through 2026-11-04) once checked against `items.json` by headline keyword --
  a reminder that generic "<topic> November 2026" discovery queries mostly re-surface the same week's
  news the queue/signals legs already caught, so always dedup-check before drafting even when a story
  reads as brand new.
- 2026-11-06-G: An ISRO Chairman "first rocket from Kulasekarapattinam in March/April 2027" quote,
  carried by a cluster of Indian outlets (DT Next, Deccan Chronicle, etvbharat) dated around Nov 2,
  traced via WebSearch to the *same* March/April 2027 timeline The Week had already reported the ISRO
  chief stating back in March 2025 -- left undrafted as a recurring stock quote rather than new news,
  extending the 2026-11-04-J (Telesat/Goldberg) and 2026-11-04-O (SyLEx) stale-quote precedents to
  periodic government-official restatements, not just social-media resurfacing.
- 2026-11-06-H: A SemiAnalysis report on SpaceX's AI/data-center buildout pace (13GW in 18 months vs
  Google's 27-year footprint) picked up by a dozen finance outlets was judged out of scope entirely,
  not merely low-priority: it is about SpaceX's terrestrial compute business, not any EO/connectivity/
  launch/human-spaceflight activity, so CLAUDE.md's "financial events of tracked companies" scope
  clause does not reach it the way it would an actual launch, satellite, or spectrum story.
- 2026-11-06-I: NASASpaceflight's "final iROSA installed on ISS" spacewalk piece was left undrafted as
  routine NASA/ISS maintenance with no stated commercial contract, award, or capability-for-sale angle,
  distinguishing it from the human-spaceflight scope clause's "contracts and outcomes affect commercial
  providers" test; a future iROSA-adjacent item should still check whether the source names Boeing/
  Redwire's contract role before defaulting to out-of-scope.
- 2026-11-06-J: `bun scripts/finalize-sweep.ts` rejected the first draft attempt (a new Deutsche Telekom
  CEO commentary item, sharing company SpaceX and category `product` with the existing Oct 30 Starlink
  pricing-change item inside 7 days, hit the same-company-plus-category dedup false positive seen
  repeatedly this week); merged cleanly on the second attempt with a `dedup_distinct` attestation
  ("merged 1 new, 1 updated, 0 held"), 1163 items up from 1162. The update (Ars Technica's cost/
  manufacturing figures added to the Blue Origin GS3/Northstar item) left the item's SNR at its existing
  non-first-party ceiling of 4 since the modifiers were already maxed, confirming attaching a 4th
  corroboration source purely for reader value (new verbatim figures) is still worth a copy-changing
  `updates[]` entry even when the score itself cannot move. Confirmed via a direct `jq` read of the new
  item's `snr`/`snr_trace`/`category`/`impact` fields and the updated item's grown `sources` (4, up from
  3) and `updates` array. A `jq empty` parse check passed on all six touched data files (items, held,
  state, source_ledger, sources, candidates). `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~9h gap, unfiltered full source list (2026-11-06, second)

- 2026-11-06-K: `https://www.iceye.com/press` has now 404'd for at least five consecutive sweeps
  (four Nov 5 notes plus this run), well past the three-failure threshold, but `fail_count` in
  sources.json had stayed at 0/status `unverified` the whole time -- prior sweeps were logging
  dated failure notes without actually flipping status via `sourceHealth`. This run reported
  `status: "dead"` explicitly and it stuck. The newsroom content itself is still live at
  `https://www.iceye.com/newsroom/press-releases` (the actual press-release path; `/press` appears
  to be a stale redirect target); worth a reviewed PR to fix the configured URL rather than relying
  on agents to rediscover the working path every run.
- 2026-11-06-L: A Payload op-ed by a named non-whitelisted individual (Shield Space's CTO, writing a
  guest column on Russia's Cosmos 2612/ICEYE-X36 approach) qualifies as commentary under the
  "named outlet/author" clause even though the author isn't in signals.json; classed the source as
  `trade` (Payload is the outlet of record) rather than `informal`, scoring the attribution at the
  outlet's tier. `crawl: "found_none"` cost it one level since no second write-up of his specific
  argument existed; still publishable per the standing weak-sourcing-is-not-a-hold rule.
- 2026-11-06-M: Chased a Nov 6 European Spaceflight piece ("Avio Scales Back Demonstrator
  Programme") to its real event date: the article recaps Avio's September 10, 2026 half-year
  financial report rather than reporting new news today. Drafted dated 2026-09-10 per the
  predates-window convention, with `dedup_distinct` against both existing same-day Avio items
  (FD1 integration-complete, CEO SpaceX-capacity commentary) since all three are different facts
  from the same company's busy day. Andrew Parsonson's own same-day bluesky post repeating the
  story doesn't count as independent corroboration (he is European Spaceflight), so the item
  landed a `crawl: "found_none"` SNR 2.
- 2026-11-06-N: A near-total-junk 109-candidate queue (SpaceX/Tesla midterm-election stock churn,
  dozens of Google News financial-reaction pickups, routine Federal Register airworthiness
  directives, BBC non-space stories) still yielded genuine finds only by chasing items past the
  queue: the AST SpaceMobile/Firefly $1.3B Blacklift rocket deal was in the queue only as
  secondary Bloomberg/Barron's Google News redirects (which render as a bare "Google News" shell on
  direct WebFetch and need either the publisher URL or the `r.jina.ai` proxy to read), while
  Firefly's own first-party press release with the full financial/engine breakdown had to be found
  via WebSearch, not the queue. A CGTN "China launches new remote sensing satellites" queue entry
  and a discovery-pass China query both resolved to the already-published Nov 5 Yaogan-51 07-09
  item; a SpaceX/Coforge "Grok AI partner network" story was judged out of scope as SpaceX's
  terrestrial AI/compute business per the 2026-11-06-H precedent, not a satellite/launch event.
- 2026-11-06-O: `bun scripts/finalize-sweep.ts` rejected the first draft attempt (the Russian
  Security Council/Starlink-OneWeb item tripped the same-company-plus-category dedup heuristic
  against two unrelated existing geopolitical items sharing company SpaceX within 7 days: Mittal's
  sovereign-network commentary and the Ukraine Starshield contract-expiry item); merged cleanly on
  the second attempt with two `dedup_distinct` entries ("merged 5 new, 0 updated, 0 held"), 1168
  items up from 1163. Confirmed via a direct `jq` read of all five new items'
  `snr`/`category`/`impact` fields and the sweep log's `signals`/`discovery` blocks. A `jq empty`
  parse check passed on all seven touched data files (items, held, state, source_ledger, sources,
  candidates, registry-candidates); no registry-candidates entries were added since none of the
  five items' crossfeed blocks carried a fact. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~2.4h gap, unfiltered full source list (2026-11-06, third)

- 2026-11-06-P: Vivienne Machi's Nov. 6 Aviation Week piece on AFRL's Oracle-P cislunar-tracking
  prototype ("due to launch in mid-'27... following a swap in launch providers") read as a fresh
  schedule update but traced, via a SpaceNews/Potomac Officers Club search, to the same "2027
  launch" target the program has carried since at least a September 2023 SpaceNews piece on an
  earlier slip (2025 to 2027); no commercial contractor was named in any directly-fetched source
  and the "provider swap" detail added nothing dateable beyond the recurring target. Left
  undrafted as a thin, long-slipping institutional R&D program update, extending the standing
  stale-recirculation pattern to a years-long (not just weeks- or months-old) recurring delay.
- 2026-11-06-Q: A Daily Beast piece on the same-day SpaceX/White House Starlink billing item
  (Washington Post-led, single-sourced at `crawl: found_none`) had its own byline and added a
  genuinely new fact the original draft didn't carry (Democracy Defenders Fund, not the
  government, first identified three of the four contracts; a DOGE-installation security-concerns
  detail; chief counsel Virginia Canter's on-record "pay-to-play access" quote) rather than
  reading as a bare WaPo rewrite; treated as independent `mainstream` corroboration
  (`corroboration_2plus`, SNR 2 to 3) per the standing distinct-byline-plus-added-fact test, not
  the credits-the-original-outlet non-independence rule.
- 2026-11-06-R: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 0
  new, 1 updated, 0 held"), 1168 items unchanged. Confirmed via a direct `jq` read of the updated
  item's `snr`/`snr_trace` (2 to 3, `corroboration_2plus` applied cleanly alongside the existing
  `corroboration_none` modifier) and `sources` (2, up from 1) fields, and the sweep log's
  `signals`/`discovery` blocks (17-channel signals pass, 4 X handles, 8-query discovery matrix).
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6h gap, unfiltered full source list (2026-11-07)

- 2026-11-07-A: `signalsPass.checked` must list a fetchable channel's canonical `url` from
  signals-context, not its `rss` field: listing European Spaceflight's substack as
  `.../feed` (the `rss` value) got the whole draft rejected ("not a fetchable whitelisted signal
  channel"); the fix was the bare `https://europeanspaceflight.substack.com` URL instead.
- 2026-11-07-B: The same-company-plus-category dedup false positive fired again for a plain
  national-security Falcon 9 launch (USSF-432) against the unrelated Oct-31 "700th Falcon 9
  launch" milestone item, six days earlier, on shared company + category + window alone, extending
  the standing pattern (first logged 2026-10-07 for Hanwha, SpaceX/NASA/Blue-Origin/etc. before
  that) to the single most generic possible pairing: two ordinary Falcon 9 launches a week apart.
  One `dedup_distinct` cleared it.
- 2026-11-07-C: A days-old wire story (Reuters, Nov 5, on Russian satellites Cosmos 2611/2613
  approaching a second ICEYE satellite, X37) was a genuinely new item, not an update to the
  Oct-17 Cosmos 2612/X36 item: 19 days past that item's last `updates[]` entry and well outside
  both the 7-day same-event window and the 30-day SNR-1-2 reinforcement window (the Oct 17 item is
  SNR 4). Cross-linked the Oct-17 item's lead source in `secondary_urls` per the "anything else"
  branch of the dedup rule rather than stretching the living-document pattern past its stated
  windows. Needed a `dedup_distinct` against a same-week ICEYE/`incident`-category commentary item
  (Molland/Shield Space jamming op-ed) on event-kind-differs grounds (op-ed speculation vs a new
  Reuters-sourced satellite-approach report), per the 2026-10-07-I precedent.
- 2026-11-07-D: For "attack rehearsal"-type quotes recurring identically across several
  independently-WebFetched outlets (Insider Paper, United24 Media) quoting the same analyst, the
  repetition across multiple separate direct fetches is reasonable confirmation it's a real
  verbatim quote in those pages, not a WebSearch-synthesis artifact; treated as citable with
  outlet attribution rather than discarded on direct-fetch-only purism, since the underlying
  analyst's own site (fetched separately) used more hedged language dated weeks earlier and was
  cited separately for that hedged framing instead.
- 2026-11-07-E: `bun scripts/finalize-sweep.ts` merged cleanly on the fourth attempt after fixing
  the signals-channel URL, adding one `dedup_distinct`, and trimming two taglines over the
  140-char cap ("merged 3 new, 1 updated, 0 held"), 1174 items up from 1171. Confirmed via a direct
  `jq` read of all three new items' `snr`/`impact`/`category` fields and the AST SpaceMobile
  update's `sources` count (3 to 4) and the sweep log's two automatic persistence `snr_movements`.

## Narrow re-check, ~8h gap, unfiltered full source list (2026-11-07, second)

- 2026-11-07-F: A UK MOD `gov.uk` press release (Titania/ISTARI satellite reaching orbit) failed
  the `official_record` anti-spoof host check the same way as the 2026-10-15-E `.gov.uk` ClearSpace
  case; reclassified to `trade` per that same precedent rather than resubmitting. A company's own
  official X post (@Starlink confirming Router 4 shipping) hit the same wall as 2026-10-29-E
  (hostname x.com never matches a registry `website` field of spacex.com): reclassified `informal`.
  Both precedents held up unchanged three weeks later; worth trusting on sight rather than
  re-deriving from the raw error message each time.
- 2026-11-07-G: A Bytes Europe/Ynetnews piece on Israel's "Access to Space" program ("will help 15
  companies... over the next three years", 60M NIS / $19M, 35% subsidy) traced via JNS/JPost to the
  program's original December 2025 launch announcement, which stated the identical "minimum 15
  payloads within three years" target and funding figure; left undrafted as stale recirculation of
  an 11-month-old announcement rather than a genuine new selection-of-15-companies milestone, since
  no source actually named the selected companies or confirmed the selection had concluded.
- 2026-11-07-H: SpaceX board member Donald Harrison's resignation (Nov 4, Musk citing "too many
  conflicts of interest involving Alphabet", filing states no disagreement over operations/policy)
  was judged routine board-composition governance below the inclusion bar, same tier as the
  standing routine-executive-hire exclusion, despite a Bloomberg headline framing it as happening
  "amid Tesla merger discussions" — the actual filing ties the departure to Alphabet's shareholder
  conflict, not the merger evaluation, and the merger-consideration story itself is already tracked
  via the 2026-10-20 committees item plus a string of analyst-commentary items.
- 2026-11-07-I: Galactic Energy's Ceres-2 Y3 (Nov 7, Jiuquan) was the medium-lift vehicle's first
  successful flight, ten months after a January 17 nozzle-liner failure on its maiden launch;
  scored `notable` rather than `seismic` since CLAUDE.md reserves "first flight of a new vehicle"
  for maiden flights, and this is a return-to-flight recovery, not a debut. `china-in-space.com`
  (Andrew Jones) gave the most complete verbatim figures of any outlet checked (flight count
  context, exact payload names, nozzle-liner failure detail) and is worth treating as a go-to trade
  lead for Chinese commercial launch stories alongside CGTN for mainstream pickup.
- 2026-11-07-J: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on three grounds at
  once (the `gov.uk` and `x.com` anti-spoof host failures above, plus a same-company-plus-category
  dedup false positive pairing the new Starlink router-shipping item against both the Oct-30
  residential-pricing item and the Nov-5 Deutsche Telekom CEO commentary item on shared
  company+category alone); merged cleanly on the second attempt after the two reclassifications and
  one `dedup_distinct` entry covering both prior items ("merged 3 new, 0 updated, 0 held"), 1177
  items up from 1174. Confirmed via a direct `jq` read of all three new items' `snr`/`impact`/
  `category` fields and the sweep log's `signals`/`discovery` blocks (17-channel signals pass, 4 X
  handles, 8-query discovery matrix). A `jq empty` parse check passed on all seven touched data
  files (items, held, state, source_ledger, sources, candidates, registry-candidates); no
  registry-candidates entries were added since none of the three items' crossfeed blocks carried a
  fact. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h gap, unfiltered full source list (2026-11-07, third)

- 2026-11-07-K: A near-total-junk 40-candidate queue (SpaceX/Tesla post-midterm stock-reaction
  spam, a Starship IFT-15 Nov. 13 preview, Pakistani-astronaut-on-Shenzhou-24 wire pickups with no
  commercial prime) still yielded two genuine commentary finds once chased past the headline:
  Musk's own Nov. 6 Baron Investment Conference remark that SpaceX could "just acquire that legacy
  telco" and use its spectrum "ten times more effectively" (24/7 Wall St. lead, TeslaNorth's full
  interview writeup as independent corroboration), and a Nov. 3 Morgan Stanley note (Adam Jonas,
  "SPCX Getting Even Cheaper") picked up by TheStreet Nov. 7 that SpaceX now trades cheaper than the
  S&P 500 on 2028 earnings. TheStreet itself 403'd; `louisvelazquez.com`'s republication explicitly
  credited TheStreet by name (classed `trade` per the standing republication-attribution pattern),
  with `finance.biggo.com`'s independently-headlined writeup as genuine corroboration. 24/7 Wall
  St. had no prior classification precedent in this file; treated as `trade` (same tier as
  Benzinga/TheStreet/Motley Fool) rather than `informal`.
- 2026-11-07-L: Both new items shared company SpaceX + category `financial` with a crowded field of
  12 existing items from the prior two weeks (Q3 earnings, the Tesla-SpaceX merger committee event,
  and seven distinct analyst/named-voice commentary items); pre-empting all 12 `dedup_distinct`
  entries on EACH new item (plus cross-referencing each other) got a clean first-attempt merge with
  zero rejections, confirming the 2026-10-15-J "default to pre-empting whenever a new item shares
  SpaceX + a common category with any existing item from the last 7 days" practice scales even when
  the colliding set is this large.
  Also folded in a no-bump enrichment on the Oct. 6 GPU-financing item: Goldman/Apollo began
  shopping the $40B deal to outside investors in up-to-$500M slices ahead of formal syndication
  (24/7 Wall St., corroborated by a Bloomberg pickup on theedgemalaysia.com), with the package now
  described as ~$47.3B including an $8.3B senior secured loan and a $7B lease prepayment.
  `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 2 new, 1 updated, 0
  held"), 1179 items up from 1177. Confirmed via a direct `jq` read of both new items'
  `snr`/`category`/`impact`/`kind` fields (both SNR 4: trade base 3 plus `corroboration_2plus`) and
  the GPU-financing item's grown `sources` (9, up from 7) and `updates` (6, up from 5) arrays. A
  `jq empty` parse check passed on all six touched data files (items, state, held, source_ledger,
  sources, candidates). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~6.75h gap, unfiltered full source list (2026-11-08)

- 2026-11-08-A: `nasa.gov/news-release/...` is a usable `official_record` lead (base tier 5,
  matching the precedent already set for `science.nasa.gov`): NASA's own Nov. 7 Moon Base press
  release gave exact dollar figures (a Blue Origin PROMISE rover contract at $94M base + $140M
  option, $1.3B combined VADR launch task orders to three providers, and the CLPS 2 $10B/10-year
  vendor-pool ceiling) that trade and mainstream rewrites (NASASpaceflight, Fox Business) only
  partially carried. One NASA press event with three genuinely distinct stated-value facts split
  into three items (same pattern as the 2026-11-06 Avio same-day-different-facts precedent);
  each needed mutual `dedup_distinct` against each other AND against two unrelated pre-existing
  NASA/SpaceX procurement items from the same week (`2026-11-04-nasa-viasat-ses-astranis-kaband-relay`,
  `2026-11-06-spacex-white-house-starlink-donation-contracts`) purely on shared company + category
  "procurement" within 7 days.
- 2026-11-08-B: WebFetch renders Bluesky profile pages (`bsky.app/profile/...`) as a blank JS
  shell with no post content, confirming the 2026-11-05-H precedent; the public
  `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=10` endpoint
  returns real post text and `createdAt` timestamps and is the reliable way to run the signals
  pass's fetchable Bluesky channels, not WebFetch on the profile URL itself (which still belongs
  in `signalsPass.checked` per the 2026-11-07-A canonical-URL rule).
- 2026-11-08-C: Two "known to MCC" matches landed outside the literal 7-day window from the
  item's original `date` but inside 7 days of that item's most recent `updates[]` entry: a new
  Blumenthal Starlink/Starshield statement (24 days after the Oct-14 Ukraine speed-restriction
  item's first publish, but only 3 days after its Nov-5 update) and a new Hinojosa Boca-Chica
  land-talks-pause story (16 days after the Oct-20 park-sale-denial item's publish, but 5 days
  after its Oct-31 update). Both merged cleanly as `updates[]` attaches; confirms the dedup
  window should be read against the living item's last touch, not its original publish date, for
  these open-ended saga items.
- 2026-11-08-D: A BASENOR Nov. 8 "SpaceX Booster 1067 Hits 37 Flights" piece recirculated the
  identical 37-flight figure already published Aug. 25 (`2026-08-25-spacex-b1067-37th-flight-final-florida-starlink`);
  left undrafted as stale recirculation, not a new reuse record.
- 2026-11-08-E: Several low-tier SEO/aggregator sites (gsmgotech.com, rsinc.com,
  shuttlepresskit.com) covering "Starlink surge pricing" conflated two different, unrelated
  Starlink programs: the long-running one-time "demand surcharge" sign-up fee in high-congestion
  areas (unchanged since 2025, per notebookcheck.net) and the newer monthly "dynamic pricing"
  pilot already covered in `2026-10-30-starlink-dynamic-residential-pricing-maritime-hike`
  (Missouri/Kansas, per How-To Geek). The figures across these sites were mutually inconsistent
  and no credible outlet confirmed a genuine nationwide expansion beyond the existing pilot;
  left undrafted rather than guessing which program a given number belonged to.
- 2026-11-08-F: `bun scripts/finalize-sweep.ts` rejected the first draft attempt (the three NASA
  Moon Base items each tripped the same-company-plus-category dedup heuristic against two
  unrelated existing NASA/SpaceX procurement items from the same week); merged cleanly on the
  second attempt after adding the cross-item `dedup_distinct` entries above ("merged 3 new, 2
  updated, 0 held"). Confirmed via a direct read of all three new items' `snr`/`category`/
  `impact` fields (procurement/major, procurement/major, procurement/notable) and the two
  updated items' grown `sources`/`updates` arrays. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~8.4h gap, unfiltered full source list (2026-11-08, second)

- 2026-11-08-G: A near-total-junk 40-candidate queue (Pakistani-astronaut-on-Shenzhou wire
  pickups with no commercial prime, SpaceX/Tesla stock chatter, off-topic BBC/CGTN/Futurism
  science and entertainment pieces) still yielded one genuine find by chasing a Google News
  pair past the headline: a new "Retailers" page on Starlink's own site (Nov. 6, unfetchable
  directly, standard JS-shell) invites any US store to apply to sell its kits for commission.
  TeslaNorth led (`trade`) with Notebookcheck's independently-bylined write-up (different
  detail: the $300 kit price, the endcap-display requirement) as genuine `corroboration_2plus`;
  a third queue entry (Mezha.net) 403'd on direct fetch and was left unattached rather than
  cited unseen. A Motley Fool piece pitting Morgan Stanley's $300 target against Michael
  Burry "overvalued" quotes read as fresh but the Burry quotes themselves trace to this
  summer's IPO-prospectus commentary (already stale by the time of the already-published
  July 7 price-target item); left undrafted as a recap with old quotes, not new news. A
  FourWeekMBA "$75B" Apollo chip-deals piece turned out to be the already-published $40B/
  $47.3B SpaceX GPU lease summed with an unrelated $35B Anthropic/Broadcom deal; no new
  SpaceX-specific fact, left undrafted. A KeepTrack "Starlink Mobile as a Major Carrier"
  piece and two "NASA's $10B Moon base" Google News hits were pure recaps of already-published
  facts (Qualcomm deal, Boost Mobile talks, Höttges $200B quote; the Nov. 7 CLPS 2 items),
  caught by grepping `items.json` by headline keyword before spending search budget on them.
- 2026-11-08-H: The new Starlink retailer item tripped the standing same-company-plus-category
  dedup heuristic three ways (the Oct. 30 dynamic-pricing item, the Nov. 5 Deutsche Telekom
  $200B commentary item, the Nov. 6 Router 4 shipping item, all sharing company SpaceX +
  category `product` within 7 days); three `dedup_distinct` entries cleared it on the second
  attempt, each a genuinely distinct fact (a pricing change, a named exec's cost estimate, a
  new hardware SKU shipping, vs. a new wholesale retail channel).
- 2026-11-08-I: RussianSpaceWeb's `buro1440-2026-0719.html` page (the existing Rassvet-3
  item's own lead source, re-fetched) flipped Satellite No. 23's status again: having
  "revived" and climbed per the Oct. 31 update, it is now forecast to decay within 78 hours
  of Nov. 6 08:15 UTC. Folded in as a no-bump `updates[].attach: []` + `patch: {}` copy-only
  enrichment (no new source URL, just updated content on the same already-attached page),
  matching the item's own prior pattern for this living-document saga.
- 2026-11-08-J: The 17-fetchable-channel signals pass found nothing new anywhere: every
  Bluesky/site/substack feed's newest entry predated this run's ~8.4h window (lastSweep
  2026-11-08T05:32Z), confirming that on a short gap the fetchable leg can legitimately come
  back empty across the board, not just from a few channels. `europeanspaceflight.substack.com`
  403'd (covered via the europeanspaceflight.com site URL instead, which did return content).
  The 10-query discovery matrix (launch, financial, incident, China, India, EO, FCC, Europe,
  Japan, launch-vehicle-failure) surfaced only already-published items (CesiumAstro, Xona,
  Northwood, Astranis/NASA Ka-band, Amazon-Globalstar, Meteor 2-7, OHB Sentinel-3) or stale
  recaps (Landspace megaconstellation contracts recapping Aug/Sept 2025 awards, an ASF/NASA
  SAR contract from June); one genuinely new funding round (EOS-X Space, $120M, Madrid) was
  judged out of scope as suborbital stratospheric-balloon tourism, not a first flight or
  incident.
- 2026-11-08-K: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the three
  same-company-plus-category dedup false positives above; merged cleanly on the second attempt
  ("merged 1 new, 1 updated, 0 held"), 1183 items up from 1182. Confirmed via a direct `jq`
  read of the new item's `snr`/`snr_trace`/`category`/`impact` fields (SNR 4: trade base 3
  plus `corroboration_2plus`) and the updated Rassvet item's grown `sources` (10, unchanged)
  and `updates` (8, up from 7) arrays. A `jq empty` parse check passed on all seven touched
  data files (items, state, held, source_ledger, sources, candidates, registry-candidates);
  only five of the seven (items, state, source_ledger, sources, candidates) actually changed.
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~3h15m gap, unfiltered full source list (2026-11-08, third)

- 2026-11-08-L: A near-total-junk 43-candidate queue (FAA airworthiness directives, an FCC
  Odessa TX broadcast-license notice, NOAA fishery notices, a wall of Google News SpaceX/Tesla
  midterm-election stock-reaction pieces, three bot/spam Bluesky search hits, off-topic
  Futurism/Space.com/BBC filler) yielded nothing of its own; two queue entries that looked
  promising on headline alone both traced to already-published stories once checked: Bloomberg/
  Barron's "AST SpaceMobile to build its own rocket" is the same Nov. 6 Firefly Blacklift deal
  already published, and a Payload "NASA Unveils Moon Base Awards" piece recaps the same Nov. 7
  NASA press event already split into three items. A naive grep for "planet ai app" (literal
  three-word substring) missed the already-published `2026-11-05-planet-ai-app-launch` item
  because the actual headline reads "Planet launches free AI App for..." with other words
  between "Planet" and "AI App"; worth checking a topic with a jq/company-name search rather
  than a rigid literal-phrase grep before spending research budget on it. An "Eyes Only with Wes
  O'Donnell" Ukraine "$0-satellite" piece was confirmed stale recirculation of the already-
  published Himera/GomSpace Oct. 30 test-satellite item.
- 2026-11-08-M: The one genuine find came entirely from the discovery pass's required ESA/Europe
  leg: ArianeGroup's Prometheus reusable methane engine completed its first hot-fires on ESA's
  newly methane-capable P5 test bench at DLR Lampoldshausen on Oct. 29, reported via ESA's own
  article (official_record, SNR 5, the v2 scorer's found_none-doesn't-penalize-direct-sources
  rule held since nothing else covered this specific test). Drafted dated on the actual Oct. 29
  test date despite predating the sweep window, per the don't-drop-a-genuine-gap-as-stale rule,
  even at `noise` impact (a routine-shaped ground test, not the "important/seismic" case that
  rule was written for) since every on-scope fact still publishes. ESA's own page reporting on
  ArianeGroup's (not ESA's) funded-program test result classed `official_record`, extending the
  2026-11-04-B NASA-blog-on-third-party-program precedent to ESA.
- 2026-11-08-N: All 17 fetchable signals channels were checked (10 bluesky `getAuthorFeed` API
  calls, 7 direct site/substack fetches) and 4 X handles searched; everything found predated the
  ~3h15m window or was already published (Avio STS scope-back, OHB Sentinel-3, PLD Miura 5
  test, SyLEx, NASA Moon Base items). `europeanspaceflight.substack.com` 403'd again, covered via
  the `europeanspaceflight.com` site instead per the standing 2026-11-08-J workaround.
- 2026-11-08-O: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 1
  new, 0 updated, 0 held"), 1184 items up from 1183. Confirmed via a direct `jq` read of the new
  Prometheus item's `snr`/`snr_trace`/`category`/`impact` fields and a `jq empty` parse check on
  all five touched data files (items, state, source_ledger, sources, candidates); held and
  registry-candidates were untouched since this draft had no held entries or crossfeed facts.
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h gap, unfiltered full source list (2026-11-08, fourth)

- 2026-11-08-P: A near-total-junk 30-candidate queue (SpaceX/Tesla stock-reaction Google News spam,
  Pakistani-astronaut-on-Shenzhou-24 wire pickups with no commercial prime, off-topic Futurism
  AI/climate pieces, a wall of bot-shaped Bluesky posts: a launch-viewing-app promo, an FAA launch
  schedule bot, a Kalshi prediction-market bot, a Starbase local-opinion rant) yielded one genuine
  find only via the Launch Library queue entry itself: a provisional "SatNet LEO Group TBD?"
  listing resolved on direct fetch to a successful Long March 12 launch of the 29th Guowang batch
  (Nov 8, 20:24 UTC, Wenchang Commercial LC-2). A Chinese-language search surfaced CCTV News
  coverage (via a Sina portal repost) as genuine corroboration, consistent with the 2026-10-09-G
  precedent of classing CCTV-sourced Chinese portal reposts as `mainstream` tier 3, not `trade`.
  Simplywall.st's "SpaceX Lands $45B AI Deal And Moves To Merge xAI" read as new but the $45B
  figure traces to the already-published Sept 29 Anthropic compute-deal item (now at $120.5B per
  IPO filing) and the one-sentence "plans to fold xAI into SpaceX" claim carried no attribution,
  date, or source of its own; left undrafted as thin aggregator rewrite plus unsourced speculation.
  A Wccftech/TeslaNorth writeup of Musk's Nov 6 Baron-conference remark on ~100k V4 Starlink
  satellites "outcompeting undersea cables" (paired with an FT/Windward report on Iran-linked ships
  lingering over Gulf of Oman cables) was judged below the inclusion bar: Musk's own 100-laser
  figure is explicitly aspirational/unconfirmed per his own caveat, and it is pure forward tech-
  roadmap hype about hardware that does not exist yet, not a stated commercial action; left
  undrafted rather than publishing attributed commentary on an unconfirmed spec. A TechCrunch
  "Sequoia partners reportedly blindsided when Roelof Botha joined SpaceX board" item was judged
  routine board-composition news (same tier as the 2026-11-07-H Donald Harrison precedent), the
  "reportedly" hedge weakening it further.
- 2026-11-08-Q: All 17 fetchable signals channels (10 Bluesky `getAuthorFeed` calls, 7
  site/substack fetches) came back with nothing newer than lastSweep (2026-11-08T17:26Z) across
  the board on this ~5h gap, extending the 2026-11-08-J/N pattern to a third consecutive narrow
  sweep; 6 X handles searched (Peter Beck, Tory Bruno, Michael Sheetz, Joey Roulette, Sandra Erwin,
  Jared Isaacman) likewise surfaced nothing inside the window.
- 2026-11-08-R: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 1 new,
  0 updated, 0 held"), 1185 items up from 1184. Confirmed via a direct `jq` read of the new Guowang
  Group 29 item's `snr`/`category`/`impact` fields (SNR 4: aggregator base 4, `corroboration_2plus`
  offset by nothing else) and a `jq empty` parse check on all five touched data files (items, state,
  source_ledger, sources, candidates); held and registry-candidates were untouched (no held entries,
  no crossfeed facts: the item stated only a batch count, not a cumulative total, so
  `sats_launched_total` could not be crossfed). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~18.3h gap, unfiltered full source list (2026-11-09)

- 2026-11-09-A: Confirms 2026-10-22-L: NTT's own newsroom (`group.ntt`) and Rakuten's own newsroom
  (`global.rakuten.com`) both tripped the anti-spoof gate as `first_party` ("not an official
  first_party host; reclassify") because neither company has a registry organization entry
  recording its website; reclassifying both to `trade` cleared the gate on the second attempt and
  both still reached SNR 4 on `corroboration_2plus`. Any actor without a registry profile needs a
  `trade`/`informal` fallback budgeted in from the start, not `first_party`, however clearly the
  page is the company's own announcement.
- 2026-11-09-B: A heavily SpaceX-stock-reaction/Starship-schedule-noise ~145-candidate queue still
  yielded seven genuine finds, all via the queue's own direct trade-source entries (European
  Spaceflight, Payload, Planet Labs IR) or the discovery pass, not Google News: a SaxaVord UK
  government equity stake (Companies House filing, via European Spaceflight), RFA's first public
  2027-slip confirmation, a Planet/Stoke Space Nova multi-launch deal, Canada's budget formally
  extending Launch the North to medium-lift, a Marble Imaging €6M seed extension, and two Japan
  constellation moves surfaced only via targeted discovery queries (not the queue): the NTT-led
  five-company mega-constellation MOU and the Rakuten AST joint venture's formal incorporation
  (both dated Nov 6, announced Nov 9).
- 2026-11-09-C: A "Room — The Space Journal of Asgardia" queue entry headlined "US rocket launch
  company targets Scottish spaceport" read as new but traced entirely to the already-published
  Nov 5 LEAP/Sutherland Spaceport MOU item; worth a reminder that a differently-worded headline
  from an unfamiliar outlet is not proof of a new story, check company + spaceport name against
  `items.json` before spending discovery budget on it.
- 2026-11-09-D: Andrew Parsonson's own Bluesky feed (fetchable signals channel) posted the exact
  SaxaVord and RFA stories same-day as his European Spaceflight bylines, confirming (not adding
  independent corroboration to) both drafts; his other recent posts (MDA/IRIS2, Stellar Alpina,
  Avio STS, BEST 2, PLD Miura 5, SyLEx) were all already-published stories, a clean example of a
  single author's channel and site both surfacing in-window without yielding anything extra.
- 2026-11-09-E: Eric Berger's and Tim Farrar's bluesky `getAuthorFeed` calls both returned posts no
  newer than June/July 2026 despite both accounts being active elsewhere; unclear if this is an API
  staleness issue or an actual posting lull, but worth re-checking next sweep rather than assuming
  the channels are dead.
- 2026-11-09-F: A SpaceNews piece on a "Chinese startup rais[ing] funds for a space situational
  awareness constellation" 429'd on direct fetch; secondary summaries traced the funding to
  Xingchen Daohe's ~$14.8M July 2026 round, already stale by the dedup window, bundled into a
  general SSA-sector trend piece. Left undrafted rather than dating a fact from a secondary
  summary of an article never actually read; worth a direct SpaceNews re-fetch next sweep once
  the rate limit clears.
- 2026-11-09-G: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the NTT/Rakuten
  anti-spoof misclassification above; merged cleanly on the second attempt ("merged 7 new, 0
  updated, 0 held"), 1192 items up from 1185. Confirmed via a direct `jq` read of all seven new
  items' `snr`/`category`/`impact` fields and a `jq empty` parse check on all six touched data
  files (items, state, held, source_ledger, sources, candidates); held and registry-candidates
  were untouched (no held entries; none of the seven items' companies had registry profiles with
  a like-for-like metric to crossfeed). `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~10-minute gap, unfiltered full source list (2026-11-09, second)

- 2026-11-09-H: A sweep launched only ~10 minutes after the prior one's merge is a legitimate
  genuine-zero case, not a signal to skip the loop: the 15-candidate queue's one substantive-
  looking lead (an Aviation Week "CesiumAstro Secures $730M..." Google News hit) traced via
  WebSearch straight to the already-published Nov. 5 Series D item, and a Morgan Stanley
  "reiterates $300 target after post-midterm sell-off" note added no new figure or argument
  beyond the Oct. 14/Nov. 3 notes already published, extending the recurring-analyst-reiteration-
  is-not-new-news pattern (ISRO chairman, Telesat/Goldberg, SyLEx) to Adam Jonas's SpaceX target.
  A Cathie Wood/ARK "sells AI stock, buys SpaceX" piece was left undrafted too: ARK discloses
  trades daily (also bought SpaceX Nov. 4, traded Broadcom/Nvidia Nov. 5), so a bare trade
  execution with no named analytical quote is routine portfolio churn, not the "take, analysis, or
  position from a named voice" the commentary kind requires (distinct from the Oct. 29 ARK merger-
  model item, which carried an actual $2.7T analytical claim).
- 2026-11-09-I: A NASA "$1 million Moon Base Student Challenge" (Isaacman announcing cash prizes
  for students at a KSC air show) was judged out of scope despite being a dateable NASA human-
  spaceflight-program announcement: it is STEM outreach with no contract, commercial provider, or
  procurement angle, unlike the CLD/Artemis/CLPS awards the human-spaceflight scope clause actually
  covers.
- 2026-11-09-J: On this short a gap, checking 13 of 17 fetchable signals channels directly (the
  other 4 covered via an already-checked equivalent surface for the same person, e.g. Parsonson's
  bluesky standing in for his substack) and running the full 8-query discovery matrix still found
  nothing: everything traced to stories already published in the immediately preceding sweep
  (SaxaVord UK stake, RFA 2027 slip, the Guowang 29th batch under CGTN's Beijing-time framing of
  the same Nov. 8 20:24 UTC launch). `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST
  attempt ("merged 0 new, 0 updated, 0 held"), 1192 items unchanged. Confirmed via a direct `jq`
  read of the sweep log's `signals`/`discovery` blocks in `state.json`. `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~8h25m gap, unfiltered full source list (2026-11-10)

- 2026-11-10-A: All 7 YouTube signals channels (Berger, Zak, Parsonson, Manley, Dodd, House,
  Schlang) again 404'd at the harvester level, extending the 2026-10-13-A pattern; still not
  reachable by anything the drafting agent can fetch directly, so just noted rather than chased.
  A ~83-candidate queue was almost entirely SpaceX stock-reaction spam around the newly-surfaced
  Starbase $24B gas-power-plant/super-compute-facility plan (SpaceX's own AI/xAI compute buildout,
  left out of scope per the standing 2026-11-06-H terrestrial-compute-business exclusion even
  though the land sits at Starbase) and Tesla-SpaceX-merger speculation; genuine finds came
  entirely from the fetchable-signals leg (Vivienne Machi's Aviation Week author page) and chasing
  one queue-adjacent Google News AST SpaceMobile hit to its SEC filing, not the queue's own
  content.
- 2026-11-10-B: Rocket Lab's Q3 2026 earnings exhibit (SEC Ex. 99.1, official_record) and a
  separate same-day GlobeNewswire release specifically about $515M in new Neutron launch
  contracts are two distinct company releases; the earnings exhibit alone didn't name the
  Neutron customers, but a StockTitan mirror of the dedicated Neutron release did (ICEYE x3, Muon
  Space x2, Starcloud, Kepler Communications, US Space Force SB-AMTI x1, base price up to $70M
  from $55M). Worth checking for a company's second, narrower same-day release when the primary
  earnings exhibit is thinner on a specific sub-story than secondary coverage suggests it should
  be, rather than assuming one document is the whole story.
- 2026-11-10-C: `dedup_distinct` must sit at the drafted item's top level, not nested inside its
  `scoring` block; placing it under `scoring.dedup_distinct` silently didn't register and the
  gate rejected three same-company-plus-category collisions (AST SpaceMobile vs. the Nov. 2
  Adderton pivot-commentary item; a T-Mobile/SpaceX commentary item vs. three unrelated Nov.
  5-6 SpaceX `product` items) that dedup_distinct entries should have cleared on the first
  attempt. Moving the array up to the item's own level fixed it; the worked example in
  prompts/update-items.md shows it correctly at the top level already, so this was a drafting
  slip, not an ambiguous spec.
- 2026-11-10-D: Two named T-Mobile executives (COO Jon Freier, CCO Andre Almeida) dismissing
  Starlink Mobile as a low-density-only niche at a company event (T-Mix) is a distinct commentary
  item from the standing string of T-Mobile CEO Gopalan quotes on the same theme (Oct. 28 MVNO
  rejection, a separate Oct./Nov. "exaggerated" framing): different named speakers, different
  venue, substantive enough technical claims to clear the commentary bar on their own, single-
  sourced to Fierce Network at an honest `crawl: "found_none"` SNR 2.
- 2026-11-10-E: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on three
  same-company-plus-category dedup collisions caused by the `scoring.dedup_distinct` placement
  bug above; merged cleanly on the second attempt after moving the arrays to the item level
  ("merged 3 new, 0 updated, 0 held"). Confirmed via a direct `jq` read of all three new items'
  `snr`/`impact`/`category` fields (1195 items, up from 1192: Rocket Lab Neutron backlog SNR 5
  major financial; AST SpaceMobile Q3 results SNR 5 notable financial; T-Mobile Starlink-dismissal
  commentary SNR 2 notable product) and a `jq empty` parse check across all six touched data files
  (items, state, source_ledger, sources, candidates, held). `bun run build` was not attempted, per

## Narrow re-check, ~3h18m gap, unfiltered full source list (2026-11-10, second)

- 2026-11-10-F: A near-total-junk 17-candidate queue (SpaceX $24B Starbase gas-power/
  supercompute buildout, the standing terrestrial-compute exclusion per 2026-11-06-H/
  2026-11-10-A; SpaceX/Tesla stock reaction; scheduled-not-yet-flown Starship IFT-15/
  Vandenberg previews) still yielded a routine Russian GLONASS-K launch (Nov 7, Plesetsk)
  via RussianSpaceWeb once Zak's own `glonass-k-2026-2.html` page was found (search-only,
  not a guessed URL pattern; `glonass-k-20.html` 404'd). The Russian MoD itself never names
  the payload type (standard classified-launch language); Zak's own page hedges the
  identification as "presumed" GLONASS-K1, so the item's headline/copy kept that hedge
  rather than asserting the satellite type as confirmed fact.
- 2026-11-10-G: An FT headline in the queue ("BT cools on Starlink satellite tie-up after
  Elon Musk Ukraine controversy," 16 minutes old at fetch time) could not be drafted: ft.com
  is on the standing unfetchable list, and WebSearch's index had nothing yet, not even a
  crediting mirror, this fresh into the story. Left undrafted per the never-cite-an-unfetched-
  page rule rather than reconstruct it from the headline alone; worth a same-topic re-check
  next sweep once a mirror exists.
- 2026-11-10-H: A Dealroom-only "Transcom Instruments buys satellite-nav tester for $133M"
  queue headline (Chinese Transcom Instruments acquiring GNSS-test-equipment firm Weiyu
  Tiandao) resolved via WebSearch synthesis but the Dealroom source itself 403'd on every
  fetch attempt; left undrafted both for the unverified-primary-source reason and a genuine
  scope judgment call (a domestic Chinese M&A between two test-equipment makers, neither a
  constellation operator, launch provider, nor ground-segment company serving the space
  industry specifically, reads as outside CLAUDE.md's ecosystem carve-outs even though one
  product line touches satellite-navigation simulation).
- 2026-11-10-I: Vivienne Machi's Aviation Week author page surfaced three same-day (Nov 9)
  bylines; two (Rocket Lab's $515M Neutron backlog, Planet/Stoke Space Nova deal) traced to
  already-published items from the immediately preceding sweep, but the third (ICEYE US CEO
  Ann Stevens telling Aviation Week the company wants to become a SAR payload provider to
  prime contractors) was genuinely new and undrafted; worth continuing to check all bylines
  on this page individually rather than assuming one hit means the others are covered too.
- 2026-11-10-J: Jeff Foust's bluesky feed listed a "NASA proceeds with plans to convert Mars
  rover engineering model into a lunar rover" headline that read as a fresh Nov 8 story but
  traced, once the actual cited SpacePolicyOnline source was fetched, to a June 30, 2026
  announcement; the genuinely new angle (RTG recycled from Cassini, <$400M total delivery
  cost including the lander, 1m drill, VIPER instrument copies) came instead from a Nov 9
  Register piece on the same program, found only via a targeted search once the June-dated
  source ruled out the WebSearch synthesis's implied freshness. The same SpacePolicyOnline
  Nov 7-8 Moon Base recap also carried a genuine, separate enrichment (Griffin/Endurance/
  Trinity CLPS missions all slipping into 2027; NASA's "10 CLPS landings a year" cadence
  target now starting 2028, not 2027) folded into two different existing items rather than
  one, since each fact fit a different item's own topic more precisely than a single
  catch-all patch would have.
- 2026-11-10-K: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged
  3 new, 3 updated, 0 held"), 1198 items up from 1195. Confirmed via a direct `jq` read of
  all three new items' `snr`/`impact`/`category` fields (GLONASS-K launch SNR 4 noise launch;
  ICEYE SAR-payload-provider SNR 2 noise product; Barclays/T-Mobile commentary SNR 2 notable
  financial, 11 `dedup_distinct` entries pre-empted in one pass against the crowded SpaceX
  financial/commentary field) and all three updated items' grown `sources`/`updates` arrays
  (HPE/Griffin: 4 sources, 1 update; CLPS 2: 5 sources, 1 update; PROMISE rover: 5 sources, 1
  update, both held at their official_record ceiling of 5). `bun run build` was not attempted,
  per
  the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~9.7h gap, unfiltered full source list (2026-11-10, third)

- 2026-11-10-L: A company's own IR/newsroom page can pass the `first_party` anti-spoof host
  check via subdomain match even when its registry `website` field points elsewhere: BlackSky's
  `ir.blacksky.com` matched registry host `blacksky.com` (subdomain of the registered apex) and
  Firefly's own `fireflyspace.com` press release matched its registry host exactly, both scoring
  SNR 5 as single-source first-party leads with `crawl: "found_none"` costing nothing (direct
  sources take no corroboration penalty). By contrast Redwire's `ir.rdw.com` and Airbus's
  `airbus.com` newsroom do NOT match their registry hosts (`redwirespace.com` and
  `space-solutions.airbus.com` respectively) and were reclassified to `wire_pr` rather than
  resubmitted as `first_party`, extending the ispace-inc.com/boe.es/.gov.uk reclassify-don't-
  resubmit pattern to same-company domain mismatches, not just missing registry entities.
- 2026-11-10-M: Kratos and Seagate Space's "Mobile Offshore Launch Capabilities for National
  Security Missions" partnership (a modular offshore launch platform for Kratos's hypersonic/
  ballistic-missile-target test vehicles) was judged out of scope despite reading like a launch-
  infrastructure story: the vehicles described are suborbital missile-defense test articles, not
  orbital payloads, extending the HyImpulse SR75/Avio FD1/Pluto Aerospace orbital-only exclusion
  and the Minotaur-ICBM-reentry-test precedent (2026-10-12-G) to a dedicated offshore pad story.
  A Payload exclusive on stealth startup Lyra Systems (AI-enabled mission-integration software,
  a five-year AFRL CRADA, no stated dollar value or named customer beyond the Pentagon agreement)
  was left undrafted as a vague company-profile piece rather than a dateable transaction with
  market terms; flag for reconsideration if a future piece names a specific contract value.
- 2026-11-10-N: France's DGA awarding Airbus/Thales Alenia Space a >€1.5bn IRIS spy-satellite
  contract (notified Nov. 5, reported Nov. 9-10) was chased as a genuine predates-window major
  gap: `defense.gouv.fr` fails the `official_record` host check (not on the fixed list, no
  `.gov` suffix) same as `boe.es`/`.gov.uk`, reclassified to `trade`. The item still reached
  SNR 4 on `corroboration_2plus` from Defense News, AeroTime, and the DGA's own page alongside
  the Airbus `wire_pr` lead.
- 2026-11-10-O: Both Starlink/Ukraine saga updates patched the item's top-level `explainer` to
  the latest development (BT delaying its own commercial Starlink launch over Ukraine optics;
  EU space commissioner Kubilius's on-record "could lose trust" warning) rather than appending to
  the old text, confirming the living-document convention: `updates[].note` is the point-in-time
  reader-facing log line, but `explainer` always reflects the single most current state of the
  story. The EU Commission item's 4th distinct source correctly triggered `corroboration_4plus`
  in the draft but the final score held at 4, confirming the non-first-party ceiling caps the
  modifier rather than erroring when the sum would exceed it.
- 2026-11-10-P: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 6
  new, 2 updated, 0 held"), 1204 items up from 1198. Confirmed via a direct `jq` read of all six
  new items' `snr`/`category`/`impact` fields and both updated items' grown `sources` (Starlink/
  Ukraine: 91 sources, 40 updates; EU Commission: 4 sources, 2 updates, SNR held at 4) and a
  `jq empty` parse check on all seven touched data files (items, held, state, source_ledger,
  sources, candidates, registry-candidates). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~1h45m gap, unfiltered full source list (2026-11-10, fourth)

- 2026-11-10-Q: A `funding_latest` crossfeed attestation on a government conditional LOAN
  (Rocket Lab's $150M Pentagon/OSC commitment for Neutron production) against a registry
  field whose stored value was an unrelated equity ATM RAISE ($1.944B for the Iridium deal)
  triggered a same-metric dispute downgrade (SNR 4 to 3) on the first finalize attempt. A debt
  instrument and an equity raise are different metrics even though both could narratively be
  called "funding"; `funding_latest` crossfeed facts need the same like-for-like scrutiny as
  any other field, not just automatic same_metric:true because both are "financing news."
  Fixed via the `dispute_resolved: true` + `rescore` update path in a second finalize pass
  (SNR corrected back to 4, `disputed` cleared, history entry logged); the erroneous
  registry-candidates.json entry itself (`action: "downgrade_incoming"`, status "pending")
  was left untouched since that file is machine-owned and only the weekly maintain-registry
  run or Florian should resolve it, not a hand-edit from this sweep.
- 2026-11-10-R: Two genuinely new items came from Sandra Erwin's SpaceNews byline (found via
  a plain WebSearch for her name + date, not her X feed, which the public bluesky/X search
  tools couldn't surface directly): Anduril unveiling in-orbit test results from all three
  Anduril-26 payloads (an update to the Aug. 14 first-satellite-on-orbit item, not a new
  item), and Rocket Lab's $150M conditional OSC loan (distinct from the same-week $515M
  Neutron customer-backlog item on `dedup_distinct`). A single-source Ars Technica piece
  (unfetchable directly, but readable via the `r.jina.ai/<url>` readability-proxy technique)
  on an Axiom Space v. Vast Space False Claims Act lawsuit over a NASA mission-planning
  document had no second outlet on an exact-headline-quote search; published anyway at a
  single-source `mainstream` tier (Ars Technica has no settled class precedent in this file
  beyond "often unfetchable directly") per the standing weak-sourcing-is-not-a-hold rule,
  dated on the Nov. 4 unsealing (the dateable fact) rather than the Nov. 10 discovery date.
  A Caltech/DARPA ASTRA robot autonomously assembling a 1.4m antenna truss bay in orbit
  (NOM4D program) was drafted despite having no tracked commercial company attached: Caltech's
  own site is not a registry-matched first_party domain (same non-registered-actor precedent
  as NTT/Rakuten, 2026-11-09-A), so classed `trade`, with Space.com/Phys.org as independent
  `mainstream` corroboration.
- 2026-11-10-S: `bun scripts/finalize-sweep.ts` merged cleanly on the second attempt after
  four taglines needed trimming under the 140-char cap ("merged 3 new, 1 updated, 0 held"),
  1204 items up to 1207. A follow-up correction-only draft (0 new, 1 updated) fixed the
  funding_latest dispute above; both merges required the full signalsPass/discoveryPass
  blocks even though the second draft touched no new candidates, confirming those blocks are
  unconditional on every finalize call, not just ones with new items. Confirmed via a direct
  `jq` read of all three new items' and the corrected item's `snr`/`category`/`impact` fields,
  the Anduril update's grown `sources` (3, up from 2) and `updates` (1, up from 0), and a
  `jq empty` parse check on all seven touched data files (items, held, state, source_ledger,
  sources, candidates, registry-candidates). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6h13m gap, unfiltered full source list (2026-11-10, fifth)

- 2026-11-10-T: `x.com`/`twitter.com` status URLs, even an actor's own verified brand account
  (`@Starlink`), fail the gate's `first_party` anti-spoof host check (only the registry-recorded
  website domain passes); reclassifying to `informal` cleared it on the second attempt, extending
  the standing x.com/elonmusk precedent (2026-10-08 Grain item) from a founder's personal account
  to a product's own brand account. The public syndication endpoint
  (`cdn.syndication.twimg.com/tweet-result?id=...&token=a`) worked cleanly here to retrieve the
  exact Starlink Mini 2 launch-post text once the status ID was found via a WebSearch for the
  quoted product tagline, not by guessing the ID.
- 2026-11-10-U: A thin, no-byline, single-page e-commerce-blog (BASENOR, a "Tesla Accessories"
  retailer with a news section) story claiming "FCC Accepts SpaceX Bid for 800 MHz Spectrum" could
  not be corroborated: no trade outlet (SpaceNews, Via Satellite, Light Reading, FierceNetwork)
  carried it, no docket/file number appeared anywhere in the piece, and an extensive FCC-filings
  search surfaced only an unrelated October WT Docket 26-187 Tristar order plus the original
  Oct. 8 SpaceX/Grain application narrative (not an acceptance notice). Left undrafted as an
  update to the existing `2026-10-08-spacex-grain-800mhz-spectrum` item rather than patch its
  copy from a single unverifiable content-mill claim; worth a direct re-check once real coverage
  or the FCC's own ECFS docket for the NewLevel IV/Starlink Spectrum Holdings transfer turns up.
- 2026-11-10-V: Four distinct same-day SpaceX "product"-category items (Starlink Mini 2 launch,
  the Nov. 5 Deutsche Telekom $200B commentary, the Nov. 6 Router 4 Wi-Fi 7 shipping start, the
  Nov. 6 US retail program) all collided on the company+category dedup heuristic despite being
  four unrelated events; `dedup_distinct` at the item's top level (not nested under `scoring`,
  per the 2026-11-10-C/E lesson) cleared all four in one pass.
- 2026-11-10-W: Earnings-release items for companies with no registry organization profile
  (Satellogic: only a constellation profile exists, no organization entity) or with a profile
  whose crossfeed-eligible fields don't cover revenue/EBITDA (Spire Global) both need an explicit
  `crossfeed: { facts: [], note: "..." }` block all the same; the gate does not exempt financial
  items just because the metric reported isn't crossfeed-eligible.
- 2026-11-10-X: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the `x.com`
  first_party misclassification and a missing `dedup_distinct` block (both above); merged cleanly
  on the third attempt after a tagline trim ("merged 4 new, 0 updated, 0 held"), 1211 items up
  from 1207. Confirmed via a direct `jq` read of all four new items' `snr`/`category`/`impact`
  fields and a `jq empty` parse check on all five touched data files (items, state, source_ledger,
  sources, candidates); held and registry-candidates were untouched (no held entries, no crossfeed
  facts). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h18m gap, unfiltered full source list (2026-11-11)

- 2026-11-11-A: A near-total-junk 47-candidate queue (SpaceX/Tesla stock-reaction spam, the
  Starbase $24B gas-plant/data-center buildout already excluded per 2026-11-06-H, Starlink Mini 2
  review pieces recapping the already-published Nov. 10 launch item, dozens of bot-shaped "Starship
  Flight 15 squeeze test" Bluesky reposts) still yielded one genuine queue find (Cosmoserve's Base
  1 facility, via a Google News redirect to Electronics For You) plus a continuation of the
  standing Terafab records-lawsuit saga (KBTX's own follow-up, chased past the headline to confirm
  SpaceX's amended petition now also targets KBTX's own records request, not just the residents'
  and citizens-group's requests already in the item). A Ninth Circuit arbitration ruling on SpaceX
  harassment claims and an India-France "Strategic Space Dialogue" (vague "reviewed progress,
  discussed avenues" diplomatic language, no named program or figure) were both left undrafted,
  the former as routine personnel-legal news, the latter as a vague-institutional-MOU non-event.
- 2026-11-11-B: An Isaacman NSF "Flame Trench" interview on standardizing SLS, the Centaur V
  switch, and cancelling Mobile Launcher 2 (`nasaspaceflight.com`) 403'd on every direct WebFetch
  attempt, and no alternate directly-fetchable mirror with verbatim quotes ever turned up despite
  two dedicated searches; the genuinely new thread in it (industry RFI responses on future
  commercial lunar transportation pointing to the 2030s, not an earlier end-to-end replacement)
  was left undrafted entirely rather than sourced from WebSearch-synthesis paraphrase, per the
  standing never-cite-an-unfetched-page rule. Worth a same-topic re-check if a mirror surfaces.
- 2026-11-11-C: The signals pass's X-search leg (not the queue or the 8-query discovery matrix)
  surfaced the sweep's highest-impact item: a Sandra Erwin SpaceNews byline search turned up AST
  SpaceMobile's $100M Space Force SB-AMTI sensing-contract disclosure from its own Nov. 10 Q3
  earnings exhibit. The company's own SEC 8-K Ex. 99.1 frames the award as flowing directly to AST
  SpaceMobile, while SpaceNews's reporting on the same disclosure describes AST as a subcontractor
  to prime contractor Systems & Technology Research (STR); copy used the official_record lead's
  figures but noted SpaceNews's subcontractor framing rather than picking one reading as fact.
  Needed three `dedup_distinct` entries against a crowded same-week AST SpaceMobile field (Firefly
  Blacklift rocket deal, Q3 results, Rakuten JV) despite differing categories, consistent with the
  standing practice of pre-empting the heuristic whenever a prolific actor has multiple items in
  the trailing 7 days.
- 2026-11-11-D: An AFP wire story on Isar Aerospace CEO Daniel Metzler's "could overtake SpaceX in
  18 years" remarks was carried near-verbatim by Brussels Times, France24, TheLocal.de and others
  with DIFFERENT headlines each (no SimHash title-collapse triggered); rather than stack several
  wire-identical mirrors as false corroboration, attached only the single clearest mirror
  (Brussels Times) and attested `crawl: "found_none"`, consistent with the standing
  many-copies-of-one-wire-source-is-not-corroboration practice (2026-10-25-K and peers) even when
  the gate's own title-collapse wouldn't have caught it. A WebFetch of a second mirror (France24)
  mis-dated the event "October 11" where the URL's own date segment (`20261110`) and a separate
  mirror's byline both confirmed Nov. 10; trusted the hard URL/byline evidence over the fetch tool's
  own date interpretation.
- 2026-11-11-E: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 4 new,
  1 updated, 0 held"), 1215 items up from 1211. Confirmed via a direct `jq` read of all four new
  items' `snr`/`category`/`impact`/`kind` fields and the updated Terafab item's grown `sources` (6,
  up from 5) and `updates` (2, up from 1) arrays, plus a `jq empty` parse check on all seven touched
  data files (items, state, held, source_ledger, sources, candidates, registry-candidates); held
  and registry-candidates were untouched (no held entries; none of the four items' companies had a
  registry profile with a like-for-like crossfeed metric). `bun run build` was not attempted, per

## Narrow re-check, ~9.5h gap, unfiltered full source list (2026-11-11, second)

- 2026-11-11-F: Reading an FCC PDF public notice directly via the Read tool (after WebFetch returned
  only garbled binary text) recovered the exact docket/date/figures cleanly; worth defaulting straight
  to that path for any `docs.fcc.gov/public/attachments/*.pdf` link rather than retrying WebFetch
  variations, since the PDF renders as unreadable binary through WebFetch every time.
- 2026-11-11-G: Two Senate Commerce Committee press releases on the same bill passage (the Democratic
  whip's "Cantwell Leads..." release and the bipartisan committee's "Senate Unanimously Approves..."
  release, both on commerce.senate.gov) collapsed into one corroboration unit at finalize
  (`same_domain` rule) despite covering the same vote from two press offices; treat same-domain
  institutional press releases about one action as one source going in, not two, since the gate
  will collapse them anyway.
- 2026-11-11-H: `bsky.app/profile/<handle>` profile pages render as an empty JS shell through
  WebFetch (handle only, zero posts), confirming the pattern already seen for spacex.com/updates;
  `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=15` reliably
  returns real post text and timestamps for the same accounts and should be the default fetch for
  every bluesky signals-pass channel, not the profile URL itself.
- 2026-11-11-I: A near-total-junk queue (SpaceX/Tesla stock reaction, Starship Flight 15 preview
  spam, dozens of Starlink Mini 2 review pieces) again yielded real stories almost entirely from the
  discovery pass and signals pass rather than the queue itself: a SpaceX SDA $9.9M Plaser
  laser-comms risk-reduction study (found via an "FCC satellite license order" discovery query,
  not the queue's own SpaceNews entry, which undersold the story without the dollar figure), the
  UAE's Arab Satellite 813 clearing its post-launch review, and the Senate's unanimous Weather Act
  passage codifying NOAA's commercial weather-data program (surfaced via Marcia Smith's bluesky
  feed, not the queue). Several queue leads traced to already-published stories on sight: an
  "Israel Defense" France-EO-satellite headline was the already-published Nov. 5 DGA/Airbus-Thales
  IRIS contract; "OHB stock gets EUR 554 million ESA contract for Sentinel-3" was the already-
  published Nov. 4 item; "Pentagon Backs Rocket Lab With $150M Loan" was the already-published
  Nov. 10 OSC loan item; an "Airbus awarded contract for two additional Galileo satellites" piece
  (evertiq.com, dated Nov. 2) traced to the same underlying Oct. 26 Airbus order already folded into
  the published "four more Galileo Second Generation satellites" item, just reported from the
  Airbus side with a different satellite count framing.
- 2026-11-11-J: An IHI/Nikkei Asia "to mass-produce dual-use satellites in Japan" piece was left
  undrafted: the only fetchable content was a single paywall-truncated paragraph with no figures,
  dates, or satellite counts, and the fuller picture found via search traced to IHI's own July 22
  press release (an already-stale ICEYE assembly-training milestone), not new reporting. A
  PierSight Varuna 2.0 SAR-AIS vibration-test pass was judged below the inclusion bar as a routine
  qualification-test milestone, consistent with the standing ISRO-engine-test-fire precedent.
  EOS-X Space's $120M raise (stratospheric balloon flights, diversifying into a dual-use-satellite
  division) and Firehawk Aerospace's $150M raise (tactical rocket/artillery motors, not orbital
  launch vehicles) were both judged out of scope as non-orbital, extending the standing
  balloon/missile-motor exclusion precedents to two funding-round candidates specifically.
- 2026-11-11-K: `bun scripts/finalize-sweep.ts` rejected the first attempt (`coverage` must be
  drawn from the Category enum, not freeform strings like "non-US") and the second attempt (a
  `dedup_distinct` gap: the new SpaceX SDA contract item collided with two same-week SpaceX
  `contract`-category items, the Singulus solar-cell order AND the Nov. 2 STIF valve order, and
  only the first was attested); merged cleanly on the third attempt ("merged 3 new, 1 updated, 0
  held"), 1218 items up from 1215. Confirmed via a direct `jq` read of all three new items'
  `snr`/`category`/`impact` fields and the Grain-spectrum item's grown `sources` (9, up from 7) and
  `updates` (4, up from 3) arrays, the sweep log's `corroboration_collapses` entry confirming the
  two Senate press releases collapsed to one source, and a `jq empty` parse check on all six
  touched data files (items, state, held, source_ledger, sources, candidates). `bun run build` was
  not attempted, per the 2026-09-09 CLAUDE.md procedure update.
  the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~2.3h gap, unfiltered full source list (2026-11-11, third)

- 2026-11-11-L: A WebSearch synthesis for "ISS Progress maneuver debris avoidance November 11
  2026" confidently returned a same-day-shaped NASA/Roscosmos debris-avoidance maneuver, but
  direct fetches of both cited articles (Aviation Week, Space.com) showed the actual event was
  from November 19, 2024, two years stale; the synthesis had silently re-dated an old story to
  match the query's requested date. Extends the standing WebSearch-fabricates-and-conflates-dates
  pattern specifically to a recurring headline shape (ISS debris-avoidance maneuvers happen
  periodically, so a vague-dated hit is easy to mistake for today's news); always direct-fetch and
  check the byline date before drafting this shape of story.
  A Bloomberg/GovExec/Forbes thread on Democrats-controlled Congress scrutinizing SpaceX's Golden
  Dome contracts (post-midterm) was investigated but left undrafted: every directly-fetched piece
  hedged ("could," "likely," "going to have a closer eye") with no stated investigation, vote, or
  contract action yet, the same forward-looking-political-speculation shape as the 2026-11-03-I/
  2026-11-04-I precedents. A GF Securities/SemiAnalysis-sourced "SpaceX designs Kessel rack for
  orbital data centers" rumor (Tom's Hardware, FourWeekMBA, et al.) was left undrafted as an
  unconfirmed hardware leak ("report claims," unnamed sourcing, ambiguous terrestrial-vs-orbital
  scope) with no SpaceX confirmation.
- 2026-11-11-M: `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 2
  new, 0 updated, 0 held"), 1220 items up from 1218. Confirmed via a direct `jq` read of both new
  items' `snr`/`category`/`impact`/`sources` fields (NASA ESCAPADE powered Earth flyby: SNR 5,
  official_record base, science/notable; Sierra Space Dream Chaser FAA reentry license: SNR 4,
  trade base plus `corroboration_2plus`, regulatory/notable) and a `jq empty` parse check on all
  five touched data files (items, state, source_ledger, sources, candidates); held was untouched
  (no held entries, no crossfeed facts).

## Narrow re-check, ~7.5h gap, unfiltered full source list (2026-11-12)

- 2026-11-12-A: A near-total-junk 95-candidate queue (SpaceX/Tesla stock-reaction spam, Starship
  Flight 15 preview pieces, the already-excluded Starbase data-center saga) again yielded real
  stories mostly outside the queue: a "SpaceX, Rocket Lab blast higher as NASA hands out $10
  billion in moon base awards" headline traced entirely to the already-published Nov 7 CLPS-2/
  VADR/PROMISE items (stock-reaction piece on stale news, not a new event); the four genuine finds
  (MDA/Globalstar on-orbit testing, Skylo/KT SAT, Gilat guidance cut, Kratos/Thaicom-10) all came
  from Via Satellite/satellitetoday.com trade coverage reachable only via the discovery pass's own
  WebSearch chase, not the queue entries themselves (satellitetoday pieces don't appear to be
  harvested into the queue at all; worth checking whether it needs an RSS feed added to
  sources.json).
- 2026-11-12-B: For both the MDA/Globalstar and Kratos/Thaicom-10 trade-press finds, chasing the
  company's own newsroom past the trade writeup upgraded the lead source class: MDA Space's own
  mda.space/article/... press release (first_party, verified against its registry profile domain)
  and Kratos' own kratosdefense.com press release both existed and stated the same facts with a
  named quote, confirming the standing practice of checking for a first-party original behind
  every trade-press rewrite before accepting trade as the lead. Kratos' own press release still
  classed `trade`, not `first_party`, because Kratos has no registry organization profile for the
  anti-spoof domain check to verify against (same non-registered-actor precedent as Caltech/NTT,
  2026-11-10-R/2026-11-09-A) -- a first-party-shaped page from an unregistered actor is not a
  first-party source until that actor gets a profile.
- 2026-11-12-C: Gilat's own SEC Form 6-K (filed same day as the Via Satellite writeup) stated the
  new 2026 guidance figures directly and classed `official_record` at base tier 5; the prior
  ($500-520M) guidance figure needed for the "cut" framing came only from the trade writeup, not
  the filing itself, confirming a single item can mix an official-record lead for the headline fact
  with a trade source for necessary comparison context, each fact attributed to the source that
  actually stated it.
- 2026-11-12-D: Skylo's South Korea/KT SAT distribution deal collided on the company+category
  dedup heuristic with the unrelated Nov 4 KT SAT/ST Engineering iDirect maritime satcom item
  (both `partnership`, both touching KT SAT); `dedup_distinct` at the item's top level cleared it,
  consistent with the standing prolific-actor pre-emption practice (2026-11-10-V, 2026-11-11-C).
- 2026-11-12-E: An Ars Technica piece on Anduril's night-vision satellite sensor (fetched via the
  `r.jina.ai/<url>` proxy, since arstechnica.com itself remains unfetchable directly) added a named,
  on-record quote from VP/GM Adam Thurn describing the exact eclipse-tracking gap the LWIR sensor
  closes, genuinely new attributable content beyond the Nov 10 "calibrated imagery from all three
  sensors" update already on the Aug 14 Anduril item; patched into `why_it_matters` as the living-
  document convention requires (2026-11-10-O) rather than appended as stale duplicate text.
- 2026-11-12-F: A Pakistani-astronaut-to-fly-on-Shenzhou-24 story (CMSA announcement via Xinhua/AP,
  Nov 7, first foreign national to visit China's Tiangong station) was held, not drafted or
  discarded: it is government-to-government human-spaceflight diplomacy with no stated contract or
  outcome touching a commercial provider, reseller, or prime, so it doesn't fit CLAUDE.md's
  commercial-angle-gated human-spaceflight scope, and isn't a sovereign EO/connectivity
  constellation program either (the exception that would otherwise let a sovereign program in). A
  genuine scope question for Florian, same shape as the Serbia/Artemis Accords and Singapore space
  agency precedents, not a sourcing-quality hold.
- 2026-11-12-G: A CalPERS/Bloomberg story confirming its $500M+ Grain Management investment "nearly
  doubled" following the SpaceX 800MHz spectrum deal (an update angle on the existing Oct 8 Grain
  item) was left undrafted: Bloomberg and Benzinga both 403'd on direct WebFetch, and the only
  reachable mirror (a biztoc snippet) couldn't confirm a precise multiple or dollar distribution
  beyond "$500M" and "nearly doubled," too thin to add confidently as a sourced update fact. A
  SpaceX/AST SpaceMobile FCC unlicensed-D2D-band comment filing (Broadband Breakfast, named
  spokespeople quoted) was also left undrafted: filed comments on an August 2026 NPRM with no
  vote or decision are procedural, below the inclusion bar's "a director acts or briefs today" test
  even at `noise` tier, distinct from an actual grant/denial.
- 2026-11-12-H: `bun scripts/finalize-sweep.ts` rejected the first attempt (invalid JSON from a
  stray brace in the `held[]` entry, and a missing `dedup_distinct` on the Skylo/KT SAT item) and
  the Kratos source's `first_party` misclassification (above); merged cleanly on the second attempt
  ("merged 4 new, 1 updated, 1 held"), 1224 items up from 1220. Confirmed via a direct `jq` read of
  all four new items' `snr`/`category`/`impact` fields (MDA/Globalstar: SNR 5 official-equivalent
  first-party base; Skylo/KT SAT: SNR 4; Gilat: SNR 5 official_record base; Kratos: SNR 4), the
  Anduril item's grown `sources` (4, up from 3) and `updates` (2, up from 1) arrays, the held
  queue's growth to 19 entries, and a `jq empty` parse check on all seven touched data files
  (items, held, state, source_ledger, sources, candidates, registry-candidates). `bun run build`
  was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4h gap, unfiltered full source list (2026-11-12, second)

- 2026-11-12-I: A TechTimes piece claiming a Nov. 9 SDA Transport Layer launch reached "105 of 126
  (83%)" did not survive verification: nextspaceflight independently placed the only Nov. 9 Vandenberg
  Falcon 9 slot as USSF-627 (delayed to Nov. 11, then actually flown Nov. 12), the article itself
  could not name which contractor built the 21 satellites despite claiming to, and no other outlet
  (SpaceNews, Defense Daily, Breaking Defense, SDA.mil's own news page) carried a 5th Tranche 1
  Transport Layer mission; left undrafted as unverifiable/likely-conflated rather than amplify a
  single uncorroborated outlet's numbers, extending the standing WebSearch-synthesis-conflates-
  stories caution (2026-11-11-L) to a case caught only by cross-checking a competing confirmed
  launch's own timeline.
- 2026-11-12-J: Google News redirect URLs again failed to resolve via WebFetch (bare header, no
  content); re-finding the publisher's own URL via a second, more specific WebSearch (the exact
  headline plus outlet name) recovered a clean direct-fetchable URL every time this run, for both
  the Anadolu Agency USSF-627 piece and the Greek-language ICEYE/HIIF coverage.
- 2026-11-12-K: An ESA EOGS architecture-study contract to ICEYE and Leonardo read as a fresh
  Nov. 2026 story via a media-advisory URL, but the underlying contracts were signed Sept. 17, 2026
  with no stated dollar value; left undrafted per the standing chase-it-only-for-notable/seismic-gaps
  rule (early-stage study contract, not a production award).
- 2026-11-12-L: A govinfo.gov Federal Register PDF (FAA's Nov. 10 Starbase PEIS scoping-meeting
  update, same docket FAA-2026-12808 as the existing Oct. 13 item) read cleanly via the Read tool
  after WebFetch returned only raw PDF structure, continuing the 2026-11-11-F pattern; the matching
  federalregister.gov HTML deep link (not the govinfo PDF) was used as the cited source, and that
  HTML host scored `official_record` without an anti-spoof rejection, same as the Oct. 13 item's
  existing federalregister.gov source.
- 2026-11-12-M: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 2 new,
  1 updated, 0 held"), 1226 items up from 1224. Confirmed via a direct `jq` read of both new items'
  `snr`/`category`/`impact` fields (USSF-627: SNR 4 noise launch; ICEYE/Greece HIIF investment: SNR 4
  major financial, 4 sources) and the FAA Starbase item's grown `sources` (4, up from 3) and
  `updates` (1) arrays; a requested `corroboration_4plus` bump on the FAA update had no visible
  effect on the trace (already at its non-first-party ceiling of 4 via `corroboration_2plus`),
  consistent with the 2026-11-10-O capped-modifier precedent. A `jq empty` parse check passed on all
  seven touched data files (items, held, state, source_ledger, sources, candidates,
  registry-candidates). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.
