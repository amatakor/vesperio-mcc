/**
 * Route table for the static site. Paths are canonical with trailing
 * slashes; matchRoute normalizes before matching.
 *
 * matchRoute is SHAPE-ONLY (no dataset lookups): the client bundle must
 * not carry the dataset, and the prerenderer only ever emits real routes
 * (listRoutes in lib/routes-server.ts owns the existence knowledge).
 * A well-shaped URL for a nonexistent entity renders NotFound because no
 * page data exists for it; unknown paths get 404.html from the host.
 */

import { CATEGORIES } from "./data/schema";

export type Route =
  | { page: "home" }
  | { page: "feed-page"; n: number }
  | { page: "item"; id: string }
  | { page: "category"; category: string }
  | { page: "tag"; tag: string }
  | { page: "kind"; kind: string }
  | { page: "orbits" }
  | { page: "registry" }
  | { page: "constellation"; slug: string }
  | { page: "vehicle"; slug: string }
  | { page: "spaceport"; slug: string }
  | { page: "org"; slug: string }
  | { page: "signals" }
  | { page: "about" }
  | { page: "methodology" }
  | { page: "digest" }
  | { page: "system" }
  | { page: "log-archive"; month: string }
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
  if (p === "/mcc/") return { page: "orbits" };
  if (p === "/registry/") return { page: "registry" };
  if (p === "/signals/") return { page: "signals" };
  if (p === "/about/") return { page: "about" };
  if (p === "/methodology/") return { page: "methodology" };
  if (p === "/digest/") return { page: "digest" };
  if (p === "/system/") return { page: "system" };

  const feedPage = p.match(/^\/feed\/(\d+)\/$/);
  if (feedPage) {
    const n = Number(feedPage[1]);
    return n >= 2 ? { page: "feed-page", n } : { page: "not-found" };
  }

  // Log archive months now live under /system/ (the merged page); the old
  // /log/YYYY-MM/ paths 301-redirect via public/_redirects.
  const logMonth = p.match(/^\/system\/(\d{4}-\d{2})\/$/);
  if (logMonth) return { page: "log-archive", month: logMonth[1]! };

  const item = p.match(/^\/item\/([^/]+)\/$/);
  if (item) return { page: "item", id: item[1]! };

  const cat = p.match(/^\/news\/([^/]+)\/$/);
  if (cat) {
    return CATEGORIES.includes(cat[1] as never)
      ? { page: "category", category: cat[1]! }
      : { page: "not-found" };
  }

  const con = p.match(/^\/registry\/constellations\/([^/]+)\/$/);
  if (con) return { page: "constellation", slug: con[1]! };

  const veh = p.match(/^\/registry\/vehicles\/([^/]+)\/$/);
  if (veh) return { page: "vehicle", slug: veh[1]! };

  const spaceport = p.match(/^\/registry\/spaceports\/([^/]+)\/$/);
  if (spaceport) return { page: "spaceport", slug: spaceport[1]! };

  const org = p.match(/^\/registry\/organizations\/([^/]+)\/$/);
  if (org) return { page: "org", slug: org[1]! };

  const kind = p.match(/^\/kind\/([^/]+)\/$/);
  if (kind) {
    // Only commentary gets a filtered page; /kind/event/ would be the whole feed.
    return kind[1] === "commentary" ? { page: "kind", kind: kind[1] } : { page: "not-found" };
  }

  const tag = p.match(/^\/tag\/([^/]+)\/$/);
  if (tag) return { page: "tag", tag: tag[1]! };

  return { page: "not-found" };
}
