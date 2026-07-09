# REGISTRY_V2_PLAN.md

Registry overhaul: audit findings and implementation spec.
Prepared 2026-07-08 from a full audit of `src/pages.tsx`, `src/index.css`, `src/data/schema.ts`, sample registry entities, `registry-logos.json`, and source research (eoPortal, GCAT, NewSpace Index, Launch Library 2, Wikimedia Commons). Decisions marked (Florian, 2026-07-08) were confirmed interactively and are settled; open items are listed at the end.

---

## 1. Audit summary

**Content.** The schema is disciplined (every field sourced, as_of, optional SNR/tier) but thin. Constellations carry no performance specs at all: no resolution, swath, spectral bands, revisit, frequency bands, or capacity fields exist in the schema. Vehicles have `payload_leo_kg`, `reusable`, `price_per_launch_usd` but no SSO/GTO payload, mass, height, stages, or engines. There is no incident structure anywhere, no positioning/differentiation field, and no events timeline for vehicles or spaceports (constellations and organizations have one). The `TimelineEvent` type has no event-type classification, so funding rounds and launches render identically.

**Known data trap.** `falcon-9.json` shows `first_flight_date: 2018-05-11`, which is Block 5's first flight (the LL2 config tracked), not Falcon 9's. Any vehicle sourced from a variant-specific LL2 config needs a visible variant qualifier or the page reads wrong.

**UI.** Confirmed defects, with root causes:

- **Yellow/green collision.** Source links in the facts table inherit the global accent `--acc: #ffe600` (`index.css` ~1420); the SNR LED uses a separate green OKLCH ramp `--led-1..5` (hue 148). Both render in the same `td.src-cell` 8px apart. A second, unused SNR ramp `--snr-1..5` (red to green) still sits in the CSS.
- **Mixed casing.** Headings, nav, and pane headers get `text-transform: uppercase` from CSS; filter chips (`.sig-tab`), kind/region/domain/status chips (`.chip`, `.chip-notable`), and their label dicts (`REG_FILTERS`, `KIND_LABEL`, `REGION_LABEL`, `ORG_KIND_LABEL`, `DOMAIN_LABEL`) have no transform and are authored lowercase, so they render lowercase. Styling inconsistency, not a data problem.
- **Structural inconsistencies.** `ConstellationBrowser` is a bespoke 4-pane widget while the other three sections share a 3-pane `PaneBrowser`. One global filter-chip row applies across all four sections, so clicking `sar` silently empties vehicles and spaceports. `FaqSection` always renders even with zero sourced answers, while every sibling section hides when empty. The `related` panel mixes affiliation siblings with alphabetical prev/next in one box. Per-domain accents (`--reg-acc`) cover only eo/connectivity/iot; spaceports and ecosystem fall back to yellow.
- **Stock chart.** Hand-rolled SVG polyline, no axes, no gridlines, no hover, no figures beyond a static caption, fixed window, min/max normalized so a flat stock and a volatile one draw the same amplitude. The code comment says "Stooq pipeline" while the rendered credit says "Yahoo Finance"; one of them is wrong and must be fixed to whichever the pipeline actually uses.

**Logos.** 86 entries, strong on EO constellations and organizations, weak on spaceports, agencies partially covered, several vehicles and emerging entities missing. Clearbit's logo API is dead (since 2025-12-01); do not build against it.

---

## 2. Workstream A: Design (registry redesign within house rules)

Scope decision (Florian, 2026-07-08): redesign the registry surface, keep the site-wide brutalist rules (dark, mono structural type, no border-radius, no transform hovers). One house-rule amendment is flagged in A6.

### A1. Role-based color tokens

Replace "yellow accent everywhere" with role tokens, all defined in `:root`:

- `--ink-link`: source/citation links. Muted, low-saturation (e.g. dimmed foreground with underline, or a desaturated steel tone). Source links are plumbing, not calls to action; they must stop competing with the SNR mark.
- `--acc` stays the brand accent for navigation, active states, and genuine emphasis only.
- `--led-1..5` (green ramp) remains the one and only SNR system. Delete the dead `--snr-1..5` ramp and any references.
- Complete `DOMAIN_ACCENT` so all four registry sections have a deliberate accent (add spaceports and ecosystem hues) or drop per-domain accents entirely. Recommendation: complete the set; the partial state is the worst option.

Acceptance: no `#ffe600` element within 24px of an SNR LED on any registry page; grep finds zero uses of `--snr-1..5`.

### A2. One casing rule

Uppercase all structural micro-labels via CSS to match headings: add `text-transform: uppercase` (with the same letter-spacing as `.reg-pane-head`) to `.chip`, `.chip-notable`, `.chip-tag`, `.sig-tab`. Keep body prose, overviews, FAQ answers, and headlines sentence case. Do not rewrite the label dicts; the transform is presentation, and the lowercase-in-data convention stays.

### A3. Registry index

- Merge `ConstellationBrowser` and `PaneBrowser` into one component with an optional extra pane; constellations keep domain > operator > fleet > preview, others get group > entity > preview. Same visual grammar everywhere.
- Scope filters per section. Each section renders only the chips that apply to it (constellations: domain/modality/status; vehicles: class/reusable/status; spaceports: region/status; ecosystem: kind). Kill the global row. A filter can never empty a section it does not apply to.
- Preview cards get logo, two or three headline specs (see A4), and status chip. This is where "sleek grid" lands: tighter cards, real data density, no decorative filler.

### A4. Detail pages

New section order: header (logo, name, type, status) > **key specs panel** > positioning > facts table > incidents > history > stock > children/roster > news events > FAQ > rail (TOC, related, sources).

- **Key specs panel:** a stat-block grid of the 4 to 6 defining numbers per entity type, each with value, unit, as_of, SNR mark, and anchor (mirroring the /stats anchored-block pattern). Constellations: resolution, swath, revisit, sats on orbit (verified), bands. Vehicles: payload LEO/SSO/GTO, height, price, flight record with success rate. Spaceports: launches total, active status, first launch. This panel is the page's reason to exist; the facts table below it becomes the exhaustive reference.
- **Positioning block:** see Workstream C2.
- **Incidents section:** typed timeline, hidden when empty, see C3.
- **Consistency:** FAQ hides when it has zero sourced answers, like every other section. Split `related` into "same operator/affiliation" (chips) and "browse" (prev/next) as two visually distinct rows.
- **Variant qualifier:** when a vehicle's figures come from a variant-specific config (Falcon 9 Block 5), render the variant name beside the vehicle name and per affected stat.

### A5. Stock chart rebuild

Keep it dependency-free SVG (house style), but functional:

- Y-axis with 3 or 4 labeled gridlines in real currency; x-axis date ticks.
- Hover/touch crosshair showing date and close; last close and period change rendered as figures in the header, not a caption.
- Range toggle: 1M / 6M / 1Y / all, client-side from the same series file.
- Baseline option: normalize to a padded min/max window (not raw min/max) so amplitude means something; show absolute range in the axis.
- Fix the attribution mismatch: the rendered credit must name the actual pipeline provider (verify whether `scripts/` fetches Stooq or Yahoo; update both comment and UI to the truth).
- Reserved fixed-height container so missing-data and present-data states do not shift layout.

### A6. House-rule flag (needs CLAUDE.md amendment)

The written rule "one accent colour" is already broken in code by the domain neons and the green SNR ramp. This is the only rule change flagged as necessary: amend CLAUDE.md to codify a small role-based token set (brand accent, domain accents, SNR ramp, link ink) instead of "one accent colour." No other house rule needs to change; dark background, mono structural type, no border-radius, no transform hovers all stay.

---

## 3. Workstream B: Schema extensions (`src/data/schema.ts`)

All new fields are optional `SourcedField<T>` unless noted; null-fill rules, SNR >= 3 entry bar, and provisional/canonical tiers apply unchanged.

### B1. Constellation (EO)

- `resolution_m`: best commercial GSD as stated by source. Where modes differ materially, prefer `imaging_modes`: array of `{ mode, resolution_m, swath_km, source, as_of }` (Capella-style spotlight/stripmap entries; eoPortal states these per mode).
- `swath_km`
- `revisit`: string as stated ("daily, full landmass", "2-5 hours with 8 satellites"); do not coerce to a number the source does not state.
- `spectral_bands`: string[] ("red", "nir", ...) or stated band description.

### B2. Constellation (connectivity/IoT)

- `frequency_bands`: string[] (Ku, Ka, E, L...). Best source: ITU/FCC filings (first-party official record, SNR 5).
- `capacity`: stated throughput per satellite or system, as stated.
- `user_terminals`: stated terminal types/classes.
- `service_type`: broadband, direct-to-device, IoT messaging, as stated.

### B3. Vehicle

- `payload_sso_kg`, `payload_gto_kg`
- `height_m`, `diameter_m`, `mass_kg`, `stages`
- `engines_stage1`: string as stated ("9x Merlin 1D")
- `variant`: plain string qualifier rendered beside figures (fixes the Block 5 trap)
- `events?: TimelineEvent[]` (first flights, certifications, block upgrades, retirements)

### B4. Spaceport

- `events?: TimelineEvent[]` (pad activations, first orbital launch, expansions, incidents)

### B5. Typed timeline + incidents

Add `type` to `TimelineEvent`: enum `launch | funding | corporate | regulatory | contract | milestone | incident`. Existing untyped events default to `milestone`; backfill types opportunistically.

Incidents are timeline events with `type: "incident"` plus optional structured extras: `{ outcome?: string, cause?: string }`, both sourced strings as stated by the source (LL2 `status.name` and `failreason`, GCAT decay records, or press). They render in their own section on the profile AND inline in history. This aligns with the site's existing incident category rules (attribute to the reporting authority, score what the sourcing earns, update when facts land). No invented failure analysis, ever.

### B6. Positioning (hybrid model, Florian 2026-07-08)

New per-entity block:

```
positioning?: {
  claims: SourcedField<string>[];   // each claim stated by its cited page, attributed where a superlative
  mcc_read?: {
    text: string;                   // 1-2 sentences, the house read
    basis: string[];                // source URLs that indirectly support it
    as_of: string;
  }
}
```

Rules: `claims` follow the full sourcing model (an operator superlative is attributed: "Planet describes PlanetScope as the only..."). `mcc_read` is the one explicitly editorial surface in the registry: it must be visibly badged (suggest a bordered "MCC READ" label in the accent color), must list its basis sources, is never scored with an SNR (it is a read, not a claim), and never feeds items, stats, or other registry fields. Update CLAUDE.md registry rules to define this carve-out precisely so scheduled agents cannot mistake it for a sourced-fact field. Drafting the ~90 mcc_read blurbs is editorial work for Florian plus interactive Claude, not the scheduled sweep.

### B7. Validation

Extend `check-registry` to validate the new fields, the event `type` enum, positioning shape, and to fail on any `mcc_read` missing `basis` or exceeding length.

---

## 4. Workstream C: Data backfill pipeline

Accepted new sources (Florian, 2026-07-08): eoPortal, GCAT, NewSpace Index (conditional), ITU/FCC direct.

### C1. Source classes (proposed; math stays in scripts/snr)

| Source | Class | Notes |
|---|---|---|
| eoPortal | Established aggregator, SNR 4 canonical | ESA-run, deep links `/satellite-missions/<slug>`, static HTML. Terms forbid republishing text/images: cite facts + link only, never copy prose, never mirror images. Page-level "last updated" stamps exist but individual figures inside a page carry their own dated status notes; extract the field-level date into `as_of`. |
| GCAT (planet4589.org) | Established aggregator, SNR 4 canonical | CC-BY-4.0 ("may be freely reproduced as long as you cite it"). Structured TSV bulk files. Add the recommended McDowell citation line wherever GCAT-derived figures render, like the Gunter's attribution rule. |
| NewSpace Index | Provisional press-tier, SNR 3, GATED | Terms page did not render during research; a human must verify terms before first citation. Until then use it only as a discovery pointer to primary sources. Single-maintainer site: treat as press, not aggregator. |
| ITU/FCC filings | Official record, SNR 5 canonical | For frequency bands, capacity, market access. Targeted manual/interactive pulls, not bulk crawling. Anti-spoof domain rules apply. |

### C2. Enrichment scripts (new, under `scripts/enrich/`)

Deterministic fetchers in the fetch-thumbs mold, each writing sourced fields with full provenance, never overwriting non-null values (null-fill plus explicit upgrade when a better class is found):

1. `enrich-ll2.ts`: vehicles. Pull `leo_capacity, gto_capacity, sso_capacity, length, diameter, launch_mass, launch_cost, maiden_flight` from launcher configs. Fields are often null per vehicle; write only non-null values. Respect the 15 req/hr free tier (batch weekly in `maintain-registry.yml`). Cross-check `maiden_flight` against variant scope before writing `first_flight_date`.
2. `enrich-gcat.ts`: download TSV catalogs; compute launch histories, object counts, decay/anomaly events per constellation. CC-BY attribution string in output.
3. `enrich-eoportal.ts`: EO constellations. Fetch mission page, extract stated resolution/swath/bands/revisit/orbit per mode. Extraction from prose needs the agent loop (structured scrape is brittle on narrative pages): run it inside `maintain-registry.yml` with the same attest-inputs pattern as sweeps, values must be quoted verbatim from the page.
4. `enrich-incidents.ts`: LL2 launches with `status.name = "Launch Failure"` (plus partial failures) per vehicle; map to typed incident events with `failreason` when present. GCAT decays for satellite-level anomalies once field semantics are confirmed (open item).
5. Wikipedia infobox fallback for vehicle figures the primary sources omit. Research confirmed manufacturer user guides often withhold payload-to-orbit mass (SpaceX: "available upon request") while stating dimensions precisely. Known trap for the agent: adapter/interface mass limits in user guides are NOT payload-to-orbit capacity; never relabel one as the other.

### C3. Ordering

Backfill priority: (1) vehicles via LL2 + Wikipedia (cheap, structured, immediate visible win on key-spec panels), (2) EO constellations via eoPortal (the differentiating content), (3) incidents via LL2, (4) connectivity via ITU/FCC + operator pages (highest value per field, most manual), (5) GCAT anomalies.

### C4. Open verification items before first use

- NewSpace Index actual terms text (human check).
- CelesTrak usage-policy page (fetch was robots-blocked; likely permissive, unconfirmed).
- eoPortal ICEYE page (only Capella and Planet pages were verified during research; fetch before citing ICEYE figures).
- GCAT/CelesTrak field semantics for satellite-anomaly (vs launch-failure) events.

---

## 5. Workstream D: Logos (Wikimedia Commons, reviewed)

Decision (Florian, 2026-07-08): Commons per-file review, re-hosted. No third-party logo API.

- New `scripts/fetch-logos.ts` stage (or extension of the existing pipeline): given a target list (all vehicles, agencies, spaceport operators, remaining orgs), locate the entity's logo file on Wikimedia Commons, record the file page URL, the license tag as stated on that page (PD-textlogo, CC-BY-SA, etc.), author where applicable, and fetch date; re-host under `public/img/registry/logos/` per the existing pattern.
- Per-file human review before merge (the license tag varies per file; pictorial logos may not be PD). Manifest entries without a verified license tag do not ship. Grow via reviewed PRs, mirroring the stock-images.json rule.
- Trademark note: copyright clearance is separate from trademark. Nominative editorial use (identifying the company in a reference profile, no implied endorsement) is the low-risk case; the existing removed-on-request rule extends to logos.
- Fallback stays the initials/mono tile; spaceports without logos can use the tile permanently (many sites have no meaningful mark).

---

## 6. Suggested PR sequence

1. **PR 1, tokens + casing:** role-based color tokens, source-link restyle, delete dead SNR ramp, uppercase chip transforms, complete or drop domain accents. Small, high-visibility, unblocks everything visual.
2. **PR 2, schema + validation:** all Workstream B fields, event typing, positioning shape, check-registry rules. Data-only, no UI.
3. **PR 3, detail page redesign:** key-specs panel, section reorder, incidents section, FAQ/related fixes, variant qualifier.
4. **PR 4, index redesign:** unified pane browser, per-section filters, spec-bearing preview cards.
5. **PR 5, stock chart.**
6. **PR 6+, enrichment scripts** in C3 order, each shipping with its backfilled data so review sees real pages.
7. **PR 7, logos pipeline + first reviewed batch.**
8. **CLAUDE.md amendments** (accent rule, positioning carve-out, new source classes) ride with the PR that implements each.

---

## 7. Remaining open questions for Florian

1. eoPortal SNR class: spec above proposes aggregator/SNR 4 canonical (Gunter's peer). Confirm, or set press-tier 3 provisional.
2. Domain accent hues for spaceports and ecosystem (palette is yours by house rule).
3. Should `mcc_read` blurbs appear on cards/index previews, or detail pages only? (Spec assumes detail pages only.)
4. Stock series provider: confirm Stooq vs Yahoo so the attribution fix states the truth.

---

## 8. Execution status (2026-07-09 session, appended at close)

All workstreams executed as seven commits on main (LOCAL, not pushed; push when Florian says go):

| Commit | Scope |
|---|---|
| 45e0dca | PR1 tokens: --ink-link, dead --snr-1..5 ramp deleted (orbits ripple/ring -> --live), all four section accents, Yahoo attribution fix, CLAUDE.md accent-rule amendment |
| 0126f90 | PR2 schema v2 + validate.ts + 23 tests (305 green); CLAUDE.md positioning carve-out |
| 568b51f | PR5 stock chart (axes, crosshair, 1M/6M/1Y/ALL, padded normalization, range=2y, 21 series refreshed) |
| 1ba9f88 | PR3 detail pages (key specs, positioning/MCC READ, incidents, FAQ/related fixes, variant chip) |
| e58f20d | PR7 logo candidates (246 candidates / 86 entities, LOGO_REVIEW.md checklist; nothing shipped) |
| 2c1f0c0 | PR4 index (unified PaneBrowser, per-section filters, spec preview cards) |
| a2523f9 | PR6a enrichment (enrich-ll2 + enrich-incidents, 25 vehicles enriched, 19 incident events); CLAUDE.md source classes |

Open questions resolved in-session: Q4 = Yahoo Finance (from code). Q1 proceeded with the spec default (eoPortal aggregator 4). Q3 assumed detail pages only. Q2 (accent hues) NOT decided: launch=--neon-hsf, ecosystem=--neon-nav are placeholders from the existing neon set awaiting Florian.

## 9. Next steps (for the next session)

1. FLORIAN: review LOGO_REVIEW.md per file; approved entries then need the re-host + registry-logos.json wiring PR (PR7b).
2. FLORIAN: sign off or replace the launch/ecosystem accent hues (src/pages.tsx SECTION_ACCENT).
3. mcc_read editorial pass: ~90 blurbs, Florian + interactive Claude only (never scheduled runs). Start with flagship profiles (Starlink, Planet, ICEYE, Falcon 9).
4. PR6b eoPortal EO-constellation extraction: agent loop inside maintain-registry.yml (attest-inputs pattern, quote verbatim, cite-facts-only per terms); verify the eoPortal ICEYE page first (C4).
5. PR6c connectivity via ITU/FCC (frequency_bands/capacity at SNR 5) - highest value per field, targeted pulls only.
6. Deferred pending checks: NewSpace Index terms (human), CelesTrak usage policy, GCAT anomaly-vs-launch-failure field semantics; Wikipedia infobox fallback (beware adapter-mass trap, C2.5).
7. Wire enrich-ll2/enrich-incidents into maintain-registry.yml (weekly, after enrich-registry.ts; they are one-shot CLI scripts today).
8. Unrelated standing work: 30-day backfill follow-ups per BACKFILL_PLAN.md (found_none batch audit); site still NOT deployed (Cloudflare Pages, Task 6).
