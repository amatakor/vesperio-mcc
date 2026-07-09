/**
 * PR7b wiring: consumes Florian's per-file logo review (logo-approvals.json,
 * produced by the logo-review.html tool) and ships the approved logos:
 * downloads each approved Commons file, re-hosts it under
 * public/img/registry/logos/, and writes the manifest entry with its full
 * license metadata (license, author, file page) so CC attribution can render
 * on the profile. Approved entries override existing favicon entries; the
 * removed-on-request rule extends to these files unchanged.
 *
 * Idempotent: re-running refreshes the same slugs from the same decisions.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const approvalsPath = join(root, "src/data/logo-approvals.json");
const manifestPath = join(root, "src/data/registry-logos.json");
const outDir = join(root, "public/img/registry/logos");

interface Approval {
  slug: string;
  file_page: string;
  file_url: string;
  license_short: string;
  license_full: string;
  author: string | null;
  usage_terms: string;
  entity_name: string;
  entity_type: string;
}

const approvals = JSON.parse(readFileSync(approvalsPath, "utf8")) as {
  reviewed_at: string;
  approvals: Approval[];
  rejected: string[];
};
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  generated_at: string;
  logos: Record<string, Record<string, unknown>>;
};

mkdirSync(outDir, { recursive: true });

let shipped = 0;
for (const a of approvals.approvals) {
  const ext = extname(new URL(a.file_url).pathname).toLowerCase() || ".png";
  const res = await fetch(a.file_url, {
    headers: { "User-Agent": "VesperioMCC-Sweep contact@vesperio.ai" },
  });
  if (!res.ok) {
    console.error(`SKIP ${a.slug}: HTTP ${res.status} for ${a.file_url}`);
    continue;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const file = `${a.slug}${ext}`;
  writeFileSync(join(outDir, file), buf);
  manifest.logos[a.slug] = {
    file: `/img/registry/logos/${file}`,
    origin: a.file_page,
    fetched_at: new Date().toISOString(),
    license: a.license_short,
    author: a.author,
    // Reviewed per file by Florian (logo-approvals.json, PR7b).
    reviewed: approvals.reviewed_at.slice(0, 10),
  };
  shipped++;
  console.log(`shipped ${a.slug} (${a.license_short}${a.author ? `, ${a.author}` : ""})`);
  await new Promise((r) => setTimeout(r, 800));
}

manifest.generated_at = new Date().toISOString();
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`apply-logo-approvals: ${shipped}/${approvals.approvals.length} shipped, ${approvals.rejected.length} entities left on the initials tile`);
