# Registry crawl tooling

The pipeline that filled the registry on 2026-07-05/06 (Tasks 13-16 and
the QC refill). Pattern: Sonnet collector agents write candidate JSON to
a scratch dir (one file per entity, verbatim quote per field, every
fetched URL recorded) -> Sonnet verifiers re-fetch every cited source
and mark pass/fix/fail per field or event -> deterministic merges
(scripts/crawl/merge-fields.ts, merge-events.ts) write only passing
values into null fields, rejecting em dashes, bad dates, wrong types,
Wikipedia-as-source for events, and sources not recorded as fetched ->
orchestrator editorial review -> check-registry gates -> one PR per
batch.

Rules files here are handed verbatim to agents. RULES-collect.md +
RULES-verify.md are the strict originals (news-grade); RULES-relaxed.md
is the registry reference-field policy Florian set on 2026-07-05
(Wikipedia + reputable press citable; no-invention rules unchanged).
Operational lessons (fetchable-outlet map, anti-bot walls, agent
concurrency caps, collector traps) live in SWEEP_MEMORY.md entries
2026-07-05-K through -U.

Both merge scripts take --verified <dir> --repo <root>; candidates must
carry verdicts. Update the hardcoded scratch paths in merge-events.ts
if reusing (merge-fields.ts is path-clean).
