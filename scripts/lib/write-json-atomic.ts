/**
 * Atomic JSON writer (plan Phase 8, should-fix 6). A plain writeFileSync
 * truncates the target before it writes the new bytes, so a crash, a full
 * disk, or a SIGKILL mid-write leaves a half-written or empty file: the
 * data files this repo commits (items.json, state.json, registry profiles)
 * would be corrupted with no backup.
 *
 * This serializes first, writes to a sibling temp file in the SAME
 * directory, then renameSync over the target. A same-filesystem rename is
 * atomic: a reader sees either the old file or the new one, never a torn
 * write, and a crash before the rename leaves the original untouched.
 * Serialization runs before any file is opened, so a value JSON.stringify
 * rejects (a BigInt, a circular structure) throws with the target intact
 * and no temp file created; a failure during the write or rename unlinks
 * the temp file so no litter survives.
 *
 * The temp name carries the pid so two processes writing the same target
 * do not collide on the temp file (the final rename is still last-writer
 * wins, which is the pre-existing behavior).
 */

import { renameSync, unlinkSync, writeFileSync } from "node:fs";

/**
 * Write `data` as JSON to `path` atomically. `indent` matches
 * JSON.stringify's third argument: 2 (default) for the repo's pretty
 * files, 0 for the compact orbits/stock files. A trailing newline is
 * always appended, matching every existing writer.
 */
export function writeJsonAtomic(path: string, data: unknown, indent = 2): void {
  const json = JSON.stringify(data, null, indent) + "\n";
  const tmp = `${path}.tmp.${process.pid}`;
  try {
    writeFileSync(tmp, json);
    renameSync(tmp, path);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      // tmp may never have been created; nothing to clean up.
    }
    throw e;
  }
}
