/**
 * Canonical data shapes for mcc.vesperio.ai.
 *
 * CLAUDE.md is the editorial spec these types implement; when a comment
 * here and CLAUDE.md disagree, CLAUDE.md wins. Runtime validation lives
 * in scripts/lib/validate.ts and must stay in sync with these types.
 */

// ---------------------------------------------------------------- items

export const CATEGORIES = [
  "launch",
  "constellation",
  "contract",
  "procurement",
  "regulatory",
  "financial",
  "product",
  "partnership",
  "incident",
  "geopolitical",
  "human-spaceflight",
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Importance, independent of SNR (SNR_SPEC.md §1): seismic = major
 * industry shifts only, notable = matters to anyone tracking the sector,
 * noise = worth logging, not worth a push. The legacy names stay
 * accepted until the slice-3 migration renames the data, then drop.
 */
export const IMPACTS = ["seismic", "notable", "noise"] as const;
export const LEGACY_IMPACTS = ["critical", "routine"] as const;
export type Impact = (typeof IMPACTS)[number] | (typeof LEGACY_IMPACTS)[number];

/**
 * DEPRECATED (SNR_SPEC.md §1): the confidence ladder is replaced by the
 * SNR score. Kept transitionally so pre-migration data and consumers
 * keep working; removed entirely in the slice-3 migration.
 */
export const CONFIDENCES = ["confirmed", "reported", "signal"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

// ------------------------------------------------------------------ snr
//
// Signal-to-noise scoring (SNR_SPEC.md; contract values in SNR_PLAN.md).
// SNR is an integer 1-5 set by the best attached source and adjusted by
// the modifiers below. The scoring math lives in scripts/snr/ and is
// pure code; the judgment inputs (source class, extraordinary flag,
// contradiction calls) come from the agent. Every score stores its
// trace at scoring time; traces are append-only over an item's life and
// never reconstructed on demand.

export const SNR_VALUES = [1, 2, 3, 4, 5] as const;
export type SnrValue = (typeof SNR_VALUES)[number];

/** Bumped on any change to the scoring math, so audits never compare incomparable scores. */
export const SCORER_VERSION = 1;

// Contract values, SNR_PLAN.md §A1-A5.
export const PERSISTENCE_DAYS = 14;
export const DEDUP_WINDOW_DAYS = 7;
export const REINFORCEMENT_WINDOW_DAYS = 30;
/** Reinforcement window applies only to items still at or below this SNR. */
export const REINFORCEMENT_MAX_SNR = 2;
export const CORROBORATION_FETCHES_PER_EVENT = 5;
export const CORROBORATION_FETCHES_PER_SWEEP = 40;
export const LEDGER_WINDOW_DAYS = 90;
export const LEDGER_DEMOTION_NET_STRIKES = 3;
export const LEDGER_DEMOTION_MIN_STRIKE_RATE = 1 / 3;
export const LEDGER_RECOVERY_NET_CREDITS = 3;
export const PROMOTION_MIN_CLAIMS = 5;
export const PROMOTION_WINDOW_DAYS = 30;
export const PROMOTION_MIN_SNR = 4;

/**
 * How a source counts toward the base tier. first_party requires the
 * URL's domain to match the actor's registry-recorded website or a
 * corporate account in signals.json (anti-spoof, SNR_PLAN.md §B1);
 * wire_pr copies (BusinessWire, GlobeNewswire, PR Newswire, PRWeb) cap
 * at 4 until the actor's own domain confirms.
 */
export const SOURCE_CLASSES = [
  "first_party",
  "official_record",
  "wire_pr",
  "trade",
  "mainstream",
  "whitelist",
  "aggregator",
  "computed",
  "informal",
] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

export const SOURCE_VIA = ["initial", "corroboration", "reinforcement", "upgrade"] as const;
export type SourceVia = (typeof SOURCE_VIA)[number];

/** One source attached to a card; cards accumulate these over their life. */
export interface ItemSource {
  url: string;
  /** Human-readable outlet or actor name, e.g. "SpaceNews" or "ICEYE". */
  outlet: string;
  class: SourceClass;
  /** YYYY-MM-DD the source attached. */
  added: string;
  via: SourceVia;
}

/**
 * Modifier vocabulary. Each type applies at most once per claim
 * (saturation rule, SNR_SPEC.md §2.1); the validator enforces it.
 */
export const SNR_MODIFIER_TYPES = [
  "corroboration_2plus", // +1: two or more distinct sources
  "corroboration_4plus", // +1: four or more distinct sources
  "mainstream_pickup", // +1: a non-trade outlet carries the story
  "corroboration_none", // -1: the crawl ran and found nothing (never applied on budget exhaustion)
  "reinforcement", // +1: a matching later event attached (SNR_PLAN.md §A2)
  "persistence", // +1: PERSISTENCE_DAYS uncontested, caps the score at 4
  "whitelist_floor", // raise to 4 (whitelisted observer) or 5 (actor about itself)
  "extraordinary", // force to 1: out-of-pattern claim (SNR_PLAN.md §B2 guardrail)
  "dispute", // -1: lost a same-metric contradiction (SNR_SPEC.md §6)
] as const;
export type SnrModifierType = (typeof SNR_MODIFIER_TYPES)[number];

export interface SnrModifier {
  type: SnrModifierType;
  delta: number;
  /** Plain-English line rendered in the trace popover. */
  reason: string;
  /** The source that triggered the modifier, when one did. */
  source?: string;
}

/** Appended whenever a stored score changes after publication; earlier entries never rewritten. */
export interface SnrHistoryEntry {
  /** YYYY-MM-DD of the change. */
  date: string;
  from: SnrValue;
  to: SnrValue;
  reason: string;
}

/**
 * Stored at scoring time and rendered by the SNR popover, never
 * reconstructed on demand. Invariant (validator-enforced): final equals
 * clamp(base.tier + sum of modifier deltas, 1, 5); floors and the
 * extraordinary reset are expressed as deltas so the arithmetic holds.
 */
export interface SnrTrace {
  base: { tier: SnrValue; source: string; reason: string };
  modifiers: SnrModifier[];
  final: SnrValue;
  scorer_version: number;
  history?: SnrHistoryEntry[];
}

/**
 * Seed tags in four tiers. Reuse before inventing new ones; new tags
 * stay lowercase and are logged in the sweep entry for review.
 * Domain tags: every item carries one where applicable.
 */
export const DOMAIN_TAGS = ["eo", "connectivity", "iot", "launch", "human-spaceflight"] as const;

export const SEED_TAGS = [
  ...DOMAIN_TAGS,
  "sar",
  "optical",
  "hyperspectral",
  "rf",
  "ghg",
  "direct-to-device",
  "smallsat-launch",
  "heavy-lift",
  "rideshare",
  "pricing",
  "china",
  "india",
  "europe",
  "japan",
  "mena",
  "us-gov",
  "esa",
  "export-control",
  "sanctions",
  "m-and-a",
  "funding",
  "bankruptcy",
  "reusability",
  "commercial-crew",
  "commercial-stations",
  "spaceport",
] as const;

export const HEADLINE_MAX_CHARS = 90;
export const TAGLINE_MAX_CHARS = 140;

export interface Explainer {
  /** One sentence, max ~140 chars. The event in plain words. */
  tagline: string;
  /** 2-3 sentences. The facts, nothing not in the source. */
  what_happened: string;
  /** 2-4 sentences. The industry read: who this affects and how. */
  why_it_matters: string;
  /** Optional. Who should care most, e.g. "EO resellers". */
  for_who?: string;
}

/**
 * Card/item artwork. Populated only by scripts/fetch-thumbs.ts: either
 * the source's own og:image (credited and linked to the source) or a
 * curated freely licensed stock image from stock-images.json. Never
 * picked by hand, never image-searched, never generated imagery of
 * real events. null/absent = the site renders a generated text tile.
 */
export interface ItemImage {
  /** Site-relative path under /img/, or an absolute https URL. */
  src: string;
  /** Human-readable credit line shown on the item page. */
  credit: string;
  /** Where the image came from (source article or license page). */
  origin_url: string;
}

/**
 * Evidence block for non-confirmed items: who said it, on what basis,
 * and what would confirm or deny it. Required by the sweep prompt for
 * reported and signal items; every statement must come from the linked
 * source, never from model memory.
 */
export interface Evidence {
  /** Who made the claim, e.g. "Financial Times" or "@Peter_Beck on X". */
  said_by: string;
  /** The stated basis, e.g. "citing 12+ current and former employees". */
  basis: string;
  /** What would confirm or deny it, with timing if stated; null if unknown. */
  confirmation: string | null;
}

export interface Item {
  /** Format: YYYY-MM-DD-slug, e.g. "2026-07-05-iceye-gen4-order". */
  id: string;
  /** Event date, YYYY-MM-DD. */
  date: string;
  /** Max 90 chars, factual, actor first, no hype verbs. */
  headline: string;
  explainer: Explainer;
  /** Lowercase; reuse SEED_TAGS before inventing new ones. */
  tags: string[];
  category: Category;
  impact: Impact;
  companies: string[];
  /** Lead source: the best source attached to the item. Required. */
  source_url: string;
  secondary_urls: string[];
  /** DEPRECATED: replaced by snr; dropped in the slice-3 migration. */
  confidence: Confidence;
  /** SNR score 1-5 (SNR_SPEC.md §2). Required once migrated; snr_trace must accompany it. */
  snr?: SnrValue;
  snr_trace?: SnrTrace;
  /** Every source attached over the card's life, lead source included. */
  sources?: ItemSource[];
  /** True while a same-metric contradiction at equal SNR stands (SNR_SPEC.md §6.4). */
  disputed?: boolean;
  /** ISO datetime stamped by finalize-sweep, absent in drafts. */
  publishDate?: string;
  /** Stamped by scripts/fetch-thumbs.ts, never by the drafting agent. */
  image?: ItemImage | null;
  /** Required for reported/signal items; absent for confirmed. */
  evidence?: Evidence | null;
}

export interface ItemsFile {
  items: Item[];
}

// ----------------------------------------------------------- held/state

export interface HeldEntry {
  /** The candidate item as far as it got; may be partial. */
  candidate: Record<string, unknown>;
  /** One-line reason the item was held, for human review. */
  reason: string;
  /** YYYY-MM-DD the candidate was held, stamped by finalize-sweep. */
  date?: string;
}

export interface HeldFile {
  held: HeldEntry[];
}

export interface SweepLogEntry {
  /** ISO datetime of the sweep. */
  at: string;
  added: number;
  updated: number;
  held: number;
  /** 1-2 sentence sweep summary. */
  summary: string;
  /** Categories genuinely searched this run; required even on zero-add sweeps. */
  coverage: string[];
  /** Tags coined this sweep that are outside SEED_TAGS and prior items; for human review. */
  new_tags?: string[];
  /** SNR movements this sweep (upgrades, downgrades, disputes); rendered on /log. */
  snr_movements?: { id: string; from: SnrValue; to: SnrValue; reason: string }[];
}

export interface StateFile {
  /** ISO datetime of the last completed sweep, null before the first. */
  lastSweep: string | null;
  sweeps: SweepLogEntry[];
}

// -------------------------------------------------------------- sources

export const SOURCE_STATUSES = ["verified", "unverified", "dead"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const FEED_TYPES = ["html", "rss", "rss_atom", "api_json"] as const;
export type FeedType = (typeof FEED_TYPES)[number];

export const SOURCE_TIERS = [1, 2] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];

export interface Source {
  name: string;
  url: string;
  feed_type: FeedType;
  rss?: string | null;
  cadence: string;
  language: string;
  /** 1 = primary (publishable basis), 2 = discovery/cross-check only. */
  tier: SourceTier;
  status: SourceStatus;
  notes?: string;
  /** Consecutive fetch failures; 3 flips the source to dead. */
  fail_count?: number;
}

export interface SourcesFile {
  $comment?: string;
  version: string;
  categories: Record<string, Source[]>;
}

// -------------------------------------------------------------- signals

/**
 * Hand-curated by Florian only; the agent never edits signals.json.
 * Schema adopted from Florian's verified scouting run of 2026-07-05.
 * Only people with whitelist "yes", via channels with status
 * "verified_active", qualify as signal-tier sourcing. ingest_rules,
 * when present, constrain which of a person's posts are eligible.
 */

export const SIGNAL_BUCKETS = [
  "founder_exec",
  "agency_leader",
  "engineer_operator",
  "analyst",
  "journalist",
  "creator",
] as const;
export type SignalBucket = (typeof SIGNAL_BUCKETS)[number];

export const SIGNAL_WHITELIST = ["yes", "review", "no"] as const;
export type SignalWhitelist = (typeof SIGNAL_WHITELIST)[number];

export const CHANNEL_STATUSES = [
  "verified_active",
  "exists_activity_unverified",
  "stale",
  "dead",
] as const;
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number];

export interface SignalChannel {
  /** e.g. "x", "bluesky", "substack", "site", "youtube", "podcast", "linkedin", "beehiiv". */
  type: string;
  handle?: string;
  url: string;
  rss?: string;
  status: ChannelStatus;
  /** YYYY-MM-DD of the newest post seen, or null when not sampled. */
  last_seen: string | null;
  /** YYYY-MM-DD the channel was last checked, or null. */
  verified_on: string | null;
  follower_scale_est?: string;
  notes?: string;
}

export interface SignalPerson {
  id: string;
  name: string;
  bucket: SignalBucket;
  role: string;
  org: string;
  domains: string[];
  regions: string[];
  /** One line on why this person is worth following. */
  why: string;
  whitelist: SignalWhitelist;
  /** Optional constraint on which posts are ingest-eligible. */
  ingest_rules?: string;
  notes?: string;
  channels: SignalChannel[];
}

export interface SignalOutlet {
  id: string;
  name: string;
  url: string;
  people?: string[];
  people_named?: string[];
  domains: string[];
  why: string;
  notes?: string;
}

export interface SignalExcluded {
  id: string;
  name: string;
  reason: string;
  recheck: boolean;
}

export interface SignalsFile {
  meta: Record<string, unknown>;
  people: SignalPerson[];
  outlets: SignalOutlet[];
  excluded: SignalExcluded[];
}

// ------------------------------------------- source ledger / suggestions

export const LEDGER_EVENT_KINDS = ["strike", "credit"] as const;
export type LedgerEventKind = (typeof LEDGER_EVENT_KINDS)[number];

export const CLAIM_RESOLUTIONS = ["confirmed", "debunked", "unresolved"] as const;
export type ClaimResolution = (typeof CLAIM_RESOLUTIONS)[number];

/**
 * One reliability event against a source (SNR_PLAN.md §A4). strike = a
 * claim downgraded by genuine same-metric contradiction or debunk;
 * credit = a claim that entered at <=2 and later reached >=4, or was
 * confirmed first-party ("early, not wrong"). Decisions use only events
 * inside LEDGER_WINDOW_DAYS.
 */
export interface LedgerEvent {
  /** YYYY-MM-DD. */
  date: string;
  kind: LedgerEventKind;
  /** Item id or "entity-slug.field" the event concerns. */
  claim: string;
  reason: string;
}

/** Calibration record: what we scored at publication vs how it resolved. */
export interface LedgerClaim {
  /** Item id or "entity-slug.field". */
  claim: string;
  /** YYYY-MM-DD the claim was first scored. */
  date: string;
  snr_at_publication: SnrValue;
  resolution: ClaimResolution;
  /** YYYY-MM-DD the resolution landed; absent while unresolved. */
  resolved_on?: string;
}

export interface LedgerSource {
  /** Source host, e.g. "spacenews.com"; the ledger key. */
  domain: string;
  name?: string;
  /** Demotion in effect: overrides the source's natural class until recovery; null = none. */
  class_override?: SourceClass | null;
  events: LedgerEvent[];
  claims: LedgerClaim[];
}

/** source_ledger.json: machine-owned, human-auditable via the report page. */
export interface SourceLedgerFile {
  version: string;
  /** ISO datetime of the last ledger update, null before the first. */
  updated: string | null;
  sources: LedgerSource[];
}

export const SUGGESTION_STATUSES = ["pending", "approved", "rejected"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/**
 * signals_suggestions.json: promotion suggestions only (SNR_PLAN.md §A5).
 * The agent never writes signals.json; Florian reviews these and edits
 * it by hand. Evidence claims must have reached PROMOTION_MIN_SNR via
 * corroboration independent of any whitelist floor.
 */
export interface SignalSuggestion {
  id: string;
  name: string;
  channel_url: string;
  /** YYYY-MM-DD. */
  proposed_on: string;
  evidence: { claim: string; final_snr: SnrValue; corroborating_sources: string[] }[];
  status: SuggestionStatus;
  notes?: string;
}

export interface SignalsSuggestionsFile {
  version: string;
  suggestions: SignalSuggestion[];
}

// ------------------------------------------------------------- registry

export const REGISTRY_FACT_TIERS = ["canonical", "provisional"] as const;
export type RegistryFactTier = (typeof REGISTRY_FACT_TIERS)[number];

/** A competing claim kept visible on a disputed registry fact (SNR_SPEC.md §6). */
export interface DisputedClaim<T> {
  value: T | null;
  source: string;
  as_of: string;
  snr: SnrValue;
}

/**
 * Every registry fact is a SourcedField: value, where it came from, and
 * when it was last verified. Unknown stays null; never estimate.
 *
 * SNR (SNR_SPEC.md §2.3, §5): Wikipedia and first-party facts carry no
 * snr/tier and just link their source; everything else carries both.
 * provisional = SNR 3 exactly, visible but never adjudicating; canonical
 * = SNR 4-5. Merge gates are unchanged: null-fill only, one source per
 * field, never overwrite silently.
 */
export interface SourcedField<T> {
  value: T | null;
  source: string | null;
  /** YYYY-MM-DD the value was last verified against the source. */
  as_of: string | null;
  snr?: SnrValue;
  /** Required whenever snr is present. */
  snr_trace?: SnrTrace;
  /** Required whenever snr is present. */
  tier?: RegistryFactTier;
  disputed?: { competing: DisputedClaim<T>[] };
}

/**
 * One sourced event on a profile's history timeline (Task 15). Dates keep
 * the precision the source states: YYYY, YYYY-MM, or YYYY-MM-DD. The
 * headline is actor-first plain English, max ~90 chars, no hype. Where
 * only trade press records an event, the headline names the outlet
 * ("per SpaceNews"), mirroring the news ladder's reported tier.
 */
export interface TimelineEvent {
  /** YYYY, YYYY-MM, or YYYY-MM-DD, exactly as precise as the source. */
  date: string;
  /** Actor-first, factual, max ~90 chars. */
  headline: string;
  /** The page that states the event. Required. */
  source: string;
  /** YYYY-MM-DD the event was verified against the source. */
  as_of: string;
}

export const CONSTELLATION_DOMAINS = [
  "eo",
  "connectivity",
  "iot",
  "human-spaceflight",
  // Public GNSS constellations, included in Orbits on Florian's
  // instruction (2026-07-05) for competitive context.
  "navigation",
] as const;
export type ConstellationDomain = (typeof CONSTELLATION_DOMAINS)[number];

/**
 * How the Orbits pipeline fetches this constellation's element sets from
 * CelesTrak (spec ORBITS_SPEC.md §5.1). Group query preferred; NAME=
 * substring query against the active catalog as fallback. name_pattern is
 * a regex OBJECT_NAME must match to belong to this constellation (needed
 * when a shared group or a broad NAME match covers several entries).
 * Absent or null: no orbit layer (planned constellations, fleet parents
 * whose children carry the layers).
 */
export interface ConstellationOrbits {
  celestrak_group: string | null;
  celestrak_name: string | null;
  name_pattern: string | null;
}

export interface ConstellationProfile {
  /** Must match the filename, e.g. "iceye" for iceye.json. */
  slug: string;
  name: string;
  entity_type: "constellation";
  domain: ConstellationDomain;
  /** Slug of the fleet-level parent profile, when the operator names sub-constellations. */
  parent?: string | null;
  /** CelesTrak query mapping for the Orbits surface; null/absent = no layer. */
  orbits?: ConstellationOrbits | null;
  /** Sourced history timeline; absent until the Task 15 crawl fills it. */
  events?: TimelineEvent[];
  /** Stock listing of the operator as stated, e.g. "NYSE: PL". */
  ticker?: SourcedField<string>;
  /** Chart-provider symbol for the price pipeline, e.g. "PL". */
  stock_symbol?: string | null;
  /** 2-4 sentence sourced overview; every claim backed by this field's source. */
  overview: SourcedField<string>;
  operator: SourcedField<string>;
  country: SourcedField<string>;
  /** EO sensor modality/ies, e.g. ["sar"]; null for connectivity. */
  sensor_types: SourcedField<string[]>;
  /** Cumulative satellites launched for the constellation, as stated. */
  sats_launched_total: SourcedField<number>;
  /** The operator's stated current active/on-orbit count. */
  sats_active_claimed: SourcedField<number>;
  /**
   * Objects currently tracked in CelesTrak's catalog for this
   * constellation; computed by scripts/compute-fleet-counts.ts from the
   * committed element sets. A tracking count, not an operator health claim.
   */
  sats_active_verified: SourcedField<number>;
  sats_planned: SourcedField<number>;
  orbit: SourcedField<string>;
  first_launch_date: SourcedField<string>;
  latest_launch_date: SourcedField<string>;
  status: SourcedField<string>;
  website: SourcedField<string>;
  notes?: string | null;
}

export interface VehicleProfile {
  /** Must match the filename, e.g. "falcon-9" for falcon-9.json. */
  slug: string;
  name: string;
  entity_type: "vehicle";
  /** 2-4 sentence sourced overview; every claim backed by this field's source. */
  overview: SourcedField<string>;
  provider: SourcedField<string>;
  country: SourcedField<string>;
  /** e.g. "small", "medium", "heavy", "super-heavy". */
  vehicle_class: SourcedField<string>;
  payload_leo_kg: SourcedField<number>;
  reusable: SourcedField<boolean>;
  first_flight_date: SourcedField<string>;
  flights_total: SourcedField<number>;
  flights_successful: SourcedField<number>;
  last_flight_date: SourcedField<string>;
  next_flight_date: SourcedField<string>;
  status: SourcedField<string>;
  price_per_launch_usd: SourcedField<number>;
  notes?: string | null;
}

export const SPACEPORT_REGIONS = [
  "north-america",
  "south-america",
  "europe",
  "asia",
  "oceania",
  "middle-east",
] as const;
export type SpaceportRegion = (typeof SPACEPORT_REGIONS)[number];

export interface SpaceportProfile {
  /** Must match the filename. */
  slug: string;
  name: string;
  entity_type: "spaceport";
  /** Structural grouping for browsing, like domain on constellations. */
  region: SpaceportRegion;
  /** Launch Library 2 location id, linking Orbits ground markers back
   * to this profile; absent when LL2 has no matching location. */
  ll2_location_id?: SourcedField<number>;
  /** 2-4 sentence sourced overview. */
  overview: SourcedField<string>;
  country: SourcedField<string>;
  operator: SourcedField<string>;
  first_launch_date: SourcedField<string>;
  launches_total: SourcedField<number>;
  status: SourcedField<string>;
  website: SourcedField<string>;
  notes?: string | null;
}

export const ORG_KINDS = [
  "manufacturer",
  "launch-services",
  "in-space-services",
  "ground-segment",
  "institution",
  "finance",
] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export interface OrgProfile {
  /** Must match the filename. */
  slug: string;
  name: string;
  entity_type: "organization";
  /** Structural grouping for browsing. */
  kind: OrgKind;
  /** Sourced history timeline; absent until the Task 15 crawl fills it. */
  events?: TimelineEvent[];
  /** Stock listing as stated by the source, e.g. "Nasdaq: RKLB". */
  ticker?: SourcedField<string>;
  /** Chart-provider symbol for scripts/fetch-stocks.ts, e.g. "RKLB" or "7011.T". */
  stock_symbol?: string | null;
  /** 2-4 sentence sourced overview. */
  overview: SourcedField<string>;
  country: SourcedField<string>;
  founded: SourcedField<number>;
  focus: SourcedField<string>;
  status: SourcedField<string>;
  website: SourcedField<string>;
  notes?: string | null;
}

export type RegistryProfile = ConstellationProfile | VehicleProfile | SpaceportProfile | OrgProfile;

// --------------------------------------------------------------- orbits
//
// Static data files under public/data/orbits/, produced by the Orbits
// pipeline scripts (scripts/orbits/) on the 12-hour cron and consumed
// only by the /orbits page. The client never calls external APIs.

/**
 * The subset of CCSDS OMM fields that satellite.js json2satrec consumes.
 * CelesTrak GP JSON (FORMAT=JSON) carries exactly these; the fetch script
 * whitelists them so format drift upstream cannot bloat the files.
 */
export const OMM_STRING_FIELDS = [
  "OBJECT_NAME",
  "OBJECT_ID",
  "EPOCH",
  "CLASSIFICATION_TYPE",
] as const;
export const OMM_NUMBER_FIELDS = [
  "MEAN_MOTION",
  "ECCENTRICITY",
  "INCLINATION",
  "RA_OF_ASC_NODE",
  "ARG_OF_PERICENTER",
  "MEAN_ANOMALY",
  "EPHEMERIS_TYPE",
  "NORAD_CAT_ID",
  "ELEMENT_SET_NO",
  "REV_AT_EPOCH",
  "BSTAR",
  "MEAN_MOTION_DOT",
  "MEAN_MOTION_DDOT",
] as const;

export interface OmmRecord {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

/** elements-<constellation-slug>.json */
export interface OrbitsElementsFile {
  /** ISO datetime the elements were fetched from CelesTrak. */
  fetched_at: string;
  /** The exact CelesTrak query URL the records came from. */
  source: string;
  /** Registry constellation slug this file belongs to. */
  constellation: string;
  records: OmmRecord[];
}

/** One active launch site in spaceports.json, merged from LL2. */
export interface OrbitsSpaceport {
  /** Launch Library 2 location id. */
  ll2_id: number;
  name: string;
  country: string;
  lat: number;
  lon: number;
  total_launch_count: number;
  upcoming_count: number;
  next_launch: { name: string; vehicle: string; net: string } | null;
  /** Most recent past launch within the fetched window; null when the
   * site had none in the last ~100 global launches. */
  last_launch: { name: string; vehicle: string; net: string } | null;
  /** Rocket configurations launching from this site, deduped. */
  vehicles: string[];
  /** LL2 wiki/info URL where present. */
  info_url: string | null;
}

/** spaceports.json */
export interface OrbitsSpaceportsFile {
  fetched_at: string;
  source: string;
  spaceports: OrbitsSpaceport[];
}

export const FACILITY_TYPES = ["hq", "production", "test", "launch"] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

/**
 * One hand-curated ground pin in facilities.json. Editorial rule applies:
 * every entry needs a citable source_url; no source, no pin.
 */
export interface OrbitsFacility {
  name: string;
  /** Registry slug the pin links to (organization or constellation operator). */
  operator_slug: string;
  type: FacilityType;
  lat: number;
  lon: number;
  blurb: string;
  source_url: string;
}

/** facilities.json; maintained via the weekly registry workflow. */
export interface OrbitsFacilitiesFile {
  as_of: string;
  facilities: OrbitsFacility[];
}

/** One weekly bucket in the stats.json flow chart. */
export interface OrbitsWeekBucket {
  /** ISO date (UTC midnight) the 7-day bucket starts. */
  start: string;
  count: number;
}

/**
 * stats.json: the live-HUD metrics (6A design), computed on the
 * 12-hour cron from Launch Library 2 and the CelesTrak SATCAT.
 * Windows are 30 days for totals; the flow chart uses 4 weekly
 * buckets on each side of now.
 */
export interface OrbitsStatsFile {
  fetched_at: string;
  source: string;
  launched_30d: {
    total: number;
    failed: number;
    weekly: { start: string; launched: number; failed: number }[];
  };
  scheduled_30d: { total: number; weekly: OrbitsWeekBucket[] };
  deorbited_30d: { total: number; weekly: OrbitsWeekBucket[] };
  /** Launches per vehicle family over 180 days, ranked descending. */
  vehicles_6mo: { family: string; count: number }[];
  /** The next few scheduled launches, for the countdown and rollover. */
  upcoming: { name: string; vehicle: string; pad: string; net: string }[];
}

/**
 * stars.json: the Orbits star background, generated once by
 * scripts/orbits/build-stars.ts from the Yale Bright Star Catalog
 * (public domain). Committed, not on any cron: the catalog is J2000
 * and static.
 */
export interface OrbitsStarsFile {
  fetched_at: string;
  source: string;
  attribution: string;
  mag_limit: number;
  /** [ra_deg, dec_deg, vmag] per star. */
  stars: [number, number, number][];
}
