/**
 * Route table for the static site. Paths are canonical with trailing
 * slashes; matchRoute normalizes before matching.
 */

import { CATEGORIES } from "./data/schema";
import { SITE_ORIGIN } from "./lib/stats";
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
} from "./lib/data";

export type Route =
  | { page: "home" }
  | { page: "item"; id: string }
  | { page: "category"; category: string }
  | { page: "tag"; tag: string }
  | { page: "orbits" }
  | { page: "registry" }
  | { page: "constellation"; slug: string }
  | { page: "vehicle"; slug: string }
  | { page: "spaceport"; slug: string }
  | { page: "org"; slug: string }
  | { page: "signals" }
  | { page: "stats" }
  | { page: "about" }
  | { page: "log" }
  | { page: "not-found" };

export function normalizePath(pathname: string): string {
  let p = pathname;
  if (!p.startsWith("/")) p = "/" + p;
  if (!p.endsWith("/")) p += "/";
  return p;
}

export function matchRoute(pathname: string): Route {
  const p = normalizePath(pathname);
  if (p === "/") return { page: "home" };
  if (p === "/orbits/") return { page: "orbits" };
  if (p === "/registry/") return { page: "registry" };
  if (p === "/signals/") return { page: "signals" };
  if (p === "/stats/") return { page: "stats" };
  if (p === "/about/") return { page: "about" };
  if (p === "/log/") return { page: "log" };

  const item = p.match(/^\/item\/([^/]+)\/$/);
  if (item) return itemById(item[1]!) ? { page: "item", id: item[1]! } : { page: "not-found" };

  const cat = p.match(/^\/news\/([^/]+)\/$/);
  if (cat) {
    return CATEGORIES.includes(cat[1] as never)
      ? { page: "category", category: cat[1]! }
      : { page: "not-found" };
  }

  const con = p.match(/^\/registry\/constellations\/([^/]+)\/$/);
  if (con) {
    return constellationBySlug(con[1]!) ? { page: "constellation", slug: con[1]! } : { page: "not-found" };
  }

  const veh = p.match(/^\/registry\/vehicles\/([^/]+)\/$/);
  if (veh) return vehicleBySlug(veh[1]!) ? { page: "vehicle", slug: veh[1]! } : { page: "not-found" };

  const spaceport = p.match(/^\/registry\/spaceports\/([^/]+)\/$/);
  if (spaceport) {
    return spaceportBySlug(spaceport[1]!)
      ? { page: "spaceport", slug: spaceport[1]! }
      : { page: "not-found" };
  }

  const org = p.match(/^\/registry\/organizations\/([^/]+)\/$/);
  if (org) return orgBySlug(org[1]!) ? { page: "org", slug: org[1]! } : { page: "not-found" };

  const tag = p.match(/^\/tag\/([^/]+)\/$/);
  if (tag) {
    return allTags.includes(tag[1]!) ? { page: "tag", tag: tag[1]! } : { page: "not-found" };
  }

  return { page: "not-found" };
}

export interface Head {
  title: string;
  description: string;
  canonical: string;
}

const SITE_NAME = "MCC | Mission Control Center";
const SITE_DESC =
  "A machine-maintained tracker for the new space economy: Earth observation, connectivity, launch, and commercial human spaceflight.";

export function headFor(path: string): Head {
  const p = normalizePath(path);
  const route = matchRoute(p);
  const canonical = SITE_ORIGIN + p;
  switch (route.page) {
    case "home":
      return { title: SITE_NAME, description: SITE_DESC, canonical };
    case "item": {
      const item = itemById(route.id)!;
      return { title: `${item.headline} | MCC`, description: item.explainer.tagline, canonical };
    }
    case "category":
      return {
        title: `${route.category} news | MCC`,
        description: `Tracked ${route.category} items in the new space economy, each with a primary source.`,
        canonical,
      };
    case "tag":
      return {
        title: `#${route.tag} | MCC`,
        description: `Items tagged ${route.tag} in the MCC feed, each with its sources and signal-to-noise score.`,
        canonical,
      };
    case "orbits":
      return {
        title: "Orbits | MCC",
        description:
          "Live 3D view of the constellations tracked in the MCC Registry, with active spaceports and industry facilities. SGP4 propagation from public element sets.",
        canonical,
      };
    case "registry":
      return {
        title: "Registry | MCC",
        description:
          "Reference profiles of constellations and launch vehicles. Every figure carries a source and an as-of date.",
        canonical,
      };
    case "constellation": {
      const c = constellationBySlug(route.slug)!;
      return {
        title: `${c.name} constellation profile | MCC`,
        description: `Reference profile of the ${c.name} constellation with sourced, dated figures.`,
        canonical,
      };
    }
    case "vehicle": {
      const v = vehicleBySlug(route.slug)!;
      return {
        title: `${v.name} launch vehicle profile | MCC`,
        description: `Reference profile of the ${v.name} launch vehicle with sourced, dated figures.`,
        canonical,
      };
    }
    case "spaceport": {
      const s = spaceportBySlug(route.slug)!;
      return {
        title: `${s.name} spaceport profile | MCC`,
        description: `Reference profile of the ${s.name} spaceport with sourced, dated figures.`,
        canonical,
      };
    }
    case "org": {
      const o = orgBySlug(route.slug)!;
      return {
        title: `${o.name} organization profile | MCC`,
        description: `Reference profile of the ${o.name} organization with sourced, dated figures.`,
        canonical,
      };
    }
    case "signals":
      return {
        title: "Signals | MCC",
        description: "A hand-curated list of people worth following in the new space economy.",
        canonical,
      };
    case "stats":
      return {
        title: "Stats | MCC",
        description:
          "Public indices computed from MCC data: items tracked, launch events by provider, satellites on orbit. Citable, with retrieval dates.",
        canonical,
      };
    case "about":
      return {
        title: "About and verification policy | MCC",
        description:
          "What MCC is, what it covers, and the verification policy: no primary source, no publish.",
        canonical,
      };
    case "log":
      return {
        title: "Sweep log | MCC",
        description:
          "Every sweep the machine ran: what was added, what was held, and why quiet days were quiet.",
        canonical,
      };
    case "not-found":
      return { title: `Not found | MCC`, description: SITE_DESC, canonical };
  }
}

/** Every path the prerender step must emit. */
export function listRoutes(): string[] {
  return [
    "/",
    "/orbits/",
    "/registry/",
    "/signals/",
    "/stats/",
    "/about/",
    "/log/",
    ...CATEGORIES.map((c) => `/news/${c}/`),
    ...items.map((i) => `/item/${i.id}/`),
    ...constellations.map((c) => `/registry/constellations/${c.slug}/`),
    ...vehicles.map((v) => `/registry/vehicles/${v.slug}/`),
    ...spaceports.map((s) => `/registry/spaceports/${s.slug}/`),
    ...organizations.map((o) => `/registry/organizations/${o.slug}/`),
    ...allTags.map((t) => `/tag/${t}/`),
  ];
}
