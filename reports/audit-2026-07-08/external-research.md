# External Data Source Research — Mission Control Center (mcc.vesperio.ai)

Compiled 2026-07-08. Budget frame: free to ~$100/month total spend across all paid sources. Method: WebSearch (primary) plus a small number of direct fetches to verify pricing/policy pages. Anything not independently fetched and confirmed is marked **[unverified — search snippet only]**. Facts confirmed by direct fetch are marked **[fetched]**.

---

## 1. News source ecosystem

### 1.1 US / English-language trade press (RSS)

| Source | Feed / URL | Free? | Machine-readable? | Update cadence |
|---|---|---|---|---|
| SpaceNews | `https://spacenews.com/feed/` | Yes | RSS | Several posts/day — direct fetch of this URL timed out during this research session, so treat as **[unverified — search snippet only]** despite being a very well-known, long-standing feed. Verify with a `curl`/HEAD request before wiring it in. |
| Payload Space | No public RSS found; distribution is via daily email (payloadspace.com/subscribe) and the Payload Pro newsletter hub (pro.payloadspace.com). **[unverified]** | Free (daily newsletter), Payload Pro/Research is paid | Email-native, not confirmed RSS | Daily M-F ~9am ET |
| Via Satellite / Satellite Today | satellitetoday.com — site has multiple category RSS feeds (Via Satellite, Launch, Telecom, Broadcasting, Government, etc.) per Feedspot listing; exact `/feed` paths not individually confirmed. **[unverified]** | Yes | RSS (per category) | Daily |
| SpacePolicyOnline.com | No confirmed feed URL found in search; site likely has one at a conventional `/feed` path but this was not confirmed. **[unverified]** | Yes (site is free) | Unconfirmed | Frequent, policy-focused |
| NASASpaceflight.com | Site states its news is "syndicated via Google, Yahoo, and RSS" but the exact feed path wasn't surfaced by search. **[unverified]** | Yes | RSS (unconfirmed exact URL) | Very high (multiple/day), forum content separate from news |
| European Spaceflight | No feed confirmed via search; site exists (europeanspaceflight.com) and is a commonly cited source in other trackers' source lists, but no RSS URL was surfaced. **[unverified]** | Presumed yes | Unconfirmed | Several/week |
| SpaceflightNow | Appears in Feedspot's space RSS listing as an established feed source. **[unverified — search snippet only]** | Yes | RSS | Daily |
| The Space Review | Appears in Feedspot listing, in-depth policy/analysis pieces. **[unverified]** | Yes | RSS | Weekly |

**Action item:** none of the trade-press RSS URLs above except the SEC/FCC/arXiv/government feeds were independently fetched and confirmed live in this session. Before wiring any into the ingestion pipeline, do a one-time `curl -I` / feed-validator pass (e.g. via W3C feed validator or a simple HTTP GET) to confirm the exact path and that it 200s.

### 1.2 Newsletters (email-native, not machine-readable as RSS)

- **Payload** (daily, free) — payloadspace.com/subscribe. No confirmed RSS; would require an email-to-feed bridge (e.g. Kill-the-Newsletter) if machine ingestion is wanted.
- **The Orbital Index** — confirmed **discontinued**: the newsletter "ended weekly publication on Jan 7, 2026" per search results. Do not build around it; useful only as a historical archive (GitHub repo `orbitalindex/orbital-index`) for methodology reference (see Section 4).
- TLDR-style aggregator newsletters for space specifically were not clearly identified beyond Payload; general TLDR.tech does not appear to run a dedicated space vertical as of this search.

### 1.3 Press-release wires

| Source | Access | Notes |
|---|---|---|
| Business Wire | RSS/Atom feeds, customizable by ~250 subject/industry keywords, per businesswire.com/help/feed-options | Free to consume; aerospace industry landing page exists at businesswire.com/newsroom/industry/manufacturing/aerospace |
| PR Newswire | RSS feed hub at prnewswire.com/rss/, plus a dedicated Aerospace & Defense news-release list (prnewswire.com/news-releases/heavy-industry-manufacturing-latest-news/aerospace-defense-list/) | Free, RSS |

These wires are useful for catching first-party press releases (satisfies the "first-party / official record" SNR-5 sourcing requirement) directly from company newsrooms, and are a good complement to a company's own investor-relations RSS feed (e.g. Viasat runs one at investors.viasat.com/rss-news-feeds — likely a pattern other public space companies follow).

### 1.4 Government / regulatory feeds (US)

| Source | URL | Free? | Machine-readable? | Cadence |
|---|---|---|---|---|
| FCC Daily Digest | fcc.gov/proceedings-actions/daily-digest, email signup available | Free | Email/HTML; RSS availability via fcc.gov/news-events/rss-feeds-and-email-updates-fcc not fully confirmed for Daily Digest specifically | ~Daily by noon ET, business days |
| FCC IBFS (satellite filings) | Official system: apps2.fcc.gov (myIBFS). Third-party mirror **fcc.report** (not FCC-affiliated) replicates IBFS filings with RSS access, e.g. fcc.report/IBFS/Filing-List/SAT (space stations) and .../SES (earth stations) | Free | RSS via fcc.report mirror | Continuous as filings post |
| SEC EDGAR full-text search API | `https://efts.sec.gov` (EFTS full-text search) and `https://data.sec.gov` (structured company facts/submissions) **[fetched-adjacent, confirmed via search + is well-documented official API]** | Free, no API key, but requires a `User-Agent` header on every request | JSON | Real-time as filings post; EDGAR itself updates continuously during business hours |
| NOAA CRSRA (remote-sensing licensing) | space.commerce.gov/regulations/commercial-remote-sensing-regulatory-affairs/ | Free | No dedicated feed found; regulatory actions route through Federal Register / regulations.gov, which do have RSS | Irregular (rulemakings, license actions) |
| Federal Register | federalregister.gov has a documented, free, JSON API and RSS feeds, filterable by agency (NOAA, FCC, FAA) | Free | JSON + RSS | Daily |

### 1.5 Non-US sources

**China:**
- Xinhua English RSS: `http://www.xinhuanet.com/english/rss/index.htm` and `rss_eng.htm` — free, general news, not a space-specific feed; requires keyword filtering downstream.
- CGTN: dedicated "Space China" section at cgtn.com/sci-tech/space-china.html; RSS subscription hub at cgtn.com/subscribe/rss.html — exact space-only feed URL not confirmed.
- CNSA (China National Space Administration) English site: cnsa.gov.cn/english/ — official but no confirmed feed; likely requires periodic scraping/fetch rather than RSS.
- Per the CLAUDE.md editorial rules, Chinese state-media facts of record (launch occurred, sat count) are publishable at official-tier sourcing; performance/intent claims must be labeled "per [source], unverified" — this applies directly to Xinhua/CGTN/CNSA content.

**India:**
- ISRO official press releases: isro.gov.in/Press.html — no RSS confirmed; likely needs periodic page fetch/diff.
- Secondary Indian press with regular ISRO coverage: The Hindu, Times of India, Business Standard, Indian Express — all mainstream-press tier for SNR purposes. No RSS URLs confirmed in this pass; these are large publishers that generally do offer RSS on their sci-tech sections, but exact paths need direct verification.

**Japan:**
- JAXA official "What's New": `global.jaxa.jp/news/` — official press-release page, appears actively maintained (dated July 2026 items observed in snippets). No RSS explicitly confirmed but JAXA is a well-resourced agency site, worth a direct check for a feed.
- Nikkei Asia covers Japanese space industry (JAXA funding, ESA-JAXA cooperation) under its Aerospace & Defense Industries and Science tags — Nikkei Asia is a paywalled subscription publication, not free; if used, it would need to be a headline-only signal or a paid subscription (cost not in scope of the $100/mo social/API budget but worth flagging as a real recurring cost if wanted).
- SpaceNews itself already regularly covers Japan (H3, JAXA) — the existing trade-press feed already provides a lot of Japan coverage without a dedicated Japanese-language source.

**Europe:**
- ESA has an extensive, confirmed RSS program: top news at `esa.int/rssfeed/TopNews`, plus a general RSS hub at esa.int/Services/RSS_Feeds covering per-programme feeds (launchers, telecom, navigation, human/robotic exploration, Earth observation). This is a strong, free, official, machine-readable European source.
- European Spaceflight (independent outlet) — see 1.1, feed not confirmed but the site is a known, frequently-cited independent European trade source.

### 1.6 Science / preprint

- **arXiv API**: official REST/OAI-PMH/RSS access, all free, no key required. Rate limit: **no more than one request every 3 seconds, one connection at a time** for the legacy API/RSS/OAI-PMH [search-confirmed against arXiv's own documentation]. RSS feeds cap at 2000 results and can combine categories (e.g. `astro-ph.EP+astro-ph.IM`) with a `+`. Relevant categories for MCC: astro-ph.IM (instrumentation), astro-ph.EP (planetary), and possibly physics.space-ph — useful mainly for EO/sensor technical developments, not commercial news per se; low signal-to-volume for this product's news feed, more relevant as a background-research source.

---

## 2. Social / commentary access (2026 status)

### 2.1 X / Twitter — NOT viable for meaningful read access within budget

**[Fetched directly from docs.x.com/x-api/getting-started/pricing, 2026-07-08]**

- X API pricing is now **pure pay-per-usage, no subscription tiers, no free tier for new developers**. Confirmed rates: **Posts: Read = $0.005/resource**, User: Read = $0.010, Following/Followers: Read = $0.010, Space/List/Community/Note: Read = $0.005, Likes/Mutes/Blocks = $0.001. Writes are separate ($0.015-$0.20/post).
- "Owned Reads" (your own app's own data) are cheaper at $0.001/resource but irrelevant for monitoring third-party signal accounts.
- Search results (not independently fetched but consistent across multiple secondary sources) indicate the **legacy Basic tier ($200/month)** still exists for grandfathered subscribers but is being migrated to pay-per-use after June 1, 2026, and new developers cannot sign up for it — so it's not an option going forward regardless of budget.
- **Budget math at $100/month**: ~20,000 post reads/month at $0.005 each (before any user/list lookups, which cost more). That is roughly 650/day — thin for continuously polling even a modest signals whitelist via search/list endpoints, especially once user-lookup and pagination overhead is included. It could support a narrow, scheduled poll (e.g., checking a short list of ~20-30 signal accounts a few times a day for new posts) but not general keyword search/monitoring at volume.
- **Conclusion: X access is technically possible under $100/mo but only for a tightly bounded whitelist-polling use case, not broad discovery.** This matches the product's existing design (signals.json whitelist), so it's arguably sufficient for the intended use (checking named individuals' posts) but would not support open corroboration crawls on X.
- Free/no-cost alternative: X posts remain visible via logged-out web fetch of individual profile/post URLs (i.e., treating a specific X post URL as a fetchable document, not via the API) — this is effectively what "X posts via search plus a rendering that yields the exact post text" in the CLAUDE.md signals workflow implies. This sidesteps API cost entirely but is fragile (rate-limited/blocked logged-out access, brittle to X's anti-scraping changes) and was not tested in this session.

### 2.2 Bluesky — free, high feasibility

**[Search-confirmed against Bluesky's own docs.bsky.app]**

- **No paid tier at all in 2026**: authentication, posting, and reading the public firehose are all free. No developer application/review process — create an account and start calling the AT Protocol API.
- Firehose: `com.atproto.sync.subscribeRepos` WebSocket endpoint, unauthenticated, streams all public repo events (posts, likes, follows) network-wide. A lighter-weight, JSON-filtered version called **Jetstream** also exists (per Bluesky's own blog) for consumers who don't need raw CAR-encoded firehose data — likely the better fit for a lean ingestion script.
- Rate limit: points-based, **5,000 points/hour**, where a post costs 3 points — generous for read-heavy polling of a signals list.
- **Journalist adoption**: per Pew Research (cited in search results), the share of a sampled set of "news influencers" with Bluesky accounts roughly doubled from 21% to 43% in the four months after the 2024 US election, continuing into 2025. This is a general journalism-migration stat, not space-specific — no space-journalism-specific adoption study was found in this pass. **[unverified for the space-journalism subset specifically]** — recommend a manual audit of MCC's existing signals.json against Bluesky handles rather than assuming migration rates from the general journalism population.
- **Conclusion: Bluesky is the strongest low-cost social channel** — free, no rate-limit risk at MCC's likely scale, and a documented (if not space-specific) trend of journalist migration onto the platform worth checking against the actual signals list.

### 2.3 Mastodon — free, moderate feasibility

- Public/local/hashtag timelines are readable **without authentication**.
- Rate limit: 300 requests per 5 minutes for authenticated general endpoints (search-confirmed against Mastodon's own docs.joinmastodon.org).
- No centralized "space Mastodon" — coverage would depend on which instances specific signal accounts use (e.g., mastodon.social, a dedicated instance). Feasible as a secondary/opportunistic source but not a primary discovery surface given fragmentation.

### 2.4 Reddit — not viable for programmatic ingestion under budget

- Free tier: ~100 queries/minute (OAuth), but **explicitly restricted to personal/academic/non-commercial use**; commercial data use is prohibited under the free tier per Reddit's terms (per multiple secondary sources, consistent across all of them — **[not independently fetched from Reddit's own ToU page]**).
- Commercial tier requires a negotiated contract with a **quoted minimum spend around $12,000/month** — far outside the $100/month budget.
- The community-run **r-spacex/SpaceX-API** (api.spacexdata.com, GitHub `r-spacex/SpaceX-API`) is a separate, free, unauthenticated REST API providing structured SpaceX launch/rocket/core/capsule/Starlink/launchpad data — **not** a Reddit-API product, just historically built by r/SpaceX moderators/community. v3 is deprecated (frozen, still resolves), v4/v5 appear current. Useful as a free structured-data source specifically for SpaceX vehicle/launch facts, separate from any Reddit discussion-monitoring question.
- **Conclusion: do not plan to ingest r/spacex (or other subreddits) via the official Reddit API** at this budget; if subreddit content is wanted, it would have to go through a third-party aggregator or be dropped from scope.

### 2.5 YouTube — free and workable

- YouTube Data API v3 is **free**, no subscription, no per-call billing; default quota **10,000 units/day** shared across most read endpoints (search-confirmed via multiple 2026-dated secondary sources; not independently fetched from Google's own quota calculator page in this session).
- Per-channel **RSS feeds exist and are free/keyless**: the well-known pattern `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>` is the standard no-quota way to watch for new uploads on specific channels (this pattern is Google's own documented mechanism, not confirmed by direct fetch in this session but is long-standing and widely relied upon — **[high confidence, not independently re-verified this session]**). This is almost certainly the better integration than the Data API for simple "new video from channel X" polling, since it consumes zero quota.
- Recommendation: use per-channel RSS for monitoring specific space-industry YouTube channels/podcasters; reserve the Data API quota (search, details) for cases RSS can't cover.

### 2.6 Podcast RSS

- Standard podcast RSS (Apple/Spotify-compatible feeds) is free and universal. Confirmed example: Main Engine Cut Off (mainenginecutoff.com/podcast, RSS at feeds.simplecast.com/Zg9AF5cA) — an active, long-running (10 years, 331+ episodes as of search) spaceflight policy/analysis podcast by Anthony Colangelo, with a companion show "Off-Nominal." Other podcasts sharing that audience per search: "Are We There Yet?", "Planetary Radio," "This Week in Space."
- Podcast RSS is a low-volume, high-context source (commentary/analysis, not breaking news) — best used as a "why it matters" background-context input rather than a primary news trigger, consistent with CLAUDE.md's rule that background context from memory/analysis stays out of factual claims.

---

## 3. Structured data APIs for registry fill and orbital crossfeed

### 3.1 Launch Library 2 (TheSpaceDevs)

- **Free**, "the entire database is accessible to everyone, for free" per TheSpaceDevs' own site (thespacedevs.com/llapi) — **[search-confirmed, not independently fetched]**.
- Base URLs: `ll.thespacedevs.com/2.2.0/` (production) and a lower-rate-limited dev/testing mirror at `lldev.thespacedevs.com`.
- Provides: upcoming/past launches, launch vehicles, launch pads/sites, agencies (operators/providers), with rich sub-fields (mission descriptions, orbit, status, live-stream links) — directly useful for the registry's launch-vehicle and spaceport entities, and for cross-checking "next flight"/cadence claims in items.
- Exact free-tier rate limit figures were not confirmed by direct fetch; the docs page exists at ll.thespacedevs.com/docs and should be checked before heavy production use to avoid throttling.

### 3.2 CelesTrak

- Non-profit (501(c)(3)), mission is explicitly to keep data free for the whole community — **[search-confirmed; the usage-policy.php page itself failed to load in a direct fetch attempt during this session, likely a transient/legacy-HTTP issue, so treat specifics below as search-snippet-sourced]**.
- GP (general perturbations / orbital element) data now served in **OMM-standard JSON and CSV**, updated **every 2 hours**.
- Usage policy: no hard published rate limit found, but explicit informal guidance ("only download what you need, when you need it, once per update") and a stated intent to start enforcing limits on large lists (Active satellites, Starlink) going forward — i.e., **be a well-behaved client, don't poll aggressively**, and expect throttling to tighten over time.
- Best use for MCC: authoritative, free source for "satellites currently on orbit" counts per constellation (feeding the Stats page's "sats on orbit" index and registry stat blocks) — this is exactly the kind of computed/first-party-adjacent data class the SNR spec treats as canonical (SNR 5, "official record / computed data").

### 3.3 Space-Track.org

- Free account required (US-government-affiliated, operated for/with 18th Space Defense Squadron); **[search-confirmed against space-track's own docs and a third-party Python client's docs, not independently fetched]**.
- Confirmed rate limits per secondary sources: **30 requests/minute, 300 requests/hour**; accounts can be suspended for abusive query patterns (e.g., one query per satellite instead of comma-delimited batch queries).
- Provides the authoritative TLE/GP catalog (SATCAT) plus decay/conjunction data — overlaps with CelesTrak (which itself sources from Space-Track) but with a lower-latency, more complete feed for those willing to register and respect the rate limit. For MCC's registry-fill purposes, CelesTrak is likely the simpler, sufficient choice; Space-Track is a fallback/cross-check if CelesTrak throttles.

### 3.4 Jonathan McDowell's GCAT (planet4589.org)

- **License: CC-BY** — free to use with attribution ("data from GCAT (J. McDowell, planet4589.org/space/gcat)") — **[search-confirmed]**.
- Format: TSV bulk downloads (e.g. `planet4589.org/space/gcat/data/cat/satcat.tsv`), plus browsable HTML catalog pages.
- Current release cited in search results: GCAT 1.8.0 (dated 2025-11-10), with a data update dated 2026-03-09 — actively maintained.
- Coverage is broader than CelesTrak/Space-Track in some respects: includes historical/organizational data (launch vehicles, organizations, launch sites) going back to Sputnik, useful for registry "founded"/history fields and cross-checking launch-vehicle specs. Given the CC-BY license, this is one of the cleanest, most reuse-friendly data sources found in this research.

### 3.5 Gunter's Space Page

- Already named explicitly in CLAUDE.md as a canonical SNR-4 aggregator reference with specific terms (deep-link exact page URL per field, visible attribution, no summing across pages).
- Confirmed via search: the site's stated policy is that **summarization/RAG use is permitted only with clear attribution and a direct link to the original URL**, and the content **may not be used for training or improving machine learning models** — this is consistent with (and reinforces) the existing CLAUDE.md handling; no conflict found, but worth flagging that any LLM-based summarization step in the ingestion pipeline should be checked against the "no ML training" clause (using the page as one-shot context at inference time is different from training on it, but the boundary is worth a conservative reading).

### 3.6 NewSpace Index / nanosats.eu (Erik Kulu)

- Attribution-based reuse: figures/data usable "with proper attribution to Erik Kulu, Nanosats Database, www.nanosats.eu" — **[search-confirmed]**; a separate terms page exists at newspace.im/newspace but its full text wasn't fetched in this session.
- Notably, per search results, **NewSpace Index's own underlying data is sourced partly from Jonathan McDowell (GCAT) and Space-Track** — meaning it's a secondary aggregator itself, not a first-party count. For SNR purposes this places it in the aggregator tier (comparable to Gunter's/Launch Library), not the "computed/official" tier CelesTrak's own OMM feed occupies.
- Useful specifically for constellation-company-level overview data (funding stage, constellation status summaries) that CelesTrak/Space-Track don't provide, since those two only carry orbital-mechanics data, not business/company metadata.

### 3.7 SatNOGS DB

- **Free, open**, REST API, data under **CC BY-SA** license — **[search-confirmed against SatNOGS' own docs.satnogs.org]**.
- Provides satellite/transmitter metadata (frequencies, modulation, status) crowd-sourced by the ground-station community — narrow but useful specifically for RF/comms-payload technical fields on constellation profiles (e.g., confirming a satellite's downlink frequency), less useful for high-level registry facts like sat counts or launch cadence.

### 3.8 UCS Satellite Database

- **Status: stalled, not formally discontinued.** Per search results, the last full release covers data current through **May 1, 2023** (page dated Jan 2, 2024); a UCS blog post from that period said the Global Security team intended to resume regular updates with student help, but **no newer public release was found as of this research (mid-2026)**. Practically: **do not rely on UCS as a current data source** — it is stale by roughly three years at the time of this research. Historical/methodology reference only.

### 3.9 SEC EDGAR (company filings)

- Confirmed via direct search of SEC's own materials: **`efts.sec.gov`** for full-text search (EFTS) across all EDGAR filings since 2001, **`data.sec.gov`** for structured per-company data (facts, submissions). **No API key required; a `User-Agent` header is mandatory** on every request per SEC's access rules.
- Directly useful for the "Financial events of tracked companies" scope item: 8-Ks (material events, M&A, bankruptcies), S-1s (IPOs), and proxy/13F-style filings for any tracked company that is US-public or has US-listed debt/equity. Free, high-quality, first-party-tier (SNR 5) sourcing when the filer is the actor itself.

### 3.10 ITU space-network filings (BR IFIC)

- Public browsing via **ITU Space Explorer** (itu.int/itu-r/space/apps/public/spaceexplorer) and the **Space Networks Regulatory Hub** (itu.int/space-networks-hub) — search-confirmed, current BR IFIC circular number cited in search snippet as "No 3075 as of 07.07.2026," implying active weekly-ish circulars.
- Bulk `.mdb` database files are distributed to BR IFIC subscribers; free online exploration exists via the web tools above, but full bulk-file access appears to require registered/subscriber status (unclear from search whether that carries a cost) — **[unverified whether the .mdb bulk downloads are free or subscription-gated]**. For MCC's purposes, the web-based Space Explorer/BR IFIC Online tools are likely sufficient for occasional spot-checks of spectrum-filing facts (regulatory category items) without needing bulk access.

### 3.11 r-spacex/SpaceX-API

- Free, unauthenticated, REST, `api.spacexdata.com` (v4/v5 current, v3 deprecated-but-live) — GitHub `r-spacex/SpaceX-API`. Community-maintained (not an official SpaceX or Reddit product despite the name). Useful narrowly as a free structured cross-check for SpaceX-specific launch/vehicle/Starlink facts, redundant with Launch Library 2 for most fields but worth knowing about as a fallback.

---

## 4. Comparable aggregators — how they actually work

### 4.1 Techmeme

- **Hybrid algorithmic + human model**, confirmed via multiple sources including Techmeme's own 2011 public explainer and Wikipedia: primarily an **automated scraping/scoring process** — signals include recency, source authority, number of independent outlets covering a story, social traction, and topical relevance — with **anti-gaming logic** to discount coordinated/bulk linking in short windows.
- A **small human editorial team** (two editors historically) overlays the algorithm to promote/demote/annotate stories, correct false reports, add context, or surface exclusives the algorithm under-weights.
- **Takeaway for MCC**: the "feels alive" quality comes from (a) a real-time scoring loop reacting to cross-outlet corroboration signals — structurally similar to MCC's own SNR corroboration-crawl mechanic — and (b) a thin human layer for judgment calls the algorithm can't make, which maps onto Florian's role reviewing `held.json` and seismic-but-low-SNR auto-queued items.

### 4.2 Hacker News

- Official API (`hacker-news.firebaseio.com`, documented at GitHub `HackerNews/API`) is free, real-time via Firebase, exposes top/new/best story ID lists. Ranking algorithm itself is not officially published; community reverse-engineering suggests a time-decayed score based on upvotes minus some penalty function, with flagged/URL-less posts decaying faster. An Algolia-powered search API (`hn.algolia.com/api`) additionally exposes full comment trees.
- Not space-specific and no per-topic volume data was found; useful mainly as a discovery surface for occasional high-signal space/deep-tech stories that cross over into general tech discourse, not a primary feed.

### 4.3 GDELT

- Free, real-time (15-minute update cadence), global event-extraction database going back to 1979, queryable via Google BigQuery (all datasets mirrored there) and a dedicated Analysis Service (analysis.gdeltproject.org) with no-code visualization tools (network/geographic/temporal). A newer paid layer, "GDELT Cloud" (docs.gdeltcloud.com), adds structured event/story clustering and an MCP/API on top of the free raw feed — **[the paid tier's pricing was not surfaced by search; treat as a possible but unverified/unbudgeted option]**.
- GDELT categorizes ~300 event types from unstructured global news text using its own actor/event coding (CAMEO-derived), not a space-industry-specific taxonomy — it would need a custom keyword/entity filter layer to be useful for MCC's scope, and skews toward geopolitical/conflict event types rather than commercial/business events, which only partially overlaps with MCC's scope (the geopolitical category, specifically). Likely more useful as an early-warning discovery signal ("something happened involving Company X today") than as a citable source in its own right, since GDELT itself is a secondary aggregation of press coverage, not a primary source.

### 4.4 SpaceNews / Payload / Orbital Index / Space Impulse / SpaceDotBiz

- **SpaceNews and Payload** are traditional newsroom operations (paid staff reporters), not algorithmic aggregators — their "aggregation" is really original trade journalism plus wire-style pickups; no published methodology found (as expected for a newsroom, not a data product).
- **Orbital Index** (now discontinued as a going publication, ended Jan 2026) was hand-curated by two individuals (Andrew Cantino, Ben Lachman) based on what they personally encountered following space/NewSpace as an interest — i.e., a manual "read everything, pick the best" model with no disclosed formal scoring, the polar opposite of MCC's SNR-scored, code-computed approach. Its GitHub repo (`orbitalindex/orbital-index`) remains public and could be read for archive/style reference but is not a live source.
- **Space Impulse / SpaceDotBiz**: Space Impulse (app.spaceimpulse.com) positions itself as an industry community/market-intelligence platform (news + networking + procurement + jobs) rather than a pure news aggregator; SpaceDotBiz appears to be (or have been folded into) a startup-focused space newsletter. No published methodology was found for either; both read as smaller, less differentiated players relative to SpaceNews/Payload for MCC's competitive-context purposes.

### 4.5 What makes a feed "feel alive" vs. stale (synthesis)

Across the examples found, three structural features recur in the aggregators that stay feeling current:
1. **A tight, disclosed scoring loop that reacts to real corroboration** (Techmeme) rather than a static "top N" list — this is directly analogous to MCC's own SNR corroboration mechanic, which is a structural strength MCC already has relative to most of these comparables.
2. **A visible cadence commitment** (Techmeme's continuous algorithmic refresh, GDELT's 15-minute updates, wire services' real-time RSS) — readers/consumers calibrate trust partly on "this updates constantly," which argues for keeping MCC's twice-daily sweep cadence honestly and visibly logged (which the CLAUDE.md `/log` design already does) rather than implying continuous coverage it doesn't have.
3. **A thin, named human layer for judgment calls** the algorithm can't make (Techmeme's two editors; Orbital Index's two curators) — MCC's Florian-reviewed `held.json` queue plays the same role structurally.

No source in this research disclosed exact daily item-volume figures for the space-news niche specifically (i.e., "SpaceNews publishes N items/day" was not found as a stated number anywhere) — this remains **unverified** and would need to be measured empirically (e.g., by counting SpaceNews/Payload RSS items over a sample week) rather than sourced from a published methodology doc.

---

## Notes on method and gaps

- Roughly 4 direct web fetches were used (well under the ~25 cap); the remainder of this report relies on WebSearch result snippets, which is why so many individual facts are flagged `[unverified]` or `[search snippet only]` above — treat every such item as needing a one-time direct verification pass (fetch/curl) before being wired into production ingestion.
- Two direct fetches failed outright during this session: `celestrak.org/usage-policy.php` (returned empty) and `spacenews.com/feed/` (timed out) — both are almost certainly transient/session issues rather than the sources being down (CelesTrak and SpaceNews are both long-established, actively maintained), but they were not re-attempted given the fetch budget, so their exact current content wasn't independently confirmed today.
- No pricing was found anywhere in this research that would push X, Reddit, or GDELT Cloud into the ~$100/month budget for meaningful production use beyond what's described above; Bluesky, YouTube RSS, Mastodon public timelines, arXiv, SEC EDGAR, CelesTrak, GCAT, Launch Library 2, SatNOGS, and Space-Track are all genuinely free and were the highest-value findings.
