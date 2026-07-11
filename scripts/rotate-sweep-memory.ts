/**
 * SWEEP_MEMORY rotation (plan Phase 6): runs pre-agent in update-items.yml.
 * Mechanical and lossless: sections whose heading carries a date older than
 * ROTATION_KEEP_DAYS move verbatim to SWEEP_MEMORY_ARCHIVE.md; the
 * hand-curated standing sections (headings without a date, plus the
 * "Standing rules" and "Seed lessons" sections whatever their date) stay
 * verbatim. The agent keeps appending dated entries as before; nothing
 * about the writing contract changes, only how much history rides along
 * in every sweep's fixed context.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const ROTATION_KEEP_DAYS = 30;

/** Headings kept regardless of any date they carry. */
const STANDING_HEADINGS = [/^## Standing rules/i, /^## Seed lessons/i];

interface Section {
  heading: string;
  body: string;
}

/** Splits markdown into a preamble (before the first "## ") and sections. */
export function splitSections(content: string): { preamble: string; sections: Section[] } {
  const lines = content.split("\n");
  const sections: Section[] = [];
  let preamble: string[] = [];
  let current: { heading: string; body: string[] } | null = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) sections.push({ heading: current.heading, body: current.body.join("\n") });
      current = { heading: line, body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) sections.push({ heading: current.heading, body: current.body.join("\n") });
  return { preamble: preamble.join("\n"), sections };
}

function sectionDate(heading: string): string | null {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(heading);
  return m ? m[1]! : null;
}

function isStanding(heading: string): boolean {
  return STANDING_HEADINGS.some((re) => re.test(heading));
}

/**
 * Pure rotation: returns the kept file content and the sections to archive,
 * in original order. Kept + archived reconstruct the input verbatim
 * (section order within each half preserved; nothing rewritten).
 */
export function rotateSweepMemory(
  content: string,
  now: Date,
  keepDays = ROTATION_KEEP_DAYS,
): { kept: string; archived: Section[] } {
  const cutoff = new Date(now.getTime() - keepDays * 86_400_000).toISOString().slice(0, 10);
  const { preamble, sections } = splitSections(content);
  const keep: Section[] = [];
  const archive: Section[] = [];
  for (const s of sections) {
    const date = sectionDate(s.heading);
    const old = date !== null && date < cutoff && !isStanding(s.heading);
    (old ? archive : keep).push(s);
  }
  const kept = [preamble, ...keep.map((s) => `${s.heading}\n${s.body}`)].join("\n");
  return { kept, archived: archive };
}

const ARCHIVE_HEADER = `# SWEEP_MEMORY_ARCHIVE.md

Dated SWEEP_MEMORY.md sections older than ${ROTATION_KEEP_DAYS} days, moved
here verbatim by scripts/rotate-sweep-memory.ts (runs pre-agent in the sweep
workflow). Append-only; the standing rules and the live window stay in
SWEEP_MEMORY.md.
`;

function main(): void {
  const root = new URL("..", import.meta.url).pathname;
  const memoryPath = `${root}SWEEP_MEMORY.md`;
  const archivePath = `${root}SWEEP_MEMORY_ARCHIVE.md`;
  const content = readFileSync(memoryPath, "utf8");
  const { kept, archived } = rotateSweepMemory(content, new Date());
  if (archived.length === 0) {
    console.log("rotate-sweep-memory: nothing older than the window, no changes.");
    return;
  }
  const existing = existsSync(archivePath) ? readFileSync(archivePath, "utf8") : ARCHIVE_HEADER;
  const appended =
    existing.trimEnd() + "\n\n" + archived.map((s) => `${s.heading}\n${s.body}`).join("\n") + "\n";
  writeFileSync(archivePath, appended);
  writeFileSync(memoryPath, kept.endsWith("\n") ? kept : kept + "\n");
  console.log(
    `rotate-sweep-memory: archived ${archived.length} dated section(s) older than ${ROTATION_KEEP_DAYS} days.`,
  );
}

if (import.meta.main) main();
