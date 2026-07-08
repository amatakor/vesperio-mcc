/**
 * Pure orbital math for the Orbits worker: SGP4 propagation via
 * satellite.js, plus the ECEF -> scene-unit coordinate mapping shared
 * with the render thread (see src/orbits/types.ts for the convention).
 *
 * No DOM, no three.js, no self/postMessage. Safe to unit test under
 * bun:test and safe to import from the worker.
 */

import { json2satrec, propagate, gstime, eciToEcf, eciToGeodetic, degreesLat, degreesLong } from "satellite.js";
import type { SatRec } from "satellite.js";
import type { OmmRecord } from "../data/schema";
import { EARTH_EQ_RADIUS_KM } from "./types";

/** Alias for the satellite.js SatRec shape; kept local so callers don't
 * need to know the exact library type name. */
export type SatRecLike = SatRec;

export interface BuiltSatrecs {
  satrecs: SatRecLike[];
  /** NORAD_CAT_ID per satrec, index-aligned with satrecs. */
  ids: number[];
  /** OBJECT_NAME per satrec, index-aligned with satrecs. */
  names: string[];
  /** Count of records that failed to build a SatRec and were skipped. */
  failed: number;
}

/** Build SatRecs from OMM records, skipping and counting any that fail. */
export function buildSatrecs(records: OmmRecord[]): BuiltSatrecs {
  const satrecs: SatRecLike[] = [];
  const ids: number[] = [];
  const names: string[] = [];
  let failed = 0;

  for (const record of records) {
    try {
      const satrec = json2satrec(record as unknown as Parameters<typeof json2satrec>[0]);
      if (!satrec || satrec.error || !Number.isFinite(meanMotion(satrec))) {
        failed += 1;
        continue;
      }
      satrecs.push(satrec);
      ids.push(record.NORAD_CAT_ID);
      names.push(record.OBJECT_NAME);
    } catch {
      failed += 1;
    }
  }

  return { satrecs, ids, names, failed };
}

/**
 * ECEF km -> scene units. Globe radius 1 = Earth's equatorial radius.
 * (x, y, z) -> (x, z, -y) / R: x toward lon 0, y toward the north pole,
 * z toward lon 90W. Matches latLonToVec3 in scene.tsx.
 */
export function ecfToScene(ecf: { x: number; y: number; z: number }): [number, number, number] {
  const r = EARTH_EQ_RADIUS_KM;
  return [ecf.x / r, ecf.z / r, -ecf.y / r];
}

/** Mean motion in rad/min, tolerating older field naming. */
function meanMotion(satrec: SatRecLike): number {
  const withKozai = satrec as unknown as { no?: number; no_kozai?: number };
  return withKozai.no ?? withKozai.no_kozai ?? NaN;
}

/**
 * Propagate every satrec at `date` and write scene-unit positions into
 * `out` starting at `offset` floats, 3 floats per satellite. Failures
 * (bad propagation, non-finite results) are written as NaN,NaN,NaN so
 * the render thread can skip that point without misaligning the buffer.
 */
export function propagateToScene(satrecs: SatRecLike[], date: Date, out: Float32Array, offset: number): void {
  const gmst = gstime(date);

  for (let i = 0; i < satrecs.length; i++) {
    const base = offset + i * 3;
    const satrec = satrecs[i]!;
    try {
      const pv = propagate(satrec, date);
      const position = pv && pv.position;
      if (!position || typeof position !== "object") {
        out[base] = NaN;
        out[base + 1] = NaN;
        out[base + 2] = NaN;
        continue;
      }
      const ecf = eciToEcf(position, gmst);
      const [x, y, z] = ecfToScene(ecf);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        out[base] = NaN;
        out[base + 1] = NaN;
        out[base + 2] = NaN;
        continue;
      }
      out[base] = x;
      out[base + 1] = y;
      out[base + 2] = z;
    } catch {
      out[base] = NaN;
      out[base + 1] = NaN;
      out[base + 2] = NaN;
    }
  }
}

/** Geodetic subpoint (degrees) and altitude (km) at `date`; null on failure. */
export function subpoint(satrec: SatRecLike, date: Date): { lat: number; lon: number; altKm: number } | null {
  try {
    const pv = propagate(satrec, date);
    const position = pv && pv.position;
    if (!position || typeof position !== "object") return null;
    const gmst = gstime(date);
    const geo = eciToGeodetic(position, gmst);
    const lat = degreesLat(geo.latitude);
    const lon = degreesLong(geo.longitude);
    const altKm = geo.height;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altKm)) return null;
    return { lat, lon, altKm };
  } catch {
    return null;
  }
}

export interface OrbitArc {
  /** 3 floats per sample, in the inertial (ECI) frame. */
  positions: Float32Array;
  periodMin: number;
}

/**
 * One closed orbital revolution as scene-unit points, sampled across
 * [date - T/2, date + T/2] where T is the orbital period, emitted in
 * the inertial (ECI) frame (no GMST bake). The scene rotates the arc
 * group by -GMST(now) each frame so the arc earth-fixes exactly like
 * the live ECEF dots and the satellite stays glued to it as time
 * advances (Florian 2026-07-07). Failed samples are filled by copying
 * the previous sample so the line stays continuous; null if more than
 * 10% of samples fail.
 */
export function orbitArcScene(satrec: SatRecLike, date: Date, samples = 129): OrbitArc | null {
  const n = meanMotion(satrec);
  if (!Number.isFinite(n) || n <= 0) return null;

  const periodMin = (2 * Math.PI) / n;
  const halfMs = (periodMin * 60_000) / 2;
  const startMs = date.getTime() - halfMs;
  const stepMs = samples > 1 ? (halfMs * 2) / (samples - 1) : 0;

  const positions = new Float32Array(samples * 3);
  let failures = 0;
  let havePrev = false;

  for (let i = 0; i < samples; i++) {
    const base = i * 3;
    const t = new Date(startMs + stepMs * i);
    let ok = false;
    try {
      const pv = propagate(satrec, t);
      const position = pv && pv.position;
      if (position && typeof position === "object") {
        const [x, y, z] = ecfToScene(position);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
          positions[base] = x;
          positions[base + 1] = y;
          positions[base + 2] = z;
          ok = true;
        }
      }
    } catch {
      ok = false;
    }

    if (!ok) {
      failures += 1;
      if (havePrev) {
        positions[base] = positions[base - 3]!;
        positions[base + 1] = positions[base - 2]!;
        positions[base + 2] = positions[base - 1]!;
      } else {
        positions[base] = NaN;
        positions[base + 1] = NaN;
        positions[base + 2] = NaN;
      }
    } else {
      havePrev = true;
    }
  }

  if (failures / samples > 0.1) return null;

  // Backfill any leading failures (no previous sample existed yet) now
  // that we know a later good sample exists, so the line has no NaNs.
  if (!Number.isFinite(positions[0]!)) {
    let firstGood = -1;
    for (let i = 0; i < samples; i++) {
      if (Number.isFinite(positions[i * 3]!)) {
        firstGood = i;
        break;
      }
    }
    if (firstGood === -1) return null;
    for (let i = 0; i < firstGood; i++) {
      positions[i * 3] = positions[firstGood * 3]!;
      positions[i * 3 + 1] = positions[firstGood * 3 + 1]!;
      positions[i * 3 + 2] = positions[firstGood * 3 + 2]!;
    }
  }

  return { positions, periodMin };
}
