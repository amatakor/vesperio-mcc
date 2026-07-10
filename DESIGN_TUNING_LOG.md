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
