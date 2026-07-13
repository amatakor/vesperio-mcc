var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var DISPATCH_URL = "https://api.github.com/repos/amatakor/vesperio-mcc/actions/workflows/update-items.yml/dispatches";
async function dispatch(env) {
  const res = await fetch(DISPATCH_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "vesperio-sweep-trigger (+https://vesperio.ai)",
      "x-github-api-version": "2022-11-28"
    },
    body: JSON.stringify({ ref: "main" })
  });
  if (res.status !== 204) {
    throw new Error(`dispatch failed: HTTP ${res.status} ${await res.text()}`);
  }
}
__name(dispatch, "dispatch");
var worker_default = {
  async scheduled(event, env) {
    try {
      await dispatch(env);
    } catch (first) {
      await new Promise((r) => setTimeout(r, 1e4));
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
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
