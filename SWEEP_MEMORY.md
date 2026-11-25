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

## Narrow re-check, ~10.1h gap, unfiltered full source list (2026-11-12, third)

- 2026-11-12-N: An "FCC approves SpaceX's move on Grain's spectrum" (Advanced Television) and
  several mirror headlines overstated the action: the FCC's own Nov. 10 notice only accepted the
  transfer application for filing and opened a public comment period (petitions to deny due Dec. 1,
  oppositions due Dec. 8), confirmed by Total Telecom's more careful framing; patched the existing
  Grain item's copy to say "accepted for filing," not "approved," rather than repeat the outlet's
  overclaim.
- 2026-11-12-O: `payloadspace.com` direct-URL queue entries (Spaceium's $1 OpenPort refueling
  license, NeuralSat's €2.9M pre-seed, OwlO Cloud's stealth launch) and a European Spaceflight
  direct entry (MaiaSpace's still-unsigned ESA Launcher Challenge contract, three weeks past ESA's
  "question of days" promise) were the queue's only non-Google-News, non-Bluesky items in a
  near-total SpaceX/Tesla-stock-reaction and Starship-preview-spam ~129-candidate queue; all four
  were genuinely new and none needed a Google News redirect workaround.
- 2026-11-12-P: `blueorigin.com/news/gs1-3-hotfire-updates` 429'd on every direct fetch attempt
  (three tries), and no independent trade outlet had written up that specific Nov. 10
  valve-qualification-complete update (only WebSearch's own synthesis of the unfetched page);
  left undrafted per the never-cite-an-unfetched-page rule despite it being a genuinely new,
  dateable fact about the New Glenn/Vulcan BE-4 valve fix. Worth a direct re-fetch next sweep once
  the rate limit clears.
- 2026-11-12-Q: A second Zelenskyy Starshield-restriction claim (speed capped to 161 kph again,
  timed with the Kushner/Witkoff Moscow-Putin talks, "helps Russians kill more Ukrainians") landed
  on the same living-document item that already carried 91 sources and 40 updates; patched the
  top-level explainer to the new claim per the standing living-document convention (2026-11-10-O)
  rather than just logging an `attach`, since the quote was substantially more pointed than the
  prior BT-delay update it was superseding at the top of the explainer.
- 2026-11-12-R: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 7 new,
  2 updated, 0 held"), 1233 items up from 1226. Confirmed via a direct `jq` read of all seven new
  items' `snr`/`category`/`impact` fields and both updated items' grown `sources` (Grain: 11, up
  from 9; Starshield: 92, up from 91) and `updates` (Grain: 5, up from 4; Starshield: 41, up from
  40) arrays, and a `jq empty` parse check on all five touched data files (items, state,
  source_ledger, sources, candidates); held and registry-candidates were untouched (no held
  entries; none of the seven new items' companies had a registry profile with a like-for-like
  crossfeed metric). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~1h23m gap, unfiltered full source list (2026-11-12, fourth)

- 2026-11-12-S: A same-day NASA Moon Base release (the Nov. 7 bundle already feeding three
  existing items: VADR task orders, CLPS 2, and the PROMISE rover) also named a fourth, distinct
  task order to SpaceX only, the Cislunar Communications Deployment Demonstration (Starship
  launching Starlink-based comms satellites to cislunar space in 2028, no stated dollar value),
  surfaced only via an open-web discovery query five days after the fact; needed `dedup_distinct`
  against FOUR existing items at once (VADR, CLPS 2, PROMISE rover, plus an unrelated Nov. 4
  NASA/Viasat/SES/Astranis Ka-band relay item and an unrelated Nov. 6 White House/SpaceX Starlink-
  donation item, both sharing company+category "procurement" only) before it merged clean.
  Aviation Week's own coverage of the same NASA release added a genuinely new fact (the satellites
  are Starlink-based) that NASA's own release never specified, confirming a trade write-up of a
  primary release can still carry an independent, citable detail worth attaching as corroboration
  even when the primary source is already at its official_record ceiling.
- 2026-11-12-T: A Star Vision/Oman Lens $200M+, 20-satellite China-Oman deal (per SCMP, itself
  unfetchable, picked up only by content-mill mirrors crediting SCMP by name) looked like a
  genuine new gap but could not be confidently separated from the already-published Nov. 2
  StarVision Aerospace/Adasat Oman item: both trace to the same Beijing state-visit week, share a
  near-identical Chinese company name, and one source describes "Oman Lens" as itself an
  "affiliated entity of STAR.VISION" rather than an arms-length third party. Left undrafted rather
  than risk either double-counting one deal under two company-name spellings or citing an
  unfetchable paywalled source's dollar figure through an unverified mirror; worth a dedicated
  re-check with a working SpaceNews or SCMP fetch (both 429'd/403'd this run) before concluding
  either way.
- 2026-11-12-U: A U-Space "€24 million Series A" funding-round hit read as a fresh Nov. 12
  announcement but several independent mirrors (satellitetoday.com, fundz.net, globalautomobility.com)
  carry the identical figure with an explicit `2025-11-12` or `2025-11-13` date in their own URLs/
  bylines, a year-stale story; left undrafted. A second, unrelated U-Space/Tenchijin EO partnership
  item was already published 2026-09-10, confirming the funding hit was the stale story, not a
  missed dedup.
- 2026-11-12-V: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on three
  unattested same-company-plus-category dedup collisions on the Cislunar-comms item (see -S
  above); merged cleanly on the second attempt ("merged 3 new, 1 updated, 0 held"), 1236 items up
  from 1233. Confirmed via a direct `jq` read of all three new items' `snr`/`category`/`impact`
  fields and the AST SpaceMobile Blacklift item's grown `sources` (5, up from 4) and `updates` (2,
  up from 1) arrays, plus a `jq empty` parse check on all seven touched data files (items, held,
  state, source_ledger, sources, candidates, registry-candidates); held and registry-candidates
  were untouched (no held entries; none of the three new items' companies had a registry profile
  with a like-for-like crossfeed metric). `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~6.5h gap, unfiltered full source list (2026-11-13)

- 2026-11-13-A: A SpaceNews "UARX Space Marks a Milestone..." piece dated Nov. 12 read as a fresh
  OSSIE-D maiden-flight event but, once chased, turned out to narrate a subsystem performing well
  on a flight that actually launched Oct. 1 aboard Transporter-18 (and had a since-resolved
  ground-station comms anomaly, per a separate SpaceNews piece found only by searching the
  company name plus "anomal"). A company-milestone feature with a present-tense "achieves" framing
  is not proof the underlying flight is new; search for the actual launch/event date before
  drafting any "marks a milestone" or vendor-performance-recap shaped piece as today's news.
- 2026-11-13-B: The near-total-junk queue this run (SpaceX/Tesla merger speculation wire pickups,
  Starship Flight 15 preview spam, dozens of identical "SpaceX $74B Texas/Arizona AI campus"
  rewrites already excluded per 2026-11-06-H) again yielded its only genuine finds from direct
  trade-source queue entries (Via Satellite: Revolv Space Series A, Gatehouse Satcom/Satlab
  acquisition, the Ukraine Starshield EPC Summit update) rather than Google News or Bluesky.
  Merger-speculation pieces ("could announce as soon as December," "sources say") with no
  confirming action from either company were left undrafted as unconfirmed rumor, same treatment
  as the standing forward-looking-political-speculation precedent.
- 2026-11-13-C: A discovery-pass India-Brazil Skyroot/Concert Technologies micro-launcher MoU
  (signed at IAC 2026 in Antalya in early October, reported fresh via ANI on Nov. 12) was left
  undrafted despite being a genuine non-US launch-vehicle development: financing, production, and
  final vehicle design were all still explicitly undecided per the source, making it too thin a
  non-binding MoU to chase a month-plus stale under the notable/seismic-only chase-it exception.
- 2026-11-13-D: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 2 new,
  3 updated, 0 held"). Confirmed via a direct `jq` read of both new items' `snr`/`category`/
  `impact` fields (Revolv Space Series A, Gatehouse Satcom/Satlab acquisition, both SNR 4 on
  `corroboration_2plus` from two distinct trade sources) and all three updated items' grown
  `sources`/`updates` arrays (Starlink/Ukraine: 94 sources, 42 updates; EU Commission GOVSATCOM:
  6 sources, 3 updates; AST SpaceMobile Blacklift: 6 sources, 3 updates, held at its first-party
  ceiling of 5), plus a `jq empty` parse check on all seven touched data files (items, held, state,
  source_ledger, sources, candidates, registry-candidates); held and registry-candidates were
  untouched (no held entries; neither new item's companies had a registry profile with a
  like-for-like crossfeed metric). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~5h gap, unfiltered full source list (2026-11-13, second)

- 2026-11-13-E: ISRO's own first-party page naming a PSLV ground test "following anomalies in
  the third stage during the PSLV-C61/EOS-09 and PSLV-C62/EOS-N1 missions" is itself the dateable
  event even though this platform never drafted either of those two underlying failures (both
  predate this site's 2026-07 launch); published as a standalone item off the fix-test fact alone,
  not held for lacking prior context, since the test (and its anomaly-history framing) is fully
  attested by ISRO's own release. Tripped the standing same-company-plus-category dedup heuristic
  against the Nov. 10 GSLV-F19 cryogenic-engine item purely on shared company ISRO + category
  `launch`; one `dedup_distinct` cleared it (different vehicle, different underlying fact: a GSLV
  upper-stage flight acceptance test for a named upcoming mission vs. a PSLV third-stage redesign
  test addressing two unrelated past failures).
- 2026-11-13-F: A SpaceNews "AST SpaceMobile presses case for developing own launch vehicle" piece,
  read in full, turned out to be a routine extension of the already-published Nov. 6 Blacklift
  unveiling, EXCEPT for one new, independently-checkable fact buried in it: the Virginia Spaceport
  Authority's on-record contradiction of CEO Avellan's claim that Blacklift will launch from
  Wallops Island ("early, preliminary conversations" only). Worth continuing to read a seemingly-
  redundant follow-up piece on an open story in full rather than skipping it on headline-shape
  alone, since the genuinely new fact can be a single contradicting quote, not a new figure.
  `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the ISRO dedup collision
  above; merged cleanly on the second attempt ("merged 1 new, 3 updated, 0 held"), 1239 items up
  from 1238. Confirmed via a direct `jq` read of the new PSLV item's `snr`/`category`/`impact`
  fields (SNR 5, first_party base, launch/notable) and all three updated items' grown `sources`/
  `updates` arrays (Blacklift: 7 sources, 4 updates; Boca Chica: 6 sources, 3 updates; Starlink/
  Ukraine: 96 sources, 43 updates). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~9.5h gap, unfiltered full source list (2026-11-13, third)

- 2026-11-13-G: Four of the YouTube signals channels flagged 404 at the harvester level since
  2026-10-13-A (Scott Manley, Tim Dodd, Marcus House, Felix Schlang) came back with real entries
  this run per `candidates-context`'s health block, while Eric Berger's and Andrew Parsonson's
  stayed stale (newest entries 2024 and May 2026 respectively). Worth treating the harvester-level
  404 as per-channel and possibly transient rather than a blanket "YouTube is unreachable" status;
  check each channel's own `newest_entry` in the health block before writing one off.
- 2026-11-13-H: Both ULA's Vulcan/Amazon Leo return-to-flight and SpaceX's Starship Flight 15
  double-catch attempt dominated the queue (dozens of Google News/Bluesky hits) but neither had
  actually flown as of this sweep's `now` (Vulcan NET Nov. 14 17:32 UTC, Starship NET Nov. 13
  22:45 UTC, confirmed via a direct Launch Library query); left both undrafted per the standing
  no-preview-coverage rule despite the volume, including a "Rocket Lab Marks 100th Electron
  Launch" headline that likewise previewed an unflown Nov. 14 iQPS mission, not a completed one.
- 2026-11-13-I: A same-day TravelPulse "Southwest Airlines Achieves New Milestone in Starlink
  Wi-Fi Rollout" piece (403'd directly) traced via search to the same 47-aircraft figure Southwest
  itself gave AirlineGeeks on Oct. 17, repackaged around a Nov. 12 in-flight gaming charter stunt
  with no updated fleet count; left undrafted as a thin marketing recap rather than a genuine
  rollout milestone, the same shape as the standing thin-marketing-stunt exclusion.
- 2026-11-13-J: A Mynaric EIN Presswire release ("CONDOR optical terminal achieves bidirectional
  space-to-ground data transfer," Nov. 11) and a W.Media piece on a Japanese "mega-constellation"
  consortium both turned out to be vendor/outlet restatements of facts already fully published:
  the Mynaric terminal is the same K2 Gravitas/Cailabs demo SES announced Nov. 4
  (`2026-11-04-ses-optical-comms-demo-k2-gravitas`), and the W.Media consortium is the same
  five-company NTT/Mitsubishi Electric/MUFG/DBJ MOU already published Nov. 9. Worth the reminder
  that a company's own wire release restating a customer's earlier announcement, or a second
  outlet's recap of an already-fully-detailed MOU, needs a company/program grep against
  `items.json` before drafting, not just a fresh-looking dateline.
- 2026-11-13-K: A Kyiv Post/United24 Media pair on Ukraine's HUR disclosing none of Russia's 30
  launched Rassvet-3 satellites reached their planned 800km orbit (26 stuck at 500-520km, two
  deorbited) folded cleanly into the 10-day-old Rassvet-4 ITU-filing item via `attach`+`patch`+
  `bump: "reinforcement"`, moving it 2→3; both outlets were independently bylined, not a wire pair,
  despite covering the same HUR report.
- 2026-11-13-L: A WebSearch-surfaced "ICEYE US raises $536 million" claim (Nov. 12) traced only to
  low-quality funding-tracker aggregator snippets (fundz.net-style sites); no outlet's own page
  could be found stating the figure directly, and SpaceNews's piece on ICEYE US's manufacturing
  expansion was paywalled beyond a lede that never mentioned a dollar amount. Left undrafted per
  the standing never-cite-an-unfetched-page rule rather than trust an aggregator's own number.
- 2026-11-13-M: A Daily Upside "Blue Origin Grounds Commercial Space Station Plans" piece that
  read as same-day corroboration for SpaceNews's real Nov. 13 "Blue Origin bows out of NASA
  commercial space station competition" scoop was actually a recirculated October 2023 Reuters
  story (Blue Origin reassigning most of the Orbital Reef team), caught only by checking the
  article's own stated byline date; Digg's own write-up (dated correctly, with its own "betting
  the Moon beats LEO real estate" framing) was used as the genuine second source instead. A sharp
  reminder that a same-topic, similarly-titled piece can still be stale-shaped resurfacing even
  when the real underlying story broke that same day elsewhere.
- 2026-11-13-N: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on one tagline at
  149 chars (max 140); merged cleanly on the second attempt ("merged 6 new, 1 updated, 0 held"),
  1245 items up from 1239. Confirmed via a direct `jq` read of all six new items'
  `snr`/`category`/`impact` fields and the Rassvet-4 item's grown `sources` (3, up from 1) and
  `updates` (1) arrays, plus a `jq empty` parse check on all seven touched data files (items, held,
  state, source_ledger, sources, candidates, registry-candidates). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~2h gap, unfiltered full source list (2026-11-13, fourth)

- 2026-11-13-O: A near-total-junk 68-candidate queue (Starship Flight 15 preview coverage, dozens of
  SpaceX/Tesla merger-speculation wire pickups, stock-analyst-call pieces, and Starlink/Ukraine saga
  rehash) traced every apparently-new lead to something already published: the Boca Chica "1,200
  acres, not the beach" clarification and the Zelenskyy mid-talks restriction claim were both already
  folded into their respective living-document items by an earlier sweep that same day. The only
  genuinely new, fetchable fact came from the mandatory signals-pass leg, not the queue: SpacePolicyOnline's
  bluesky account (Marcia Smith, verbatim via `getAuthorFeed`) gave the exact cause of ULA's Vulcan
  scrub to Nov. 14 ("power interruption in the Air Liquide gaseous nitrogen (GN2) plant causing a loss
  of their high-pressure pumps"), a detail a half-dozen WebSearch queries for the same fact only ever
  returned as unattributed synthesis, never from a page that would directly confirm it on fetch. Worth
  remembering that a signals-pass whitelisted bluesky account can out-source the open web on a fast-
  moving technical detail like a launch scrub cause.
- 2026-11-13-P: `bsky.app/profile/<handle>` post URLs needed for an `attach` citation aren't visible
  from the `getAuthorFeed` JSON reply by default; asking the fetch tool explicitly for the post's `uri`
  (`at://did/app.bsky.feed.post/rkey`) and reconstructing `bsky.app/profile/<handle>/post/<rkey>` from
  it worked cleanly, extending the 2026-11-11-H lesson on using the API endpoint over the profile page.
- 2026-11-13-Q: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 0 new, 1
  updated, 0 held"). Confirmed via a direct `jq` read of the ULA Vulcan item's grown `sources` (4, up
  from 3) and `updates` (1) arrays and the sweep log's `signals`/`discovery` blocks (17 channels
  checked, 8 discovery queries, 0 new candidates). A zero-new-item sweep with a single routine update
  is an honest result for a ~2-hour gap dominated by unflown-launch preview spam, not a sign something
  was missed.

## Narrow re-check, ~6.5h gap, unfiltered full source list (2026-11-13, fifth)

- 2026-11-13-R: Starship Flight 15 lifted off at 22:47 UTC and deployed its 26 Starlink V3 satellites
  cleanly, but SpaceX aborted the Super Heavy booster's tower-catch attempt (cause unclear) and
  diverted it to a Gulf of Mexico splashdown; the ship's own catch attempt remains pending ~22 hours
  out, well past this sweep's window, so `flights_successful` was deliberately left unattested on the
  vehicle crossfeed fact (only the monotonic `flights_total: 15` was attested) rather than guess at a
  final mission outcome that will only be known on a later sweep. The Launch Library entry itself
  (not just press coverage) already carried the abort/splashdown narrative text, confirming it is
  usable as an aggregator-tier LEAD for an in-progress multi-stage mission's partial outcome, not just
  the generic pre-launch mission description.
- 2026-11-13-S: A same-day satellitetoday.com "Office of Space Commerce Picks 4 Companies for
  Regulatory Pilot" piece read as fresh (dateline Nov. 13) but was a one-day-later trade rewrite of
  the already-published Nov. 12 item (`2026-11-12-osc-space-commerce-certification-pilot-cohort`,
  already at its official_record SNR 5 ceiling) with identical companies (Cowboy Space, Portal Space
  Systems, Redwire/SpaceMD, Starcloud) and the same Taylor Jordan quote; caught only by an
  items.json grep on the shared company (Redwire) before drafting, not by the headline looking novel.
  Worth the reminder that a trade outlet's own write-up of an official release can still lag the
  release itself by a full day and read as "today's news" in the queue.
- 2026-11-13-T: Andrew Jones's Bluesky post on CNSA's Tianwen-4 international payload call (Callisto
  lander added, Uranus flyby probe dropped) needed the `getAuthorFeed` verbatim-text re-fetch
  discipline (2026-11-13-P) to get the exact post text rather than a WebFetch paraphrase; the post's
  own linked `cnsa.gov.cn` URL itself `ECONNRESET`'d on every direct-fetch attempt (consistent with
  the standing pattern of Chinese government sites being intermittently unreachable), but an
  independent Italian outlet (hwupgrade.it, dated the same day, citing the same CNSA notice with
  additional instrument detail) gave real corroboration without needing the primary page. Classed
  Jones `whitelist`/`observer` (he is reporting CNSA's own action, not speaking for CNSA itself) and
  hwupgrade.it `informal` (no established-outlet precedent in this file). Also confirmed a
  WebSearch-synthesis claim about an FCC "36 next-gen Starlink gateways" grant (PCMag, 403'd on
  direct fetch) could not be distinguished from the already-known Jan. 2026 gigabit approval via any
  fetchable source; left undrafted per the never-cite-an-unfetched-page rule. A WSJ-sourced "Democrats
  order Musk to preserve Starshield records" piece recirculating via Google News traced entirely to
  the already-published Nov. 4-5 CNN/WSJ scoop (Blumenthal/Whitehouse/Shaheen/Coons letter already on
  the living-document item); left undrafted as a stale resurfacing, not a new Nov. 13 development.
- 2026-11-13-U: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on a same-company
  (SpaceX) + category (`launch`) dedup collision against `2026-11-06-spacex-ussf-432-vandenberg` (a
  second, older Falcon 9 Space Force launch in the trailing 7 days beyond the one already attested
  against `2026-11-12-spacex-ussf-627-vandenberg`); merged cleanly on the second attempt after adding
  both `dedup_distinct` entries ("merged 3 new, 0 updated, 0 held"), 1248 items up from 1245.
  Confirmed via a direct `jq` read of all three new items' `snr`/`category`/`impact`/`kind` fields
  (Starship Flight 15: SNR 4, aggregator base plus `corroboration_2plus`; Space42: SNR 4, trade base
  plus corroboration; Tianwen-4: SNR 4, whitelist/observer floor) and a `jq empty` parse check on all
  seven touched data files (items, held, state, source_ledger, sources, candidates,
  registry-candidates); held and registry-candidates were untouched (no held entries; none of the
  three new items' companies had a registry profile with a like-for-like crossfeed metric beyond the
  Starship `flights_total` monotonic-counter fact). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h08m gap, unfiltered full source list (2026-11-14)

- 2026-11-14-A: A WebSearch synthesis flatly claimed "Vulcan Centaur VC6L launched carrying 40
  LeoSat satellites for Amazon Leo" on Nov. 13, directly contradicting a same-query result two
  lines below it ("ULA scrubs Vulcan's Amazon Leo launch hours before liftoff, retries Saturday")
  and a direct Launch Library fetch (status "Go for Launch", NET Nov. 14 17:32:30 UTC, unchanged
  from the 2026-11-13-Q scrub already published). Trusted the direct Launch Library fetch and a
  second WebSearch pass over the synthesis's own contradiction rather than draft a launch that
  hadn't happened; extends the standing WebSearch-fabricates/conflates-dates caution to a case
  where the tool's own two result snippets disagreed with each other in the same response.
- 2026-11-14-B: A single WebFetch pass on a TASS article about the Soyuz-2.1b/KOEN/Kinosputnik
  launch rendered the date as "November 14, 2024" even though the launch, confirmed independently
  via Interfax (04:16 Moscow Time) and RussianSpaceWeb's own 2026 launch table, was same-day
  2026-11-14; treated as a WebFetch rendering artifact rather than a real two-year discrepancy and
  dated the item on the corroborated 2026-11-14 date. Worth the reminder that a single fetch's
  own stated date can be wrong even when every other fact it reports checks out.
- 2026-11-14-C: `spacenews.com` 429'd on three separate direct WebFetch attempts spread across the
  run (not just back-to-back retries) for a single story (Trusted Space/Falcon ExoDynamics), long
  enough that a genuinely distinct SpaceNews headline on the same deal was visible in search
  results but never readable; published off the PR Newswire wire release alone at an honest
  `crawl: "found_none"` (SNR 3) rather than cite the unread SpaceNews page. Worth a same-topic
  re-check next sweep once the rate limit clears, since SpaceNews very likely has independent
  reporting beyond the wire text here.
- 2026-11-14-D: The signals pass's RussianSpaceWeb/bluesky leg (Anatoly Zak) again out-sourced the
  queue and discovery pass for a same-day Russian launch: his bluesky post linked a truncated
  russianspaceweb.com URL that 404'd verbatim, but his site's own main 2026 launch table (not the
  dead link) gave the exact vehicle, payload names, and site; Roscosmos's own "first time private
  spacecraft were the main payload" framing and a subsidy quote from director Dmitry Bakanov came
  only from TASS/Interfax, not from Zak's page. Confirms a whitelisted tracker's post is often the
  trigger to go looking, not the full story itself.
- 2026-11-14-E: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 2 new,
  1 updated, 0 held"), 1250 items up from 1248. Confirmed via a direct `jq` read of both new items'
  `snr`/`snr_trace`/`category`/`impact` fields (Roscosmos/KOEN/Kinosputnik: SNR 4, mainstream base
  plus `corroboration_2plus`; Trusted Space/Falcon ExoDynamics: SNR 3, wire_pr base minus
  `corroboration_none`) and the Starship Flight 15 item's grown `sources` (7, up from 3) confirming
  the booster-explosion and Hawaii-ground-stop patch. A `dedup_distinct` against the same-company
  (Roscosmos) + category (`launch`) Nov. 7 GLONASS-K/Plesetsk item was attested up front and cleared
  on the first submit. A `jq empty` parse check passed on all six touched data files (items, state,
  held, source_ledger, sources, candidates); registry-candidates was untouched (no crossfeed facts).

## Narrow re-check, ~8h17m gap, unfiltered full source list (2026-11-14, second)

- 2026-11-14-F: A 93-candidate queue was almost entirely Starship Flight 15 aftermath (dozens of
  Google News/Bluesky rewrites of the booster-explosion/Gulf-splashdown story, already fully
  reflected on the existing item) and junk (stock-prediction listicles, a BBC sky-watching piece, a
  GTA6/ISRO-budget comparison, routine Federal Register airworthiness/fisheries notices, a Blue
  Vigil LLC tethered-drone FAA petition). A Xinhua "China-Thailand space cooperation turns tangible
  projects" roundup traced its only concrete claim (the GISTDA CubeSat-1/GalaxySpace launch) to an
  August 25, 2026 event; left undrafted as an evergreen retrospective with no new dateable fact,
  same treatment as the standing science-evergreen exclusion extended to geopolitical-cooperation
  recaps.
- 2026-11-14-G: The only genuine new find was European Spaceflight's own Avio/Vega C/IRIDE launch-
  slip piece (Ranzo's Nov. 11 earnings-call quote, picked up by the harvester's direct feed fetch of
  europeanspaceflight.com, not the signals leg). A second apparent corroborating hit (archyde.com)
  403'd on direct fetch, so the crawl landed `found_none`; Andrew Parsonson's own same-day bluesky
  post about his own article was correctly NOT counted as independent corroboration or a whitelist
  source, extending the 2026-11-06-M precedent for the exact same author/outlet pair. `next_flight_date`
  crossfeed was left empty rather than invent a precise date from Ranzo's "very close to Christmas
  Day" phrasing.
- 2026-11-14-H: Confirmed the signals-pass budget-rotation logic from first principles rather than
  from a prior entry: when a signals.json person's `fetchable` channel is the exact same domain as a
  regular sources.json feed the harvester already fetched this run (europeanspaceflight.com for
  Parsonson, spacepolicyonline.com for Marcia Smith), it's legitimate to drop that one duplicate leg
  from the 15-fetch budget and rely on the harvester's own fetch of the identical URL, rotating the
  saved budget onto channels with no such overlap (here, nothing extra was found either way).
  Fetched all 15 remaining channels via the `getAuthorFeed` API / site pages; nothing else was new
  beyond stories already published in prior sweeps (CNSA Tianwen-4 Callisto call, Blue Origin CLD
  exit, ULA Vulcan scrub cause, MaiaSpace delay, OHB Sentinel-3 NGT, Mynaric/SES optical demo,
  USSF EW orchestration vendors). A held.json entry from 2026-07-16 on Ma Xingrui (CNSA/CASC,
  scope question re: commercial-space angle) still has no Florian ruling; a Nov. 5 escalation to a
  formal bribery indictment (via Andrew Jones's bluesky, itself untouched this far from the window)
  doesn't change the underlying scope question, so no new held entry or action was taken.
- 2026-11-14-I: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on `coverage: ["launch",
  "eo"]` ("eo" is a tag, not a category); merged cleanly on the second attempt after trimming coverage
  to `["launch"]` ("merged 1 new, 0 updated, 0 held"), 1251 items up from 1250. Confirmed via a direct
  `jq` read of the new item's `snr`/`snr_trace`/`category`/`impact` fields (SNR 2, trade base minus
  `corroboration_none`, launch/noise) and a `jq empty` parse check on all seven touched data files
  (items, held, state, source_ledger, sources, candidates, registry-candidates); registry-candidates
  was untouched (crossfeed facts list was empty, honestly noted rather than inventing a precise
  `next_flight_date`). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~3h18m gap, unfiltered full source list (2026-11-14, third)

- 2026-11-14-J: A near-total-junk 58-candidate queue (Starship Flight 15 aftermath rehash, Starlink/
  Ukraine saga rehash, off-topic Tesla/SpaceX-merger-speculation chatter and stock-analyst pieces,
  spam-shaped Bluesky reaction posts) yielded zero new items but five genuine update-worthy facts, all
  found by chasing queue headlines past their first line rather than from the signals or discovery
  passes: SpaceX disclosed the Flight 15 booster-catch abort cause (an automated GNC trigger, not a
  hardware fault, per Dan Huot via Spaceflight Now) distinct from the "not disclosed" framing already
  published; ULA's Vulcan slipped a third time (network communication issue, now NET Nov. 15), confirmed
  independently by Marcia Smith's bluesky verbatim before any trade outlet's own write-up; Zelenskyy's
  Nov. 14 Reuters remarks added a sharper political-recognition framing ("already partially recognising
  the temporarily occupied territories as not ours") beyond the already-published technical/air-defense
  framing; a discovery-pass Equatys/D2D query surfaced Space42's own Q3 earnings release upgrading the
  Sept. 16 "commit up to $1 billion" MOU-shaped item to a signed "binding agreement," found via two
  wire-style republications (Sharjah24, Defense Arabia) rather than Space42's own newsroom (no registry
  org profile exists for Space42, so even a first-party-shaped page would cap at informal per the
  standing no-registry-host workaround); and a Kyiv Post direct fetch surfaced a named Ukrainian Air
  Assault Forces commander's on-record, if thin, Rassvet timeline assessment. Astrome's Rs 64.05 crore
  AI-ELINT grant (Adda247 queue entry) and the India ELINT headline were both confirmed stale resurfacings
  of the already-published Nov. 12 item on an items.json grep. A Peter Thiel/Founders Fund 13F disclosure
  ($17B of SpaceX stock reduced across Q3, confirmed via Yahoo Finance/24/7 Wall St.) was left undrafted:
  it's a secondary-market investor's portfolio filing, not a transaction by the tracked company itself,
  the filing states no reason, and it fails the "director acts on this" test, same treatment as the
  2026-11-12-G CalPERS/Grain precedent for investor-position stories.
- 2026-11-14-K: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 0 new, 5
  updated, 0 held"), 1251 items unchanged (update-only sweep). Confirmed via a direct `jq` read of all
  five updated items' grown `sources`/`updates` arrays (Vulcan: 7 sources/2 updates; Starship Flight 15:
  9 sources/2 updates; Starlink/Ukraine: 97 sources/44 updates; Equatys: 5 sources/1 update; Rassvet-4: 3
  sources/2 updates) and the sweep log's `signals`/`discovery` blocks (17 channels checked, 3 X handles
  attempted, 8 discovery queries, 0 new candidates). A `jq empty` parse check passed on all six touched
  data files (items, held, state, source_ledger, sources, candidates); registry-candidates was untouched
  (no crossfeed facts on any of the five update-only items). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h21m gap, unfiltered full source list (2026-11-14, fourth)

- 2026-11-14-L: `finalize-sweep.ts` rejected a first draft attempt for quoting SpaceX's own X post
  verbatim ("Mechazilla catches Starship!") inside `what_happened`: the exclamation-mark gate applies
  even to a direct, attributed first-party quote, not just to agent-authored hype. Paraphrasing the
  quote ("confirmed the catch...writing that its tower...had caught Starship") cleared it on the next
  attempt. Worth defaulting to paraphrase-with-attribution rather than verbatim-quote whenever a
  source's own exclamatory language is the only way to state a fact.
- 2026-11-14-M: A same-day queue/discovery/signals triage (86-candidate queue, almost entirely Google
  News/Bluesky rewrites of the Starship Flight 15 ship-catch story) correctly separated the mission's
  two distinct facts: the booster catch failure (already published 2026-11-13) and the ship's own
  tower catch, the first-ever recovery of an orbital-class rocket's upper stage, confirmed directly via
  SpacePolicyOnline's own queue-harvested piece (raw_excerpt alone gave the full story: Ship 42, 14
  orbits, ~22.5 hours, Mechazilla) plus direct fetches of Teslarati and a second, distinct CNBC article.
  Patched the existing item's headline/impact (notable to major) rather than draft a new one, since it
  is the same Flight 15 event. Separately, a UPI/LBC "Zelensky accuses SpaceX of lying" pair that read
  as a fresh escalation in the Starlink/Ukraine saga turned out to be a word-for-word match for facts
  an earlier same-day sweep had already folded into the item's top-level `what_happened` ("they say it
  is some kind of technical issue...SpaceX has denied introducing new restrictions"); always diff a
  seemingly-new saga quote against the item's current full copy, not just its `updates[]` log, before
  drafting. A discovery-pass "Amazon Leo Vulcan launch" hit (UPI photo captioned with today's date,
  several outlets describing it in past tense) was confirmed unflown via a direct Launch Library check
  (still "Go for Launch", NET the next day) before being left undrafted, extending the standing
  WebSearch-conflates-unflown-launches-with-completed-ones caution to wire-photo-caption artifacts
  specifically.
- 2026-11-14-N: Rocket Lab's 100th Electron launch (iQPS's 11th satellite, "The Mountain God Rises")
  cleared as a new `notable`-impact item once Launch Library's own launch record confirmed mission
  success (space.com/starlust syntheses alone didn't state it); `rocketlabcorp.com/updates/` still
  403's directly, so the lead stayed the Launch Library record with space.com (mainstream) and
  Starlust (informal, per standing precedent) as corroboration. `bun scripts/finalize-sweep.ts`
  rejected the first draft attempt on the exclamation-mark quote above; merged cleanly on the second
  attempt ("merged 1 new, 1 updated, 0 held"), 1252 items up from 1251. Confirmed via a direct `jq`
  read of both items' `snr`/`category`/`impact` fields and the Starship item's grown `sources` (12, up
  from 9) and `updates` (3, up from 2) arrays, the registry-candidates file's new Electron
  `flights_total: 100` monotonic-refresh proposal, and a `jq empty` parse check on all seven touched
  data files (items, held, state, source_ledger, sources, candidates, registry-candidates); held was
  untouched (no held entries). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~6h20m gap, unfiltered full source list (2026-11-15)

- 2026-11-15-A: A 73-candidate queue was almost entirely Starship Flight 15 ship-catch rehash
  (already published 2026-11-14) and the 100th Electron/iQPS launch (already published 2026-11-14,
  confirmed by matching the Launch Library mission title "The Mountain God Rises" to the existing
  item despite the queue calling it "iQPS Launch 10" vs. the item's "10th dedicated Electron mission
  for iQPS" framing); a Falcon 9 NROL-136 Launch Library entry was still NET Nov. 21, not yet flown.
  Bluesky's "satellite constellation" search leg surfaced an AFU-commander Rassvet quote that an
  items.json grep confirmed was already folded into the 2026-11-03 Rassvet-4 item's latest update
  verbatim. A Yahoo Finance "Simply Wall St." AI-written piece flatly claimed SpaceX had "signaled
  plans to retire Falcon 9," but a direct fetch found zero named source or SpaceX statement behind
  it (just unattributed analyst synthesis); left undrafted per the never-state-an-unattributable-claim
  rule rather than treat an AI-generated finance-site summary as reporting.
- 2026-11-15-B: All 3 HTML-only sources (Planet Labs Pulse, BlackSky News, EUSPA procurement) and 14
  of the 17 signals-pass fetchable channels (dropping Marcia Smith's spacepolicyonline.com site leg
  and Andrew Parsonson's europeanspaceflight.com site leg as duplicates of this run's own harvested
  feeds of the same two domains, both 304-unmodified, extending 2026-11-14-H) returned nothing newer
  than the window start; RussianSpaceWeb's own page rendered a "November 24, 2026" dateline on a
  Progress MS-36 preview despite the site's own "last updated November 13" stamp, a future-dated
  rendering artifact in the same family as 2026-11-14-B, not evidence of real content from the future.
- 2026-11-15-C: The 8-query discovery pass (full matrix) surfaced six stories that all traced to
  items already published in prior sweeps (CesiumAstro Series D, Northwood Series C, Revolv Space
  Series A, the France/Airbus-Thales IRIS contract, OHB's Sentinel-3 award, China's 29th Guowang
  batch) plus one genuine new development: Bloomberg's Nov. 12 and Nov. 14 reporting (read via
  Investing.com's Reuters pickup and a Yahoo Finance republish carrying the original Bloomberg
  byline, Bloomberg's own domain 403'd on direct fetch both times) that SpaceX-Tesla merger talks
  have advanced from the Oct. 20 "special committees formed" stage to negotiating price and control,
  with a deal possibly announced as early as December to coincide with Tesla's Dec. 3 annual meeting.
  Treated this as an attach-only update to the standing `2026-10-20-spacex-tesla-merger-committees`
  living-document item (same ongoing merger-talks story, same pattern as the Starlink/Ukraine and
  Rassvet sagas) rather than a new item, even though the gap since that item's last update is well
  past 7 days: the dedup rule's day windows are for distinguishing discrete events, not for capping
  how long a single continuing negotiation can keep accreting updates.
- 2026-11-15-D: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 0 new, 1
  updated, 0 held"), 1252 items unchanged (update-only sweep). Confirmed via a direct `jq` read of
  the merger-committees item's grown `sources` (11, up from 8) and `updates` (5, up from 4) arrays
  with `snr`/`impact` correctly unchanged at 4/major (an attach-only patch, no score-moving fields
  touched), and a `jq empty` parse check on all six touched data files (items, held, state,
  source_ledger, sources, candidates); registry-candidates was untouched (no crossfeed block on an
  update). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~9h gap, unfiltered full source list (2026-11-15, second)

- 2026-11-15-E: A near-total-junk ~90-candidate queue (almost entirely Starship Flight 15 ship-catch
  rehash, already published 2026-11-13/14, plus off-topic CGTN general-China and Futurism filler, zero
  entries from any direct trade/IR/regulatory feed despite the harvester fetching all of them) confirms
  2026-11-13-O's pattern once more: even a near-total-junk queue needs full per-candidate triage, but
  this time it genuinely yielded nothing beyond one signals-pass find.
- 2026-11-15-F: Re-checked the Star Vision/Oman Lens 20-satellite, $200M+ AI-constellation story flagged
  in 2026-11-12-T for a dedicated re-check: SCMP still 403's on every direct fetch, but a targeted search
  established "Oman Lens" is a distinct, pre-existing Omani startup (operates satellite OL-1, launched
  2024 from China) from "Adasat Oman" (the signer on the already-published Nov. 2 StarVision/Space Silk
  Road item). That distinction alone doesn't resolve whether the SCMP-reported 20-satellite/$200M+ deal
  IS the same Nov. 2 Beijing state-visit agreement (same companies, same program name, same scholarship/
  training numbers) reported from Oman Lens's angle, or a second, separate StarVision deal; left
  undrafted again rather than risk either double-counting one deal or citing an unfetched SCMP figure
  through content-mill mirrors. Worth a direct SpaceNews or SCMP fetch, or an Oman-side primary source,
  before ruling either way.
- 2026-11-15-G: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 0 new, 1
  updated, 0 held"), 1252 items unchanged (update-only sweep). Confirmed via a direct `jq` read of the
  Cosmos 2612/ICEYE-X36 item's grown `sources` (19, up from 18) and `updates` (11, up from 10) arrays
  with `snr` correctly unchanged at 4 (already at its non-first-party ceiling, no bump requested), and a
  `jq empty` parse check on all six touched data files (items, state, source_ledger, sources,
  candidates); held was untouched (no held entries; the update carried no crossfeed-eligible fact).
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Deep sweep (triggered by two prior zero-new sweeps), ~2h50m gap (2026-11-15, third)

- 2026-11-15-H: A 957-candidate deep-mode queue (dominated by hundreds of Starship Flight 15
  ship-catch and Vulcan/Amazon Leo return-to-flight rehash) still rewarded full per-candidate
  triage: an IHI press release (ihi.co.jp, Nov. 12) disclosed a new SAR-satellite demonstration
  lab in Tokyo and domestic assembly/testing of 2 of 4 ICEYE-procured satellites toward a
  contract that could grow to 24, while Nikkei separately reported (not confirmed by IHI's own
  page) a much larger 100-satellite/2030 dual-use ambition; led with IHI's own release and
  attributed the bigger, unconfirmed figure to Nikkei by name rather than merging the two into
  one stated fact, the same "first-party doesn't confirm the bigger number" caution as the
  2026-10-16-M RATLOG case, just inverted (here the SECONDARY source has the bigger number).
- 2026-11-15-I: Classed IHI's own ihi.co.jp press release `trade` rather than `first_party`,
  pre-empting the anti-spoof domain check rather than spending a submit-reject cycle on it: IHI
  has no `src/data/registry` organization entity, so there is no registry-recorded website for
  the gate to match against, the same no-registry-host workaround as the 2026-10-22-L National
  Academies case. Worth checking for a registry entity BEFORE attempting `first_party` on any
  company's own domain, not just after a rejection.
  Separately, a Payload-exclusive-shaped Canadian lunar-rover redesign story (CSA pivoting from
  a 4-ton/2034 to a 2-ton/earlier design) had two apparent corroborating hits
  (newspaceeconomy.ca, econotimes.com) that both explicitly stated "Payload reported" as their
  own source; correctly treated as non-independent and scored `crawl: "found_none"` (honest SNR
  2) rather than credited as `corroboration_2plus`, extending the wire-rewrite-collapse logic to
  a case where the rewrite says so in its own text rather than needing title-similarity
  detection.
- 2026-11-15-J: A dozen-plus discovery-pass leads that read as fresh on first WebSearch snippet
  (Pakistan's first foreign astronaut on Shenzhou-24, a Bridgit Mendler/Northwood profile piece,
  Isaacman's MAX POWER remarks, a Lynk/Omnispace merger, Amazon's Globalstar acquisition, a
  Globalstar-Rocket Lab FCC petition, France's IRIS contract, ESA/MaiaSpace's launcher-challenge
  delay, AST SpaceMobile's Q3 "45 satellites by mid-2027" figure, Anduril's eclipse-tracking
  demo) all traced via `items.json` id greps to stories already published across the past two
  weeks; a bare WebSearch snippet reading "new" is not evidence against a prior sweep having
  already caught it, especially during a Starship-Flight-15-saturated news cycle where
  secondary/rewrite outlets keep re-dating old facts. The Pakistan/Shenzhou-24 "first foreign
  astronaut on China's space station" story was left out of scope on a judgment call: a
  government-to-government diplomatic/training cooperation with no stated commercial contract,
  procurement, or market-access angle, distinct from the human-spaceflight carve-out's
  commercial-primes test (Commercial Crew, CLD, Artemis awards) and the geopolitical category's
  documented-commercial-angle requirement; flag for Florian if China/foreign-astronaut stories
  like this should instead publish under the general "equal weight to Chinese activity" clause.
- 2026-11-15-K: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 2
  new, 0 updated, 0 held"), 1254 items up from 1252. Confirmed via a direct `jq` read of both new
  items' `snr`/`category`/`impact` fields (CSA lunar rover: SNR 2, trade base minus
  `corroboration_none`, human-spaceflight/notable; IHI/ICEYE: SNR 4, trade base plus
  `corroboration_2plus`, constellation/notable) and the sweep log's `signals`/`discovery` blocks
  (15 channels checked, 12 discovery queries, mode "deep"). `bun run build` was not attempted,
  per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h41m gap, unfiltered full source list (2026-11-15, fourth)

- 2026-11-15-L: ULA's Vulcan suffered the company's first outright launch failure since its 2006
  founding on its Nov. 15 return-to-flight attempt, destroying all 40 Amazon Leo satellites aboard
  about 10 minutes into flight (Centaur upper stage anomaly). Treated as an `update` to the
  standing `2026-10-28-ula-vulcan-return-to-flight-nov13` item (same tracked launch event, now
  resolved) rather than a new item, patching headline/explainer/impact from `notable` to `seismic`:
  a flagship national-security launch vehicle's first-ever failure, grounding it again nine months
  after its last anomaly and destroying a major customer's satellites, clears the same bar as "first
  flight of a new orbital vehicle" (inverted) rather than a routine launch outcome. Led the patch on
  Spaceflight Now's own direct-fetched article (trade) with Launch Library's independently-confirmed
  "Launch Failure" status (aggregator/computed) as corroboration, plus SpacePolicyOnline (whitelist,
  her own site) and CBS News (mainstream, direct fetch, carried Amazon's own on-record quote: "there
  is risk with any launch... we believe they'll learn from this mission"); did not attest a
  `flights_total` registry crossfeed fact since crossfeed blocks apply only to `newItems`, not
  `updates`, per the draft schema.
- 2026-11-15-M: Confirms 2026-11-14-H's signals-pass budget-rotation logic a second time: with
  Marcia Smith's site and Andrew Parsonson's site each duplicating a domain the harvester already
  fetched this run, dropping those two legs from the 17 fetchable channels left exactly 15 to fetch
  within budget. Marco Langbroek's bluesky surfaced a Kosmos 2612/ICEYE-X36 maneuver detail that
  read as fresh but an `items.json` grep of the open incident item's own `updates[]` confirmed it was
  the identical fact an earlier same-day sweep had already attached; always diff a signals-pass find
  against the target item's existing `updates[]` text, not just assume a new-sounding post is new.
- 2026-11-15-N: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 0 new, 2
  updated, 0 held"), 1254 items unchanged (update-only sweep). Confirmed via a direct `jq` read of
  the Vulcan item's patched `headline`/`impact` (seismic, up from notable) and grown `sources` (11,
  up from 7) and `updates` (3, up from 2) arrays, and the Starlink/Ukraine item's grown `sources` (98,
  up from 97) and `updates` (45, up from 44) arrays, plus a `jq empty` parse check on all six touched
  data files (items, held, state, source_ledger, sources, candidates); registry-candidates was
  untouched (no crossfeed block on either update). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6h gap, unfiltered full source list (2026-11-16)

- 2026-11-16-A: A 61-candidate queue was almost entirely Starship Flight 15 ship-catch and Vulcan
  failure rehash (both already published 2026-11-14/15), SpaceX/Tesla stock-reaction spam, and
  bot-shaped Bluesky posts with no space content; the only genuine queue find was a Jio Platforms
  launch-partner-talks story (ISRO, Skyroot Aerospace, and separately SpaceX) for its 1,600-satellite
  broadband constellation, a concrete development on the standing June 19/July 17 Jio items (evaluation
  stage, then technical clearance) now five months old, drafted as a new item rather than an update
  since it was well outside both the 7-day and 30-day-reinforcement windows. The Mint-originated report
  ("three people familiar with the matter") was treated as ordinary trade/mainstream reporting with
  anonymous tipsters, not an unattributable rumour: Communications Today's own CT-bylined piece (no
  Mint credit visible) led as `trade`, with Business Today's explicitly Mint-citing piece as independent
  `mainstream` corroboration, landing a clean SNR 4.
- 2026-11-16-B: A Starlust CEO interview (Meridian Space's Massimiliano Ladovaz, on the launch-capacity
  crunch and a 2029 timeline prediction, with specific BryceTech figures) cleared the commentary bar on
  substance despite being single-sourced (`crawl: "found_none"` after a genuine search); landed an
  honest SNR 1 off Starlust's standing `informal` classification. Worth remembering a commentary item's
  SNR can legitimately land at the floor (1) when the lead is informal and no corroboration exists; the
  gate accepted it without complaint.
- 2026-11-16-C: Re-read `scripts/finalize-sweep.ts` directly rather than relying on this file's dedup
  precedents: the same-event dedup gate is category-agnostic only as a FALLBACK (shared source URL or
  near-identical headline across categories); an exact-category match is still required for the
  baseline same-company-plus-category trigger. Both new items' companies (SpaceX, ISRO) shared with
  several same-window items only by DIFFERENT categories (product, financial, contract, launch vs. this
  draft's constellation/launch), so no `dedup_distinct` was needed for the Jio item at all, and only two
  entries (both same-category SpaceX+launch items) were needed for the Meridian commentary item. Worth
  checking the actual category overlap before assuming a prolific-actor item needs a dozen preemptive
  `dedup_distinct` entries; the crowded-field precedents in this file were all genuine same-category
  collisions, not evidence the gate fires on company alone.
- 2026-11-16-D: Confirmed the signals-pass budget-rotation logic (2026-11-14-H/2026-11-15-B) a third
  time: Marcia Smith's spacepolicyonline.com and Andrew Parsonson's europeanspaceflight.com were both
  already in this run's harvester health block (200 and 304-not-modified respectively), so their direct
  site fetches were dropped from the 17-channel budget, leaving 15 fetched individually; nothing new
  surfaced beyond a Langbroek Cosmos 2612 maneuver note already folded into the existing item by the
  prior sweep.
- 2026-11-16-E: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 2 new, 0
  updated, 0 held"), 1256 items up from 1254. Confirmed via a direct `jq` read of both new items'
  `snr`/`snr_trace`/`category`/`impact`/`kind` fields (Jio: SNR 4, trade base plus `corroboration_2plus`;
  Meridian: SNR 1, informal base, commentary) and the sweep log's two unrelated persistence-bump
  `snr_movements` entries (Boost Mobile/EchoStar talks 2→3, STIF valve order 3→4). `bun run build` was
  not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~43m gap, unfiltered full source list (2026-11-16, second)

- 2026-11-16-F: A near-total-rehash 30-candidate queue (Starship Flight 15 ship-catch, the Vulcan
  failure, the SpaceX/Tesla merger talks, the Starlink/Ukraine saga, and a stale 11-day-old Nov. 5
  France/Airbus-Thales IRIS contract resurfacing via two new outlets with no new figure) yielded
  nothing from the queue itself, but Marcia Smith's bluesky (the signals pass, posted minutes before
  this run's `now`) surfaced a genuinely fresh fact on the open Vulcan item: the FAA is requiring ULA
  to conduct a mishap investigation and activated two Debris Response Areas after debris fell outside
  the closed hazard zones. Her post linked a `faa.gov/newsroom/statements/general-statements` URL that
  403'd on direct fetch (standing .gov block); a WebSearch corroboration crawl found only a
  self-contradicting synthesis (one line claiming the FAA said it had no jurisdiction since this was a
  "government mission," which is wrong for a commercial Amazon Leo payload and reads like conflation
  with an unrelated earlier NSSL mishap-authority question) and no direct mainstream confirmation yet;
  trusted Marcia Smith's own post over the WebSearch synthesis per the standing never-trust-a-
  self-contradicting-synthesis-over-a-direct-source rule, folded in via `attach`+`patch` at her
  standing `whitelist`/`observer` class, no `bump` (item capped at SNR 3 by a standing same-metric
  dispute that survives rescores).
- 2026-11-16-G: An 8-query discovery pass (full matrix) surfaced one genuine miss from an earlier
  sweep: Reflect Orbital's Nov. 10 $73.5 million raise (total funding now over $100M), reported by
  SpaceNews, the company's own site, and PV Tech, confirmed independently via the company's own X post
  through the syndication endpoint. Classed the company's own `reflectorbital.com` press release
  `trade` rather than `first_party` up front (no registry org profile exists for Reflect Orbital, so
  there is no registry-recorded website for the anti-spoof gate to match against), extending the
  2026-11-15-I/2026-10-22-L no-registry-host workaround. Drafted dated on the actual Nov. 10 event per
  the standing predates-window chase-it exception rather than as a stale miss.
- 2026-11-16-H: `bun scripts/finalize-sweep.ts` rejected the first draft attempt for listing
  `europeanspaceflight.substack.com/feed` (the channel's `rss` value) in `signalsPass.checked`; the
  gate matches against the channel's `url` field from `signals-context` (`europeanspaceflight.substack.com`,
  no `/feed`), not the RSS endpoint actually fetched. Swapping to the bare `url` cleared it on the second
  attempt ("merged 1 new, 1 updated, 0 held"), 1258 items up from 1257. Confirmed via a direct `jq` read
  of the new Reflect Orbital item's `snr`/`snr_trace`/`category`/`impact` fields (SNR 4, trade base plus
  `corroboration_2plus`, financial/notable) and the Vulcan item's grown `sources` (12, up from 11) and
  `updates` (4, up from 3) arrays with `snr` correctly unchanged at 3 (dispute cap survives rescore), and
  a direct `jq empty` parse check on all six touched data files (items, held, state, source_ledger,
  sources, candidates); registry-candidates was untouched (no registry entity for Reflect Orbital, no
  crossfeed block on the Vulcan update). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~8.5h gap, unfiltered full source list (2026-11-17)

- 2026-11-17-A: A 100-candidate queue was almost entirely Starship Flight 15 catch and Vulcan-failure
  stock/political rehash (SpaceX data centers, Tesla-merger chatter, FAA Starbase comment-period
  updates already folded into the standing EIS item, an xAI/SpaceXAI Mississippi turbine permit ruling
  that is data-center, not space), but five Via Satellite/SpaceNews/wire-service stories the harvester
  queued without obvious rehash markers (ICEYE Gen5, Umbra's next 7 launches, LeoLabs/FishEye, Meridian
  Space's antenna validation, SpaceNukes' Los Alamos facility) plus a TransAstra capture-bag press
  release from the incidents+regulation feed all turned out to be genuine, un-published same-day news:
  full per-candidate triage stayed worth it even when the top of the queue reads as 95% rehash.
- 2026-11-17-B: The Bluesky `bsky.app/profile/<handle>` pages WebFetch renders are an empty JS shell
  (confirmed across 6+ distinct signals-pass channels this run, not a one-off); the AT Protocol public
  API endpoint `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=10`
  returns real post text, timestamps, and (on request) the post's `uri` (`at://did:.../app.bsky.feed.post/<rkey>`)
  from which the citable `https://bsky.app/profile/<handle>/post/<rkey>` permalink is constructed. Use
  this API for every signals-pass Bluesky channel instead of fetching the profile page directly; it is
  how this run surfaced Andrew Jones's (whitelisted, observer-floor) Galactic Energy Huoniao-6 post.
- 2026-11-17-C: ICEYE's Gen5 SAR satellite announcement (a new product generation with new specs) and
  the standing `2026-11-12-ihi-domestic-sar-satellite-assembly` item (IHI assembling existing-generation
  ICEYE-designed satellites toward an older supply contract) share company+category+a sub-7-day gap but
  are genuinely distinct events; `dedup_distinct` with a one-line reason cleared the gate on the first
  retry. The `explainer.tagline` 140-char cap bit six of nine drafted items this run (all written to
  ~150-185 chars before trimming); write taglines tighter the first time, closer to ~120 chars, to avoid
  the multi-round trim-and-retry cycle.
- 2026-11-17-D: `bun scripts/finalize-sweep.ts` merged cleanly on the fourth attempt (three prior
  rejections: one dedup match, five consecutive tagline-length rejections resolved one item at a time
  since the gate reports only the first violation per run) with "merged 9 new, 0 updated, 0 held", 1267
  items up from 1258. Confirmed via a direct `jq` read of all nine new items' `snr`/`category`/`impact`
  fields (ICEYE Gen5: SNR 5 first-party ceiling; Umbra, LeoLabs/FishEye, TransAstra, Galactic Energy: SNR
  4; Meridian, SpaceNukes, UK MOD Starshield, Ramaphosa/BEE: SNR 2 off a `found_none` corroboration
  penalty), and a direct `jq empty` parse check on all six touched data files (items, held, state,
  source_ledger, sources, candidates); held and registry-candidates were untouched (no held entries, no
  registry entities for any of the nine companies to crossfeed against). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~11h gap, unfiltered full source list (2026-11-17, second)

- 2026-11-17-E: Thales Alenia Space's own press release for "Space Cargo Unlimited and Thales Alenia
  Space unveil details of their alliance" (thalesaleniaspace.com, registry-domain-matched first_party)
  turned out to be dated December 2, 2022, the original contract-signing announcement, with a different
  timeline (2-3 month missions, late-2025 target) than today's actual Space Tech Expo Bremen unveiling
  (1,200L/2.5kW/six-month-mission REV1 specs, 2028-2030 target). A first-party page surfaced by searching
  the exact company+product name can be the WRONG, years-stale document even when its domain passes
  every anti-spoof check; led with Payload's and Aviation Week's direct, same-day trade coverage instead
  and left the 2022 release unused. Worth checking a first-party press release's own dateline against the
  event being drafted, not just its domain, before trusting it as today's source.
- 2026-11-17-F: NATO's own nato.int article was pre-emptively classed `trade`, not `official_record` or
  `first_party`, since NATO (like ESA-less institutions UK MOD, France's DGA, and EU bodies in prior
  entries) has no `src/data/registry` entity for the anti-spoof host check to match against; a second,
  independently-written trade outlet (defence-industry.eu) gave `corroboration_2plus` cleanly. Worth
  extending the standing no-registry-host workaround to NATO specifically.
- 2026-11-17-G: A near-total-junk ~124-candidate queue (SpaceX stock-reaction/13F-filing spam, Starship
  Flight 15 and Vulcan-failure rehash, dozens of off-topic CGTN/Futurism/Federal-Register entries) still
  buried a seismic find in a single queue headline: ICEYE's own 2.05 billion euro public tender offer for
  Avio, found via the queue's lone europeanspaceflight.com entry and independently confirmed by Il Sole 24
  Ore, Bloomberg (403'd, used only via search snippets), and Rafal Modrzewski's own X post. ICEYE's own
  `iceye.com` press release (found via a targeted WebSearch, not the queue) gave the full first-party
  figures and reached the direct-source SNR 5 ceiling despite being an unsolicited, unaccepted bid still
  needing five countries' regulatory clearance.
- 2026-11-17-H: Seven further genuinely new, same-day items (REV1, Ramon.Space Series B, Firefly/QASCOM,
  SEOPS/Stoke Nova, Asynchronics seed, Cosmo Bee/D-Orbit, the $985M NSSL Lane 2 contract mod, and a Delta
  CEO Bastian Starlink-dismissal commentary piece) all came from direct Payload/SpaceNews/trade queue
  entries or a Google-News redirect chased to its originating outlet (ClearanceJobs, Defense Daily for the
  NSSL item; Yahoo Finance/View from the Wing for the Bastian commentary), not the discovery or signals
  passes. The NSSL item's own ClearanceJobs/Defense Daily leads stated no per-company dollar breakdown and
  no funds obligated; left that split out entirely rather than infer one from a WebSearch synthesis that
  cited unconfirmed per-company figures.
- 2026-11-17-I: The same-company-plus-category dedup heuristic fired five separate ways across this
  draft's ten items (ICEYE/financial vs. the Nov 11 Greece/HIIF item; Thales Alenia/product vs. the Nov 12
  OwlO Cloud item; Firefly/contract vs. the Nov 10 Synspective deal; D-Orbit/product vs. the Nov 16
  SpaceComputer demo; SpaceX/contract vs. the Nov 10 Singulus order; and three separate SpaceX/product
  collisions on the Bastian commentary alone). Pre-empting all of them from a `jq` scan of the full Nov
  10-17 window by category, rather than drafting first and reacting to rejections, got a clean first-attempt
  merge ("merged 10 new, 0 updated, 0 held", 1278 items up from 1268).

## Narrow re-check, ~29min gap, unfiltered full source list (2026-11-17, third)

- 2026-11-17-J: `candidates-context`'s `window_start` can sit well before `sweep-context`'s `lastSweep`
  (here, two full days earlier) even in `mode: "normal"`; the candidates queue is a global, independently-
  windowed cursor, not keyed to this run's own gap, so a short-gap sweep can still see a wide queue window.
  Worked from the queue's own output as instructed regardless of the mismatch.
- 2026-11-17-K: A 17-candidate queue, 29 minutes after a 10-item merge, was entirely rehash/noise: unflown
  USSF-317 preview spam (Bluesky FAA bot, Google News, Launch Library), stale Starship-catch rehash, two
  separate investor-13F-disclosure stock pieces (Tepper's $518M SpaceX bet, Berkshire/Nvidia stake moves,
  both the standing investor-position-not-a-company-transaction exclusion), and a Musk "SpaceX assumes
  zero sales to OpenAI" remark (SpaceX's terrestrial AI/compute business, out of scope per the standing
  2026-11-06-H exclusion). A Havana Times "Cuban police prepare block-by-block Starlink offensive" piece
  was judged out of scope on a fresh instance of the pattern: it is Cuba's domestic crackdown on citizens'
  unauthorized Starlink antennas (censorship/contraband enforcement), with explicitly "no official
  confirmation" of a nationwide operation, not an operator or government statement about commercial
  service policy; flag for Florian if cross-border Starlink-access-crackdown stories like this should
  publish anyway under the geopolitical category.
- 2026-11-17-L: All three mandatory HTML sources (Planet Labs, BlackSky, EUSPA procurement) and 14 of 17
  fetchable signals channels (dropping Parsonson's site+substack and Marcia Smith's site legs as
  harvester-duplicate domains, both 304-not-modified) traced entirely to already-published items;
  confirmed via direct `items.json` greps rather than assumption (Parsonson's ICEYE/Avio bid and Avio/
  Vega-C Christmas-Day items, Andrew Jones' Galactic Energy Huoniao-6 post, and SpacePolicyOnline's FAA/
  Vulcan mishap-investigation note were all already in the feed verbatim). A SpacePolicyOnline post merely
  linking the Senate Appropriations Committee's just-unveiled FY2027 defense bill, with no space-specific
  figure in the post itself, led to a WebSearch rabbit hole (Golden Dome cut to $9.4B) that never produced
  a directly-fetched source with a Space Force/NSSL-specific breakdown; left undrafted as a
  still-unveiled, not-yet-passed appropriations bill with no independently confirmed space line item,
  not a missed story.
- 2026-11-17-M: The 8-query discovery pass's lone genuine find (Freezz Italia's ESA IRIS2 Low-LEO VLEO
  direct-to-device Consolidation Phase contract, via a Google-indexed IRW-Press/ACCESS Newswire release)
  had a dozen-plus mirrors (German, Spanish, Italian, English) but all traced to the same one wire
  release; no SpaceNews/Payload/European Spaceflight pickup existed on a dedicated second search, landing
  an honest `crawl: "found_none"` wire_pr-base SNR 3. The new item's only shared element with two
  unrelated same-week ESA items (MaiaSpace launcher-challenge delay, Thales Alenia/TeQuantS quantum
  contract) was company "ESA" + category `contract`; two `dedup_distinct` entries cleared the standing
  heuristic on the second attempt. `bun scripts/finalize-sweep.ts` merged cleanly on the second attempt
  ("merged 1 new, 0 updated, 0 held"), 1279 items up from 1278. `bun run build` was not attempted, per
  the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~8h gap, unfiltered full source list (2026-11-18)

- 2026-11-18-A: Cameron County commissioners voting 3-2 against a public hearing on SpaceX's tax
  abatement request for its $24 billion Starbase data center/gas-plant plant was left entirely out of
  scope, extending the 2026-11-06-H/2026-11-10-A terrestrial-AI/compute-business exclusion from the
  compute-deal financial stories themselves to a LOCAL TAX dispute whose subject is squarely that same
  excluded data center (no launch, satellite, or EO/connectivity angle at all); a same-day Politico piece
  on the data center's Texas air permit was excluded on the identical reasoning. Worth remembering the
  exclusion travels with the data-center subject matter, not just with "financial event" framing.
- 2026-11-18-B: A third ESA+`contract` same-company-plus-category dedup collision this week (against the
  Nov. 12 MaiaSpace launcher-challenge delay, the Nov. 16 Thales Alenia/TeQuantS quantum contract, and
  the Nov. 17 Freezz Italia IRIS2 item, all three at once) confirms ESA's prolific contract cadence now
  needs the same pre-emptive multi-entry `dedup_distinct` treatment as SpaceX; a brand-new OHB/ClearSpace-1
  debris-removal contract needed three entries in one draft to clear on the second attempt.
- 2026-11-18-C: ULA's CEO is now Mark Peller, not Tory Bruno (who resigned per earlier entries); Aviation
  Week's Nov. 17 Vivienne Machi byline quoting him on the Vulcan anomaly investigation ("centers around
  core stage booster... powered by a pair of BE-4 engines") reads as pointing toward the engines, while
  the same day's Ars Technica piece (citing ULA's own statement) says the early data "may not be due to
  BE-4 engines" and instead describes low booster performance causing early stage separation; folded both
  readings into the item's `what_happened`/`why_it_matters` attributed to their outlets rather than picking
  one, per the standing metric-mismatch-is-annotated-not-punished rule. The item's SNR correctly held at 3
  (the standing same-metric dispute cap survives the rescore).
- 2026-11-18-D: Texas's frozen $109M Starlink BEAD award (standing Aug. 12 item) got a genuine escalation
  via Fortune: Gina Hinojosa, who sued Abbott for his Musk emails and unseated him in the Nov. 3 election
  to become Texas's first Latina governor, and incoming AG Nathan Johnson have both pledged to investigate
  the broadband office's shift from calling satellite "non-reliable" to funding Starlink as possible
  favoritism. Worth watching next sweep for Hinojosa's own campaign-trail "data center freeze" pledge
  (per the same Fortune piece's sourcing) materializing as an actual state action against the Cameron
  County-adjacent Terafab/Starbase buildout, which would be a genuinely new, in-scope regulatory fact
  distinct from the out-of-scope tax-abatement vote itself.
- 2026-11-18-E: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the triple ESA+contract
  dedup collision above; merged cleanly on the second attempt ("merged 5 new, 4 updated, 0 held"), 1284
  items up from 1279. Confirmed via a direct `jq` read of all five new items' `snr`/`impact`/`category`
  fields and all four updated items' grown `sources`/`updates` arrays (Vulcan: 15 sources/5 updates, SNR
  held at 3; Texas BEAD: 2 sources/1 update, SNR 3 to 4; AST SpaceMobile/Firefly: 8 sources/5 updates, SNR
  held at 5; SpaceX/Apollo financing: 10 sources/7 updates, SNR held at 4), the sweep log's three unrelated
  persistence-bump `snr_movements` entries, and a `jq empty` parse check on all six touched data files
  (items, held, state, source_ledger, sources, candidates). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~3h42m gap, unfiltered full source list (2026-11-18, second)

- 2026-11-18-F: `scoring.whitelist: "observer"` on a commentary item needs an actual source entry
  classed `whitelist` under a verified-active signals.json channel in that item's `scoring.sources`;
  attesting the floor off a trade outlet's report of a whitelisted analyst's (Tim Farrar) X quote,
  with no fetchable copy of his own channel confirming it, gets rejected ("the floor is earned by
  membership, not attested"). Setting `whitelist: null` and letting the plain trade-base-plus-
  corroboration math run (Light Reading lead, a Stocktwits/Yahoo Finance mirror as the second
  distinct source) still landed a clean SNR 4; worth remembering the floor requires citing the
  person's own channel, not just a report of what they said elsewhere, even when they are genuinely
  signals.json-whitelisted and the quote is corroborated across multiple direct fetches.
- 2026-11-18-G: A near-total-junk 28-candidate queue (SpaceX/Tesla stock and merger-speculation
  chatter, Starship-catch and Vulcan-failure rehash already published 2026-11-14/15/18) still
  yielded one genuine commentary gap via the open-web discovery pass, not the queue: analyst Tim
  Farrar's X post (quoted identically across three independently-fetched trade outlets) urging Musk
  to guarantee 50+ Falcon 9 flights/year to third parties after Vulcan's failure. Also confirmed a
  WebSearch-synthesis fabrication the standing pattern predicts: a search result flatly claimed "the
  Space Force suspended Vulcan launches for NSSL" following the failure, but a direct CNBC fetch
  showed the real fact is a pre-existing Pentagon certification hold pending that mission's outcome,
  not a new suspension triggered by the failure. All three mandatory HTML-only sources (Planet Labs
  Pulse, BlackSky News, EUSPA procurement) traced to already-published or already-judged-too-thin
  ground (BlackSky's Nov. 10 MoD contract, the EUSPA Space Traffic Coordination Platform listing
  flagged thin on 2026-10-24-H).
- 2026-11-18-H: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the whitelist-
  floor misuse above; merged cleanly on the second attempt ("merged 1 new, 3 updated, 0 held"), 1285
  items up from 1284. Confirmed via a direct `jq` read of the new Farrar item's `snr`/`snr_trace`/
  `category`/`impact`/`kind` fields and all three updated items' grown `sources`/`updates` arrays
  (FAA Starbase EIS: 5 sources, 2 updates; Starlink/Ukraine: 99 sources, 46 updates; Starship Flight
  15: 14 sources, 4 updates). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md
  procedure update.

## Narrow re-check, ~10.5h gap, unfiltered full source list (2026-11-18, third)

- 2026-11-18-I: A signals-pass X search for Vast CEO Max Haot (not on any fetchable channel type,
  only `x`) surfaced a real, substantive update to the open Nov. 4 Axiom/Vast lawsuit item sitting
  at a single-sourced SNR 2: Haot's own X post explaining the disputed mission-planning document
  came from a subcontractor shared with Axiom and that Vast had already corrected and resubmitted
  it to NASA, plus an on-record denial ("Vast did not take anything from Axiom, and any suggestion
  otherwise is false."). `x.com` itself now 402s on direct WebFetch (a new failure mode, previously
  just login-walled); the public syndication endpoint
  (`cdn.syndication.twimg.com/tweet-result?id=<status_id>&token=a`) still returned the verbatim
  (truncated) text and was enough to cite. Classing the post `whitelist`/`self` (Max Haot's org
  "Vast" matches the item's own `companies` array; he is the concerned party speaking about its own
  conduct) plus a genuine third source (Starlust) moved the item via `rescore` from SNR 2 to 5 in
  one pass (`corroboration_2plus` +1, `whitelist_floor` self +1, both applied on top of the
  unchanged mainstream base 3). Worth remembering the self/observer whitelist floor applies to a
  company's own denial/defense statement just as readily as to a plain factual claim; the SNR
  scores the attribution, not which side of a dispute turns out to be right.
- 2026-11-18-J: A near-total-junk 123-candidate queue (SpaceX/Tesla-merger and Anthropic-IPO-vs-
  SpaceX comparison spam dominating Google News: launch, Starship/Vulcan rehash, a wall of CGTN
  filler and Federal Register routine notices) still yielded six genuinely new, same-day items once
  chased past the headline, all via Payload/European Spaceflight/ESA/Xinhua rather than the queue
  itself: a Dcubed funding round, PLD Space's first commercial Miura 5 launch contract (Mitsubishi
  Electric), CUBECOM's Netherlands office, Inflection Space Systems' first booked mission, ESA's
  Sentinel-3C SLSTR first-light images, and a Chinese Academy of Sciences Q/V-band satellite-
  internet speed-record claim (scored `trade`, "per Xinhua, unverified," per the state-media edge
  case rule, since the entire story is a performance claim). Two apparent discovery-pass finds
  (an Isar Aerospace/Maritime Launch Services Nova Scotia spaceport deal, an ESA Sentinel-1 NGT
  contract to Thales Alenia Space) both turned out to be stale articles from July and June 2026
  respectively resurfacing in a plain WebSearch with no date filter; always check a search hit's
  own byline/publish date before treating it as today's news, even when the query specified
  "November 2026." A Nigeria NASRDA six-satellite, $2 billion sovereign procurement program ("95%
  complete," IAI/Thales Alenia Space/China Great Wall Industry Corp as expected partners) traced to
  an Oct. 2 original statement with contracts still unsigned, due at the Nov. 24-27 ASEICC
  conference in Abuja; left undrafted as a pre-signing "coming soon" restatement, worth checking
  again after ASEICC for the actual signed contracts.
- 2026-11-18-K: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 6 new,
  1 updated, 0 held"), 1291 items up from 1285. Confirmed via a direct `jq` read of all six new
  items' `snr`/`category`/`impact` fields (Dcubed and PLD Space/Mitsubishi both SNR 4 off
  `corroboration_2plus`; ESA Sentinel-3C SNR 5 first-party ceiling; CUBECOM, Inflection Space, and
  the China Q/V-band item all SNR 2 off `corroboration_none`) and the Axiom/Vast item's rescore
  (SNR 2 to 5, 3 sources, 1 update), plus a `jq empty` parse check on all seven touched data files
  (items, held, state, source_ledger, sources, candidates, registry-candidates); held was untouched
  (no held entries; none of the six new items' companies had a registry profile with a like-for-like
  crossfeed metric). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~1h gap, unfiltered full source list (2026-11-18, fourth)

- 2026-11-18-L: ULA's own blog (blog.ulalaunch.com, registry-domain-matched first_party) narrowed
  the open Vulcan failure's cause from the vaguer "low booster performance" framing already in the
  item to a specific finding: inadequate fuel supply from the vehicle to the BE-4 engines, not the
  engines' own performance. Marcia Smith's bluesky independently carried the identical quote minutes
  later, giving a clean second-source confirmation. The item's `explainer.what_happened` text was
  still the ORIGINAL Oct. 28/Nov. 15 draft wording, missing both the Nov. 16 FAA mishap-investigation
  fact and a Nov. 17 Peller/BE-4 quote that a prior sweep had apparently patched onto a stray
  top-level `what_happened` key instead of nesting it under `explainer` (the site only ever renders
  `item.explainer.what_happened`, per `src/pages.tsx`, so that Nov. 17 patch never actually displayed).
  Rewrote `explainer.what_happened` from scratch with the full current narrative (failure, FAA
  investigation, today's fuel-supply finding) rather than just appending today's delta, to resync the
  rendered copy; worth checking a long-running saga item's actual `explainer.what_happened` against
  its own `updates[]` log before assuming prior copy patches landed where the site reads them.
- 2026-11-18-M: A "New details emerge in SpaceX's $40B debt plan" queue lead traced to a single
  Bloomberg report (Bloomberg.com itself 403'd) mirrored non-independently by both briefs.co and a
  Yahoo Finance republish, both explicitly crediting Bloomberg by name; attached only one
  (briefs.co, "Bloomberg (via Briefs)", mainstream) rather than stacking the second non-independent
  mirror. Gave the first-tranche-to-market bond terms (5-year Nvidia chip lease with no
  force-majeure exit, Moody's A3/Kroll A- ratings, Goldman Sachs/Apollo underwriting an Atlas SP
  SPV) that the existing item's `explainer.what_happened` never had (it was still the Oct. 6
  "seeking to raise... expected to close in 2027" draft text, stale against the item's own
  already-updated headline/SNR); rewrote the explainer field in full for the same resync reason as
  -L above.
- 2026-11-18-N: A near-total-junk 23-candidate queue (Anthropic-IPO-vs-SpaceX stock comparisons,
  SpaceX/Tesla merger and Starship-catch rehash, a Musk/Duffy free-Starlink-for-FAA X spat) and
  three quiet mandatory HTML sources yielded nothing else: the Musk/Duffy spat was left out of
  scope on a judgment call (Musk's own X claim is unconfirmed by DOT/FAA on the specific offer,
  no stated terms/scope/date, reads as political blame-exchange rather than a procurement event a
  director would act on); flag for Florian if this read is too strict. A NASA SkyFall/DRACO "why
  are the helicopters riding a nuclear rocket" space.com piece was a background explainer/feature,
  not a dated event, left out per the evergreen-explainer exclusion. An HPQ Silicon battery-pack
  accessory for Starlink Mini (GlobeNewswire) was judged too thin/tangential (a non-tracked
  materials company's third-party accessory, "not affiliated with or endorsed by SpaceX") to clear
  the inclusion bar. An 8-query discovery pass (full matrix) and a 15-of-17-channel signals pass
  (Marcia Smith's and Andrew Parsonson's own-domain site legs dropped as harvester duplicates, both
  304/already-covered) surfaced nothing beyond items already published, mostly in this same day's
  16:16 UTC sweep (Dcubed, PLD Space/Mitsubishi, OHB ClearSpace-1, Thales Alenia/TeQuantS, Freezz
  Italia/IRIS2). `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 0 new,
  2 updated, 0 held"), 1291 items unchanged (update-only sweep). Confirmed via a direct `jq` read of
  both updated items' `snr`/`impact` fields, correctly unchanged (Vulcan: 3/seismic, dispute cap
  survives; SpaceX financing: 4/major), their grown `sources` (Vulcan 17, up from 15; financing 11,
  up from 10) and `updates` (Vulcan 6, up from 5; financing 8, up from 7) arrays, and a `jq empty`
  parse check on all six touched data files (items, held, state, source_ledger, sources,
  candidates); held and registry-candidates were untouched (no held entries; both touched items
  were updates, which carry no crossfeed block). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h17m gap, unfiltered full source list (2026-11-19)

- 2026-11-19-A: Two discovery-pass leads that read as fresh gaps (a Bloomberg-sourced "NATO turns to
  commercial rockets" piece on the Starlift initiative; a SatNews piece on the Senate Appropriations
  SpaceX sole-source-award restriction) both turned out to already be published by an earlier sweep
  the same day, caught only by a direct `items.json` grep for the distinctive terms ("Starlift",
  company "SpaceX" + category "procurement") before drafting, not by the queue or a title match
  (NATO's own item used a differently-worded headline and a `nato.int` primary source neither of my
  WebSearches had surfaced). Worth grepping `items.json` for a candidate's most distinctive proper
  noun before spending further research time on it, even when the candidate seems to come from an
  outlet/angle the existing item's sources don't show.
- 2026-11-19-B: A mainstream source (BBC, via a Yahoo News mirror) had already been attached to the
  living-document Starlink/Ukraine saga item on 2026-11-15, but its specific quotes (the 161km/h
  drone-interception mechanism, the winter-energy-infrastructure stakes, "right side of history")
  never made it into the item's `explainer.what_happened` text; a prior sweep attached the URL as
  corroboration without folding its content into the copy. Patched the explainer from the article
  content directly rather than assuming an already-attached source has nothing left to add; worth
  checking a saga item's actual prose against each attached source's content, not just assuming
  attachment implies full use, when a source's publish date suggests it might carry a distinct quote.
- 2026-11-19-C: ALATYR (French orbital-data-center startup), Flexell Space, All Points Logistics,
  Expeditors International, Star Catcher Industries and Common Space all lack `src/data/registry`
  organization profiles, so even their own-domain or own-release pages cap at `wire_pr`/`trade`
  rather than `first_party`, consistent with the standing no-registry-host precedent (2026-10-22-L
  and many peers); none of this run's crossfeed blocks needed a fact since none of the six new
  items touched a profiled entity's crossfeed-eligible fields.
- 2026-11-19-D: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 6 new, 2
  updated, 0 held"), 1297 items up from 1291. Confirmed via a direct `jq` read of all six new items'
  `snr`/`category`/`impact` fields and both updated items' grown `sources` arrays (ICEYE/Avio: 4
  sources, up from 3; Starlink/Ukraine: 99 sources, unchanged, copy-only patch) and the sweep log's
  four unrelated persistence-bump `snr_movements` entries. `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4h gap, unfiltered full source list (2026-11-19, second)

- 2026-11-19-E: A near-total-junk 40-candidate queue (DealBook Summit Musk political/midterms chatter,
  SpaceX-Tesla-merger and Anthropic-IPO-vs-SpaceX stock comparisons, repeated Bluesky launch-alert bot
  posts) still yielded a cluster of genuinely new DealBook Summit facts once chased past the political
  headlines: Musk's on-record "he is lying" accusation against Zelenskyy over Starshield (distinguishing
  civilian Starlink's "kill decisions" framing from government-controlled Starshield), and a separate,
  more specific stance on his Tesla pay package not being triggered by a merger alone. Both folded into
  their respective living-document items (Starlink/Ukraine saga, Tesla/SpaceX merger) as attach+patch
  enrichments, no bump (both items already at modifier ceilings). The ISRO "4 Gaganyaan astronaut
  candidates revealed" queue/discovery hit (also "How did ISRO pick...") traced to Modi's February 2024
  naming ceremony, a pure recap feature with zero new dateable fact and no commercial-contractor angle;
  left undrafted per the standing stale-resurfacing and evergreen-explainer exclusions, extending the
  2026-10-25-H China-crewed-lunar precedent to Gaganyaan crew-reveal recaps specifically.
- 2026-11-19-F: HallTech (Eindhoven, €25M Series A) uses Hall-effect-thruster physics repurposed into a
  terrestrial physical-vapor-deposition tool for semiconductor fabs; it doesn't build or operate
  anything in orbit, so it's out of scope entirely despite the ESA BIC pedigree and the "satellite
  propulsion" framing in coverage. Worth the general reminder that a space-derived-IP company's own
  product category (semiconductor fab tooling here) decides scope, not its origin story.
- 2026-11-19-G: `candidates-context`'s queue surfaced a signals-pass-shaped value-add only via a direct
  X search, not the registered `fetchable` leg: ESA Director General Josef Aschbacher's own Nov. 17 X
  post welcoming the ICEYE/Avio tie-up ("a strategically significant move... a powerful end-to-end
  European player") was found by a targeted WebSearch for his handle rather than his `signals-context`
  `fetchable` bluesky/site channel. `whitelistFloorChannels` covers ALL verified-active channel types
  per person (including `x`), so citing his own x.com/status URL directly as `class: "whitelist"` on a
  plain `attach` (no bump requested) validated cleanly even though the floor machinery is normally only
  exercised via `scoring.whitelist`/`rescore.whitelist`.
- 2026-11-19-H: A second, independently-fetched source (Space.com) on the already-published Nov. 17
  Foundational.Space Retro-2 item added real new facts the single-sourced Via Satellite-led draft
  lacked (the July 2026 Transporter-17/D-Orbit ION launch vehicle, ESA's collaboration explicitly named,
  a CTO quote), earning a clean `corroboration_2plus` bump (2 to 3) on an `attach`+`bump` update with no
  `patch` needed. Worth re-checking a single-sourced recent item for a second angle before assuming
  `found_none` is final; the Payload April 2026 "Kepler opens 40-GPU cluster" piece surfaced by the same
  search was confirmed (via a direct fetch) to be a stale pre-announcement of a DIFFERENT, later Nov. 19
  Sophia Space/Kepler test-completion story, not corroboration of it.
- 2026-11-19-I: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 2 new, 4
  updated, 0 held"), 1299 items up from 1297. Confirmed via a direct `jq` read of both new items'
  `snr`/`category`/`impact` fields (Sophia Space/Kepler: SNR 2, trade base minus `corroboration_none`;
  Thales Alenia/ASI SAR-L: SNR 5, first-party ceiling) and all four updated items' grown `sources`/
  `updates` arrays (Starlink/Ukraine: 102 sources, 48 updates; Tesla merger: 13 sources, 6 updates;
  ICEYE/Avio: 5 sources, 2 updates; Foundational Retro-2: 2 sources, 1 update, SNR 2 to 3), plus a direct
  `jq empty` parse check on all seven touched data files (items, held, state, source_ledger, sources,
  candidates, registry-candidates); held and registry-candidates were untouched (no held entries;
  neither new item's companies touched a crossfeed-eligible registry field). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~10.5h gap, unfiltered full source list (2026-11-19, third)

- 2026-11-19-J: A Mediaite piece surfaced by a Duffy/Starlink search read like the same FAA-outage
  explanation ("Sean Duffy Blames Faulty Test of One Router for FAA Stop") but, fetched directly,
  turned out to describe an unrelated router-installation failure, not the Starlink lab-test claim;
  used two other independently-fetched outlets (Moneywise, 24/7 Wall St.) that both carried Duffy's
  actual verbatim quote ("we sent Starlink, in one of its prior iterations, to our tech lab...")
  instead. Worth the reminder that two Duffy-and-FAA stories from the same week can cover genuinely
  different root-cause explanations; a matching headline shape is not proof of a matching claim,
  extending the standing WebSearch-conflates-distinct-facts caution to same-official multi-cause
  news cycles specifically.
- 2026-11-19-K: A drafted new item on the Senate Appropriations defense bill's SpaceX sole-source
  restriction (Section 8127, SB-AMTI/SDN, $100M cap) turned out to duplicate
  `2026-11-17-senate-appropriations-space-force-sole-source-limit`, already published by an earlier
  sweep the same day the bill was released; caught only by grepping `items.json` for recent
  SpaceX+procurement items before drafting, not by the headline (my lead source, SatNews, used
  different wording than the existing item's SpacePolicyOnline-led copy). A second, genuinely
  distinct fact from the SAME underlying bill (Aviation Week's "SAML R&D up 226% to $31.7M" in-space-
  servicing budget line, naming Astroscale/Orbit Fab/Rocket Lab/Northrop Grumman/Starfish Space/
  Momentus Space) folded in cleanly as a no-bump `updates[].attach`+`patch` enrichment instead of a
  second new item, since it is the same bill-release event just a different provision. Worth checking
  a budget-bill story against `items.json` by company+category before drafting even when the specific
  provision and lead outlet both look fresh.
- 2026-11-19-L: `bun scripts/finalize-sweep.ts` rejected five consecutive draft attempts, each on a
  single tagline over 140 chars (one item at a time, since the gate reports only the first
  violation); merged cleanly on the sixth attempt ("merged 6 new, 1 updated, 0 held"), 1305 items up
  from 1299. Confirmed via a direct `jq` read of all six new items' `snr`/`category`/`impact` fields
  and the Senate appropriations item's grown `companies` array and `updates` (1), plus a `jq empty`
  parse check on all six touched data files (items, held, state, source_ledger, sources, candidates);
  registry-candidates was untouched (no crossfeed facts: none of the six companies/entities touched a
  registry-eligible field). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure
  update.

## Narrow re-check, ~7.5h gap, unfiltered full source list (2026-11-20)

- 2026-11-20-A: A near-total-junk 101-candidate queue (Anthropic-IPO-vs-SpaceX comparison spam
  dominating Google News: launch, SpaceX Texas/Arizona data-center tax-abatement rehash already
  excluded per 2026-11-18-A, 24 Bluesky bot/joke posts on the scheduled USSF-317 launch) still
  yielded six genuinely new items, five of them via the 6 Via Satellite queue entries (one of six,
  a Space Tech Expo panel on European chipset reliance, was left out as thin multi-voice commentary
  with no dateable action) plus one each from NASASpaceflight and open-web discovery: Google/Blue
  Origin's Project Suncatcher New Glenn launch deal, a Telesat/Dominion Dynamics Canadian-military
  LEO-antenna partnership, and a Relativity Terran R second-stage hot-fire milestone.
- 2026-11-20-B: Two genuine predates-window science gaps were chased per the standing exception
  (Florian, 2026-07-08): ESA's Hera actually rendezvoused with Didymos-Dimorphos on Nov. 11 (an
  ESA article teasing a Nov. 25 image-reveal livestream read, on first fetch, like the event was
  still upcoming; a second, targeted fetch confirmed Hera "has arrived" and a dedicated WebSearch
  pinned the exact Nov. 11 date via ESA's own "rectangular orbit" article and Sky & Telescope),
  and JAXA's Hayabusa2 thruster failure/retarget was announced Nov. 17 (no JAXA English press
  release found; led with Space.com, mainstream, corroborated by phys.org's AFP wire, also
  mainstream, both capping at base tier 3 per the SNR tier table, not 4, since neither is a
  corporate wire_pr or aggregator). Both predate `lastSweep` by days, but "arrival" and "major
  anomaly/failure" are explicitly always-in-scope science event types per CLAUDE.md regardless of
  how thin the stated commercial angle is; kept `why_it_matters` to facts the sources actually
  stated rather than inventing a supply-chain read neither source gave.
- 2026-11-20-C: China's rollout of the Long March 2F/Shenzhou-24 ahead of Tiangong's first
  international (Pakistani) astronaut was judged OUT of scope despite being a genuine program
  "first": CLAUDE.md's human-spaceflight scope is explicitly limited to programs "where contracts
  and outcomes affect commercial providers" (Commercial Crew, CLD, Artemis commercial awards), and
  Shenzhou/Tiangong has no commercial-contractor angle stated anywhere. Extends the standing
  China-crewed-program exclusion precedent (2026-10-25-H) from recap/evergreen pieces to a genuine
  same-day rollout-ahead-of-launch event.
- 2026-11-20-D: An FT queue lead ("Lenders aim to bar SpaceX from launching $40bn of chips into
  orbit") could not be verified: ft.com itself is unfetchable, and four other WebSearch-surfaced
  mirrors/related pieces (Semafor, Yahoo Finance "leasing like a car," two further financing-detail
  searches) all covered the financing structure but none confirmed the specific "lenders want to
  bar orbital launch of the collateral" claim. Left the existing SpaceX $40B item unupdated rather
  than draft the FT headline's specific claim from a WebSearch synthesis alone; worth a retry next
  sweep for an accessible FT mirror.
- 2026-11-20-E: Three already-published same-day items (SpaceX rooftop microcell, Redwire/
  AscendArc, Sophia Space/Kepler) each had a second Via Satellite or TechCrunch article covering
  the same fact with genuinely new details (Direct-to-Cell V2's stated 40-fold bandwidth figure;
  AscendArc's KT SAT/Space Leasing International customer list; the exact six-processor Kepler
  distributed-compute count) not in the original single-sourced drafts; all three patched via
  `attach`+`bump` (`mainstream_pickup` once, `corroboration_2plus` twice) rather than left alone,
  confirming a single-sourced same-day item is worth a second look before assuming nothing is left
  to add.
- 2026-11-20-F: Confirmed the signals-pass budget-rotation logic once more: of 17 fetchable
  channels, `spacepolicyonline.com` and `europeanspaceflight.com` (bare sites) were dropped as
  harvester-duplicate domains (both already in this run's `candidates-context` health block),
  leaving 15 checked individually; `europeanspaceflight.substack.com` 403'd (logged as a failed
  attempt, not claimed checked). The AT Protocol `getAuthorFeed` endpoint was used for all 10
  bluesky channels per the standing `bsky.app` empty-shell workaround; nothing new surfaced beyond
  already-published facts (Vulcan failure cause, ICEYE/Avio, ClearSpace-1, Hera close-range
  imagery).
- 2026-11-20-G: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 6 new,
  3 updated, 0 held"), 1311 items up from 1305. Confirmed via a direct `jq` read of all six new
  items' `snr`/`category`/`impact` fields and all three updated items' grown `sources` (2-3) and
  `updates` (1 each) arrays with the expected SNR bumps (rooftop microcell 2→3, Redwire 3→4, Sophia
  Space 2→3), plus a `jq empty` parse check on all seven touched data files (items, held, state,
  source_ledger, sources, candidates, registry-candidates); held was untouched (no held entries;
  none of the six new items' companies had a registry profile with a like-for-like crossfeed
  metric). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4h gap, unfiltered full source list (2026-11-20, second)

- 2026-11-20-H: JAXA's registry-recorded website is `global.jaxa.jp`, but its own Japanese-language
  press releases live on `www.jaxa.jp` (the English stub pages under `global.jaxa.jp/press/...` carry
  only a title, "Japanese Only," with no body text); the anti-spoof gate rejected `www.jaxa.jp` as
  `first_party` on the exact-hostname mismatch. Reclassified to `trade` rather than resubmit, same
  playbook as the standing same-company domain-mismatch precedents (Redwire's `ir.rdw.com`, Airbus's
  `space-solutions.airbus.com`, 2026-11-10-L); still reached SNR 4 on `corroboration_2plus` with Jiji
  Press independently confirmed (minister's name, a 5-of-7 success-rate stat, MHI's own stated
  overseas-contract ambition, none of which were in JAXA's own page). Also confirms: a WebSearch
  synthesis flatly claimed South Korea's Mir rocket flew its first full four-stage orbital test on
  Nov. 10, but a second, more specific search showed the real flight is still NET Nov. 30; left
  undrafted, extending the standing WebSearch-fabricates-completed-launches pattern to a vehicle with
  a thin English-language footprint.
- 2026-11-20-I: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on the JAXA
  `first_party` host mismatch above; merged cleanly on the second attempt ("merged 3 new, 3 updated,
  0 held"), 1314 items up from 1311. Confirmed via a direct `jq` read of all three new items'
  `snr`/`category`/`impact` fields and all three updated items' grown `sources`/`updates` arrays
  (FAA Starbase EIS: 6 sources, 3 updates; SpaceX GPU financing: 13 sources, 9 updates; United
  Starlink fleet: 3 sources, 1 update), plus a `jq empty` parse check on all six touched data files
  (items, held, state, source_ledger, sources, candidates); held was untouched (no held entries).
  Diffed a Musk/Zelensky DealBook Summit quote found via CNBC against the Starlink/Ukraine saga
  item's own current `explainer.what_happened` text before drafting an update and found it was
  already fully captured via a different CNBC URL from the same event, extending the standing
  diff-against-current-copy-not-just-updates-log practice (2026-11-14-M) to avoid a redundant attach.
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~10h14m gap, unfiltered full source list (2026-11-20, third)

- 2026-11-20-J: Grepping `items.json` by company before drafting caught a near-miss: the queue's
  "Japan to Transfer H3 Rocket Launch Operations to Mitsubishi" story (nippon.com, confirmed
  directly with a verbatim minister quote naming Yoshihiro Seki, plus an independent Korean
  outlet, JKN, as a second source) turned out to already be published by the immediately prior
  same-day sweep (`2026-11-20-jaxa-h3-mhi-launch-operations-transfer`); dropped entirely rather
  than drafted as a duplicate.
- 2026-11-20-K: Two Chinese-language mainstream outlets (The Paper, TVB News) independently
  reporting the same CCTV footage of LandSpace's Zhuque-3 Y2 recovered-engine reuse test (9
  engines, 185-second hot-fire) is the same shape as the standing state-media-pair precedent
  (2026-10-24-G): `corroboration_2plus` and `crawl: "found_none"` (no non-Chinese-state-adjacent
  pickup existed despite a dedicated English-language search) netted to the mainstream base of 3,
  correctly landing SNR 3 rather than 4. Worth treating two CCTV-sourced Chinese portals the same
  way as two Xinhua pieces for this purpose.
- 2026-11-20-L: A signals-pass bluesky find (Andrew Parsonson) surfaced a genuinely new, slightly
  startling item on its own merits: ATMOS Space Cargo and MBDA Deutschland's cooperation agreement
  to study a "Precision Orbital Deep Strike" capability (a conventional munition parked in orbit
  and deorbited on command onto a ground target). Judged in scope as a company
  product/capability-development announcement (ecosystem: manufacturer + defense), not conflict
  analysis or operational-use attribution, since no conflict or operational use is implicated;
  flag for Florian if an orbital-weapons-concept story like this should be scoped differently.
  Aviation Week (trade) and Tech Times, explicitly crediting Defense News as the original source,
  gave clean `corroboration_2plus` (two genuinely distinct original outlets, not one wire-rewrite).
- 2026-11-20-M: A WebSearch-sourced "India Today Digital" ISRO Gaganyaan G1 delay-to-February-2027
  story (unnamed officials, anonymous sourcing) had two mirrors (CSR Journal, NewsBytes) that both
  explicitly credit India Today Digital as their own source; treated as ONE source per the
  standing credits-the-original-outlet-by-name non-independence rule, landing an honest SNR 2
  (`crawl: "found_none"`) rather than `corroboration_2plus` padding from the mirror count.
- 2026-11-20-N: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 4 new,
  3 updated, 0 held"), 1318 items up from 1314. Confirmed via a direct `jq` read of all four new
  items' `snr`/`category`/`impact` fields and all three updated items' grown `sources`/`updates`
  arrays (FCC Upper C-band: 10 sources, 5 updates, SNR held at 5; Atomic-6: 4 sources, 2 updates,
  SNR held at 4; Telesat/Dominion: 4 sources, 1 update, SNR held at 4, a copy-only enrichment at
  the non-first-party ceiling). All three mandatory HTML sources (Planet Labs, BlackSky, EUSPA
  procurement) and 14 of 17 signals channels traced to already-published ground; 2 dropped as
  harvester-duplicate domains (spacepolicyonline.com, europeanspaceflight.com bare sites),
  `europeanspaceflight.substack.com` 403'd. `bun run build` was not attempted, per the 2026-09-09
  CLAUDE.md procedure update.

## Narrow re-check, ~1h13m gap, unfiltered full source list (2026-11-20, fourth)

- 2026-11-20-O: A thepeninsulaqatar.com mirror of Xinhua's same-day Long March 8A/SatNet Group 30
  report stated the launch date as "November 21," a full day off every Chinese-language source
  (Xinhua, The Paper, Sina, 21jingji) and Launch Library's own 11:59 UTC Nov. 20 timestamp; trusted
  the converging Chinese-language sources and LL2 over the one English mirror's date rather than
  split the difference, consistent with the standing single-outlet-conflicts-with-everything-else
  caution.
- 2026-11-20-P: Vivienne Machi's Aviation Week author page 403'd on the first fetch attempt this run
  but succeeded on a second, immediately-retried fetch with no change in approach; worth retrying
  once before logging a 403 as a failed attempt, since the page has flipped between the two outcomes
  across sweeps with no apparent pattern. Its newest byline ("Demand For Rides Ignites Rocket
  Developments," Nov. 19, on AST SpaceMobile's Blacklift rocket amid the industry launch-capacity
  crunch) was a paywalled recap of the already-published Nov. 6 Firefly/AST SpaceMobile Blacklift
  item with no new fact beyond its own teaser paragraph; left unpatched as too thin to add anything.
- 2026-11-20-Q: A discovery-pass DIA "Challenges to Security in Space" report finding ("Russia is
  developing a nuclear space weapon") was judged out of scope on the standing institutional-
  intelligence-disclosure precedent (DSP retirement, Space RCO jammers, the China DIA spaceplane
  story): the report names no specific commercial operator, contractor, or transaction, only generic
  language about satellites "operated by countries and companies around the world." A CoStar
  Group/Vexcel $730M acquisition read as a strong EO-sector M&A gap on headline alone but Vexcel
  turned out to be a manned-aircraft aerial-imagery company (UltraCam cameras on airplanes, not
  satellites); out of scope entirely despite the imagery-industry framing in coverage, same
  space-derived-but-not-actually-space-hardware judgment as 2026-11-19-F's HallTech thruster-tech
  exclusion.
- 2026-11-20-R: Andrew Parsonson's bluesky surfaced the sweep's only genuine signals-pass find: a
  europeanspaceflight.com piece on Greenland's government admitting (in a Nov. 5 parliamentary
  response, chased per the predates-window exception) it lacks the resources to meaningfully enforce
  its Starlink ban against reportedly-sneaking Danish soldiers' personal terminals. Single-sourced to
  Parsonson's own site with a genuine `crawl: "found_none"` (no other outlet had covered the Nov. 5
  government response by this run); landed SNR 4 anyway via the `whitelist`/`observer` floor, the
  same floor-survives-found_none mechanic as the 2026-10-26-E Zvezda case and 2026-10-29-N Amur-SPG
  case. A Marcos-at-APEC "Philippines in early talks with SpaceX over launch sites" story (Daily
  Tribune lead, mainstream; The Deep Dive corroboration, informal) needed three `dedup_distinct`
  entries against unrelated same-window SpaceX+launch items (Starship Flight 15, two launch-capacity
  commentary pieces) purely on company+category overlap, extending the standing prolific-actor
  pre-emption pattern to a government/company story rather than a company's own announcement.
- 2026-11-20-S: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on four
  same-company-plus-category dedup collisions at once (three on the Philippines item, one on the
  Greenland item, all against unrelated SpaceX+launch/regulatory items in the window); adding the
  `dedup_distinct` entries merged cleanly on the second attempt ("merged 3 new, 0 updated, 0 held"),
  1321 items up from 1318. Confirmed via a direct `jq` read of all three new items' `snr`/`category`/
  `impact`/`sources` fields (SatNet Group 30: SNR 4, aggregator base plus `corroboration_2plus`;
  Philippines/SpaceX: SNR 4, mainstream base plus `corroboration_2plus`; Greenland/Starlink: SNR 4,
  whitelist `observer` floor surviving `found_none`) and a `jq empty` parse check on all six touched
  data files (items, held, state, source_ledger, sources, candidates); held and registry-candidates
  were untouched (no held entries; none of the three companies/entities touched a crossfeed-eligible
  registry field). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7h gap, unfiltered full source list (2026-11-21)

- 2026-11-21-A: A Via Satellite "SatSure Raises $21M, With Sovereign Fund Investment" piece turned out
  to be the SAME funding event as the same-day Reuters-led item already published hours earlier (`2026-
  11-20-satsure-antariksh-vc-fund-7m`), not a separate round: Reuters' $7 million figure covered only the
  Antariksh Venture Capital Fund's own tranche of a $21 million total raise that Via Satellite reported
  in full ($17.6M equity, $2.7M debt, $1.1M secondary). Patched the existing item to state the full round
  and attribute each outlet's own figure for AVCF's slice (Reuters ~$7M/600M rupees vs Via Satellite
  $6.4M) rather than force them to agree, per the standing metric-mismatch-is-annotated rule. Worth
  checking whether a "new" funding-amount headline is actually a bigger-picture restatement of a same-day
  item's own round before treating the bigger number as a distinct raise.
- 2026-11-21-B: A corroboration_2plus bump on an item that already carries a standing `corroboration_none`
  penalty from its initial scoring does NOT cancel that penalty out to the base tier; both modifiers are
  logged and net together (base 3, -1, +1 = 3 here), one level below what a corroboration_2plus-only item
  would land at (4). Worth not assuming a later-arriving second source fully erases an earlier honest
  `found_none` finding in the trace.
- 2026-11-21-C: Himes' (incoming House Intelligence chair) letter threatening to withhold SpaceX funding
  over the unexplained October Starshield/Ukraine slowdown, and Apollo/Goldman's final $44 billion pricing
  of SpaceX's Nvidia GPU financing (up from the $40B/$43B figures already in the item, with exact tranche
  yields from Apollo's own release), and SpaceX's own denial of responsibility for the Mexico Starship-
  debris complaint, all folded cleanly as `attach`+`patch` enrichments onto their respective living-document
  items with no `bump` needed (all three already sat at their indirect-sourcing ceiling of 4). cnn.com
  403'd and a direct Yahoo mirror plus the Kyiv Independent's own write-up both worked for the Himes story.
- 2026-11-21-D: A "Hunters sue SpaceX, DOTD to preserve lease access" story (thecurrentla.com, a new,
  distinct Louisiana lawsuit over duck-lease canal access, separate from the standing Vermilion Parish
  Open Meetings Law suit) 403'd on two direct fetch attempts; two older background pieces (973thedawg.com,
  louisianasportsman.com, both from August/September) fetched fine but predate this specific filing and
  couldn't confirm its facts. Left undrafted rather than publish from a WebSearch synthesis of the one
  inaccessible original report, per the standing never-draft-from-synthesis-of-an-unfetched-page rule. A
  WWLTV piece on a related Louisiana permit hurdle also failed (403, then 404 on a corrected URL).
- 2026-11-21-E: Vivienne Machi's (mandatory fetchable signals channel) Nov. 20 Aviation Week byline on
  Turion Space's GEO Space Domain Awareness "design milestone" was left undrafted: the article is paywalled
  beyond its opening sentence, and an open-web search for the underlying program traced its Critical Design
  Review to September, with no directly-fetched source confirming today's byline describes a genuinely new
  Nov. 20 development rather than a late recap.
- 2026-11-21-F: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 3 new, 4
  updated, 0 held"), 1324 items up from 1321. Confirmed via a direct `jq` read of all three new items'
  `snr`/`category`/`impact` fields (FCC ESIM order: SNR 4, major; SSC Space/NTT and Sidus Space/Argotec:
  SNR 4, noise) and all four updated items' grown `sources`/`updates` arrays (Starlink/Ukraine saga: 104
  sources, 49 updates; SpaceX GPU financing: 15 sources, 10 updates; Flight 15 Mexico debris: 4 sources, 1
  update; SatSure: 2 sources, 1 update, SNR 2 to 3), the sweep log's two `snr_movements` entries, and a `jq
  empty` parse check on all seven touched data files (items, held, state, source_ledger, sources,
  candidates, registry-candidates); held and registry-candidates were untouched (no held entries; none of
  the three new items' companies had a registry profile with a like-for-like crossfeed metric). `bun run
  build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~4h47m gap, unfiltered full source list (2026-11-21, second)

- 2026-11-21-G: A "Morgan Stanley Starlink Tesla Report: 36% by 2040" shattered.io queue lead (and its
  NAI500/investing.com/BigGo mirrors) all traced to the SAME Adam Jonas note first covered by BigGo Finance
  and Investing.com on September 21, 2026; left undrafted as a stale resurfacing, extending the standing
  page-load-date-is-not-proof-of-age pattern (2026-10-22-M, 2026-11-18-J) to analyst-note commentary
  specifically, not just press releases.
- 2026-11-21-H: A Senate NASA Authorization Act (S.933) "extends ISS to 2032" queue lead read as fresh (a
  newspaceeconomy.ca piece citing a November 9 "Senate-reported" calendar placement) but the underlying
  committee passage was SpaceNews-confirmed to March 4, 2026; the only genuinely new fact was a procedural
  calendar placement 8 months later, with no floor vote. Left undrafted as too thin/not-yet-passed, same
  judgment as the standing still-unveiled-appropriations-bill precedent (2026-11-17-L).
- 2026-11-21-I: Three Gray Television/Nexstar-network local-news mirrors of the same SpaceX Vermilion Parish
  Coastal Use Permit story (theadvocate.com, acadiananewsfirst.com, klfy.com) all carried the identical
  byline (Claire Taylor) and text; attested `crawl: "found_none"` and cited only the original (The Advocate)
  rather than stacking the same-author mirrors as independent corroboration, consistent with the standing
  same-byline-is-one-source rule extended from wire services to a shared local-TV content network. klfy.com
  itself 403'd on a direct fetch; acadiananewsfirst.com (same publisher group) worked as a readable mirror
  of the identical text for confirmation purposes only, not as a second scored source.
- 2026-11-21-J: A routine classified Falcon 9 NSSL launch (USSF-317) had zero trade/mainstream pickup beyond
  a local Santa Barbara TV affiliate (keyt.com) and a low-profile business portal (businessupturn.com, classed
  `informal`); published off Launch Library's own tracking data as the `aggregator` lead per the standing
  "every on-scope launch publishes, weak sourcing is never a hold reason" rule, needing three `dedup_distinct`
  entries against unrelated same-window SpaceX+launch commentary/talks items purely on company+category
  overlap.
- 2026-11-21-K: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on a 142-char tagline and the
  USSF-317 item's triple company+category dedup collision at once; merged cleanly on the second attempt
  ("merged 3 new, 0 updated, 0 held"), 1327 items up from 1324. Confirmed via a direct `jq` read of all three
  new items' `snr`/`snr_trace`/`category`/`impact` fields (Satellogic/Common Space: SNR 5, first-party
  ceiling; USSF-317: SNR 4, aggregator base plus mainstream/informal corroboration; Vermilion Parish CUP: SNR
  2, mainstream base minus honest `corroboration_none`) and a `jq empty` parse check on all six touched data
  files (items, held, state, source_ledger, sources, candidates); held and registry-candidates were untouched
  (no held entries; only the Satellogic item had a like-for-like crossfeed metric, `sats_launched_total`).
  `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~7.5h gap, unfiltered full source list (2026-11-21, third)

- 2026-11-21-L: A near-total-junk 77-candidate queue (SpaceX/Tesla-merger and Musk-politics spam, launch-alert
  and viewing-guide Bluesky bots that only restate already-known launches, an "@everythingspace.bsky.social"
  aggregator feed that mirrors already-known trade headlines) still yielded four open-web-discovery items:
  GomSpace's own press release never names Blue Origin as the customer for its 8 MEUR Oasis lunar contract
  ("a leading North American space company," consistent with its January first-phase release), while
  europeanspaceflight.com's own reporting makes the Blue Origin/Project Oasis identification; led with
  GomSpace's own-domain release reclassified `wire_pr` (no registry organization entity, same precedent as
  OVHcloud 2026-10-25-G) and attributed the Blue Origin tie to European Spaceflight in the copy rather than
  stating it as GomSpace's own claim.
- 2026-11-21-M: A WebSearch-surfaced europeanspaceflight.com "Isar Aerospace signs $112.5M deal for dedicated
  launch site in Canada" headline read as a fresh gap but its own byline dated it July 7, 2026; the body's
  2026-2028 milestone dates (statement of work, pad handover, first launch) made it look current on a skim.
  Worth checking a WebSearch-surfaced trade article's own byline date before treating a multi-year-milestone
  story as new, extending the standing page-load-date-is-not-proof-of-age pattern to byline dates specifically.
- 2026-11-21-N: A Seagate Space/Kratos Defense "offshore rocket launch" deal (tbbwmag.com) described a mobile
  sea platform for "missile tests," "hypersonic testing," and "ballistic-missile targets," not an orbital
  launch vehicle service; left out of scope as suborbital defense target testing rather than drafted as a
  spaceport/launch-services item, on the standing orbital-only launch-vehicle scope rule.
  Also left out: a Florian Rabitz/Xiao-Shan Yap academic journal article calling for a lunar-industrialization
  moratorium (no tracked commercial actor, an advocacy paper rather than an event or a commentary-eligible
  signals/outlet voice) and NASA's own April-2026-dated "$476M Commercial Satellite Data" resurfacing already
  flagged stale by 2026-10-22-J.
- 2026-11-21-O: The Paraguay Starlink-schools item's two independently-written, different-domain sources
  (revistaplus.com.py's Nov. 16 original with the Copaco GM's named quote; hoy.com.py's Nov. 20 follow-up with
  a department-level installation breakdown) collapsed to ONE corroboration unit at finalize under the
  `same_domain` label despite being genuinely different domains; final SNR landed at the honest mainstream
  base of 3 rather than a `corroboration_2plus` 4. Submitted both sources anyway per the standing
  don't-under-submit-a-source-list-out-of-fear-of-collapse practice (2026-10-24-C); the collapse rule's exact
  trigger here (domain vs. title-similarity) is worth double-checking in `scripts/snr/corroboration.ts` next
  time a cross-domain pair collapses unexpectedly.
- 2026-11-21-P: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on four same-company-plus-
  category dedup collisions at once (GomSpace/Blue Origin vs. both the unrelated NSSL Lane 2 contract-mod and
  the unrelated Google/New Glenn Suncatcher item, both sharing Blue Origin + category contract; BepiColombo vs.
  both the unrelated ESA Plasma Observatory selection and the unrelated JAXA Hayabusa2 retarget, both sharing
  the agency + category science; Paraguay/Starlink vs. the unrelated Senate Appropriations SpaceX sole-source
  item, sharing SpaceX + category procurement); four `dedup_distinct` entries cleared it on the second attempt
  ("merged 4 new, 1 updated, 0 held"), 1331 items up from 1327. Confirmed via a direct `jq` read of all four
  new items' `snr`/`category`/`impact` fields and the Starship Flight 15 item's grown `sources`/`updates`
  arrays (15 sources, up from 14; 5 updates, up from 4, recording Musk's Nov. 18 decision to retire Ship 42 for
  display rather than refly it), the sweep log's `corroboration_collapses` entry for the Paraguay same-domain
  case above, and a `jq empty` parse check on all seven touched data files (items, held, state, source_ledger,
  sources, candidates, registry-candidates); held and registry-candidates were untouched (no held entries;
  none of the four new items' companies had a registry profile with a like-for-like crossfeed metric). `bun
  run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~2h gap, unfiltered full source list (2026-11-21, fourth)

- 2026-11-21-Q: Five separate queue/discovery candidates in one pass all traced to stories already fully
  captured under existing items with no new facts: a Futurism "SpaceX lenders horrified" AI-chips piece and a
  Bloomberg "Credit Weekly" piece were both rewrites of the same FT/Apollo reporting already attached to the
  2026-10-06 GPU-financing item; a Yahoo Finance "Google paying SpaceX $30 billion" (Jim Cramer) piece and a
  "Musk won't take stock awards for merging with SpaceX" piece both resurfaced facts (the $920M/month Google
  compute deal, the exact DealBook Summit stock-award quote) already verbatim in existing items. Left all four
  undrafted rather than publish a duplicate card with no new information.
- 2026-11-21-R: Two further candidates were stale resurfacings disguised as fresh by today's load/post date,
  extending the standing page-load-date-is-not-proof-of-age pattern: a Satellogic "$18 million contract"
  press release (satellogic.com itself) actually dated May 26, 2026, and a "European Southern Observatory
  calls for a 100,000-satellite limit" story (via a Bluesky repost) whose original Fast Company reporting
  dated to July 3, 2026. Checking a first-party press release's own dateline, not just when a Bluesky bot
  reposted it, caught the first one; checking the original outlet's byline date (not the aggregator's) caught
  the second.
- 2026-11-21-S: A WebSearch for the Mexico/Texas Starship-debris angle surfaced an unrelated June 2025
  "Sheinbaum threatens to sue SpaceX" story from a prior, different Starbase explosion incident; confirmed via
  the article's own dateline before treating it as a new escalation on the current Nov. 17-21 Playa Bagdad
  Flight 15 debris story, which the sitting item already covers via its Nov. 21 Mexico News Daily addition.
- 2026-11-21-T: Of 17 fetchable signals channels, Bluesky profile pages fetched via `bsky.app/profile/<handle>`
  return only the bare handle with no post content (the page is JS-rendered); the public AT Protocol endpoint
  `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=10` returns the actual
  posts with `indexedAt` timestamps and works as a direct fetch. Use the API endpoint, not the bsky.app profile
  URL, for any fetchable-channel signals pass on a Bluesky handle.
- 2026-11-21-U: Only one genuine action survived this pass: Indian Masterminds and BehindTheBlack both
  independently rewrote the same India Today Digital Gaganyaan G1 delay report (2026-11-20 item), corroborating
  rather than duplicating it; attached both via `updates[].attach` with `bump: "corroboration_2plus"`, raising
  the item from SNR 2 to 3. `bun scripts/finalize-sweep.ts` merged cleanly on the first attempt ("merged 0 new,
  1 updated, 0 held"). Confirmed via a direct read of the updated item's grown `sources`/`secondary_urls` and
  `snr_trace.history` entry, the sweep log's `snr_movements` entry, and a `jq empty` parse check on all six
  touched data files (items, held, state, source_ledger, sources, candidates); held was untouched. `bun run
  build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Deep sweep, ~5.5h gap, unfiltered full source list (2026-11-22)

- 2026-11-22-A: A huge (714-candidate) deep-mode queue was almost entirely SpaceX/Tesla-merger and
  Anthropic-IPO stock chatter, Starlink/Ukraine-saga rehash, and launch-alert bots, plus five full
  Via Satellite queue entries that were all already published same-week; the genuine finds came from
  the mandatory HTML-only sources (NOAA CRSRA's Nov. 17 EU Space Act procedural update led to searching
  out the actual Nov. 19 ITRE committee vote itself, 72-1-2, which the queue never surfaced directly)
  and the discovery pass. A DeepSat/EraDrive VLEO-autonomy MoU had only one fetchable source
  (deepsat.com's own newsroom, reclassified `wire_pr` since neither company has a registry organization
  profile for the anti-spoof check); a WebSearch snippet confirmed a SpaceWatch.GLOBAL piece also
  covered it, but SpaceWatch.GLOBAL 403'd on every direct WebFetch attempt (plain http, cache, and
  retry), so it was left uncited rather than drafted from a search-snippet synthesis of an unfetched
  page; `crawl: "found_none"` was the honest attestation even though coverage demonstrably existed,
  since none of it was independently fetchable this run.
- 2026-11-22-B: A Bluesky "satellite constellation" search hit ("Dingo Sat Constellation Phase 1
  deployed 42 Ku-band satellites... Australia's sovereign broadband satellite constellation") could
  not be corroborated by any dedicated WebSearch at all, not even a single mention of a "Dingo"
  satellite program anywhere; treated as a fabricated/hallucinated bot post per the standing
  2026-10-23-C/G pattern and left entirely unchased, not even held.
- 2026-11-22-C: The AT Protocol `getAuthorFeed` endpoint, the standing workaround for blank `bsky.app`
  profile pages, returned real-looking but stale, months-old cached posts for four signals accounts
  this run (Eric Berger, Jeff Foust, Tim Farrar, Caleb Henry) while working freshly for others (Marco
  Langbroek, Josef Aschbacher, Anatoly Zak, Andrew Jones, Andrew Parsonson, SpacePolicyOnline); worth
  sanity-checking a bluesky fetch's newest post date against `lastSweep` before trusting it as current,
  since the endpoint can silently serve a cached snapshot per-account rather than erroring.
- 2026-11-22-D: A Roscosmos/Buro 1440 "Rassvet" (nicknamed "Russian Starlink") satellite-failure story
  on Anatoly Zak's own site traced, on the actual detail page, to a batch launched in July with
  predicted reentry dates of Oct. 30 and Nov. 6 and a last page update of Nov. 2; by this run's Nov. 22
  date the predicted reentries had already passed with no fresh November development stated, so it
  read as stale rather than a live incident and was left undrafted rather than republished as news.
- 2026-11-22-E: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 5 new, 2
  updated, 0 held"), 1336 items up from 1331. Confirmed via a direct `jq` read of all five new items'
  `snr`/`category`/`impact` fields (EU Space Act ITRE vote and NATO Global Data Marketplace both SNR 4
  off `corroboration_2plus`; DeepSat/EraDrive SNR 3, `wire_pr` base minus `corroboration_none`; ECOSAT-1
  SNR 4; NASA Perseverance/Odyssey SNR 5, `first_party` ceiling) and both updated items' grown
  `sources`/`updates` arrays (Artemis III/IV mission plan: 6 sources, 3 updates; Starship Flight 15
  catch: 17 sources, 6 updates), the sweep log's `mode: "deep"` entry, and a `jq empty` parse check on
  all seven touched data files (items, held, state, source_ledger, sources, candidates,
  registry-candidates); held and registry-candidates were untouched (no held entries; none of the five
  new items' companies had a registry profile with a like-for-like crossfeed metric). `bun run build`
  was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~9h15m gap, unfiltered full source list (2026-11-22, second)

- 2026-11-22-F: Of 15 fetchable-leg fetches this run (10 bluesky via the AT Protocol `getAuthorFeed`
  endpoint, 5 sites), every single one returned content that predated this run's `lastSweep`
  (2026-11-22T05:41 UTC) by hours to months, including channels not previously flagged as
  serving stale cache (Josef Aschbacher, Marco Langbroek, SpacePolicyOnline bluesky, Andrew
  Jones, Andrew Parsonson bluesky). Worth treating the bsky stale-cache issue (2026-11-22-C) as
  a general per-run risk rather than a fixed list of four accounts; sanity-check newest-post
  timestamps against `lastSweep` every time, not just for the previously-identified names.
- 2026-11-22-G: A WebSearch-surfaced NewSpace India Limited/Australia "Space MAITRI" $18M MoU
  story (newsbytesapp, pwonlyias, indiastrategic, latestly, diplomacyindia) could not be pinned
  to a fresh November 2026 signing: the underlying Launch Service Agreement traces to a June 26,
  2024 signing at India Space Congress, and no fetched source stated a distinct new November
  2026 action (ratification, amendment, or launch-date confirmation) beyond restating the
  original 2024 deal terms. Left undrafted as unconfirmed-fresh rather than guess which framing
  was correct, extending the standing page-load-date-is-not-proof-of-age pattern to a case where
  multiple outlets disagree on the underlying event's actual year.
- 2026-11-22-H: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on three
  same-company-plus-category dedup collisions at once (SpaceX + launch, against two unrelated
  commentary items and the Philippines launch-site-talks item, none caught by the initial
  single-collision check against USSF-317) and a second attempt on a 168-char tagline (a
  pre-existing item's own tagline, carried over unchanged into an enrichment patch that reused
  the full `explainer` block rather than touching only `what_happened`); three added
  `dedup_distinct` entries plus a shortened tagline merged cleanly on the third attempt ("merged
  1 new, 1 updated, 0 held"), 1337 items up from 1336. Confirmed via a direct `jq` read of the
  new item's `snr`/`snr_trace`/`category`/`impact` fields (NROL-136 Vandenberg turnaround record:
  SNR 4, trade base plus `corroboration_2plus`) and the updated GPU-financing item's grown
  `sources` (17, up from 15) and `updates` (11, up from 10) arrays, plus a `jq empty` parse check
  on all six touched data files (items, held, state, source_ledger, sources, candidates); held
  and registry-candidates were untouched (no held entries; the new item stated only a
  pad-turnaround time and a single booster's flight count, neither a like-for-like registry
  metric). Worth patching only the specific field needing new text (`what_happened`) rather than
  re-supplying an update patch's entire `explainer` block verbatim, to avoid accidentally
  re-triggering field-length gates on text that was never meant to change. `bun run build` was
  not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~2h13m gap, unfiltered full source list (2026-11-22, third)

- 2026-11-22-I: A near-total-junk 32-candidate queue was entirely NROL-136 launch rehash from a
  dozen angles (already published same-day), NSSL Lane 2/Starship Flight 15/Mexico-debris recaps,
  SpaceX/Tesla-merger and Anthropic-IPO chatter, and two off-topic Futurism lifestyle pieces; a
  routine ground test was nearly drafted as new (an Atomic-6 "tests new space Armor to protect
  astronauts" Satellite Evolution piece) before a direct read of the existing Oct. 20 Atomic-6
  item showed the identical Texas A&M hypervelocity test and CEO quote were already folded in via
  a Nov. 20 update two days earlier; grepping an existing item's own `updates[]` log, not just its
  original `what_happened`, caught the duplicate.
- 2026-11-22-J: Google News RSS redirect URLs again failed to resolve via WebFetch this entire run
  (bare "Google News" header, no content), extending the standing 2026-10-25-A/E outage pattern;
  WebSearch-plus-direct-outlet-URL was the only working path for every Google News-sourced lead.
  A Sandra Erwin (X search leg) SpaceNews piece on the Space Data Network Backbone's accelerated
  launch cadence was itself paywalled and never directly fetched; rather than cite it from a
  WebSearch synthesis, chased the same facts through Spaceflight Now's own live-coverage page
  (successfully fetched directly), which verbatim-confirmed USSF-317 was the sixth R-designated
  SDN Backbone launch (R-1 through R-6, matching the existing item's independent Tech Times count)
  and stated the accelerated regional-this-year/global-next-year schedule; folded into two
  existing items (USSF-317's payload-ID confirmation, the $2.3B SDN contract item's bump to 4) as
  attach+patch rather than drafted as a new item, since both were the same program already
  covered.
- 2026-11-22-K: Elon Musk's SpaceX-stock-to-every-child pledge (and The Hill's tax-loophole
  critique of it) was judged out of scope: it is Musk's personal estate/tax-planning vehicle using
  his own shares as the asset, not a disclosed SpaceX corporate transaction (no funding round, 8-K,
  M&A, or filing), and no commercial-market consequence is stated. A routine CRS-35 Dragon cargo
  splashdown (ISS resupply mission already published at launch) was left undrafted as the
  splashdown/return-leg analogue of a scheduled-launch-succeeding-on-schedule noise item, with no
  new company fact to add. Flag both for Florian if either read is too strict.
- 2026-11-22-L: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 0 new,
  3 updated, 0 held"), 1337 items unchanged (update-only sweep). Confirmed via a direct `jq` read
  of all three updated items' `snr`/`sources`/`updates` fields (USSF-317: SNR unchanged at 4, 5
  sources, 2 updates; SDN contract: SNR 3 to 4 via `corroboration_2plus`, 2 sources, 1 update;
  NROL-136: SNR unchanged at 4, 3 sources, 1 update), the sweep log's `snr_movements` entry, and a
  `jq empty` parse check on all six touched data files (items, held, state, source_ledger,
  sources, candidates); held and registry-candidates were untouched (no held entries; all three
  touched items were updates, which carry no crossfeed block). `bun run build` was not attempted,
  per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6.5h gap, unfiltered full source list (2026-11-23)

- 2026-11-23-A: Two different banks' SpaceX price targets landed on the identical $210 figure five
  months apart (UBS, July 7, 2026; Jefferies, Nov. 22, 2026, initiating fresh coverage); the
  matching number alone is not proof of a stale resurfacing, but it is worth double-checking the
  byline date on any "new" analyst note whose price target matches a figure already seen, since a
  coincidence like this is exactly the shape a stale-recirculation trap takes. Confirmed Jefferies
  was the genuinely new Nov. 22 initiation by checking both notes' own publish dates directly.
- 2026-11-23-B: AskTraders.com and TheFly (via TipRanks) both carried byte-identical analyst-note
  phrasing ("exceptional" engineering, "durable high growth," "exponential growth," the $8.4
  trillion AI figure) for the same Jefferies initiation, alongside several more mirrors (panews.io,
  phemex.com, chaincatcher.com) with the same wording; treated as one wire source
  (`crawl: "found_none"`, honest SNR 2) rather than padding `corroboration_2plus` from the mirror
  count, extending the standing many-mirrors-of-one-wire-is-not-corroboration rule to sell-side
  research-note pickups specifically. Neither AskTraders.com nor TheFly/TipRanks had prior
  classification precedent in this file; treated both as `trade` (same tier as Benzinga/TheStreet).
- 2026-11-23-C: A ColombiaOne.com queue hit (Colombia's MinTIC filing formal charges against
  Starlink and three mobile carriers over prison signal-blocking failures at four facilities) and
  an independently-fetched Colombian business outlet (Asuntos Legales, different language framing
  of the same facts, `trade`) gave clean `corroboration_2plus` off a `mainstream` lead for a
  genuinely new Latin American regulatory action; no prior item covered Starlink-in-Colombia
  prison-signal enforcement specifically, so no dedup collision beyond the standing
  same-company-plus-category heuristic (three unrelated SpaceX+regulatory items in the window,
  cleared with `dedup_distinct`).
- 2026-11-23-D: A whitelisted signal's bluesky feed (here, Andrew Jones, via a repost rather than
  his own reporting) surfaced the sweep's only genuine signals-pass find: ESA's own "ESA Operations"
  account confirming the Nov. 21 BepiColombo Mercury orbit-insertion thruster burn ran shorter than
  planned due to a software issue. Space.com's own article (already the item's attached lead) had
  already been updated in place with the same quote, so no new source URL was attached, just a
  copy-only `updates[].patch` resync, the same shape as the standing 2026-11-08-I/2026-11-18-L
  pattern of re-checking an already-cited page's current content before assuming nothing changed.
- 2026-11-23-E: A Houston Chronicle follow-up (Molly Wilhelm) on the open Starship Flight 15
  Tamaulipas debris item was paywalled directly (402 on its own `tollbit.chron.com` redirect target)
  but a Yahoo republish explicitly crediting "Houston Chronicle" by byline worked cleanly; it also
  corrected a WebSearch synthesis that had misattributed a Conibio Global conservation-group quote
  ("the evidence is in Mexico... must be treated with the seriousness it deserves") to an unnamed
  Mexican government official, confirming the standing never-trust-a-synthesis-for-attribution
  pattern extends to quote sourcing, not just figures and dates.
- 2026-11-23-F: `bun scripts/finalize-sweep.ts` merged cleanly on the FIRST attempt ("merged 2 new,
  2 updated, 0 held"), 1339 items up from 1337. Confirmed via a direct `jq` read of both new items'
  `snr`/`snr_trace`/`category`/`impact`/`kind` fields (Colombia/MinTIC: SNR 4, mainstream base plus
  `corroboration_2plus`; Jefferies: SNR 2, trade base minus `corroboration_none`) and both updated
  items' grown `sources`/`updates` arrays (BepiColombo: 2 sources unchanged, 1 update; Tamaulipas
  debris: 5 sources up from 4, 2 updates up from 1), the sweep log's one unrelated persistence-bump
  `snr_movement` (Marble Imaging 2 to 3), and a `jq empty` parse check on all six touched data files
  (items, state, held, source_ledger, sources, candidates). `bun run build` was not attempted, per
  the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~5h13m gap, unfiltered full source list (2026-11-23, second)

- 2026-11-23-G: Google News RSS redirect URLs again failed to resolve via WebFetch this entire run
  (bare "Google News" header, no content, on 5 separate attempts), extending the standing
  2026-10-25-A/E/2026-11-22-J outage pattern across a fourth day; WebSearch-plus-direct-outlet-URL
  remained the only working path for every Google News-sourced queue lead.
- 2026-11-23-H: A SatNews piece ("Scientists and Regulators Weigh 150x Emission Claims...") on
  SpaceX's pending FCC million-satellite data-center filing had no byline, no named study, and no
  link to its source, failing the attribution bar outright; a dedicated WebSearch traced the actual
  claim to a named UCL preprint (Eloise Marais and Connor Barker, awaiting peer review in the ACS
  journal *Earth and Space Chemistry*), which essopenarchive.org itself 403'd on direct fetch.
  Scientific American (Nov. 18, byline Jacklin Kwan, a direct Marais quote) and Futurism (Nov. 22,
  independently written, a different Marais quote) both fetched cleanly and gave clean
  `corroboration_2plus` at the mainstream base tier; led with the earlier, more-detailed outlet
  rather than the thin trade piece that actually surfaced in the queue. Worth remembering that when
  an academic preprint is the real newsy fact, lead with whichever mainstream outlet's own reporting
  you can directly fetch, not the (likely 403'd) preprint host or a thin, unbylined trade rewrite.
- 2026-11-23-I: A Bluesky "satellite constellation" search hit claiming Poland's Creotech got a
  fresh "€59M" sovereign-constellation funding round traced, on a dedicated search, to the CAMILA
  program's original April 2025 ESA contract (later extended to ~€59M total, still within 2026);
  left undrafted as a stale resurfacing rather than republished off the bot repost's framing.
- 2026-11-23-J: `bun scripts/finalize-sweep.ts` rejected the first draft attempt on six
  same-company-plus-category dedup collisions at once (four on the UCL/SpaceX emissions item, two
  on the Citi price-target item, all against unrelated SpaceX regulatory/financial items in the
  window); adding the `dedup_distinct` entries merged cleanly on the second attempt ("merged 4 new,
  0 updated, 0 held"), 1343 items up from 1339. Confirmed via a direct `jq` read of all four new
  items' `snr`/`category`/`impact`/`kind` fields (BTC/Botswana: SNR 4, trade base plus
  `corroboration_2plus`; UCL emissions study: SNR 4, mainstream base plus `corroboration_2plus`;
  AssamSAT: SNR 4, mainstream base plus `corroboration_2plus`; Citi price target: SNR 2, trade base
  minus `corroboration_none`) and a `jq empty` parse check on all seven touched data files (items,
  state, held, source_ledger, sources, candidates, registry-candidates); held and
  registry-candidates were untouched (no held entries; none of the four new items' companies/
  entities had a registry profile with a like-for-like crossfeed metric). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~6h gap, unfiltered full source list (2026-11-23, third)

- 2026-11-23-K: A Payload "Industry Shares Plan for Moon Base Power Tower" piece read like a fresh
  gap on first glance but turned out to be a deeper feature on the already-published Nov. 10
  Redwire $40M NASA Moon Base contract (same figure, same program), naming the broader architecture
  (miniCAST) and two uncredited-elsewhere partners (Blue Origin's Honeybee Robotics for storage,
  Yank Technologies for wireless power transfer); folded in as a no-bump `attach`+`patch` rather
  than drafted as a new item. Worth checking a company's most recent registry items by name before
  treating a differently-titled feature as a new program.
- 2026-11-23-L: A CGTN "UK joins 10 other nations in NATO STARLIFT" piece read as fresh news but the
  existing Nov. 17 STARLIFT item already named the UK as one of the ten founding Allies in its own
  `what_happened` text; left entirely unpatched as a stale-framing resurfacing, not a UK-specific
  development. Also left out: Nara Space's and ISRO's CARTOSAT-2F "satellite exceeds design life"
  design-life-milestone recaps (routine operational status, no commercial action, same shape as the
  standing evergreen-milestone exclusion), an ISpA conference recap restating already-known
  Jio/OneWeb/Starlink India spectrum status with no new dateable action, and an Iran intelligence-
  ministry weapons-seizure release whose only Starlink angle was one terminal among hundreds of
  firearms seized from alleged separatists (no commercial-operations angle, unverified claims about
  unnamed detainees).
- 2026-11-23-M: `bun scripts/finalize-sweep.ts` rejected the first two draft attempts on two
  different updated items' taglines exceeding 140 chars (one at a time, since the gate reports only
  the first violation); merged cleanly on the third attempt ("merged 2 new, 3 updated, 0 held"),
  1345 items up from 1343. Confirmed via a direct `jq` read of both new items' `snr`/`category`/
  `impact` fields (Eutelsat/Space Force: SNR 4, trade base plus `corroboration_2plus`; Verde
  Technologies/ISS: SNR 2, trade base minus `corroboration_none` off a single-sourced Payload
  exclusive) and all three updated items' grown `sources`/`updates` arrays (Redwire Moon Base: 3
  sources, 1 update, SNR unchanged at 4; Poland Starlink sabotage saga: 16 sources, 6 updates, SNR
  unchanged at 4; Quantum Space SPAC: 5 sources, 2 updates, SNR unchanged at its official_record
  ceiling of 5), and a `jq empty` parse check on all six touched data files (items, held, state,
  source_ledger, sources, candidates); held and registry-candidates were untouched (no held
  entries; neither new item's company had a registry profile with a like-for-like crossfeed
  metric). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~11.7h gap, unfiltered full source list (2026-11-24)

- 2026-11-24-N: A 196-candidate queue almost entirely Tesla-SpaceX-merger stock-reaction spam and a
  massive Pakistani-astronaut/Shenzhou-24 cluster (left out of scope throughout, same no-commercial-
  prime-named precedent as 2026-10-25-H/2026-11-20-C) still yielded six genuinely new items via direct
  IR/trade queue entries rather than Google News: Northrop's sixth Falcon 9 booking for Cygnus (Antares
  330 still undated), a White House Artemis funding-anomalies request, BlackSky's EpochGeo acquisition,
  ISRO's L&T-HAL industry-built-PSLV milestone, a routine Ariane 6/Amazon Leo batch, and Myriota's
  Series C first close. A WebSearch synthesis for "NASA Artemis $2 billion boost" surfaced an Axios URL
  that, fetched via the `r.jina.ai` proxy, turned out to be a verbatim 2019 Trump-administration Artemis
  funding request (same $1.6B-shaped ask, Bridenstine "down payment" quote) rather than today's story;
  caught only by checking the fetched content's own dateline against the headline's claimed year, and
  worth flagging as a new flavor of the stale-resurfacing trap: a search engine can index an old article
  under a URL/headline that reads as current. The live $2B figure was confirmed instead via Politico/
  piqmarkets.com/qncnews.com (all dated Nov. 23) and the earlier-fetched Ars Technica piece.
- 2026-11-24-O: A real figure quoted in a WebSearch result ("Rs 860 crore" for the L&T-HAL PSLV
  contract) did not appear in either directly-fetched article (Tribune, India Strategic) about today's
  ISRO-chief statement; left the figure out of the drafted copy entirely rather than trust the search
  synthesis, consistent with the standing never-state-a-fact-from-an-unfetched-source rule extended to
  numbers a search engine attaches to an otherwise-correct, dated story.
- 2026-11-24-P: `arianespace.com`/`newsroom.arianespace.com` fails the `first_party` anti-spoof check:
  the registry's `arianegroup.json` organization entity records `website` as `ariane.group`, a distinct
  legal entity from Arianespace itself; reclassified Arianespace's own launch-success release to `trade`
  rather than resubmit, same shape as the standing same-company-domain-mismatch precedents (Redwire,
  Airbus, JAXA). Also: Amazon's Leo constellation has no `amazon-leo` registry slug; the entity is still
  filed under the legacy `kuiper` slug/name in `src/data/registry/constellations/kuiper.json` (a
  registry-maintenance item for Florian, not something a sweep can fix) — crossfeed facts on an Amazon
  Leo item must target `entity_slug: "kuiper"`.
- 2026-11-24-Q: Six same-week procurement/contract dedup collisions needed pre-emptive `dedup_distinct`
  entries this run (Northrop/Cygnus vs. the NSSL Lane 2 contract mod sharing company+category; the White
  House Artemis request vs. five unrelated NASA/SpaceX-adjacent procurement items from the trailing
  week), confirming the standing prolific-category pre-emption practice extends to "procurement" as a
  category, not just a single prolific company, once several government funding/contract stories land
  in the same window.
- 2026-11-24-R: `bun scripts/finalize-sweep.ts` rejected the first draft attempt (six dedup collisions
  above, plus the Arianespace first_party misclassification); merged cleanly on the second attempt after
  fixing an invalid `entity_slug` on the Amazon Leo crossfeed fact on a third attempt ("merged 6 new, 5
  updated, 0 held"), 1357 items up from 1351. Confirmed via a direct `jq` read of all six new items'
  `snr`/`category`/`impact` fields and all five updated items' grown `sources`/`updates` arrays
  (Tesla-SpaceX merger committees: 14 sources, 7 updates; Planet European defense deal: 3 sources, 1
  update; Simera Sense/Spacemanic: 2 sources, 1 update; SpaceX BEAD: 3 sources, 1 update; Zvezda PrK: 2
  sources, 1 update), the new `registry-candidates.json` `annotate_mismatch` entry for `kuiper.
  sats_launched_total` (Arianespace's own cumulative count is narrower than the registry field), and a
  `jq empty` parse check on all six touched data files (items, state, source_ledger, sources, candidates,
  registry-candidates); held was untouched (no held entries). `bun run build` was not attempted, per the
  2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~9h17m gap, unfiltered full source list (2026-11-25)

- 2026-11-25-A: A near-total-junk queue (SpaceX/Tesla-merger stock chatter, dozens of Shenzhou-24/
  Pakistan-astronaut syndicated wire pickups across small-town US papers via a single AP-style feed,
  off-topic BBC/Futurism/Space.com filler) still yielded four genuinely new items, three found entirely
  outside the queue: a discovery-pass M&A search surfaced Cerberus Capital Management's acquisition of
  Airbus U.S. Space & Defense's satellite manufacturing business (Via Satellite lead, FlightGlobal
  corroboration, both `trade`); Ars Technica's own reporting (unfetchable directly, but readable via the
  `r.jina.ai/<url>` proxy) that Amazon is moving a Falcon 9 mission from 2027 to December 2026 after
  ULA's Vulcan failure, with every other outlet found on a corroboration search explicitly crediting Ars
  Technica as its source rather than reporting it independently (`crawl: "found_none"` despite real
  topical pickup); Palmer Luckey's Nov. 18 DealBook Summit commentary on why Musk "shouldn't have to
  sacrifice the existence of the entire Starlink network" for Ukraine, found via a queue headline chased
  past its Yahoo Finance republish; and Northwood Space's own PR Newswire release on completing a
  full-duplex GEO phased-array link under an existing Space Force prototype contract, found only via
  Vivienne Machi's mandatory Aviation Week author-page leg, not the queue.
- 2026-11-25-B: The standing same-company-plus-category dedup heuristic fired on BOTH new `launch`-
  category and `geopolitical`-category items against items the drafting pass's own `items.json` greps
  (by company name) hadn't surfaced: the Amazon/Falcon 9 item collided with Tim Farrar's Nov. 18
  Falcon-9-access commentary and the Philippines/SpaceX launch-site-talks item (both company SpaceX +
  category launch); the Palmer Luckey commentary collided with the UK MOD Starshield-resilience item and
  the Ramaphosa/Musk South Africa BEE item (both company SpaceX + category geopolitical), neither of
  which shares any topic with Luckey's DealBook remarks. Worth the reminder that a `jq`/grep sweep by
  company name alone, run before drafting, will still miss same-category collisions that don't share any
  obvious keyword with the new item; checking the gate's own rejection message and adding all flagged
  `dedup_distinct` entries in one pass cleared both on the second attempt.
- 2026-11-25-C: `finalize-sweep.ts` also rejected a headline containing the word "milestone" ("Northwood
  Space completes GEO link milestone...") as hype under the exclamation-mark-adjacent hype-word gate;
  renaming to name the actual action ("closes full-duplex GEO link") cleared it immediately. Worth
  screening headline drafts for "milestone," not just obvious hype verbs, before submitting.
- 2026-11-25-D: Shell redirection to write intermediate files (`> /tmp/foo.json`, `> ./scratch.json`) is
  blocked in this sandbox even inside the repo's own working directory; large tool outputs must be read
  back via the harness's own saved-output file path (shown in the truncation notice) with the Read tool's
  `offset`/`limit`, not re-captured by shell redirection. Plan for this when triaging a large
  `candidates-context` queue.
- 2026-11-25-E: `bun scripts/finalize-sweep.ts` rejected the first attempt (four missing `dedup_distinct`
  entries above) and the second attempt (the "milestone" headline hype word); merged cleanly on the third
  attempt ("merged 4 new, 2 updated, 0 held"), 1361 items up from 1357. Confirmed via a direct grep read
  of all four new items' `snr`/`category`/`impact` fields and both updated items' patched headline/copy,
  plus the sweep log's three unrelated persistence-bump `snr_movements` entries and `signals`/`discovery`
  blocks (12-channel signals pass, 4 X handles, 8-query discovery matrix). `bun run build` was not
  attempted, per the 2026-09-09 CLAUDE.md procedure update.

## Narrow re-check, ~12h gap, unfiltered full source list (2026-11-25, second)

- 2026-11-25-F: A near-total-junk ~110-candidate queue (SpaceX/Tesla-merger stock chatter, dozens of
  Shenzhou-24/Pakistan-astronaut syndicated pickups across small-town US papers via a single AP-style feed)
  still surfaced a major first via the Google News launch feed itself: the FCC's same-day grant of SpaceX's
  "Starmind" authorization for up to 1 million orbital data-center satellites, the first US authorization
  for a space-based data-center constellation, widely covered within the hour (Reuters, CNBC, Light
  Reading, Seeking Alpha). Treated as a new item rather than an update to the existing Starmind filing/
  emissions-study items since this is the actual grant, not a filing or a third-party study of a pending
  one; needed `dedup_distinct` against five unrelated same-company-plus-category SpaceX+regulatory items
  in the window (Greenland Starlink enforcement, the UCL emissions study, the Vermilion Parish CUP, the
  BEAD no-cost deal, and Colombia/MinTIC), the last one found only from the gate's own rejection message.
  The FCC's own order (`docs.fcc.gov/public/attachments/DA-26-113A1.docx`) rendered as corrupted binary via
  WebFetch even after Reading the auto-saved local copy (a `.docx`, not a `.pdf`; the standing PDF-local-
  copy workaround does not generalize to Word documents), so the item led on Light Reading (trade) rather
  than an official_record source.
- 2026-11-25-G: Aerospacelab's own Nov. 24 inauguration of its 20,000-square-metre Charleroi satellite
  factory (Iris2's largest single production line, tied to the Sept. 10 €2.4B contract already published)
  surfaced via a Bluesky "satellite constellation" search hit, not the queue; Euronews and Kyiv Post carried
  the identical CEO Benoit Deper quote verbatim, reading as the same AFP wire text, but neither explicitly
  credited AFP and both fetched as distinct domains, so both were submitted per the standing
  don't-under-submit practice and left for the gate's title-collapse detection to adjudicate rather than
  pre-judging it a wire rewrite.
- 2026-11-25-H: Two existing items needed refinement, not new cards: SpaceX's BEAD no-cost deal (2026-11-23)
  had only a vague "~$700M"/"~$636M" range on record; Teslarati and SDxCentral (both fetched directly)
  gave the deal's finalized exact figure ($738M, ~476,000 locations) and new oversight terms (financial
  audits and procurement reporting dropped, performance-only oversight retained), landing a genuine
  `corroboration_2plus` bump (SNR 2 to 3). Louisiana's Nov. 23 pause of SpaceX's Vermilion Parish coastal
  permit review (a wildlife-habitat proximity concern, 30-day response window) patched the existing CUP
  item as a copy-only update, WDSU being the only outlet of several same-headline local-TV pickups
  (klfy.com, myarklamiss.com) that didn't 403 on direct fetch.
- 2026-11-25-I: `bun scripts/finalize-sweep.ts` rejected the first attempt (the Colombia/MinTIC dedup
  collision above, surfaced only in the gate's rejection message despite a pre-draft grep for SpaceX+
  regulatory items in the window); merged cleanly on the second attempt ("merged 2 new, 2 updated, 0
  held"), 1363 items up from 1361. Confirmed via a direct grep read of both new items' `snr`/`category`/
  `impact` fields (FCC Starmind grant: SNR 4, trade base plus `corroboration_2plus`; Aerospacelab factory:
  SNR 4, mainstream base plus `corroboration_2plus`) and both updated items' grown `sources` arrays (BEAD:
  5 sources, SNR 2 to 3; Vermilion Parish CUP: 2 sources, SNR unchanged at 2), plus the sweep log's
  `snr_movements` entry and `signals`/`discovery` blocks (13-channel signals pass, 2 X handles, 8-query
  discovery matrix). `bun run build` was not attempted, per the 2026-09-09 CLAUDE.md procedure update.
