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
