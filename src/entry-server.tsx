/**
 * SSR entry used only by scripts/prerender.ts. Built with
 * `vite build --ssr` so import.meta.glob and JSON imports resolve the
 * same way they do in the dev client. This bundle (and the modules it
 * pulls in: lib/data, lib/routes-server, lib/page-data-server) is the
 * ONLY place the whole dataset is loaded; every page's client payload
 * is the PageData slice embedded in its prerendered HTML.
 */

import { renderToString } from "react-dom/server";
import App from "./App";
import { matchRoute } from "./routes";
import { headFor, listRoutes, type Head } from "./lib/routes-server";
import { buildPageData, buildDataSlices } from "./lib/page-data-server";
import { computeHero, computeStats, statsJson } from "./lib/stats";
import { items, constellations, vehicles, spaceports, organizations, sweeps } from "./lib/data";

export { listRoutes, buildDataSlices };

export function render(
  path: string,
  generatedAt: string,
): { html: string; head: Head; pageDataJson: string | null } {
  const pageData = buildPageData(matchRoute(path), generatedAt);
  return {
    html: renderToString(<App path={path} generatedAt={generatedAt} pageData={pageData} />),
    head: headFor(path),
    pageDataJson: pageData === null ? null : JSON.stringify(pageData),
  };
}

export function renderStatsJson(generatedAt: string): string {
  const now = new Date(generatedAt);
  const hero = computeHero(items, constellations, vehicles, sweeps, now, spaceports, organizations);
  return statsJson(hero, computeStats(items, constellations, vehicles, spaceports, now), now);
}
