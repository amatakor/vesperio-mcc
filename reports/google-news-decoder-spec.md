# Task spec: decode Google News redirect URLs in the harvester (approved by Florian 2026-07-08)

Problem: sources.json mainstream_triggers queue hundreds of entries whose URLs
are news.google.com/rss/articles/... redirects. Since ~2024 these no longer
resolve server-side (JS interstitial; SWEEP_MEMORY 2026-07-08-C2), so every
sweep burns agent searches re-locating publisher URLs.

Change: add a best-effort decode step to scripts/harvest.ts (or a small
scripts/lib/gnews-decode.ts) that converts each redirect to its publisher URL
at harvest time, storing it in the candidate's url field (keep the original
redirect in a new gnews_url field for provenance).

Approach (known working technique, used by open-source decoders such as the
googlenewsdecoder Python package; re-verify current behavior live before
trusting):
1. Old-format IDs (base64 starting "AhqJ..." era) decode directly from the
   article id path segment.
2. Current-format IDs require two requests: fetch the article page HTML and
   read the c-wiz element's data-n-a-sg (signature) and data-n-a-ts
   (timestamp) attributes; then POST to
   https://news.google.com/_/DotsSplashUi/data/batchexecute with an f.req
   payload containing the article id, signature, and timestamp; the response
   contains the publisher URL.
3. Throttle: batch and space requests (Google rate-limits; decoders use
   ~1 req/s with jitter). Decode NEW queue entries only, never re-decode.

Hard requirements:
- Best-effort with graceful fallback: on any decode failure the entry keeps
  the redirect URL exactly as today, and the sweep prompt's existing
  "follow/re-locate the redirect" instruction remains the fallback path.
  A Google-side change must never break the harvest (individual failures
  logged, never fatal, matching harvest.ts source-failure semantics).
- Unit tests on fixtures (old-format decode, response parsing, failure
  fallback). Live verification before merge: run against 5+ real queue
  entries from src/data/candidates.json and confirm the decoded URLs match
  the story titles.
- No new dependencies unless strictly necessary; no API keys.
- Terms note: Florian ruled 2026-07-08 that MCC's personal, non-commercial
  use of Google News RSS is acceptable; batchexecute is an unofficial
  endpoint and can break or be rate-limited without notice. REVISIT before
  any paid layer launches (same caveat already recorded in sources.json).

Why this doc exists: specced 2026-07-08 in a cloud session that cannot reach
news.google.com (network policy), so implementation belongs to a local or CI
session with real network. Point a session at this file; build on a branch
with tests; PR for Florian.
