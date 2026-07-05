# CLAUDE.md — mcc.vesperio.ai (Mission Control Center)

Editorial and operational policy for this repo. Applies to the scheduled ingestion agent and to interactive @claude development work. When these rules conflict with anything else, these rules win.

## What this site is

A machine-maintained tracker for the new space economy: Earth observation, connectivity, launch, and commercial human spaceflight. Site surfaces:

1. **News**: fresh items twice daily, each with a plain-English explainer, tags, a source link, and a visible confidence label. Plus one prerendered static page per item and one filtered feed page per category (SEO surface).
2. **Registry**: standardised reference profiles of constellations and launch vehicles. One prerendered static page per entity. Each profile carries key computed figures (launch cadence, sats on orbit, flight record, growth trend) as anchored, citable stat blocks with as-of dates.
3. **Signals** (influencers): a hand-curated list of people worth following. The agent never edits this section. The list doubles as the whitelist for `signal`-tier sourcing: only people on it (plus named executives of the actor concerned) can be the basis of an item via social posts.
4. **Stats**: a public page of basic computed indices from our own data (launch cadence by provider, sats on orbit by constellation, items tracked), each stat block with an anchor and a pre-formatted citation string with retrieval date, plus a `/stats.json` endpoint. Deeper cross-cutting indices (contract volume by agency, pricing trends, growth analytics) are reserved for the v2 paid layer and must not appear here.
5. **Learn**: parked for a later phase. Do not build or scaffold it without explicit instruction.
6. **Log**: the public sweep changelog, rendered from state.json: every sweep's counters and summary, including zero-add sweeps and why they were quiet. The machine's restraint, visible.

The product promise is reliability. A reader should never catch this site claiming more confidence than its source supports. Confirmed means confirmed; everything less is labelled. Missing a story is acceptable; publishing a false one as fact is not.

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
- Chinese, Indian, Japanese, and European activity gets equal weight to US activity. Non-US coverage is a differentiator, not an afterthought.

**Out of scope:**
- Deep space and planetary science missions with no commercial-provider angle
- Suborbital tourism as routine events (first flights and incidents qualify)
- Conflict analysis, battlefield OSINT, or claims about how space assets are being used operationally, unless stated by the operator or a government on the record
- Rumours, personnel gossip, and social media claims from accounts outside the source ladder (not the actor, not a named executive of it, not on the Signals list)

## Ingestion rules (hard rules, no exceptions)

1. **No source on the ladder, no publish; never overclaim.** Every item links the best available source and carries the confidence tier that source earns (see "The source ladder"). `confirmed` requires a primary source. Tier-2 trade press (SpaceNews, Payload, NASASpaceflight, European Spaceflight, Xinhua) can be the basis of an item at `reported` confidence. Social posts by Signals-list individuals or named executives of the actor can be the basis at `signal` confidence. Every non-confirmed item names its sourcing in the copy ("per SpaceNews", "per @handle on X, unconfirmed"). When a primary source exists, link it and use it; below the signal tier, hold the item.
2. **Never state a fact that is not in the linked source.** No enrichment from model memory for dates, figures, names, or technical specs. Background context from memory is allowed only in the "why it matters" field and must be framed as context, not news.
3. **Numbers are copied, not paraphrased.** Resolutions, prices, masses, orbit parameters, contract values: exact figures from the source or omit them.
4. **Deduplicate before writing.** Check `src/data/items.json` for the same event (same company + same event type within 7 days). Update the existing item rather than creating a duplicate.
5. **When uncertain, hold.** An item held for one cycle costs nothing. A wrong item costs the site's credibility. Write held items to `src/data/held.json` with a one-line reason for human review.
6. **State-media handling.** Facts of record (launch occurred, satellite count) from Chinese state sources are publishable. Claims about performance, commercial success, or intent are labelled "per [source], unverified."
7. **Never fabricate a URL.** Only link URLs actually fetched during the run.

## The source ladder

An item's confidence is set by the best source it has. Three tiers, and the copy never claims more than its tier.

**`confirmed` requires a primary source.** A primary source is the actor itself or an official record of the event. Concretely:
1. Statements by the company the item is about: press releases, official newsroom/blog posts, official corporate social accounts, investor relations pages
2. Regulatory and legal records: FCC/ITU/NOAA filings, SEC filings, court documents, export-control and sanctions notices in official registers
3. Government and agency statements: contract award notices (SAM.gov, esa-star, TED), official agency press releases, on-the-record statements published by the government itself
4. Financial disclosures: earnings releases, 8-Ks, investor presentations hosted by the company
5. Direct observational data: launch webcasts, Space-Track/CelesTrak orbital data, Launch Library records for launch occurrence facts
6. Recorded first-party statements: earnings call transcripts, executives speaking on stage where a recording or official transcript is linkable

**`reported` allows credible trade press as the basis.** Wire services and trade press (Reuters, SpaceNews, Payload, European Spaceflight, NASASpaceflight) reporting with named sources, direct quotes, or documents they publish. The item names the outlet in the copy ("per SpaceNews"). If the outlet merely relays a company statement, link the company statement instead and confirm. Unnamed-source reporting from these outlets is also `reported`, phrased as such ("Reuters reports, citing unnamed sources").

**`signal` allows curated voices as the basis.** Posts on X or other social platforms by individuals on the Signals whitelist (`whitelist: "yes"` in `src/data/signals.json`, via `verified_active` channels, honoring their `ingest_rules`) or by named executives or officials of the actor, speaking about their own organisation or domain. The item names the account and flags it in the copy ("per @handle on X, unconfirmed"). Everyone outside the ladder (anonymous accounts, random aggregators, forum posts) does not qualify at any tier.

**Upgrade rule.** When a better source appears for a published item, upgrade it via an update: switch source_url to the better source, raise the confidence tier, keep the id.

**Presentation of non-confirmed items.** The sourcing is named in the headline itself ("SpaceNews: ..." for reported, "Per @handle: ..." for signal). Item media carries an UNVERIFIED banner. The item page shows an evidence block: who said it, on what basis (named sources, documents, count of corroborating outlets), and what would confirm or deny it, with the expected timing when the source states one. Announcements of record (a signed contract, a completed launch) should be re-checked against a corporate or official source in the next sweeps and upgraded when possible.

**Edge cases:**
- State media (Xinhua, TASS) on state programs: primary for facts of record, `reported` for everything else, origin always labelled.
- Aggregator databases (Gunter's Space Page, NextSpaceflight): reference material for the registry, not a basis for news items. Gunter's terms permit summarization/RAG only with clear attribution and a direct link to the original URL; therefore every registry field based on it carries the exact page URL (deep link, never the homepage) in its `source`, registry pages render a visible attribution notice when Gunter's data is present, and only facts stated on that single page are used (no summing across pages).
- Leaked documents: out of scope entirely. Hold until officially confirmed or reported so widely the actor responds on record; then the response is the source.

Test to apply: could the linked source itself be wrong about the fact without the actor or official record being wrong? If yes, it is not primary, and the item cannot be `confirmed`.

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
  "tags": [],
  "category": "",
  "impact": "",
  "companies": [],
  "source_url": "primary source, required",
  "secondary_urls": [],
  "confidence": ""
}
```

**Categories** (exactly one): `launch`, `constellation`, `contract`, `procurement`, `regulatory`, `financial`, `product`, `partnership`, `incident`, `geopolitical`, `human-spaceflight`.

**Impact** (exactly one):
- `critical`: reshapes competitive dynamics (major M&A, operator failure, flagship program cancellation, first flight of a new vehicle)
- `notable`: matters to anyone tracking the sector (contract awards, constellation expansions, funding rounds, regulatory grants)
- `routine`: worth logging, not worth a push (scheduled launch success, minor product update)

**Confidence** (exactly one): `confirmed` (primary source: the actor itself or an official record), `reported` (credible trade press with named sourcing; outlet named in the copy), `signal` (Signals-list individual or named executive on social; account named and flagged "unconfirmed" in the copy).

**Tags**: lowercase, reuse existing tags before inventing new ones; newly coined tags are logged in the sweep entry for human review. Four tiers:
- Domain (every item carries one where applicable): `eo`, `connectivity`, `launch`, `human-spaceflight`
- Modality: `sar`, `optical`, `hyperspectral`, `rf`, `ghg`, `direct-to-device`, `heavy-lift`, `smallsat-launch`, `rideshare`, `reusability`
- Geography: `china`, `india`, `europe`, `japan`, `mena`, `us-gov`, `esa`
- Theme: `pricing`, `export-control`, `sanctions`, `m-and-a`, `funding`, `bankruptcy`, `commercial-crew`, `commercial-stations`

## Writing style

- Plain declarative English. No hype ("game-changing", "revolutionary", "milestone"), no press-release voice.
- "Why it matters" is written for a commercial director at an operator or reseller, not for space fans. Assume the reader knows what SAR is; tell them what the event changes.
- Attribute claims: "ICEYE says", "per the FCC filing", "the 8-K states".
- No em dashes anywhere on the site.
- Headlines name the actor first: "Firefly wins NASA VADR task order", not "NASA awards task order to Firefly".

## Item images

Card and item artwork is stamped exclusively by the deterministic `scripts/fetch-thumbs.ts` pipeline, in this priority order:

1. The source's own og:image / twitter:image (the image the publisher designates for link previews), re-hosted under `public/img/items/`, credited to the source host, linked to the source page.
2. A curated freely licensed stock image from `src/data/stock-images.json`, keyed by source domain (e.g. sec.gov filings get the SEC headquarters photo). Every entry records license, author, and origin URL; the map grows only via reviewed PRs with the license verified.
3. Nothing: the site renders a generated mono text tile from the item's own fields.

Never: image search results, AI-generated imagery of real events, official agency seals (legally restricted), or images hand-picked by the drafting agent. Any image is removed on request from its rights holder by setting the item's `image` to null.

Signals avatars follow the same logic via `scripts/fetch-avatars.ts`: the profile picture of the exact account the card links to, re-hosted under `public/img/signals/`, initials tile when none is fetchable, removed on request from the person concerned by deleting the file and manifest entry.

## Scheduled run procedure (update-items.yml)

1. Read `SWEEP_MEMORY.md` first. It contains lessons from past runs (flaky sources, recurring dedup traps, style corrections). Apply them.
2. Load `src/data/sources.json`. Fetch each source with `status` of `verified` or `unverified`. On first successful fetch of an `unverified` source, flip it to `verified`; after 3 consecutive failures, flip to `dead` and add a note.
3. Collect candidate items newer than the last run timestamp in `src/data/state.json`.
4. Filter against scope. Discard out-of-scope items silently.
5. For each candidate: verify against a tier-1 source, apply the hard rules, write the item or hold it.
6. Run the build (`bun run build`) to confirm the feed parses and the site builds before committing. A commit that breaks the build is worse than a skipped run.
7. Append new lessons to `SWEEP_MEMORY.md` (source behaviour changes, mistakes caught, judgment calls worth remembering). Keep entries short and dated.
8. Commit with message `ingest: N new, M updated, K held (YYYY-MM-DD HH:MM UTC)`.
9. If a run produces zero items, still write and commit the sweep log entry in state.json; the public /log/ page renders it, and a quiet day explained is a trust signal. Feed content is never padded: no items, no filler, on quiet days.

Registry updates run in a separate scheduled workflow (`maintain-registry.yml`), lower cadence (weekly): update factual fields (sats on orbit, flight counts, next flight) from Launch Library and published items only, every change carrying `source` and `as_of`. Never restructure the registry in a scheduled run.

## Registry rules

- Scope (extended 2026-07-05): constellations (EO, connectivity, IoT; fleet-level parents may carry named child constellations via the parent field), orbital launch vehicles, spaceports (grouped by region), and ecosystem organizations (manufacturer, in-space-services, ground-segment, institution, finance). One profile per entity, uniform fields per entity type.
- No free-form essays, with one exception: a profile may carry a short overview block (2-4 sentences) stored as a sourced field like any other; every claim in it must be backed by that field's source URL and as_of date. Anything the source does not state stays out of the overview.
- Every field carries a `source` and `as_of` date. Unknown fields stay `null`; never estimate.
- Structural edits (new fields, new entries) happen only via @claude issues reviewed by Florian, never in scheduled runs.

## Development rules (@claude interactive)

- Stack mirrors the AI/TLDR blueprint: React + Vite + TypeScript, Bun for scripts and package management, per-page prerender script for SEO, deployed on Cloudflare Pages, data as JSON files in `src/data/`. No database, no backend.
- Design language: brutalist editorial, rebuilt in our own code (do not copy blueprint CSS verbatim; no license grants that). House rules carried over: no border-radius anywhere, no transform-based hovers, mono type for structural elements, dark background, one accent colour. Vesperio palette to be defined by Florian before the first UI PR.
- Build must include schema validation scripts (check-feed, check-registry) that fail the build on malformed data, mirroring the blueprint's check-*.ts pattern.
- Don't touch `src/data/items.json` history in dev PRs.
- Keep API cost in mind: filtering with a cheaper model, writing with a better one, is the intended pattern once volume justifies it.

## Things the agent must never do

- Publish from a source outside the ladder, or at a higher confidence than the source earns
- Invent, estimate, or "recall" numbers, dates, or URLs
- Edit the Signals/influencers list
- Widen scope beyond the Scope section without an explicit instruction from Florian
- Analyse conflicts or attribute operational use of space assets beyond what actors state on the record
- Pad quiet news days with filler or evergreen content
- Use marketing language or exclamation marks
