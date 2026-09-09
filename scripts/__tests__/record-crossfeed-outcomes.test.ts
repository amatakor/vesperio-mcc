import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  snapshotQueue,
  recordOutcomes,
  classifyOutcome,
  valuesEqual,
  hostOf,
  QUEUE_FILENAME,
  LOG_FILENAME,
} from "../record-crossfeed-outcomes";
import type { RegistryCrossfeedLogFile } from "../../src/data/schema";

let dir: string;
let dataDir: string;
let snapshotPath: string;

/** A minimal QueueCandidate object, matching scripts/lib/crossfeed.ts's
    QueueCandidate (only the fields this script reads). */
function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "2026-08-01-iceye-fleet-size:iceye.sats_launched_total",
    item_id: "2026-08-01-iceye-fleet-size",
    entity_slug: "iceye",
    entity_type: "constellation",
    field: "sats_launched_total",
    value: 40,
    metric: "satellites launched cumulative",
    same_metric: true,
    item_snr: 4,
    source_url: "https://www.iceye.com/press/40-satellites",
    action: "null_fill",
    proposed_on: "2026-08-01",
    status: "pending",
    ...overrides,
  };
}

function writeQueue(candidates: ReturnType<typeof candidate>[]): void {
  writeFileSync(
    join(dataDir, QUEUE_FILENAME),
    JSON.stringify({ version: "0.1", candidates }, null, 2),
  );
}

function writeProfile(slug: string, fields: Record<string, unknown>): void {
  const regDir = join(dataDir, "registry", "constellations");
  mkdirSync(regDir, { recursive: true });
  writeFileSync(join(regDir, `${slug}.json`), JSON.stringify({ slug, name: "ICEYE", ...fields }, null, 2));
}

function readLog(): RegistryCrossfeedLogFile {
  return JSON.parse(readFileSync(join(dataDir, LOG_FILENAME), "utf8")) as RegistryCrossfeedLogFile;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mcc-crossfeed-outcomes-test-"));
  dataDir = join(dir, "data");
  mkdirSync(dataDir);
  snapshotPath = join(dir, ".crossfeed-before.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("value normalization", () => {
  test("numbers and numeric strings compare equal", () => {
    expect(valuesEqual(40, "40")).toBe(true);
    expect(valuesEqual("40", 40)).toBe(true);
    expect(valuesEqual(40, "41")).toBe(false);
  });

  test("numeric strings with decimals normalize to the same number", () => {
    expect(valuesEqual("40.0", 40)).toBe(true);
  });

  test("non-numeric strings compare case-insensitively after trimming", () => {
    expect(valuesEqual("Active", "active")).toBe(true);
    expect(valuesEqual("  Active  ", "active")).toBe(true);
    expect(valuesEqual("Active", "retired")).toBe(false);
  });

  test("hostOf strips a leading www", () => {
    expect(hostOf("https://www.spacenews.com/article")).toBe("spacenews.com");
    expect(hostOf("https://iceye.com/press")).toBe("iceye.com");
    expect(hostOf("not a url")).toBe("not a url");
  });
});

describe("snapshotQueue", () => {
  test("copies the current queue file verbatim", () => {
    writeQueue([candidate()]);
    snapshotQueue(dataDir, snapshotPath);
    expect(existsSync(snapshotPath)).toBe(true);
    const before = JSON.parse(readFileSync(snapshotPath, "utf8"));
    const live = JSON.parse(readFileSync(join(dataDir, QUEUE_FILENAME), "utf8"));
    expect(before).toEqual(live);
  });
});

describe("classifyOutcome", () => {
  test("landed: value and source both match the proposal", () => {
    const c = candidate();
    const profile = {
      sats_launched_total: { value: 40, source: c.source_url, as_of: "2026-08-01" },
    };
    const { outcome, detail } = classifyOutcome(c as never, profile);
    expect(outcome).toBe("landed");
    expect(detail).toContain("iceye.com");
  });

  test("landed_resourced: value matches but a different source landed", () => {
    const c = candidate();
    const profile = {
      sats_launched_total: {
        value: 40,
        source: "https://spacenews.com/iceye-hits-40-satellites",
        as_of: "2026-08-02",
      },
    };
    const { outcome, detail } = classifyOutcome(c as never, profile);
    expect(outcome).toBe("landed_resourced");
    expect(detail).toContain("spacenews.com");
  });

  test("disputed: the proposal is recorded as a competing claim, not the leading value", () => {
    const c = candidate();
    const profile = {
      sats_launched_total: {
        value: 38,
        source: "https://gunter.space/iceye",
        as_of: "2026-07-20",
        snr: 4,
        tier: "canonical",
        disputed: {
          competing: [{ value: 40, source: c.source_url, as_of: "2026-08-01", snr: 5 }],
        },
      },
    };
    const { outcome, detail } = classifyOutcome(c as never, profile);
    expect(outcome).toBe("disputed");
    expect(detail).toContain("40");
  });

  test("unchanged: the proposal is reflected nowhere on the field", () => {
    const c = candidate();
    const profile = {
      sats_launched_total: { value: 38, source: "https://gunter.space/iceye", as_of: "2026-07-20" },
    };
    const { outcome, detail } = classifyOutcome(c as never, profile);
    expect(outcome).toBe("unchanged");
    expect(detail).toContain("38");
    expect(detail).toContain("gunter.space");
  });

  test("unchanged: the profile could not be read", () => {
    const { outcome, detail } = classifyOutcome(candidate() as never, undefined);
    expect(outcome).toBe("unchanged");
    expect(detail).toContain("could not be read");
  });

  test("unchanged: the field is absent from the profile", () => {
    const { outcome, detail } = classifyOutcome(candidate() as never, { name: "ICEYE" });
    expect(outcome).toBe("unchanged");
    expect(detail).toContain("not found");
  });

  test("value comparison is normalized (numeric string source value)", () => {
    const c = candidate();
    const profile = { sats_launched_total: { value: "40", source: c.source_url, as_of: "2026-08-01" } };
    expect(classifyOutcome(c as never, profile).outcome).toBe("landed");
  });
});

describe("recordOutcomes", () => {
  test("returns wrote:false and touches nothing when no snapshot exists", () => {
    writeQueue([candidate()]);
    const result = recordOutcomes(dataDir, snapshotPath, "2026-08-05T06:00:00.000Z");
    expect(result).toEqual({ wrote: false, consumedCount: 0 });
    expect(existsSync(join(dataDir, LOG_FILENAME))).toBe(false);
  });

  test("returns wrote:false and appends nothing when the queue is unchanged", () => {
    writeQueue([candidate()]);
    snapshotQueue(dataDir, snapshotPath);
    // Queue untouched: nothing was consumed this run.
    const result = recordOutcomes(dataDir, snapshotPath, "2026-08-05T06:00:00.000Z");
    expect(result).toEqual({ wrote: false, consumedCount: 0 });
    expect(existsSync(join(dataDir, LOG_FILENAME))).toBe(false);
  });

  test("classifies each consumed candidate and appends one run entry", () => {
    const landedCandidate = candidate();
    const resourcedCandidate = candidate({
      id: "2026-08-01-iceye-status:iceye.status",
      field: "status",
      value: "active",
      source_url: "https://www.iceye.com/press/status-update",
      action: "null_fill",
    });
    const disputedCandidate = candidate({
      id: "2026-08-01-iceye-country:iceye.country",
      field: "country",
      value: "Finland",
      source_url: "https://www.iceye.com/press/hq",
      action: "flag_refresh",
    });
    const untouchedCandidate = candidate({
      id: "2026-08-01-iceye-orbit:iceye.orbit",
      field: "orbit",
      value: "SSO",
      source_url: "https://www.iceye.com/press/orbit",
      action: "no_registry_change",
    });
    const stillPendingCandidate = candidate({
      id: "2026-08-02-iceye-other:iceye.sats_planned",
      field: "sats_planned",
      value: 100,
      source_url: "https://www.iceye.com/press/roadmap",
    });

    writeQueue([
      landedCandidate,
      resourcedCandidate,
      disputedCandidate,
      untouchedCandidate,
      stillPendingCandidate,
    ]);
    snapshotQueue(dataDir, snapshotPath);

    // The agent "runs": four candidates are consumed (removed), one is left
    // pending; the registry profile is updated to reflect three of them.
    writeQueue([stillPendingCandidate]);
    writeProfile("iceye", {
      sats_launched_total: { value: 40, source: landedCandidate.source_url, as_of: "2026-08-05" },
      status: {
        value: "active",
        source: "https://spacenews.com/iceye-status",
        as_of: "2026-08-05",
      },
      country: {
        value: "Estonia",
        source: "https://gunter.space/iceye",
        as_of: "2026-07-01",
        snr: 4,
        tier: "canonical",
        disputed: {
          competing: [
            { value: "Finland", source: disputedCandidate.source_url, as_of: "2026-08-05", snr: 5 },
          ],
        },
      },
      // orbit field left untouched: the maintenance run rejected it.
      orbit: { value: null, source: null, as_of: null },
    });

    const result = recordOutcomes(dataDir, snapshotPath, "2026-08-05T06:00:00.000Z");
    expect(result).toEqual({ wrote: true, consumedCount: 4 });

    const log = readLog();
    expect(log.runs).toHaveLength(1);
    const run = log.runs[0]!;
    expect(run.at).toBe("2026-08-05T06:00:00.000Z");
    expect(run.consumed).toHaveLength(4);

    const byId = new Map(run.consumed.map((c) => [c.id, c]));
    expect(byId.get(landedCandidate.id)?.outcome).toBe("landed");
    expect(byId.get(resourcedCandidate.id)?.outcome).toBe("landed_resourced");
    expect(byId.get(disputedCandidate.id)?.outcome).toBe("disputed");
    expect(byId.get(untouchedCandidate.id)?.outcome).toBe("unchanged");
    expect(byId.has(stillPendingCandidate.id)).toBe(false);

    // Every consumed field is carried through onto the logged entry.
    const landedEntry = byId.get(landedCandidate.id)!;
    expect(landedEntry.item_id).toBe(landedCandidate.item_id);
    expect(landedEntry.entity_slug).toBe("iceye");
    expect(landedEntry.entity_type).toBe("constellation");
    expect(landedEntry.field).toBe("sats_launched_total");
    expect(landedEntry.value).toBe(40);
    expect(landedEntry.action).toBe("null_fill");
    expect(landedEntry.proposed_on).toBe("2026-08-01");
    expect(landedEntry.item_snr).toBe(4);
    expect(landedEntry.source_url).toBe(landedCandidate.source_url);
    expect(typeof landedEntry.detail).toBe("string");
  });

  test("appends a second run entry alongside an existing one rather than overwriting", () => {
    writeFileSync(
      join(dataDir, LOG_FILENAME),
      JSON.stringify(
        {
          version: "0.1",
          runs: [
            {
              at: "2026-07-01T06:00:00.000Z",
              consumed: [
                {
                  id: "old-entry",
                  item_id: "2026-07-01-old-item",
                  entity_slug: "iceye",
                  entity_type: "constellation",
                  field: "sats_planned",
                  value: 50,
                  action: "null_fill",
                  proposed_on: "2026-07-01",
                  item_snr: 3,
                  source_url: "https://www.iceye.com/old",
                  outcome: "landed",
                  detail: "value landed with the proposed source (iceye.com)",
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    );
    writeQueue([candidate()]);
    snapshotQueue(dataDir, snapshotPath);
    writeQueue([]);
    writeProfile("iceye", {
      sats_launched_total: { value: 40, source: candidate().source_url, as_of: "2026-08-05" },
    });

    const result = recordOutcomes(dataDir, snapshotPath, "2026-08-05T06:00:00.000Z");
    expect(result.wrote).toBe(true);
    const log = readLog();
    expect(log.runs).toHaveLength(2);
    expect(log.runs[0]!.consumed[0]!.id).toBe("old-entry");
    expect(log.runs[1]!.consumed[0]!.id).toBe(candidate().id);
  });
});
