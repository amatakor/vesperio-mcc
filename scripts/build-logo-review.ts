/**
 * Generates logo-review.html at the repo root: a self-contained, offline
 * review surface for src/data/logo-candidates.json. Florian opens it in a
 * browser (no server needed), sees every candidate image inline with its
 * license, approves at most one per entity or rejects them all, and
 * exports logo-approvals.json for the PR7b wiring pass.
 *
 * The output file is a working artifact, not part of the site: it is NOT
 * under public/ (so it never deploys) and stays untracked.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const data = readFileSync(join(root, "src/data/logo-candidates.json"), "utf8");

const html = `<!doctype html>
<meta charset="utf-8">
<title>MCC logo review</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0a0a0a; color: #e8eaed; font: 14px/1.5 "JetBrains Mono", ui-monospace, Menlo, monospace; }
  header { position: sticky; top: 0; background: #0a0a0a; border-bottom: 1px solid #2e2e2e; padding: 10px 16px; display: flex; gap: 16px; align-items: center; z-index: 5; flex-wrap: wrap; }
  header b { color: #ffe600; }
  button { background: none; border: 1px solid #2e2e2e; color: #e8eaed; font: inherit; padding: 4px 12px; cursor: pointer; }
  button:hover { border-color: #ffe600; }
  button.primary { border-color: #3dff9e; color: #3dff9e; }
  .entity { border-bottom: 1px solid #2e2e2e; padding: 14px 16px; }
  .entity.done { opacity: 0.45; }
  .entity h2 { margin: 0 0 2px; font-size: 15px; }
  .entity h2 .type { color: #8b9096; font-weight: 400; }
  .status { font-size: 12px; margin: 0 0 8px; color: #8b9096; }
  .status .ok { color: #3dff9e; }
  .status .no { color: #ff7a5c; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; }
  .card { border: 1px solid #2e2e2e; background: #141414; width: 200px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
  .card.approved { border-color: #3dff9e; }
  .card .img { height: 90px; display: flex; align-items: center; justify-content: center; background: #fff; }
  .card img { max-width: 184px; max-height: 84px; }
  .card .lic { font-size: 11px; color: #8b9096; }
  .card .lic .warn { color: #ff7a5c; }
  .card a { color: #93a4b5; font-size: 11px; }
  .card .pick { border-color: #3dff9e; color: #3dff9e; }
  .reject-row { margin-top: 8px; }
  .hint { color: #8b9096; font-size: 12px; padding: 8px 16px; }
</style>
<header>
  <b>MCC LOGO REVIEW</b>
  <span id="progress"></span>
  <button id="filter">show: all</button>
  <button id="export" class="primary">export approvals JSON</button>
  <span id="saved" style="color:#8b9096;font-size:12px"></span>
</header>
<p class="hint">Per entity: click USE THIS on the one correct, license-clean logo, or NONE FIT if none do (wrong company, dodgy license). Progress saves in this browser. When done, export and drop the file in the repo root as logo-approvals.json.</p>
<div id="list"></div>
<script id="data" type="application/json">${data}</script>
<script>
  const DATA = JSON.parse(document.getElementById("data").textContent);
  const KEY = "mcc-logo-review-v1";
  let state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
  let showAll = true;
  const save = () => { localStorage.setItem(KEY, JSON.stringify(state)); render(); };
  const list = document.getElementById("list");

  function render() {
    const done = Object.keys(state).length;
    document.getElementById("progress").textContent = done + " / " + DATA.entries.length + " decided";
    document.getElementById("filter").textContent = showAll ? "show: all" : "show: pending";
    list.innerHTML = "";
    for (const e of DATA.entries) {
      const decision = state[e.slug];
      if (!showAll && decision) continue;
      const div = document.createElement("div");
      div.className = "entity" + (decision ? " done" : "");
      const status = decision
        ? decision.file_page
          ? '<span class="ok">APPROVED</span> ' + decision.file_page.split("File:")[1]
          : '<span class="no">NONE FIT</span>'
        : "pending";
      div.innerHTML = "<h2>" + e.entity_name + ' <span class="type">/ ' + e.entity_type + " / " + e.slug + "</span></h2>"
        + '<p class="status">' + status + "</p>";
      const cards = document.createElement("div");
      cards.className = "cards";
      for (const c of e.candidates) {
        const card = document.createElement("div");
        card.className = "card" + (decision && decision.file_page === c.file_page ? " approved" : "");
        const licWarn = c.license_unstated ? '<span class="warn">LICENSE UNSTATED</span>' : c.license_short;
        card.innerHTML = '<div class="img"><img loading="lazy" src="' + c.file_url + '"></div>'
          + '<span class="lic">' + licWarn + (c.author ? " · " + c.author : "") + "</span>"
          + '<a href="' + c.file_page + '" target="_blank" rel="noopener">file page ↗</a>';
        const btn = document.createElement("button");
        btn.className = "pick";
        btn.textContent = "USE THIS";
        btn.onclick = () => { state[e.slug] = { ...c, entity_name: e.entity_name, entity_type: e.entity_type }; save(); };
        card.appendChild(btn);
        cards.appendChild(card);
      }
      div.appendChild(cards);
      const rejRow = document.createElement("div");
      rejRow.className = "reject-row";
      const rej = document.createElement("button");
      rej.textContent = "NONE FIT";
      rej.onclick = () => { state[e.slug] = { rejected: true }; save(); };
      const undo = document.createElement("button");
      undo.textContent = "UNDO";
      undo.onclick = () => { delete state[e.slug]; save(); };
      rejRow.appendChild(rej);
      if (decision) rejRow.appendChild(undo);
      div.appendChild(rejRow);
      list.appendChild(div);
    }
  }
  document.getElementById("filter").onclick = () => { showAll = !showAll; render(); };
  document.getElementById("export").onclick = () => {
    const out = { reviewed_at: new Date().toISOString(), approvals: [], rejected: [] };
    for (const [slug, d] of Object.entries(state)) {
      if (d.rejected) out.rejected.push(slug);
      else out.approvals.push({ slug, ...d });
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "logo-approvals.json";
    a.click();
    document.getElementById("saved").textContent = "exported " + out.approvals.length + " approvals, " + out.rejected.length + " rejections";
  };
  render();
</script>
`;

writeFileSync(join(root, "logo-review.html"), html);
console.log(`logo-review: wrote logo-review.html (${(html.length / 1024).toFixed(0)} kB)`);
