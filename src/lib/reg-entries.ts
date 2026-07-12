/**
 * Registry index entry summaries: the small per-profile card set the
 * /registry/ browser renders. Moved out of pages.tsx and PARAMETERIZED
 * on the profile arrays so the builders run server-side (prerender)
 * against the full dataset while the client receives only the built
 * entries; pages.tsx imports the types and canonicalName (aliases.json
 * is a small curated map and stays a static import).
 */

import type {
  ConstellationProfile,
  VehicleProfile,
  SpaceportProfile,
  OrgProfile,
} from "../data/schema";
import aliases from "../data/aliases.json";

export type EntityKind = "eo" | "connectivity" | "iot" | "vehicle" | "spaceport" | "org";

export interface RegSpec {
  label: string;
  value: string;
}

export interface RegEntry {
  slug: string;
  name: string;
  kind: EntityKind;
  href: string;
  /** Grouping key: operator/provider name, region, or org kind. */
  group: string;
  /** Sub-grouping for constellations (fleet parent slug); null otherwise. */
  parent: string | null;
  affiliation: string;
  status: string | null;
  asOf: string | null;
  snippet: string | null;
  sensors: string[];
  reusable: boolean | null;
  /** Normalized short launch-vehicle class (heavy-lift, medium-lift, ...); null for non-vehicles or unclassifiable. */
  vehicleClass: string | null;
  /** Two or three headline specs, only for fields the profile states. */
  specs: RegSpec[];
}

/**
 * Curated alias map (src/data/aliases.json): unifies display names and
 * browser grouping for companies that sources phrase differently. The
 * sourced value inside each profile keeps the cited page's wording.
 */
const CANONICAL_BY_ALIAS = new Map<string, { name: string; org?: string }>();
for (const e of aliases.entities) {
  CANONICAL_BY_ALIAS.set(e.name.toLowerCase(), e);
  for (const a of e.aliases) CANONICAL_BY_ALIAS.set(a.toLowerCase(), e);
}

export function canonicalName(v: string): string {
  return CANONICAL_BY_ALIAS.get(v.toLowerCase())?.name ?? v;
}

/**
 * Href of the registry entity a display name refers to, resolved
 * through the alias map and the org name -> href map the page's data
 * slice carries (built server-side from the organizations corpus).
 */
export function entityHrefFor(
  v: string,
  orgHrefs: Record<string, string>,
): string | undefined {
  const canon = CANONICAL_BY_ALIAS.get(v.toLowerCase());
  if (canon?.org) return `/registry/organizations/${canon.org}/`;
  return orgHrefs[(canon?.name ?? v).toLowerCase()] ?? orgHrefs[v.toLowerCase()];
}

const DOMAIN_LABEL: Record<string, string> = { eo: "eo", connectivity: "connectivity", iot: "iot" };

export const ORG_KIND_LABEL: Record<string, string> = {
  manufacturer: "manufacturer",
  "launch-services": "launch services",
  "in-space-services": "in-space services",
  "ground-segment": "ground segment",
  institution: "institution",
  finance: "finance",
};

/** Collapse a free-text vehicle_class value to a short lift-class label; null when the source states no class we recognise. */
export function normVehicleClass(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("super") && s.includes("heavy")) return "super-heavy";
  if (s.includes("heavy")) return "heavy-lift";
  if (s.includes("medium")) return "medium-lift";
  if (s.includes("small")) return "small-lift";
  return null;
}

export function constellationEntries(constellations: ConstellationProfile[]): RegEntry[] {
  return constellations.map((c) => {
    const kind =
      c.domain === "eo" ? ("eo" as const) : c.domain === "iot" ? ("iot" as const) : ("connectivity" as const);
    const specs: RegSpec[] = [];
    if (c.sats_active_verified.value !== null)
      specs.push({ label: "on orbit", value: String(c.sats_active_verified.value) });
    else if (c.sats_launched_total.value !== null)
      specs.push({ label: "launched", value: String(c.sats_launched_total.value) });
    if (c.resolution_m?.value != null) specs.push({ label: "resolution", value: `${c.resolution_m.value} m` });
    // Domain is a tag, not prose: the tile renders it in caps (Florian,
    // 2026-07-11, registry casing pass).
    specs.push({ label: "domain", value: (DOMAIN_LABEL[kind] ?? kind).toUpperCase() });
    return {
      slug: c.slug,
      name: c.name,
      kind,
      href: `/registry/constellations/${c.slug}/`,
      group: c.operator.value ? canonicalName(c.operator.value) : "Operator unconfirmed",
      parent: c.parent ?? null,
      affiliation: c.operator.value ? canonicalName(c.operator.value) : "Operator unconfirmed",
      status: c.status.value,
      asOf: c.operator.as_of,
      snippet: c.overview.value,
      sensors: c.sensor_types.value ?? [],
      reusable: null,
      vehicleClass: null,
      specs,
    };
  });
}

export function vehicleEntries(vehicles: VehicleProfile[]): RegEntry[] {
  return vehicles.map((v) => {
    const specs: RegSpec[] = [];
    if (v.payload_leo_kg.value !== null)
      specs.push({ label: "leo payload", value: `${v.payload_leo_kg.value.toLocaleString()} kg` });
    if (v.flights_total.value !== null)
      specs.push({
        label: "flights",
        value:
          v.flights_successful.value !== null
            ? `${v.flights_successful.value}/${v.flights_total.value}`
            : String(v.flights_total.value),
      });
    if (v.reusable.value !== null) specs.push({ label: "reusable", value: v.reusable.value ? "yes" : "no" });
    return {
      slug: v.slug,
      name: v.name,
      kind: "vehicle" as const,
      href: `/registry/vehicles/${v.slug}/`,
      group: v.provider.value ?? "Provider unconfirmed",
      parent: null,
      affiliation: v.provider.value ?? "Provider unconfirmed",
      status: v.status.value,
      asOf: v.provider.as_of,
      snippet: v.overview.value,
      sensors: [],
      reusable: v.reusable.value,
      vehicleClass: normVehicleClass(v.vehicle_class.value),
      specs,
    };
  });
}

export function spaceportEntries(spaceports: SpaceportProfile[]): RegEntry[] {
  return spaceports.map((s) => {
    const specs: RegSpec[] = [];
    if (s.launches_total.value !== null) specs.push({ label: "launches", value: String(s.launches_total.value) });
    if (s.country.value) specs.push({ label: "country", value: s.country.value });
    return {
      slug: s.slug,
      name: s.name,
      kind: "spaceport" as const,
      href: `/registry/spaceports/${s.slug}/`,
      group: s.region,
      parent: null,
      affiliation: s.operator.value ?? "Operator unconfirmed",
      status: s.status.value,
      asOf: s.launches_total.as_of,
      snippet: s.overview.value,
      sensors: [],
      reusable: null,
      vehicleClass: null,
      specs,
    };
  });
}

export function orgEntries(organizations: OrgProfile[]): RegEntry[] {
  return organizations.map((o) => {
    const specs: RegSpec[] = [];
    if (o.founded.value !== null) specs.push({ label: "founded", value: String(o.founded.value) });
    if (o.country.value) specs.push({ label: "country", value: o.country.value });
    // Kind is a tag, not prose: caps like the DOMAIN tile (Florian,
    // 2026-07-12: "launch-services, manufacturer" read lowercase).
    specs.push({ label: "kind", value: (ORG_KIND_LABEL[o.kind] ?? o.kind).toUpperCase() });
    return {
      slug: o.slug,
      name: o.name,
      kind: "org" as const,
      href: `/registry/organizations/${o.slug}/`,
      group: o.kind,
      parent: null,
      affiliation: o.kind,
      status: o.status.value,
      asOf: o.focus.as_of,
      snippet: o.overview.value ?? o.focus.value,
      sensors: [],
      reusable: null,
      vehicleClass: null,
      specs,
    };
  });
}
