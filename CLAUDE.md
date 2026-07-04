# CLAUDE.md — mcc.vesperio.com (Mission Control Center)

Editorial and operational policy for this repo. Applies to the scheduled ingestion agent and to interactive @claude development work. When these rules conflict with anything else, these rules win.

## What this site is

A machine-maintained tracker for the new space economy: Earth observation, connectivity, launch, and commercial human spaceflight. Site surfaces:

1. **News**: fresh items twice daily, each with a plain-English explainer, tags, and a primary-source link. Plus one prerendered static page per item and one filtered feed page per category (SEO surface).
2. **Registry**: standardised reference profiles of constellations and launch vehicles. One prerendered static page per entity. Each profile carries key computed figures (launch cadence, sats on orbit, flight record, growth trend) as anchored, citable stat blocks with as-of dates.
3. **Signals** (influencers): a hand-curated list of people worth following. The agent never edits this section.
4. **Stats**: a public page of basic computed indices from our own data (launch cadence by provider, sats on orbit by constellation, items tracked), each stat block with an anchor and a pre-formatted citation string with retrieval date, plus a `/stats.json` endpoint. Deeper cross-cutting indices (contract volume by agency, pricing trends, growth analytics) are reserved for the v2 paid layer and must not appear here.
5. **Learn**: parked for a later phase. Do not build or scaffold it without explicit instruction.

The product promise is reliability. A reader should never catch this site being wrong. Missing a story is acceptable; publishing a false one is not.

## Scope

The platform tracks new space events: the commercial space economy and the events that move it.

**In scope:**
- Commercial EO operators and their constellations (optical, SAR, hyperspectral, RF, GHG)
- Connectivity constellations and operators (Starlink, Kuiper, OneWeb/Eutelsat, AST SpaceMobile, GEO operators when the event is new-space relevant)
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
- Rumours, personnel gossip, unsourced social media claims

## Ingestion rules (hard rules, no exceptions)

1. **No primary source, no publish.** Every item must link a tier-1 source from `src/data/sources.json`. Tier-2 sources (SpaceNews, Payload, NASASpaceflight, European Spaceflight, Xinhua) are for discovery only. If a tier-2 outlet reports something, find the primary source it is based on. If none exists yet, hold the item.
2. **Never state a fact that is not in the linked source.** No enrichment from model memory for dates, figures, names, or technical specs. Background context from memory is allowed only in the "why it matters" field and must be framed as context, not news.
3. **Numbers are copied, not paraphrased.** Resolutions, prices, masses, orbit parameters, contract values: exact figures from the source or omit them.
4. **Deduplicate before writing.** Check `src/data/items.json` for the same event (same company + same event type within 7 days). Update the existing item rather than creating a duplicate.
5. **When uncertain, hold.** An item held for one cycle costs nothing. A wrong item costs the site's credibility. Write held items to `src/data/held.json` with a one-line reason for human review.
6. **State-media handling.** Facts of record (launch occurred, satellite count) from Chinese state sources are publishable. Claims about performance, commercial success, or intent are labelled "per [source], unverified."
7. **Never fabricate a URL.** Only link URLs actually fetched during the run.

## What counts as a primary source

A primary source is the actor itself or an official record of the event. Concretely:

**Primary (tier 1, publishable basis):**
1. Statements by the company the item is about: press releases, official newsroom/blog posts, official corporate social accounts, investor relations pages
2. Regulatory and legal records: FCC/ITU/NOAA filings, SEC filings, court documents, export-control and sanctions notices in official registers
3. Government and agency statements: contract award notices (SAM.gov, esa-star, TED), official agency press releases, on-the-record statements published by the government itself
4. Financial disclosures: earnings releases, 8-Ks, investor presentations hosted by the company
5. Direct observational data: launch webcasts, Space-Track/CelesTrak orbital data, Launch Library records for launch occurrence facts
6. Recorded first-party statements: earnings call transcripts, executives speaking on stage where a recording or official transcript is linkable

**Edge cases:**
- Executive personal social accounts (e.g. a CEO posting on X): primary for that person's stated intent, but confidence is `reported` until echoed by a corporate channel or filing. Announcements of record (a signed contract, a completed launch) still need a corporate or official source.
- State media (Xinhua, TASS) on state programs: primary for facts of record, `reported` for everything else, origin always labelled.
- Wire services and trade press (Reuters, SpaceNews, Payload): never primary, regardless of quality. They are discovery and cross-check. If Reuters cites a company statement, link the company statement; if it cites unnamed sources, the item holds until an actor confirms.
- Aggregator databases (Gunter's, NextSpaceflight): reference material for the registry, not a basis for news items.
- Leaked documents: out of scope entirely. Hold until officially confirmed or reported so widely the actor responds on record; then the response is the source.

Test to apply: could the linked source itself be wrong about the fact without the actor or official record being wrong? If yes, it is not primary.

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

**Confidence** (exactly one): `confirmed` (primary source is the actor itself or an official record), `reported` (credible primary-adjacent source, actor has not confirmed).

**Tags**: lowercase, reuse existing tags before inventing new ones. Seed set: `sar`, `optical`, `hyperspectral`, `rf`, `ghg`, `connectivity`, `direct-to-device`, `smallsat-launch`, `heavy-lift`, `rideshare`, `pricing`, `china`, `india`, `europe`, `japan`, `mena`, `us-gov`, `esa`, `export-control`, `sanctions`, `m-and-a`, `funding`, `bankruptcy`, `reusability`, `commercial-crew`, `commercial-stations`.

## Writing style

- Plain declarative English. No hype ("game-changing", "revolutionary", "milestone"), no press-release voice.
- "Why it matters" is written for a commercial director at an operator or reseller, not for space fans. Assume the reader knows what SAR is; tell them what the event changes.
- Attribute claims: "ICEYE says", "per the FCC filing", "the 8-K states".
- No em dashes anywhere on the site.
- Headlines name the actor first: "Firefly wins NASA VADR task order", not "NASA awards task order to Firefly".

## Scheduled run procedure (update-items.yml)

1. Read `SWEEP_MEMORY.md` first. It contains lessons from past runs (flaky sources, recurring dedup traps, style corrections). Apply them.
2. Load `src/data/sources.json`. Fetch each source with `status` of `verified` or `unverified`. On first successful fetch of an `unverified` source, flip it to `verified`; after 3 consecutive failures, flip to `dead` and add a note.
3. Collect candidate items newer than the last run timestamp in `src/data/state.json`.
4. Filter against scope. Discard out-of-scope items silently.
5. For each candidate: verify against a tier-1 source, apply the hard rules, write the item or hold it.
6. Run the build (`bun run build`) to confirm the feed parses and the site builds before committing. A commit that breaks the build is worse than a skipped run.
7. Append new lessons to `SWEEP_MEMORY.md` (source behaviour changes, mistakes caught, judgment calls worth remembering). Keep entries short and dated.
8. Commit with message `ingest: N new, M updated, K held (YYYY-MM-DD HH:MM UTC)`.
9. If a run produces zero items, still write the sweep log entry, but commit no feed changes. Do not pad quiet days.

Registry updates run in a separate scheduled workflow (`maintain-registry.yml`), lower cadence (weekly): update factual fields (sats on orbit, flight counts, next flight) from Launch Library and published items only, every change carrying `source` and `as_of`. Never restructure the registry in a scheduled run.

## Registry rules

- v1 scope: EO constellations, connectivity constellations, and orbital launch vehicles. One profile per entity, uniform fields per entity type, no free-form essays.
- Every field carries a `source` and `as_of` date. Unknown fields stay `null`; never estimate.
- Structural edits (new fields, new entries) happen only via @claude issues reviewed by Florian, never in scheduled runs.

## Development rules (@claude interactive)

- Stack mirrors the AI/TLDR blueprint: React + Vite + TypeScript, Bun for scripts and package management, per-page prerender script for SEO, deployed on Cloudflare Pages, data as JSON files in `src/data/`. No database, no backend.
- Design language: brutalist editorial, rebuilt in our own code (do not copy blueprint CSS verbatim; no license grants that). House rules carried over: no border-radius anywhere, no transform-based hovers, mono type for structural elements, dark background, one accent colour. Vesperio palette to be defined by Florian before the first UI PR.
- Build must include schema validation scripts (check-feed, check-registry) that fail the build on malformed data, mirroring the blueprint's check-*.ts pattern.
- Don't touch `src/data/items.json` history in dev PRs.
- Keep API cost in mind: filtering with a cheaper model, writing with a better one, is the intended pattern once volume justifies it.

## Things the agent must never do

- Publish without a primary source
- Invent, estimate, or "recall" numbers, dates, or URLs
- Edit the Signals/influencers list
- Widen scope beyond the Scope section without an explicit instruction from Florian
- Analyse conflicts or attribute operational use of space assets beyond what actors state on the record
- Pad quiet news days with filler or evergreen content
- Use marketing language or exclamation marks
