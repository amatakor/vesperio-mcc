/**
 * Client-side async loaders for the data slices the prerenderer emits
 * under /data/ (same convention as orbits/elements.ts and the stock
 * sections: absolute root-relative URLs, session-cached promises,
 * plain HTTP caching underneath). Pages render from their embedded
 * page data; these loaders serve the interactions that need MORE than
 * the page slice (the home search over the full corpus) and act as the
 * public JSON surface.
 */

import type { Item, SweepLogEntry } from "../data/schema";

const cache = new Map<string, Promise<unknown>>();

function loadJson<T>(url: string): Promise<T> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    });
    // A failed fetch must not poison the session cache.
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p as Promise<T>;
}

/** Resolved full corpus, kept for the sync accessor the modal fallback uses. */
let allItemsResolved: Item[] | null = null;

export function getAllItems(): Promise<Item[]> {
  return loadJson<{ items: Item[] }>("/data/feed/all.json").then((f) => {
    allItemsResolved = f.items;
    return f.items;
  });
}

/**
 * The full corpus IF getAllItems() has already resolved, else null. The
 * feed modal uses it to survive filter changes without ever blocking on
 * a fetch (a miss just renders the item from the page slice).
 */
export function allItemsIfLoaded(): Item[] | null {
  return allItemsResolved;
}

export function getItem(id: string): Promise<Item> {
  return loadJson<Item>(`/data/items/${id}.json`);
}

export function getFeedPage(n: number): Promise<{ items: Item[]; page: number; pages: number }> {
  return loadJson(`/data/feed/page-${n}.json`);
}

export function getLogPage(n: number): Promise<{ sweeps: SweepLogEntry[]; page: number; pages: number }> {
  return loadJson(`/data/log/page-${n}.json`);
}

export function getProfile<T>(kind: string, slug: string): Promise<T> {
  return loadJson<T>(`/data/registry/${kind}/${slug}.json`);
}
