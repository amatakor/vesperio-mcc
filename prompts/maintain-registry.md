---
prompt-id: mcc.maintain-registry
prompt-version: 0.3.0
output-target: src/data/registry/** + public/data/orbits/facilities.json
---

# MCC — Registry Maintenance (weekly)

Keeps registry profiles factually current. This is evergreen-catalog
work, separate from the news sweep. CLAUDE.md's Registry rules govern.

## What you may do

- Update factual fields on EXISTING profiles: sats on orbit, launches
  performed, flight record, next scheduled flight, operational status,
  constellation phase, and the overview field (2-4 sentences; every
  claim must appear in that field's single source, per CLAUDE.md
  registry rules).
- Every changed field gets a fresh `as_of` (today) and a `source` URL
  fetched this run. Allowed bases: Launch Library API, the operator's
  own published material, official filings, a published item in
  `src/data/items.json`, Gunter's Space Page (space.skyrocket.de), or
  eoPortal (www.eoportal.org, see the EO spec section below).
- Gunter's terms: summarization/RAG only with clear attribution and a
  direct link. Use the exact page URL as `source` (never the homepage),
  and only facts stated on that single page; never sum counts across
  multiple Gunter's pages into one figure. The site renders the
  attribution notice automatically from the source URLs.
- Set a field to `null` with a note if its previous source is gone and
  no current source exists. Null beats stale.
- Curate the Orbits ground layer, `public/data/orbits/facilities.json`
  (schema in `src/data/schema.ts`, OrbitsFacility): verify existing pins
  against their `source_url` and update blurbs that have gone stale; add
  missing operator HQ pins ONLY when a citable source states the location
  (company site, filing, or reputable press) fetched this run. No source,
  no pin. Coordinates are derived from the sourced address at city-block
  precision. Every pin's `operator_slug` must match an existing registry
  profile. Remove a pin when its facility is documented as closed.

## What you must never do

- Add, remove, rename, or restructure profiles or fields. Those changes
  go through reviewed PRs opened by Florian.
- Estimate, interpolate, or carry a number forward without re-verifying.
- Touch anything outside `src/data/registry/`,
  `public/data/orbits/facilities.json`, and the crossfeed queue
  `src/data/registry-candidates.json` (which you consume, step 1). The
  other files under `public/data/orbits/` belong to the deterministic
  update-orbits workflow; never edit them.

## Procedure

1. **Consume the crossfeed queue FIRST.** Read
   `src/data/registry-candidates.json` (written by finalize-sweep from
   attested facts on scored news items). For every entry, do exactly one
   of these, then REMOVE the entry from the queue (entries leave the
   queue only by being consumed):
   - Land it: for `null_fill` and `flag_refresh` entries, verify the
     item's source URL still states the value, then write the field with
     that URL as `source`, today's `as_of`, and the SNR its class earns
     (see below). `flag_refresh` means the news claim outranked the
     stored fact; refresh the field from the stronger source.
   - Reject it: when the source no longer states the value, the value
     fails the field's shape, or the metric does not truly match. Record
     one line per rejection in your run summary with the reason.
   - Queue it for Florian: `both_disputed_queue` entries and anything
     genuinely ambiguous become a `held.json`-style note in your run
     summary; for a disputed fact, add the competing claim to the
     field's `disputed.competing` list instead of overwriting.
   - `annotate_mismatch`, `below_entry_bar`, and `no_registry_change`
     entries are informational: consume them (remove from the queue),
     no registry write.
2. List profiles: `ls src/data/registry/constellations src/data/registry/vehicles`.
3. Pull current launch/orbit facts from the Launch Library API first;
   it covers most vehicle and launch-count fields in one pass. (The
   deterministic `scripts/enrich-registry.ts` step has already run
   before you; do not repeat its null-fills, work on what it left.)
4. For constellation fields the API does not cover, check the operator's
   own site and recent items in `src/data/items.json`.
5. Apply changes conservatively: no source, no change.
6. Run `bun run build`; the check scripts must pass.
7. Do not commit or push; the workflow handles it.

## EO spec extraction from eoPortal (registry v2, 2026-07-09)

A continuing null-fill task: EO constellations carry v2 capability
fields (`resolution_m`, `swath_km`, `revisit`, `spectral_bands`,
`imaging_modes`) and most profiles still lack them. Each run, pick up
to 5 EO constellation profiles missing these fields and try their
eoPortal mission page (`https://www.eoportal.org/satellite-missions/<slug>`).
The 2026-07-09 interactive backfill filled 13 profiles; match its
field shapes exactly (any of those profiles is a template).

- **Slug discovery.** Guessing slugs yields SOFT 404s: the page returns
  HTTP 200 with only nav/footer (the ICEYE page lives at
  `iceye-constellation`, not `iceye`; Satellogic at `newsat`). A page
  with no mission prose is a miss, not an empty mission. Find the real
  slug via a site search (`site:eoportal.org <operator>`), and confirm
  the page describes THIS constellation before extracting (the `dove`
  page is a 2013 tech demo, not PlanetScope).
- **eoPortal terms (cite facts only).** Extract stated figures and cite
  the deep link; NEVER copy prose sentences into `overview` or any text
  field, never mirror images. Short verbatim quotes inside the
  `snr_trace.reason` line (to pin which sentence states the figure) are
  the one allowed quotation.
- **Verbatim numbers.** Copy figures exactly as stated. A stated range
  ("10-30 km swath") is never reduced to one number: keep the range in
  the imaging-mode name or notes and leave the numeric field null. A
  non-square SAR resolution ("5 m x 20 m") likewise stays in the mode
  name. `resolution_m` takes the best single resolution the page states
  for the constellation; unit-convert cm to m, nothing else.
- **Design aims are not capabilities.** Figures stated with "aims to",
  "expected to", "under development" may be carried ONLY with the
  qualifier named in the trace reason and notes; a mode described as
  under development gets no imaging_modes row.
- **Dated statements.** Record the page's "Last updated" date in notes
  when figures could age; when a figure carries its own dated status
  note on the page, that date governs how you describe it.
- Per-mode figures go to `imaging_modes` rows (`mode`, `resolution_m`,
  `swath_km`, `source`, `as_of`, no SNR fields on rows); a SAR band
  ("X-band") or an RF frequency range is a `spectral_bands` value as
  stated. All scored fields take eoPortal's aggregator class: `"snr": 4`,
  `"tier": "canonical"`, trace per the section below. Null-fill and
  upgrade only, as everywhere in the registry.

## SNR fields on registry writes (SNR_SPEC.md, 2026-07-06)

Every field you fill or refresh carries the SNR its source class earns,
alongside `source` and `as_of`:

- CelesTrak / Space-Track / Launch Library records: `"snr": 5` (Launch
  Library reference pages: `"snr": 4`), `"tier": "canonical"`.
- Gunter's, eoPortal, and other established aggregators: `"snr": 4`,
  `"tier": "canonical"`.
- A single reputable press source: `"snr": 3`, `"tier": "provisional"`.
- Wikipedia and first-party pages (the entity's own site, agency pages
  for their own programs): NO snr/tier/trace fields at all; the source
  link is the whole story.

Scored fields also need an `snr_trace`:
`{ "base": { "tier": N, "source": "<the field's source URL>", "reason": "<one line>" }, "modifiers": [], "final": N, "scorer_version": 1 }`
with `final` equal to `snr` and to `base.tier`. `check-registry` rejects
anything inconsistent (provisional must be exactly 3, canonical 4-5).

Never overwrite a filled field with a lower-SNR source; upgrade only.
A value that contradicts an existing canonical fact is not written: note
the conflict for Florian instead (same-metric contradictions are his
queue). Provisional facts never adjudicate anything.
