/**
 * Registry crossfeed plumbing (SNR_SPEC §6, SNR_PLAN §7.3), wired by
 * finalize-sweep. The agent attests extracted facts per item (which
 * entity, which field, what the source states, and the like-for-like
 * judgment); this module owns everything after that judgment: eligible
 * fields, entity resolution, the reconcile() outcome, and the queue
 * entries the weekly registry run consumes.
 *
 * Metric discipline is inherited from the spec: sats_active_verified is
 * NOT crossfeedable (it is computed from CelesTrak by our own pipeline
 * and refreshed there, never from news), and the same_metric flag is the
 * agent's attested judgment, exactly as reconcile() documents.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { reconcile } from "../snr/reconcile";
import type { ReconcileAction } from "../snr/reconcile";
import type { RegistryFactTier, SnrValue } from "../../src/data/schema";

type Obj = Record<string, unknown>;

export const REGISTRY_SUBDIR_BY_TYPE = {
  constellation: "constellations",
  vehicle: "vehicles",
  spaceport: "spaceports",
  organization: "organizations",
} as const;
export type RegistryEntityType = keyof typeof REGISTRY_SUBDIR_BY_TYPE;

/** SourcedFields a news fact may legally target, per entity type. */
export const CROSSFEED_FIELDS: Record<RegistryEntityType, ReadonlySet<string>> = {
  constellation: new Set([
    "operator",
    "country",
    "sensor_types",
    "sats_launched_total",
    "sats_active_claimed",
    "sats_planned",
    "orbit",
    "first_launch_date",
    "latest_launch_date",
    "status",
  ]),
  vehicle: new Set([
    "provider",
    "country",
    "vehicle_class",
    "payload_leo_kg",
    "reusable",
    "first_flight_date",
    "flights_total",
    "flights_successful",
    "last_flight_date",
    "next_flight_date",
    "status",
    "price_per_launch_usd",
  ]),
  spaceport: new Set(["country", "operator", "first_launch_date", "launches_total", "status"]),
  organization: new Set(["country", "founded", "focus", "status"]),
};

export interface RegistryEntityRef {
  slug: string;
  entityType: RegistryEntityType;
  name: string;
  profile: Obj;
}

export interface RegistryIndex {
  bySlug: Map<string, RegistryEntityRef>;
  /** lowercased display name / alias / slug-as-words -> slugs it maps to. */
  byName: Map<string, string[]>;
}

function addName(index: RegistryIndex, name: string, slug: string): void {
  const key = name.toLowerCase().trim();
  if (key === "") return;
  const list = index.byName.get(key) ?? [];
  if (!list.includes(slug)) list.push(slug);
  index.byName.set(key, list);
}

/** Loads every registry profile plus the curated alias map into one index. */
export function loadRegistryIndex(dataDir: string): RegistryIndex {
  const index: RegistryIndex = { bySlug: new Map(), byName: new Map() };
  for (const [entityType, sub] of Object.entries(REGISTRY_SUBDIR_BY_TYPE) as [
    RegistryEntityType,
    string,
  ][]) {
    let files: string[];
    try {
      files = readdirSync(join(dataDir, "registry", sub));
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      let profile: Obj;
      try {
        profile = JSON.parse(readFileSync(join(dataDir, "registry", sub, file), "utf8")) as Obj;
      } catch {
        continue;
      }
      const slug = typeof profile.slug === "string" ? profile.slug : file.replace(/\.json$/, "");
      const name = typeof profile.name === "string" ? profile.name : slug;
      const ref: RegistryEntityRef = { slug, entityType, name, profile };
      index.bySlug.set(slug, ref);
      addName(index, name, slug);
      addName(index, slug.replace(/-/g, " "), slug);
    }
  }
  // Curated aliases: alias -> the linked org profile (when one exists).
  try {
    const aliases = JSON.parse(readFileSync(join(dataDir, "aliases.json"), "utf8")) as {
      entities?: { name?: string; org?: string; aliases?: string[] }[];
    };
    for (const e of aliases.entities ?? []) {
      if (typeof e.org !== "string" || !index.bySlug.has(e.org)) continue;
      if (typeof e.name === "string") addName(index, e.name, e.org);
      for (const a of e.aliases ?? []) addName(index, a, e.org);
    }
  } catch {
    // no aliases file in minimal test data dirs
  }
  return index;
}

/** The registry entity slugs an item's companies[] resolves to. */
export function matchCompanies(index: RegistryIndex, companies: string[]): string[] {
  const out = new Set<string>();
  for (const c of companies) {
    for (const slug of index.byName.get(c.toLowerCase().trim()) ?? []) out.add(slug);
  }
  return [...out];
}

/** One attested fact from a draft item's crossfeed block. */
export interface CrossfeedFact {
  entity_slug: string;
  field: string;
  value: unknown;
  /** What the value measures, in the source's own terms. */
  metric: string;
  /** The agent's like-for-like judgment vs the current registry fact. */
  same_metric: boolean;
}

export type CrossfeedActionKind = ReconcileAction["action"] | "null_fill" | "below_entry_bar";

export interface QueueCandidate {
  /** "<item-id>:<entity-slug>.<field>", the dedup key. */
  id: string;
  item_id: string;
  entity_slug: string;
  entity_type: RegistryEntityType;
  field: string;
  value: unknown;
  metric: string;
  same_metric: boolean;
  item_snr: SnrValue;
  source_url: string;
  action: CrossfeedActionKind;
  proposed_on: string;
  status: "pending";
}

export interface RegistryCandidatesFile {
  $comment?: string;
  version: string;
  candidates: QueueCandidate[];
}

/**
 * Decide what a scored item fact does to the registry. Mirrors SNR_SPEC §6:
 *  - the target field is currently null -> null_fill when the item clears
 *    the SNR >= 3 entry bar, below_entry_bar otherwise (recorded, not landed)
 *  - the target field has a value -> reconcile() applies the spec's rules
 *    (metric mismatch annotates; provisional never adjudicates; canonical
 *    wins/loses/ties by SNR).
 */
export function decideFact(
  fact: CrossfeedFact,
  entity: RegistryEntityRef,
  itemSnr: SnrValue,
): CrossfeedActionKind {
  const current = entity.profile[fact.field] as Obj | undefined;
  const currentValue = current === undefined ? null : (current.value ?? null);
  const isEmpty =
    currentValue === null || (Array.isArray(currentValue) && currentValue.length === 0);
  if (isEmpty) return itemSnr >= 3 ? "null_fill" : "below_entry_bar";
  const snr = current !== undefined && typeof current.snr === "number" ? (current.snr as number) : undefined;
  const tier =
    current !== undefined && typeof current.tier === "string"
      ? (current.tier as RegistryFactTier)
      : undefined;
  const registryFact = {
    ...(snr !== undefined ? { snr } : {}),
    ...(tier !== undefined ? { tier } : {}),
    ...(snr === undefined ? { unscored: true } : {}),
  };
  return reconcile({ snr: itemSnr }, registryFact, fact.same_metric).action;
}

/** Validation errors for one crossfeed fact; [] when the fact is well-formed. */
export function validateFact(
  fact: unknown,
  index: RegistryIndex,
  path: string,
): { errors: string[]; fact?: CrossfeedFact; entity?: RegistryEntityRef } {
  const errors: string[] = [];
  if (typeof fact !== "object" || fact === null) {
    return { errors: [`${path}: must be an object { entity_slug, field, value, metric, same_metric }`] };
  }
  const f = fact as Obj;
  const entity =
    typeof f.entity_slug === "string" ? index.bySlug.get(f.entity_slug) : undefined;
  if (entity === undefined) {
    errors.push(`${path}.entity_slug: "${String(f.entity_slug)}" is not a registry entity slug`);
  }
  if (typeof f.field !== "string") {
    errors.push(`${path}.field: required string`);
  } else if (entity !== undefined && !CROSSFEED_FIELDS[entity.entityType].has(f.field)) {
    errors.push(
      `${path}.field: "${f.field}" is not a crossfeedable ${entity.entityType} field ` +
        `(allowed: ${[...CROSSFEED_FIELDS[entity.entityType]].join(", ")})`,
    );
  }
  if (f.value === undefined || f.value === null) {
    errors.push(`${path}.value: required (the fact as the source states it)`);
  }
  if (typeof f.metric !== "string" || f.metric.trim() === "") {
    errors.push(`${path}.metric: required non-empty string (what the value measures)`);
  }
  if (typeof f.same_metric !== "boolean") {
    errors.push(`${path}.same_metric: required boolean (the like-for-like judgment)`);
  }
  if (errors.length > 0) return { errors };
  return { errors, fact: f as unknown as CrossfeedFact, entity };
}
