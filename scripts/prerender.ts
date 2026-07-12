/**
 * Last build step. Uses the SSR bundle (dist/server/entry-server.js,
 * built by `vite build --ssr`) to emit one static HTML file per route
 * into dist/, each with the correct title, meta description, canonical
 * URL, and its embedded PageData slice (#__MCC_DATA__), plus the /data
 * JSON slices, dist/stats.json, and a dist/404.html.
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
  render: (
    path: string,
    generatedAt: string,
  ) => { html: string; head: Head; pageDataJson: string | null };
  renderStatsJson: (generatedAt: string) => string;
  buildDataSlices: (generatedAt: string) => { path: string; body: string }[];
}

const DIST = "dist";
/** Cloudflare Pages free tier caps 20k files per deploy; warn early. */
const FILE_COUNT_WARN = 15_000;
const generatedAt = new Date().toISOString();

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * JSON inside a <script> block must not be able to close the tag.
 * The standard escape: forward slashes in closing-tag position.
 */
const escapeJsonForScript = (json: string) => json.replace(/</g, "\\u003c");

function fillTemplate(template: string, head: Head, html: string, pageDataJson: string | null): string {
  const dataScript =
    pageDataJson === null
      ? ""
      : `<script type="application/json" id="__MCC_DATA__">${escapeJsonForScript(pageDataJson)}</script>`;
  // Link-preview card (Florian, 2026-07-12): WhatsApp/Instagram/Slack/X all
  // read these Open Graph tags. One shared 1200x630 image (the live MCC
  // view, public/img/social-card.jpg) with per-page title/description.
  // Origin comes from the canonical URL so nothing here hardcodes the host.
  const origin = new URL(head.canonical).origin;
  const cardUrl = `${origin}/img/social-card.jpg`;
  const socialTags = [
    `<meta property="og:site_name" content="Vesperio" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeAttr(head.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(head.description)}" />`,
    `<meta property="og:url" content="${escapeAttr(head.canonical)}" />`,
    `<meta property="og:image" content="${cardUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${cardUrl}" />`,
  ].join("\n    ");
  const out = template
    .replace(/<title>.*?<\/title>/, `<title>${escapeAttr(head.title)}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${escapeAttr(head.description)}" />`,
    )
    .replace(
      /<!--canonical-->/,
      `<link rel="canonical" href="${escapeAttr(head.canonical)}" />\n    ${socialTags}`,
    )
    .replace(
      /<div id="root">.*?<\/div>/,
      () => `<div id="root" data-generated-at="${generatedAt}">${html}</div>${dataScript}`,
    );
  if (!out.includes('rel="canonical"') || !out.includes("data-generated-at") || !out.includes('property="og:image"')) {
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
  const { html, head, pageDataJson } = entry.render(route, generatedAt);
  const outPath =
    route === "/" ? join(DIST, "index.html") : join(DIST, route.slice(1), "index.html");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, fillTemplate(template, head, html, pageDataJson));
}

// 404 page for Cloudflare Pages.
const notFound = entry.render("/__not_found__/", generatedAt);
writeFileSync(join(DIST, "404.html"), fillTemplate(template, notFound.head, notFound.html, null));

writeFileSync(join(DIST, "stats.json"), entry.renderStatsJson(generatedAt) + "\n");

// The /data JSON surface (feed pages, per-item, log pages, registry
// profile slices, latest.json).
const slices = entry.buildDataSlices(generatedAt);
for (const slice of slices) {
  const outPath = join(DIST, slice.path);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, slice.body);
}

// The SSR bundle exists only for this script; don't ship it.
rmSync(join(DIST, "server"), { recursive: true, force: true });

// Deployment file-count guard (Cloudflare Pages free tier: 20k files).
const { execSync } = await import("node:child_process");
const fileCount = Number(execSync(`find ${DIST} -type f | wc -l`, { encoding: "utf8" }).trim());
if (fileCount >= FILE_COUNT_WARN) {
  console.warn(
    `::warning::prerender: dist/ holds ${fileCount} files, approaching the 20k Pages deploy cap`,
  );
}

console.log(
  `prerender: ${routes.length} routes + 404.html + stats.json + ${slices.length} data slices (${fileCount} files in dist/)`,
);
