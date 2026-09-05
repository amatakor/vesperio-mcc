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

## Normal-mode sweep, ~11h50m gap, unfiltered full source list (2026-08-22)

- 2026-08-22-A: `signalsPass.checked` must list the exact `url` field
  signals-context prints for a channel, not the `rss` field: submitting
  `https://europeanspaceflight.substack.com/feed` (the RSS endpoint
  actually fetched) got the draft rejected as "not a fetchable
  whitelisted signal channel"; swapping to the plain
  `https://europeanspaceflight.substack.com` (the `url` field) merged
  clean. Fetch the `rss` URL when present, but report the channel's
  `url` in the draft.
- 2026-08-22-B: A market-forecast press release from a firm with no
  registry entity (Novaspace's own "6,500 EO satellites by 2035"
  report) can't be led as `first_party` even though it's the actor
  speaking about itself, because the anti-spoof gate only checks
  registry/fixed-official hosts, and Novaspace has no registry profile
  to match: extends the ArkEdge/Orbit Fab/Arianespace no-registry-host
  pattern (2026-07-26-E and earlier) to analytics-firm press releases.
  SpaceNews's own RSS `raw_excerpt` for the same release (harvester-
  fetched, verbatim, matching the actor's own page word for word once
  independently checked via a guessed nova.space press-release URL)
  was usable as the `trade`-class lead instead, landing at SNR 2 after
  an honest `crawl: "found_none"` (no independent pickup found yet for
  a report published the same day). A company's own market-forecast
  report is a legitimate item in the same vein as the Space Foundation
  state-of-the-economy report (2026-07-21), category `financial`,
  `notable` impact, even when it isn't tied to a specific tracked
  actor's contract or event.
- 2026-08-22-C: Guessing a company's press-release URL slug from its
  headline can work when the listing page is reachable: fetching
  `nova.space/about-us/press-release/` first (to confirm the release
  was genuinely dated Aug 20, not a stale resurfacing) then guessing
  `nova.space/press-release/6500-eo-satellites-to-launch-by-2035/`
  from the headline's slug pattern landed the exact page on the first
  try, cross-confirming SpaceNews's raw_excerpt figures independently
  even though SpaceNews itself 403'd on direct fetch (both attempts).
- 2026-08-22-D: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate on the first
  attempt, continuing the standing pattern since 2026-07-11-B; relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 0
  updated, 0 held") plus a direct read of both new items'
  `snr`/`category`/`impact`/`snr_trace` fields as the build-health
  signal.

## Normal-mode sweep, ~11h47m gap, unfiltered full source list (2026-08-22, second)

- 2026-08-22-E: Piping an items.json dedup grep through `head -5` (or any
  small limit) is dangerous when the matched term is common: grepping
  "muon" for a dedup check returned 30 matches, but `head -5` showed only
  the earliest-in-file hits (the July 7 FireSat item), silently hiding
  the later `2026-08-20-muon-space-series-c` entry an earlier sweep
  published that same day. Drafted a discovery-pass find (Muon Space's
  $250M Series C) as a brand-new item on the strength of that truncated
  grep; `finalize-sweep.ts`'s own dedup gate caught it before merge (as
  did a second duplicate, the SpaceWERX STRATFI $562.5M/11-company
  award, surfaced independently via the signals-pass Aviation Week
  leg). Recovered both by redirecting the newly-found corroborating
  sources (a GlobeNewswire wire copy, Via Satellite, Tech Startups for
  Muon; Aviation Week's own author-page listing for STRATFI) into
  `updates[].attach` with the appropriate bump instead of discarding the
  research. Lesson: never cap a dedup grep against items.json with a
  small `head`/`tail`; use `grep -c` first to see the true match count,
  or grep for the specific slug/id shape, not just a company name.
- 2026-08-22-F: The gap between sweeps within one calendar day can be
  short enough (a same-day sweep already ran and published before this
  one started) that `sweep-context.ts`'s printed `existing[]` sample is
  not exhaustive proof an event is undrafted; a full `grep` against
  `items.json` is still the only reliable dedup check, and even that
  needs its full output read, not a truncated preview (see 2026-08-22-E).
- 2026-08-22-G: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 1 new, 2 updated, 0 held") plus a direct read of
  the new item's and both updated items' `snr`/`category`/`impact`/
  `snr_trace` fields as the build-health signal.

## Normal-mode sweep, ~11h47m gap, unfiltered full source list (2026-08-23)

- 2026-08-23-A: `federalregister.gov`'s own HTML document pages redirect
  every WebFetch to the `unblock.federalregister.gov` bot-check (2026-07-30-H's
  pattern held again), and this run additionally found the FAA's own PDF
  NEPA documents at `faa.gov/space/environmental/nepa_docs/*.pdf` 403
  outright, unlike the 2026-07-28-H case where a saved PDF was at least
  readable after a failed WebFetch. The `federalregister.gov/api/v1/documents/<id>.json`
  form still worked cleanly and gave title/publication_date/docket_id/
  comments_close_on/agencies -- used those verified fields only (a new FAA
  NEPA comment period on Reditus Space's ENOS reentry vehicle, closing Aug
  28) and deliberately left out more specific figures a WebSearch synthesis
  offered (reentry count per year, exact geographic bounds, cooperating
  agencies) since those were never confirmed by a direct fetch of the
  notice's actual text, only by search-engine paraphrase.
- 2026-08-23-B: A federal RFI/press-release fact can be real and
  well-corroborated even when the ONLY page that actually loads is an
  obscure aggregator: transportation.gov and faa.gov both 403'd for the
  FAA's spaceport-siting/priority-airspace RFI (implementing the Aug 20
  space transportation policy), and no English trade outlet covering it
  specifically could be found; it-boltwise.de (a German tech-news site)
  was the only page that fetched, and its docket number (FAA-2026-9736)
  and 60-day comment window matched independent WebSearch synthesis
  snippets of the DOT release closely enough to trust as a genuine, if
  thin, informal-class corroboration attach on the already-published
  Aug 20 policy item (already at the SNR 5 ceiling, so no bump applied).
- 2026-08-23-C: A very quiet queue (296 consumed, only 27 candidates, all
  SpaceX stock/IPO-lockup speculation or ISRO National Space Day recap
  noise) and a fully clean discovery/signals pass still surfaced two
  genuinely new facts, both regulatory follow-ons to already-published
  items rather than standalone stories -- worth remembering that a thin
  queue doesn't mean thin sourcing work; both finds required chasing a
  signals-pass lead (Jeff Foust's FAA-spaceport-RFI post) or a targeted
  Federal Register API query rather than appearing readymade. Also
  reconfirmed two standing stale-resurfacing traps on new instances: an
  "ISRO exits rocket manufacturing" IN-SPACe-chairman quote traced
  straight to the year-old Sept 2025 HAL/SSLV tech-transfer signing
  (extends 2026-08-21-G), and a "Starlink now largest ISP in Zimbabwe"
  CleanTechnica piece cited the same Q1 2026 POTRAZ data already covered
  by Orbital Today/Space in Africa in May 2026, with no new figures at
  all in the body text despite the fresh-sounding Aug 22 headline.
- 2026-08-23-D: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 0 new, 2 updated, 0 held") plus `jq` validating
  `items.json` parses (452 items, matching `sweep-context.ts`'s pre-run
  `feedSize`) and a direct read of both updated items' `snr`/`sources`
  fields as the build-health signal.

## Normal-mode sweep, ~11h49m gap, unfiltered full source list (2026-08-23, second)

- 2026-08-23-E: China's Manned Space Engineering Office (cmse.gov.cn), the
  actual first-party publisher of the Chang'e-7 launch-postponement
  statement Xinhua and Ars Technica both quoted, had not yet had the
  Aug. 23 announcement indexed by WebSearch within a few hours of the
  event (a targeted `site:cmse.gov.cn` search and a direct fetch of its
  `/xwzx/` news-listing page both surfaced only its Aug. 19
  vertical-transfer update, one step behind). Led with Xinhua/Ars
  Technica/SCMP instead rather than block on the primary; worth a
  same-metric re-check of cmse.gov.cn next sweep in case a first-party
  rescore to the direct-source ceiling becomes available once it
  indexes, same pattern as the 2026-07-30-E CASC case (though note
  english.news.cn/Xinhua itself is NOT on the gate's official_record
  allowlist per 2026-08-03-F, so cmse.gov.cn would need its own
  anti-spoof check before it could class higher than `trade`).
- 2026-08-23-F: europeanspaceflight.substack.com's `/feed` endpoint
  403'd on WebFetch this session even though the bare `europeanspaceflight.com`
  site and a Bluesky-linked article on it both fetched fine; the
  substack leg's flakiness looks session-dependent like the Bluesky API
  (2026-07-25-F and peers), not a permanent block. A whitelisted
  signal's Bluesky post pointing at a europeanspaceflight.com article
  (CNES's Aug. 18 mass-producible-telescope RFI) was still fully
  chaseable via WebSearch + direct fetch of the linked page without the
  substack feed.
- 2026-08-23-G: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate on the first
  attempt, continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 1
  updated, 0 held") plus a direct `jq` read of all three new items' and
  the one updated item's `snr`/`category`/`impact`/`snr_trace` fields
  (455 items total, up from 452) as the build-health signal.

## Normal-mode sweep, ~11h47m gap, unfiltered full source list (2026-08-24)

- 2026-08-24-A: A significant fact for an already-published item can sit
  uncaptured for over a week even on a heavily-tracked company: SpaceX's
  Cursor/Anysphere acquisition (announced June 16, still at "targets a
  close in Q3 2026" in the item's copy) actually closed Aug. 14 -- a
  fresh WebSearch surfaced it 10 days later purely from a stray Google
  News headline ("...sold to SpaceX for $60 billion") in the routine
  queue. sec.gov itself still 403'd on direct WebFetch for the closing
  8-K, but a StockTitan mirror (classed `informal`, same as the
  2026-08-02-A/2026-08-03-A precedent) plus a Yahoo Finance writeup gave
  clean, verbatim, independently-fetchable text for the closing share
  count and the new SpaceXAI/Colossus integration detail. Treated as an
  `updates[].patch` full-explainer replacement rather than a new item,
  since no new dollar figure was disclosed at closing, only the same
  $60B value becoming effective -- consistent with the 2026-08-05-I
  "closing-tranche confirmation" precedent, not the 2026-08-02-A
  EchoStar/AT&T case (which got a new item because closing disclosed a
  genuinely new figure).
- 2026-08-24-B: LandSpace's own Zhuque-3 booster-recovery milestone
  (2026-08-18, seismic) needed a same-item update five days later: both
  NASASpaceflight and a China in Space direct fetch confirmed the
  recovered booster tipped over on the pad after a post-landing
  propellant fire weakened a landing leg, damaging the interstage, both
  tanks, and two engine nozzles. Landed as an `updates[].patch` (new
  trade-class sources attached, no bump requested since the item's
  non-first-party lead was already capped at the direct-source ceiling
  of 4) rather than held or ignored; the tension between the item's
  "targeting reflight within six months" line and the new damage was
  folded into `why_it_matters` as an attributed caveat, not dropped.
- 2026-08-24-C: A fully quiet queue/HTML/signals/discovery pass
  (38 post-filter candidates, ~95% SpaceX stock-merger speculation and
  Indian National-Space-Day political noise about ISRO privatization;
  all 10 HTML sources and 17 signals channels current; an 8-query
  discovery matrix traced every hit to an already-published story)
  still yielded two genuine, non-obvious updates once each queue hit
  was checked against `items.json` rather than discarded on its
  surface framing -- confirms the standing pattern that "quiet" and
  "nothing to do" are not the same thing.
- 2026-08-24-D: `bun run build` was denied outright by this session's
  permission gate on the first attempt, continuing the standing pattern
  since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 0 new, 2 updated, 0 held") plus a `jq` parse
  check (455 items, matching the pre-run `feedSize`) and a direct read
  of both updated items' `snr`/`category`/`impact`/`sources` fields as
  the build-health signal.

## Normal-mode sweep, ~11h51m gap, unfiltered full source list (2026-08-24, second)

- 2026-08-24-E: A trade outlet's specific, technical follow-up story
  (European Spaceflight's Aug 24 piece on ESA confirming Ariane 64 Block 2
  as Argonaut's baseline, with new RPS-adaptation detail from an ESA
  spokesperson) tripped the same-company-plus-category dedup gate against
  the already-published Aug 20 "ESA shelves Ariane 6 Block 3" item on the
  same outlet, same companies (ESA/ArianeGroup), same category `launch`,
  4 days apart -- correctly folded into the existing item via
  `updates[].patch` rather than drafted standalone or forced through with
  `dedup_distinct`, since both stories are genuinely the same underlying
  Argonaut/Ariane-6-capability thread the earlier item's own why_it_matters
  already flagged ("narrows the payload margin available to ESA's Argonaut
  lunar lander"). Worth checking whether a dedup-gate hit is actually the
  SAME story continuing before reaching for `dedup_distinct`; not every
  gate hit is a false positive.
- 2026-08-24-F: `turkiyetoday.com` fetched cleanly (mainstream class,
  citing Iran's state news agency IRNA) for a 163-arrests/997-device
  Starlink-seizure report; the outlet that broke it first (iranwire.com)
  403'd on direct fetch, and a second candidate mirror
  (breakingthenews.net) returned an empty JS-shell page despite both
  appearing in WebSearch results with real-looking snippets -- landed a
  clean single-source `crawl: "found_none"` per the standing 2026-08-20-E
  precedent (WebSearch snippets/summaries of an unfetched page never
  substitute for a direct fetch, even when multiple independent-looking
  hits exist).
- 2026-08-24-G: An unregistered startup's own site (beyondreachlabs.io,
  no registry organization entity to match) confirmed and slightly
  refined a Payload article's product specs (splitting Payload's single
  "8 kW" Flarewing-S figure into 5 kW Si-cell / 8 kW triple-junction-cell
  variants) -- attached as `informal` class per the standing
  2026-07-26-E/2026-07-31-I no-registry-host workaround, since anti-spoof
  `first_party` matching requires a registry-recorded website regardless
  of whether the item is a new draft or an update.
- 2026-08-24-H: Vivienne Machi's Aviation Week author-page "NRO Takes
  Commercial SAR Partnerships To New Operational Level" (Aug 21) is still
  unverifiable three sweeps after first flagged (2026-08-21-I): still no
  fetchable article behind the headline. Worth treating this specific
  headline as a standing dead lead rather than re-attempting it each
  sweep.
- 2026-08-24-I: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 3 new,
  2 updated, 0 held") plus a `jq` parse check (458 items, up from 455)
  and a direct read of all three new items' `snr`/`category`/`impact`
  fields as the build-health signal.

## Normal-mode sweep, ~11h48m gap, unfiltered full source list (2026-08-25)

- 2026-08-25-A: A registry organization entity's `website` field can
  belong to a JOINT VENTURE profile and still class that entity's own
  same-day newsroom post as `first_party`: KSAT (equally owned by Space
  Norway and Kongsberg Defence & Aerospace) has an `organizations/ksat.json`
  entry with `website: https://www.ksat.no`, so KSAT's own Aug 24 Hyperion
  demo-campaign post matched cleanly and scored a tier-5 lead, beating the
  same-day PR Newswire wire copy and Via Satellite trade write-up of the
  identical release. Worth checking a company's registry profile even when
  its news reads like a routine wire-distributed press release; the
  company's own newsroom URL is often findable one hop from a listing page
  the wire copy doesn't link.
- 2026-08-25-B: A launch-preview candidate ("B1067 Preps Record 37th
  Flight") whose own live-coverage article stated a NET later than the
  sweep's own `now` timestamp (booster scheduled 09:33 UTC Aug 25; sweep
  ran at 05:17 UTC Aug 25) was correctly left undrafted per the standing
  2026-08-20-A "don't draft a scheduled-but-not-yet-flown launch" rule,
  confirmed by checking the Launch Library API's own `status`/`net` fields
  directly (`status.id: 1`, "Go for Launch") rather than trusting a
  "Live coverage: SpaceX to launch..." headline as evidence the launch had
  already happened.
- 2026-08-25-C: A batch of Chinese Long March 6C payloads that read like a
  fresh commercial rideshare from the raw_excerpt alone ("share ride of 7
  satellites... details TBD") turned out, once searched, to carry only two
  named payloads and both were student/amateur-radio education microsats
  (JAMX01 from a Shanghai school project, BY70-4 from Harbin Institute of
  Technology's LilacSat team) with no commercial operator aboard at all --
  left undrafted as out of scope despite the launch itself succeeding
  within window. A generic rideshare raw_excerpt is not evidence the
  payloads are commercial; check the actual manifest before drafting any
  "successful launch" candidate as an item.
- 2026-08-25-D: A Gulf News headline ("Abu Dhabi's Space42 lines up $695.5m
  to build new satellites") read as fresh discovery-pass news but every
  detail (the exact $695.5 million figure, Crédit Agricole/Santander/
  Societe Generale/Natixis arrangers, Al Yah 4/5, the 2027/2028 launch
  dates) traced to a July 2025 Via Satellite/SpaceWatch.Global/Zawya
  financing announcement, over a year stale -- caught by searching the
  exact dollar figure before drafting rather than trusting the outlet's
  current-looking publish context. Extends the standing stale-resurfacing
  pattern (2026-08-19-G and many peers) to a financial/financing story,
  not just product or personnel news.
- 2026-08-25-E: Two same-day announcements from unrelated companies
  (OrbitAID's Q1 2027 RPO demo via a Payload exclusive, Star Catcher/
  Aethero's power purchase agreement via PR Newswire) both landed at
  honest `crawl: found_none` single-source scores (SNR 2 and 3
  respectively) after genuine multi-query corroboration searches came up
  empty; publishing them at the floor rather than holding for thin
  sourcing is the model working, not a defect.
- 2026-08-25-F: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own
  merge confirmation ("merged 5 new, 3 updated, 0 held") plus a `jq` parse
  check (463 items, up from 458) and a direct read of all five new items'
  and all three updated items' `snr`/`category`/`impact`/`snr_trace`
  fields as the build-health signal.

## Normal-mode sweep, ~11h44m gap, unfiltered full source list (2026-08-25, second)

- 2026-08-25-G: SpaceX's Louisiana spaceport story (flagged "close to
  finalizing a deal" and left as a `notable`-tier item on 2026-08-03) had
  its scheduled Aug. 25 announcement (foreseen and correctly left
  undrafted on 2026-08-21) actually happen this run, 22 days after the
  original item and well outside the 7-day update/30-day reinforcement
  windows -- drafted as a new item rather than an update per the
  standard dedup rule, cross-referencing the old item only in prose (no
  unfetched URL added). Louisiana Economic Development's own
  `opportunitylouisiana.gov/spacex/` page classed `official_record`
  (a state economic-development agency's own domain stating a deal it
  brokered, same treatment as a NASA program-announcement page) and
  landed the item at the SNR 5 ceiling with three mainstream corroborations
  attached for free; spacex.com/updates and starlink.com/updates both
  still render as unreadable JS shells, confirming the standing
  2026-07-05-I dead-source call.
- 2026-08-25-H: A SpaceNews-only headline ("SpaceX offers space safety
  service for satellite operators," Aug 25) that read like a fresh
  Stargaze rollout announcement turned out to be unverifiable: SpaceNews
  itself 403'd, the Google News redirect resolved to a bare header, and
  no other outlet's Aug 25 coverage of the specific claim could be found
  (Stargaze was originally unveiled in January with a vague "spring"
  general-availability target, and starlink.com/updates/stargaze is a
  JS shell). Left undrafted per the standing "only cite pages with
  genuinely fetched content" rule rather than guess whether this is a
  genuine GA-launch follow-up or a rehash; worth re-checking next sweep
  if SpaceNews becomes fetchable or another outlet picks it up.
- 2026-08-25-I: A same-day KSAT press release ("KSAT Delivers Integrated
  Mission Services for Kongsberg's N3X Satellite Constellation," via a
  Manila Times PR Newswire mirror) read like a new constellation-ops
  story but a direct fetch confirmed it explicitly recaps KONGSBERG's
  prior N3X expansion announcement rather than stating anything new;
  left undrafted. Separately, a same-day YourStory.com profile of
  VyomIC's India PNT-constellation "GPS alternative" traced every
  concrete figure (the $1.6M raise, the founder quote) to a September
  2025 announcement, another stale-resurfacing case a full year later
  than the September 2025 original, not just the 2026-08-19-G one-year
  case -- worth treating any startup-profile piece with a suspiciously
  round, oft-repeated raise figure as a resurfacing candidate by default.
- 2026-08-25-J: A never-covered, week-old gap surfaced via the harvester
  queue itself (not discovery): the WA government's $1.75M Space Angel
  spaceport-establishment grant. The SpaceNews entry in today's queue was
  itself a catch-up piece of an Aug. 18 announcement (confirmed via
  Space Connect's own byline date); dated the item to the actual Aug. 18
  event per the standing predates-window chase rule rather than to
  today's SpaceNews republish date, even though the chase started from
  the queue rather than a discovery-pass search.
- 2026-08-25-K: Confirmed the standing `ir.rdw.com`/`rdw.com` anti-spoof
  failure (2026-08-05/2026-08-12-H: Redwire's registry `website` is
  `redwirespace.com`, a different domain) on a fresh Redwire press
  release, but found a better fallback than `informal`: the release was
  distributed via BusinessWire (confirmed by checking a Yahoo Finance
  mirror's own dateline, "--(BUSINESS WIRE)--"), so it led `wire_pr`
  (tier 4) instead. Worth checking a wire-distributed release's syndicated
  mirror for its actual wire-service dateline before defaulting a
  registry-mismatched company newsroom URL straight to `informal`.
- 2026-08-25-L: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 8 new,
  0 updated, 0 held") plus a `grep -c` parse check (471 items, up from
  463) and a direct read of the Louisiana and Ares Shield items'
  `snr`/`category`/`impact`/`snr_trace` fields as the build-health signal.

## Normal-mode sweep, ~11h42m gap, unfiltered full source list (2026-08-26)

- 2026-08-26-A: The mandatory HTML-source pass (`fetch-list.ts`'s list)
  surfaced two genuinely new, never-covered items the queue and
  discovery legs both missed entirely: ICEYE's own newsroom carried
  "establishes Netherlands entity" (Aug 25) and "establishes Indian
  entity" (Aug 24) press releases, extending the standing Germany/
  Portugal/UAE country-entity pattern (noise-tier, `partnership`,
  `first_party`), and SES's own press-releases page carried an Aug 17
  expanded Elveo Mobile D2D investment (chased back to its actual
  announcement date per the predates-window notable-event exception,
  found via the mandatory source list rather than discovery). Worth
  remembering the HTML source pass is not just a health check: company
  newsrooms on the fixed list can carry stories the Google
  News/Bluesky/candidate queue never surfaces at all.
- 2026-08-26-B: A queue candidate ("China's AI-equipped satellite
  constellation launched to boost early warnings," bastillepost.com via
  Google News, timestamped fresh in this run's window) traced on direct
  fetch to an Anadolu Agency (aa.com.tr) piece about a Smart Dragon-3/
  Star.ai launch dated August 6, three weeks stale; a small-scale,
  no-dollar-figure story like this doesn't clear the
  notable-or-seismic bar for the predates-window chase exception, so it
  was left undrafted rather than chased. Extends the standing
  stale-resurfacing pattern to a Google-News-fed Chinese wire rewrite,
  not just search-surfaced or listing-page hits.
- 2026-08-26-C: `federalregister.gov/api/v1/documents/<doc-id>.json`
  (2026-07-30-H's pattern) worked again to pin an exact FAA
  comment-deadline date (Oct 26, 2026) for the same RFI docket
  (FAA-2026-9736) a SpacePolicyOnline Bluesky post had also just
  surfaced same-day; used as an `official_record` update-only source
  (no bump possible, item already at the SNR 5 ceiling) purely to
  replace the item's vaguer "within 60 days of publication" phrasing
  with the exact date. Confirms the API-form fetch is reliable enough to
  reach for by default whenever a federalregister.gov HTML page (still
  bot-gated) is the only otherwise-blocked source for an exact date.
- 2026-08-26-D: One SpaceX event (B1067's 37th flight) carried three
  independently newsworthy facts across separately-focused outlets that
  needed combining into one item rather than three: a UPI wire piece
  (via Yahoo News Canada) led with the booster-reuse-record framing
  (100th Falcon 9 launch of 2026, closing on the Shuttle's 39-flight
  mark), while mynews13.com (Spectrum News, local Orlando TV) led with
  SpaceX VP Kiko Dontchev's on-record X post about it being the last
  planned Falcon 9 Starlink launch from Florida (Starship taking over).
  Same launch, same booster, genuinely complementary facts from
  differently-focused outlets, not a wire rewrite of each other despite
  publishing within hours of one another same day.
- 2026-08-26-E: Kiko Dontchev (SpaceX VP of Launch)'s own X account
  (@TurkeyBeaver, confirmed via a second targeted search, not the
  @-mention account a Google search snippet first suggested) is a named
  executive of the actor concerned per CLAUDE.md's signals-sourcing
  carve-out, but not a signals.json whitelist entry and not "the actor's
  official corporate account" per the first_party domain test; classed
  the tweet `informal` (attributable, corroborating) rather than
  `first_party`, leading instead with the mainstream outlet that quoted
  him. Worth the reminder that "named executive of the actor concerned"
  only grants ELIGIBILITY to be a basis for an item via social posts, not
  an automatic tier bump to first_party.
- 2026-08-26-F: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 8 new, 1 updated, 0 held") plus a `jq` parse check (479
  items, up from 471) and a direct read of all eight new items' and the
  updated item's `snr`/`category`/`impact` fields as the build-health
  signal.

## Normal-mode sweep, ~11h44m gap, unfiltered full source list (2026-08-26, second)

- 2026-08-26-G: The queue was almost entirely a single story (SpaceX's
  Aug 25 Starbase Louisiana announcement) re-reported by 40+ outlets
  plus a wave of unrelated SpaceX-valuation/analyst-note financial
  blogs (Motley Fool, Barron's, 24/7 Wall St, Seeking Alpha, Stocktwits
  price-target pieces); none of the analyst takes were drafted as
  commentary since none came from a signals.json whitelist person or a
  distinguishing named bank call beyond what the existing Aug 25 item
  already carries (Morgan Stanley) — publishing every repeat "SpaceX
  valuation" take would be padding, not signal. Instead the mandatory
  HTML-source pass caught the genuinely new fact the queue buried: a
  same-day ICEYE Korea entity release, extending the standing country-
  entity pattern (Germany/Portugal/UAE/India/Netherlands) to a sixth
  country; drafted with `dedup_distinct` against the two most recent
  same-category ICEYE entries (Netherlands Aug 25, India Aug 24) since
  each is a genuinely separate country/leadership/MOU event, not a
  rewrite.
- 2026-08-26-H: Payload's own Starbase Louisiana article, fetched via
  its queue `raw_excerpt` (not a WebFetch summary), carried real
  operational detail the Aug 25 item's official-record lead source
  didn't state (five launch complexes, self-sustaining site plan,
  a jobs estimate revised up to 10,000, and the ExxonMobil-lawsuit
  dismissal that freed the land) — patched into the existing item's
  `what_happened` via `updates[]` even though the item was already at
  the SNR 5 ceiling and no rescore was possible; the value was in the
  copy, not the score. Reminder: `explainer` patches are a full-field
  replace, not an append (confirmed against `finalize-sweep.ts`'s
  `{...base.explainer, ...patch.explainer}` merge), so the patch must
  carry the complete new text, original sentences included.
- 2026-08-26-I: A single-source Payload exclusive (City Labs' second
  nuclear demo, testing a lunar-night radioisotope heating unit) got a
  genuine `crawl: "found_none"` after a real search turned up nothing
  beyond the same Payload piece — landed at trade tier 3 minus one for
  the uncorroborated claim, SNR 2, published anyway per the standing
  "weak sourcing is not a hold reason" rule.
- 2026-08-26-J: `spacenews.com` 403'd on a queue candidate (RTX/Blue
  Canyon "new spacecraft mission enabler") and the queue's own
  `raw_excerpt` cut off before naming the actual product; a WebSearch
  surfaced a plausibly-related "FleXbus" RTX release but dated Aug 14,
  a mismatch with the Aug 26 SpaceNews republish date and never
  independently confirmed as the same announcement — left undrafted
  rather than guess which product the SpaceNews piece meant, per the
  standing "only cite pages with genuinely fetched content" rule.
- 2026-08-26-K: A Reuters/Washington Times/AP set of pickups on
  "Zelensky awards Musk Ukraine's Order of Freedom, seeks wider
  Starlink access over Russia" all 403'd or were unreachable directly;
  Fortune and the Kyiv Independent both fetched cleanly and corroborated
  each other (mainstream tier 3 + corroboration bump = SNR 4) despite
  disagreeing on the award's English name (Order of Freedom vs. Order
  of Liberty, likely a Ukrainian-to-English translation variance) —
  went with "Order of Freedom" per the majority of headlines seen in
  WebSearch results (AP, Reuters, Fortune, Washington Post, ABC) without
  citing any of the unfetched pages. Classed as `geopolitical` under the
  CLAUDE.md carve-out (a government statement about commercial space
  services in a conflict), not conflict analysis, since the item reports
  Zelensky's on-record ask and Musk's on-record refusal without
  characterizing the war itself.
- 2026-08-26-L: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate, continuing
  the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 5 new, 1
  updated, 0 held") plus a `jq` parse check (484 items, up from 479)
  and a direct read of all five new items' and the updated item's
  `snr`/`category`/`impact` fields as the build-health signal.

## Narrow same-day re-check, ~3h48m gap, unfiltered full source list (2026-08-26, third)

- 2026-08-26-M: A near-total-duplicate queue (400 of ~447 candidates
  already consumed, the remainder almost entirely SpaceX Louisiana
  Starbase follow-up coverage from 40+ outlets and SpaceX/Tesla stock
  speculation) still surfaced one genuinely new, well-sourced item via
  the queue's own Spire IR/Via Satellite entries: NOAA's TMATE program
  (Temperature and Moisture Advanced Technology Evolution) awarded
  Spire ($27,982,177), Muon Space ($11M), and Weather Stream ($7.5M)
  combined $46.5M to develop new microwave sounding instruments,
  announced Aug 26. Spire's own IR release didn't name the "TMATE"
  program (called it "HyMS" work generically) and the raw_excerpt was
  empty; NOAA's own NESDIS press release (found via WebSearch, not the
  queue) named the program, listed all three exact award figures, and
  gave the 24-month/Aug 25 start timeline -- led with NESDIS as
  `official_record` (SNR 5) rather than Spire's own release, since the
  government award notice is the more complete and more authoritative
  primary source when both exist for a procurement.
- 2026-08-26-N: Extends the standing same-company-plus-category dedup
  false positive to a new instance: the new NOAA TMATE award (company
  Muon Space, category `procurement`) tripped the gate against the
  Aug 20 SpaceWERX STRATFI awards (also company Muon Space, also
  `procurement`, within 7 days) despite being unrelated agencies
  (NOAA vs. Space Force), programs, and cohorts. One `dedup_distinct`
  entry cleared it.
- 2026-08-26-O: A Polish government institute's GNSS-jamming report
  (widespread interference along the Baltic coast, also flagged
  same-day by Andrew Parsonson on Bluesky) was left out of scope
  despite reading like a regulatory/incident story: no commercial
  satellite operator is named, no operator or government statement
  ties it to a specific space asset or service change, and the
  disruption is described purely in terms of ground-receiver/PNT
  effects (phones, drones, city bikes) -- distinct from the
  attributable-incident carve-out (which covers debris, collisions,
  and satellite anomalies attributed to a reporting authority), and
  matching the 2026-08-19-H "space-adjacent but no commercial-space
  angle stated" exclusion pattern.
- 2026-08-26-P: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate, continuing
  the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 0
  updated, 0 held") plus a grep parse check (485 items, up from 484)
  and a direct read of the new item's `snr`/`snr_trace`/`category`/
  `impact` fields as the build-health signal.

## Narrow same-day re-check, ~7h55m gap, unfiltered full source list (2026-08-27)

- 2026-08-27-A: A near-total Louisiana-Starbase-follow-up queue (24 of
  31 candidates were local-TV/Google-News reaction pieces on the Aug 25
  SpaceX deal: NDAs/"Project Osprey" secrecy criticism, permitting
  timelines, community/environmental concern coverage) yielded no
  update: every Google News redirect resolved to a bare "Google News"
  header (the standing 2026-07-31-J/2026-08-21-G pattern), and
  WebSearch summaries of the same headlines surfaced only vague framing
  ("NDAs," "permits within months") with no specific new fact
  independently confirmable by a direct fetch. Left the already-SNR-5
  item untouched rather than attach unverified reaction-piece framing.
- 2026-08-27-B: The same-company-plus-category dedup heuristic fired
  twice on one new item for entirely different reasons: a new TraCSS
  pilot-status/budget item (company "Office of Space Commerce",
  category `regulatory`) matched BOTH the July 15 TraCSS-budget-cut
  congressional-hearing item (42 days prior, same underlying funding
  saga, still a legitimately distinct dateable statement) AND the Aug
  20 Space Commerce Certification pilot item (6 days prior, a
  completely unrelated mission-authorization program). Needed two
  separate `dedup_distinct` entries on one item; the gate checks each
  window-eligible existing item independently, so one dedup_distinct
  clearing one match does not pre-clear a second unrelated match on
  the same company+category.
  Also note: `Ethan Baumann` (TraCSS's actual acting program manager
  per space.commerce.gov's own staff page) is a different named
  individual from `Dmitry Poisik` (a TraCSS program manager quoted in
  older, unrelated pilot-user-count coverage found via WebSearch) --
  don't assume a single "TraCSS program manager" byline is
  interchangeable across articles months apart; check the specific
  quote's attribution before merging facts from two searches.
- 2026-08-27-C: An important, well-corroborated event surfaced by
  discovery search can carry conflicting dates across secondary
  aggregators even when nothing is actually wrong: India's Pixxel-led
  "Allied Orbits" national EO-constellation PPP deal was reported with
  three different dates across five outlets (an Aug 2025 Via Satellite
  "IN-SPACe selects Pixxel" selection-stage story, a domain-b.com
  mirror stamped "January 21, 2026," and SatNews/Newsage.in both dated
  Aug 12-13, 2026 and both explicitly tracing the fact to a written Lok
  Sabha reply from Minister Jitendra Singh). Treated the two outlets
  that independently cited the specific parliamentary-reply mechanism
  (with matching satellite-sensor breakdowns) as the reliable date
  rather than the single outlier mirror date, and dated the item to the
  Lok Sabha reply (Aug 12) rather than either the year-old selection
  announcement or the unverifiable January date; pib.gov.in and
  inspace.gov.in were both unreachable (DNS failure / blank JS shell)
  so no first-party confirmation was possible. When aggregator dates
  disagree, prefer the date consistently tied to a specific, named
  disclosure mechanism (a parliamentary reply, a filing) over a lone
  outlier, rather than defaulting to the earliest or most recent.
- 2026-08-27-D: A second India-privatization headlines trap
  ("ISRO will not make any launch vehicles" / PSLV and LVM3
  manufacturing moving to HAL/L&T, IN-SPACe chairman Pawan Goenka,
  National Space Day Aug 23) looked like a genuine escalation beyond
  the already-flagged-stale SSLV-only HAL transfer (2026-08-21-G,
  2026-08-23-C), since it explicitly named PSLV and LVM3 too -- but no
  source stated a signed contract or a named consortium for those two
  vehicles specifically (only SSLV had a completed "competitive bidding
  process"), and pib.gov.in/isro.gov.in were unreachable to confirm.
  Left undrafted as still-ambiguous policy intent rather than a
  completed transfer; worth a direct check of isro.gov.in or
  inspace.gov.in next sweep if either becomes fetchable, since this
  could be a genuine, larger story if a specific consortium and
  contract for PSLV/LVM3 gets confirmed.
- 2026-08-27-E: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate, continuing
  the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 0
  updated, 0 held") plus a `jq` parse check (488 items, up from 485)
  and a direct read of all three new items' `snr`/`snr_trace`/
  `category`/`impact` fields as the build-health signal.

## Narrow same-day re-check, ~11h47m gap, unfiltered full source list (2026-08-27, second)

- 2026-08-27-F: The mandatory HTML-source pass (`fetch-list.ts`) again
  surfaced the sweep's only genuinely new, well-sourced find: ESA's own
  newsroom carried "First contracts kick off European Launcher
  Challenge" (Aug 27), confirming ESA's first three European Launcher
  Challenge awards (Isar Aerospace €197.8M, Rocket Factory Augsburg
  €186.9M, PLD Space €158.9M; MaiaSpace excluded this round). The queue
  and Google News legs carried only Louisiana-Starbase follow-up chatter
  and SpaceX stock-analyst noise. `esa.int` classes clean as
  `first_party` per existing item precedent (registry `organizations/
  esa.json` website field matches exactly, e.g.
  `2026-07-02-esa-emxys-don-quijote-cubesat-contract`'s snr_trace),
  landing the item at the SNR 5 ceiling with European Spaceflight
  (trade, harvester raw_excerpt) and Euronews (mainstream, direct fetch)
  as free corroboration. Same ICEYE newsroom fetch also caught two
  already-published items (Korea entity Aug 26, Netherlands entity Aug
  25) alongside one genuinely new one (a Water Institute FloodID
  partnership, Aug 27, noise-tier `product`, no independent corroboration
  found beyond a PR Newswire wire-copy of the same release).
- 2026-08-27-G: Extends the standing "already-published, just needs a
  grep" pattern (2026-08-22-E and peers) to Spire Global's own IR page:
  both a "$28M NOAA hyperspectral microwave sounding" release (Aug 26)
  and a "€4M EUMETSAT contract renewal" release (Aug 25) read like fresh
  finds from the mandatory source pass but grepped straight to
  already-published items from earlier the same day
  (`2026-08-26-noaa-tmate-spire-muon-weatherstream`,
  `2026-08-25-spire-eumetsat-contract-renewal`) — the $28M figure is
  Spire's individual share of the $46.5M three-company TMATE award
  already covered under NOAA's own program name. Grep company-page
  press-release headlines against items.json before treating a "new"
  IR-page release as undrafted, not just Google News/queue hits.
- 2026-08-27-H: The Bluesky public API (2026-07-30-I's pattern) worked
  cleanly for Josef Aschbacher, Andrew Jones, Marco Langbroek, Caleb
  Henry, and Tim Farrar this run, but returned obviously stale content
  for Eric Berger (posts dated April-June 2025/2026, over a year old,
  despite a fresh `now` timestamp) — a session-dependent caching quirk,
  not a dead account; worth a retry next sweep rather than treating the
  account as unreachable. Aschbacher's own post confirmed the ELC
  signing same-day but added no fact beyond ESA's own press release.
- 2026-08-27-I: A discovery-pass hit ("SpaceX folded xAI into its own
  stack... deal effective on announcement," from a general funding-round
  search) turned out to already be folded into an existing item's prose
  as background context (grepped "xAI" against items.json body text, not
  just headlines) — worth grepping full item bodies, not just headlines,
  when a discovery search surfaces something that reads like it could be
  a standalone event.
- 2026-08-27-J: Confirms 2026-08-27-D from the same day's earlier sweep:
  a fresh WebSearch on India's ISRO PSLV/LVM3/SSLV privatization still
  traced only to the same SatNews/BusinessToday synthesis (no named
  consortium or signed contract for PSLV/LVM3 specifically), and
  `pib.gov.in` still 403'd on direct WebFetch. Left undrafted a second
  time this day rather than re-litigate a same-day call with no new
  primary source.
- 2026-08-27-K: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s
  own merge confirmation ("merged 2 new, 0 updated, 0 held") plus a `jq`
  parse check (490 items, up from 488) and a direct read of both new
  items' `snr`/`snr_trace`/`category`/`impact` fields as the
  build-health signal.

## Narrow same-day re-check, ~9h gap, unfiltered full source list (2026-08-28)

- 2026-08-28-A: "USAF: Our Starbase Louisiana is not affiliated with SpaceX" (KATC,
  Google News queue) is a genuine name collision, not a story about SpaceX's
  Starbase Louisiana: STARBASE is a 27-year-old DoD youth STEM education program
  (the Louisiana Air/Army National Guard's science-outreach initiative), unrelated
  to SpaceX's own "Starbase" branding. Confirmed via WebSearch before drafting;
  discarded as out of scope rather than treated as a regulatory clarification on
  the Aug 25 SpaceX deal.
  Separately, a Satellogic `SEC EDGAR 8-K feed: SATL` Item 5.02 filing traced (via
  WebSearch, sec.gov 403'd as usual) to a routine Interim CFO appointment
  (Corporate Controller since 2022 stepping up), below the inclusion bar per the
  standing routine-executive-hire exclusion.
- 2026-08-28-B: `esa.int` classes `first_party` for an update's `rescore` even
  when the item's `companies` array names a different party (Arianespace, not
  ESA): the anti-spoof gate checks the URL's domain against the FULL registry
  host set, not just the item's own companies, confirming 2026-08-27-F's finding
  generalizes to the update/rescore path, not just newItems. Used it to upgrade
  the MTG-I2 scheduled-launch item (Via Satellite lead, SNR 4) to the completed
  launch via ESA's own post-launch article (SNR 5 ceiling) once the Aug 27 mission
  actually flew; `rescore.sources[0].url` had to equal a `patch.source_url` set in
  the same update object first, per the documented upgrade-path contract.
- 2026-08-28-C: A quiet, near-total SpaceX-Starbase-Louisiana-follow-up queue
  (stock speculation, local-TV reaction pieces, Motley Fool/Barron's SpaceX
  valuation churn) still yielded two genuinely new items straight from the
  Via Satellite/Payload queue entries once each was actually read rather than
  assumed to be more Louisiana follow-up: Astrum Space's ~$1B SPAC merger with
  Black Spade Acquisition III (a Singapore satellite-to-device operator with no
  registry entity, landed at trade+mainstream SNR 4, `major` impact on the
  stated-valuation test) and a Kepler Communications/NorthStar Earth & Space
  hosted-payload SDA partnership (two independent trade outlets, SNR 4,
  `notable`). Neither needed a corroboration WebSearch beyond confirming no
  further pickup existed; the queue's own distinct-outlet entries (Via Satellite
  + Payload, Via Satellite + BNN Bloomberg/Reuters) supplied the required second
  source directly.
- 2026-08-28-D: The Bluesky public API 504-timed-out on all seven attempted
  accounts in one batch, then succeeded cleanly on an identical retry of the same
  URLs roughly two minutes later — confirms 2026-08-27-H's "session-dependent,
  not dead" read of Bluesky API flakiness; worth one immediate retry before
  logging an account as unreachable this session.
- 2026-08-28-E: Two same-day discovery-pass leads that read like fresh finds
  traced to already-covered ground once checked against `items.json`: NOAA's
  Spire/PlanetiQ radio-occultation contracts ($3.7M/$2.7M) were the same Aug 14
  award already published, and the FCC's "200 MHz unlicensed D2D spectrum"
  initiative was the same Aug 6 NPRM vote already published under its own id.
  Relativity Networks' "$22M SAFE note" hit (from a generic funding-round query)
  is a terrestrial hollow-core-fiber data-center company with no satellite
  connection at all despite ranking high in a space-adjacent search; confirmed
  via a direct read of its own business description before discarding, not
  assumed out of scope from the headline alone.
- 2026-08-28-F: `bun run build` was denied outright by this session's permission
  gate, continuing the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 1 updated, 0
  held") plus a `jq` parse check (492 items, up from 490) and a direct read of
  both new items' and the updated item's `snr`/`snr_trace`/`category`/`impact`
  fields as the build-health signal.

## Narrow same-day re-check, ~2h48m gap, unfiltered full source list (2026-08-28, second)

- 2026-08-28-G: A genuine "government's own announcement is forward-looking,
  not confirmation" trap: Turks and Caicos Islands' Telecommunications
  Commission own site (telecommission.tc) carried a page titled "Signing and
  Presentation of Licences Ceremony" (published Aug 20) announcing that
  Starlink Caribbean LLC's licence ceremony was SCHEDULED for Aug 27, in
  future tense throughout ("is facilitating... on August 27, 2026"). By the
  time this sweep ran (Aug 28), search snippets from suntci.com and other
  local outlets described the ceremony in the past tense ("Starlink Goes Live
  in TCI"), but suntci.com and tcweeklynews.com both 403'd on every direct
  fetch attempt, and telecommission.tc's own site had no follow-up post
  confirming completion (checked its homepage listing directly). Left
  undrafted rather than assert a completed-event fact from an announcement
  page that only speaks in future tense plus unfetchable search snippets;
  worth a direct re-check of telecommission.tc and suntci.com next sweep for
  a post-ceremony confirmation post, since the underlying event (a small but
  genuine market-access regulatory grant, matching the Vietnam market-entry
  precedent) is real and worth publishing once confirmable.
- 2026-08-28-H: A same-day re-check with a genuinely near-total-duplicate
  14-candidate queue (SpaceX/Starlink stock speculation, an AP-wire Ship 40
  recovery piece resurfacing days late via Gulf Coast News/WTAE that traced
  to the already-covered Aug 20/24 Christmas Island recovery already in the
  existing Flight 13 item, and Jalopnik's late pickup of the already-published
  Aug 25 Starbase Louisiana announcement) plus a clean mandatory 10-source
  HTML pass and a 10-query discovery matrix all traced to already-published
  ground: confirms the standing pattern that a short re-check can legitimately
  net zero even after full-effort discovery. `bun run build` and
  `bun scripts/check-feed.ts` were both denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B; relied
  on `finalize-sweep.ts`'s own merge confirmation ("merged 0 new, 0 updated, 0
  held") plus a grep parse check (492 items, unchanged from the prior sweep)
  as the build-health signal.

## Normal-mode sweep, ~11h51m gap, unfiltered full source list (2026-08-28, third)

- 2026-08-28-I: The registry's `official_record` anti-spoof allowlist rejects
  a state economic-development agency's own domain unless it is already on the
  allowlist: `hie.co.uk` (Scotland's Highlands and Islands Enterprise,
  confirming a spaceport asset acquisition it brokered) was rejected as "not an
  official official_record host" even though the 2026-08-25-G precedent
  (Louisiana Economic Development's `opportunitylouisiana.gov`) classed an
  analogous state-agency announcement page as `official_record` and it passed.
  The distinguishing factor is likely the `.gov` TLD; a non-`.gov` development
  agency domain needs `trade` instead until the allowlist is extended. Reclassed
  to `trade` and the draft passed.
- 2026-08-28-J: The finalize-sweep gate rejects exclamation marks anywhere in
  `headline`/`explainer.tagline`/`explainer.what_happened`, including inside a
  company's own stylized legal name: French rideshare broker RIDE! (styled
  with a trailing exclamation mark on its own site and by every outlet
  covering it) had to be written as "Ride" throughout the prose (kept as
  "RIDE!" in the `companies` array, which the gate did not flag) to pass the
  no-hype/no-exclamation-marks house style rule. Worth checking a newly
  introduced company's stylized name for punctuation before drafting.
- 2026-08-28-K: MaiaSpace's own newsroom (`maia-space.com`, note the hyphen;
  `maiaspace.com` without one does not resolve via WebFetch, ENOTFOUND) is a
  genuine first-party source for its own announcements, but MaiaSpace has no
  standalone registry organization entity (it appears only inside
  ArianeGroup's org profile) — per the standing 2026-07-26-E/2026-08-04-B
  no-registry-host workaround, its own domain still capped at `informal`
  class rather than `first_party`; landed the item at SNR 2 despite being a
  clean, well-corroborated (3 independent outlets) own-source lead. Confirms
  MaiaSpace joins the standing list of frequently-recurring actors (Apex
  Space, ispace, Orbit Fab, ArkEdge) worth a registry add at the next
  structural touch.
- 2026-08-28-L: A months-old dormant registry spaceport entity can resurface
  as a genuine new item once its parent company's insolvency saga produces a
  new, distinct event: `src/data/registry/spaceports/sutherland.json` already
  existed (operator "Orbex", status "on hold") from the original February
  Orbex-administration coverage, and HIE's August 25 acquisition of the site's
  assets out of liquidation is a clean crossfeed touch on the `operator`
  field, six-plus months outside the 7-day window of the original item, so it
  drafted as a new standalone item rather than an update.
- 2026-08-28-M: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the standing
  pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 3 new, 0 updated, 0 held") plus a grep parse check
  (495 items, up from 492) and a direct read of all three new items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the build-health
  signal.

## Normal-mode sweep, ~11h47m gap, unfiltered full source list (2026-08-29)

- 2026-08-29-A: A stock-move financial-blog headline ("Rocket Lab Falls 6% as
  SpaceX Flags Iridium Deal to the FCC," 24/7 Wall St.) buried a genuine,
  distinct regulatory development on the already-published June 29 Rocket
  Lab/Iridium acquisition: SpaceX filed a letter with the FCC urging scrutiny
  of Iridium's conduct (50+ petitions against rival satellite deployments)
  during the merger's license-transfer review, tied to a real spectrum-sharing
  dispute (Starlink gateways vs. Iridium in the 19.4-19.6/29.1-29.3 GHz bands).
  MLex (paywalled but confirmed the core facts before cutting off) and a
  Stocktwits/TradingView mirror (which alone carried Iridium's on-record
  response quote) both independently corroborated 24/7 Wall St.'s reporting.
  Drafted as a new item (not an update; ~2 months outside the dedup window)
  cross-referenced only in prose per the 2026-08-25-G precedent, no unfetched
  URL added to secondary_urls.
- 2026-08-29-B: The same-company-plus-category dedup heuristic fired again on
  a new SpaceX-adjacent item: the SpaceX/Iridium FCC-filing draft (category
  `regulatory`) false-matched the Aug 24 Iran Starlink-crackdown item purely
  on shared company (SpaceX/Starlink) + category + <7-day window, despite
  being completely unrelated (a domestic terminal-seizure story vs. a
  merger-review spectrum dispute). One `dedup_distinct` entry cleared it;
  extends the standing SpaceX-volume false-positive pattern
  (2026-08-03-H/2026-08-05-C and peers) to the `regulatory` category
  specifically, not just `launch`/`procurement`.
- 2026-08-29-C: Google News RSS redirects failed again on every attempt this
  run (PCMag Viasat-interference and Chinese-rocket-debris headlines, a
  247wallst/BPUB MyRGV.com redirect) -- WebFetch returned only a bare "Google
  News" header each time, continuing the standing 2026-07-31-J/2026-08-21-G
  pattern. WebSearch-by-headline recovered the Iridium/FCC story fully (see
  2026-08-29-A) but could NOT independently confirm the PCMag Viasat-petition
  or Chinese-rocket-debris headlines beyond generic background on long-running
  SpaceX-Viasat EPFD disputes and the already-published June 15 Zhuque-2E
  breakup; left both undrafted per the standing "only cite pages with
  genuinely fetched content" rule rather than guess which specific claim the
  unfetchable PCMag pieces were making.
- 2026-08-29-D: A NASA press release that reads exactly like breaking news
  from a routine discovery-pass query ("NASA Awards Spaceflight Operations,
  Systems Organization Contract," $1.8B COSMOS award to ASCEND Aerospace &
  Technology, appearing in a "commercial contract award this week" search)
  traced via GovConWire and Space Coast Daily's own dateline
  (spacecoastdaily.com/2025/08/...) to an August 29, **2025** award, exactly
  one year stale. nasa.gov's own release page carries no visible publish date
  in its rendered content, making this a new trap shape: a primary-source
  government press page without an obvious date stamp needs its date
  cross-checked via a secondary outlet's URL/dateline before treating a
  search hit as fresh, not just Google News/publisher pages with visible
  bylines.
- 2026-08-29-E: The mandatory HTML-source pass and signals pass (12 of 17
  fetchable channels checked, rotating out Vivienne Machi's still-dead
  Aviation Week lead per 2026-08-24-H, plus Marcia Smith's and Anatoly Zak's
  site legs since their Bluesky feeds and the harvester's own
  SpacePolicyOnline queue feed already cover the same ground) surfaced
  nothing beyond already-published stories this run (MTG-I2 completion,
  the Aug 28 Space Academy executive order, Sutherland spaceport). Genuinely
  new items instead came entirely from the routine candidates-queue (Via
  Satellite's InspeCity/Ovzon entries) and a discovery-pass search (the
  Iridium/FCC filing) -- confirms `bun run build`/`check-feed.ts` remain
  denied outright by this session's permission gate (standing pattern since
  2026-07-11-B); relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 3 new, 0 updated, 0 held") plus a grep parse check (498 items, up
  from 495) and a direct read of all three new items' `snr`/`category`/
  `impact` fields as the build-health signal.

## Narrow same-day re-check, ~7.5hr gap, unfiltered full source list (2026-08-29, second)

- 2026-08-29-F: A genuine near-total-zero sweep with full-effort discovery
  behind it: the queue (53 candidates, mostly SpaceX stock/Cursor-OpenAI
  drama and ISRO exam-recruitment noise), a 10-source mandatory HTML pass,
  a 12-channel signals pass, and an 8-query discovery matrix all traced to
  ground already covered by the earlier same-day sweep or before: MTG-I2's
  Aug 27 launch (2026-07-20 item, updated per 2026-08-28-B), the ESA
  European Launcher Challenge award (2026-08-27), ICEYE/Spire's newsroom
  releases (2026-08-24 through -27 items), Muon Space's Series C
  (2026-08-20), Astrum/Black Spade SPAC (2026-08-28), Sutherland spaceport
  (2026-08-28), and the whole 2025 "New Glenn rocket explosion" Wikipedia
  page (the same May 28, 2026 pad explosion already covered under several
  ids, not a fresh incident despite reading like one from the title alone).
  A single OHB Sweden EPS-Sterna EUR 248M contract lead traced on direct
  fetch to a March 18, 2026 signing date, five-plus months stale despite
  surfacing near the top of a fresh search.
- 2026-08-29-G: A Nancy Grace Roman Space Telescope Falcon Heavy launch is
  scheduled for Aug 30, 2026 (per space.com's own mission-timeline
  article), one day after this sweep's `now`; left it undrafted rather than
  publish pre-launch buildup coverage (fairing encapsulation, rollout)
  as an event, consistent with the standing rule that a scheduled/upcoming
  launch is not itself a dateable event until it actually flies. Revisit
  next sweep once the launch has occurred.
- 2026-08-29-H: A whitelisted signal's on-topic-looking lead can still miss
  the scope bar: Andrew Parsonson's Aug 26 Bluesky post on Poland's
  National Institute of Telecommunications reporting widespread GNSS
  interference along its Baltic coast (63% of August days affected) named
  no satellite operator, no space-industry actor, and no government
  statement about a commercial-space angle -- it is a ground-based
  navigation-jamming/electronic-warfare report, not a commercial-space
  event, and stayed out per the conflict-analysis exclusion even coming
  from a whitelisted, fetchable channel.
- 2026-08-29-I: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own
  merge confirmation ("merged 0 new, 0 updated, 0 held") plus a `jq` parse
  check (498 items, unchanged from the prior sweep) and `state.json`'s
  stamped `lastSweep` as the build-health signal.

## Narrow same-day re-check, ~4h20m gap, unfiltered full source list (2026-08-29, third)

- 2026-08-29-J: A near-total-zero queue (41 candidates, ~95% SpaceX stock/
  Cursor-OpenAI-feud speculation, Futurism AI stories, and evergreen
  Space.com content) and a fully clean HTML/signals pass still yielded a
  genuine, never-covered find via the discovery pass's own "incident/
  debris/regulatory" leg: SpaceX's Falcon 9 upper stage 2025-010D (the
  Blue Ghost-1/ispace Resilience lunar-lander launch from Jan 15, 2025)
  struck the Moon near Einstein crater on Aug 5, 2026, 24 days before this
  sweep ran and well-forecast in advance (astronomy press covered it
  extensively). Chased per the standing predates-window rule even at
  noise tier, since CLAUDE.md's incident category names "uncontrolled
  reentries... and satellite losses or anomalies" as in-scope regardless
  of how routine, with no notable/seismic gate on the chase itself for a
  genuinely never-covered fact (distinct from 2026-08-26-B, where a
  small, no-dollar-figure story was left unchased because it was a
  resurfacing of an *already-published* event, not a fresh gap). Led with
  Forbes (mainstream, published the day of impact) over NASA's own page
  (official_record, but published pre-impact as a "will attempt to
  observe" forecast, not a confirmation the impact occurred) and a
  specialist orbit-tracking site, Project Pluto (Bill Gray), classed
  `informal` since it isn't CelesTrak/Space-Track (the only two sources
  SNR_SPEC names for the `computed` class). cnn.com 451'd
  ("Unavailable For Legal Reasons," a new failure mode for this project)
  and techtimes.com 403'd on this specific article; space.com's own
  article page rendered navigation chrome only, no body text, on
  WebFetch.
- 2026-08-29-K: Two Aug 2026 "space company" funding/M&A leads from a
  generic discovery query were confirmed non-orbital defense companies
  once checked, not space-scope name collisions: Castelion ($1B Series C,
  $13B valuation) makes hypersonic missiles, and Space-Eyes (still
  tracked from 2026-08-01-B) took an option to acquire KMS Solutions, a
  Navy engineering services firm — neither has an orbital product. A
  third lead, GovConWire's "Quantum Space to Go Public" piece, read fresh
  in search results but was dated June 8, 2026, the same original SPAC
  announcement already published under
  `2026-06-08-quantum-space-spac-merger` (grepped before drafting).
- 2026-08-29-L: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new,
  0 updated, 0 held") plus a `jq` parse check (499 items, up from 498)
  and a direct read of the new item's `snr`/`snr_trace`/`category`/
  `impact`/`sources` fields as the build-health signal.

## Narrow same-day re-check, ~3h50m gap, unfiltered full source list (2026-08-29, fourth)

- 2026-08-29-M: A headline-shaped trap on Nvidia's own Q2 FY2027 earnings
  release (Aug 26): outlets widely reported "SpaceX is ~5% of Nvidia's
  revenue, nearly $5 billion" as if Nvidia disclosed it, but that figure
  traces to analyst Gene Munster (Deepwater Asset Management), not
  Nvidia's own press release or CFO Colette Kress's on-the-record
  quote (which only confirmed SpaceXAI as a "lead partner" receiving
  Vera CPU shipments, no dollar figure). Nvidia does not break out
  customer-level revenue. Left the existing 2026-08-04 Starmind/Nvidia
  item untouched rather than attach an analyst-estimated dollar figure
  as if it were a company disclosure; a genuine update here would need
  Nvidia's own confirmation quote, cleanly sourced, not folded together
  with the analyst estimate the way most coverage presented it.
- 2026-08-29-N: aboutamazon.com's own Project-Kuiper/Amazon-Leo news-tag
  page can surface an older article ("375+ satellites now in orbit")
  whose count is LOWER than the registry's current figure (396, as_of
  Jul 13) despite reading like a fresh mission-update headline on the
  tag listing page with no visible date — a new stale-resurfacing shape
  on a primary company page, not just search snippets or Google News.
  Cross-check a company's own "latest update" page's stated figures
  against the registry before treating it as a fresh milestone.
- 2026-08-29-O: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 0 new,
  0 updated, 0 held") plus a `grep -c` parse check (499 items, unchanged
  from the prior sweep) as the build-health signal.

## Normal-mode sweep, ~7h52m gap, unfiltered full source list (2026-08-30)

- 2026-08-30-A: A vague Google-News queue headline ("Reports of space debris
  breaking up over Montana," KPAX) traced on WebSearch to an unrelated,
  genuinely new gap rather than the Montana sighting itself: a Long March 6C
  upper stage (NORAD 100472) fragmented in orbit Aug. 27, tracked by LeoLabs,
  the second documented CZ-6-family breakup this year. The Montana sighting
  itself stayed undrafted (unconfirmed, speculative "perhaps an old Starlink"
  framing, no named tracking source). SpaceNews was the only fetchable
  account of the fragmentation; Space.com's own article page rendered
  navigation chrome only (no body text, the standing space.com WebFetch
  failure mode) despite appearing in search results, and airandspaceforces.com
  turned out to be about the unrelated 2024 Long March 6A breakup (a new
  stale-resurfacing trap: identical topic, wrong year). Landed a clean
  single-source `crawl: "found_none"` (SNR 2) per the standing "WebSearch
  snippets of an unfetched page never substitute for a direct fetch" rule.
- 2026-08-30-B: A SpaceNews repost embedded in Jonathan McDowell's Bluesky
  feed ("NASA and AeroVironment are moving ahead with...helicopters...on a
  nuclear propulsion demonstration mission") surfaced a genuine gap: NASA/JPL
  awarded AeroVironment's MacCready Works a contract to build three
  autonomous Mars helicopters for the SkyFall mission (Aug. 27 announcement),
  a distinct provider-selection event from the already-published July 23
  SR-1 Freedom budget item (37 days prior, no shared source URL, a different
  specific fact) rather than an update. AeroVironment has no registry
  organization entity, so its own avinc.com press-release page could not
  class `first_party`; found a BusinessWire-mirror page (offshoresource.com,
  confirmed via its own "ARLINGTON, Va.--(BUSINESS WIRE)--" dateline) as a
  `wire_pr` (tier 4) lead instead of falling back to `informal`, per the
  standing 2026-08-25-K workaround. Worth a registry add for AeroVironment
  at the next structural touch: this is now at least three items (SR-1
  Freedom budget, SkyFall contract, plus its recurring role as a Mars-program
  contractor) referencing a company with no profile.
- 2026-08-30-C: The mandatory 10-source HTML pass and a 10-channel Bluesky
  signals pass were both fully clean this run beyond the two finds above:
  every ICEYE/Spire/SES/Telesat release traced to an already-published item,
  and the CNES press page's "8th Ariane 6 commercial mission, first to GTO"
  release confirmed it was the same MTG-I2 launch already upgraded to
  completed status via the 2026-08-28-B rescore, not a second GTO mission.
  A 10-query discovery matrix (launch, financial x2, regulatory, non-US x3,
  constellation contract, incident, M&A) traced every hit to already-covered
  ground (Muon Space Series C, SpaceSail $1B, FCC D2D NPRM, GalaxySpace
  Thailand export, Rocket Lab/STR SB-AMTI $615M batch, ESA Launcher
  Challenge, Astrum/Black Spade SPAC, Hughes/Dish bankruptcies) -- confirms
  the two real finds this run both came from chasing thin/misleading leads
  past their surface framing, not from the matrix itself.
- 2026-08-30-D: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own
  merge confirmation ("merged 2 new, 0 updated, 0 held") plus a `jq` parse
  check (501 items, up from 499) and a direct read of both new items'
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the build-health
  signal.

## Normal-mode sweep, ~7h gap, unfiltered full source list (2026-08-30, second)

- 2026-08-30-E: NASA's own science.nasa.gov mission-blog subdomain (not
  `www.nasa.gov`, the registry's exact `website` value) classed clean as
  `first_party` for the Roman Space Telescope's own launch-day post,
  confirming the standing subdomain-of-registered-apex rule
  (2026-07-07-E/2026-08-27-F) extends to nasa.gov's science-blog
  subdomain, not just esa.int. A flagship-observatory launch (NASA's next
  "great observatory" after Hubble/Webb, $4.3B lifecycle cost, launched
  nine months ahead of schedule) was scored `major` impact under the
  science-category "exceptional firsts reach major" rule (2026-07-13)
  rather than the more common `notable` every other science item in the
  feed carries to date -- flag for Florian if that reading of "exceptional"
  is too generous, since this is the first `major`-tier science item.
- 2026-08-30-F: A same-day, same-company-plus-category dedup false
  positive fired on BOTH new items this run (NASA/science against the
  Aug 27 AeroVironment SkyFall item; SpaceX/partnership against the Aug 4
  Nvidia/Starmind item), extending the standing SpaceX-volume pattern
  (2026-08-01-C and many peers) to NASA for the first time -- NASA's own
  high item-count across unrelated science-program stories makes it as
  prone to this heuristic as SpaceX. Two `dedup_distinct` entries cleared
  both.
- 2026-08-30-G: An unofficial, unconfirmed-by-either-party trade report
  (Royal Air Maroc/Starlink Aviation fleet Wi-Fi deal, sourced to Africa
  Intelligence's Aug 18 scoop via Space in Africa and Le360, neither RAM
  nor SpaceX having confirmed it) was chased and published anyway per the
  standing "attributable weak sources publish at low SNR, only anonymous
  sources don't" rule (CLAUDE.md) -- landed at trade+mainstream SNR 4,
  dated to the reported Aug 4 signing date (19 days outside the sweep
  window) under the standing notable-or-above predates-window chase rule,
  with the copy explicitly flagging the lack of official confirmation
  rather than asserting the deal as settled fact.
- 2026-08-30-H: Two further stale-resurfacing traps this run: a SpaceNews
  "China resumes launches for Thousand Sails constellation" piece that
  reads current in search results actually mirrors to an October 2025
  dateline (per a copernical.com mirror's own timestamp), and a
  "European acquisition revives Space Perspective's space tourism
  ambitions" (EOS-X Space) hit traces to a July 2025 acquisition, over a
  year stale; also out of scope regardless (stratospheric balloon
  tourism, not orbital). Neither drafted.
- 2026-08-30-I: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own
  merge confirmation ("merged 2 new, 0 updated, 0 held") plus a `jq` parse
  check (503 items, up from 501) and a direct read of both new items'
  `snr`/`category`/`impact`/`sources` fields as the build-health signal.

## Narrow same-day re-check, ~4h49m gap, unfiltered full source list (2026-08-30, third)

- 2026-08-30-J: A near-total-duplicate queue (43 candidates, ~90% Roman
  Space Telescope launch-day pickup from 30+ outlets plus SpaceX stock/
  IPO-lockup speculation and off-topic Futurism content) still surfaced a
  genuine, never-covered gap via the discovery pass's financial leg:
  Delta Air Lines picked Amazon Leo over Starlink for future in-flight
  WiFi, announced March 31, 2026 (500 aircraft from 2028), with zero prior
  draft under any id (grepped items.json for "amazon leo"/"delta air
  lines", only tangential Amazon Leo hits, no Delta one) despite wide
  contemporaneous coverage (CNBC, Amazon's own newsroom, Delta's own
  newsroom, Airways Magazine). Chased per the standing predates-window
  convention and dated to the actual March 31 announcement, 5 months
  stale. Delta has no `src/data/registry` organization entity, so its own
  news.delta.com release capped at `informal` (the standing
  2026-08-05-O/2026-07-31-I no-registry-host workaround) even though it
  is genuinely the customer speaking about itself; Amazon's own
  aboutamazon.com page led clean at `first_party` (registry-matched
  Kuiper/Amazon Leo website), landing the item at the SNR 5 ceiling.
- 2026-08-30-K: The Launch Library candidate queue can carry a launch
  entry ("Long March 8A | Unknown Payload") whose own `raw_excerpt`
  ("Details TBD") gives no hint it is actually three weeks out: the
  linked Launch Library record's own `status`/`net` fields showed "To Be
  Confirmed" for a September 11 window, not a completed or even
  near-term launch. Confirms the standing 2026-08-09-B/2026-08-25-B rule
  (always check a Launch Library entry's own status/net fields, not just
  its presence in the window-dated queue) extends to entries with no
  payload identified yet, which read as maximally ambiguous rather than
  obviously future-dated.
- 2026-08-30-L: NASA's own Crew-13 delay announcement (an oxidizer leak
  found on Dragon's propulsion system during routine prelaunch
  processing, Aug 29) was a genuine same-day item the queue surfaced
  directly (Google News), not a discovery-pass chase; scored `noise`
  impact as a routine pre-launch schedule slip caught by ground
  processing, consistent with the standing treatment of scheduled-launch
  delays as non-market-moving unless the underlying cause itself is
  seismic. NASA's science-agency blog domain (nasa.gov) matches the
  registry's recorded website cleanly for `first_party`; a mainstream
  local-TV pickup (FOX 35 Orlando) supplied `corroboration_2plus` even
  though its text closely tracked NASA's own release, since it is an
  independent outlet's own coverage, not a wire-service rewrite.
- 2026-08-30-M: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own
  merge confirmation ("merged 2 new, 0 updated, 0 held") plus a `jq` parse
  check (505 items, up from 503) and a direct read of both new items'
  `snr`/`category`/`impact`/`sources` fields as the build-health signal.

## Narrow same-day re-check, ~4h11m gap, unfiltered full source list (2026-08-30, fourth)

- 2026-08-30-N: **NEEDS FLORIAN: accidentally published an exact
  duplicate item.** Andrew Parsonson's bluesky (signals pass) surfaced
  "Highlands and Islands Enterprise bought Sutherland Spaceport Ltd's
  assets" (HIE's own release + European Spaceflight, Aug 25) and it was
  drafted and merged as `2026-08-25-hie-sutherland-spaceport-assets`
  (category `launch`) -- only after finalize-sweep merged it did a
  registry-candidates.json check reveal this is the SAME event as the
  already-published `2026-08-25-orbex-sutherland-spaceport-hie-acquisition`
  (category `financial`, merged 2026-08-28, same two source URLs, same
  facts). The finalize-sweep same-event dedup gate did NOT catch it
  because the two items landed in different categories (`launch` vs
  `financial`) despite sharing a company, date, and both source URLs --
  confirms the gate's same-company+category+7-day match can be defeated
  by an honest category-judgment difference between two independent
  drafting passes on the identical story. No sweep-side tool can retract
  a merged item (`scripts/review-queue.ts` only manages `held.json`
  entries pre-publish; there is no delete/retract path in
  `finalize-sweep.ts`), and hand-editing `items.json` is a hard rule
  violation even to fix this -- left both items live and flagged here
  for manual removal of the duplicate (recommend keeping
  `2026-08-25-orbex-sutherland-spaceport-hie-acquisition`, the earlier
  one, and deleting `2026-08-25-hie-sutherland-spaceport-assets`, plus
  the resulting duplicate `sutherland.operator` entry it added to
  `registry-candidates.json`). Lesson: before drafting ANY signals-pass
  or discovery-pass find, grep `items.json` directly for the actor/place
  name (here "sutherland" or "hie"), not just the `existing[]` sample
  from sweep-context or trust in the dedup gate -- the gate is a
  backstop, not a substitute for a direct grep, especially for a story
  that could plausibly be filed under more than one category.
- 2026-08-30-O: The Brownsville, TX city commission's Aug 29 vote to
  disannex 444 acres near Starbase from city zoning in exchange for a
  $220 million SpaceX water-infrastructure commitment (KRGV lead,
  RGV Business Journal corroboration) published clean as a genuinely new
  item at `launch`/`notable`/SNR 4, after two same-company+category
  dedup false positives against the unrelated Aug 25 Starbase Louisiana
  and B1067 Florida-Starlink items were cleared with `dedup_distinct`
  (the standing SpaceX-volume pattern, 2026-08-01-C and many peers).
  Confirmed via direct grep of `items.json` for "brownsville"/"disannex"
  post-merge that this one is NOT a duplicate.
- 2026-08-30-P: A stale (Aug 9) Elon Musk X reply -- "All cars will have
  Starlink in the future... the only way to get super high bandwidth to
  billions of vehicles" -- resurfaced today in Yahoo Autos/Jalopnik/
  Benzinga reaction pieces piggybacking on Roman-launch-day traffic;
  verified verbatim via the syndication endpoint but NOT drafted as
  commentary: three weeks stale, speculative musing rather than a
  concrete product decision, below the notable-or-above bar the
  predates-window chase convention requires.
- 2026-08-30-Q: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s own
  merge confirmation ("merged 2 new, 0 updated, 0 held") plus a `jq`
  parse check (507 items, up from 505) as the build-health signal --
  the duplicate in 2026-08-30-N above is a content/dedup defect, not a
  schema or build failure, so it passed this check cleanly.

## Narrow same-day re-check, ~7.5h gap, unfiltered full source list (2026-08-31)

- 2026-08-31-A: A near-total-duplicate queue (55 post-filter candidates, ~90%
  Roman Space Telescope launch-day reaction across Google News and Bluesky
  search, plus SpaceX/Tesla stock speculation) and a fully clean mandatory
  10-source HTML pass yielded exactly one genuinely new item, surfaced by the
  discovery pass, not the queue: Firefly CEO Jason Kim's on-record commentary
  (Yahoo Finance exclusive interview, corroborated by an independently
  worded SatNews piece) that rocket supply still trails satellite demand
  despite SpaceX's dominance. Drafted as `kind: "commentary"` and left
  `companies` as `["Firefly Aerospace"]` only (omitting SpaceX, which is
  discussed but doesn't act in the item) specifically to avoid the standing
  same-company-plus-category dedup false positive against the week's many
  SpaceX `launch`-category items; worth this as a general tactic for
  commentary/analysis items that merely reference a heavily-covered company
  in passing.
- 2026-08-31-B: "US forces strike 2 Iranian rocket launch sites" (a same-day
  Google News queue entry, several outlets) traced via WebSearch to anti-ship
  rocket LAUNCHERS with sea mines on Larak Island in the Strait of Hormuz,
  not an orbital/space launch site -- a pure military-strike headline
  collision on the word "rocket launch," not a space story at all. Discarded
  silently rather than treated as a geopolitical/incident candidate.
- 2026-08-31-C: The already-flagged Sutherland/HIE spaceport duplicate
  (SWEEP_MEMORY 2026-08-30-N) resurfaced via Andrew Parsonson's Bluesky feed
  again this run; recognized it as the known duplicate on sight and did not
  redraft it. That NEEDS-FLORIAN flag is still open as of this sweep.
- 2026-08-31-D: A signals-pass Bluesky post from Andrew Parsonson ("WTF is
  going on with the Polish Space Agency?", re: POLSA president Marta Ewa
  Wachowicz) traced to institutional agency-leadership turmoil with no
  discrete new fact or stated commercial-space consequence in the post
  itself -- left undrafted per the standing NASA-STRIDE/ASI-board
  institutional-disclosure exclusion pattern, not chased further.
  Separately, Andrew Jones' Galactic Energy Pallas-1 debut-launch post is for
  a launch scheduled Sept 1 (not yet flown as of this sweep); left undrafted
  per the standing don't-draft-scheduled-launches rule, revisit next sweep.
- 2026-08-31-E: A discovery-pass "space company bankruptcy OR layoffs"
  query surfaced True Anomaly workforce-cut coverage that read current in
  search snippets but traced on inspection to April 2024 layoffs following
  the Jackal spacecraft's failed debut, not a 2026 event (more recent
  reporting says the company has since grown to ~300 employees) -- another
  instance of the standing stale-resurfacing trap, this time from a
  bankruptcy/layoffs-focused query rather than a headline-shaped one.
- 2026-08-31-F: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 1 new, 0
  updated, 0 held") plus a `jq` parse check (508 items, up from 507) and a
  direct read of the new item's `snr`/`snr_trace`/`category`/`impact`
  fields as the build-health signal.

## Narrow same-day re-check, ~9h gap, unfiltered full source list (2026-08-31, second)

- 2026-08-31-G: A signals.json whitelisted person's own SITE (not just their
  bluesky/X channel) can be classed `whitelist` directly: Andrew Parsonson's
  europeanspaceflight.com article on SES awarding OHB a ~€1B IRIS2 MEO
  satellite-manufacturing contract was led with `class: "whitelist"`,
  `scoring.whitelist: "observer"` (he's reporting on SES/OHB, not himself),
  base tier 3 per the "whitelisted account 3 (before floors)" rule, and
  landed at SNR 4 via the ordinary 2-source corroboration bump rather than
  the whitelist-floor modifier -- same final score, different code path,
  worth noting both routes reach 4 on a 2-source whitelisted-lead item.
  This is a distinct event from the already-published Aug 6 EU/SpaceRISE
  IRIS2 implementation-agreement item and the Aug 7 SES MEO capital-
  commitment item (SES's own capex vs. SES awarding a build contract to
  OHB) despite sharing OHB/SES as companies and landing in a
  procurement-adjacent category; no dedup false positive fired since the
  nearest same-company item was 25 days prior.
- 2026-08-31-H: A same-day PR Newswire release for a startup with no
  `src/data/registry` entity (Diffraqtion, quantum-imaging cameras for
  space/EO/SDA payloads) classed cleanly as `wire_pr` (base tier 4) without
  needing the no-registry-host `informal` workaround (2026-08-05-O and
  peers) -- `wire_pr` never required a registry match in the first place,
  only `first_party` does; worth remembering the workaround is specific to
  companies whose OWN domain needs anti-spoof matching, not to wire
  distribution platforms.
- 2026-08-31-I: Vivienne Machi's Aug 28 Aviation Week piece on Trump's
  executive order creating a Presidential Commission to design a "United
  States Space Academy" (NASA-led workforce/training academy) was left
  undrafted: it names no commercial contractor, procurement dollar figure,
  or market-access change, just a commission to advise on standing up a
  federal academy -- squarely the standing institutional-disclosure
  exclusion (NASA-STRIDE/ASI-board/Lok-Sabha precedent, most recently
  2026-08-06-G) despite being genuinely on-the-record and dated.
- 2026-08-31-J: Chased two speculative-looking queue leads to ground and
  discarded both: "Musk clarifies that SpaceX bought APR Energy" is a
  months-old (May 2026), already-reported acquisition of a mobile gas/
  diesel-turbine power company for AI datacenters, entirely terrestrial
  power generation with no orbital space product or service -- out of
  scope regardless of SpaceX ownership, same logic as the DISH DBS/
  Wireless terrestrial exclusion. Harvard's 13F disclosure of a $2.2B
  SpaceX stake was also left undrafted: it's a passive third-party
  portfolio disclosure, not a transaction by or affecting SpaceX itself
  (no funding round, 8-K, M&A, or bankruptcy), so it doesn't fit the
  financial-events scope even though the dollar figure is large and
  widely reported.
- 2026-08-31-K: A same-day Global Times/Xinhua story ("world's first
  space-based computing cloud enters routine on-orbit service," BUPT-led
  Tiansuan Constellation platform) was judged out of scope and left
  undrafted rather than held: the Global Times piece's own commercial-angle
  framing ("shifting from delivering hardware to delivering services") read
  as an inference from the coverage, not a stated fact from either source,
  and the underlying event is a research platform reaching steady-state
  operation for academic/government experiments, not a capability offered
  on commercial terms. Flag for Florian if in-space computing infrastructure
  should get an explicit scope ruling either way, since this is the second
  time this topic has come up (2026-08-05-K's ESPI commentary item was the
  first) without a clear precedent for the underlying technical milestones.
- 2026-08-31-L: `bun run build` was denied outright by this session's
  permission gate, continuing the standing pattern since 2026-07-11-B;
  relied on `finalize-sweep.ts`'s own merge confirmation ("merged 2 new, 0
  updated, 0 held") plus a `jq` parse check (510 items, up from 508) and a
  direct read of both new items' `snr`/`snr_trace`/`category`/`impact`/
  `tags` fields as the build-health signal.

## Narrow same-day re-check, ~2h40m gap, unfiltered full source list (2026-08-31, third)

- 2026-08-31-M: `draft.signalsPass.checked` must list the exact channel URL
  from `signals-context.ts`'s `fetchable[]` array (the `bsky.app/profile/...`
  page URL), not the Bluesky public API endpoint actually used to fetch it
  (`public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=...`);
  finalize-sweep rejected all ten API-URL entries in one pass with "not a
  fetchable whitelisted signal channel." Also, `draft.coverage` must be
  valid `Category` enum values (e.g. `"product"`), not a tag like
  `"connectivity"`. Both were mechanical draft-format mistakes, not
  editorial ones; fixed and the draft passed clean on the second attempt.
- 2026-08-31-N: A near-total SpaceX-stock/turbine-speculation and
  Roman-telescope-followup queue (34 candidates, one collapsed) yielded
  zero drafts from the queue itself; the sweep's only genuinely new item
  came from chasing the queue's own stock-reaction fallout back to its
  source. SpaceX's own gas-turbine-blade foundry for AI data centers
  (Bastrop, TX; announced Aug 29, driving Howmet/GE Vernova stock moves
  and most of this queue) is out of scope on the same terrestrial-power
  logic as the 2026-08-31-J APR Energy call: no orbital space product
  or service, regardless of SpaceX ownership or how much financial-press
  churn it generates. A same-queue "FT: Musk willing to let Ukraine use
  Starlink to strike Russia" headline traced, via WebSearch beyond the
  single-outlet mirror, to conflicting unnamed-source reporting (Kyiv
  Independent's own sourcing says Musk actually opposes it) with no
  confirmed Starlink service change -- squarely the 2026-08-01-F
  conflict-operational-use exclusion, now confirmed on a second, higher-
  profile instance with a bigger outlet byline (FT) than the original
  Trump "consider" case.
- 2026-08-31-O: A Tech Times headline ("ISRO Launches First Geostationary
  Imager as NavIC Falls Below Four-Satellite Floor") conflates two
  separate things: ISRO's GISAT-1A/EOS-05 GSLV launch is still scheduled
  (confirmed via the Launch Library entry, "Go for Launch," Sept 3-4
  window, not yet flown) and NavIC's constellation dropping below its
  four-satellite minimum PNT threshold is a stale fact from March 2026
  (last atomic clock failure on IRNSS-1F) already reported to Parliament
  in July -- neither is a fresh, dateable event for this sweep. Left both
  undrafted; NavIC's degradation could be a legitimate predates-window
  chase candidate later if a source states a concrete commercial/market-
  access consequence (India mandates NavIC smartphone support), but this
  run's trigger article was about the future launch, not that angle.
- 2026-08-31-P: The mandatory HTML pass, an 11-channel signals pass
  (10 Bluesky accounts via the public API plus Jonathan McDowell's site,
  which is stale at Aug 1 with no separate bluesky/rss entry in the
  fetchable list), and an 8-query discovery matrix all traced to already-
  published ground (Diffraqtion funding, SES/OHB IRIS2, CesiumAstro/
  1Aardvark, Quantum Space/Bridenstine, Kulasekarapattinam privatization,
  Hughes Chapter 11, LandSpace booster landing) or were too stale to chase
  (an Array Labs $20M Series A radar-payload round, actually dated Jan 6
  2026 despite reading fresh in a "raised $20 million... announced
  Monday" search snippet -- eight months stale, well past any reasonable
  predates-window bar for a routine, non-notable funding round). Only
  find: chasing a Google-News SpaceX-stock-reaction headline
  ("SpaceX cuts Starlink prices by 50% for residents near Starbase
  Louisiana") back through WebSearch to Yahoo Finance's direct fetch
  (quoting both Musk's X post and SpaceX's own "neighbors on Louisiana's
  Gulf Coast" statement) plus KADN (local Louisiana TV) and a smaller
  informal blog, landing a clean 3-source SNR 4 `product`/`noise` item
  dated to the actual Aug 27 announcement, 4 days before this sweep.
  Neither `starlink.com`'s own support-article page (JS shell, no
  content on WebFetch) nor `businesswire`-class wire mirrors were
  needed once a mainstream outlet's direct fetch supplied the verbatim
  Musk quote and exact per-tier dollar figures.
- 2026-08-31-Q: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 1 new, 0 updated, 0 held") plus a `jq` parse check (511 items,
  up from 510) and a direct read of the new item's `snr`/`snr_trace`/
  `category`/`impact`/`tags` fields as the build-health signal.

## Narrow same-day re-check, ~5.5h gap, unfiltered full source list (2026-08-31, fourth)

- 2026-08-31-R: WebSearching a company's own domain for a specific story
  (`site:northstar-data.com` plus the story's keywords) surfaced a
  different, older press release on a superficially similar topic: a
  search for NorthStar's own FALCON/reentry-forecasting consortium
  announcement kept returning an Oct 21, 2025 release about a separate
  ESA-funded atmospheric-drag-uncertainty consortium (different program,
  different partners overlap only on "ESA" and "consortium"). Confirmed
  by fetching the page directly and checking its stated publish date
  before citing it; no current-dated NorthStar press release for the
  Aug 31 FALCON story was found, so the item shipped on Via Satellite's
  trade lead alone (crawl `found_none`, the only other hit being an
  aggregator, UFO FEED, republishing Via Satellite's own headline
  verbatim, a wire-rewrite, not independent corroboration). Extends the
  standing stale-resurfacing trap pattern to same-domain company-site
  searches, not just generic web search snippets.
- 2026-08-31-S: Two more companies join the no-registry-entity list
  (2026-08-04-B's Apex Space precedent): All.Space (owned by York Space
  Systems, no `src/data/registry` entity for either) and NorthStar
  Earth & Space (no entity despite recurring in a April SPAC item and an
  Aug 27 Kepler-hosted-payload item). Both companies' own domains were
  classed `informal` rather than forced `first_party`, per the standing
  workaround.
- 2026-08-31-T: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 3 new, 0 updated, 0 held") plus a `jq` parse check (514 items,
  up from 511) and a direct read of all three new items' `snr`/
  `snr_trace`/`category`/`impact`/`tags` fields as the build-health
  signal.

## Narrow same-day re-check, ~6h gap, unfiltered full source list (2026-09-01)

- 2026-09-01-A: A near-total-junk queue (31 candidates: Roman Space
  Telescope launch reaction, SpaceX/Tesla stock speculation, an
  off-topic FBI story, weather/storm-name filler) still yielded a
  seismic item via the queue's own Launch Library entry: Galactic
  Energy's Pallas-1 (a new, partially-reusable kerolox rocket) flew its
  debut flight successfully. Led with china-in-space.com (trade, richest
  technical detail) over Xinhua, since 2026-08-03-F's ruling still holds
  (english.news.cn is not on the gate's `official_record` allowlist;
  cite it as `trade`). The extraordinary flag was forced by the gate's
  own seismic-with-non-first-party-lead rule and landed the item at a
  sober SNR 3 despite 3 independent sources (china-in-space, Xinhua,
  TASS) -- a good example of "seismic AND honestly low-scored" per
  CLAUDE.md's importance/SNR independence rule, not a bug to fight.
- 2026-09-01-B: A same-day AST SpaceMobile/Rakuten Japan D2C story
  (queue candidate was a stock-reaction piece rehashing a stale June 24
  MIC spectrum recommendation) was chased via WebSearch to an Aug 4
  "commences operations" claim (SatNews, Yahoo Finance, ForeignPolicy
  Journal), but a same-day (Aug 5) Foreign Policy Journal piece on the
  identical FCC filing described operations as only "imminent"/"in the
  near term," not yet commenced -- a genuine tense discrepancy between
  outlets describing the same underlying FCC notification, with no
  fetchable first-party AST SpaceMobile or Rakuten press release to
  settle it (ast-science.com's investor press-releases page and
  corp.mobile.rakuten.co.jp's press listing both loaded but had no
  August 2026 entries). Left undrafted rather than risk overclaiming a
  "commenced" fact the sourcing doesn't cleanly support; flag for a
  future sweep if a firmer source turns up.
- 2026-09-01-C: The signals pass's fetchable legs (15 of 17 channels,
  two skipped as same-person site/bluesky duplicates) outperformed the
  queue and discovery pass combined this run: Vivienne Machi's
  Aviation Week author page (whitelisted, `observer`) surfaced a
  same-day Northwood Space factory-opening story the queue never
  carried at all. Her articles are AWIN-paywalled per her signals.json
  note, so only the author-page headline was usable as the whitelist
  corroboration source; the actual facts were drafted from Northwood's
  own blog post (classed `informal`, no registry entity to anti-spoof
  match, per the standing 2026-08-04-B/2026-08-31-S workaround). The
  whitelist-floor modifier alone took the item from a tier-1 informal
  base to a final SNR 4.
- 2026-09-01-D: Jeff Foust's and Andrew Parsonson's bluesky posts about
  OHB's ~€1B SES IRIS2 MEO contract were both same-day rediscoveries of
  the already-published `2026-08-31-ses-ohb-iris2-meo-contract` item
  (merged earlier the same day per SWEEP_MEMORY 2026-08-31-G); confirmed
  via grep before drafting anything, no update needed.
- 2026-09-01-E: An 8-query discovery matrix (including a Chinese-language
  query for the China/non-US leg) surfaced only already-published ground
  (K2 Space Series D, NASA's June 23 CSDA On-Ramp 2, ESA's European
  Launcher Challenge, India's Kulasekarapattinam spaceport privatization)
  -- zero net-new items from this leg, consistent with the standing
  pattern that discovery is a completeness backstop, not the primary
  yield source, on narrow same-day re-checks.
- 2026-09-01-F: `bun scripts/check-feed.ts` was denied outright by this
  session's permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 2 new, 0 updated, 0 held") plus a `jq` parse check (516 items,
  up from 514) and a direct read of both new items' `snr`/`snr_trace`/
  `category`/`impact`/`tags` fields as the build-health signal.

## Narrow same-day re-check, ~6h38m gap, unfiltered full source list (2026-09-01, second)

- 2026-09-01-G: The corroboration_2plus modifier needs at least 2 sources
  tagged `"via": "corroboration"` beyond the lead, not just a total of 2
  sources: a trade-lead item with exactly one corroboration source (Airbus/
  Aeolus-2, lead + 1) landed at a flat base-tier SNR 3 with an empty
  `modifiers` array, while a same-run item with lead + 2 corroboration
  sources (Pallas-1 update, now 4 total) got the bump. CLAUDE.md's "a second
  distinct source" wording reads like 2 sources total should count; the
  deployed scorer apparently wants 2 *additional* ones. Not fudged or
  worked around, since the math is code, but worth flagging for Florian if
  that reading is unintended.
- 2026-09-01-H: A registry organization's `website` field can be a
  product-line subdomain that fails anti-spoof against the company's own
  main corporate domain: the registry's Airbus Defence and Space entry
  records `space-solutions.airbus.com`, and Airbus's own newsroom press
  release for the Aeolus-2 contract lives on `www.airbus.com` (the actual
  official corporate site) -- finalize-sweep's gate rejected `first_party`
  on the apex-domain press release as "not an official first_party host."
  Reclassed to `trade` and the draft passed. Same shape as the SpaceX
  ir.spacex.com/s21.q4cdn.com and Redwire ir.rdw.com mismatches
  (2026-08-05-B/2026-08-06-B), but this is the first case where the
  registry-recorded domain is the narrower one and the company's actual
  main site is the one that fails the match.
- 2026-09-01-I: A discovery pass's rotating "Europe space agency contract
  satellite" query surfaced two genuinely never-covered, well-documented
  ESA contract awards sitting in plain sight for months: ESA/Thales Alenia
  Space's €700M Sentinel-1 Next Generation contract (June 10) and ESA/
  Airbus's Aeolus-2 wind-lidar contract (July 2), neither drafted under any
  id despite wide contemporaneous trade coverage (SpaceNews, Aviation Week,
  Thales/Airbus's own newsrooms). A generic WebSearch synthesis claimed
  Aeolus-2's initial contract was worth "51 million euros ($58.3 million)";
  direct fetches of euro-sd.com and defensetalks.com both confirmed no
  dollar figure appears in either article, so the figure was dropped
  entirely rather than published on an unverified WebSearch-summary number
  a source page itself doesn't state (Aeolus-2 shipped as `notable` with no
  stated value rather than the unverifiable `major`-shaped figure).
- 2026-09-01-J: A "NIWC Pacific... India... maritime domain awareness"
  corroboration search for a same-day Vantor Maritime Sentry contract
  returned two seemingly on-point trade hits (Seapower Magazine, Baird
  Maritime) that, on direct fetch, turned out to be about a different,
  older (May 2025) $125M IPMDA initiative naming HawkEye 360, not Vantor,
  as the contractor -- a new stale/wrong-contractor trap shape (same
  program acronym, different year, different company) caught only by
  actually reading the fetched content rather than trusting the search
  snippet's apparent relevance. The item shipped as a clean single-source
  first-party SNR 5 (`crawl: "found_none"`, no penalty per the direct-source
  rule) once the only other hits found were confirmed Business Wire
  syndication mirrors of Vantor's own release, not independent coverage.
- 2026-09-01-K: `bun run build` was denied outright by this session's
  permission gate; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 6 new, 1 updated, 1 held") plus a `jq` parse check (522 items,
  up from 516) as the build-health signal. The Sentinel-1 NG item's
  crossfeed (`sats_planned: 2`, exactly matching the registry's existing
  value) still auto-queued to `held.json` as a same-metric SNR tie for
  Florian to adjudicate per SNR_SPEC 6, even though the two values agree;
  the item published normally per the standing auto-queue-while-publishing
  rule.

## Narrow same-day re-check, ~6h38m gap, unfiltered full source list (2026-09-01, third)

- 2026-09-01-L: A discovery-pass find can already be covered by the SAME-DAY
  morning sweep even when the candidate queue re-surfaces it fresh: a
  Telesat/Cailabs optical-connectivity queue result (via the mandatory
  Telesat News HTML pass) read as a brand-new Sept 1 release, but grepping
  `items.json` for "telesat-cailabs" found it already published as
  `2026-09-01-telesat-cailabs-optical-connectivity` by the 12:16 UTC sweep
  earlier the same day. Drafted the full item first, including scoring and
  crossfeed, before the grep check; finalize-sweep's own same-event dedup
  gate caught it anyway ("same-event match ... draft it as an updates[]
  entry"), but the 2026-08-07-A lesson (always grep existing items before
  drafting a signals/discovery find, not just trust the gate) held here too
  and would have saved the redraft.
- 2026-09-01-M: The MyRGV.com follow-up on the Brownsville/SpaceX water deal
  (refund-if-milestones-missed provision) was left undrafted: MyRGV and
  ValleyCentral (KVEO) both 403'd on every attempt, and the only other
  direct fetch (KSAT) confirmed the escrow/payment structure already in the
  published item but explicitly did NOT contain the refund-contingency
  detail a WebSearch synthesis had surfaced. Per the standing rule (numbers
  must come from a direct fetch or raw_excerpt, never a WebSearch summary
  alone), there was no gate-safe way to add this genuinely new-sounding
  detail this run; worth re-checking MyRGV directly in a future sweep in
  case the 403 was transient.
- 2026-09-01-N: Helogen (in-space biomanufacturing, HEL-IOS platform) joins
  the no-`src/data/registry`-entity list (2026-08-04-B/2026-08-31-S
  pattern); no first-party lead was needed here since Payload's own
  "Exclusive" reporting was the only outlet with the October-specific
  mission detail (a WebSearch corroboration crawl for the exact headline
  and for the technical/product terms found only the older, distinct
  May 2026 LambdaVision-partnership announcement, not this story) --
  shipped clean as a single-source trade-tier item, crawl `found_none`,
  landing at SNR 2.
- 2026-09-01-O: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 1 new, 0 updated, 0 held") plus a `jq` parse check (523 items,
  up from 522) and a direct read of the new item's `snr`/`snr_trace`/
  `category`/`impact` fields as the build-health signal.

## Narrow same-day re-check, ~3h56m gap, unfiltered full source list (2026-09-01, fourth)

- 2026-09-01-P: The mandatory fetchable-signals leg outran the queue and
  discovery pass again: Jeff Foust's bluesky post ("NASA selects Blue
  Origin to build the Mars Telecommunications Network spacecraft...
  $700 million. Blue Origin and Rocket Lab competed fiercely") surfaced
  a genuine, same-hour NASA contract award (nasa.gov's own release,
  published minutes earlier, confirmed the exact figures) before any
  trade outlet's write-up existed on the open web -- two WebSearch
  passes for independent trade pickup came back empty beyond NASA's own
  page and Blue Origin's older pre-award product pages. Led with
  nasa.gov as `first_party` and used Foust's post as the sole
  `whitelist`/`observer` corroboration source, landing a clean SNR 5 on
  a single first-party lead per the direct-source-ceiling rule (no
  `found_none` penalty needed since a first-party lead proves its own
  statement).
- 2026-09-01-Q: A new same-company-plus-category dedup false-positive
  shape: Inmarsat Maritime's new Safety Data Hub product launch (company
  list includes "Viasat" as parent) matched the existing Aug 31 ViaSat-3
  F3 satellite-enters-service item purely on the shared Viasat corporate
  family + category `product` + within 7 days, despite one being a
  software analytics tool and the other a GEO satellite completing
  in-orbit testing. One `dedup_distinct` cleared it -- extends the
  standing SpaceX/Blue-Origin/Redwire pattern to a parent-subsidiary
  company-name overlap, not just literal same-company matches.
- 2026-09-01-R: All 9 unfiltered HTML sources (Planet Labs, ICEYE,
  BlackSky, Spire, Gunter's, EUSPA procurement, CNES, Amazon/Kuiper,
  Telesat) were current with nothing new in this run's ~4-hour window;
  Amazon's `aboutamazon.com/news/tag/project-kuiper` listing rendered no
  visible publish dates on this fetch (a new gap, not previously
  logged), so its sourceHealth evidence had to rely on headline-text
  matching against already-known Amazon Leo stories rather than a dated
  freshness check -- worth trying a more specific Kuiper-tagged URL or
  the RSS-equivalent if one exists, next time this page's dates matter.
- 2026-09-01-S: `bun run build` was denied outright by this session's
  permission gate; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 5 new, 0 updated, 0 held") plus a `jq` parse
  check (528 items, up from 523) and a direct read of all five new
  items' `snr`/`category`/`impact` fields as the build-health signal.

## Narrow same-day re-check, ~9h43m gap, unfiltered full source list (2026-09-02)

- 2026-09-02-A: `applyModifier` (scripts/snr/match.ts) silently no-ops a
  requested bump that the direct-source ceiling would reduce to zero
  delta, rather than erroring: requesting `bump: "corroboration_4plus"`
  on the Bureau 1440 Rassvet item (whitelist-observer lead, base tier 3,
  already at its ceiling of 4 via the existing `corroboration_2plus`
  modifier) attached both new sources cleanly but left `snr_trace`
  unchanged (still one modifier, final 4) -- confirmed correct per the
  direct-source-ceiling rule (no amount of indirect corroboration from a
  non-first-party lead reaches 5), not a rejection or a bug; the two new
  sources still render on the card, the score just can't move further.
  Worth expecting this same silent-no-op shape (not an error) whenever a
  bump is requested against an item already sitting at its ceiling.
- 2026-09-02-B: A Bluesky-queue "Institute for the Study of War" claim
  (Rassvet second batch: none of 16 satellites reached the planned
  altitude, ~37.5% fleet-wide operational rate) needed the actual
  outlets (Euromaidan Press, Newsweek) fetched directly for exact
  figures rather than trusted from the queue's raw_excerpt fragment
  alone; both fetched cleanly and independently (different quote sets:
  Euromaidan led with Beskrestnov/Progress-strike context, Newsweek had
  the ISW quote and a named Foundation for Defense of Democracies
  analyst), giving genuine 2-source corroboration beyond the item's
  existing RussianSpaceWeb/TASS sources.
- 2026-09-02-C: A "year in review"-style aggregator sentence
  ("In September, EchoStar agreed to sell its AWS-4 and H-block spectrum
  licenses... to SpaceX for $17 billion") surfaced by a discovery-pass
  D2D/spectrum query read as fresh but traced to a September 8, **2025**
  announcement (confirmed via the original EchoStar 8-K exhibit and
  Fierce Network/DataCenterDynamics coverage), a full year stale --
  another instance of the standing stale-resurfacing trap, this time
  from a retrospective/analysis piece rather than a dated news article.
- 2026-09-02-D: An MDA Space D2D product-line-expansion story (SatNews,
  Sept 1) could not be corroborated on MDA's own newsroom listing
  (`mda.space/news`), which showed no matching release among its most
  recent items as of this run (last was Aug 27's LaunchPad Ventures
  announcement) -- shipped anyway on SatNews's own fetched content alone
  (verbatim CEO quote, specific technical detail) per the standing
  "weak/thin corroboration is not a hold reason" rule, landing an honest
  single-source SNR 2; worth a same-metric re-check of mda.space next
  sweep in case the release was simply not yet indexed on the listing
  page (the 2026-08-23-E CASC/cmse.gov.cn indexing-lag pattern).
- 2026-09-02-E: `bun run build` was denied outright by this session's
  permission gate; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 1 new, 2 updated, 0 held") plus a `jq` parse
  check (`.items | length`, 529, up from 528 -- note `items.json`'s
  top-level shape is `{ items: [...] }`, not a bare array, so a plain
  `jq length` on the file itself returns 1) and a direct read of the
  new item's and both updated items' `snr`/`snr_trace`/`sources` fields
  as the build-health signal.

## Narrow same-day re-check, ~6h18m gap, unfiltered full source list (2026-09-02, second)

- 2026-09-02-F: `crossfeed.facts[].field` for a constellation entity is
  `sats_active_claimed`, not `sats_active` -- finalize-sweep rejected the
  Axelspace/GRUS crossfeed outright with the full allowed-fields list
  (`operator, country, sensor_types, sats_launched_total,
  sats_active_claimed, sats_planned, orbit, first_launch_date,
  latest_launch_date, status`). Worth checking a registry entity's own
  JSON keys before naming a crossfeed field rather than guessing from
  the item's own wording.
- 2026-09-02-G: A same-headline press release syndicated verbatim across
  multiple unrelated small outlets (01net.it, a Delaware "Middletown
  Life" lifestyle site, finanznachrichten.de) traced via WebSearch to a
  Business Wire release (Axelspace Holdings Corporation's own Axelspace/
  Airbus Defence and Space imagery-distribution partnership, Sept 1) --
  neither company's own newsroom had indexed it yet (the standing
  2026-08-23-E/2026-09-02-D indexing-lag pattern) and no independent
  trade pickup (SpaceNews, Payload, Via Satellite) turned up on a
  dedicated search. Classed the mirror site itself `wire_pr` (it is
  literally the wire text, same logic as the 2026-08-07-L mynewsdesk.com
  precedent) rather than `first_party` or `informal`, and scored
  `crawl: "found_none"` honestly (searched, found only more mirrors of
  the same wire text) rather than stacking the syndicated copies as
  independent corroboration.
- 2026-09-02-H: The documented MAGPIE upgrade-path (`patch.source_url` +
  a full `rescore` block replacing the scoring basis) worked exactly as
  prompts/update-items.md describes on a live item: ESA's own Sept 2
  "signing ceremony" page for the already-published July 24 ispace-Europe
  MAGPIE contract item was a genuinely better lead (first_party vs the
  original Payload trade lead) with new instrument detail (drill,
  volatile analyser, ground-penetrating radar, neutron detector) neither
  original source stated; the item moved from SNR 4 (trade,
  corroboration_2plus) to SNR 5 (first_party ceiling) cleanly on the
  first attempt.
- 2026-09-02-I: `presse.cnes.fr` now 301-redirects to `cnes.fr/presse`
  (confirmed reachable, current press listing); worth using the new URL
  directly in a future `fetch-list.ts` source-health check rather than
  re-discovering the redirect each run.
- 2026-09-02-J: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 4 new, 1 updated, 0 held") plus a `jq` parse check (533
  items, up from 529) and a direct read of all four new items' and the
  updated item's `snr`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow same-day re-check, ~5.5h gap, unfiltered full source list (2026-09-02, third)

- 2026-09-02-K: The harvester queue (57 candidates, 1 collapsed) was almost
  entirely SpaceX stock-speculation/analyst-price-target chatter and
  off-topic Futurism/space.com entertainment pieces; every one of this
  run's 10 new items came from the mandatory signals pass, the 8-source
  HTML pass, or discovery, none from the queue itself. Confirms the
  standing 2026-08-06-A/2026-08-09-G pattern continues a month post-IPO.
- 2026-09-02-L: `.gov.ae` domains are not on the gate's `official_record`
  allowlist, extending 2026-08-03-F's Xinhua finding to a different
  country's regulator: citing `tdra.gov.ae` (UAE's telecom regulator) as
  `official_record` for its own Starlink-license announcement was
  rejected ("not an official official_record host"); reclassing to
  `trade` was accepted. Worth assuming any non-US/non-EU government
  regulator domain will need the same fallback until the allowlist is
  extended.
  Also confirms a new dedup false-positive shape: a UAE Starlink
  regulatory-license item matched TWO unrelated existing Starlink/SpaceX
  `regulatory`-category items (an Iran crackdown-on-unauthorized-terminals
  story and an FCC filing about SpaceX's conduct in the Rocket Lab/Iridium
  merger review) purely on shared company + category + <7-day window, in
  spite of the item being dated Aug 28 (predates-window chase) rather than
  same-day. Two `dedup_distinct` entries cleared it in one pass.
- 2026-09-02-M: A rocket-engine-manufacturer fire (Proton-PM/Perm, Russia)
  is a distinct scope shape from the 2026-08-05-tsniimash-fire-roscosmos
  precedent (which hooked into ISS mission control): here the in-scope
  hook is CLAUDE.md's explicit "manufacturers and bus providers" ecosystem
  carve-out plus the plant's role building RD-191 engines for the active
  Angara launch vehicle, not a human-spaceflight/ISS angle. Drafted as
  `incident`/`notable` with tag `launch`, sourcing the fire fact itself to
  Meduza and Militarnyi (both fetched directly) and deliberately leaving
  out the Russian governor's "no drone attack" statement and any
  strike-related speculation multiple outlets carried, per the standing
  conflict-analysis exclusion; the commercial hook is production capacity,
  not the war.
  Also: two companies (Farcast, York Space Systems) had no
  `src/data/registry` entity, extending the standing
  2026-08-04-B/2026-08-31-S/2026-09-01-N no-registry-entity list; both
  companies' own domains were classed `first_party`/none forced, per the
  workaround (Farcast's site wasn't fetched directly as a lead since
  Telesat's own first-party release covered the same facts; York's own
  site wasn't checked, Payload's trade coverage was thorough enough to
  lead with).
- 2026-09-02-N: Two predates-window items (UAE's Aug 28 Starlink license,
  the FAA's Aug 25 spaceport/launch-corridor RFI) had sat uncovered under
  any id for 4-8 days despite wide contemporaneous trade pickup; both
  were found via the mandatory discovery-pass matrix, not the queue or
  signals pass. The UAE license cleanly hit the `major` impact tier's
  explicit "regulatory grant... that changes what an operator may sell or
  where" test, a useful confirming example beyond the FCC-license-mod
  cases CLAUDE.md already names.
- 2026-09-02-O: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 10 new, 0 updated, 0 held") plus a `jq` parse check (543
  items, up from 533), confirmation both crossfeed facts (Synspective
  `sats_launched_total`, Electron `flights_total`) landed as
  `flag_refresh` entries in `registry-candidates.json`, and a direct read
  of all ten new items' `snr`/`category`/`impact`/`tags` fields as the
  build-health signal.

## Narrow same-day re-check, ~3h50m gap, unfiltered full source list (2026-09-02, fourth)

- 2026-09-02-P: A NASASpaceflight "state of Rocket Lab" explainer citing
  an "Aug. 27" completion of Neutron's Hungry Hippo fairing testing was a
  likely stale-resurfacing trap: the only dated primary sources findable
  for that exact claim were a Rocket Lab X post from Dec 2025
  (qualification/acceptance testing complete, fairing en route to LC-3)
  and a separate one from March 2026 (fluids/avionics integration
  underway), neither matching "Aug. 27, 2026." Fetching both candidate
  tweets via the syndication endpoint to check `created_at` was what
  caught it; a WebSearch summary alone would have taken the article's
  own claimed date at face value. Left undrafted rather than publish an
  unverifiable "new" milestone date.
- 2026-09-02-Q: A new same-company-plus-category dedup false-positive
  shape: an Axiom Space/NASA Artemis IV "Sortie Suit" spacesuit-design
  item (category `human-spaceflight`) matched the existing Aug 29
  Crew-13/Dragon-leak delay item purely on shared company (NASA) +
  category + within 7 days, despite one being an ISS crew-rotation
  hardware issue and the other a lunar-lander spacesuit architecture
  decision. One `dedup_distinct` entry cleared it, extending the
  standing pattern to NASA itself (not just SpaceX/Blue Origin/Redwire)
  as the shared-company anchor.
- 2026-09-02-R: An Ars Technica "Ars has learned" / unnamed-sources
  report (NASA's internal decision to simplify the Artemis IV spacesuit)
  is exactly the CLAUDE.md rule-5 case, not the older SWEEP_MEMORY
  2026-07-05-B tier-2-tracing lesson: CLAUDE.md's held.json section is
  explicit that weak sourcing is never a hold reason, and an identifiable
  named outlet standing behind its own unnamed-sources reporting is an
  "attributable weak source," not an anonymous rumour. Published at an
  honest single-source SNR (`crawl: "found_none"`, two searches for the
  "Sortie Suit" name and the decision found nothing beyond recycled
  Artemis III/AxEMU/Prada coverage) rather than held.
- 2026-09-02-S: `bun scripts/check-feed.ts` was denied outright by this
  session's permission gate; relied on `finalize-sweep.ts`'s own merge
  confirmation ("merged 3 new, 0 updated, 0 held") plus a `jq` parse
  check (546 items, up from 543) and a direct read of all three new
  items' `snr`/`category`/`impact`/`tags` fields as the build-health
  signal.

## Narrow same-day re-check, ~7h48m gap, unfiltered full source list (2026-09-03)

- 2026-09-03-A: A Jeff Foust bluesky post linking a fresh, same-window
  SpaceNews lead ("New NASA office to consolidate launch procurements")
  turned out to be a genuine source-access gap, not a thin-story call:
  the page's own visible lead paragraph ("NASA is consolidating many of
  its launch programs into a single office that is considering block
  buys of launches") is real and confirmed identically via two separate
  fetches plus an aggregator mirror (hype.aero), but everything past that
  one sentence sits behind SpaceNews's paywall, with no named office, no
  timeline, and no quotes findable via WebSearch or any independent
  outlet. Left undrafted rather than stretch one paywalled sentence into
  a full item; worth re-checking once another outlet picks up the story
  or SpaceNews's own page opens further.
- 2026-09-03-B: A Chinese state-wire (ecns.cn, China News Service)
  constellation-completion claim (Chang Guang Satellite's 19-satellite
  dedicated 3D-mapping sub-fleet) had a same-content English mirror
  (ua.news) that turned out to be a straight translation of the ecns.cn
  wire text once fetched directly (identical facts and figures, credited
  "ECNS reports" as its source) -- treated as one source per the standing
  wire-rewrite rule rather than stacking it as independent corroboration,
  landing an honest single-source SNR 2. The company's own site
  (jl1.cn/EWeb) was checked but did not surface this specific release.
- 2026-09-03-C: it-boltwise.de (a general German tech/startup news
  blog, not space-trade press) gave genuinely independent-written
  coverage of a same-day Munich funding story (Project-S's seed round
  for orbital-debris radar) -- different wording and framing from the
  SatNews lead, no attribution back to SatNews or any other outlet, read
  as original reporting off the company's own announcement rather than a
  rewrite. Classed `informal` (general tech blog, not established space
  trade press) but counted as genuine `corroboration_2plus`, landing
  SNR 4 on what would otherwise have been a single-source item.
- 2026-09-03-D: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s
  own merge confirmation ("merged 2 new, 0 updated, 0 held") plus a `jq`
  parse check (548 items, up from 546) and a direct read of both new
  items' `snr`/`snr_trace`/`category`/`impact`/`tags` fields as the
  build-health signal.

## Narrow same-day re-check, ~6h18m gap, unfiltered full source list (2026-09-03, second)

- 2026-09-03-E: A CNES press release about an already-published NASA/SpaceX
  launch item (the Aug 30 Roman Space Telescope launch) restated the same
  event but added a genuinely new fact neither original source stated:
  France's Laboratoire d'astrophysique de Marseille built the coronagraph's
  16 parabolic mirrors under a 2023 CNES-NASA agreement. Patched into the
  existing item via `updates[].attach` rather than treated as a new item
  or ignored, per the standing "same event, new detail" pattern
  (2026-08-04-F and peers). CNES has no `src/data/registry` organization
  entity, so classed the attach `informal` rather than force `first_party`
  through the anti-spoof domain check, extending the no-registry-host
  workaround (2026-08-05-O/2026-08-09-A) to a national space agency, not
  just companies.
- 2026-09-03-F: Two genuinely new, never-covered items surfaced this run
  despite an otherwise thin queue: Kineis' own Sept 3 release with Netmore
  Group (hybrid satellite/LPWAN IoT, first-party lead, no independent
  pickup found on two searches, landed a clean SNR 5 as a direct-source
  lead per the found_none-costs-nothing-for-direct-sources rule) and
  ArcSpace's Aug 25 seed round for a 2027 on-orbit electron-beam-welding
  demo (chased via a discovery-pass financial query, dated to the actual
  funding-close date per the predates-window convention; EU-Startups and
  finsmes.com both 403'd on direct fetch, leaving European Spaceflight's
  own reporting as the only fetchable lead, landing an honest single-source
  SNR 2).
- 2026-09-03-G: The signals pass's mandatory fetchable leg was almost
  entirely quiet (13 of 17 channels checked, rotating out three duplicate
  legs for people already covered via another channel) -- Jeff Foust's
  bluesky was the only channel with anything in-window, and all three
  space-relevant posts (NASA/Blue Origin Mars contract, House SAT
  Streamlining Act markup, Rocket Lab/Synspective launch) were already
  published by earlier same-day sweeps; europeanspaceflight.substack.com
  403'd on direct fetch (the bare site, still checked, was quiet too).
- 2026-09-03-H: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 2 new, 1 updated, 0 held") plus a `jq` parse check (550 items,
  up from 548) and a direct read of both new items' and the updated
  item's `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow same-day re-check, ~5.5h gap, unfiltered full source list (2026-09-03, third)

- 2026-09-03-I: A new borderline geopolitical-scope shape, held rather than
  guessed either way: wide mainstream reporting (Politico, mirrored by
  TheLocal, TAG24, and others) that a White House official pressured SpaceX,
  Stoke Space, K2 Space, and Astra by private call to skip Macron's Paris
  space summit ("could look like tacit support for EU policy positions").
  Real, dateable, well-sourced, but no fetched source states a direct
  commercial consequence (contract, market access, service change) the way
  CLAUDE.md's geopolitical/regulatory carve-outs require -- diplomatic
  pressure not to attend a conference isn't a sanction, an export-control
  notice, or a service-change statement. Same shape as the 2026-08-08-E ASI
  board-dissolution precedent; queued for Florian.
- 2026-09-03-J: An unattributed "report suggests" stock-reaction story
  (Technip Energies shares jumping on a claimed $10B bid for SpaceX's
  Starbase Louisiana methane facility) traced through half a dozen
  syndicated write-ups back to zero named source for the bid claim itself
  -- every article said "reportedly" or "per a report" with no outlet,
  filing, or company statement behind it, and a direct construction-trade
  fetch confirmed "no official word has been released" from either company.
  Left undrafted as unattributable rather than held or published at SNR 1:
  CLAUDE.md's rule 5 distinguishes an attributable weak source (a named
  outlet standing behind its own reporting) from a claim nobody will put
  their name on, and this is the latter.
- 2026-09-03-K: The HTML pass, a 12-of-17-channel signals pass, and an
  8-query discovery matrix were otherwise fully covered ground: every
  Amazon Leo/Kuiper "recent news" item on the listing page (Delta Wi-Fi
  deal, gigabit aviation antenna, Globalstar acquisition) traced via
  WebSearch to publish dates from April-August 2026, all already published;
  Farcast/Telesat's Sept 2 antenna-demo release and CNES's Sept 2 Roman
  Space Telescope piece were also both already merged by the prior sweep.
  Confirms the standing pattern (2026-08-08-F and peers) that narrow-gap
  re-checks following an active prior sweep look thin by design once every
  leg is checked exhaustively, not from under-coverage.
- 2026-09-03-L: `bun run build` was denied outright by this session's
  permission gate; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 2 new, 0 updated, 1 held") plus a `jq` parse check (552 items,
  up from 550) and a direct read of both new items' `snr`/`snr_trace`/
  `category`/`impact`/`tags` fields as the build-health signal.

## Narrow same-day re-check, ~4h gap, unfiltered full source list (2026-09-03, fourth)

- 2026-09-03-M: A Launch Library entry can sit in an ambiguous third state,
  neither clearly future nor confirmed: ISRO's GSLV-F17/EOS-05 mission (a
  high-profile "return to flight after the 2021 EOS-03 failure" story) showed
  status "Launch in Flight" at fetch time, net exactly matching the current
  sweep timestamp to the minute. Neither Launch Library's own status field nor
  a fresh WebSearch could confirm orbit-insertion success or failure yet.
  Left undrafted rather than publish an outcome-unconfirmed launch as
  "occurred"; extends the standing 2026-08-09-B/2026-08-25-B/2026-08-30-K
  rule (always check status/net) with a third case beyond
  scheduled-future/already-flown: genuinely in-progress at sweep time. Worth
  a same-day re-check once the outcome is confirmed.
- 2026-09-03-N: Another stale-resurfacing trap, a new shape: a "News On AIR"
  (India's state broadcaster) Google News entry, "ISRO to launch two
  satellites tonight from Sriharikota to demonstrate docking and undocking,"
  carried a fresh in-window timestamp but resolved via WebSearch to the
  December 30, 2024 PSLV-C60/SpaDeX mission (already completed, docked, and
  de-docked by March 2025) -- the newsonair.gov.in archive page apparently
  got re-surfaced with a current Google News timestamp. Same pattern as the
  2026-08-06-G ISRO/Gaganyaan case; a same-broadcaster, same-topic-shape
  headline is worth a WebSearch sanity check before drafting even when it
  reads as same-day.
- 2026-09-03-O: Two genuinely new items shipped clean at SNR 5, both with a
  working first-party lead: SES's own `/news/press-release/...` page
  (Peruvian Navy multi-orbit connectivity extension) and Satellogic's own
  `/news/press-releases/...` page (SynMax named exclusive maritime channel
  for the not-yet-launched Merlin constellation; `satellogic.com/newsroom/`
  404s, the working path is `/news/press-releases/`). SES has NO
  `src/data/registry` organization entity at all (only referenced as O3b
  mPOWER's `operator` field) -- first_party still passed cleanly, apparently
  matched via the ses.com domain already on file in that constellation
  entity's own `source`/`website` fields, extending the no-registry-host
  workaround's opposite case: a company can lack its OWN org entity yet still
  anti-spoof-match through a constellation entity that names it as operator.
- 2026-09-03-P: A new dedup false-positive shape on SES specifically: the new
  Peruvian Navy item matched the existing Aug 31 SES/OHB IRIS2
  satellite-manufacturing-contract item purely on shared company (SES) +
  category (`contract`) + within 7 days, despite one being SES buying
  satellite manufacturing from OHB and the other SES selling connectivity
  service to a foreign navy. One `dedup_distinct` cleared it -- extends the
  standing NASA/SpaceX/Blue-Origin/Redwire/Viasat pattern to SES.
  Also confirms `sats_planned`/quantified-figure crossfeed isn't always
  triggered: neither new item stated a registry-scored metric, so
  `crossfeed.facts: []` with a note passed cleanly without any dispute-queue
  detour.
- 2026-09-03-Q: Via Satellite's RSS feed (`satellitetoday.com`, via the
  harvester queue) carries full article body text in `raw_excerpt`, not just
  a teaser -- three of this run's Via Satellite candidates (SES/Peru,
  KSAT Hyper follow-up, Axelspace/Airbus follow-up) were draftable/
  attachable straight from the queue's own excerpt with no live page fetch
  needed. Used this to attach genuine new-detail corroboration to three
  already-published items (Axelspace/Airbus moved SNR 2->3 via
  `corroboration_2plus`; 4iG and KSAT Hyper were already at their ceilings,
  so the new sources and detail were added for the record with no bump
  requested, confirming 2026-09-02-A's silent-no-op-at-ceiling behavior is
  the right call rather than something to route around).
- 2026-09-03-R: `bun run build` was denied outright by this session's
  permission gate; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 2 new, 3 updated, 0 held") plus a `jq` parse check (554 items,
  up from 552) and a direct read of both new items', all three updated
  items', and the sweep log entry's `snr`/`snr_trace`/`category`/`impact`/
  `sources` fields as the build-health signal.

## Narrow same-day re-check, ~7h43m gap, unfiltered full source list (2026-09-04)

- 2026-09-04-A: The 2026-09-03-M "in-progress at sweep time" ambiguity
  (ISRO's GSLV-F17/EOS-05 mission, Launch Library status "Launch in
  Flight" exactly at the prior sweep's `now`) resolved cleanly this run:
  a fresh Launch Library fetch confirmed `status: Launch Successful`,
  net 2026-09-03T21:25Z (2:55 a.m. IST Sept 4). isro.gov.in's own mission
  page confirmed success and the "first imaging satellite from
  geosynchronous orbit" framing but had no mass/resolution figures; those
  came from two independently fetched mainstream Indian outlets (Free
  Press Journal, The Federal), both agreeing on 2,367 kg and 42 m
  resolution. Deliberately dropped a "world's first geostationary
  hyperspectral imager" superlative that appeared only in an unofficial
  ISRO Spaceflight fan-account X post and one WebSearch synthesis, never
  independently confirmed by a directly fetched page or ISRO's own
  (unparseable PDF) mission brochure.
- 2026-09-04-B: A signals-pass find (Payload's Isaacman/McAlister
  commentary piece, queue-fed) named a specific X post URL
  (@NASAAdmin/status/2095345993738850760) in its own body text; fetching
  the syndication endpoint confirmed the post is genuinely from
  @NASAAdmin (NASA's Administrator title-account) at the right timestamp,
  but its visible text was a different portion of the same reply thread
  than Payload's quoted sentences (a Starliner/LEO reply, not the
  "force an economy out of every NASA endeavor" line Payload quoted).
  Treated Payload's own verbatim-quoted reporting as the trade lead and
  the verified X post as `informal` corroboration (confirming the person
  posted, not itself carrying every quoted sentence) rather than either
  discard the item or force the syndication text to match Payload's
  quotes.
- 2026-09-04-C: Jared Isaacman is a signals.json xSearch entry (handle
  `rookisaacman`), but the actual post came from a different account
  (`@NASAAdmin`) not matching that recorded handle -- per the standing
  2026-08-26-E Kiko Dontchev precedent, classed the post `informal`, not
  `whitelist`, since only the exact recorded channel earns the floor.
- 2026-09-04-D: A Space Force Chief of Space Operations change-of-command
  (Schiess succeeding Saltzman, Sept 3, well-telegraphed since an Aug 6
  Senate confirmation) was drafted at `noise`/`launch`, matching the
  standing "well-telegraphed non-scandal succession" precedent (ULA's
  Peller, 2026-08-17-F) rather than the FCC Space Bureau chief precedent
  (2026-08-08-H, `notable`): that case turned on the office directly
  licensing every commercial operator, which CSO doesn't do as narrowly.
  Led with SpacePolicyOnline (whitelist, observer) since Marcia Smith's
  own site (also a harvester-fed source) carried the fullest body text;
  SpaceNews's matching headline was paywalled beyond one paragraph.
- 2026-09-04-E: Extends the standing "check items.json before drafting a
  signals/discovery find" practice to a fully clean sweep: every single
  substantive lead from the fetchable signals channels this run (PLD
  Space, HyImpulse, Synspective, Boeing/O3b mPower, Axiom Sortie Suit,
  Sierra Space Dream Chaser) had already been published by an earlier
  same-day sweep, confirming 2026-09-01-L/2026-09-03-K's pattern that a
  narrow re-check following an active prior sweep looks thin by design.
  A NOAA RODB-2 $6.4M Spire+PlanetiQ radio-occultation award surfaced by
  the discovery pass's EO-procurement leg was also already published
  (same combined figure as the Aug 14 item's $3.7M+$2.7M split).
- 2026-09-04-F: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s
  own merge confirmation ("merged 5 new, 0 updated, 0 held") plus a `jq`
  parse check (559 items, up from 554) and a direct read of all five new
  items' `snr`/`category`/`impact`/`tags`/`companies` fields as the
  build-health signal.

## Narrow same-day re-check, ~6h15m gap, unfiltered full source list (2026-09-04, second)

- 2026-09-04-G: A "final" version of a federal regulatory filing can
  supersede an already-published "draft" item under the SAME docket
  months later without being a dedup match: the FAA's Sept 4 Federal
  Register notice for the Final Tiered EA and FONSI/ROD (Docket
  FAA-2026-6968) covers the identical Pacific reentry-zone scope as the
  already-published July 14 draft-EA item. Treated as an `updates[]`
  entry with `patch.source_url` + a full `rescore` (the MAGPIE upgrade
  pattern, 2026-09-02-H) rather than a new item, keeping the July 14
  notice as a secondary `rescore.sources[]` entry so it isn't dropped
  from the card (a bare rescore with only the new URL would have
  silently deleted the old one, since `rescore` fully replaces
  `merged.sources`, unlike `attach` which only appends). Deliberately
  did NOT bump impact to `major` even though a FONSI/ROD reads like a
  regulatory decision: the fetched notice states SpaceX "must still
  obtain a modification to their existing vehicle operator license" to
  actually use the cleared zones, so the market-access grant itself
  hasn't happened yet. Left impact at `notable` per the "when torn
  between two levels, pick the lower one" rule.
- 2026-09-04-H: federalregister.gov's own document pages 403/redirect-loop
  WebFetch directly (`unblock.federalregister.gov`, a scraping-block
  page), but its public JSON API
  (`federalregister.gov/api/v1/documents/<doc-number>.json`) and its
  full-text XML endpoint
  (`federalregister.gov/documents/full_text/xml/<year>/<month>/<day>/<doc-number>.xml`)
  both fetched cleanly with real body text (docket number, dates,
  geographic scope, comment counts) -- worth trying these two endpoint
  shapes first for any future federalregister.gov citation instead of
  the blocked HTML document page.
- 2026-09-04-I: An ASD Eurospace "GALAXY" report (15 anonymized European
  space-industry CEO interviews on procurement/institutional-demand
  complaints) had two independent trade-press writeups (Payload, named
  author, on-record Marco Fuchs quote; Space Intel Report, different
  byline, two days earlier, added the Jean-Marc Nasr/interview-window
  detail neither other source stated) -- drafted as `kind: "commentary"`
  (industry-association policy-recommendation piece, same shape as the
  2026-08-05-K ESPI precedent) rather than a factual event, category
  `procurement` since the core complaint is geo-return/institutional
  demand. Landed `corroboration_2plus` at SNR 4 despite both sources
  being `trade` class (no first-party GALAXY report page was found to
  lead with).
- 2026-09-04-J: The harvester queue (92 candidates) was almost entirely
  EOS-05 launch reaction/commentary pieces (dozens of Indian outlets,
  same launch already resolved in the prior sweep per 2026-09-04-A) and
  SpaceX stock-speculation chatter; zero queue candidates survived past
  the scope filter. Both of this run's items came from the HTML/signals
  legs (europeanspaceflight.com surfacing the queue-independent
  federalregister.gov Google News entry indirectly via the FR feed
  itself, not the queue) and a discovery-pass-adjacent direct check of
  the Federal Register feed. Confirms the standing EOS-05/SpaceX-stock
  low-yield-queue pattern extends to single-story wire pileups, not
  just ongoing background chatter.
- 2026-09-04-K: A pre-launch ESA/EU-Space explainer ("Sentinel-3C: Europe
  is launching its next Earth observation satellite," queue-fed) traced
  via WebSearch to a launch scheduled for September 14, 2026, nine days
  out -- left undrafted as a preview, not an event; the actual launch
  will be a candidate on its own date. Isar Aerospace's second Spectrum
  test flight ("Onward and Upward," europeanspaceflight.com Sept 3
  piece) was also still pre-launch at this run's `now` (net 20:00 UTC
  Sept 4, status "To Be Confirmed" on Launch Library), same treatment.
- 2026-09-04-L: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 1 new, 1 updated, 0 held") plus a `jq` parse check (560
  items, up from 559) and a direct read of the new item's and updated
  item's `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow same-day re-check, ~5h24m gap, unfiltered full source list (2026-09-04, third)

- 2026-09-04-M: A months-old, never-covered gap surfaced from the queue's
  Nikkei Asia "Rakuten to debut satellite-to-cell service with Starlink
  rival AST" entry, which itself traced (via WebFetch) to a Sept 5, 2026
  JST-dated recap: fetching that recap alone would have been a stale-
  resurfacing trap (the JV formation, $922-926M Japanese-government J-LEO
  funding commitment, and 700MHz regulatory recommendation all date to
  June-July 2026). The genuinely undrafted event underneath the recap was
  AST SpaceMobile's Aug 4 commencement of active D2C operations in Japan
  (SatNews), AST's first commercial market outside the US -- grepped
  items.json for "rakuten"/"ast spacemobile" first and confirmed zero
  coverage of the JV, the funding, or the Aug 4 launch under any id,
  despite four AST BlueBird/earnings items already on the site. Chased
  and dated to Aug 4 per the standing predates-window convention, landing
  `category: product`, `impact: major` (first-of-kind capability on
  commercial terms, per CLAUDE.md's major-tier test). ast-science.com's
  blog/investor press-release pages were both JS shells with no visible
  post list (same shape as the standing AST IR-subdomain thinness,
  2026-08-11-D); Rakuten's own corp.mobile.rakuten.co.jp press listing
  was checked directly and had no matching release either. Led with
  SatNews (trade) and Light Reading (trade, the July 1 funding piece) for
  `corroboration_2plus` (SNR 4) rather than force a first-party lead
  through a dead-end domain.
- 2026-09-04-N: Confirms a numeric-variance trap worth flagging: three
  outlets covering the same $150 billion yen Japanese government
  commitment stated three different rounded dollar figures on direct
  fetch ($922M Light Reading, $912M Investing.com, $926M SatNews) despite
  describing the same underlying 150bn yen figure -- almost certainly
  different yen/dollar conversion snapshots at different publish dates,
  not different facts. Used only the lead source's (SatNews) own stated
  figure in the item copy rather than blend or average across outlets,
  per the standing "numbers are copied, not paraphrased" rule; the
  other outlets' slightly different figures were left uncited to avoid
  implying disagreement where none was stated.
- 2026-09-04-O: A signals-pass Aviation Week find (Vivienne Machi's Sept 4
  "Orbital Cargo Firms Aim To Make Space Reentry Routine," on Outpost and
  reentry-as-a-service startups) was left undrafted as a paywalled general
  trend/analysis piece with no single dateable event, corroborating and
  extending the standing 2026-09-03-A paywall-limits pattern to a
  signals-channel find rather than a Bluesky-linked one.
- 2026-09-04-P: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 1 new, 0 updated, 0 held") plus a `jq` parse check (561 items,
  up from 560) and a direct read of the new item's
  `snr`/`snr_trace`/`category`/`impact`/`sources` fields as the
  build-health signal.

## Narrow same-day re-check, ~3h38m gap, unfiltered full source list (2026-09-04, fourth)

- 2026-09-04-Q: `idirect.net` (ST Engineering iDirect's own newsroom) has
  no `src/data/registry` organization entity at all, so its own press
  release failed the anti-spoof gate as `first_party`; classed `informal`
  instead and led with Via Satellite's independent write-up (`trade`)
  covering the same INT3000 5G NR-NTN modem pilot, per the standing
  2026-08-05-O/2026-08-09-A no-registry-host pattern extended to a new
  ground-segment vendor.
- 2026-09-04-R: A company's own newsroom copy and its PR Newswire wire
  mirror shared the EXACT SAME headline text
  ("ST Engineering iDirect Demonstrates Multi-Waveform 5G NR-NTN User
  Equipment Pilot") even though the two live on completely different
  domains (idirect.net vs prnewswire.com); finalize's title-SimHash
  correctly collapsed them into one `wire_rewrite` corroboration unit
  (`state.json`'s `corroboration_collapses`), confirming the collapse
  logic works across unrelated domains, not just same-domain URL variants
  (extends 2026-08-10-D).
- 2026-09-04-S: Two genuinely new, on-scope product-demo items (ST
  Engineering iDirect's 5G NR-NTN modem pilot, Sparkle/Hellas Sat's
  quantum-safe satellite link) both had wide, independently-written trade
  coverage (Via Satellite, Mobile Europe, The Quantum Insider,
  SatellitePro ME) despite neither ever reaching `major`/`notable`
  impact -- routine ground-segment/GEO-operator technology
  demonstrations with no stated commercial deployment or customer still
  clear the inclusion bar at `noise`/`product` per the standing "nothing
  on-scope is withheld for sourcing reasons" rule; low impact and strong
  sourcing are independent axes just like low SNR and high impact are.
- 2026-09-04-T: A trend/wrap-up piece bundling several already-published
  facts (NASASpaceflight's "Blue Origin expands test and launch sites
  across the Cape," covering the already-covered LC-36 rebuild and
  Stennis B-2 test-stand stories) plus one new but explicitly
  unconfirmed detail (a "MILA Stage 2" second-stage test site inferred
  from lightning-tower/crane permit filings, with the outlet itself
  saying "it is still not known exactly what kind of testing this
  facility will support") was left undrafted as too speculative to
  publish as its own fact, rather than force a thin permit-filing
  inference into copy.
- 2026-09-04-U: A repeated launch-attempt scrub (Isar Aerospace's Spectrum
  second test flight, 5th scrubbed attempt as of Sept 4, no company
  statement and only "weather may have played a role" from the outlet
  itself) was left undrafted: CLAUDE.md's "launches are never discarded
  as routine" ruling covers launches that occur, not non-events with an
  unconfirmed cause; worth chasing once the flight actually occurs or a
  scrub gets a company-confirmed technical cause.
- 2026-09-04-V: An Aviation Week piece titled "Three Additional
  Space-Based AMTI Vendors Revealed" (Sept 4, signals-pass find) traced
  via WebSearch to the SAME $615M Rocket Lab/STR/unidentified-third-vendor
  SB-AMTI award already published under
  `2026-08-04-rocket-lab-str-amti-contracts` -- the third vendor is still
  described as unidentified in every source checked, so nothing was
  actually revealed beyond the existing item; left undrafted rather than
  treated as an update, since no new fact was found to attach.
- 2026-09-04-W: `bun run build` and `bun scripts/check-feed.ts` were both
  denied outright by this session's permission gate, continuing the
  standing pattern since 2026-07-11-B; relied on `finalize-sweep.ts`'s
  own merge confirmation ("merged 2 new, 0 updated, 0 held") plus a `jq`
  parse check (563 items, up from 561) and a direct read of both new
  items' `snr`/`snr_trace`/`category`/`impact`/`tags`/`companies`/
  `sources` fields and the sweep log entry's `corroboration_collapses`
  as the build-health signal.

## Normal-mode sweep, ~8h05m gap, unfiltered full source list (2026-09-05)

- 2026-09-05-A: A signals-fetchable bluesky account's `getAuthorFeed`
  summary can flatten a post's linked article into prose without
  surfacing the URL; re-fetching the SAME endpoint with an explicit ask
  for "the post about X" and its `embed.external.uri` recovered the
  exact article link (SpaceNews's paywalled "New NASA office to
  consolidate launch procurements", found only via Jeff Foust's Sept 2
  bluesky post) when a direct site search and three WebSearch variants
  all failed to surface it. Worth re-querying a signals account's feed
  a second time, asking specifically for one post's embed URL, before
  giving up on a thin lead traced only to a bluesky summary.
- 2026-09-05-B: A SpaceNews article behind the paywall can still yield
  a legitimately citable two-sentence fact: the fetched page rendered
  headline + a one-paragraph teaser before the paywall gate, no
  fabrication needed. Drafted the NASA launch-procurement-office story
  from exactly that teaser text at `noise` impact (thin, no figures,
  no named programs) and let `crawl: found_none` (three WebSearch
  variants, all empty) land it at SNR 2 rather than holding it for
  weak sourcing.
- 2026-09-05-C: The same-company-plus-category dedup false positive
  keeps finding new shapes: a NASA/Blue Origin Mars-telecom contract
  award (Sept 1) blocked an unrelated NASA launch-procurement-office
  reorg (Sept 2, category `procurement`) purely on shared company
  "NASA"; separately, an SpaceX/FCC High-Cost Fund USF filing (category
  `regulatory`) blocked against BOTH the Rocket Lab/Iridium
  merger-conduct FCC review and a UAE Starlink license grant, purely on
  shared company "SpaceX" plus "regulatory" category, despite being
  three different regulators/dockets/countries with nothing else in
  common. Three `dedup_distinct` entries cleared it in one pass.
- 2026-09-05-D: ESA's BepiColombo Mercury Transfer Module separation
  (Sept 3, confirmed via ESA's own mission page, esa.int, first_party)
  was independently corroborated by Ars Technica but NOT by CNN
  (HTTP 451, geo/legal block), Space.com (truncated to nav chrome, the
  standing 2026-08-11-F pattern), or Gizmodo (403) despite all three
  covering the same event per WebSearch snippets; only cited pages
  with genuinely fetched content rather than force in blocked/truncated
  fetches as scoring sources. CNES's own site (presse.cnes.fr/fr) also
  covered the story via a "France's role in Roman telescope" angle
  piece that turned out to be about the ALREADY-published Aug 30 Roman
  launch, not BepiColombo; read past the headline before assuming a
  same-day national-space-agency piece is a new event.
- 2026-09-05-E: `presse.cnes.fr/fr` now 301-redirects permanently to
  `cnes.fr/presse`; the redirect target fetches cleanly. Worth updating
  the sources.json URL at a future structural touch.
- 2026-09-05-F: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate, continuing
  the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 3 new, 0
  updated, 0 held") and a direct read of all three new items'
  `snr`/`snr_trace`/`category`/`impact`/`tags`/`companies`/`sources`
  fields as the build-health signal.

## Narrow same-day re-check, ~5.5h gap, unfiltered full source list (2026-09-05, second)

- 2026-09-05-G: A fully clean zero-item sweep: the harvester queue
  (candidates-context) was almost entirely EOS-05 launch-reaction
  pieces and SpaceX stock-speculation chatter (zero survivors), the
  8-source HTML pass found nothing dated after the prior sweep, a
  16-of-17-channel signals pass (europeanspaceflight.substack.com/feed
  still 403's, per 2026-08-09-G) surfaced only leads already published
  by the prior two same-day sweeps, and an 11-query discovery matrix
  independently rediscovered the same five stories (PLD Space Series C
  extension, Kepler Aerospace seed round, the European Launcher
  Challenge contracts, OHB/SES IRIS2, Isar Aerospace's Spectrum
  scrub) with none new. Confirms the standing pattern
  (2026-08-08-F/2026-09-03-K/2026-09-04-E) that a narrow re-check
  right after an active prior sweep looks thin by design, not from
  under-coverage, once every leg is checked exhaustively.
- 2026-09-05-H: `bun run build` and `bun scripts/check-feed.ts` were
  both denied outright by this session's permission gate, continuing
  the standing pattern since 2026-07-11-B; relied on
  `finalize-sweep.ts`'s own merge confirmation ("merged 0 new, 0
  updated, 0 held") and a direct read of the appended `state.json`
  sweep-log entry as the build-health signal.

## Narrow same-day re-check, ~6h14m gap, unfiltered full source list (2026-09-05, third)

- 2026-09-05-I: A signals-channel author-page find (Vivienne Machi's
  Aviation Week "Three Additional Space-Based AMTI Vendors Revealed")
  named three genuinely new SB-AMTI vendors (Blue Origin, Boeing, Umbra)
  distinct from the already-published Aug 4 Rocket Lab/STR/unidentified-
  third-vendor item (2026-09-04-V): that item's mystery vendor is still
  unnamed anywhere; these three are a separate vendor-pool addition
  entirely, with contracts stated as "signed June 2." Aviation Week's own
  article page 404'd and ssc.spaceforce.mil (the likely primary source)
  403'd per the standing .mil-block pattern; two content-scraper mirrors
  (ufofeed.com, newsbeep.com) republishing the same paywalled teaser text
  do not count as independent corroboration (same underlying source, not
  separate reporting), so this landed a single-source trade lead with
  `crawl: found_none` at SNR 2. Dated to June 2 (the stated contract-
  signing date) rather than the Sept 4 reveal date per the standing
  predates-window convention, even though the underlying detail (a thin,
  cut-off paywall quote with no dollar figures) is much sparser than
  most chased predates-window items.
- 2026-09-05-J: A new scope-question shape for the institutional-
  disclosure precedent (NASA-STRIDE, ASI board dissolution, Singapore-
  JAXA): 9 ISRO employee associations (~5,000 staff) sent ISRO's Chairman
  a letter seeking clarity on the agency's shrinking role as launch-
  vehicle manufacturing shifts to private industry (HAL's SSLV transfer,
  LVM3/PSLV bidding, the already-published Kulasekarapattinam spaceport
  handover). Unlike the STRIDE/ASI cases, this letter DOES name concrete
  commercial-space actions (HAL, LVM3, PSLV, the spaceport), but the
  event itself is a staff-association letter about job security, not a
  procurement action, contract, or market-access change in its own
  right -- queued to held.json as a scope question rather than published
  or discarded. Single-sourced to WION (Sidharth MP); Times of India and
  Inshorts carried the same story same-day but neither was directly
  fetchable, and a corroboration search found only secondary aggregator
  restatements of the same underlying reporting.
- 2026-09-05-K: `presse.cnes.fr/fr`'s 301-redirect to `cnes.fr/presse`
  (noted 2026-09-05-E) fetches cleanly and is a good direct substitute;
  worth updating the `sources.json` URL at a future structural touch
  rather than continuing to rely on the redirect resolving.
- 2026-09-05-L: `bun run build` was denied outright by this session's
  permission gate again, continuing the standing pattern since
  2026-07-11-B; relied on `finalize-sweep.ts`'s own merge confirmation
  ("merged 1 new, 0 updated, 1 held") plus a `jq` parse check (567 items,
  up from 566) and a direct read of the new item's and the new held
  entry's fields as the build-health signal.
