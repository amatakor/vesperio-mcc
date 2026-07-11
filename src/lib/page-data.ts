/**
 * Per-page data contract between the prerenderer and the client.
 *
 * Every prerendered page embeds exactly the data IT needs as a JSON
 * script tag (#__MCC_DATA__); main.tsx parses it and App renders from
 * it. This file is CLIENT-SAFE: types, constants, and pure helpers
 * only, no dataset imports (the builders that slice the dataset live in
 * lib/page-data-server.ts).
 */

import type {
  Item,
  SweepLogEntry,
  LedgerSource,
  ConstellationProfile,
  VehicleProfile,
  SpaceportProfile,
  OrgProfile,
  SignalsFile,
} from "../data/schema";
import type { CalibrationBucket } from "../../scripts/snr/ledger";
import type { HeroStats, StatBlock } from "./stats";
import type { RegEntry } from "./reg-entries";
import type { LogKpis, PresenceRow } from "./log-kpis";

/** Feed-wide counts the home filter bar shows (computed at prerender). */
export interface FeedCounts {
  categories: Record<string, number>;
  domains: Record<string, number>;
  total: number;
}

/** Compact item reference a profile's events list renders. */
export interface ProfileEventRef {
  id: string;
  impact: Item["impact"];
  date: string;
  headline: string;
}

/** Lowercased org display name -> profile href (for entityHrefFor). */
export type OrgHrefs = Record<string, string>;

/** Compact item reference the weekly digest lists per importance tier. */
export interface DigestItemRef {
  id: string;
  headline: string;
  tagline: string;
  date: string;
  category: string;
}

/** One SNR movement the digest surfaces from the week's sweeps. */
export interface DigestMovement {
  id: string;
  from: number;
  to: number;
  reason: string;
}

/** A zero-add ("quiet") sweep in the digest window, with its summary. */
export interface DigestQuietSweep {
  at: string;
  summary: string;
}

export type PageData =
  | { page: "home"; items: Item[]; pageCount: number; counts: FeedCounts }
  | { page: "feed-page"; n: number; items: Item[]; pageCount: number; counts: FeedCounts }
  | { page: "item"; item: Item }
  | { page: "category"; category: string; items: Item[] }
  | { page: "tag"; tag: string; items: Item[] }
  | { page: "kind"; kind: string; items: Item[] }
  | {
      page: "registry";
      entries: {
        constellations: RegEntry[];
        vehicles: RegEntry[];
        spaceports: RegEntry[];
        orgs: RegEntry[];
      };
      orgHrefs: OrgHrefs;
    }
  | {
      page: "constellation";
      profile: ConstellationProfile;
      events: ProfileEventRef[];
      /** Full child profiles (fleet sub-constellations); small set. */
      children: ConstellationProfile[];
      parent: { slug: string; name: string } | null;
      siblings: { slug: string; name: string; affiliation: string | null }[];
      orgHrefs: OrgHrefs;
    }
  | {
      page: "vehicle";
      profile: VehicleProfile;
      events: ProfileEventRef[];
      siblings: { slug: string; name: string; affiliation: string | null }[];
      orgHrefs: OrgHrefs;
    }
  | {
      page: "spaceport";
      profile: SpaceportProfile;
      events: ProfileEventRef[];
      siblings: { slug: string; name: string; affiliation: string | null }[];
      orgHrefs: OrgHrefs;
    }
  | {
      page: "org";
      profile: OrgProfile;
      events: ProfileEventRef[];
      vehicleRoster: { slug: string; name: string; status: string | null }[];
      siblings: { slug: string; name: string; affiliation: string | null }[];
      orgHrefs: OrgHrefs;
    }
  | {
      page: "signals";
      people: SignalsFile["people"];
      outlets: SignalsFile["outlets"];
      avatars: Record<string, string>;
    }
  | {
      /**
       * The merged /system/ page (Florian, 2026-07-11): the sweep log (the
       * spine) plus the public stat indices (the rail). Carries both the
       * former "log" and "stats" data slices; SystemPage lays them out.
       */
      page: "system";
      // --- stats rail ---
      hero: HeroStats;
      blocks: StatBlock[];
      // --- log spine ---
      sweeps: SweepLogEntry[];
      /** Lifetime counters over ALL sweeps (the window shows a subset). */
      totals: { added: number; updated: number; held: number; count: number };
      ledgerSources: LedgerSource[];
      calibrationBuckets: CalibrationBucket[];
      archiveMonths: string[];
      /** Sources currently dead or stale (Phase 5): the honest gap list. */
      sourceProblems: { name: string; status: "dead" | "stale" }[];
      /** Trailing-30-day KPIs (Phase 7), computed server-side. */
      kpis: LogKpis;
      /** Lead-source presence over the same window, full sorted list. */
      presence: PresenceRow[];
    }
  | { page: "log-archive"; month: string; sweeps: SweepLogEntry[] }
  | {
      page: "orbits";
      /** Compact lookups for linking LL2 launches to items/vehicles. */
      linkItems: { id: string; headline: string; tagline: string }[];
      vehicleLinks: { name: string; slug: string }[];
    }
  | { page: "about" }
  | { page: "methodology" }
  | {
      page: "digest";
      windowDays: number;
      /** Inclusive event-date range of the window, YYYY-MM-DD. */
      from: string;
      to: string;
      seismic: DigestItemRef[];
      major: DigestItemRef[];
      notable: DigestItemRef[];
      movements: DigestMovement[];
      quietSweeps: DigestQuietSweep[];
    }
  | { page: "not-found" };

/** Items per prerendered feed page (plan: 30-50; 50 keeps page count low). */
export const FEED_PAGE_SIZE = 50;

/** /log shows sweeps this recent; older ones move to monthly archive pages. */
export const LOG_WINDOW_DAYS = 90;

export function feedPageCount(totalItems: number): number {
  return Math.max(1, Math.ceil(totalItems / FEED_PAGE_SIZE));
}

/**
 * Splits sweep entries into the /log window and the archive tail.
 * Reference time defaults to now (the prerender moment); deterministic
 * given (sweeps, now).
 */
export function splitLogWindow(
  sweeps: SweepLogEntry[],
  now: Date = new Date(),
): { recent: SweepLogEntry[]; archived: SweepLogEntry[]; archiveMonths: string[] } {
  const cutoff = new Date(now.getTime() - LOG_WINDOW_DAYS * 86_400_000).toISOString();
  const recent: SweepLogEntry[] = [];
  const archived: SweepLogEntry[] = [];
  for (const s of sweeps) (s.at >= cutoff ? recent : archived).push(s);
  const archiveMonths = [...new Set(archived.map((s) => s.at.slice(0, 7)))].sort().reverse();
  return { recent, archived, archiveMonths };
}

export function logArchiveMonths(sweeps: SweepLogEntry[], now: Date = new Date()): string[] {
  return splitLogWindow(sweeps, now).archiveMonths;
}
