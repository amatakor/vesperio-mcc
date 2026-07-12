# CLAUDE.md — Vesperio (vesperio.ai)

Editorial and operational policy for this repo. Applies to the scheduled ingestion agent and to interactive @claude development work. When these rules conflict with anything else, these rules win.

Naming (Florian, 2026-07-09): the SITE is **Vesperio**. **MCC** now names only the live 3D orbital view at `/mcc/` (formerly the Orbits page); "MCC" in older prompts, filenames, and this repo's shorthand refers to the platform now called Vesperio. User-facing copy says Vesperio for the site and MCC for that page only.

## What this site is

A machine-maintained tracker for the new space economy: Earth observation, connectivity, launch, and commercial human spaceflight. Site surfaces:

1. **News**: fresh items twice daily, each with a plain-English explainer, tags, its sources, and a visible signal-to-noise (SNR) score whose calculation is stored and shown. Plus one prerendered static page per item and one filtered feed page per category (SEO surface).
2. **Registry**: standardised reference profiles of constellations and launch vehicles. One prerendered static page per entity. Each profile carries key computed figures (launch cadence, sats on orbit, flight record, growth trend) as anchored, citable stat blocks with as-of dates.
3. **Signals** (influencers): a hand-curated list of people worth following. The agent never edits this section. The list doubles as the whitelist for `signal`-tier sourcing: only people on it (plus named executives of the actor concerned) can be the basis of an item via social posts. Sweeps READ the list as a discovery surface (the signals pass in prompts/update-items.md): fetchable channels directly, X posts via search plus a rendering that yields the exact post text.
4. **Stats**: a public page of basic computed indices from our own data (launch cadence by provider, sats on orbit by constellation, items tracked), each stat block with an anchor and a pre-formatted citation string with retrieval date, plus a `/stats.json` endpoint. Deeper cross-cutting indices (contract volume by agency, pricing trends, growth analytics) are reserved for the v2 paid layer and must not appear here.
5. **Learn**: parked for a later phase. Do not build or scaffold it without explicit instruction.
6. **Log**: the public sweep changelog, rendered from state.json: every sweep's counters, summary, and SNR movements (upgrades, downgrades, disputes), plus the source-reliability ledger, including zero-add sweeps and why they were quiet. The machine's calibration, visible.

The product promise is honest calibration. Nothing on-scope is withheld for sourcing reasons; every item and every scored registry fact carries a visible SNR score (1-5) whose calculation is stored and shown. A reader should never catch this site claiming more confidence than its sources support: the copy attributes every claim, and the score never exaggerates. Publishing an early signal at SNR 1 is the model working; publishing a weak claim dressed as a certainty is the cardinal failure. Whether the scores are honest is itself measured: every claim's score at publication is recorded and compared against how it resolves.

## Scope

The platform tracks new space events: the commercial space economy and the events that move it.

**In scope:**
- Commercial EO operators and their constellations (optical, SAR, hyperspectral, RF, GHG)
- Connectivity constellations and operators (Starlink, Kuiper, OneWeb/Eutelsat, AST SpaceMobile, GEO operators when the event is new-space relevant)
- IoT and RF constellations: IoT messaging operators (Kineis, Astrocast, Myriota, OQ Technology) and RF-sensing operators (Unseenlabs, HawkEye 360, Spire). Classification rule: RF sensing is EO, RF communication is IoT (sensor or modem)
- Spaceports and launch infrastructure, orbital sites worldwide
- The wider ecosystem where events move the commercial market: manufacturers and bus providers, in-space services (tugs, cleanup, capsules, manufacturing), ground-segment providers, institutions and regulators (space agencies, UN bodies, FCC/ITU/NOAA), and space-focused investment funds
- Launch vehicles and launch providers, orbital only
- Human spaceflight, active programs only, where contracts and outcomes affect commercial providers (Commercial Crew, CLD/commercial stations, Artemis awards to commercial primes). Science-only mission coverage stays out.
- Regulatory events affecting any of the above (FCC, ITU, NOAA CRSRA, export control, spectrum)
- Government procurement of commercial space services
- Financial events of tracked companies (funding rounds, 8-Ks, M&A, bankruptcies)
- Geopolitical events, only via their documented commercial-space angle: an operator confirming service changes or imagery provision, sanctions or export-control notices, government statements directly concerning commercial space services in a conflict or crisis. The item reports the space-industry fact; it does not analyse the conflict.
- Orbital-safety incidents: uncontrolled reentries, recovered debris, collisions and near-misses, and satellite losses or anomalies. These publish as `incident` even before the responsible operator is identified (Florian, 2026-07-08): tracing debris to an operator IS the commercial story (liability, deorbit compliance, insurance). Attribute to the reporting authority (a space agency, the recovering party, the outlet) and score at the SNR the sourcing earns; update the item when the operator is named. This does not reopen conflict analysis or operational-use claims, which stay out.
- Government-owned and sovereign constellation programs (national EO or connectivity systems such as Italy's IRIDE) and their program milestones (Florian, 2026-07-08). The item publishes on the program fact; the commercial read is what it changes for operators, manufacturers, and resellers (procurement of commercial supply, marketplace access, competition with commercial operators). This supersedes the institutional-program exclusion precedent for constellation programs; science-only missions stay out per the existing rule.
- Chinese, Indian, Japanese, and European activity gets equal weight to US activity. Non-US coverage is a differentiator, not an afterthought.

**Out of scope:**
- Deep space and planetary science missions with no commercial-provider angle
- Suborbital tourism as routine events (first flights and incidents qualify)
- Conflict analysis, battlefield OSINT, or claims about how space assets are being used operationally, unless stated by the operator or a government on the record
- Anonymous, unattributable rumours and personnel gossip. Attributable weak sources (an identifiable account, an informal but named outlet) publish at low SNR; sources that cannot be named at all do not publish.

## Ingestion rules (hard rules, no exceptions)

1. **Everything on-scope publishes at its honest SNR; the copy never overclaims.** Every item links every source it has and carries the SNR the scoring engine computes (see "The SNR score"). The agent attests judgment inputs (source classes, extraordinary flags, corroboration outcomes); the math is code (`scripts/snr/`, applied by `finalize-sweep`), never the agent's to run by hand. Items whose lead source is not first-party name their sourcing in the copy ("per SpaceNews", "per @handle on X"), never in the headline: cards display events, not articles (Florian, 2026-07-08); the headline stays actor-first while the sources list, SNR mark, and copy attribution carry the sourcing. When a primary source exists, link it and lead with it. The one thing that still never publishes is a claim that cannot be attributed to anyone.
2. **Never state a fact that is not in the linked source.** No enrichment from model memory for dates, figures, names, or technical specs. Background context from memory is allowed only in the "why it matters" field and must be framed as context, not news.
3. **Numbers are copied, not paraphrased.** Resolutions, prices, masses, orbit parameters, contract values: exact figures from the source or omit them.
4. **Deduplicate before writing.** Check `src/data/items.json` for the same event (same company + same event type within 7 days). Update the existing item rather than creating a duplicate.
5. **held.json is an edit queue, not a sourcing quarantine.** It holds schema conflicts, same-metric contradictions awaiting reconciliation, and open decisions for Florian (including auto-queued seismic items at SNR 2 or below). Weak sourcing is never a reason to hold: that is what a low SNR is for.
6. **State-media handling.** Facts of record (launch occurred, satellite count) from Chinese state sources are publishable. Claims about performance, commercial success, or intent are labelled "per [source], unverified."
7. **Never fabricate a URL.** Only link URLs actually fetched during the run.

## The SNR score

Every item and every scored registry fact carries an SNR: an integer 1-5, with the full calculation stored at scoring time (`snr_trace`) and shown on demand. News surfaces display the LED mark per item. Registry profile pages consolidate the display (Florian, 2026-07-09): the header carries ONE aggregate mark, the median of the profile's scored facts, whose hover popover shows the honest mix (count per source class and the weakest fact's score); per-fact marks render in the profile's Sources view, not beside every field. The aggregate is display-only, computed at render, never stored as a fact; the per-fact scores and traces remain the record, still computed by the engine, never hand-set. SNR_SPEC.md is the governing spec and SNR_PLAN.md the resolved contract; this section is the operating summary.

| SNR | Meaning |
|---|---|
| 1 | Low confidence. Single source, rumor, out of pattern, extraordinary claim with little evidence. |
| 2 | As 1 but with more than one source, OR from a usually-reliable / whitelisted source, OR reinforced by a later matching signal. |
| 3 | Multiple informal sources, or a few reputable sources (trade press, legacy media, industry-leader accounts). |
| 4 | Wide reporting (multiple sources, media + social), an established aggregator, or a long-standing uncontested signal. |
| 5 | Quasi-certainty. A direct source from the concerned party: press release on its own domain, first-party account, official filing, or direct observational data. |

**Mechanics (the math is code; agents only attest inputs):**
- Base tier comes from the lead source's class: first-party / official record / computed data 5, press-wire copy or established aggregator 4, trade or mainstream press 3, whitelisted account 3 (before floors), informal 1. A ledger demotion lowers a trade source to informal.
- Corroboration raises the score, once per rule: a second distinct source, a fourth, and pickup by a mainstream (non-trade) outlet beyond the lead. Wire rewrites of one story are one source, code-enforced at finalize since 2026-07-11: URL variants of one article, multiple pages on one registrable domain, and near-identical titles (SimHash) collapse into ONE corroboration unit before scoring; the item keeps every link, the units drive the math, every collapse is logged in the sweep entry and rendered on /log. Drafts should carry each scoring source's page headline verbatim in the optional `title` field so rewrites can be recognized. The corroboration crawl searches the open web (WebSearch plus fetching the strongest hits); a run's source filter constrains discovery only, never the crawl. A corroboration crawl that ran and found nothing costs one level (indirect leads only: a direct source proves its own statement); "found nothing" is a claim about the web, not about the run's source list. A crawl that never ran costs nothing, and the gate rejects skipped crawls the budget covered.
- **Direct-source ceiling:** no amount of indirect corroboration reaches 5. Wide reporting IS tier 4; 5 is reserved for direct sources (or the whitelist self-floor, which is a direct source).
- **Extraordinary claims start at 1** regardless of source count and climb only via corroboration and persistence. Any seismic claim whose lead is below first-party is automatically extraordinary (code-enforced).
- **Persistence:** 14 uncontested days earn +1, once, never above 4. **Reinforcement:** a matching event within 30 days bumps an SNR 1-2 item by one and attaches its source. **Contradiction** is handled by reconciliation (metric mismatch is annotated, never punished; genuine same-metric conflicts let the higher-SNR side lead, and equals are both marked disputed and queued for Florian).
- **Anti-spoof:** first-party and official-record classes are accepted only when the URL's domain matches the actor's registry-recorded website or an official register; press-wire copies cap at 4 until the actor's own domain confirms. Fake press releases are a documented attack; the gate rejects misclassification.
- **Whitelist floor:** a signals.json person (whitelist "yes", verified_active channel, ingest_rules honored) floors an on-topic factual claim at 4 as an observer, 5 when the concerned party speaks about itself. Jokes, opinions, and off-topic posts get no floor.
- Scores move over an item's life; traces are append-only, every move is logged in the sweep entry and rendered on /log, and each claim's score-at-publication is recorded in the source ledger for calibration.

**Registry facts:** a fact needs SNR ≥ 3 to enter (null-fill only, never a silent overwrite). SNR 3 fields are **provisional** (badged, never adjudicating); SNR 4-5, first-party, Wikipedia, and computed facts are **canonical**. Wikipedia and first-party fields carry no badge and just link their source; computed figures are authoritative only for what they measure ("cataloged on orbit, as_of date") and never contradict "operational" or "announced" claims.

**Edge cases:**
- State media (Xinhua, TASS) on state programs: facts of record score as official; performance and intent claims are labelled "per [source], unverified" and scored as trade at best.
- Aggregator databases (Gunter's Space Page, Launch Library, eoPortal, GCAT): canonical registry references at SNR 4. Gunter's terms still apply unchanged: exact page URL (deep link) in every field's `source`, visible attribution on pages using it, no summing across pages. eoPortal (ESA): cite facts and deep-link only, never copy prose or mirror images (terms forbid republishing); extract the field-level dated status note into `as_of`, not just the page stamp. GCAT (J. McDowell, planet4589.org): CC-BY-4.0; render the McDowell citation line wherever GCAT-derived figures appear. NewSpace Index is citable (Florian reviewed the terms and ruled 2026-07-11; evidence in reports/source-terms-2026-07.md): press-tier (SNR 3 provisional, single-maintainer site), cite facts and deep-link only within the quotation right, never copy tables or prose wholesale, and prefer the primary sources it links whenever they state the value. CelesTrak (usage policy reviewed 2026-07-11, same memo): any non-200 response stops that run's remaining CelesTrak queries per the policy's machine-to-machine instruction; the 404 no-match answer on NAME queries is a documented empty result, not an error. ITU/FCC filings are official record (SNR 5 canonical) for frequency bands, capacity, and market access; targeted pulls only, never bulk crawling, anti-spoof domain rules apply.
- Leaked documents: still out entirely. Publishable only once the actor or an official record responds; the response is the source.
- The old primary-source test still decides the first-party class: could the linked source itself be wrong about the fact without the actor or official record being wrong? If yes, it is not first-party.

**Source reliability feedback:** `source_ledger.json` (machine-owned, human-audited, rendered on /log) records strikes (claims that lost a same-metric contradiction), credits (claims that started at 1-2 and were later confirmed: early, not wrong), and every claim's calibration record. Repeated strikes demote a source's class inside a rolling 90-day window; demotion decays and confirmed claims win it back. Sources that repeatedly produce floor-independently confirmed claims become entries in `signals_suggestions.json` for Florian's review; the agent never writes `signals.json`.

## Item format

Each item in `src/data/items.json`:

```json
{
  "id": "2026-07-05-iceye-gen4-order",
  "date": "2026-07-05",
  "headline": "Max 90 chars, factual, actor first, no hype verbs",
  "explainer": {
    "tagline": "One sentence, max ~140 chars. The event in plain words.",
    "what_happened": "2-3 sentences. The facts, nothing not in the source.",
    "why_it_matters": "2-4 sentences. The industry read: who this affects and how. This is the product; write it with judgment, not filler.",
    "for_who": "Optional. Who should care most, e.g. 'EO resellers', 'rideshare customers'."
  },
  "kind": "event",
  "tags": [],
  "category": "",
  "impact": "",
  "companies": [],
  "source_url": "lead (best) source, required",
  "secondary_urls": [],
  "snr": 0,
  "snr_trace": {},
  "sources": []
}
```

`snr`, `snr_trace`, and `sources` are stamped by `finalize-sweep` from the draft's `scoring` block (see prompts/update-items.md); agents never hand-write them.

**Categories** (exactly one): `launch`, `constellation`, `contract`, `procurement`, `regulatory`, `financial`, `product`, `partnership`, `incident`, `geopolitical`, `human-spaceflight`.

**Kind** (exactly one, default `event`): `event` is something that happened. `commentary` is a take, analysis, or position from a named voice, visibly tagged as commentary on cards and item pages. Commentary rules: the source must be a signals.json whitelisted person or a named outlet/author (anonymous takes never publish); the tagline quotes or tightly paraphrases the take with attribution; `what_happened` states who said what, where; `why_it_matters` may engage with the argument. The SNR scores the attribution ("this person said this"), never the opinion's truth; whitelist floors apply as observers. Commentary never feeds the registry and never reinforces factual items. Impact for commentary caps at `notable`. Analyst research notes and price targets on tracked companies (a bank's SpaceX valuation, a downgrade) are `commentary`, not `financial` events: they are an attributed opinion about value, not a transaction. The tagline attributes the call ("Per Morgan Stanley:"); the copy never repeats the target as fact.

**Impact** (exactly one; four tiers since 2026-07-10, Florian: the old three-tier scale marked 78% of the feed notable). Importance and SNR are independent axes; a seismic rumour is seismic AND low-SNR, and seismic items at SNR ≤ 2 are auto-queued for Florian while they publish:
- `seismic`: reshapes competitive dynamics (major M&A, operator failure, flagship program cancellation, first flight of a new vehicle)
- `major`: a commercial director at an operator or reseller acts on it or briefs their team the same day. Examples: a contract award or funding round with a stated value that changes the actor's trajectory (nine figures, or the actor's largest to date); a regulatory grant or denial that changes what an operator may sell or where; a demonstrated first-of-kind capability offered on commercial terms. The stated-value test matters: money or market access must be in the source, not inferred.
- `notable`: worth knowing; the director skims it in the morning read and moves on. Examples: a contract award of routine size or without a stated value; an ordinary funding round; a program milestone arriving on schedule; a partnership with named scope but unstated money. Routine executive hires stay below the inclusion bar, but a senior government or political figure joining a tracked company (board or advisory role) is notable: it signals commercial access.
- `noise`: worth logging, not worth a push. Examples: a scheduled launch succeeding on schedule; a routine product update; a minor partnership without stated money, capacity, or regulatory effect. Routine product updates, minor partnerships, and scheduled successes default here, however long the press release.
- When torn between two tiers, take the lower one; the feed's credibility spends on restraint. Impact for commentary still caps at `notable`.

**SNR** (integer 1-5): computed by the scoring engine, never hand-set. See "The SNR score".

**Tags**: lowercase, reuse existing tags before inventing new ones; newly coined tags are logged in the sweep entry for human review. Four tiers:
- Domain (every item carries one where applicable): `eo`, `connectivity`, `iot`, `launch`, `human-spaceflight`
- Modality: `sar`, `optical`, `hyperspectral`, `rf`, `ghg`, `direct-to-device`, `heavy-lift`, `smallsat-launch`, `rideshare`, `reusability`
- Geography: `china`, `india`, `europe`, `japan`, `mena`, `us-gov`, `esa`
- Theme: `pricing`, `export-control`, `sanctions`, `m-and-a`, `funding`, `bankruptcy`, `commercial-crew`, `commercial-stations`, `spaceport`

## Writing style

- Plain declarative English. No hype ("game-changing", "revolutionary", "milestone"), no press-release voice.
- "Why it matters" is written for a commercial director at an operator or reseller, not for space fans. Assume the reader knows what SAR is; tell them what the event changes.
- Attribute claims: "ICEYE says", "per the FCC filing", "the 8-K states". Attribution in copy survives every scoring change; the score never replaces naming who said what.
- Commentary items attribute the take in the tagline itself ("Per @handle: ..."), and the copy never presents the opinion as the site's own read; "why it matters" may engage with the argument, attributed.
- SNR scores statements, not boasts: a first-party superlative ("world's largest constellation") is attributed, never scored or repeated as fact.
- No em dashes anywhere on the site.
- Headlines name the actor first: "Firefly wins NASA VADR task order", not "NASA awards task order to Firefly".

## Item images

Card and item artwork is stamped exclusively by the deterministic `scripts/fetch-thumbs.ts` pipeline, in this priority order:

1. The og:image / twitter:image of the item's own sources, tried press-first (trade > mainstream > aggregator > informal > first-party > official record): trade-press artwork beats press-release, investor-relations, and filing pages (Florian, 2026-07-08). Social platform pages never contribute their own og:image (it is a profile picture); a Bluesky post resolves to the article it embeds via the public API and that page joins the candidates. PDFs are skipped; tiny images and ad-shaped banners are rejected; a logo-shaped image is used only when no source yields a photo. The winner is re-hosted under `public/img/items/`, credited to and linked to the page it actually came from.
2. A curated freely licensed stock image from `src/data/stock-images.json`, keyed by source domain. Every entry records license, author, and origin URL; the map grows only via reviewed PRs with the license verified. (The SEC headquarters photo was removed 2026-07-08: one stock photo repeating across filing-sourced items, seismic ones included, reads worse than the honest text tile.)
3. Nothing: the card and item page render text-only — no media block at all (the generated mono text tile was retired 2026-07-10, rule 57).

Never: image search results, AI-generated imagery of real events, official agency seals (legally restricted), or images hand-picked by the drafting agent. Any image is removed on request from its rights holder by setting the item's `image` to null.

Signals avatars follow the same logic via `scripts/fetch-avatars.ts`: the profile picture of the exact account the card links to, re-hosted under `public/img/signals/`, initials tile when none is fetchable, removed on request from the person concerned by deleting the file and manifest entry.

## Scheduled run procedure (update-items.yml)

Sandbox (2026-07-11): scheduled agents run without curl (WebFetch/WebSearch are the only fetchers), with Bash limited to the exact scripts their prompts mandate, without a readable push token, and behind `scripts/check-run-diff.ts`: a post-agent step that fails the run if the working tree changed ANYTHING outside that run's data paths. Prompt-injected instructions to edit code, workflows, prompts, or signals.json cannot reach main. Sources our tools cannot fetch record honest failures; the fix is a deterministic fetcher (harvest.ts pattern), never a wider agent sandbox.

1. Read `SWEEP_MEMORY.md` first. It contains lessons from past runs (flaky sources, recurring dedup traps, style corrections). Apply them.
2. Load `src/data/sources.json`. Fetch each source with `status` of `verified` or `unverified`. On first successful fetch of an `unverified` source, flip it to `verified`; after 3 consecutive failures, flip to `dead` and add a note.
3. Collect candidate items newer than the last run timestamp in `src/data/state.json`.
4. Filter against scope. Discard out-of-scope items silently.
5. For each candidate, run the master-crawler loop in prompts/update-items.md: known-to-MCC match (7-day dedup, 30-day reinforcement for SNR ≤ 2), corroboration crawl within budget (5 fetches per event, 40 per sweep, seismic first), registry crossfeed check (like-for-like metrics first), honest source classes in the draft's scoring block. `finalize-sweep` computes all scores, applies persistence bumps, records ledger claims, and logs SNR movements.
6. Run the build (`bun run build`) to confirm the feed parses and the site builds before committing. A commit that breaks the build is worse than a skipped run.
7. Append new lessons to `SWEEP_MEMORY.md` (source behaviour changes, mistakes caught, judgment calls worth remembering). Keep entries short and dated.
8. Commit with message `ingest: N new, M updated, K held (YYYY-MM-DD HH:MM UTC)`.
9. If a run produces zero items, still write and commit the sweep log entry in state.json; the public /log/ page renders it, and a quiet day explained is a trust signal. Feed content is never padded: no items, no filler, on quiet days.

Registry updates run in a separate scheduled workflow (`maintain-registry.yml`), lower cadence (weekly): update factual fields (sats on orbit, flight counts, next flight) from Launch Library and published items only, every change carrying `source` and `as_of`, plus the SNR fields its class earns (computed 5 canonical; aggregator 4 canonical; a single reputable press source 3 provisional; Wikipedia/first-party unscored). Never restructure the registry in a scheduled run.

## Registry rules

- Scope (extended 2026-07-05): constellations (EO, connectivity, IoT; fleet-level parents may carry named child constellations via the parent field), orbital launch vehicles, spaceports (grouped by region), and ecosystem organizations (manufacturer, launch-services, in-space-services, ground-segment, institution, finance). One profile per entity, uniform fields per entity type.
- Registry sourcing (relaxed by Florian, 2026-07-05; news items are NOT affected and keep the full SNR model): reference fields (country, founded, focus, status, websites, dates, sensor types, orbits, vehicle specs, timeline events) may cite Wikipedia and reputable publications (SpaceNews, Payload, Via Satellite, Reuters, and peers) in addition to operator/official pages, Gunter's, and Launch Library. Preference order stays: primary > aggregator > Wikipedia/press, and a field is upgraded when a better source is found. What does NOT relax: the value must still be stated by the cited page (no invention, no estimates, no summing), every field still carries source + as_of, and satellite counts prefer primary or CelesTrak-derived figures.
- Operator/company display names are normalized through the curated alias map (src/data/aliases.json); the sourced value in each profile keeps the cited page's wording.
- No free-form essays, with one exception: a profile may carry a short overview block (2-4 sentences) stored as a sourced field like any other; every claim in it must be backed by that field's source URL and as_of date. Anything the source does not state stays out of the overview.
- Every field carries a `source` and `as_of` date. Unknown fields stay `null`; never estimate.
- Two SNR tiers (see "The SNR score"): a fact needs SNR ≥ 3 to enter; SNR 3 fields are provisional (badged, never adjudicating), SNR 4-5 / first-party / Wikipedia / computed facts are canonical. Wikipedia and first-party fields carry no badge. Disputed fields keep both claims visible, each with its own badge.
- Positioning blocks (registry v2, 2026-07-09): a profile may carry `positioning`. `positioning.claims` are sourced fields like any other: the value must be stated by the cited page, superlatives attributed ("Planet describes PlanetScope as the only..."), full sourcing model. `positioning.mcc_read` is the registry's ONE editorial surface: 1-2 sentences of house read (max 400 chars), visibly badged "MCC READ", carrying its `basis` source URLs and `as_of`. It is never SNR-scored (it is a read, not a claim), is never treated as a sourced fact, and never feeds items, stats, or any other registry field. Only Florian plus interactive Claude write `mcc_read`; scheduled sweeps and registry maintenance runs must never create or edit it.
- Generations (registry v3, 2026-07-09): a constellation may carry `generations`, sourced rows (`name`, `text`, `source`, `as_of`) stating per-generation capabilities exactly as the cited page states them, same rules as timeline events. Maintenance runs may append sourced rows; a generation no source names does not get a row.
- Quantified figures beat vague ones (Florian, 2026-07-09): for fields like `revisit`, a source stating a figure ("under 6 hour global revisit", "twice daily") is preferred over one stating a vagueness ("multiple times per day"); a vague value is a placeholder to upgrade when any eligible source states a quantified one, and the normal preference order (primary > aggregator > press) breaks ties. Never coerce a vague statement into a number.
- Structural edits (new fields, new entries) happen only via @claude issues reviewed by Florian, never in scheduled runs.

## Development rules (@claude interactive)

- Stack mirrors the AI/TLDR blueprint: React + Vite + TypeScript, Bun for scripts and package management, per-page prerender script for SEO, deployed on Cloudflare Pages, data as JSON files in `src/data/`. No database, no backend.
- Release flow (Florian, 2026-07-12; effective after the v1.0 squash): PLATFORM changes (code, design, copy, structure) are built on a branch and never deploy on their own. Cloudflare Pages builds every branch a preview URL; Florian reviews there. Only when he says GO LIVE does the branch merge to main, which auto-deploys. Each go-live: (1) back up the version being replaced (`git tag` on the outgoing main commit + `git bundle` to ../backups/vesperio-vX.YY.bundle, outside the repo), (2) bump the version (v1.01, v1.02, ...; tag the new deploy commit `vX.YY`), (3) add a dated plain-English entry to CHANGELOG.md in the same merge. DATA commits (scheduled sweeps, orbit refreshes, registry maintenance) are exempt: the machine keeps committing to main and auto-deploying, unversioned; that is the product working.
- Design language: the Vesperio V1.1 design system (fine-tuning lock 2026-07-09, applied 2026-07-10; tokens in `src/index.css`, spec in the design project's handoff). Brutalist editorial, rebuilt in our own code (do not copy blueprint CSS verbatim; no license grants that). House rules: no border-radius anywhere, no shadows, no glow, no gradients, no transform-based hovers. One frame per section (Florian, 2026-07-09): the frame belongs to the CONTENT block; sections themselves are unfenced, marked by their `//` heading and a top hairline, never a box. Numbers get display-size type; stated phrases render at body scale. Typography is three voices: IBM Plex Sans is the DISPLAY voice (light register, ALWAYS uppercase: hero numbers 52/200, page titles 28/200/+.12em, headlines 21/300/+.06em, never bold); IBM Plex Mono is the DATA voice (body 12.5/400, labels 10/500/+.08em caps, instrument register 11/500/+.14em caps; MONO IS NEVER BOLD, cap 500, tabular numerals); Space Grotesk 700 lowercase is the wordmark only. Color is governed (90/9/1): role colors (`--acc-*`) appear ONLY as glyphs ≤12px, layer squares, or badges, never on running text, counts, or timestamps; volt `#ADFF00` is logo + app shell + HERO ELEMENTS (nav underline, focus, selection fills, card hover frames via `--shell-accent`, the sweep-countdown flood, LCD clocks, the selected satellite's orbit arc), never running data or status (the MCC satellites-tracked count left the volt list 2026-07-11, rule 58i: it renders volt-ink in both themes); a new hero use still needs Florian's sign-off per element; constants are links cyan (`--link`), meters + live dots green, clocks volt, yellow strictly MAJOR fills. Badges: one height (24px), dim-hue border + colored text; FILLED reserved for MAJOR (yellow) and FAILURE/SEISMIC (red); NOTABLE is the outlined INFO-blue chip (--acc-blue text, --acc-blue-dim border; rules 51/51b, 2026-07-10). Spacing is a 4px grid (named steps 4/8/12/16/20/28/40/64); exactly three control heights (24/32/40). Both themes ship (dark default, light via `data-theme="light"`, persisted as `vesperio-theme`); theme coverage follows DESIGN_TUNING_LOG.md where it amends the handoff: the MCC orbits view THEMES (rule 3: dark is the night-ops view, light the daylight chart), its launch clock included (rule 16); the only constant-dark surfaces are monogram/avatar tiles (rules 2, 16, 52, and 52d: the news sweep face takes the MCC clock's smoked treatment in BOTH themes — rgba(20,20,18,.55) over paper, rgba(255,255,255,.07) over night — flood and volt digits unchanged), and constant surfaces use literal grays, never themed tokens. The wordmark's square i-dot is ALWAYS lit (volt on dark, volt-ink on bright; amendment 2026-07-10). `--neon-*` domain accents survive only inside the orbits canvas and chart data layers. No new color roles without Florian's sign-off; palette values remain Florian's.
- Build must include schema validation scripts (check-feed, check-registry) that fail the build on malformed data, mirroring the blueprint's check-*.ts pattern.
- Don't touch `src/data/items.json` history in dev PRs.
- Keep API cost in mind: filtering with a cheaper model, writing with a better one, is the intended pattern once volume justifies it.

## Things the agent must never do

- Misclassify a source class, hand-write an SNR/trace, or claim more certainty in copy than the score supports
- Invent, estimate, or "recall" numbers, dates, or URLs
- Edit the Signals/influencers list
- Widen scope beyond the Scope section without an explicit instruction from Florian
- Analyse conflicts or attribute operational use of space assets beyond what actors state on the record
- Pad quiet news days with filler or evergreen content
- Use marketing language or exclamation marks
