/**
 * Validation tests for the registry v2 schema extensions: typed timeline
 * events (outcome/cause incident-only), the positioning block (sourced
 * claims + the mcc_read editorial surface), per-mode EO specs, and the
 * new optional capability/performance SourcedFields.
 */

import { describe, expect, test } from "bun:test";
import { validateRegistryProfile } from "../lib/validate";

const nullField = { value: null, source: null, as_of: null };

function constellationProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "testsat",
    name: "TestSat",
    entity_type: "constellation",
    domain: "eo",
    overview: { ...nullField },
    operator: { ...nullField },
    country: { ...nullField },
    sensor_types: { ...nullField },
    sats_launched_total: { ...nullField },
    sats_active_claimed: { ...nullField },
    sats_active_verified: { ...nullField },
    sats_planned: { ...nullField },
    orbit: { ...nullField },
    first_launch_date: { ...nullField },
    latest_launch_date: { ...nullField },
    status: { ...nullField },
    website: { ...nullField },
    ...overrides,
  };
}

function vehicleProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "testrocket",
    name: "TestRocket",
    entity_type: "vehicle",
    overview: { ...nullField },
    provider: { ...nullField },
    country: { ...nullField },
    vehicle_class: { ...nullField },
    payload_leo_kg: { ...nullField },
    reusable: { ...nullField },
    first_flight_date: { ...nullField },
    flights_total: { ...nullField },
    flights_successful: { ...nullField },
    last_flight_date: { ...nullField },
    next_flight_date: { ...nullField },
    status: { ...nullField },
    price_per_launch_usd: { ...nullField },
    ...overrides,
  };
}

const okEvent = {
  date: "2026-03-01",
  headline: "TestSat launches first satellite",
  source: "https://example.com/launch",
  as_of: "2026-07-08",
};

const okField = {
  value: 0.5,
  source: "https://example.com/specs",
  as_of: "2026-07-08",
};

function constErrors(overrides: Record<string, unknown>): string[] {
  return validateRegistryProfile(constellationProfile(overrides), "constellation", "testsat");
}

function vehicleErrors(overrides: Record<string, unknown>): string[] {
  return validateRegistryProfile(vehicleProfile(overrides), "vehicle", "testrocket");
}

// ------------------------------------------------------- timeline events

describe("timeline events: type / outcome / cause", () => {
  test("typeless event stays valid (absent type means milestone)", () => {
    expect(constErrors({ events: [okEvent] })).toEqual([]);
  });

  test("valid typed event passes", () => {
    expect(constErrors({ events: [{ ...okEvent, type: "launch" }] })).toEqual([]);
  });

  test("unknown type fails", () => {
    const errors = constErrors({ events: [{ ...okEvent, type: "party" }] });
    expect(errors.some((e) => e.includes('events[0].type: "party"'))).toBe(true);
  });

  test("incident with outcome and cause passes", () => {
    const events = [{ ...okEvent, type: "incident", outcome: "vehicle lost", cause: "stage 2 anomaly" }];
    expect(constErrors({ events })).toEqual([]);
  });

  test("outcome on a non-incident event fails", () => {
    const errors = constErrors({ events: [{ ...okEvent, type: "launch", outcome: "success" }] });
    expect(errors.some((e) => e.includes("events[0].outcome") && e.includes("incident"))).toBe(true);
  });

  test("cause on a typeless (milestone) event fails", () => {
    const errors = constErrors({ events: [{ ...okEvent, cause: "unknown" }] });
    expect(errors.some((e) => e.includes("events[0].cause") && e.includes("incident"))).toBe(true);
  });

  test("empty outcome string fails even on an incident", () => {
    const errors = constErrors({ events: [{ ...okEvent, type: "incident", outcome: "" }] });
    expect(errors.some((e) => e.includes("events[0].outcome"))).toBe(true);
  });

  test("vehicles and spaceports now carry timelines too", () => {
    expect(vehicleErrors({ events: [{ ...okEvent, type: "launch" }] })).toEqual([]);
    const badVehicle = vehicleErrors({ events: [{ ...okEvent, type: "party" }] });
    expect(badVehicle.some((e) => e.includes("events[0].type"))).toBe(true);
  });
});

// ----------------------------------------------------------- positioning

const okClaim = {
  value: "TestSat says it operates the largest SAR constellation",
  source: "https://example.com/about",
  as_of: "2026-07-08",
};

const okRead = {
  text: "The price leader in smallsat SAR tasking.",
  basis: ["https://example.com/about", "https://spacenews.com/testsat"],
  as_of: "2026-07-08",
};

describe("positioning block", () => {
  test("valid positioning with claims and mcc_read passes on all entity types", () => {
    const positioning = { claims: [okClaim], mcc_read: okRead };
    expect(constErrors({ positioning })).toEqual([]);
    expect(vehicleErrors({ positioning })).toEqual([]);
  });

  test("claims not an array fails", () => {
    const errors = constErrors({ positioning: { claims: "biggest" } });
    expect(errors.some((e) => e.includes("positioning.claims: required array"))).toBe(true);
  });

  test("claim with a value but no source or as_of fails like any SourcedField", () => {
    const errors = constErrors({
      positioning: { claims: [{ value: "unsourced boast", source: null, as_of: null }] },
    });
    expect(errors.some((e) => e.includes("claims[0]") && e.includes("no source"))).toBe(true);
    expect(errors.some((e) => e.includes("claims[0]") && e.includes("no as_of"))).toBe(true);
  });

  test("mcc_read missing text fails", () => {
    const errors = constErrors({
      positioning: { claims: [], mcc_read: { ...okRead, text: undefined } },
    });
    expect(errors.some((e) => e.includes("mcc_read.text"))).toBe(true);
  });

  test("mcc_read text over 400 chars fails", () => {
    const errors = constErrors({
      positioning: { claims: [], mcc_read: { ...okRead, text: "x".repeat(401) } },
    });
    expect(errors.some((e) => e.includes("mcc_read.text") && e.includes("max 400"))).toBe(true);
  });

  test("mcc_read missing or empty basis fails", () => {
    const missing = constErrors({
      positioning: { claims: [], mcc_read: { text: "A read.", as_of: "2026-07-08" } },
    });
    expect(missing.some((e) => e.includes("mcc_read.basis"))).toBe(true);
    const empty = constErrors({
      positioning: { claims: [], mcc_read: { ...okRead, basis: [] } },
    });
    expect(empty.some((e) => e.includes("mcc_read.basis") && e.includes("at least one"))).toBe(true);
  });

  test("mcc_read missing as_of fails", () => {
    const errors = constErrors({
      positioning: { claims: [], mcc_read: { text: "A read.", basis: okRead.basis } },
    });
    expect(errors.some((e) => e.includes("mcc_read.as_of"))).toBe(true);
  });
});

// ---------------------------------------------------------- imaging modes

describe("imaging_modes", () => {
  const okMode = {
    mode: "Spotlight",
    resolution_m: 0.5,
    swath_km: 5,
    source: "https://example.com/modes",
    as_of: "2026-07-08",
  };

  test("valid modes pass, null figures allowed", () => {
    expect(constErrors({ imaging_modes: [okMode, { ...okMode, mode: "Stripmap", swath_km: null }] })).toEqual([]);
  });

  test("entry missing mode, source, or as_of fails", () => {
    const errors = constErrors({
      imaging_modes: [{ resolution_m: 0.5, swath_km: 5 }],
    });
    expect(errors.some((e) => e.includes("imaging_modes[0].mode"))).toBe(true);
    expect(errors.some((e) => e.includes("imaging_modes[0].source"))).toBe(true);
    expect(errors.some((e) => e.includes("imaging_modes[0].as_of"))).toBe(true);
  });

  test("non-numeric figure fails", () => {
    const errors = constErrors({ imaging_modes: [{ ...okMode, resolution_m: "0.5 m" }] });
    expect(errors.some((e) => e.includes("imaging_modes[0].resolution_m"))).toBe(true);
  });
});

describe("generations", () => {
  const okGen = {
    name: "Gen4",
    text: "50cm resolution, daily revisit",
    source: "https://example.com/gen4",
    as_of: "2026-07-08",
  };

  test("valid generations pass", () => {
    expect(constErrors({ generations: [okGen, { ...okGen, name: "Gen5" }] })).toEqual([]);
  });

  test("entry missing name, text, source, or as_of fails", () => {
    const errors = constErrors({
      generations: [{}],
    });
    expect(errors.some((e) => e.includes("generations[0].name"))).toBe(true);
    expect(errors.some((e) => e.includes("generations[0].text"))).toBe(true);
    expect(errors.some((e) => e.includes("generations[0].source"))).toBe(true);
    expect(errors.some((e) => e.includes("generations[0].as_of"))).toBe(true);
  });

  test("bad as_of format fails", () => {
    const errors = constErrors({ generations: [{ ...okGen, as_of: "07/08/2026" }] });
    expect(errors.some((e) => e.includes("generations[0].as_of"))).toBe(true);
  });
});

// -------------------------------------------- new optional SourcedFields

describe("registry v2 optional SourcedFields", () => {
  test("valid EO and connectivity fields pass", () => {
    const errors = constErrors({
      resolution_m: okField,
      swath_km: { ...okField, value: 30 },
      revisit: { ...okField, value: "up to 10x daily" },
      spectral_bands: { ...okField, value: ["RGB", "NIR"] },
      frequency_bands: { ...okField, value: ["Ka", "Ku"] },
      capacity: { ...okField, value: "up to 220 Mbps per user" },
      user_terminals: { ...okField, value: "flat panel" },
      service_type: { ...okField, value: "broadband" },
    });
    expect(errors).toEqual([]);
  });

  test("wrong-shape values fail: revisit stays a string, resolution stays a number", () => {
    const asNumber = constErrors({ revisit: { ...okField, value: 10 } });
    expect(asNumber.some((e) => e.includes("revisit.value: must be null or string"))).toBe(true);
    const asString = constErrors({ resolution_m: { ...okField, value: "0.5 m" } });
    expect(asString.some((e) => e.includes("resolution_m.value: must be null or number"))).toBe(true);
  });

  test("bare value instead of a SourcedField fails", () => {
    const errors = constErrors({ swath_km: 30 });
    expect(errors.some((e) => e.includes("swath_km: required SourcedField object"))).toBe(true);
  });

  test("valid vehicle performance fields and variant pass", () => {
    const errors = vehicleErrors({
      payload_sso_kg: { ...okField, value: 17500 },
      payload_gto_kg: { ...okField, value: 8300 },
      height_m: { ...okField, value: 70 },
      diameter_m: { ...okField, value: 3.7 },
      mass_kg: { ...okField, value: 549054 },
      stages: { ...okField, value: 2 },
      engines_stage1: { ...okField, value: "9x Merlin 1D" },
      variant: "Block 5",
    });
    expect(errors).toEqual([]);
  });

  test("vehicle wrong shapes fail: stages as string, variant as SourcedField", () => {
    const stages = vehicleErrors({ stages: { ...okField, value: "two" } });
    expect(stages.some((e) => e.includes("stages.value: must be null or number"))).toBe(true);
    const variant = vehicleErrors({ variant: { value: "Block 5" } });
    expect(variant.some((e) => e.includes("variant: must be a non-empty string"))).toBe(true);
  });
});
