import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finalizeSweep } from "../finalize-sweep";
import { buildSweepContext } from "../sweep-context";
import type { ItemsFile, HeldFile, StateFile, SourcesFile } from "../../src/data/schema";

const FIXTURES = join(import.meta.dir, "fixtures");
const DATA_FILES = ["items.json", "held.json", "state.json", "sources.json"] as const;

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
  confidence: "confirmed",
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
  writeFileSync(join(dataDir, "items.json"), JSON.stringify(items, null, 2));
  writeFileSync(join(dataDir, "held.json"), JSON.stringify(held, null, 2));
  writeFileSync(join(dataDir, "state.json"), JSON.stringify(state, null, 2));
  writeFileSync(join(dataDir, "sources.json"), JSON.stringify(sources, null, 2));
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

  test("reported item without an evidence block is rejected", () => {
    const draft = JSON.parse(readFileSync(join(FIXTURES, "draft-valid.json"), "utf8"));
    draft.newItems[0].confidence = "reported";
    draft.newItems[0].headline = "SpaceNews: Rocket Lab books confidential EO launch";
    writeFileSync(draftPath, JSON.stringify(draft));
    const before = snapshotDataFiles();
    const result = finalizeSweep({ dataDir, draftPath });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("evidence");
    expect(snapshotDataFiles()).toEqual(before);
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

    expect(existsSync(draftPath)).toBe(false);
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
              impact: "critical",
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
    expect(patched.impact).toBe("critical");
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
