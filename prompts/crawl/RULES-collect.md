# Registry fill crawl: collection rules (Task 13, mcc.vesperio.ai)

You are collecting candidate field values for registry profiles of a tracker whose
product promise is reliability: it must never claim more than its source supports.
These are hard rules. When in doubt, leave the field out.

## Sourcing

1. One source URL per field. The source is the exact page (deep link, never the
   homepage when the fact is on a subpage) that literally states the fact. If you
   cannot point at one page that states it, the field stays out.
2. Only the bases named in your assignment qualify (official/first-party pages;
   for constellations also Gunter's Space Page deep links and Launch Library API
   records). Wikipedia, news articles, blogs, and other third-party databases are
   NOT acceptable bases in this crawl.
3. Never state a fact that is not on the fetched page. No recall from training
   data. No estimating, no rounding, no deriving. Never sum numbers across pages
   (adding up satellites across Gunter's pages is explicitly forbidden).
4. Numbers are copied exactly as the page states them. "More than 200" is not a
   number; leave the field out and put the phrase in notes.
5. Only URLs you actually fetched in this run may appear anywhere in your output.
   Record every URL you fetch, successes and failures, in fetched_urls.
6. Dates are YYYY-MM-DD. If the source gives only a month or a year, leave the
   date field out and mention it in notes. Never guess a day.
7. Fetch politely: at most ~3 pages per entity, one attempt plus one retry per
   page, no hammering. Identify pages via the entity's own site navigation or a
   web search to LOCATE the official page (facts still only from fetched pages).

## Writing style (overview, focus, and other prose fields)

- Plain declarative English. No hype words (game-changing, revolutionary,
  milestone, world-leading), no marketing voice, no exclamation marks.
- No em dashes and no en dashes anywhere. Use commas or periods.
- overview: 2 to 4 sentences. EVERY claim in it must be stated on the single
  source page you cite for the overview field. Do not blend facts from two pages
  into one overview. Attribute claims where sensible ("the company says").
- focus: one short line naming what the entity does, in words the source supports.

## Output

For each assigned entity, write ONE file: <OUTDIR>/<slug>.json

{
  "slug": "<slug>",
  "entity_type": "<organization|constellation|spaceport|vehicle>",
  "as_of": "2026-07-05",
  "fetched_urls": ["every URL you fetched, including failures"],
  "fields": {
    "<field>": {
      "value": <value>,
      "source": "<the one URL that states it>",
      "quote": "<verbatim excerpt from that page, max ~250 chars, supporting the value>"
    }
  },
  "notes": "<anything ambiguous, conflicting, or worth human review; omit if none>"
}

- Omit any field you could not source. Do NOT write null-valued field entries.
- The quote is mandatory for every field and must be copied verbatim.
- Valid JSON only. Value types: strings for text and dates, numbers for counts
  and years, arrays of strings where your assignment says so, booleans where
  your assignment says so.

## Stop conditions

- If a site is unreachable after one retry, write the entity file with an empty
  "fields" object and explain in notes. Do not substitute another source.
- If a fact seems to need out-of-scope pages or judgment beyond these rules,
  leave the field out and note why. Do not improvise.

## Final answer format (IMPORTANT)

Your final answer must contain ONLY: the file paths you wrote, one line per
entity ("slug: N fields; short note"), and one overall confidence line
(high/medium/low). Do NOT paste page content, quotes, or candidate JSON into
your final answer.
