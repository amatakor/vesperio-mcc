import { describe, expect, test } from "bun:test";
import { parseRanking, resultText } from "../extract-judge-ranking";

const RANKING_JSON =
  '{"2026-07-17-item-a": {"order": ["a.cand-1.webp", "a.cand-0.webp"], "reason": "real photo beats logo"}}';

describe("resultText execution-output parsing", () => {
  test("finds the last result message in a JSON array", () => {
    const raw = JSON.stringify([
      { type: "system", subtype: "init" },
      { type: "assistant", message: {} },
      { type: "result", subtype: "success", result: RANKING_JSON },
    ]);
    expect(resultText(raw)).toBe(RANKING_JSON);
  });

  test("handles a single result object", () => {
    expect(resultText(JSON.stringify({ type: "result", result: RANKING_JSON }))).toBe(RANKING_JSON);
  });

  test("handles NDJSON, one message per line", () => {
    const raw = [
      JSON.stringify({ type: "system" }),
      JSON.stringify({ type: "result", result: RANKING_JSON }),
    ].join("\n");
    expect(resultText(raw)).toBe(RANKING_JSON);
  });

  test("null when no result message exists", () => {
    expect(resultText(JSON.stringify([{ type: "assistant" }]))).toBeNull();
    expect(resultText("not json at all")).toBeNull();
  });
});

describe("parseRanking validation", () => {
  test("parses a bare JSON object", () => {
    const r = parseRanking(RANKING_JSON);
    expect(r).not.toBeNull();
    expect(r!["2026-07-17-item-a"]!.order).toEqual(["a.cand-1.webp", "a.cand-0.webp"]);
    expect(r!["2026-07-17-item-a"]!.reason).toBe("real photo beats logo");
  });

  test("tolerates prose and code fences around the JSON", () => {
    const wrapped = "Here is the ranking:\n```json\n" + RANKING_JSON + "\n```\nDone.";
    expect(parseRanking(wrapped)).not.toBeNull();
  });

  test("drops entries without a valid order array, keeps the rest", () => {
    const mixed = JSON.stringify({
      good: { order: ["x.webp"] },
      "bad-order": { order: "x.webp" },
      "bad-shape": 42,
    });
    const r = parseRanking(mixed);
    expect(Object.keys(r!)).toEqual(["good"]);
  });

  test("null when nothing valid remains", () => {
    expect(parseRanking("no braces here")).toBeNull();
    expect(parseRanking('{"a": {"order": 1}}')).toBeNull();
    expect(parseRanking('["not", "an", "object"]')).toBeNull();
  });
});
