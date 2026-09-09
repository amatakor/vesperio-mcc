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

The artwork judge lost its pen for good (2026-07-18), and works for
the first time because of it. The 2026-07-15 permission respelling
never actually fixed the write denial: every sweep since the judge
shipped still fell back to og-image-first order, which is how a
corporate logo from a press-release page beat a trade article's real
photograph of the Valiant Shield exercise on 2026-07-17. The judge is
now strictly read-only and returns its ranking as its final message;
a deterministic extractor script writes the ranking file from the
run's captured output, so there is no permission spelling left to
get wrong. The same investigation found the thumbnail fetcher was
swallowing HTTP failures silently (a rate-limited page looked
identical to a page with no images), so non-2xx responses now log
their status and rate-limit or server errors get one polite retry.

Thumbnails also lost their white letterbox bars (2026-07-18): some
publishers paste a dark graphic onto a white canvas for their
share image, and the white side bars read as broken card edges. The
re-encode step now shaves uniform near-white borders, but only when
it is provably a border shave, never a content crop: all four corners
must be near-white, at least half the image must survive, and the
result must still pass the minimum-size gate. The manual override
tool gets a --no-trim flag to keep an image exactly as served.

The dispute machinery learned to tell time (2026-07-18): the day
India's first private rocket reached orbit, the scoring engine
marked the item disputed because the registry still said the vehicle
had zero flights, on a snapshot dated ten days before the launch.
Both statements were true on their own dates; nothing was disputed.
Cumulative counters that only ever grow (flight counts, satellites
launched, launches from a pad) are now superseded in time rather
than contradicted: a higher or equal count dated after the snapshot
proposes a registry refresh instead of engaging the dispute rules,
while a count that goes DOWN still reconciles as a genuine conflict.
The same fix gave disputes an honest lifecycle: they now survive
ordinary rescores (previously any rescore silently dropped the
downgrade while the flag stayed on), and the one way to clear a
dispute is an explicit attested resolution whose note says why. The
false flag on the Vikram-1 item itself was removed by hand the same
morning.

The sweep trigger moved off GitHub's scheduler (2026-07-13): after
two mornings of 2h-late or dropped crons, a Cloudflare Worker
(infra/sweep-trigger/) now calls the dispatch API at exactly
05:15/17:15 UTC; the GitHub cron became a 06:45/18:45 fallback behind
a freshness guard, so a missed primary costs at most 90 minutes and
a double run costs nothing.

Launch Library lost its tier-5 badge (2026-07-22): CLAUDE.md and the
registry path always scored it as an aggregator at tier 4, but the
news gate's host list classed it as computed observational data at
tier 5, past the direct-source ceiling. Florian adjudicated it back
to aggregator; the gate and the drafting prompt now agree with the
policy, and a one-shot migration reclassed five item sources and
rescored the three LL2-led launch items from 5 to 4, with the
movements logged on /system/. The item ledger also stopped saying
"not tested yet" under items whose corroboration earned no lift: when
corroboration sources are attached but the ceiling absorbed them, it
now says so.

QR codes are never artwork (2026-07-22): the morning sweep stamped
Sina Finance's WeChat QR code onto the Gravity-1 sea-launch item
because it was the article's only in-body image, square, and over the
minimum size, and the artwork judge only ranks contested candidates.
Every candidate's pixels now run through a QR decoder and anything
that reads as a QR code is rejected; the recovered QR itself became
the regression fixture. The manual image override learned the same
gate, plus a short map of known source media buckets (TheSpaceDevs'
image CDN) so a source's own hosted photograph counts as coming from
that source; the map is how the Gravity-1 item got its real rocket
photograph from its Launch Library record.

Polish round (2026-09-09): the first work session after seven weeks
of unattended machine commits opened with a full audit (browser
walk-through of every page in both themes and at phone width, plus
typecheck, tests, a link check over all 846 prerendered pages, the
artwork files, and the house-style rules); the fundamentals were
clean. Fixed: the MCC page's bottom bar overflowed a phone screen
because its three freshness timestamps could not wrap (they now break
between entries); the news feed's page numbers spilled past a phone's
right edge (they wrap now); the registry Sources view clipped long
field labels with no way to read them (a hover tooltip carries the
full label). /system now shows the last 30 days of sweeps instead of
90, with older months on their archive pages; at four sweeps a day the
90-day window had grown to 228 entries on one page. The held queue
stops collecting the same story twice: a candidate re-queued on a
later sweep (same source URL, or the same headline) folds into the
existing entry with its new reason appended, and the merge is stated
in that sweep's summary. The orbits refresh no longer files an ops
alert every time CelesTrak is slow: it stops issuing queries after 150
seconds, keeps the previous element sets, and only fails the run when
every query failed and the kept data is more than three days old
(thirteen alerts between July 22 and August 31 were all this). The
sweep procedure in CLAUDE.md now says the workflow runs the build after
the agent, so the agent stops logging a "build denied" lesson twice a
day.

Item modal left plate scrolls (2026-09-09): the July rule that only
the right column scrolls left the title/image/sources plate fixed, so
an item with eight attached sources (Isar Aerospace's Spectrum
reaching orbit) cut its source list off at the bottom. The plate now
scrolls on its own when its content overflows and stays put otherwise;
the artwork height cap and the mobile single-column scroll are
unchanged.

Date register (2026-09-09): the "updated 7 Sep" marker that resurfaced
items wore as a chip now sits with the event date as one timestamp
block in the same dim mono register, stacked at a card's top-right
corner and inline on the item and modal bands. Chips are for
classification (category, impact, kind, disputed); a timestamp in a
badge was the odd one out, and it wrapped the badge row onto a second
line on seismic cards. The resurfacing rule itself is unchanged.
The date block now spans exactly the chip row's height, so a single
date centers on the chips and the stacked pair sits flush with their
top and bottom edges. Card headlines are never clamped any more: the
three-line cut with an ellipsis is gone and the card grows to fit
(Florian, 2026-09-09; the 90-character headline rule bounds the
growth). Taglines keep their three-line clamp.

Artwork relevance veto (2026-09-09): the Planet Labs defense-contract
item wore a portrait of Elon Musk. Root cause: its informal
corroboration source was a 247wallst.com market roundup whose only
image was that portrait, the artwork judge only ever ranked candidates
and never rejected one, and it did not know the story it was judging,
so "any real photograph beats a logo" made an unrelated face the
winner. The judge now receives each item's headline and companies,
drops every candidate that does not depict the story or its named
actor (unnamed people, other companies' hardware, roundup-page images
from other stories, a publisher's watermarked stock composites,
earnings and price chart cards), and may return an empty order; the
apply step treats a candidate the judge left out as rejected, never as
a fallback. Three 247wallst.com images were removed by hand (the Musk
portrait, a watermarked satellite render on the AST SpaceMobile Q2
item, an earnings chart card on the Planet Q2 item); those cards
render text-only.

Impact filter and multi-select (2026-09-09): the news feed's filter
panel gains an IMPACT row (seismic, major, notable, noise) alongside
category and domain, and every row now takes several picks at once.
Values within a row combine as OR and rows combine as AND, so "major or
seismic, within launch or constellation" is one selection. The panel
stays open while chips are toggled and closes on a click outside or
Escape; the button reads the live selection ("MAJOR · SEISMIC ·
LAUNCH"); counts come precomputed over the whole corpus; the ALL chip
clears every row. The button's word changed from CATEGORIES to FILTER
now that it covers three groups.

Registry self-population round, part 1 (2026-09-09): the crossfeed
reconciler now looks at values, not only source tiers. A news claim that
states the same value as the stored fact confirms it (a stronger source
refreshes the citation, an equal or weaker one changes nothing) and is
never routed to the dispute queue; the Sentinel-1 NG "dispute" between
two sources that both said 2 is cleared from the profile and from the
held queue. Positioning claims must cite the entity's own website
domain, enforced by the validator, and the maintenance run now fills
empty claims blocks a few profiles at a time from the entities' own
pages. Organizations enter the crossfeed scope with the new fields the
feed carries (headquarters, parent organization, latest and total
funding, valuation, headcount), the drafting prompt requires the
matching fact on funding, M&A, IPO, headquarters, and status items, and
the maintenance prompt covers organization profiles. The two queue
files named "candidates" now each say which queue they are.

Category-agnostic dedup gate (2026-09-09): the HIE/Orbex Sutherland
Spaceport story published twice, once as a `financial` item and once
as a `launch` item, because the sweep merge gate only ever compared a
new draft against existing items sharing the same company AND the same
category. The gate now also rejects a same-company match within the
7-day dedup window when the new draft shares a source URL (a
canonicalized comparison: scheme, `www.`, tracking query params, the
fragment, and a trailing slash are all stripped before comparing, so
an http/https or `?utm_source=` republish of the same page still
matches) with an existing item's `source_url` or `secondary_urls`,
regardless of category; the existing near-identical-headline
(SimHash) cross-category check is unchanged and still applies
alongside it. The rejection message now also names the existing
item's id directly in its "draft it as an updates[] entry" instruction.
The duplicate `2026-08-25-orbex-sutherland-spaceport-hie-acquisition`
item and its re-hosted artwork were removed by hand; the surviving
`2026-08-25-hie-sutherland-spaceport-assets` item is unchanged.

Organization profiles can now self-populate from the news feed
(2026-09-09): the registry crossfeed used to carry only country,
founded, focus, and status onto a company profile, so the funding
rounds, valuations, acquisitions, and headquarters moves the feed
reports constantly had nowhere to land. Organization profiles gain six
optional sourced fields: headquarters, parent org (the owning company
after an acquisition or merger), funding (latest), funding (total,
only when a source states the total outright, never summed from
rounds), valuation (latest), and employees. Each renders on the
organization profile page exactly like the existing fields, only when
a source has filled it in, with its source link, as-of date, and
provisional badge where it applies; parent org links to that company's
own profile when one exists, same as operator and provider already do.
The crossfeed's allowed-field list and value-shape check grew to
match, and the registry validator's exhaustive key list now accepts
the six fields as optional SourcedFields. No existing profile was
touched; the fields stay null until the feed states a fact.

Registry crossfeed outcome ledger (2026-09-09): the weekly registry
maintenance run consumes the news-to-registry crossfeed queue
(registry-candidates.json) by deleting each candidate once it acts on
it, which left no record of whether a candidate actually landed, was
re-sourced, was disputed, or was rejected. A new machine-owned file,
registry-crossfeed-log.json, now records the outcome of every consumed
candidate. A deterministic script (scripts/record-crossfeed-outcomes.ts,
no network, no LLM) snapshots the queue right before the agent runs and
diffs it against the queue afterward: any candidate that disappeared was
consumed, and its target registry field is inspected to classify what
happened to it, landed with the proposed source, landed but re-sourced
to a different one, disputed against a competing claim, or left
unchanged. The /system page gains a "registry crossfeed" panel listing
the last 20 consumed candidates with their outcome and a link back to
the source item, plus lifetime totals per outcome; the KPI row gains a
"crossfeed landed" count alongside the existing "crossfeed queued" one.
