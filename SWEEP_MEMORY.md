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

## Narrow same-day re-check, ~8h05m gap, unfiltered full source list (2026-09-07)

- 2026-09-07-A: A fully clean zero-item sweep: the 27-candidate queue was
  almost entirely the ongoing ISRO-privatization Google News wave (still no
  Florian ruling, extending 2026-09-06-C/I/L to a sixth sweep in the
  sequence) plus SpaceX stock-speculation content-mill pieces and stories
  already published (Sept 6 Starlink Vandenberg launch, 4iG/SpaceX Starlink
  Mobile Europe, ISRO's EOS-05 launch). The 8-source HTML pass, a
  15-of-17-channel signals pass, and a 10-query discovery matrix all
  independently converged on the same already-published stories, confirming
  the standing narrow-re-check-after-an-active-prior-sweep pattern once
  again.
- 2026-09-07-B: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 0 new, 0
  updated, 0 held") plus a `jq` parse check (572 items, unchanged; sweeps
  log 219 to 220) as the build-health signal.

## Deep sweep (~7h41m gap since last, 7-day window, unfiltered full source list, 2026-09-07, second)

- 2026-09-07-C: Two consecutive zero-add sweeps (2026-09-06 fourth,
  2026-09-07 first) triggered `candidates-context`'s deep mode (7-day
  window, `previously_presented` re-triage). Working the full 7-day queue
  plus all 17 fetchable signals-channel entries plus a 12-query discovery
  matrix surfaced only two genuinely new items in an otherwise
  thoroughly-covered week; confirms deep mode is working as designed
  (exhaustive re-check, not a signal that coverage was previously thin).
- 2026-09-07-D: Kineis published two Sept 7 press releases same-day: a
  break-even/revenue target (18M EUR revenue, connected objects up 150%
  to ~50,000) and a "Thomas Hiriart" appointment whose page TITLE says
  "General Manager" but whose URL SLUG says "chief-executive-officer"
  (`/appointment-of-thomas-hiriart-as-chief-executive-officer/"). Trusted
  the page's own stated title (General Manager) over the URL slug and
  treated it as a routine below-the-bar hire; only drafted the break-even
  release. Worth a second look if Kineis's own copy is inconsistent again
  next time this domain is touched.
- 2026-09-07-E: A first-party financial-target press release (Kineis
  "targeting break-even as early as 2026") takes NO `found_none` penalty
  per the direct-source-ceiling rule even on a same-day, zero-corroboration
  search: landed SNR 5 (base tier 5, no modifiers) exactly as the spec
  describes for direct sources, distinct from the informal/indirect
  leads where `found_none` costs a level. Worth remembering that a
  forward-looking company projection is scored on the strength of the
  attribution ("Kineis says it is targeting X"), not on whether the
  projection will prove true.
- 2026-09-07-F: A same-company-plus-category dedup false positive fired
  FOUR ways at once on a new SpaceX/Viasat FCC interference petition
  (regulatory): matched against the Iran Starlink-crackdown item, the
  SpaceX/Iridium-conduct FCC review, the UAE Starlink license grant, and
  the SpaceX/FCC USF High-Cost Fund docket, none of which share anything
  with this petition beyond SpaceX plus the regulatory category. Four
  `dedup_distinct` entries cleared it in one pass; extends the standing
  finding (now covering NASA, SpaceX, Blue Origin, Redwire, Viasat, SES)
  that this heuristic fires per shared company regardless of docket,
  regulator, or country, and that a company with many regulatory items in
  one week can trigger it against ALL of them simultaneously.
- 2026-09-07-G: datacenterdynamics.com (a data-center-industry trade
  outlet, not a space/satcom-focused one) covered a genuinely new SpaceX
  FCC filing (petition to block Viasat-3 F2 over Ku/Ka interference) that
  only SatNews otherwise carried; several other "hits" on this story
  (corsstations.com, newsdirectory3.com, memesita.com) were identical-
  headline content-farm rewrites of the same SatNews/DCD reporting, not
  independent coverage, and were correctly left uncited rather than
  stacked for fake corroboration.
- 2026-09-07-H: Confirms 2026-09-04-T/2026-09-06-H's "trend piece bundles
  old facts" trap in force again: Ars Technica's Sept 2 "Is Russia's rival
  to Starlink failing?" and TechSpot's Sept 3 follow-up both restate
  figures (32 Rassvet satellites, none reaching operational altitude)
  already fully captured in the existing 2026-07-19 item's ISW-sourced
  Sept 1 update; left both undrafted and did not even attach them as
  corroboration since they add no fact beyond what's already on the card.
- 2026-09-07-I: A Google News redirect through WebFetch is now
  consistently unusable for `news.google.com/rss/articles/...` links in
  this environment (returns a bare "Google News" header, no redirect
  target, no content) -- for every such candidate this run, WebSearch on
  the exact headline text was used instead to find the underlying
  publisher article, which worked reliably. Treat WebFetch-on-a-Google-
  News-URL as a dead end and go straight to WebSearch rather than
  retrying the fetch.
- 2026-09-07-J: A CGTN headline naming "Starman" (GoPro's $285M
  acquirer) is unrelated to SpaceX/Starman-the-Tesla-Roadster-payload;
  it is a US optical-transceiver maker for AI data centers. Worth a
  reminder that a space-adjacent-sounding proper noun in a headline still
  needs a one-line fetch to confirm it is actually a space story before
  spending more time on it.
- 2026-09-07-K: A retrospective NISAR/Nepal-avalanche "warning signs
  detected after the fact" story (India Today, NewsBytes, Indian Defence
  News) was judged out of scope as a science-mission research result
  (CLAUDE.md excludes "research results and papers" for science
  missions), not a dated program event; a differently-sourced ABC News
  version of the same disaster didn't even use NISAR, using Planet/
  Landsat 9 imagery and a HiRISK academic report instead, another sign
  this is a retrospective analysis piece rather than an operational
  commercial-EO event.
- 2026-09-07-L: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new,
  0 updated, 0 held") plus a `jq` parse check (574 items, up from 572)
  and a direct read of both new items' `snr`/`snr_trace`/`category`/
  `impact`/`sources` fields as the build-health signal.

## Narrow same-day re-check, ~4h07m gap, unfiltered full source list (2026-09-07, third)

- 2026-09-07-M: A funding round reported as "in progress" (2026-07-07,
  informal NewsBytes lead, SNR 2) that a directly fetched mainstream
  source (Free Press Journal) plus an independent trade source
  (TechNode Global) confirmed CLOSED two months later, with the same
  lead investor (Temasek) and the same $100M figure but new named
  co-investors and a firm total-funding number, was treated as an
  `updates[].rescore` (upgrading the lead source class and re-basing
  the trace) rather than a new item, even though the gap is far outside
  the dedup rule's literal 7-day/30-day windows -- it is still the
  identical financing event reaching its closing milestone, not a
  distinct one. `source_url` was switched to the new mainstream lead
  per the upgrade-path convention (patch it first, then the rescore's
  sources[0] must match).
- 2026-09-07-N: A company exec's on-the-record but explicitly-unsigned
  claim (Isar Aerospace CCO Stella Guillen telling CNBC the order
  pipeline "tops 10 billion euros," with the company declining to say
  how much is contracted) was folded into an existing seismic item via
  `updates[].patch` (appending one attributed, caveated sentence to
  `what_happened`) with an `attach` but no `bump`: it is a genuinely new
  supplementary fact, not corroboration of the already-scored
  orbital-insertion claim, so the item's SNR was left untouched rather
  than bumped. Every outlet found (Yahoo Finance, IBTimes, TechStartups,
  Coinotag) traced to the same CNBC interview (CNBC's own page 403'd on
  direct fetch); treated as one underlying source per the standing
  wire-rewrite rule rather than stacked for fake corroboration.
- 2026-09-07-O: A new HTML-source find (ICEYE's own newsroom, Sompo
  Japan flood-claims partnership) landed cleanly at first-party SNR 5
  with a `crawl: found_some` (several outlets, e.g. Finextra, turned out
  to be verbatim press-release reproductions marked "External"/
  "provided by an external author" -- left uncited as non-independent
  rather than stacked as corroboration, though the search genuinely did
  find real matching coverage so `found_none` would have been dishonest
  the other way).
- 2026-09-07-P: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new,
  2 updated, 0 held") plus a `jq` parse check (575 items, up from 574;
  sweeps log 221 to 222) and a direct read of the new item's and both
  updated items' `snr`/`snr_trace`/`sources`/`explainer` fields as the
  build-health signal.

## Narrow same-day re-check, ~4h22m gap, unfiltered full source list (2026-09-07, fourth)

- 2026-09-07-Q: A layered, multi-month airline-Starlink-rollout story
  needed judgment on which date to use: Lufthansa Group's 850-aircraft
  Starlink commitment was actually first announced January 14, 2026,
  re-announced August 10 ahead of Lufthansa mainline's own August 19
  first flight, and today's queue hit was Austrian Airlines' own first
  Starlink flight (Vienna-Porto, Sept 7) -- genuinely never covered
  under any id (grepped items.json for "lufthansa"/"austrian airlines",
  zero hits). Judged the January/August announcements too stale to
  chase under the predates-window convention (months old, already
  superseded by two later operational milestones) and instead drafted
  today's Austrian-specific first-flight milestone as its own item,
  same shape as the standing Qatar Airways/Gulf News 150-aircraft
  rollout-milestone precedent (2026-08-20, `noise`/`partnership`),
  folding the 850-aircraft/2029 group-wide context into why_it_matters
  rather than as the news peg itself.
- 2026-09-07-R: Neither Austrian Airlines nor Lufthansa Group has a
  `src/data/registry` organization entity, so their own newsroom pages
  (austrianairlines.ag, newsroom.lufthansagroup.com) fail the
  anti-spoof gate as `first_party`; led with TeslaNorth (trade, English)
  instead and used two independently-written Austrian aviation outlets
  (aeroTELEGRAPH, Austrian Wings -- different headlines, different
  added detail: seat count, six more A320neo on order, 17 Embraer jets
  retiring by 2029) as `informal`-class corroboration, landing
  `corroboration_2plus` at SNR 4. Extends the standing no-registry-host
  workaround pattern to a non-space-industry counterparty (an airline
  group) rather than a space company or manufacturer.
- 2026-09-07-S: The standing same-company-plus-category dedup false
  positive fired again (SpaceX + `partnership`), this time against
  4iG's unrelated Starlink direct-to-device mobile deal in Europe
  (2026-09-02), 5 days apart with nothing else in common. One
  `dedup_distinct` entry cleared it, extending the long-running list of
  companies this heuristic fires on regardless of relatedness.
- 2026-09-07-T: A fully clean pass otherwise: the queue (23 candidates)
  was dominated by the still-open ISRO-privatization Google News wave
  (a seventh consecutive sweep with no Florian ruling) and SpaceX
  stock-speculation content-mill pieces; the Pixxel $100M Series C
  Bluesky hit and the Isar Aerospace CNBC "10 billion euro pipeline"
  Bluesky hit were both already published/patched earlier in today's
  sweep sequence. The 8-source HTML pass, a 12-of-17-channel signals
  pass, and an 8-query discovery matrix all converged on already-known
  stories; one signals find (Anatoly Zak: unofficial, unnamed-source
  reports of a Progress MS-35 launch postponement) was judged out of
  scope as Russian government ISS cargo resupply with no
  commercial-provider angle and no official confirmation.
- 2026-09-07-U: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 1
  new, 0 updated, 0 held") plus a `jq` parse check (576 items, up from
  575) and a direct read of the new item's
  `snr`/`snr_trace`/`category`/`impact`/`tags`/`companies`/`sources`
  fields as the build-health signal.

## Narrow re-check, ~7h23m gap, unfiltered full source list (2026-09-08)

- 2026-09-08-A: A Chinese military reconnaissance satellite breakup
  (Yaogan-50 (02), rare 141-degree retrograde orbit, 43 debris pieces
  cataloged by US Space Force) surfaced via a general discovery-pass
  search rather than a targeted per-handle xSearch query; Jonathan
  McDowell's (@planet4589) X post carried the exact debris count and
  orbit parameters, pulled verbatim via the syndication endpoint, while
  SpaceNews (paywalled beyond the lede) supplied the trade-press lead
  and satellite ID/launch date. Landed as `incident`/`notable` with no
  operator named, per the standing rule that debris/breakup events
  publish before attribution.
  Worth noting for next time: a whitelisted signal's post found through
  ordinary discovery (not a dedicated handle search) still counts
  toward `xAttempted` once its verbatim text is actually used.
- 2026-09-08-B: A recurring pattern confirmed again: an Aviation Week
  piece dated "Sep 04, 2026" ("Three Additional Space-Based AMTI
  Vendors Revealed") turned out, on a WebSearch cross-check, to be
  restating the already-published Aug 4 event
  (2026-08-04-rocket-lab-str-amti-contracts: Rocket Lab $397M, STR,
  one unnamed vendor, $615M total) rather than a new vendor wave;
  Aviation Week's own author-page listing date is not reliable proof
  of a new event without confirming the underlying facts differ.
- 2026-09-08-C: A government/sovereign EO constellation announcement
  (Kazakhstan: nine satellites by 2030 with Mongolia, Republic of the
  Congo and Nigeria, expandable to 14, announced by Deputy PM Zhaslan
  Madiyev at the Space Days Kazakhstan 2026 forum) had no reachable
  first-party source: kazcosmos.gov.kz (the national space agency)
  failed outright (`getaddrinfo ENOTFOUND`), so the item ran on two
  independently-written national-news outlets (Kazakhstan Today,
  AzerNews) at `informal` class rather than a first-party lead. A
  Bernama Google News redirect for the same story could not be
  resolved to a live URL (confirms 2026-09-07-I: WebFetch on
  `news.google.com/rss/articles/...` is a dead end in this
  environment) and was dropped rather than cited without a real URL.
- 2026-09-08-D: A patent-grant item (GalaxEye's first-for-India US
  patent on its OptoSAR sensor-fusion architecture) is a good
  `product`/`noise` template: two independently-written India-focused
  outlets (Inc42, Daijiworld) both dated the same day, no company
  quote needed from a paywalled/blocked source (Business Standard
  403'd) since Inc42 carried the CEO quote directly.
- 2026-09-08-E: The FAA's NEPA-waiver rule item
  (2026-07-28-dot-faa-launch-environmental-waiver) and the Starship
  Pacific-reentry final-EA item (2026-07-14-faa-starship-pacific-
  reentry-draft-ea) were both already fully current through Sept
  1-4 sourcing before this run started; several Sept 7-8 local-color
  pieces (WWLTV, Yahoo, AFR "$150b bet on a swamp" on Starbase
  Louisiana community pushback) added no fact beyond what those two
  items already carry and were correctly left undrafted.
- 2026-09-08-F: Amazon's Kuiper newsroom tag page
  (aboutamazon.com/news/tag/project-kuiper), which has shown a
  standing "no visible dates" pattern since 2026-07-06, returned a
  bare HTTP 403 this fetch instead -- a new failure mode. Recorded as
  an unlogged failed attempt (no sourceHealth entry, since "verified"
  status requires fetch evidence the failure can't provide) rather
  than flipping status; watch whether the 403 recurs next run.
- 2026-09-08-G: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate, continuing
  the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 0
  updated, 0 held") plus a `jq` parse check across all four touched
  data files (579 items, up from 576) and a direct read of all three
  new items' `snr`/`impact`/`category`/`headline` fields as the
  build-health signal.

## Narrow re-check, ~6h15m gap, unfiltered full source list (2026-09-08, second)

- 2026-09-08-H: `gov.uk` is NOT on `FIXED_OFFICIAL_HOSTS` in
  finalize-sweep.ts (only `sec.gov`, `fcc.gov`, `sam.gov`,
  `ted.europa.eu`, `esa.int`, `nasa.gov`, `noaa.gov`, `itu.int`,
  `unoosa.org`, `europa.eu`, plus any bare `*.gov` TLD host) -- a UK
  government press release (`gov.uk/government/news/...`, the SaxaVord
  £30m spaceport-funding announcement) is rejected outright as
  `official_record`, since `gov.uk` is a different TLD shape than the
  US `.gov` the code's suffix check matches. Reclassified as `informal`
  corroboration and led with BBC (`mainstream`) instead, landing a
  clean SNR 4 via `corroboration_2plus`; worth remembering non-US
  `.gov.<cc>`-style domains (UK, and likely others) need the fixed-list
  treatment, not the blanket `.gov` pass, unless added to the list at a
  future structural touch.
- 2026-09-08-I: A guessed/stale gov.uk URL trap: the first WebFetch of
  a plausible SaxaVord-funding gov.uk URL (`.../uk-and-european-space-
  agency-funding-boost-for-satellite-launch-from-shetland`, found via
  the article's own linked text) landed on a November 2023 RFA UK
  release (£3.5M ESA Boost! Programme funding, a Q2 2024 launch
  target), not today's £30m announcement -- caught only because the
  fetched page's own stated date (8 November 2023) didn't match:
  extends the standing "check a fetched page's own stated date"
  pattern (2026-08-12-B and many peers) to gov.uk itself. The correct
  page (`.../new-space-strategy-will-bolster-uk-defences-against-
  threats-from-space`) was found via a second, more specific WebSearch
  after Shetland News (`shetnews.co.uk`) supplied the clean, dated,
  correctly-figured writeup first.
- 2026-09-08-J: A senior-former-government-official appointment at a
  tracked EO operator (Satellogic naming retired NGA director Frank
  Whitworth president, promoted from strategic advisor since March
  2026) followed the standing Wolfgang Schmidt/Planet precedent
  (category `partnership`, `notable` impact) even though the new role
  is an operating executive title, not a board/advisory seat -- worth
  confirming with Florian whether an operating C-suite appointment
  (vs. board/advisory) should read the same way under that rule.
- 2026-09-08-K: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate, continuing
  the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 4 new, 0
  updated, 0 held") plus a `jq` parse check (583 items, up from 579)
  and a direct read of all four new items' `snr`/`snr_trace`/
  `category`/`impact`/`tags`/`companies` fields as the build-health
  signal.

## Narrow re-check, ~5h20m gap, unfiltered full source list (2026-09-08, third)

- 2026-09-08-L: A funding round reported as "in talks" for $300M (July 26,
  informal Investing.com-per-FT lead, SNR 2) closing seven weeks later at
  $450M -- 50% above the original target, with a named investor syndicate
  (Bessemer, Atomico, EQT's Scaleup Europe Fund, Balderton, Plural, Cherry,
  Red River West) and a CEO quote -- was treated as an `updates[].rescore`
  per the standing 2026-09-07-M "financing reaches its closing milestone"
  precedent: lead upgraded from informal to trade (European Spaceflight,
  directly fetched), `source_url` switched to match, landing SNR 4 via
  `corroboration_2plus` (Tech.eu informal + TheNextWeb mainstream, both
  independently fetched with unique detail beyond the press release).
  Bloomberg's own writeup of the same close was found via WebSearch but
  403'd on direct WebFetch both times; left uncited per the standing
  "only cite pages genuinely fetched this run" rule even though its
  content (per the search snippet) matched the other three sources.
- 2026-09-08-M: THREE separate stale-resurfacing traps caught in one
  discovery pass, each initially reading as fresh September 2026 news: (1)
  a SpaceNews "NASA and SpaceX finalize extension of commercial crew
  contract" WebFetch resolved to an article whose own page explicitly
  stated "Publication Date: September 1, 2022" once fetched directly --
  a stale URL surfaced by a generic search, not a resurfaced wire story;
  (2) a Yahoo Finance/gokhshtein.com/TheStreet "Amazon and AT&T partner to
  challenge Starlink" wave read as a brand-new Sept 8 deal (Yahoo even
  carried a same-day-framed AT&T exec quote), but press.aboutamazon.com's
  own release for the identical AT&T/AWS/Amazon-Leo partnership is dated
  February 4, 2026 -- a low-quality source (gokhshtein.com) that stated
  the correct Feb 4 date was initially discounted as unreliable until the
  first-party Amazon press release confirmed it independently; a same-day
  exec quote does not itself prove a story is new when the underlying deal
  predates it by 7 months. (3) The recurring ISRO-privatization Google News
  wave (ninth-plus consecutive sweep with no Florian ruling, now joined by
  ISRO's own "won't be privatized" clarification, SatNews Sept 7) generated
  no new draft or duplicate held entry, consistent with the standing
  practice.
- 2026-09-08-N: A UAE business story (IHC's 80% acquisition of Marlan
  Holding, parent of the Orbitworks/Loft-Orbital EO joint venture) had two
  independently-written, directly-fetched mainstream UAE outlets (The
  National, Khaleej Times) with different exec quotes but matching facts;
  neither IHC nor Marlan Space has a `src/data/registry` organization
  entry, so no first-party lead was attempted (the no-registry-host
  workaround, informal/mainstream class regardless of domain).
- 2026-09-08-O: `defence-blog.com` 403'd on every direct WebFetch attempt
  for ImageSat International's EROS NOVA satellite unveiling (25cm
  resolution, onboard AI processing); a German defense-trade outlet
  (esut.de) independently covered the same unveiling with its own CEO
  quote and fetched cleanly, used as the sole trade-class lead at
  `crawl: found_none` per the standing 2026-08-24-F rule (a WebSearch
  synthesis of an unfetched page is never citable, even when it clearly
  exists).
- 2026-09-08-P: A Light Reading "EU telcos close ranks against Starlink"
  spectrum-consortium story (Deutsche Telekom/Orange/Telefonica/Vodafone,
  2GHz MSS band) stated explicitly, once fetched directly, that the four
  operators are only in "early talks" via unnamed sources with "no final
  decisions" -- a process-not-yet-fact exclusion, same standard as the
  T-Mobile/Sateliot and Grain Management precedents (2026-08-21-D).
- 2026-09-08-Q: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new,
  1 updated, 0 held") plus a `jq` parse check (585 items, up from 583)
  and a direct read of both new items' and the updated item's
  `snr`/`snr_trace`/`category`/`impact`/`tags` fields as the build-health
  signal.

## Narrow re-check, ~4h gap, unfiltered full source list (2026-09-08, fourth)

- 2026-09-08-R: A Light Reading search-result title ("AT&T hooks up with
  Amazon Leo to connect businesses") that read like independent
  corroboration for today's AT&T Business/Amazon Leo "further
  agreements" expansion turned out, on direct fetch, to be dated
  February 5, 2026 -- the ORIGINAL agreement announcement, not today's
  story -- despite near-identical framing; extends the standing
  stale-resurfacing pattern to search-result titles for a story that
  genuinely does have a new Sept. 8 installment (SDxCentral's same-day
  piece, with a fresh Stankey quote, served as the real corroboration
  instead).
- 2026-09-08-S: A recurring Textron Aviation Starlink-retrofit STC
  press release (this time Hawker 700/800/900 via AeroMech's STC,
  BusinessWire-distributed, reproduced verbatim by stocktitan/
  investingnews/travelprnews with no independent reporting) was left
  undrafted: `site:txtav.com` search showed Textron has issued
  near-identical per-aircraft-type Starlink availability releases
  repeatedly (King Air B200/300, Citation X/X+, Citation Longitude,
  Citation Caravan) over recent months, making this a routine,
  recurring product-rollout cadence rather than a genuinely new
  capability -- unlike the Qatar Airways/Austrian Airlines airline
  first-flight precedents, which mark a distinct operational milestone
  each time.
- 2026-09-08-T: NordiskPost (a small Nordic-focus outlet) supplied a
  quantified figure (EU 9.1M euros + Denmark 2M euros funding; target
  bandwidth improvement 6 Mbps to 15 Mbps per Tusass's CEO) that neither
  of the two trade leads (Via Satellite, Satcom.Digital) stated for the
  Eutelsat/Tusass Greenland connectivity project; classed `informal`
  and used as a third corroboration source rather than discounted for
  being a smaller outlet, consistent with the standing "attributable
  weak sources publish, informally classed" rule.
- 2026-09-08-U: The Amazon/Project Kuiper newsroom tag page
  (aboutamazon.com/news/tag/project-kuiper) reversed its 2026-09-08-F
  bare-403 failure and loaded again, but confirmed its standing
  "no visible per-article dates" defect (2026-07-06): its apparent
  "newest" entry by list position was an old evergreen employee-profile
  piece, with the actual April 2026 Globalstar-acquisition news still
  listed high up out of chronological order. Cross-checked against
  `existing[]` before concluding nothing new; still not usable for
  dating candidates without a secondary date source.
- 2026-09-08-V: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 2
  new, 1 updated, 0 held") plus a `jq empty` parse check across all
  five touched data files (items 587, up from 585) and a direct read
  of both new items' and the updated item's `snr`/`snr_trace`/
  `category`/`impact`/`sources` fields as the build-health signal.

## Narrow re-check, ~7h40m gap, unfiltered full source list (2026-09-09)

- 2026-09-09-A: A `class: "whitelist"` source must be the RECORDED CHANNEL
  URL itself, not just any article on the same site by that whitelisted
  person: `scoring.sources[0]` set to Vivienne Machi's actual Aviation Week
  article URL (`aviationweek.com/space/satellites/...`) with `class:
  "whitelist"` was rejected outright ("not under any whitelisted
  verified-active signals.json channel"), because her recorded channel is
  the narrower `aviationweek.com/author/vivienne-machi` listing page, not
  the article path. Fixed by leading with the article as `class: "trade"`
  (Aviation Week is a trade outlet) and adding the author-page URL itself
  as a second, `via: "corroboration"` source with `class: "whitelist"`,
  `scoring.whitelist: "observer"` -- the gate then applied the
  `whitelist_floor` modifier cleanly (tier 3 trade, corroboration_none -1,
  whitelist_floor +2, final SNR 4). Confirms 2026-09-01-C's workaround
  (author-page as the whitelist source, facts drafted from elsewhere) is
  not just a paywall workaround but the ONLY gate-safe way to claim the
  whitelist floor when the person's own article IS the fact source.
  Also: finalize's same-domain corroboration-collapse rule (2026-09-05-N)
  fired again here, collapsing the article and the author-page URL into
  one unit (`rule: "same_domain"`) since both are aviationweek.com --
  harmless (the item still landed the intended SNR 4) but worth expecting
  whenever a whitelist-floor source and its lead share a domain.
- 2026-09-09-B: A never-covered gap surfaced only via the mandatory
  signals pass: BAE Systems' critical design review for the Space Force's
  10-satellite Epoch 2 MEO missile-warning constellation (Sept 8), six
  months after its March PDR, which was itself never drafted under any id.
  DefenseScoop's March PDR article was directly fetched and used only for
  `why_it_matters` background (the $1.2B contract value, 10-satellite
  count), not as a scoring source, since it reports a different, earlier
  milestone than today's CDR.
- 2026-09-09-C: Two same-day recap pieces (Jeff Foust's bluesky, a fresh
  SpaceNews article) restated The Exploration Company's $450M Series C
  with no new investor or figure -- confirmed via the existing item's
  `snr_trace.history` that it was rescored from "in talks" to "closed"
  only the PREVIOUS day (2026-09-08), so today's pickups are late
  coverage of yesterday's already-current close, not a new development;
  left untouched rather than patched or redrafted.
- 2026-09-09-D: A Google-News "Kazakhstan plans to expand Starlink
  internet to 124 passenger trains" headline (Qazinform, dated today) and
  a June 25 Qazinform piece on a single private-carrier train
  (Aray Trans KZ, one route) are two different, both-stale stories: the
  124-trains/1,235-carriages/50-routes figure traces to an August 20
  Transtelecom (TTC) announcement already three weeks old with no new
  news peg today. Left undrafted as a recurring, no-dollar-figure
  connectivity-rollout update, same treatment as the standing Textron
  Aviation STC-recap precedent (2026-09-08-S).
- 2026-09-09-E: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new,
  0 updated, 0 held") plus a `jq empty` parse check across all four
  touched data files (588 items, up from 587) and a direct read of the
  new item's `snr`/`snr_trace`/`category`/`impact`/`sources` fields as
  the build-health signal.

## Narrow re-check, ~6h39m gap, unfiltered full source list (2026-09-09, second)

- 2026-09-09-F: A Bloomberg "UAE-Based Group Leads $1 Billion Satellite
  Constellation Project" headline (Sept 9, discovery pass) is a stale
  resurfacing, not new: Khaleej Times's own writeup of the identical
  Orbitworks/Marlan Space/Loft Orbital $1B/40-satellite/French-space-agency
  figures, fetched directly, carries a "Mon 4 May 2026" publish date --
  extends the standing stale-resurfacing pattern to a fourth-month-old
  Bloomberg pickup with no new figure or peg. Left undrafted.
- 2026-09-09-G: A paywalled SpaceNews article (Andrew Parsonson's ESA
  radioisotope-heater-plant tender piece) still yields a gate-safe,
  attributable lead when a direct WebFetch confirms only the headline,
  byline, and publish date plus the lede sentence: drafted from that one
  confirmed sentence (base tier 3, `trade`) and corroborated with an
  independently-written Italian outlet (AstroSpace.it) that had the fuller
  figures (deadline, euro amount, per-year watt/gram targets) the
  paywalled lede didn't state. Don't discard a paywalled trade lead just
  because the body text is inaccessible; the confirmed lede plus an
  independent second source with the depth is still a clean draft.
- 2026-09-09-H: `bun run build` was NOT attempted this run, per the
  2026-09-09 CLAUDE.md procedure update: the workflow now runs the build
  itself after the agent finishes, and the agent is instructed not to run
  it or log the denial. Relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 3 new, 0 updated, 0 held") plus a `jq` parse check
  (591 items, up from 588) and a direct read of all three new items'
  `snr`/`category`/`impact`/`tags`/`companies`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~5h14m gap, unfiltered full source list (2026-09-09, third)

- 2026-09-09-I: The Paris International Space Summit produced multiple
  independent, genuinely new commercial announcements the same day the
  Eutelsat/Infinite Orbits item from an earlier same-day sweep was
  published: BlackSky's own release naming it exclusive electro-optical
  provider for a $1B, 50-satellite "Altair-Next Gen" AI-infrastructure
  constellation (Marlan Space/Loft Orbital/Mistral AI-led, UAE/France
  backed) landed a clean single-source first_party SNR 5
  (`crawl: "found_none"`, no penalty per the direct-source-ceiling rule;
  only derivative wire-aggregator mirrors, e.g. securities.io, turned up
  on a search, correctly left uncited as non-independent). ICEYE and
  Arianespace's same-day MoU to explore Ariane 6 launches for European
  government SAR missions landed SNR 5 the same way, ICEYE's own release
  leading; Arianespace has no `src/data/registry` organization entity, so
  its own newsroom.arianespace.com release capped at `informal` (not
  `first_party`) per the standing no-registry-host workaround, confirmed
  by finalize-sweep's rejection on the first attempt.
- 2026-09-09-J: A same-company-plus-category dedup false positive fired on
  the new ICEYE/Arianespace MoU (category `partnership`) against the
  existing Sept 7 ICEYE/Sompo Japan flood-insights item (also
  `partnership`, within 7 days), despite the two sharing nothing but the
  company name -- extends the standing SpaceX/NASA/Blue-Origin/Redwire/
  Viasat/SES pattern to ICEYE. One `dedup_distinct` entry cleared it.
- 2026-09-09-K: A same-underlying-document follow-up is a clean
  `updates[].patch`+`rescore`/`attach` case, not a new item, when it adds
  genuinely new facts to a story published hours or weeks earlier: Firefly's
  own release confirming a SIGNED two-Alpha-launch contract with SSC Space
  (vs. the June 30 item's "targeting 2028" language) upgraded the item from
  a persistence-capped SNR 4 (trade lead) to SNR 5 (first_party) via the
  documented `rescore` upgrade path (patch `source_url` first, then
  `rescore.sources[0].url` must match); European Spaceflight's deeper read
  of the SAME UK Space Strategy document already sourcing the Sept 8
  SaxaVord £30m item (ESA European Launcher Challenge €144M commitment,
  £226M total assured-access spending, RFA's exclusive SaxaVord pad, the
  "leaving launch to Germany and allies" framing shift) was folded in via
  plain `attach` with no bump requested, since only 3 total additional
  sources existed, short of the `corroboration_4plus` threshold.
- 2026-09-09-L: A scoring-block mismatch produced an unintentionally low
  score: for the OECD's "Space Economy at a Glance 2026" report (no trade
  pickup found, two `informal`-class outlets used, Mirage News + Bytes
  Europe), `crawl: "found_none"` was attested even though 2 sources were
  already listed -- the gate applied BOTH `corroboration_2plus` (+1) and a
  `corroboration_none` (-1, via a `single_class_corroboration: "informal"`
  flag) since it read "found_none" as "the crawl found nothing beyond the
  lead," landing base-tier-1 informal flat at SNR 1 instead of SNR 2.
  `crawl` should be attested `"found_some"` whenever ANY second source is
  actually listed in `scoring.sources`, regardless of how weak the
  outlets are or whether a stronger (trade/mainstream) source was found;
  `found_none` means literally no other source exists, not merely "no
  strong source exists." The item still published honestly (weak sourcing
  is not a hold reason), just one level lower than the sourcing actually
  supported.
- 2026-09-09-M: Two same-day queue/discovery leads were resolved as
  already-published without drafting: Samtel Avionics/BULL's debris-MoU
  (queue re-surfaced from Sept 8 via multiple outlets) matched
  `2026-09-08-samtel-avionics-bull-debris-mou` on a straight company-name
  grep before drafting -- confirms the standing grep-before-drafting
  practice caught a same-day queue rehash that would otherwise have looked
  like a fresh Sept 9 find.
- 2026-09-09-N: Two discovery-pass leads were correctly left undrafted as
  out of scope or too stale: Intel's Terafab foundry deal with SpaceX/
  Tesla/xAI (a $55-120B Texas chip-fab consolidation) is entirely
  terrestrial chip manufacturing, no orbital product or service, same
  logic as the standing SpaceX/APR-Energy and Bastrop-turbine-foundry
  exclusions regardless of SpaceX's involvement; Orano/Perpetual Atomics'
  americium-241 supply agreement, resurfaced via a whitelisted signal's
  same-day post, traced to a December 19, 2025 signing, nine months
  stale with no new peg today.
- 2026-09-09-O: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow now runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 5 new, 2
  updated, 0 held") plus a direct read of all five new items' and both
  updated items' `snr`/`snr_trace`/`category`/`impact`/`sources` fields as
  the build-health signal.

## Narrow re-check, ~3h44m gap, unfiltered full source list (2026-09-09, fourth)

- 2026-09-09-P: Marcia Smith's bluesky post citing "According to NASAWatch"
  led to a genuinely new, never-covered item the queue and discovery pass
  both missed: NASA Administrator Jared Isaacman named Henry Helgeson (new
  Associate Administrator for Communications) as NASA's first-ever Chief
  Commercial Officer. The only fetchable confirmation was NASAWatch's own
  repost of Isaacman's `@NASAAdmin` X statement (verified verbatim via the
  syndication endpoint); nasa.gov's own staff bio page for Helgeson does not
  yet mention the CCO title at all. Led `informal` (NASAWatch, base tier 1)
  with Marcia Smith's bluesky as `whitelist`/`observer` corroboration,
  landing SNR 4 via the whitelist-floor modifier (same shape as the
  2026-09-01-C Northwood Space precedent) -- confirms `crawl: "found_some"`
  is correct here per the 2026-09-09-L lesson (2 sources listed) even though
  a dedicated trade-press search for the CCO title specifically came back
  empty both times.
- 2026-09-09-Q: The standing same-company-plus-category dedup false positive
  fired on the new NASA CCO item (category `procurement`) against the Sept 2
  NASA launch-procurement-office-reorg item, despite sharing nothing but
  company + category -- extends the long-running NASA/SpaceX/Blue-Origin/
  Redwire/Viasat/SES/ICEYE pattern. One `dedup_distinct` cleared it.
- 2026-09-09-R: The queue's own Via Satellite entries for the Paris space
  summit (Loft Orbital/Marlan Space AI-constellation piece, Amazon Leo/
  Arianespace launch-order piece, UK Space Strategy defense piece) were each
  worth checking individually even though the summit's biggest story
  (BlackSky/Altair) was already published earlier the same day: two of the
  three were genuine same-event follow-ons with new detail (MaiaSpace as
  Altair's launch provider, Orbitworks' Abu Dhabi manufacturing site; the UK
  strategy's overall £8B/defense-spending breakdown neither original
  SaxaVord source stated) folded in as `updates[].attach`+patch, and the
  third (Amazon Leo ordering 6 more Ariane 64 launches, 18->24 total) was a
  clean standalone new item with no first-party lead available (Arianespace
  has no registry organization entity, per the standing 2026-09-09-I
  no-registry-host workaround) -- led on Reuters via a Yahoo Finance mirror
  instead, `corroboration_2plus` at SNR 4.
- 2026-09-09-S: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 2 updated, 0
  held") plus a `jq` parse check (598 items, up from 596) and a direct read
  of both new items' and both updated items' `snr`/`snr_trace`/`category`/
  `impact`/`sources` fields as the build-health signal.

## Narrow re-check, ~7h49m gap, unfiltered full source list (2026-09-10)

- 2026-09-10-A: The Google News "launch" query feed was almost entirely
  investment-clickbait about "SpaceX stock" (price targets, analyst
  downgrades, an "AI stock pick" ranking) despite SpaceX being privately
  held with no real public ticker -- only one such entry was caught by the
  deterministic junk prefilter (`investment-clickbait: 1`); the rest had to
  be discarded by hand as out of scope. Worth flagging if this volume
  recurs: the prefilter pattern may need widening rather than relying on
  per-sweep manual triage.
- 2026-09-10-B: A White House-pressures-SpaceX/Blue-Origin-to-skip-Paris-
  summit story was genuinely new and worth drafting even though the
  summit's commercial deals (BlackSky Altair, ICEYE/Arianespace, Amazon
  Leo/Ariane) were already published from the prior sweep: the political
  friction (Politico via Fortune: White House urged US firms not to
  attend; a second, independently-written Pakistani outlet naming
  Stoke Space and Starcloud among the withdrawals and citing the EU Space
  Act as the specific friction point) is a distinct geopolitical fact from
  the deals themselves. Categorized `geopolitical`/`notable` (no stated
  contract value or market-access change, so not `major`).
- 2026-09-10-C: A `class: "whitelist"` source on the SAME domain as the
  lead (Vivienne Machi's Aviation Week author page vs. her own Aviation
  Week article) triggered the `same_domain` corroboration-collapse rule
  exactly as predicted by 2026-09-09-A, but the whitelist-floor modifier
  still applied cleanly (final SNR 4) -- confirms the collapse is
  cosmetic to the sources array, not a scoring loss, when the intent is
  the whitelist floor rather than an independent corroboration unit.
- 2026-09-10-D: Two FCC "weird space stuff" spectrum stories resurfaced
  the same week: an SDxCentral piece genuinely published Sept 9 turned out
  to be analysis of a Sept 30 SCHEDULED VOTE on an NPRM the FCC actually
  adopted back on March 26, 2026 -- a process-not-yet-fact story, left
  undrafted per the standing T-Mobile/Sateliot precedent (2026-08-21-D).
  Worth a follow-up check around Sept 30 once the vote itself happens.
- 2026-09-10-E: The recurring ISRO-privatization/talent-drain Google News
  wave resurfaced again, this time as "120 scientists exit ISRO" framed
  as breaking news by a small outlet (Whispers in the Corridors, vague
  "reports of roughly 100-120" sourcing, no dates); traced via search to
  a Department of Space memo dated July 14, 2026 -- two months stale, and
  the underlying claim's vague/anonymous sourcing style would fail the
  personnel-gossip exclusion even if it were fresh. Left undrafted,
  tenth-plus consecutive sweep with no Florian ruling on this wave.
- 2026-09-10-F: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 0
  updated, 0 held") plus a `jq` parse check (600 items, up from 598) and a
  direct read of both new items' `snr`/`snr_trace`/`category`/`impact`/
  `sources` fields as the build-health signal.

## Narrow re-check, ~6h24m gap, unfiltered full source list (2026-09-10, second)

- 2026-09-10-G: A same-company-plus-category dedup false positive fired
  TWICE on one new ISRO CE20 engine ground-test item (category `launch`)
  against BOTH the completed Sept 4 GSLV-F17/EOS-05 launch and the Sept 5
  semi-cryogenic engine full-thrust test, despite sharing nothing with
  either beyond company ISRO + category + within 7 days (a different
  engine, a ground test vs. a flown launch). Two `dedup_distinct` entries
  cleared it in one pass; extends the standing pattern (now well beyond
  SpaceX/NASA/Blue Origin) to ISRO's own recurring high cadence of
  engine-test items specifically, not just launches.
- 2026-09-10-H: A whitelisted person's OWN bare-domain site extends the
  whitelist channel to every article on it, not just a narrower listing
  page: Andrew Parsonson's europeanspaceflight.com article on The
  Exploration Company's Ariane 6/Nyx/ALADDIN booking (found via the
  candidates queue, then independently confirmed via his mandatory
  bluesky leg) led cleanly at `class: "whitelist"` since the article URL
  sits directly under his recorded channel (bare `europeanspaceflight.com`),
  unlike Vivienne Machi's narrower `aviationweek.com/author/vivienne-machi`
  channel, which only the author-listing page itself satisfies
  (2026-09-09-A). Confirms the gate's whitelist-channel check is
  path-prefix-based against the recorded URL, not an exact match.
- 2026-09-10-I: A Reuters "Exclusive" story (UK Ministry of Defence FOIA
  disclosure of ~$40M Starlink/Starshield spending) landed an honest SNR 2
  (`mainstream` base tier 3, `crawl: "found_none"` -1) despite being
  substantial and newsworthy (first public UK acknowledgment of Starshield
  adoption): exclusives by definition have no independent pickup yet, and
  every other hit found on search was a same-text mirror of the same
  Reuters wire, not separate reporting. Left single-sourced rather than
  stacked with wire mirrors, per the standing wire-collapse rule; a
  genuine June 2026 "UK adopts Starshield" Reuters report (sources say, no
  figures) was never itself drafted under any id, so this FOIA-figures
  story published as a new item rather than an update.
- 2026-09-10-J: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 4 new, 0
  updated, 0 held") plus a `jq` parse check (603 items, up from 599) and a
  direct read of all four new items' `snr`/`snr_trace`/`category`/
  `impact`/`sources` fields as the build-health signal.

## Normal-mode sweep, ~5h15m gap, unfiltered full source list (2026-09-10, third: Paris summit day)

- 2026-09-10-K: Bluesky's `bsky.app/profile/...` HTML pages still render
  nothing via WebFetch (confirms the standing pattern); the public
  `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=10`
  JSON endpoint works cleanly for every signals-pass account this run and
  is the only reliable way to check a fetchable Bluesky channel.
- 2026-09-10-L: A same-day European Spaceflight follow-up article that
  formally confirms an event the SAME outlet's prior-day article had only
  inferred from a leaked government document (ESA's own €760M ALADDIN
  Phase 2 announcement for Exploration Company, following yesterday's
  "French Presidency document reveals..." item) is a clean
  `updates[].patch`+`attach`+`bump: "corroboration_2plus"` case, not a new
  item, even though the new article adds a full financial breakdown and a
  named ESA quote the original never had.
- 2026-09-10-M: Two independent Google News headline-shaped queue entries
  ("Eutelsat Communications Engages Airbus Unit, Thales Alenia Space...",
  "Starlink rival Eutelsat plans OneWeb expansion after €1 billion
  satellite order") both traced to the SAME underlying story (Eutelsat's
  IRIS2 LEO manufacturing awards to Aerospacelab/Airbus/Thales Alenia
  Space) that European Spaceflight and Reuters covered directly with the
  real €5.4B figure; neither Google News redirect resolved via WebFetch,
  but a plain WebSearch on the company+figure terms found the
  europeanspaceflight.com original and a Reuters-via-Yahoo-Finance mirror
  directly. A stale-title trap nearly followed: Telecompaper's own
  "Aerospacelab, Thales Alenia Space confirm major Iris2 awards" headline
  (found via WebSearch) turned out, once fetched, to carry a December 12,
  2024 publish date describing the ORIGINAL 2024 SpaceRISE manufacturing
  split, not today's contract-value announcement -- left uncited.
  Aerospacelab has no `src/data/registry` organization entry, so even
  though Eutelsat (the awarding party) does, the no-registry-host
  workaround still applied to the reported figures since the award is to
  Aerospacelab/Thales/Airbus, not a fact about Eutelsat itself.
  Aviation24.be, an otherwise-useful Belgian aviation trade outlet, 403'd
  on this story.
- 2026-09-10-N: `aerospacelab.be` 301-redirects to `aerospacelab.com`
  (confirmed via a `/news/` fetch); worth updating any stored source URL
  at a future structural touch, same pattern as prior rebrand-domain
  cases.
- 2026-09-10-O: A same-calendar-date, year-old stale trap on a Kazakhstan
  headline: "Kazakhstan Ready to Build Satellites for Neighboring
  Countries" (DKNews.kz, dated today via Google News) traced via
  WebSearch to Kazakhstan's September 2025 Nigeria/DRC satellite-
  manufacturing agreement (Space in Africa, dated 2025-09-10 exactly one
  year earlier) -- extends the standing same-calendar-date-different-year
  trap (2026-08-13-A and many peers) to a case where the DAY AND MONTH
  match exactly, one year apart.
- 2026-09-10-P: Confirms 2026-09-09-A/2026-09-10-C's whitelist-channel
  pattern a third time on a new person: Vivienne Machi's own article
  (Aviation Week, Sierra Space Ghost drop-test story) led at `class:
  "trade"` with her narrower `aviationweek.com/author/vivienne-machi`
  channel page attached separately at `class: "whitelist"` for the floor;
  finalize's same-domain collapse rule fired again (logged to
  `corroboration_collapses`), cosmetic only, final SNR unaffected.
- 2026-09-10-Q: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 8 new, 1
  updated, 0 held") plus a `jq empty` parse check across all five touched
  data files (items 611, up from 603) and a direct read of all eight new
  items' and the one updated item's `snr`/`snr_trace`/`category`/
  `impact`/`tags`/`companies`/`sources` fields as the build-health signal.

## Narrow re-check, ~3h44m gap, unfiltered full source list (2026-09-10, fourth: Paris summit day, second)

- 2026-09-10-R: The same-company-plus-category dedup false positive now
  confirmed on the `science` category specifically: a new ESA/NASA item
  (NASA withdrawing its VenSAR radar instrument from ESA's EnVision Venus
  orbiter) false-matched the existing Sept 3 BepiColombo Mercury
  transfer-module-separation item purely on shared company ESA + category
  `science` + within 7 days, despite covering unrelated missions (Mercury
  vs. Venus). One `dedup_distinct` cleared it; extends the long list
  (NASA/SpaceX/Blue-Origin/Redwire/Viasat/SES/ICEYE) to ESA and to a
  category beyond contract/regulatory/procurement.
- 2026-09-10-S: A wire-distributed press release (BusinessWire) that
  403's at its own domain is still usable as `wire_pr` via a StockTitan
  mirror carrying the exact same release text verbatim (dateline,
  quotes, disclosure language) -- same pattern as the 2026-08-25-K
  Redwire/Yahoo-Finance-dateline workaround, now confirmed for
  StockTitan specifically. The mirror explicitly stating "previously
  disclosed [a figure] in March" is exactly the kind of self-reported
  staleness marker worth trusting over the fresh-looking wrapper
  headline: York Space's $187M Tomorrow.io contract was the SAME figure
  York disclosed without a customer name in March, not a new dollar
  amount; scored/impacted as notable rather than major for exactly this
  reason (money was not new today, only the customer's name was).
- 2026-09-10-T: A signals-pass whitelist channel (Vivienne Machi's
  Aviation Week author page) surfaced two same-day product/contract
  finds (MDA Aurora Black, York/Tomorrow.io) the queue and discovery
  pass both also caught independently -- but also one unverifiable
  headline (a "France Plans First Deorbiting Demo In 2030" Exotrail/
  Astroscale France piece) where AW's paywall left only a headline visible
  and a background WebSearch found only a January 2026 "still in
  selection, hopes to know by summer" item with no September resolution
  independently confirmed -- left undrafted per the standing
  genuinely-fetched-content rule rather than assume the AW headline means
  selection was confirmed.
- 2026-09-10-U: A crewed-mission update three months after the original
  item (Vast-PAM-1's Czech Republic/Ales Svoboda booking, June 8) adding
  a fourth crew member for a different, newsworthy-in-its-own-right
  national angle (Greece's first-ever astronaut, Adrianos Golemis) was
  drafted as a NEW standalone item rather than an `updates[].patch` on
  the 94-day-old original, cross-referenced only in prose (no unfetched
  URL added) -- the national-first framing carries its own news value
  independent of the underlying mission's continuity, similar to how
  country-by-country Starlink market-entry items each get their own id
  despite sharing the same company and program.
- 2026-09-10-V: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 5 new, 3
  updated, 0 held") and a direct read of all five new items' and all
  three updated items' `snr`/`category`/`impact`/`tags`/`companies`/
  `sources` fields as the build-health signal.

## Narrow re-check, ~7h48m gap, unfiltered full source list (2026-09-11)

- 2026-09-11-A: A large, widely-mirrored "SpaceX signs $1 billion-a-month
  AI hosting deal" / Nvidia-alliance / "$100B ARR by year-end" cluster
  (Seeking Alpha, Stocktwits, Moomoo, TeslaNorth, allweatherfinance.com,
  from SpaceX CFO Bret Johnsen's remarks at the Goldman Sachs
  Communacopia conference) traced, once one underlying CNBC headline was
  read closely ("Google to pay SpaceX $920 million a month for compute
  capacity **at xAI data centers**"), to SpaceX's terrestrial AI/GPU
  hosting business (the Colossus-style data centers it operates for
  Google/Anthropic/xAI), not its orbital Starmind compute-satellite
  product (already separately covered under
  `2026-06-24-spacex-starmind-name` and
  `2026-08-04-spacex-nvidia-starmind-exclusive`). Left the whole
  financial cluster undrafted as out of scope, extending the standing
  Intel Terafab/APR-Energy/turbine-foundry precedent (2026-09-09-N) to a
  new shape: a huge, SpaceX-branded, multi-billion-dollar financial
  disclosure that is still terrestrial infrastructure business, not a
  launch/satellite/spacecraft product, regardless of dollar value or
  how "space company signs deal" the headlines read.
- 2026-09-11-B: A one-year-stale trap on an Indian government-relations
  headline shape distinct from the standing India-EO-PPP trap: an
  Akashvani/newsonair.gov.in "NSIL-ISRO-HAL ink pact for SSLV technology
  transfer" story, surfaced fresh via WebSearch, carries its own stated
  publish date of September 11, **2025**, exactly one year before this
  sweep -- same-calendar-date-different-year pattern (2026-08-13-A and
  many peers), this time on an official .gov.in press page rather than a
  trade aggregator or Google News wave.
- 2026-09-11-C: BlackSky's own confidentially-launched Gen-3 satellites
  (this run's 5th, on Rocket Lab's "Happily Ever Faster" Electron
  mission) are hard to corroborate same-day: SpaceNews 429'd on every
  attempt (three tries) and the Google News redirect for a Quiver
  Quantitative pickup wouldn't resolve, leaving only Launch Library 2
  (aggregator, tier 4) as a fetchable source; landed a clean, honest
  SNR 3 via `crawl: "found_none"` rather than force an uncited claim of
  corroboration that technically exists on the web per search snippets.
- 2026-09-11-D: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 3
  new, 1 updated, 0 held") plus a direct `jq` read of all three new
  items' and the one updated item's `snr`/`snr_trace`/`category`/
  `impact`/`sources` fields, and the registry-candidates.json crossfeed
  entry it produced, as the build-health signal.

## Narrow re-check, ~5h14m gap, unfiltered full source list (2026-09-11, second)

- 2026-09-11-E: A company's own press release re-hosted on a PR-wire
  syndication mirror (Business Wire content republished verbatim on
  `lifestyle.middletownlifemagazine.com`, a local-news content-syndication
  site) scores higher (`wire_pr`, base tier 4) than an independent trade
  outlet's own reporting of the same fact (Payload, base tier 3, despite
  Payload having an exclusive quote "via email" from the company) -- led
  Antares' $161M DoD nuclear-reactor award with the wire mirror and used
  Payload as `trade` corroboration, per the standing base-tier-by-class
  rule rather than by which source reads as more authoritative.
- 2026-09-11-F: Confirms the `hostMatches()` hostname-suffix check treats
  a bare-apex company domain (`impulsespace.com/updates/...`) as
  `first_party` cleanly when the registry `website` value is the same
  bare apex (no subdomain), landing SNR 5 on a company's own technical
  milestone post (Impulse Space's LEO-2/LEO-3 200m proximity flyby) with
  zero `found_none` penalty risk since it's a direct source regardless of
  corroboration strength.
- 2026-09-11-G: A same-company-plus-category dedup false positive fired
  TWICE on a new Poland/PGZ/ICEYE sovereign-satellite letter-of-intent
  item (category `partnership`) against both the Sept 7 ICEYE/Sompo Japan
  insurance item and the Sept 9 ICEYE/Arianespace launch-services MoU,
  none of which share anything with a Polish state-defense LOI beyond the
  company name ICEYE -- two `dedup_distinct` entries cleared it in one
  pass, extending the long-running list to a case where all three ICEYE
  items in one week are mutually unrelated.
- 2026-09-11-H: Two same-day "big number" headlines both traced to stale
  restatements once fetched/searched directly: (1) "Britain...Contracts
  Already Top $6 Billion" (Yahoo Finance/247wallst) wraps the already-
  published Sept 10 Reuters FOIA story (UK MoD's own ~$40M Starlink/
  Starshield spend) in unrelated context about total US Space Force
  Starshield contract value nationally, adding no new UK-specific fact;
  (2) Le Monde's "France and EU rescue Iris²" Paris-summit coverage and
  von der Leyen's own summit remarks both restate the already-published
  Aug 7 SpaceRISE acceleration decision and the Sept 10 Aerospacelab/
  Thales €5.4B contract awards, not a new figure or decision. Both left
  undrafted/unpatched rather than treated as fresh.
- 2026-09-11-I: A signals-pass Bluesky find (Andrew Parsonson: Avio's FD1
  reusability-demonstrator rocket completed integration ahead of ground
  testing and a planned SUBORBITAL flight from Sardinia) was left
  undrafted on two independent grounds: it is a pre-flight milestone (no
  launch yet, standing "scheduled-but-not-flown" exclusion), and the
  planned flight itself is suborbital, which CLAUDE.md's launch-vehicle
  scope excludes regardless of whether the vehicle is a reusability tech
  demonstrator rather than a tourism vehicle -- first time the
  suborbital-demonstrator shape (distinct from the 2026-08-14-B
  suborbital-manufacturer-insolvency case) has come up.
- 2026-09-11-J: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 4 new,
  0 updated, 0 held") plus a direct `jq` read of all four new items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields (items 622 to
  626, sweep log 237 to 238) as the build-health signal.

## Narrow re-check, ~4h06m gap, unfiltered full source list (2026-09-11, third)

- 2026-09-11-K: Vivienne Machi's Aviation Week author page carried "France
  Plans First Deorbiting Demo In 2030 With Industry Trio" (Sept 10) a
  second sweep running (first flagged 2026-09-10-T): a WebSearch synthesis
  can now describe it in full (Astroscale France signed a stated EUR13.2M
  Sept 9 subcontract to Exotrail's CNES/France 2030 prime contract,
  targeting a Eutelsat OneWeb satellite, 2029-2030 window), but both
  non-mirror write-ups found (Tokyo Brief, Space & Defense) 403'd on every
  direct WebFetch attempt, and Astroscale's own site's most specific page
  on the partnership is a stale April 2 framework announcement with no
  euro figure or Sept 9 date. Left undrafted again rather than cite the
  figures from an unfetched page's WebSearch summary; worth treating this
  specific headline as a standing dead lead (like the 2026-08-24-H NRO/SAR
  case) unless a directly-fetchable page turns up.
- 2026-09-11-L: A CFO's forward-looking conference remarks about an
  already-drafted, not-yet-flown launch are fair game as an
  `updates[].patch`, not a "don't draft a scheduled launch" violation:
  SpaceX CFO Bret Johnsen telling investors (Goldman Sachs Communacopia,
  Sept 10) that Starship Flight 14 will be the company's first
  revenue-generating mission is new, attributed, dateable information
  layered onto the existing Sept 1 FCC-filing item, not a claim that the
  flight itself already happened; folded in via explainer patch with two
  `informal`-class attaches (BigGo Finance, TeslaNorth) and no rescore
  requested (item already at its trade-lead ceiling of 4).
- 2026-09-11-M: A whitelisted tracker's own blog post directly disputing
  an already-published claim (Marco Langbroek's SatTrackCam post arguing
  ISW's "Rassvet second batch failed to reach altitude" read is wrong,
  based on a side-by-side altitude-raising comparison against the first
  batch) is a legitimate `updates[].patch` attaching both reads, not a
  dispute-downgrade case: this is an editorial disagreement about
  interpreting public tracking data, not a same-metric registry-fact
  conflict, so no `dispute_resolved`/`rescore` machinery applies; his
  bluesky post (the recorded signals.json channel) supplied the specific
  post permalink as the `whitelist`/`observer` source, with the blog's own
  fuller analysis drafted as attributed background per the standing
  Northwood Space/2026-09-01-C workaround for a non-recorded companion
  page.
- 2026-09-11-N: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 2
  updated, 0 held") plus a direct grep read of the new item's and both
  updated items' `snr`/`category`/`impact`/`sources` fields (item 627, up
  from 626; sweep log 238 to 239) as the build-health signal.

## Narrow re-check, ~7h44m gap, unfiltered full source list (2026-09-12)

- 2026-09-12-A: A WebSearch open-web find (Loft Orbital/Marlan Space's $1B
  Orbitworks constellation expansion from 10 to 50 satellites, announced
  at the Paris summit) turned out to already be published, just under a
  different lead company: the existing item led with BlackSky as the
  exclusive imaging-sensor supplier
  (`2026-09-09-blacksky-altair-next-gen-ai-constellation`), while every
  independent outlet this run's search surfaced (Via Satellite, SatNews,
  a Satellite Evolution Group wire mirror) framed the same announcement
  around Loft Orbital/Marlan Space as the deal principals. finalize-sweep's
  dedup gate still caught it correctly on shared companies + category +
  date; worth remembering that the same multi-company announcement can
  read as a completely different "lead actor" story depending on which
  outlet's framing you find first.
- 2026-09-12-B: Two Arianespace launch-services bookings from the same
  Sept. 10 Paris-summit order-intake wave (Eutelsat/OneWeb renewal,
  KT SAT/KOREASAT 9) both false-matched the *already-published* Amazon
  Leo/Arianespace six-launch item purely on shared company (Arianespace)
  + category (launch) + date proximity, and the Eutelsat item separately
  false-matched the unrelated Eutelsat/Skynopy ground-network item on
  shared company + a shared Payload recap-article URL cited as
  background in both. Three `dedup_distinct` entries cleared all of it in
  one pass -- extends the standing multi-deal-single-summit-day dedup
  false-positive pattern to launch-services bookings specifically.
- 2026-09-12-C: Arianespace's own newsroom (`newsroom.arianespace.com`)
  fetches clean and gives full press-release text, but Arianespace has no
  `src/data/registry` organization entry of its own -- only ArianeGroup
  does, registered at `ariane.group`, a different domain -- so
  Arianespace's own-domain press releases still fail anti-spoof and must
  be classed `informal` (standing no-registry-host workaround, first
  applied to Arianespace 2026-07-something per earlier entries). A
  same-day EuropaWire wire-service republish of the identical release
  classed `wire_pr` (tier 4) outscores the informal-capped original and
  is the better lead every time this pattern recurs.
- 2026-09-12-D: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 4 new, 0
  updated, 0 held") plus a direct `jq` read of all four new items'
  `snr`/`category`/`impact`/`tags`/`companies`/`sources` fields (items
  628-631, sweep log 239 to 240) as the build-health signal.

## Narrow re-check, ~5h44m gap, unfiltered full source list (2026-09-12, second)

- 2026-09-12-E: A T-Mobile CFO (Peter Osvaldik) quote dismissing Starlink
  Mobile's competitive threat ("can't even get through a Tesla
  windshield"), widely picked up from Citi's 2026 Global TMT Conference
  (Sept 9-10), traced via search to the SAME physics-of-D2D talking
  points he had already made publicly in August conference/earnings
  appearances (AndroidHeadlines, late August) -- left undrafted as a
  recycled corporate talking point with no new stated fact, figure, or
  contract, rather than a fresh commentary item. Worth flagging if a
  future instance of this quote carries a genuinely new data point (e.g.
  a stated traffic-share percentage) not present in the August coverage.
- 2026-09-12-F: The Exotrail/Astroscale-France/Eutelsat France 2030
  sovereign deorbiting-demonstration contract (first flagged as an
  unfetchable Aviation Week headline in 2026-09-10-T/2026-09-11-K) was
  finally sourced cleanly this sweep via Astroscale's OWN newsroom
  (`astroscale.com/en/news/...`), a first-party page the prior two
  sweeps never tried fetching directly -- landed a clean SNR 5 with zero
  `found_none` penalty (direct-source lead) even though the €13.2M figure
  cited by Tokyo Brief/Space & Defense (both still 403 on direct fetch)
  never appeared in Astroscale's own release and was correctly omitted
  rather than borrowed from an unfetched page. Lesson: when a trade
  outlet covering a company announcement is paywalled or blocked, check
  the NAMED companies' own newsrooms before giving up on a lead a second
  time.
- 2026-09-12-G: The same-company-plus-category dedup false positive fired
  again on Eutelsat + `procurement` within 7 days, this time against the
  Sept 8 Tusass/Greenland ground-network expansion item, despite sharing
  nothing else with the Exotrail deorbiting-demo item -- extends the long
  list to a case where Eutelsat is only the THIRD-named company (behind
  Exotrail and Astroscale) on the new item. One `dedup_distinct` cleared
  it.
- 2026-09-12-H: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 0
  updated, 0 held") plus a direct `jq` read of the new item's
  `snr`/`snr_trace`/`category`/`impact`/`tags`/`companies`/`sources`
  fields (item 632, sweep log 240 to 241) as the build-health signal.

## Narrow re-check, ~5h55m gap, unfiltered full source list (2026-09-12, third)

- 2026-09-12-I: A company's own blog/newsroom post is rejected as
  `first_party` by the anti-spoof gate whenever the actor has no
  `src/data/registry` organization entry at all (not just a mismatched
  domain): Astranis' own `astranis.com/blog/...` post about the stc
  group/Saudi Arabia deal 403'd the first_party classification with "not
  an official first_party host" since Astranis has no registry profile to
  verify the domain against. Reclassified it `informal` and led with Via
  Satellite (`trade`) instead, per the standing no-registry-host
  workaround (2026-09-10-N/2026-09-12-C, previously only seen on
  Arianespace) now confirmed for a second, entirely different company.
  Landed a clean SNR 4 off two independent trade sources (Via Satellite,
  Developing Telecoms) rather than force an unverifiable SNR 5.
- 2026-09-12-J: Bluesky profile pages (`bsky.app/profile/...`) render as
  an empty JS shell via WebFetch as expected, but
  `public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=N`
  returns full post text and `createdAt` timestamps cleanly for every
  handle tried this run (Josef Aschbacher, Marco Langbroek, Caleb Henry,
  Tim Farrar, Eric Berger, Jeff Foust's SpaceNews account, Andrew Jones,
  SpacePolicyOnline) with no auth needed; worth using this endpoint
  directly instead of the profile URL on future sweeps to cut the
  fetchable-channel budget roughly in half. Two caveats found: some feeds
  return posts far out of chronological order / very stale (Caleb Henry
  and Eric Berger's most recent returned posts were from July 2026 and
  2025 respectively despite presumably posting more recently, and Tim
  Farrar's feed likewise topped out at July), so a stale-looking API
  result is not proof the account has nothing new; and the
  `marcolangbroek.bsky.social` feed came back dominated by unrelated Dutch
  political posts mixed with his real space content (RASSVET blog
  repost), so the account is a personal, not space-only, feed and needs
  filtering by content, not by assuming every post is on-topic.
- 2026-09-12-K: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 0
  updated, 0 held") plus a direct `jq` read of the new item's
  `snr`/`category`/`impact`/`tags`/`companies`/`sources` fields (item 633,
  sweep log 241 to 242) as the build-health signal.

## Narrow re-check, ~3h38m gap, unfiltered full source list (2026-09-12, fourth)

- 2026-09-12-L: A rocket-propulsion manufacturer's own going-public event
  (Ursa Major Technologies' $2.3B SPAC merger with Bleichroeder
  Acquisition Corp. III, announced Aug 25, surfaced via discovery search
  and never previously drafted) left undrafted as out of scope despite
  Ursa Major being a real registry-adjacent "manufacturer" (its Hadley
  and Draper engines fly on orbital and in-space vehicles, and SpaceNews/
  Payload both cover the company): the company's own press release calls
  itself a "Hypersonics and Critical Munitions Company," and every use-
  of-proceeds line (HAVOC Missile System, munitions production capacity,
  hypersonic engine manufacturing) is defense/munitions, with "space
  mobility systems" mentioned only as one minor line item. Same
  terrestrial/adjacent-industry-substance-over-space-branding shape as
  the 2026-09-09-N Intel Terafab precedent, now confirmed for a company
  that DOES have a genuine, otherwise-in-scope space product line: the
  test is the substance of the specific event (what the money funds, how
  the company frames its own release), not whether the company also does
  space work elsewhere. Worth revisiting if a future Ursa Major event is
  framed around its space-launch engine business specifically.
- 2026-09-12-M: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 0 new, 0
  updated, 0 held") and a `jq empty` parse check across all four touched
  data files (candidates, source_ledger, sources, state) as the
  build-health signal. Zero-item sweep: queue, 7 HTML sources, 15/17
  signals channels, and 8 discovery queries all came up empty or already-
  published.

## Narrow re-check, ~8h11m gap, unfiltered full source list (2026-09-13)

- 2026-09-13-A: A CZ-8A/Wenchang commercial-LC-1 launch previewed for
  Sept 11 (NASASpaceflight launch-preview roundup, "TBC" status) never
  resolved to a confirmed payload or outcome in any source checked
  (English or Chinese search); left undrafted per the standing
  "don't state a fact not in a source" rule rather than assume a routine
  Guowang-style success. Worth a follow-up grep next sweep once
  independent reporting catches up.
- 2026-09-13-B: A "secretive backer builds $40bn SpaceX stake" FT
  headline and a fresh "$1.11 billion-per-month AI compute deal" wave
  both traced cleanly to already-known shapes: the former is coverage of
  an existing, long-held shareholder now that SpaceX trades publicly
  (pure stock-market content, the standing 2026-09-10-A investment-
  clickbait exclusion), and the latter is another tranche of SpaceX's
  terrestrial Colossus AI/GPU hosting business (confirmed via a direct
  search on the deal specifics: Mississippi/Tennessee data centers), the
  same out-of-scope shape as the 2026-09-11-A Google/xAI compute deal.
- 2026-09-13-C: Two independent stale-resurfacing traps in one discovery
  pass: a New Space Economy op-ed (Sept 11) discussing "US sanctions on
  Chinese satellite firms" over Iran-imagery support (Chang Guang,
  MizarVision, The Earth Eye) reads as fresh but the underlying OFAC
  action is dated May 9, 2026, four months stale; and a SpaceNews
  "NASA releases details on revised next phase of commercial space
  station development" piece, which surfaces readily for a "September
  2026" query, carries its own stated publish date of September 6,
  **2025** once fetched directly, over a year stale.
- 2026-09-13-D: Two more "process not yet fact" exclusions: NASA's
  NextSTEP-3 BAA Appendix A (Sept 8 lunar-surface-tech proposal call,
  five capability areas including oxygen extraction and vertical solar
  arrays) is a call for proposals with no award; a same-day scheduled
  SpaceX Falcon 9 launch of the final three O3b mPOWER satellites for
  SES (window opening hours after this sweep ran) was correctly left
  undrafted as not-yet-flown.
- 2026-09-13-E: A recycled-talking-point exclusion on a new person:
  Rocket Lab CEO Peter Beck's "piping hot" AI/space valuation warning
  (widely mirrored via UFO Feed and peers, dated Sept 11-12) traces to a
  Newstalk ZB radio interview restating his own June "completely
  untethered to reality" remarks, not a fresh fact or a retrievable X
  post — same shape as the 2026-09-12-E T-Mobile CFO precedent, now
  confirmed for an xSearch-only whitelisted person rather than a
  non-whitelisted executive.
- 2026-09-13-F: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 0 new, 0
  updated, 0 held") and the sweep log entry it wrote (one persistence
  SNR bump on an existing item, `2026-08-27-casc-long-march-6c-
  fragmentation` 2 to 3) as the build-health signal. Zero-item sweep:
  the 20-candidate queue, all 7 HTML sources, 13/17 signals channels
  (rotation), and a 10-query discovery matrix all came up empty,
  already-published, stale, or out of scope.

## Deep sweep (mode "deep", triggered after two zero-add sweeps), ~7h gap, unfiltered full source list (2026-09-13, fourth)

- 2026-09-13-G: A deep-mode 583-candidate queue re-triaged after three
  same-day narrow sweeps already ran means most title-scan "looks new"
  hits are stale re-presentations, not fresh finds: WebSearch corroboration
  for four promising trade-press headlines (Sirius Space STAR-1 engine
  hot-fire, NOAA's 14-vendor SBEM IDIQ, MaiaSpace/iQPS Asia SAR deal,
  TrustPoint/EnduroSat 40-satellite PNT contract) found real, on-scope
  events, but grepping `items.json` by company/keyword before drafting
  would have caught that three of the four (all but Sirius Space) were
  already published earlier the same day under different-looking item
  IDs; finalize-sweep's dedup gate caught all three anyway, but only
  after a wasted full drafting pass. Lesson: in deep mode specifically,
  grep `items.json` for each candidate's exact company names BEFORE
  spending a corroboration-search budget on it, not just against the
  `existing[]` summary list, which does not surface every recent title.
- 2026-09-13-H: One of the three redundant hits was a genuine enrichment
  case rather than a pure duplicate: Via Satellite's write-up of the NOAA
  SBEM IDIQ item named all 14 vendors across seven data categories, while
  the already-published item (led by NOAA's own official_record release,
  SNR 5) had compressed the roster to "including Spire Global, Tomorrow.io,
  PlanetiQ and Muon Space," dropping 10 named companies (BAE Systems,
  Ethereal Space, Precursor SPC, Weather Stream, Hydrosat, Tropical Weather
  Analytics, SpaceX, Iceye US, Umbra Lab, Care Weather Technologies).
  Patched via `updates[].patch` to the fuller breakdown with Via Satellite
  attached as corroboration, leaving the $8B figure and official lead
  source untouched — a same-event dedup match doesn't mean the newer
  source has nothing left to add.
- 2026-09-13-I: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 1
  updated, 0 held") plus a direct `jq` read of the new item's and the
  updated item's `snr`/`category`/`impact`/`tags`/`companies`/`sources`
  fields as the build-health signal.

## Narrow re-check, ~4h50m gap, unfiltered full source list (2026-09-13, fifth)

- 2026-09-13-J: A WebSearch result summary for a plain "rocket launch
  failure anomaly satellite September 12 13 2026" query confidently
  restated a January 12, 2026 PSLV-C62 third-stage failure (spaceflightnow.com,
  URL path literally `/2026/01/12/...`) as having happened "on September
  13, 2026," inventing a fresh date the source page does not state.
  Fetching the article directly confirmed both publish date and launch
  date were January 12, 2026, eight months stale. Extends the standing
  WebSearch-summary-fabricates-currency pattern to a case where the
  summary didn't just resurface an old story, it actively relabeled its
  date to match the query's requested window; always verify a
  search-summary's claimed date against the source URL/page directly
  before treating it as inside the sweep window.
- 2026-09-13-K: The Loft Orbital/Marlan Space/BlackSky/Mistral AI $1B
  50-satellite constellation (already published 2026-09-09) resurfaced a
  third time via a SatNews restatement dated Sept 13; company-name grep
  against items.json (not just the `existing[]` summary list) again
  caught it before any drafting time was spent, per the 2026-09-13-G
  lesson now paying off on a narrow (non-deep) sweep too.
- 2026-09-13-L: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 0 new, 0
  updated, 0 held") as the build-health signal. Zero-item sweep: the
  20-candidate queue, 7 HTML sources, 15/17 signals channels, and a
  10-query discovery matrix all came up empty, already-published, or

## Narrow re-check, ~8h gap, unfiltered full source list (2026-09-14)

- 2026-09-14-A: `space.com` article pages still render nav-chrome-only on
  direct WebFetch (standing pattern), but the harvester queue's own
  `raw_excerpt` for a Space.com Google-News-fed candidate carried the
  full verbatim article body (booster designation, Falcon-family flight
  count, Falcon 1 debut date) -- used that queue text directly rather
  than the failed live fetch to patch a genuinely new fact (SpaceX's
  700th Falcon-family flight, not stated in the original mainstream leads)
  into a same-day item published by the prior sweep.
  Two same-day "SpaceX will launch Nvidia AI computers into orbit" pieces
  (GuruFocus, investingLive) both traced to an Aug 24 Musk X post
  ("space-optimized Vera Rubin NVL72 system for launch to orbit in Q4
  next year") already restated Aug 25 and again Sept 6
  (2026-09-06-O); left undrafted as a third resurfacing of the same
  recycled talking point. A same-day Aero-News.net/Yahoo Finance "Amazon,
  AT&T Join Forces" piece traced via direct fetch to the identical Sept 8
  AT&T Business/Amazon Leo announcement already published
  (`2026-09-08-att-business-amazon-leo-expansion`), confirmed by the
  article's own Sept 8 dateline despite a Sept 13-14 republish wave.
- 2026-09-14-B: `SLI` (the aerospace-leasing firm, backed by Libra Group)
  has no `src/data/registry` organization entity, so its and Sophia
  Space's own `sophia.space` release both capped below `first_party`; led
  with the PR Newswire wire copy (`wire_pr`, tier 4) instead. Confirms
  2026-09-02-A's silent-no-op-at-ceiling behavior once more on a fresh
  item, not just an update: attaching a genuinely distinct `trade`
  corroboration source (Payload) to a `wire_pr`-led item already at its
  ceiling produced an empty `modifiers` array and an unchanged final SNR
  4, since a non-direct-source lead cannot reach 5 regardless of
  corroboration count. Also: `sophia.space`'s own release and the PR
  Newswire copy collapsed into one `wire_rewrite` corroboration unit
  (near-identical text), leaving Payload as the only actually-distinct
  corroboration source, harmless here since the ceiling made the
  distinction moot.
- 2026-09-14-C: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 1
  updated, 0 held") plus a direct read of the new item's and the updated
  item's `snr`/`snr_trace`/`category`/`impact`/`sources` fields, and the
  sweep log's `corroboration_collapses` entry, as the build-health
  signal.
  stale.

## Narrow re-check, ~8h gap, unfiltered full source list (2026-09-14, second)

- 2026-09-14-D: A new self-referential-PR trap shape: Satellogic's own
  Sept 14 GlobeNewswire release ("Satellogic Expands Slingshot III Work
  with IDT and U.S. Office of Naval Research") restates, almost fact for
  fact, its own March 24, 2026 release ("...for 'Slingshot' Program
  Phases II and III"): both state six new NewSat Mark VI satellites
  integrated into Slingshot III, both cite a 2027 (Sept: "2027 and 2028")
  on-orbit timeline, only the CEO quote framing ("expanded work...
  operationalizing") differs. The underlying March 24 event was never
  drafted under any id (a genuine gap, confirmed via grep), but it also
  predates the site's ~June 2026 coverage start, so there was no
  predates-window chase target either. Left undrafted rather than guess
  whether Sept 14 adds a material new fact; worth a second look if a
  future Satellogic/Slingshot release states a dollar figure or a
  genuinely different satellite count.
- 2026-09-14-E: A months-stale financial event can still be a genuine,
  never-covered gap worth chasing even when the only English source is a
  non-space-focused analysis outlet: Jamestown Foundation's Sept 14 piece
  on ExPace ("China's SpaceX") losing majority CASIC ownership to a Wuhan
  state investment fund traced, via a Chinese-language search, to a much
  better primary account: Sina Finance (mainstream, directly fetchable)
  had reported the same 29.5904%/3.3 billion yuan deal on April 21, 2026,
  with matching figures. Led with Sina Finance and used Jamestown as
  `informal`-class corroboration for the fresher "registration completed
  July 31" and CASIC-branding-drop detail; landed a clean SNR 4. Worth
  remembering: a Chinese-language search for the company's own name plus
  the deal terms can surface a far better source than the English-language
  analysis piece that originally flagged the story.
- 2026-09-14-F: An ESA annual data report (Space Environment Report 2026,
  first-party esa.int, SNR 5 ceiling) filed cleanly under the same
  `financial` genre convention used for the Novaspace/Space Foundation
  report precedents (2026-08-22-B, 2026-07-21) despite being about orbital
  debris, not money: no CLAUDE.md category maps cleanly to "the agency's
  own cross-cutting industry report," and `incident` is reserved for
  specific dateable events, not annual statistics. SpacePolicyOnline's
  same-day bluesky post flagging the report was usable as ordinary
  `whitelist`/`observer` corroboration even though the item's first-party
  lead was already at the SNR ceiling and needed no floor.
- 2026-09-14-G: Two Andrew Jones bluesky one-liners naming brand-new
  Chinese launch startups (Heng Space, ex-CALT chief designer; Spark
  Space's first-stage oxidizer tank test) were left undrafted despite
  being on-scope and genuinely never covered: each was a single sentence
  with no company site, no funding figure, no launch date and no
  corroborating outlet found, too thin to support the item format even at
  a floor SNR. Worth re-checking if either surfaces again with more
  substance.
- 2026-09-14-H: Two discovery-pass "fresh-looking" hits both traced to
  stale dates once fetched directly: EarthDaily's NRO Strategic Commercial
  Enhancements contract ($1.2M) was dated May 5, 2026 on EarthDaily's own
  blog despite surfacing in a "September 2026" search, and Aviation Week's
  "Starfish Space Announces $100M Series B" (paywalled) resolved via
  425business.com and Axios URL slugs (`20260409`, `2026/04/07`) to an
  April 7, 2026 close, five months stale. A third hit, SES's completed
  $3.1B Intelsat acquisition, is genuinely non-stale reporting of a real
  deal but the deal itself closed in July 2025, before this site's
  coverage began (~June 2026 backfill window) -- not a "gap" to chase,
  simply outside all coverage history.
- 2026-09-14-I: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 1
  updated, 0 held") plus a `jq` parse check (639 items, up from 636) and a
  direct read of all three new items' and the updated item's
  `snr`/`snr_trace`/`category`/`impact`/`tags`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~3h55m gap, unfiltered full source list (2026-09-14, third)

- 2026-09-14-J: The same-company-plus-category dedup false positive fired
  on two unrelated new items in one draft: Apex + `partnership` matched
  the existing AnySignal/Apex bus-software item (Elveo's D2D
  manufacturing-factory deal shares nothing else with it), and Thales
  Alenia Space + `contract` matched the existing Aerospacelab/Thales
  IRIS2 LEO-manufacturing item (NIGCOMSAT's separate GEO satellite order
  shares nothing else with it). Two `dedup_distinct` entries cleared both
  in one pass, extending the long-running list (Apex now joins
  NASA/SpaceX/Blue-Origin/Redwire/Viasat/SES/ICEYE/ESA) and confirming
  Thales Alenia Space can trip it on a second, unrelated contract inside
  the same week as a prior Thales item.
- 2026-09-14-K: `finalize-sweep`'s `signalsPass.checked` gate validates
  entries against signals-context's recorded channel URL
  (`bsky.app/profile/<handle>`), not the actual fetch mechanism used:
  listing the `public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed`
  endpoint URLs (the one that actually returns readable content per
  2026-09-12-J) got every entry rejected as "not a fetchable whitelisted
  signal channel." List the `bsky.app/profile/...` URL from
  signals-context's `fetchable[]` even when the real request goes to the
  API endpoint.
- 2026-09-14-L: A same-day BlackSky press release ("BlackSky's Fifth
  Gen-3 Attains First Light in Hours") read as a fresh standalone
  candidate from the HTML-source pass, but is the same fact already
  folded into the existing Sept 11 Rocket Lab/BlackSky launch item via a
  same-day patch (2026-09-11-C's item, upgraded to BlackSky's own
  release as lead) -- caught by grepping "first light" against
  items.json before drafting, not by finalize-sweep's dedup gate.
- 2026-09-14-M: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 0
  updated, 0 held") plus a `jq` parse check (641 items, up from 639) and
  a direct read of both new items' `snr`/`category`/`impact`/`tags`/
  `companies`/`sources` fields as the build-health signal.

## Narrow re-check, ~4h38m gap, unfiltered full source list (2026-09-14, fourth)

- 2026-09-14-N: A `found_none` corroboration penalty applied three days
  earlier turned out to be a false negative worth re-chasing on a plain
  narrow-window candidate match, not just in deep-mode re-triage: the
  Sept 11 Rocket Lab GAO protest against Blue Origin's NASA Mars
  Telecommunications Network award (SNR 2, `corroboration_none` -1) still
  had two live trade-press pickups (The Register, SatNews) a fresh
  search found instantly once the Ars Technica queue candidate pointed
  back at the same story; the additive modifier model applied the delta
  correctly without needing to touch the stale -1 (base 3 + -1 + new
  +1 = 3). The Register's fuller quote also restored the word "punitive"
  that Space.com's original paraphrase of Rocket Lab's statement had
  dropped -- a same-quote, different-completeness case, not a new fact.
- 2026-09-14-O: A same-company-plus-category dedup-adjacent case that
  ISN'T a false positive: Kazakhstan's Sept 7 EO constellation item
  (informal-sourced, SNR 2) hit its 7-day same-event boundary exactly
  today and picked up two more regional outlets (Times of Central Asia,
  Astana Times) restating the identical satellite-count/partner figures
  with zero new facts; attached both anyway as pure corroboration
  (`corroboration_4plus`, informal class throughout) since the rule
  rewards distinct-source count, not novelty. Worth remembering as the
  inverse of the usual "does this add anything" pattern: corroboration
  attachment doesn't require new facts, only distinct sources.
- 2026-09-14-P: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 0 new, 2
  updated, 0 held") plus a `jq` parse check across all five touched data
  files and a direct read of both updated items' `snr`/`snr_trace`/
  `sources` fields (both moved 2 to 3) as the build-health signal.
  Zero-new-item sweep: the 40-candidate queue, 6 HTML sources, 12/17
  signals channels (3 X handles), and an 8-query discovery matrix
  surfaced nothing on-scope that wasn't already published.

## Narrow re-check, ~6h43m gap, unfiltered full source list (2026-09-15)

- 2026-09-15-A: An `updates[].attach` with no matching `patch` silently adds
  a source to the card without changing any visible copy: attached
  TechNode Global to the Sept 13 O3b mPOWER item with a note claiming it
  "adds the operational timeline," but left `patch: {}`, so the new fact
  (mid-2027 service entry, SES's multi-orbit strategy framing) never
  actually appeared in `what_happened`/`why_it_matters` on the first
  finalize-sweep run. Caught by re-reading the merged item's explainer
  text after merge; fixed with a second, same-sweep finalize-sweep pass
  carrying the actual `patch.explainer` fields. When a draft's `note`
  describes new copy, the `patch` block must carry that copy; `attach`
  alone only adds a citation, it never edits prose.
- 2026-09-15-B: A same-day Axios headline ("How SpaceX bought 125,000
  acres of Louisiana's coast") read as a fresh detail on top of the
  already-published Aug 25 Starbase Louisiana item, but axios.com 403'd
  on every direct-fetch attempt and the one new-sounding fact a WebSearch
  surfaced (a ~$100M land-purchase price SpaceX paid) could not be
  confirmed on any other directly-fetchable page; left the existing item
  unpatched per the standing "only cite pages with genuinely fetched
  content" rule rather than add an unverified WebSearch-summary figure.
- 2026-09-15-C: A Google-News "Starlink inches closer to India
  availability" (Advanced Television) headline 403'd on direct fetch;
  WebSearch traced the underlying fact to India's DCC approving most of
  TRAI's satellite-spectrum recommendations on September 2-3, still
  pending Union Cabinet sign-off before commercial launch -- a
  process-not-yet-fact exclusion (same standard as the T-Mobile/Sateliot
  and Grain Management precedents) compounded by being 12-13 days stale
  with no confirmed final market-access grant; left undrafted.
- 2026-09-15-D: A SpaceNews profile piece on ICEYE's growth strategy
  (€1.5B+ backlog, 2-satellites-per-week production target by end of
  2027, a "Constellation Europe" 1,000+-satellite federated-network
  concept floated by the CEO) bundled genuinely new figures with already-
  published facts (the Arianespace MoU) and a speculative, unfunded
  concept rather than a concrete announcement -- left undrafted as a
  trend/strategy piece per the standing "bundles old facts, no single
  dateable new event" pattern (2026-09-04-T and peers), though the
  backlog figure and Constellation Europe concept may be worth a second
  look if ICEYE later attaches a contract or funding commitment to it.
- 2026-09-15-E: The standing same-company-plus-category dedup false
  positive fired on a new KDDI/SpaceX Starlink Mobile V2 carrier contract
  (category `contract`) against the already-published SpaceX Starfall/
  Space Cargo item, sharing only company SpaceX + category + same-day
  window -- one `dedup_distinct` entry cleared it, extending the
  long-running list to a case where SpaceX is only the second-named
  company (KDDI is first) on the new item.
- 2026-09-15-F: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 5 new, 1
  updated, 0 held", then a same-sweep follow-up "merged 0 new, 1 updated,
  0 held") plus a `jq` parse check (649 items, up from 644) and a direct
  read of all five new items' `snr`/`category`/`impact` fields and the
  corrected O3b mPOWER explainer text as the build-health signal.

## Narrow re-check, ~5h gap, unfiltered full source list (2026-09-15, second)

- 2026-09-15-G: `dedup_distinct` must sit at the TOP LEVEL of a `newItems[]`
  entry, not nested inside its `scoring` block: nesting it under `scoring`
  produced the exact same "same-event match... unattested" rejection as
  omitting it entirely, because the gate reads `raw.dedup_distinct` off the
  item object itself. Confirmed by reading `finalize-sweep.ts`'s gate code
  directly after a first rejected draft; the prompt's own example (`on the
  item`) already says this, but it is easy to slot it next to `whitelist`/
  `crawl` inside `scoring` by analogy with the `sources` array. Two genuine
  same-company-plus-category false positives this run (a Senegal Starlink
  regulatory item against two unrelated US FCC items; a new SES/Elveo Sept
  15 partnership-expansion item against both the Aug 17 SES/Elveo
  investment item and the unrelated Sept 14 Elveo/Apex US-factory item)
  both cleared once moved to the item's top level.
- 2026-09-15-H: A Google News-sourced Morningstar mirror headline
  ("Arcfield's Orion Space Solutions to provide upgraded Spectre EO/IR
  payload and RF sensor suite for Tomorrow.io's DeepSky") could not be
  resolved to a live source this run: the news.google.com redirect page
  would not resolve via WebFetch (no meta-refresh/canonical text visible to
  the fetcher, consistent with the standing Google News JS-shell pattern),
  and targeted WebSearch queries for the exact wire-copy text and for
  Arcfield/Orion + Spectre + Tomorrow.io together surfaced only older,
  unrelated Orion Space Solutions press releases (a March 2026 $24M
  proprietary-customer award, an EWS/RROCI product-launch piece) and the
  already-published York Space/DeepSky contract, never this specific
  payload deal. Left undrafted per the "never state a fact not in a
  fetched source" rule rather than guess it's the same as the March award.
  Worth a second look if a future sweep's queue carries the underlying
  PRNewswire/BusinessWire/GlobeNewswire URL directly instead of a
  Morningstar/Google-News mirror.
- 2026-09-15-I: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 3
  updated, 0 held") and a direct read of both new items' `snr`/`category`/
  `impact`/`sources` fields and all three patched items' `what_happened`
  text (confirming the `patch.explainer` prose, not just `attach`, landed)
  as the build-health signal; `node -e`/`python3 -c` JSON-validity checks
  were blocked by the sandbox's command-approval gate this run.

## Narrow re-check, ~4h20m gap, unfiltered full source list (2026-09-15, third)

- 2026-09-15-J: **`finalize-sweep.ts` bug, worth a dev fix**: on an
  `updates[]` entry that patches `source_url` to a NEW lead (the upgrade
  path) while also attaching more sources, the merge code computes
  `secondary_urls` from `base.secondary_urls` (the item's PRE-patch list)
  plus each `attach` entry checked only against `base.source_url` (the
  OLD pre-patch lead), then that computed list unconditionally overwrites
  whatever `patch.secondary_urls` the draft supplied (object-spread order
  in `finalize-sweep.ts` puts the computed `secondary_urls` after
  `...patch`). Net effect on the Starship Flight-14 update this run:
  switching lead from Teslarati to Ars Technica left Ars Technica
  duplicated (once as `source_url`, once in `secondary_urls`) and dropped
  Teslarati out of `secondary_urls` entirely, even though the draft's
  patch explicitly listed Teslarati in `secondary_urls` and omitted Ars
  Technica. Teslarati is still fully credited in the `sources` array
  (correct SNR/trace/citation), so this is a cosmetic quick-links miss,
  not a sourcing-integrity bug, and it can't be corrected from a sweep
  draft (patch.secondary_urls is always discarded, and the merge code only
  ever pushes to secondary_urls, never removes). Left as-is rather than
  compounding it with a further patch; flagging here since scheduled/
  interactive sweep agents must not edit `scripts/finalize-sweep.ts`
  themselves.
- 2026-09-15-K: A `$1.11 billion/month` SpaceX AI-computing-hosting deal,
  disclosed by CFO Bret Johnsen at the Sept. 10 Goldman Sachs
  Communacopia conference, was a genuine five-day-old gap: never drafted
  by any prior sweep despite being wall-to-wall covered by finance media
  (Yahoo Finance, Benzinga, TeslaNorth, Seeking Alpha) and clearly on
  scope as a stated-value (nine-figure-plus) financial event of a
  tracked company, consistent with the standing precedent that SpaceX's
  AI-compute-hosting business (Pentagon talks, Starmind, Nvidia GPU
  commitment) is treated as in-scope even when the specific deal is
  terrestrial, not orbital. Benzinga, Neowin, and Qz.com all 403'd on
  direct fetch; Yahoo Finance and TeslaNorth were the only two sources
  that actually rendered fetchable content, which was enough for a clean
  SNR 4 (mainstream base 3 + corroboration_2plus). Chased per the
  predates-window rule and dated on the actual Sept. 10 disclosure date.
- 2026-09-15-L: Google News queue entries can carry a publisher's exact
  press-release URL as their visible title even though the link itself is
  a `news.google.com` redirect (e.g. "Starship Flight 14 - SpaceX",
  "Telesat and SatPort Infrastructure sign global build-to-suit
  agreement..." style titles that read like a headline, not an outlet
  byline). Asking WebFetch to read the source page's own listing (e.g.
  `telesat.com/press/`) and extract the matching press release's link/URL
  worked directly, faster than trying to resolve the Google News redirect
  itself (which frequently fails per the standing JS-shell pattern) --
  worth trying "find the link on the source's own listing page" before
  giving up on a Google-News-only lead.
- 2026-09-15-M: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 4 new, 1
  updated, 0 held") plus a direct read of all four new items' `snr`/
  `snr_trace`/`category`/`impact`/`sources` fields and the updated
  Starship item's patched explainer/source_url/sources fields as the
  build-health signal.

## Narrow re-check, ~7h17m gap, unfiltered full source list (2026-09-16)

- 2026-09-16-A: A discovery-pass find (Loft Orbital/Marlan Space's $1B
  Altair-Next Gen AI-constellation deal, via Satellite/SatNews/Space Intel
  Report/The Next Web) that read as a genuine predates-window gap turned
  out to already be published under a different actor-first headline
  ("BlackSky named exclusive imager for $1 billion Altair-Next Gen AI
  satellite network", 2026-09-09) -- the same-event dedup check missed it
  on a first pass because I searched existing[] for "loft orbital" and
  "orbitworks" but not the lead company BlackSky used in its own headline.
  finalize-sweep's same-event gate caught it on the first submit
  ("shared company, category contract, within 7 days"). Worth grepping
  existing[] by every named company in a multi-party deal, not just the
  ones foregrounded in the sources you happened to read first, before
  concluding something predates the window.
- 2026-09-16-B: Confirmed the anti-spoof gate's registry-host check is a
  hard blocker, not just a nudge: a real, fetched, on-topic company page
  (orbitworks.space, the JV's own announcement of its own $1B raise) fails
  `first_party` because Loft Orbital/Marlan Space/Orbitworks have no
  registry organization profile to match the URL's host against, and the
  gate's error message names the fix (reclassify wire_pr/trade/informal)
  rather than accepting the class on the strength of the fetched content
  alone. Classed it `informal` per the hint; the fact and its attribution
  still publish honestly, just without the tier-5 floor a first-party
  class would otherwise earn.
- 2026-09-16-C: A same-day Gravity-1 (Yao-3/"遥三") sea launch from Haiyang
  scheduled for the morning of Sept 16 Beijing time (~21:55 UTC Sept 15)
  carrying an unconfirmed SpaceSail/Qianfan-style LEO batch had no
  post-launch outcome reported by any outlet (English or Chinese-language
  search) as of ~7.5 hours after the scheduled window; left undrafted per
  "never state a fact not in a fetched source" rather than assume success
  from the scheduled-launch coverage alone. Worth a same-day re-check next
  sweep for the actual result once trade press (SpaceNews, NASASpaceflight)
  or Gunter's catches up.
- 2026-09-16-D: A signals-pass find (Aviation Week's Vivienne Machi,
  Sept 15: "Space Force To Award New Resilient-GPS Contracts" to Astranis,
  L3Harris, and Sierra Space, funded by a $15M congressional add-on) is a
  clean process-not-yet-fact exclusion: the article itself says the awards
  are expected "shortly," not yet made, matching the standing CLPS/NDAA
  pre-award pattern (2026-08-16-C and peers). Left undrafted; worth
  chasing once Space Systems Command actually announces the awards.
- 2026-09-16-E: A KELOLAND "possible space debris" viewer-video story
  (South Dakota, overnight Sept 15) was walked back in the same article by
  a named physics professor as most likely the Chi Cygnids meteor shower,
  not debris -- a useful reminder that "possible space debris" local-news
  headlines need the same skepticism as any other unconfirmed-attribution
  incident claim before drafting under the `incident` category.
- 2026-09-16-F: `bun run build`, `bun scripts/check-feed.ts`, and even a
  bare `python3 -c` JSON-validity check were all denied by this session's
  permission gate; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 2 new, 1 updated, 0 held") plus a direct read of both new
  items' `snr`/`snr_trace`/`category`/`impact` fields, the corroboration-
  collapse log entry in `state.json` (SEC 8-K exhibit vs. Rocket Lab IR
  page correctly collapsed as a wire rewrite), and the updated BlackSky
  item's newly attached `sources` as the build-health signal.

## Narrow re-check, ~6h34m gap, unfiltered full source list (2026-09-16, second)

- 2026-09-16-G: An exact-quoted-headline corroboration search for a
  Tech Times-only iQPS/Mitsubishi Heavy Industries H3 rideshare story
  (three QPS-SAR satellites, Sept 14) initially surfaced what looked
  like a contradicting fact -- an unrelated June 12, 2026 H3 flight that
  already carried a single iQPS SAR satellite as a hitchhiker payload --
  which briefly read as evidence the "first commercial SAR constellation
  customer" framing was fabricated or conflated. A follow-up search
  specifically for "Space Strategy Fund" + iQPS + H3 (rather than the
  exact headline) found genuine independent corroboration on
  economiadellospazio.it (Italian trade outlet, matching facts: three
  QPS-SAR satellites, Sept 14, Space Strategy Fund backing), confirming
  the Sept 14 story as a real, distinct, larger dedicated-rideshare deal
  rather than a restatement of the June hitchhiker slot. Worth
  remembering: a single quoted-headline search surfacing an older,
  superficially similar story is not itself proof of fabrication or
  duplication; a second search varied on distinguishing details (program
  name, funding source, exact satellite count) before discarding a
  single-source lead as unreliable.
- 2026-09-16-H: Marco Langbroek's bluesky.social feed (one of the 17
  fetchable signals channels) is running almost entirely off-topic Dutch
  political content (farmer protests, AntiFa, Prinsjesdag) this window,
  not space-debris/reentry tracking; still checked in full per the
  mandatory-fetchable rule, but a useful expectation-setter for future
  sweeps skimming this channel under time pressure.
- 2026-09-16-I: OrienSpace/Gravity-1 flight-numbering is inconsistent
  across the launch provider's own coverage: CGTN's Sept 16 piece calls
  today's flight "Gravity-1 Y3" and "Gravity-1's fourth flight," while
  CGTN's own July 22 piece was headlined "Gravity-1 Y4" and SpaceNews
  called that same July 22 flight "its third Gravity-1 mission" (already
  published as `2026-07-22-orienspace-gravity-1-launch`). Left the
  registry crossfeed's `orienspace.flights_total` fact unattested this
  run rather than trust either single-source count, given the standing
  cited page contradicts itself across two of its own articles; worth a
  same-metric re-check once a source states a flight count that doesn't
  conflict with its own prior reporting.
- 2026-09-16-J: A Vantor blog post (candidates queue entry, "Vantor, UK
  Ministry of Defence and Industry Partners Establish Defence
  Intelligence Innovation Cluster - Project FAIRFAX") carried a dateline
  of "Sep. 17, 2026," one day ahead of the actual fetch time -- left
  undrafted not because of the date anomaly itself but because the
  underlying event (the RAF Wyton collaboration hub) had already opened
  Aug 27, 2026 and been reported by GOV.UK/DPRTE weeks earlier, and
  Vantor's own post added no financial figure or new scope beyond
  naming itself a founding partner (per the standing thin/predates-
  window pattern). Worth a second look only if a future release states a
  contract value tied to the hub.
- 2026-09-16-K: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 0
  updated, 0 held") plus a direct read of all three new items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields and the
  `corroboration_collapses` log entry (MDA CHORUS: mda.space vs. PR
  Newswire correctly collapsed as a wire rewrite) as the build-health
  signal.

## Narrow re-check, ~5h gap, unfiltered full source list (2026-09-16, third)

- 2026-09-16-L: Google News queue entries for a Sept 16 SpaceNews piece
  ("Space Force gives SpaceX latitude on design of $2.3 billion satellite
  network") and an Aviation Week piece ("L3Harris Builds Xoople
  Earth-Observation Satellites For 2028 Launch") both resolved by
  guessing the SpaceNews slug pattern directly (worked, partial paywalled
  content still gave headline/byline/date/facts) versus Aviation Week,
  which stayed fully paywalled (login-wall redirect) with no other
  fetchable page confirming the "2028" launch date claimed only in the
  Google News title; left the Xoople lead undrafted per "never state a
  fact not in a fetched source" rather than trust an unverified headline.
  Worth trying the direct-slug-guess trick on other spacenews.com Google
  News redirects before giving up on them.
- 2026-09-16-M: An important debris incident (Yaogan-50 (02) breaking
  into 43 tracked fragments in a rare 141-142 degree retrograde orbit)
  predated the window by 12 days (event/report date Sept 4) and never
  surfaced in the harvested queue at all; only a discovery-pass query on
  "satellite debris reentry incident collision" found it. Chased per the
  predates-window rule: found the actual SpaceNews piece (Andrew Jones)
  via a WebSearch for the exact headline after an aggregator (space4peace)
  credited it as the original source, plus Jonathan McDowell's original
  X post fetched verbatim via the syndication endpoint (whitelist
  observer floor, since he first reported the catalog numbers). The
  aggregator copy collapsed automatically as a wire-rewrite of the
  SpaceNews piece at finalize, confirming the collapse logic also catches
  informal aggregator rewrites of trade-press originals, not just
  wire-service copies.
- 2026-09-16-N: Three same-company-plus-category dedup false positives
  fired in one draft: an Avio-CEO commentary item (companies
  ["Avio","SpaceX"], category "launch") matched THREE unrelated existing
  SpaceX-adjacent launch items (a Vandenberg Starlink batch, USSF-153,
  and even the unrelated ESA Vega-C/Sentinel-3C launch, apparently via
  the "launch" category alone once any company overlap exists), and a
  Space Force/SpaceX procurement-approach item matched an unrelated UK
  MoD Starshield-spending item on shared company + category alone. Three
  `dedup_distinct` entries (at the item's top level, per the 2026-09-15-G
  lesson) cleared both. Commentary items and pure-approach/regulatory
  items sharing a company with several unrelated hard-news items in the
  same category is looking like a recurring shape for this false
  positive, not just same-day partnership overlaps.
- 2026-09-16-O: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 7 new, 0
  updated, 0 held") plus a direct read of all seven new items'
  `snr`/`category`/`impact`/`kind`/`tags`/`companies`/`sources` fields,
  the `registry-candidates.json` queue entry for Impulse Space's
  `funding_latest`, and the `corroboration_collapses` log entry
  (Yaogan-50 breakup: space4peace.org vs. SpaceNews correctly collapsed
  as a wire rewrite) as the build-health signal.

## Narrow re-check, ~4h13m gap, unfiltered full source list (2026-09-16, fourth)

- 2026-09-16-P: `finalize-sweep.ts`'s whitelist anti-spoof match
  (`matchWhitelistChannel`) is a strict path-prefix match against the
  signals.json channel URL (e.g. `youtube.com/@scottmanley`); a specific
  video's `youtube.com/watch?v=...` URL never prefixes under the channel
  URL, so no YouTube video candidate can ever pass as `class: "whitelist"`
  no matter how clearly it came from that channel's own feed. Classed the
  Scott Manley China-rocket-designs commentary source `informal` instead
  (per the standing 2026-09-16-B precedent for the same shape of gap): the
  fact and attribution still publish honestly, just without the tier-4
  observer floor. Worth a dev fix (match the channel's recorded RSS
  `channel_id` against the video's own channel, not the watch URL path)
  but not something a sweep draft can work around otherwise.
- 2026-09-16-Q: A same-company-plus-category dedup false positive fired on
  a new NASA Roman Space Telescope instrument-activation item against the
  unrelated Sept 10 ESA EnVision Venus/NASA-radar-instrument item (shared
  company NASA, category `science`, within 7 days). One `dedup_distinct`
  entry at the item's top level cleared it; same recurring shape as the
  2026-09-16-N SpaceX/launch cases, now confirmed for `science` too.
- 2026-09-16-R: A Google News "Starlink Mobile Lands in Panama" item
  (BASENOR, a low-quality SEO mirror) traced back via WebSearch to a
  +Móvil/Panama D2D announcement from Move On 2026 in May 2026, not a new
  September event; the service itself was stated to begin "at the end of
  this year," a process-not-yet-fact exclusion on top of being stale.
  Left undrafted. A same-queue Mashable "Starlink partners for rural phone
  service" item and a Fierce Network "SpaceX sees mostly friendly skies
  from rural carriers" item both read as generic Starlink-D2D roundups
  tied to the same World Space Business Week panel discussions, not a
  single new dateable event; also left undrafted.
- 2026-09-16-S: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 0
  updated, 0 held") plus a direct read of both new items' `snr`/
  `snr_trace`/`category`/`impact`/`kind`/`companies` fields as the
  build-health signal.

## Narrow re-check, ~7h24m gap, unfiltered full source list (2026-09-17)

- 2026-09-17-A: Refines the standing 2026-09-01-G finding on
  `corroboration_2plus`: a `trade`-class lead with exactly ONE
  `trade`-class corroboration source DID trigger the +1 modifier this run
  (China in Space lead + Guangming Online corroboration on the GuoWang
  25th-group item, "2 distinct sources (>=2)"), while the same-run
  Kuaizhou-11/SpaceTY item (aggregator lead + one `informal`-class
  corroboration) got NO modifier at all despite also having 2 total
  sources. The distinguishing factor looks like the corroboration
  source's own class, not the raw source count: a same-or-higher-tier
  additional source earns the bump with just one attach, but a single
  weaker (`informal`) addition doesn't. Worth confirming on a future
  mixed-class case before treating this as settled.
- 2026-09-17-B: Two Chinese state-media outlets that write independent
  prose around the same Xinhua wire fact (china-in-space.com's own
  technical writeup vs. Guangming Online's bare wire rewrite) still count
  as 2 distinct sources for corroboration purposes; finalize-sweep's
  title-collapse logic did not merge them, unlike ifeng.com's and
  fx168news.com's near-identical verbatim Xinhua quote (same brief,
  correctly treated as one source, only one attached here).
- 2026-09-17-C: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 0
  updated, 0 held") plus a direct read of both new items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields, the
  `registry-candidates.json` flag_refresh entries for `guowang`, and the
  three automatic persistence bumps logged in the sweep entry as the
  build-health signal.

## Narrow re-check, ~6h38m gap, unfiltered full source list (2026-09-17, second)

- 2026-09-17-D: The anti-spoof `first_party` host check (2026-09-16-B) runs
  against ALL registry entity types, not just organizations: Vantor's own
  blog (vantor.com) passed as `first_party` because a `vantor.json`
  CONSTELLATION profile exists with that domain, even though no Vantor
  ORGANIZATION profile does. EnduroSat and Kymeta have no registry entity
  at all (no organization, constellation, vehicle, or spaceport profile),
  so their own-domain press pages were rejected and reclassified
  `informal` per the standing precedent. Worth checking all four registry
  subdirectories (not just organizations/) before assuming a company's own
  domain will fail the gate.
- 2026-09-17-E: Two same-day EnduroSat announcements (a $205M funding round
  and Vantor's Pulse constellation contract) are genuinely distinct events
  but share the company and land in adjacent categories; the same-event
  gate matched the Pulse item against the OLDER, unrelated
  `2026-09-10-trustpoint-endurosat-gnss-constellation` contract (shared
  company EnduroSat, category `contract`, within 7 days) rather than
  against the same-sweep funding item. `dedup_distinct` needs to name the
  actual existing item the gate flags, not just whichever other new draft
  item seems like the obvious collision; when in doubt, add entries for
  every plausible match.
- 2026-09-17-F: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 5 new, 0
  updated, 0 held") plus a direct read of all five new items'
  `snr`/`category`/`impact`/`sources` fields as the build-health signal.

## Narrow re-check, ~4h20m gap, unfiltered full source list (2026-09-17, third)

- 2026-09-17-G: A near-total-junk queue (32 candidates, almost entirely
  SpaceX stock/Starship-delay financial-press churn and Futurism off-topic
  content) still yielded two genuinely new items via the discovery pass's
  own confirmation follow-through: a same-day Breaking Defense/DefenseScoop
  briefing naming the Space Force's Ground Moving Target Indicator program
  "Resilient Radar System-Ground (RRS-G)" with Northrop Grumman confirmed
  as prime (no dollar figure disclosed), and a same-day GlobeNewswire/TV
  Technology United Airlines/DISH live-football-on-Starlink rollout. Both
  were genuinely undrafted (grepped items.json for "RRS-G"/"GMTI"/
  "Northrop" and "United"/"Dish" first).
- 2026-09-17-H: A Google News "Nuri rocket launch...South Korea's first
  microsatellite constellation" headline (TechRadar, dated in-window) traced
  via WebSearch to a launch actually scheduled for Oct. 7, not yet flown;
  left undrafted per the standing don't-draft-a-scheduled-launch rule. A
  same-day CZ-12 Wenchang commercial-pad launch (confirmed via PhilSA's own
  debris-advisory) had no named payload or confirmed outcome in any source
  found; left undrafted as too thin per rule 2 rather than assume success.
  Confirms the standing pattern that a scheduled/outcome-unconfirmed launch
  stays out even when the launch itself is real and dateable.
  Caixin Global (English edition of a mainstream Chinese financial daily)
  had no prior classification precedent in this file; treated as
  `mainstream` (same tier as SCMP), used as the sole fetchable lead for a
  Space Epoch reusable-rocket funding round after SpaceNews's own writeup
  429'd on every attempt (two tries) -- landed an honest single-source SNR 2
  (`crawl: "found_none"`) per the standing rule that a WebSearch-confirmed-
  to-exist-but-unfetchable page is never citable, even when other
  independent coverage (SpaceNews, china-in-space.com) clearly exists.
- 2026-09-17-I: Two signals-pass leads were recognized as already-published
  same-day rehashes before drafting: Andrew Parsonson's Sept. 16 Avio-CEO
  "customers turned away by SpaceX" bluesky post is the same earnings-call
  quote already published as `2026-09-10-avio-ceo-spacex-capacity-
  commentary`, and his Sept. 17 grid-fins/MR10-reignition post is just more
  technical detail on the already-published `2026-09-10-avio-fd1-
  integration-complete` (itself a suborbital demonstrator, per the standing
  2026-09-11-I exclusion for the vehicle's eventual flight, not the
  integration-milestone item). Both grepped against items.json before any
  drafting time was spent.
- 2026-09-17-J: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 2
  updated, 0 held") plus a direct read of all three new items' and both
  updated items' `snr`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~6h24m gap, unfiltered full source list (2026-09-18)

- 2026-09-18-A: A "reported, not yet officially announced" story (SpaceX
  President Shotwell's on-record All-In Podcast comments declining to commit
  to Crew Dragon flying past 2030, plus Ars Technica's multi-source
  reporting that NASA plans to order two more Starliner missions "as early
  as next week") could not be fetched from Ars Technica directly
  (arstechnica.com is outright unfetchable via WebFetch in this
  environment, "Claude Code is unable to fetch from arstechnica.com",
  distinct from a 403/paywall). Traced the exact Ars URL via a secondary
  aggregator (Aroged) that credited and linked it, then used two
  independently-worded aggregator pieces (Aroged, UFO Feed) as the
  informal-class lead and corroboration since neither is a verbatim copy of
  the other. Landed an honest SNR 2 rather than hold for weak sourcing; the
  NASA-order half of the story was written as reported/attributed, not
  asserted as fact, since neither NASA nor Boeing had confirmed it.
- 2026-09-18-B: `docs.fcc.gov/public/attachments/<DA-number>A1.txt` (not
  just `.pdf`) fetches as real, readable text via WebFetch for FCC public
  notices -- confirmed on a fresh case (a Sept 17 international Section 214
  grant to SpaceX/Starlink Mobile, DA 26-998): the `.pdf` URL itself
  returned undecodable binary, but swapping the extension to `.txt` on the
  same attachment path returned clean prose including the exact grant
  language, docket numbers, and release date. Cited the `.pdf` as the
  canonical `source_url` (the real document) while using the `.txt` fetch
  to extract the verbatim text. Worth trying this extension swap by default
  for any future docs.fcc.gov attachment that returns binary.
- 2026-09-18-C: Guessed FCC DA-number URLs from a generic web search
  (DA-26-421A1, DA-26-471A1) resolved to completely unrelated orders (a
  routine three-company Section 214 notice from April; an EchoStar/SpaceX
  spectrum-assignment order from May) before the correct one (DA-26-998)
  was found via a secondary source's own citation -- a plausible-looking
  FCC docket number from search is not evidence it is the right order; only
  a source that actually names or links the specific DA number, or the
  fetched document's own content naming the right party/date, confirms it.
- 2026-09-18-D: A government-official on-the-record capability disclosure
  with no stated commercial-space consequence (Air Force Secretary Meink
  confirming the US has orbiting space-control weapons, an Aviation Week
  Sept 18 piece) was left undrafted per the standing institutional-
  disclosure exclusion (NASA-STRIDE/ASI-board/Singapore-JAXA precedent): no
  contract, operator, or market-access fact is stated, only a general
  capability acknowledgment.
- 2026-09-18-E: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 2
  updated, 0 held") plus a direct read of all three new items' and both
  updated items' `snr`/`snr_trace`/`category`/`impact`/`sources` fields as
  the build-health signal.

## Narrow re-check, ~5h10m gap, unfiltered full source list (2026-09-18, second)

- 2026-09-18-F: A "NASA gives SpaceX almost $1B for 3 Crew missions" wave
  (Breakingthenews.net, TradingView, Pluang, CoinGape, 24/7 Wall St, Yahoo
  Finance, all via Google News) turned out to have TWO plausible NASA.gov
  targets with the same generic search phrasing: `nasa.gov/humans-in-space/
  nasa-awards-spacex-more-crew-flights-to-space-station/` is a stale Aug
  31, 2022 page (Crew-10 through 14, $1.436B), while the genuinely fresh
  Sept 18, 2026 announcement (Crew-15/16/17, $946M, CCtCap total now
  $5.92B) lives at the differently-slugged `nasa.gov/missions/station/
  commercial-crew/nasa-awards-spacex-three-crew-flights-to-space-station/`.
  A generic WebSearch for the headline surfaced the stale URL first; only
  searching the specific dollar figure ($946 million) surfaced the correct
  page. Confirmed fresh via Marcia Smith's same-day bluesky post citing the
  identical $946M/through-2030 figures. Worth remembering: when a NASA
  contract-modification headline could plausibly be a resurfacing (SpaceX
  Crew Dragon awards recur every 1-2 years with similar headlines), search
  the stated dollar figure, not just the headline shape, before concluding
  either way.
- 2026-09-18-G: Two standing same-company-plus-category dedup false
  positives fired on the new NASA/SpaceX CCtCap item (against the
  unrelated Starfall/Space Cargo and KDDI/Starlink Mobile V2 items, both
  sharing only company SpaceX + category contract) and one on the new
  NIGCOMSAT/Hughes ground-gateway item (against the NigComSat-2A/Thales
  Alenia satellite-manufacturing award, sharing only company NIGCOMSAT +
  category contract) -- three `dedup_distinct` entries at each item's top
  level cleared all of it in one pass, extending the long-running list.
- 2026-09-18-H: `ir.echostar.com`'s press-release detail pages timed out
  twice (60s) even though EchoStar's registry `website` (`echostar.com`)
  would have passed the Hughes/NIGCOMSAT gateway release as `first_party`
  via subdomain match; fell back to the GlobeNewswire wire copy
  (`wire_pr`, tier 4) instead, per the standing pattern of registry-eligible
  first-party pages that simply don't load. `idirect.net`'s own press
  page for the ST Engineering/Datacom deal loaded fine but has no registry
  organization entity to match against, so it capped at `informal`
  (extends the no-registry-host workaround to a third distinct company);
  the wire-service PR Newswire copy of the same release led at `wire_pr`
  instead and finalize-sweep's title-collapse correctly merged the two as
  one `wire_rewrite` corroboration unit.
- 2026-09-18-I: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 2
  updated, 0 held") plus a direct read of all three new items' and both
  updated items' `snr`/`snr_trace`/`category`/`impact`/`sources` fields,
  and the `corroboration_collapses`/`snr_movements` entries logged in
  `state.json`, as the build-health signal.

## Narrow re-check, ~3h46m gap, unfiltered full source list (2026-09-18, third)

- 2026-09-18-J: Almost the entire "Google News: launch" leg this run (25+
  of ~32 candidates) was repeat financial-press churn on the already-
  published `2026-09-18-nasa-spacex-three-crew-flights-946m` item (stock-
  price reaction pieces, analyst-target rehashes, "$10T Starship revenue"
  Cathie Wood takes) plus two off-topic Futurism politics pieces the
  "Google News: launch" feed occasionally pulls in; none needed more than
  a title/source check against `existing[]` before discarding. A securities
  class-action law-firm PR wave against AST SpaceMobile (Robbins/Portnoy/
  Pomerantz "shareholder alert" GlobeNewswire/PRNewswire releases) is
  confirmed as the standard boilerplate-lawsuit-solicitation pattern, not a
  substantive legal/regulatory development; treated as out of scope
  entirely, same as the routine merger-objection disclosure lawsuits in the
  Rocket Lab/Iridium 8-K below.
- 2026-09-18-K: An Iridium 8-K (Item 8.01, filed same day) turned out to be
  a supplemental-disclosure response to standard "disclosure deficiency"
  merger-objection lawsuits over the Rocket Lab acquisition (three NY state
  suits plus demand letters, company says claims are "without merit"),
  bundled with routine EBITDA/net-debt/share-count supplemental figures.
  This is boilerplate M&A-litigation procedure, not new deal news; left
  undrafted. Worth remembering this pattern shows up as an 8-K Item 8.01
  on nearly every large public-company merger and is essentially never
  itself newsworthy.
- 2026-09-18-L: A same-day Aviation Week story ("L3Harris Builds Xoople
  Earth-Observation Satellites For 2028 Launch," published Sept 16, byline
  Robert Wall) reported L3Harris has started building the first satellites
  of a 14-craft constellation for AI-data startup Xoople, a program
  announced back in April 2026 that the site never covered (predates this
  Vesperio instance or was missed at launch). Confirmed via three separate
  WebSearch passes (exact headline, actor+distinguishing-noun variant, and
  named-executives variant) that only Aviation Week has this specific
  "construction has begun" fact; every other hit was the April partnership-
  announcement coverage (SpaceNews, L3Harris's own editorial, TechCrunch on
  Xoople's $130M Series B) reporting a different claim, so `crawl:
  "found_none"` was correct despite the topic itself being well-covered
  elsewhere. Landed SNR 2 (trade base 3, minus 1 for found_none).
- 2026-09-18-M: A Marcia Smith/SpacePolicyOnline bluesky post ("Albania
  will become the 73th Artemis Accord signatory on Monday, Sept 21, at NASA
  HQ") posted after this run's `lastSweep` cutoff was left undrafted as a
  scheduled-not-yet-occurred event, consistent with the standing don't-
  draft-scheduled-launches precedent extended to diplomatic signing
  ceremonies; draft it once NASA's own release confirms the signing
  actually happened (the Turkey 71st-signatory item was drafted after the
  fact, same pattern).
- 2026-09-18-N: Confirmed the `public.api.bsky.app/xrpc/app.bsky.
  feed.getAuthorFeed?actor=<handle>&limit=N` endpoint is a reliable way to
  get a fetchable signals bluesky channel's recent posts with real
  timestamps and full text; plain `bsky.app/profile/<handle>` profile pages
  render as an empty JS shell via WebFetch (handle-only, no post content),
  consistent with the general Bluesky JS-shell limitation noted for other
  sites. Worth using the API endpoint by default for every bluesky signals
  channel going forward instead of the profile URL.
- 2026-09-18-O: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 0
  updated, 0 held") plus a direct read of the new item's `snr`/
  `snr_trace`/`category`/`impact`/`sources` fields as the build-health
  signal.

## Narrow re-check, ~8h gap, unfiltered full source list (2026-09-19)

- 2026-09-19-A: An ISRO-first-party press release
  (`isro.gov.in/Successful_Hot_Test_of_CE20_Cryogenic.html`, published
  Sept 10) for an already-published Sept 9 CE20 hot test item surfaced
  through a Google News redirect a full sweep late; confirmed via
  WebSearch (the redirect itself was an empty JS shell) that it was the
  same test, not a new one, then used `rescore` (not just `attach`) to
  promote the lead from mainstream (The Hans India, tier 3) to
  first-party (tier 5): `rescore.sources[0].url` had to equal the
  item's patched `source_url`, and the patch had to land before the
  rescore in the same update entry. Worth remembering that a stale
  first-party press release for a known event is still worth chasing
  down and merging as a `rescore`, not just an `attach`, since `attach`
  alone doesn't change which source the base tier is computed from.
- 2026-09-19-B: A near-total-junk 24-candidate queue (scheduled-launch
  previews, SpaceX stock-reaction churn, several already-published
  stories resurfacing via Google News) plus a 10-query discovery pass
  still yielded one genuinely new item: Valor Equity Partners'
  Form-4-disclosed $8.5B in-kind SpaceX stock distribution to its LPs
  (official_record lead, SNR 5). It hit the standing same-company
  (SpaceX) + same-category (financial) dedup false-positive shape
  against `2026-09-10-spacex-ai-compute-deal-1-1b-monthly`; one
  `dedup_distinct` entry cleared it, extending the running list of that
  false-positive pattern to a same-financial-category collision (prior
  instances were cross-category via shared company/category pairs, not
  strictly within the same category).
- 2026-09-19-C: A South Korea Mirae Asset/SpaceX-private-offering story
  (Google News, UPI) turned out to be an ongoing regulatory probe
  running since June 2026 with no new concrete outcome (fine, finding,
  ruling) in this window, just an escalation in investigative intensity
  reported piecemeal across several Korean outlets on different days;
  left undrafted as process-not-yet-fact rather than try to pin a single
  new dateable fact to it. A NASASpaceflight China-roundup item on
  Tianwen-3 entering "prototype development phase" traced via WebSearch
  to a Sept 3 Global Times original (predates window by 16 days,
  routine-tier program milestone, not a first) and was left undrafted
  rather than invoked under the predates-window chase-it exception,
  which is reserved for notable/seismic events.
- 2026-09-19-D: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 1
  new, 1 updated, 0 held") plus a direct read of the new item's and the
  updated item's `snr`/`snr_trace`/`category`/`impact`/`sources` fields
  and the three automatic persistence-bump `snr_movements` entries
  logged in `state.json` as the build-health signal.

## Narrow re-check, ~3h37m gap, unfiltered full source list (2026-09-19, second)

- 2026-09-19-E: The Google News "launch" leg was almost entirely SpaceX
  stock-reaction/analyst-rating churn (Nasdaq-100 rebalance weighting,
  "stock has gone nowhere" pieces, buy-rating roundups) plus an
  unrelated Trump "AI Force" politics story and a scheduled-launch
  preview (Starship IFT-14's already-published Sept 28 slip); none
  needed more than a title check against `existing[]` or the
  don't-draft-scheduled-launches precedent.
- 2026-09-19-F: A Global Times article on the same day's Kuaizhou-11
  Tianyi-51/52 launch (already published, Launch Library/Xinhua lead)
  turned out to carry substantive detail the original sources didn't:
  a 55-degree medium-inclination orbit designed for daily InSAR revisit
  (vs. the days-long cycle of sun-synchronous InSAR birds) and a "world's
  first commercial medium-inclination InSAR satellites" claim. Confirmed
  the technical/orbit facts via the non-state trade outlet China in
  Space (china-in-space.com) before drafting, and kept the "world's
  first" superlative labeled "per Global Times, unverified" per the
  state-media performance-claim rule rather than stating it as fact;
  used `rescore`-free `attach` since the lead source and base tier
  didn't change, only impact (noise -> notable) on the strength of the
  now-attested daily-revisit capability. Worth remembering: a same-day
  state-media follow-up on an already-published Chinese launch is worth
  a second look even when the original wire brief gave no payload
  detail, since Global Times/Xinhua sometimes carry the actual technical
  substance a day or two after the bare launch-confirmation wire.
- 2026-09-19-G: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 0 new,
  1 updated, 0 held") plus a direct read of the updated item's
  `headline`/`explainer`/`impact`/`sources`/`snr`/`snr_trace` fields as
  the build-health signal. No `snr_movements` were logged this run (the
  update added corroboration sources but didn't change the base tier or
  trigger a persistence/reinforcement bump).

## Narrow re-check, ~8h07m gap, unfiltered full source list (2026-09-20)

- 2026-09-20-A: Drafted a SpaceNews-sourced Simera Sense/IDOM
  MultiScape350 optics-partnership item from a same-day queue candidate
  without first grepping `items.json` for the company names; it was
  already published under an identical id from earlier the same day.
  finalize-sweep's dedup gate caught it on the first submit ("id already
  exists... duplicate"), but the wasted drafting pass (scoring block,
  crossfeed, corroboration search) would have been avoided by the
  standing grep-before-drafting practice (2026-08-22-E and many peers) —
  worth remembering that practice applies even to queue-surfaced
  candidates the harvester flags as fresh, not just signals/discovery
  finds.
- 2026-09-20-B: A Chinese Launch Library entry ("Kinetica 1 | 9
  satellites", generic "details TBD" raw_excerpt) is not evidence of
  which specific mission it is: an initial WebSearch for the exact
  payload count and vehicle name surfaced a superficially matching but
  stale Dec. 10, 2025 Kinetica-1 flight with the identical "9 satellites"
  framing. Only a Chinese-language search for the specific date ("力箭一号
  9月20日") resolved it to the correct, distinct Sept. 20, 2026 Yao-18
  flight (carrying Supercomputing-1, an AI-computing EO demo satellite).
  Extends the standing 2026-08-25-C "generic rideshare excerpt is not
  proof of payload identity" pattern to Launch Library's own generic
  mission titles, not just harvester excerpts; a same-shaped title with a
  matching satellite count from a different year is a stale-resurfacing
  trap even when it comes from the authoritative launch-tracking
  aggregator itself.
- 2026-09-20-C: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new,
  0 updated, 0 held") plus a direct read of both new items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~6h22m gap, unfiltered full source list (2026-09-20, second)

- 2026-09-20-D: A near-total-junk queue (33 candidates: SpaceX stock/IPO
  speculation, off-topic CGTN/BBC science filler) had its only two
  real China-launch stories (Lijian-1 Yao-18, PIESAT-2) and the Rocket
  Lab/Synspective launch already published by the prior same-day sweep;
  the sole genuinely new item, a routine 27-satellite Starlink batch on
  booster B1093's 17th flight, came from a discovery-pass search after
  the queue's own Google News entries for it (a keeptrack.space X-report
  aggregator, a Space.com headline) didn't resolve to fetchable content
  directly.
- 2026-09-20-E: An NPR piece on Starbase Louisiana ("Thousands of planned
  launches, terms of deal, worry some") genuinely cleared the
  standing "trend/reaction piece adds nothing" bar (2026-08-27-A and
  peers) other Louisiana follow-ups have failed: it carried three facts
  the original Aug 25 item never stated (SpaceX's own ~30-rockets-a-day
  cadence claim, the "Project Osprey" NDA codename from records-request
  documents, and outdoor educator Gabe Giffin's on-record migratory-bird
  concern) verified via a syndicated NPR-affiliate mirror after npr.org
  itself timed out twice. Folded in via `updates[].attach`+patch with no
  bump requested (item already at the SNR 5 ceiling).
- 2026-09-20-F: A same-day RFE/RL piece on the Rassvet constellation,
  fetched directly rather than assumed to be another rehash of the
  well-trodden ISW/altitude-failure story (2026-09-07-H and peers this
  item has attracted), turned out to carry genuinely new facts: reported
  Ukrainian strikes on ground infrastructure the program depends on
  (the Dubna satellite comms center, the Progress Rocket and Space
  Center that builds Bureau 1440's Soyuz launch vehicles, a drone threat
  to Plesetsk) and revised satellite-count targets. Treated as
  `updates[].patch`+attach, framed as an industrial-capacity risk to the
  deployment timeline rather than conflict analysis, consistent with the
  2026-08-16-A Progress/Samara precedent; explicitly did not characterize
  the war itself. No bump requested: base tier 3 (whitelist observer)
  plus `corroboration_2plus` already sits at this non-first-party lead's
  ceiling of 4, confirming the 2026-09-02-A silent-no-op pattern once
  more on a 7th total source.
- 2026-09-20-G: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new,
  2 updated, 0 held") plus a `jq empty` parse check across all six
  touched data files (703 items, up from 702) and a direct read of the
  new item's and both updated items' `snr`/`snr_trace`/`category`/
  `impact`/`sources` fields as the build-health signal.

## Narrow re-check, ~5h24m gap, unfiltered full source list (2026-09-20, third)

- 2026-09-20-H: Both leads the signals pass surfaced this run (Vivienne
  Machi's Aviation Week author page listing the Sept 18 GHOST-R
  Northrop Grumman/True Anomaly GEO-recon prototype award, and Andrew
  Parsonson's bluesky post on ESA's Sept 18 IRIS2 Low-LEO consolidation
  contracts) were fully drafted, sourced, and scored before a
  `grep -i` company/program-name check against `items.json` revealed
  both already published under existing ids
  (`2026-09-18-northrop-grumman-true-anomaly-ghost-r`,
  `2026-09-17-esa-iris2-low-leo-consolidation-contracts`) from an
  earlier same-day sweep. No time was lost past the drafting stage
  since the grep ran before `sweep-draft.json` was written, but it
  confirms 2026-09-20-A's lesson from earlier the same day: run the
  items.json grep on signals/discovery leads BEFORE building the
  scoring block and crossfeed attestation, not just before writing the
  final draft, especially on a day with several same-day sweeps already
  ahead of you.
- 2026-09-20-I: A fully quiet run start to finish: the harvested queue
  (30 candidates post-filter) was entirely SpaceX stock/valuation churn,
  Google News redirects to already-published stories, and off-topic
  Futurism filler; all six mandatory HTML sources and 15 of 17 signals
  channels were current with nothing new in window; a 9-query discovery
  pass covering the full matrix (launch, financial, incident, regulatory,
  China, India) surfaced only already-published stories (Impulse Space
  Series D extension, Safran/Dhruva SBS-III, Stoke Space Series E/Nova
  Block 2) or process-not-yet-fact exclusions (the FCC's draft
  12.7-13.25/42-42.5 GHz satellite-spectrum order, scheduled for a Sept
  30 vote, not yet decided). Zero new items, zero updates, zero held;
  confirms a genuinely quiet day rather than an under-worked one, per
  the standing "quiet is not the same as nothing to check" discipline
  (2026-08-24-C and peers) followed to its honest zero-item conclusion.
  Note: the merged sweep-entry summary text in `state.json` has a typo
  ("an 8-8h discovery pass" should read "a 9-query discovery pass");
  harmless but worth proofreading the summary string before it lands in
  a future draft, since `state.json` is machine-owned and not
  hand-editable after merge.

## Narrow re-check, ~3h45m gap, unfiltered full source list (2026-09-20, fourth)

- 2026-09-20-J: A "Space-Eyes confirms $638m SPAC merger with McKinley"
  discovery-pass lead traced (via a follow-up WebSearch on what Space-Eyes
  actually does) to a counter-drone/geospatial-AI company: its C-UAS
  platform fuses RF, EO/IR and satellite inputs for detection, but it is
  not an EO/SAR operator, launch provider, or connectivity constellation
  itself. Left out of scope entirely rather than drafted as a financial
  SPAC event, distinct from the standing Quantum Space/other space-SPAC
  precedents that ARE in scope because the underlying company builds
  space hardware. Worth remembering: a SPAC merger headline mentioning
  "satellite" or "geospatial" needs the same what-does-this-company-
  actually-do check as any other borderline actor before drafting.
- 2026-09-20-K: `europeanspaceflight.substack.com/feed` 403'd on a direct
  WebFetch this run (first observed failure for this channel); fell back
  on Andrew Parsonson's bluesky and site coverage from the same run
  instead of treating the person as unchecked. Worth a re-try next sweep
  before assuming the substack feed itself, not just this one fetch, is
  now blocked.
- 2026-09-20-L: A fully quiet run start to finish: the harvested queue (9
  candidates post-filter) was entirely FAA/NOAA fishery-council notices,
  SpaceX stock-advice churn, and off-topic Futurism content, or stories
  already published earlier the same day (StarBurst, United/DISH,
  Starship Flight 14 orbit coverage); all six mandatory HTML sources, 14
  of 17 signals channels (rotation skipped Anatoly Zak's bluesky and
  Andrew Parsonson's site), and an 8-query discovery pass covering the
  full matrix (launch, financial, incident, China, India, EO contracts,
  regulatory, M&A) surfaced only already-published leads or the
  Space-Eyes scope exclusion above. Zero new items, zero updates, zero
  held; `bun run build` not attempted per the 2026-09-09 CLAUDE.md
  procedure update, relying on `finalize-sweep.ts`'s own merge
  confirmation ("merged 0 new, 0 updated, 0 held") as the build-health
  signal.

## Deep sweep (mode "deep", triggered after two zero-add sweeps), ~8h07m gap, 7-day window, unfiltered full source list (2026-09-21)

- 2026-09-21-A: A Payload "DIU and SSC Announce Joint GHOST-R Mission" queue
  hit and a Planet Pulse "Next Chapter in Germany" satellite-manufacturing
  post both read as fresh discovery-pass-shaped finds but were caught
  before drafting: GHOST-R was already the Sept 18 Northrop
  Grumman/True Anomaly item (grep on "ghost-r"), and the Planet post
  restated the exact investment figure ("expected to exceed 8 figures"),
  headcount ("~150 to ~220 by 2027"), and Martin Polak quote from a
  September 2025 Berlin-facility announcement (SatNews/Via
  Satellite/European Spaceflight, dated a year earlier) with only the
  publish date changed to today -- left undrafted as a stale company-blog
  recap, not a fresh opening milestone, since nothing in the fetched text
  stated a new fact beyond the year-old plan.
- 2026-09-21-B: Extends 2026-09-20-A/H's "grep before building the
  scoring block" lesson to a case where the grep target isn't obvious
  from the headline: a Payload/SpaceQ/Kepler-press-release story
  ("Maverick Books 10 Kepler Sats...") read as a clean, undrafted
  three-way launch-integrator deal, but grepping "Maverick" against
  `items.json` (not just checking for a `maverick`-slugged id) found the
  identical fact already folded into the existing Aug 20 Portal Space
  Systems item's `why_it_matters` as background context, added by an
  earlier same-topic sweep. An id-based grep alone would have missed
  this; grep the actor's plain name across the full item body too.
- 2026-09-21-C: In deep mode, a genuinely new fact can still hide behind
  a wall of already-published queue hits: of roughly a dozen promising-
  looking EO/connectivity/launch candidates checked this run (Open
  Cosmos funding, Planet German federal contract, Viasat/Space42
  Equatys JV, Hydrosat Osiris, SEOPS/Isar five-launch deal, ESA
  EOGS/ARISE study contracts, IRIS2 Low-LEO consolidation, NigComSat/
  Hughes gateway, ST Engineering/Datacom, Lynred/constellr, Kymeta rail
  certification, Impulse Space Series D, Kuva Space poppy detection,
  State Dept Space Catalyst Partnership), every single one was already
  published under an existing id. Only two candidates that required an
  open-web discovery chase (not sitting in the queue at all) were
  genuinely new: Hanwha Systems' Korea K-SSA debris-tracking contract
  and SpaceX's Starmind FCC re-entry/collision-risk filing. Worth
  expecting this ratio (queue mostly re-presentation, real finds from
  chasing thin discovery leads) as the deep-mode norm, not a sign the
  queue check was wasted effort.
- 2026-09-21-D: A Satellogic/IDT/ONR "Slingshot III" SpaceNews headline
  that resurfaces every few days (first flagged 2026-09-14-D as a
  self-referential PR restating a March release) still adds no new fact
  on a fourth appearance: the Sept 20-21 SpaceNews/Stocktwits wave
  restates the identical six-satellite/18-month/2027-2028 figures word
  for word. Confirmed via direct search rather than re-guessing; worth
  treating this specific headline shape as a standing dead lead like the
  Aviation Week NRO/SAR case (2026-08-24-H) unless a source states a new
  satellite count or dollar figure.
- 2026-09-21-E: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new,
  0 updated, 0 held") plus a direct read of both new items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~8h gap, unfiltered full source list (2026-09-21, second)

- 2026-09-21-F: The dedup gate's shared-company + shared-category heuristic
  produced two false positives on genuinely distinct events, extending the
  standing pattern (2026-09-19-B and peers): an Exolaunch/SpaceX Starfall
  payload-integrator deal (category `launch`) matched against a same-day
  routine Starlink Vandenberg launch purely on shared company `SpaceX`, and
  an ESA Investor Forum financing item (category `financial`) matched
  against the unrelated Sept 8 ESA Space Environment Report purely on
  shared company `ESA`. Both cleared with a `dedup_distinct` entry citing
  the actual distinguishing facts (different mission/topic entirely, not
  just a different date).
- 2026-09-21-G: `updates[].note` must sit at the top level of the update
  object, sibling to `patch`/`attach`, not nested inside `patch` alongside
  the patched fields; nesting it under `patch` produced a hard rejection
  ("updates[N].note: required non-empty string") on an otherwise-valid
  draft with three updates. The worked example in prompts/update-items.md
  already shows it top-level; worth re-reading the schema shape literally
  rather than by pattern-matching the newItems `crossfeed.note` shape.
- 2026-09-21-H: A CGTN state-media follow-up gave genuinely new payload
  detail (mass, 5G NTN payload, laser link, on-orbit computing) for a
  satellite the already-published item had only named ("the Pengcheng-
  branded debut satellite") without specs, on the same already-published
  Sept 20 Lijian-1/Yao-18 launch -- a same-launch variant of the 2026-09-19-F
  "same-day state-media follow-up carries the technical substance" pattern,
  this time for a *named-but-undetailed* payload rather than a wholly
  unmentioned one.
- 2026-09-21-I: A Google News redirect URL for a marketscreener.com
  headline ("Airbus Defence and Space Hires SSC Space...") failed to
  resolve via WebFetch (returned only a bare "Google News" placeholder,
  no redirect target) on two separate attempts; recovered by searching the
  actor's own newsroom (`sscspace.com/news/`) directly, which listed the
  same-day first-party release with a working link. Worth trying the named
  company's own newsroom before spending further attempts on a
  non-resolving Google News redirect.
- 2026-09-21-J: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 4 new, 3
  updated, 0 held") plus a direct read of all four new items' and all
  three updated items' `snr`/`snr_trace`/`category`/`impact`/`sources`
  fields, and the state.json `corroboration_collapses` entry (SSC's own
  release vs. Satellite Evolution's near-identical republish, correctly
  auto-collapsed as `wire_rewrite`), as the build-health signal.

## Narrow re-check, ~3h45m gap, unfiltered full source list (2026-09-21, third)

- 2026-09-21-K: The Albania Artemis Accords signing (73rd signatory,
  scheduled 12pm ET Sept 21 at NASA HQ) was still only "invites media"
  pre-event framing in every source checked over an hour after the
  scheduled time, including a same-day Albanian outlet (exit.al, future
  tense "will become"); left undrafted per the standing 2026-09-18-M
  scheduled-not-yet-confirmed precedent (mirrors the Turkey 71st-signatory
  case, drafted only once NASA's own post-ceremony release existed). Worth
  a same-day re-check once NASA/State publish a past-tense confirmation.
- 2026-09-21-L: A same-company (Telesat) + same-category (partnership)
  dedup false positive fired on a new Kongsberg Canada/MDA Space/Telesat
  defence-ISR MOU+LOI (Sept 21) against the unrelated Sept 15 Telesat/
  SatPort ground-infrastructure MSA, extending the standing pattern once
  more; one `dedup_distinct` entry cleared it.
  Separately, a same-day PCMag-sourced Google News item ("Viasat Readies
  Faster Service, Despite SpaceX's Protest of Its F2 Satellite") would not
  resolve via the Google News redirect (bare placeholder, both attempts),
  but the underlying fact — Viasat-3 F2 actually entered commercial
  service Sept 17, reassigned from its originally planned EMEA coverage to
  the Americas, while SpaceX's Aug 31 FCC block petition is still pending
  — was independently confirmable via two aviation trade outlets (PaxEx.
  Aero, Runway Girl Network) neither of which mentioned the FCC dispute at
  all; folded into the existing Aug 31 item as an `updates[].patch`+attach
  rather than held for the unfetchable lead, since the fact itself was
  fully corroborated by sources that were fetched.
- 2026-09-21-M: The mandatory HTML source pass surfaced BlackSky's own
  Sept 9 "$1B Altair-Next Gen AI constellation" and Sept 14 "fifth Gen-3
  first light" press releases and ICEYE's own Sept 17 ARISE-consortium and
  Sept 7 Sompo Japan releases; all four grepped straight to already-
  published items (the Altair/BlackSky story alone had 14 matching
  mentions across items.json). Worth the reminder that a mandatory-pass
  "new-looking" press release still needs the same items.json grep as any
  discovery or queue lead before drafting time is spent (extends
  2026-09-20-A/H to the HTML-source leg specifically).
- 2026-09-21-N: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 1
  updated, 0 held") plus a direct read of the new item's and the updated
  item's `snr`/`snr_trace`/`category`/`impact`/`sources` fields (710
  items, up from 709) as the build-health signal.

## Narrow re-check, ~5h04m gap, unfiltered full source list (2026-09-21, fourth)

- 2026-09-21-O: A same-day federal court ruling on the standing Starbase
  land-swap lawsuit (2026-06-10-starbase-land-swap-lawsuit) surfaced as
  four independent Google News hits (NYT, Bloomberg Law News,
  BorderReport, MyRGV) but every one of the four redirect URLs resolved
  to a bare "Google News" placeholder via WebFetch, the same failure
  mode as 2026-09-21-I; only MyRGV's actual publisher URL was recoverable,
  via a plain (non-domain-restricted) WebSearch for the exact queue
  headline text rather than the redirect itself. Worth trying an
  unrestricted WebSearch for the verbatim queue title before giving up
  on a story whose Google News redirect won't resolve; it surfaced the
  real URL and enough synthesized page content (court, ruling, date) to
  draft an honest, appropriately thin update even though the direct
  WebFetch on that URL also 403'd.
- 2026-09-21-P: The anti-spoof gate rejects `first_party` for a company's
  own domain when that company has no `src/data/registry/organizations/`
  profile (`isOfficialHost` only matches `.gov`, the fixed official list,
  or a registry-recorded website): Katalyst Space Technologies' own
  katalystspace.com news post and Network Innovations' own blog post
  both had to be classed `informal` rather than `first_party` for this
  reason, even though both were verbatim company statements about
  themselves. Led with the trade-press pickup (Via Satellite) and the
  wire release (PR Newswire) instead, both of which score fine unaided.
  Worth remembering for any unprofiled company's own announcement: check
  for a registry entry before attesting `first_party`, or expect a
  rejection and reclassify to `informal`/`wire_pr`/`trade` instead.
- 2026-09-21-Q: An Intellian/Network Innovations WGS flyaway terminal
  partnership surfaced via a same-day Via Satellite queue entry actually
  traced (via WebSearch) to a September 15-16 announcement, six days
  before the queue picked it up; drafted dated on the actual announcement
  date per the standing predates-window chase-it precedent (2026-08-18
  Vikram-1 and peers), not on the queue's discovery date.
- 2026-09-21-R: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new,
  1 updated, 0 held") plus a direct read of both new items' and the
  updated item's `snr`/`snr_trace`/`category`/`impact`/`sources` fields
  (712 items, up from 710) as the build-health signal.

## Narrow re-check, ~6h47m gap, unfiltered full source list (2026-09-22)

- 2026-09-22-A: A same-underlying-round headline can show two different
  dollar figures for a genuinely non-stale reason: "HEO Space raises
  $37m" (Startup Daily/Capital Brief) and "HEO raises $25M" (Axios/
  Dealroom/Tech Startups) are the SAME Sept. 21 Series B, just quoted in
  AUD vs. USD (confirmed by Startup Daily's own body text stating
  "US$25 million (A$37 million)" once fetched directly) -- distinct from
  the yen/dollar conversion-snapshot trap (2026-09-04-N) in that here
  both figures came from the same day's coverage, not different publish
  dates. Worth checking for a stated FX conversion before treating two
  differing dollar figures on the same story as a stale-resurfacing or
  wrong-round trap.
- 2026-09-22-B: Confirms 2026-09-17-A's refinement a second time: a lead
  source and its sole corroboration source at the EQUAL tier (both
  `informal`, HEO's Startup Daily lead + Tech Startups corroboration)
  triggered `corroboration_2plus` (+1) with just one attach, consistent
  with "same-or-higher-tier corroboration earns the bump, a weaker
  addition doesn't" rather than raw source count.
- 2026-09-22-C: The Starbase land-swap item's Sept. 21 injunction-denial
  fact (added same-day by the prior sweep per MyRGV) needed a same-day
  follow-up patch once the Texas Tribune's own fuller Sept. 21 article
  became fetchable: the original MyRGV-sourced text named no judge and
  no legal basis; the Tribune's direct-fetched follow-up supplied the
  judge's name (Fernando Rodriguez Jr.), the standing/irreparable-harm
  ruling basis, the debris-allegation rejection, and the Sept. 1
  agreement / Sept. 22 title-transfer dates -- a genuine enrichment
  patch, not corroboration of an already-complete fact.
- 2026-09-22-D: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new,
  1 updated, 0 held") plus a direct read of both new items' and the
  updated item's `snr`/`snr_trace`/`category`/`impact`/`sources` fields
  as the build-health signal.

## Narrow re-check, ~6h40m gap, unfiltered full source list (2026-09-22, second)

- 2026-09-22-E: A Planet Labs IR press release ("Planet Opens
  State-of-the-Art Satellite Manufacturing in Berlin", Sept. 22, first
  seen via the mandatory HTML pass since raw_excerpt was empty) is a
  distinct dateable event from the Sept. 17 "opening this fall" plan
  announcement already published as `2026-09-17-planet-berlin-satellite-
  factory`: the actual handover/ribbon-cutting, with Germany's economy
  minister Katherina Reiche attending, plus facility size (5,700 sqm),
  satellite specs, 60-sat/year capacity, and the Isar Aerospace launch
  plan. Folded in as `updates[].patch`+attach within the 7-day dedup
  window rather than a new item, consistent with the standing
  plan-vs-actual-event enrichment pattern (the 2026-09-22-C Starbase
  ruling case and peers).
- 2026-09-22-F: Confirms `loadRegistryHosts`' apex-domain reduction
  (finalize-sweep.ts) treats `investors.planet.com` as the same actor as
  the registry's `www.planet.com` website field (the "www." prefix is
  stripped before matching, per the code comment), so a company's IR
  subdomain classes cleanly as `first_party` without a registry edit.
  Worth checking this reduction before assuming an unprofiled-looking
  subdomain (investors., newsroom., ir.) needs `informal` per the
  2026-09-21-P precedent, which applies to companies with NO registry
  profile at all, not to subdomains of an already-profiled company's
  registered site.
- 2026-09-22-G: `draft.signalsPass.checked` must list the exact
  whitelisted channel URL from `signals-context.ts`'s `fetchable[]`
  array (e.g. `https://europeanspaceflight.substack.com`), never the
  underlying `rss` fetch URL (`.../feed`) even when that's the URL
  actually requested; finalize-sweep rejected the draft on the first
  submit for listing the feed URL. List the channel URL and note the
  feed 403 in the pass's `note` field instead.
- 2026-09-22-H: A fully quiet run otherwise: of ~65 harvested candidates
  (mostly SpaceX stock/valuation churn, Google News redirects to
  same-day-earlier-sweep stories -- the Starbase land-swap ruling
  picked up by 8+ more outlets, the SSC/Pleiades Neo deal restated by
  defence-industry.eu, ISRO-ESA cooperation picked up by 4 Indian
  outlets -- and off-topic BBC/CGTN/FAA-NOAA fishery filler), all 5
  mandatory HTML sources, all 17 signals channels, and an 8-query
  discovery pass covering the full matrix surfaced nothing new beyond
  the Planet Berlin item above. `bun run build` was not attempted, per
  the 2026-09-09 CLAUDE.md procedure update; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 0 new, 1
  updated, 0 held") plus a direct read of the updated item's fields as
  the build-health signal.

## Narrow re-check, ~5h07m gap, unfiltered full source list (2026-09-22, third)

- 2026-09-22-I: All the loudest queue/discovery leads this run were already
  fully covered same-day or earlier: a Newser "Judge OKs Land Swap" hit added
  nothing beyond the existing Starbase land-swap item's Sept. 21/22 patch; a
  fresh ThePrint/satnews/Space Daily wave on "ESA and ISRO extend to 2032"
  restated the identical Paris-signing, Jan. 8 2032 date, and scope details
  already in the Sept. 10 item; and Payload's own "HEO Raises $25M Series B"
  and the TRL11/Firefly Mars-mission $13M-aeroshell background were each
  already published. Confirms the standing grep-before-drafting discipline
  (2026-09-20-A/H/I, 2026-09-21-B/M) generalizes past headline-name matches to
  full-body company/program mentions.
- 2026-09-22-J: The FCC's Sept. 30 vote on waiving NEPA review for satellite
  ops (Payload) is a second, independent not-yet-decided draft order sharing
  the same Sept. 30 Open Meeting date as the already-excluded 12.7-13.25/
  42-42.5 GHz spectrum order (2026-09-20-I); left undrafted for the same
  reason (a draft order on a meeting agenda is not adopted commission
  action). Worth checking both items' outcomes together after Sept. 30.
- 2026-09-22-K: An EarthDaily first-party blog post ("EarthDaily Secures
  Marigold Renewals With Two Global Mining Majors") named no customers but
  did state a concrete, quotable figure ("each six figure contracts") --
  drafted as a thin but honest noise item rather than held or discarded,
  since the source itself (not a paraphrase) supplied the only figure used
  and EarthDaily's constellation registry profile satisfies the first-party
  anti-spoof host check even without an `organizations/` profile.
- 2026-09-22-L: The dedup gate's shared-company + shared-category heuristic
  fired twice on one new item: a TRL11/NASA SR-1 Freedom imaging subcontract
  (category `science`) matched against both the unrelated Sept. 16 Roman
  Space Telescope WFI activation and the unrelated Sept. 17 SpaceX/StarBurst
  launch task order, purely on shared company "NASA" plus shared category,
  extending the standing pattern (2026-09-19-B, 2026-09-21-F and peers) to a
  two-way simultaneous false-positive on the same draft item. Two
  `dedup_distinct` entries cleared both.
- 2026-09-22-M: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 4 new, 0 updated, 0
  held") plus a direct read of all four new items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the build-health
  signal.

## Narrow re-check, ~4h14m gap, unfiltered full source list (2026-09-22, fourth)

- 2026-09-22-N: Two same-day near-duplicates were caught only by grepping
  `items.json` before drafting, not by title recognition: a Google-News
  "ESA awards contracts for Europe's EOGS blueprint" candidate and a Via
  Satellite "Boeing Taps Lite Coms..." mandatory-pass headline both read as
  fresh, but the real trap was the mandatory Telesat HTML pass's "Orange and
  Telesat inaugurate Europe's first Telesat Lightspeed Gateway in France"
  release (Sept 17), which was already published verbatim under
  `2026-09-17-orange-telesat-lightspeed-gateway-france` -- and the
  Andrew Parsonson signals-pass find "SaxaVord has abandoned plans for a
  shared suborbital launch rail" was already published same-day as
  `2026-09-22-saxavord-launch-rail-scrapped`. Both were fully sourced and
  ready to draft before a plain `grep -o '"id": "2026-09-1[6-9]...'` dump of
  recent ids caught them; extends 2026-09-20-A/H/I/2026-09-21-B/M's
  grep-before-drafting discipline to the mandatory HTML pass and signals
  pass specifically, not just discovery/queue finds.
- 2026-09-22-O: Confirms 2026-09-22-F's apex-domain reduction a second time
  on a different company: `ir.spire.com` (Spire's IR press-release page)
  classed clean as `first_party` against the registry's `https://spire.com`
  website field for a same-day $33.2M NOAA task-order announcement, no
  registry edit needed.
- 2026-09-22-P: The MAGPIE upgrade-path (2026-09-02-H) worked again on a
  live item, this time via `patch.source_url` + `rescore` rather than a bare
  `attach`: Kymeta's Sept 17 TÜV rail-certification item (originally led by
  Kymeta's own no-registry-entity site, capped `informal`, SNR 2) got a
  genuinely better lead five days later when Eutelsat's own Sept 22 release
  confirmed the certified terminal's first live rail trial (named operator,
  route, integration partners) -- Eutelsat's release lives on
  `mynewsdesk.com`, not the registry-recorded `eutelsat.com`, so it still
  classed `wire_pr` (the standing 2026-08-07-L mynewsdesk precedent) rather
  than `first_party`, but wire_pr beats the original informal lead and the
  item moved from SNR 2 to SNR 4 on the rescore.
- 2026-09-22-Q: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 5 new, 1 updated, 0
  held") plus a direct read of all five new items' and the updated item's
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields (723 items, up from
  718) as the build-health signal.

## Narrow re-check, ~6.5h gap, unfiltered full source list (2026-09-23)

- 2026-09-23-A: A near-total-junk queue (SpaceX stock/valuation churn, Trump's
  personal SpaceX stock-trade disclosures under the standing 2026-08-31-J
  passive-disclosure exclusion, Starship Flight 14 pre-launch prep) still
  yielded one genuinely new item via the mandatory signals pass: Anatoly
  Zak's bluesky post on Russia's Okulus radar satellite reaching orbit and
  beginning to supply data to federal agencies, per Roscosmos chief Dmitry
  Bakanov. RussianSpaceWeb's own article was paywalled ("insider content");
  the fact was sourced instead to vz.ru (mainstream) and Ruscable.ru
  (informal, an odd small outlet that nonetheless wrote independently, same
  shape as the standing NordiskPost/it-boltwise.de precedent). Novyy Kosmos
  (the private developer) has no `src/data/registry` entity, so its own
  `newspacecorp.ru` product page capped at `informal` per the standing
  no-registry-host workaround, extending that list to a Russian company for
  the first time; its page still supplied genuinely new, directly-fetched
  technical specs (0.4m resolution, 400km swath, 475km SSO) the news
  coverage didn't state.
- 2026-09-23-B: A SpaceNews trend piece Jeff Foust linked ("Satellite
  industry grapples with the end of Falcon 9," Sept 21) bundles only
  already-published facts (the June rideshare-booking freeze, the Sept 10
  Avio CEO commentary) under a bigger-sounding headline; left undrafted per
  the standing 2026-09-04-T/2026-09-06-H/2026-09-14-D "trend piece bundles
  old facts" pattern. Worth treating this specific headline shape as a
  standing dead lead unless a source states a genuinely new fact (an actual
  Falcon 9 retirement date, a stated production wind-down timeline).
- 2026-09-23-C: A DOJ press release (`justice.gov`, a bare `.gov` host) on
  the already-published Sept 21 Starbase land-swap injunction ruling
  cleanly upgraded the item's lead from mainstream to official_record via
  the documented MAGPIE `rescore` path (patch `source_url` first, then
  `rescore.sources[0].url` must match), moving SNR 4 to 5 and adding DOJ's
  own on-record characterization of the swap as a "win-win" for
  conservation and national security. Aviation Week's Sept 18 "USSF Seeks
  Agile, Docking-Capable Sats For Future Victus Mission" is a request for
  industry proposals (responses due Oct 19, first deliveries targeted
  FY2029), not an award; left undrafted per the standing
  CLPS/NDAA/Resilient-GPS process-not-yet-fact pattern, worth re-checking
  once Space Systems Command actually selects a vendor.

## Narrow re-check, ~6h40m gap, unfiltered full source list (2026-09-23, second)

- 2026-09-23-D: ESA's own program name "Boost!" (with a literal exclamation
  mark) trips the site's no-exclamation-marks rule when used verbatim in
  headline/tagline/what_happened; finalize-sweep rejects on
  "exclamation marks never publish" regardless of the mark being part of a
  proper noun. Wrote around it as "Boost" (no punctuation) in all prose
  fields while leaving the literal `Boost!_` segment untouched in URLs,
  which the gate does not flag.
- 2026-09-23-E: A same-day NASA Isaacman quote (Italy committing over $5
  billion to the Multi-Purpose Habitat lunar module, securing two Italian
  astronauts Moon-surface seats) is genuinely single-sourced: European
  Spaceflight's Sept 23 writeup is the only outlet reporting Isaacman's
  Sept 15 Air, Space & Cyber Conference remarks with that specific dollar
  figure and astronaut count; every other hit (Decode39, KeepTrack's own
  space-brief) is either the stale March Statement-of-Intent story or a
  bare rewrite of European Spaceflight itself, and the AFA's own
  airandspaceforces.com writeup of the same conference didn't mention
  Italy at all. Dated the item on the actual Sept 15 statement date per
  the standing predates-window chase-it precedent rather than Sept 23
  (the reporting date), landed an honest single-source SNR 2
  (`crawl: "found_none"`, trade base 3 minus 1).
- 2026-09-23-F: The dedup gate's shared-company + shared-category
  heuristic fired again (extends 2026-09-19-B/2026-09-21-F/L/2026-09-22-L
  and peers): the new Italy/NASA lunar-habitat item (category
  `human-spaceflight`) matched against the unrelated Sept 17 SpaceX
  Dragon-retirement/Starliner item purely on shared company NASA. One
  `dedup_distinct` entry cleared it.
- 2026-09-23-G: All 13 unique signals-pass people were checked (bluesky
  author-feed API for the bluesky accounts, direct site fetch for the
  rest); everything on-scope found (Aschbacher's ISRO post, Parsonson's
  Italy/SaxaVord/Ariane-6-turbopump posts, Andrew Jones's China roundups,
  Vivienne Machi's Victus RFP piece) traced to already-published items or
  the standing process-not-yet-fact exclusion. The mandatory 5-source
  HTML pass and an 8-query discovery pass covering the full matrix
  (launch, financial, incident, regulatory, China, India, EO contracts,
  M&A) surfaced nothing else new; every substantive hit traced to an
  already-published item. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update (the workflow runs the build
  itself); relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 3 new, 0 updated, 0 held") plus a direct read of all three new
  items' `snr`/`category`/`impact`/`sources` fields as the build-health
  signal.

## Narrow re-check, ~5h gap, unfiltered full source list (2026-09-23, third)

- 2026-09-23-H: A discovery-pass-shaped SpaceNews headline ("Ethereal Space
  Awarded NOAA SBEM Task Order 1," $27.4M covering GNSS-RO + thermospheric +
  multispectral imagery) contradicted NOAA's own NESDIS release ($67,053,698
  split three ways: Spire $33,158,160, PlanetiQ $28,413,038, Ethereal Space
  $5,482,500, GNSS-RO only) for what reads like the same Sept. 18 award.
  Rather than reconcile or repeat both figures, cited only NOAA's official,
  internally-consistent breakdown and omitted the SpaceNews piece entirely
  from sources; the detour was avoidable if the queue's "Ethereal Space
  Awarded NOAA SBEM Task Order 1" headline had been grepped against
  `items.json` (NOAA, radio occultation) before chasing the dollar figure,
  since it turned out to already be a same-week update to
  `2026-09-22-spire-noaa-33m-radio-occultation-task-order`, not a new item.
  When a single-company NOAA task-order headline appears days after a
  same-program multi-company award already published, check whether it is
  actually a fuller breakdown of the same underlying award before treating
  the new company name as an undrafted story.
- 2026-09-23-I: Confirms 2026-09-22-F/O's apex-domain and registry-match
  reduction does not require the item's `companies[]` to include the org:
  Vast's own `vastspace.com/updates/...` post classed clean `first_party`
  against `organizations/vast.json`'s website field for a division
  announcement with zero dollar figure or contract, landing SNR 5 (ceiling
  reached from the lead alone) even at `noise` impact -- SNR and impact are
  fully independent axes, a routine company-strategy post can still hit the
  direct-source ceiling if the company has a matching registry profile.
- 2026-09-23-J: China SatNet's GuoWang launches recur inside the 7-day
  dedup window almost every sweep now (25th group Sept 17, 26th group Sept
  23, six days apart); `dedup_distinct` against the immediately-prior
  numbered group is now the default expectation for this actor, not an
  edge case, per the standing 2026-08-26-D "two launches by the same
  provider inside 7 days are distinct events" rule.
- 2026-09-23-K: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 2
  updated, 0 held") plus a direct read of all three new items' and both
  updated items' `snr`/`snr_trace`/`category`/`impact`/`sources` fields
  (730 items, up from 727) as the build-health signal.

## Narrow re-check, ~4.3h gap, unfiltered full source list (2026-09-23, fourth)

- 2026-09-23-L: `hubblenetwork.com` now 301-redirects to `hubble.com`
  (rebrand); the company's own `hubble.com/news` press release still
  capped `informal` per the standing no-registry-host workaround (no
  `src/data/registry` entity for Hubble Network), but a Business
  Wire-distributed copy of the identical release (StockTitan mirror)
  classed `wire_pr` (tier 4) and led a clean $200M Series C item instead;
  finalize's title-collapse correctly merged the two as one
  `wire_rewrite` unit. `investors.viasat.com`'s press-release detail page
  timed out (60s) even though Viasat's registry `website` would have
  passed it as `first_party` via subdomain match (the standing
  `ir.echostar.com`/2026-09-18-H pattern); fell back to the GlobeNewswire
  wire copy (`wire_pr`) instead, landing SNR 4 on an otherwise-`noise`
  routine USMC task order.
- 2026-09-23-M: The same-company-plus-category dedup false positive fired
  on both new NASA/`science` and SpaceX/`contract` items this run (three
  separate unrelated existing items in total) purely on shared company +
  category + within-7-days, extending the long-running list once more;
  three `dedup_distinct` entries cleared it in one pass.
- 2026-09-23-N: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 4 new, 0
  updated, 0 held") plus a `jq` parse check (734 items, up from 730) and
  a direct read of all four new items' `snr`/`snr_trace`/`category`/
  `impact`/`sources` fields as the build-health signal.

## Narrow re-check, ~7h17m gap, unfiltered full source list (2026-09-24)

- 2026-09-24-A: A Jamestown Foundation trend piece on Russia's Rassvet
  program ("Russia Trying to Replace Starlink") mostly bundled
  already-published satellite-failure statistics (32 satellites, 800km
  orbit misses) per the standing trend-piece-bundles-old-facts pattern,
  but buried inside it was a genuinely new, never-covered discrete fact:
  Ukraine's Foreign Ministry formally petitioned the ITU on Aug. 28 to
  exclude Ukrainian territory from Rassvet's coverage in all frequency
  bands. Confirmed independently via Militarnyi (trade) and the Kyiv Post
  (mainstream) rather than cited to Jamestown itself. Worth remembering
  a "bundles old facts, skip it" trend piece can still be worth reading
  in full for one buried, dateable sub-fact rather than discarded whole.
  Also confirms Bureau 1440/Rassvet still has no `src/data/registry`
  entity (no crossfeed metric touched by a diplomatic filing anyway).
- 2026-09-24-B: `basenor.com` (already flagged 2026-09-16-R as a
  low-quality SEO mirror) supplied specific-looking but unverifiable
  figures for the Vietjet/Starlink deal (a VND 300 billion Galaxy Pay
  investment, a $500K-per-aircraft hardware estimate) that no other
  fetched source stated; left both figures out of the draft entirely
  rather than risk citing an unverified number from a site with a
  standing unreliability flag. `tradingview.com`'s Reuters mirror pages
  render only the headline behind a hard paywall (no teaser paragraph,
  unlike SpaceNews's lede-before-paywall pattern) -- the headline text
  itself is still a legitimate citable fact when nothing else is
  visible, just a thinner one than a teaser paragraph would give.
- 2026-09-24-C: A "SpaceX alums found a startup" headline is not itself
  evidence of scope: Applied Atomics (small modular nuclear reactors for
  AI data centers, Bywater New Orleans HQ) joins the standing terrestrial-
  diversification exclusion list (Intel Terafab, APR Energy, the Bastrop
  turbine foundry, Ursa Major's SPAC) -- no orbital product, regardless of
  founder pedigree or Louisiana/Starbase-adjacent framing in local coverage.
- 2026-09-24-D: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 2
  updated, 0 held") plus a `jq` parse check (736 items, up from 734) and
  a direct read of both new items' and both updated items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields, and the six
  automatic persistence-bump `snr_movements` entries logged in
  `state.json`, as the build-health signal.

## Narrow re-check, ~5h gap, unfiltered full source list (2026-09-24, second)

- 2026-09-24-E: "Lunar Outpost" (a lunar-rover company, several existing
  items) and "Outpost Technologies" (an unrelated reentry/in-space-
  manufacturing startup, "Space Factories") are two entirely different
  companies that both go by "Outpost" in casual references -- grep by the
  full company name, not the short form, before concluding a same-named
  candidate is already covered.
- 2026-09-24-F: `explainer.tagline`'s 140-char cap is tighter than it
  looks when a headline-worthy fact needs full attribution clauses;
  five of seven drafted items this run needed a tagline trim after
  finalize-sweep rejected an over-length one (each rejection names only
  the FIRST offending item, so a multi-item draft with several
  over-length taglines needs several successive fix-and-rerun passes,
  one per item, not one pass). Worth drafting taglines noticeably under
  140 chars on the first pass rather than at the limit.
- 2026-09-24-G: Google's and Outpost Technologies' own announcements
  both had no `src/data/registry` organization entity to anti-spoof
  against (neither Google/Alphabet nor Outpost Technologies has one),
  capping their own blog/PR-wire posts at `informal`/`wire_pr`; led both
  items instead with a mainstream wire pickup (Reuters via Yahoo
  Finance) and the PR Newswire wire copy respectively, extending the
  standing no-registry-host workaround to two more frequently-recurring
  actor shapes (a Big Tech company entering space, and a reentry/
  manufacturing startup).
- 2026-09-24-H: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 7 new,
  0 updated, 0 held") plus a `jq` parse check (745 items, up from 736)
  and a direct read of all seven new items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~4h25m gap, unfiltered full source list (2026-09-24, third)

- 2026-09-24-I: ESA's "European Resilience from Space-Earth Observation"
  (ERS-EO, a 167M-to-350M-euro funding line per a Sept 24 SatNews/Space
  Intel Report pair) and the already-published Sept 17 EOGS/ARISE item
  ("ESA awards contracts for Europe's EOGS blueprint") are the SAME
  underlying architecture-study contracts (identical ICEYE-led ARISE vs.
  Leonardo-led consortium, both traced to "Element 1 of ESA's European
  Resilience from Space for Earth Observation programme" per the Sept 17
  item's own text) reported under two different framings, ISR-military
  vs. EOGS-civilian-governmental. Today's story is ESA now asking
  governments to raise that same program's funding from 167M to 350M
  euros ahead of a Nov 30 deadline; folded in as `updates[].patch` (a
  same-program funding development) rather than a new item, since
  drafting it standalone risked a same-week duplicate the dedup gate
  might not catch (different category framing, same shape as the
  2026-08-30-N Sutherland/HIE near-miss). Worth treating "ERS-EO" and
  "EOGS" as the same program by default when the named companies and
  contract-award dates line up, not two adjacent EU space initiatives.
- 2026-09-24-J: An Iridium 8-K (Item 5.07, filed same day) reporting the
  special-meeting vote adopting the Rocket Lab merger agreement (~99.6%
  of votes cast, 81.0% of outstanding shares) was a genuine new item, not
  an update, despite being the same M&A story as the June 29 announcement:
  87 days outside the 7-day window, and a shareholder-approval vote is a
  distinct, separately newsworthy closing-condition milestone. Led with
  the SEC EDGAR exhibit (Ex. 99.1, the joint press release) as
  `official_record`; every other hit (GlobeNewswire, PR Newswire,
  StockTitan, Manila Times) was a wire mirror of the identical release,
  correctly left as one `wire_pr` corroboration unit rather than stacked.
  `crossfeed.facts` stayed empty since the deal has not closed (expected
  mid-2027, still subject to regulatory approvals) -- a shareholder vote
  is not itself a registry status/parent_org change.
- 2026-09-24-K: The mandatory signals pass again outperformed the queue on
  a near-total SpaceX-stock/Futurism-junk 36-candidate window: Marcia
  Smith's (SpacePolicyOnline) bluesky post surfaced NASA's Crew-14
  assignment release before any trade outlet's writeup existed, and
  Vivienne Machi's Aviation Week author page surfaced L3Harris's SDA
  Tranche 3 preliminary-design-review milestone, both fully undrafted
  gaps confirmed via grep against `items.json` before scoring. Neither
  needed the whitelist floor (both had usable first-party leads at the
  SNR 5 ceiling already), consistent with the standing pattern that
  whitelisted-channel corroboration is often just a free find-signal, not
  a scoring necessity, when the underlying actor's own site is
  first-party-eligible.
- 2026-09-24-L: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 4 new, 1
  updated, 0 held") plus a `jq` parse check (749 items, up from 745) and a
  direct read of all four new items' and the updated item's
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~7h11m gap, unfiltered full source list (2026-09-25)

- 2026-09-25-A: A near-total-junk queue (SpaceX stock/valuation/Nasdaq-100
  churn, UN-floor Starlink-terminal political theater from Netanyahu and
  an Israeli envoy that stayed excluded as conflict-adjacent stunt
  coverage rather than an operator statement, and Finland's president
  publicly asking Musk to enable Starlink over Russian territory for
  missile-launcher strikes, left out under the standing conflict/
  operational-use exclusion since it is a government plea with no SpaceX
  response on record) still yielded three items, all via the signals
  pass rather than the queue or an 8-query discovery pass (which reached
  only already-published or out-of-window hits): Croatia's and Cote
  d'Ivoire's Artemis Accords signings (74th/75th) surfaced through Jeff
  Foust's and Marcia Smith's bluesky feeds a day before any dedicated
  trade writeup existed, and Isaacman's "dodged a bullet" China-lunar-
  delay remarks at Payload's Off World conference surfaced through
  Andrew Jones's feed. All three were first-party-or-trade led (NASA
  release, SpaceNews) with genuine independent corroboration (Croatia
  Week's own quotes from the ceremony, Behind The Black's independent
  writeup, Payload's own conference coverage), landing SNR 5/5/4.
- 2026-09-25-B: A same-day Google News "Earth observation satellites
  Copernicus Sentinel-3C and Earth Explorer FLEX successfully launched"
  hit and a Townsville Bulletin "Suspected space debris has more earthly
  origins" hit were both stale resurfacings of much older already-
  published stories (the Sept. 15 Vega-C launch and the July Forrest
  Beach spheres identification respectively) rather than new events;
  neither WebFetch nor WebSearch could pin either "republish" to a
  genuine new dateable fact, so both were left undrafted after the
  items.json grep confirmed prior coverage. Worth remembering that an
  aggregator/regional-mirror headline using a definitive-sounding past
  tense ("...successfully launched", "...has more earthly origins") on
  a story already fully resolved weeks earlier is a resurfacing, not new
  reporting, even when its own publish date falls inside the window.
- 2026-09-25-C: `blacksky.com/company/news/` rendered only the page's
  search/filter shell (no dated items in the fetched content) on two
  consecutive WebFetch attempts this run, despite SWEEP_MEMORY entries
  as recent as 2026-09-24 recording clean fetches of the same URL;
  logged no sourceHealth entry at all rather than attesting `verified`/
  `stale` without the required `evidence.excerpt` (finalize-sweep
  rejects a bare success claim for an html source with no evidence) or
  wrongly demoting an otherwise-reliable source to `unverified` off a
  single anomalous render. Worth retrying this source on a future run
  before concluding it needs a fetch_note; this looks like a one-off
  rendering miss, not a source change.
- 2026-09-25-D: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 3 new,
  0 updated, 0 held") plus a `jq` parse check (752 items, up from 749)
  and a direct read of all three new items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~7h gap, unfiltered full source list (2026-09-25, second)

- 2026-09-25-E: `bsky.app/profile/<handle>` renders only the bare handle
  via WebFetch (a JS shell, same class of failure as spacex.com/updates
  and rocketlabcorp.com/updates in the 2026-07-05 seed lessons); the
  public AT Protocol endpoint
  `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=15`
  returns real post text and `createdAt` timestamps and works cleanly
  with WebFetch. Use the API endpoint directly for every bluesky
  signals-pass fetch going forward rather than the profile page.
- 2026-09-25-F: A "SpaceX raises $250M / Astra targets early 2027 for
  Rocket 4.0" thread traced back to at least two different underlying
  dates across mirrors: an August 14 Reuters funding-raise story
  (americanbazaaronline, yournews) and a September 17-18 SpaceNews
  specs/timeline piece (thedebrief.org interview, hype.aero summary),
  with the direct spacenews.com URL returning HTTP 429 on every retry
  this run. Left the whole thread undrafted rather than risk conflating
  two different-dated stories or misdating a stale one; worth a future
  run retrying spacenews.com directly (or finding an alternate primary)
  to pin down which of the two is the actual dateable event and whether
  either is still fresh enough to publish on its real date under the
  stale-but-notable exception.
- 2026-09-25-G: Isaacman's September 25 Payload "doubles down" remarks
  on NASA's international-partnership standard (same Off World Houston
  conference as the already-published Sept 23 "dodged a bullet" item,
  two days apart, overlapping topic cluster) were folded into that
  existing item as an `update` rather than drafted as a new item, to
  avoid a same-conference near-duplicate the dedup gate might not catch
  by headline alone. Worth treating same-conference, adjacent-day
  remarks from the same official as an update-not-new-item case by
  default, even when the specific topic (international partnerships vs.
  China-delay comment) differs from the original item's headline focus.
- 2026-09-25-H: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new,
  1 updated, 0 held") plus a `jq` parse check (754 items, up from 752)
  and a direct read of the two new items' and the updated item's
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~4h47m gap, unfiltered full source list (2026-09-25, third)

- 2026-09-25-I: A VC-portfolio puff piece ("FUSE Grows Its Space Portfolio,"
  Payload) naming a fresh seed round for Pluto Aerospace read as an
  in-scope launch-sector funding round, but Pluto's own description
  ("building the fastest path from lab bench to hypersonic flight,"
  a "reusable sub-orbital rocket") makes it a suborbital hypersonics-
  testing vehicle, not an orbital launch vehicle -- left undrafted per
  the standing CLAUDE.md orbital-only launch-vehicle scope, same logic
  as the 2026-09-11-I Avio FD1 suborbital-demonstrator exclusion. Worth
  the reminder that a space-VC "portfolio" framing doesn't itself confer
  scope; check what the specific funded company's vehicle actually flies.
- 2026-09-25-J: Two same-day "SpaceX benefits from X" trend/analysis
  pieces (Bloomberg's "SpaceX-Focused Pentagon Contracts Leave Rivals
  Feeling Squeezed," Yahoo Finance's "The U.S. Just Confirmed It Has
  Weapons in Space. Here's How SpaceX Is Already Benefiting") both
  bundle only already-disclosed contract figures (the May Golden Dome
  satellite-network award, SB-AMTI/NSSL figures) under a competitive-
  dynamics or institutional-disclosure news peg (Sept. 14 Air Force
  Secretary Meink space-weapons admission, already excluded
  2026-09-18-D) with no new dateable fact stated; left both undrafted
  per the standing trend-piece-bundles-old-facts pattern.
- 2026-09-25-K: A "ClearanceJobs" roundup headline bundling two unrelated
  defense-industry items in one post title ("S23 Holdings Adding 414
  Jobs in Virginia and SpaceX Lands $946M NASA Contract Mod") is a pure
  headline collision, not two related facts: S23 Holdings is a maritime
  ship-repair/fabrication private-equity firm expanding a Newport News
  shipyard, with zero satellite or space connection despite sharing a
  headline with an already-published SpaceX NASA contract mod. Worth a
  reminder to check what an unfamiliar company actually does before
  assuming a shared headline implies a shared story.
- 2026-09-25-L: `blacksky.com/company/news/` again rendered only the
  page's search/filter shell on WebFetch (no dated items), continuing
  2026-09-25-C's anomaly a second consecutive sweep; logged no
  sourceHealth entry again rather than a bare-evidence "verified" claim
  or an unwarranted demotion. Worth flagging as a possibly-recurring
  rendering issue (not a one-off) if it persists into a third sweep.
- 2026-09-25-M: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself);
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 3 new,
  1 updated, 0 held") plus a `jq` parse check (757 items, up from 754)
  and a direct read of all three new items' and the updated item's
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~4h26m gap, unfiltered full source list (2026-09-25, fourth)

- 2026-09-25-N: A search-result headline "poland arrests nine on charges of
  russian ordered sabotage" (Deccan Herald) surfacing alongside genuinely
  fresh Sept. 25 coverage of the Wola Krobowska Starlink-station-fire
  investigation turned out to be an unrelated 2024 case (Tusk's original
  nine-arrest sabotage sweep) with no date in the headline itself to flag
  it as stale; confirmed via a dedicated follow-up search before treating
  it as a new arrest tied to this fire. A same-country, same-topic-shape,
  no-date-in-headline resurfacing is a new wrinkle on the standing
  stale-resurfacing trap family (distinct from the usual identical-headline
  or same-calendar-date cases): worth a distinguishing search whenever a
  Poland/Russia-sabotage headline reads as a fresh escalation.
- 2026-09-25-O: Poland's National Prosecutor's Office spokesman's on-record
  statement (formally classifying the already-published Sept. 24 Starlink
  station fire as sabotage and a terrorism-related crime, with "reasonable
  grounds to suspect the perpetrators acted on the orders of Russian
  special services") was never itself posted as a press release findable
  on pk.gov.pl; every account (TVN24, RMF24, Ukrainska Pravda, and Polish
  outlets found via a Polish-language search) is journalism reporting the
  spokesperson's quote, not a linkable official document, so it classed
  `mainstream` rather than `official_record` despite naming a specific
  named prosecutor spokesperson and an exact criminal classification.
  Folded into the existing item via `updates[].patch`+attach with no bump
  requested (lead unchanged, already at its non-first-party ceiling of 4).
- 2026-09-25-P: A discovery-pass China lead (Ningbo's "Zhiyi Constellation,"
  Zhenyou Weitong, 108-planned-satellite LEO wind-field network) had only
  one search-surfaced source (chinatechnews.com) and it 403'd on every
  direct-fetch attempt (including a Google cache try); left undrafted per
  the standing never-cite-an-unfetched-page rule despite reading like a
  clean gap. Worth a second look if chinatechnews.com becomes fetchable or
  a second outlet picks up the story.
- 2026-09-25-Q: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 1
  updated, 0 held") plus a `jq` parse check (758 items, up from 757) and a
  direct read of the new item's and the updated item's `snr`/`snr_trace`/
  `category`/`impact`/`sources` fields as the build-health signal.

## Narrow re-check, ~7h14m gap, unfiltered full source list (2026-09-26)

- 2026-09-26-A: A regex grep for "Yaogan 50" (space) against items.json
  missed the already-published "Yaogan-50 (02)" items entirely (hyphen,
  not space) and a discovery-pass Yaogan-50 breakup lead nearly drafted as
  a duplicate; finalize-sweep's own dedup gate caught it before merge.
  Worth grepping company/object names with the punctuation variant
  actually used in past headlines (hyphens, slashes) rather than a
  loosely-spaced guess, since jq regex is a literal substring match, not
  fuzzy.
- 2026-09-26-B: Several `bsky.app` public-API signals-pass fetches this
  run (chenryspace, tmfassociates, sciguyspace, andrewjonesspace) returned
  posts from months-old dates (July, June, August) instead of the
  requested last-day window, despite the 2026-09-25-E lesson confirming
  the API endpoint works cleanly; other accounts fetched in the same
  batch (Josef Aschbacher, Jeff Foust, Marcia Smith, Anatoly Zak, Andrew
  Parsonson) returned correctly dated Sept 25-26 posts. Looks like an
  intermittent stale-cache/rate-limit response on a subset of calls in a
  large parallel batch rather than a systemic endpoint problem; worth a
  retry on the affected handles specifically (not the whole batch) if
  budget allows, rather than assuming the endpoint itself regressed.
- 2026-09-26-C: A discovery-pass "SpaceX launches classified USSF-385"
  lead had internally conflicting facts across every source found
  (Spaceflight Now's dated article said Sept 25 liftoff with booster
  B1100; a WebSearch synthesis citing spacex.com/keyt.com/supercluster
  said Sept 26 with booster B1096), and the one page directly fetched for
  confirmation (spaceflightnow.com's dedicated launch page) was itself
  still a pre-launch preview with no completed-launch facts. Left
  undrafted rather than assert a specific date/booster for a launch whose
  actual occurrence I could not confirm via any single fetched page;
  worth remembering that Spaceflight Now runs a persistent per-mission
  URL (`/launch/falcon-9-<mission>/`) that gets updated in place, so a
  same-URL refetch during the pre-launch window still reads as a preview
  even close to or after the scheduled time, distinct from AI-summarized
  search snippets claiming completion.
- 2026-09-26-D: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 1
  updated, 0 held") plus a `jq` parse check (761 items, up from 758) and a
  direct read of all three new items' and the updated item's
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~6h21m gap, unfiltered full source list (2026-09-26, second)

- 2026-09-26-E: `blacksky.com/company/news/` rendered only the page's
  search/filter shell (no dated items) again this run, a fourth
  consecutive sweep of the same anomaly (2026-09-25-C, -L); logged no
  sourceHealth entry rather than a bare-evidence "verified"/"stale" claim.
  Four sweeps running is long enough that this reads like a real site
  change (e.g. the listing now requires a filter selection or client-side
  render finalize-sweep's fetcher can't trigger), not a one-off rendering
  miss; worth a `fetch_note` at the next structural touch if a fifth
  sweep confirms the same empty shell.
- 2026-09-26-F: A near-total-junk 28-candidate queue (SpaceX stock/
  valuation churn, off-topic BBC/Futurism filler, pre-launch Starship/
  USSF-385 coverage) still yielded one genuinely new item straight from
  the queue itself: Russia's defense ministry said it struck Kyiv's
  Cosmonova data center with drones, claiming the facility supported
  Starlink connectivity for the Ukrainian military (per TASS); Ukrainian
  officials confirmed the strike and casualties elsewhere in the capital
  (per Newsweek) but disputed any military impact. This is the second
  Starlink-ground-infrastructure attack claim in three days after Poland's
  Sept. 24 station-fire item -- a `dedup_distinct` against that item
  (same company SpaceX + category geopolitical, different country and
  actor claim) cleared cleanly, and Yahoo's mirror of the Newsweek piece
  correctly auto-collapsed as a `wire_rewrite`, leaving TASS (mainstream
  class per the standing 2026-07-19/2026-08-10/2026-09-01 precedent) as
  the only genuine second source: `corroboration_2plus` landed a clean
  SNR 4 off two mainstream-class sources.
- 2026-09-26-G: A Google-News queue entry naming Poland's "reasonable
  suspicion" of Russian involvement in the Sept. 24 Starlink-station fire
  added no new fact beyond the already-published item's Sept. 25 patch
  (same prosecutor-spokesman quote); left unpatched. Two Bluesky signals
  leads (Anatoly Zak on Roskosmos's ~400-satellite/~60-in-2026 orbital
  grouping claim and on Bureau 1440 "working on new-generation
  satellites") were left undrafted as too thin and too aggregate: the
  400-satellite figure is Roskosmos's whole orbital grouping (GLONASS,
  Sfera, military, etc.), not a Rassvet-specific commercial count, reading
  like the standing institutional-capability-disclosure exclusion rather
  than a discrete Bureau 1440 fact, and RussianSpaceWeb's own "new-
  generation satellites" post was a single captioned image with no
  article text (its fuller detail is paywalled "insider content").
- 2026-09-26-H: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 0
  updated, 0 held") plus a direct read of the new item's `snr`/
  `snr_trace`/`category`/`impact`/`sources` fields and the sweep log's
  `corroboration_collapses` entry (Yahoo News mirror of Newsweek correctly
  collapsed as a wire rewrite) as the build-health signal.

## Narrow re-check, ~7h13m gap, unfiltered full source list (2026-09-26, third)

- 2026-09-26-I: Resolves the 2026-09-26-C same-day conflict (Spaceflight
  Now's pre-launch preview said Sept 25 with booster B1100, a WebSearch
  synthesis said Sept 26 with B1096): a direct Launch Library query for
  "USSF-385" gave an unambiguous `net` of 2026-09-26T14:00:54Z, and
  Spaceflight Now's OWN dedicated post-launch article (a different URL
  than the pre-launch preview, despite carrying a "2026/09/25" path
  segment from when the preview was first published) confirmed the same
  facts as Teslarati's independently-published piece (Sept 26, booster
  B1100, 10th flight and landing) once actually fetched — the earlier
  session's B1096 figure traced to an unfetched WebSearch synthesis, not
  a real source. Lesson: a Spaceflight Now per-mission URL's date-stamped
  path segment reflects when the article was FIRST created (the preview),
  not the actual launch date once updated in place (extends
  2026-09-26-C); query Launch Library's `net` field directly by mission
  name for the authoritative date/booster before trusting either a URL
  slug or an unfetched search-snippet synthesis.
- 2026-09-26-J: The same-company-plus-category dedup heuristic fired
  twice on the USSF-385 item (against the unrelated Sept 19 Starlink
  batch and the unrelated Sept 21 Exolaunch rideshare, both Vandenberg
  SpaceX launches), extending the long-running SpaceX-volume pattern to
  a third distinct Vandenberg mission inside one 7-day dedup window. Two
  `dedup_distinct` entries cleared it.
- 2026-09-26-K: A near-total-junk 26-candidate queue (SpaceX stock
  churn, Starship Flight 14 pre-launch hype, Crew-13's routine
  aircraft travel from Houston to Kennedy for pre-launch review
  mislabeled by several outlets as "lands at Kennedy"/"arrives at
  Kennedy" in a way that reads like a spacecraft landing until checked
  against the existing Crew-13 item, which confirms the mission is
  still pre-launch targeting Oct 1) and a fully clean mandatory 4-source
  HTML pass (BlackSky's news page rendered only its filter shell for a
  5th consecutive sweep, no sourceHealth entry logged again) and 14-of-17
  signals channels plus an 8-query discovery matrix all traced to
  already-published ground. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s
  own merge confirmation ("merged 1 new, 0 updated, 0 held") and a direct
  read of the new item's `snr`/`snr_trace`/`category`/`impact`/`sources`
  fields as the build-health signal.

## Narrow re-check, ~4h12m gap, unfiltered full source list (2026-09-26, fourth)

- 2026-09-26-L: A genuine zero-item sweep: the queue (13 candidates after
  filtering, mostly SpaceX stock/valuation churn and Google News Crew-13
  reaction pieces) carried only two not-yet-flown launches (Starship
  Flight 14/Starlink Group 31-1, net Sept 28 per Launch Library; Falcon
  Heavy/NROL-97, net Oct 2) and Crew-13's routine pre-launch travel to
  KSC (already tracked, still targeting Oct 1) -- nothing draftable. The
  mandatory 4-fetchable-source HTML pass (Planet Labs, ICEYE, EUSPA,
  Telesat), a 13-person signals pass, and an 8-query discovery matrix
  (launch, financial/M&A, incident/regulatory, China, India, EO
  contracts, ESA, D2D) all traced every substantive hit to an
  already-published item. Confirms narrow same-day re-checks can
  legitimately net zero even after full-effort, full-matrix discovery
  (2026-08-28-H and many peers).
- 2026-09-26-M: `blacksky.com/company/news/` rendered only the page's
  search/filter shell (no dated items) for a SIXTH consecutive sweep
  (2026-09-25-C, -L; 2026-09-26-E, -K, and this run's own two separate
  fetch attempts, both empty). This is no longer a one-off rendering
  miss; per the 2026-09-26-E note, six sweeps confirms a real site
  change (the listing likely now requires a filter selection or a
  client-side render the fetcher can't trigger). No sourceHealth entry
  logged again this run either. Flag for Florian: this source needs a
  `fetch_note` at the next structural touch to stop the repeated
  no-evidence retry every sweep.
- 2026-09-26-N: A new stale-resurfacing trap shape: a Sept 15 Via
  Satellite trend piece ("Satellite-Mobile Partnerships for D2D
  Multiply...") surfaced by a discovery-pass D2D query restates Orange's
  MOU with AST SpaceMobile and Satellite Connect Europe (the AST/Vodafone
  D2D joint venture) for Romania demonstrations -- the underlying Orange
  newsroom release traces to March 2, 2026, seven months stale, with the
  actual Romania demo still only planned for "H2 2026" in the original
  release, not a completed event. Left undrafted; worth a same-topic
  re-check once a Romania demo actually occurs.
- 2026-09-26-O: The intermittent stale-Bluesky-cache pattern (2026-09-26-B)
  persisted on a same-run retry with a smaller `limit` parameter: Caleb
  Henry, Tim Farrar, and Eric Berger's feeds still returned posts from
  July 2026, March 2026, and April/May 2025 respectively on a second
  fetch; Andrew Jones's retry improved slightly (from Aug 19-28 stale to
  Sept 23) but still missed the last ~3 days. Retrying with a different
  `limit` value did not fix it; worth trying a fully distinct request
  shape (e.g. a cursor param) or simply accepting these four handles as
  occasionally cache-locked for a whole session rather than retriable
  mid-run.
- 2026-09-26-P: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update (the workflow runs the build itself); relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 0 new, 0
  updated, 0 held") and the unchanged item count (763) as the
  build-health signal.

## Narrow re-check, ~7h34m gap, unfiltered full source list (2026-09-27)

- 2026-09-27-A: `blacksky.com/company/news/` rendered only the page's
  search/filter shell for a SEVENTH consecutive sweep (2026-09-25-C, -L;
  2026-09-26-E, -K, -M and this run); no sourceHealth entry logged again.
  This has now been flagged for Florian in five straight sweep entries
  with no fetch_note added yet; still worth flagging rather than silently
  dropping the mandatory-pass attempt.
- 2026-09-27-B: Two thin queue leads confirmed below the inclusion bar on
  direct check: Gwynne Shotwell's SEC Form 144 notice to sell ~$52M in
  SpaceX (SPCX, now publicly traded) stock is a routine pre-arranged
  10b5-1-style trading-plan filing, not a company financial event
  (funding round, M&A, bankruptcy, 8-K) -- same shape as the standing
  Harvard-13F-passive-disclosure exclusion (2026-08-31-J), just from the
  insider's side rather than a shareholder's. Silver Touch Technologies'
  ISRO Space Applications Centre purchase order (workstations, delivery
  by Feb 2027) has no stated dollar figure and is a routine IT-hardware
  supply contract to a government client, not itself a space-industry
  capability, contract, or market event; left undrafted rather than
  published at a floor SNR, since CLAUDE.md's inclusion bar still
  requires the fact to matter to an operator/reseller/investor, which a
  vague-value hardware PO to SAC does not clear regardless of honest
  low-confidence sourcing.
- 2026-09-27-C: A fully clean zero-item sweep otherwise: a 12-candidate
  post-filter queue (SpaceX stock/executive-equity churn, an Iran/Israeli-
  envoy Starlink-video virality story left out as conflict-adjacent
  political content with no operator statement, a personal SpaceX-moon-
  trip essay, routine Crew-13/USSF-385 follow-up), a 4-of-5 mandatory
  HTML pass, a 14-of-17-channel signals pass plus 4 targeted X searches,
  and an 8-query discovery matrix covering the full scope (launch,
  financial, incident, China, India, Japan, EO contracts, FCC) all traced
  to already-published ground. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s
  own merge confirmation ("merged 0 new, 0 updated, 0 held") and the
  unchanged item count (763) as the build-health signal.

## Deep sweep (auto-escalated, mode: deep), ~7h08m gap, unfiltered full source list (2026-09-27, second)

- 2026-09-27-D: The harvester auto-escalated to a 7-day deep sweep (427
  post-collapse candidates, 73 syndicated titles pre-collapsed) after
  consecutive quiet narrow re-checks. Almost the entire queue was
  re-presented Starship Flight 14 pre-launch hype (not yet flown, still
  targeting Sept 28), SpaceX stock/executive-equity churn, and
  already-published ground; a keyword-filtered pass (funding/contract/
  regulatory/incident terms) cut the non-Federal-Register queue from 385
  entries to a manageable review set and is worth reusing on future deep
  sweeps rather than reading the full queue serially.
- 2026-09-27-E: Three separate discovery-pass leads that read as clean
  gaps (a WebSearch synthesis for "17,000 satellites... orbital
  collisions" ESA debris report; "ESA awards study contracts for
  dual-use Earth observation system" plus the ICEYE ARISE press
  release; "Planet's Next Chapter in Germany" Berlin factory post) were
  each already published under headlines that did not share obvious
  keywords with the search terms that surfaced them (`2026-09-14-esa-
  space-environment-report-2026`, `2026-09-17-esa-eogs-arise-leonardo-
  study-contracts`, `2026-09-17-planet-berlin-satellite-factory`), and a
  targeted `jq` grep against items.json for terms like "space
  environment", "dual-use", and "germany" missed all three. Only
  finalize-sweep's own dedup gate caught the duplicates before merge.
  Lesson: for a discovery-pass lead that reads like an ESA/first-party
  announcement or a Planet/ICEYE blog post, search items.json by
  company name and rough date window (not just topic keywords) before
  spending further research budget drafting it; the existing items had
  materially more detail (e.g. the EOGS item's own €167M-to-€350M
  funding figures, sourced from SatNews, Space Intel Report AND
  Leonardo's own press release, which this session never found) than a
  fresh draft would have carried.
- 2026-09-27-F: A prior session had already resolved the ESA EOGS/ICEYE-
  ARISE vs. "€350M European military ISR constellation" framing
  confusion this session spent significant effort on (satnews.com and
  Space Intel Report describe the same Sept. 17 ICEYE/Leonardo
  architecture-study contracts using military-ISR language, while
  ESA's and ICEYE's own releases frame it as the dual-use EOGS
  program): Leonardo's own press release (findable via WebSearch,
  `leonardo.com/en/press-release-detail/.../leonardo-selected-to-help-
  shape-europe-s-future-sovereign-earth-observation-capability`) is the
  piece that ties the two framings together as one event. Worth
  remembering for any future ESA/EU sovereign-program story that reads
  ambiguous between a "civil/dual-use" framing and a "military ISR"
  framing: check whether the losing/other named contractor (here,
  Leonardo, the second consortium lead) has its own release before
  concluding the two framings are separate events.
- 2026-09-27-G: Three genuinely new items cleared: China's S-AIDC
  Supercomputing-1 onboard-AI EO satellite (RunTimeWire as lead since
  Data Center Dynamics 403'd and Tom's Hardware's page wouldn't render
  via WebFetch; a Thai tech-blog translation independently confirmed
  the same facts for corroboration), Sanyark Space's $2M Indian NAV-COM
  pre-seed (Dealroom lead, a regional business outlet for
  corroboration), and EU commissioner Kubilius's Ariane 6 capacity
  remarks at the Sept. 23 Access to Space Conference (SatNews as lead
  since SpaceNews itself was paywalled beyond the headline/date/author
  metadata WebFetch could still confirm). All landed SNR 4 off a trade
  lead plus one corroboration source.
- 2026-09-27-H: Several arstechnica.com and realclearscience.com URLs
  failed outright via WebFetch this run (arstechnica.com: "unable to
  fetch"; realclearscience.com: HTTP 403), consistent with prior notes
  that these sites block the fetcher; a Yahoo News mirror that surfaced
  in the same search for the ESA debris report turned out to be a
  stale 2024 article recycled under a similar headline (a new
  same-topic-no-date-in-snippet trap distinct from the Poland/Russia
  case in 2026-09-25-N) and was correctly not used after a direct
  fetch caught the wrong year. A WordPress reblog site
  (nuclear-news.net) that credited and rehosted the original Ars
  Technica piece fetched cleanly and was usable for corroboration
  credit once the standalone ESA item turned out to already exist.
- 2026-09-27-I: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 3 new, 0 updated, 0 held") and the item count
  moving from 763 to 766 as the build-health signal.

## Narrow re-check, ~4h29m gap, unfiltered full source list (2026-09-27, third)

- 2026-09-27-J: A near-total-junk 31-candidate queue (SpaceX stock/IPO
  churn, Starship Flight 14 pre-launch viewing guides, off-topic
  BBC/Futurism filler) still yielded one genuinely new item: Kremlin
  spokesman Peskov warned that letting Ukraine use Starlink for deep
  strikes into Russia would be "dangerous," responding to Finland's
  Stubb reiterating his Starlink-access push to Musk. The dedup gate's
  same-company-plus-category heuristic fired against both prior
  Starlink-conflict items (Poland's station-fire sabotage, the Cosmonova
  Kyiv strike) despite this being a distinct diplomatic-statement event;
  two `dedup_distinct` entries cleared it. Anadolu Agency (aNews) and The
  Moscow Times, both independently reporting the same Peskov quote via
  Russian TV (Vesti/Zarubin), landed a clean SNR 4 as two mainstream
  sources; found no kremlin.ru transcript to upgrade further.
- 2026-09-27-K: The queue's "SpaceX just got the green light Starship
  has waited years for" (Teslarati) confirmed the FAA had granted
  Starship Flight 14's launch license (late Sept. 26), closing out the
  standing item's own "awaiting its FAA launch license" open point from
  its last update. Patched as an update rather than a new item despite
  being 26 days after the item's creation date, since it's a direct
  continuation of a story the item had already been receiving updates
  on; bumped impact from notable to major given the stated regulatory
  grant unlocking Starship's first orbital, revenue-generating flight
  (the stated-value/first-of-kind test, not the eventual launch outcome
  itself, which will be its own event next sweep).
- 2026-09-27-L: Two discovery-pass leads that read as clean gaps (Google's
  "Suncatcher" orbital-AI-chip project picking SpaceX as launch provider;
  Dhruva Space/Safran's SBS-III contract) were both already published
  under headlines with no shared keywords with the search terms that
  surfaced them (`2026-09-24-google-project-suncatcher-orbital-test`,
  `2026-09-10-safran-dhruva-space-sbs3-contract`) -- caught by an id/
  headline grep against sweep-context's `existing[]` before drafting,
  extending the 2026-09-27-E company-name-search lesson.
- 2026-09-27-M: `blacksky.com/company/news/` rendered only the page's
  search/filter shell for an EIGHTH consecutive sweep; no sourceHealth
  entry logged again. A thin general-commentary lead (Elon Musk's CGTN
  interview on US-China orbital-collision coordination and rocket
  reusability) was left undrafted: no new dateable action, matching the
  standing thin-trend-piece exclusion pattern even though Musk is a
  first-party voice for SpaceX. `bun run build` was not attempted, per
  the 2026-09-09 CLAUDE.md procedure update; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 1
  updated, 0 held") and the item count moving from 766 to 767 as the
  build-health signal.

## Narrow re-check, ~4h01m gap, unfiltered full source list (2026-09-27, fifth)

- 2026-09-27-N: A near-total-junk 23-candidate queue (Starship Flight 14
  pre-launch hype, SpaceX stock/valuation churn, off-topic Futurism
  filler) plus an already-published Kremlin/Peskov Starlink item and a
  too-thin, repetitive Budanov Starlink/Starshield access request (no new
  dateable action beyond the standing Ukraine-access-ask thread) yielded
  zero drafts. `fetch-list.ts` returned zero due HTML sources this pass
  (all 39 currently `stale`/`dead`/`fetch_note`). A discovery matrix of 10
  queries (launch, financial, incident/debris, China, FCC, EO contracts,
  India, ESA, Japan, M&A) traced every hit to already-published items
  (Stoke Space Series E, HEO Series B, Hubble Network Series C,
  Exploration Company ALADDIN, EOGS ICEYE/Leonardo, IRIS2 study
  contracts, NOAA GNSS-RO task orders, EnduroSat/Vantor, Yaogan-50
  breakup) or not-yet-occurred scheduled events (the FCC's Sept. 30
  12/42 GHz spectrum vote, Starship Flight 14 itself).
- 2026-09-27-O: Re-broke a mistake this same session made and then
  self-corrected before the memory write: fetched the 8 fetchable
  Bluesky signals channels via their plain `bsky.app/profile/<handle>`
  URLs first (which render only the bare handle, no posts, per the
  standing lesson since 2026-09-06-Q/2026-09-10-K/2026-09-12-J/
  2026-09-18-N/2026-09-25-E) instead of
  `public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=N`,
  and merged a first zero-item draft with a signalsPass note that
  described the blank-page symptom as if it were the outcome. Caught
  before moving on, re-fetched all 8 via the correct API endpoint, and
  merged a second corrective draft in the same run with an accurate
  note; the substantive result was unchanged (nothing past lastSweep on
  any account, Josef Aschbacher/Marco Langbroek/Anatoly Zak/
  SpacePolicyOnline all confirmed via real post data with timestamps,
  Caleb Henry/Tim Farrar/Eric Berger/Andrew Jones stuck on the standing
  stale-cache pattern), but the lesson is procedural: this specific
  wrong-URL mistake recurs across sessions despite five prior memory
  entries naming it; worth checking this exact note before starting the
  signals pass rather than defaulting to the profile URL out of habit.
- 2026-09-27-P: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 0 new, 0 updated, 0 held" twice) and the
  unchanged item count (767) as the build-health signal.

## Deep sweep (auto-escalated, mode: deep), ~7h31m gap, unfiltered full source list (2026-09-28)

- 2026-09-28-A: A second consecutive deep-sweep escalation (after two
  zero-add narrow re-checks closed out 2026-09-27) re-presented a
  476-candidate queue that was almost entirely Starship Flight 14
  pre-launch hype and SpaceX stock/executive-equity churn, plus dozens of
  `previously_presented`-unflagged Via Satellite/ESA/European Spaceflight
  items that grepped straight to already-published ids (Redwire's own
  NITE-STAR $980M post turned out to just restate its existing membership
  in the already-published 15-firm IDIQ awardee list; Space Applications'
  LUVMI-M Blue Origin post was a byte-for-byte source-URL match to an
  already-published item). Confirms the standing grep-before-drafting
  discipline is necessary even when `previously_presented` reads false,
  since that flag tracks queue re-presentation, not publish status.
- 2026-09-28-B: Two genuinely new items surfaced from the discovery pass
  after the queue/signals/HTML legs all traced to already-published or
  thin ground: USA 32 (NORAD 19460), a retired 1988 NRO signals-
  intelligence satellite, broke apart Sept. 13 at 775 km per a Space-Track
  notice quoted by KeepTrack.space; chased 15 days past the sweep window
  per the standing predates-window rule since CLAUDE.md's incident
  category covers satellite losses/anomalies regardless of how old the
  hardware is. Space-Track's own bulletin sits behind account
  authentication (no public space-track.org page to link), so the lead
  had to be KeepTrack.space's notice page (classed `informal`, not
  `computed`, since SNR_SPEC names only CelesTrak/Space-Track for that
  tier) rather than an `official_record`/`computed` citation of the
  quote's original source. Landed SNR 3 off 3 informal/mainstream sources
  (`corroboration_2plus` + `mainstream_pickup`, Futura-Sciences).
- 2026-09-28-C: Arabsat's Sept. 22 contract with China Great Wall
  Industry Corporation to build ARABSAT-50 (the operator's 50th-
  anniversary satellite, its first ever built in China) surfaced via the
  queue's own Via Satellite entries; Arabsat has no
  `src/data/registry` entity, but the story didn't need the no-registry
  workaround since the lead was Via Satellite (trade) rather than
  Arabsat's own site. Landed a clean SNR 4 off three independent trade
  sources (Via Satellite, Developing Telecoms, China-in-Space), the last
  of which corrected an overclaim implicit in other coverage: the "first
  Chinese satellite for the Middle East" framing is actually specific to
  Arabsat's own fleet, not the region as a whole (China has built
  satellites for other Middle Eastern operators before) -- worth checking
  a specialist regional-space outlet's more precise framing before a
  broader superlative from secondary coverage makes it into copy.
- 2026-09-28-D: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 2 new, 0 updated, 0 held") and the item count
  moving from 767 to 769 as the build-health signal.

## Narrow re-check, ~9h07m gap, unfiltered full source list (2026-09-28, second)

- 2026-09-28-E: A verified company's own X/Twitter posts do NOT pass the
  first_party anti-spoof gate even when genuinely fetched and confirmed
  verbatim via the syndication endpoint: the gate only matches a
  source's URL host against the registry's recorded `website` domain (or
  a fixed official-hosts list), and `x.com` is neither, so two of
  SpaceX's own posts confirming today's Starship Starlink V3 deployment
  classed `informal`, not `first_party`, despite being the actor's own
  official account. Worth remembering before assuming a verified
  company account earns first_party the way a whitelisted person's
  signals.json channel does; the anti-spoof rule cares about domains,
  not verification badges.
- 2026-09-28-F: Starship's actual first ORBITAL flight (the 14th test
  flight, Sept. 28, engine loss during ascent, orbit reached ~25 minutes
  after liftoff, 26 Starlink V3 satellites deployed into the operational
  constellation for the first time rather than discarded on reentry, per
  Payload/UPI/BBC/TechCrunch) was a genuinely undrafted gap distinct
  from the already-published Sept. 1 FAA-license item and its Sept. 27
  update noting the license grant: drafted as a new `launch`-category
  item rather than folded into the license item, since a regulatory
  approval and the actual flight execution are separate dateable events
  (same logic as Flight 13's abort/flight being its own item apart from
  license news). Landed `major` impact (a demonstrated first-of-kind
  operational capability) rather than `seismic`: CLAUDE.md's seismic
  example specifically names a vehicle's maiden flight, and Starship's
  literal first flight was years prior (this is its first flight to
  actually reach orbit after 13 suborbital-only attempts) -- picked the
  lower tier per the standing "when torn, pick the lower one" rule.
  spacex.com/updates and the dedicated spacex.com/launches/starship-
  flight-14 page both remained unfetchable JS shells (no first_party
  lead available), so the item led on Payload (trade) with UPI/BBC/
  TechCrunch (mainstream) corroboration, landing SNR 4 off 5 distinct
  sources -- the direct-source ceiling applies regardless of magnitude
  when no first-party lead is fetchable.
- 2026-09-28-G: The same-company-plus-category dedup heuristic fired on
  the Starship item against two unrelated Falcon 9 missions (the Sept.
  21 Exolaunch Starfall reentry rideshare and the Sept. 26 USSF-385
  Vandenberg launch), purely on shared company SpaceX + category
  `launch` + within 7 days, despite being a different vehicle and
  program entirely. Two `dedup_distinct` entries cleared it, extending
  the long-running pattern to same-company-different-vehicle collisions
  specifically.
- 2026-09-28-H: A discovery-pass "satellite company funding" query
  resurfaced Sateliot's April 2026 Series C round-OPENING announcement
  (not a close) under a September-dated search; confirmed stale via a
  second targeted search finding no September close, left undrafted.
  ESA's "first office in Japan" (europeanspaceflight.com) traced to an
  October 2025 opening, also stale. Both genuinely new items this run
  (Starship orbital flight, Meridian Space's spinout from SpinLaunch)
  came from the harvester queue itself, not the 8-query discovery
  matrix, which traced entirely to already-published ground.
- 2026-09-28-I: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 2 new, 0 updated, 0 held") and the item count
  moving from 769 to 771 as the build-health signal.

## Narrow re-check, ~2h30m gap, unfiltered full source list (2026-09-28, third)

- 2026-09-28-J: A queue dominated by hundreds of Starship Flight 14
  pickup pieces buried a genuine correction: the already-published
  item's TechCrunch-sourced text conflated the mission's ORIGINALLY
  PLANNED six-orbit/Chile splashdown with what actually happened once
  mission managers cut the flight short after satellite deployment. CBS
  News, fetched directly, gave the real outcome: splashdown in the
  Pacific north of Hawaii about three hours in, the ship tipping over
  and catching fire on impact (a normal ocean-landing occurrence per
  CBS), and a Super Heavy booster splashdown off Texas after a second
  engine issue during boost-back. ABC News and SpacePolicyOnline's
  bluesky (real-time launch-day posts) both independently corroborated
  "north Pacific"/"north of Hawaii" over TechCrunch's "west of Chile"
  phrasing. Patched via `updates[].patch.explainer.what_happened` (full
  field replacement, not an append) plus an `attach`; no bump requested,
  since the item's non-first-party trade lead was already at its
  corroboration ceiling of 4. Worth remembering: a same-day launch
  item's first-draft copy can describe the PLAN rather than the OUTCOME
  when the lead source was still live-blogging pre-splashdown; a
  same-day follow-up fetch of a different outlet is worth doing even on
  an already-published seismic/major item, not just thin ones.
- 2026-09-28-K: Two genuinely new items surfaced entirely from the
  harvester queue's own non-Starship entries, not discovery: Beeline
  Kazakhstan's commercial Starlink Mobile direct-to-cell launch (Via
  Satellite's `raw_excerpt` carried the full article; Kazakhstan's
  government ministry announcement and VEON's own two prior press
  releases, Nov 2025 and Dec 2025, were both confirmed stale on direct
  fetch and used only for background, not as today's news peg) and
  ESA's Digital EO cloud-infrastructure contract with OVHcloud and CGI
  (a Reuters wire piece, credited "Thomson Reuters by Leo Marchandon"
  on one of its many identical local-radio-station mirror hosts;
  Techzine.eu, an independently-written tech-infra trade outlet, gave
  the same facts in its own words for `corroboration_2plus`). Neither
  OVHcloud nor CGI has a `src/data/registry` organization entity, but
  the lead was never their own site, so the no-registry-host workaround
  never came up.
- 2026-09-28-L: `blacksky.com/company/news/` rendered only the page's
  search/filter shell again this run (a ninth consecutive sweep,
  2026-09-25-C through 2026-09-27-M); no sourceHealth entry logged
  again, per the standing practice. Still flagged for Florian: needs a
  `fetch_note` at the next structural touch.
- 2026-09-28-M: A NASA/Boeing Starliner press conference was scheduled
  for 3 p.m. ET today (after this run's `now`); left uncovered as a
  scheduled, not-yet-occurred event. Worth checking next sweep for the
  actual announcement.
- 2026-09-28-N: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 2 new, 1 updated, 0 held") plus a direct read of
  both new items' and the updated item's `snr`/`snr_trace`/`category`/
  `impact`/`sources` fields, and the state.json sweep-log entry, as the
  build-health signal.

## Narrow re-check, ~6h05m gap, unfiltered full source list (2026-09-28, fourth)

- 2026-09-28-O: WebFetch's AI summarization of a Bluesky
  `getAuthorFeed` JSON response is not reliably reproducible: fetching
  Jeff Foust's and Eric Berger's feeds twice each (once asking for
  text+timestamp, once asking additionally for the `uri` field) returned
  materially different post sets each time, and one live-tweet-style
  quote about the Starliner briefing shifted from being attributed to
  Foust's feed on the first call to Berger's feed on the second. Rather
  than risk a misattributed quote or fabricated post URI, dropped both
  Bluesky posts from the Starliner item's sourcing entirely and drafted
  from Payload/Scientific American/ClickOrlando instead, which was
  already sufficient for SNR 4. Lesson: when a signals-channel fetch
  needs an exact quote or post URI (not just "is there anything new"),
  don't trust a single WebFetch summarization pass; re-fetching the same
  endpoint can silently change which posts and attributions come back.
- 2026-09-28-P: arstechnica.com again failed outright via WebFetch
  ("unable to fetch"), but its content on the ISS mobile-transporter
  fault ahead of Crew-13 (Sept 27-28) had already propagated through
  rewrite/preview sites that explicitly credit Ars Technica
  (hwbusters.com with the fuller rewrite, physicalainews.com with a
  shorter preview linking through to the original). Used hwbusters.com
  as the lead, classed `informal` (not `mainstream`), since Ars Technica
  itself was never actually fetched this run; citing the rewrite site
  honestly rather than laundering Ars Technica's tier through it. Only
  one such rewrite cluster existed for this story (no independent
  outlet had it yet), so `crawl: "found_none"` and the item landed SNR 1
  -- still drafted per the standing "weak sourcing is never a reason to
  hold" rule, since it's a genuine, dateable, on-scope Commercial Crew
  operational risk two days before Crew-13's targeted launch.
- 2026-09-28-Q: `finalize-sweep.ts` rejects an `updates[].attach` entry
  missing `via` even when the attached source is first-party and is
  functionally the new lead-quality source, not mere corroboration;
  every attach entry needs an explicit `via` from the enum
  (`initial`/`corroboration`/`reinforcement`/`upgrade`), not just the
  ones that are obviously additive.
- 2026-09-28-R: Three genuinely new items cleared after the queue (dominated
  by already-published Starship Flight 14 coverage) and an 8-query
  discovery matrix both traced entirely to already-published ground:
  Boeing/NASA's Starliner return-to-flight schedule (uncrewed NET
  December, crewed mid-2028, Vulcan Centaur certification needed since
  Atlas V is retiring) from the harvester queue's Payload entry; the ISS
  mobile-transporter fault above; and Northrop Grumman's first-21-of-150
  PWSA Tranche 1 Transport Layer satellite delivery, found via the
  signals pass (Aviation Week's Vivienne Machi) but sourced to the
  company's own first-party press release once found, landing SNR 5
  with Defense Daily corroboration. Also closed out the
  2026-07-03-katalyst-swift-reboost-launch saga with NASA's first-party
  lessons-learned page (nasa.gov concluded involvement Sept 3, Link
  reentered Sept 25, plus quotes and the drag-minimization detail),
  found via a Jeff Foust Bluesky headline-teaser pointing at a paywalled
  SpaceNews piece that in turn led to the NASA source.

## Narrow re-check, ~5.5h gap, unfiltered full source list (2026-09-29)

- 2026-09-29-A: `blacksky.com/company/news/` rendered a normal dated listing
  this run (Sept 15 Via Satellite pickup, Sept 14 Gen-3 first light, Sept 9
  press release and Bloomberg pickup, back through July), ending the
  9-consecutive-sweep empty-filter-shell streak (2026-09-25-C through
  2026-09-28-L). Nothing on the listing was newer than lastSweep or
  unpublished, so this changed nothing substantively, but it supersedes
  the standing "flag for Florian, needs a fetch_note" note: the anomaly
  was transient after all, not a permanent site change, and a fetch_note
  is not warranted at the next structural touch.
- 2026-09-29-B: A genuine, fully clean zero-item sweep: a 65-candidate
  post-filter queue (almost entirely Starship Flight 14 pickup and
  SpaceX-stock/Bluesky-search-query chatter, plus off-topic CGTN
  general-tech filler) yielded nothing draftable. Three queue leads
  worth naming as screened-out rather than missed: an AST SpaceMobile
  8-K's Item 5.02 was a routine Compensation-Committee change-of-control
  severance POLICY adoption with no named departing/appointed officer,
  below the inclusion bar regardless of honest low-confidence sourcing
  (not a personnel change at all, so the routine-hire exclusion doesn't
  even need to apply); Planet's Sept 28 "Counting 5.2 Billion Trees"
  post is a peer-reviewed research-paper case study (2019 data, published
  in the Journal of Remote Sensing Sept 28) with no contract, customer
  action, or dollar figure, squarely the science/EO research-not-events
  exclusion; The Air Current's "NASA invests in Boeing, woos new entrants
  to replace SpaceX's Dragon" named zero specific companies, programs, or
  RFPs behind its paywall, a thin trend piece per the standing pattern.
  The mandatory 5-source HTML pass, a 13-channel signals pass (8 further
  X-handle searches), and a 10-query discovery matrix (launch, funding,
  incident/debris, China, India, EO contracts, FCC, Japan, M&A,
  geopolitical) all traced to already-published items or to the FCC's
  not-yet-occurred Sept 30 12.7/42 GHz spectrum vote. `bun run build` was
  not attempted, per the 2026-09-09 CLAUDE.md procedure update; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 0 new, 0 updated,
  0 held") and three persistence-bump `snr_movements` in the sweep log
  entry as the build-health signal.

## Narrow re-check, ~5h08m gap, unfiltered full source list (2026-09-29, second)

- 2026-09-29-C: A same-day Reuters piece ("SpaceX's Starship engine
  failure could impact NASA's moon mission objectives," fetched via an
  Investing.com wire mirror since reuters.com itself wasn't tried) added a
  genuinely new, attributed analysis angle to the already-published Sept
  28 Starship-reaches-orbit item: a named aerospace engineer (Dean Sladen,
  Accu Components) on the specific Artemis III/2027-rehearsal/2028-landing
  timeline risk from the same in-flight engine that failed. Folded in via
  `updates[].patch.explainer.why_it_matters` (full-field replacement,
  appending one attributed sentence) plus `attach`, no bump requested
  since the item's non-first-party trade lead was already at its
  corroboration ceiling of 4 -- a clean instance of the standing
  "enrichment patch, not corroboration of the original claim" pattern
  (2026-09-07-N and peers) on a major/seismic-adjacent item the same day
  it published, not weeks later.
- 2026-09-29-D: Singapore's "Earth Observation Initiative" (EDB/OSTIn,
  Google-News-queue "Singapore sets up Earth Observation Initiative in
  space sector push") is a year-and-a-half-stale resurfacing: the EOI
  itself launched Feb. 26, 2025 at GSTC 2025 (S$60M/US$44.8M STDP
  investment, UN/World Bank/WEF partners), confirmed via WebSearch: no
  today-dated peg in the EDB "business insights" page. A China-Global
  South Project analysis piece on Pakistan's still-undecided first
  Tiangong astronaut pick (two trainees, Zeeshan Ali and Khurram Daud,
  selection expected mid-to-late October) was left undrafted as
  process-not-yet-fact/scheduled-not-yet-occurred, same standard as a
  not-yet-awarded contract or not-yet-flown launch; worth a same-topic
  chase once China names the pilot or the flight actually occurs.
- 2026-09-29-E: A near-total-junk queue (mostly Starship Flight 14
  reaction/stock churn and Google News redirects) plus a fully clean
  mandatory 5-source HTML pass (Planet Labs, ICEYE, BlackSky, EUSPA,
  Telesat, all current with nothing new since lastSweep), a 14-of-17
  fetchable-channel signals pass (3 X-handle searches, none retrievable
  via the syndication endpoint), and a 10-query discovery matrix covering
  the full scope matrix all traced to already-published ground or the two
  exclusions above. `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 0 new, 1 updated, 0 held") and a direct read of
  the updated item's patched `why_it_matters`/`sources`/`secondary_urls`
  fields as the build-health signal.

## Deep sweep (auto-escalated after two zero-add sweeps), ~3h49m gap, unfiltered full source list (2026-09-29, third)

- 2026-09-29-F: A same-outlet self-correction is a clean `updates[].patch`
  case with no `attach`: Via Satellite silently corrected its own Sept 25
  NSSLGlobal article in place (same URL) to say NSSLGlobal acquired
  "MetOcean Security UK, a division of MetOcean Telematics" rather than
  MetOcean Telematics itself, which "continues to operate as an
  independent company" -- caught only because the harvester re-queued the
  same URL with different `raw_excerpt` text days later, carrying an
  explicit "Correction -- An earlier version of this story stated..."
  paragraph. Patched `headline`/`explainer`/`companies` to the corrected
  facts with no `attach` (no new URL exists, the same source_url was
  simply edited by the outlet) and no rescore (same lead, same tier).
  Worth checking a re-queued identical URL's `raw_excerpt` for a
  correction notice before assuming it's pure re-syndication.
- 2026-09-29-G: A `class: "whitelist"` lead source needs no second source
  to reach its floor: Andrew Parsonson's own europeanspaceflight.com
  article (bare-domain, satisfies the path-prefix whitelist match per
  2026-09-10-H) on a CNES spaceport-procurement call, single-sourced with
  `crawl: "found_none"` (the only other hit was a UFO Feed wire-rewrite
  mirror, left uncited), still landed SNR 4 via the whitelist-floor
  modifier alone -- base tier 3 (whitelist, before floors) would floor at
  3 unmodified, but the observer floor of 4 applies regardless of
  corroboration count, same mechanism as the informal-plus-whitelist-
  observer cases (2026-09-01-C and peers), just with the whitelisted
  person's own writing as both the fact source and the floor source.
- 2026-09-29-H: `federalregister.gov` passes the anti-spoof gate as
  `official_record` via the blanket bare-`*.gov`-TLD rule (its own domain
  ends `.gov`), not via the small fixed-hosts list -- a Draft EA Notice of
  Availability for Blue Origin's proposed New Glenn cadence increase at
  SLC-36A (12 to 50 launches/year) landed a clean single-source SNR 5 with
  no `found_none` penalty (direct-source ceiling) even though no
  independent trade pickup existed yet at fetch time. Used the
  `federalregister.gov/api/v1/documents/<doc-number>.json` and
  `.../full_text/xml/...` endpoints (2026-09-04-H) to pull the exact
  "from 12 to 50 launches per year" figure verbatim, since the canonical
  HTML document page itself redirects to `unblock.federalregister.gov`.
- 2026-09-29-I: A government-insourcing/contractor-layoff story with a
  quantified financial impact (NASA insourcing Kennedy Space Center's
  Amentum-run Base Operations and Spaceport Services contract, 70 jobs
  cut via WARN notice, ~3% of Amentum's FY2027 revenue per Washington
  Technology) was judged below the inclusion bar and left undrafted: it's
  a facility-support-services staffing/contracting change, not a fact
  about commercial launch, EO, connectivity, or IoT operators, resellers
  or investors acting differently -- distinct from the in-scope
  "government procurement of commercial space services" carve-out, which
  covers agencies buying commercial space CAPABILITIES, not routine base-
  ops contractor staffing.
- 2026-09-29-J: A thin queue candidate with a real-sounding headline can
  be pure thought-leadership marketing content with zero dateable fact:
  Planet's own Sept 29 blog post ("Beyond the Soda Straw: Why Modern
  Defense Needs Continual GEOINT") named no new contract, customer, or
  product, just an argument for daily imaging cadence in defense
  contexts -- left undrafted despite being a same-day first-party post on
  a mandatory HTML-pass source.
- 2026-09-29-K: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 5 new, 1 updated, 0 held") plus a direct read of
  all five new items' and the updated item's `snr`/`snr_trace`/
  `category`/`impact`/`sources` fields, and the sweep log's
  `corroboration_collapses` entry (ICEYE's own release vs. Insurity's own
  mirrored release, correctly collapsed as a wire rewrite despite living
  on two different companies' domains), as the build-health signal.

## Narrow re-check, ~5h08m gap, unfiltered full source list (2026-09-29, fourth)

- 2026-09-29-L: A vendor's own press release restating its inclusion in an
  already-published multi-vendor IDIQ list is not a new item even when it
  reads as a fresh company-specific announcement: Umbra's Sept. 17
  umbra.space post ("Umbra Selected by NOAA to Provide Commercial SAR
  Data") looked like a standalone procurement win, but the already-
  published `2026-09-11-noaa-sbem-idiq-commercial-data` item's own
  category breakdown already named "Iceye US, Umbra Lab" under scatterometry/
  SAR/radar. Caught only by grepping `items.json` for the NOAA program
  name (a plain "umbra noaa" grep found nothing, since the existing item's
  headline and id never mention Umbra by name) before drafting; worth
  checking a suspiciously-standalone vendor-selection press release
  against any existing multi-vendor IDIQ/contract-vehicle item covering
  the same program, not just a direct company-name grep.
- 2026-09-29-M: Two genuinely new items surfaced entirely from the
  mandatory signals pass (Jeff Foust's and Andrew Jones' bluesky feeds),
  not the queue or discovery matrix, which both traced to a near-total
  Starship Flight 14 pickup wave: AstroForge's Solo autonomy-AI
  announcement (Sept. 21, TechCrunch lead since AstroForge's own site
  wasn't needed) and Momentus' Vigoride-7 AI-sensor RPO demo with a NASA
  satellite (Sept. 29, `wire_pr` lead via a StockTitan/BusinessWire
  mirror, SatNews independently-written trade corroboration). Both
  companies have no `src/data/registry` entity. A third signals-pass lead
  (UK's new No. III Space Effects Squadron, Sept. 23) was left undrafted
  as a military-organization stand-up naming no commercial contractor,
  procurement figure, or market-access change, per the standing
  institutional-disclosure exclusion.
- 2026-09-29-N: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 2 new, 0 updated, 0 held") and a direct read of
  both new items' `snr`/`snr_trace`/`category`/`impact`/`sources` fields
  as the build-health signal.

## Narrow re-check, ~2h27m gap, unfiltered full source list (2026-09-30)

- 2026-09-30-A: A near-total-junk 24-candidate queue (Starship Flight 14
  reaction/UFO-sighting chatter, SpaceX stock/options-desk churn, Crew-13
  pre-launch scheduling posts, one unrelated Times of India/BBC filler
  wave) plus a fully clean mandatory 5-source HTML pass and a 17-channel
  signals pass (2 targeted X-handle searches, none retrievable) all
  traced to already-published ground; the two genuinely new items both
  came from an 8-query discovery matrix. ESA's own Sept 22 contract
  advancing ClearSpace's Phoenix GEO satellite-servicing mission
  (Forbes Luxembourg lead, mainstream, since ClearSpace has no
  `src/data/registry` organization entity to anti-spoof-match; ClearSpace's
  own release and startupticker.ch as informal corroboration) fired the
  standing ESA+category-"contract" dedup false positive against THREE
  unrelated existing ESA contract items (EOGS/ARISE, IRIS2 LEO
  consolidation, OVHcloud/CGI digital-EO) simultaneously; three
  `dedup_distinct` entries cleared it in one pass. CNT's Starlink Mobile
  direct-to-cell launch in Ecuador (SatPower branding, 82.4% initial
  coverage, third LatAm country after Chile/Peru) led on Primicias
  (mainstream, independently reported with a CNT exec quote and coverage
  stats) over TeslaNorth, since developingtelecoms.com's search hit for
  "Starlink Ecuador" turned out to be a stale March 2023 Galapagos
  broadband article, not this direct-to-cell launch; fired the same
  SpaceX+category-"product" dedup false positive against the unrelated
  Sept 28 Beeline Kazakhstan Starlink Mobile item (a different country,
  nothing else shared), cleared with one `dedup_distinct`.
- 2026-09-30-B: An AWS/Arbol/University of Cambridge "TESSERA" geospatial-AI
  foundation-model dataset going free on AWS Open Data (built on ESA
  Sentinel-1/2 imagery, one named user citing it for climate-insurance
  products) was judged too thin to draft: no contract, no customer
  transaction, no stated commercial deployment, closer to a research-tool
  release than a dateable industry event, similar in shape to the
  standing Planet-thought-leadership-post exclusion (2026-09-29-J) even
  though it does name one real downstream user. Left undrafted as a
  restrained call rather than published at a floor SNR; flag if a future
  sweep finds a contract or paid product built on it.
- 2026-09-30-C: A Yahoo Finance/Seeking Alpha "Falcon 9 rideshare sales
  paused as SpaceX winds down flagship vehicle" wave (WSJ-sourced, Sept 25)
  read as a bigger escalation of the already-published June 25 rideshare-
  freeze item (2026-06-25-spacex-rideshare-booking-freeze), but the exact
  Musk quote and "past late 2028" framing it cites are the same ones
  already in that item's `what_happened`; left unpatched rather than
  guess a materially new fact from a paraphrase-only fetch. The same
  wave's "Rocket Lab Steps In Where SpaceX Just Walked Away" angle traces
  to the already-published Aug 10 Kepler/Neutron booking
  (2026-08-10-kepler-rocket-lab-neutron-2028); grepping both company names
  against items.json before drafting caught this without spending
  corroboration budget on either.
- 2026-09-30-D: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 2 new, 0 updated, 0 held") and a direct read of
  both new items' `snr`/`snr_trace`/`category`/`impact`/`sources` fields
  as the build-health signal.

## Narrow re-check, ~7h35m gap, unfiltered full source list (2026-09-30, second)

- 2026-09-30-E: A new WebFetch actor-mismatch shape on the mandatory
  signals leg: fetching marco-langbroek's and andrew-jones's bluesky
  `getAuthorFeed` API endpoints back to back returned 20 posts each of
  entirely off-topic Dutch political content for BOTH handles, no space
  content at all, despite both being genuine space-focused accounts in
  every prior sweep. Not the usual stale-timestamp cache pattern
  (2026-09-26-B/-O); this looked like a wrong-feed/cross-contaminated
  response. Left both undrafted rather than risk misattributing Dutch
  political commentary to either account; worth a from-scratch retry
  (not just a smaller `limit`) next time either handle is checked.
- 2026-09-30-F: A discovery-pass ESA/Airbus/OHB "European space station
  studies" lead (surfaced via europeanspaceflight.com and corroborated
  with SpaceNews and an Italian outlet) turned out to be the SAME event
  already published same-day as `2026-09-29-esa-orbital-outpost-studies`
  (ESA's own first-party release, already at the SNR 5 ceiling) --
  caught only by finalize-sweep's dedup gate, not a pre-draft grep,
  since the new sources used different company-order phrasing than the
  existing headline. The new sources still carried a genuinely new fact
  (SpaceNews's €1B-per-three-year-period development-spending cap, not
  in ESA's own release) worth keeping: patched into
  `explainer.why_it_matters` via `updates[].patch` plus `attach`, no
  bump requested since the item was already at its first-party ceiling.
  Worth grepping `items.json` by company pair (ESA + Airbus/OHB) before
  drafting an ESA contract-award lead, not just by topic keywords, per
  the standing 2026-09-27-E/2026-09-27-L pattern.
- 2026-09-30-G: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 8 new, 1 updated, 0 held") and a direct read of
  all eight new items' and the updated item's `snr`/`category`/`impact`

## Narrow re-check, ~4h03m gap, unfiltered full source list (2026-09-30, third)

- 2026-09-30-H: `finalize-sweep.ts` rejects a `signalsPass.checked` entry
  that is a channel's `rss` URL rather than its listed `url`: for
  Andrew Parsonson's substack leg, `signals-context.ts` lists
  `url: "https://europeanspaceflight.substack.com"` with a separate
  `rss` field pointing at `.../feed`; listing the `/feed` URL in
  `checked` (even though that's the endpoint actually fetched) fails
  the "is not a fetchable whitelisted signal channel" gate. List the
  channel's base `url`, not its `rss` endpoint, even when you fetched
  the feed URL directly.
- 2026-09-30-I: A near-total-junk ~55-candidate queue (Starship Flight
  14 post-flight reaction/stock churn, Crew-13 pre-launch hype, generic
  Futurism/BBC filler) yielded zero drafts from the queue itself; both
  new items came from the mandatory HTML/discovery legs. An "AST
  SpaceMobile Jumps 5% on Takeover Speculation" piece traced to a
  routine change-of-control severance-policy 8-K with no named
  acquirer or source, explicitly "not confirm[ing]" any transaction --
  pure anonymous stock-trader rumor, left undrafted per the standing
  anonymous-rumor exclusion (same shape as 2026-09-29-B's severance-
  policy case, just with speculation layered on top). A Textron/
  AeroMech "Starlink now available on Hawker 700/800/900" piece traced
  to a Sept. 11 press release with no new date peg, left undrafted as
  stale. The Musk/Delta-CEO "will lose his job" in-flight-wifi spat
  traced to unverifiable "reportedly said" remarks with no new
  commercial fact beyond the already-published March 31 Delta/Amazon
  Leo item, left undrafted as gossip rather than an industry event.
  A SpaceX-donates-50-Starlink-kits-to-Malaysia courtesy-call story
  was judged too thin (no stated figures, capacity, or market-access
  change, a goodwill photo-op) per the standing minor-partnership-
  without-stated-money exclusion.
- 2026-09-30-J: NorthStar Earth & Space's SPAC merger with Viking
  Acquisition (first announced/published April 17) closed today; led
  on Viking's own SEC 8-K exhibit (sec.gov, `official_record`, ceiling
  5 with no `found_none` penalty) rather than the GlobeNewswire/wire
  mirrors (Manila Times, Yahoo UK, TradingView, Pulse2, Dealroom, all
  republishing the same press release). Drafted as a NEW item rather
  than an `updates[].patch` on the April item: five months apart, and
  a deal's public announcement and its actual closing/listing are
  distinct dateable events (same logic as a regulatory grant vs. the
  eventual flight). Neither NorthStar nor Viking has a
  `src/data/registry` organization entity.
  fields as the build-health signal.

## Narrow re-check, ~5h18m gap, unfiltered full source list (2026-09-30, fourth)

- 2026-09-30-K: A near-total Crew-13-prelaunch/Starship-14-aftermath queue (65
  candidates, almost all scheduled-not-yet-occurred Crew-13 coverage and
  already-published Starship Flight 14 pickup) still yielded the actual
  outcome of a process-not-yet-fact item flagged in this file on
  2026-09-20-I/2026-09-22-J: the FCC's Sept. 30 Open Meeting vote adopted
  both the satellite-NEPA exemption and the 12.7/42 GHz spectrum order, per
  Via Satellite's same-day writeup (verbatim commissioner quotes) plus an
  independently-worded TVTechnology piece (different commissioner quote) for
  `corroboration_2plus`. `docs.fcc.gov/public/attachments/DOC-424841A1.txt`
  (the .txt-extension trick, 2026-09-04-H/2026-09-29-H) fetched clean but is
  the Sept. 9 pre-vote FACT SHEET describing the draft order, not proof of
  adoption; fcc.gov itself 403'd on every attempt (`/September2026`,
  `/news-events`), so the item led on Via Satellite (trade) rather than force
  an official_record lead through an unreachable domain or a pre-vote
  document. Landed a clean SNR 4.
- 2026-09-30-L: A same-day Reuters wire story (Ukraine's Washington deputy
  chief of mission urging US sanctions on Rassvet's component suppliers) had
  zero independently-written pickup: every hit (US News, Yahoo, ThePrint,
  KFGO, headtopics) was the identical wire text. The same interview also
  included Ukraine asking to use Starlink over Russian territory to strike
  missile launchers, the same operational-use ask the 2026-09-25-A Finland/
  Stubb case excluded; wrote the item narrowly around the sanctions/
  export-control request only and left the strike-enablement ask out
  entirely, rather than drop the story or publish the operational claim.
  Landed an honest single-wire-source SNR 2 (`crawl: "found_none"`).
- 2026-09-30-M: Requesting a `corroboration_2plus` bump on an `updates[]`
  item that already carries a `corroboration_none` modifier from its
  original scoring does not replace that modifier, it adds to it: the
  Meridian Space/SpinLaunch item's trace kept both `corroboration_none: -1`
  and the new `corroboration_2plus: +1` side by side, netting zero delta
  (2 -> 3, base 3 + 0) rather than the 2 -> 4 a naive "the new modifier wins"
  read would predict. Worth expecting a smaller-than-expected bump whenever
  an update adds corroboration to an item that was originally scored
  `found_none`.
- 2026-09-30-N: Reaffirmed the institutional-disclosure exclusion over the
  weaker 2026-09-04-D CSO-succession precedent: a same-day White House
  nomination of Lt. Gen. David Miller to lead US Space Command (well-sourced,
  Via Satellite plus Aviation Week plus Marcia Smith's bluesky) was left
  undrafted despite the existing precedent for publishing a well-telegraphed
  military space-command succession at `noise`. A SPACECOM combatant-command
  change tied to a base-relocation political fight reads as pure
  institutional/military news with no stated commercial-space consequence,
  a poorer fit for the CSO analogy (which at least oversees Space Force
  acquisition) than the ULA-CEO-succession comparison that justified it;
  treated the CSO case as an outlier rather than a rule to keep extending.
  Flag for Florian if military space-command leadership changes should get
  an explicit ruling either way.

## Narrow re-check, ~6h25m gap, unfiltered full source list (2026-10-01)

- 2026-10-01-A: A near-total-junk ~60-candidate queue (Crew-13 pre-launch
  coverage across dozens of outlets, SpaceX stock/options chatter, a
  "rocket launch" headline collision that was actually an anti-ship
  missile strike on Iranian launchers) yielded zero draftable candidates
  from the queue itself; all three new items came from the mandatory
  signals/HTML/discovery legs. `rocketlabcorp.com/updates/` listing page
  still loads fine but individual `/updates/<slug>/` article pages still
  403 behind Cloudflare (same gap as 2026-07-05-G, still unresolved);
  GlobeNewswire carries the same press-release text at a fetchable URL
  and was used as the `wire_pr` lead instead.
- 2026-10-01-B: A regional/local outlet's own calculated estimate
  (NZ Herald computing an approximate ~US$170M contract value from
  Rocket Lab's published per-launch pricing, for a deal whose press
  release explicitly left "remaining terms... undisclosed") is the
  outlet's own inference, not a source-stated figure -- left out of the
  item copy per the "numbers are copied, not paraphrased" rule even
  though the outlet itself is a genuine, independently-written
  corroboration source (confirmed via direct fetch, added Mahia-specific
  launch-site detail and SpaceX-rideshare-freeze context the press
  release didn't have). Worth remembering: an outlet being independent
  enough to count as real corroboration doesn't make its own computed
  figures citable; check whether a number is stated or derived before
  copying it.
- 2026-10-01-C: Blue Origin's CEO going on the record for the first time
  (Dave Limp at the White House's "Hello, America" summit, Sept 30,
  confirming the July-reported outside funding round is real,
  oversubscribed, and still open, while declining to confirm final
  figures) is a clean `updates[].patch` case layered on top of a
  "reportedly" lead: patched `what_happened`/`why_it_matters` to add the
  on-record confirmation and the WSJ's separately-reported $140B
  valuation climb, attached two mainstream mirrors (AFP via Macau
  Business, Yahoo Finance/Investing.com citing WSJ) since cnbc.com
  itself 403'd on direct fetch, and requested no bump since the item's
  mainstream-led trace was already at its corroboration_2plus ceiling of
  4. The update's `note` led with the CEO's own on-record status rather
  than the still-unconfirmed $140B figure, keeping the copy honestly
  behind the sourcing.
- 2026-10-01-D: A routine airline-Wi-Fi-rollout milestone (Alaska Air
  Group, >40% of its combined fleet now Starlink-equipped per a Sept 29
  investor day, two independently-written trade sources with no stated
  dollar figure) cleared the inclusion bar at `noise`/`product` per the
  standing "low impact and strong sourcing are independent axes" rule
  (2026-09-04-S and peers); fired the same-company-plus-category dedup
  heuristic against two unrelated Sept 28/29 Starlink Mobile D2C launch
  items (Kazakhstan, Ecuador) purely on shared SpaceX + category
  `product` + window, cleared with two `dedup_distinct` entries.
- 2026-10-01-E: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 3 new, 1 updated, 0 held") and a direct read of
  all three new items' and the updated item's `snr`/`snr_trace`/
  `category`/`impact`/`tags` fields, plus four unrelated persistence-bump
  `snr_movements` in the sweep log entry, as the build-health signal.

## Narrow re-check, ~8h27m gap, unfiltered full source list (2026-10-01, second)

- 2026-10-01-F: A near-total-junk 104-candidate queue (Crew-13 pre-launch
  live-coverage across dozens of outlets, SpaceX stock chatter) still
  yielded three genuinely new seed/pre-seed funding items straight from
  the queue's own Payload entries (Satlyt, Foundational, Charter Space),
  none needing a live-page fetch beyond Payload's own `raw_excerpt`/page
  content. Crew-13 (net 15:10Z), Transporter-18/the Google Suncatcher
  orbital-test launch carrying it (net 18:18Z) and the NROL-97 Falcon
  Heavy mission (net 2026-10-02T03:53Z) were all still "Go for Launch"/
  pre-liftoff per a direct Launch Library fetch at this sweep's `now`
  (13:56Z) despite dozens of "watch live today" queue headlines; left all
  three uncovered as scheduled-not-yet-occurred rather than drafting from
  preview coverage.
- 2026-10-01-G: A Dealroom.co writeup of the same Charter Space raise
  stated "US$3.24M seed round" where Payload, the company's own X post,
  and five other outlets all agreed on $5M -- used Dealroom only as a
  corroboration source (distinct wording, genuine independent write-up)
  without citing its conflicting figure anywhere in the item copy, per
  the standing 2026-09-04-N numeric-variance-trap handling (use the lead
  source's own stated number, leave a conflicting secondary figure
  uncited rather than imply agreement or dispute that wasn't stated).
- 2026-10-01-H: A LiveEO/DLR "INSPECTEO" award surfaced only via a
  SpaceWatch.Global interview-format piece (Mission-K 2026 podcast
  writeup) with no stated date or figure; LiveEO's own newsroom listing
  had no INSPECTEO press release at all (nearest match, "SurfaceFrame,"
  a Sept 30 DLR-backed project with Universität der Bundeswehr München,
  also had no fetchable article body, its direct URL 404'd and no
  cached full text was findable). Left both undrafted per the standing
  "don't stretch a single unconfirmed mention into an item" rule, same
  shape as a paywalled trend piece with no verifiable body text.
- 2026-10-01-I: The ICEYE/Nokia sovereign-LEO-satcom partnership (Oct 1,
  first-party ICEYE press release, ceiling SNR 5) fired the standing
  same-company-plus-category dedup false positive against the unrelated
  Sept 29 ICEYE/Insurity/SpatialKey insurance-data item, purely on
  shared company (ICEYE) + category (`partnership`) + within 7 days.
  One `dedup_distinct` entry cleared it, extending the long-running
  pattern to ICEYE specifically.
- 2026-10-01-J: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 4 new, 0 updated, 0 held") and the item count
  moving from 801 to 805 as the build-health signal.

## Narrow re-check, ~3h13m gap, unfiltered full source list (2026-10-01, third)

- 2026-10-01-K: WebFetch's own "detailed"/synthesized answer mode on a
  Launch Library search query (asking it to "give me the launch status...
  booster info" in prose) returned a fully plausible-reading but
  unverifiable paragraph with a specific booster tail number (B1101) and
  landing-zone detail that a follow-up raw-JSON-only fetch of the same
  endpoint did not carry at all. Treat any WebFetch prompt that asks for
  a prose "summary"/"detailed info" of an API endpoint as untrustworthy
  for specific figures; always re-fetch asking verbatim for named JSON
  fields, and get booster/crew/timing specifics from a directly fetched
  news article or the actor's own page instead, never from the API
  endpoint's own prose gloss.
- 2026-10-01-L: A near-total Crew-13 launch-day queue (dozens of "watch
  live"/liftoff reaction headlines) buried the one thing actually
  undrafted: the launch itself. Two prior sweeps today had left Crew-13
  as "still pre-launch" (2026-10-01-F); once it actually flew, no queue
  candidate stated the plain fact "it launched" in a draftable way studied
  on its own (Google News entries all required following a redirect that
  WebFetch could not resolve). Went straight to nasa.gov/blogs/crew-13/
  (first-party, passes the blanket `.gov` anti-spoof rule) instead,
  landing a clean single-source SNR 5. Worth remembering: on a big
  scheduled-crewed-launch day, check the actor's own blog/newsroom
  directly rather than trying to resolve Google News redirects for the
  core "did it launch" fact.
- 2026-10-01-M: The Crew-13 item's same-company-plus-category dedup
  heuristic fired against THREE existing human-spaceflight items in the
  7-day window, not just the obvious transporter-fault one: also NASA's
  Crew-14 roster-naming item and Boeing/NASA's unrelated Starliner
  return-to-flight-schedule item (shared company NASA, category
  human-spaceflight, no other overlap). Three `dedup_distinct` entries
  cleared it in one pass; worth expecting the heuristic to walk every
  same-category NASA item in-window, not just the most topically obvious
  one.
- 2026-10-01-N: A SpaceNews URL's own page can be labeled "Posted in
  Press Release" with a company byline (here, Novaspace) rather than a
  SpaceNews staff byline; checking for that label before classing a
  SpaceNews piece as `trade` caught a would-be misclassification on the
  LMT Group/Novaspace Latvia 5G/6G hub story. Classed `wire_pr` instead
  (base tier 4, no independent pickup found beyond identical wire
  mirrors on Baltic Times/TelecomTV/UFO Feed/etc., so `corroboration_none`
  dropped it to a final SNR 3) rather than overclaim `trade`-tier
  original reporting that was never done.
- 2026-10-01-O: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 4 new, 0 updated, 0 held") and the item count
  moving from 805 to 809 as the build-health signal.

## Narrow re-check, ~5h25m gap, unfiltered full source list (2026-10-01, fourth)

- 2026-10-01-P: Launch Library's `/launch/upcoming/?search=<name>` endpoint
  returns an empty result set, not an error, once a mission has already
  flown (confirmed on both "NROL-97" still upcoming and "Transporter-18"
  already flown) -- an empty `upcoming` search is not proof a mission
  hasn't happened, just proof it isn't in the upcoming queue anymore.
  Switching to the unfiltered `/launch/?search=` endpoint, or a broader
  name query ordered `-net` (e.g. "Transporter" across all 21 numbered
  missions), surfaced the real `status.name: "Launch Successful"` and
  `net` cleanly. Worth trying the broader/unfiltered query by default
  whenever an `upcoming`-filtered search comes back suspiciously empty
  for a mission that might already have flown.
- 2026-10-01-Q: A scheduled-payload preview item that already published
  (Google's Project Suncatcher "will launch" piece, Starfish Space's
  Otter "scheduled to launch" piece, both drafted 2026-09-24) is the SAME
  event continued once the rideshare mission actually flies, not a new
  item, even though the originals were announcements rather than the
  flight itself: patched both via `updates[]` once Transporter-18 launched
  Oct. 1 (Suncatcher got a full `rescore` to Planet's own first-party
  confirmation of initial contact, landing SNR 5; Starfish got a plain
  `attach`+copy patch, no bump, since its trade lead was already at its
  non-first-party ceiling of 4). Two OTHER payloads on the same
  Transporter-18 mission (Cowboy Space's Reason-1, Star Catcher's
  Protostar) had no prior item at all under any id and drafted clean as
  new items instead -- worth checking per-payload, not per-mission,
  whether a prior preview item exists before deciding new-item vs.
  update.
- 2026-10-01-R: The mandatory fetchable-signals pass again outperformed
  the queue and a 10-query discovery matrix on a near-total Crew-13/
  Transporter-18-repost queue: Jeff Foust's bluesky feed surfaced a
  genuinely undrafted Pentagon OECIF contract for Overview Energy (a
  third orbital power-beaming company, contract dated Sept. 30, one day
  outside this run's narrow ~5.5h window) that neither the queue nor a
  dedicated discovery query ("Overview Energy space-based solar power
  agreement October 2026" only found it after the lead was already in
  hand) surfaced independently. Chased per the predates-window
  convention and dated on the actual Sept. 30 award date.
- 2026-10-01-S: A RussianSpaceWeb homepage teaser ("Russian satellites
  appear maneuver toward a commercial Western imager") traced via
  WebSearch to an already-reported April-June 2026 ICEYE-X36/Kosmos
  rendezvous-proximity-operations saga (Supercluster, Tom's Hardware,
  dated as far back as June 16) with no fresh dateable escalation found
  this run; left undrafted rather than risk restating 4-month-old
  proximity-operations reporting as new, on top of the standing
  conflict-analysis-adjacent caution for Russia/Ukraine-linked satellite
  stories (the item would need to report the ICEYE safety fact, not
  adjudicate Russian intent, and no fresh fact was found to hang that on).
- 2026-10-01-T: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 3 new, 2 updated, 0 held") plus a direct read of
  all three new items' and both updated items' `snr`/`snr_trace`/
  `category`/`impact`/`sources` fields, and the sweep log's
  `snr_movements` entry, as the build-health signal.

## Narrow re-check, ~7h34m gap, unfiltered full source list (2026-10-02)

- 2026-10-02-A: `draft.coverage` must list `category` values, not tags
  ("eo" was rejected outright with "is not a known category"); use the
  categories actually touched (`constellation`, `launch`, `contract`,
  etc.), not domain/modality tags, even though the field reads like a
  topic summary.
- 2026-10-02-B: `dedup_distinct` is a top-level field on the newItem
  object, sibling to `crossfeed`, not nested inside `crossfeed`; nesting
  it inside `crossfeed` is silently ignored by the dedup gate (the EU
  Space Shield item still got flagged against the same-day STRA item
  until the attestation was moved up a level).
- 2026-10-02-C: Four separate taglines this run tripped the 140-char cap
  by small margins (141-157 chars) despite reading as reasonably tight
  one-sentence summaries; the cap is stricter than it looks when a
  tagline names two actors, a figure and a date together. Worth drafting
  taglines short on the first pass for any item with more than one named
  party or a stated figure.
- 2026-10-02-D: Five Transporter-18 rideshare payloads (Spire's first
  Boulder-built satellites, IRIDE's Eaglet II completion, Satellogic's
  first Merlin satellite, Rheinmetall/Argotec's first surveillance
  satellite, plus the already-covered Suncatcher/Cowboy Space/Star
  Catcher/Altair-1 payloads) all surfaced as separate first-party or
  trade press releases dated Oct. 1-2 rather than from one aggregated
  manifest; confirms the standing 2026-10-01-Q practice of checking
  per-payload for a prior preview item rather than treating a rideshare
  mission as one event. None of IRIDE, Rheinmetall or Argotec has a
  registry entity, extending the no-registry-host workaround to a
  national space-agency program and a defense-hardware prime entering
  satellite manufacturing.
- 2026-10-02-E: A specialist non-space trade outlet (PV Magazine USA)
  was the only fetchable lead for a genuinely new space-based-solar PPA
  (Virtus Solis/Brae Systems); SpaceNews covered the same contracts
  same-day but was paywalled beyond headline/byline, still usable as a
  confirmed corroboration source per the standing paywall-lede pattern.
  Latitude Media's independently-reported skepticism (a 2009 PG&E/
  Solaren space-solar PPA cancelled in 2015, ~4% prior wireless
  power-transfer efficiency) was folded into `why_it_matters`,
  attributed, rather than left out for being unflattering to the deal.
- 2026-10-02-F: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 9 new, 1 updated, 0 held") and the item count
  moving from 815 to 824 as the build-health signal.

## Narrow re-check, ~3h44m gap, unfiltered full source list (2026-10-02, second)

- 2026-10-02-G: A Polish listed company's own stock-exchange (ESPI)
  disclosure, republished on a financial-news site (parkiet.com's
  `komunikaty-espi` section carrying Creotech Instruments' "Uzyskanie
  łączności z satelitami Mikroglob-2, Mikroglob-3, Mikroglob-4"
  announcement verbatim), is NOT `official_record` or `first_party`
  despite functioning like an SEC 8-K exhibit: the anti-spoof domain
  check needs either the company's own domain or a registered
  official-regulator domain, and parkiet.com is neither. Classed
  `trade` (a financial-press mirror of the statutory disclosure) rather
  than force first-party/official_record through a non-matching domain;
  worth the same treatment for any future Polish GPW-listed company's
  ESPI/EBI announcement cited via a news aggregator.
- 2026-10-02-H: Two independent stale-resurfacing traps in one
  discovery-pass funding query: a WebSearch for "space company funding
  round...October 2026" surfaced Stoke Space's Series D extension to
  $860M and Observable Space's $90M Series A with search-engine framing
  that read as current, but both traced on a dedicated follow-up search
  to February and May/June 2026 respectively (Stoke's extension is
  already superseded by its September 8 $1B Series E, already
  published; Observable's round is from its original announcement
  months ago) -- neither was a same-day rewrite, just old news a search
  aggregator resurfaced with no date discipline. Worth always running a
  second, narrower date-qualified search before drafting any funding
  headline a broad discovery query turns up.
- 2026-10-02-I: An Aviation Week piece ("ESA Boss Sees European Human
  Spaceflight Taking Decade To Attain," Oct 1, Josef Aschbacher's
  ~€10B/decade independent-human-spaceflight estimate) traced through
  three other recycled write-ups (European Spaceflight May 19, SatNews
  Sept 25, Agence Europe May 30) back to the same Sept 9-10 Paris Space
  Summit remarks already a month old at this run's `now` -- left
  undrafted as a resurfaced quote rather than a new Oct 1 statement; no
  source found a new venue or occasion for Aschbacher to have repeated
  the figure that day. Flag for a future sweep once ESA's December
  Ministerial Council actually votes on the program.
- 2026-10-02-J: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 2 new, 1 updated, 0 held") and the item count
  moving from 824 to 826, plus a direct read of both new items'
  `snr`/`snr_trace`/`category`/`impact` fields and the updated Starliner
  item's five-source `sources` array, as the build-health signal.

## Narrow re-check, ~4h56m gap, unfiltered full source list (2026-10-02, third)

- 2026-10-02-K: A Federal Register notice of intent (SpaceX's SLC-37
  Supplemental EIS, up to 76 Starship-Super Heavy launches and 152
  landings/year at Cape Canaveral) sat as a genuine 3-day-old
  predates-window gap: SpaceNews 429'd and space.com rendered only nav
  chrome, but `federalregister.gov/api/v1/documents/<doc-number>.json`
  gave clean verbatim text (the standard .txt/.json-endpoint workaround,
  2026-09-04-H/2026-09-29-H) and landed a clean single-source SNR 5
  (official_record ceiling, no `found_none` penalty). Confirms the
  standing same-company-plus-category dedup false positive extends to
  SpaceX + `regulatory` matching an entirely unrelated Iran/Starlink
  item on nothing but those two fields.
- 2026-10-02-L: A foreign university's own announcement that one of its
  professors is leaving for industry (ETH Zurich's page on Thomas
  Zurbuchen, NASA's science chief 2016-2022, joining Blue Origin as SVP
  of Advanced Concepts) is `informal`, not `first_party` for Blue Origin
  (wrong actor's domain) -- but still landed a clean SNR 4 off the
  whitelist-floor modifier alone, with a single whitelisted observer's
  bluesky post (Marcia Smith, no original reporting beyond linking the
  news) as the only "second" source. A Mirage News mirror of the
  identical ETH release collapsed correctly as `wire_rewrite` despite
  sitting on a completely unrelated domain and covering a third-party
  company, not the institution itself -- confirms the title-collapse
  logic isn't limited to a single company's own multi-domain PR network.
- 2026-10-02-M: A new corroboration-honesty distinction: Space Intel
  Report's own framing of a US ambassador's Sept. 30 Brussels speech
  (warning the EU Space Act could burden US space providers) was the
  ONLY source to mention the Space Act angle at all, even though two
  other outlets (Yahoo News, ednews.net) independently covered the SAME
  speech's broader "Buy European" defense-procurement remarks in detail.
  Did not count the broader-remarks outlets as corroboration for the
  space-specific claim they never stated, and re-fetched Space Intel
  Report a second time asking for the exact verbatim sentence (not a
  WebFetch synthesis) before trusting the specific attribution; landed
  an honest single-source SNR 2 (`crawl: "found_none"`) rather than
  stack unrelated-angle coverage as fake corroboration.
- 2026-10-02-N: Another stale-resurfacing trap from a generic WebSearch:
  a "Japan's H3 suffers second-stage anomaly, QZS-5 satellite lost"
  SpaceNews headline read current but traced (via a second, more
  specific search) to a December 22, 2025 failure, nine months stale
  and well before this site's effective coverage. Left undrafted.
- 2026-10-02-O: `bun scripts/finalize-sweep.ts` merged cleanly on the
  second attempt ("merged 5 new, 1 updated, 0 held") after the first
  attempt was rejected for a missing top-level `dedup_distinct` on the
  SLC-37 item (shared company SpaceX + category regulatory against the
  unrelated Iran item, 2026-10-02-K above); confirmed via a direct read
  of all five new items' `snr`/`snr_trace`/`category`/`impact` fields,
  the updated NROL-97 item's four-source `sources` array and patched
  `what_happened` text, and the sweep log's `corroboration_collapses`
  entry (2026-10-02-L) as the build-health signal.

## Narrow re-check, ~6h26m gap, unfiltered full source list (2026-10-03)

- 2026-10-03-A: A same-company-plus-category dedup false positive fired
  FOUR ways at once on a new AT&T-CEO/Starlink-cellular commentary item
  (category `product`): against Beeline Kazakhstan's and CNT Ecuador's
  Starlink Mobile D2D launches, Alaska Air Group's Starlink aviation
  fleet milestone, and SpaceX's residential Starlink Community Host
  program, none of which share anything with an AT&T executive's opinion
  piece beyond company SpaceX + category `product` + the window. Four
  `dedup_distinct` entries cleared it in one pass; extends the
  long-running list to commentary items specifically, not just hard-news
  events.
  Also confirms a 4-day predates-window chase is worth it for executive
  commentary that moves a tracked company's stock: AT&T CEO Stankey's
  Sept. 29 on-record dismissal of SpaceX's Starlink cellular strategy to
  Axios (axios.com itself 403's) was fully recoverable via Yahoo
  Finance's direct quotes (crediting the Axios interview) plus CircleID's
  independently-written technical/regulatory analysis of the same
  remarks, landing a clean SNR 4 (`mainstream` base + `corroboration_2plus`)
  despite neither being a space-trade outlet.
- 2026-10-03-B: A Google News "Starlink helped Jamaica get back online
  after Hurricane Melissa" (PCMag-bylined) candidate traced via search to
  wall-to-wall October 2025 coverage (Hurricane Melissa hit Jamaica
  October 2025, not 2026) -- a one-year-anniversary retrospective
  resurfacing, not fresh news, caught before any fetch of the actual
  PCMag page. A Google News "Zelenskyy asked Trump to block Russia and
  China's Starlink rival" (FT) candidate could not be independently
  confirmed to add anything beyond the already-published Sept. 30
  Ukraine/Rassvet-sanctions item: ft.com itself is unfetchable
  ("unable to fetch", joining arstechnica.com/axios.com/realclearscience.com
  on the standing always-blocked list), and no secondary source
  confirmed a China-specific angle; left undrafted as a probable
  trend-piece restatement rather than guess.
- 2026-10-03-C: HyImpulse's new UK CAA launch operator licence (Oct 1,
  SpaceWatch.Global/PA-wire-syndicated local papers, SaxaVord spring-2027
  target) is genuinely new and distinct from the same-week Omnidea/Orbex
  item, but the vehicle named throughout (SR75) is HyImpulse's suborbital
  hybrid-propellant test rocket, not its future orbital SL1 -- left
  undrafted per the standing orbital-only launch-vehicle scope
  (2026-09-11-I Avio FD1 / 2026-09-25-I Pluto Aerospace precedent),
  despite the regulatory/spaceport-milestone framing reading like a
  stronger scope case than a bare vehicle-demo flight.
- 2026-10-03-D: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 1 new, 0 updated, 0 held") plus a direct `jq`
  read of the new item's `snr`/`snr_trace`/`category`/`impact`/`sources`
  fields (832 items, up from 831) and the sweep log's `snr_movements`
  entry (one unrelated persistence bump, Aer Lingus Starlink item 1 to 2)
  as the build-health signal.

## Narrow re-check, ~6h38m gap, unfiltered full source list (2026-10-03, second)

- 2026-10-03-E: A fully clean, zero-new-item sweep: the 54-candidate
  post-filter queue was almost entirely routine Federal Register
  aviation/fishery notices (none FCC/satellite-relevant), off-topic
  CGTN/Futurism/BBC filler, and bot/stock-chatter Bluesky hits; all 5
  mandatory HTML sources, 14 of 17 signals channels (rotated out two
  site duplicates of already-checked bluesky accounts plus Parsonson's
  substack feed) and 4 X-handle searches, and a 10-query discovery
  matrix covering the full scope (launch, financial/M&A, incident,
  China, India, Japan, EO contracts, FCC, D2D) all traced to
  already-published items (Satlyt seed round, WISeSat SPAC close,
  NorthStar SPAC listing, AT&T/Verizon/T-Mobile D2D JV, Rocket
  Lab/Synspective 20-launch, ESA EOGS/ICEYE-Leonardo study contracts) or
  out-of-scope/not-yet-occurred leads: SDA's 4th Tranche 1 mission
  (confirmed via WebSearch as net Oct. 5, not yet flown, despite a
  Google News headline reading as settled), CAS Space's Lihong-2
  pharmaceutical-payload test (explicitly a 2027-planned *suborbital*
  verification flight per the fetched article, out per the standing
  orbital-only launch-vehicle scope), and the Space Force's DSP
  missile-warning constellation retirement after 56 years (confirmed via
  WebSearch: a pure institutional decommissioning exercise with no named
  commercial contractor or market-access fact, same shape as the
  standing SPACECOM-succession/NASA-STRIDE institutional-disclosure
  exclusion).
- 2026-10-03-F: A same-source enrichment that needed no new attach: the
  Sept. 30 FCC NEPA/spectrum item's own already-cited lead (Via
  Satellite) stated one more fact the original draft never extracted
  into copy — the same Sept. 30 meeting also issued an FNPRM exploring
  1,450 MHz more Ku/Ka-band and D-band spectrum, plus bands for
  non-connectivity uses. Patched `what_happened` with no `attach`/bump
  (the fact was already in the existing `source_url`, not a new source).
  Worth re-reading an item's own already-cited source in full when a
  later pickup (here, advanced-television.com) flags a detail that
  sounds unfamiliar; it often turns out the original source said it all
  along.
- 2026-10-03-G: An Aviation Week author-page headline for a new piece
  can itself be a WebFetch summarization artifact: a listed headline
  ("Pentagon Space-Based Target Tracking Constellations Take Shape")
  could not be found verbatim anywhere via WebSearch, including on
  Aviation Week's own site (the guessed URL 404'd); left uncovered
  rather than draft from a possibly-mistitled summary. Worth a direct
  re-fetch of the author-page listing (not a single AI-summarized pass)
  before trusting an unusual-sounding headline enough to chase it.
- 2026-10-03-H: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 0 new, 1 updated, 0 held") plus a direct `jq`
  read of the updated item's patched `what_happened`/`snr`/`sources`
  fields (unchanged SNR 4, no new source added) as the build-health
  signal.

## Narrow re-check, ~5h12m gap, unfiltered full source list (2026-10-03, third)

- 2026-10-03-I: A same-event escalation within the 7-day window is an
  `attach`+`bump` update, not a new item, even when the actor moves up a
  level: Zelenskyy personally telling the FT (Oct. 3) that he has
  repeatedly asked Trump to sanction Rassvet's backers is the same
  underlying "Ukraine seeks US sanctions on Rassvet suppliers" event as
  the Sept. 30 item sourced to Ukraine's Washington envoy, just a more
  senior speaker with a new fact (China named as a collaborator) three
  days later. `corroboration_2plus` stacked cleanly on top of the
  original item's `corroboration_none` penalty (different modifier
  types, not a saturation conflict), landing SNR 2 -> 3. The turkiyetoday.com
  Google News candidate itself 404'd on direct fetch; the FT interview
  (paywalled, standing unfetchable per 2026-10-03-B precedent) was only
  usable via two independent Ukrainian outlets (Ukrainska Pravda, UNN)
  that both quoted it directly, re-confirming the paywalled-lede pattern
  works for a head-of-state interview too, not just corporate press.
- 2026-10-03-J: A video-description claim ("SpaceX just filed the first
  real construction permit for Starbase Louisiana, with a bridge, a
  wharf, and five million cubic yards of dredging in it," Felix
  Schlang's Oct. 3 upload) could not be pinned to one dateable, fetchable
  filing: Starbase Louisiana's bridge/wharf/dredging permits are several
  separate, weeks-old, still-pending items (LA 82 bridge replacements,
  Army Corps Freshwater Bayou maintenance dredging, a pending Corps test-pit
  permit) per direct search, not one new filing matching the "5 million
  cubic yards" figure anywhere. Left undrafted rather than compress an
  ongoing multi-permit process into a single invented event; the
  video-description-as-source rule still requires the description's
  claim to be independently pinnable to a real, dated fact.
- 2026-10-03-K: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 0 new, 1 updated, 0 held") plus a direct `jq`
  read of the updated Rassvet item's patched `headline`/`tags`/`snr`/
  `snr_trace`/`sources` fields (SNR 2 to 3, two new mainstream sources
  attached) and the sweep log's `snr_movements` entry as the
  build-health signal.

## Deep sweep (~11h52m gap, two prior zero-add sweeps, unfiltered full source list, 2026-10-04)

- 2026-10-04-A: An EU Council Sept. 28 "SPACE" defence-project funding-
  eligibility story, found independently via Andrew Parsonson's bluesky
  post AND a discovery-pass search, read as a genuine gap (grepping
  items.json for "27 billion"/"shared tracking data"/"Space Shield"
  found nothing) until a full-text draft of it hit finalize-sweep's
  dedup gate and surfaced `2026-09-28-eu-defence-projects-space-edpci-
  endorsement`, an already-published first_party item (ec.europa.eu +
  Defense News) using a differently-worded headline ("EU states endorse
  space project...") and EUR-denominated figures (EUR24B/EUR190B) where
  my search results had surfaced USD-converted figures ($27B) via
  SpaceNews. Worth grepping both currency formats (and a looser
  "EDPCI"/"defence project" term) before concluding a EUR-figured EU
  story is undrafted; a same-day institutional decision reported in two
  currencies is a classic near-duplicate-miss shape.
- 2026-10-04-B: Fully confirms the standing deep-sweep pattern
  (2026-09-07-C and many peers): the 744-candidate 7-day queue, all 5
  mandatory HTML sources, all 13 non-redundant fetchable signals
  channels, 6 xSearch handles and a 12-query discovery matrix converged
  on stories already published across the preceding four days of
  same-day sweeps, net one new supplementary fact (a Starbase Louisiana
  incentive-contract penalty clause, patched as an update with no SNR
  change since the item was already at the first-party ceiling).
  Several near-misses were resolved as stale resurfacing on direct
  fetch rather than drafted: an NEC optical-constellation "plan"
  Google News piece traced to a March 2026 press release
  (`nec.com/en/press/202603/...`), a Singapore "Earth Observation
  Initiative" EDB page traced to a February 2025 announcement despite
  an Oct. 1, 2026 Google News timestamp, and a Fox35 "Space Octopus"
  clip was Kall Morris's (KMI Space) already-published July 29 REACCH
  ISS demo under a new local-TV headline.

## Narrow re-check, ~7h22m gap, unfiltered full source list (2026-10-04, second)

- 2026-10-04-C: Serco's own newsroom (serco.com) 403'd on every direct
  WebFetch attempt for its new NadirEO Earth-observation-data platform
  (both the `/eu/` and `/uk/` press pages); no second trade/mainstream
  pickup was found on a targeted search either, so the item ran single-
  sourced on a directly-fetched Il Sole 24 Ore piece (`mainstream`,
  `crawl: found_none`), landing an honest SNR 2. Serco has no
  `src/data/registry` organization entity, same no-registry-host
  workaround as Arianespace/Astranis/Aerospacelab.
- 2026-10-04-D: A direct author-page fetch (Vivienne Machi's Aviation
  Week listing) confirmed "Pentagon Space-Based Target Tracking
  Constellations Take Shape" (Oct 2) genuinely exists, resolving
  2026-10-03-G's suspicion that the headline was a WebFetch
  summarization artifact -- but a WebSearch synthesis of the piece
  showed it is itself a recap of already-published AMTI contracts
  (SpaceX's $4.16B award, the Rocket Lab/STR $615M total), so it was
  still left undrafted for lack of a new fact, just for a different
  reason than originally suspected. Worth checking an author-page
  listing directly before assuming a headline is fabricated, but still
  verifying the piece's actual content adds anything new.
- 2026-10-04-E: A government official's own on-the-record threat is a
  clean `updates[].patch`+`attach` layered onto an existing geopolitical
  item, not a new item or a bump: Medvedev's Telegram warning that
  blocking Russia's Rassvet satellites could trigger "full-scale space
  war" is Russia's direct response to the already-published Ukraine/
  Zelenskyy Rassvet-sanctions item, so it was folded in as a supplementary
  fact (no bump requested, since it corroborates nothing about the
  original sanctions-request claim). Classed the two outlets covering it
  (A News, Bluewin) `informal` rather than `mainstream`, being general
  regional portals rather than recognized national press.
- 2026-10-04-F: A SPAC merger's "signed" announcement and its "closed,
  began trading" milestone months later is the same `updates[].patch`
  treatment as a funding round reaching its closing milestone
  (2026-09-07-M/2026-09-08-L): NorthStar Earth & Space's April 17
  SPAC-merger-signing item never got its Oct 1 close/Oct 2
  NYSE-trading-start milestone attached at all until this run surfaced
  it via the discovery pass; patched with no bump since the original
  `wire_pr` lead was already at its tier-4 ceiling.
- 2026-10-04-G: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 1 new, 2 updated, 0 held") and the item count
  moving from 832 to 833, plus a direct read of the new item's and both
  updated items' `snr`/`snr_trace`/`sources` fields as the build-health
  signal.

## Narrow re-check, ~4h12m gap, unfiltered full source list (2026-10-04, third)

- 2026-10-04-H: A parody/mocking Bluesky account (quoting "Pravda_Gerashchenko",
  asking "Is #Medvedev on a three vodka bottle binge today?") garbled the
  already-published Oct. 4 Medvedev "full-scale space warfare" threat's
  satellite-program name from Rassvet to "Razryad" -- a new shape of
  stale-resurfacing trap distinct from the standing wrong-date/wrong-year
  cases: here the event and date were both correct, only the proper noun
  was wrong, introduced by an unreliable satirical account rather than a
  content-mill rewrite. A quick WebSearch for "Medvedev Razryad" confirmed
  no such program exists and that every real report names Rassvet; left
  undrafted as the same already-covered item rather than a new Razryad
  story.
- 2026-10-04-I: A genuine gap on Kyrgyzstan's first national satellite
  (Transporter-18 rideshare, Oct. 1) needed reconciling two source
  families that each named a different "builder": the state-owned
  program itself is Kyrgyz Asman (established 2026, renamed from
  "Kyrgyz Sputnik", per the Times of Central Asia's pre-launch piece),
  while the actual integrator is Kyrgyz Electronics, directed by Ilya
  Cherny (per Tech Times' post-launch piece) -- not a contradiction,
  just program-owner vs. contractor, resolved by attributing each name
  to the source that stated it rather than picking one. Separately, a
  UAE "cooperation" claim appeared in several wire-style regional
  outlets with zero detail; Tech Times was the only source to flag
  explicitly that "the specific nature of that partnership...has not
  been detailed publicly," which settled the ambiguity (real but vague)
  rather than treating conflicting silence elsewhere as grounds to drop
  it. RFE/RL's and one Times of Central Asia article were both
  pre-launch-dated (future tense, "scheduled to take place"); picked
  TASS (post-launch, past tense) as the lead instead and used the
  pre-launch pieces only for background facts that don't change
  pre/post launch (team size, program history).
- 2026-10-04-J: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 1 new, 0 updated, 0 held") and a direct `jq`
  read of the new item's `snr`/`snr_trace`/`category`/`impact`/`sources`
  fields (834 items, up from 833) as the build-health signal.

## Narrow re-check, ~4h31m gap, unfiltered full source list (2026-10-04, fourth)

- 2026-10-04-K: A satnews.com piece restating Elon Musk's per-satellite
  Starmind specs (250kW solar power, 10Tbps bidirectional connectivity,
  a path to 100+Tbps, Vera Rubin NVL72 compute) traced the actual specs
  to two Musk X posts dated Sept 20 and Oct 1, both outside this run's
  window and already recycled across teslanorth.com/benzinga/
  nextbigfuture for two weeks. Rather than draft a stale "recycled
  talking point" item, folded the verbatim figures into the existing
  Aug 4 Nvidia-exclusivity item as an `updates[].patch`+`attach`
  enrichment (no bump requested): that item already named the Vera
  Rubin NVL72 architecture but had no per-satellite power/throughput
  numbers, so this is a genuine new fact for the copy even though the
  underlying tweets are stale and the item was already at its
  non-first-party corroboration ceiling (adding a 4th/5th/6th source
  past `corroboration_2plus` is a documented no-op per the climb
  ceiling, confirmed again here).
- 2026-10-04-L: SDA's Tranche 1 Transport Layer "A" (Northrop
  Grumman-built, the program's third vendor after York/Lockheed) is
  scheduled for Oct. 5, status "Go for Launch" per Launch Library;
  SpaceflightNow's own "live coverage" page, several Bluesky
  queue hits, and an Aviation Week author-page piece ("SDA Preps For
  3rd Tranche 1 Vendor Launch Amid Sat Integration Woes") all cover
  this same not-yet-flown mission. Left undrafted per the standing
  don't-draft-scheduled-launches rule; worth checking next sweep for
  the actual outcome. Note: WebFetch's summary of the SpaceflightNow
  live-coverage page read as if the page were still accurate hours
  after a stated past launch time, when the real net was actually a
  day later — cross-checking Launch Library's own `net`/`status.name`
  directly (2026-09-26-I's lesson) resolved the ambiguity cleanly.
- 2026-10-04-M: A GomSpace GOMX-5 (8U CubeSat, Transporter-18,
  ESA-supported) press release was judged too thin to draft despite
  being genuinely undrafted and dateable (Oct 1): GomSpace's own
  release names no customer, contract, or dollar figure, only generic
  "validates technologies with potential for future customer
  programs" language; left out per the standing thin-tech-demo
  exclusion (Planet's GEOINT blog post, LiveEO/INSPECTEO precedents)
  rather than published on a floor SNR for a non-fact. A Rio Grande
  Guardian op-ed defending the already-published Aug 29 Brownsville/
  SpaceX water disannexation deal and a SWISS Airlines Starlink-WiFi
  launch (genuinely new per-airline milestone, but already a week
  stale and `noise`-tier, so not chased) were both left unpatched/
  undrafted for adding no new fact beyond what's already on their
  respective cards. India's 5.56km QNu Labs/BISAG-N quantum-key-
  distribution field trial was judged out of scope entirely: it is a
  ground-to-ground free-space optical link between two terrestrial
  institutions, no satellite or orbital component at all despite the
  space-agency-adjacent participants.
- 2026-10-04-N: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 0 new, 1 updated, 0 held") and a direct `jq`
  read of the updated item's patched `explainer.what_happened` and six-
  source `sources` array (unchanged SNR 4, confirming the ceiling

## Narrow re-check, ~7h10m gap, unfiltered full source list (2026-10-05)

- 2026-10-05-A: A `wire_pr`-led item (SFL Missions' GHGSat-D2 contract,
  BusinessWire-distributed, Sept 28) with one `trade`-class corroboration
  (SpaceQ, independently written) landed zero corroboration modifier
  (`modifiers: []`, final SNR held at the wire_pr base tier of 4) rather
  than the `corroboration_2plus` bump a naive reading of the spec would
  predict -- worth remembering a single non-mainstream corroboration
  source on top of a wire_pr lead doesn't always move the score; the
  math is code and this is an honest outcome, not a bug to chase.
  businesswire.com and a lelezard.com mirror both 403'd on direct
  WebFetch; a third mirror (amerisurv.com, The American Surveyor) fetched
  cleanly with the full press release text and executive quotes, used as
  the lead instead.
- 2026-10-05-B: Two more stale-resurfacing traps from generic discovery
  queries: a SpaceNews "Landspace secures launch contracts for China's
  megaconstellation projects" piece traced to January reporting (9+
  months stale, from Landspace's IPO filing period), left undrafted as
  far outside any reasonable predates-window chase; and a nuclear-news.net/
  americanpartisan.org/sgtreport.com "exploding satellite: act of war?"
  wave was the already-published Sept 13 USA-32 breakup
  (2026-09-13-usa-32-satellite-breakup) resurfacing on fringe/conspiracy
  sites with speculative framing added, not a new fact -- left unpatched.
- 2026-10-05-C: ESA's own Smile mission page (already an item's
  `source_url` at the first-party SNR 5 ceiling) had been updated in
  place with new content -- the mission's first released images (a July
  24 UVI auroral-substorm view, an SXI test shot of Cassiopeia A) -- with
  no URL change, same shape as 2026-10-03-F's "re-read an item's own
  already-cited source" pattern. Patched with no new `attach`/bump since
  the fact lived on the existing `source_url`.
- 2026-10-05-D: A Bluesky post linking to an Ars Technica piece (itself
  unfetchable, standing block) led to a genuinely new supplementary fact
  for an already-published, SNR-5-ceilinged item: Jessica Watkins became
  the first Black woman to command a crewed orbital spaceflight (Crew-13,
  Oct 1). Wikipedia stated this clearly but was not used as the citable
  source (Wikipedia's registry-sourcing relaxation doesn't extend to news
  items); PBS NewsHour and AOL, both independently fetched, confirmed the
  same fact in their own words and were attached instead. No bump
  requested since the item's `what_happened` enrichment didn't change
  the sourcing tier.
- 2026-10-05-E: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 1 new, 2 updated, 0 held") and the item count
  moving from 834 to 835, plus a direct read of the new item's and both
  updated items' `snr`/`snr_trace`/`sources` fields, and the sweep log's
  two unrelated persistence-bump `snr_movements` entries, as the
  build-health signal.

## Narrow re-check, ~9h30m gap, unfiltered full source list (2026-10-05, second)

- 2026-10-05-F: Redwire's registry `website` field still records the
  retired `redwirespace.com` domain, which now 301-redirects to `rdw.com`
  (a rebrand, same pattern as `hubblenetwork.com`->`hubble.com` and
  `aerospacelab.be`->`aerospacelab.com`); `ir.rdw.com`'s own press page for
  a new Axiom Space ROSA follow-on contract therefore still fails the
  anti-spoof `first_party` host check against the stale registry value.
  Led instead with a StockTitan mirror explicitly credited "Business Wire"
  (`wire_pr`, tier 4, better than the mainstream Investing.com pickup
  would have given), and used `ir.rdw.com` itself only as `informal`
  corroboration. Worth a registry update to `rdw.com` at a future
  structural touch.
- 2026-10-05-G: A new company-with-no-registry-entity pairing: Nebex (a
  space-sector financial-exchange startup founded by two former Axiom
  Space executives) and Thrusters Unlimited (a Mexican EO operator) have
  neither one a `src/data/registry` organization entity, so their joint
  $700M Mexico-sovereign-space financing announcement led on a WebWire
  press-release mirror (`wire_pr`) rather than either company's own site,
  extending the standing no-registry-host workaround to a financial-
  services space startup for the first time.
- 2026-10-05-H: A `pulse2.com`-style press-release-aggregator page (no
  original reporting, just a close restatement of the underlying EXIM/
  company release) still counts as a genuinely distinct second source for
  `crawl: "found_some"` purposes, classed `informal`, same treatment as
  the standing "weak sourcing still counts as a second source" rule
  (2026-09-09-L) -- it does not need to add new facts to count, only to
  exist as a separately-fetched page.
- 2026-10-05-I: A discovery-pass National Geographic "space junk near-miss"
  snippet claimed an October 15, 2026 close-approach event -- ten days
  AFTER this sweep's own `now` (Oct 5). Treated as an unconfirmable/likely
  mis-dated search artifact (not a source directly fetched) and left out
  entirely rather than guess at a future-dated claim; worth a direct fetch
  next time a search snippet's own stated date postdates the sweep's `now`,
  since that is never possible for a real past event.
- 2026-10-05-J: The standing Bluesky stale/cross-contaminated-cache pattern
  (2026-09-26-B/-O, 2026-09-30-E) recurred on a THIRD consecutive sweep day:
  Caleb Henry's and Tim Farrar's `getAuthorFeed` API responses were still
  stuck on pre-August 2026 posts, and Marco Langbroek's feed, while
  genuinely current (posts through Oct 5), was entirely off-topic Dutch
  politics content with no space posts in the returned window at all.
  Andrew Jones's feed was current only through Sept 30, five days stale.
  Treated all four as checked-but-empty rather than re-querying repeatedly;
  the channels that return cleanly (Josef Aschbacher, Jeff Foust, Marcia
  Smith, Anatoly Zak, Andrew Parsonson) continue to be the reliable core of
  this leg.
- 2026-10-05-K: Iran's Starlink-threat thread escalated again within the
  same item's 7-day+ window: a Sept 30 single-source `informal` warning
  (SNR 1) grew a same-week diplomatic protest to Norway (formal note to
  the ambassador) plus a cyber-council official's "legitimate military
  target" threat, independently confirmed via Mehr News (Iranian state
  media, `informal`) and Daily Times (Pakistani mainstream, `mainstream`)
  -- landed `mainstream_pickup` (+1, SNR 1 to 2) via `updates[].patch`+
  `attach`, with a full-field `explainer`/`headline` replacement rather
  than an append, since the diplomatic escalation was the more newsworthy
  framing than the original "undermines internet control" quote.
- 2026-10-05-L: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 3 new, 1 updated, 0 held") and the item count
  moving from 835 to 838, plus a direct read of all three new items' and
  the updated item's `snr`/`snr_trace`/`category`/`impact`/`sources`
  fields, and the sweep log's `mainstream_pickup` `snr_movements` entry,
  as the build-health signal.
  no-op) as the build-health signal.

## Narrow re-check, ~1h49m gap, unfiltered full source list (2026-10-05, third)

- 2026-10-05-M: `dedup_distinct` on a new item belongs at the item's TOP
  LEVEL (sibling of `scoring`/`crossfeed`), not nested inside
  `scoring.dedup_distinct`; finalize-sweep's dedup gate reads `raw.dedup_distinct`
  and silently ignores it in the wrong place, so a first attempt with it
  nested under `scoring` still rejected with the exact same unattested-match
  errors even though the acknowledgment was present in the draft.
- 2026-10-05-N: A whitelisted signal's post found via a general bluesky-feed
  check (not a targeted handle search) led to a genuine predates-window gap:
  Jeff Foust's Oct 5 IAC2026 post flagged an ESA talk citing a "late 2027"
  Artemis III date against NASA's still-public "mid-2027," which traced back
  to NASA Administrator Isaacman's Sept 20 staff memo ("~90 days broken
  against the Artemis III schedule," obtained by NASA Watch, reported by
  Fox 35 Orlando Sept 24) -- never drafted by any prior sweep despite being
  two weeks old. Worth the reminder that a single vague social post is
  sometimes just the thread to pull, not the citable fact itself: the memo,
  not the IAC2026 post, became the lead.
- 2026-10-05-O: A discovery-pass hit (Andrew Parsonson's "ESA Selects Airbus
  and OHB to Lead European Space Station Studies") read as a genuine gap
  until a full draft hit finalize-sweep's dedup gate and surfaced
  `2026-09-29-esa-orbital-outpost-studies`, already published same-day at
  SNR 5 from ESA's own first-party release with the exact same Airbus/OHB
  Pre-Phase A/`EUR1B`-per-period facts, just reached via a European
  Spaceflight mirror rather than esa.int itself. Worth checking
  `source_url`-adjacent first-party domains (here, esa.int) before trusting
  a trade-press mirror's framing as the only account of an ESA decision.
- 2026-10-05-P: Two more recycled-content traps, both left undrafted: (1) a
  Euromaidan Press "Ukraine wants to aim Starlink at Russian targets and
  build a version Musk can't switch off" (Oct 4/5) bundled Zelenskyy's
  Aug 23 "we have started testing it" European-alternative remark and Fire
  Point's June 7 "satellite constellation for Ukraine and Europe" quote
  under a fresh conflict-framed headline, with no genuinely new fact
  (confirmed via direct fetches of the Aug 23 and June 7 originals); (2) a
  Morgan Stanley SpaceX "AI, Starship upside" wave (6+ outlets, Oct 5) was a
  reiteration of the SAME $300 target Adam Jonas set July 7 and reiterated
  Sept 15, just with a new AI-compute/broadband/launch/X-Grok component
  breakdown -- consistent with the standing same-number-reiteration
  skip rule (2026-09-06-A), even though the breakdown framing was new.
- 2026-10-05-Q: An Iranian official's "disabled Starlink terminals during
  the recent war" claim (WANA/Mehr News, Oct 5) and a "95% of initial
  phase tests complete" Gaganyaan claim (Times of India, via Google News)
  both turned out to be already-captured or unverifiable: the Iran claim
  restates the same Aghamiri quote the existing
  `2026-09-30-iran-official-starlink-internet-control-warning` item already
  carries (just "January 2026 unrest" vs. this piece's vaguer "recent war"
  wording); the Gaganyaan figure couldn't be confirmed since
  timesofindia.indiatimes.com is unfetchable in this environment and every
  other search hit cited a different percentage (80/90%) from months
  earlier. Left both unpatched/undrafted.
- 2026-10-05-R: Eric Berger's bluesky feed (`sciguyspace.bsky.social`, via
  the `public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed` endpoint) is
  stuck on posts through June 23, 2026 -- a new name on the standing
  stale/cross-contaminated-cache list (2026-09-26-B/-O, 2026-09-30-E,
  2026-10-05-J), now five bluesky accounts affected. The bare
  `bsky.app/profile/<handle>/post/<id>` WebFetch route still only returns
  the handle with no post text (confirms 2026-09-06-Q); the
  `getAuthorFeed` endpoint works for named accounts but a plain
  `searchPosts` call to the same API 403'd, so there is still no reliable
  way to read content from generic (non-signals) bluesky search-queue hits.
- 2026-10-05-S: `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 2 new, 0 updated, 0 held") and the item count
  moving from 838 to 840, plus a direct read of both new items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow re-check, ~6h gap, unfiltered full source list (2026-10-06)

- 2026-10-06-A: A company's own press release, wire-distributed (Business
  Wire via a StockTitan mirror), outranks an independently-written trade
  article as the lead even when the company (York Space Systems) has no
  `src/data/registry` organization profile: `wire_pr` base tier 4 beat the
  `trade`-tier Via Satellite/SpaceNews pieces on the same York/Space Force
  Tetra 3-4 GEO-integration story, which were attached as corroboration
  instead. Finding the wire mirror took a second search specifically for
  the company's own release after the trade pieces surfaced first.
- 2026-10-06-B: Anadolu Agency (AA), Turkiye's state-run wire service,
  treated as `mainstream` class (not `informal`) for a factual company
  announcement (Aselsan unveiling its Gokbagi/Astralink LEO constellation
  at IAC 2026) with no performance or intent claim at stake, consistent
  with the standing TASS/state-media-as-mainstream precedent (2026-07-19
  and peers) now extended to a Turkish outlet for the first time. Worth
  remembering for future Turkiye-sourced items.
- 2026-10-06-C: AA's own English AND Turkish-language articles on the
  same Aselsan unveiling both omitted the specific 198-satellite count
  and 2028-2029 launch timeline that a narrower Turkish defense-trade
  outlet (defenceturk.net) stated; attributed those specific figures only
  to defenceturk.net rather than implying AA confirmed them. A same-outlet,
  two-language check (English vs Turkish AA) is worth doing before
  assuming a wire service's own-language original carries a figure its
  English translation omits, or vice versa.
- 2026-10-06-D: satcom.digital, used as a second source for a Kratos
  space-intelligence-contracts item, turned out on inspection to be a
  verbatim press-release republish (byline present, but content and
  structure mirror the company release with no independent reporting) --
  still counted as a genuinely distinct fetched page for `crawl:
  "found_some"` per the standing pulse2.com/NordiskPost precedent
  (2026-10-05-H and peers), classed `informal` rather than `trade`.
- 2026-10-06-E: An FAA internal memo (June 8) disclosed only via a trade
  outlet's October 5 report (The Air Current, after obtaining the memo)
  was dated on the actual June 8 decision date, not the October 5
  reporting date, per the standing predates-window chase convention; a
  single targeted follow-up search for the memo's own title found no
  independent pickup, landing an honest `crawl: "found_none"` single-source
  SNR 2 rather than a forced higher score.
- 2026-10-06-F: `finalize-sweep.ts` merged cleanly on the first attempt
  ("merged 6 new, 3 updated, 0 held"); confirmed via a direct read of all
  six new items' and all three updated items' `snr`/`snr_trace`/
  `category`/`impact`/`sources` fields, the `corroboration_collapses`
  entry (KSAT's own release vs. a PR Newswire mirror, correctly collapsed
  as a wire rewrite), and four unrelated persistence-bump `snr_movements`
  entries in the sweep log.

## Narrow re-check, ~4.6h gap, unfiltered full source list (2026-10-06, second run)

- 2026-10-06-G: Caleb Henry's bluesky feed (`chenryspace.bsky.social`) is
  now also stuck on a stale cache (newest post Sept 30, with the rest of
  the visible feed dated back to June), joining the standing stale/cached
  bluesky list (2026-09-26-B/-O, 2026-09-30-E, 2026-10-05-J/-R) -- six
  accounts affected now. Tim Farrar's (`tmfassociates.bsky.social`) is
  stuck even further back, on July 26. The `getAuthorFeed` endpoint still
  returns content for all of them, just old content; there is no error to
  catch, only a date check against `lastSweep` to catch it.
- 2026-10-06-H: For `signalsPass.checked`, use the exact `url` field
  candidates-context/signals-context prints for each fetchable entry, not
  the `rss` field when both exist: Andrew Parsonson's substack entry has
  `url: "https://europeanspaceflight.substack.com"` and a separate `rss`
  pointing at `/feed`; passing the `/feed` URL made finalize-sweep reject
  the draft ("not a fetchable whitelisted signal channel"). Fetching via
  the `rss` URL is fine; just report the channel's own `url` back.
- 2026-10-06-I: `draft.coverage` takes `Category` values (the
  CLAUDE.md/schema category enum: launch, constellation, contract, ...),
  not domain tags like `eo`; `"eo"` in coverage is a hard rejection, not a
  warning.
- 2026-10-06-J: A Google News "launch" query feed on a quiet day can be
  almost entirely SpaceX stock-price churn (Musk's trillionaire-again
  cycle, 10+ near-duplicate outlets same afternoon) with zero on-scope
  signal; that is a legitimate zero-add outcome for that leg, not a sign
  the queue needs a wider net.
- 2026-10-06-K: Unseenlabs' BRO-23/BRO-32 joint Gen1+Gen2 launch (Oct 1,
  PR Newswire) was still undrafted five days later: it had surfaced only
  via a sponsor-spam-laden Bluesky repost in the queue, easy to dismiss on
  sight, but the underlying claim (two generations flown together, fleet
  to 25) checked out cleanly against the operator's own release plus two
  independent trade pickups (Military Aerospace, Via Satellite). Worth
  reading past a spammy-looking Bluesky wrapper to the fact underneath
  before discarding it.
- 2026-10-06-L: `finalize-sweep.ts` merged cleanly on the second attempt
  after fixing -H and -I above ("merged 1 new, 0 updated, 0 held");
  confirmed via a direct read of the new item's `snr`/`snr_trace`
  (wire_pr base tier 4, no modifiers applied since the wire-pr cap holds
  it at 4 regardless of the two trade corroborations) and the
  `registry-candidates.json` `flag_refresh` entry for
  `unseenlabs.sats_launched_total` (23 to 25).

## Narrow re-check, ~6h gap, unfiltered full source list (2026-10-06, third)

- 2026-10-06-M: A same-program follow-up 29 days after the original item,
  outside both the 7-day same-event and 30-day reinforcement windows, is
  still a clean `updates[].patch`+`attach` case rather than a new item
  when it is genuinely the same ongoing government program restated with
  new figures: Kazakhstan's Oct. 6 government meeting (deputy PM Madiyev,
  per Kazakhstan Today) gave a concrete breakdown of the Sept. 7 nine-
  satellite EO constellation item's "six Kazakh satellites" (three high-
  resolution, three medium-resolution), a new five-year economic-impact
  figure, and a $70M value for the partner-country export projects.
  Treated as an enrichment patch (same lead class, no bump) rather than a
  new item, consistent with the standing ESA-ERS-EO/Starbase-ruling
  enrichment pattern even though the literal dedup windows had elapsed.
  A WebSearch synthesis for this story also conflated in a South
  Korea/CONTEC manufacturing detail from a different Kazakhstan Today
  article; the directly fetched page did not state it, so it was left out
  per rule 2 rather than trusted from the search summary alone.
- 2026-10-06-N: A Payload exclusive (HawkEye 360's AFRL-funded whitepaper
  on using its RF sensors to characterize OTHER satellites' behavior in
  LEO/MEO/GEO) found zero independent pickup on two separate searches;
  published honestly at `crawl: "found_none"` (trade base 3, final SNR 2)
  rather than held for being single-sourced, per the standing weak-
  sourcing-is-not-a-hold-reason rule.
- 2026-10-06-O: A months-stale KBR/USGS $350M Earth-observation IDIQ
  contract (actual company release dated January 5, 2026) recirculated
  today via stock-reaction aggregators (Investing.com, GuruFocus, Simply
  Wall St, framed around a same-day stock move) with no new fact --
  caught only by fetching KBR's own press release directly and reading
  its stated date, since every WebSearch snippet read as current. Left
  undrafted; extends the standing stale-resurfacing-via-stock-reaction-
  piece pattern (2026-09-06-A and peers) to a government-services IDIQ
  rather than an analyst price target.
- 2026-10-06-P: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 4 new, 1 updated, 0 held"); confirmed via a
  direct `jq` read of all four new items' `snr`/`category`/`impact`
  fields (851 items, up from 847), the Kazakhstan update's patched
  `explainer.what_happened` and five-source `sources` array, and the
  sweep log's `corroboration_collapses` entry (Global Invacom's own blog
  post vs. a Satellite Evolution Group republish, correctly collapsed as
  a wire rewrite) as the build-health signal.

## Narrow re-check, ~3.5h gap, unfiltered full source list (2026-10-06, fourth)

- 2026-10-06-Q: A predates-window local-news story (McGregor, Texas city
  council settling a $175,000 groundwater-overpumping penalty tied to
  SpaceX's rocket-test site, first reported Sept 30) led on a small
  nonprofit newsroom (Waco Bridge) with a second NPR-affiliate pickup
  (KEDT) that turned out to carry the exact same headline and text (a
  Texas Newsroom collaborative piece); finalize's title-collapse
  correctly caught it as a `wire_rewrite`, so the item landed an honest
  single-source-equivalent SNR 1 (informal base, no corroboration
  credit) rather than the SNR 2 a naive two-source count would predict.
  Worth expecting near-identical-headline local-public-radio pickups to
  collapse even when they're hosted on genuinely different nonprofit
  domains.
- 2026-10-06-R: A literal Musk exclamation mark in a direct quote
  ("...it will have no chance of accessing the Internet!") tripped the
  gate's blanket "exclamation marks never publish" rule even inside a
  quoted/attributed sentence; rewrote the sentence to drop the mark
  while keeping the quoted clause intact rather than omit the fact.
  The rule applies to the rendered copy, not just unquoted agent prose.
- 2026-10-06-S: A same-company-plus-category dedup false positive fired
  three ways on a new SpaceX/McGregor groundwater item (category
  `regulatory`): against an unrelated Iran/Starlink item, an FAA
  Starship SLC-37 EIS item, and a Florida gas-pipeline item, sharing
  nothing but company SpaceX + category + window. Three
  `dedup_distinct` entries (using the REAL matched item ids, not an
  invented placeholder id — the gate rejects a mismatched id) cleared it
  in one pass.
- 2026-10-06-T: A Bloomberg-exclusive story (NASA eyeing bulk multi-rocket
  purchases for its Moon Base, naming program manager Carlos
  Garcia-Galan) was fully paywalled/403'd at the source, but two
  independently-fetched stock-reaction mirrors (TradingView/Benzinga,
  MoneyCheck) carried the same direct quote verbatim; drafted at an
  honest `informal`-base SNR 2 via `corroboration_2plus` rather than
  held for weak sourcing. The older, already-published "SpaceX stops
  booking Falcon 9 past 2028" fact was treated as background context,
  not the news peg, since only NASA's bulk-buy response was new.
- 2026-10-06-U: `finalize-sweep.ts` merged cleanly on the third attempt
  after fixing -S and -R above ("merged 4 new, 0 updated, 0 held");
  confirmed via a direct read of all four new items' `snr`/`snr_trace`/
  `category`/`impact` fields (855 items, up from 851) and the sweep
  log's `corroboration_collapses` entry (McGregor item, Waco
  Bridge/KEDT wire rewrite).

## Narrow re-check, ~4.6h gap, unfiltered full source list (2026-10-06, fifth)

- 2026-10-06-V: Two paywalled-at-source financial stories (a Reuters "SpaceX
  seeks $40B Apollo-led financing for Nvidia chips" brief and a Reuters
  "Anthropic IPO prospectus shows $84.5B SpaceX compute deal" report, both
  inaccessible directly via WebFetch on reuters.com/ft.com, which return hard
  "unable to fetch" errors rather than 403/timeout) were each confirmed via
  two independently-fetched secondary mirrors (ChainCatcher + Crypto Briefing
  for the Nvidia financing; Seeking Alpha + Crypto Briefing for the Anthropic
  deal) that both named Reuters/FT as the original reporter and gave matching
  figures -- drafted at `informal`/`trade` base per the standing
  paywalled-original-via-mirrors precedent (2026-10-06-T) rather than held.
  The Anthropic figure traced back to a Sept 29 original disclosure recycled
  today via a Musk-"evil"-quote framing (TheStreet); chased and dated
  2026-09-29 per the predates-window convention rather than drafted on
  today's recirculation date.
- 2026-10-06-W: Company-own-domain press-release pages (sealsq.com investor
  news release; thinkom.com's news page, which despite its URL slug
  referencing an unrelated Safran story actually rendered the Northrop
  Grumman/TACAMO announcement content when fetched) both got the exact same
  gate rejection: "host ... is not an official first_party host; reclassify"
  -- neither SEALSQ, WISeSat, nor ThinKom has a registry organization
  profile, so `first_party` can never pass the anti-spoof domain check for
  them regardless of how official the page is. Reclassified both as
  `wire_pr` and the draft passed; `first_party` is effectively reserved for
  entities with a registry profile to validate the domain against.
- 2026-10-06-X: A same-company-plus-category dedup false positive fired
  again (SpaceX + category `product`), this time against FOUR unrelated
  existing items at once (Ecuador Starlink Mobile, Alaska Air fleet
  connectivity, the community-host program, and an AT&T exec's Starlink
  comments) for a new item about SpaceX's own space-safety data platform
  launch -- same pattern as 2026-10-06-S, just wider (4 matches instead of
  3). All four cleared in one pass with `dedup_distinct` at the item's top
  level using the real matched ids.
- 2026-10-06-Y: A new WISeSat-related item (SEALSQ's $10M related-party PIPE
  investment, announced Oct 6) tripped the same-company dedup gate against
  the Oct 1 WISeSat SPAC-merger-close item despite being a genuinely
  different transaction (equity PIPE investment vs. SPAC listing); cleared
  with a one-line `dedup_distinct` reason rather than folded into an
  `updates[]` attach, since it is new news, not corroboration of the old
  story.
- 2026-10-06-Z: `finalize-sweep.ts` rejected twice on `explainer.tagline`
  exceeding 140 chars (ICEYE/California at 146, Iran EO claim at 160) before
  merging cleanly on the third attempt ("merged 8 new, 0 updated, 0 held");
  confirmed via a direct read of all eight new items' `snr`/`snr_trace`/
  `category`/`impact`/`sources` fields (863 items, up from 855).

## Narrow re-check, ~6h07m gap, unfiltered full source list (2026-10-07)

- 2026-10-07-A: A pre-event Bluesky "live now, off the pad" post for South
  Korea's 5th Nuri launch (NEONSAT-2 to 6) led to a genuine gap once chased
  past the launch window: Korea Times and Korea JoongAng Daily, both fetched
  after the window closed, independently confirmed a clean success (570km
  orbit, satellites released at 35-40s/10s intervals). A pre-launch claim
  (TechTimes/BigGo, both dated weeks before the flight) that Hanwha Aerospace
  would hold full operational command of the rocket for the first time was
  NOT repeated by either post-launch article; kept it in `why_it_matters`
  attributed to TechTimes rather than dropped or stated as confirmed, since
  neither post-event source contradicted it either. The existing Aug 13
  NEONSAT item covered KASA's pre-shipment review, a different milestone 55
  days earlier, so this was a new item, not an update.
- 2026-10-07-B: The same-company-plus-category dedup false positive now
  confirmed for Hanwha Aerospace specifically (new pattern, not just
  SpaceX/NASA/Blue-Origin/Redwire/Viasat/SES/ICEYE/ESA): a new item about
  KARI's government Nuri/NEONSAT launch false-matched the existing Sept 30
  Hanwha-reusable-rocket-demonstrator item purely on shared company + category
  `launch` + within 7 days, despite covering unrelated programs. One
  `dedup_distinct` cleared it.
- 2026-10-07-C: A brand-new FAA Part 450 licensing-NPRM item (Duffy's "five
  actions," Oct 6, surfaced via Marcia Smith's bluesky post and confirmed via
  a Reuters/Investing.com mirror) tripped the same-company-plus-category dedup
  gate FOUR ways at once against unrelated SpaceX+`regulatory` items (Iran
  Starlink threat, the Starship SLC-37 SEIS, the Florida gas-pipeline permit,
  and the McGregor groundwater settlement) sharing nothing but company+
  category+window; four `dedup_distinct` entries cleared it in one pass,
  extending the standing heuristic-fires-on-shared-company-alone finding to a
  case with four simultaneous false matches on one item.
- 2026-10-07-D: A WebSearch AI-synthesized answer stated "On October 6, 2026"
  for the Duffy FAA announcement, but several of the search-result titles it
  drew from (executivegov.com, flyingmag.com, thefederalnewswire.com) turned
  out on direct fetch to be a stale March 18, 2026 story about the FAA's
  *original* Part 450 framework completion, not today's new NPRM -- the
  genuine Oct 6 story was only confirmed by directly fetching a Reuters wire
  mirror (investing.com) and cross-checking the Federal Register's own Oct 5
  docket titles (`2026-20392`, `2026-20387`) via search. The Federal Register
  documents themselves 403'd behind an `unblock.federalregister.gov` wall on
  direct WebFetch and were correctly left uncited (title-only from search is
  not a fetch); the direct Reuters fetch was sufficient to publish honestly
  at `crawl: found_none` (every other hit traced to the same Reuters wire).
- 2026-10-07-E: SpaceX's Starbase Louisiana living-document item picked up a
  genuinely new, specific fact five days after it broke (Oct 5 coastal-use
  permit filing for a 15.5-mile heavy-haul road, 1.5-mile bridge, and a
  Freshwater City cargo wharf) via two independently-fetched mainstream
  outlets (The Advocate/Acadiana, KALB) that gave slightly different road
  lengths (15.5mi vs. 15.75mi) for the same filing -- attributed each outlet's
  own figure rather than picking one, consistent with the standing
  attribute-what-each-source-states practice.
- 2026-10-07-F: The SpaceX/Apollo/Nvidia-chip financing item (published Oct 6
  at informal-base SNR 2) got a same-day `mainstream_pickup` bump when Reuters
  independently picked up the same FT scoop with one new fact (expected 2027
  close) not in the original ChainCatcher/Crypto Briefing draft -- confirms a
  `mainstream_pickup` bump is available even on an update to a same-day item,
  not just on day-later corroboration.
- 2026-10-07-G: `finalize-sweep.ts` merged cleanly on the second attempt after
  adding the five `dedup_distinct` entries above ("merged 2 new, 2 updated, 0
  held"); confirmed via a direct `jq` read of both new items' `snr`/`category`/
  `impact`/`tags`/`companies` fields (865 items, up from 863), both updated
  items' patched `explainer`/`snr_trace` fields, and the sweep log's four
  `snr_movements` entries (one from this run's Nvidia-financing bump, three
  unrelated persistence bumps) and `flag_refresh` entries for
  `nuri-kslv-2.flights_total`/`flights_successful` (4->5, 3->4).
