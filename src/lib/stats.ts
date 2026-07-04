/**
 * Basic public indices computed from our own data at build time.
 * Deeper cross-cutting analytics are reserved for the v2 paid layer
 * and must not be added here.
 */

import type { Item, ConstellationProfile, VehicleProfile } from "../data/schema";

export const SITE_ORIGIN = "https://mcc.vesperio.com";

export interface StatBlock {
  /** Anchor id on /stats/, and key in stats.json. */
  id: string;
  title: string;
  /** [label, value] rows; a single-row block is a scalar stat. */
  rows: Array<[string, number]>;
  /** Where the numbers come from, in one plain sentence. */
  method: string;
  /** Pre-formatted citation string including retrieval date. */
  citation: string;
}

function citation(title: string, anchor: string, asOf: string): string {
  return `Vesperio MCC, "${title}", ${SITE_ORIGIN}/stats/#${anchor}, retrieved ${asOf}.`;
}

export function computeStats(
  items: Item[],
  constellations: ConstellationProfile[],
  vehicles: VehicleProfile[],
  generatedAt: Date,
): StatBlock[] {
  const asOf = generatedAt.toISOString().slice(0, 10);

  const byCategory = new Map<string, number>();
  for (const item of items) {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
  }

  const launchesByProvider = new Map<string, number>();
  for (const item of items) {
    if (item.category !== "launch") continue;
    for (const company of item.companies) {
      launchesByProvider.set(company, (launchesByProvider.get(company) ?? 0) + 1);
    }
  }

  const satsOnOrbit: Array<[string, number]> = constellations
    .filter((c) => c.sats_on_orbit.value !== null)
    .map((c) => [c.name, c.sats_on_orbit.value as number]);

  const flightsByVehicle: Array<[string, number]> = vehicles
    .filter((v) => v.flights_total.value !== null)
    .map((v) => [v.name, v.flights_total.value as number]);

  const sortDesc = (rows: Array<[string, number]>) =>
    rows.slice().sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return [
    {
      id: "items-tracked",
      title: "News items tracked",
      rows: [["Total items", items.length], ...sortDesc([...byCategory.entries()])],
      method: "Count of published items in the MCC feed, total and per category.",
      citation: citation("News items tracked", "items-tracked", asOf),
    },
    {
      id: "launches-by-provider",
      title: "Launch events logged by provider",
      rows: sortDesc([...launchesByProvider.entries()]),
      method: "Count of items in the launch category, grouped by the companies on each item.",
      citation: citation("Launch events logged by provider", "launches-by-provider", asOf),
    },
    {
      id: "sats-on-orbit",
      title: "Satellites on orbit by constellation",
      rows: sortDesc(satsOnOrbit),
      method: "The sats_on_orbit field of each registry profile; every value carries its own source and as-of date on the profile page.",
      citation: citation("Satellites on orbit by constellation", "sats-on-orbit", asOf),
    },
    {
      id: "vehicle-flight-counts",
      title: "Total flights by launch vehicle",
      rows: sortDesc(flightsByVehicle),
      method: "The flights_total field of each registry vehicle profile; every value carries its own source and as-of date on the profile page.",
      citation: citation("Total flights by launch vehicle", "vehicle-flight-counts", asOf),
    },
  ];
}

export function statsJson(blocks: StatBlock[], generatedAt: Date): string {
  return JSON.stringify(
    {
      generated_at: generatedAt.toISOString(),
      site: SITE_ORIGIN,
      stats: blocks.map((b) => ({
        id: b.id,
        title: b.title,
        anchor: `${SITE_ORIGIN}/stats/#${b.id}`,
        rows: Object.fromEntries(b.rows),
        method: b.method,
        citation: b.citation,
      })),
    },
    null,
    2,
  );
}
