/**
 * Dead-man's switch for the news sweep (plan Phase 5, should-fix 2).
 *
 * The failure-alert steps catch runs that fail; this catches runs that
 * silently stop happening (disabled cron, revoked token, GitHub quietly
 * pausing schedules on inactive repos). It reads state.json's lastSweep
 * and exits non-zero when it is older than twice the sweep interval;
 * the daily health-check workflow turns that into an ops issue.
 *
 * Sweeps run twice daily (05:00/17:00 UTC), so the interval is 12h and
 * the threshold 24h: one missed or failed sweep stays quiet (the run's
 * own alert covers it); two in a row trip the switch.
 */

import { readFileSync } from "node:fs";

export const SWEEP_INTERVAL_HOURS = 12;
export const STALE_AFTER_INTERVALS = 2;

/** True when the last sweep is missing or older than the threshold. */
export function heartbeatStale(
  lastSweep: string | null,
  now: Date,
  thresholdHours = SWEEP_INTERVAL_HOURS * STALE_AFTER_INTERVALS,
): boolean {
  if (lastSweep === null) return true;
  const t = Date.parse(lastSweep);
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > thresholdHours * 3_600_000;
}

function main(): void {
  const root = new URL("..", import.meta.url).pathname;
  const state = JSON.parse(readFileSync(`${root}src/data/state.json`, "utf8")) as {
    lastSweep: string | null;
  };
  const now = new Date();
  if (heartbeatStale(state.lastSweep, now)) {
    const hours = state.lastSweep
      ? ((now.getTime() - Date.parse(state.lastSweep)) / 3_600_000).toFixed(1)
      : "unknown";
    console.error(
      `::error::Sweep heartbeat stale: lastSweep=${state.lastSweep ?? "null"} (${hours}h ago), threshold ${SWEEP_INTERVAL_HOURS * STALE_AFTER_INTERVALS}h. The scheduled sweeps have stopped landing on main.`,
    );
    process.exit(1);
  }
  console.log(`heartbeat ok: lastSweep=${state.lastSweep}`);
}

if (import.meta.main) main();
