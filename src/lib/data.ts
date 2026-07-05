/**
 * Build-time data access. All JSON is imported statically so both the
 * client bundle and the SSR/prerender bundle see identical data.
 */

import type {
  Item,
  ItemsFile,
  SignalsFile,
  StateFile,
  SweepLogEntry,
  ConstellationProfile,
  VehicleProfile,
  SpaceportProfile,
  OrgProfile,
} from "../data/schema";
import { DOMAIN_TAGS } from "../data/schema";
import itemsJson from "../data/items.json";
import signalsJson from "../data/signals.json";
import stateJson from "../data/state.json";
import signalAvatarsJson from "../data/signal-avatars.json";

export const items: Item[] = (itemsJson as ItemsFile).items
  .slice()
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const signalsFile = signalsJson as unknown as SignalsFile;
export const signals = signalsFile.people;
export const signalOutlets = signalsFile.outlets;
export const signalAvatars: Record<string, string> = signalAvatarsJson as Record<string, string>;

export const sweeps: SweepLogEntry[] = (stateJson as StateFile).sweeps
  .slice()
  .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

const constellationModules = import.meta.glob("../data/registry/constellations/*.json", {
  eager: true,
}) as Record<string, { default: ConstellationProfile }>;
const vehicleModules = import.meta.glob("../data/registry/vehicles/*.json", {
  eager: true,
}) as Record<string, { default: VehicleProfile }>;
const spaceportModules = import.meta.glob("../data/registry/spaceports/*.json", {
  eager: true,
}) as Record<string, { default: SpaceportProfile }>;
const organizationModules = import.meta.glob("../data/registry/organizations/*.json", {
  eager: true,
}) as Record<string, { default: OrgProfile }>;

const bySlug = <T extends { slug: string }>(mods: Record<string, { default: T }>): T[] =>
  Object.values(mods)
    .map((m) => m.default)
    .sort((a, b) => a.slug.localeCompare(b.slug));

export const constellations: ConstellationProfile[] = bySlug(constellationModules);
export const vehicles: VehicleProfile[] = bySlug(vehicleModules);
export const spaceports: SpaceportProfile[] = bySlug(spaceportModules);
export const organizations: OrgProfile[] = bySlug(organizationModules);

export function itemById(id: string): Item | undefined {
  return items.find((i) => i.id === id);
}

export function itemsByCategory(category: string): Item[] {
  return items.filter((i) => i.category === category);
}

export const allTags: string[] = [
  ...new Set([...items.flatMap((i) => i.tags), ...DOMAIN_TAGS]),
].sort();

export function itemsByTag(tag: string): Item[] {
  return items.filter((i) => i.tags.includes(tag));
}

export function constellationBySlug(slug: string): ConstellationProfile | undefined {
  return constellations.find((c) => c.slug === slug);
}

export function vehicleBySlug(slug: string): VehicleProfile | undefined {
  return vehicles.find((v) => v.slug === slug);
}

export function spaceportBySlug(slug: string): SpaceportProfile | undefined {
  return spaceports.find((s) => s.slug === slug);
}

export function orgBySlug(slug: string): OrgProfile | undefined {
  return organizations.find((o) => o.slug === slug);
}

/** Constellations whose parent matches slug (fleet sub-constellations), sorted by name. */
export function constellationChildren(slug: string): ConstellationProfile[] {
  return constellations
    .filter((c) => c.parent === slug)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Feed items that name any of the given entity names: a match on
 * item.companies (case-insensitive) or a whole-word match of the name
 * in the headline. Used to build a registry profile's event history.
 */
export function itemsMentioning(names: string[]): Item[] {
  const wanted = names.filter(Boolean).map((n) => n.toLowerCase());
  if (wanted.length === 0) return [];
  return items.filter((i) => {
    if (i.companies.some((c) => wanted.includes(c.toLowerCase()))) return true;
    return names.some((n) => {
      if (!n) return false;
      const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      return re.test(i.headline);
    });
  });
}
