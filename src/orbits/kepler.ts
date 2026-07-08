/**
 * Whole-constellation orbit shells: one closed ellipse per satellite,
 * drawn from the OMM mean elements directly (no SGP4; the two-body
 * ellipse stays within a few km of the propagated track, plenty for a
 * shell rendered under the live dots). Ellipses are emitted in the
 * inertial (ECI) frame; the scene wraps the shell group in a live
 * -GMST(now) rotation so the shell earth-fixes exactly like the ECEF
 * satellite dots and never drifts off them (Florian 2026-07-07).
 *
 * Pure math, no three.js, bun-testable.
 */

import type { OmmRecord } from "../data/schema";
import { EARTH_EQ_RADIUS_KM } from "./types";

const MU_KM3_S2 = 398600.4418;

/** Cap per constellation; beyond this the shell samples evenly. */
export const MAX_SHELL_ORBITS = 1500;

/**
 * Line-segment vertices (x,y,z pairs per segment) for every orbit in
 * `records`, in scene units, in the inertial (ECI) frame. The caller
 * rotates the shell group by -GMST(now) each frame to earth-fix it.
 */
export function orbitShellSegments(
  records: OmmRecord[],
  samplesPerOrbit = 64,
): Float32Array {
  const stride = records.length > MAX_SHELL_ORBITS ? records.length / MAX_SHELL_ORBITS : 1;
  const picked: OmmRecord[] = [];
  for (let f = 0; f < records.length; f += stride) picked.push(records[Math.floor(f)]!);

  const out = new Float32Array(picked.length * samplesPerOrbit * 2 * 3);
  let w = 0;
  const rad = Math.PI / 180;

  for (const r of picked) {
    // Semi-major axis from mean motion (rev/day).
    const nRadS = (r.MEAN_MOTION * 2 * Math.PI) / 86400;
    const a = Math.cbrt(MU_KM3_S2 / (nRadS * nRadS));
    const e = r.ECCENTRICITY;
    const inc = r.INCLINATION * rad;
    const raan = r.RA_OF_ASC_NODE * rad;
    const argp = r.ARG_OF_PERICENTER * rad;

    const cosO = Math.cos(raan);
    const sinO = Math.sin(raan);
    const cosI = Math.cos(inc);
    const sinI = Math.sin(inc);
    const cosW = Math.cos(argp);
    const sinW = Math.sin(argp);

    // Perifocal -> ECI rotation, Rz(raan) Rx(inc) Rz(argp).
    const r11 = cosO * cosW - sinO * sinW * cosI;
    const r12 = -cosO * sinW - sinO * cosW * cosI;
    const r21 = sinO * cosW + cosO * sinW * cosI;
    const r22 = -sinO * sinW + cosO * cosW * cosI;
    const r31 = sinW * sinI;
    const r32 = cosW * sinI;

    let prev: [number, number, number] | null = null;
    let first: [number, number, number] | null = null;
    for (let s = 0; s < samplesPerOrbit; s++) {
      // Uniform eccentric anomaly closes the ellipse without a Kepler solve.
      const E = (s / samplesPerOrbit) * 2 * Math.PI;
      const xp = a * (Math.cos(E) - e);
      const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

      const xi = r11 * xp + r12 * yp;
      const yi = r21 * xp + r22 * yp;
      const zi = r31 * xp + r32 * yp;

      // ECI -> scene units (x, z, -y); the -GMST(now) group rotation in
      // the scene earth-fixes this to match the live ECEF dots.
      const point: [number, number, number] = [
        xi / EARTH_EQ_RADIUS_KM,
        zi / EARTH_EQ_RADIUS_KM,
        -yi / EARTH_EQ_RADIUS_KM,
      ];

      if (prev) {
        out[w++] = prev[0];
        out[w++] = prev[1];
        out[w++] = prev[2];
        out[w++] = point[0];
        out[w++] = point[1];
        out[w++] = point[2];
      } else {
        first = point;
      }
      prev = point;
    }
    if (prev && first) {
      out[w++] = prev[0];
      out[w++] = prev[1];
      out[w++] = prev[2];
      out[w++] = first[0];
      out[w++] = first[1];
      out[w++] = first[2];
    }
  }
  return out;
}

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
