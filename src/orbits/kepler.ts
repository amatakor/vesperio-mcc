/**
 * Kepler-derived scene helpers from OMM mean elements. The orbit SHELLS
 * that used to live here (two-body ellipses) were retired 2026-07-10:
 * they froze RAAN at the element-set epoch and drifted off stale-epoch
 * dots, so both scenes now render SGP4-sampled shells from the worker
 * (orbitShellScene in propagate.ts). What remains is pure element math.
 *
 * Pure math, no three.js, bun-testable.
 */

import type { OmmRecord } from "../data/schema";
import { EARTH_EQ_RADIUS_KM } from "./types";

const MU_KM3_S2 = 398600.4418;

/** Cap per constellation; beyond this the shell sampler strides evenly. */
export const MAX_SHELL_ORBITS = 1500;

/** Largest apogee among records, in scene units (globe radius = 1). */
export function maxApogeeSceneUnits(records: OmmRecord[]): number {
  let max = 0;
  for (const r of records) {
    const nRadS = (r.MEAN_MOTION * 2 * Math.PI) / 86400;
    const a = Math.cbrt(MU_KM3_S2 / (nRadS * nRadS));
    const apogee = (a * (1 + r.ECCENTRICITY)) / EARTH_EQ_RADIUS_KM;
    if (apogee > max) max = apogee;
  }
  return max;
}

// ----------------------------------------------------- ground stations
//
// The ground-station receiving cones (ground.tsx) are station-centric and
// constellation-agnostic (Florian 2026-07-11, replacing the old
// per-constellation footprint rings): apex at the station, axis along the
// local vertical, half-angle (90 - epsilon). They scale km to globe units
// against the mean Earth radius (globe radius 1 = 6371 km), so that
// reference lives here as its own constant and is never inferred from the
// equatorial radius the scene projection uses.

/** Mean Earth radius for ground-station geometry, km (globe radius 1).
 * The minimum-elevation default lives with the rest of the cone defaults
 * in ground.tsx (CONE_DEFAULTS). */
export const FOOTPRINT_EARTH_R_KM = 6371;
