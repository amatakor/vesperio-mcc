/**
 * Atomic JSON writer tests (plan Phase 8, should-fix 6). The kill-test
 * proves the safety property that motivates the whole change: when a write
 * fails mid-flight, the pre-existing file must survive intact and no temp
 * file may be left behind.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeJsonAtomic } from "../lib/write-json-atomic";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "write-json-atomic-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("writeJsonAtomic", () => {
  test("normal write round-trips with pretty indent and trailing newline", () => {
    const path = join(dir, "out.json");
    const data = { b: 2, a: [1, 2, 3], nested: { x: true } };
    writeJsonAtomic(path, data);
    const raw = readFileSync(path, "utf8");
    expect(raw).toBe(JSON.stringify(data, null, 2) + "\n");
    expect(JSON.parse(raw)).toEqual(data);
    expect(readdirSync(dir)).toEqual(["out.json"]);
  });

  test("indent 0 writes the compact single-line form", () => {
    const path = join(dir, "compact.json");
    const data = { a: 1, b: 2 };
    writeJsonAtomic(path, data, 0);
    expect(readFileSync(path, "utf8")).toBe(JSON.stringify(data) + "\n");
  });

  test("a failed write leaves the original file intact and no temp litter", () => {
    const path = join(dir, "kept.json");
    const original = JSON.stringify({ safe: true }, null, 2) + "\n";
    writeFileSync(path, original);

    // A BigInt makes JSON.stringify throw, failing the write mid-flight.
    const poison = { n: 10n };
    expect(() => writeJsonAtomic(path, poison)).toThrow();

    expect(readFileSync(path, "utf8")).toBe(original);
    expect(readdirSync(dir)).toEqual(["kept.json"]);
    expect(existsSync(`${path}.tmp.${process.pid}`)).toBe(false);
  });
});
