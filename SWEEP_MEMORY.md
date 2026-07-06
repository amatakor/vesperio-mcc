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

## Task 13 registry fill crawl (2026-07-05)

- 2026-07-05-K: Launch Library API versioning. 2.2.0 `/launches/` list
  endpoints return 404; use 2.3.0 for launch lists. 2.2.0
  `/config/launcher/` pages still resolve. Unauthenticated rate limit is
  ~15 req/hr, so fetch bulk snapshots once and work from the saved file
  instead of per-entity calls.
- 2026-07-05-L: Launch Library location records carry an `active: true`
  database boolean. It is NOT a stated operational status; never publish
  it as a status value.
- 2026-07-05-M: Collector agents repeatedly inferred `country` from city
  names or office addresses. A country field needs the country name
  literally stated on the cited page.
- 2026-07-05-N: Collector agents sometimes fabricate plausible quotes
  (caught on astroscale, unseenlabs, starlink, and JAXA pages, plus an
  invented full date for Uchinoura's 1970 launch against a year-only
  source). Adversarial re-fetch verification against every cited source
  is mandatory before publishing crawled facts.
- 2026-07-05-O: Unreachable-from-fetcher sites this run: fcc.gov
  (timeouts, even via curl), Space Force *.spaceforce.mil (403),
  rocketlabusa.com (403), orbex.space (502), he360.com, ghgsat.com,
  starlink.com (JS app). unoosa.org needs a browser user agent via curl.
- 2026-07-05-P: Redirects and rebrands: maxar.com redirects to
  vantor.com (Vantor rebrand); oneweb.net redirects to eutelsat.com;
  Amazon now calls Kuiper "Amazon Leo" on official pages.

## Filtered-source sweep, 08:58-18:07 UTC window (2026-07-05)

- 2026-07-05-Q: Scope judgment call: excluded a SpaceNews report on ESA
  authorizing Airbus to begin Aeolus-2 wind-lidar satellite development
  (EUR51M initial phase, 2034 target launch). It satisfies the letter of
  "government procurement of commercial space services" and Airbus is a
  tracked source, but it reads as legacy institutional weather-science
  procurement via a heritage prime, not a new-space-economy event in the
  spirit of the site (contrast with the Portugal/Norway ICEYE deals,
  which are agile-constellation operators winning sovereign contracts).
  Flag for Florian if that read is wrong; if it recurs, worth an explicit
  scope note for ESA/Eumetsat Earth-science procurement via legacy primes.
- 2026-07-05-R: SEC EDGAR atom feeds need a real contact-style
  User-Agent ("VesperioMCC-Sweep contact@vesperio.ai"); a bare product
  token without contact info (e.g. just "VesperioMCC-Sweep/1.0") still
  gets a 403 "Undeclared Automated Tool" page even though it looks like
  a User-Agent is set.
- 2026-07-05-S: A short, narrow re-check window (same-day, ~9 hours
  since the last sweep) against a small filtered source list is a
  legitimate sweep shape distinct from the 30-day backfill runs earlier
  today; all 12 named sources came back unchanged from the prior run
  except one fresh SpaceNews story, and zero items shipped. A quiet
  sweep with a documented scope call is a valid outcome, not a gap in
  coverage.

## Deep registry crawl (2026-07-05, second session)

- 2026-07-05-Q: WebFetch returns summarized page text; "verbatim" quotes
  drawn from it can be paraphrase. Verification must re-check against the
  live page, and collectors must not trust the summarizer's wording for
  quote fields (this systematically broke Sentinel operator quotes).
- 2026-07-05-R: More collector traps that recur: byline-relative dates
  ("yesterday", "today") are not calendar dates; press-release publication
  dates are not always the event date; state-media pages often state only
  a weekday, day precision needs the dateline to corroborate; "optical"
  must not be asserted when a page only says panchromatic/multispectral;
  " (per [outlet])" belongs only on true trade-press citations, not a
  company's own release.
- 2026-07-05-S: Fetchable-outlet map for this network: Payload, Via
  Satellite, The Register, TechCrunch (mostly), Reuters (sometimes),
  IonQ/Amazon newsrooms, telesat.com, capellaspace.com, astroscale.com,
  isaraerospace.com, rfa.space, stokespace.com, fireflyspace.com load;
  blueorigin.com 429s; rocketlabusa/corp.com, spaceforce.mil, SEC EDGAR,
  fcc.gov, pib.gov.in 403/timeout; spacenews.com 429s under load;
  businesswire times out; ghgsat.com/he360.com/oqtec unreachable.
- 2026-07-05-T: Launch Library /2.3.0/agencies/ records (founding_year,
  description, country, info_url) are an eligible structured-data source
  that fills org fields when corporate sites block fetchers; featured=true
  returns the majors in one request.
- 2026-07-05-U: Concurrency: ~25 simultaneous agents triggered server-side
  API rate limiting that killed nearly a whole fan-out. Keep waves at 3-5
  agents; forbid sub-agent spawning in collector prompts explicitly.

## Timeline batch, fleet/IoT constellations (2026-07-06)

- 2026-07-06-A: Verifier gap: adversarial verifiers checked facts, dates,
  and quotes against live pages but did not check OUTLET ELIGIBILITY, so
  Wamda and Startup Daily events (not on the trade-press list) passed
  verification and had to be caught in orchestrator editorial review.
  Verify prompts must name the closed outlet list explicitly.
- 2026-07-06-B: Batch targeting: assign crawl entities from the
  missing-data scan, not from a domain listing; kineis and astrocast
  already had events (deep crawl 07-05) and two agents collected and
  verified them for nothing. merge-events.ts's already-has-events guard
  caught it, but the tokens were spent.
- 2026-07-06-C: kineis.com and astrocast.com WERE reachable this run,
  contrary to the 07-05 unreachable note; anti-bot walls come and go,
  so collectors should always try the primary site once before falling
  back to trade press.

## Narrow same-day re-check, 12-source filtered list (2026-07-06)

- 2026-07-06-D: iceye.com/press now 301-redirects (bare curl without
  -L returned 301, not 200); `curl -sL` resolves it cleanly to 200.
  Use -L by default for iceye.com going forward.
- 2026-07-06-E: A short same-day re-check window (~15 hours since the
  last sweep) against the 12-source filtered list again produced
  mostly unchanged sources (all 6 SEC 8-K feeds, Planet Labs, ICEYE,
  Rocket Lab, European Spaceflight, Launch Library) plus exactly one
  fresh SpaceNews item (NASA-SBA capital partnership, published inside
  the window). Confirms the 07-05-S pattern: a narrow filtered re-check
  is a legitimate sweep shape and a single-item outcome is normal, not
  a sign of under-coverage.
