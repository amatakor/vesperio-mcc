/** Shared runner: load JSON files, apply validators, exit non-zero on any violation. */

import { readFileSync } from "node:fs";

export function loadJson(path: string, errors: string[]): unknown {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    errors.push(`${path}: cannot read file`);
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    errors.push(`${path}: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
    return undefined;
  }
}

export function report(name: string, errors: string[]): never {
  if (errors.length > 0) {
    console.error(`${name}: FAIL (${errors.length} error${errors.length === 1 ? "" : "s"})`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  console.log(`${name}: OK`);
  process.exit(0);
}
