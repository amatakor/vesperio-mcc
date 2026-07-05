---
prompt-id: mcc.maintain-registry
prompt-version: 0.2.0
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
  `src/data/items.json`, or Gunter's Space Page (space.skyrocket.de).
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
- Touch anything outside `src/data/registry/` and
  `public/data/orbits/facilities.json`. The other files under
  `public/data/orbits/` belong to the deterministic update-orbits
  workflow; never edit them.

## Procedure

1. List profiles: `ls src/data/registry/constellations src/data/registry/vehicles`.
2. Pull current launch/orbit facts from the Launch Library API first;
   it covers most vehicle and launch-count fields in one pass.
3. For constellation fields the API does not cover, check the operator's
   own site and recent items in `src/data/items.json`.
4. Apply changes conservatively: no source, no change.
5. Run `bun run build`; the check scripts must pass.
6. Do not commit or push; the workflow handles it.
