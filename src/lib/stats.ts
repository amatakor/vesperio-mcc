/**
 * Public indices computed from our own data at build time, in the
 * question / answer / method / citation shape. Every citation is a
 * finished claim sentence a reader can paste into a report. Deeper
 * cross-cutting analytics stay reserved for the v2 paid layer.
 */

import type {
  Item,
  ConstellationProfile,
  VehicleProfile,
  SpaceportProfile,
  OrgProfile,
  SweepLogEntry,
} from "../data/schema";

export const SITE_ORIGIN = "https://mcc.vesperio.ai";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StatBlock {
  /** Anchor id on /stats/, and key in stats.json. */
  id: string;
  /** Question the block answers, used as its title. */
  question: string;
  /** One-sentence answer, shown as a pull-quote and used in the citation. */
  answer: string;
  /** [label, value] rows, rendered with bars. */
  rows: Array<[string, number]>;
  /** How the numbers are computed, in one plain sentence. */
  method: string;
  /** Finished claim sentence + anchor + retrieval date. */
  citation: string;
}

export interface HeroStats {
  /** Prose summary sentence with the headline figures. */
  sentence: string;
  /** [big number, label, sublabel] tiles. */
  tiles: Array<[string, string, string]>;
}

function cite(answer: string, anchor: string, asOf: string): string {
  return `"${answer}" MCC, ${SITE_ORIGIN}/stats/#${anchor}, retrieved ${asOf}.`;
}

const sortDesc = (rows: Array<[string, number]>) =>
  rows.slice().sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/** Fixture test items never count; they leave the feed at launch prep. */
function realItems(items: Item[]): Item[] {
  return items.filter((i) => !i.tags.includes("fixture"));
}

function daysAgo(dateIso: string, now: Date): number {
  return (now.getTime() - new Date(dateIso + "T00:00:00Z").getTime()) / DAY_MS;
}

export function computeHero(
  items: Item[],
  constellations: ConstellationProfile[],
  vehicles: VehicleProfile[],
  sweeps: SweepLogEntry[],
  now: Date,
  spaceports: SpaceportProfile[],
  organizations: OrgProfile[],
): HeroStats {
  const real = realItems(items);
  const last7 = real.filter((i) => daysAgo(i.date, now) <= 7).length;
  const last30 = real.filter((i) => daysAgo(i.date, now) <= 30).length;
  const sources = new Set(
    real.flatMap((i) => [i.source_url, ...i.secondary_urls]).map((u) => {
      try {
        return new URL(u).hostname.replace(/^www\./, "");
      } catch {
        return u;
      }
    }),
  );
  const notableUp = real.filter(
    (i) => (i.impact === "notable" || i.impact === "critical") && daysAgo(i.date, now) <= 30,
  ).length;
  const perWeek = last30 > 0 ? Math.round((last30 / 30) * 7 * 10) / 10 : 0;

  return {
    sentence:
      `MCC has tracked ${real.length} items from ${sources.size} distinct sources. ` +
      `${notableUp} notable-or-critical items landed in the last 30 days, ` +
      `and the feed is averaging ${perWeek} items per week.`,
    tiles: [
      [String(real.length), "items tracked", "verified, all-time"],
      [String(last7), "in the last 7 days", "fresh this week"],
      [String(last30), "in the last 30 days", "this month"],
      [
        String(constellations.length + vehicles.length + spaceports.length + organizations.length),
        "registry profiles",
        "sourced and dated",
      ],
      [String(sources.size), "distinct sources", "cited in the feed"],
      [String(sweeps.length), "sweeps run", "including quiet ones"],
    ],
  };
}

export function computeStats(
  items: Item[],
  constellations: ConstellationProfile[],
  vehicles: VehicleProfile[],
  spaceports: SpaceportProfile[],
  now: Date,
): StatBlock[] {
  const asOf = now.toISOString().slice(0, 10);
  const real = realItems(items);
  const blocks: StatBlock[] = [];

  // ------------------------------------------------------ items tracked
  const byCategory = new Map<string, number>();
  for (const item of real) byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
  const catRows = sortDesc([...byCategory.entries()]);
  const topCat = catRows[0];
  const itemsAnswer =
    real.length === 0
      ? "MCC has not published any items yet."
      : `MCC tracks ${real.length} verified items across ${catRows.length} categories, led by ${topCat![0]} (${topCat![1]}).`;
  blocks.push({
    id: "items-tracked",
    question: "What is MCC tracking?",
    answer: itemsAnswer,
    rows: catRows,
    method: "Count of published feed items per category, all-time. Test fixtures excluded.",
    citation: cite(itemsAnswer, "items-tracked", asOf),
  });

  // ----------------------------------------------------------- velocity
  const weeks = 4;
  const weekRows: Array<[string, number]> = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = new Date(now.getTime() - w * 7 * DAY_MS);
    const start = new Date(end.getTime() - 7 * DAY_MS);
    const label = start.toISOString().slice(5, 10);
    const n = real.filter((i) => {
      const t = new Date(i.date + "T00:00:00Z").getTime();
      return t > start.getTime() && t <= end.getTime();
    }).length;
    weekRows.push([label, n]);
  }
  const last4 = weekRows.reduce((a, [, n]) => a + n, 0);
  const velocityAnswer =
    last4 === 0
      ? "No items landed in the last four weeks."
      : `The feed averaged ${Math.round((last4 / 4) * 10) / 10} items per week over the last four weeks.`;
  blocks.push({
    id: "velocity",
    question: "How fast is the news flowing?",
    answer: velocityAnswer,
    rows: weekRows,
    method:
      "Items per 7-day bucket by event date, most recent four buckets; bucket labels are the week start (MM-DD). Momentum versus the prior four weeks will appear once eight weeks of history exist.",
    citation: cite(velocityAnswer, "velocity", asOf),
  });

  // ----------------------------------------------------- launch cadence
  const launches = real.filter((i) => i.category === "launch");
  const byProvider = new Map<string, string[]>();
  for (const l of launches) {
    for (const c of l.companies) {
      byProvider.set(c, [...(byProvider.get(c) ?? []), l.date]);
    }
  }
  const cadenceRows = sortDesc(
    [...byProvider.entries()].map(([c, ds]) => [c, ds.length] as [string, number]),
  );
  const cadenceable = [...byProvider.entries()]
    .filter(([, ds]) => ds.length >= 3)
    .map(([c, ds]) => {
      const times = ds.map((d) => new Date(d + "T00:00:00Z").getTime()).sort((a, b) => a - b);
      const avg = (times[times.length - 1]! - times[0]!) / (times.length - 1) / DAY_MS;
      return [c, Math.round(avg * 10) / 10] as [string, number];
    })
    .sort((a, b) => a[1] - b[1]);
  const cadenceAnswer =
    cadenceable.length > 0
      ? `${cadenceable[0]![0]} launches every ${cadenceable[0]![1]} days on average, the fastest tracked cadence.`
      : `${launches.length} launch events are tracked; no provider has the three or more tracked launches a cadence figure requires yet.`;
  blocks.push({
    id: "launch-cadence",
    question: "Who is launching most often?",
    answer: cadenceAnswer,
    rows: cadenceRows,
    method:
      "Launch-category items grouped by the companies on each item; cadence is the mean days between a provider's tracked launches, shown once a provider has three or more.",
    citation: cite(cadenceAnswer, "launch-cadence", asOf),
  });

  // ------------------------------------------------------ confidence mix
  const byConfidence = new Map<string, number>();
  for (const item of real) {
    byConfidence.set(item.confidence, (byConfidence.get(item.confidence) ?? 0) + 1);
  }
  const confRows = sortDesc([...byConfidence.entries()]);
  const confirmed = byConfidence.get("confirmed") ?? 0;
  const confAnswer =
    real.length === 0
      ? "No items to grade yet."
      : `${confirmed} of ${real.length} items (${Math.round((confirmed / real.length) * 100)}%) are confirmed against primary sources; the rest are labelled reported or signal.`;
  blocks.push({
    id: "confidence-mix",
    question: "How much of the feed is confirmed?",
    answer: confAnswer,
    rows: confRows,
    method:
      "Items per confidence tier. confirmed = the actor itself or an official record; reported = credible trade press, named in the copy; signal = curated voices, flagged unconfirmed.",
    citation: cite(confAnswer, "confidence-mix", asOf),
  });

  // -------------------------------------------------------- impact mix
  const byImpact = new Map<string, number>();
  for (const item of real) byImpact.set(item.impact, (byImpact.get(item.impact) ?? 0) + 1);
  const impactRows = sortDesc([...byImpact.entries()]);
  const critical = byImpact.get("critical") ?? 0;
  const impactAnswer =
    real.length === 0
      ? "No items to grade yet."
      : `${critical} of ${real.length} tracked items are rated critical; the bar for interrupting anyone's Monday stays high.`;
  blocks.push({
    id: "impact-mix",
    question: "How big are the stories?",
    answer: impactAnswer,
    rows: impactRows,
    method: "Items per impact level (critical, notable, routine), all-time.",
    citation: cite(impactAnswer, "impact-mix", asOf),
  });

  // ------------------------------------------------------ sats on orbit
  const satsRows = sortDesc(
    constellations
      .filter((c) => c.sats_on_orbit.value !== null)
      .map((c) => [c.name, c.sats_on_orbit.value as number] as [string, number]),
  );
  const satsAnswer =
    satsRows.length === 0
      ? "No constellation has a sourced on-orbit figure yet."
      : `${satsRows[0]![0]} leads the registry with ${satsRows[0]![1]} satellites recorded on orbit.`;
  blocks.push({
    id: "sats-on-orbit",
    question: "How many satellites are actually up?",
    answer: satsAnswer,
    rows: satsRows,
    method:
      "The sats_on_orbit field of each registry profile; every value carries its own source and as-of date on the profile page. Operators without a sourced figure are absent, not estimated.",
    citation: cite(satsAnswer, "sats-on-orbit", asOf),
  });

  // ------------------------------------------------------- spaceports
  const portRows = sortDesc(
    spaceports
      .filter((p) => p.launches_total.value !== null)
      .map((p) => [p.name, p.launches_total.value as number] as [string, number]),
  ).slice(0, 12);
  const portAnswer =
    portRows.length === 0
      ? "No spaceport has a sourced launch count yet."
      : `${portRows[0]![0]} leads the tracked sites with ${portRows[0]![1]} launches hosted, all-time.`;
  blocks.push({
    id: "launch-sites",
    question: "Where do launches happen?",
    answer: portAnswer,
    rows: portRows,
    method:
      "All-time launches hosted per registry spaceport profile (top 12 shown), each figure sourced to its Launch Library location record with an as-of date.",
    citation: cite(portAnswer, "launch-sites", asOf),
  });

  // ------------------------------------------------- vehicle flight counts
  const flightRows = sortDesc(
    vehicles
      .filter((v) => v.flights_total.value !== null)
      .map((v) => [v.name, v.flights_total.value as number] as [string, number]),
  );
  const flightsAnswer =
    flightRows.length === 0
      ? "No vehicle has a sourced flight count yet."
      : `${flightRows[0]![0]} leads with ${flightRows[0]![1]} recorded flights.`;
  blocks.push({
    id: "vehicle-flight-counts",
    question: "Which rockets have flown the most?",
    answer: flightsAnswer,
    rows: flightRows,
    method:
      "The flights_total field of each registry vehicle profile, sourced per profile; families split across variants record no aggregate.",
    citation: cite(flightsAnswer, "vehicle-flight-counts", asOf),
  });

  return blocks;
}

export function statsJson(hero: HeroStats, blocks: StatBlock[], generatedAt: Date): string {
  return JSON.stringify(
    {
      generated_at: generatedAt.toISOString(),
      site: SITE_ORIGIN,
      summary: hero.sentence,
      stats: blocks.map((b) => ({
        id: b.id,
        question: b.question,
        answer: b.answer,
        anchor: `${SITE_ORIGIN}/stats/#${b.id}`,
        rows: Object.fromEntries(b.rows),
        method: b.method,
        citation: b.citation,
      })),
    },
    null,
    2,
  );
}
