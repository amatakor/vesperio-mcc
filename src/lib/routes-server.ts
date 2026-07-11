/**
 * Server-only route knowledge: the full route list the prerenderer emits
 * and the per-route head metadata. Lives apart from routes.ts because
 * both need the whole dataset (lib/data), which must never enter the
 * client bundle; only entry-server and the prerender pipeline import
 * this module.
 */

import { CATEGORIES } from "../data/schema";
import { SITE_ORIGIN } from "./stats";
import { matchRoute, normalizePath } from "../routes";
import { FEED_PAGE_SIZE, feedPageCount, logArchiveMonths } from "./page-data";
import {
  items,
  constellations,
  vehicles,
  spaceports,
  organizations,
  itemById,
  constellationBySlug,
  vehicleBySlug,
  spaceportBySlug,
  orgBySlug,
  allTags,
  sweeps,
} from "./data";

export interface Head {
  title: string;
  description: string;
  canonical: string;
}

const SITE_NAME = "Vesperio";
const SITE_DESC =
  "A machine-maintained tracker for the new space economy: Earth observation, connectivity, launch, and commercial human spaceflight.";

export function headFor(path: string): Head {
  const p = normalizePath(path);
  const route = matchRoute(p);
  const canonical = SITE_ORIGIN + p;
  switch (route.page) {
    case "home":
      return { title: SITE_NAME, description: SITE_DESC, canonical };
    case "feed-page":
      return {
        title: `Feed, page ${route.n} | Vesperio`,
        description: SITE_DESC,
        canonical,
      };
    case "item": {
      const item = itemById(route.id);
      if (!item) return { title: `Not found | Vesperio`, description: SITE_DESC, canonical };
      return { title: `${item.headline} | Vesperio`, description: item.explainer.tagline, canonical };
    }
    case "category":
      return {
        title: `${route.category} news | Vesperio`,
        description: `Tracked ${route.category} items in the new space economy, each with a primary source.`,
        canonical,
      };
    case "tag":
      return {
        title: `#${route.tag} | Vesperio`,
        description: `Items tagged ${route.tag} in the Vesperio feed, each with its sources and signal-to-noise score.`,
        canonical,
      };
    case "kind":
      return {
        title: "commentary | Vesperio",
        description:
          "Takes and analysis from named, whitelisted voices in the new space economy. Scored for attribution, visibly tagged as commentary.",
        canonical,
      };
    case "orbits":
      return {
        title: "MCC | Vesperio",
        description:
          "MCC, Vesperio's live mission control view: the constellations tracked in the Registry in 3D, with active spaceports and industry facilities. SGP4 propagation from public element sets.",
        canonical,
      };
    case "registry":
      return {
        title: "Registry | Vesperio",
        description:
          "Reference profiles of constellations and launch vehicles. Every figure carries a source and an as-of date.",
        canonical,
      };
    case "constellation": {
      const c = constellationBySlug(route.slug);
      if (!c) return { title: `Not found | Vesperio`, description: SITE_DESC, canonical };
      return {
        title: `${c.name} constellation profile | Vesperio`,
        description: `Reference profile of the ${c.name} constellation with sourced, dated figures.`,
        canonical,
      };
    }
    case "vehicle": {
      const v = vehicleBySlug(route.slug);
      if (!v) return { title: `Not found | Vesperio`, description: SITE_DESC, canonical };
      return {
        title: `${v.name} launch vehicle profile | Vesperio`,
        description: `Reference profile of the ${v.name} launch vehicle with sourced, dated figures.`,
        canonical,
      };
    }
    case "spaceport": {
      const s = spaceportBySlug(route.slug);
      if (!s) return { title: `Not found | Vesperio`, description: SITE_DESC, canonical };
      return {
        title: `${s.name} spaceport profile | Vesperio`,
        description: `Reference profile of the ${s.name} spaceport with sourced, dated figures.`,
        canonical,
      };
    }
    case "org": {
      const o = orgBySlug(route.slug);
      if (!o) return { title: `Not found | Vesperio`, description: SITE_DESC, canonical };
      return {
        title: `${o.name} organization profile | Vesperio`,
        description: `Reference profile of the ${o.name} organization with sourced, dated figures.`,
        canonical,
      };
    }
    case "signals":
      return {
        title: "Signals | Vesperio",
        description: "A hand-curated list of people worth following in the new space economy.",
        canonical,
      };
    case "stats":
      return {
        title: "Stats | Vesperio",
        description:
          "Public indices computed from Vesperio data: items tracked, launch events by provider, satellites on orbit. Citable, with retrieval dates.",
        canonical,
      };
    case "about":
      return {
        title: "About and verification policy | Vesperio",
        description:
          "What Vesperio is, what it covers, and the verification policy: no primary source, no publish.",
        canonical,
      };
    case "methodology":
      return {
        title: "How the SNR score works | Vesperio",
        description:
          "The signal-to-noise score explained for readers: what 1 to 5 means, how the base source class, corroboration, and time move a score, and how the scores are checked for honesty.",
        canonical,
      };
    case "digest":
      return {
        title: "Weekly digest | Vesperio",
        description:
          "The last seven days at a glance: the week's items by importance, the scores that moved, and the sweeps that were quiet.",
        canonical,
      };
    case "log":
      return {
        title: "Sweep log | Vesperio",
        description:
          "Every sweep the machine ran: what was added, what was held, and why quiet days were quiet.",
        canonical,
      };
    case "log-archive":
      return {
        title: `Sweep log, ${route.month} | Vesperio`,
        description: `Archived sweep log entries from ${route.month}.`,
        canonical,
      };
    case "not-found":
      return { title: `Not found | Vesperio`, description: SITE_DESC, canonical };
  }
}

/** Every path the prerender step must emit. */
export function listRoutes(): string[] {
  const feedPages = feedPageCount(items.length);
  return [
    "/",
    ...Array.from({ length: Math.max(0, feedPages - 1) }, (_, i) => `/feed/${i + 2}/`),
    "/mcc/",
    "/registry/",
    "/signals/",
    "/stats/",
    "/about/",
    "/methodology/",
    "/digest/",
    "/log/",
    ...logArchiveMonths(sweeps).map((m) => `/log/${m}/`),
    ...CATEGORIES.map((c) => `/news/${c}/`),
    "/kind/commentary/",
    ...items.map((i) => `/item/${i.id}/`),
    ...constellations.map((c) => `/registry/constellations/${c.slug}/`),
    ...vehicles.map((v) => `/registry/vehicles/${v.slug}/`),
    ...spaceports.map((s) => `/registry/spaceports/${s.slug}/`),
    ...organizations.map((o) => `/registry/organizations/${o.slug}/`),
    ...allTags.map((t) => `/tag/${t}/`),
  ];
}

export { FEED_PAGE_SIZE };
