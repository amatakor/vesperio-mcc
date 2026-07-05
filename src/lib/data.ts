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
} from "../data/schema";
import { DOMAIN_TAGS } from "../data/schema";
import itemsJson from "../data/items.json";
import signalsJson from "../data/signals.json";
import stateJson from "../data/state.json";

export const items: Item[] = (itemsJson as ItemsFile).items
  .slice()
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const signalsFile = signalsJson as unknown as SignalsFile;
export const signals = signalsFile.people;
export const signalOutlets = signalsFile.outlets;

export const sweeps: SweepLogEntry[] = (stateJson as StateFile).sweeps
  .slice()
  .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

const constellationModules = import.meta.glob("../data/registry/constellations/*.json", {
  eager: true,
}) as Record<string, { default: ConstellationProfile }>;
const vehicleModules = import.meta.glob("../data/registry/vehicles/*.json", {
  eager: true,
}) as Record<string, { default: VehicleProfile }>;

const bySlug = <T extends { slug: string }>(mods: Record<string, { default: T }>): T[] =>
  Object.values(mods)
    .map((m) => m.default)
    .sort((a, b) => a.slug.localeCompare(b.slug));

export const constellations: ConstellationProfile[] = bySlug(constellationModules);
export const vehicles: VehicleProfile[] = bySlug(vehicleModules);

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
