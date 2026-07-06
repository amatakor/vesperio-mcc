# Relaxed registry sourcing (Florian, 2026-07-05) — refill crawl rules

This crawl fills REGISTRY REFERENCE FIELDS under the relaxed policy.
Read ../task13/RULES-collect.md first; everything there still applies
EXCEPT the source whitelist, which widens as follows.

## Acceptable sources for registry reference fields

In preference order (cite the best you find, but any tier is citable):
1. The operator's/manufacturer's own pages and official government or
   agency pages, Launch Library API records, Gunter's Space Page deep
   links (as before).
2. Reputable publications: SpaceNews, Payload, Via Satellite, Reuters,
   NASASpaceflight, European Spaceflight, Ars Technica, BBC, major
   newspapers.
3. Wikipedia article pages (the exact article URL).

## What does NOT relax

- The value must be STATED on the cited page. No invention, no
  estimates, no summing rows, no deriving. A page saying "over 100" is
  still not a number; a year-only statement still cannot support a full
  date.
- Verbatim quote per field, every fetched URL recorded, one source per
  field, em/en dashes banned, no hype prose, overviews 2-4 sentences
  from ONE page.
- Wikipedia infoboxes count as page content; cite the article URL and
  quote the infobox line (e.g. "Founded: 2006") or body sentence.
- fetch politely; do all work yourself; do NOT spawn sub-agents.

## Field notes

- status: a stated word ("operational", "retired", "active",
  "in development") from any acceptable source qualifies. ADDITIONALLY
  (convention set 2026-07-05): status "active" may be recorded when the
  cited page describes the entity as currently operating in the present
  tense, with the describing sentence as the quote. Ceased/merged/
  bankrupt statuses still need an explicit statement.
- focus: one line in the source's words.
- country: a literal statement anywhere acceptable now ("American
  company", "headquartered in France", a Wikipedia infobox country
  line) qualifies. City-only still does not.
- sensor_types: lowercase from: sar, optical, multispectral,
  hyperspectral, rf, ghg, thermal — only as the page's wording supports
  (panchromatic/multispectral imager supports "optical, multispectral").
- Dates: full YYYY-MM-DD from any acceptable page.

## Output

Same candidate JSON shape and OUTDIR conventions as RULES-collect.md;
same final answer format (paths + one line per entity + confidence).
