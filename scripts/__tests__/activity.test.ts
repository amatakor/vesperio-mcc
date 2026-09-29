import { describe, expect, test } from "bun:test";
import { cardNote, feedRowKey, feedRows, updateEntries } from "../../src/lib/activity";
import type { Item } from "../../src/data/schema";

function item(over: Partial<Item>): Item {
  return {
    id: "2026-06-29-x",
    date: "2026-06-29",
    publishDate: "2026-06-29T10:00:00.000Z",
    headline: "X",
    explainer: { tagline: "t", what_happened: "w", why_it_matters: "y" },
    kind: "event",
    tags: [],
    category: "financial",
    impact: "notable",
    companies: [],
    source_url: "https://a.example/1",
    secondary_urls: [],
    snr: 4,
    snr_trace: { base: { tier: 4, source: "https://a.example/1", reason: "r" }, modifiers: [], final: 4, scorer_version: 2 },
    sources: [{ url: "https://a.example/1", outlet: "A", class: "trade", added: "2026-06-29", via: "initial" }],
    ...over,
  } as Item;
}

describe("cardNote", () => {
  test("keeps abbreviations whole and stops at the first real sentence end", () => {
    expect(cardNote("DOJ's own Sept. 22 release confirms the Sept. 21 ruling. More follows.")).toBe(
      "DOJ's own Sept. 22 release confirms the Sept. 21 ruling.",
    );
    expect(cardNote("US District Judge Fernando Rodriguez Jr. denied the request.")).toBe(
      "US District Judge Fernando Rodriguez Jr. denied the request.",
    );
  });
});

describe("feed rows (2026-09-23: updates are their own rows; items never move)", () => {
  test("an attach-only update makes no row", () => {
    const i = item({ updates: [{ date: "2026-09-23", kind: "attach", note: "Two forum pages attached." }] });
    const rows = feedRows([i]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("item");
    expect(updateEntries(i)).toEqual([]);
  });

  test("a copy update becomes a row dated by the update, ahead of newer items", () => {
    const old = item({ updates: [{ date: "2026-09-23", kind: "copy", note: "The deal closed on 22 September." }] });
    const newer = item({ id: "2026-09-20-y", date: "2026-09-20", publishDate: "2026-09-20T10:00:00.000Z" });
    const rows = feedRows([old, newer]);
    expect(rows.map((r) => `${r.kind}:${r.date}`)).toEqual(["update:2026-09-23", "item:2026-09-20", "item:2026-06-29"]);
    expect(feedRowKey(rows[0]!)).toBe("2026-06-29-x@2026-09-23");
  });

  test("a score update carries from/to; legacy history moves count once", () => {
    const i = item({
      snr_trace: {
        base: { tier: 4, source: "https://a.example/1", reason: "r" },
        modifiers: [],
        final: 5,
        scorer_version: 2,
        history: [
          { date: "2026-07-13", from: 4, to: 5, reason: "persistence window: 14 uncontested days" },
          { date: "2026-09-22", from: 4, to: 5, reason: "DOJ confirms the ruling in its own release." },
        ],
      },
      updates: [{ date: "2026-09-22", kind: "score", note: "DOJ confirms the ruling in its own release.", score: { from: 4, to: 5 } }],
    });
    const e = updateEntries(i);
    expect(e).toHaveLength(1);
    expect(e[0]!.score).toEqual({ from: 4, to: 5 });
    expect(feedRows([i]).map((r) => r.kind)).toEqual(["update", "item"]);
  });
});
