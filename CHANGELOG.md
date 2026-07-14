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

The pre-launch QC hardening pass (2026-07-13, from the 2026-07-12
review): the whitelist SNR floor is membership-checked against
signals.json channels instead of trusted on attestation (the "self"
floor additionally requires the poster's org to match the item's
company); registry facts are capped by what their source host's class
earns, unknown profile fields are rejected, and scheduled runs can no
longer create or delete registry entries or touch the MCC READ blurbs;
the six-file sweep write is staged so a crash cannot commit partial
state; source-reliability strikes now age out with the claim they
punish; the image fetchers refuse hostnames that resolve to private
addresses (DNS rebinding) and carry one overall deadline; the SVG logo
sanitizer was rebuilt parse-and-allowlist fail-closed with a
content-security header on /img/ as a second lock; a same-company
near-identical-headline net catches re-categorized duplicates; item
artwork re-encoded to WebP (65 MB to 8 MB, future thumbnails encoded
on arrival); sitemap.xml and robots.txt now ship, home and MCC carry
their missing h1, and the 404 page stopped advertising a dead
canonical; the item modal traps keyboard focus properly; the MCC view
idles in hidden tabs and recovers from GPU context loss; source
attributions and as-of dates stepped up one ink for WCAG contrast, the
light theme got a visible focus ring, and the commentary impact cap
moved from notable to major (seismic stays events-only; Florian,
2026-07-13).

The registry and MCC additions (2026-07-13): Soyuz-2, Proton-M, and
Angara A5 vehicle profiles; GPS, Galileo, BeiDou, and GLONASS
constellation profiles under the new navigation domain, deliberately
without MCC layers (their medium-Earth orbits overwhelm the view);
four new MCC layers for Iridium, Globalstar, Qianfan, and Guowang
(the satellites-tracked count rose from 12,300 to 12,781); and the
sweep countdown's spoken label now says hours and minutes instead of
raw minutes.

The science category (2026-07-13): dated program events of deep-space
and planetary science missions joined the scope (launches, arrivals,
landings, sample returns, provider selections, major failures), with
the commercial supply chain as the editorial angle; routine ops,
paper results, and evergreen explainers stay out. Futurism joined the
monitored sources.

The feed learned to resurface developments (2026-07-13): items keep
filing by their honest event date, but one that gains a corroborating
source or a score movement after publication floats back up wearing
an "updated" chip beside its unchanged date, so readers see the
development without the feed ever implying an old event just
happened.

The artwork pipeline grew taste (2026-07-13): item thumbnails now
consider a page's in-article photographs alongside its og:image, and
when several candidates pass the gates, a sealed bounded model step
ranks them (real photograph beats concept art beats stock graphic
beats chart), with its one-line reasoning logged per item and a full
fallback to the old behavior on any failure. A companion tool lets
Florian override any item's artwork with another image from the
item's own sources through the same gates.

The artwork judge got its pen back (2026-07-15): its first day in
production, the judge ranked candidates for two full sweeps but a
too-strict write permission silently discarded every ranking, and the
fallback order shipped a 1024x1024 company logo over the article's
real photograph because the logo detector only recognized logos up to
900px. The write permission now accepts every spelling of the ranking
file's path (still that one file, the judge's seal unchanged), a
judge that writes nothing now raises a visible warning on the run
page instead of degrading silently, and the fallback's logo test is
size-independent, so a near-square image of any size yields to a real
photograph.

The sweep trigger moved off GitHub's scheduler (2026-07-13): after
two mornings of 2h-late or dropped crons, a Cloudflare Worker
(infra/sweep-trigger/) now calls the dispatch API at exactly
05:15/17:15 UTC; the GitHub cron became a 06:45/18:45 fallback behind
a freshness guard, so a missed primary costs at most 90 minutes and
a double run costs nothing.
