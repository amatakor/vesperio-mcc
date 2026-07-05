# Orbits — UI & Presentation Design Brief

## Context

`/orbits` is the hero surface of MCC (mcc.vesperio.ai), a machine-maintained
tracker for the commercial space economy. It renders a live 3D wireframe Earth
with the tracked satellite constellations orbiting it, plus ground markers for
spaceports and facilities. The 3D scene works and is signed off. **This brief is
only about the 2D chrome around it** — the panels, controls, stats overlay, and
overall composition. We need a few distinct directions because the current chrome
reads as a utilitarian form, not the mission-control console this product wants to be.

## Scope

### In scope (design these)
- **The live stats HUD** (new) — a readout overlay. The centrepiece of this brief.
- **The layer control panel** — where the user toggles constellations, spaceports,
  and facilities. Its placement is an open question (see below).
- **Info popups** — the small panels that appear when a satellite, spaceport, or
  facility is selected. **These already work well and Florian likes them — do not
  restructure them.** The only ask is a light typographic pass so they sit in the
  new type system. Keep their layout, corner-tick framing, and content as-is.
- **Page composition** — how these panels sit around the globe; the header/nav
  context; the attribution + data-freshness footer.
- **States** — loading, stale-data notice, empty, and a no-WebGL fallback message.
- **Optional / minor:** the floating name-label container that sits beside a
  focused satellite (the box and its type only — see the render firewall below).

### Out of scope — do NOT touch (hard firewall)
Everything rendered inside the WebGL canvas is finished and off-limits. Do not
redesign, restyle, or propose changes to any of:
- the **Earth** sphere, its ocean fill, coastlines, or lat/long graticule
- the **satellite cloud** — the points/dots and their colours
- the **orbit arcs and orbit shells** (the ellipse lines)
- the **focused-satellite glyphs** (the little satellite icons) and their motion
- the **ground markers** — spaceport triangles, facility squares, HQ dots
- the **activity pulse** (the red ring on recently-active spaceports)
- camera behaviour, rotation, or fit

If a direction needs to reference the globe, treat it as a fixed background image.
The label-box exception above covers only the 2D container/typography, never the
satellite icon itself.

## Current state (reference)

A screenshot of the current Orbits chrome accompanies this brief. It is the
**"before"** — the chrome we want to reinvent, over a globe that stays exactly as
shown. In it you can see: the MCC masthead and nav; the right-hand layer rail with
its `[x]` checkboxes, category swatches, and nested fleet rows (Airbus EO, BlackSky
→ Gen-2/Gen-3, CGSTL Jilin-1, ESA Copernicus → Sentinel-1/2/3/5P/6, CSA/MDA
RADARSAT); and a focused constellation (ICEYE) showing the floating name-label
boxes and orbit shells on the globe. The stats HUD does not exist yet — it is new.
Treat the globe and everything on it as the fixed background; redesign only the
2D chrome.

## The problems to solve (specific)

1. **The two per-constellation controls are not intuitive.** Each constellation
   needs two independent states (defined below). The previous attempt used an
   abstract "circle inside a square" icon that nobody could read. The affordance
   must be instantly legible — a user should know what each control does without a
   legend. Reinvent it; don't reuse the circle-in-square.
2. **Nested rows look messy.** Some constellations are fleet parents with children
   (e.g. Planet → PlanetScope / SkySat / Pelican; BlackSky → Gen-2 / Gen-3). Child
   rows currently indent raggedly and the control columns don't line up. We need a
   strict, pixel-clean column grid where parent and child controls align perfectly.
3. **The stats HUD feels uninspired.** It reads as label/value pairs in a grid.
   It should feel like a considered ops console: confident typographic hierarchy,
   deliberate density, tactical line/tick detailing. Character, within the
   constraints below.
4. **Placement is open.** The controls currently live in a right-hand rail.
   We want to compare that against a **bottom dock/bar**. Explore both across your
   directions so we can judge.
5. **The control must fit on screen — no internal scrollbar.** Today the layer list
   runs taller than the viewport and spawns an ugly inner scrollbar. The whole
   control must sit within the viewport height, with no scrolling required to reach
   any constellation. See the fit requirement below for the scale this implies.

## Palette (work strictly in these)

Chrome is a disciplined grayscale system with a single accent. The vivid neon
colours belong to the data on the globe and must not leak into the chrome.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0a0a0a` | page background |
| `--panel` | `#141414` | panel fill (also darker `#0d0f12` used for overlays) |
| `--fg` | `#f2f2f2` | primary text, numerals |
| `--dim` | `#8f8f8f` | labels, secondary text, ticks |
| `--line` | `#2e2e2e` | borders, dividers |
| `--acc` | `#ffe600` | **the one chrome accent** — use sparingly for emphasis |
| `--alert` | `#ff2043` | critical / recent-activity signal |
| `--mono` | monospace stack | all structural type: labels, numerals, controls |
| `--sans` | system sans | body prose only |

**Neon (DATA ONLY — do not use on chrome):** EO `#3dff9e`, connectivity `#ff3dd8`,
IoT `#19d9ff`, human-spaceflight `#ffb054`, reserve `#b18cff`. The single exception:
a **category legend swatch** — a tiny square of the constellation's neon colour used
purely to identify its category in the layer panel. That is the only place neon
touches the chrome, and it mirrors the (untouchable) colour of that constellation's
dots on the globe.

The creative challenge: make it feel alive and tactical **without** glow, neon
chrome, or colour. Interest comes from type, density, hierarchy, tick/rule
detailing, and disciplined use of the yellow accent.

## Visual language (binding house rules)

- Brutalist-editorial, tactical, mission-control. Dark throughout.
- **No border-radius, anywhere.** No drop shadows. No gradients. No blur/glow.
- No transform-based hovers; keep any transitions minimal (≤100ms) or none.
- Mono type for everything structural (labels, numerals, controls); sans for prose.
- Established motif (evolve, don't abandon): thin 1px panel borders with small
  L-shaped corner ticks. Uppercase mono labels with wide letter-spacing.
- No em dashes anywhere in copy (site-wide rule).

## Reference: ai-tldr.dev

MCC's whole design language was derived from **https://ai-tldr.dev** — reference it
for the *feel*, specifically:
- **Type roles:** monospace for technical identifiers, labels, and structural
  elements; sans reserved for body prose. Bold marks headings and key terms;
  regular dominates. This mono/sans split is core to the MCC identity.
- **Density with breathing room:** information-dense and fast to scan, but generous
  vertical rhythm between sections. Compact spacing *within* a group, generous
  margins *between* groups. This is the balance the stats HUD and layer panel need.
- **Structural restraint:** section breaks lean on whitespace, not heavy rules;
  small inline tag/badge treatments; a flat feed rather than boxed cards; one
  accent colour for focus, nothing competing.

Two caveats: (1) ai-tldr is black-on-**white**; MCC already inverted this to a dark
ground with a single yellow accent, so take the *structure and rhythm*, not the
light palette. (2) Reference the feel only — **do not copy ai-tldr's CSS** (there is
no license for that); rebuild the language in our tokens.

## Layer control — the interaction to nail

Every constellation row exposes **two independent states**:

- **Cloud (visibility):** is this constellation's satellite cloud drawn on the
  globe? On/off, per constellation, many on at once. This is the default browse mode.
- **Detail (orbits + labels):** "focus" this constellation — its orbit shells and
  per-satellite name labels appear and everything else dims. This is effectively a
  single focus (focusing one clears another; a fleet parent focuses all its
  children together).

Also in this panel: category groupings (EO, connectivity, IoT, human-spaceflight)
that can each be toggled as a whole; per-row satellite counts; per-row status
(loading / stale / no-data); and two more layer toggles for **Spaceports** (on by
default) and **Facilities & HQs** (off by default). Design the whole thing as one
coherent, dense, aligned system — parents and children on a strict grid.

**Fit requirement — the whole control must fit the viewport with no internal
scroll.** The list is long and growing: today there are **48 constellation rows**
(EO alone is 39) plus the two ground-layer toggles, split across categories and
7 fleet parents with nested children. Fitting that on screen at once, with no ugly
inner scrollbar, is a core design problem — not an afterthought. It almost certainly
requires **collapsible fleet groups** (a fleet shows only its parent row until
expanded) and/or **collapsible categories**, and may favour a **bottom dock or
multi-column layout** over a tall single-column rail. Design for the full count
resolving on screen, and so that adding more constellations later does not
reintroduce a scrollbar. A fleet parent toggling/focusing all its children still
holds, whether the group is collapsed or expanded.

## Stats HUD — content is fixed, presentation is yours

Five live metrics (numbers refresh on their own; treat the values as placeholders):

1. **Satellites tracked** — total currently rendered (~12,100).
2. **Launched · last 30 days** — global orbital launches in the window.
3. **Launching · next 30 days** — scheduled global orbital launches.
4. **Deorbited · last 30 days** — tracked satellites that have decayed.
5. **Launches · last 6 months, by vehicle** — a small ranked breakdown per rocket
   (e.g. Falcon 9, Long March 2D, Electron…). This is the one "chart-like" element;
   keep it flat and on-palette (no gradients).

Make this feel like the beating readout of an ops console. Numbers are the hero —
mono, confident. Labels quiet. It sits over the globe, so it must not shrink the
Earth and must stay legible over a busy background (a solid or near-solid panel
fill is fine; translucency is optional).

## Data reality (design for graceful degradation)

- Satellite counts and "satellites tracked" are **live and always present**.
- Launch metrics and the 6-month vehicle breakdown come from a launch-data feed,
  refreshed twice daily — **always present**.
- Per-constellation registry detail (operator name, sats-on-orbit, etc.) is
  **frequently null** for the ~23 newly added constellations (a slower crawl fills
  these over time). The design **must degrade gracefully**: show the figure when we
  have it, hide the field when we don't. Never render "null", "undefined", or a
  blank that looks broken.

## Page anatomy (fixed structure to design within)

- Top: MCC masthead + horizontal nav (NEWS / REGISTRY / ORBITS / SIGNALS / STATS /
  LOG / ABOUT). ORBITS is the active tab. This exists; match it.
- Middle: the globe (fixed background for your purposes), with the stats HUD and
  the layer control arranged around/over it.
- Bottom: a one-line attribution + honesty statement ("Orbital data: CelesTrak.
  Launch data: The Space Devs / Launch Library 2. Positions are SGP4 propagations,
  accurate to a few km, not for operational use.") plus per-dataset "as of"
  timestamps. Keep it, style it.
- Responsive/touch-first: the site collapses to a single column under ~720px. Your
  control-panel and HUD placement need a mobile story (a bottom dock may suit mobile
  especially well — worth showing).

## Deliverables

- **2–3 distinct directions**, not variations of one idea.
- Across them, show **both** control placements: a persistent side rail **and** a
  bottom dock/bar.
- Each direction: at minimum the **stats HUD** and the **layer control panel**,
  shown in context around the globe; desktop primary, with a mobile note or frame.
- Show the layer control with **nested fleet rows** (parent + children) so the
  column alignment is visible, and show the **two per-constellation states** clearly.
- Static mockups are fine (PNG/Figma/HTML). Annotate which palette token maps to
  each element so it's unambiguous to build.

## Avoid (learned from prior attempts)

- The circle-in-square toggle icon (unreadable).
- Ragged / misaligned nested rows.
- Label/value grids that read as a form rather than a console.
- Any neon, glow, gradient, rounded corner, or drop shadow on the chrome.
- Restructuring the info popups (they work; typography only).
- Touching anything inside the 3D canvas (see the render firewall).
