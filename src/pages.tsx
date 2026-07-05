import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Item,
  SourcedField,
  TimelineEvent,
  ConstellationProfile,
  VehicleProfile,
  SpaceportProfile,
  OrgProfile,
  SignalPerson,
} from "./data/schema";
import { CATEGORIES, DOMAIN_TAGS } from "./data/schema";
import {
  items,
  signals,
  signalOutlets,
  signalAvatars,
  constellations,
  vehicles,
  spaceports,
  organizations,
  sweeps,
  itemsByTag,
  itemsMentioning,
  constellationChildren,
} from "./lib/data";
import { computeHero, computeStats } from "./lib/stats";
import { OrbitsStage } from "./orbits/stage";

/** sessionStorage key set on card-link click, read once on the next mount. */
const LAST_ITEM_KEY = "mcc:last-item";

function markVisited(id: string) {
  try {
    sessionStorage.setItem(LAST_ITEM_KEY, id);
  } catch {
    // sessionStorage unavailable (e.g. private mode); visited-highlight is best-effort.
  }
}

/** Reads and clears the last-visited item id, then scrolls its card into view. */
function useVisitedHighlight() {
  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(LAST_ITEM_KEY);
      if (id) sessionStorage.removeItem(LAST_ITEM_KEY);
    } catch {
      return;
    }
    if (!id) return;
    const el = document.querySelector(`[data-item-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.classList.add("card-visited");
    el.scrollIntoView({ block: "center" });
  }, []);
}

// ------------------------------------------------------------------ layout

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className="masthead">
        <a href="/" className="brand">
          MCC / MISSION CONTROL CENTER
        </a>
        <nav className="nav">
          <a href="/">news</a>
          <a href="/tag/eo/">eo</a>
          <a href="/tag/connectivity/">connectivity</a>
          <a href="/tag/iot/">iot</a>
          <a href="/tag/launch/">launch</a>
          <a href="/registry/">registry</a>
          <a href="/orbits/">orbits</a>
          <a href="/signals/">signals</a>
          <a href="/stats/">stats</a>
          <a href="/log/">log</a>
          <a href="/about/">about</a>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <p>
          Machine-maintained. Every item links its source and wears its confidence. Missing a
          story is acceptable; publishing a false one as fact is not.{" "}
          <a href="/about/">Verification policy</a>
        </p>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------- feed

const CAT_ABBR: Record<string, string> = {
  launch: "LAU",
  constellation: "CON",
  contract: "CTR",
  procurement: "PRC",
  regulatory: "REG",
  financial: "FIN",
  product: "PRD",
  partnership: "PTN",
  incident: "INC",
  geopolitical: "GEO",
  "human-spaceflight": "HSF",
};

function UnverifiedBanner() {
  return <span className="unverified-banner">unverified</span>;
}

/** Image when the pipeline found one; otherwise a generated text tile. */
function CardMedia({ item }: { item: Item }) {
  const unverified = item.confidence !== "confirmed";
  if (item.image) {
    return (
      <a
        href={`/item/${item.id}/`}
        className="card-media"
        onClick={() => markVisited(item.id)}
      >
        <img src={item.image.src} alt="" loading="lazy" />
        {unverified && <UnverifiedBanner />}
      </a>
    );
  }
  return (
    <a
      href={`/item/${item.id}/`}
      className="card-media card-tile"
      onClick={() => markVisited(item.id)}
    >
      <span className="tile-cat">{CAT_ABBR[item.category] ?? item.category.toUpperCase()}</span>
      <span className="tile-co">{item.companies[0] ?? item.category}</span>
      {unverified && <UnverifiedBanner />}
    </a>
  );
}

/** Up to 2 tags, domain tags preferred first. */
function cardTags(item: Item): string[] {
  const domain = item.tags.filter((t) => (DOMAIN_TAGS as readonly string[]).includes(t));
  const rest = item.tags.filter((t) => !(DOMAIN_TAGS as readonly string[]).includes(t));
  return [...domain, ...rest].slice(0, 2);
}

function Card({ item }: { item: Item }) {
  const sources = 1 + item.secondary_urls.length;
  return (
    <article className={`card card-${item.impact}`} data-item-id={item.id}>
      <CardMedia item={item} />
      <div className="card-meta">
        <a className="chip" href={`/news/${item.category}/`}>
          {item.category}
        </a>
        {cardTags(item).map((t) => (
          <a key={t} className="chip chip-tag" href={`/tag/${t}/`}>
            #{t}
          </a>
        ))}
        <span className={`chip chip-${item.impact}`}>{item.impact}</span>
        {item.confidence !== "confirmed" && (
          <span className={`chip chip-${item.confidence}`}>{item.confidence}</span>
        )}
        <span className="date">{item.date}</span>
      </div>
      <h2 className="card-headline">
        <a href={`/item/${item.id}/`} onClick={() => markVisited(item.id)}>
          {item.headline}
        </a>
      </h2>
      <p className="card-tagline">{item.explainer.tagline}</p>
      {item.impact === "critical" && (
        <p className="card-extra">{item.explainer.what_happened}</p>
      )}
      <div className="card-foot">
        <span className="card-companies">{item.companies.join(" · ")}</span>
        <span className="card-sources">
          {sources} source{sources === 1 ? "" : "s"}
        </span>
        <a className="card-details" href={`/item/${item.id}/`} onClick={() => markVisited(item.id)}>
          details →
        </a>
      </div>
    </article>
  );
}

/** Renders the card grid with no visited-highlight wiring of its own. */
function FeedListBare({ list, emptyNote }: { list: Item[]; emptyNote: string }) {
  if (list.length === 0) return <p className="empty">{emptyNote}</p>;
  return <div className="cards">{list.map((i) => <Card key={i.id} item={i} />)}</div>;
}

/** FeedListBare plus the visited-highlight mount effect, for pages with a fixed list. */
function FeedList({ list, emptyNote }: { list: Item[]; emptyNote: string }) {
  useVisitedHighlight();
  return <FeedListBare list={list} emptyNote={emptyNote} />;
}

function matchesQuery(item: Item, q: string): boolean {
  const haystack = [item.headline, item.explainer.tagline, ...item.companies, ...item.tags]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function HomePage() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => (q === "" ? items : items.filter((i) => matchesQuery(i, q))), [q]);

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, []);

  const domainCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of DOMAIN_TAGS) m.set(t, 0);
    for (const i of items) {
      for (const t of i.tags) {
        if (m.has(t)) m.set(t, (m.get(t) ?? 0) + 1);
      }
    }
    return m;
  }, []);

  useVisitedHighlight();

  return (
    <Layout>
      <p className="lede">
        The new space economy, tracked by machine: Earth observation, connectivity, launch,
        commercial human spaceflight. Every item carries a plain-English explainer, its source,
        and an honest confidence label.
      </p>
      <nav className="cat-row">
        {CATEGORIES.filter((c) => (catCounts.get(c) ?? 0) > 0).map((c) => (
          <a key={c} href={`/news/${c}/`}>
            {c} <span className="count">{catCounts.get(c) ?? 0}</span>
          </a>
        ))}
      </nav>
      <nav className="cat-row domain-row">
        {DOMAIN_TAGS.map((t) => (
          <a key={t} href={`/tag/${t}/`}>
            {t} <span className="count">{domainCounts.get(t) ?? 0}</span>
          </a>
        ))}
      </nav>
      <div className="filter-bar">
        <input
          ref={inputRef}
          type="text"
          className="filter-input"
          placeholder="/ search"
          aria-label="Search items"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="filter-tally mono">
          {shown.length} / {items.length}
        </span>
      </div>
      {q !== "" && shown.length === 0 ? (
        <p className="empty">// no items match: adjust filters</p>
      ) : (
        <FeedListBare list={shown} emptyNote="No items yet. The first sweep has not run." />
      )}
    </Layout>
  );
}

export function CategoryPage({ category }: { category: string }) {
  return (
    <Layout>
      <h1 className="page-title">news / {category}</h1>
      <FeedList
        list={items.filter((i) => i.category === category)}
        emptyNote={`No ${category} items tracked yet.`}
      />
      <p>
        <a href="/">All news</a>
      </p>
    </Layout>
  );
}

export function TagPage({ tag }: { tag: string }) {
  return (
    <Layout>
      <h1 className="page-title">#{tag}</h1>
      <FeedList list={itemsByTag(tag)} emptyNote={`No ${tag} items tracked yet.`} />
      <p>
        <a href="/">All news</a>
      </p>
    </Layout>
  );
}

const IMPACT_LEVEL: Record<string, number> = { critical: 3, notable: 2, routine: 1 };

function ImpactMeter({ impact }: { impact: string }) {
  const level = IMPACT_LEVEL[impact] ?? 1;
  return (
    <span className={`meter meter-${impact}`} aria-label={`impact: ${impact}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`meter-cell${i < level ? " on" : ""}`} />
      ))}
    </span>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ItemPage({ item }: { item: Item }) {
  const sources = [item.source_url, ...item.secondary_urls];
  return (
    <Layout>
      <article className="item-page item-wide">
        <div className="item-band">
          <ImpactMeter impact={item.impact} />
          <span className="band-impact">{item.impact}</span>
          <a className="chip" href={`/news/${item.category}/`}>
            {item.category}
          </a>
          <span className={`chip chip-${item.confidence}`}>{item.confidence}</span>
          <span className="date">{item.date}</span>
        </div>
        <div className="item-cols">
          <div className="item-side">
            {item.image && (
              <figure className="item-figure">
                <div className="item-figure-media">
                  <img src={item.image.src} alt={item.headline} />
                  {item.confidence !== "confirmed" && <UnverifiedBanner />}
                </div>
                <figcaption className="dim">
                  <a href={item.image.origin_url} rel="noopener">
                    {item.image.credit}
                  </a>
                </figcaption>
              </figure>
            )}
            <div className="src-band">
              // sources · {sources.length} outlet{sources.length === 1 ? "" : "s"}
            </div>
            <ol className="src-list">
              {sources.map((u, i) => (
                <li key={u}>
                  <a href={u} rel="noopener">
                    <span className="src-num">[{i + 1}]</span>
                    <span>
                      <span className="src-kind">{i === 0 ? "primary source" : "secondary"}</span>
                      <span className="src-host">{hostOf(u)}</span>
                    </span>
                    <span className="src-arrow">↗</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
          <div className="item-main">
            <h1 className="page-title">{item.headline}</h1>
            <p className="actor">{item.companies.join(" · ") || item.category}</p>
            <p className="tagline-acc">{item.explainer.tagline}</p>
            <section className="panel">
              <h2>what happened</h2>
              <p>{item.explainer.what_happened}</p>
            </section>
            <section className="panel">
              <h2>why it matters</h2>
              <p>{item.explainer.why_it_matters}</p>
            </section>
            {item.explainer.for_who && (
              <section className="panel">
                <h2>for who</h2>
                <p>{item.explainer.for_who}</p>
              </section>
            )}
            {item.evidence && (
              <section className="panel">
                <h2>evidence</h2>
                <dl className="kv">
                  <dt>Said by</dt>
                  <dd>{item.evidence.said_by}</dd>
                  <dt>Basis</dt>
                  <dd>{item.evidence.basis}</dd>
                  <dt>What would confirm it</dt>
                  <dd>{item.evidence.confirmation ?? "not stated"}</dd>
                </dl>
              </section>
            )}
            <section className="panel">
              <h2>quick facts</h2>
              <dl className="kv">
                <dt>Companies</dt>
                <dd>{item.companies.join(", ") || "none listed"}</dd>
                <dt>Category</dt>
                <dd>{item.category}</dd>
                <dt>Impact</dt>
                <dd>{item.impact}</dd>
                <dt>Confidence</dt>
                <dd>{item.confidence}</dd>
                <dt>Event date</dt>
                <dd>{item.date}</dd>
                {item.publishDate && (
                  <>
                    <dt>Published</dt>
                    <dd>{item.publishDate.slice(0, 16).replace("T", " ")} UTC</dd>
                  </>
                )}
              </dl>
            </section>
            <div className="tag-row">
              {item.tags.map((t) => (
                <a key={t} className="chip chip-tag" href={`/tag/${t}/`}>
                  #{t}
                </a>
              ))}
            </div>
            <p>
              <a href="/">Back to the feed</a>
            </p>
          </div>
        </div>
      </article>
    </Layout>
  );
}

// --------------------------------------------------------------- registry

function fieldRow(label: string, f: SourcedField<unknown>): ReactNode {
  const value =
    f.value === null || f.value === undefined
      ? "unknown"
      : Array.isArray(f.value)
        ? f.value.join(", ")
        : String(f.value);
  return (
    <tr key={label}>
      <th scope="row">{label}</th>
      <td className={f.value === null ? "empty" : ""}>{value}</td>
      <td>{f.as_of ?? ""}</td>
      <td>
        {f.source ? (
          <a href={f.source} rel="noopener">
            source
          </a>
        ) : (
          ""
        )}
      </td>
    </tr>
  );
}

function ProfileTable({ rows }: { rows: Array<[string, SourcedField<unknown>]> }) {
  return (
    <table className="profile">
      <thead>
        <tr>
          <th>field</th>
          <th>value</th>
          <th>as of</th>
          <th>source</th>
        </tr>
      </thead>
      <tbody>{rows.map(([label, f]) => fieldRow(label, f))}</tbody>
    </table>
  );
}

/**
 * Gunter's Space Page permits summarization/RAG only with clear
 * attribution and a direct link to the original URL; render both
 * whenever any field on the profile cites it.
 */
function GuntersAttribution({ rows }: { rows: Array<[string, SourcedField<unknown>]> }) {
  const pages = [
    ...new Set(
      rows
        .map(([, f]) => f.source)
        .filter((s): s is string => typeof s === "string" && s.includes("space.skyrocket.de")),
    ),
  ];
  if (pages.length === 0) return null;
  return (
    <p className="dim attribution">
      Includes data from Gunter's Space Page:{" "}
      {pages.map((url, i) => (
        <span key={url}>
          {i > 0 && ", "}
          <a href={url} rel="noopener">
            {url.replace("https://space.skyrocket.de/", "")}
          </a>
        </span>
      ))}
    </p>
  );
}

type EntityKind = "eo" | "connectivity" | "iot" | "vehicle" | "spaceport" | "org";

interface RegEntry {
  slug: string;
  name: string;
  kind: EntityKind;
  href: string;
  /** Grouping key: operator/provider name, region, or org kind. */
  group: string;
  /** Sub-grouping for constellations (fleet parent slug); null otherwise. */
  parent: string | null;
  affiliation: string;
  figure: string | null;
  figure2: string | null;
  status: string | null;
  firstDate: string | null;
  asOf: string | null;
  snippet: string | null;
  sensors: string[];
  reusable: boolean | null;
}

const KIND_LABEL: Record<EntityKind, string> = {
  eo: "eo constellation",
  connectivity: "connectivity",
  iot: "iot / rf",
  vehicle: "launch vehicle",
  spaceport: "spaceport",
  org: "organization",
};

const REGION_LABEL: Record<string, string> = {
  "north-america": "north america",
  "south-america": "south america",
  europe: "europe",
  asia: "asia",
  oceania: "oceania",
  "middle-east": "middle east",
};

const ORG_KIND_LABEL: Record<string, string> = {
  manufacturer: "manufacturer",
  "in-space-services": "in-space services",
  "ground-segment": "ground segment",
  institution: "institution",
  finance: "finance",
};

function constellationEntries(): RegEntry[] {
  return constellations.map((c) => ({
    slug: c.slug,
    name: c.name,
    kind: c.domain === "eo" ? ("eo" as const) : c.domain === "iot" ? ("iot" as const) : ("connectivity" as const),
    href: `/registry/constellations/${c.slug}/`,
    group: c.operator.value ?? "Operator unconfirmed",
    parent: c.parent ?? null,
    affiliation: c.operator.value ?? "Operator unconfirmed",
    figure:
      c.sats_active_verified.value !== null
        ? `${c.sats_active_verified.value} tracked on orbit`
        : c.sats_active_claimed.value !== null
          ? `${c.sats_active_claimed.value} on orbit (claimed)`
          : null,
    figure2: null,
    status: c.status.value,
    firstDate: c.first_launch_date.value,
    asOf: c.operator.as_of,
    snippet: c.overview.value,
    sensors: c.sensor_types.value ?? [],
    reusable: null,
  }));
}

function vehicleEntries(): RegEntry[] {
  return vehicles.map((v) => ({
    slug: v.slug,
    name: v.name,
    kind: "vehicle" as const,
    href: `/registry/vehicles/${v.slug}/`,
    group: v.provider.value ?? "Provider unconfirmed",
    parent: null,
    affiliation: v.provider.value ?? "Provider unconfirmed",
    figure: v.flights_total.value !== null ? `${v.flights_total.value} flights` : null,
    figure2: null,
    status: v.status.value,
    firstDate: v.first_flight_date.value,
    asOf: v.provider.as_of,
    snippet: v.overview.value,
    sensors: [],
    reusable: v.reusable.value,
  }));
}

function spaceportEntries(): RegEntry[] {
  return spaceports.map((s) => ({
    slug: s.slug,
    name: s.name,
    kind: "spaceport" as const,
    href: `/registry/spaceports/${s.slug}/`,
    group: s.region,
    parent: null,
    affiliation: s.operator.value ?? "Operator unconfirmed",
    figure: s.launches_total.value !== null ? `${s.launches_total.value} launches hosted` : null,
    figure2: s.country.value,
    status: s.status.value,
    firstDate: s.first_launch_date.value,
    asOf: s.launches_total.as_of,
    snippet: s.overview.value,
    sensors: [],
    reusable: null,
  }));
}

function orgEntries(): RegEntry[] {
  return organizations.map((o) => ({
    slug: o.slug,
    name: o.name,
    kind: "org" as const,
    href: `/registry/organizations/${o.slug}/`,
    group: o.kind,
    parent: null,
    affiliation: o.kind,
    figure: o.founded.value !== null ? `founded ${o.founded.value}` : null,
    figure2: o.country.value,
    status: o.status.value,
    firstDate: null,
    asOf: o.focus.as_of,
    snippet: o.overview.value ?? o.focus.value,
    sensors: [],
    reusable: null,
  }));
}

/** Shared attribute filters, applied across all four sections at once. */
const REG_FILTERS: Array<[string, string, (e: RegEntry) => boolean]> = [
  ["eo", "eo", (e) => e.kind === "eo"],
  ["connectivity", "connectivity", (e) => e.kind === "connectivity"],
  ["vehicles", "vehicles", (e) => e.kind === "vehicle"],
  ["sar", "sar", (e) => e.sensors.includes("sar")],
  ["optical", "optical", (e) => e.sensors.includes("optical")],
  ["reusable", "reusable", (e) => e.reusable === true],
  ["operational", "operational", (e) => e.status !== null],
  ["iot", "iot", (e) => e.kind === "iot"],
  ["institutions", "institutions", (e) => e.kind === "org" && e.group === "institution"],
];

function matchesRegQuery(e: RegEntry, q: string): boolean {
  return [e.name, e.affiliation, e.slug].join(" ").toLowerCase().includes(q);
}

/** Preview card shared by every section's third (or fourth) pane. */
function RegPreviewCard({ entry, extraChips }: { entry: RegEntry; extraChips?: ReactNode }) {
  return (
    <>
      <div className="reg-pane-head">
        {entry.name}
        <span className="dim"> / {entry.affiliation}</span>
      </div>
      <a className="reg-card" href={entry.href}>
        <div className="card-meta">
          <span className="chip chip-notable">{KIND_LABEL[entry.kind]}</span>
          {entry.status && <span className="chip">{entry.status}</span>}
          {entry.asOf && <span className="date">{entry.asOf}</span>}
        </div>
        <h3 className="sig-name">{entry.name}</h3>
        {entry.snippet ? (
          <p className="reg-snippet">
            {entry.snippet.length > 260 ? entry.snippet.slice(0, 260) + "..." : entry.snippet}
          </p>
        ) : (
          <p className="reg-snippet dim">
            No sourced overview yet. Unknowns stay unknown rather than estimated.
          </p>
        )}
        <div className="tag-row">
          {entry.figure && <span className="chip sig-tag">{entry.figure}</span>}
          {entry.figure2 && <span className="chip sig-tag">{entry.figure2}</span>}
          {entry.firstDate && <span className="chip sig-tag">first: {entry.firstDate}</span>}
          {entry.sensors.map((s) => (
            <span key={s} className="chip sig-tag">
              {s}
            </span>
          ))}
          {entry.reusable === true && <span className="chip sig-tag">reusable</span>}
          {extraChips}
        </div>
        <span className="reg-open">facts, events &amp; sources &rarr;</span>
      </a>
    </>
  );
}

/** One clickable pane row: name, a count/label on the right, a chevron. */
function RegRow({
  label,
  aside,
  selected,
  onClick,
}: {
  label: string;
  aside: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`reg-row${selected ? " selected" : ""}`} onClick={onClick}>
      <span className="reg-row-name">{label}</span>
      <span className="count">{aside}</span>
      <span className="reg-chev">&rsaquo;</span>
    </button>
  );
}

/**
 * Reusable two-level pane browser: group -> entity -> preview. Used by the
 * launch providers, spaceports, and ecosystem sections. Constellations get
 * a bespoke browser below because it can grow a fourth pane.
 */
function PaneBrowser({
  entries,
  groupLabel,
  groupDisplay = (name) => name,
  entityAside,
}: {
  entries: RegEntry[];
  groupLabel: string;
  groupDisplay?: (name: string) => string;
  entityAside: (e: RegEntry) => ReactNode;
}) {
  const [selGroup, setSelGroup] = useState<string | null>(null);
  const [selSlug, setSelSlug] = useState<string | null>(null);

  const byGroup = new Map<string, RegEntry[]>();
  for (const e of entries) byGroup.set(e.group, [...(byGroup.get(e.group) ?? []), e]);
  const groups = [...byGroup.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );

  const group = groups.find(([name]) => name === selGroup) ?? groups[0];
  const groupEntries = (group ? group[1] : []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const sel = groupEntries.find((e) => e.slug === selSlug) ?? groupEntries[0];

  return (
    <div className="reg-browser">
      <div className="reg-pane reg-ops">
        <div className="reg-pane-head">
          {groupLabel} <span className="dim">{groups.length}</span>
        </div>
        {groups.map(([name, list]) => (
          <RegRow
            key={name}
            label={groupDisplay(name)}
            aside={list.length}
            selected={!!group && name === group[0]}
            onClick={() => {
              setSelGroup(name);
              setSelSlug(null);
            }}
          />
        ))}
      </div>
      <div className="reg-pane reg-ents">
        <div className="reg-pane-head">{group ? groupDisplay(group[0]) : ""}</div>
        {groupEntries.map((e) => (
          <RegRow
            key={e.slug}
            label={e.name}
            aside={entityAside(e)}
            selected={!!sel && e.slug === sel.slug}
            onClick={() => setSelSlug(e.slug)}
          />
        ))}
      </div>
      <div className="reg-pane reg-preview">{sel && <RegPreviewCard entry={sel} />}</div>
    </div>
  );
}

const DOMAIN_LABEL: Record<string, string> = { eo: "eo", connectivity: "connectivity", iot: "iot" };

/**
 * Constellation section browser: domain -> operator -> constellation, with
 * a fourth pane for named sub-constellations (e.g. Planet's SkySat,
 * SuperDove, Pelican, Tanager) when the selected entry has children.
 */
function ConstellationBrowser({ entries }: { entries: RegEntry[] }) {
  const [selDomain, setSelDomain] = useState<string | null>(null);
  const [selOp, setSelOp] = useState<string | null>(null);
  const [selSlug, setSelSlug] = useState<string | null>(null);
  const [selChild, setSelChild] = useState<string | null>(null);

  const byDomain = new Map<string, RegEntry[]>();
  for (const e of entries) byDomain.set(e.kind, [...(byDomain.get(e.kind) ?? []), e]);
  const domains = (["eo", "connectivity", "iot"] as const)
    .filter((d) => (byDomain.get(d) ?? []).length > 0)
    .map((d) => [d, byDomain.get(d) ?? []] as [string, RegEntry[]]);

  const domain = domains.find(([d]) => d === selDomain) ?? domains[0];
  const domainEntries = domain ? domain[1] : [];

  const byOp = new Map<string, RegEntry[]>();
  for (const e of domainEntries) byOp.set(e.group, [...(byOp.get(e.group) ?? []), e]);
  const operators = [...byOp.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  const op = operators.find(([name]) => name === selOp) ?? operators[0];

  // The constellation pane lists only top-level entries (no parent).
  const topLevel = (op ? op[1] : [])
    .filter((e) => !e.parent)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const sel = topLevel.find((e) => e.slug === selSlug) ?? topLevel[0];

  const children = sel ? entries.filter((e) => e.parent === sel.slug).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const child = children.find((e) => e.slug === selChild) ?? undefined;
  const preview = child ?? sel;

  return (
    <div className={`reg-browser ${children.length > 0 ? "reg-browser-5" : "reg-browser-4"}`}>
      <div className="reg-pane reg-ops">
        <div className="reg-pane-head">
          domain <span className="dim">{domains.length}</span>
        </div>
        {domains.map(([d, list]) => (
          <RegRow
            key={d}
            label={DOMAIN_LABEL[d] ?? d}
            aside={list.length}
            selected={!!domain && d === domain[0]}
            onClick={() => {
              setSelDomain(d);
              setSelOp(null);
              setSelSlug(null);
              setSelChild(null);
            }}
          />
        ))}
      </div>
      <div className="reg-pane reg-ops">
        <div className="reg-pane-head">
          operator <span className="dim">{operators.length}</span>
        </div>
        {operators.map(([name, list]) => (
          <RegRow
            key={name}
            label={name}
            aside={list.length}
            selected={!!op && name === op[0]}
            onClick={() => {
              setSelOp(name);
              setSelSlug(null);
              setSelChild(null);
            }}
          />
        ))}
      </div>
      <div className="reg-pane reg-ents">
        <div className="reg-pane-head">{op ? op[0] : ""}</div>
        {topLevel.map((e) => (
          <RegRow
            key={e.slug}
            label={e.name}
            aside={KIND_LABEL[e.kind]}
            selected={!!sel && e.slug === sel.slug}
            onClick={() => {
              setSelSlug(e.slug);
              setSelChild(null);
            }}
          />
        ))}
      </div>
      {sel && children.length > 0 && (
        <div className="reg-pane reg-ents">
          <div className="reg-pane-head">
            {sel.name} constellations <span className="dim">{children.length}</span>
          </div>
          {children.map((c) => (
            <RegRow
              key={c.slug}
              label={c.name}
              aside="constellation"
              selected={!!child && c.slug === child.slug}
              onClick={() => setSelChild(c.slug)}
            />
          ))}
        </div>
      )}
      <div className="reg-pane reg-preview">{preview && <RegPreviewCard entry={preview} />}</div>
    </div>
  );
}

interface RegSection {
  id: string;
  heading: string;
  tagline: string;
  entries: RegEntry[];
}

/** Registry index: four stacked sections, one shared search and filter set. */
export function RegistryIndexPage() {
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const allConstellations = useMemo(constellationEntries, []);
  const allVehicles = useMemo(vehicleEntries, []);
  const allSpaceports = useMemo(spaceportEntries, []);
  const allOrgs = useMemo(orgEntries, []);
  const all = useMemo(
    () => [...allConstellations, ...allVehicles, ...allSpaceports, ...allOrgs],
    [allConstellations, allVehicles, allSpaceports, allOrgs],
  );

  const q = query.trim().toLowerCase();
  const active = REG_FILTERS.find(([id]) => id === filter);
  const passes = (e: RegEntry) => (!active || active[2](e)) && (q === "" || matchesRegQuery(e, q));

  const launchEntries = allVehicles.filter(passes);
  const constellationEntriesVisible = allConstellations.filter(passes);
  const spaceportEntriesVisible = allSpaceports.filter(passes);
  const orgEntriesVisible = allOrgs.filter(passes);

  const sections: RegSection[] = [
    {
      id: "launch",
      heading: "launch service providers",
      tagline: "Who flies, and on what.",
      entries: launchEntries,
    },
    {
      id: "constellations",
      heading: "constellations",
      tagline: "What is up, who owns it.",
      entries: constellationEntriesVisible,
    },
    {
      id: "spaceports",
      heading: "spaceports",
      tagline: "Where it leaves the ground.",
      entries: spaceportEntriesVisible,
    },
    {
      id: "ecosystem",
      heading: "ecosystem",
      tagline: "Everyone else who moves the market.",
      entries: orgEntriesVisible,
    },
  ];

  const visibleCount = sections.reduce((n, s) => n + s.entries.length, 0);

  return (
    <Layout>
      <div className="reg-head">
        <h1 className="page-title">registry</h1>
        <input
          type="text"
          className="filter-input reg-search"
          placeholder="/ filter: entity, operator or provider..."
          aria-label="Search registry"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="reg-counts mono">
          <strong>{all.length}</strong> profiles{" "}
          <strong>{new Set(all.map((e) => e.affiliation)).size}</strong> operators
        </span>
      </div>
      <div className="sig-tabs reg-chips">
        {REG_FILTERS.map(([id, label]) => (
          <button
            key={id}
            className={`sig-tab${filter === id ? " active" : ""}`}
            onClick={() => setFilter(filter === id ? null : id)}
          >
            {label}
          </button>
        ))}
      </div>
      {visibleCount === 0 ? (
        <p className="empty">// nothing matches: adjust filters</p>
      ) : (
        sections.map((s) => {
          if (s.entries.length === 0) return null;
          return (
            <section key={s.id} className="signal-section reg-section">
              <h2 className="signal-heading">
                <span>
                  {s.heading} <span className="badge-acc">{s.entries.length}</span>
                </span>
                <span className="sig-tagline">{s.tagline}</span>
              </h2>
              {s.id === "launch" && (
                <PaneBrowser
                  entries={s.entries}
                  groupLabel="provider"
                  entityAside={() => "vehicle"}
                />
              )}
              {s.id === "constellations" && <ConstellationBrowser entries={s.entries} />}
              {s.id === "spaceports" && (
                <PaneBrowser
                  entries={s.entries}
                  groupLabel="region"
                  groupDisplay={(r) => REGION_LABEL[r] ?? r}
                  entityAside={() => "site"}
                />
              )}
              {s.id === "ecosystem" && (
                <PaneBrowser
                  entries={s.entries}
                  groupLabel="kind"
                  groupDisplay={(k) => ORG_KIND_LABEL[k] ?? k}
                  entityAside={() => "organization"}
                />
              )}
            </section>
          );
        })
      )}
      <p className="dim reg-footnote">
        A registry of constellations, launch vehicles, spaceports, and the wider ecosystem. Pick
        a group, then an entity, to open its profile; every figure carries its source and as-of
        date, and unknown fields stay unknown. Numbers refresh on the weekly maintenance sweep.
      </p>
    </Layout>
  );
}

// ---------------------------------------------------------- profile pages

interface ProfileMeta {
  slug: string;
  name: string;
  typeLabel: string;
  /** operator (constellation) or provider (vehicle) value, for related/events matching. */
  affiliation: string | null;
  rows: Array<[string, SourcedField<unknown>]>;
  overview: SourcedField<string>;
  notes: string | null | undefined;
  href: string;
  siblingsBase: string;
  siblings: Array<{ slug: string; name: string; affiliation: string | null }>;
  breadcrumbSegment: string;
  faq: FaqItem[];
  /** Fleet parent, for constellations with a named operator-level parent profile. */
  parentLink?: { slug: string; name: string } | null;
  /** Named sub-constellations of this profile (e.g. Planet's SkySat, SuperDove). */
  children?: Array<{ slug: string; name: string }>;
  /** Full vehicle roster of a provider org, active and retired alike. */
  vehicleRoster?: Array<{ slug: string; name: string; status: string | null }>;
  /** Sourced history timeline (Task 15); rendered when non-empty. */
  history?: TimelineEvent[];
  /** Dim methodology note under the facts table. */
  tableNote?: string | null;
}

function Breadcrumbs({
  segment,
  name,
  parentLink,
}: {
  segment: string;
  name: string;
  parentLink?: { slug: string; name: string } | null;
}) {
  return (
    <p className="dim mono breadcrumbs">
      <a href="/registry/">registry</a> / <a href="/registry/">{segment}</a> / {name}
      {parentLink && (
        <>
          {" "}
          <span className="dim">
            (part of{" "}
            <a href={`/registry/constellations/${parentLink.slug}/`}>{parentLink.name}</a>)
          </span>
        </>
      )}
    </p>
  );
}

/** Numbered "// on this page" jump-list, ai-tldr style, built from the sections present. */
function OnThisPageToc({ sections }: { sections: Array<[string, string]> }) {
  return (
    <section className="panel toc-panel">
      <h2>on this page</h2>
      <ol className="toc-list">
        {sections.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`}>{label}</a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EventsSection({ profile }: { profile: ProfileMeta }) {
  const names = [profile.name, profile.affiliation].filter((n): n is string => !!n);
  // items is sorted newest-first already; itemsMentioning preserves that order.
  const events = itemsMentioning(names);
  if (events.length === 0) return null;
  return (
    <section id="events" className="panel">
      <h2>events</h2>
      <ul className="index-list event-list">
        {events.map((i) => (
          <li key={i.id} className="event-row">
            <span className="date">{i.date}</span>
            <span className={`chip chip-${i.impact}`}>{i.impact}</span>
            <a href={`/item/${i.id}/`}>{i.headline}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RelatedSection({
  profile,
  related,
  prev,
  next,
}: {
  profile: ProfileMeta;
  related: Array<{ slug: string; name: string; href: string }>;
  prev: { slug: string; name: string } | null;
  next: { slug: string; name: string } | null;
}) {
  if (related.length === 0 && !prev && !next) return null;
  return (
    <section id="related" className="panel">
      <h2>related</h2>
      {related.length > 0 && (
        <div className="tag-row">
          {related.map((r) => (
            <a key={r.slug} className="chip chip-tag" href={r.href}>
              {r.name}
            </a>
          ))}
        </div>
      )}
      <div className="prev-next">
        <span>{prev ? <a href={`${profile.siblingsBase}${prev.slug}/`}>&larr; {prev.name}</a> : <span className="dim">&larr; start</span>}</span>
        <span>{next ? <a href={`${profile.siblingsBase}${next.slug}/`}>{next.name} &rarr;</a> : <span className="dim">end &rarr;</span>}</span>
      </div>
    </section>
  );
}

/** Named sub-constellations of a fleet-level parent (e.g. Planet's SkySat, SuperDove). */
function ChildConstellationsSection({ children }: { children: Array<{ slug: string; name: string }> }) {
  if (children.length === 0) return null;
  return (
    <section id="constellations" className="panel">
      <h2>constellations</h2>
      <div className="tag-row">
        {children.map((c) => (
          <a key={c.slug} className="chip chip-tag" href={`/registry/constellations/${c.slug}/`}>
            {c.name}
          </a>
        ))}
      </div>
    </section>
  );
}

/** Sourced history timeline: every event carries its own source link. */
function HistorySection({ history }: { history: TimelineEvent[] }) {
  if (history.length === 0) return null;
  const ordered = [...history].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section id="history" className="panel">
      <h2>history</h2>
      <ol className="timeline">
        {ordered.map((e) => (
          <li key={`${e.date}-${e.headline}`}>
            <span className="mono timeline-date">{e.date}</span>
            <span>
              {e.headline}{" "}
              <a href={e.source} rel="noopener" className="dim">
                (source, as of {e.as_of})
              </a>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A provider's vehicles, active and retired alike; the status makes the tag meaningful. */
function VehicleRosterSection({ roster }: { roster: Array<{ slug: string; name: string; status: string | null }> }) {
  if (roster.length === 0) return null;
  return (
    <section id="vehicles" className="panel">
      <h2>vehicles</h2>
      <div className="tag-row">
        {roster.map((v) => (
          <a key={v.slug} className="chip chip-tag" href={`/registry/vehicles/${v.slug}/`}>
            {v.name} <span className="dim">/ {v.status ?? "status unknown"}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function SourcesSection({ rows }: { rows: Array<[string, SourcedField<unknown>]> }) {
  const byUrl = new Map<string, string[]>();
  for (const [label, f] of rows) {
    if (!f.source) continue;
    const list = byUrl.get(f.source) ?? [];
    list.push(label);
    byUrl.set(f.source, list);
  }
  const urls = [...byUrl.keys()];
  if (urls.length === 0) return null;
  return (
    <section id="sources" className="panel">
      <h2>sources</h2>
      <ol className="src-list">
        {urls.map((u, i) => (
          <li key={u}>
            <a href={u} rel="noopener">
              <span className="src-num">[{i + 1}]</span>
              <span>
                <span className="src-kind">{hostOf(u)}</span>
                <span className="src-host">{byUrl.get(u)!.join(", ")}</span>
              </span>
              <span className="src-arrow">↗</span>
            </a>
          </li>
        ))}
      </ol>
      <GuntersAttribution rows={rows} />
    </section>
  );
}

interface FaqItem {
  q: string;
  field: SourcedField<unknown>;
  render: (value: unknown) => string;
}

function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section id="faq" className="panel">
      <h2>faq</h2>
      {items.map(({ q, field, render }) => (
        <details className="cite faq-item" key={q}>
          <summary>{q}</summary>
          <p className="citation">
            {field.value === null || field.value === undefined ? (
              "No sourced figure yet. Unknowns stay unknown rather than estimated."
            ) : (
              <>
                {render(field.value)}{" "}
                <a href={field.source ?? undefined} rel="noopener" className="dim">
                  (source, as of {field.as_of})
                </a>
              </>
            )}
          </p>
        </details>
      ))}
    </section>
  );
}

/** Shared destination-page shell for every registry profile type. */
function ProfilePage({ profile }: { profile: ProfileMeta }) {
  const children = profile.children ?? [];
  const roster = profile.vehicleRoster ?? [];
  const history = profile.history ?? [];
  const sections: Array<[string, string]> = [["facts", "facts"]];
  if (history.length > 0) sections.push(["history", "history"]);
  if (children.length > 0) sections.push(["constellations", "constellations"]);
  if (roster.length > 0) sections.push(["vehicles", "vehicles"]);
  const names = [profile.name, profile.affiliation].filter((n): n is string => !!n);
  const hasEvents = itemsMentioning(names).length > 0;
  if (hasEvents) sections.push(["events", "events"]);

  const related = profile.affiliation
    ? profile.siblings
        .filter(
          (s) =>
            s.slug !== profile.slug &&
            s.affiliation &&
            s.affiliation.toLowerCase() === profile.affiliation!.toLowerCase(),
        )
        .map((s) => ({ slug: s.slug, name: s.name, href: `${profile.siblingsBase}${s.slug}/` }))
    : [];
  const ordered = profile.siblings.slice().sort((a, b) => a.name.localeCompare(b.name));
  const idx = ordered.findIndex((s) => s.slug === profile.slug);
  const prev = idx > 0 ? ordered[idx - 1]! : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1]! : null;
  if (related.length > 0 || prev || next) sections.push(["related", "related"]);

  const hasSources = profile.rows.some(([, f]) => !!f.source);
  if (hasSources) sections.push(["sources", "sources"]);
  sections.push(["faq", "faq"]);

  return (
    <Layout>
      <div className="registry-profile">
        <Breadcrumbs
          segment={profile.breadcrumbSegment}
          name={profile.name}
          parentLink={profile.parentLink}
        />
        <h1 className="page-title">
          {profile.name} <span className="dim">/ {profile.typeLabel}</span>
        </h1>
        {profile.overview.value && (
          <>
            <p className="tagline-acc">{profile.overview.value}</p>
            <p className="dim source-line">
              <a href={profile.overview.source ?? undefined} rel="noopener">
                (source, as of {profile.overview.as_of})
              </a>
            </p>
          </>
        )}
        <OnThisPageToc sections={sections} />
        <section id="facts" className="panel">
          <h2>facts</h2>
          <ProfileTable rows={profile.rows} />
          {profile.tableNote && <p className="dim">{profile.tableNote}</p>}
          {profile.notes && <p className="dim">{profile.notes}</p>}
        </section>
        <ChildConstellationsSection children={children} />
        <HistorySection history={history} />
        <VehicleRosterSection roster={roster} />
        <EventsSection profile={profile} />
        <RelatedSection profile={profile} related={related} prev={prev} next={next} />
        {hasSources && <SourcesSection rows={profile.rows} />}
        <FaqSection items={profile.faq} />
        <p>
          <a href="/registry/">Back to the registry</a>
        </p>
      </div>
    </Layout>
  );
}

export function ConstellationPage({ profile }: { profile: ConstellationProfile }) {
  const rows: Array<[string, SourcedField<unknown>]> = [
    ["operator", profile.operator],
    ["country", profile.country],
    ["sensor types", profile.sensor_types],
    ["sats launched (total)", profile.sats_launched_total],
    ["sats active (claimed)", profile.sats_active_claimed],
    ["sats active (verified)", profile.sats_active_verified],
    ["sats planned", profile.sats_planned],
    ["orbit", profile.orbit],
    ["first launch", profile.first_launch_date],
    ["latest launch", profile.latest_launch_date],
    ["status", profile.status],
    ["website", profile.website],
  ];
  const faq: FaqItem[] = [
    {
      q: `Who operates ${profile.name}?`,
      field: profile.operator,
      render: (v) => `${profile.name} is operated by ${v as string}.`,
    },
    {
      q: `How many ${profile.name} satellites are active on orbit?`,
      field: profile.sats_active_verified,
      render: (v) =>
        `CelesTrak's catalog currently tracks ${v as number} object${(v as number) === 1 ? "" : "s"} for ${profile.name}.`,
    },
    {
      q: `When did ${profile.name} first launch?`,
      field: profile.first_launch_date,
      render: (v) => `${profile.name} first launched on ${v as string}.`,
    },
  ];
  const children = constellationChildren(profile.slug);
  const parent = profile.parent ? constellations.find((c) => c.slug === profile.parent) : undefined;
  const meta: ProfileMeta = {
    slug: profile.slug,
    name: profile.name,
    typeLabel: `${profile.domain} constellation`,
    affiliation: profile.operator.value,
    rows,
    overview: profile.overview,
    notes: profile.notes,
    href: `/registry/constellations/${profile.slug}/`,
    siblingsBase: "/registry/constellations/",
    siblings: constellations.map((c) => ({ slug: c.slug, name: c.name, affiliation: c.operator.value })),
    breadcrumbSegment: "constellations",
    history: profile.events ?? [],
    tableNote:
      profile.sats_active_verified.value !== null
        ? "sats active (verified) counts objects currently tracked in CelesTrak's catalog for this constellation. It is a tracking count, not an operator claim about satellite health."
        : null,
    faq,
    parentLink: parent ? { slug: parent.slug, name: parent.name } : null,
    children: children.map((c) => ({ slug: c.slug, name: c.name })),
  };
  return <ProfilePage profile={meta} />;
}

export function VehiclePage({ profile }: { profile: VehicleProfile }) {
  const rows: Array<[string, SourcedField<unknown>]> = [
    ["provider", profile.provider],
    ["country", profile.country],
    ["class", profile.vehicle_class],
    ["payload to LEO (kg)", profile.payload_leo_kg],
    ["reusable", profile.reusable],
    ["first flight", profile.first_flight_date],
    ["flights total", profile.flights_total],
    ["flights successful", profile.flights_successful],
    ["last flight", profile.last_flight_date],
    ["next flight", profile.next_flight_date],
    ["status", profile.status],
    ["price per launch (USD)", profile.price_per_launch_usd],
  ];
  const faq: FaqItem[] = [
    {
      q: `Who builds ${profile.name}?`,
      field: profile.provider,
      render: (v) => `${profile.name} is built by ${v as string}.`,
    },
    {
      q: `How many times has ${profile.name} flown?`,
      field: profile.flights_total,
      render: (v) => `${profile.name} has flown ${v as number} times.`,
    },
    {
      q: `When did ${profile.name} first fly?`,
      field: profile.first_flight_date,
      render: (v) => `${profile.name} first flew on ${v as string}.`,
    },
    {
      q: `Is ${profile.name} reusable?`,
      field: profile.reusable,
      render: (v) => `${profile.name} is ${v ? "" : "not "}reusable.`,
    },
  ];
  const meta: ProfileMeta = {
    slug: profile.slug,
    name: profile.name,
    typeLabel: "launch vehicle",
    affiliation: profile.provider.value,
    rows,
    overview: profile.overview,
    notes: profile.notes,
    href: `/registry/vehicles/${profile.slug}/`,
    siblingsBase: "/registry/vehicles/",
    siblings: vehicles.map((v) => ({ slug: v.slug, name: v.name, affiliation: v.provider.value })),
    breadcrumbSegment: "vehicles",
    faq,
  };
  return <ProfilePage profile={meta} />;
}

export function SpaceportPage({ profile }: { profile: SpaceportProfile }) {
  const rows: Array<[string, SourcedField<unknown>]> = [
    ["country", profile.country],
    ["operator", profile.operator],
    ["first launch", profile.first_launch_date],
    ["launches total", profile.launches_total],
    ["status", profile.status],
    ["website", profile.website],
  ];
  const faq: FaqItem[] = [
    {
      q: `Where is ${profile.name}?`,
      field: profile.country,
      render: (v) => `${profile.name} is located in ${v as string}.`,
    },
    {
      q: `How many launches has ${profile.name} hosted?`,
      field: profile.launches_total,
      render: (v) => `${profile.name} has hosted ${v as number} launches.`,
    },
    {
      q: `Who operates ${profile.name}?`,
      field: profile.operator,
      render: (v) => `${profile.name} is operated by ${v as string}.`,
    },
  ];
  const meta: ProfileMeta = {
    slug: profile.slug,
    name: profile.name,
    typeLabel: "spaceport",
    affiliation: profile.operator.value,
    rows,
    overview: profile.overview,
    notes: profile.notes,
    href: `/registry/spaceports/${profile.slug}/`,
    siblingsBase: "/registry/spaceports/",
    siblings: spaceports
      .filter((s) => s.region === profile.region)
      .map((s) => ({ slug: s.slug, name: s.name, affiliation: s.region })),
    breadcrumbSegment: "spaceports",
    faq,
  };
  return <ProfilePage profile={meta} />;
}

export function OrgPage({ profile }: { profile: OrgProfile }) {
  const rows: Array<[string, SourcedField<unknown>]> = [
    ["country", profile.country],
    ["founded", profile.founded],
    ["focus", profile.focus],
    ["status", profile.status],
    ["website", profile.website],
  ];
  // Full roster, active and retired alike, matched on the vehicle's stated provider.
  const vehicleRoster = vehicles
    .filter((v) => v.provider.value && v.provider.value.toLowerCase() === profile.name.toLowerCase())
    .map((v) => ({ slug: v.slug, name: v.name, status: v.status.value }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const faq: FaqItem[] = [
    {
      q: `What is ${profile.name}?`,
      field: profile.focus,
      render: (v) => `${profile.name} focuses on ${v as string}.`,
    },
    {
      q: `Where is ${profile.name} based?`,
      field: profile.country,
      render: (v) => `${profile.name} is based in ${v as string}.`,
    },
    {
      q: `When was ${profile.name} founded?`,
      field: profile.founded,
      render: (v) => `${profile.name} was founded in ${v as number}.`,
    },
  ];
  const meta: ProfileMeta = {
    slug: profile.slug,
    name: profile.name,
    typeLabel: "organization",
    affiliation: null,
    rows,
    overview: profile.overview,
    notes: profile.notes,
    href: `/registry/organizations/${profile.slug}/`,
    siblingsBase: "/registry/organizations/",
    siblings: organizations
      .filter((o) => o.kind === profile.kind)
      .map((o) => ({ slug: o.slug, name: o.name, affiliation: o.kind })),
    breadcrumbSegment: "organizations",
    faq,
    vehicleRoster,
    history: profile.events ?? [],
  };
  return <ProfilePage profile={meta} />;
}

// ---------------------------------------------------------------- signals

const BUCKET_META: Record<string, [string, string]> = {
  founder_exec: ["founders & executives", "The people running the rockets and constellations."],
  agency_leader: ["agency leaders", "The officials whose signatures move programs."],
  engineer_operator: ["engineers & trackers", "Builders and independent trackers posting primary data."],
  analyst: ["analysts", "The sharpest reads on markets, China, and policy."],
  journalist: ["journalists", "Reporters who break it before the wires."],
  creator: ["creators", "Video explainers credible enough for engineers to cite."],
};

function initialsOf(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function followerBadge(person: SignalPerson): string | null {
  const est = person.channels.find((c) => c.follower_scale_est)?.follower_scale_est;
  if (!est) return null;
  const token = est.split(" ")[0]!;
  return /^\d+[KM]$/.test(token) ? `${token}+` : token;
}

const PLATFORM_LABELS: Record<string, string> = {
  x: "twitter/x",
  youtube: "youtube",
  bluesky: "bluesky",
  linkedin: "linkedin",
  substack: "substack",
  beehiiv: "newsletter",
  podcast: "podcast",
  site: "web",
};

/** Platform marks, nominative use: they say where the link goes. */
const PLATFORM_ICONS: Record<string, ReactNode> = {
  x: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.51A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.123 2.136c1.872.51 9.377.51 9.377.51s7.505 0 9.377-.51a3.02 3.02 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.545 15.568V8.432L15.818 12z" />
    </svg>
  ),
  bluesky: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  ),
  substack: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
    </svg>
  ),
};

function PlatformChip({ type, active }: { type: string; active: boolean }) {
  return (
    <span className={`chip sig-platform sig-p-${type}${active ? "" : " chip-reported"}`}>
      {PLATFORM_ICONS[type]}
      {PLATFORM_LABELS[type] ?? type}
    </span>
  );
}

const ROLE_TAGS = [
  "ceo",
  "founder",
  "administrator",
  "director general",
  "editor",
  "correspondent",
  "reporter",
  "analyst",
  "astrophysicist",
  "tracker",
  "youtuber",
  "director",
  "principal",
  "author",
] as const;

function roleTag(role: string): string | null {
  const lower = role.toLowerCase();
  return ROLE_TAGS.find((r) => lower.includes(r)) ?? null;
}

function SignalCard({ person }: { person: SignalPerson }) {
  const primary =
    person.channels.find((c) => c.status === "verified_active") ?? person.channels[0];
  const followers = followerBadge(person);
  const avatar = signalAvatars[person.id];
  const role = roleTag(person.role);
  const tags = [person.org, ...(role ? [role] : []), ...person.domains.map((d) => d.replace(/_/g, "-"))];
  return (
    <a className="sig-card" href={primary ? primary.url : undefined} rel="noopener">
      <div className="sig-avatar" aria-hidden="true">
        {avatar ? <img src={avatar} alt="" loading="lazy" /> : initialsOf(person.name)}
      </div>
      <div className="sig-body">
        <div className="sig-top">
          {primary && <PlatformChip type={primary.type} active={primary.status === "verified_active"} />}
          {followers && <span className="sig-followers">{followers}</span>}
        </div>
        <h3 className="sig-name">{person.name}</h3>
        {primary && (
          <span className="sig-handle">
            {primary.handle ? `@${primary.handle}` : primary.url.replace(/^https?:\/\/(www\.)?/, "")}
          </span>
        )}
        <p className="sig-why">{person.why}</p>
        <div className="sig-tags">
          {tags.map((t) => (
            <span key={t} className="chip sig-tag">
              {t}
            </span>
          ))}
        </div>
      </div>
    </a>
  );
}

function matchesSignalQuery(p: SignalPerson, q: string): boolean {
  const hay = [
    p.name,
    p.org,
    p.role,
    p.why,
    ...p.domains,
    ...p.regions,
    ...p.channels.map((c) => c.handle ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

// ---------------------------------------------------------------- orbits

/** 6A app frame: full-bleed header (brand + nav rows, ORBITS underlined
 * active), the stage filling the viewport, footer rendered by the scene.
 * The old H1 + intro prose are removed on this view per the handoff. */
export function OrbitsPage() {
  const links: Array<[string, string]> = [
    ["/", "news"],
    ["/tag/eo/", "eo"],
    ["/tag/connectivity/", "connectivity"],
    ["/tag/iot/", "iot"],
    ["/tag/launch/", "launch"],
    ["/registry/", "registry"],
    ["/orbits/", "orbits"],
    ["/signals/", "signals"],
    ["/stats/", "stats"],
    ["/log/", "log"],
    ["/about/", "about"],
  ];
  return (
    <div>
      <header className="ohead">
        <a href="/" className="brand">
          MCC / MISSION CONTROL CENTER
        </a>
        <nav className="nav onav">
          {links.map(([href, label]) => (
            <a key={href} href={href} className={label === "orbits" ? "onav-active" : undefined}>
              {label}
            </a>
          ))}
        </nav>
      </header>
      <OrbitsStage />
    </div>
  );
}

export function SignalsPage() {
  const [bucket, setBucket] = useState<string>("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = signals.filter(
    (p) => (bucket === "all" || p.bucket === bucket) && (q === "" || matchesSignalQuery(p, q)),
  );
  const whitelisted = signals.filter((p) => p.whitelist === "yes").length;
  const countFor = (b: string) => signals.filter((p) => p.bucket === b).length;

  return (
    <Layout>
      <h1 className="page-title">top signals to follow</h1>
      <p className="dim mono">
        {signals.length} people worth following · curated by role · {whitelisted} on the sourcing
        whitelist
      </p>
      <div className="sig-controls">
        <div className="sig-tabs">
          <button
            className={`sig-tab${bucket === "all" ? " active" : ""}`}
            onClick={() => setBucket("all")}
          >
            all <span className="count">{signals.length}</span>
          </button>
          {Object.entries(BUCKET_META).map(([b, [label]]) => (
            <button
              key={b}
              className={`sig-tab${bucket === b ? " active" : ""}`}
              onClick={() => setBucket(b)}
            >
              {label} <span className="count">{countFor(b)}</span>
            </button>
          ))}
        </div>
        <input
          type="text"
          className="filter-input sig-search"
          placeholder="/ search name, handle, topic"
          aria-label="Search signals"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <p className="empty">// nobody matches: adjust filters</p>
      ) : (
        Object.entries(BUCKET_META).map(([b, [label, tagline]]) => {
          const group = filtered.filter((p) => p.bucket === b);
          if (group.length === 0) return null;
          return (
            <section key={b} className="signal-section">
              <h2 className="signal-heading">
                <span>
                  {label} <span className="badge-acc">{group.length}</span>
                </span>
                <span className="sig-tagline">{tagline}</span>
              </h2>
              <div className="sig-grid">
                {group.map((p) => (
                  <SignalCard key={p.id} person={p} />
                ))}
              </div>
            </section>
          );
        })
      )}
      {signalOutlets.length > 0 && bucket === "all" && q === "" && (
        <section className="signal-section">
          <h2 className="signal-heading">
            <span>
              outlets we read <span className="badge-acc">{signalOutlets.length}</span>
            </span>
            <span className="sig-tagline">Publications, not people; tracked as sources.</span>
          </h2>
          <ul className="index-list">
            {signalOutlets.map((o) => (
              <li key={o.id}>
                <a href={o.url} rel="noopener">
                  {o.name}
                </a>
                <div className="dim">{o.why}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Layout>
  );
}


// ------------------------------------------------------------------ stats

export function StatsPage({ generatedAt }: { generatedAt: string }) {
  const now = new Date(generatedAt);
  const hero = computeHero(items, constellations, vehicles, sweeps, now, spaceports, organizations);
  const blocks = computeStats(items, constellations, vehicles, spaceports, now);
  return (
    <Layout>
      <h1 className="page-title">stats</h1>
      <p className="lede">
        Live indices computed from MCC data on every build. Each block answers one question,
        states its method, and offers a ready-made citation. Machine-readable copy at{" "}
        <a href="/stats.json">/stats.json</a>.
      </p>
      <p className="hero-sentence">{hero.sentence}</p>
      <p>
        <span className="badge-acc">updated {generatedAt.slice(0, 10)}</span>
      </p>
      <div className="tiles">
        {hero.tiles.map(([num, label, sub]) => (
          <div key={label} className="tile">
            <span className="tile-num">{num}</span>
            <span className="tile-label">{label}</span>
            <span className="tile-sub">{sub}</span>
          </div>
        ))}
      </div>
      {blocks.map((b) => {
        const max = Math.max(1, ...b.rows.map(([, v]) => v));
        return (
          <section key={b.id} id={b.id} className="stat-block">
            <h2>
              <a href={`#${b.id}`}>#</a> {b.question}
            </h2>
            <p className="stat-answer">{b.answer}</p>
            {b.rows.length === 0 ? (
              <p className="empty">// no data yet; this index fills as the feed and registry grow</p>
            ) : (
              <table className="stat-table">
                <tbody>
                  {b.rows.map(([label, value]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td className="num">{value}</td>
                      <td className="bar-cell">
                        <div
                          className="bar"
                          style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="dim stat-method">{b.method}</p>
            <details className="cite">
              <summary>cite this</summary>
              <p className="citation">
                <code>{b.citation}</code>
              </p>
            </details>
          </section>
        );
      })}
    </Layout>
  );
}

// ------------------------------------------------------------------ about

const QA: Array<[string, string]> = [
  [
    "What is MCC?",
    "A machine-maintained tracker for the new space economy: Earth observation, connectivity, launch, and commercial human spaceflight. It surfaces fresh items twice daily, keeps reference profiles of constellations and launch vehicles, and publishes basic computed statistics.",
  ],
  [
    "Who writes the items?",
    "An automated agent drafts every item; deterministic validation scripts check each draft against the schema and editorial hard rules before anything is published. A human reviews the pipeline and its rules, not each item.",
  ],
  [
    "What counts as a source?",
    "Every published item links the best available source on a three-tier ladder. confirmed items link a primary source: the actor itself (press release, filing, webcast) or an official record of the event (regulator, court, procurement register, orbital tracking data). reported items are based on credible trade press with named sourcing. signal items are based on posts by hand-picked individuals from the Signals list or named executives of the actor. Anonymous accounts and unattributed rumours are never a basis at any tier.",
  ],
  [
    "What do the confidence labels mean?",
    "The label states exactly how strong the sourcing is, and the copy never claims more. confirmed: the actor itself or an official record. reported: credible trade press, named in the item (per SpaceNews). signal: a curated voice on social media, named and flagged unconfirmed in the item. When a stronger source appears, the item is upgraded and keeps its address.",
  ],
  [
    "What happens when a story cannot be verified?",
    "It is held, not published. A held item costs nothing; a wrong item costs the site its credibility. Missing a story is acceptable, publishing a false one is not.",
  ],
  [
    "Are numbers ever estimated?",
    "No. Figures are copied exactly from the linked source or omitted. Registry fields without a current source stay null, and every filled registry field carries its source URL and an as-of date.",
  ],
  [
    "Can I cite MCC?",
    "Yes. Every stat block on the stats page has a stable anchor and a pre-formatted citation string with a retrieval date, and the same numbers are served machine-readable at /stats.json.",
  ],
];

export function AboutPage() {
  return (
    <Layout>
      <h1 className="page-title">about</h1>
      <p className="lede">
        MCC tracks the commercial space economy and the events that move it. Coverage of Chinese,
        Indian, Japanese, and European activity gets equal weight to US activity.
      </p>
      <section id="verification-policy" className="qa">
        <h2>Verification policy</h2>
        {QA.map(([q, a]) => (
          <div className="qa-pair" key={q}>
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}
      </section>
    </Layout>
  );
}

// --------------------------------------------------------------------- log

function formatSweepTimestamp(at: string): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

export function LogPage() {
  const totals = sweeps.reduce(
    (acc, s) => ({
      added: acc.added + s.added,
      updated: acc.updated + s.updated,
      held: acc.held + s.held,
    }),
    { added: 0, updated: 0, held: 0 },
  );
  return (
    <Layout>
      <h1 className="page-title">sweep log</h1>
      <p className="lede">
        Every sweep the machine ran, including the quiet ones. No items is a valid result; an
        unexplained gap is not.
      </p>
      <p className="dim mono">
        {sweeps.length} sweep{sweeps.length === 1 ? "" : "s"} · +{totals.added} added · ~
        {totals.updated} updated · {totals.held} held
      </p>
      {sweeps.length === 0 ? (
        <p className="empty">// no sweeps logged yet</p>
      ) : (
        sweeps.map((s) => (
          <section key={s.at} className="panel">
            <div className="card-meta">
              <span>{formatSweepTimestamp(s.at)}</span>
              <span className={`chip${s.added > 0 ? " chip-notable" : ""}`}>+{s.added}</span>
              <span className="chip">~{s.updated}</span>
              {s.held > 0 && <span className="chip">{s.held} held</span>}
            </div>
            <p>{s.summary}</p>
            <div className="tag-row">
              {s.coverage.map((c) => (
                <span key={c} className="chip">
                  #{c}
                </span>
              ))}
            </div>
          </section>
        ))
      )}
    </Layout>
  );
}

// -------------------------------------------------------------- not found

export function NotFoundPage() {
  return (
    <Layout>
      <h1 className="page-title">404 / not found</h1>
      <p>
        No page at this address. <a href="/">Back to the feed</a>
      </p>
    </Layout>
  );
}
