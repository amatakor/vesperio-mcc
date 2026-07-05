/**
 * The Orbits view of the Registry: which constellations can render a
 * layer, their category coloring, the fleet parent/child nesting (same
 * logic as the Registry browser), and the LL2-to-registry spaceport
 * mapping. Derived entirely from registry data; nothing hardcoded.
 */

import type { ConstellationDomain } from "../data/schema";
import { constellations, spaceports as registrySpaceports } from "../lib/data";
import { CATEGORY_ORDER, CATEGORY_TOKENS } from "./types";

export interface CatalogEntry {
  slug: string;
  name: string;
  category: ConstellationDomain;
  /** CSS custom property carrying the category neon. */
  colorToken: string;
  operator: string | null;
  /** False for fleet parents that carry no element layer of their own. */
  hasOrbits: boolean;
}

const toEntry = (c: (typeof constellations)[number]): CatalogEntry => ({
  slug: c.slug,
  name: c.name,
  category: c.domain,
  colorToken: CATEGORY_TOKENS[c.domain],
  operator: c.operator.value,
  hasOrbits: Boolean(c.orbits),
});

const byCategoryThenName = (a: CatalogEntry, b: CatalogEntry) => {
  const ca = CATEGORY_ORDER.indexOf(a.category);
  const cb = CATEGORY_ORDER.indexOf(b.category);
  return ca !== cb ? ca - cb : a.name.localeCompare(b.name);
};

/** Constellations with a CelesTrak mapping: the renderable layers. */
export const orbitCatalog: CatalogEntry[] = constellations
  .filter((c) => c.orbits)
  .map(toEntry)
  .sort(byCategoryThenName);

/** Fleet parent/child nesting, mirroring the Registry browser. */
export interface CatalogNode {
  entry: CatalogEntry;
  children: CatalogEntry[];
}

const childrenByParent = new Map<string, CatalogEntry[]>();
for (const c of constellations) {
  if (c.parent && c.orbits) {
    const list = childrenByParent.get(c.parent) ?? [];
    list.push(toEntry(c));
    childrenByParent.set(c.parent, list);
  }
}
for (const list of childrenByParent.values()) list.sort((a, b) => a.name.localeCompare(b.name));

export const catalogTree: CatalogNode[] = constellations
  .filter((c) => (c.orbits && !c.parent) || childrenByParent.has(c.slug))
  .map((c) => ({ entry: toEntry(c), children: childrenByParent.get(c.slug) ?? [] }))
  .sort((a, b) => byCategoryThenName(a.entry, b.entry));

/** Every entry the UI can reference: layers plus fleet parents. */
export const catalogBySlug = new Map<string, CatalogEntry>(
  catalogTree
    .flatMap((n) => [n.entry, ...n.children])
    .map((e) => [e.slug, e] as const),
);

/** A highlight on a fleet parent means all of its child layers. */
export function expandHighlight(slug: string): string[] {
  const children = childrenByParent.get(slug);
  if (children && children.length > 0) return children.map((c) => c.slug);
  return catalogBySlug.get(slug)?.hasOrbits ? [slug] : [];
}

/** LL2 location id -> registry spaceport slug, where profiles carry one. */
export const ll2ToRegistrySlug = new Map<number, string>(
  registrySpaceports.flatMap((s) =>
    s.ll2_location_id?.value != null ? [[s.ll2_location_id.value, s.slug] as const] : [],
  ),
);
