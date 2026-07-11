# Registry crawl merge scripts

Status: completed one-off tooling. `merge-fields.ts` and `merge-events.ts`
are the deterministic merge stage of the 2026-07 registry backfill crawl
(see prompts/crawl/README.md): they wrote verified candidate values into
null registry fields, one batch at a time. They are kept for the record
only and run on no schedule; reuse them by hand if the registry is ever
refilled in bulk. Scheduled registry maintenance is a separate path
(enrich-registry.ts, maintain-registry.yml), and launches_total is now a
computed field (compute-spaceport-launches.ts), no longer merged here.
