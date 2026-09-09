/**
 * Deterministic outcome ledger for the registry crossfeed queue
 * (registry-candidates.json). The weekly maintain-registry agent
 * consumes queue entries by deleting them, which left no record of
 * whether a candidate landed, was re-sourced, was queued as disputed,
 * or was rejected outright: /system could not show the crossfeed
 * working. This script closes that gap without any network access or
 * LLM judgment, code only, in two modes:
 *
 *   --snapshot  copies the current queue to a gitignored path
 *               (.crossfeed-before.json at the repo root) before the
 *               agent runs.
 *   --record    runs after the agent. Every candidate present in the
 *               snapshot but absent from the current queue was
 *               consumed; its target profile field is inspected and
 *               classified, and one run entry is appended to
 *               src/data/registry-crossfeed-log.json (skipped
 *               entirely when nothing was consumed).
 *
 * Wired into .github/workflows/maintain-registry.yml: --snapshot runs
 * immediately before the agent step, --record immediately after it and
 * before the diff-scope gate.
 */

import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeJsonAtomic } from "./lib/write-json-atomic";
import { REGISTRY_SUBDIR_BY_TYPE } from "./lib/crossfeed";
import type { RegistryEntityType } from "./lib/crossfeed";
import type {
  CrossfeedConsumedEntry,
  CrossfeedOutcome,
  CrossfeedQueueAction,
  RegistryCrossfeedLogFile,
} from "../src/data/schema";

export const QUEUE_FILENAME = "registry-candidates.json";
export const LOG_FILENAME = "registry-crossfeed-log.json";
export const DEFAULT_SNAPSHOT_PATH = ".crossfeed-before.json";

/** The subset of a queue candidate's shape this script reads. Matches
    QueueCandidate in scripts/lib/crossfeed.ts. */
interface QueueCandidateLike {
  id: string;
  item_id: string;
  entity_slug: string;
  entity_type: RegistryEntityType;
  field: string;
  value: unknown;
  action: string;
  proposed_on: string;
  item_snr: number;
  source_url: string;
}

interface QueueFile {
  version?: string;
  candidates: QueueCandidateLike[];
}

/** A SourcedField<T>-shaped object, read loosely (the profile's own
    schema is not re-validated here; check-registry.ts owns that). */
interface SourcedFieldLike {
  value?: unknown;
  source?: unknown;
  disputed?: { competing?: { value?: unknown }[] };
}

// ------------------------------------------------------------- snapshot

/** Copies the current queue file to `snapshotPath`, byte for byte. */
export function snapshotQueue(dataDir: string, snapshotPath: string): void {
  copyFileSync(join(dataDir, QUEUE_FILENAME), snapshotPath);
}

// --------------------------------------------------- value normalization

/**
 * Strict equality after JSON-normalizing: numbers and numeric strings
 * compare equal, and non-numeric strings compare equal case-insensitive
 * after trimming. Arrays normalize element-wise; everything else
 * compares by JSON shape.
 */
function normalizeValue(v: unknown): unknown {
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return trimmed.toLowerCase();
  }
  if (Array.isArray(v)) return v.map(normalizeValue);
  return v;
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeValue(a)) === JSON.stringify(normalizeValue(b));
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function describeValue(v: unknown): string {
  return v === null || v === undefined ? "null" : JSON.stringify(v);
}

// -------------------------------------------------------- classification

/**
 * Classifies what became of one consumed candidate by comparing its
 * proposal against the current state of its target profile field:
 *   - value matches AND source matches the candidate's source_url -> landed
 *   - value matches but the source differs -> landed_resourced
 *   - value does not match, but a disputed.competing entry carries it -> disputed
 *   - anything else -> unchanged
 */
export function classifyOutcome(
  candidate: QueueCandidateLike,
  profile: Record<string, unknown> | undefined,
): { outcome: CrossfeedOutcome; detail: string } {
  if (profile === undefined) {
    return {
      outcome: "unchanged",
      detail: `profile ${REGISTRY_SUBDIR_BY_TYPE[candidate.entity_type]}/${candidate.entity_slug}.json could not be read`,
    };
  }
  const field = profile[candidate.field] as SourcedFieldLike | undefined;
  if (field === undefined || typeof field !== "object" || field === null) {
    return { outcome: "unchanged", detail: `field "${candidate.field}" not found on the profile` };
  }
  const currentValue = field.value;
  const currentSource = typeof field.source === "string" ? field.source : null;

  if (valuesEqual(currentValue, candidate.value)) {
    if (currentSource === candidate.source_url) {
      return {
        outcome: "landed",
        detail: `value landed with the proposed source (${hostOf(candidate.source_url)})`,
      };
    }
    return {
      outcome: "landed_resourced",
      detail: `value landed but the field now cites ${currentSource ? hostOf(currentSource) : "no source"} instead of ${hostOf(candidate.source_url)}`,
    };
  }

  const competing = field.disputed?.competing ?? [];
  if (competing.some((c) => valuesEqual(c?.value, candidate.value))) {
    return {
      outcome: "disputed",
      detail: `proposed value ${describeValue(candidate.value)} recorded as a competing disputed claim, not the leading value`,
    };
  }

  return {
    outcome: "unchanged",
    detail: `field currently ${describeValue(currentValue)} (${currentSource ? hostOf(currentSource) : "no source"}); proposal not reflected`,
  };
}

// -------------------------------------------------------------- record

export interface RecordResult {
  wrote: boolean;
  consumedCount: number;
}

/**
 * Diffs the snapshot against the current queue, classifies every
 * consumed candidate, and appends one run entry to the log (skipped
 * when nothing was consumed, or when no snapshot exists to diff
 * against).
 */
export function recordOutcomes(dataDir: string, snapshotPath: string, nowIso: string): RecordResult {
  if (!existsSync(snapshotPath)) {
    console.error(
      `record-crossfeed-outcomes: no snapshot at ${snapshotPath}; run --snapshot before the agent step`,
    );
    return { wrote: false, consumedCount: 0 };
  }
  const before = JSON.parse(readFileSync(snapshotPath, "utf8")) as QueueFile;
  const afterPath = join(dataDir, QUEUE_FILENAME);
  const after = JSON.parse(readFileSync(afterPath, "utf8")) as QueueFile;
  const afterIds = new Set(after.candidates.map((c) => c.id));
  const consumedCandidates = before.candidates.filter((c) => !afterIds.has(c.id));
  if (consumedCandidates.length === 0) return { wrote: false, consumedCount: 0 };

  const profileCache = new Map<string, Record<string, unknown> | undefined>();
  const loadProfile = (
    entityType: RegistryEntityType,
    slug: string,
  ): Record<string, unknown> | undefined => {
    const key = `${entityType}/${slug}`;
    if (!profileCache.has(key)) {
      const subdir = REGISTRY_SUBDIR_BY_TYPE[entityType];
      const p = join(dataDir, "registry", subdir, `${slug}.json`);
      try {
        profileCache.set(key, JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>);
      } catch {
        profileCache.set(key, undefined);
      }
    }
    return profileCache.get(key);
  };

  const consumed: CrossfeedConsumedEntry[] = consumedCandidates.map((c) => {
    const profile = loadProfile(c.entity_type, c.entity_slug);
    const { outcome, detail } = classifyOutcome(c, profile);
    return {
      id: c.id,
      item_id: c.item_id,
      entity_slug: c.entity_slug,
      entity_type: c.entity_type,
      field: c.field,
      value: c.value,
      action: c.action as CrossfeedQueueAction,
      proposed_on: c.proposed_on,
      item_snr: c.item_snr as CrossfeedConsumedEntry["item_snr"],
      source_url: c.source_url,
      outcome,
      detail,
    };
  });

  const logPath = join(dataDir, LOG_FILENAME);
  let log: RegistryCrossfeedLogFile;
  try {
    log = JSON.parse(readFileSync(logPath, "utf8")) as RegistryCrossfeedLogFile;
  } catch {
    log = {
      $comment:
        "Machine-owned outcome ledger for the registry crossfeed queue. Written only by scripts/record-crossfeed-outcomes.ts.",
      version: "0.1",
      runs: [],
    };
  }
  log.runs.push({ at: nowIso, consumed });
  writeJsonAtomic(logPath, log);
  return { wrote: true, consumedCount: consumed.length };
}

if (import.meta.main) {
  const mode = process.argv[2];
  const dataDir = "src/data";
  const snapshotPath = DEFAULT_SNAPSHOT_PATH;
  if (mode === "--snapshot") {
    snapshotQueue(dataDir, snapshotPath);
    console.log(`record-crossfeed-outcomes: snapshot written to ${snapshotPath}`);
  } else if (mode === "--record") {
    const result = recordOutcomes(dataDir, snapshotPath, new Date().toISOString());
    console.log(
      result.wrote
        ? `record-crossfeed-outcomes: recorded ${result.consumedCount} consumed candidate(s)`
        : "record-crossfeed-outcomes: nothing consumed this run, log untouched",
    );
  } else {
    console.error("usage: bun scripts/record-crossfeed-outcomes.ts --snapshot|--record");
    process.exit(2);
  }
}
