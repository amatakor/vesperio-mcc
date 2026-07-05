/**
 * The deterministic gate between the ingestion agent and the data files.
 *
 * Reads sweep-draft.json from the repo root, validates every part of it
 * against the schema and the mechanically checkable hard rules, and only
 * if EVERYTHING passes: stamps publish dates, merges into items.json /
 * held.json / sources.json / state.json, and deletes the draft.
 *
 * On any rejection it exits non-zero with a precise reason and leaves
 * every data file untouched. The agent must fix the draft and rerun;
 * there is no bypass.
 */

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type {
  Item,
  ItemsFile,
  HeldFile,
  StateFile,
  SourcesFile,
  SweepLogEntry,
} from "../src/data/schema";
import { CATEGORIES, SOURCE_STATUSES, SEED_TAGS } from "../src/data/schema";
import {
  validateItem,
  validateItemsFile,
  validateHeldFile,
  validateStateFile,
  validateSourcesFile,
} from "./lib/validate";

interface DraftUpdate {
  id: string;
  patch: Record<string, unknown>;
  note: string;
}

interface DraftHeld {
  candidate: Record<string, unknown>;
  reason: string;
}

interface DraftSourceHealth {
  name: string;
  status: string;
  note?: string;
  fail_count?: number;
}

interface Draft {
  newItems: unknown[];
  updates: DraftUpdate[];
  held: DraftHeld[];
  sourceHealth: DraftSourceHealth[];
  summary: string;
  coverage: string[];
}

export interface FinalizeOptions {
  dataDir: string;
  draftPath: string;
  now?: Date;
}

export interface FinalizeResult {
  ok: boolean;
  errors: string[];
  added: number;
  updated: number;
  held: number;
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(errors: string[]): FinalizeResult {
  return { ok: false, errors, added: 0, updated: 0, held: 0 };
}

function readJson(path: string, label: string, errors: string[]): unknown {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    errors.push(`${label}: cannot read ${path}`);
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    errors.push(`${label}: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
    return undefined;
  }
}

export function finalizeSweep(opts: FinalizeOptions): FinalizeResult {
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const errors: string[] = [];

  // ---- load draft -------------------------------------------------------
  const draftRaw = readJson(opts.draftPath, "draft", errors);
  if (draftRaw === undefined) return fail(errors);
  if (!isObj(draftRaw)) return fail(["draft: root must be an object"]);

  for (const key of ["newItems", "updates", "held", "sourceHealth", "coverage"]) {
    if (!Array.isArray(draftRaw[key])) errors.push(`draft.${key}: required array`);
  }
  if (typeof draftRaw.summary !== "string" || draftRaw.summary.trim() === "") {
    errors.push("draft.summary: required non-empty string");
  }
  if (errors.length > 0) return fail(errors);
  const draft = draftRaw as unknown as Draft;

  for (const c of draft.coverage) {
    if (!CATEGORIES.includes(c as never)) {
      errors.push(`draft.coverage: "${String(c)}" is not a known category`);
    }
  }

  // ---- load current data files ------------------------------------------
  const itemsPath = join(opts.dataDir, "items.json");
  const heldPath = join(opts.dataDir, "held.json");
  const statePath = join(opts.dataDir, "state.json");
  const sourcesPath = join(opts.dataDir, "sources.json");

  const itemsData = readJson(itemsPath, "items.json", errors);
  const heldData = readJson(heldPath, "held.json", errors);
  const stateData = readJson(statePath, "state.json", errors);
  const sourcesData = readJson(sourcesPath, "sources.json", errors);
  if (errors.length > 0) return fail(errors);

  errors.push(...validateItemsFile(itemsData));
  errors.push(...validateHeldFile(heldData));
  errors.push(...validateStateFile(stateData));
  errors.push(...validateSourcesFile(sourcesData));
  if (errors.length > 0) {
    return fail(errors.map((e) => `pre-existing data invalid, refusing to merge: ${e}`));
  }

  const items = itemsData as ItemsFile;
  const held = heldData as HeldFile;
  const state = stateData as StateFile;
  const sources = sourcesData as SourcesFile;

  const existingIds = new Set(items.items.map((i) => i.id));

  // ---- validate newItems -------------------------------------------------
  const draftIds = new Set<string>();
  draft.newItems.forEach((raw, i) => {
    const path = `newItems[${i}]`;
    validateItem(raw, path, errors);
    if (!isObj(raw)) return;
    if (raw.publishDate !== undefined) {
      errors.push(`${path}.publishDate: must not be set in a draft; finalize-sweep stamps it`);
    }
    if (typeof raw.id === "string") {
      if (existingIds.has(raw.id)) {
        errors.push(`${path}.id: "${raw.id}" already exists in items.json (duplicate)`);
      }
      if (draftIds.has(raw.id)) {
        errors.push(`${path}.id: "${raw.id}" appears twice in this draft`);
      }
      draftIds.add(raw.id);
    }
  });

  // ---- validate updates ---------------------------------------------------
  const patchedItems = new Map<string, Item>();
  draft.updates.forEach((u, i) => {
    const path = `updates[${i}]`;
    if (!isObj(u)) {
      errors.push(`${path}: must be an object { id, patch, note }`);
      return;
    }
    if (typeof u.id !== "string" || !existingIds.has(u.id)) {
      errors.push(`${path}.id: "${String(u.id)}" does not match any existing item`);
      return;
    }
    if (!isObj(u.patch)) {
      errors.push(`${path}.patch: required object`);
      return;
    }
    if (typeof u.note !== "string" || u.note.trim() === "") {
      errors.push(`${path}.note: required non-empty string`);
    }
    if ("id" in u.patch) errors.push(`${path}.patch: changing an item id is not allowed`);
    if ("publishDate" in u.patch) errors.push(`${path}.patch: publishDate is stamped, not patched`);
    if (errors.length > 0 && !isObj(u.patch)) return;

    const current = items.items.find((it) => it.id === u.id)!;
    const patch = u.patch as Obj;
    const merged: Item = {
      ...current,
      ...(patch as Partial<Item>),
      id: current.id,
      publishDate: current.publishDate,
      explainer: isObj(patch.explainer)
        ? { ...current.explainer, ...(patch.explainer as Partial<Item["explainer"]>) }
        : current.explainer,
    };
    const before = errors.length;
    validateItem(merged, `${path} (after patch)`, errors);
    if (errors.length === before) patchedItems.set(u.id, merged);
  });

  // ---- validate held ------------------------------------------------------
  draft.held.forEach((h, i) => {
    const path = `held[${i}]`;
    if (!isObj(h)) {
      errors.push(`${path}: must be an object { candidate, reason }`);
      return;
    }
    if (!isObj(h.candidate)) errors.push(`${path}.candidate: required object`);
    if (typeof h.reason !== "string" || h.reason.trim() === "") {
      errors.push(`${path}.reason: required one-line reason`);
    }
  });

  // ---- validate sourceHealth ----------------------------------------------
  const allSources = Object.values(sources.categories).flat();
  draft.sourceHealth.forEach((s, i) => {
    const path = `sourceHealth[${i}]`;
    if (!isObj(s)) {
      errors.push(`${path}: must be an object { name, status, note? }`);
      return;
    }
    if (typeof s.name !== "string" || !allSources.some((src) => src.name === s.name)) {
      errors.push(`${path}.name: "${String(s.name)}" not found in sources.json`);
    }
    if (!SOURCE_STATUSES.includes(s.status as never)) {
      errors.push(`${path}.status: "${String(s.status)}" must be one of [${SOURCE_STATUSES.join(", ")}]`);
    }
    if (s.note !== undefined && typeof s.note !== "string") {
      errors.push(`${path}.note: must be a string when present`);
    }
    if (
      s.fail_count !== undefined &&
      (typeof s.fail_count !== "number" || !Number.isInteger(s.fail_count) || s.fail_count < 0)
    ) {
      errors.push(`${path}.fail_count: must be a non-negative integer when present`);
    }
  });

  if (errors.length > 0) return fail(errors);

  // ---- everything valid: build new file contents in memory -----------------
  const stampedItems = (draft.newItems as Item[]).map((item) => ({
    ...item,
    publishDate: nowIso,
  }));
  const nextItems: ItemsFile = {
    items: [...items.items.map((it) => patchedItems.get(it.id) ?? it), ...stampedItems],
  };

  const nextHeld: HeldFile = {
    held: [
      ...held.held,
      ...draft.held.map((h) => ({ candidate: h.candidate, reason: h.reason, date: today })),
    ],
  };

  // Tags coined this sweep (outside the seed set and all prior items) are
  // logged for human review; inventing tags is allowed, silently is not.
  const knownTags = new Set<string>([...SEED_TAGS, ...items.items.flatMap((it) => it.tags)]);
  const newTags = [
    ...new Set(stampedItems.flatMap((it) => it.tags).filter((t) => !knownTags.has(t))),
  ].sort();

  const logEntry: SweepLogEntry = {
    at: nowIso,
    added: stampedItems.length,
    updated: draft.updates.length,
    held: draft.held.length,
    summary: draft.summary,
    coverage: draft.coverage,
    ...(newTags.length > 0 ? { new_tags: newTags } : {}),
  };
  const nextState: StateFile = {
    lastSweep: nowIso,
    sweeps: [...state.sweeps, logEntry],
  };

  const nextSources: SourcesFile = structuredClone(sources);
  for (const h of draft.sourceHealth) {
    for (const list of Object.values(nextSources.categories)) {
      const src = list.find((s) => s.name === h.name);
      if (!src) continue;
      src.status = h.status as (typeof SOURCE_STATUSES)[number];
      if (h.fail_count !== undefined) src.fail_count = h.fail_count;
      if (h.note) {
        src.notes = src.notes ? `${src.notes} | [${today}] ${h.note}` : `[${today}] ${h.note}`;
      }
    }
  }

  // ---- defence in depth: the results must themselves validate --------------
  const finalErrors = [
    ...validateItemsFile(nextItems),
    ...validateHeldFile(nextHeld),
    ...validateStateFile(nextState),
    ...validateSourcesFile(nextSources),
  ];
  if (finalErrors.length > 0) {
    return fail(finalErrors.map((e) => `post-merge validation failed, nothing written: ${e}`));
  }

  // ---- write --------------------------------------------------------------
  const write = (path: string, data: unknown) =>
    writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  write(itemsPath, nextItems);
  write(heldPath, nextHeld);
  write(statePath, nextState);
  write(sourcesPath, nextSources);
  unlinkSync(opts.draftPath);

  return {
    ok: true,
    errors: [],
    added: stampedItems.length,
    updated: draft.updates.length,
    held: draft.held.length,
  };
}

if (import.meta.main) {
  const result = finalizeSweep({ dataDir: "src/data", draftPath: "sweep-draft.json" });
  if (!result.ok) {
    console.error(`finalize-sweep: REJECTED (${result.errors.length} reason${result.errors.length === 1 ? "" : "s"}), data files untouched`);
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    `finalize-sweep: merged ${result.added} new, ${result.updated} updated, ${result.held} held; draft deleted`,
  );
}
