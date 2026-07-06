/**
 * Florian's edit-queue review tool. `bun run review` walks held.json
 * entry by entry:
 *
 *   [p]ublish  - stamps { decision: { verdict: "publish", ... } } on the
 *                entry. The entry STAYS in the queue; the next sweep (or
 *                an interactive session) must draft it as a real item
 *                through finalize-sweep's normal scoring gate and remove
 *                it via the draft's resolveHeld field. This tool never
 *                writes items itself.
 *   [d]iscard  - removes the entry from the queue.
 *   [s]kip     - leaves the entry untouched.
 *
 * Every decision is appended to reports/queue-decisions.md (the audit
 * trail) and held.json is rewritten once at the end. Commit the result;
 * the tool does not touch git.
 *
 * Non-interactive use (scripts, agents):
 *   bun scripts/review-queue.ts list
 *   bun scripts/review-queue.ts publish <n> [note...]
 *   bun scripts/review-queue.ts discard <n> [note...]
 * where <n> is the 1-based index shown by `list`.
 */

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import type { HeldFile, HeldEntry } from "../src/data/schema";

const HELD_PATH = "src/data/held.json";
const AUDIT_PATH = "reports/queue-decisions.md";

type Decision = { verdict: "publish"; note?: string; decided: string };
type Entry = HeldEntry & { decision?: Decision };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): { file: HeldFile; entries: Entry[] } {
  const file = JSON.parse(readFileSync(HELD_PATH, "utf8")) as HeldFile;
  return { file, entries: file.held as Entry[] };
}

function save(file: HeldFile): void {
  writeFileSync(HELD_PATH, JSON.stringify(file, null, 2) + "\n");
}

function headlineOf(e: Entry): string {
  const c = e.candidate as Record<string, unknown>;
  return typeof c.headline === "string" ? c.headline : JSON.stringify(c).slice(0, 80);
}

function audit(line: string): void {
  let header = "";
  try {
    readFileSync(AUDIT_PATH, "utf8");
  } catch {
    header =
      "# Edit-queue decisions\n\nAudit trail written by scripts/review-queue.ts. " +
      "publish = approved for drafting through finalize-sweep; discard = removed from the queue.\n\n";
  }
  appendFileSync(AUDIT_PATH, header + line + "\n");
}

function show(e: Entry, i: number, total: number): void {
  const c = e.candidate as Record<string, unknown>;
  console.log(`\n--- ${i + 1} / ${total} (held ${e.date ?? "?"}) ---`);
  console.log(`headline: ${headlineOf(e)}`);
  for (const key of ["source_url", "url", "date", "what_happened"]) {
    if (typeof c[key] === "string") console.log(`${key}: ${(c[key] as string).slice(0, 300)}`);
  }
  console.log(`\nwhy it is queued:\n  ${e.reason}`);
  if (e.decision) {
    console.log(`\nALREADY DECIDED: publish (${e.decision.decided})${e.decision.note ? ` - ${e.decision.note}` : ""}`);
  }
}

function markPublish(entries: Entry[], idx: number, note: string | undefined): void {
  const e = entries[idx]!;
  e.decision = { verdict: "publish", decided: today(), ...(note ? { note } : {}) };
  audit(`- ${today()} PUBLISH "${headlineOf(e)}"${note ? ` — ${note}` : ""}`);
  console.log(`\nmarked for publication. The next sweep drafts it through the scoring gate`);
  console.log(`(or ask Claude to draft it now); the draft removes it via resolveHeld.`);
}

function discard(entries: Entry[], idx: number, note: string | undefined): Entry {
  const [e] = entries.splice(idx, 1);
  audit(`- ${today()} DISCARD "${headlineOf(e!)}"${note ? ` — ${note}` : ""}`);
  console.log(`\ndiscarded.`);
  return e!;
}

async function interactive(): Promise<void> {
  const { file, entries } = load();
  if (entries.length === 0) {
    console.log("// the edit queue is empty");
    return;
  }
  let changed = false;
  let i = 0;
  while (i < entries.length) {
    show(entries[i]!, i, entries.length);
    const answer = (prompt("\n[p]ublish / [d]iscard / [s]kip / [q]uit > ") ?? "q").trim().toLowerCase();
    if (answer === "p") {
      const note = (prompt("note (optional) > ") ?? "").trim() || undefined;
      markPublish(entries, i, note);
      changed = true;
      i++;
    } else if (answer === "d") {
      const note = (prompt("note (optional) > ") ?? "").trim() || undefined;
      discard(entries, i, note);
      changed = true;
      // no i++: the next entry slid into this slot
    } else if (answer === "s") {
      i++;
    } else {
      break;
    }
  }
  if (changed) {
    save(file);
    console.log(`\nheld.json updated (${entries.length} entr${entries.length === 1 ? "y" : "ies"} remaining).`);
    console.log(`decisions logged in ${AUDIT_PATH}. Commit when ready:`);
    console.log(`  git add ${HELD_PATH} ${AUDIT_PATH} && git commit -m "edit queue: review decisions"`);
  } else {
    console.log("\nno changes.");
  }
}

function nonInteractive(cmd: string, argv: string[]): void {
  const { file, entries } = load();
  if (cmd === "list") {
    if (entries.length === 0) {
      console.log("// the edit queue is empty");
      return;
    }
    entries.forEach((e, i) => show(e, i, entries.length));
    return;
  }
  const idx = Number.parseInt(argv[0] ?? "", 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx >= entries.length) {
    console.error(`usage: bun scripts/review-queue.ts ${cmd} <n> [note...]  (1-based; ${entries.length} queued)`);
    process.exit(1);
  }
  const note = argv.slice(1).join(" ").trim() || undefined;
  if (cmd === "publish") markPublish(entries, idx, note);
  else discard(entries, idx, note);
  save(file);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "list" || cmd === "publish" || cmd === "discard") {
  nonInteractive(cmd, rest);
} else if (cmd === undefined) {
  await interactive();
} else {
  console.error("usage: bun scripts/review-queue.ts [list | publish <n> [note] | discard <n> [note]]");
  process.exit(1);
}
