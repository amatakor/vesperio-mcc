import { describe, expect, test } from "bun:test";
import { collapseCorroboration } from "../snr/corroboration";
import type { CollapsibleSource } from "../snr/corroboration";

const src = (
  url: string,
  cls: CollapsibleSource["class"],
  title?: string,
): CollapsibleSource => ({
  url,
  outlet: new URL(url).hostname,
  class: cls,
  ...(title !== undefined ? { title } : {}),
});

describe("canonical duplicates", () => {
  test("two utm variants of one article are one source end to end", () => {
    const r = collapseCorroboration([
      src("https://spacenews.com/iceye-order/?utm_source=rss", "trade"),
      src("https://www.spacenews.com/iceye-order/", "trade"),
    ]);
    expect(r.listed).toHaveLength(1);
    expect(r.representatives).toHaveLength(1);
    expect(r.collapses).toEqual([
      {
        kept: "https://spacenews.com/iceye-order/?utm_source=rss",
        dropped: "https://www.spacenews.com/iceye-order/",
        rule: "canonical_duplicate",
      },
    ]);
  });
});

describe("same-domain collapse", () => {
  test("two articles on one registrable domain stay listed but count once", () => {
    const r = collapseCorroboration([
      src("https://spacenews.com/a", "trade"),
      src("https://spacenews.com/b", "trade"),
      src("https://payloadspace.com/c", "trade"),
    ]);
    expect(r.listed).toHaveLength(3);
    expect(r.representatives).toHaveLength(2);
    expect(r.collapses).toEqual([
      { kept: "https://spacenews.com/a", dropped: "https://spacenews.com/b", rule: "same_domain" },
    ]);
  });

  test("subdomains of one registrable domain collapse", () => {
    const r = collapseCorroboration([
      src("https://spacenews.com/a", "trade"),
      src("https://feeds.spacenews.com/b", "trade"),
    ]);
    expect(r.representatives).toHaveLength(1);
  });
});

describe("wire-rewrite collapse", () => {
  const TITLE = "SpaceX launches 23 Starlink satellites from Cape Canaveral";

  test("an AP story plus two syndicated rewrites yields one unit and logs both collapses", () => {
    const r = collapseCorroboration([
      src("https://apnews.com/article/x", "mainstream", TITLE),
      src("https://outlet-one.com/y", "mainstream", TITLE),
      src("https://outlet-two.com/z", "mainstream", TITLE),
    ]);
    expect(r.listed).toHaveLength(3);
    expect(r.representatives).toHaveLength(1);
    expect(r.collapses.map((c) => c.rule)).toEqual(["wire_rewrite", "wire_rewrite"]);
  });

  test("titleless sources never collide", () => {
    const r = collapseCorroboration([
      src("https://apnews.com/article/x", "mainstream"),
      src("https://outlet-one.com/y", "mainstream"),
    ]);
    expect(r.representatives).toHaveLength(2);
  });

  test("distinct stories on distinct domains stay distinct units", () => {
    const r = collapseCorroboration([
      src("https://apnews.com/article/x", "mainstream", TITLE),
      src("https://spacenews.com/y", "trade", "ESA awards IRIDE ground segment contract to Telespazio"),
    ]);
    expect(r.representatives).toHaveLength(2);
    expect(r.collapses).toEqual([]);
  });
});

describe("representatives", () => {
  test("the lead always represents its own unit even when a better class joins it", () => {
    const r = collapseCorroboration([
      src("https://spacenews.com/a", "trade"),
      src("https://spacenews.com/b", "aggregator"),
    ]);
    expect(r.representatives).toHaveLength(1);
    expect(r.representatives[0]!.url).toBe("https://spacenews.com/a");
  });

  test("a non-lead unit is represented by its best class", () => {
    const r = collapseCorroboration([
      src("https://iceye.com/press/x", "first_party"),
      src("https://example-blog.com/a", "informal", "ICEYE wins order"),
      src("https://reuters.com/b", "mainstream", "ICEYE wins order"),
    ]);
    expect(r.representatives).toHaveLength(2);
    expect(r.representatives[0]!.class).toBe("first_party");
    expect(r.representatives[1]!.class).toBe("mainstream");
  });
});

describe("coverage-mix flag", () => {
  test("all-trade corroboration sets singleClass", () => {
    const r = collapseCorroboration([
      src("https://spacenews.com/a", "trade"),
      src("https://payloadspace.com/b", "trade"),
    ]);
    expect(r.singleClass).toBe("trade");
  });

  test("mixed classes clear it, and a lone source never sets it", () => {
    expect(
      collapseCorroboration([
        src("https://spacenews.com/a", "trade"),
        src("https://reuters.com/b", "mainstream"),
      ]).singleClass,
    ).toBeNull();
    expect(collapseCorroboration([src("https://spacenews.com/a", "trade")]).singleClass).toBeNull();
  });
});

describe("edge cases", () => {
  test("empty input", () => {
    const r = collapseCorroboration([]);
    expect(r.listed).toEqual([]);
    expect(r.representatives).toEqual([]);
    expect(r.singleClass).toBeNull();
  });

  test("unparseable URLs never throw and never merge on the empty domain", () => {
    const r = collapseCorroboration([
      src("https://spacenews.com/a", "trade"),
      { url: "not a url", outlet: "x", class: "informal" },
      { url: "also not a url", outlet: "y", class: "informal" },
    ]);
    expect(r.representatives).toHaveLength(3);
  });
});
