/**
 * Deterministic bridge between the sealed artwork judge and --apply
 * (2026-07-18). The judge agent's Write-permission allowlist silently
 * never matched (permission_denials_count in every run since 2026-07-13;
 * the 86d2ba7 respelling did not fix it), so every sweep fell back to
 * og-image-first order and logos kept beating real photographs. Rather
 * than guess at permission-pattern semantics a third time, the judge is
 * now Read-only and returns its ranking as its final message; this
 * script pulls that message out of the action's execution output file
 * and writes .image-judge/ranking.json itself.
 *
 * The seal gets stronger, not weaker: the judge can no longer write ANY
 * file, and --apply still honors only candidate file names present in
 * the staged manifest. On any parse failure this script warns and exits
 * 0; --apply's og-image-first fallback remains the safety net.
 *
 * Usage: bun scripts/extract-judge-ranking.ts [execution-output.json]
 *   Default path: $RUNNER_TEMP/claude-execution-output.json
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeJsonAtomic } from "./lib/write-json-atomic";

const JUDGE_DIR = ".image-judge";

export interface RankingEntry {
  order: string[];
  reason?: string;
}

/** The final assistant text from a claude-code-action execution output
    file: a JSON array (or NDJSON stream) of messages whose last "result"
    message carries it, or a single result object. Null when no result
    text is found. */
export function resultText(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // NDJSON: one message per line.
    parsed = raw
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => {
        try {
          return JSON.parse(l) as unknown;
        } catch {
          return null;
        }
      })
      .filter((m) => m !== null);
  }
  const messages = Array.isArray(parsed) ? parsed : [parsed];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { type?: string; result?: unknown };
    if (m && m.type === "result" && typeof m.result === "string") return m.result;
  }
  return null;
}

/** The ranking object embedded in the judge's final message. Tolerates
    prose or code fences around the JSON: takes the outermost {...} span.
    Entries must be {order: string[]} to survive; anything else is
    dropped. Null when nothing valid remains. */
export function parseRanking(text: string): Record<string, RankingEntry> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const out: Record<string, RankingEntry> = {};
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const { order, reason } = value as { order?: unknown; reason?: unknown };
    if (!Array.isArray(order) || !order.every((f) => typeof f === "string")) continue;
    out[id] = { order, ...(typeof reason === "string" ? { reason } : {}) };
  }
  return Object.keys(out).length > 0 ? out : null;
}

function main(): void {
  const path =
    process.argv[2] ||
    (process.env.RUNNER_TEMP ? join(process.env.RUNNER_TEMP, "claude-execution-output.json") : "");
  if (!existsSync(join(JUDGE_DIR, "manifest.json"))) {
    console.log("extract-judge-ranking: nothing staged; skipping");
    return;
  }
  if (!path || !existsSync(path)) {
    console.log(`::warning::extract-judge-ranking: no execution output at "${path}"; --apply will use fallback order`);
    return;
  }
  const text = resultText(readFileSync(path, "utf8"));
  if (text === null) {
    console.log("::warning::extract-judge-ranking: no result message in execution output; --apply will use fallback order");
    return;
  }
  const ranking = parseRanking(text);
  if (ranking === null) {
    console.log("::warning::extract-judge-ranking: judge output contained no valid ranking; --apply will use fallback order");
    return;
  }
  writeJsonAtomic(join(JUDGE_DIR, "ranking.json"), ranking);
  console.log(`extract-judge-ranking: ranking written for ${Object.keys(ranking).length} item(s)`);
}

if (import.meta.main) main();
