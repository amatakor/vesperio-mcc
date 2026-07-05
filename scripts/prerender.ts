/**
 * Last build step. Uses the SSR bundle (dist/server/entry-server.js,
 * built by `vite build --ssr`) to emit one static HTML file per route
 * into dist/, each with the correct title, meta description, and
 * canonical URL for https://mcc.vesperio.ai, plus dist/stats.json
 * and a dist/404.html.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";

interface Head {
  title: string;
  description: string;
  canonical: string;
}

interface ServerEntry {
  listRoutes: () => string[];
  render: (path: string, generatedAt: string) => { html: string; head: Head };
  renderStatsJson: (generatedAt: string) => string;
}

const DIST = "dist";
const generatedAt = new Date().toISOString();

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function fillTemplate(template: string, head: Head, html: string): string {
  const out = template
    .replace(/<title>.*?<\/title>/, `<title>${escapeAttr(head.title)}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${escapeAttr(head.description)}" />`,
    )
    .replace(/<!--canonical-->/, `<link rel="canonical" href="${escapeAttr(head.canonical)}" />`)
    .replace(
      /<div id="root">.*?<\/div>/,
      () => `<div id="root" data-generated-at="${generatedAt}">${html}</div>`,
    );
  if (!out.includes('rel="canonical"') || !out.includes("data-generated-at")) {
    throw new Error("prerender: template placeholders not found; index.html changed shape");
  }
  return out;
}

const entry = (await import(
  join(process.cwd(), DIST, "server", "entry-server.js")
)) as unknown as ServerEntry;
const template = readFileSync(join(DIST, "index.html"), "utf8");

const routes = entry.listRoutes();
for (const route of routes) {
  const { html, head } = entry.render(route, generatedAt);
  const outPath =
    route === "/" ? join(DIST, "index.html") : join(DIST, route.slice(1), "index.html");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, fillTemplate(template, head, html));
}

// 404 page for Cloudflare Pages.
const notFound = entry.render("/__not_found__/", generatedAt);
writeFileSync(join(DIST, "404.html"), fillTemplate(template, notFound.head, notFound.html));

writeFileSync(join(DIST, "stats.json"), entry.renderStatsJson(generatedAt) + "\n");

// The SSR bundle exists only for this script; don't ship it.
rmSync(join(DIST, "server"), { recursive: true, force: true });

console.log(`prerender: ${routes.length} routes + 404.html + stats.json`);
