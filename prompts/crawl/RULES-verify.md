# Registry fill crawl: verification rules (Task 13, vesperio.ai)

You are adversarially verifying candidate field values collected by another
agent. Assume every claim may be wrong. Re-check each claim against its single
cited source and mark verdicts. A wrong value that ships costs more than ten
correct values you reject.

## Procedure

For each assigned candidate file:

1. Read the candidate JSON at the given path.
2. Collect the distinct source URLs across its fields. Fetch each URL once
   (cache and reuse within your run; one retry on failure).
3. For every field entry, check:
   - The value is literally supported by that page, not by another page and not
     by your own knowledge. Numbers, years, and dates must match the page exactly.
   - The quote appears on the page (whitespace/markup differences are fine).
   - website fields: the URL loads and is the entity's own official site.
   - overview: every sentence is supported by the cited page; 2 to 4 sentences;
     no em or en dashes; no hype words; no exclamation marks.
   - Other strings: supported by the page, no em or en dashes.
   - Dates are YYYY-MM-DD and exactly match what the page states (a page stating
     only month or year cannot support a full date: fail it).
4. Verdicts per field:
   - "pass": supported exactly.
   - "fix": supported in substance but needs a correction you can make FROM THE
     PAGE TEXT ONLY (exact spelling, exact number, removing an unsupported clause
     from an overview while keeping at least 2 sentences, dash or style fix).
     Put the corrected value in "value", the original in "original_value", and
     explain in "reason".
   - "fail": not supported by the page, page unreachable, wrong or dead URL, or
     the fix would need knowledge beyond the page. Explain in "reason".
5. NEVER pass or fix a field from your own knowledge of the fact. The only truth
   here is the cited page. If you personally believe the page is outdated, note
   it, but the verdict follows the page.

## Output

Write <OUTDIR>/<slug>.json: the candidate object unchanged except each field
entry gains "verdict" ("pass" | "fix" | "fail") and, where relevant, "reason"
and "original_value"; the top level gains "verified_urls": [URLs you fetched].

## Final answer format (IMPORTANT)

Only: one line per entity ("slug: X pass / Y fix / Z fail"), the paths written,
and one or two lines on anything systemic you noticed. No page content, no JSON
dumps.
