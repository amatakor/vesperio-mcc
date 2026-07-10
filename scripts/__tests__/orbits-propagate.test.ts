import { describe, expect, test } from "bun:test";
import { buildSatrecs, ecfToScene, propagateToScene, subpoint, orbitArcScene, orbitShellScene } from "../../src/orbits/propagate";
import { propagate } from "satellite.js";
import { EARTH_EQ_RADIUS_KM } from "../../src/orbits/types";
import type { OmmRecord } from "../../src/data/schema";

// Real records copied from public/data/orbits/elements-iceye.json
// (fetched_at 2026-07-05T12:48:00.609Z). Inlined so tests never touch
// the churning public/ data file.
const ICEYE_X2: OmmRecord = {
  OBJECT_NAME: "ICEYE-X2",
  OBJECT_ID: "2018-099AU",
  EPOCH: "2026-07-05T06:30:31.291200",
  CLASSIFICATION_TYPE: "U",
  MEAN_MOTION: 15.1796556,
  ECCENTRICITY: 0.00088284,
  INCLINATION: 97.4341,
  RA_OF_ASC_NODE: 239.7954,
  ARG_OF_PERICENTER: 232.4025,
  MEAN_ANOMALY: 127.6408,
  EPHEMERIS_TYPE: 0,
  NORAD_CAT_ID: 43800,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 41556,
  BSTAR: 0.0008232055,
  MEAN_MOTION_DOT: 0.00016695,
  MEAN_MOTION_DDOT: 0,
};

const ICEYE_X5: OmmRecord = {
  OBJECT_NAME: "ICEYE-X5",
  OBJECT_ID: "2019-038C",
  EPOCH: "2026-07-05T08:12:50.975424",
  CLASSIFICATION_TYPE: "U",
  MEAN_MOTION: 15.57013095,
  ECCENTRICITY: 0.00073692,
  INCLINATION: 97.8673,
  RA_OF_ASC_NODE: 242.8851,
  ARG_OF_PERICENTER: 176.3957,
  MEAN_ANOMALY: 183.7351,
  EPHEMERIS_TYPE: 0,
  NORAD_CAT_ID: 44389,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 38578,
  BSTAR: 0.00078864875,
  MEAN_MOTION_DOT: 0.00057213,
  MEAN_MOTION_DDOT: 0,
};

const ICEYE_X4: OmmRecord = {
  OBJECT_NAME: "ICEYE-X4",
  OBJECT_ID: "2019-038D",
  EPOCH: "2026-07-05T07:40:55.815744",
  CLASSIFICATION_TYPE: "U",
  MEAN_MOTION: 15.29721762,
  ECCENTRICITY: 0.00119914,
  INCLINATION: 97.8747,
  RA_OF_ASC_NODE: 220.3025,
  ARG_OF_PERICENTER: 234.7003,
  MEAN_ANOMALY: 125.3116,
  EPHEMERIS_TYPE: 0,
  NORAD_CAT_ID: 44390,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 38457,
  BSTAR: 0.00052958701,
  MEAN_MOTION_DOT: 0.00015211,
  MEAN_MOTION_DDOT: 0,
};

const GOOD_RECORDS: OmmRecord[] = [ICEYE_X2, ICEYE_X5, ICEYE_X4];

// Corrupt record: MEAN_MOTION as a string should make json2satrec throw
// or produce an unusable satrec, exercising the failure path.
const CORRUPT_RECORD = {
  ...ICEYE_X2,
  OBJECT_NAME: "ICEYE-CORRUPT",
  NORAD_CAT_ID: 99999,
  MEAN_MOTION: "not-a-number",
} as unknown as OmmRecord;

const LEO_MIN = 1.02;
const LEO_MAX = 1.3;

function radius(v: [number, number, number]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

describe("buildSatrecs", () => {
  test("builds one satrec per valid record, ids/names index-aligned", () => {
    const { satrecs, ids, names, failed } = buildSatrecs(GOOD_RECORDS);
    expect(satrecs).toHaveLength(3);
    expect(ids).toEqual([43800, 44389, 44390]);
    expect(names).toEqual(["ICEYE-X2", "ICEYE-X5", "ICEYE-X4"]);
    expect(failed).toBe(0);
  });

  test("skips a corrupt record and counts it as failed", () => {
    const { satrecs, ids, names, failed } = buildSatrecs([...GOOD_RECORDS, CORRUPT_RECORD]);
    expect(satrecs).toHaveLength(3);
    expect(ids).toEqual([43800, 44389, 44390]);
    expect(names).toEqual(["ICEYE-X2", "ICEYE-X5", "ICEYE-X4"]);
    expect(failed).toBe(1);
  });
});

describe("ecfToScene", () => {
  const R = EARTH_EQ_RADIUS_KM;
  const tol = 1e-9;

  test("x axis (lon 0) maps to scene [1, 0, 0]", () => {
    const [x, y, z] = ecfToScene({ x: R, y: 0, z: 0 });
    expect(x).toBeCloseTo(1, 9);
    expect(Math.abs(y)).toBeLessThan(tol);
    expect(Math.abs(z)).toBeLessThan(tol);
  });

  test("y axis (lon 90E) maps to scene [0, 0, -1]", () => {
    const [x, y, z] = ecfToScene({ x: 0, y: R, z: 0 });
    expect(Math.abs(x)).toBeLessThan(tol);
    expect(Math.abs(y)).toBeLessThan(tol);
    expect(z).toBeCloseTo(-1, 9);
  });

  test("z axis (north pole) maps to scene [0, 1, 0]", () => {
    const [x, y, z] = ecfToScene({ x: 0, y: 0, z: R });
    expect(Math.abs(x)).toBeLessThan(tol);
    expect(y).toBeCloseTo(1, 9);
    expect(Math.abs(z)).toBeLessThan(tol);
  });
});

describe("propagateToScene", () => {
  test("every satellite finite with radius in the LEO band at its own EPOCH", () => {
    const { satrecs } = buildSatrecs(GOOD_RECORDS);
    for (let i = 0; i < satrecs.length; i++) {
      const date = new Date(GOOD_RECORDS[i]!.EPOCH + "Z");
      const out = new Float32Array(3);
      propagateToScene([satrecs[i]!], date, out, 0);
      expect(Number.isFinite(out[0])).toBe(true);
      expect(Number.isFinite(out[1])).toBe(true);
      expect(Number.isFinite(out[2])).toBe(true);
      const r = radius([out[0]!, out[1]!, out[2]!]);
      expect(r).toBeGreaterThan(LEO_MIN);
      expect(r).toBeLessThan(LEO_MAX);
    }
  });

  test("writes at the given offset without touching earlier floats", () => {
    const { satrecs } = buildSatrecs(GOOD_RECORDS);
    const date = new Date(GOOD_RECORDS[0]!.EPOCH + "Z");
    const out = new Float32Array(6).fill(-999);
    propagateToScene([satrecs[0]!], date, out, 3);
    expect(out[0]).toBe(-999);
    expect(out[1]).toBe(-999);
    expect(out[2]).toBe(-999);
    expect(Number.isFinite(out[3])).toBe(true);
  });
});

describe("subpoint", () => {
  test("lat/lon/alt in range at EPOCH for every record", () => {
    const { satrecs } = buildSatrecs(GOOD_RECORDS);
    for (let i = 0; i < satrecs.length; i++) {
      const date = new Date(GOOD_RECORDS[i]!.EPOCH + "Z");
      const point = subpoint(satrecs[i]!, date);
      expect(point).not.toBeNull();
      expect(point!.lat).toBeGreaterThanOrEqual(-90);
      expect(point!.lat).toBeLessThanOrEqual(90);
      expect(point!.lon).toBeGreaterThanOrEqual(-180);
      expect(point!.lon).toBeLessThanOrEqual(180);
      expect(point!.altKm).toBeGreaterThan(200);
      expect(point!.altKm).toBeLessThan(2000);
    }
  });
});

describe("orbitArcScene", () => {
  test("129 samples, all finite, LEO band, closed-ish ellipse", () => {
    const { satrecs } = buildSatrecs([ICEYE_X2]);
    const date = new Date(ICEYE_X2.EPOCH + "Z");
    const arc = orbitArcScene(satrecs[0]!, date);
    expect(arc).not.toBeNull();
    const { positions, periodMin } = arc!;
    expect(positions).toHaveLength(129 * 3);
    expect(periodMin).toBeGreaterThan(0);

    for (let i = 0; i < positions.length; i++) {
      expect(Number.isFinite(positions[i])).toBe(true);
    }

    for (let i = 0; i < 129; i++) {
      const r = radius([positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!]);
      expect(r).toBeGreaterThan(LEO_MIN);
      expect(r).toBeLessThan(LEO_MAX);
    }

    const first: [number, number, number] = [positions[0]!, positions[1]!, positions[2]!];
    const lastIdx = (129 - 1) * 3;
    const last: [number, number, number] = [positions[lastIdx]!, positions[lastIdx + 1]!, positions[lastIdx + 2]!];
    const dist = Math.sqrt(
      (first[0] - last[0]) ** 2 + (first[1] - last[1]) ** 2 + (first[2] - last[2]) ** 2,
    );
    expect(dist).toBeLessThan(0.25);
  });
});

describe("orbitShellScene", () => {
  test("the satellite's now-position lies on its sampled ring (the focus-shell invariant)", () => {
    const { satrecs } = buildSatrecs([ICEYE_X2]);
    // Evaluate 3 days after epoch: far enough for J2 nodal regression to
    // pull a two-body-at-epoch ellipse visibly off the SGP4 dot, which is
    // the bug this sampler replaces.
    const date = new Date(new Date(ICEYE_X2.EPOCH + "Z").getTime() + 3 * 86_400_000);
    const segs = orbitShellScene(satrecs, date);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.length % 6).toBe(0); // whole line segments only

    // Dot position, same convention the shell uses (ECI, no GMST bake).
    const pv = propagate(satrecs[0]!, date);
    const dot = ecfToScene(pv!.position as { x: number; y: number; z: number });

    // Min distance from the dot to any segment endpoint: with 64 samples a
    // LEO ring's inter-sample gap is ~600 km, so on-ring means well under
    // half that. The old two-body ellipse missed by 100-400 km sideways
    // PLUS sat-to-sample distance; this bound catches that regression.
    let min = Infinity;
    for (let i = 0; i < segs.length; i += 3) {
      const d = Math.sqrt(
        (segs[i]! - dot[0]) ** 2 + (segs[i + 1]! - dot[1]) ** 2 + (segs[i + 2]! - dot[2]) ** 2,
      );
      if (d < min) min = d;
    }
    const kmPerUnit = EARTH_EQ_RADIUS_KM;
    expect(min * kmPerUnit).toBeLessThan(350); // < half the inter-sample gap
  });
});
