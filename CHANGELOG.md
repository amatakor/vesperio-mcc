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
the reader to the top when cards re-measure mid-scroll), and the
launch-cadence policy guard (2026-07-12: routine megaconstellation
batch launches always publish at noise, US and Chinese alike; launch
candidates are judged from the article body, never the headline).
