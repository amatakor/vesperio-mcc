/**
 * Unit tests for scripts/registry-suggest.ts: the normalization/merge
 * helpers directly, plus the full run against a temp data dir (items.json
 * + an optional registry/aliases fixture) mirroring the pattern in
 * resolve-claims.test.ts.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeSuggestions,
  mergeSuggestions,
  normalizeCompanyName,
  runRegistrySuggest,
} from "../registry-suggest";
import { loadRegistryIndex } from "../lib/crossfeed";
import type { Item, ItemsFile, RegistrySuggestion, RegistrySuggestionsFile } from "../../src/data/schema";

const TODAY = "2026-09-09";

function makeItem(over: Partial<Item> & { id: string; date: string; companies: string[] }): Item {
  return {
    headline: "TestCo does a thing",
    explainer: {
      tagline: "TestCo did a thing worth logging.",
      what_happened: "TestCo announced a thing. The announcement is linked.",
      why_it_matters: "Things change markets; resellers care about this one.",
    },
    kind: "event",
    tags: ["eo"],
    category: "constellation",
    impact: "notable",
    source_url: "https://example.com/post",
    secondary_urls: [],
    snr: 3,
    snr_trace: {
      base: { tier: 3, source: "https://example.com/post", reason: "test" },
      modifiers: [],
      final: 3,
      scorer_version: 2,
    },
    ...over,
  } as Item;
}

describe("normalizeCompanyName", () => {
  test("collapses whitespace and lowercases the merge key", () => {
    expect(normalizeCompanyName("  Planet   Labs  ").key).toBe("planet labs");
  });

  test("strips one trailing corporate-suffix token", () => {
    expect(normalizeCompanyName("Planet Labs PBC").display).toBe("Planet Labs");
    expect(normalizeCompanyName("Telesat Corp.").display).toBe("Telesat");
    expect(normalizeCompanyName("Something GmbH").display).toBe("Something");
  });

  test("merges 'Planet Labs' and 'Planet Labs PBC' to the same key", () => {
    expect(normalizeCompanyName("Planet Labs").key).toBe(normalizeCompanyName("Planet Labs PBC").key);
  });
});

describe("computeSuggestions (threshold and window)", () => {
  const emptyIndex = loadRegistryIndex(mkdtempSync(join(tmpdir(), "mcc-empty-registry-")));

  test("a name on a single item does not qualify", () => {
    const items = [makeItem({ id: "2026-09-01-a", date: "2026-09-01", companies: ["Planet Labs"] })];
    expect(computeSuggestions(items, emptyIndex, TODAY)).toEqual([]);
  });

  test("a name on 2+ items within the window qualifies", () => {
    const items = [
      makeItem({ id: "2026-09-01-a", date: "2026-09-01", companies: ["Planet Labs"] }),
      makeItem({ id: "2026-08-01-b", date: "2026-08-01", companies: ["Planet Labs"] }),
    ];
    const out = computeSuggestions(items, emptyIndex, TODAY);
    expect(out.length).toBe(1);
    expect(out[0]!.name).toBe("Planet Labs");
    expect(out[0]!.item_count).toBe(2);
  });

  test("an item mentioning the same company twice counts once", () => {
    const items = [
      makeItem({ id: "2026-09-01-a", date: "2026-09-01", companies: ["Planet Labs", "Planet Labs"] }),
    ];
    expect(computeSuggestions(items, emptyIndex, TODAY)).toEqual([]);
  });

  test("an item older than 90 days falls outside the window", () => {
    const items = [
      makeItem({ id: "2026-09-01-a", date: "2026-09-01", companies: ["Planet Labs"] }),
      // 2026-06-01 is > 90 days before 2026-09-09.
      makeItem({ id: "2026-06-01-b", date: "2026-06-01", companies: ["Planet Labs"] }),
    ];
    expect(computeSuggestions(items, emptyIndex, TODAY)).toEqual([]);
  });

  test("an item exactly at the 90-day boundary still counts", () => {
    // 2026-06-11 is exactly 90 days before 2026-09-09.
    const items = [
      makeItem({ id: "2026-09-01-a", date: "2026-09-01", companies: ["Planet Labs"] }),
      makeItem({ id: "2026-06-11-b", date: "2026-06-11", companies: ["Planet Labs"] }),
    ];
    const out = computeSuggestions(items, emptyIndex, TODAY);
    expect(out.length).toBe(1);
    expect(out[0]!.item_count).toBe(2);
    expect(out[0]!.first_seen).toBe("2026-06-11");
    expect(out[0]!.last_seen).toBe("2026-09-01");
  });

  test("normalization merges 'Planet Labs' and 'Planet Labs PBC' into one suggestion", () => {
    const items = [
      makeItem({ id: "2026-09-01-a", date: "2026-09-01", companies: ["Planet Labs"] }),
      makeItem({ id: "2026-08-01-b", date: "2026-08-01", companies: ["Planet Labs PBC"] }),
    ];
    const out = computeSuggestions(items, emptyIndex, TODAY);
    expect(out.length).toBe(1);
    expect(out[0]!.item_count).toBe(2);
    // majority display: one vote each, alphabetical tiebreak picks "Planet Labs".
    expect(out[0]!.name).toBe("Planet Labs");
  });

  test("a company that resolves in the registry index is never suggested", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcc-registry-fixture-"));
    mkdirSync(join(dir, "registry", "organizations"), { recursive: true });
    writeFileSync(
      join(dir, "registry", "organizations", "rocket-lab.json"),
      JSON.stringify({ slug: "rocket-lab", name: "Rocket Lab" }),
    );
    const index = loadRegistryIndex(dir);
    const items = [
      makeItem({ id: "2026-09-01-a", date: "2026-09-01", companies: ["Rocket Lab"] }),
      makeItem({ id: "2026-08-01-b", date: "2026-08-01", companies: ["Rocket Lab"] }),
    ];
    expect(computeSuggestions(items, index, TODAY)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  test("categories tally per qualifying item", () => {
    const items = [
      makeItem({ id: "2026-09-01-a", date: "2026-09-01", companies: ["Telesat"], category: "financial" }),
      makeItem({ id: "2026-08-01-b", date: "2026-08-01", companies: ["Telesat"], category: "constellation" }),
      makeItem({ id: "2026-07-15-c", date: "2026-07-15", companies: ["Telesat"], category: "constellation" }),
    ];
    const out = computeSuggestions(items, emptyIndex, TODAY);
    expect(out[0]!.categories).toEqual({ financial: 1, constellation: 2 });
  });

  test("item_ids caps at 10, newest first", () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      makeItem({
        id: `2026-08-${String(i + 1).padStart(2, "0")}-c${i}`,
        date: `2026-08-${String(i + 1).padStart(2, "0")}`,
        companies: ["Viasat"],
      }),
    );
    const out = computeSuggestions(items, emptyIndex, TODAY);
    expect(out[0]!.item_count).toBe(12);
    expect(out[0]!.item_ids.length).toBe(10);
    expect(out[0]!.item_ids[0]).toBe("2026-08-12-c11");
  });
});

describe("mergeSuggestions (status preservation)", () => {
  function fresh(name: string, item_count = 2): RegistrySuggestion {
    return {
      name,
      item_count,
      first_seen: "2026-08-01",
      last_seen: "2026-09-01",
      item_ids: ["a", "b"],
      categories: { constellation: item_count },
      status: "pending",
    };
  }

  test("a still-qualifying entry keeps a prior 'dismissed' status instead of resetting to pending", () => {
    const previous: RegistrySuggestion[] = [{ ...fresh("Planet Labs"), status: "dismissed" }];
    const out = mergeSuggestions([fresh("Planet Labs")], previous);
    expect(out.length).toBe(1);
    expect(out[0]!.status).toBe("dismissed");
    expect(out[0]!.item_count).toBe(2); // counts still recomputed
  });

  test("a still-qualifying entry keeps a prior 'created' status", () => {
    const previous: RegistrySuggestion[] = [{ ...fresh("Telesat"), status: "created" }];
    const out = mergeSuggestions([fresh("Telesat", 5)], previous);
    expect(out[0]!.status).toBe("created");
    expect(out[0]!.item_count).toBe(5);
  });

  test("a still-qualifying entry with a prior 'pending' status stays pending", () => {
    const previous: RegistrySuggestion[] = [{ ...fresh("SES"), status: "pending" }];
    const out = mergeSuggestions([fresh("SES", 3)], previous);
    expect(out[0]!.status).toBe("pending");
  });

  test("a no-longer-qualifying 'pending' entry is dropped", () => {
    const previous: RegistrySuggestion[] = [{ ...fresh("Viasat"), status: "pending" }];
    const out = mergeSuggestions([], previous);
    expect(out).toEqual([]);
  });

  test("a no-longer-qualifying 'dismissed' entry is carried over unchanged", () => {
    const dismissed: RegistrySuggestion = { ...fresh("Kuiper"), status: "dismissed" };
    const out = mergeSuggestions([], [dismissed]);
    expect(out).toEqual([dismissed]);
  });

  test("a no-longer-qualifying 'created' entry is carried over unchanged", () => {
    const created: RegistrySuggestion = { ...fresh("OneWeb"), status: "created" };
    const out = mergeSuggestions([], [created]);
    expect(out).toEqual([created]);
  });

  test("matches by normalized name, not exact string", () => {
    const previous: RegistrySuggestion[] = [{ ...fresh("Planet Labs PBC"), status: "dismissed" }];
    const out = mergeSuggestions([fresh("Planet Labs")], previous);
    expect(out[0]!.status).toBe("dismissed");
    expect(out[0]!.name).toBe("Planet Labs"); // fresh display wins, only status carries
  });
});

describe("runRegistrySuggest (integration)", () => {
  let dir: string;
  let dataDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mcc-registry-suggest-test-"));
    dataDir = join(dir, "data");
    mkdirSync(dataDir);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function seedItems(items: Item[]): void {
    const file: ItemsFile = { items };
    writeFileSync(join(dataDir, "items.json"), JSON.stringify(file, null, 2));
  }

  test("writes registry_suggestions.json sorted by item_count desc, last_seen desc", () => {
    seedItems([
      makeItem({ id: "2026-09-01-a", date: "2026-09-01", companies: ["Telesat"] }),
      makeItem({ id: "2026-08-01-b", date: "2026-08-01", companies: ["Telesat"] }),
      makeItem({ id: "2026-08-15-c", date: "2026-08-15", companies: ["SES"] }),
      makeItem({ id: "2026-08-20-d", date: "2026-08-20", companies: ["SES"] }),
      makeItem({ id: "2026-08-25-e", date: "2026-08-25", companies: ["SES"] }),
    ]);
    const r = runRegistrySuggest(dataDir, TODAY);
    expect(r.suggestions.map((s) => s.name)).toEqual(["SES", "Telesat"]);
    expect(r.added).toEqual(["SES", "Telesat"]);
    const written = JSON.parse(
      readFileSync(join(dataDir, "registry_suggestions.json"), "utf8"),
    ) as RegistrySuggestionsFile;
    expect(written.version).toBe("0.1");
    expect(written.suggestions.length).toBe(2);
    expect(typeof written.$comment).toBe("string");
  });

  test("rerunning preserves a hand-set 'dismissed' status", () => {
    seedItems([
      makeItem({ id: "2026-09-01-a", date: "2026-09-01", companies: ["Telesat"] }),
      makeItem({ id: "2026-08-01-b", date: "2026-08-01", companies: ["Telesat"] }),
    ]);
    runRegistrySuggest(dataDir, TODAY);

    // Florian reviews and dismisses it by hand.
    const path = join(dataDir, "registry_suggestions.json");
    const file = JSON.parse(readFileSync(path, "utf8")) as RegistrySuggestionsFile;
    file.suggestions[0]!.status = "dismissed";
    writeFileSync(path, JSON.stringify(file, null, 2));

    // A later sweep adds a third Telesat item; rerun recomputes counts.
    seedItems([
      makeItem({ id: "2026-09-01-a", date: "2026-09-01", companies: ["Telesat"] }),
      makeItem({ id: "2026-08-01-b", date: "2026-08-01", companies: ["Telesat"] }),
      makeItem({ id: "2026-09-05-c", date: "2026-09-05", companies: ["Telesat"] }),
    ]);
    const r2 = runRegistrySuggest(dataDir, TODAY);
    expect(r2.suggestions.length).toBe(1);
    expect(r2.suggestions[0]!.status).toBe("dismissed");
    expect(r2.suggestions[0]!.item_count).toBe(3);
    expect(r2.added).toEqual([]);
  });

  test("rerunning drops a 'pending' suggestion whose items fell out of the window", () => {
    seedItems([
      makeItem({ id: "2026-06-01-a", date: "2026-06-01", companies: ["Kuiper"] }),
      makeItem({ id: "2026-06-05-b", date: "2026-06-05", companies: ["Kuiper"] }),
    ]);
    const r1 = runRegistrySuggest(dataDir, "2026-06-10");
    expect(r1.suggestions.length).toBe(1);

    // Same items, but "today" has moved past the 90-day window.
    const r2 = runRegistrySuggest(dataDir, TODAY);
    expect(r2.suggestions).toEqual([]);
    expect(r2.dropped).toEqual(["Kuiper"]);
  });
});
