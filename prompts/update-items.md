---
prompt-id: mcc.update-items
prompt-version: 0.1.0
output-target: src/data/items.json (via scripts/finalize-sweep.ts)
schema: src/data/schema.ts
---

# MCC — News Sweep

Single source of truth for refreshing the news feed. Invoked on cron
(twice daily) and manually. You write a draft; deterministic scripts
validate and merge. You do NOT edit `items.json`, `held.json`, or
`state.json` directly under any circumstance.

CLAUDE.md governs editorial policy (scope, primary sources, hard rules,
writing style). This file governs procedure. Read SWEEP_MEMORY.md before
starting and apply its lessons.

## Mission

Surface what happened in the new space economy since the last sweep:
EO, connectivity, launch, commercial human spaceflight, and the
regulatory, financial, procurement, and geopolitical events that move
them. Real, sourced, in scope. If nothing meets the bar, ship zero
items; that is a successful sweep, not a failure. Padding is the bug.

## The pipeline (one canonical path)

1. **Briefing.** Run `bun scripts/sweep-context.ts`. It prints
   `{ now, lastSweep, feedSize, existing[] }` where `existing[i]` is
   `{ id, normId, source_url, headline }`. This is the no-add-twice list.
2. **Discovery.** Work through `src/data/sources.json`:
   - Fetch every source with status `verified` or `unverified`.
   - Tier-1 sources produce candidates directly.
   - Tier-2 sources produce leads only; trace each lead to its tier-1
     primary source before it can become a candidate (see CLAUDE.md,
     "What counts as a primary source").
   - Record source health: first successful fetch of an `unverified`
     source flips it to `verified`; a third consecutive failure flips
     it to `dead` with a dated note. Track consecutive failures in the
     source's `fail_count` field.
3. **Filter.** Apply the CLAUDE.md scope. Discard out-of-scope
   candidates silently. Apply the dedup check against `existing[]`
   (same companies + same category within 7 days = update, not new).
4. **Verify.** For each surviving candidate, confirm every fact you
   will state appears in the linked primary source. Numbers are copied
   exactly or omitted. Any URL you cite must have returned 200 when you
   fetched it this run.
5. **Draft.** Write `sweep-draft.json` at the repo root:
   ```json
   {
     "newItems":  [ /* full item objects per CLAUDE.md schema, minus publishDate */ ],
     "updates":   [ { "id": "...", "patch": { }, "note": "..." } ],
     "held":      [ { "candidate": { }, "reason": "one line" } ],
     "sourceHealth": [ { "name": "...", "status": "verified|dead", "note": "..." } ],
     "summary":   "1-2 sentence sweep summary",
     "coverage":  ["launch", "regulatory", "..."]
   }
   ```
   `coverage` lists only categories you genuinely searched this run.
   Fill it even on a zero-add sweep; a zero-add sweep must be auditable.
6. **Finalize.** Run `bun scripts/finalize-sweep.ts`. It validates the
   draft against the schema, stamps publish dates, merges into
   `src/data/items.json` / `held.json` / `sources.json`, updates
   `state.json`, and appends the sweep log. If it rejects the draft,
   fix the draft and rerun; never bypass it.
7. **Memory.** If this run taught you something durable (a source
   changed structure, a dedup trap, a scope judgment call), append a
   short dated entry to `SWEEP_MEMORY.md`. Skip routine runs.

## Inclusion bar

An item ships when all are true:
- In scope per CLAUDE.md
- Primary source linked, fetched this run, facts verified against it
- New information (not a rewrite of an existing item; use `updates` for
  developments on an existing story)
- A commercial director at an operator, reseller, or investor would
  want to know

## Importance calibration (impact field)

- `critical`: you would interrupt someone's Monday for this
- `notable`: belongs in their weekly read
- `routine`: belongs in the record
When torn between two levels, pick the lower one.

## Hard reminders

- Zero fabricated URLs, figures, or dates. Ever.
- Uncertain items go to `held`, not to the feed and not to the void.
- Do not commit or push; the workflow handles it.
- Do not edit the Signals data, registry entries, or site code in a sweep.
