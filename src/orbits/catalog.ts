/**
 * The Orbits view of the Registry: which constellations can render a
 * layer, their category coloring, and the LL2-to-registry spaceport
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
}

/** Constellations with a CelesTrak mapping, in category display order. */
export const orbitCatalog: CatalogEntry[] = constellations
  .filter((c) => c.orbits)
  .map((c) => ({
    slug: c.slug,
    name: c.name,
    category: c.domain,
    colorToken: CATEGORY_TOKENS[c.domain],
    operator: c.operator.value,
  }))
  .sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    return ca !== cb ? ca - cb : a.name.localeCompare(b.name);
  });

export const catalogBySlug = new Map(orbitCatalog.map((e) => [e.slug, e]));

/** LL2 location id -> registry spaceport slug, where profiles carry one. */
export const ll2ToRegistrySlug = new Map<number, string>(
  registrySpaceports.flatMap((s) =>
    s.ll2_location_id?.value != null ? [[s.ll2_location_id.value, s.slug] as const] : [],
  ),
);
