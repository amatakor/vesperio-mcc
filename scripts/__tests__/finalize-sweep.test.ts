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
      crawl: "not_attempted",
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
      ...body,
    }),
  );
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
      crawl: "not_attempted",
      whitelist: null,
    };
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("reclassify");
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
});

describe("finalize-sweep merge", () => {
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
    // A single trade lead scores base tier 3, no modifiers.
    expect(added.snr).toBe(3);
    expect(added.snr_trace.base.tier).toBe(3);
    expect(added.snr_trace.modifiers).toEqual([]);
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
    expect(src.claims[0]!.snr_at_publication).toBe(3);
    expect(src.claims[0]!.resolution).toBe("unresolved");
    expect(ledger.updated).toBe("2026-07-05T05:00:00.000Z");

    expect(existsSync(draftPath)).toBe(false);
  });

  test("first_party with a .gov host is accepted and scores tier 5", () => {
    const item = baseNewItem({ source_url: "https://www.nasa.gov/press/artemis-award" });
    item.scoring = {
      sources: [{ url: "https://www.nasa.gov/press/artemis-award", outlet: "NASA", class: "official_record" }],
      extraordinary: false,
      crawl: "not_attempted",
      whitelist: null,
    };
    writeDraft({ newItems: [item] });
    const result = finalizeSweep({ dataDir, draftPath, now: new Date("2026-07-05T05:00:00.000Z") });
    expect(result.errors).toEqual([]);
    const added = readItems().items.find((i) => i.source_url.includes("nasa.gov"))!;
    expect(added.snr).toBe(5);
    expect(added.snr_trace.base.tier).toBe(5);
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

  test("persistence auto-bumps a 15-day-old snr-3 item once, and never above 4", () => {
    // Rewrite the existing item as a 15-day-old SNR-3 (trade) item.
    const items = readItems();
    const it = items.items[0]!;
    it.date = "2026-06-20";
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
