/**
 * Dead-man's-switch threshold tests (scripts/check-heartbeat.ts): the
 * daily health check must stay quiet through one missed sweep (the run's
 * own failure alert covers it) and trip on two.
 */

import { describe, expect, test } from "bun:test";
import { heartbeatStale, SWEEP_INTERVAL_HOURS, STALE_AFTER_INTERVALS } from "../check-heartbeat";

describe("heartbeatStale", () => {
  const now = new Date("2026-07-11T09:00:00Z");

  test("a sweep inside the threshold is healthy", () => {
    expect(heartbeatStale("2026-07-11T05:10:00Z", now)).toBe(false);
    expect(heartbeatStale("2026-07-10T17:10:00Z", now)).toBe(false);
  });

  test("one missed sweep stays below the threshold", () => {
    // Last sweep yesterday 17:00, this morning's 05:00 failed: 16h ago.
    expect(heartbeatStale("2026-07-10T17:00:00Z", now)).toBe(false);
  });

  test("two missed sweeps trip the switch", () => {
    // Last sweep yesterday 05:00: 28h ago, over the 24h threshold.
    expect(heartbeatStale("2026-07-10T05:00:00Z", now)).toBe(true);
  });

  test("exactly at the threshold does not trip; just past it does", () => {
    const threshold = SWEEP_INTERVAL_HOURS * STALE_AFTER_INTERVALS;
    const atLimit = new Date(now.getTime() - threshold * 3_600_000).toISOString();
    expect(heartbeatStale(atLimit, now)).toBe(false);
    const past = new Date(now.getTime() - (threshold * 3_600_000 + 1)).toISOString();
    expect(heartbeatStale(past, now)).toBe(true);
  });

  test("a missing or unparseable lastSweep is stale", () => {
    expect(heartbeatStale(null, now)).toBe(true);
    expect(heartbeatStale("not-a-date", now)).toBe(true);
  });
});
