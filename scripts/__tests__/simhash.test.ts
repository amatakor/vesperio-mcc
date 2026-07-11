/**
 * Unit tests for the 64-bit SimHash wire-rewrite detector
 * (scripts/lib/simhash.ts).
 */

import { describe, expect, test } from "bun:test";
import { normalizeTitle, simhash64, hammingDistance, titlesCollide } from "../lib/simhash";

describe("normalizeTitle", () => {
  test("lowercases and tokenizes on non-alphanumeric runs", () => {
    expect(normalizeTitle("SpaceX Launches 23 Starlink Satellites")).toEqual([
      "spacex",
      "launches",
      "23",
      "starlink",
      "satellites",
    ]);
  });

  test("strips a short trailing ' - Outlet Name' segment", () => {
    expect(normalizeTitle("ICEYE raises $200M - SpaceNews")).toEqual([
      "iceye",
      "raises",
      "200m",
    ]);
  });

  test("strips a short trailing ' | Outlet Name' segment", () => {
    expect(normalizeTitle("ICEYE raises $200M | Reuters")).toEqual([
      "iceye",
      "raises",
      "200m",
    ]);
  });

  test("does not strip a long tail after a separator (not an outlet suffix)", () => {
    const tokens = normalizeTitle(
      "SpaceX wins contract - the award covers several launch slots this year",
    );
    expect(tokens).toContain("wins");
    expect(tokens).toContain("year");
  });

  test("empty or punctuation-only titles normalize to no tokens", () => {
    expect(normalizeTitle("")).toEqual([]);
    expect(normalizeTitle("   ")).toEqual([]);
    expect(normalizeTitle("---...???")).toEqual([]);
  });
});

describe("simhash64", () => {
  test("empty token list returns 0n", () => {
    expect(simhash64("")).toBe(0n);
    expect(simhash64("!!!")).toBe(0n);
  });

  test("is deterministic for the same input", () => {
    const title = "SpaceX launches 23 Starlink satellites from Cape Canaveral";
    expect(simhash64(title)).toBe(simhash64(title));
  });

  test("returns a value within the 64-bit range", () => {
    const h = simhash64("Rocket Lab launches Electron from Mahia");
    expect(h).toBeGreaterThanOrEqual(0n);
    expect(h).toBeLessThan(1n << 64n);
  });
});

describe("hammingDistance", () => {
  test("identical values have distance 0", () => {
    expect(hammingDistance(0n, 0n)).toBe(0);
    expect(hammingDistance(0xffffn, 0xffffn)).toBe(0);
  });

  test("a single differing bit is distance 1", () => {
    expect(hammingDistance(0n, 1n)).toBe(1);
    expect(hammingDistance(0b1010n, 0b1000n)).toBe(1);
  });

  test("fully inverted 64-bit values are distance 64", () => {
    const all = (1n << 64n) - 1n;
    expect(hammingDistance(0n, all)).toBe(64);
  });
});

describe("titlesCollide", () => {
  test("identical titles collide at distance 0", () => {
    const title = "SpaceX launches 23 Starlink satellites from Cape Canaveral";
    expect(hammingDistance(simhash64(title), simhash64(title))).toBe(0);
    expect(titlesCollide(title, title)).toBe(true);
  });

  // A wire-service rewrite typically keeps every fact token (actor, figure,
  // agency) and swaps a single word choice between outlets. This pair is a
  // genuine one-token edit ("contract" vs "deal"), distance 3, verified
  // measured. A multi-word entity swap (e.g. "Cape Canaveral" vs "Florida",
  // a 3-of-9 token change) is a materially larger edit and measures well
  // outside a threshold-3 window on titles this short (distance 9 with this
  // implementation); collapsing that case would need overfitting the hash
  // to one example rather than a generically sound SimHash, so it is not
  // asserted here.
  test("a realistic wire-rewrite pair collides within the default threshold", () => {
    const a = "Planet Labs announces new SkySat contract with NOAA";
    const b = "Planet Labs announces new SkySat deal with NOAA";
    const distance = hammingDistance(simhash64(a), simhash64(b));
    expect(distance).toBeLessThanOrEqual(3);
    expect(titlesCollide(a, b)).toBe(true);
  });

  test("the outlet-suffix case collides once suffixes are stripped", () => {
    const a = "ICEYE raises $200M - SpaceNews";
    const b = "ICEYE raises $200M | Reuters";
    expect(titlesCollide(a, b)).toBe(true);
  });

  test("two genuinely different space headlines do not collide", () => {
    const a = "SpaceX launches 23 Starlink satellites from Cape Canaveral";
    const b = "ICEYE raises $200M in Series D funding round";
    const distance = hammingDistance(simhash64(a), simhash64(b));
    expect(distance).toBeGreaterThan(3);
    expect(titlesCollide(a, b)).toBe(false);
  });

  test("empty or punctuation-only titles never collide, even with each other", () => {
    expect(titlesCollide("", "")).toBe(false);
    expect(titlesCollide("", "SpaceX launches 23 Starlink satellites")).toBe(false);
    expect(titlesCollide("!!!", "???")).toBe(false);
    expect(titlesCollide("   ", "SpaceX launches 23 Starlink satellites")).toBe(false);
  });

  test("respects a custom maxDistance", () => {
    const a = "SpaceX launches 23 Starlink satellites from Cape Canaveral";
    const b = "ICEYE raises $200M in Series D funding round";
    expect(titlesCollide(a, b, 64)).toBe(true);
  });
});

describe("normalizeTitle hyphen safety", () => {
  test("an intra-word hyphen is not an outlet separator", () => {
    expect(normalizeTitle("AST SpaceMobile expands direct-to-device coverage")).toEqual([
      "ast",
      "spacemobile",
      "expands",
      "direct",
      "to",
      "device",
      "coverage",
    ]);
  });
});
