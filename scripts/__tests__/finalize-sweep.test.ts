import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finalizeSweep } from "../finalize-sweep";
import { buildSweepContext } from "../sweep-context";
import type {
  ItemsFile,
  HeldFile,
  StateFile,
  SourcesFile,
  SourceLedgerFile,
} from "../../src/data/schema";

const FIXTURES = join(import.meta.dir, "fixtures");
const DATA_FILES = [
  "items.json",
  "held.json",
  "state.json",
  "sources.json",
  "source_ledger.json",
] as const;

let dir: string;
let dataDir: string;
let draftPath: string;

/** The item that already exists in the feed; the duplicate-id fixture reuses its id. */
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
    base: {
      tier: 5,
      source: "https://example.com/iceye/press-existing",
      reason: "test fixture: first party",
    },
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

/** A minimal valid new-item draft body around a scoring block. */
function baseNewItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "2026-07-04-rocket-lab-electron-eo-launch",
    date: "2026-07-04",
    headline: "Rocket Lab launches Electron mission for a confidential EO customer",
    explainer: {
      tagline: "Electron flew again with a dedicated smallsat payload.",
      what_happened: "Rocket Lab launched an Electron from Launch Complex 1. It reached target orbit per the webcast.",
      why_it_matters: "Dedicated smallsat cadence affects EO deployment schedules and rideshare pricing leverage.",
    },
    tags: ["smallsat-launch"],
    category: "launch",
    impact: "noise",
    companies: ["Rocket Lab"],
    source_url: "https://spacenews.com/rocket-lab/launch-report",
    secondary_urls: [],
    scoring: {
      sources: [
        { url: "https://spacenews.com/rocket-lab/launch-report", outlet: "SpaceNews", class: "trade" },
      ],
      extraordinary: false,
      crawl: "found_none",
      whitelist: null,
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

/** A minimal signals.json with one fetchable whitelisted channel + one X handle. */
const FETCHABLE_URL = "https://spacepolicyonline.com";
function seedSignals(): void {
  const signals = {
    meta: {},
    people: [
      {
        id: "marcia-smith",
        name: "Marcia Smith",
        bucket: "analyst",
        role: "Editor",
        org: "SpacePolicyOnline",
        domains: ["launch"],
        regions: ["us"],
        why: "Policy tracker.",
        whitelist: "yes",
        channels: [
          { type: "site", url: FETCHABLE_URL, status: "verified_active", last_seen: null, verified_on: null },
          { type: "x", handle: "SpcPlcyOnline", url: "https://x.com/SpcPlcyOnline", status: "verified_active", last_seen: null, verified_on: null },
        ],
      },
    ],
    outlets: [],
    excluded: [],
  };
  writeFileSync(join(dataDir, "signals.json"), JSON.stringify(signals, null, 2));
}

function readLedger(): SourceLedgerFile {
  return JSON.parse(readFileSync(join(dataDir, "source_ledger.json"), "utf8")) as SourceLedgerFile;
}
function readItems(): ItemsFile {
  return JSON.parse(readFileSync(join(dataDir, "items.json"), "utf8")) as ItemsFile;
}
function readState(): StateFile {
  return JSON.parse(readFileSync(join(dataDir, "state.json"), "utf8")) as StateFile;
}
function readHeld(): HeldFile {
  return JSON.parse(readFileSync(join(dataDir, "held.json"), "utf8")) as HeldFile;
}

function snapshotDataFiles(): Record<string, string> {
  const snap: Record<string, string> = {};
  for (const f of DATA_FILES) snap[f] = readFileSync(join(dataDir, f), "utf8");
  return snap;
}

function useDraftFixture(name: string): void {
  copyFileSync(join(FIXTURES, name), draftPath);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mcc-sweep-test-"));
  dataDir = join(dir, "data");
  mkdirSync(dataDir);
  draftPath = join(dir, "sweep-draft.json");
  seedDataDir();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function expectRejectedUntouched(fixture: string, reasonSubstring: string): void {
  useDraftFixture(fixture);
  const before = snapshotDataFiles();
  const result = finalizeSweep({ dataDir, draftPath });
  expect(result.ok).toBe(false);
  expect(result.errors.join("\n")).toContain(reasonSubstring);
  expect(snapshotDataFiles()).toEqual(before);
  // A rejected draft stays on disk for the agent to fix and rerun.
  expect(existsSync(draftPath)).toBe(true);
}

describe("finalize-sweep rejections", () => {
  test("missing source_url is rejected, data files unchanged", () => {
    expectRejectedUntouched("draft-missing-source-url.json", "source_url");
  });

  test("duplicate id is rejected, data files unchanged", () => {
    expectRejectedUntouched("draft-duplicate-id.json", "already exists in items.json");
  });

  test("invalid category is rejected, data files unchanged", () => {
    expectRejectedUntouched("draft-invalid-category.json", "category");
  });

  test("missing draft file is rejected", () => {
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("cannot read");
  });

  test("draft with publishDate already set is rejected", () => {
    const draft = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    draft.newItems[0].publishDate = "2026-07-04T00:00:00.000Z";
    writeFileSync(draftPath, JSON.stringify(draft));
    const before = snapshotDataFiles();
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("publishDate");
    expect(snapshotDataFiles()).toEqual(before);
  });

  test("a preset snr on a new item is rejected (finalize stamps it)", () => {
    writeDraft({ newItems: [baseNewItem({ snr: 5 })] });
    const before = snapshotDataFiles();
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("snr");
    expect(snapshotDataFiles()).toEqual(before);
  });

  test("a lead-source url that differs from source_url is rejected", () => {
    const item = baseNewItem();
    (item.scoring as { sources: { url: string }[] }).sources[0]!.url = "https://spacenews.com/other";
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("must equal item.source_url");
  });

  test("an unknown source class is rejected", () => {
    const item = baseNewItem();
    (item.scoring as { sources: { class: string }[] }).sources[0]!.class = "blog";
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("not in [");
  });

  test("first_party with an unofficial host is rejected with a reclassify hint", () => {
    const item = baseNewItem({ source_url: "https://randomblog.example/iceye" });
    item.scoring = {
      sources: [{ url: "https://randomblog.example/iceye", outlet: "Random Blog", class: "first_party" }],
      extraordinary: false,
      crawl: "found_none",
      whitelist: null,
    };
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("reclassify");
  });

  test("first_party on a sibling subdomain of a www-recorded registry website is accepted", () => {
    // The registry stores display URLs (www.planet.com); the actor's
    // domain is the apex, so investors.planet.com is the same actor.
    // Regression: the Wolfgang Schmidt item led with a wire copy because
    // the gate rejected Planet's own IR subdomain.
    const regDir = join(dataDir, "registry", "constellations");
    mkdirSync(regDir, { recursive: true });
    writeFileSync(
      join(regDir, "planet.json"),
      JSON.stringify({
        name: "Planet (fleet)",
        website: { value: "https://www.planet.com/", source: "https://www.planet.com/company/", as_of: "2026-07-05" },
      }),
    );
    const url = "https://investors.planet.com/news/news-details/2026/some-release/default.aspx";
    const item = baseNewItem({
      id: "2026-07-04-planet-first-party-test",
      source_url: url,
      companies: ["Planet Labs"],
      scoring: {
        sources: [{ url, outlet: "Planet Labs", class: "first_party" }],
        extraordinary: false,
        crawl: "found_none",
        whitelist: null,
      },
    });
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const merged = readItems().items.find((it) => it.id === "2026-07-04-planet-first-party-test")!;
    expect(merged.snr).toBe(5);
    expect(merged.snr_trace.base.tier).toBe(5);
  });

  test("a bump on a saturated modifier is rejected", () => {
    // Give the existing item a reinforcement modifier, then bump it again.
    const items = readItems();
    const it = items.items[0]!;
    it.snr = 3;
    it.snr_trace = {
      base: { tier: 3, source: it.source_url, reason: "trade base" },
      modifiers: [{ type: "reinforcement", delta: 1, reason: "earlier reinforcement" }],
      final: 4,
      scorer_version: 1,
    } as (typeof it)["snr_trace"];
    it.snr = 4;
    writeFileSync(join(dataDir, "items.json"), JSON.stringify(items, null, 2));

    writeDraft({
      updates: [
        {
          id: existingItem.id,
          patch: {},
          note: "Second reinforcement attempt.",
          bump: "reinforcement",
        },
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("already applied");
  });

  test("unknown source name in sourceHealth is rejected", () => {
    const draft = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    draft.sourceHealth = [{ name: "Not A Source", status: "verified" }];
    writeFileSync(draftPath, JSON.stringify(draft));
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("not found in sources.json");
  });

  // ICEYE in the seeded sources.json is feed_type html: attesting a
  // successful fetch of it needs proof (plan Phase 5, should-fix 3).
  test("a bare success attestation for an html source is rejected", () => {
    const draft = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    draft.sourceHealth = [{ name: "ICEYE", status: "verified", note: "fetched cleanly, no new items" }];
    writeFileSync(draftPath, JSON.stringify(draft));
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("requires evidence.excerpt");
  });

  test("a too-short excerpt is not proof", () => {
    const draft = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    draft.sourceHealth = [
      { name: "ICEYE", status: "verified", evidence: { excerpt: "ICEYE press page" } },
    ];
    writeFileSync(draftPath, JSON.stringify(draft));
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("requires evidence.excerpt");
  });

  test("a malformed content hash is not proof", () => {
    const draft = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    draft.sourceHealth = [
      { name: "ICEYE", status: "verified", evidence: { content_sha256: "deadbeef" } },
    ];
    writeFileSync(draftPath, JSON.stringify(draft));
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("requires evidence.excerpt");
  });

  test("a real excerpt or a 64-hex hash satisfies the gate", () => {
    const draft = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    draft.sourceHealth = [
      {
        name: "ICEYE",
        status: "verified",
        evidence: {
          excerpt: "ICEYE announces four Gen4 satellites launched on Transporter-17, July 7, 2026",
        },
      },
    ];
    writeFileSync(draftPath, JSON.stringify(draft));
    expect(finalizeSweep({ dataDir, draftPath }).ok).toBe(true);

    // Second run in the same seeded dir: attest health only, no new items
    // (the first run already merged the fixture item).
    const draft2 = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    draft2.newItems = [];
    draft2.held = [];
    draft2.sourceHealth = [
      { name: "ICEYE", status: "verified", evidence: { content_sha256: "a".repeat(64) } },
    ];
    writeFileSync(draftPath, JSON.stringify(draft2));
    expect(finalizeSweep({ dataDir, draftPath }).ok).toBe(true);
  });

  test("a successful merge stamps every queue candidate consumed; a rejected draft stamps nothing", () => {
    const queue = {
      generated_at: "2026-07-05T04:30:00.000Z",
      window_start: "2026-07-03T04:30:00.000Z",
      mode: "normal",
      health: [],
      candidates: [
        { id: "aaa", source_name: "S", url: "https://e.com/a", title: "A", published_at: "2026-07-04T00:00:00.000Z", raw_excerpt: "", fetched_at: "2026-07-05T04:30:00.000Z" },
        { id: "bbb", source_name: "S", url: "https://e.com/b", title: "B", published_at: "2026-07-04T00:00:00.000Z", raw_excerpt: "", fetched_at: "2026-07-05T04:30:00.000Z" },
      ],
    };
    writeFileSync(join(dataDir, "candidates.json"), JSON.stringify(queue, null, 2));

    // Rejected draft first: the queue must stay unstamped for the retry.
    const bad = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    bad.sourceHealth = [{ name: "Not A Source", status: "verified" }];
    writeFileSync(draftPath, JSON.stringify(bad));
    expect(finalizeSweep({ dataDir, draftPath }).ok).toBe(false);
    let onDisk = JSON.parse(readFileSync(join(dataDir, "candidates.json"), "utf8"));
    expect(onDisk.candidates.every((c: { consumed?: boolean }) => c.consumed === undefined)).toBe(true);

    // Successful merge: every entry stamped.
    useDraftFixture("draft-valid.json");
    expect(finalizeSweep({ dataDir, draftPath }).ok).toBe(true);
    onDisk = JSON.parse(readFileSync(join(dataDir, "candidates.json"), "utf8"));
    expect(onDisk.candidates.every((c: { consumed?: boolean }) => c.consumed === true)).toBe(true);
  });

  test("failure attestations for html sources need no evidence", () => {
    const draft = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    draft.sourceHealth = [
      { name: "ICEYE", status: "dead", note: "403 on three consecutive attempts", fail_count: 3 },
    ];
    writeFileSync(draftPath, JSON.stringify(draft));
    expect(finalizeSweep({ dataDir, draftPath }).ok).toBe(true);
  });
});

describe("finalize-sweep merge", () => {
  test("new items get entities stamped from the registry alias index (Phase 7)", () => {
    mkdirSync(join(dataDir, "registry", "organizations"), { recursive: true });
    writeFileSync(
      join(dataDir, "registry", "organizations", "rocket-lab.json"),
      JSON.stringify({ slug: "rocket-lab", name: "Rocket Lab" }, null, 2),
    );
    useDraftFixture("draft-valid.json");
    const result = finalizeSweep({ dataDir, draftPath, now: new Date("2026-07-05T05:00:00.000Z") });
    expect(result.ok).toBe(true);
    const merged = readItems().items.find((i) => i.companies.includes("Rocket Lab"))!;
    expect(merged.entities).toEqual([{ name: "Rocket Lab", ref: "organizations/rocket-lab" }]);
    // The seeded existing item has no registry match and stays unstamped.
    const existing = readItems().items.find((i) => i.id === existingItem.id)!;
    expect(existing.entities).toBeUndefined();
  });

  test("a valid draft merges into all four data files and deletes the draft", () => {
    useDraftFixture("draft-valid.json");
    const now = new Date("2026-07-05T05:00:00.000Z");
    const result = finalizeSweep({ dataDir, draftPath, now });

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.added).toBe(1);
    expect(result.held).toBe(1);

    const items = JSON.parse(readFileSync(join(dataDir, "items.json"), "utf8")) as ItemsFile;
    expect(items.items).toHaveLength(2);
    const added = items.items.find((i) => i.id === "2026-07-04-rocket-lab-electron-eo-launch")!;
    expect(added.publishDate).toBe("2026-07-05T05:00:00.000Z");
    // A single trade lead whose crawl found nothing: base 3 - 1 = 2.
    expect(added.snr).toBe(2);
    expect(added.snr_trace.base.tier).toBe(3);
    expect(added.snr_trace.modifiers.map((m) => m.type)).toEqual(["corroboration_none"]);
    expect(added.sources).toHaveLength(1);
    expect(added.sources![0]!.via).toBe("initial");
    expect(added.sources![0]!.added).toBe("2026-07-05");

    const held = JSON.parse(readFileSync(join(dataDir, "held.json"), "utf8")) as HeldFile;
    expect(held.held).toHaveLength(1);
    expect(held.held[0]!.date).toBe("2026-07-05");
    expect(held.held[0]!.reason).toContain("Tier-2");

    const state = JSON.parse(readFileSync(join(dataDir, "state.json"), "utf8")) as StateFile;
    expect(state.lastSweep).toBe("2026-07-05T05:00:00.000Z");
    expect(state.sweeps).toHaveLength(1);
    expect(state.sweeps[0]!.added).toBe(1);
    expect(state.sweeps[0]!.coverage).toEqual(["launch", "constellation"]);

    const sources = JSON.parse(readFileSync(join(dataDir, "sources.json"), "utf8")) as SourcesFile;
    const iceye = sources.categories.eo_operators!.find((s) => s.name === "ICEYE")!;
    expect(iceye.status).toBe("verified");
    expect(iceye.notes).toContain("[2026-07-05] First successful fetch.");

    // The ledger gains a calibration claim for the lead source's host.
    const ledger = readLedger();
    const src = ledger.sources.find((s) => s.domain === "spacenews.com")!;
    expect(src).toBeDefined();
    expect(src.claims).toHaveLength(1);
    expect(src.claims[0]!.claim).toBe("2026-07-04-rocket-lab-electron-eo-launch");
    expect(src.claims[0]!.snr_at_publication).toBe(2);
    expect(src.claims[0]!.resolution).toBe("unresolved");
    expect(ledger.updated).toBe("2026-07-05T05:00:00.000Z");

    expect(existsSync(draftPath)).toBe(false);
  });

  test("first_party with a .gov host is accepted and scores tier 5", () => {
    const item = baseNewItem({ source_url: "https://www.nasa.gov/press/artemis-award" });
    item.scoring = {
      sources: [{ url: "https://www.nasa.gov/press/artemis-award", outlet: "NASA", class: "official_record" }],
      extraordinary: false,
      crawl: "found_none",
      whitelist: null,
    };
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath, now: new Date("2026-07-05T05:00:00.000Z") });
    expect(result.errors).toEqual([]);
    const added = readItems().items.find((i) => i.source_url.includes("nasa.gov"))!;
    // Direct-source leads are exempt from the found_none penalty: the
    // filing proves its own statement (scorer v2).
    expect(added.snr).toBe(5);
    expect(added.snr_trace.base.tier).toBe(5);
    expect(added.snr_trace.modifiers.some((m) => m.type === "corroboration_none")).toBe(false);
  });

  test("the seismic guardrail forces extraordinary, landing the score at 1", () => {
    // A seismic item with a trade lead is not a verified first-party
    // source, so finalize forces extraordinary regardless of the flag.
    const item = baseNewItem({ impact: "seismic" });
    (item.scoring as { extraordinary: boolean }).extraordinary = false;
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath, now: new Date("2026-07-05T05:00:00.000Z") });
    expect(result.errors).toEqual([]);

    const added = readItems().items.find((i) => i.impact === "seismic")!;
    expect(added.snr).toBe(1);
    expect(added.snr_trace.modifiers.some((m) => m.type === "extraordinary")).toBe(true);
  });

  test("a seismic item at SNR <= 2 still publishes but lands in the review queue", () => {
    const item = baseNewItem({ impact: "seismic" });
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath, now: new Date("2026-07-05T05:00:00.000Z") });
    expect(result.ok).toBe(true);

    // Published.
    const added = readItems().items.find((i) => i.impact === "seismic");
    expect(added).toBeDefined();
    // And flagged for Florian.
    const held = readHeld();
    const review = held.held.find((h) => h.reason.includes("SNR_PLAN 7.4"));
    expect(review).toBeDefined();
    expect((review!.candidate as { id: string }).id).toBe(added!.id);
    expect(result.held).toBe(1);
  });

  test("an update attach+bump raises snr, appends history, and records the movement", () => {
    // The existing item is at SNR 5 (base tier 5); make it a corroboratable
    // low item first so the bump has room.
    const items = readItems();
    const it = items.items[0]!;
    it.snr = 3;
    it.snr_trace = {
      base: { tier: 3, source: it.source_url, reason: "trade base" },
      modifiers: [],
      final: 3,
      scorer_version: 1,
    } as (typeof it)["snr_trace"];
    writeFileSync(join(dataDir, "items.json"), JSON.stringify(items, null, 2));

    writeDraft({
      updates: [
        {
          id: existingItem.id,
          patch: {},
          note: "SpaceNews and Reuters both now carry it.",
          attach: [
            { url: "https://reuters.com/iceye-expansion", outlet: "Reuters", class: "mainstream", via: "corroboration" },
          ],
          bump: "corroboration_2plus",
        },
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath, now: new Date("2026-07-05T05:00:00.000Z") });
    expect(result.errors).toEqual([]);

    const patched = readItems().items[0]!;
    expect(patched.snr).toBe(4);
    expect(patched.snr_trace.modifiers.some((m) => m.type === "corroboration_2plus")).toBe(true);
    expect(patched.snr_trace.history).toHaveLength(1);
    expect(patched.snr_trace.history![0]!.from).toBe(3);
    expect(patched.snr_trace.history![0]!.to).toBe(4);
    // Source appended and mirrored into secondary_urls.
    expect(patched.sources!.some((s) => s.url === "https://reuters.com/iceye-expansion")).toBe(true);
    expect(patched.secondary_urls).toContain("https://reuters.com/iceye-expansion");

    const state = readState();
    expect(state.sweeps[0]!.snr_movements).toEqual([
      { id: existingItem.id, from: 3, to: 4, reason: "SpaceNews and Reuters both now carry it." },
    ]);
  });

  test("a bump that hits the ceiling is a no-op and records no movement", () => {
    // Existing item is base tier 5, already at 5: a reinforcement bump is a
    // ceiling no-op (applyModifier returns the same trace).
    writeDraft({
      updates: [
        {
          id: existingItem.id,
          patch: {},
          note: "Another outlet picked it up.",
          bump: "reinforcement",
        },
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath, now: new Date("2026-07-05T05:00:00.000Z") });
    expect(result.errors).toEqual([]);
    const patched = readItems().items[0]!;
    expect(patched.snr).toBe(5);
    expect(patched.snr_trace.modifiers.some((m) => m.type === "reinforcement")).toBe(false);
    const state = readState();
    expect(state.sweeps[0]!.snr_movements).toBeUndefined();
  });

  test("resolveHeld removes a queued entry by exact headline", () => {
    // Seed a held entry, then resolve it in a follow-up draft.
    writeDraft({
      held: [{ candidate: { headline: "Queued rumour about ICEYE" }, reason: "scope call" }],
    });
    expect(finalizeSweep({ dataDir, draftPath }).ok).toBe(true);
    expect(readHeld().held).toHaveLength(1);

    writeDraft({ resolveHeld: ["Queued rumour about ICEYE"] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.errors).toEqual([]);
    expect(readHeld().held).toHaveLength(0);
  });

  test("resolveHeld with an unknown headline rejects the draft", () => {
    writeDraft({ resolveHeld: ["No such entry"] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain('no held entry with candidate.headline "No such entry"');
  });

  test("crawl not_attempted is rejected when the budget covered the event", () => {
    const item = baseNewItem();
    (item.scoring as { crawl: string }).crawl = "not_attempted";
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("not_attempted");
    expect(result.errors.join("\n")).toContain("at most 0 may skip");
  });

  test("crawl not_attempted is allowed only for genuine budget overflow", () => {
    // 9 items vs a budget that covers 8: exactly one may skip.
    const items = Array.from({ length: 9 }, (_, i) => {
      const it = baseNewItem({
        id: `2026-07-04-rocket-lab-item-${i}`,
        source_url: `https://spacenews.com/rocket-lab/report-${i}`,
      });
      (it.scoring as { sources: { url: string }[] }).sources[0]!.url =
        `https://spacenews.com/rocket-lab/report-${i}`;
      return it;
    });
    (items[8]!.scoring as { crawl: string }).crawl = "not_attempted";
    writeDraft({ newItems: items });
    const result = finalizeSweep({ dataDir, draftPath, now: new Date("2026-07-05T05:00:00.000Z") });
    expect(result.errors).toEqual([]);
    expect(result.added).toBe(9);
  });

  test("a new item with an old event date gets NO immediate persistence bump", () => {
    // The persistence clock runs from publication, not the event date: a
    // late-discovered 20-day-old event has not survived any exposure yet.
    const draft = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    draft.newItems[0].date = "2026-06-15";
    draft.newItems[0].id = "2026-06-15-rocket-lab-electron-eo-launch";
    writeFileSync(draftPath, JSON.stringify(draft));
    const now = new Date("2026-07-05T05:00:00.000Z");
    const result = finalizeSweep({ dataDir, draftPath, now });
    expect(result.ok).toBe(true);
    const items = readItems();
    const added = items.items.find((i) => i.id === "2026-06-15-rocket-lab-electron-eo-launch")!;
    expect(added.snr_trace.modifiers.some((m) => m.type === "persistence")).toBe(false);
  });

  test("rescore re-bases the trace, preserves history, records the movement", () => {
    // The existing item sits at snr 5 (first-party fixture trace). Rescore
    // it as a trade lead corroborated by an official record: base 3 + 1 = 4.
    writeDraft({
      updates: [
        {
          id: existingItem.id,
          patch: {},
          note: "official record attached; prior crawl outcome corrected",
          rescore: {
            sources: [
              { url: existingItem.source_url, outlet: "SpaceNews", class: "trade" },
              { url: "https://www.gao.gov/products/gao-26-000000", outlet: "GAO", class: "official_record", via: "corroboration" },
            ],
            extraordinary: false,
            crawl: "found_some",
            whitelist: null,
          },
        },
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.errors).toEqual([]);
    const items = readItems();
    const patched = items.items[0]!;
    expect(patched.snr).toBe(4);
    expect(patched.snr_trace.base.tier).toBe(3);
    expect(patched.snr_trace.modifiers.map((m) => m.type)).toEqual(["corroboration_2plus"]);
    expect(patched.snr_trace.history?.at(-1)).toMatchObject({ from: 5, to: 4 });
    expect(patched.sources!.map((s) => s.class)).toEqual(["trade", "official_record"]);
    expect(patched.secondary_urls).toContain("https://www.gao.gov/products/gao-26-000000");
    const state = readState();
    expect(state.sweeps[0]!.snr_movements).toMatchObject([{ id: existingItem.id, from: 5, to: 4 }]);
  });

  test("rescore and bump together are rejected", () => {
    writeDraft({
      updates: [
        {
          id: existingItem.id,
          patch: {},
          note: "x",
          bump: "reinforcement",
          rescore: {
            sources: [{ url: existingItem.source_url, outlet: "X", class: "trade" }],
            extraordinary: false,
            crawl: "not_attempted",
            whitelist: null,
          },
        },
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("mutually exclusive");
  });

  test("rescore lead must equal the (patched) source_url", () => {
    writeDraft({
      updates: [
        {
          id: existingItem.id,
          patch: {},
          note: "x",
          rescore: {
            sources: [{ url: "https://example.com/other", outlet: "X", class: "trade" }],
            extraordinary: false,
            crawl: "not_attempted",
            whitelist: null,
          },
        },
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("must equal item.source_url");
  });

  test("persistence auto-bumps an item published 15 days ago, once, never above 4", () => {
    // Rewrite the existing item as a 15-days-published SNR-3 (trade) item.
    const items = readItems();
    const it = items.items[0]!;
    it.date = "2026-06-20";
    it.publishDate = "2026-06-20T05:00:00.000Z"; // the persistence clock runs from publication
    it.snr = 3;
    it.snr_trace = {
      base: { tier: 3, source: it.source_url, reason: "trade base" },
      modifiers: [],
      final: 3,
      scorer_version: 1,
    } as (typeof it)["snr_trace"];
    writeFileSync(join(dataDir, "items.json"), JSON.stringify(items, null, 2));

    const now = new Date("2026-07-05T05:00:00.000Z"); // 15 days after 2026-06-20
    writeDraft({});
    const r1 = finalizeSweep({ dataDir, draftPath, now });
    expect(r1.errors).toEqual([]);
    const after1 = readItems().items[0]!;
    expect(after1.snr).toBe(4);
    expect(after1.snr_trace.modifiers.filter((m) => m.type === "persistence")).toHaveLength(1);
    const st1 = readState();
    expect(st1.sweeps[0]!.snr_movements).toEqual([
      { id: existingItem.id, from: 3, to: 4, reason: "persistence: survived uncontested past the window" },
    ]);

    // Rerun: no second persistence modifier, no new movement.
    writeDraft({});
    const r2 = finalizeSweep({ dataDir, draftPath, now });
    expect(r2.errors).toEqual([]);
    const after2 = readItems().items[0]!;
    expect(after2.snr).toBe(4);
    expect(after2.snr_trace.modifiers.filter((m) => m.type === "persistence")).toHaveLength(1);
    const st2 = readState();
    expect(st2.sweeps[1]!.snr_movements).toBeUndefined();
  });

  test("newly coined tags are logged in the sweep entry for review", () => {
    const draft = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    draft.newItems[0].tags = ["smallsat-launch", "wildfire-response"];
    writeFileSync(draftPath, JSON.stringify(draft));
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.errors).toEqual([]);
    const state = JSON.parse(readFileSync(join(dataDir, "state.json"), "utf8")) as StateFile;
    expect(state.sweeps[0]!.new_tags).toEqual(["wildfire-response"]);
  });

  test("an update patches an existing item and keeps id and publishDate", () => {
    writeFileSync(
      draftPath,
      JSON.stringify({
        newItems: [],
        updates: [
          {
            id: existingItem.id,
            patch: {
              impact: "seismic",
              explainer: { why_it_matters: "Updated read: capacity now doubles previous guidance, per the company." },
            },
            note: "Company upgraded the expansion figures.",
          },
        ],
        held: [],
        sourceHealth: [],
        summary: "Updated the ICEYE expansion item with new figures.",
        coverage: ["constellation"],
        discoveryPass: {
          queries: ["a", "b", "c", "d", "e", "f"].map((x) => `test query ${x}`),
          found: 0,
          note: "inline test draft: matrix covered",
        },
      }),
    );
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.errors).toEqual([]);
    expect(result.updated).toBe(1);

    const items = JSON.parse(readFileSync(join(dataDir, "items.json"), "utf8")) as ItemsFile;
    const patched = items.items[0]!;
    expect(patched.id).toBe(existingItem.id);
    expect(patched.publishDate).toBe(existingItem.publishDate);
    expect(patched.impact).toBe("seismic");
    expect(patched.explainer.why_it_matters).toContain("doubles previous guidance");
    expect(patched.explainer.tagline).toBe(existingItem.explainer.tagline);
  });
});

describe("signals-pass gate", () => {
  test("a draft with fetchable signal channels but no signalsPass is rejected", () => {
    seedSignals();
    writeDraft({}); // no signalsPass
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("draft.signalsPass: required object");
  });

  test("no signals.json means no gate (backward compatible)", () => {
    // seedDataDir wrote no signals.json; a draft without signalsPass merges.
    writeDraft({});
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
  });

  test("a valid signalsPass merges and records the outcome on the sweep entry", () => {
    seedSignals();
    writeDraft({
      signalsPass: { checked: [FETCHABLE_URL], xAttempted: 1, note: "checked, nothing new in window" },
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const entry = readState().sweeps.at(-1)!;
    expect(entry.signals).toEqual({ checked: 1, x_attempted: 1, note: "checked, nothing new in window" });
  });

  test("signalsPass listing a URL that is not a fetchable channel is rejected", () => {
    seedSignals();
    writeDraft({
      signalsPass: { checked: ["https://not-a-signal.example/feed"], xAttempted: 0, note: "n/a" },
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("is not a fetchable whitelisted signal");
  });

  test("an empty checked list is legal with a note (honest rotation/unreachable)", () => {
    seedSignals();
    writeDraft({
      signalsPass: { checked: [], xAttempted: 0, note: "narrow re-check, fetchable channels deferred to next full sweep" },
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    expect(readState().sweeps.at(-1)!.signals!.checked).toBe(0);
  });
});

describe("ledger demotion live (effectiveClass in the scoring path)", () => {
  function seedLedgerOverride(): void {
    const ledger: SourceLedgerFile = {
      version: "0.1",
      updated: null,
      sources: [
        { domain: "spacenews.com", class_override: "informal", events: [], claims: [] },
      ],
    };
    writeFileSync(join(dataDir, "source_ledger.json"), JSON.stringify(ledger, null, 2));
  }

  /** Demotion earned by events: 3 strikes against 3 windowed claims (rate 1 >= 1/3). */
  function seedLedgerStrikes(): void {
    const d = (daysAgo: number): string =>
      new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
    const ledger: SourceLedgerFile = {
      version: "0.1",
      updated: null,
      sources: [
        {
          domain: "spacenews.com",
          events: [
            { date: d(10), kind: "strike", claim: "a", reason: "test strike" },
            { date: d(8), kind: "strike", claim: "b", reason: "test strike" },
            { date: d(5), kind: "strike", claim: "c", reason: "test strike" },
          ],
          claims: [
            { claim: "a", date: d(20), snr_at_publication: 3, resolution: "debunked" },
            { claim: "b", date: d(18), snr_at_publication: 3, resolution: "debunked" },
            { claim: "c", date: d(15), snr_at_publication: 3, resolution: "debunked" },
          ],
        },
      ],
    };
    writeFileSync(join(dataDir, "source_ledger.json"), JSON.stringify(ledger, null, 2));
  }

  test("a stored class_override scores the source at the demoted tier", () => {
    seedLedgerOverride();
    writeDraft({ newItems: [baseNewItem()] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const item = readItems().items.find((i) => i.id === baseNewItem().id)!;
    // trade would base at 3 (minus crawl found_none = 2); demoted informal
    // bases at 1 and cannot go below it.
    expect(item.sources![0]!.class).toBe("informal");
    expect(item.snr_trace.base.tier).toBe(1);
    expect(item.snr).toBe(1);
  });

  test("a demotion earned by windowed strikes lowers a trade source to informal", () => {
    seedLedgerStrikes();
    writeDraft({ newItems: [baseNewItem()] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const item = readItems().items.find((i) => i.id === baseNewItem().id)!;
    expect(item.sources![0]!.class).toBe("informal");
    expect(item.snr).toBe(1);
  });

  test("an undemoted source is untouched (control)", () => {
    writeDraft({ newItems: [baseNewItem()] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const item = readItems().items.find((i) => i.id === baseNewItem().id)!;
    expect(item.sources![0]!.class).toBe("trade");
    expect(item.snr_trace.base.tier).toBe(3);
    expect(item.snr).toBe(2); // trade 3, crawl found_none -1
  });

  test("demotion only lowers trade: an informal source under strikes is unchanged", () => {
    seedLedgerStrikes();
    const item = baseNewItem();
    (item.scoring as { sources: { class: string }[] }).sources[0]!.class = "informal";
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const stamped = readItems().items.find((i) => i.id === item.id)!;
    expect(stamped.sources![0]!.class).toBe("informal");
  });
});

describe("dedup-as-code gate (matchDecision in finalize)", () => {
  /** Same company + category as the existing ICEYE item, 2 days later. */
  function collidingItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return baseNewItem({
      id: "2026-07-03-iceye-finland-sar-expansion-two",
      date: "2026-07-03",
      headline: "ICEYE adds a second Gen4 SAR production line in Finland",
      explainer: {
        tagline: "ICEYE says it will add a second Gen4 line.",
        what_happened: "ICEYE announced additional production capacity. The plan was published on its press page.",
        why_it_matters: "More SAR production capacity changes reseller delivery timelines across the market.",
      },
      tags: ["sar", "europe"],
      category: "constellation",
      companies: ["ICEYE"],
      ...overrides,
    });
  }

  test("a new item matching an existing one inside the 7-day window is rejected", () => {
    writeDraft({ newItems: [collidingItem()] });
    const before = snapshotDataFiles();
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("same-event match");
    expect(result.errors.join("\n")).toContain(existingItem.id);
    expect(snapshotDataFiles()).toEqual(before);
  });

  test("an attested distinct event (dedup_distinct) passes and the field is stripped", () => {
    writeDraft({
      newItems: [
        collidingItem({
          dedup_distinct: [
            { id: existingItem.id, reason: "second production line, distinct announcement per ICEYE" },
          ],
        }),
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const stamped = readItems().items.find(
      (i) => i.id === "2026-07-03-iceye-finland-sar-expansion-two",
    )!;
    expect((stamped as unknown as Record<string, unknown>).dedup_distinct).toBeUndefined();
  });

  test("an ack without a reason does not pass the gate", () => {
    writeDraft({
      newItems: [collidingItem({ dedup_distinct: [{ id: existingItem.id, reason: " " }] })],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("same-event match");
  });

  test("same company + category outside the 7-day window is not gated", () => {
    writeDraft({
      newItems: [
        collidingItem({ id: "2026-06-20-iceye-finland-sar-earlier-event", date: "2026-06-20" }),
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
  });

  test("different company inside the window is not gated", () => {
    writeDraft({
      newItems: [collidingItem({ companies: ["Umbra"], id: "2026-07-03-umbra-sar-expansion" })],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
  });
});

describe("commentary kind (audit Phase 4)", () => {
  test("kind defaults to event when the draft omits it", () => {
    writeDraft({ newItems: [baseNewItem()] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    expect(readItems().items.find((i) => i.id === baseNewItem().id)!.kind).toBe("event");
  });

  test("an explicit commentary kind is stamped through", () => {
    writeDraft({ newItems: [baseNewItem({ kind: "commentary" })] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    expect(readItems().items.find((i) => i.id === baseNewItem().id)!.kind).toBe("commentary");
  });

  test("seismic commentary is rejected: impact caps at notable", () => {
    writeDraft({ newItems: [baseNewItem({ kind: "commentary", impact: "seismic" })] });
    const before = snapshotDataFiles();
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("commentary caps at");
    expect(snapshotDataFiles()).toEqual(before);
  });

  test("an unknown kind is rejected", () => {
    writeDraft({ newItems: [baseNewItem({ kind: "hot-take" })] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("kind");
  });
});

describe("sweep-context", () => {
  test("prints now, lastSweep, feedSize, and existing with normId", () => {
    const ctx = buildSweepContext(dataDir, new Date("2026-07-05T05:00:00.000Z"));
    expect(ctx.now).toBe("2026-07-05T05:00:00.000Z");
    expect(ctx.lastSweep).toBe("2026-07-01T12:00:00.000Z");
    expect(ctx.feedSize).toBe(1);
    expect(ctx.existing).toEqual([
      {
        id: existingItem.id,
        normId: "iceye-finland-sar-expansion",
        source_url: existingItem.source_url,
        headline: existingItem.headline,
      },
    ]);
  });
});

describe("discovery-pass gate", () => {
  test("a draft without discoveryPass is rejected", () => {
    writeDraft({ discoveryPass: undefined });
    const before = snapshotDataFiles();
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("discoveryPass: required");
    expect(snapshotDataFiles()).toEqual(before);
  });

  test("fewer than 6 queries is rejected", () => {
    writeDraft({
      discoveryPass: { queries: ["one", "two", "three"], found: 0, note: "too thin" },
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("minimum 6");
  });

  test("a valid pass lands in the sweep log entry", () => {
    writeDraft({});
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const entry = readState().sweeps.at(-1)!;
    expect(entry.discovery).toEqual({
      queries: 6,
      note: "test default: matrix covered, nothing new surfaced",
    });
  });
});

describe("deep-sweep mode stamping", () => {
  test("mode deep in candidates.json lands on the log entry", () => {
    writeFileSync(
      join(dataDir, "candidates.json"),
      JSON.stringify({ $comment: "t", generated_at: "2026-07-08T05:00:00Z", window_start: "2026-07-01T05:00:00Z", mode: "deep", health: [], candidates: [] }),
    );
    writeDraft({});
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    expect(readState().sweeps.at(-1)!.mode).toBe("deep");
  });

  test("normal mode leaves the entry unmarked", () => {
    writeFileSync(
      join(dataDir, "candidates.json"),
      JSON.stringify({ $comment: "t", generated_at: "2026-07-08T05:00:00Z", window_start: "2026-07-06T05:00:00Z", mode: "normal", health: [], candidates: [] }),
    );
    writeDraft({});
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    expect(readState().sweeps.at(-1)!.mode).toBeUndefined();
  });

  test("absent candidates.json means normal (test dataDirs keep working)", () => {
    writeDraft({});
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    expect(readState().sweeps.at(-1)!.mode).toBeUndefined();
  });
});

describe("corroboration-unit collapse (Phase 3)", () => {
  test("two utm variants of one article count as one source end to end", () => {
    writeDraft({
      newItems: [
        baseNewItem({
          scoring: {
            sources: [
              { url: "https://spacenews.com/rocket-lab/launch-report", outlet: "SpaceNews", class: "trade" },
              { url: "https://www.spacenews.com/rocket-lab/launch-report?utm_source=rss", outlet: "SpaceNews", class: "trade" },
            ],
            extraordinary: false,
            crawl: "found_some",
            whitelist: null,
          },
        }),
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const stamped = readItems().items.find((i) => i.id.includes("rocket-lab"))!;
    // One unit: base trade 3, no corroboration bump, one listed source.
    expect(stamped.snr).toBe(3);
    expect(stamped.sources).toHaveLength(1);
    expect(stamped.snr_trace.modifiers.some((m) => m.type === "corroboration_2plus")).toBe(false);
    const entry = readState().sweeps.at(-1)!;
    expect(entry.corroboration_collapses).toEqual([
      {
        id: stamped.id,
        kept: "https://spacenews.com/rocket-lab/launch-report",
        dropped: "https://www.spacenews.com/rocket-lab/launch-report?utm_source=rss",
        rule: "canonical_duplicate",
      },
    ]);
  });

  test("an AP story plus two syndicated rewrites yields one corroboration unit and logs the collapses", () => {
    const TITLE = "Rocket Lab launches Electron mission for confidential EO customer";
    writeDraft({
      newItems: [
        baseNewItem({
          source_url: "https://apnews.com/article/rocket-lab-electron",
          scoring: {
            sources: [
              { url: "https://apnews.com/article/rocket-lab-electron", outlet: "AP", class: "mainstream", title: TITLE },
              { url: "https://syndicated-one.com/wire/rl", outlet: "Syndicated One", class: "mainstream", title: TITLE },
              { url: "https://syndicated-two.com/news/rl", outlet: "Syndicated Two", class: "mainstream", title: TITLE },
            ],
            extraordinary: false,
            crawl: "found_some",
            whitelist: null,
          },
        }),
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const stamped = readItems().items.find((i) => i.id.includes("rocket-lab"))!;
    // One unit despite three domains: no corroboration bump, base mainstream 3.
    expect(stamped.snr).toBe(3);
    expect(stamped.sources).toHaveLength(3); // all stay listed on the item
    expect(stamped.snr_trace.modifiers.some((m) => m.type === "corroboration_2plus")).toBe(false);
    const entry = readState().sweeps.at(-1)!;
    expect(entry.corroboration_collapses!.map((c) => c.rule)).toEqual([
      "wire_rewrite",
      "wire_rewrite",
    ]);
  });

  test("genuinely distinct domains still corroborate, and all-trade coverage sets the mix flag", () => {
    writeDraft({
      newItems: [
        baseNewItem({
          scoring: {
            sources: [
              { url: "https://spacenews.com/rocket-lab/launch-report", outlet: "SpaceNews", class: "trade" },
              { url: "https://payloadspace.com/rocket-lab-electron", outlet: "Payload", class: "trade" },
            ],
            extraordinary: false,
            crawl: "found_some",
            whitelist: null,
          },
        }),
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(true);
    const stamped = readItems().items.find((i) => i.id.includes("rocket-lab"))!;
    expect(stamped.snr).toBe(4); // trade 3 + corroboration_2plus
    expect(stamped.snr_trace.single_class_corroboration).toBe("trade");
    expect(readState().sweeps.at(-1)!.corroboration_collapses).toBeUndefined();
  });
});

describe("alias-aware dedup (Phase 3)", () => {
  test("ISRO and Indian Space Research Organisation dedupe across sweeps via aliases.json", () => {
    // Registry profile + alias map: both names resolve to the slug isro.
    mkdirSync(join(dataDir, "registry", "organizations"), { recursive: true });
    writeFileSync(
      join(dataDir, "registry", "organizations", "isro.json"),
      JSON.stringify({ slug: "isro", name: "ISRO" }, null, 2),
    );
    writeFileSync(
      join(dataDir, "aliases.json"),
      JSON.stringify(
        {
          entities: [
            {
              name: "Indian Space Research Organisation",
              org: "isro",
              aliases: ["ISRO"],
            },
          ],
        },
        null,
        2,
      ),
    );
    // An existing ISRO item from a prior sweep.
    const items = readItems();
    items.items.push({
      ...(existingItem as ItemsFile["items"][number]),
      id: "2026-07-02-isro-pslv-eo-launch",
      date: "2026-07-02",
      headline: "ISRO launches PSLV with a commercial EO payload",
      category: "launch",
      tags: ["india"],
      companies: ["ISRO"],
    });
    writeFileSync(join(dataDir, "items.json"), JSON.stringify(items, null, 2));
    // A new draft for the same event window naming the long form.
    writeDraft({
      newItems: [
        baseNewItem({
          companies: ["Indian Space Research Organisation"],
        }),
      ],
    });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("same-event match");
    expect(result.errors.join("\n")).toContain("2026-07-02-isro-pslv-eo-launch");
  });
});
