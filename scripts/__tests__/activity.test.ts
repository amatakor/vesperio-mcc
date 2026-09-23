import { describe, expect, test } from "bun:test";
import { activityAt, freshnessChip, latestUpdateNote, updateEntries } from "../../src/lib/activity";
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

import { cardNote } from "../../src/lib/activity";

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

describe("feed activity (2026-09-23 rule: attachments never resurface)", () => {
  test("an attach-only update leaves the item in its event slot", () => {
    const i = item({
      sources: [
        { url: "https://a.example/1", outlet: "A", class: "trade", added: "2026-06-29", via: "initial" },
        { url: "https://stocktwits.com/x", outlet: "S", class: "informal", added: "2026-09-23", via: "corroboration" },
      ],
      updates: [{ date: "2026-09-23", kind: "attach", note: "Two forum pages attached." }],
    });
    expect(activityAt(i)).toBe("2026-06-29");
    expect(freshnessChip(i)).toBeNull();
    expect(latestUpdateNote(i)).toBeNull();
  });

  test("a copy update resurfaces with its note", () => {
    const i = item({ updates: [{ date: "2026-09-23", kind: "copy", note: "The deal closed on 22 September." }] });
    expect(activityAt(i)).toBe("2026-09-23");
    expect(freshnessChip(i)).toBe("updated 23 Sep");
    expect(latestUpdateNote(i)).toEqual({ day: "23 Sep", note: "The deal closed on 22 September." });
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
    expect(activityAt(i)).toBe("2026-09-22");
  });
});
