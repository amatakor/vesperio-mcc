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
