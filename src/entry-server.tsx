/**
 * SSR entry used only by scripts/prerender.ts. Built with
 * `vite build --ssr` so import.meta.glob and JSON imports resolve the
 * same way they do in the client bundle.
 */

import { renderToString } from "react-dom/server";
import App from "./App";
import { headFor, listRoutes, type Head } from "./routes";
import { computeHero, computeStats, statsJson } from "./lib/stats";
import { items, constellations, vehicles, spaceports, organizations, sweeps } from "./lib/data";

export { listRoutes };

export function render(path: string, generatedAt: string): { html: string; head: Head } {
  return {
    html: renderToString(<App path={path} generatedAt={generatedAt} />),
    head: headFor(path),
  };
}

export function renderStatsJson(generatedAt: string): string {
  const now = new Date(generatedAt);
  const hero = computeHero(items, constellations, vehicles, sweeps, now, spaceports, organizations);
  return statsJson(hero, computeStats(items, constellations, vehicles, now), now);
}
