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

export const IMPACTS = ["critical", "notable", "routine"] as const;
export type Impact = (typeof IMPACTS)[number];

/**
 * The source ladder, best to weakest. confirmed = primary source
 * (the actor or an official record); reported = credible trade press,
 * outlet named in the copy; signal = Signals-list individual or named
 * executive on social, flagged "unconfirmed" in the copy.
 */
export const CONFIDENCES = ["confirmed", "reported", "signal"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

/**
 * Seed tags in four tiers. Reuse before inventing new ones; new tags
 * stay lowercase and are logged in the sweep entry for review.
 * Domain tags: every item carries one where applicable.
 */
export const DOMAIN_TAGS = ["eo", "connectivity", "launch", "human-spaceflight"] as const;

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
  /** Primary (tier-1) source. Required. */
  source_url: string;
  secondary_urls: string[];
  confidence: Confidence;
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

// ------------------------------------------------------------- registry

/**
 * Every registry fact is a SourcedField: value, where it came from, and
 * when it was last verified. Unknown stays null; never estimate.
 */
export interface SourcedField<T> {
  value: T | null;
  source: string | null;
  /** YYYY-MM-DD the value was last verified against the source. */
  as_of: string | null;
}

export const CONSTELLATION_DOMAINS = ["eo", "connectivity"] as const;
export type ConstellationDomain = (typeof CONSTELLATION_DOMAINS)[number];

export interface ConstellationProfile {
  /** Must match the filename, e.g. "iceye" for iceye.json. */
  slug: string;
  name: string;
  entity_type: "constellation";
  domain: ConstellationDomain;
  operator: SourcedField<string>;
  country: SourcedField<string>;
  /** EO sensor modality/ies, e.g. ["sar"]; null for connectivity. */
  sensor_types: SourcedField<string[]>;
  sats_on_orbit: SourcedField<number>;
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

export type RegistryProfile = ConstellationProfile | VehicleProfile;
