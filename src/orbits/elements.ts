/**
 * Client-side loading of the static Orbits data files. Each layer's
 * elements load on demand, are cached for the session, and carry a
 * staleness verdict from fetched_at (spec 6 failure modes).
 */

import type {
  OrbitsElementsFile,
  OrbitsFacilitiesFile,
  OrbitsSpaceportsFile,
  OrbitsStatsFile,
} from "../data/schema";
import { STALE_AFTER_DAYS } from "./types";

export type ElementsResult =
  | { ok: true; file: OrbitsElementsFile; stale: boolean }
  | { ok: false };

export function isStale(fetchedAt: string): boolean {
  const age = Date.now() - new Date(fetchedAt).getTime();
  return !Number.isFinite(age) || age > STALE_AFTER_DAYS * 24 * 3600 * 1000;
}

const elementsCache = new Map<string, Promise<ElementsResult>>();

export function loadElements(slug: string): Promise<ElementsResult> {
  let p = elementsCache.get(slug);
  if (!p) {
    p = fetch(`/data/orbits/elements-${slug}.json`)
      .then(async (res): Promise<ElementsResult> => {
        if (!res.ok) return { ok: false };
        const file = (await res.json()) as OrbitsElementsFile;
        return { ok: true, file, stale: isStale(file.fetched_at) };
      })
      .catch((): ElementsResult => ({ ok: false }));
    elementsCache.set(slug, p);
  }
  return p;
}

let spaceportsPromise: Promise<OrbitsSpaceportsFile | null> | null = null;

export function loadSpaceports(): Promise<OrbitsSpaceportsFile | null> {
  spaceportsPromise ??= fetch("/data/orbits/spaceports.json")
    .then((res) => (res.ok ? (res.json() as Promise<OrbitsSpaceportsFile>) : null))
    .catch(() => null);
  return spaceportsPromise;
}

let facilitiesPromise: Promise<OrbitsFacilitiesFile | null> | null = null;

export function loadFacilities(): Promise<OrbitsFacilitiesFile | null> {
  facilitiesPromise ??= fetch("/data/orbits/facilities.json")
    .then((res) => (res.ok ? (res.json() as Promise<OrbitsFacilitiesFile>) : null))
    .catch(() => null);
  return facilitiesPromise;
}

let statsPromise: Promise<OrbitsStatsFile | null> | null = null;

export function loadStats(): Promise<OrbitsStatsFile | null> {
  statsPromise ??= fetch("/data/orbits/stats.json")
    .then((res) => (res.ok ? (res.json() as Promise<OrbitsStatsFile>) : null))
    .catch(() => null);
  return statsPromise;
}
