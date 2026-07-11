/**
 * Builds each page's PageData slice and the /data/ JSON files from the
 * full dataset. Imported by entry-server (prerender) and, in dev only,
 * dynamically by main.tsx (the import.meta.env.DEV guard keeps this
 * module and the dataset out of production client builds).
 */

import type { Item, SweepLogEntry } from "../data/schema";
import { CATEGORIES, DOMAIN_TAGS } from "../data/schema";
import type { Route } from "../routes";
import type { FeedCounts, OrgHrefs, PageData, ProfileEventRef } from "./page-data";
import { FEED_PAGE_SIZE, feedPageCount, splitLogWindow } from "./page-data";
import {
  constellationEntries,
  vehicleEntries,
  spaceportEntries,
  orgEntries,
} from "./reg-entries";
import { computeHero, computeStats } from "./stats";
import sourcesJson from "../data/sources.json";
import type { SourcesFile } from "../data/schema";
import {
  items,
  itemById,
  itemsByTag,
  itemsMentioning,
  signals,
  signalOutlets,
  signalAvatars,
  sweeps,
  ledgerSources,
  calibrationBuckets,
  constellations,
  vehicles,
  spaceports,
  organizations,
  constellationBySlug,
  vehicleBySlug,
  spaceportBySlug,
  orgBySlug,
  constellationChildren,
} from "./data";

function feedCounts(): FeedCounts {
  const categories: Record<string, number> = {};
  for (const c of CATEGORIES) categories[c] = 0;
  const domains: Record<string, number> = {};
  for (const d of DOMAIN_TAGS) domains[d] = 0;
  for (const i of items) {
    categories[i.category] = (categories[i.category] ?? 0) + 1;
    for (const d of DOMAIN_TAGS) if (i.tags.includes(d)) domains[d] = (domains[d] ?? 0) + 1;
  }
  return { categories, domains, total: items.length };
}

function feedPage(n: number): Item[] {
  return items.slice((n - 1) * FEED_PAGE_SIZE, n * FEED_PAGE_SIZE);
}

function orgHrefs(): OrgHrefs {
  const map: OrgHrefs = {};
  for (const o of organizations) {
    map[o.name.toLowerCase()] = `/registry/organizations/${o.slug}/`;
  }
  return map;
}

function eventRefs(names: (string | null | undefined)[]): ProfileEventRef[] {
  return itemsMentioning(names.filter((n): n is string => Boolean(n))).map((i) => ({
    id: i.id,
    impact: i.impact,
    date: i.date,
    headline: i.headline,
  }));
}

function logTotals(all: SweepLogEntry[]): { added: number; updated: number; held: number; count: number } {
  return all.reduce(
    (t, s) => ({
      added: t.added + s.added,
      updated: t.updated + s.updated,
      held: t.held + s.held,
      count: t.count + 1,
    }),
    { added: 0, updated: 0, held: 0, count: 0 },
  );
}

export function buildPageData(route: Route, generatedAt: string): PageData | null {
  const now = new Date(generatedAt);
  switch (route.page) {
    case "home":
      return { page: "home", items: feedPage(1), pageCount: feedPageCount(items.length), counts: feedCounts() };
    case "feed-page": {
      const list = feedPage(route.n);
      if (list.length === 0) return null;
      return { page: "feed-page", n: route.n, items: list, pageCount: feedPageCount(items.length), counts: feedCounts() };
    }
    case "item": {
      const item = itemById(route.id);
      return item ? { page: "item", item } : null;
    }
    case "category":
      return { page: "category", category: route.category, items: items.filter((i) => i.category === route.category) };
    case "tag": {
      const list = itemsByTag(route.tag);
      return list.length > 0 ? { page: "tag", tag: route.tag, items: list } : null;
    }
    case "kind":
      return { page: "kind", kind: route.kind, items: items.filter((i) => i.kind === route.kind) };
    case "registry":
      return {
        page: "registry",
        entries: {
          constellations: constellationEntries(constellations),
          vehicles: vehicleEntries(vehicles),
          spaceports: spaceportEntries(spaceports),
          orgs: orgEntries(organizations),
        },
        orgHrefs: orgHrefs(),
      };
    case "constellation": {
      const profile = constellationBySlug(route.slug);
      if (!profile) return null;
      const parent = profile.parent ? (constellationBySlug(profile.parent) ?? null) : null;
      return {
        page: "constellation",
        profile,
        events: eventRefs([profile.name, profile.operator.value]),
        children: constellationChildren(profile.slug),
        parent: parent ? { slug: parent.slug, name: parent.name } : null,
        siblings: constellations.map((c) => ({ slug: c.slug, name: c.name, affiliation: c.operator.value })),
        orgHrefs: orgHrefs(),
      };
    }
    case "vehicle": {
      const profile = vehicleBySlug(route.slug);
      if (!profile) return null;
      return {
        page: "vehicle",
        profile,
        events: eventRefs([profile.name, profile.provider.value]),
        siblings: vehicles.map((v) => ({ slug: v.slug, name: v.name, affiliation: v.provider.value })),
        orgHrefs: orgHrefs(),
      };
    }
    case "spaceport": {
      const profile = spaceportBySlug(route.slug);
      if (!profile) return null;
      return {
        page: "spaceport",
        profile,
        events: eventRefs([profile.name, profile.operator.value]),
        siblings: spaceports.map((s) => ({ slug: s.slug, name: s.name, affiliation: s.region })),
        orgHrefs: orgHrefs(),
      };
    }
    case "org": {
      const profile = orgBySlug(route.slug);
      if (!profile) return null;
      return {
        page: "org",
        profile,
        events: eventRefs([profile.name]),
        vehicleRoster: vehicles
          .filter((v) => v.provider.value === profile.name)
          .map((v) => ({ slug: v.slug, name: v.name, status: v.status.value })),
        siblings: organizations.map((o) => ({ slug: o.slug, name: o.name, affiliation: o.kind })),
        orgHrefs: orgHrefs(),
      };
    }
    case "signals":
      return { page: "signals", people: signals, outlets: signalOutlets, avatars: signalAvatars };
    case "stats":
      return {
        page: "stats",
        hero: computeHero(items, constellations, vehicles, sweeps, now, spaceports, organizations),
        blocks: computeStats(items, constellations, vehicles, spaceports, now),
      };
    case "log": {
      const { recent, archiveMonths } = splitLogWindow(sweeps, now);
      const sourceProblems = Object.values((sourcesJson as unknown as SourcesFile).categories)
        .flat()
        .filter((s) => s.status === "dead" || s.status === "stale")
        .map((s) => ({ name: s.name, status: s.status as "dead" | "stale" }))
        .sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name));
      return {
        page: "log",
        sweeps: recent,
        totals: logTotals(sweeps),
        ledgerSources,
        calibrationBuckets,
        archiveMonths,
        sourceProblems,
      };
    }
    case "log-archive": {
      const monthSweeps = sweeps.filter((s) => s.at.slice(0, 7) === route.month);
      return monthSweeps.length > 0 ? { page: "log-archive", month: route.month, sweeps: monthSweeps } : null;
    }
    case "orbits":
      return {
        page: "orbits",
        linkItems: items.map((i) => ({ id: i.id, headline: i.headline, tagline: i.explainer.tagline })),
        vehicleLinks: vehicles.map((v) => ({ name: v.name, slug: v.slug })),
      };
    case "about":
      return { page: "about" };
    case "not-found":
      return null;
  }
}

/** One emitted /data file: path relative to dist/, pre-serialized body. */
export interface DataSlice {
  path: string;
  body: string;
}

/**
 * The /data JSON surface the prerenderer writes: per-item files, feed
 * pages (plus per-category and the full corpus for the home search),
 * log pages, per-profile registry slices, and the small latest.json.
 */
export function buildDataSlices(generatedAt: string): DataSlice[] {
  const slices: DataSlice[] = [];
  const put = (path: string, value: unknown): void => {
    slices.push({ path, body: JSON.stringify(value) + "\n" });
  };

  const pages = feedPageCount(items.length);
  for (let n = 1; n <= pages; n++) {
    put(`data/feed/page-${n}.json`, { page: n, pages, items: feedPage(n) });
  }
  put("data/feed/all.json", { generated_at: generatedAt, items });
  for (const c of CATEGORIES) {
    put(`data/feed/${c}.json`, { category: c, items: items.filter((i) => i.category === c) });
  }
  for (const i of items) put(`data/items/${i.id}.json`, i);

  const LOG_PAGE_SIZE = 50;
  const logPages = Math.max(1, Math.ceil(sweeps.length / LOG_PAGE_SIZE));
  for (let n = 1; n <= logPages; n++) {
    put(`data/log/page-${n}.json`, {
      page: n,
      pages: logPages,
      sweeps: sweeps.slice((n - 1) * LOG_PAGE_SIZE, n * LOG_PAGE_SIZE),
    });
  }

  const profileRoutes: Route[] = [
    ...constellations.map((c) => ({ page: "constellation", slug: c.slug }) as Route),
    ...vehicles.map((v) => ({ page: "vehicle", slug: v.slug }) as Route),
    ...spaceports.map((s) => ({ page: "spaceport", slug: s.slug }) as Route),
    ...organizations.map((o) => ({ page: "org", slug: o.slug }) as Route),
  ];
  const KIND_DIR: Record<string, string> = {
    constellation: "constellations",
    vehicle: "vehicles",
    spaceport: "spaceports",
    org: "organizations",
  };
  for (const r of profileRoutes) {
    const data = buildPageData(r, generatedAt);
    if (data && "slug" in r) put(`data/registry/${KIND_DIR[r.page]}/${r.slug}.json`, data);
  }

  put("data/latest.json", {
    generated_at: generatedAt,
    items: feedPage(1),
    counts: feedCounts(),
  });

  return slices;
}
