/**
 * Fetches ~2 years of daily closes for every registry profile carrying a
 * stock_symbol, writing public/data/stocks/<slug>.json for the profile-page
 * chart. Run daily by cron. Provider: Yahoo Finance chart endpoint (JSON,
 * end-of-day granularity at range=2y/interval=1d); the chart slices this
 * series client-side for its 1M/6M/1Y/ALL range toggle. Attribution rendered
 * in the UI. Output schema is unchanged (fetched_at, source, provider,
 * currency, symbol, closes:[[date,close]]).
 */
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { writeJsonAtomic } from "./lib/write-json-atomic";
import { join } from "node:path";

const OUT = "public/data/stocks";
const UA = "vesperio.ai stock chart pipeline (contact: mail@florianwardell.com)";

const targets: Array<{ slug: string; symbol: string }> = [];
for (const dir of ["organizations", "constellations"]) {
  const base = `src/data/registry/${dir}`;
  for (const f of readdirSync(base).filter((x) => x.endsWith(".json"))) {
    const p = JSON.parse(readFileSync(join(base, f), "utf8"));
    if (typeof p.stock_symbol === "string" && p.stock_symbol) {
      targets.push({ slug: p.slug, symbol: p.stock_symbol });
    }
  }
}

mkdirSync(OUT, { recursive: true });
let ok = 0;
for (const t of targets) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t.symbol)}?range=2y&interval=1d`;
  try {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) {
      console.error(`${t.slug} (${t.symbol}): HTTP ${res.status}, skipped`);
      continue;
    }
    const data = (await res.json()) as any;
    const r = data?.chart?.result?.[0];
    const ts: number[] = r?.timestamp ?? [];
    const closesRaw: Array<number | null> = r?.indicators?.quote?.[0]?.close ?? [];
    const closes: Array<[string, number]> = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closesRaw[i];
      if (typeof c === "number" && Number.isFinite(c)) {
        closes.push([new Date(ts[i]! * 1000).toISOString().slice(0, 10), Number(c.toFixed(2))]);
      }
    }
    if (closes.length < 10) {
      console.error(`${t.slug} (${t.symbol}): only ${closes.length} points, skipped`);
      continue;
    }
    writeJsonAtomic(
      join(OUT, `${t.slug}.json`),
      {
        fetched_at: new Date().toISOString(),
        source: url,
        provider: "Yahoo Finance",
        currency: r?.meta?.currency ?? null,
        symbol: t.symbol,
        closes,
      },
      0,
    );
    ok++;
    console.log(`${t.slug}: ${closes.length} closes (${t.symbol}, ${r?.meta?.currency})`);
  } catch (e) {
    console.error(`${t.slug} (${t.symbol}): failed, skipped: ${e}`);
  }
  await new Promise((r2) => setTimeout(r2, 1200));
}
console.log(`fetch-stocks: ${ok}/${targets.length} written`);
