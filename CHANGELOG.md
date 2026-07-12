# Changelog

Platform releases of vesperio.ai. Every entry is a deployed version; the
version being replaced is backed up (git tag + bundle) before each
go-live. Data commits (news sweeps, orbit refreshes, registry
maintenance) deploy continuously and are not versioned; this log tracks
the platform itself.

## v1.01 — unreleased

The sweep countdown gains a HOLD state: when a scheduled sweep slot has
passed but the deployed data predates it (GitHub fires this repo's cron
40-70 minutes late some days), the clock freezes at zero under the full
volt flood and reads HOLD with the minutes elapsed, instead of silently
re-arming for the next slot. The LAST label now shows the actual last
sweep time from the site's own data. Guards from the same session: the
build rejects registry status values over 32 characters (statuses are
chips, not sentences) and the maintenance prompt spells out the
convention.

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
crawl.
