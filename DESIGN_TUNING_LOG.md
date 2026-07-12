# Design Tuning Log — V1.1 post-application feedback

Locked decisions from Florian's review of the applied V1.1 restyle
(2026-07-10, restyle/v1-1 branch). Each entry is written to be pasted
into the design project so the canonical system (tokens, kit, decision
record) stays in sync with production. Format: RULE is the system-level
statement; IMPLEMENTATION is where it landed in this repo.

## 1 · Sweep countdown — digit-grid centering (clarified, not changed)

RULE: The LCD centers its 8-cell DIGIT GRID in the stage, never the lit
ink. A 7-segment "1" lights only the right segments of its cell, so a
clock like 11:12:11 reads right-biased; that is hardware-clock behavior
and correct. To anchor the eye on the centered grid, the ghost cells run
`#1F1F1F` on the black instrument ground (raised from `#161616`, which
disappeared on glossy/retina displays). Ghost still equals the flood
color on the flood side (invisible there).

IMPLEMENTATION: `.sweep-lcd-ghost` in `src/index.css`.

## 2 · Seismic card footer now THEMES (amendment)

RULE: The seismic card's footer bar is a themed surface: `#0C0C0C` bar,
literal gray text, yellow source link on dark; inset-white bar
(`--bg-inset`), `--text-3` text, cyan `--link` on light. This narrows
the V1.1 "constant-dark surfaces" list to: the sweep-countdown
instrument face, LCD instrument faces, and monogram/avatar tiles.
(Supersedes handoff §3's inclusion of the seismic footer.)

IMPLEMENTATION: `[data-theme="light"] .card-seismic .card-foot` rules in
`src/index.css`.

## 3 · MCC (orbits view) now THEMES — the daylight chart (amendment)

RULE: MCC is no longer theme-invariant (supersedes handoff §3 "orbits
canvas stays dark"). Dark theme is the night-ops view; light theme is a
daylight chart:

- Ground: ocean `#E6EBEE`, grid `#C9D2D8`, coast `#56707F` (steel).
- Data accents (arcs, dots, legend swatches) darken one step in light,
  parallel to the status accents: eo `#0E9E57`, connectivity `#C217A0`,
  iot `#0E93AD`, hsf `#C56A00`, nav `#45566F`, reserve `#7434D6`.
- Stars render in the foreground ink (white on night, near-black specks
  on paper) — the field stays, reading as a chart texture in daylight.
- LCD instruments on the HUD keep the clock rule: volt digits on dark;
  volt-ink digits with `#D6D6D0` ghost segments on paper.
- The rail, HUD, and footer chrome use the themed tokens like any other
  surface; selection is the raised ground + 2px n7 leading edge.

IMPLEMENTATION: light values for `--globe-*`, `--neon-*`, `--acc-ghost`
in `src/index.css` `[data-theme="light"]`; the theme-invariant pin
removed from `src/orbits/orbits.css`; the WebGL scene re-reads tokens by
remounting on theme change (`useTheme` in `src/orbits/stage.tsx`, keyed
`<Scene>` and `<Mini3DScene>`).

## 3b · Stars visibility (regression fix, both themes)

RULE: Star points size in device pixels; scale point size by
devicePixelRatio (cap 2) so retina displays don't halve them. Brightness
floor for the faintest catalog stars raised 0.18 → 0.30.

IMPLEMENTATION: `src/orbits/stars.tsx`.

## 4 · Satellite labels — legibility spec

RULE: In-canvas satellite labels render from a 2x-resolution texture
(512×64, 40px IBM Plex Mono 500) so they stay crisp under minification
and on retina. The backing box derives from the ink: light ink gets
`rgba(0,0,0,.78)`, dark ink (daylight chart) gets `rgba(255,255,255,.82)`.
Label ink is the theme foreground.

IMPLEMENTATION: `labelTexture()` in `src/orbits/satellites.tsx`.

## 5 · Display register — weight ladder (amendment)

RULE: In the DISPLAY voice, weight 200 is reserved for sizes ≥ 40px
(hero numbers at 52). At 28px (page titles, stat-tile numbers) the
register runs 300, so an H1 never reads dimmer than the body copy below
it. Ladder: 52/200 · 28/300/+.12em · 21/300/+.06em. The old "floor:
nothing under 200 below 28px" rule is superseded by "nothing under 300
below 40px".

Also normalized: stated phrases (stats hero sentence) render at body
scale (13px mono), per the existing "numbers get display size; stated
phrases render at body scale" rule — the 17.6px hero sentence was
off-system and out-shouted the title.

IMPLEMENTATION: `.page-title`, `.tile-num`, `.hero-sentence` in
`src/index.css`.

---

# Round 3 (2026-07-10, second review)

## 6 · Sweep LCD — grid centering, measured and locked

MEASUREMENT: DSEG7 "88:88:88" at 45px has symmetric ink bearings (4px
each side of the 240px advance box); the LCD box centers to the pixel in
the stage (verified by getBoundingClientRect and pixel-scan). What reads
as off-center is lit-segment asymmetry: a 7-seg "1" lights only its
right segment pair.

RULE: the instrument centers its DIGIT GRID, never the lit ink (ink
centering would make the clock wobble as digits change). The ghost grid
is therefore a first-class element: unlit segments run classic LCD gray
`#262626` on the black instrument ground, strong enough to anchor the
eye. Applies to every LCD face (sweep card, MCC countdown).

## 7 · LCD instruments are MODULES (amendment)

RULE: every LCD countdown sits on a constant black instrument module
(black ground, 1px `--border-2` frame, volt digits via `--clock`,
`#262626` ghost) in BOTH themes — the news sweep card grammar, reused.
The MCC HUD countdown adopts it; volt digits never sit on paper.

IMPLEMENTATION: `.hud-countdown` module + `.lcd-*` constants in
`src/orbits/orbits.css`.

## 8 · Daylight chart refinements

- ISS wireframe inks are theme-aware: `#22303C` structure / `#2666D1`
  arrays on light (pale `#D5DEEC` / `#7AA8E0` stay on dark).
- Satellite cloud blending: additive is the night-view glow; the
  daylight chart uses normal blending or the cloud washes out over the
  pale ocean.
- Coast ink darkens to `#33495A`, grid to `#BFC9D0`, for continent
  contrast on paper.

## 9 · MCC layout — flush panels

RULE: the MCC frame sits flush under the top bar (no top gap) and its
side gutter is the sitewide 28px, so panel edges align with the
masthead content. Frame height accounts for the 64px bar + 2px rule.

## 10 · Stars — original rendering restored

The dpr-scaled point sizes from round 2 read as chunky squares; the
original sizes (2.2 / 1.3, brightness floor 0.18) are restored and
locked. Source data unchanged: Yale Bright Star Catalog, true RA/Dec,
sidereal orientation, parallax factor 0.3.

## 11 · Satellite labels — weight

RULE: in-canvas labels render at weight 400 (was 500). Mono above 400
stays reserved for labels/badges in the UI itself; canvas text is body
register. Bold mono remains banned everywhere.

---

# Round 4 (2026-07-10, third review)

## 12 · LCD centering — ink-true (amends round 6)

MEASUREMENT: in DSEG7 at 45px, every digit's ink ends 33/37 into its
cell, but a leading "1" STARTS its ink at 26px where every other digit
starts at 4px. So lit ink sits off-center exactly and only when the
first digit is a 1.

RULE: the clock centers its INK. When the leading digit is "1" the grid
shifts left by half the dead space (`-0.245em`, any size); the shift
keys on the leading digit only, so it changes at most hourly and the
clock never wobbles. Ghost grid stays `#262626`. Applies to every LCD
face (class `lcd-lead-1`).

IMPLEMENTATION: `SweepLcd` in `src/pages.tsx`, `Lcd` in
`src/orbits/chrome.tsx`, classes in `src/index.css` /
`src/orbits/orbits.css`.

## 13 · MCC launch countdown — redesigned as the sweep instrument

RULE: the launch countdown adopts the sweep card's grammar, quieted for
the rail (the eye belongs to the earth): black stage (76px) with
`T-MINUS NEXT LAUNCH` in the instrument register top-left and a
tabular `T-nD` days chip top-right (only when days > 0); the HH:MM:SS
remainder centered on its ghost grid at 32px (not 45 — rail scale); a
themed footer carries vehicle · mission and pad · net time in the meta
register. NO volt flood: the flood is the sweep instrument's exception,
not a family trait. The old twin-LCD `t-0d` display is retired.

IMPLEMENTATION: `.hud-launch*` in `src/orbits/orbits.css`, markup in
`src/orbits/chrome.tsx`.

## 14 · Top bar band holds the content measure

RULE: the masthead band is NOT full-bleed; it spans the content measure,
so the band's edges land exactly above the panel and card-plate edges on
every page (raised by Florian on MCC: "the menu bar extends wider than
the panels"). The MCC frame keeps the sitewide 28px gutter and its
footer bar indents to match.

IMPLEMENTATION: `.masthead` in `src/index.css`, `.oframe-main` /
`.obar` in `src/orbits/orbits.css`.

---

# Round 5 (2026-07-10, fourth review)

## 15 · Sweep instrument — quieter scale

RULE: sweep stage 86px (was 108), digits 32px (was 45); the seam keeps
its ~31° slope (lean ±26px over the 86px stage). The instrument reads
as a card among cards, not a headline.

## 16 · Launch instrument — frameless, translucent, themed

RULE: the MCC launch countdown drops its frame and sits slightly
translucent over the canvas like the HUD's other panels:
`rgba(0,0,0,.72)` stage on dark. The LIGHT variant exists (approved
attempt): `rgba(255,255,255,.72)` stage, volt-ink digits, `#DCDCD6`
ghost cells. The MCC clock THEMES; the news sweep card keeps its
constant black face (it carries the flood). Label/days chip use themed
inks (n7 / text-3).

## 17 · Band and panels — final alignment rule

RULE: the top bar band is FULL-BLEED (runs to the shell's outer edge);
the MCC panels edge-align to the BAND (frame has no side padding), and
a 20px top gap separates the bar from the panels — the bar never
touches them. (Round 14's "band holds the content measure" is
reverted and superseded.)

## 18 · Nav hover feedback

RULE: nav items respond on hover — text steps n6→n8 and a neutral
`--border-2` underline previews the volt underline the active tab
carries; ≤120ms linear. The theme toggle shares the treatment.

---

# Round 6 (2026-07-10, fifth review)

## 19 · Instrument labels — micro register

RULE: instrument corner labels drop a class: micro register (9px / 500 /
+.08em caps), pinned 8px from the top and 10px from the sides. The face
belongs to the digits. Applies to the sweep card and the launch
instrument (label and days chip alike).

## 20 · Launch instrument light stage — smoked glass

RULE: the white light-theme stage failed review; the light variant is
SMOKED GLASS instead: `rgba(20,20,18,.55)` over the paper, volt digits
exactly as on dark, ghost cells `rgba(0,0,0,.3)`. Labels carry constant
light inks (#EDEDED / #A8A8A8) since the stage is dark-to-smoked in
both themes. The module's footer keeps its 1px frame (`--border-1`) and
inset ground in both themes; only the stage is frameless.

---

# Round 7 (2026-07-10, sixth review)

## 21 · Sweep footer states its cadence

RULE: the sweep instrument's footer carries the crawl frequency as its
middle segment — `LAST …Z · SWEEPS EVERY 12H · NEXT …Z · LOCAL`,
three-way justified. An instrument states its own duty cycle.

## 22 · Launch instrument — title is a MODULE title

RULE: `T-MINUS NEXT LAUNCH` moves out of the frame and becomes the
module title in the shared HUD label class (same register as ORBITAL
FLOW and LAUNCHES). The stage drops to 64px and the digits center
DEAD in the box (inset 0; -2px lift for DSEG7's em-box descent). Only
the `T-nD` days chip stays inside the stage, top-right.

---

# Round 8 (2026-07-10, seventh review)

## 23 · Globe land shading

RULE: continents carry a very light shading step against the water,
both themes: dark land `#12203A` on ocean `#0B1626`; light land
`#DCE3DD` on ocean `#E6EBEE`. Implemented as an equirectangular
canvas texture generated from the same Natural Earth 110m topology as
the coastlines, so the fill sits exactly under the strokes. Tokens:
`--globe-land`.

## 24 · Launch instrument dark stage

RULE: the dark stage carries the same smoked treatment as light, in
reverse: `rgba(255,255,255,.07)` lift off the page ground, so the
module's padding reads against a surface.

## 25 · Light-stage ghost, quieter

RULE: ghost cells on the smoked light stage drop to `rgba(0,0,0,.14)`
(from .3) — to be reassessed.

## 26 · Wheel zoom

RULE: scroll/pinch-wheel zooms the globe, stepping the same FitCamera
zoom as the `[+]/[-]` buttons (60 wheel-units per step, clamped to the
same -2..4 range); non-passive so the page never scrolls under the
canvas.

## 27 · Labels hold fixed screen size

RULE: satellite labels scale with camera distance every frame
(reference distance 2.8), so zooming never grows the type. Labels are
instrument chrome, not scene objects.

## 28 · Focused orbit shells brighter

RULE: orbit-shell line opacity 0.36 (was 0.22).

---

# Round 9 (2026-07-10, eighth review)

## 29 · Launch clock — signed and centered

RULE: the countdown reads negative (`-17:18:32`), like a pad clock; the
sign occupies its own grid cell. Vertical centering is measured, not
eyeballed: +1px at 32px sits the lit ink dead on the stage center.

## 30 · Satellite dots — crisp and pixel-stable

RULE: cloud points render as crisp discs (solid core, 2-texel AA rim,
128px texture — the radial glow blurred at zoom) and hold a fixed
apparent size: the material's point size tracks camera distance per
frame (ref 2.8), so zooming never inflates the dots.

## 31 · Labels — true-width textures

RULE: label textures take the text's true width (capped at ~25 chars
with an ellipsis); glyphs are never condensed to fit. Sprite aspect
follows the texture.

## 32 · (superseding note) Rounds 8-9 lock the MCC instrument: title
outside in the HUD label class, smoked stage both themes, signed
centered digits, quiet ghost. Kit should adopt this as the LCD module
spec alongside the sweep card.

---

# Round 10 (2026-07-10, ninth review)

## 33 · Dot weight is per-category

RULE: the mega-constellations must not overwhelm the map: connectivity
dots render at 0.6x the standard disc; every other category keeps the
full size. Implemented as a per-point size attribute (`aDot`) patched
into the points shader — one draw call, no split geometry.

---

# Round 11 (2026-07-10, tenth review)

## 34 · Connectivity dots — 0.5x

RULE: connectivity dot factor drops to 0.5x (from round 10's 0.6).

## 35 · Signed clock centers its DIGITS

RULE: on a signed LCD, the sign cell does not participate in
centering: the digit group centers in the box and the minus hangs
left. The leading-1 ink rule applies to the first DIGIT (the sign is
skipped when detecting it). Shifts are ONE analytic transform (sign
half-cell + leading-1 ink delta; -13px / -21px at 32px), never
compounded margins. Verified by pixel scan: digit ink center within
0.5px of the stage center.

---

# Round 12 (2026-07-10, eleventh review)

## 36 · Signed clock — OPTICAL centering (final)

RULE: digit-only centering reads left-heavy (the dash adds ink mass),
full-string centering reads right-heavy; the sign carries HALF weight.
At 32px: -7px shift (-15px with a leading 1). Supersedes round 35's
digit-only rule.

## 37 · Light-theme stars, 1.3x

RULE: dark ink on paper needs more body than light ink on night; the
daylight chart renders the star field at 1.3x point size.

## 38 · Focus keeps the context cloud present

RULE: under a constellation focus, unfocused dots dim to 0.18 (was
0.12) — context stays legible without competing.

## 39 · Labels — light register, smaller

RULE: in-canvas labels render in Plex Mono 200 (the light register) at
0.038 sprite height (~15% smaller). Canvas text weight follows the
site's self-hosted faces only.

# Round 13 (2026-07-10, Florian's pre-deploy punch list)

## 40 · Page containers span the shell

RULE: every page container runs the full shell measure, exactly as wide
as the menu bar; structural furniture (bands, hairlines, panels, grids)
spans with it, and only raw running text keeps the 46rem reading
measure. When the window narrows, the menu and the content share the
same gutters. Supersedes the 46rem page cap on .item-page/.qa and
retires .item-wide's 64rem cap (the class stays as a layout hook).

IMPLEMENTATION: src/index.css (.item-page/.qa max-width none; .item-page
p/ul/ol and .qa p at 46rem; .lede unchanged). The narrow-viewport
masonry blowout (grid minmax forcing tracks past the container under
~408px) fixed with minmax(min(22rem, 100%), 1fr) in .cards.

## 41 · Card hover carries the shell-accent frame

RULE: news cards on hover show a 1px shell-accent frame (volt on dark,
volt-ink on bright — the nav-underline token) on top of the existing
copy inversion. This is a sanctioned interaction-feedback use of the
shell accent, not a new color role; running data stays volt-free.
Seismic cards keep their photographic-negative hover and are excluded
(their inverted filter would shift volt off-palette).

IMPLEMENTATION: .card:not(.card-seismic):hover { border-color:
var(--shell-accent) } in src/index.css.

## 42 · Sweep footer sits on the card surface

RULE: the sweep-countdown card's footer strip (LAST / SWEEPS EVERY /
NEXT) is a themed surface on the card token (--bg-panel), identical to
feed cards in both themes. The instrument face above it stays constant
dark (rule 2's list is unchanged).

IMPLEMENTATION: .sweep-card-foot background --bg-inset -> --bg-panel.

## 43 · Registry pane header — logo/name on one axis (defect fix)

Not a new rule; rule-8-family alignment defect. The registry browser's
preview-pane header now vertically centers the monogram/logo tile and
the entity name on one flex axis (was block flow with a mistuned
vertical-align, ~3px off).

IMPLEMENTATION: .reg-pane-head { display: flex; align-items: center }.

(Engineering note, same date, not a design rule: MCC focus-mode orbit
shells are now SGP4-sampled per satellite on the worker, so every ring
passes through its live dot; the old two-body-at-epoch ellipses drifted
100-400 km off stale-epoch dots. Rule 3's daylight/night visuals are
unchanged.)

## 42b · Sweep footer token corrected (same day, Florian's review)

RULE 42 AMENDED: the reference surface is the feed cards' FOOTER bar
(--bg-raised, the grey footer token), not the card body (--bg-panel).
The sweep card's footer now matches .card-foot exactly in both themes.

## 44 · Fluid measure; band box = content box

RULE: the shell is FLUID — the site adapts to the browser width with no
maximum measure; the page gutter is the only outer inset and is shared
by the menu bar and the content at every size. The masthead band's box
is exactly the content box (round 5's full-bleed pull-out is
superseded): in the light theme the white band no longer overhangs the
feed by a gutter on each side. The masonry grows columns as the window
widens (auto-fill).

IMPLEMENTATION: .shell max-width none; .masthead margin/padding
pull-out removed (src/index.css).

## 45 · MCC star field fills the browser

RULE: the MCC canvas (globe + star field) bleeds window edge to window
edge; the HUD panels hold the page-gutter line so chrome stays aligned
with the masthead (rule 44). The star field reads as the page ground,
panels float on it.

IMPLEMENTATION: .oframe escapes the gutter with negative side margins;
.oframe-main pads the panels back in (src/orbits/orbits.css).

## 44b · Band interior — brand and nav on the cards' text line

RULE 44 AMENDED (Florian's second review, same day): with the band box
equal to the content box, a flush logo reads as a defect. Inside the
band, the brand lockup and nav sit on the cards' inner text line
(--pad-card), one shared left edge from the menu text to the card text.

IMPLEMENTATION: .masthead padding var(--sp-2) var(--pad-card).

## 44c · The menu bar sits on the page ground (supersedes 44b)

RULE (Florian's third review, same day): the masthead has NO band
surface in either theme — its background is the page ground itself
(--bg), which is how the dark theme always read (band and page were
both near-black). The brand and nav align flush with the content edge
(44b's --pad-card inset reverted: "aligning the logo to the website
edge was the right move"); the 2px n7 rule below is the masthead's
only mark.

IMPLEMENTATION: .masthead background var(--bg), padding var(--sp-2) 0.

## 46 · Volt gains HERO ELEMENTS (Florian's palette ruling)

RULE: volt is logo + app shell + HERO ELEMENTS. A hero element is a
singular, page-defining mark — currently the MCC satellites-tracked
count (whose legacy --acc volt is hereby lawful) and the selected
satellite's orbit arc on /mcc/ (volt on night, volt-ink on the daylight
chart, via --shell-accent; the boot-state ISS arc shares the treatment
as the load-state selection). Running data, counts in tables, and
status marks stay volt-free; each NEW hero use needs Florian's
sign-off. Selection was already volt in the shell (selection fills,
focus) — this extends the same grammar into the canvas.

IMPLEMENTATION: scene.tsx arcColor -> colors.volt (token
--shell-accent); CLAUDE.md volt clause updated; MCC_HERO_BRIEF.md
constraint 3 rewritten (the count's volt is no longer a violation to
resolve).

## 3c · Daylight chart — ocean one step darker

RULE 3 AMENDED (Florian, 2026-07-10): the light-theme ocean darkens one
step, #E6EBEE -> #DBE2E7, so the globe disc separates from the paper
ground. Land, grid, and coast values unchanged.

IMPLEMENTATION: --globe-ocean in [data-theme="light"], src/index.css.

(Engineering note, same date: the registry orbit-tab mini embed now
renders SGP4-sampled shells from its worker, same fix as the main
scene; kepler.ts's two-body orbitShellSegments deleted, ISS ring now
passes through the station glyph.)

## 3d · Daylight ocean — darker and bluer (supersedes 3c)

RULE (Florian, same day): the light-theme ocean is a real blue, not a
gray: #C7D5E3 (from 3c's #DBE2E7; original #E6EBEE). The globe disc
reads as water against the paper ground; land/grid/coast unchanged,
grid still darker than the ocean it draws on.

IMPLEMENTATION: --globe-ocean in [data-theme="light"], src/index.css.

## 3e · Daylight ocean — saturated map blue (supersedes 3d)

RULE (Florian, same day, third step): the daylight ocean is a saturated
cartographic blue, #9DB9D6. Full ramp walked today:
#E6EBEE > #DBE2E7 > #C7D5E3 > #9DB9D6. Land stays pale (#DCE3DD) so
continents read light-on-water like a printed chart; the grid now draws
LIGHTER than the water (inverted, intentional); coast steel unchanged;
data accents still clear the ocean.

IMPLEMENTATION: --globe-ocean in [data-theme="light"], src/index.css.

## 47 · Daylight canvas labels — regular weight, opaque paper

RULE (Florian, 2026-07-10: "labels not readable in light mode"): in-
canvas satellite labels keep Plex Mono 200 on the night view but step
up to 400 on the daylight chart, and the paper backing goes near-opaque
(0.95, was 0.82). Same optical asymmetry as the stars (rule 3b): dark
strokes on paper thin out at sprite scale where light-on-night reads
heavier; and the blue ocean bled through the translucent backing and
grayed the ink. Amends rules 4 and 39 for the light theme only.

IMPLEMENTATION: labelTexture() in src/orbits/satellites.tsx (weight and
backing switch on the ink's luminance).

## 48 · Orbital flow — scheduled bars are FILLED

RULE (Florian, 2026-07-10): the next-30d scheduled bars fill with the
mid dim ink (--dim) in both themes, replacing the hollow outline; the
NOW divider already separates past from future, and the legend swatch
fills to match. Launched keeps the full ink, deorbited keeps dim-deep.

IMPLEMENTATION: .flow-bar-sched / .flow-sw-sched (renamed from -hollow)
in src/orbits/orbits.css + chrome.tsx.

(Engineering note, same date: the pale band that crossed the globe was
the land texture mis-filling at the antimeridian — 7 rings in the 110m
data cross lon 180 (Fiji's at 16S was the visible one) and their wrap
edges drew straight lines across the canvas. landTexture now unwraps
rings, closes pole-encircling rings via the pole, and fills at the
three seam offsets. Present since the texture shipped; the saturated
daylight ocean made it visible.)

## 48b · Scheduled bars — volt hatch (supersedes 48's dim fill)

RULE (Florian, same day): the next-30d bars fill with a 45-degree volt
hatch (2px stroke / 3px gap, --shell-accent: volt on night, volt-ink on
daylight) — hatched-equals-planned, the engineering-drawing grammar.
Legend swatch matches. Volt on this element is Florian's explicit
sign-off (rule 46's process).

IMPLEMENTATION: .flow-bar-sched / .flow-sw-sched repeating-linear-
gradient in src/orbits/orbits.css.

## 49 · Satellite card fits its content and hides behind the earth

RULE (Florian, 2026-07-10): the click popup accommodates its data — no
truncation; width grows to fit (max-content, 210-320px), titles wrap,
the card may run taller. And the card is occluded like its object: when
the satellite (or ground site) passes behind the earth, the card hides
with it (same 0.995-radius test the labels use), returning as the
object does.

IMPLEMENTATION: .opopup / .opopup-title in orbits.css; PopupAnchor
occlusion in scene.tsx.

## 50 · Camera fit measures the real gap between the panels

RULE (Florian, 2026-07-10): on load the globe fits the actual space
between the floating panels at ANY window size — big enough to fill
the gap, never sliding under the chrome. The old symmetric side-pad +
breakpoint zoom steps (0/-1/-2) are replaced by true per-side spans
(gutter 28 + HUD 272 + gap 16 left; gap 16 + rail 352 + gutter 28
right), with the view offset derived from their difference. Every
floating-panel width opens at the base fit; mobile keeps two steps
wider over the stacked layout. User zoom steps are unchanged.

IMPLEMENTATION: FitCamera padLeft/padRight in scene.tsx (mini3d passes
zeros); defaultZoom simplified.

## 50b · Fit air tightened

RULE (Florian, same day: "fill the gap sliiiightly more"): the base fit
radius drops 1.28 -> 1.22 globe radii; the LEO cloud's outer edge may
crop under the chrome (the canvas-wrap fades own the top and bottom).

IMPLEMENTATION: fitRadius base in scene.tsx.

## 51 · Four impact tiers; yellow intensity encodes the tier

RULE (Florian, 2026-07-10: "I see too many notables" — 102 of 131 items
wore the yellow fill): the impact scale gains MAJOR between notable and
seismic. Badge grammar: NOTABLE becomes the standard outlined chip in
yellow (dim yellow border at 45%, yellow text); MAJOR takes the filled
yellow badge; SEISMIC keeps filled red. One hue, three intensities —
outline < fill < red; the feed's yellow becomes rare and meaningful
again. Editorial bars redefined in CLAUDE.md (major = a director acts
or briefs the team the same day, stated value or market access in the
source; when torn, take the lower tier). Existing items reclassified in
a reviewed migration.

IMPLEMENTATION: IMPACTS in schema.ts; .chip-major / .chip-notable in
src/index.css (+ hover inversion rules); CLAUDE.md Impact block + badge
law; prompts/update-items.md impact guidance; stats.ts hero and
impact-mix copy.

## 51b · Notable chip in INFO blue (supersedes 51's yellow outline)

RULE (Florian, same day; endorsed): the notable chip is the OUTLINED
INFO-blue badge (--acc-blue text, --acc-blue-dim border — the token
sheet's CONNECTIVITY/INFO pair, the same pairing the kit already uses
elsewhere). The impact ladder now reads as the instrument convention:
red fill = failure/seismic, yellow fill = act today (major), blue
outline = worth knowing (notable), neutral outline = logged (noise).
Yellow means exactly one thing again, and yellow/blue is the
colorblind-safe axis. 51's light-theme --acc-yellow-dim ink (#8F8E00)
is withdrawn (unused).

IMPLEMENTATION: .chip-notable + hover rule in src/index.css; CLAUDE.md
badge law updated.

## 52 · Sweep face smoked on daylight (supersedes rule 2 for this face)

RULE (Florian, 2026-07-10: the constant-black clock face was jarring
on the light page; "take inspiration from the grey tones in the MCC
section — that was the right direction"): the news sweep-countdown
face takes the MCC launch clock's smoked treatment on the daylight
theme — rgba(20,20,18,.55) over the page ground (the approved
instrument grey), ghost cells rgba(0,0,0,.18) (MCC's 0.14 nudged up so
the centering grid still anchors, rule 1), on-stage labels at full
paper ink, flood side unchanged (volt flood, volt-equal ghosts, dark
flood labels). Volt digits constant in both themes. Night view
untouched. Constant-dark survivors: monogram/avatar tiles only.

IMPLEMENTATION: [data-theme="light"] .sweep-card / .sweep-lcd-ghost /
.sweep-lab rules in src/index.css.

## 52b · Daylight ghost segments quieter

RULE (Florian, same day): the smoked face's unlit LCD segments drop
rgba(0,0,0,.18) -> rgba(0,0,0,.11), just under the MCC clock's 0.14 —
the ghost grid should be felt, not read.

IMPLEMENTATION: [data-theme="light"] .sweep-lcd-ghost, src/index.css.

## 52c · Daylight ghosts, second step down

RULE (Florian, same day, second round): rgba(0,0,0,.11) -> .06 — on
the daylight face the ghost grid is subliminal, an impression of the
instrument rather than a visible frame.

IMPLEMENTATION: [data-theme="light"] .sweep-lcd-ghost, src/index.css.

## 53 · Seismic hover — negative for the copy, not the photo or frame

RULE (Florian, 2026-07-10): the seismic card's hover keeps its
photographic-negative READ but spares the thumbnail and the frame, and
the card's framing behaves exactly like every other card (border-2 at
rest, volt hover frame, z-lift). Implementation drops filter:invert
(which flipped the border, and triple-stacked on imgs so thumbnails
rendered negative) for explicit values: ground #FFFF00 -> #0000FF (the
literal negative), ink #0A0A0A -> #F5F5F5, outlined chips to paper ink,
filled chips keep their fills, media and foot untouched. Both themes
(the yellow fill keeps its hue everywhere, so its negative does too).

IMPLEMENTATION: .card-seismic:hover rules in src/index.css; rule 41's
seismic exclusion note retired.

## 53b · The SEISMIC tag flips with the negative

RULE (Florian, same day): on the seismic card's hover the SEISMIC chip
is part of the negative, not exempt from it — its red fill inverts
(#FF2E1E -> #00D1E1 dark, #D12619 -> #2ED9E6 light) and its white text
to black, exactly what the retired filter produced. Other filled
badges keep their fills; only the seismic tag belongs to the effect.

IMPLEMENTATION: .card-seismic:hover .chip-seismic in src/index.css.

## 53c · Seismic card's category chip — opaque panel backing

RULE (Florian, same day): the category chip on the seismic card was
transparent and read as a yellow pill on the yellow ground; it now
carries an opaque --bg-panel backing so it renders identically to the
same chip on every other card. Under the negative hover it becomes the
dark pill (#0A0A0A) with paper ink in both themes. (53b's seismic-tag
selectors gained the .card-meta scope so the cyan flip outranks the
generic chip rule.)

IMPLEMENTATION: .card-seismic .card-meta .chip rules, src/index.css.

## 53d · Seismic chips use the base inks (legacy dark-ink override retired)

RULE (Florian, same day: the launch chip went unreadable at rest): the
yellow-ground era pinned seismic-card chips to #0A0A0A ink and border —
right on yellow, invisible on 53c's panel backing. The override is
deleted; chips on seismic cards now render with the base chip inks
(text-1 on border-2 over --bg-panel), pixel-identical to chips on
every other card, in both themes. The date and meta labels keep their
dark ink (they still sit on the yellow itself).

IMPLEMENTATION: legacy .card-seismic .chip / a.chip:hover rules removed
from src/index.css.

## 53e · Backing exempts the SEISMIC tag (it keeps its red fill at rest)

53c's panel backing out-ranked the red fill by specificity and painted
over it. The backing rule now targets outlined chips only
(:not(.chip-seismic)); the tag is red at rest, cyan under the negative,
as ruled.

IMPLEMENTATION: .card-seismic .card-meta .chip:not(.chip-seismic),
src/index.css.

## 54 · The sweep clock opens the log; negative hover announces it

RULE (Florian, 2026-07-10): the sweep-countdown card is a real door —
clicking it opens /log/, the sweep changelog — and hovering it flips
the instrument to its stated negative (the rule-53 method, no filter):
paper face, flood and lit digits to #5200FF (the literal invert of
volt, landing on the palette's UV family), ghosts #D9D9D9, labels to
ink, the ARMED lamp to magenta #C60095, flood-side inks to paper, and
the standard volt hover frame. The footer stays put like every card.
Both themes share the values (volt and the lamp are literals). The
hover is earned: it announces a real destination, so the instrument
grammar stays honest.

IMPLEMENTATION: .sweep-link anchor in pages.tsx (SweepCard wraps stage
+ foot); .sweep-card:hover rules at the end of src/index.css.

## 52d · Sweep face smoked on the night theme too (pitch black retired)

RULE (Florian, 2026-07-10, completing rule 52's arc): the sweep clock's
dark-theme face drops constant #000 for the MCC launch clock's dark
recipe — rgba(255,255,255,.07) over the page ground, the instrument
dark grey. Both clocks now share one smoked treatment in both themes.
The hover negative softens to match: #E3E3DF paper grey (the literal
negative of a dark-grey face) instead of the white flash. Ghost cells
unchanged — the grey ground quiets them a step by itself, in the
direction rules 52b/52c already walked.

IMPLEMENTATION: .sweep-card background and :hover background,
src/index.css; CLAUDE.md constant-dark note synced.

## 55 · The sweep footer dissolves into the instrument

RULE (Florian, 2026-07-10: with the smoked faces, the footer's grey
matched the face and the seam stopped meaning anything): the separate
schedule footer is removed; its content (LAST / SWEEPS EVERY 12H /
NEXT) moves ONTO the stage as a bottom-pinned row in the instrument
register, mirroring the top label row. It renders inside both face
copies, so the volt flood clips and re-inks it exactly like the other
on-stage labels, and the hover negative carries it for free. The card
is now a single smoked surface: labels top, LCD center, schedule
bottom.

IMPLEMENTATION: SweepFace gains the schedule row (pages.tsx);
.sweep-sched layout + .sweep-card-foot/-seg rules removed
(src/index.css).

## 55b · Flood layer pinned above the base face (regression fix)

Florian's screenshot: seam-crossing labels rendered white OVER the
volt instead of flipping to dark ink — the doubled-face flip relied on
implicit DOM paint order, disturbed by the rule-54 link wrapper and
rule-55 layer changes. .sweep-flood now carries z-index: 1 so the
flood copy explicitly wins; the flip is structural again, not
accidental.

IMPLEMENTATION: .sweep-flood in src/index.css.

## 55c · LCD centers between the label and schedule rows

RULE (Florian: the digits overlapped the schedule line): .sweep-mid's
centering band still ran to the stage floor from before rule 55 put
the schedule there; its bottom inset now mirrors the top (22px), so
the LCD centers between the two label rows with clear air. Verified in
a headless render: no overlap, and the seam ink-flip reads correctly
on both rows.

IMPLEMENTATION: .sweep-mid inset in src/index.css.

## 56 · The seismic lede speaks in the display voice

RULE (Florian, 2026-07-10, annotated screenshot): the seismic card's
tagline renders in Plex Sans (450, 14px, regular case) — it is a lede,
not data; the what-happened body below stays in the mono data voice.
First sanctioned regular-case use of the display face; scoped to the
seismic lede only.

IMPLEMENTATION: .card-seismic .card-tagline in src/index.css.

## 56b · Sweep stage grows to 104px (amends rule 15's 86)

RULE (Florian, same request): the stage takes real padding between the
LCD and the rule-55 schedule row — 86 -> 104px, LCD centering insets
26/28, and the seam lean scales 26 -> 31px so the locked ~31-degree
slope holds on the taller face. Verified headless: clear air on both
sides of the digits, ink-flips correct on both label rows.

IMPLEMENTATION: .sweep-layer height + .sweep-mid insets in
src/index.css; clip-path lean constants in pages.tsx.

## 53f · Outlined chips join the negative fully

RULE (Florian): on the seismic hover the category chip takes the stated
invert of its per-theme rest state — light pill/dark ink on night, dark
pill/paper ink on daylight — instead of the fixed dark pill. The
SEISMIC tag keeps its cyan flip.

IMPLEMENTATION: per-theme .card-seismic:hover chip rules, src/index.css.

## 56 (amended) · Seismic lede weight 400

Florian's second look: 450 read bold; the display-voice lede sits at
400.

(Engineering note, 2026-07-10: the masonry packer pins cards with an
inline height, so a card whose CONTENT grows at runtime could never
re-fire the ResizeObserver — the box was pinned — and overflow:hidden
clipped the growth; this is what kept "cutting off" the clock's
schedule row after live height tunings. The observer now also watches
each card's direct children, so content growth re-packs. Verified:
force-growing the stage +26px at runtime re-packed the card with the
schedule row intact.)

(Engineering note, second pass on the clipped schedule row: the packer
no longer PINS the sweep card with an inline height at all — pins from
a pre-tuning measure were guillotining the instrument's bottom row in
long-lived tabs even after the child-observer fix. The clock's grid
span still reserves its rows; an unpinned fixed-height instrument can
never be clipped by a stale measure. Ordinary cards keep the pin,
whose sub-pixel absorption their footers provide.)

## 57 · The generated text tile is retired

RULE (Florian, 2026-07-10): items without a thumbnail render TEXT-ONLY
— no media block, no REG/PTN monogram header, on cards and on the item
page/modal hero alike. The masonry absorbs the shorter cards (that was
already its job). CLAUDE.md's item-images fallback chain now ends at
"nothing" meaning nothing.

IMPLEMENTATION: CardMedia returns null without an image; the modal's
tile branch removed; .card-tile/.tile-cat/.tile-co/.modal-tile CSS and
the CAT_ABBR map deleted (pages.tsx, index.css).

## 3f · Daylight ocean — deeper for the volt orbits (supersedes 3e)

RULE (Florian, 2026-07-10: "I need to create a contrast with the volt
orbits" — rule 46 made selected arcs volt-ink on daylight): the ocean
steps to #7B9CC4, a confident mid-blue. Full ramp: #E6EBEE > #DBE2E7 >
#C7D5E3 > #9DB9D6 > #7B9CC4. Land/grid/coast unchanged; verified in a
headless WebGL render with the boot ISS volt arc against the new
ground.

IMPLEMENTATION: --globe-ocean in [data-theme="light"], src/index.css.

## 3g · Daylight ocean lands on cartographic navy (supersedes 3f)

RULE (Florian, same request, final step: "make it dark blue"): the
daylight ocean is #3B5B88, a dark cartographic navy — the volt arcs'
contrast ground. The chart flips to the classic atlas read: pale land,
bright graticule on dark water, data accents luminous. Full day's ramp:
#E6EBEE > #DBE2E7 > #C7D5E3 > #9DB9D6 > #7B9CC4 > #3B5B88. Land, grid,
coast unchanged; verified headless with the boot ISS volt arc.

IMPLEMENTATION: --globe-ocean in [data-theme="light"], src/index.css.

## 3h · Daylight ocean — deep navy (supersedes 3g)

RULE (Florian: "even darker blue"): #24406B. The daylight globe is now
a dark atlas plate on the paper page — pale land and luminous data on
deep water. Note recorded: at this depth the coast stroke (#33495A)
matches the water's luminance and the land edge is carried by the fill
contrast alone, which reads clean. Ramp: ... > #7B9CC4 > #3B5B88 >
#24406B.

IMPLEMENTATION: --globe-ocean in [data-theme="light"], src/index.css.

## 3i · The daylight chart rethought: grey sky, white stars, no grid

RULE (Florian, 2026-07-10, superseding the paper-sky model): the light
theme's MCC canvas grounds on a dark-mid grey (--mcc-sky #47494C), the
stars go white (--mcc-fg #F2F2EE, main scene only — registry embeds
keep the page ink), the seas stay the deep navy (#24406B) and the
continents the pale land, and the lat/lon graticule is REMOVED on the
light chart (--globe-grid: none; the scenes skip the draw; the night
view keeps its tactical grid). Knock-ons carried with it: the left HUD
and status lamp float on the grey and remap their ink ramp to the
night values (the rail and VIEW panels are paper chrome, unchanged);
the canvas edge fades follow the sky token; the ISS wireframe returns
to its pale night inks in both themes; the dot cloud's additive glow
returns in both themes (the paper-era NormalBlending branch retired);
in-canvas labels flip to light-ink-on-dark automatically via the
luminance check. Verified in headless WebGL renders, light and dark.

IMPLEMENTATION: --mcc-sky/--mcc-fg tokens + light --globe-grid: none
(index.css); canvas-wrap ground + fades + HUD ink remap (orbits.css);
grid draw gate + fg token in scene.tsx; ISS inks + blending in
satellites.tsx.

## 3j · Continents at 80% grey

RULE (Florian): the daylight land drops its green cast for neutral 80%
grey (#CCCCCC) — a pure two-tone plate: grey land, navy water, grey
sky, white stars.

IMPLEMENTATION: --globe-land in [data-theme="light"], src/index.css.

## 3j (amended) · Continents at 80% INK grey

Florian's "80% grey" meant ink coverage, not lightness: the daylight
land is #333333. The daylight chart resolves as a moody sibling of the
night view — grey sky, white stars, navy water, dark land — with the
data layers as the only luminous elements.

IMPLEMENTATION: --globe-land in [data-theme="light"], src/index.css.

(Engineering note, the "continents still almost white" mystery: the
WebGL scene read its color tokens ONCE at mount and baked them into
the globe texture — theme toggles remounted the scene, but hot style
updates did not, so any open tab rendered palette tunes one or more
steps stale. Florian's live view lagged the whole daylight ramp while
fresh headless loads showed the truth. The scene now polls its token
set once a second and re-keys the palette only when a value changes,
so open tabs repaint within a tick of any tune. Proven by injecting a
red land token into a running page: repainted in 2.5s without reload.)

## 3k · The lighter view's triad: the night ladder, raised

RULE (Florian: "not a light theme — a lighter one"; the grey/navy/#333
triad read muddy): the daylight MCC grounds on the NIGHT view's depth
order at a raised ambient — sky #31363F (deep blue-grey), ocean
#2C4368 one step above it, land #43536B one step above the water
(night's land-over-ocean order restored; #333 under the navy read as
holes), coast #4D6980 (the night steel, now shared). Even ~6L steps,
one blue family, data layers brightest. Supersedes 3h/3j's values;
the principle supersedes the "daylight chart" metaphor: one instrument,
two ambient levels.

IMPLEMENTATION: --mcc-sky/--globe-ocean/--globe-land/--globe-coast in
[data-theme="light"], src/index.css.

## 3k (amended) · Ocean half a step darker

Florian's balance pass on the 3k triad: the ocean drops #2C4368 ->
#24395C, widening the land/water gap while the globe still lifts off
the #31363F sky. Final lighter-view ladder: sky #31363F, ocean
#24395C, land #43536B, coast #4D6980, data brightest.

IMPLEMENTATION: --globe-ocean in [data-theme="light"], src/index.css.

## 3k (second nudge) · Ocean to #1D3050

The land/water gap at a full step: sky #31363F, ocean #1D3050, land
#43536B, coast #4D6980. The continents now carry the globe's shape.

## 3m · Lighter-view HUD polish: track, clock foot, sky lift

RULE (Florian, three-point review): the vehicle meters' track goes
rgba(255,255,255,.14) inside the desktop remap (the paper track token
vanished under white fills); the launch clock's footer drops its pure
white --bg-inset for a dark inset (rgba(10,10,10,.28)) matching the
smoked stage; the sky lifts #31363F -> #373D48 (star background
slightly brighter). With 3l's scoping (night inks on desktop regimes
only; sky-tinted mid boxes; page inks on the stacked layout), the
lighter view is coherent at every width.

IMPLEMENTATION: remap block + .hud-launch-foot override (orbits.css);
--mcc-sky (index.css).
## 58 · The satellites-tracked hero floats in the instrument void (design 9a)

RULE (Florian via Claude Design, 2026-07-10): The MCC satellites-tracked
count is the page's hero element (rule 46). It renders frameless over
the canvas in the DISPLAY voice — Plex Sans 200/72, `--shell-accent` —
its digits justified edge-to-edge across the 272px HUD measure
(per-glyph flex cells; no tabular dependency, no shuffle within a digit
count, 6 digits tighten against held edges). Label demotes to one mono
line below (SP-16): `SATELLITES TRACKED` 10/500/+.14em with `AS OF
<stamp>` 10/400/+.08em one step dimmer. Placement is computed, not
styled: the module centers in the instrument void (masthead rule →
first rail ink; gutter → fitted cloud edge, globeCenterX − 1.22R) and
lifts one SP-16 step, the LCD rules' optical-center grammar; on stacked
layouts it is the first rail block at 52px. The legacy `.count-big` /
`--acc` implementation is retired.

IMPLEMENTATION: hero component (SatHero) in src/orbits/chrome.tsx,
styles in src/orbits/orbits.css (hero label inks carry their own
--hero-dim/--hero-dim-deep aliases, both themes: the neutral ramp has
no step at the handoff's values), void math beside FitCamera's spans
(onProject + recalcHero, src/orbits/scene.tsx). A page-load count-up
was discussed and deferred; no persistent animation is permitted.

## 58a · The launch block centers between the counter and the footer

RULE (Florian, 2026-07-11: "the left panel needs to be centered between
the sat counter and the footer, not between the top and bottom of the
page"): the launch block (ORBITAL FLOW / T-MINUS / LAUNCHES) centers in
the leftover BELOW the floating hero, not the full column. The hero's
own seat is unchanged: its void.bottom keeps the full-column centering
line (the block's pre-58a position, derived from sizes only) so the
counter does not chase the block it displaces — the dependency runs
hero → block, never back.

IMPLEMENTATION: scene.tsx sets the column's padding-top to the hero's
bottom edge when the hero floats (heroPos.clear), so the block's
existing auto margins measure from the counter; the rail fallback
already behaved this way (the in-flow hero pushes the block). Comment
updated on .ocol-left > .hud (orbits.css).

## 58b · The hero's seat, dragged into place

RULE (Florian, 2026-07-11: positioned by hand on a live drag handle,
1600×1240): the hero sits one SP-64 in from the page gutter and one
SP-20 step BELOW the void's optical center — supersedes 9a's
horizontally centered, SP-16-lifted seat. His drop landed at (90,110)
in frame coordinates; the grid-snapped rule gives (92,110), within
hand tolerance. The count's right edge now deliberately tucks under
the LEO cloud's sparse fringe (the 272px measure no longer fits
inside the void's width); the clamp thresholds still key on the void
and are unchanged, so narrow windows and zoom-in fall back to the
rail exactly as before.

IMPLEMENTATION: recalcHero's seat math (scene.tsx): left = voidLeft +
64, top = voidCenterY − H/2 + 20; dev reference check updated to hero
(92,174) viewport at 1600×1240. The 58a block-centering follows the
new seat automatically (padding derives from the hero's bottom edge).

## 58c · The launch block reorders: ranking, flow, clock at the foot

RULE (Florian, 2026-07-11): the launch block reads LAUNCHES · 6 MO /
BY VEHICLE first, ORBITAL FLOW second, and the T-MINUS clock anchors
the panel's foot. The block's first ink (now the LAUNCHES label) still
defines nothing structural — the hero's void math keys on the block's
box, so the reorder moves no seats.

IMPLEMENTATION: HudColumn child order (chrome.tsx); the .hud-module
first/last-child rules (flush top, clean foot) follow structurally.

## 58c (amended) · Flow back on top, ranking second

RULE (Florian, 2026-07-11, same review): swap the first two — ORBITAL
FLOW leads, LAUNCHES · 6 MO / BY VEHICLE second, the T-MINUS clock
keeps the panel's foot.

IMPLEMENTATION: HudColumn child order (chrome.tsx).

## 58d · 58a reverted: the launch block re-centers to the page

RULE (Florian, 2026-07-11, same review, "still not 100% happy"): the
launch block returns to full-column centering (top of frame to
footer), reverting 58a's counter-to-footer seat while the hero's
position is re-tuned by hand (see 58b's method: live drag handle plus
a module-gap slider, grid-stepped).

IMPLEMENTATION: heroPos.clear + the column padding-top removed
(scene.tsx); .ocol-left > .hud comment restored (orbits.css). The
hero's void.bottom already used the full-column line, so its math is
untouched.

## 58e · Second drag round: seat re-anchored, module gap 44

RULE (Florian, 2026-07-11, tuned on the live rig — drag handle plus
grid-stepped gap slider — after 58d re-centered the launch block to
the page): the hero's center sits one SP-64 step RIGHT of the void's
optical center and one SP-8 step ABOVE it, both offsets from the same
anchor (supersedes 58b's gutter-indent grammar; his drop (103,70)
frame-local, the snapped rule gives (104,70)). The launch block's
inter-module air steps 32 -> 44 (his slider value, on the 4px grid).
The count's right edge still tucks under the LEO cloud's fringe;
clamp thresholds unchanged.

IMPLEMENTATION: recalcHero seat math (scene.tsx): left/top =
voidCenter − module/2 + (64, −8); .ocol-left .hud .hud-module padding
44px 0 (orbits.css); dev reference check now expects hero (104,134)
viewport at 1600×1240.

## 58f · Back to the rail: the count is a module (floating seat retired)

RULE (Florian, 2026-07-11, "back to square one, that doesn't work"):
the tracked count moves INTO the left rail panel as its first module,
with everything the module grammar entails — the module measure, a
hairline below, the hud-label header (the AS OF stamp joins it in the
label's · convention: "SATELLITES TRACKED · AS OF <stamp>"), and the
shared module padding. The count keeps the DISPLAY voice at the V1.1
hero size (Plex Sans 200/52, --shell-accent) with the per-glyph
edge-to-edge justification from 9a. The panel centers in the column's
full height. Retired with the floating seat: the void math beside
FitCamera (onProject), the float/rail duality and clamp, the dragged
seat constants (58b/58e), and the hero-only label inks
(--hero-dim/--hero-dim-deep — the label is a standard hud-label now).
Module order: counter, orbital flow, vehicle ranking, clock at the
foot. The 44px module padding from 58e stands, pending another slider
round.

IMPLEMENTATION: SatCount module inside HudColumn (chrome.tsx, SatHero
deleted); scene.tsx sheds proj/onProject/heroPos/recalcHero/observers
and the FitCamera onProject param; orbits.css replaces the .osat-hero
family with .osat-count.

## 58g · The count closes the line by size, not spacing; module gap 52

RULE (Florian, 2026-07-11, slider round 2 + "this spacing looks off"):
the count fills the module measure by TYPE SIZE, never letter spacing
— the per-glyph justified cells (9a's edge-to-edge trick) read as
broken tracking at module scale and are retired. The count renders as
plain DISPLAY-voice text at natural tracking, sized to close the line
exactly (SatCount measures the rendered width and scales the type,
floored to the pixel; re-fits on resize and digit-count change, waits
for the display face to load). Tabular figures return so a moving
count neither shuffles nor re-fits within a digit count (the
2026-07-07 lock, by its original mechanism). The rail's inter-module
air steps 44 -> 52 (his slider, on the grid).

IMPLEMENTATION: SatCount fit effect (chrome.tsx); .osat-count drops
the flex cells for nowrap + tabular-nums, 52px as pre-fit fallback
(orbits.css); .ocol-left .hud .hud-module padding 52px 0.

## 58h · Launch clock stage 20% taller

RULE (Florian, 2026-07-11): the clock's display stage (the smoked
face, not the framed footer) steps 64 -> 76px — his "20% taller"
(76.8) snapped to the 4px grid per his standing nudge-to-grid call.
The digits re-center in the taller stage (the mid layer is inset:0
place-items center); the days chip stays pinned top-right; the footer
is untouched.

IMPLEMENTATION: .hud-launch-stage height (orbits.css).

## 58i · The count in volt-ink both themes; the scheduled hatch goes cyan

RULE (Florian, 2026-07-11, after a live volt-ink preview on night):
the satellites-tracked count renders volt-ink #64C400 in BOTH themes —
printed ink, not a lit instrument — and leaves the volt hero-element
list (CLAUDE.md synced; the LCD clocks keep true volt on their black
grounds). The orbital-flow SCHEDULED hatch (rule 48b's
hatched-equals-planned grammar) recolors from the volt shell accent to
the themed cyan (--acc-cyan: #00F0FF night, #007A87 daylight), legend
swatch included.

IMPLEMENTATION: .osat-count color var(--volt-ink); .flow-bar-sched +
.flow-sw-sched gradients var(--acc-cyan) (orbits.css); CLAUDE.md volt
list amended.

## 58i (amended) · Night cyan for the hatch on the daylight sky

RULE (Florian, 2026-07-11: "the cyan looks much dimmer in the light
theme"): the scheduled hatch sits inside the left HUD, which floats on
the GREY SKY in the light theme's desktop regimes — paper's darkened
teal (#007A87) vanished there. The 3i/3l remap already returns the
HUD's ink ramp to night values on that ground; --acc-cyan joins it
(#00F0FF inside the desktop remap). The stacked mobile layout keeps
paper's teal: its panels sit on the page, where the dark teal is the
one that holds.

IMPLEMENTATION: --acc-cyan added to the [data-theme="light"]
.ocol-left/.ostatus desktop remap block (orbits.css).

## 59 · Pre-v1.0 tweak set: masthead hairline goes volt; the MCC clock joins the count as ink

RULE (Florian, 2026-07-11, pre-v1.0 pass): (a) the masthead's bottom
rule thins from 2px n7 to a 1px shell-accent hairline — volt on night,
volt-ink on paper via the themed token; Florian's request is the
per-element volt sign-off. (b) The MCC LCD launch clock renders
volt-ink #64C400 in both themes, matching the satellites-tracked count
(supersedes 58i's parenthetical "the LCD clocks keep true volt" FOR THE
MCC CLOCK ONLY; the news sweep face keeps volt digits per 52d). (c) The
brand tag reads "/ NEW SPACE INTELLIGENCE" (renamed from "/ SPACE
INTELLIGENCE"). (d) The site ships the Negative Star mark as favicon:
SVG plus 32px PNG plus 180px apple-touch tile, geometry identical to
.brand-mark.

IMPLEMENTATION: .masthead border-bottom 1px var(--shell-accent),
.brand-tag copy (index.css, pages.tsx); .lcd-lit/.lcd-comma
var(--volt-ink) (orbits.css); public/favicon.svg, favicon-32.png,
apple-touch-icon.png + index.html head links.

## 60 · Typography gains a fourth voice: a normal-case reading register

RULE (Florian, 2026-07-11): the type system adds a fourth voice for the
long prose a reader actually sits with. The three existing voices are
unchanged — IBM Plex Sans caps is the DISPLAY voice (titles), IBM Plex
Mono caps is the LABEL voice (tags, chips, labels), IBM Plex Mono normal
case is the DATA voice (blurbs, taglines, citations, captions, ledes,
and everything rendered from data). The new READING voice is IBM Plex
Sans in NORMAL case: 14/400/1.6, sentence case, primary ink on the page
ground, proportional (non-tabular) figures. It clothes multi-sentence
authored prose only: the About Q&A answers and impact-tier explainer,
the methodology body paragraphs, the stats block answers, the log
section descriptions (source health / ledger / calibration / lead-source
presence), and the item PAGE explainer's what-happened and why-it-matters
paragraphs. The mono voice keeps every one-line lede, every tagline,
every `//` note, all card copy (cards are untouched — the whole card
explainer stays mono), the item modal, and all data rendered from
items.json / state.json / stats verbatim. Section headings stay the
sitewide lowercase mono labels. Authored prose was audited for the
sentence-case recase in the same pass and found already sentence-cased;
the only lowercase authored strings left are the house-style lowercase
section headings and the sitewide `//` comment-register notes, both
labels, deliberately unchanged.

IMPLEMENTATION: .prose class (index.css, near the copy-voice block) at
sans 14/400/1.6, text-transform none, --text-1, font-variant-numeric
normal, 46rem measure; .item-page p.prose override to outrank
.item-page p's data-voice size; font-weight dropped from .stat-answer so
.prose's 400 governs (its border-left accent and measure stay).
className="prose" applied on the AboutPage Q&A + impact answers,
MethodologyPage body paragraphs (the dim under-table footnote stays
mono), StatsPage stat-answer, LogPage/LogPresence section descriptions
(dim → prose), and the ItemPage what-happened / why-it-matters
paragraphs (pages.tsx).

## 61 · Round-2 corrections: full-bleed bar, bright paper accents, selection-fill hover, the heading floor

RULE (Florian, 2026-07-11, after the first pre-v1.0 review): (a) the
sticky masthead grounds the FULL viewport width (negative gutter
margins, gutter returned as padding) so card edges never scroll up
beside it. (b) Accent policy on paper: the light theme carries the SAME
bright accents as night (red, orange, blue, magenta, uv); the darkened
ink variant is reserved for hues that physically vanish on paper
(green, cyan ~1.3:1) — the volt/volt-ink logic generalized. (c) Nav
hover is the SELECTION FILL (variant 02 of the six-way demo): the label
floods literal volt (selection tokens, both themes) with ink text; the
active tab keeps the volt underline (position is a rule, action is a
flood). (d) HEADING FLOOR: an unclassed h2-h4 renders as the mono-caps
instrument label (11px/500/ls-inst/uppercase); big mono in normal case
is banned outright. (e) The subscribe unit lives in the masthead as a
[SUBSCRIBE] bracket control dropping a right-anchored panel.

IMPLEMENTATION: .masthead negative-margin bleed; light [data-theme]
accent overrides + policy comment; .nav a ::before volt flood +
aria-current ::after rule; global h2-h4 floor + .qa/.stat-block h2
section register (sans 16/300 caps, top hairline); SubscribeControl in
pages.tsx, .subscribe-panel in index.css.

## 62 · Stats and Log merge into one /system/ page

RULE (Florian, 2026-07-11): the Stats page and the Log page fuse into a
single page at a NEW url /system/. It reads as the machine's calibration
in the open. DESKTOP is a two-column grid: the LOG is the spine on the
LEFT (lede, KPI band, sweep entries, source health, source ledger,
lead-source presence, calibration, archive) and the STATS RAIL is a
STICKY ~340px column on the RIGHT (the hero tiles + every stat block,
each keeping its anchor id, table, method note, and cite-this element).
MOBILE stacks to one column with the STATS BAND FIRST (CSS order), then
the log. Both old urls redirect: /stats/ and /log/ 301 to /system/, and
the log archive months move under /system/ (/log/* -> /system/:splat).
Anchor ids on the stat blocks are unchanged so #launch-cadence and peers
keep resolving; fragments survive a 301 client-side. Section headings
follow the round-2 registers: the log's unclassed h2s stay the mono-caps
instrument label, the stat-block h2s keep the sans-caps section register.
The /stats.json ENDPOINT stays exactly as is, but the page urls it
embeds (each block's anchor and citation string) update from /stats/# to
/system/#.

NAV: the two separate glyph items (bar-chart for Stats, ledger-lines for
Log) collapse into ONE /system/ item — a 12px currentColor glyph of
three ascending bars standing ON a baseline rule with a shorter second
rule beneath (bars = the indices, rules = the ledger), aria-label +
title "System". The selection-fill hover and active-underline mechanics
carry over unchanged (it is still a nav link like any word).

IMPLEMENTATION: new "system" Route + PageData variant merging the former
stats and log slices (routes.ts, page-data.ts, page-data-server.ts,
routes-server.ts listRoutes/headFor); log-archive months matched and
emitted under /system/. pages.tsx: StatsRail (aside) + LogBody (div)
fragments extracted from the deleted StatsPage/LogPage and composed by a
new SystemPage under one <h1>; LogArchivePage, the sweep-clock link, the
digest and methodology cross-links, and the About Q&A copy repointed to
/system/. cite()/statsJson anchors -> /system/# (stats.ts). .system-grid
/.system-rail layout in index.css (sticky top calc(--header-h + --sp-4),
gap --sp-7, single column + rail order -1 below 64rem). public/_redirects
created with the two 301s + the /log/* splat.

## 63 · Registry card stack; hero-spec values carry the domain accent

RULE (Florian, 2026-07-11, registry index rework): the registry
browser keeps its pane MENU (constellations: domain + operator panes;
other sections: their one group pane), but the entity-list pane and
the detail panel merge into ONE card-stack region: the selected
group's entities render as full-width cards, one after the other,
topped by a full-width cyan COMPANY PROFILE bar when the group has a
profile (omitted when absent, or when it would only duplicate a lone
card's own link).

COLOR AMENDMENT (his explicit ruling, "add color to the hero specs,
be creative but logical, systematic"): REGISTRY CARD SPEC VALUES ONLY
(the .reg-spec dd figures and a 2px left tile edge) carry a role
color, overriding the "no role color on counts" default for this one
surface. The system is the orbits domain palette translated into the
governed --acc-* tokens so the light theme's ink overrides apply: eo
green, connectivity magenta, iot cyan, launch vehicles orange,
spaceports uv, ecosystem blue. Labels stay dim; running prose, dates,
and names stay neutral. Status badges may carry a role-color glyph
(≤12px: ● live green for operational, ◆ orange for development or
planned states), text neutral, per the glyph pack.

IMPLEMENTATION: PaneBrowser card stack + CARD_ACCENT map + RegCard
--card-acc (pages.tsx); .reg-stack, .reg-profile-bar, .reg-spec
accent rules, .stat-glyph-* (index.css). The fused pane-head counts
("PROVIDER24") fixed via .reg-pane-count with an explicit margin.

## 64 · Connectivity dots — 0.45x

RULE: the connectivity dot factor drops to 0.45x (Florian 2026-07-11,
"dim the connectivity satellite cloud again. Half a step down. Still
too overwhelming"): rule 34's step was 0.6 -> 0.5, so half that delta
further lands at 0.45. Same `aDot` per-point size attribute, one draw
call; every other category keeps the full disc. Theme-independent (the
factor scales point size, not the neon token, so the light theme's
--neon-connectivity remap is untouched).

## 64 (amended) · Connectivity blanket to 0.35x

RULE (Florian, 2026-07-12: "Reduce the connectivity sats to 0.25"):
the connectivity dot scale settles at 0.35x. Path: rule 64's 0.45
-> 0.25 tried live and ruled too dim -> 0.3 -> 0.35 (final round,
same session). Every other domain cloud unchanged.

IMPLEMENTATION: dotScaleArr connectivity fill 0.35 (satellites.tsx).

## 65 · Theme switch — drawn sun/moon

RULE (Florian, 2026-07-12, third round: "a more elegant and beautiful
way... sun/moon is a good direction"): the theme switch is a DRAWN
15px SVG pair, not a font glyph (the U+2600/U+263E route read as
dingbats and needed a symbol-font stack). Sun on night, moon on
paper — still naming the theme the click goes TO. House vocabulary:
the sun's eight rays are square-cut strokes off a filled disc; the
moon is a crescent carrying the brand mark's SQUARE STAR beside it.
Both follow currentColor (text-3, text-1 on hover); no new color
roles. Vertical seat unchanged (3/5 padding, text-top within 0.1px
of the word row).

IMPLEMENTATION: inline SVGs in ThemeToggle (pages.tsx);
.theme-toggle svg display block, symbol font stack removed
(index.css).

## 66 · Coffee badge — drawn cup glyph

RULE (Florian, 2026-07-12: "a coffee glyph in the buy me a coffee
button?"): the support badge's leading glyph is a drawn 11px
mono-line coffee cup (square body, square handle, two steam ticks,
1.1px stroke, currentColor) replacing the glyph-pack ◆. Badge
grammar otherwise untouched: dim-accent border, accent text, never
filled.

IMPLEMENTATION: inline .badge-glyph SVG in the coffee anchor
(pages.tsx); ◆ ::before rule dropped (index.css).

## 67 · Masthead narrow-window grid

RULE (Florian, 2026-07-12: "menu behavior is janky when the window
is resized and made narrow. Solve that."): below the single-row fit
(72rem) the masthead becomes a deliberate two-row GRID — brand + tag
+ the framed badge pair on row one (badges right), the word menu
with the theme switch flush left on its own full-width row two. The
old flex wrap dropped the whole nav right-aligned under a dead
half-bar (~1100px), then orphaned the coffee badge onto a third row
(~760px). At 40rem the coffee badge collapses to the CUP ALONE
(24px square; it used to hide outright) and the tag hides as before;
at 30rem the word gap tightens (8/12) so phone widths wrap into
clean flush-left rows.

IMPLEMENTATION: .nav-controls cluster split out of .nav (pages.tsx
Masthead); @media 72rem masthead grid, 40rem cup collapse via
.nav-badge-label display none, 30rem .nav gap (index.css).

## 68 · Registry casing, details tab, domain-accent active tab

RULE (Florian, 2026-07-12 morning, four-point registry pass):
(a) CASING: the profile breadcrumb ("REGISTRY / VEHICLES / ...") is
label register, CSS-uppercased; org KIND values are tags, not prose —
caps in the card tile and the pane's kind rows ("LAUNCH SERVICES",
"MANUFACTURER"); the missing launch-services entry joined
ORG_KIND_LABEL so the raw slug never renders.
(b) "SPECS" is renamed "DETAILS" everywhere the reader sees it (tab
label, "details & sensors" when imaging modes exist, "// KEY DETAILS"
panel): "specs" fits vehicles and spacecraft, not spaceports or
organizations. Tab ids and #specs anchors unchanged.
(c) The registry index footnote runs the full pane width (the 46rem
reading measure came off; Florian: as wide as the registry table).
(d) ACTIVE PROFILE TAB carries the page's DOMAIN accent, not volt
(Florian: volt "too bright" here): fill var(--reg-acc) — eo green,
connectivity magenta, iot cyan, vehicles orange, spaceports uv, orgs
blue — with the label in var(--bg-page) so the light theme's ink-dark
accents stay readable. One fewer volt surface; the selection-fill
grammar elsewhere is untouched.

IMPLEMENTATION: .breadcrumbs text-transform, .profile-tab.active,
.reg-footnote (index.css); ORG_KIND_LABEL + kind tile uppercase
(reg-entries.ts); org pane group labels, tab labels, key-details
heading (pages.tsx).

## 69 · Card hover: inward volt band, immutable grid

RULE (Florian, 2026-07-12, supersedes rule "fix 2" volt border
recolor): the masonry grid's gray border NEVER changes. On hover the
face inverts as before and a 2px volt band grows INWARD from just
inside the border (100ms ease-out), drawn as an overlay ABOVE all card
content, thumbnails included. Applies to every card: standard, seismic
(over its blue negative), and the sweep clock. --shell-accent stays
the theme token. Geometry chosen by Florian from a three-option
question (flush line / inward band / inset ring): inward band.
REJECTED on the way, do not re-propose: border-color recolor on hover
(shared-seam breakage), inset ring with a gap, inset glow "halo"
(inset shadows paint UNDER children; thumbnails always occlude it),
five-variant gallery (reticle / selection / scanline / meter / focus).

IMPLEMENTATION: .card::after / .sweep-card::after border-width 0 to
2px, z-index 5; .sweep-card gained position: relative (without it the
overlay anchored to the page: a site-wide frame on clock hover).

## 70 · Caps as a system

RULE (Florian, 2026-07-12: "no lowercase anywhere"): all UI chrome
renders uppercase. Registry surfaces (.registry-profile, .reg-index)
uppercase at the CONTAINER with named opt-outs: overview paragraphs
and entry snippets (verbatim sourced prose). Everywhere else, chrome
classes carry the transform (esc control, source-as-of lines, footer,
credits, quick-facts values, pagers, placeholders, SNR trace rows and
popovers, empty states). Data values with units (nm/km/m) and article
explainer prose stay as authored: uppercasing corrupts units and
readability. Form controls need text-transform: inherit (UA default
blocks the container rule).

## 71 · One edge per page

RULE (Florian, 2026-07-12): a page's blocks share ONE right edge; no
module gets a private width. Registry profiles: overview, stock chart,
tables, and timeline all span the profile measure. About: everything
(prose, tables, diagrams) shares a 62rem measure, justified with
auto-hyphenation. The two-tier look (hairlines wider than paragraphs)
is retired.

## 72 · About is the white paper; SNR reads as an instrument ledger

RULE (Florian, 2026-07-12): /about/ is the single system document
(concept, engine diagram with owner color legend, full SNR rulebook,
tiers, registry channels, FAQ); /methodology/ is retired into
/about/#methodology with 301s. Rulebook renders as ledger-notation
rule grids; tier tables wear the real LED marks and impact chips. The
item detail's signal-to-noise section is an instrument ledger: hero
LED row + 52/200 numeral, axes strip, signed deltas on one
right-aligned gutter, sum row, movements, label-register footer.
Scoring deltas color by sign EVERYWHERE the notation appears: positive
green, negative red, zero orange (small mono glyphs, within the color
budget).

## 73 · Masthead: order, alignment, and a plain MCC

RULE (Florian, 2026-07-12): menu order NEWS · MCC · REGISTRY · SIGNALS
· SYSTEM · ABOUT. Nav link vertical padding balanced (4.5/3.5, was
0/5 underline reserve) so word centers align with the framed badges
within 0.2px. The MCC nav word stays PLAIN: the animated markers
(orbiting sat, satellite pass, ripple/breathe/scan, the two-layer
occluding atom) were all built, reviewed, and REVERTED by Florian; do
not re-propose without a new brief.

PROCESS (rule 69-73 rounds): zoom-inspect rendered output
(element.style.zoom then screenshot) BEFORE reporting a visual as
done; verify hover states with the pointer actually parked on the
element.

## 74 · Footers are centered colophons

RULE (Florian, 2026-07-12 pre-v1 pass): both footers center. The site
footer is a four-row colophon in the mono label register (10px caps,
dim): mission line, action links (verification policy / SNR score /
sweep log / stats.json), category feeds, identity line ("VESPERIO /
NEW SPACE INTELLIGENCE · © 2026"), each row on a 46rem measure with
--sp-2 rhythm and --sp-5 before the identity line; the shell's bottom
inset closes the page. The MCC status bar joins the same grammar:
justify-content center with flex-wrap (attribution and freshness stack
as centered rows when the stage narrows), 10px/500/.08em (the 8px face
was off-system), padding 12px 0.

## 75 · /system/ typography: no lowercase STARTS, one measure

RULE (Florian, 2026-07-12, clarified same day): "no lowercase" means
no sentence or label STARTS lowercase; normal case is allowed. A
container-wide uppercase on /system/ was built and REVERTED — do not
re-propose. What holds: ::first-letter guards on machine-rendered
text (sweep summaries, stat tile labels) and uppercase-in-source for
native tooltips (title bubbles can't be CSS-guarded); data values
(domains, slugs, category names) stay as data. Paragraphs of equal
width (rule 71 applied): every text block on the log spine and rail
shares the 46rem measure, justified with auto-hyphenation —
summaries, signals/discovery lines, SNR movement notes, panel prose,
ledes, hero sentence. The 80ch sweep measure is retired. SNR movement
downgrades recolored orange -> red per rule 72 (sign colors
everywhere the notation appears).

AMENDMENT (same day, "balance the system page"): the /system/ grid is
two balanced instruments: the log spine caps at 48rem (46rem text +
1rem panel padding a side; sweep frames carry no dead width) and the
INDICES rail breathes clamp(340px, 30vw, 30rem) instead of the fixed
340px. justify-content: space-between hands leftover width to the
middle seam; the gap is the floor when space is tight. Verified at
1600 (spine 768 / seam 296 / rail 480), 1280, and the mobile stack.
