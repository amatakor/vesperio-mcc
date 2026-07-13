// Deterministic diff-scope gate for the scheduled agent workflows.
//
// Usage: bun scripts/check-run-diff.ts <sweep|registry>
//
// Asserts that the working tree (git status --porcelain) contains
// changes ONLY under the given run type's allowed paths. Any change
// outside them (workflows, scripts, src code, CLAUDE.md, prompts,
// signals.json, ...) fails the job before build and push, so a
// prompt-injected agent cannot smuggle code or policy edits into a
// data commit. Runs as its own workflow step immediately after the
// agent step; the allowlists mirror what each run's commit step
// stages (plus the transient files the run is expected to leave).

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Entries ending in "/" are directory prefixes; everything else is an
// exact path match.
export const ALLOWED_PATHS: Record<string, readonly string[]> = {
  sweep: [
    "src/data/items.json",
    "src/data/held.json",
    "src/data/state.json",
    "src/data/sources.json",
    "src/data/candidates.json",
    "src/data/source_ledger.json",
    "src/data/signals_suggestions.json",
    "src/data/registry-candidates.json", // crossfeed queue
    "SWEEP_MEMORY.md",
    "SWEEP_MEMORY_ARCHIVE.md", // written pre-agent by rotate-sweep-memory
    "public/img/items/",
    "sweep-draft.json",
  ],
  registry: [
    // mirrors the maintain-registry commit step's staged paths
    "src/data/registry/",
    "public/data/orbits/facilities.json",
    "src/data/source_ledger.json",
    "src/data/signals_suggestions.json",
    "src/data/registry-candidates.json",
  ],
};

export function isAllowedPath(path: string, allowed: readonly string[]): boolean {
  return allowed.some((rule) =>
    rule.endsWith("/") ? path.startsWith(rule) : path === rule,
  );
}

// git status --porcelain quotes paths containing special characters
// (C-style, in double quotes). Unquote conservatively: reject on any
// escape we do not positively recognize, since a gate that guesses is
// worse than one that fails closed.
export function unquotePorcelainPath(raw: string): string {
  if (!raw.startsWith('"')) return raw;
  if (!raw.endsWith('"') || raw.length < 2) {
    throw new Error(`unparseable quoted path: ${raw}`);
  }
  const inner = raw.slice(1, -1);
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = inner[++i];
    if (next === "\\" || next === '"') out += next;
    else if (next === "t") out += "\t";
    else if (next === "n") out += "\n";
    else throw new Error(`unsupported escape \\${next} in path: ${raw}`);
  }
  return out;
}

// Parses `git status --porcelain` (v1) output and returns every path a
// line touches. Rename/copy lines ("R  old -> new") yield both sides.
export function pathsFromStatus(statusOutput: string): string[] {
  const paths: string[] = [];
  for (const line of statusOutput.split("\n")) {
    if (line.trim() === "") continue;
    // XY<space>path — status codes are the first two columns.
    const rest = line.slice(3);
    const xy = line.slice(0, 2);
    if (xy.includes("R") || xy.includes("C")) {
      const sep = rest.indexOf(" -> ");
      if (sep === -1) throw new Error(`unparseable rename line: ${line}`);
      paths.push(unquotePorcelainPath(rest.slice(0, sep)));
      paths.push(unquotePorcelainPath(rest.slice(sep + 4)));
    } else {
      paths.push(unquotePorcelainPath(rest));
    }
  }
  return paths;
}

export function findViolations(
  statusOutput: string,
  allowed: readonly string[],
): string[] {
  return pathsFromStatus(statusOutput).filter((p) => !isAllowedPath(p, allowed));
}

const REGISTRY_PREFIX = "src/data/registry/";

/**
 * Structural registry gate (QC P1-3, 2026-07-13). A registry run may
 * UPDATE existing profiles, never create, delete, or rename them: new
 * entries land only via reviewed PRs. Returns one violation string per
 * registry path whose status is anything but a plain modification.
 */
export function findRegistryStructuralViolations(statusOutput: string): string[] {
  const violations: string[] = [];
  for (const line of statusOutput.split("\n")) {
    if (line.trim() === "") continue;
    const xy = line.slice(0, 2);
    const rest = line.slice(3);
    const paths: string[] = [];
    if (xy.includes("R") || xy.includes("C")) {
      const sep = rest.indexOf(" -> ");
      if (sep === -1) throw new Error(`unparseable rename line: ${line}`);
      paths.push(unquotePorcelainPath(rest.slice(0, sep)));
      paths.push(unquotePorcelainPath(rest.slice(sep + 4)));
    } else {
      paths.push(unquotePorcelainPath(rest));
    }
    if (!paths.some((p) => p.startsWith(REGISTRY_PREFIX))) continue;
    // "M " / " M" / "MM" are plain content modifications; everything else
    // (?? untracked, A added, D deleted, R renamed, C copied) is structural.
    const structural = xy === "??" || /[ADRC]/.test(xy);
    if (structural) {
      for (const p of paths.filter((x) => x.startsWith(REGISTRY_PREFIX))) {
        violations.push(`${p} (status "${xy}": registry entries are only created/deleted/renamed via reviewed PRs)`);
      }
    }
  }
  return violations;
}

/**
 * mcc_read protection (QC 2026-07-13). positioning.mcc_read is the
 * registry's one editorial surface, written only by Florian plus
 * interactive Claude; check-run-diff was file-path granular, so a
 * scheduled run editing a profile could rewrite it unnoticed. Pure
 * comparator: true when the two profile payloads disagree on mcc_read.
 */
export function mccReadChanged(before: unknown, after: unknown): boolean {
  const readOf = (profile: unknown): unknown => {
    if (typeof profile !== "object" || profile === null) return undefined;
    const pos = (profile as Record<string, unknown>).positioning;
    if (typeof pos !== "object" || pos === null) return undefined;
    return (pos as Record<string, unknown>).mcc_read;
  };
  return JSON.stringify(readOf(before) ?? null) !== JSON.stringify(readOf(after) ?? null);
}

if (import.meta.main) {
  const runType = process.argv[2];
  const allowed = runType ? ALLOWED_PATHS[runType] : undefined;
  if (!allowed) {
    console.error(
      `usage: bun scripts/check-run-diff.ts <${Object.keys(ALLOWED_PATHS).join("|")}>`,
    );
    process.exit(2);
  }
  const status = execSync("git status --porcelain", { encoding: "utf8" });
  let violations: string[];
  try {
    violations = findViolations(status, allowed);
  } catch (err) {
    // Fail closed on anything the parser does not positively recognize.
    console.error(`::error::check-run-diff could not parse git status: ${err}`);
    process.exit(1);
  }
  if (violations.length > 0) {
    for (const p of violations) {
      console.error(
        `::error::check-run-diff(${runType}): change outside allowed paths: ${p}`,
      );
    }
    console.error(
      `::error::A ${runType} run may only touch: ${allowed.join(", ")}`,
    );
    process.exit(1);
  }
  // Registry runs get two deeper gates: no structural edits (create/
  // delete/rename of profiles), and no touching positioning.mcc_read
  // (Florian + interactive Claude only) inside otherwise-legal edits.
  if (runType === "registry") {
    let structural: string[];
    try {
      structural = findRegistryStructuralViolations(status);
    } catch (err) {
      console.error(`::error::check-run-diff could not parse git status: ${err}`);
      process.exit(1);
    }
    for (const line of status.split("\n")) {
      if (line.trim() === "") continue;
      const xy = line.slice(0, 2);
      if (xy.includes("R") || xy.includes("C") || xy === "??") continue; // structural, caught above
      const p = unquotePorcelainPath(line.slice(3));
      if (!p.startsWith("src/data/registry/") || !p.endsWith(".json")) continue;
      let before: unknown;
      let after: unknown;
      try {
        before = JSON.parse(execSync(`git show HEAD:"${p}"`, { encoding: "utf8" }));
        after = JSON.parse(readFileSync(p, "utf8"));
      } catch {
        // Unreadable/unparseable on either side is itself suspicious for a
        // modified profile: fail closed.
        structural.push(`${p} (could not compare positioning.mcc_read against HEAD)`);
        continue;
      }
      if (mccReadChanged(before, after)) {
        structural.push(`${p} (positioning.mcc_read changed: that field is written only by Florian and interactive sessions, never scheduled runs)`);
      }
    }
    if (structural.length > 0) {
      for (const v of structural) {
        console.error(`::error::check-run-diff(registry): ${v}`);
      }
      process.exit(1);
    }
  }
  console.log(`check-run-diff(${runType}): working tree within allowed paths.`);
}
