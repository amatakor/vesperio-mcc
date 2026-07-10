/**
 * Shared contracts for the Orbits data layer: the worker protocol, the
 * scene coordinate convention, and the category color mapping. Pure
 * types and constants; no three.js, no DOM, importable from workers,
 * tests, and the render thread alike.
 *
 * Scene convention: globe radius 1 = Earth's equatorial radius. ECEF km
 * map to scene as (x, y, z) -> (X, Z, -Y) / EARTH_EQ_RADIUS_KM, which
 * matches latLonToVec3 in scene.tsx (x toward lon 0, y toward the north
 * pole, z toward lon 90W).
 */

import type { ConstellationDomain, OmmRecord } from "../data/schema";

export const EARTH_EQ_RADIUS_KM = 6378.137;

/** Worker snapshot cadence; the render thread interpolates between two. */
export const SNAPSHOT_CADENCE_MS = 1000;

/** Elements older than this show the stale-data HUD notice (spec 6). */
export const STALE_AFTER_DAYS = 7;

// ------------------------------------------------- worker protocol

export type WorkerIn =
  | { type: "load"; slug: string; records: OmmRecord[] }
  | { type: "enable"; slugs: string[] }
  | { type: "watch"; id: number | null }
  | { type: "arc"; id: number }
  | { type: "shell"; slugs: string[] }
  | { type: "cadence"; ms: number };

/** Render order and identity of one enabled constellation's satellites. */
export interface LayoutEntry {
  slug: string;
  /** NORAD_CAT_ID per satellite, in the exact order positions are written. */
  ids: number[];
  /** OBJECT_NAME per satellite, same order. */
  names: string[];
}

export type WorkerOut =
  | { type: "loaded"; slug: string; count: number; failed: number }
  | { type: "layout"; order: LayoutEntry[] }
  /** positions: Float32Array buffer, 3 floats per satellite in layout
   * order (scene units); NaN triple = propagation failed this tick. */
  | { type: "snapshot"; time: number; positions: ArrayBuffer }
  | { type: "watch"; id: number; lat: number; lon: number; altKm: number }
  /** positions: Float32Array buffer of one closed orbit, 3 floats per
   * sample, in the earth-fixed frame of the request time. */
  | { type: "arc"; id: number; positions: ArrayBuffer; periodMin: number }
  /** positions: Float32Array line-segment buffer (x,y,z vertex pairs) of
   * every SGP4-sampled orbit in one focused constellation, ECI frame. */
  | { type: "shell"; slug: string; positions: ArrayBuffer };

// ------------------------------------------------- category colors

/** Registry domain -> shared neon theme token (spec 3, criterion 8). */
export const CATEGORY_TOKENS: Record<ConstellationDomain, string> = {
  eo: "--neon-eo",
  connectivity: "--neon-connectivity",
  iot: "--neon-iot",
  "human-spaceflight": "--neon-hsf",
  navigation: "--neon-nav",
};

/** Anything uncategorized, and ground-marker hover/selection accents. */
export const RESERVE_TOKEN = "--neon-reserve";

export const CATEGORY_ORDER: ConstellationDomain[] = [
  "eo",
  "connectivity",
  "iot",
  "human-spaceflight",
  "navigation",
];
