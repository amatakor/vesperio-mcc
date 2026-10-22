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

## Narrow re-check, ~8h26m gap, unfiltered full source list (2026-10-07, second)

- 2026-10-07-H: A near-total-junk queue (99 candidates, almost entirely SpaceX
  stock-reaction churn on the Apollo/Nvidia $40B financing story and routine
  Crew-12 ISS-return coverage) still yielded two genuinely new FCC stories via
  the discovery pass: a granted Starlink Mobile buildout (15,000 satellites
  plus a spectrum-leasing waiver, Oct. 6, sourced to ISPreview UK + a French
  Notebookcheck.biz mirror since the English notebookcheck.net page 403'd
  directly) and a still-pending SpaceX petition to drop AFTRCC's third-party
  launch-spectrum coordination (single-sourced TipRanks, `crawl: found_none`,
  honest SNR 1; LA Times and Bloomberg's own versions of this AP-shaped story
  both proved unfetchable). Neither was in the harvested queue at all; both
  came from targeted WebSearch once the queue's generic SpaceX-financing noise
  was cleared.
- 2026-10-07-I: A same-company-plus-category dedup false positive fired on
  BOTH new FCC items against `2026-09-29-faa-starship-slc37-seis` (a wholly
  different agency/docket, FAA environmental review vs. FCC spectrum/
  satellite-count actions), extending the standing shared-company-alone
  pattern to cases where even the REGULATING AGENCY differs, not just the
  underlying fact. Also: the Themis second-wet-dress-rehearsal item (below)
  matched `2026-10-06-eu-salto-themis-deadline-extension` on shared company +
  category + window despite being a genuinely different kind of event (an EU
  administrative deadline extension vs. an actual test milestone) even though
  both belong to the same SALTO/Themis program; worth remembering
  `dedup_distinct` can legitimately apply to two items about the identical
  program when the EVENT KIND differs (a bureaucratic decision vs. a hardware
  test), not only when the underlying facts are wholly unrelated.
- 2026-10-07-J: SSC Space's own newsroom (`sscspace.com`) passes the
  anti-spoof `first_party` host check for facts about Esrange specifically,
  because the Esrange spaceport registry entity's `website` field is
  `sscspace.com` (SSC operates Esrange) -- used for a second Themis wet dress
  rehearsal (Sept. 29, announced Oct. 7 by ESA/SSC), landing a clean SNR 5
  even though neither ArianeGroup's nor SSC's domain is first-party for
  ArianeGroup facts generally. Dated the item on the actual test date (Sept.
  29) rather than the Oct. 7 announcement date, chasing the predates-window
  convention for a routine item, not just notable/seismic ones.
- 2026-10-07-K: Two same-day enrichment patches avoided drafting stale
  "new" items: Korea Times' own post-launch "cover story" on the Nuri/NEONSAT
  flight (already published same-day) added KASA's two-way-comms confirmation,
  one CubeSat (Quaternion's PERSAT02) failing to separate, and the 10-satellite
  constellation's planned revisit cadence; and the Sept. 17 SpaceX/Dragon-
  retirement item picked up NASA Administrator Isaacman's on-record
  acknowledgment plus a $3.1B NASA investment figure and SpaceX's notice to
  private station developers (Axiom, Voyager, Vast) that Dragon service ends
  after 2030, both fetched directly (Tech Times, Digital Today) rather than
  taken from a WebSearch synthesis. A third candidate enrichment (a Benzinga
  "FAA targets 1,000 launches by 2030" figure) turned out to already be fully
  present in the existing FAA Part 450 item's `why_it_matters`; checking the
  existing item's full text before treating a new figure as novel saved a
  wasted no-op patch.
- 2026-10-07-L: A whitelisted signal's bluesky post surfaced a real scoop
  (Andrew Parsonson: a FOIA'd Polish State Labour Inspectorate report on
  POLSA, four improper Article-52 dismissals) judged out of scope: it is an
  internal labor-law/governance story about a space agency's HR practices
  with no stated commercial-space angle (no contract, market access, or
  operator effect), the same institutional-disclosure exclusion applied to
  NASA-STRIDE/ASI-board/Space-Command-succession stories. Flag if a future
  installment of this series ties the findings to a commercial consequence
  (e.g., a contractor dispute or lost tender).
- 2026-10-07-M: A WebSearch result ("Long March 6A... October 17, 2026,
  Thousand Sails Polar Group 18") postdated this sweep's own `now` (Oct. 7) by
  ten days -- a future-dated search artifact, not a real retrievable fact,
  consistent with the standing 2026-10-05-I pattern; left unconfirmed rather
  than treated as a real launch.
- 2026-10-07-N: `finalize-sweep.ts` merged cleanly on the third attempt, after
  (1) adding `dedup_distinct` entries for the three same-company-plus-category
  false positives above and (2) trimming two `explainer.tagline` fields that
  initially ran 142-145 chars over the 140-char cap ("merged 3 new, 2 updated,
  0 held"); confirmed via a direct `jq` read of all three new items'
  `snr`/`impact`/`category` fields (868 items, up from 865) and both updated
  items' patched `sources`/`snr` fields.

## Narrow re-check, ~3h gap, unfiltered full source list (2026-10-07, third)

- 2026-10-07-O: `updates[].attach` alone does NOT recompute an item's SNR,
  confirmed by direct inspection: attaching a genuinely new second source
  (The Next Web, mainstream) to the single-sourced SpaceX/AFTRCC spectrum
  item left `snr`/`snr_trace` byte-for-byte unchanged at the old value
  after the merge ("merged 3 new, 2 updated, 0 held"), even though the
  `sources` array correctly grew to two entries. A second
  `updates[]` entry on the same id with an explicit
  `"bump": "corroboration_2plus"` (one of the valid bump types:
  reinforcement, corroboration_2plus, corroboration_4plus,
  mainstream_pickup) was required to actually move the score (1 to 2,
  logged in `snr_movements`). The Royal Air Maroc update in the same
  merge looked fine without a bump only because its base+corroboration_2plus
  was already at the trade-lead ceiling (4), so no visible change was
  expected either way; do not take a same-sweep plain `attach` producing
  no score movement as proof the math is wired up when the lead is at a
  ceiling. Rule of thumb going forward: whenever an `attach` is meant to
  move the score (not just add a citation), pair it with the matching
  `bump` (or a full `rescore` block for a lead upgrade) in the SAME
  update entry, and verify by reading `snr_trace.modifiers`/`history`
  after merge, not just the `sources` array length.
- 2026-10-07-P: Three new items (EU SST/TraCSS SSA data-exchange study,
  first-party sourced from space.commerce.gov; an ESA-Vast post-ISS MoU
  on using Vast's Haven station, first-party sourced from esa.int; and a
  Sateliot Draconis five-satellite IoT launch, dated on the actual Oct 2
  launch date per the predates-window convention) all merged on the
  second attempt, after (1) trimming the TraCSS tagline from 157 to under
  140 chars and (2) adding a `dedup_distinct` entry for the ESA-Vast item
  against the existing Sept 29 ESA/Airbus/OHB sovereign-outpost-studies
  item -- another instance of the standing shared-company-plus-category
  false-positive pattern, this time on "ESA" specifically rather than
  SpaceX/NASA/Blue-Origin/Hanwha, confirming the heuristic fires on any
  frequently-tracked institutional actor, not just companies.
- 2026-10-07-Q: A near-total-junk candidate queue (79 candidates after
  filtering, almost entirely SpaceX stock-reaction churn on the
  Apollo/Nvidia $40B financing story, Crew-12 ISS-return coverage, and a
  dozen Via Satellite evergreen analysis/opinion pieces with no dated
  news hook) still yielded two genuine finds via the open-web discovery
  pass that were NOT in the harvested queue at all: the EU SST/TraCSS
  study and the ESA-Vast MoU. Several queue entries that looked like new
  stories resolved to recycled olds ones on direct fetch: a BASENOR
  "Starlink Mobile V2 100x bandwidth" piece recycled a March 2026
  announcement; a Tech Review Africa "STAR.VISION/Oman Lens two new
  satellites" piece recycled a Sept 2025 TechAfrica News story; and a
  BASENOR "Royal Air Maroc, Africa's First LEO In-Flight Wi-Fi" piece
  turned out to be the first OFFICIAL confirmation of an Aug. 4 deal
  previously reported only as unconfirmed trade sourcing (Royal Air
  Maroc CEO Hamid Addou and Starlink's Lauren Dreyer both quoted on
  record), landing as a content-upgrade `updates[]` patch rather than a
  new item or a skip.

## Narrow re-check, ~5h45m gap, unfiltered full source list (2026-10-07, fourth)

- 2026-10-07-R: The standing same-company-plus-category dedup false
  positive fired a record SIX ways at once on a new Musk "oligarchs
  blocking Starlink in India" commentary item (category `regulatory`):
  against the Iran-Starlink item, the Florida gas-pipeline permit, the
  McGregor groundwater settlement, the FAA Part 450 rulemaking, the FCC
  15,000-satellite approval, and the AFTRCC spectrum fight, none of
  which share anything with Musk's India market-access commentary
  beyond company SpaceX + category regulatory + window. Six
  `dedup_distinct` entries at the item's top level cleared it in one
  pass; worth expecting this heuristic to walk literally every
  same-category SpaceX item in the 7-day window, not a handful, once
  SpaceX has had several regulatory items in one week.
- 2026-10-07-S: A trade piece covering an FCC order the agency itself
  issued (Via Satellite's deep read of the Oct. 6 15,000-satellite D2D
  grant) carried materially more regulatory detail than the two outlets
  that broke the story first (ISPreview UK, Notebookcheck): the 15-year
  license term, the 2032/2035 50%/100% build-out deadlines, the
  condition tying SpaceX's EchoStar spectrum rights to closing that
  deal's second step, and the specific bands the FCC deferred
  (2020-2025MHz Earth-to-space; 20.2-21.2/30.0-31.0GHz, citing heavy
  federal use). Folded in as an `updates[].patch`+`attach` enrichment
  with no bump requested, since the item's trade-led lead was already
  at its non-first-party ceiling of 4 — a same-event dedup match on an
  already-published regulatory order is still worth a deeper read of
  the agency's own order, not just the outlets that first reported it.
- 2026-10-07-T: Vivienne Machi's Aviation Week author-page listing
  carried a same-day "Debrief: When Will U.S. Space Force Get Its
  Optical Mesh Network?" piece that read as a potential undrafted SDA
  gap; a WebSearch of the piece's own preview text showed it is a
  historical status explainer (recapping Starlink's 2019 RF debut and
  2021 optical-crosslink addition) rather than a dateable new event or
  award — left undrafted per the standing trend/explainer-piece
  exclusion, distinct from the several SDA Tranche-vendor award items
  that DO belong on the feed.
- 2026-10-07-U: `finalize-sweep.ts` merged cleanly on the second attempt
  after adding the six `dedup_distinct` entries above ("merged 4 new, 2
  updated, 0 held"); confirmed via a direct `jq` read of all four new
  items' `snr`/`impact`/`kind` fields (875 items, up from 871) and both
  updated items' patched `explainer`/`sources` fields.

## Narrow re-check, ~5h40m gap, unfiltered full source list (2026-10-08)

- 2026-10-08-A: A genuinely new on-record fact (Bezos telling Fox News's
  "Special Report with Bret Baier," Oct 7, that a Blue Origin IPO
  "probably makes sense...several years from now," his first personal
  comment on a future listing) folded cleanly into the existing
  2026-07-08 $10B/$130B funding-round item as an `updates[].patch`+attach,
  no bump requested (non-first-party mainstream lead already at its
  corroboration_2plus ceiling of 4). Confirms the standing "enrichment
  patch, no rescore" pattern applies even when the new fact is a fresh
  on-record quote, not just a closing/escalation milestone.
- 2026-10-08-B: A LeoLabs Meteor 2-7 fragmentation event (Oct 5, Soviet-era
  weather satellite) had exactly one source (spacewatch.global) and it
  403'd on every direct-fetch attempt (including the full article URL);
  no LeoLabs own blog/X post and no second outlet were findable. Left
  undrafted per the standing never-cite-an-unfetched-page rule even
  though WebSearch could describe it in full. Worth a second look if
  spacewatch.global becomes fetchable or a second outlet picks it up.
- 2026-10-08-C: The FCC's Oct. 29 vote on a 25MHz D2D spectrum auction
  (1675-1695/2020-2025MHz bands) plus a companion 482MHz NPRM is a
  scheduled, not-yet-decided proposal (CNBC, Oct 7) distinct from the
  already-published Oct 6 15,000-satellite D2D grant; left undrafted per
  the standing process-not-yet-fact rule (same shape as the Sept 30
  FCC-vote precedent before it happened). Worth checking after Oct 29.
- 2026-10-08-D: NASA's Crew-12 return: SpacePolicyOnline's own calendar
  (fetched directly) showed undock already moved to Oct 7, 8:05am ET and
  splashdown scheduled Oct 8, 11:24am ET, i.e. AFTER this sweep's own
  `now` (05:18 UTC) despite a same-day C-SPAN "Crew-12 Return to Earth"
  queue headline reading like a completed event. Left undrafted per the
  standing don't-draft-a-scheduled-not-yet-occurred rule; check the next
  sweep for the actual splashdown.
- 2026-10-08-E: `finalize-sweep.ts` merged cleanly on the first attempt
  ("merged 0 new, 1 updated, 0 held"); confirmed via a direct `jq` read
  of the updated Blue Origin item's patched `explainer`/`sources`/
  `updates` fields (SNR held at 4, as expected) and the sweep log's two
  unrelated persistence-bump `snr_movements` entries.

## Narrow re-check, ~8.6h gap, unfiltered full source list (2026-10-08, second)

- 2026-10-08-F: The same-company-plus-category dedup false positive extended
  to ESA/`constellation` specifically: a new Sentinel-3C first-light item
  (ESA's own release, two weeks after the Sept 15 launch) false-matched
  `2026-10-01-iride-eaglet-ii-constellation-complete` on nothing but shared
  company ESA + category `constellation` + window; the two programs
  (Copernicus EO vs. Italy's IRIDE SAR constellation) share no actual
  connection. One `dedup_distinct` cleared it.
- 2026-10-08-G: A genuinely new-looking "Norway proposes second Andoya
  launch pad" story, surfaced fresh via European Spaceflight's own site
  listing (the whitelisted signals-pass channel, not the harvested queue),
  turned out to already be published as `2026-09-30-norway-andoya-second-
  launch-pad` from the exact same source URL -- the finalize gate caught it
  as a same-source-URL dedup match even though the on-site listing read as
  today's top story. A second independent source (Behind the Black) was
  found on the corroboration crawl but added no reader-facing fact and the
  existing item was already at its whitelist-observer SNR ceiling (4), so
  it was left unpatched rather than filed as a content-free `updates[]`
  attach. Lesson: a whitelisted outlet's own homepage/listing page can
  resurface an old story as if new; always check `existing[]` by source URL
  before drafting, not just by headline similarity.
- 2026-10-08-H: Self-correction, not a new finding: initially ran the
  signals pass on five bluesky people (Aschbacher, Langbroek, Henry, Foust,
  A. Jones) using the bare `bsky.app/profile/<handle>` WebFetch route, which
  (per the standing 2026-09-06-Q/2026-10-05-R finding) returns only the
  handle header with no post body; re-ran all five afterward via
  `public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>`,
  which worked cleanly and surfaced real post text/dates. Nothing new came
  of the retry (Aschbacher's latest post was about the already-drafted
  Sentinel-3C item; Foust's Sept 30 Rocket Lab/Synspective repost and
  space-based-solar-power repost were both already published). Worth
  defaulting to the `getAuthorFeed` endpoint FIRST for any named signals
  bluesky check, never the bare profile URL, to avoid burning fetch budget
  on empty responses.
- 2026-10-08-I: `finalize-sweep.ts` rejected once on a JSON structural typo
  (a stray array-closing bracket introduced mid-edit) and once on the two
  dedup false positives above before merging cleanly on the third attempt
  ("merged 6 new, 1 updated, 0 held"); confirmed via a direct read of all
  six new items' `snr`/`category`/`impact` fields (881 items, up from 875)
  and the updated Musk/India commentary item's patched `explainer`/
  `sources`/`updates` fields. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h27m gap, unfiltered full source list (2026-10-09)

- 2026-10-09-A: A near-total-junk ~60-candidate queue (dozens of outlets
  reacting to the already-published Oct 8 SpaceX/Grain 800 MHz spectrum
  item, framed as AT&T/Verizon/T-Mobile stock-crash coverage; a fresh
  wave of Trump SpaceX-bond-purchase disclosure chatter, same passive-
  disclosure exclusion as 2026-08-31-J/2026-09-27-B; the Musk/Ambani
  India "oligarchs" commentary, already published Oct 7) traced entirely
  to already-published or out-of-scope ground; both genuine finds came
  from the open-web discovery pass and a Google-News non-US-space entry,
  not the harvested queue itself.
- 2026-10-09-B: A Google News "TURKSAT Deal" redirect that looked like a
  resurfacing of TURKSAT's own Oct. 31, 2025 Beijing-signed Chinasat/
  Spacesail MoUs (confirmed stale on direct fetch of turksat.com.tr's
  own newsroom, which has not been updated with anything newer) turned
  out to be a genuinely new, distinct Oct. 8 2026 follow-on protocol
  signed at IAC 2026 in Antalya: worth remembering a company's own
  newsroom can lag an independently-reported follow-on event by almost a
  year, so a stale first-party page is not proof the new story is the
  same old one. Anadolu Agency and TRT World, Turkiye's two state outlets,
  gave near-identical phrasing (likely both translating the same joint
  statement) but were NOT title-collapsed by finalize (different
  headlines), landing a clean `corroboration_2plus` at SNR 4.
- 2026-10-09-C: A local nonprofit newsroom new to this file (The Lens,
  New Orleans) supplied a genuine, substantive admission on the
  standing Starbase Louisiana living-document item: SpaceX chief
  engineer Mark Soltys told Pecan Island residents at a Sept. 24 public
  meeting that the exclusion zone at a 30-launches-a-day cadence would
  leave property access "essentially blocked," walking back the
  company's earlier "temporary" framing. Classed `informal` per the
  standing small-nonprofit-newsroom treatment (Waco Bridge,
  2026-10-06-Q); no bump requested since the item's official_record
  lead is already at the SNR 5 ceiling. A paywalled Law360 "astronomers
  warn FCC on Rocket Lab/Iridium RF interference" lead (CRAF/NRAO named
  only in a WebSearch synthesis, never in directly-fetched text) was
  left undrafted per the standing never-cite-an-unfetched-page rule
  despite a real Oct. 15 FCC comment deadline confirming the broader
  claim is current.
- 2026-10-09-D: The mandatory signals pass hit full coverage (all 13
  unique fetchable people checked, zero rotation needed) entirely via
  the bluesky `getAuthorFeed` API plus direct site fetches, with no
  separate call to the stale `bsky.app/profile/...` page needed at all;
  everything found (Isaacman/DOE nuclear-propulsion MOU, Exploration
  Company's ONEIROS lunar hopper, York's "Nemesis" GEO demo) had already
  been captured by the HTML/queue legs same-day. The standing stale
  bluesky-cache list (Caleb Henry, Tim Farrar, Eric Berger, Andrew
  Jones) persisted unchanged; Marco Langbroek's feed was entirely
  off-topic Dutch political content in this window.
- 2026-10-09-E: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 1 new, 1 updated, 0 held"); confirmed via a
  direct read of the new TURKSAT/China Satcom item's `snr`/`snr_trace`/
  `sources` fields (890 items, up from 889) and the updated Starbase
  Louisiana item's `sources`/`updates` arrays (14 sources, 7 updates),
  plus the sweep log's three unrelated persistence-bump `snr_movements`
  entries. `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~8h13m gap, unfiltered full source list (2026-10-09, second)

- 2026-10-09-F: An ESA Φ-lab "EVE" AI-for-Earth-observation tool, pitched
  by SpaceWatch.GLOBAL's October headline as "ESA Releases AI-Powered
  Earth Virtual Expert," turned out to be a stale resurfacing on direct
  fetch of ESA's own Φ-lab page (dated April 16, 2026, "undergoing final
  stages of development, will be available soon") and the project's
  HuggingFace page (model updates through August, chat platform still
  "under closed access," public release still only "targeted" for early
  2026 with no October launch event). Left undrafted per the standing
  stale-recirculation pattern (2026-10-06-O, 2026-10-08-G); the
  SpaceWatch.GLOBAL piece itself 403'd on direct fetch, so its framing
  was never independently confirmable anyway.
- 2026-10-09-G: SCMP's own "Chinese researchers make Arctic-to-Antarctic
  call using rival to Musk's Starlink" 403'd on every direct-fetch
  attempt, but the same Guowang polar video-call story was independently
  confirmed via two directly-fetched Chinese portals (Sina Finance,
  163.com, both carrying identical CCTV-sourced text and headline, so
  title-collapsed into one unit at finalize) plus a genuinely distinct
  write-up (china-in-space.com, different headline, no collapse),
  landing a clean `corroboration_2plus` at base mainstream tier 3. The
  Chinese-language originals gave a MORE PRECISE planned-satellite figure
  (12,992 across two sub-constellations) than the registry's existing
  Wikipedia-sourced 13,000 round number; attesting this as a crossfeed
  fact with `same_metric: true` triggered a genuine `downgrade_incoming`
  dispute (12,992 != 13,000 is a real mismatch, not agreement, even
  though both are "about 13,000") and cost the item one SNR level
  (4 -> 3, `disputed: true`) rather than silently refreshing the stored
  value. Worth remembering: a more-precise exact figure that merely
  rounds to an already-stored approximate figure still reads as a
  same-metric contradiction to the gate, not an agreement: the dispute
  downgrade on the news item is the correct, intended outcome (queued
  for Florian), not a bug to route around next time.
- 2026-10-09-H: A single Reuters wire story (German Space Command chief
  Maj. Gen. Michael Traut warning that Russia's May shadowing of
  ICEYE's satellite demonstrates tactics that could threaten Starlink)
  was syndicated near-verbatim across a dozen-plus outlets (Investing.com,
  ThePrint, Yahoo Finance, WHTC, Devdiscourse, GlobalBankingAndFinance,
  Boursorama in French, Notebookcheck in German); confirms the standing
  Reuters-wire-via-any-mirror precedent (2026-07-08 WHBL/SatSure case)
  scores base mainstream tier 3 regardless of which mirror carries it,
  and that a dozen syndicated copies of ONE interview is `found_none` for
  corroboration purposes (no second independently-reported source), not
  `found_some` just because many domains carry it.
- 2026-10-09-I: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 3 new, 2 updated, 0 held"); confirmed via a
  direct read of all three new items' `snr`/`snr_trace`/`category`/
  `impact` fields (893 items, up from 890), both updated items' patched
  `explainer`/`sources` fields, the sweep log's two `corroboration_collapses`
  entries (German Space Command Investing.com/ThePrint wire rewrite;
  Guowang Sina/163.com wire rewrite), and the registry crossfeed queue's
  `downgrade_incoming` entry for `guowang.sats_planned`. `bun run build`
  was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~3h18m gap, unfiltered full source list (2026-10-09, third)

- 2026-10-09-J: The Meteor 2-7 gap flagged unsourceable in 2026-10-08-B
  (LeoLabs' own detection, only spacewatch.global found and it 403'd)
  resolved cleanly four days later once independent popular-science/general
  outlets caught up: EarthSky, Starlust, and UA.News all fetched directly
  and all independently worded (not wire rewrites of each other), landing
  an honest `informal`-base SNR 2 via `corroboration_2plus`. LeoLabs itself
  has no `src/data/registry` organization entity, so even a fetchable
  LeoLabs blog post would still cap at `informal`, same as Arianespace/
  Astranis/Serco; worth remembering a "never-covered gap" held for lack of
  a fetchable source is worth a same-topic re-search days later rather than
  dropped for good.
- 2026-10-09-K: A near-total-junk ~60-candidate queue, almost entirely
  stock-reaction churn on the already-published Oct 8 SpaceX/Grain 800 MHz
  spectrum deal (telecom-stock-crash framing) plus Musk-trillionaire and
  Bezos-IPO-hint restatements of already-published facts, needed only a
  grep-before-drafting pass; an RFE/RL "Starlink test in Italy worries
  Iran's censors" piece read as fresh but was a bundle-old-facts analysis
  piece (the Italy embassy test is a stale March 2026 fact, the Iran
  warning already published Sept 30/Oct 5) and ESA's own Fluid Science
  Laboratory ISS-facility retirement, while a real dateable fact (Oct 9),
  was left out as a routine station-operations decommissioning with no
  commercial contract or market angle, not a dated science-mission program
  event per the science-category scope.
- 2026-10-09-L: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt ("merged 1 new, 0 updated, 0 held"); confirmed via a direct `jq`
  read of the new Meteor 2-7 item's `snr`/`snr_trace`/`sources` fields (894
  items, up from 893) and the sweep log's `signals`/`discovery` blocks.
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~5h46m gap, unfiltered full source list (2026-10-09, fourth)

- 2026-10-09-M: A near-total-junk ~87-candidate queue (almost entirely stock-
  reaction churn on the Oct 8 SpaceX/Grain 800 MHz spectrum deal) still
  yielded 7 new items, five from the queue's own Via Satellite/Ars
  Technica/SEC entries and two from the signals pass (SpacePolicyOnline's
  bluesky post on NASA's final CLD RFP; European Spaceflight's piece on
  ASI's artificial-gravity platform consultation). A search for trade
  corroboration on the L3Harris/NASA LISA telescope contract (Oct 8) led to
  a satnews.com redirect that resolved to a STALE March 2020 article about
  an earlier, much narrower L3Harris LISA contract (engineering-development
  telescope units, $20M) -- a genuinely distinct, later contract phase
  (flight-hardware telescopes, full-scale prototype already built), not a
  duplicate, but worth checking the redirect target's date before citing a
  "LISA contract" headline as corroboration for a fresh award.
- 2026-10-09-N: ASI (Italy's space agency) has no `src/data/registry`
  organization entity, so even its own `asi.it` first-party release capped
  at `informal` (no-registry-host workaround, extending the standing
  Arianespace/Astranis/Serco/LeoLabs list to a national space agency); led
  instead with Andrew Parsonson's europeanspaceflight.com writeup at
  `class: "whitelist"`/`"observer"` (bare-domain match, same shape as the
  2026-09-10-H precedent), landing a clean SNR 4 with ASI's own page
  attached as informal corroboration.
- 2026-10-09-O: A scheduled SDA Tranche 1 Transport Layer A relaunch
  attempt (Spaceflight Now, Oct 9: "another attempt... five days after a
  last-minute abort") was confirmed via Launch Library as net 2026-10-10
  0739Z, status "Go for Launch" -- left undrafted per the standing
  don't-draft-scheduled-launches rule; check next sweep for the outcome.
  A Congress-delegation-in-Kyiv "backs expanded Starlink access" story
  (Oct 9) was left undrafted as the same operational-use-request shape as
  the standing Finland/Stubb exclusion (2026-09-25-A): political support
  for persuading Musk to enable strikes, no SpaceX statement on record.
- 2026-10-09-P: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt ("merged 7 new, 0 updated, 0 held"); confirmed via a direct `jq`
  read of all seven new items' `snr`/`category`/`impact`/`sources` fields
  (901 items, up from 894) and the sweep log's `signals`/`discovery`
  blocks. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~6h07m gap, unfiltered full source list (2026-10-10)

- 2026-10-10-A: A near-total-junk 36-candidate queue (SpaceX/Trump debt-
  disclosure chatter already excluded under the standing passive-
  disclosure precedent, a wall of bot/spam Bluesky accounts from the
  "spacex launch" search leg, scheduled-not-yet-flown Dragon CRS-2 SpX-35
  and SDA-T1A relaunch previews) still yielded one genuine gap neither the
  queue nor discovery surfaced directly: a judgement-bot Bluesky post
  claiming Xona Space Systems "launches six satellites" traced via search
  to a still-upcoming (not yet flown) production-class Pulsar batch,
  "preparing to launch" in October per TechCrunch; left undrafted as
  scheduled-not-yet-occurred rather than trust the bot's past-tense
  phrasing of a future event.
- 2026-10-10-B: A BASENOR "Starlink in Venezuela" queue headline (standing
  low-quality-mirror flag, 2026-09-16-R/2026-09-24-B) pointed at a
  genuine, undrafted gap once chased past the mirror itself: Venezuela's
  Conatel formally granted SpaceX's Starlink a nationwide general license
  plus seven Ku-band concessions on Oct. 9, confirmed via a directly-
  fetched Reuters/Investing.com wire piece and an independently-written
  El Nacional article with the specific license number and Ku-band/D2D
  detail the wire piece omitted. Landed a clean SNR 4 off two mainstream
  sources; fired the standing SpaceX+category-shared dedup false positive
  against all six other SpaceX `regulatory` items already published in the
  7-day window, cleared with six `dedup_distinct` entries in one pass.
- 2026-10-10-C: A Runway Girl Network piece bundling four Starlink
  connectivity deals (American, KLM, Royal Air Maroc, Amtrak) needed a
  grep-before-drafting pass before writing anything: American and KLM were
  already published same-week (Oct. 8), and RAM's fleet-wide deal was
  already published back in August: only the Amtrak Cascades-Airo Starlink
  backhaul trial (the outlet's own on-site observation, not an Amtrak
  announcement) was genuinely new. Single-sourced (`crawl: "found_none"`,
  no independent outlet mentioned the Starlink detail even though several
  covered the same trainset's debut), published honestly at SNR 2 per the
  standing weak-sourcing-is-not-a-hold-reason rule; worth remembering a
  bundled multi-company trade piece can carry exactly one undrafted fact
  buried among three already-covered ones.
- 2026-10-10-D: Musk's Oct. 9 escalation against Ambani (a sarcastic "Dear
  Prime Minister Ambani" letter plus an unproven Reliance/BJP-donation
  allegation, per TechCrunch and Outlook India) folded cleanly into the
  existing Oct. 7 commentary item as an `updates[].patch`+`attach`, no bump
  requested since the mainstream-led item was already at its non-first-
  party corroboration ceiling of 4 -- same enrichment-patch pattern as
  prior same-story escalations, just two days into an already-updated
  commentary item rather than a dormant one.
- 2026-10-10-E: The mandatory 13-unique-person signals pass (10 bluesky
  `getAuthorFeed` API calls plus 4 direct site fetches) and a 5-source
  mandatory HTML pass were both fully clean: every substantive post/
  release found (Crew-12 return, the CLD final RFP, ONEIROS lunar hopper,
  ASI's artificial-gravity consultation, California/ICEYE, BlackSky Gen-3
  pilot) had already been published by the prior same-day sweep. Caleb
  Henry, Tim Farrar and Eric Berger's bluesky feeds remain stuck on the
  standing stale-cache pattern (no posts inside the window on any of the
  three); Marco Langbroek's feed was entirely off-topic Dutch political/
  missile-test content again. A 10-query discovery matrix (launch,
  funding, incident/debris, China, India, EO, FCC, ESA, M&A, Japan) traced
  every hit to an already-published item or a stale-resurfacing search
  artifact (Aalyria's $100M Series B is from February 2026, not today; the
  Rocket Lab/JAXA Electron contract is from October 2025).
- 2026-10-10-F: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt ("merged 2 new, 1 updated, 0 held"); confirmed via a direct `jq`
  read of both new items' `snr`/`snr_trace`/`category`/`impact`/`tags`/
  `sources` fields (903 items, up from 901) and the updated Musk/Ambani
  item's `sources`/`updates` arrays (7 sources, 4 updates). `bun run
  build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h37m gap, unfiltered full source list (2026-10-10, second)

- 2026-10-10-G: The scheduled SDA Tranche 1 Transport Layer A relaunch
  flagged pending in 2026-10-09-O finally flew this sweep (liftoff 07:39
  UTC after the Oct 5 auto-abort): genuinely new, drafted as a `launch`
  item at `notable` (Northrop Grumman's first Tranche 1 launch, the
  program's third manufacturer after York and Lockheed). SpaceNews led
  (direct-fetched despite its own paywall truncating most of the body;
  the fetched fragment still carried the "third manufacturer" fact
  verbatim) with Spaceflight Now's pre-launch deep-dive and Launch
  Library 2 as corroboration; space.com and spacex.com/launches both
  truncated to nav-only on direct fetch (standing spacex.com dead-source
  pattern extends to the new per-mission `/launches/<slug>` URL shape,
  worth a one-off re-check later but not a reason to keep retrying it).
- 2026-10-10-H: A near-total-junk ~82-candidate queue (FAA/NOAA Federal
  Register fishery/airworthiness noise, Futurism AI-bubble pieces, a wall
  of SpaceX-launch Bluesky bot/fan accounts reacting to the T1TL-A
  liftoff) yielded exactly one queue-sourced gap (the T1TL-A launch
  itself, via a Google News SpaceNews redirect) plus two enrichment
  patches surfaced by discovery, not the queue: ESA's own Sophie Adenot
  return page (first-party, already-published Crew-12 item at its SNR 5
  ceiling) stated a genuinely new record fact — longest single ESA
  spaceflight ever, 35+ days past Parmitano's mark, also the longest
  Dragon mission to date — folded in as a no-bump attach+patch. A Reuters/
  Globe and Mail wire piece reported, citing a WSJ account of unnamed
  sources, an $8B valuation for the already-published SpaceX/Grain 800MHz
  deal (whose item explicitly said "financial terms were not disclosed");
  attributed the figure to Reuters/WSJ rather than stating it as fact,
  folded in as a no-bump attach+patch on the existing item (already at
  its non-first-party ceiling of 4).
- 2026-10-10-I: Two IAC 2026 CGTN pieces (Azerbaijan-China space ties,
  "Chinese companies aim for bigger market share") and a JAXA-Saudi Space
  Agency MOC (Oct 8, confirmed via WebSearch of JAXA's own announcement)
  were all left undrafted as the same vague-diplomatic-MOU shape: no
  named satellite program, contract, or dollar figure in any of the
  three, just general "deepening cooperation" language. A KeepTrack
  algorithmic reentry prediction for ISRO's SDX02 (SpaDeX docking
  demonstrator, ~180kg, nominal reentry Oct 13 but a 45-day/1,080-hour
  uncertainty window) was left undrafted as a predicted-not-yet-occurred
  event, same standing rule as scheduled launches.
- 2026-10-10-J: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 1 new, 2 updated, 0 held"); confirmed via a
  direct `jq` read of the new T1TL-A item's `snr`/`snr_trace`/`category`/
  `impact`/`tags`/`sources` fields (904 items, up from 903) and both
  updated items' `updates`/`sources` arrays (Crew-12: 4 sources; Grain
  spectrum: 5 sources). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4h gap, unfiltered full source list (2026-10-10, third)

- 2026-10-10-K: A diversified VC firm's own capital-raise milestone
  (Balerion Space Ventures oversubscribing its $200M Fund II) was judged
  out of scope despite CLAUDE.md's "space-focused investment funds"
  ecosystem inclusion: the fund backs "space, defense, and deep
  technology" broadly (portfolio includes Commonwealth Fusion, Valar
  Atomics, a bank) rather than being a dedicated space fund, and the
  event is the investor's own routine fundraising milestone, not a
  financial event of a tracked operator. Left undrafted; flag if a
  future instance is a pure-play space fund (e.g. Seraphim-shaped) for a
  cleaner precedent either way.
- 2026-10-10-L: Two same-shaped stale-resurfacing traps resolved cleanly
  via direct fetch: a "China resumes Thousand Sails" SpaceNews headline
  from a generic search carried its own October 19, **2025** byline
  (same-topic, different year); and a same-day "China's 27th group of
  low-orbit internet satellites" (Long March 12, Hainan, 3:27 a.m.
  Beijing time Oct 10) traced via timezone conversion (3:27 p.m. EDT Oct
  9) to the SAME GuoWang 27th-group launch already published the same
  morning under `2026-10-09-satnet-27th-group-hainan`, just re-reported
  under a vaguer "satellite internet" framing with no constellation name
  stated. Also: the Sept 30 FCC NEPA/spectrum order (1,050 MHz,
  12.7-13.25/42-42.5 GHz) resurfaced Oct 1 under an unrelated-looking
  "Satellite Spectrum Abundance Order" branding on advanced-television.com;
  matching band figures confirmed it as the same order, not a new one.
- 2026-10-10-M: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 0 new, 1 updated, 0 held"); confirmed via a
  direct `jq` read of the updated ICEYE/California item's `snr`/
  `snr_trace`/`sources`/`updates` fields (SNR held at 5, as expected for
  an attach on an already-ceilinged official_record lead) and the sweep
  log's `signals`/`discovery` blocks. `bun run build` was not attempted,
  per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4h37m gap, unfiltered full source list (2026-10-10, fourth)

- 2026-10-10-N: A near-total-junk 24-candidate queue (SpaceX/Grain
  800MHz spectrum stock-reaction churn, scheduled-not-yet-flown FAA/SDA
  launch bot previews, off-topic Bluesky trivia) yielded nothing; the
  signalsPass draft field requires the fetchable-channel URL exactly as
  listed by `signals-context`, not the `rss` variant: listing
  `europeanspaceflight.substack.com/feed` (the RSS URL) instead of
  `europeanspaceflight.substack.com` (the channel URL) got the draft
  rejected on the first attempt; finalize accepted it once corrected to
  the bare substack URL.
- 2026-10-10-O: Two suborbital-vehicle stories surfaced by discovery
  (HyImpulse's new UK CAA launch-operator licence for its SR75 rocket
  at SaxaVord, announced Oct 1 and confirmed via direct fetch of
  advanced-television.com and shetlandtimes.co.uk; OculloSpace's 10km
  AZAD test flight from Oman's Etlaq Spaceport) were both left
  undrafted under the CLAUDE.md "launch vehicles and launch providers,
  orbital only" scope line: the story's entire substance in both cases
  is the suborbital vehicle itself, not an orbital-site infrastructure
  milestone, even though SaxaVord and Etlaq are themselves in-scope
  spaceports. Worth a cleaner precedent either way if Florian disagrees
  (the SaxaVord license grant is a genuine regulatory "may now sell
  launch services from UK soil" fact, just for a suborbital vehicle).
- 2026-10-10-P: A WebSearch-surfaced "Stoke Space extends Series D to
  $860M" result read as fresh but direct-fetched to a stale February
  10, 2026 announcement (the original $510M Series D was October
  2025); search snippets for funding-round headlines need their
  publish date confirmed by direct fetch before drafting, same lesson
  as the stale-resurfacing pattern for news articles, now confirmed for
  funding-round PR too.
- 2026-10-10-Q: `bun scripts/finalize-sweep.ts` merged cleanly on the
  second attempt after the signalsPass URL fix ("merged 0 new, 0
  updated, 0 held"); confirmed via the sweep log's `signals`/
  `discovery` blocks recording full 17-channel coverage and the
  10-query discovery matrix. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Deep sweep (auto-escalated after two consecutive zero-add sweeps), ~7h gap, unfiltered full source list (2026-10-11)

- 2026-10-11-A: A 700-candidate deep-mode queue (7-day window) was almost
  entirely junk (SpaceX stock/valuation churn, off-topic Futurism/BBC
  filler, routine Federal Register notices, IAC 2026 generic-cooperation
  wire pieces) or re-presentation of already-published stories; roughly a
  dozen candidates that read as genuinely new on headline alone (Amazon's
  1,000th Kuiper satellite, Kapta Space's $24M round, the Themis/SALTO
  deadline extension, the Exploration Company's ONEIROS hopper, Redwire's
  Axiom ROSA follow-on, T1TL-A's launch, American Airlines' mainline
  Starlink rollout, Aselsan's Gokbagi/Astralink and TUSAS/Roketsan's
  Hursat-2, Golbriak/Fortastra/Astrolight/Astrogate funding and MOUs, the
  L3Harris LISA telescope contract) all turned out to already be
  published once grepped against `items.json` by company name. Confirms
  the standing deep-mode norm (2026-09-27-D, 2026-10-04-B) at a larger
  scale than previously logged.
- 2026-10-11-B: A new vague-conference-announcement shape: a Turkish
  industry-cluster chair (Haluk Bayraktar, SAHA Istanbul, not a
  government or company official) announcing at IAC 2026's opening that
  Türkiye is "building" a 100-satellite navigation constellation named no
  contractor, budget, or timeline in any outlet checked (AA, Yeni Şafak).
  Left undrafted alongside two CGTN/JAXA-Saudi vague-cooperation MOUs
  already excluded 2026-10-10-I; worth a cleaner precedent if a future
  sweep finds the Turkish Space Agency or a named contractor attaching a
  budget to the same program.
- 2026-10-11-C: Two more ESA Multimedia Videos/Images read as thin/not a
  defined science-event type: Hera's "first glimpse of Didymos" (Oct 7,
  236,500 km out, an optical-acquisition navigation milestone two years
  post-launch, with the actual rendezvous/survey still not until 2027)
  and an animated educational short claiming Hera has "finally arrived"
  were both left undrafted as neither an arrival, orbit insertion, nor
  landing per the science scope's named event list, and ESA's own page
  states no commercial/industry angle. Revisit when the actual 2027
  rendezvous/survey begins.
- 2026-10-11-D: The Bluesky stale-cache pattern now affects Caleb Henry,
  Tim Farrar and Eric Berger on essentially every sweep (Eric Berger's
  `getAuthorFeed` returned posts dated back to March 2025 this run, the
  worst staleness yet recorded); Marco Langbroek's feed was dominated by
  an unrelated French SLBM-test news cycle. Treated all four as
  checked-but-empty per the standing practice rather than re-querying.
- 2026-10-11-E: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 0 new, 0 updated, 0 held"); confirmed via the
  sweep log's `signals`/`discovery` blocks recording full 17-channel/
  13-person coverage, 8 X-handle searches, and the 12-query discovery
  matrix. `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~3h33m gap, unfiltered full source list (2026-10-11, second)

- 2026-10-11-F: A near-total-junk 25-candidate queue (Bluesky spacex-launch
  bot/opinion accounts, stock-reaction Yahoo/Barron's/Seeking Alpha pieces
  on the Oct 8 Grain spectrum deal, Futurism/BBC off-topic filler) yielded
  nothing itself; the one genuine new item came from the discovery pass,
  not the queue: a Sept 30 NASA/Glenn Research Center $38M firm-fixed-price
  contract to Modulate Space Corporation for a lunar-surface 5G/Wi-Fi 6
  network, confirmed via NASA's own press release (first_party, SNR 5,
  `dedup_distinct` against the unrelated Oct 6 NASA bulk-rocket-buy item on
  shared-company/category grounds) and missed entirely by the prior four
  sweeps that day. Worth remembering: a plain WebSearch discovery query can
  surface a real NASA contract award that several SEO-mirror sites
  (memesita, dijitalmasallar, streamlinefeed, ufofeed, time.news,
  miragenews) picked up days before any sweep drafted it; none of those
  mirrors counted as corroboration (pure rewrites of the NASA release, no
  independent reporting), so the crawl recorded `found_none` with no SNR
  penalty since the lead is first-party.
- 2026-10-11-G: WebFetch cannot render `bsky.app/profile/<handle>` pages at
  all (they return only the bare handle, no post content, regardless of
  account); the public API endpoint
  `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=10`
  works reliably and returns real post text + `createdAt` timestamps for
  every handle tried this run (Aschbacher, Langbroek, Henry, Farrar,
  Berger, Foust, Jones). Use the API endpoint directly for the signals
  pass rather than the profile page URL (still record the bare profile
  URL in `signalsPass.checked` per the 2026-10-10-N lesson; the API URL is
  just the fetch mechanism).
- 2026-10-11-H: `bun scripts/finalize-sweep.ts` rejected the first draft
  attempt on the dedup gate (shared company NASA + category "procurement"
  within 7 days against the unrelated Oct 6 bulk-rocket-buy item), then on
  a tagline length overage (144 vs 140 char max) after the dedup_distinct
  fix; merged cleanly on the third attempt ("merged 1 new, 0 updated, 0
  held"), confirmed via a direct `grep` read of the new item's `snr`
  (5)/`impact` (notable)/`category` (procurement) fields (905 items, up
  from 904). `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~6h40m gap, unfiltered full source list (2026-10-12)

- 2026-10-12-A: A satnews.com piece ("Amazon Leo Plans Prime Subscription
  Bundling...") read like independent reporting on a genuine queue find
  but, once fetched directly, turned out to be the outlet's own
  uncredited characterization of someone else's reporting: no quote, no
  named source, no attribution language at all, just "Amazon disclosed
  details" framing. The real origin was an Ars Technica interview with
  Amazon Leo VP of business Chris Weber (Oct 9), recoverable only via
  three rewrite sites that DO credit Ars Technica by name (HowToGeek,
  Broadband Breakfast, Telecompaper), each with its own distinct
  verbatim quotes. Led with HowToGeek (fullest quotes: 3x downlink/
  8-10x uplink claim vs. Starlink, 396 satellites, bundling with Prime/
  Eero/Fire TV/Ring); satnews.com itself was left off the sources list
  entirely since nothing in it was independently attributable. Worth
  remembering: an aggregator piece that *sounds* like original reporting
  but names no source at all is weaker than a rewrite site that openly
  credits the outlet it's summarizing; the latter is citable (informal),
  the former is not citable for anything beyond its own bare headline.
  Telecompaper.com is a telecom-trade outlet with no prior
  classification precedent in this file; treated as `informal` here
  since it was only used as an Ars Technica rewrite, not for original
  telecom-trade reporting.
- 2026-10-12-B: `bun scripts/finalize-sweep.ts` merged cleanly on the
  first attempt ("merged 1 new, 0 updated, 0 held"); confirmed via a
  direct `jq` read of the new item's `snr`/`snr_trace`/`category`/
  `impact`/`sources` fields (906 items, up from 905), the
  `registry-candidates.json` `annotate_mismatch` entry for
  `kuiper.sats_launched_total`, and the sweep log's two unrelated
  persistence-bump `snr_movements` entries. `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~10h45m gap, unfiltered full source list (2026-10-12, second)

- 2026-10-12-C: A same-looking Brazil/Venezuela Starlink regulatory headline
  bundled two genuinely different facts: a BNamericas-style roundup framed both
  as one "Starlink flies higher" story, but Venezuela's Oct. 9 Conatel license
  was already published three days earlier while Brazil's ANATEL S-band vote,
  also Oct. 9, was a genuine gap. Worth checking a bundled dual-country
  headline for which half is actually new before discarding the whole thing as
  already covered.
- 2026-10-12-D: Starlink's own quoted self-description of a regulatory grant
  can overclaim relative to the actual grant: the company told TELETIME News
  it won ANATEL's vote for "full access to the 2 GHz spectrum," but the
  regulator's own order gave 15+15 MHz, half of the ~25+25 MHz requested
  (confirmed independently via a second, Brazilian-language search once the
  English-language TeslaNorth mirror repeated the "full access" framing
  uncritically). Led on TELETIME (trade, independently reported the actual
  MHz figures) rather than the company's own superlative; cited Starlink's
  quote in copy but did not treat it as the fact, per the standing
  first-party-superlative-is-attributed-not-scored rule now confirmed for a
  grant amount, not just a product claim.
- 2026-10-12-E: A same-day press release that reads as a completed launch
  event can still describe a launch that hasn't happened yet: Redwire's own
  Oct. 12 "Final Pair of Redwire ROSA Wings Launch to the ISS" release uses
  present/future-continuous phrasing ("will be launching... onboard... SpaceX
  CRS-35") for a Dragon cargo mission Launch Library confirmed was still
  "Go for Launch," net Oct. 13 -- left undrafted per the standing
  don't-draft-scheduled-launches rule despite the headline's completed-event
  shape; worth a same-topic re-check once CRS-35 actually flies.
- 2026-10-12-F: `bun scripts/finalize-sweep.ts` merged cleanly on the first
  attempt ("merged 1 new, 1 updated, 0 held"); confirmed via a direct `jq`
  read of the new Brazil/ANATEL item's `snr`/`snr_trace`/`category`/`impact`/
  `sources` fields (907 items, up from 906) and the updated Musk/India
  item's `sources`/`updates` arrays (10 sources, 6 updates). `bun run build`
  was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~53min gap, unfiltered full source list (2026-10-12, third)

- 2026-10-12-G: A genuine zero-item sweep on a very narrow gap: the
  8-candidate post-filter queue was SpaceX stock chatter, a "Carolinas can
  see the rocket" visibility piece, off-topic storm coverage, and a
  SatNews Google-News re-report of the already-published Oct 10 T1TL-A
  launch (`2026-10-10-spacex-sda-tranche1-transport-layer-a`, same 21
  Northrop Grumman satellites). The 14-channel signals pass, 4 X-handle
  searches, and an 8-query discovery matrix all traced to already-
  published items or two fresh out-of-scope exclusions: Poland's
  SpaceForest PERUN ("fourth PERUN launch, fifth pushed to 2027" per
  Andrew Parsonson's bluesky) is a suborbital test rocket, joining the
  standing HyImpulse SR75/Avio FD1/Pluto Aerospace orbital-only
  exclusion list; and Vivienne Machi's Oct 12 Aviation Week piece headlined
  around "Fourth SDA Data Relay Launch" turned out on closer check to be
  about an unarmed Mk21A ICBM reentry-vehicle test (a Minotaur I flight
  for the Sentinel/W87-1 warhead program) that merely caused the range
  conflict behind the already-published T1TL-A launch's one scrub -- a
  military nuclear-weapons test with zero commercial-space angle, the
  same institutional-disclosure shape as the Air Force Secretary Meink
  space-weapons-admission precedent (2026-09-18-D), not a new SDA launch.
  `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt
  ("merged 0 new, 0 updated, 0 held"); `bun run build` was not attempted,
  per the 2026-09-09 CLAUDE.md procedure update.

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
