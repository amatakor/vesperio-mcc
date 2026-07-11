# Applied migrations

One-off data migrations that have been run against the live data files, in
order. Scripts stay in this directory as the record of what was done; none
of them run on a schedule. Re-running one is safe only where its own header
says so.

| Date | Script | What it did |
|---|---|---|
| 2026-07-06 | `2026-07-06-snr-backfill.ts` | Scored the pre-SNR-engine items through the engine and stamped snr/snr_trace. |
| 2026-07-08 | `2026-07-08-headline-attribution.ts` | Removed outlet prefixes from 38 headlines per the headline policy (cards display events, not articles). |
| 2026-07-08 | `2026-07-08-item-kind.ts` | Added the `kind` field (event/commentary) to existing items. |
| 2026-07-11 | `2026-07-11-backfill-entities.ts` | Stamped `entities` (companies resolved to registry profile refs) on existing items, matching the finalize-sweep stamping added the same day (plan Phase 7). Idempotent. |
