import { describe, expect, test } from "bun:test";
import { planElementQueries, splitRecords, stripOmm, buildSpaceports } from "../orbits/lib";
import type { OmmRecord } from "../../src/data/schema";

const omm = (name: string, catId: number, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  OBJECT_NAME: name,
  OBJECT_ID: "2018-004A",
  EPOCH: "2026-07-05T04:31:12.345678",
  MEAN_MOTION: 15.1,
  ECCENTRICITY: 0.0001,
  INCLINATION: 97.7,
  RA_OF_ASC_NODE: 120.1,
  ARG_OF_PERICENTER: 30.2,
  MEAN_ANOMALY: 300.3,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: "U",
  NORAD_CAT_ID: catId,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 12345,
  BSTAR: 0.0001,
  MEAN_MOTION_DOT: 0.00001,
  MEAN_MOTION_DDOT: 0,
  ...extra,
});

describe("planElementQueries", () => {
  test("dedupes a shared group into one query with sorted targets", () => {
    const plan = planElementQueries([
      { slug: "skysat", orbits: { celestrak_group: "planet", celestrak_name: null, name_pattern: "^SKYSAT" } },
      { slug: "superdove", orbits: { celestrak_group: "planet", celestrak_name: null, name_pattern: "^FLOCK" } },
      { slug: "iceye", orbits: { celestrak_group: null, celestrak_name: "ICEYE", name_pattern: "^ICEYE" } },
      { slug: "planet", orbits: null },
    ]);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toEqual({
      query: "GROUP=planet",
      targets: [
        { slug: "skysat", pattern: "^SKYSAT" },
        { slug: "superdove", pattern: "^FLOCK" },
      ],
    });
    expect(plan[1]!.query).toBe("NAME=ICEYE");
  });

  test("skips constellations without a mapping", () => {
    expect(planElementQueries([{ slug: "lightspeed", orbits: null }, { slug: "x" }])).toEqual([]);
  });
});

describe("stripOmm", () => {
  test("whitelists to the json2satrec field set", () => {
    const res = stripOmm(omm("ICEYE-X44", 55555, { MEAN_ELEMENT_THEORY: "SGP4", ORIGINATOR: "CELESTRAK" }));
    if ("error" in res) throw new Error(res.error);
    expect(Object.keys(res.record)).not.toContain("MEAN_ELEMENT_THEORY");
    expect(Object.keys(res.record)).not.toContain("ORIGINATOR");
    expect(res.record.NORAD_CAT_ID).toBe(55555);
  });

  test("rejects records missing a required field", () => {
    const bad = omm("ICEYE-X44", 55555);
    delete bad.BSTAR;
    const res = stripOmm(bad);
    expect("error" in res && res.error).toContain("BSTAR");
  });

  test("rejects mistyped numerics", () => {
    const res = stripOmm(omm("ICEYE-X44", 55555, { MEAN_MOTION: "15.1" }));
    expect("error" in res && res.error).toContain("MEAN_MOTION");
  });
});

describe("splitRecords", () => {
  const records = [
    omm("SKYSAT-C13", 3),
    omm("FLOCK 4X-1", 2),
    omm("PELICAN-2", 1),
  ] as unknown as OmmRecord[];

  test("routes records to targets by pattern, sorted by catalog number", () => {
    const split = splitRecords(records, [
      { slug: "skysat", pattern: "^SKYSAT" },
      { slug: "superdove", pattern: "^FLOCK" },
      { slug: "pelican", pattern: "^PELICAN" },
    ]);
    expect(split.get("skysat")!.map((r) => r.OBJECT_NAME)).toEqual(["SKYSAT-C13"]);
    expect(split.get("superdove")!.map((r) => r.OBJECT_NAME)).toEqual(["FLOCK 4X-1"]);
    expect(split.get("pelican")!.map((r) => r.OBJECT_NAME)).toEqual(["PELICAN-2"]);
  });

  test("null pattern keeps everything", () => {
    const split = splitRecords(records, [{ slug: "starlink", pattern: null }]);
    expect(split.get("starlink")!.map((r) => r.NORAD_CAT_ID)).toEqual([1, 2, 3]);
  });
});

describe("buildSpaceports", () => {
  const loc = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    country: { name: "United States of America" },
    latitude: "28.5",
    longitude: -80.6,
    total_launch_count: 42,
    ...extra,
  });
  const launch = (locId: number, vehicle: string, net: string, name = `${vehicle} | Mission`) => ({
    name,
    net,
    rocket: { configuration: { name: vehicle, full_name: vehicle } },
    pad: { location: { id: locId } },
  });

  test("keeps sites with an active pad or an upcoming launch, drops the rest", () => {
    const { spaceports } = buildSpaceports({
      locations: [loc(1, "Cape"), loc(2, "Dormant"), loc(3, "Upcoming-only")],
      pads: [{ active: true, location: { id: 1 } }, { active: false, location: { id: 2 } }],
      upcoming: [launch(3, "Vega C", "2026-08-01T00:00:00Z")],
      previous: [],
    });
    expect(spaceports.map((s) => s.ll2_id).sort()).toEqual([1, 3]);
  });

  test("computes next launch, upcoming count, and merged vehicles", () => {
    const { spaceports } = buildSpaceports({
      locations: [loc(1, "Cape")],
      pads: [{ active: true, location: { id: 1 }, wiki_url: "https://example.com/cape" }],
      upcoming: [
        launch(1, "Falcon 9 Block 5", "2026-09-01T00:00:00Z"),
        launch(1, "Vulcan VC4S", "2026-07-10T12:00:00Z", "Vulcan | USSF-106"),
      ],
      previous: [launch(1, "Atlas V 551", "2026-06-01T00:00:00Z")],
    });
    const cape = spaceports[0]!;
    expect(cape.upcoming_count).toBe(2);
    expect(cape.next_launch).toEqual({
      name: "Vulcan | USSF-106",
      vehicle: "Vulcan VC4S",
      net: "2026-07-10T12:00:00Z",
    });
    expect(cape.vehicles).toEqual(["Atlas V 551", "Falcon 9 Block 5", "Vulcan VC4S"]);
    expect(cape.last_launch).toEqual({
      name: "Atlas V 551 | Mission",
      vehicle: "Atlas V 551",
      net: "2026-06-01T00:00:00Z",
    });
    expect(cape.info_url).toBe("https://example.com/cape");
    expect(cape.lat).toBe(28.5);
    expect(cape.country).toBe("United States of America");
  });

  test("skips locations with unusable coordinates and reports them", () => {
    const { spaceports, errors } = buildSpaceports({
      locations: [loc(1, "Nowhere", { latitude: null, longitude: null })],
      pads: [{ active: true, location: { id: 1 } }],
      upcoming: [],
      previous: [],
    });
    expect(spaceports).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});
