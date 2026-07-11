/**
 * The deterministic gate between the ingestion agent and the data files.
 *
 * Reads sweep-draft.json from the repo root, validates every part of it
 * against the schema and the mechanically checkable hard rules, and only
 * if EVERYTHING passes: scores new items through the SNR engine, stamps
 * publish dates, applies update bumps and the automatic persistence pass,
 * records calibration claims in the source ledger, merges into
 * items.json / held.json / sources.json / state.json / source_ledger.json,
 * and deletes the draft.
 *
 * On any rejection it exits non-zero with a precise reason and leaves
 * every data file untouched. The agent must fix the draft and rerun;
 * there is no bypass.
 */

import { readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  Item,
  ItemsFile,
  HeldFile,
  StateFile,
  SourcesFile,
  SourceLedgerFile,
  LedgerSource,
  SweepLogEntry,
  ItemSource,
  SourceClass,
  SnrValue,
} from "../src/data/schema";
import {
  CATEGORIES,
  SOURCE_STATUSES,
  SEED_TAGS,
  SOURCE_CLASSES,
  PERSISTENCE_DAYS,
  DEDUP_WINDOW_DAYS,
  CORROBORATION_FETCHES_PER_EVENT,
  CORROBORATION_FETCHES_PER_SWEEP,
} from "../src/data/schema";
import {
  validateItem,
  validateItemsFile,
  validateHeldFile,
  validateStateFile,
  validateSourcesFile,
  validateSourceLedgerFile,
  validateRegistryCandidatesFile,
} from "./lib/validate";
import { scoreClaim } from "./snr/score";
import { collapseCorroboration } from "./snr/corroboration";
import { applyModifier, daysBetween, matchDecision } from "./snr/match";
import { recordClaim, effectiveClass } from "./snr/ledger";
import {
  loadRegistryIndex,
  matchCompanies,
  matchCompanyRefs,
  validateFact,
  decideFact,
} from "./lib/crossfeed";
import type {
  CrossfeedFact,
  CrossfeedActionKind,
  QueueCandidate,
  RegistryCandidatesFile,
} from "./lib/crossfeed";
import { fetchableSignalChannels } from "./lib/signals";
import type { SignalsFile } from "../src/data/schema";

/**
 * The fetchable whitelisted signal channels the pass must account for.
 * Returns an empty set when signals.json is absent or unreadable (test
 * data dirs, or before the file exists): with no channels to check the
 * signals-pass gate has nothing to enforce and stays out of the way.
 */
function loadFetchableSignalUrls(dataDir: string): Set<string> {
  try {
    const signals = JSON.parse(
      readFileSync(join(dataDir, "signals.json"), "utf8"),
    ) as SignalsFile;
    return new Set(fetchableSignalChannels(signals).map((c) => c.url));
  } catch {
    return new Set();
  }
}

/** The scoring block the agent supplies on each new item (contract §1). */
interface DraftScoringSource {
  url: string;
  outlet: string;
  class: string;
  via?: string;
  /**
   * The page's headline, verbatim, when the agent saw one (optional
   * during the transition). Enables the wire-rewrite collapse: titles
   * within SimHash Hamming distance 3 count as one corroboration unit.
   */
  title?: string;
}
interface DraftScoring {
  sources: DraftScoringSource[];
  extraordinary: boolean;
  crawl: string;
  whitelist: "self" | "observer" | null;
}

/** One attachment on an update (contract §2). */
interface DraftAttach {
  url: string;
  outlet: string;
  class: string;
  via: string;
}

type BumpType =
  | "reinforcement"
  | "corroboration_2plus"
  | "corroboration_4plus"
  | "mainstream_pickup"
  | null;

interface DraftUpdate {
  id: string;
  patch: Record<string, unknown>;
  note: string;
  attach?: DraftAttach[];
  bump?: BumpType;
  /**
   * Full re-score (the upgrade path, SNR_SPEC "upgrade rule"): replaces
   * the item's scoring inputs and re-bases the trace, e.g. when a better
   * source class is found or a prior crawl outcome was wrong. Mutually
   * exclusive with bump. Prior trace history is preserved and the move
   * is appended to it.
   */
  rescore?: DraftScoring;
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
  /**
   * Proof of fetch (plan Phase 5, should-fix 3): an attestation that an
   * HTML source was successfully fetched must carry either a verbatim
   * excerpt (>= 40 chars of visible text from the fetched page) or a
   * sha256 of the fetched body. Bare "fetched cleanly" claims for HTML
   * sources are rejected: the other passes are gated, this one was not.
   */
  evidence?: { excerpt?: string; content_sha256?: string };
}

/** Minimum excerpt length for an HTML fetch attestation to count as proof. */
const EVIDENCE_EXCERPT_MIN_CHARS = 40;

interface Draft {
  newItems: unknown[];
  updates: DraftUpdate[];
  held: DraftHeld[];
  /**
   * Exact candidate.headline strings of held entries this draft resolves
   * (removes from the queue). Used when a decision: publish entry is
   * drafted as a real item, or when an entry is otherwise settled by
   * this sweep. Unknown headlines reject the draft.
   */
  resolveHeld?: string[];
  sourceHealth: DraftSourceHealth[];
  summary: string;
  coverage: string[];
  /**
   * Signals-pass attestation (see prompts/update-items.md step 2). Required
   * whenever signals.json has fetchable whitelisted channels: the pass is
   * unenforceable otherwise and gets silently skipped. `checked` lists the
   * fetchable channel URLs actually fetched this run; an empty list is legal
   * only with a `note` explaining why (rotation, all unreachable), mirroring
   * the corroboration crawl's honest "not_attempted".
   */
  signalsPass?: { checked: string[]; xAttempted: number; note: string };
  /**
   * Discovery-pass attestation (audit follow-up, 2026-07-08): the open-web
   * searches this sweep actually ran. Required on EVERY sweep; the 6-query
   * minimum enforces the coverage matrix in prompts/update-items.md
   * (launch, financial, incident/regulatory, non-US, plus rotating slots).
   * Deep sweeps run 10-12. Mirrors the signals-pass gate: a skipped or
   * thin discovery pass is a rejection, not a silent gap.
   */
  discoveryPass?: { queries: string[]; found: number; note: string };
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
type SnrMovement = { id: string; from: SnrValue; to: SnrValue; reason: string };

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

// ------------------------------------------------------- anti-spoof hosts

/** Fixed official hosts (SNR_PLAN.md §B1). Any *.gov host also passes. */
const FIXED_OFFICIAL_HOSTS = new Set([
  "sec.gov",
  "fcc.gov",
  "sam.gov",
  "ted.europa.eu",
  "esa.int",
  "nasa.gov",
  "noaa.gov",
  "itu.int",
  "unoosa.org",
  "europa.eu",
]);

/** Hosts whose data may be classed "computed" (SNR_PLAN.md §B1). */
const COMPUTED_HOSTS = new Set([
  "celestrak.org",
  "space-track.org",
  "ll.thespacedevs.com",
  "thespacedevs.com",
]);

const REGISTRY_SUBDIRS = ["constellations", "organizations", "spaceports", "vehicles"] as const;

/** Lowercased hostname of a URL, or null when it does not parse. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when `host` equals or is a subdomain of `base`. */
function hostMatches(host: string, base: string): boolean {
  return host === base || host.endsWith("." + base);
}

/**
 * Collect every hostname declared in a registry profile's `website`
 * SourcedField, across all registry subdirectories under `dataDir`. When
 * the registry dir is absent (test data dirs), returns an empty set: the
 * fixed official list and *.gov rule still apply.
 */
function loadRegistryHosts(dataDir: string): Set<string> {
  const hosts = new Set<string>();
  const registryDir = join(dataDir, "registry");
  for (const sub of REGISTRY_SUBDIRS) {
    let entries: string[];
    try {
      entries = readdirSync(join(registryDir, sub));
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith(".json")) continue;
      let profile: unknown;
      try {
        profile = JSON.parse(readFileSync(join(registryDir, sub, name), "utf8"));
      } catch {
        continue;
      }
      if (!isObj(profile) || !isObj(profile.website)) continue;
      const value = (profile.website as Obj).value;
      if (typeof value !== "string") continue;
      const h = hostOf(value);
      // Registry website fields record display URLs, usually www-prefixed.
      // The actor's domain is the registrable apex, so a www. host is
      // reduced to it: investors.planet.com and newsroom.ulalaunch.com are
      // the same actor as www.planet.com / www.ulalaunch.com. Hosts with
      // any other subdomain are kept verbatim (a site hosted on a shared
      // platform must not whitelist the whole platform).
      if (h) hosts.add(h.replace(/^www\./, ""));
    }
  }
  return hosts;
}

/**
 * Anti-spoof gate (SNR_PLAN.md §B1). A first_party / official_record URL
 * passes only when its host matches a registry website host, the fixed
 * official list, or any *.gov host. A computed URL passes only on the
 * fixed computed-data hosts. Every other class passes unconditionally
 * (the honesty burden is on the two direct-source classes).
 */
function isOfficialHost(url: string, cls: string, registryHosts: Set<string>): boolean {
  const host = hostOf(url);
  if (host === null) return false;
  if (cls === "first_party" || cls === "official_record") {
    if (host.endsWith(".gov")) return true;
    if (FIXED_OFFICIAL_HOSTS.has(host)) return true;
    for (const base of FIXED_OFFICIAL_HOSTS) {
      if (hostMatches(host, base)) return true;
    }
    for (const base of registryHosts) {
      if (hostMatches(host, base)) return true;
    }
    return false;
  }
  if (cls === "computed") {
    for (const base of COMPUTED_HOSTS) {
      if (hostMatches(host, base)) return true;
    }
    return false;
  }
  return true;
}

/**
 * Validate the shape of one source-like entry (scoring.sources or
 * update.attach). Pushes precise errors; the anti-spoof reclassify hint
 * is emitted for direct-source classes that fail isOfficialHost.
 */
function validateSourceEntry(
  s: unknown,
  path: string,
  viaAllowed: readonly string[],
  registryHosts: Set<string>,
  errors: string[],
): void {
  if (!isObj(s)) {
    errors.push(`${path}: must be an object { url, outlet, class, via }`);
    return;
  }
  const urlOk = typeof s.url === "string" && /^https?:\/\//.test(s.url);
  if (!urlOk) errors.push(`${path}.url: required http(s) URL`);
  if (typeof s.outlet !== "string" || s.outlet.trim() === "") {
    errors.push(`${path}.outlet: required non-empty string`);
  }
  if (s.title !== undefined && (typeof s.title !== "string" || s.title.trim() === "")) {
    errors.push(`${path}.title: when present, must be the page's headline verbatim (non-empty string)`);
  }
  const cls = s.class;
  if (!SOURCE_CLASSES.includes(cls as never)) {
    errors.push(`${path}.class: "${String(cls)}" not in [${SOURCE_CLASSES.join(", ")}]`);
  }
  if (s.via !== undefined && !viaAllowed.includes(s.via as string)) {
    errors.push(`${path}.via: "${String(s.via)}" not in [${viaAllowed.join(", ")}]`);
  }
  // Anti-spoof only meaningful once url and class parsed.
  if (urlOk && typeof cls === "string" && SOURCE_CLASSES.includes(cls as never)) {
    if (
      (cls === "first_party" || cls === "official_record" || cls === "computed") &&
      !isOfficialHost(s.url as string, cls, registryHosts)
    ) {
      const hint =
        cls === "computed"
          ? "reclassify (only celestrak.org, space-track.org, thespacedevs.com are computed)"
          : "reclassify (wire_pr / trade / informal)";
      errors.push(
        `${path}: host of "${String(s.url)}" is not an official ${cls} host; ${hint}`,
      );
    }
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

  // ---- signals-pass gate --------------------------------------------------
  // The signals pass produces whitelist-tier candidates from the people in
  // signals.json. It was pure prose the scheduled agent skipped, exactly
  // like the corroboration crawl before its gate. When there are fetchable
  // whitelisted channels, the draft must carry a signalsPass block whose
  // `checked` entries are real channel URLs; a skipped pass is now a
  // rejection, not a silent gap. X handles stay best-effort (unenforced).
  const fetchableSignalUrls = loadFetchableSignalUrls(opts.dataDir);
  let signalsSummary: SweepLogEntry["signals"] | undefined;
  if (fetchableSignalUrls.size > 0) {
    const sp = draft.signalsPass;
    if (!isObj(sp)) {
      errors.push(
        `draft.signalsPass: required object { checked: string[], xAttempted: number, note } ` +
          `when signals.json has fetchable whitelisted channels (${fetchableSignalUrls.size} this run). ` +
          `Run "bun scripts/signals-context.ts", check the fetchable channels, and report the outcome. ` +
          `An empty "checked" is legal only with a note explaining why.`,
      );
    } else {
      if (!Array.isArray(sp.checked) || sp.checked.some((u) => typeof u !== "string")) {
        errors.push("draft.signalsPass.checked: required array of channel URL strings");
      } else {
        for (const url of sp.checked) {
          if (!fetchableSignalUrls.has(url)) {
            errors.push(
              `draft.signalsPass.checked: "${url}" is not a fetchable whitelisted signal ` +
                `channel (see signals-context). List only channels the pass actually fetched.`,
            );
          }
        }
      }
      if (typeof sp.xAttempted !== "number" || !Number.isInteger(sp.xAttempted) || sp.xAttempted < 0) {
        errors.push("draft.signalsPass.xAttempted: required non-negative integer (X handles searched)");
      }
      if (typeof sp.note !== "string" || sp.note.trim() === "") {
        errors.push("draft.signalsPass.note: required non-empty string (what was found, or why empty)");
      }
      if (Array.isArray(sp.checked) && sp.checked.length === 0 && typeof sp.note === "string" && sp.note.trim() === "") {
        errors.push("draft.signalsPass: an empty checked list requires a note explaining why (rotation, all unreachable)");
      }
      if (errors.length === 0) {
        signalsSummary = {
          checked: sp.checked.length,
          x_attempted: sp.xAttempted,
          note: sp.note.trim(),
        };
      }
    }
  }
  // ---- discovery-pass gate --------------------------------------------------
  // Open-web discovery was pure prose and got skipped or run thin (the
  // 2026-07-08 05:47 sweep ran 4 vague queries while real stories sat on
  // Google News). Same medicine as the signals pass: attest what ran.
  const DISCOVERY_MIN_QUERIES = 6;
  let discoverySummary: SweepLogEntry["discovery"] | undefined;
  {
    const dp = draft.discoveryPass;
    if (!isObj(dp)) {
      errors.push(
        `draft.discoveryPass: required object { queries: string[], found: number, note } on every ` +
          `sweep. Run the discovery pass per prompts/update-items.md (at least ${DISCOVERY_MIN_QUERIES} ` +
          `queries covering the matrix: launch, financial, incident/regulatory, non-US) and report it.`,
      );
    } else {
      if (!Array.isArray(dp.queries) || dp.queries.some((q) => typeof q !== "string" || q.trim() === "")) {
        errors.push("draft.discoveryPass.queries: required array of non-empty query strings");
      } else if (dp.queries.length < DISCOVERY_MIN_QUERIES) {
        errors.push(
          `draft.discoveryPass.queries: ${dp.queries.length} queries, minimum ${DISCOVERY_MIN_QUERIES}. ` +
            `The coverage matrix (launch, financial, incident/regulatory, non-US) plus rotating slots is not optional.`,
        );
      }
      if (typeof dp.found !== "number" || !Number.isInteger(dp.found) || dp.found < 0) {
        errors.push("draft.discoveryPass.found: required non-negative integer (candidates the searches surfaced)");
      }
      if (typeof dp.note !== "string" || dp.note.trim() === "") {
        errors.push("draft.discoveryPass.note: required non-empty string (what was searched and what came of it)");
      }
      if (errors.length === 0) {
        discoverySummary = { queries: dp.queries.length, note: dp.note.trim() };
      }
    }
  }
  if (errors.length > 0) return fail(errors);

  // ---- load current data files ------------------------------------------
  const itemsPath = join(opts.dataDir, "items.json");
  const heldPath = join(opts.dataDir, "held.json");
  const statePath = join(opts.dataDir, "state.json");
  const sourcesPath = join(opts.dataDir, "sources.json");
  const ledgerPath = join(opts.dataDir, "source_ledger.json");

  const itemsData = readJson(itemsPath, "items.json", errors);
  const heldData = readJson(heldPath, "held.json", errors);
  const stateData = readJson(statePath, "state.json", errors);
  const sourcesData = readJson(sourcesPath, "sources.json", errors);
  const ledgerData = readJson(ledgerPath, "source_ledger.json", errors);
  if (errors.length > 0) return fail(errors);

  errors.push(...validateItemsFile(itemsData));
  errors.push(...validateHeldFile(heldData));
  errors.push(...validateStateFile(stateData));
  errors.push(...validateSourcesFile(sourcesData));
  errors.push(...validateSourceLedgerFile(ledgerData));
  if (errors.length > 0) {
    return fail(errors.map((e) => `pre-existing data invalid, refusing to merge: ${e}`));
  }

  const items = itemsData as ItemsFile;
  const held = heldData as HeldFile;
  const state = stateData as StateFile;
  const sources = sourcesData as SourcesFile;
  const ledger = ledgerData as SourceLedgerFile;

  // Deep-sweep mode is the harvester's code decision, carried by the queue
  // file; absent file (test dataDirs) means normal. Never from the draft.
  let harvestMode: "normal" | "deep" = "normal";
  try {
    const queue = JSON.parse(
      readFileSync(join(opts.dataDir, "candidates.json"), "utf8"),
    ) as { mode?: unknown };
    if (queue.mode === "deep") harvestMode = "deep";
  } catch {
    // no queue file: normal
  }

  const existingIds = new Set(items.items.map((i) => i.id));
  const registryHosts = loadRegistryHosts(opts.dataDir);
  const registryIndex = loadRegistryIndex(opts.dataDir);
  /** Crossfeed queue entries collected from this draft's accepted items. */
  const queueAdds: QueueCandidate[] = [];

  // Ledger demotion live (SNR_SPEC §7.1): every attested class is resolved
  // through effectiveClass() before it scores, so "a ledger demotion lowers
  // a trade source to informal" (CLAUDE.md) is enforced by code, not prose.
  // With no live demotion the natural class passes through unchanged.
  const ledgerLookup = new Map<string, LedgerSource>(ledger.sources.map((s) => [s.domain, s]));
  const resolveClass = (url: string, natural: SourceClass): SourceClass => {
    const domain = hostOf(url);
    const entry = domain !== null ? ledgerLookup.get(domain) : undefined;
    return entry === undefined ? natural : effectiveClass(natural, entry, today);
  };

  const movements: SnrMovement[] = [];
  const corroborationCollapses: NonNullable<SweepLogEntry["corroboration_collapses"]> = [];
  const autoHeld: DraftHeld[] = [];

  // ---- validate + score newItems ----------------------------------------
  // Each new item arrives with a `scoring` block instead of snr/snr_trace/
  // sources; finalize validates the block, applies the deterministic
  // guardrails, scores it, and stamps the results.
  const draftIds = new Set<string>();
  const stampedNew: Item[] = [];
  let crawlSkips = 0;
  draft.newItems.forEach((raw, i) => {
    const path = `newItems[${i}]`;
    if (!isObj(raw)) {
      errors.push(`${path}: item must be an object`);
      return;
    }

    // The stamped fields must not be pre-set (same style as publishDate).
    for (const banned of ["snr", "snr_trace", "sources"]) {
      if (raw[banned] !== undefined) {
        errors.push(`${path}.${banned}: must not be set in a draft; finalize-sweep stamps it from scoring`);
      }
    }
    if (raw.publishDate !== undefined) {
      errors.push(`${path}.publishDate: must not be set in a draft; finalize-sweep stamps it`);
    }

    // The scoring block is required and shaped.
    const scoringRaw = raw.scoring;
    if (!isObj(scoringRaw)) {
      errors.push(`${path}.scoring: required object { sources, extraordinary, crawl, whitelist }`);
      return;
    }
    const scoring = scoringRaw as unknown as DraftScoring;
    if (!Array.isArray(scoring.sources) || scoring.sources.length === 0) {
      errors.push(`${path}.scoring.sources: required non-empty array (lead first)`);
    }
    if (typeof scoring.extraordinary !== "boolean") {
      errors.push(`${path}.scoring.extraordinary: required boolean`);
    }
    if (!["found_none", "found_some", "not_attempted"].includes(scoring.crawl as string)) {
      errors.push(`${path}.scoring.crawl: must be one of [found_none, found_some, not_attempted]`);
    }
    if (scoring.crawl === "not_attempted") crawlSkips++;
    if (
      scoring.whitelist !== null &&
      scoring.whitelist !== "self" &&
      scoring.whitelist !== "observer"
    ) {
      errors.push(`${path}.scoring.whitelist: must be "self", "observer", or null`);
    }
    if (Array.isArray(scoring.sources)) {
      scoring.sources.forEach((s, j) => {
        validateSourceEntry(s, `${path}.scoring.sources[${j}]`, ["initial", "corroboration"], registryHosts, errors);
      });
      // Lead url must equal source_url.
      const lead = scoring.sources[0];
      if (isObj(lead) && typeof lead.url === "string" && typeof raw.source_url === "string") {
        if (lead.url !== raw.source_url) {
          errors.push(
            `${path}.scoring.sources[0].url: lead source "${lead.url}" must equal item.source_url "${raw.source_url}"`,
          );
        }
      }
    }

    // id uniqueness (mirrors the prior behaviour).
    if (typeof raw.id === "string") {
      if (existingIds.has(raw.id)) {
        errors.push(`${path}.id: "${raw.id}" already exists in items.json (duplicate)`);
      }
      if (draftIds.has(raw.id)) {
        errors.push(`${path}.id: "${raw.id}" appears twice in this draft`);
      }
      draftIds.add(raw.id);
    }

    // ---- dedup-as-code gate (SNR_PLAN §A2) --------------------------------
    // matchDecision() owns the window arithmetic the agent used to re-derive
    // in prose. A NEW item that shares a company and category with an
    // existing item inside DEDUP_WINDOW_DAYS is presumed to be the same
    // event and must be drafted as an update. Distinct events do legally
    // share company+category inside the window (two Starlink launches in a
    // week), so the draft may attest that explicitly per matched item with
    // dedup_distinct: [{ id, reason }]; unattested matches reject.
    if (
      typeof raw.date === "string" &&
      typeof raw.category === "string" &&
      Array.isArray(raw.companies)
    ) {
      const companies = (raw.companies as unknown[])
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.toLowerCase());
      // Alias-aware: "ISRO" and "Indian Space Research Organisation" are
      // the same company for dedup purposes. Names resolve through the
      // curated alias map (the same index crossfeed uses); unresolved
      // names still compare by lowercase string.
      const companySlugs = new Set(matchCompanies(registryIndex, companies));
      const sharesCompany = (exCompanies: string[]): boolean =>
        exCompanies.some((c) => companies.includes(c.toLowerCase())) ||
        (companySlugs.size > 0 &&
          matchCompanies(registryIndex, exCompanies).some((s) => companySlugs.has(s)));
      const ackList = Array.isArray(raw.dedup_distinct)
        ? (raw.dedup_distinct as unknown[])
        : raw.dedup_distinct !== undefined
          ? [raw.dedup_distinct]
          : [];
      const acked = (id: string): boolean =>
        ackList.some(
          (a) =>
            isObj(a) &&
            a.id === id &&
            typeof a.reason === "string" &&
            a.reason.trim() !== "",
        );
      for (const ex of items.items) {
        if (ex.category !== raw.category) continue;
        if (!sharesCompany(ex.companies)) continue;
        if (matchDecision({ id: ex.id, date: ex.date, snr: ex.snr }, raw.date) !== "same_event") {
          continue;
        }
        if (!acked(ex.id)) {
          errors.push(
            `${path}: same-event match with existing "${ex.id}" (shared company, category ` +
              `"${ex.category}", within ${DEDUP_WINDOW_DAYS} days). Draft it as an updates[] entry ` +
              `(attach/bump), or, if it is genuinely a distinct event, attest that with ` +
              `dedup_distinct: [{ "id": "${ex.id}", "reason": "..." }] on the item.`,
          );
        }
      }
    }

    if (errors.length > 0) return; // don't score against a malformed block

    // Deterministic extraordinary guardrail (SNR_PLAN §B2).
    const leadClass = scoring.sources[0]!.class as SourceClass;
    let extraordinary = scoring.extraordinary;
    if (
      raw.impact === "seismic" &&
      !["first_party", "official_record", "computed"].includes(leadClass)
    ) {
      extraordinary = true;
    }

    // Collapse the sources into corroboration units before scoring:
    // canonical duplicates, one registrable domain, and wire rewrites
    // (attested titles within SimHash distance 3) each count once. The
    // item keeps the full list (minus exact duplicates); only the
    // scoring input shrinks, and every merge is logged into the sweep
    // entry.
    const collapse = collapseCorroboration(
      scoring.sources.map((s) => ({
        url: s.url,
        outlet: s.outlet,
        class: resolveClass(s.url, s.class as SourceClass),
        via: (s.via ?? "initial") as ItemSource["via"],
        ...(s.title !== undefined ? { title: s.title } : {}),
      })),
    );
    const toItemSource = (s: (typeof collapse.listed)[number]): ItemSource => ({
      url: s.url,
      outlet: s.outlet,
      class: s.class,
      added: today,
      via: s.via,
    });
    const mappedSources: ItemSource[] = collapse.listed.map(toItemSource);
    for (const c of collapse.collapses) {
      corroborationCollapses.push({ id: raw.id as string, ...c });
    }

    const result = scoreClaim({
      sources: collapse.representatives.map(toItemSource),
      extraordinary,
      crawl: scoring.crawl as "found_none" | "found_some" | "not_attempted",
      whitelist: scoring.whitelist,
      reinforced: false,
      persisted: false,
      disputeDowngrade: false,
    });
    if (collapse.singleClass !== null) {
      result.trace.single_class_corroboration = collapse.singleClass;
    }

    const stamped: Item = {
      ...(raw as unknown as Item),
      // kind defaults to "event"; commentary must be declared explicitly.
      kind: (raw.kind ?? "event") as Item["kind"],
      snr: result.snr,
      snr_trace: result.trace,
      sources: mappedSources,
      publishDate: nowIso,
    };
    delete (stamped as unknown as Obj).scoring;
    delete (stamped as unknown as Obj).dedup_distinct;

    // ---- registry crossfeed (SNR_SPEC §6, SNR_PLAN §7.3) -------------------
    // The agent attests extracted facts + the like-for-like judgment in a
    // crossfeed block; the outcomes are computed by reconcile() and queued
    // for the weekly registry run. The gate mirrors the corroboration one:
    // an item whose companies map to registry entities and that scored at
    // the SNR >= 3 entry bar must carry the block (empty facts + a note is
    // an honest answer; silence is not).
    const itemQueue: QueueCandidate[] = [];
    const crossfeedRaw = raw.crossfeed;
    if (stamped.kind === "commentary" && isObj(crossfeedRaw) && Array.isArray((crossfeedRaw as Obj).facts) && ((crossfeedRaw as Obj).facts as unknown[]).length > 0) {
      errors.push(`${path}.crossfeed: commentary never feeds the registry; remove the facts`);
    } else if (crossfeedRaw !== undefined) {
      if (!isObj(crossfeedRaw) || !Array.isArray((crossfeedRaw as Obj).facts)) {
        errors.push(`${path}.crossfeed: must be { facts: [...], note? }`);
      } else {
        const cf = crossfeedRaw as unknown as { facts: unknown[]; note?: unknown };
        if (cf.facts.length === 0 && (typeof cf.note !== "string" || cf.note.trim() === "")) {
          errors.push(
            `${path}.crossfeed: empty facts requires a note saying why the item carries no like-for-like registry metric`,
          );
        }
        const disputeFacts: { fact: CrossfeedFact; action: CrossfeedActionKind }[] = [];
        cf.facts.forEach((rawFact, j) => {
          const v = validateFact(rawFact, registryIndex, `${path}.crossfeed.facts[${j}]`);
          errors.push(...v.errors);
          if (v.fact === undefined || v.entity === undefined) return;
          const action = decideFact(v.fact, v.entity, stamped.snr);
          itemQueue.push({
            id: `${stamped.id}:${v.fact.entity_slug}.${v.fact.field}`,
            item_id: stamped.id,
            entity_slug: v.fact.entity_slug,
            entity_type: v.entity.entityType,
            field: v.fact.field,
            value: v.fact.value,
            metric: v.fact.metric,
            same_metric: v.fact.same_metric,
            item_snr: stamped.snr,
            source_url: stamped.source_url,
            action,
            proposed_on: today,
            status: "pending",
          });
          if (action === "downgrade_incoming" || action === "both_disputed_queue") {
            disputeFacts.push({ fact: v.fact, action });
          }
        });
        if (disputeFacts.length > 0) {
          // A genuine same-metric conflict with a canonical fact: the
          // higher-SNR registry side leads, the item takes the dispute
          // downgrade (the math is scoreClaim's, not ours) and is marked.
          const disputedResult = scoreClaim({
            sources: mappedSources,
            extraordinary,
            crawl: scoring.crawl as "found_none" | "found_some" | "not_attempted",
            whitelist: scoring.whitelist,
            reinforced: false,
            persisted: false,
            disputeDowngrade: true,
          });
          stamped.snr = disputedResult.snr;
          stamped.snr_trace = disputedResult.trace;
          stamped.disputed = true;
          for (const d of disputeFacts) {
            if (d.action === "both_disputed_queue") {
              autoHeld.push({
                candidate: { id: stamped.id, headline: stamped.headline },
                reason: `crossfeed: same-metric SNR tie with ${d.fact.entity_slug}.${d.fact.field}; both sides marked disputed, Florian adjudicates (SNR_SPEC 6)`,
              });
            }
          }
        }
      }
    } else {
      // Commentary never feeds the registry (policy), so it owes no
      // crossfeed attestation; the gate applies to events only.
      const matched = matchCompanies(registryIndex, stamped.companies);
      if (stamped.kind !== "commentary" && stamped.snr >= 3 && matched.length > 0) {
        errors.push(
          `${path}: item companies map to registry entit${matched.length === 1 ? "y" : "ies"} ` +
            `[${matched.join(", ")}] and the item scored SNR ${stamped.snr} (>= 3), but the draft ` +
            `carries no crossfeed block. Attest the like-for-like check: crossfeed: { facts: [...] } ` +
            `or crossfeed: { facts: [], note: "why no registry metric is touched" }.`,
        );
      }
    }
    delete (stamped as unknown as Obj).crossfeed;

    // Entity linking (plan Phase 7): companies resolved to registry
    // profiles through the same alias index the crossfeed uses. Names
    // with no registry match carry no entry; an empty result stamps
    // nothing (the field is additive and optional).
    const entityRefs = matchCompanyRefs(registryIndex, stamped.companies);
    if (entityRefs.length > 0) stamped.entities = entityRefs;

    const before = errors.length;
    validateItem(stamped, `${path} (after scoring)`, errors);
    if (errors.length !== before) return;

    // Seismic low-SNR review queue (SNR_PLAN §7.4): still publishes.
    if (stamped.impact === "seismic" && stamped.snr <= 2) {
      autoHeld.push({
        candidate: { id: stamped.id, headline: stamped.headline },
        reason: "review: seismic at SNR <= 2, published wide-net; needs Florian (SNR_PLAN 7.4)",
      });
    }

    queueAdds.push(...itemQueue);
    stampedNew.push(stamped);
  });

  // ---- corroboration-budget honesty gate ----------------------------------
  // "not_attempted" is only legal for events the sweep budget could not
  // cover. The budget covers floor(40 / 5) = 8 events per sweep; a draft
  // with N new items may skip at most max(0, N - 8) of them. Anything more
  // means searches that could have run were not run: do them and file
  // found_some or found_none per event.
  const crawlCapacity = Math.floor(CORROBORATION_FETCHES_PER_SWEEP / CORROBORATION_FETCHES_PER_EVENT);
  const allowedSkips = Math.max(0, draft.newItems.length - crawlCapacity);
  if (crawlSkips > allowedSkips) {
    errors.push(
      `newItems: ${crawlSkips} item(s) claim crawl "not_attempted", but the sweep budget ` +
        `(${CORROBORATION_FETCHES_PER_SWEEP} fetches at ${CORROBORATION_FETCHES_PER_EVENT}/event) covers ` +
        `${crawlCapacity} events, so at most ${allowedSkips} may skip. Run the corroboration crawl ` +
        `for the rest and set found_some or found_none honestly.`,
    );
  }

  // ---- validate + apply updates ------------------------------------------
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

    // attach shape (validated whether or not there's a bump).
    if (u.attach !== undefined && !Array.isArray(u.attach)) {
      errors.push(`${path}.attach: must be an array when present`);
    }
    const attach = Array.isArray(u.attach) ? u.attach : [];
    attach.forEach((a, j) => {
      validateSourceEntry(a, `${path}.attach[${j}]`, ["corroboration", "upgrade"], registryHosts, errors);
    });
    const validBumps = [
      "reinforcement",
      "corroboration_2plus",
      "corroboration_4plus",
      "mainstream_pickup",
    ];
    if (u.bump !== undefined && u.bump !== null && !validBumps.includes(u.bump)) {
      errors.push(`${path}.bump: "${String(u.bump)}" not in [${validBumps.join(", ")}]`);
    }
    if (u.rescore !== undefined) {
      if (u.bump) errors.push(`${path}: bump and rescore are mutually exclusive`);
      if (!isObj(u.rescore)) {
        errors.push(`${path}.rescore: must be a scoring object { sources, extraordinary, crawl, whitelist }`);
      } else {
        const r = u.rescore as unknown as DraftScoring;
        if (!Array.isArray(r.sources) || r.sources.length === 0) {
          errors.push(`${path}.rescore.sources: required non-empty array (lead first)`);
        } else {
          r.sources.forEach((sc, j) => {
            validateSourceEntry(sc, `${path}.rescore.sources[${j}]`, ["initial", "corroboration", "upgrade"], registryHosts, errors);
          });
        }
        if (typeof r.extraordinary !== "boolean") {
          errors.push(`${path}.rescore.extraordinary: required boolean`);
        }
        if (!["found_none", "found_some", "not_attempted"].includes(r.crawl as string)) {
          errors.push(`${path}.rescore.crawl: must be one of [found_none, found_some, not_attempted]`);
        }
        if (r.whitelist !== null && r.whitelist !== "self" && r.whitelist !== "observer") {
          errors.push(`${path}.rescore.whitelist: must be "self", "observer", or null`);
        }
      }
    }

    if (errors.length > 0) return;

    const current = items.items.find((it) => it.id === u.id)!;
    // Start from any earlier patch of the same item in this run.
    const base = patchedItems.get(u.id) ?? current;
    const patch = u.patch as Obj;

    // Merge sources: append each attach not already present by url.
    const existingSources: ItemSource[] = (base.sources ?? []).slice();
    const existingUrls = new Set(existingSources.map((s) => s.url));
    const newSecondary = base.secondary_urls.slice();
    for (const a of attach) {
      if (!existingUrls.has(a.url)) {
        existingSources.push({
          url: a.url,
          outlet: a.outlet,
          class: resolveClass(a.url, a.class as SourceClass),
          added: today,
          via: a.via as ItemSource["via"],
        });
        existingUrls.add(a.url);
      }
      if (a.url !== base.source_url && !newSecondary.includes(a.url)) {
        newSecondary.push(a.url);
      }
    }

    const merged: Item = {
      ...base,
      ...(patch as Partial<Item>),
      id: current.id,
      publishDate: current.publishDate,
      explainer: isObj(patch.explainer)
        ? { ...base.explainer, ...(patch.explainer as Partial<Item["explainer"]>) }
        : base.explainer,
      sources: existingSources.length > 0 ? existingSources : base.sources,
      secondary_urls: newSecondary,
    };

    // bump: apply the modifier to the (possibly already-patched) trace.
    if (u.bump) {
      const bumpSource = attach.length > 0 ? attach[0]!.url : undefined;
      let newTrace;
      try {
        newTrace = applyModifier(
          merged.snr_trace,
          { type: u.bump, delta: 1, reason: u.note, ...(bumpSource ? { source: bumpSource } : {}) },
          today,
        );
      } catch (e) {
        errors.push(`${path}.bump: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      const from = merged.snr;
      if (newTrace !== merged.snr_trace) {
        // Real movement (applyModifier returns the same object on a no-op).
        merged.snr = newTrace.final;
        merged.snr_trace = newTrace;
        if (newTrace.final !== from) {
          movements.push({ id: merged.id, from, to: newTrace.final, reason: u.note });
        }
      }
    }

    // rescore: re-base the whole trace (the upgrade path). The lead of
    // the new scoring must equal the item's (possibly patched) lead.
    if (u.rescore !== undefined && isObj(u.rescore)) {
      const r = u.rescore as unknown as DraftScoring;
      const lead = r.sources[0]!;
      if (lead.url !== merged.source_url) {
        errors.push(
          `${path}.rescore.sources[0].url: lead "${lead.url}" must equal item.source_url "${merged.source_url}" (patch it first when upgrading the lead)`,
        );
        return;
      }
      let extraordinary = r.extraordinary;
      if (
        merged.impact === "seismic" &&
        !["first_party", "official_record", "computed"].includes(lead.class)
      ) {
        extraordinary = true;
      }
      // Preserve original attachment dates/via for urls already on the item.
      const prior = new Map((merged.sources ?? []).map((sc) => [sc.url, sc]));
      // Same corroboration-unit collapse as the new-item path: the item
      // keeps the full list (minus exact duplicates), scoring sees one
      // representative per unit.
      const rescoreCollapse = collapseCorroboration(
        r.sources.map((sc) => {
          const existing = prior.get(sc.url);
          return {
            url: sc.url,
            outlet: sc.outlet,
            class: resolveClass(sc.url, sc.class as SourceClass),
            added: existing?.added ?? today,
            via: (existing?.via ?? sc.via ?? "initial") as ItemSource["via"],
            ...(sc.title !== undefined ? { title: sc.title } : {}),
          };
        }),
      );
      const stripTitle = (s: (typeof rescoreCollapse.listed)[number]): ItemSource => ({
        url: s.url,
        outlet: s.outlet,
        class: s.class,
        added: s.added,
        via: s.via,
      });
      const rescored: ItemSource[] = rescoreCollapse.listed.map(stripTitle);
      for (const c of rescoreCollapse.collapses) {
        corroborationCollapses.push({ id: merged.id, ...c });
      }
      const result = scoreClaim({
        sources: rescoreCollapse.representatives.map(stripTitle),
        extraordinary,
        crawl: r.crawl as "found_none" | "found_some" | "not_attempted",
        whitelist: r.whitelist,
        reinforced: false,
        persisted: false,
        disputeDowngrade: false,
      });
      if (rescoreCollapse.singleClass !== null) {
        result.trace.single_class_corroboration = rescoreCollapse.singleClass;
      }
      const from = merged.snr;
      const history = [
        ...(merged.snr_trace.history ?? []),
        ...(result.snr !== from
          ? [{ date: today, from, to: result.snr, reason: u.note }]
          : []),
      ];
      merged.snr = result.snr;
      merged.snr_trace = history.length > 0 ? { ...result.trace, history } : result.trace;
      merged.sources = rescored;
      for (const sc of rescored) {
        if (sc.url !== merged.source_url && !merged.secondary_urls.includes(sc.url)) {
          merged.secondary_urls.push(sc.url);
        }
      }
      if (result.snr !== from) {
        movements.push({ id: merged.id, from, to: result.snr, reason: u.note });
      }
    }

    const before = errors.length;
    validateItem(merged, `${path} (after patch)`, errors);
    if (errors.length === before) patchedItems.set(u.id, merged);
  });

  // ---- validate resolveHeld ------------------------------------------------
  const resolveHeld = draft.resolveHeld ?? [];
  if (draft.resolveHeld !== undefined && !Array.isArray(draft.resolveHeld)) {
    errors.push("draft.resolveHeld: must be an array of candidate.headline strings when present");
  } else {
    const queued = new Set(
      held.held.map((h) => {
        const c = h.candidate as Obj;
        return typeof c.headline === "string" ? c.headline : "";
      }),
    );
    resolveHeld.forEach((headline, i) => {
      if (typeof headline !== "string" || !queued.has(headline)) {
        errors.push(`resolveHeld[${i}]: no held entry with candidate.headline "${String(headline)}"`);
      }
    });
  }

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
    // HTML fetch attestations need proof (plan Phase 5): a claimed
    // successful fetch of an html source carries an excerpt or a body
    // hash. Statuses that report failure (dead, unverified after a
    // failed attempt) claim no fetch and need none.
    const attested = allSources.find((src) => src.name === s.name);
    const claimsSuccessfulFetch = s.status === "verified" || s.status === "stale";
    if (attested?.feed_type === "html" && claimsSuccessfulFetch) {
      const ev = s.evidence;
      const okExcerpt =
        isObj(ev) && typeof ev.excerpt === "string" && ev.excerpt.trim().length >= EVIDENCE_EXCERPT_MIN_CHARS;
      const okHash =
        isObj(ev) && typeof ev.content_sha256 === "string" && /^[0-9a-f]{64}$/i.test(ev.content_sha256);
      if (!okExcerpt && !okHash) {
        errors.push(
          `${path}.evidence: attesting a successful fetch of html source "${s.name}" requires evidence.excerpt (>= ${EVIDENCE_EXCERPT_MIN_CHARS} chars verbatim from the page) or evidence.content_sha256 (64-hex sha256 of the fetched body)`,
        );
      }
    }
  });

  if (errors.length > 0) return fail(errors);

  // ---- everything valid: build new file contents in memory -----------------
  const mergedExisting = items.items.map((it) => patchedItems.get(it.id) ?? it);
  let nextItemsList = [...mergedExisting, ...stampedNew];

  // Automatic persistence pass (SNR_PLAN §A1): over ALL next items, an
  // item still below 4, not disputed, with no persistence modifier yet,
  // published >= PERSISTENCE_DAYS before today, gets +1 (caps 4). The
  // clock starts at FIRST PUBLICATION, not the event date: a
  // late-discovered old event has not survived any exposure yet.
  nextItemsList = nextItemsList.map((it) => {
    if (it.disputed) return it;
    if (it.snr >= 4) return it;
    if (it.snr_trace.modifiers.some((m) => m.type === "persistence")) return it;
    const publishedOn = (it.publishDate ?? it.date).slice(0, 10);
    if (daysBetween(publishedOn, today) < PERSISTENCE_DAYS) return it;
    const newTrace = applyModifier(
      it.snr_trace,
      {
        type: "persistence",
        delta: 1,
        reason: "survived uncontested past the persistence window (caps at 4)",
      },
      today,
    );
    if (newTrace === it.snr_trace) return it; // no-op (ceiling)
    if (newTrace.final !== it.snr) {
      movements.push({
        id: it.id,
        from: it.snr,
        to: newTrace.final,
        reason: "persistence: survived uncontested past the window",
      });
    }
    return { ...it, snr: newTrace.final, snr_trace: newTrace };
  });

  const nextItems: ItemsFile = { items: nextItemsList };

  const resolved = new Set(resolveHeld);
  const nextHeld: HeldFile = {
    held: [
      ...held.held.filter((h) => {
        const c = h.candidate as Obj;
        return !(typeof c.headline === "string" && resolved.has(c.headline));
      }),
      ...draft.held.map((h) => ({ candidate: h.candidate, reason: h.reason, date: today })),
      ...autoHeld.map((h) => ({ candidate: h.candidate, reason: h.reason, date: today })),
    ],
  };

  // Tags coined this sweep (outside the seed set and all prior items) are
  // logged for human review; inventing tags is allowed, silently is not.
  const knownTags = new Set<string>([...SEED_TAGS, ...items.items.flatMap((it) => it.tags)]);
  const newTags = [
    ...new Set(stampedNew.flatMap((it) => it.tags).filter((t) => !knownTags.has(t))),
  ].sort();

  // ---- ledger: record a calibration claim per stamped NEW item ------------
  const nextLedger: SourceLedgerFile = structuredClone(ledger);
  const ledgerByDomain = new Map<string, LedgerSource>(
    nextLedger.sources.map((s) => [s.domain, s]),
  );
  for (const item of stampedNew) {
    const lead = item.sources![0]!;
    const domain = hostOf(lead.url);
    if (domain === null) continue;
    let source = ledgerByDomain.get(domain);
    if (source === undefined) {
      source = { domain, events: [], claims: [] };
      ledgerByDomain.set(domain, source);
      nextLedger.sources.push(source);
    }
    const updated = recordClaim(source, {
      claim: item.id,
      date: today,
      snr_at_publication: item.snr,
      resolution: "unresolved",
    });
    // recordClaim returns a new object; swap it into the list in place.
    const idx = nextLedger.sources.indexOf(source);
    nextLedger.sources[idx] = updated;
    ledgerByDomain.set(domain, updated);
    source = updated;
  }
  nextLedger.updated = nowIso;

  const logEntry: SweepLogEntry = {
    at: nowIso,
    added: stampedNew.length,
    updated: draft.updates.length,
    held: draft.held.length + autoHeld.length,
    summary: draft.summary,
    coverage: draft.coverage,
    ...(newTags.length > 0 ? { new_tags: newTags } : {}),
    ...(movements.length > 0 ? { snr_movements: movements } : {}),
    ...(corroborationCollapses.length > 0
      ? { corroboration_collapses: corroborationCollapses }
      : {}),
    ...(signalsSummary !== undefined ? { signals: signalsSummary } : {}),
    ...(discoverySummary !== undefined ? { discovery: discoverySummary } : {}),
    ...(harvestMode === "deep" ? { mode: "deep" as const } : {}),
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

  // ---- registry crossfeed queue (consumed by maintain-registry) ------------
  // Entries are appended here and removed ONLY by the weekly registry run
  // when it consumes them; a pending entry re-proposed by a later sweep
  // keeps its original record (dedup by id).
  const queuePath = join(opts.dataDir, "registry-candidates.json");
  let queueFile: RegistryCandidatesFile;
  try {
    queueFile = JSON.parse(readFileSync(queuePath, "utf8")) as RegistryCandidatesFile;
  } catch {
    queueFile = { version: "0.1", candidates: [] };
  }
  const queueIds = new Set(queueFile.candidates.map((c) => c.id));
  const nextQueue: RegistryCandidatesFile = {
    $comment:
      "Registry crossfeed queue (SNR_SPEC 6, SNR_PLAN 7.3). Written by finalize-sweep from attested crossfeed facts on scored items; consumed by the weekly maintain-registry run. Every entry either lands in the registry (with the item's URL as source), is rejected with a reason, or is queued for Florian; entries are removed only when consumed.",
    version: queueFile.version,
    candidates: [...queueFile.candidates, ...queueAdds.filter((c) => !queueIds.has(c.id))],
  };

  // ---- defence in depth: the results must themselves validate --------------
  const finalErrors = [
    ...validateItemsFile(nextItems),
    ...validateHeldFile(nextHeld),
    ...validateStateFile(nextState),
    ...validateSourcesFile(nextSources),
    ...validateSourceLedgerFile(nextLedger),
    ...validateRegistryCandidatesFile(nextQueue),
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
  write(ledgerPath, nextLedger);
  write(queuePath, nextQueue);

  // Consumed markers (plan Phase 6): a successful merge means every entry
  // now in the queue was triaged this sweep (presented via
  // candidates-context or deterministically filtered by it). Stamping them
  // stops the 48h window overlap re-feeding the same entries to the next
  // sweep; deep sweeps still re-examine them, flagged. A rejected draft
  // stamps nothing, so a retried sweep sees the identical queue.
  const candidatesPath = join(opts.dataDir, "candidates.json");
  try {
    const queue = JSON.parse(readFileSync(candidatesPath, "utf8")) as {
      candidates?: { consumed?: boolean }[];
    };
    if (Array.isArray(queue.candidates)) {
      for (const c of queue.candidates) c.consumed = true;
      write(candidatesPath, queue);
    }
  } catch {
    // no queue file (test dataDirs, first run): nothing to stamp
  }
  unlinkSync(opts.draftPath);

  return {
    ok: true,
    errors: [],
    added: stampedNew.length,
    updated: draft.updates.length,
    held: draft.held.length + autoHeld.length,
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
