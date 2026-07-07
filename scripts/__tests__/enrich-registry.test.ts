/**
 * Unit tests for the deterministic enrichment merge logic
 * (scripts/enrich-registry.ts): null-fill-only guarantees, LL2 config id
 * extraction, date normalization, and GCAT orgs table parsing.
 */

import { describe, expect, test } from "bun:test";
import {
  isNull,
  fillAggregator,
  ll2ConfigId,
  isoDay,
  parseGcatOrgs,
  GCAT_ATTRIBUTION,
} from "../enrich-registry";

type Obj = Record<string, unknown>;

function profile(): Obj {
  return {
    slug: "test-vehicle",
    name: "Test Vehicle",
    entity_type: "vehicle",
    provider: {
      value: "TestCo",
      source: "https://ll.thespacedevs.com/2.2.0/config/launcher/26/",
      as_of: "2026-07-05",
    },
    flights_total: { value: null, source: null, as_of: null },
    first_flight_date: { value: "2020-01-01", source: "https://x.example", as_of: "2026-07-05" },
  };
}

describe("isNull", () => {
  test("null value, empty array, and filled fields", () => {
    const p = profile();
    expect(isNull(p, "flights_total")).toBe(true);
    expect(isNull(p, "first_flight_date")).toBe(false);
    expect(isNull(p, "not_a_field")).toBe(false); // structurally absent: not ours to add
    expect(isNull({ sensor_types: { value: [], source: null, as_of: null } }, "sensor_types")).toBe(true);
  });
});

describe("fillAggregator (null-fill only, never overwrite)", () => {
  test("fills a null field with SNR 4 canonical and a trace", () => {
    const p = profile();
    const ok = fillAggregator(p, "flights_total", 42, "https://ll.example/query", "2026-07-08", "LL2");
    expect(ok).toBe(true);
    const f = p.flights_total as Obj;
    expect(f.value).toBe(42);
    expect(f.snr).toBe(4);
    expect(f.tier).toBe("canonical");
    expect((f.snr_trace as Obj).final).toBe(4);
    expect(f.as_of).toBe("2026-07-08");
  });

  test("refuses to overwrite a filled field", () => {
    const p = profile();
    const before = JSON.stringify(p.first_flight_date);
    expect(fillAggregator(p, "first_flight_date", "2021-01-01", "https://x", "2026-07-08", "r")).toBe(false);
    expect(JSON.stringify(p.first_flight_date)).toBe(before);
  });

  test("refuses to fill with a null value", () => {
    const p = profile();
    expect(fillAggregator(p, "flights_total", null, "https://x", "2026-07-08", "r")).toBe(false);
    expect((p.flights_total as Obj).value).toBeNull();
  });
});

describe("ll2ConfigId", () => {
  test("extracts the launcher config id from any field source", () => {
    expect(ll2ConfigId(profile())).toBe(26);
  });
  test("null when no LL2 config URL exists on the profile", () => {
    expect(ll2ConfigId({ provider: { value: "x", source: "https://en.wikipedia.org/wiki/X", as_of: "2026-07-05" } })).toBeNull();
  });
});

describe("isoDay", () => {
  test("normalizes ISO datetimes to YYYY-MM-DD and rejects junk", () => {
    expect(isoDay("2026-07-09T02:04:00Z")).toBe("2026-07-09");
    expect(isoDay("not a date")).toBeNull();
    expect(isoDay(null)).toBeNull();
  });
});

describe("parseGcatOrgs", () => {
  const TSV = [
    "#Code\tUCode\tStateCode\tType\tClass\tTStart\tTStop\tShortName\tName\tLocation\tLongitude\tLatitude\tError\tParent\tShortEName\tEName\tUName",
    "BOEIN\tBOEIN\tUS\tIN\tB\t1916 Jul 15\t-\tBoeing\tBoeing Co\tChicago\t0\t0\t0\t-\tBoeing\tThe Boeing Company\t-",
    "NOYEAR\tNOYEAR\tUS\tIN\tB\t?\t-\tNoYear\tNo Year Org\tNowhere\t0\t0\t0\t-\t-\t-\t-",
    "# comment line",
  ].join("\n");

  test("maps names to the TStart year", () => {
    const m = parseGcatOrgs(TSV);
    expect(m.get("boeing co")).toBe(1916);
    expect(m.get("the boeing company")).toBe(1916);
    expect(m.get("boeing")).toBe(1916);
  });

  test("skips rows without a year and GCAT empty markers", () => {
    const m = parseGcatOrgs(TSV);
    expect(m.get("no year org")).toBeUndefined();
    expect(m.has("-")).toBe(false);
  });

  test("attribution string is exactly the required one", () => {
    expect(GCAT_ATTRIBUTION).toBe("data from GCAT (J. McDowell, planet4589.org/space/gcat)");
  });
});
