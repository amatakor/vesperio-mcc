# Changelog

Platform releases of vesperio.ai. Every entry is a deployed version; the
version being replaced is backed up (git tag + bundle) before each
go-live. Data commits (news sweeps, orbit refreshes, registry
maintenance) deploy continuously and are not versioned; this log tracks
the platform itself.

## v1.0 — pending

The launch baseline: the full platform as built through 2026-07-12,
squashed to a single root commit when the repository goes public.
Highlights of the pre-release polish rounds (2026-07-11/12): Negative
Star favicon set, sticky full-bleed masthead with selection-fill nav
hover, drawn sun/moon theme switch, SUBSCRIBE and BUY ME A COFFEE
badges, news feed infinite scroll, SNR and impact popovers, /system/
merge of stats and log, registry card stack with domain-accent spec
values and domain-accent active tabs, MCC ground-stations layer with
receiving cones, registry fill crawl (91 sourced fields) and timeline
crawl, sweep-clock HOLD signal (the countdown freezes at zero and says
SCHEDULER LATE instead of silently re-arming when a sweep slot passes
unserved) with the honest LAST timestamp, the status-is-a-word build
guard, the infinite-scroll fix (the masonry repack no longer yanks
the reader to the top when cards re-measure mid-scroll), the
launch-cadence policy guard (2026-07-12: routine megaconstellation
batch launches always publish at noise, US and Chinese alike; launch
candidates are judged from the article body, never the headline), and
the platform-polish round (2026-07-12): the About page rebuilt as the
site's white paper (color-coded data-engine diagram, the full SNR
rulebook merged in from the retired /methodology/ page with 301s, rule
grids in ledger notation, tier tables wearing the real LED marks and
impact chips, one justified 62rem measure), the item detail's
signal-to-noise section redesigned as an instrument ledger with
sign-colored deltas, the item modal's title module moved to the left
plate above the artwork with right-column-only scrolling and one
shared inset, uppercase enforced across all chrome with registry
surfaces capsed at the container, one shared right edge per registry
profile, menu reordered (MCC after News) with nav word centers
aligned to the framed badges, the card hover reworked so a 2px volt
band grows inward while the grid border never changes (seismic and
the sweep clock included), and the thumbnail pipeline taught never to
hand two cards the same artwork.
