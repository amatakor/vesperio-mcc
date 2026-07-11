import { describe, expect, test } from "bun:test";
import {
  ALLOWED_PATHS,
  findViolations,
  isAllowedPath,
  pathsFromStatus,
  unquotePorcelainPath,
} from "../check-run-diff";

const SWEEP = ALLOWED_PATHS.sweep;
const REGISTRY = ALLOWED_PATHS.registry;

describe("isAllowedPath", () => {
  test("exact file matches", () => {
    expect(isAllowedPath("src/data/items.json", SWEEP)).toBe(true);
    expect(isAllowedPath("SWEEP_MEMORY.md", SWEEP)).toBe(true);
    expect(isAllowedPath("sweep-draft.json", SWEEP)).toBe(true);
  });

  test("directory prefix matches files beneath it", () => {
    expect(isAllowedPath("public/img/items/2026-07-11-foo.jpg", SWEEP)).toBe(true);
    expect(isAllowedPath("src/data/registry/constellations/iceye.json", REGISTRY)).toBe(true);
  });

  test("a prefix rule does not match sibling paths sharing the string", () => {
    // "public/img/items/" must not match "public/img/items-evil.png"
    expect(isAllowedPath("public/img/items-evil.png", SWEEP)).toBe(false);
    expect(isAllowedPath("src/data/registry-extra/x.json", REGISTRY)).toBe(false);
  });

  test("an exact rule does not match paths beneath a same-named directory", () => {
    expect(isAllowedPath("src/data/items.json/nested", SWEEP)).toBe(false);
  });

  test("hostile targets are rejected for both run types", () => {
    for (const p of [
      ".github/workflows/x.yml",
      ".github/workflows/update-items.yml",
      "scripts/finalize-sweep.ts",
      "scripts/snr/score.ts",
      "src/pages.tsx",
      "CLAUDE.md",
      "prompts/update-items.md",
      "src/data/signals.json",
      "package.json",
    ]) {
      expect(isAllowedPath(p, SWEEP)).toBe(false);
      expect(isAllowedPath(p, REGISTRY)).toBe(false);
    }
  });

  test("sweep paths are not registry paths and vice versa", () => {
    expect(isAllowedPath("src/data/items.json", REGISTRY)).toBe(false);
    expect(isAllowedPath("SWEEP_MEMORY.md", REGISTRY)).toBe(false);
    expect(isAllowedPath("src/data/registry/vehicles/falcon-9.json", SWEEP)).toBe(false);
    // shared: the crossfeed queue and the ledger files
    expect(isAllowedPath("src/data/registry-candidates.json", SWEEP)).toBe(true);
    expect(isAllowedPath("src/data/registry-candidates.json", REGISTRY)).toBe(true);
  });
});

describe("pathsFromStatus", () => {
  test("parses modified, added, deleted, and untracked lines", () => {
    const status = [
      " M src/data/items.json",
      "A  src/data/held.json",
      " D SWEEP_MEMORY.md",
      "?? sweep-draft.json",
    ].join("\n");
    expect(pathsFromStatus(status)).toEqual([
      "src/data/items.json",
      "src/data/held.json",
      "SWEEP_MEMORY.md",
      "sweep-draft.json",
    ]);
  });

  test("rename lines yield both sides", () => {
    const status = "R  src/data/items.json -> scripts/evil.ts";
    expect(pathsFromStatus(status)).toEqual([
      "src/data/items.json",
      "scripts/evil.ts",
    ]);
  });

  test("untracked directory lines keep their trailing slash for prefix checks", () => {
    expect(pathsFromStatus("?? public/img/items/")).toEqual(["public/img/items/"]);
    expect(isAllowedPath("public/img/items/", SWEEP)).toBe(true);
  });

  test("quoted paths with escapes are unquoted", () => {
    expect(unquotePorcelainPath('"a b.json"')).toBe("a b.json");
    expect(unquotePorcelainPath('"a\\"b"')).toBe('a"b');
    expect(unquotePorcelainPath('"a\\\\b"')).toBe("a\\b");
    expect(pathsFromStatus('?? "public/img/items/a b.jpg"')).toEqual([
      "public/img/items/a b.jpg",
    ]);
  });

  test("fails closed on unrecognized escapes", () => {
    expect(() => unquotePorcelainPath('"a\\x41"')).toThrow();
  });

  test("blank lines are ignored", () => {
    expect(pathsFromStatus("\n \n")).toEqual([]);
  });
});

describe("findViolations", () => {
  test("a clean sweep tree passes", () => {
    const status = [
      " M src/data/items.json",
      " M src/data/state.json",
      " M src/data/sources.json",
      " M src/data/candidates.json",
      " M SWEEP_MEMORY.md",
      "?? public/img/items/2026-07-11-x.jpg",
      "?? sweep-draft.json",
    ].join("\n");
    expect(findViolations(status, SWEEP)).toEqual([]);
  });

  test("the simulated hostile edit hard-fails", () => {
    const status = [
      " M src/data/items.json",
      "?? .github/workflows/x.yml",
    ].join("\n");
    expect(findViolations(status, SWEEP)).toEqual([".github/workflows/x.yml"]);
  });

  test("a rename that smuggles data INTO an allowed path still fails on the source side", () => {
    const status = "R  scripts/check-run-diff.ts -> src/data/items.json";
    expect(findViolations(status, SWEEP)).toEqual(["scripts/check-run-diff.ts"]);
  });

  test("empty status passes", () => {
    expect(findViolations("", SWEEP)).toEqual([]);
    expect(findViolations("", REGISTRY)).toEqual([]);
  });
});
