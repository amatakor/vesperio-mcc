/**
 * Pre-launch QC hardening (2026-07-13): the whitelist-floor membership
 * gate, the full commentary impact cap, registry provenance ceilings,
 * exhaustive registry keys, ledger windowing by publication date, the
 * cross-category dedup net, and the scheduled-run registry diff gates.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finalizeSweep } from "../finalize-sweep";
import { validateItem, validateRegistryProfile } from "../lib/validate";
import { windowEvents, netStrikes, demotionInEffect } from "../snr/ledger";
import { findRegistryStructuralViolations, mccReadChanged } from "../check-run-diff";
import type { ItemsFile, HeldFile, StateFile, SourcesFile, SourceLedgerFile, LedgerSource } from "../../src/data/schema";

let dir: string;
let dataDir: string;
let draftPath: string;

const existingItem = {
  id: "2026-07-01-iceye-finland-sar-expansion",
  date: "2026-07-01",
  headline: "ICEYE expands Finnish SAR manufacturing line",
  explainer: {
    tagline: "ICEYE grows its Gen4 production capacity in Finland.",
    what_happened: "ICEYE announced an expansion of its satellite manufacturing line. The company published the plan on its own press page.",
    why_it_matters: "SAR supply constrains every downstream reseller; more production capacity changes delivery timelines.",
  },
  kind: "event",
  tags: ["sar", "europe"],
  category: "constellation",
  impact: "notable",
  companies: ["ICEYE"],
  source_url: "https://example.com/iceye/press-existing",
  secondary_urls: [],
  snr: 5,
  snr_trace: {
    base: { tier: 5, source: "https://example.com/iceye/press-existing", reason: "test fixture: first party" },
    modifiers: [],
    final: 5,
    scorer_version: 1,
  },
  publishDate: "2026-07-01T12:00:00.000Z",
};

function seedDataDir(): void {
  const items: ItemsFile = { items: [existingItem as ItemsFile["items"][number]] };
  const held: HeldFile = { held: [] };
  const state: StateFile = { lastSweep: "2026-07-01T12:00:00.000Z", sweeps: [] };
  const sources: SourcesFile = {
    version: "0.1",
    categories: {
      eo_operators: [
        {
          name: "ICEYE",
          url: "https://www.iceye.com/press",
          feed_type: "html",
          rss: null,
          cadence: "weekly",
          language: "en",
          tier: 1,
          status: "unverified",
        },
      ],
    },
  };
  const ledger: SourceLedgerFile = { version: "0.1", updated: null, sources: [] };
  writeFileSync(join(dataDir, "items.json"), JSON.stringify(items, null, 2));
  writeFileSync(join(dataDir, "held.json"), JSON.stringify(held, null, 2));
  writeFileSync(join(dataDir, "state.json"), JSON.stringify(state, null, 2));
  writeFileSync(join(dataDir, "sources.json"), JSON.stringify(sources, null, 2));
  writeFileSync(join(dataDir, "source_ledger.json"), JSON.stringify(ledger, null, 2));
}

/**
 * A whitelisted person with an X-only channel set: X is not a fetchable
 * type, so the signals-pass gate stays out of the way and the tests
 * exercise only the floor-membership gate.
 */
function seedSignalsXOnly(): void {
  const signals = {
    meta: {},
    people: [
      {
        id: "peter-beck",
        name: "Peter Beck",
        bucket: "founder_exec",
        role: "Founder and CEO",
        org: "Rocket Lab",
        domains: ["launch"],
        regions: ["us", "nz"],
        why: "Test fixture.",
        whitelist: "yes",
        channels: [
          { type: "x", handle: "Peter_J_Beck", url: "https://x.com/Peter_J_Beck", status: "verified_active", last_seen: null, verified_on: null },
        ],
      },
    ],
    outlets: [],
    excluded: [],
  };
  writeFileSync(join(dataDir, "signals.json"), JSON.stringify(signals, null, 2));
}

function whitelistItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const post = "https://x.com/Peter_J_Beck/status/1234567890";
  return {
    id: "2026-07-12-rocket-lab-neutron-update",
    date: "2026-07-12",
    headline: "Rocket Lab reports Neutron stage-one tank qualification complete",
    explainer: {
      tagline: "Per Peter Beck on X: the Neutron first-stage tank passed qualification.",
      what_happened: "Peter Beck posted that the Neutron first-stage tank completed qualification testing. The post appeared on his verified X account.",
      why_it_matters: "Neutron schedule confidence moves medium-lift manifest planning for 2027 customers.",
    },
    tags: ["launch"],
    category: "launch",
    impact: "notable",
    companies: ["Rocket Lab"],
    source_url: post,
    secondary_urls: [],
    scoring: {
      sources: [{ url: post, outlet: "Peter Beck on X", class: "whitelist" }],
      extraordinary: false,
      crawl: "found_some",
      whitelist: "self",
    },
    ...overrides,
  };
}

function writeDraft(body: Record<string, unknown>): void {
  writeFileSync(
    draftPath,
    JSON.stringify({
      newItems: [],
      updates: [],
      held: [],
      sourceHealth: [],
      summary: "test sweep",
      coverage: ["launch"],
      discoveryPass: {
        queries: [
          "rocket launch this week",
          "space company funding round",
          "satellite incident",
          "china commercial launch",
          "earth observation contract",
          "spacex starlink news",
        ],
        found: 0,
        note: "test default: matrix covered, nothing new surfaced",
      },
      ...body,
    }),
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mcc-qc-test-"));
  dataDir = join(dir, "data");
  mkdirSync(dataDir);
  draftPath = join(dir, "sweep-draft.json");
  seedDataDir();
  seedSignalsXOnly();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("whitelist floor membership gate", () => {
  test("self floor from a real channel of the concerned party scores 5", () => {
    writeDraft({ newItems: [whitelistItem()] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    const items = JSON.parse(require("node:fs").readFileSync(join(dataDir, "items.json"), "utf8")) as ItemsFile;
    const stamped = items.items.find((i) => i.id === "2026-07-12-rocket-lab-neutron-update")!;
    expect(stamped.snr).toBe(5);
  });

  test("twitter.com URL variant still matches the x.com channel", () => {
    const post = "https://twitter.com/Peter_J_Beck/status/1234567890";
    const item = whitelistItem({ source_url: post });
    (item.scoring as { sources: { url: string }[] }).sources[0]!.url = post;
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
  });

  test("a whitelist-class source not under any channel is rejected", () => {
    const post = "https://x.com/random_account/status/999";
    const item = whitelistItem({ source_url: post, scoring: {
      sources: [{ url: post, outlet: "Random on X", class: "whitelist" }],
      extraordinary: false,
      crawl: "found_some",
      whitelist: "observer",
    } });
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("not under any whitelisted verified-active");
  });

  test("a bare-prefix spoof (handle as substring) does not match", () => {
    const post = "https://x.com/Peter_J_Beck_fan/status/999";
    const item = whitelistItem({ source_url: post, scoring: {
      sources: [{ url: post, outlet: "Fan on X", class: "whitelist" }],
      extraordinary: false,
      crawl: "found_some",
      whitelist: "observer",
    } });
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
  });

  test("self without an org-to-companies match is rejected toward observer", () => {
    const item = whitelistItem({ companies: ["SpaceX"] });
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain('use "observer"');
  });

  test("observer floor from a real channel scores 4", () => {
    const item = whitelistItem({ companies: ["SpaceX"] });
    (item.scoring as { whitelist: string }).whitelist = "observer";
    (item.explainer as Record<string, string>).tagline = "Per Peter Beck on X: SpaceX completed the test.";
    item.headline = "SpaceX completes Starship static fire per Peter Beck";
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.errors).toEqual([]);
    const items = JSON.parse(require("node:fs").readFileSync(join(dataDir, "items.json"), "utf8")) as ItemsFile;
    const stamped = items.items.find((i) => i.id === "2026-07-12-rocket-lab-neutron-update")!;
    expect(stamped.snr).toBe(4);
  });

  test("a floor claim with no whitelist-class source at all is rejected", () => {
    const item = whitelistItem({
      source_url: "https://spacenews.com/report",
      scoring: {
        sources: [{ url: "https://spacenews.com/report", outlet: "SpaceNews", class: "trade" }],
        extraordinary: false,
        crawl: "found_some",
        whitelist: "self",
      },
    });
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("earned by membership");
  });
});

describe("cross-category dedup net", () => {
  const dupe = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: "2026-07-04-iceye-finland-line",
    date: "2026-07-04",
    headline: "ICEYE expands Finnish SAR manufacturing line",
    explainer: {
      tagline: "ICEYE grows Gen4 production capacity in Finland.",
      what_happened: "ICEYE said it is expanding its manufacturing line. The plan was published this week.",
      why_it_matters: "SAR supply constrains resellers; capacity changes delivery timelines.",
    },
    tags: ["sar"],
    category: "product",
    impact: "noise",
    companies: ["ICEYE"],
    source_url: "https://spacenews.com/iceye-expansion",
    secondary_urls: [],
    scoring: {
      sources: [{ url: "https://spacenews.com/iceye-expansion", outlet: "SpaceNews", class: "trade" }],
      extraordinary: false,
      crawl: "found_some",
      whitelist: null,
    },
    ...overrides,
  });

  test("same company + near-identical headline in a DIFFERENT category is caught", () => {
    writeDraft({ newItems: [dupe()] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("near-identical headline across categories");
  });

  test("the attested-distinct escape hatch still works across categories", () => {
    writeDraft({
      newItems: [dupe({ dedup_distinct: [{ id: existingItem.id, reason: "genuinely a second, distinct expansion" }] })],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("different category with an unrelated headline still passes", () => {
    writeDraft({
      newItems: [dupe({ headline: "ICEYE signs Gen4 imagery deal with Finnish defence ministry" })],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.errors).toEqual([]);
  });
});

describe("commentary impact cap covers major", () => {
  const commentaryBase = {
    ...existingItem,
    id: "2026-07-02-analyst-take",
    kind: "commentary",
    headline: "Per analyst: SAR pricing will compress through 2027",
    sources: undefined,
  };
  const errorsFor = (impact: string): string[] => {
    const errors: string[] = [];
    validateItem({ ...commentaryBase, impact }, "item", errors);
    return errors.filter((e) => e.includes("caps at"));
  };

  test("major commentary is rejected", () => {
    expect(errorsFor("major").join("\n")).toContain('caps at "notable"');
  });
  test("seismic commentary is still rejected", () => {
    expect(errorsFor("seismic").join("\n")).toContain('caps at "notable"');
  });
  test("notable commentary passes the cap", () => {
    expect(errorsFor("notable")).toEqual([]);
  });
});

describe("item image src is pipeline-only", () => {
  test("external image URLs are rejected", () => {
    const errors: string[] = [];
    validateItem(
      { ...existingItem, image: { src: "https://evil.example.com/x.jpg", credit: "x", origin_url: "https://evil.example.com" } },
      "item",
      errors,
    );
    expect(errors.join("\n")).toContain("re-hosted /img/ path");
  });
  test("re-hosted /img/ paths pass", () => {
    const errors: string[] = [];
    validateItem(
      { ...existingItem, image: { src: "/img/items/x.webp", credit: "x", origin_url: "https://example.com/article" } },
      "item",
      errors,
    );
    expect(errors).toEqual([]);
  });
});

describe("ledger windows strikes by claim publication date", () => {
  const source: LedgerSource = {
    domain: "example.com",
    events: [
      // Resolution landed recently, but the claim it strikes was published
      // outside the 90-day window: the strike must age out with its cohort.
      { date: "2026-06-20", kind: "strike", claim: "old-claim", reason: "lost a contradiction" },
    ],
    claims: [
      { claim: "old-claim", date: "2026-03-01", snr_at_publication: 3, resolution: "debunked", resolved_on: "2026-06-20" },
    ],
  };

  test("a fresh strike on an aged-out claim is not windowed", () => {
    expect(windowEvents(source, "2026-07-01").length).toBe(0);
    expect(netStrikes(source, "2026-07-01")).toBe(0);
    expect(demotionInEffect(source, "2026-07-01")).toBe(false);
  });

  test("an event with no matching claim falls back to its own date", () => {
    const orphan: LedgerSource = {
      domain: "example.com",
      events: [{ date: "2026-06-20", kind: "strike", claim: "unknown", reason: "" }],
      claims: [],
    };
    expect(windowEvents(orphan, "2026-07-01").length).toBe(1);
  });
});

describe("registry provenance and key gates", () => {
  const nullField = { value: null, source: null, as_of: null };
  const baseConstellation = (): Record<string, unknown> => ({
    slug: "testcon",
    name: "TestCon",
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
  });
  const scored = (host: string, baseTier: number, modifiers: Array<Record<string, unknown>> = []) => {
    const final = baseTier + modifiers.reduce((n, m) => n + (m.delta as number), 0);
    return {
      value: "Finland",
      source: `https://${host}/page`,
      as_of: "2026-07-01",
      snr: final,
      tier: final >= 4 ? "canonical" : "provisional",
      snr_trace: {
        base: { tier: baseTier, source: `https://${host}/page`, reason: "test" },
        modifiers,
        final,
        scorer_version: 1,
      },
    };
  };

  test("a press host claiming base tier 4 is rejected", () => {
    const profile = { ...baseConstellation(), country: scored("spacenews.com", 4) };
    const errors = validateRegistryProfile(profile, "constellation", "testcon");
    expect(errors.join("\n")).toContain("earns at most 3");
  });

  test("a press host claiming base tier 5 canonical is rejected", () => {
    const profile = { ...baseConstellation(), country: scored("evil-injected.example.com", 5) };
    const errors = validateRegistryProfile(profile, "constellation", "testcon");
    expect(errors.join("\n")).toContain("earns at most 3");
  });

  test("an aggregator base tier 4 passes", () => {
    const profile = { ...baseConstellation(), country: scored("space.skyrocket.de", 4) };
    expect(validateRegistryProfile(profile, "constellation", "testcon")).toEqual([]);
  });

  test("a press base 3 corroborated to 4 passes (the honest climb)", () => {
    const profile = {
      ...baseConstellation(),
      country: scored("spacenews.com", 3, [
        { type: "corroboration_2plus", delta: 1, reason: "2 distinct sources" },
      ]),
    };
    expect(validateRegistryProfile(profile, "constellation", "testcon")).toEqual([]);
  });

  test("a .gov base tier 5 passes", () => {
    const profile = { ...baseConstellation(), country: scored("docs.fcc.gov", 5) };
    expect(validateRegistryProfile(profile, "constellation", "testcon")).toEqual([]);
  });

  test("unknown keys are rejected", () => {
    const profile = { ...baseConstellation(), smuggled_field: { ...nullField } };
    const errors = validateRegistryProfile(profile, "constellation", "testcon");
    expect(errors.join("\n")).toContain("smuggled_field: unknown key");
  });

  test("em dashes in notes and overview are rejected", () => {
    const withNotes = { ...baseConstellation(), notes: "a — b" };
    expect(validateRegistryProfile(withNotes, "constellation", "testcon").join("\n")).toContain("notes");
    const withOverview = {
      ...baseConstellation(),
      overview: { value: "An operator — with a dash.", source: "https://example.com", as_of: "2026-07-01" },
    };
    expect(validateRegistryProfile(withOverview, "constellation", "testcon").join("\n")).toContain("overview.value");
  });
});

describe("check-run-diff registry gates", () => {
  test("new, deleted, and renamed registry files are structural violations", () => {
    const status = [
      "?? src/data/registry/constellations/fake-injected.json",
      "A  src/data/registry/vehicles/fake.json",
      " D src/data/registry/spaceports/wallops.json",
      "R  src/data/registry/organizations/a.json -> src/data/registry/organizations/b.json",
      " M src/data/registry/constellations/starlink.json",
      " M src/data/state.json",
    ].join("\n");
    const violations = findRegistryStructuralViolations(status);
    expect(violations.length).toBe(5); // rename counts both sides
    expect(violations.join("\n")).toContain("fake-injected.json");
    expect(violations.join("\n")).not.toContain("starlink.json");
  });

  test("plain modifications are not structural violations", () => {
    expect(findRegistryStructuralViolations(" M src/data/registry/constellations/starlink.json")).toEqual([]);
  });

  test("mccReadChanged detects edits, additions, and removals", () => {
    const withRead = { positioning: { claims: [], mcc_read: { text: "a read", basis: [], as_of: "2026-07-01" } } };
    const withEditedRead = { positioning: { claims: [], mcc_read: { text: "another read", basis: [], as_of: "2026-07-01" } } };
    const without = { positioning: { claims: [] } };
    expect(mccReadChanged(withRead, withEditedRead)).toBe(true);
    expect(mccReadChanged(withRead, without)).toBe(true);
    expect(mccReadChanged(without, withRead)).toBe(true);
    expect(mccReadChanged(withRead, structuredClone(withRead))).toBe(false);
    expect(mccReadChanged(without, structuredClone(without))).toBe(false);
    // claims edits alone are legal for maintenance runs
    const withClaim = { positioning: { claims: [{ value: "x", source: "https://e.com", as_of: "2026-07-01" }] } };
    expect(mccReadChanged(without, withClaim)).toBe(false);
  });
});
