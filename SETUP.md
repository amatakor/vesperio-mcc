# MCC — Getting started (Claude Code)

Order matters: scaffold first, enable cron last. The sweep workflows
reference scripts (sweep-context.ts, finalize-sweep.ts, check-*.ts) that
the scaffold task creates.

## 1. Repo
- Create a private GitHub repo (e.g. `vesperio-mcc`), default branch `main`.
- Copy this starter's contents to the repo root and push.

## 2. Claude Code wiring
- Locally: `claude setup-token`, then `gh secret set CLAUDE_CODE_OAUTH_TOKEN`.
- In Claude Code, run `/install-github-app` on the repo (enables @claude
  on issues/PRs for interactive dev).

## 3. Build (follow BUILD_PLAN.md, Tasks 1-4, one PR each)
Open Claude Code in the repo and work through BUILD_PLAN.md task by task.
Each task is a self-contained brief with acceptance criteria.

## 4. Cloudflare Pages
- Connect the repo in Cloudflare Pages, build command `bun run build`,
  output `dist/`.
- Add custom domain `mcc.vesperio.com` (CNAME in the vesperio.com zone).

## 5. First supervised sweeps
- Trigger `update-items.yml` manually (workflow_dispatch) with only
  5-6 sources marked active if you want a soft start.
- Read every item of the first ~5 sweeps against its source. Fix
  editorial gaps by editing CLAUDE.md / prompts, not by hand-editing items.

## 6. Go live
- Leave the cron enabled (05:00 / 17:00 UTC).
- Enable `maintain-registry.yml` once the first registry profiles exist.

## Cost notes
- Sonnet on both agents to start; move sweep write-ups to a stronger
  model only if quality demands it.
- 2 sweeps/day at ~15-25 min each stays well inside Actions free tier
  for a private repo's 2000 min/month? No: private repos meter minutes.
  Either make the repo public (also enables community trust) or budget
  ~1500-3000 min/month. Public is recommended once the feed is stable.
