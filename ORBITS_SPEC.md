# MCC Orbits Surface - Specification v1.2

Status: approved, build as first fast-follow after the core five surfaces ship.
Owner: Florian. Implementation: Claude Code. This file is the source of truth for the feature.

---

## 1. Purpose

A real-time 3D view of the constellations tracked in the MCC Registry, orbiting a rotatable wireframe Earth, with ground layers for active spaceports and industry facilities. It is the Registry rendered physically: every satellite and ground marker links back to its Registry page. It is not a whole-sky tracker; scope is MCC's coverage, nothing more.

## 2. Route & placement

- Route: `/orbits`
- Deep links: `/orbits?constellation=<registry-slug>` (opens with that constellation highlighted and its layer enabled)
- Nav: new top-level tab alongside News / Registry / Signals / Stats
- The 3D bundle (three.js, satellite.js) must be code-split at the route level. No other page pays for it.

## 3. Design language (binding)

Digital, wireframe, tactical. Mission-control aesthetic, matching the MCC name. No photographic textures anywhere.

**Governing rule: Orbits is an MCC surface, not an embedded globe widget.** Before styling anything, read MCC's existing theme (CSS variables / design tokens, typography, panel and border conventions, header and nav). Every chrome element on this page (nav, HUD panels, toggles, popups, legend, footer) uses those tokens directly. The only additions this feature is allowed to make to the theme are the tokens defined below, and they must be added to the shared theme file, not hardcoded in Orbits components.

**Color model, two tiers:**

1. **Base (quiet):** everything structural stays in MCC's existing palette.
   - Page background: MCC's dark background token.
   - Earth: the opaque occluding sphere is filled with a deep, dark desaturated blue (the oceans). Dark enough that neon points glow against it; it should read as "dark mode blue," not a bright map.
   - Coastlines: thin line segments from Natural Earth 110m coastline GeoJSON (or the `world-atlas` TopoJSON package) projected onto the sphere, in a low-opacity desaturated line color from MCC's tokens.
   - Graticule: latitude/longitude grid at 15° spacing, dimmer than the coastlines.
   - Optional stretch: dot-matrix landmass fill (point cloud sampled on land) instead of, or beneath, the coastlines. Prototype both, pick one, don't ship both.
2. **Data (loud):** neon accents are reserved exclusively for data, meaning satellites, orbit arcs, ground-marker accents, and their legend swatches. Neon never appears in chrome, text, panel borders, or backgrounds. This keeps the tactical base quiet and makes the data the only thing that glows.

**Neon category coding:**

- Color is assigned by category, not by constellation. One neon hue per Registry category: EO, connectivity, IoT, human spaceflight, plus a reserve hue for anything uncategorized. Define these as named tokens in the MCC theme (e.g. EO neon green, connectivity magenta, IoT cyan, human spaceflight amber; exact values chosen for separation on the dark blue globe, verified with a deuteranopia/protanopia simulator).
- The category is a field on each Registry constellation entry; the globe derives point color from it. IoT is its own category, distinct from broadband connectivity (Swarm/Kinéis-type constellations vs Starlink/OneWeb-type).
- Per-constellation identity is handled by interaction, not color: the HUD legend lists constellations grouped by category and doubles as the filter; selecting a constellation brightens its members to full intensity and drops everything else to ~30% desaturated.
- These category tokens are shared theme assets: Stats charts and Registry pages reuse the same category colors later.

**Rendering rules:**

- **Occlusion:** lines and markers on the far side of the globe must be hidden or heavily dimmed. Standard trick: render the occluding sphere at a slightly smaller radius than the line layer.
- **Satellites:** GL points with a subtle glow (additive blending), colored by category as above. Uniform point size. Selected constellation brightens to full intensity; everything else drops to ~30% and desaturates.
- **Orbit paths:** drawn only on selection (one satellite or one constellation), as a thin arc in the category's neon. Never draw all orbits at once.
- **Ground markers:** distinct glyph per type, drawn in the base line color with a neon accent only on hover/selection. Spaceports: triangle or ring-pulse. Facilities: square. HQs: small dot. Billboarded sprites, same wireframe style.
- **Popups/HUD:** MCC panel styling; thin borders with corner ticks, monospace numerals, sentence-case labels. No rounded cards, no drop shadows. The selected item's neon may appear only as a small identity swatch/tick inside the panel, not as panel color.
- **Motion:** satellites move in real time (their actual propagated positions). Idle globe auto-rotates slowly; any user interaction stops auto-rotation permanently for the session. Respect `prefers-reduced-motion` (no auto-rotation, no pulse animations).

## 4. Interaction model

- **Rotate/zoom:** OrbitControls. Drag to rotate, scroll/pinch to zoom. Touch-first: this must work on mobile.
- **Primary selection is tap/click**, on satellites and ground markers alike. Hover is a desktop-only enhancement showing the same popup. Never gate information behind hover.
- **Layer toggles**, in a compact HUD panel:
  - Constellations: ON by default (with per-constellation sub-toggles or a filter list)
  - Spaceports: ON by default
  - Facilities & HQs: OFF by default
- **Satellite popup:** name, operator, constellation, category, altitude (km), inclination, current lat/lon, link to Registry constellation page.
- **Spaceport popup:** name, country, total launches (all-time), next launch (vehicle, mission, NET date), upcoming launch count, vehicles served (list), link to source (LL2 wiki/info URL where present).
- **Facility/HQ popup:** name, operator, type (HQ / production / test / launch), one-line description, link to Registry operator page.

## 5. Data contracts

All data ships as static JSON under `/data/orbits/`, produced by the existing pipelines. The client never calls external APIs directly.

### 5.1 `elements-<constellation-slug>.json` — orbital elements

- **Source:** CelesTrak GP data, `https://celestrak.org/NORAD/elements/gp.php`
- **Format: OMM JSON (`FORMAT=JSON`), not legacy TLE.** Non-negotiable: 5-digit catalog numbers are exhausting (~mid-July 2026); new objects get 6-digit numbers that the TLE format cannot represent. satellite.js ingests OMM directly via `json2satrec`.
- **Queries:** use `GROUP=` for constellations with a dedicated CelesTrak group (Starlink, OneWeb, Planet, Spire, Iridium, and others; enumerate at build time). Fall back to `NAME=` queries against the active catalog for operators without a group (likely ICEYE, BlackSky, Capella; verify per operator). Map results to Registry entries by name pattern, defined per constellation in the Registry data.
- **Cadence:** fetched by the existing 12-hour cron. CelesTrak updates at most every 2 hours and asks users not to poll more often; 12 hours is polite and accurate enough (SGP4 from elements a few days old is still within a few km, fine for visualization).
- **File shape:** one file per constellation so layers load on demand. Strip OMM fields not needed by `json2satrec` to cut payload. Cloudflare compression (gzip/brotli) handles the rest; a full Starlink file is roughly 4–5 MB raw and compresses well, and it only loads if that layer is enabled.
- Each file carries a `fetched_at` timestamp.

### 5.2 `spaceports.json` — active launch sites with stats

- **Source:** Launch Library 2 (The Space Devs), `https://ll.thespacedevs.com/2.3.0/`
- **Scope:** ALL active orbital launch sites globally, including Chinese and Russian sites. Definition of active: at least one active pad, or at least one upcoming launch. No curated shortlist.
- **Build (cron, 12-hour):**
  1. Fetch `locations` (paginated) → name, country, lat/lon, `total_launch_count`.
  2. Fetch `launches/upcoming` (limit 100) → per location: upcoming count, next launch (name, vehicle, NET), and the set of rocket configurations = "vehicles served" (dedupe; supplement with recent past launches if upcoming is sparse for a site).
  3. Emit one merged `spaceports.json` with `fetched_at`.
- **Rate limits:** the free tier is throttled (recalled as ~15 requests/hour; VERIFY in TSD docs at build time). The cron needs roughly 3–5 calls per run, safely inside any plausible limit. Add exponential backoff on 429.

### 5.3 `facilities.json` — hand-curated ground layer

- No API exists for this. Curated file maintained through the weekly registry maintenance workflow.
- **Contents:** SpaceX major facilities (Starbase, Hawthorne, McGregor, launch leases where not already in spaceports), Blue Origin (Kent, Huntsville, LC-36, Corn Ranch if not covered by LL2), and HQ coordinates for every operator in the Registry.
- **Fields:** `name`, `operator_slug` (Registry link), `type` (hq | production | test | launch), `lat`, `lon`, `blurb`, `source_url`.
- **Editorial rule applies:** every entry needs a citable source (company site, filing, or reputable press). No source, no pin.

## 6. Rendering & performance requirements

- **Stack:** three.js via react-three-fiber + drei (OrbitControls), satellite.js for SGP4/SDP4 propagation. All client-side; no server.
- **Propagation:** per animation frame is fine below ~2,000 concurrently visible objects. Above that (i.e. Starlink layer on), move SGP4 into a Web Worker writing positions to a transferable typed array, with the render thread interpolating between worker updates (1–2 s cadence is plenty). Precedent: stuffin.space and satellitetracker3d.com render 20k+ objects this way.
- **Instancing:** all satellites in a single `Points` / instanced draw call per category. No per-satellite meshes.
- **Budgets:** 60 fps desktop, 30 fps mobile mid-tier, initial route JS < 500 KB gzipped before element data, elements loaded per enabled layer only.
- **Failure modes:** if an elements file is stale (> 7 days) or missing, show the layer with a "data stale/unavailable" HUD notice rather than silently rendering old positions as current. If WebGL is unavailable, show a static fallback message linking to the Registry.

## 7. Credibility requirements (per CLAUDE.md principles)

- Footer/HUD attribution: "Orbital data: CelesTrak (Dr. T.S. Kelso). Launch data: The Space Devs / Launch Library 2." TSD requests attribution for free-tier use (VERIFY exact wording in their docs).
- Display the `fetched_at` timestamp of each active dataset ("elements as of …").
- One line of honesty in the info panel: positions are SGP4 propagations from public element sets, accurate to a few km; not for operational use.

## 8. Out of scope for v1

- Whole-catalog view, debris, rocket bodies
- Time scrubbing / playback, historical constellation growth
- Ground tracks, coverage footprints, conjunction analysis
- Sun/terminator shading, day-night lighting (conflicts with the wireframe direction anyway)
- Ground station layers beyond the curated facilities file

## 9. Acceptance criteria (v1 gate)

1. Globe rotates smoothly by touch and mouse; coastlines and graticule render in the tactical style with correct far-side occlusion.
2. Every Registry constellation with available elements renders with live propagated positions; clicking a satellite shows its popup and orbit arc and links to its Registry page.
3. All active spaceports render with correct positions; popup shows total launches, next launch, upcoming count, and vehicles served, consistent with LL2.
4. Facilities layer toggles on and renders the curated set; default state is off.
5. Works on mobile (tap selection, pinch zoom, acceptable frame rate).
6. Attribution and data timestamps visible; stale-data notice fires when applicable.
7. Lighthouse/route check: no other MCC page loads the 3D bundle.
8. Style audit: all chrome uses existing MCC tokens; neon appears only on data elements and legend swatches; category colors match the shared theme tokens and the Registry data's `category` field.
