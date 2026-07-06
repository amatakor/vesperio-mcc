# Task 15: operator history timeline collection rules

Read RULES-collect.md (same directory tree: ../task13/RULES-collect.md)
first; its sourcing and style rules apply. These rules add the
timeline-specific procedure.

## Goal

For each assigned entity: 6 to 12 major events covering roughly the past
10 years PLUS founding-era anchors. Event types that qualify: founding,
first launch / first flight of a flagship product, major acquisitions and
divestments (both directions), IPO / SPAC / delisting / bankruptcy,
flagship program starts and cancellations, major failures or incidents,
landmark contracts and government awards, renames and rebrands, major
constellation milestones. Routine launches and product releases do NOT
qualify; a timeline of 40 entries is a failure of judgment.

## Sourcing

1. WIKIPEDIA IS ALLOWED FOR DISCOVERY ONLY. Use the entity's Wikipedia
   article to learn which events exist and when, and use its footnotes to
   locate the source that states each event. Wikipedia never appears in a
   source field, ever.
2. Every event's source must be a page you actually fetched that states
   the event: company newsrooms and press releases, SEC/regulatory
   filings, agency announcements and award notices, Gunter's Space Page
   deep links.
3. Where only credible trade press records the event (Reuters, SpaceNews,
   Payload, NASASpaceflight, European Spaceflight), cite the article and
   end the headline with " (per [outlet])". Everything else (blogs,
   aggregators, forums) does not qualify; drop the event.
4. Date precision: record exactly what the source states: YYYY, YYYY-MM,
   or YYYY-MM-DD. Never invent a day.
5. Verbatim quote per event (max ~250 chars) from the cited page.
6. Record every URL fetched (Wikipedia included) in fetched_urls.
7. Politeness: at most ~15 fetches per entity including discovery.

## Headlines

Actor-first, factual, plain English, max 90 chars, no hype verbs, no em
or en dashes. "Planet acquires RapidEye's constellation and archive",
not "Planet supercharges its offering with RapidEye deal".

## Output

One file per entity: <OUTDIR>/<slug>.json

{
  "slug": "<slug>",
  "entity_type": "<organization|constellation>",
  "as_of": "2026-07-05",
  "fetched_urls": [...],
  "events": [
    { "date": "YYYY[-MM[-DD]]", "headline": "...", "source": "<url>", "quote": "..." }
  ],
  "notes": "events you found but could not source to an eligible page, and why"
}

Final answer: paths written, one line per entity ("slug: N events"), one
confidence line. No page content, no event lists in the answer.
