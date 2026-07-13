/**
 * Sweep trigger (Florian, 2026-07-13). GitHub's shared cron scheduler
 * fired this repo's morning sweeps 2h+ late or not at all (2026-07-12
 * and -13, both mornings; the :15 off-minute offset did not help), so
 * the PRIMARY trigger is this Cloudflare Worker cron: it calls the
 * GitHub API at exactly 05:15 / 17:15 UTC and dispatches the
 * update-items workflow. The workflow keeps a late GitHub cron
 * (06:45 / 18:45) as a fallback behind a freshness guard, and the
 * daily health-check dead-man's switch alerts if BOTH ever fail.
 *
 * Secret (set in the Worker's dashboard settings, never in code):
 *   GH_DISPATCH_TOKEN: fine-grained GitHub PAT, repo
 *   amatakor/vesperio-mcc only, permission Actions: read and write.
 *
 * A failed dispatch throws, so it lands in the Worker's error metrics.
 */

const DISPATCH_URL =
  "https://api.github.com/repos/amatakor/vesperio-mcc/actions/workflows/update-items.yml/dispatches";

async function dispatch(env) {
  const res = await fetch(DISPATCH_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "vesperio-sweep-trigger (+https://vesperio.ai)",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  // 204 No Content is the API's success answer for workflow dispatches.
  if (res.status !== 204) {
    throw new Error(`dispatch failed: HTTP ${res.status} ${await res.text()}`);
  }
}

export default {
  async scheduled(event, env) {
    try {
      await dispatch(env);
    } catch (first) {
      // One retry for transient network blips; a second failure surfaces
      // in the Worker's error metrics and the GitHub fallback cron plus
      // the health-check dead-man's switch take over.
      await new Promise((r) => setTimeout(r, 10_000));
      try {
        await dispatch(env);
      } catch (second) {
        throw new Error(`both attempts failed: ${first.message}; ${second.message}`);
      }
    }
  },

  // No HTTP surface: cron-only. Anything that fetches it gets a 404.
  async fetch() {
    return new Response("not found", { status: 404 });
  },
};
