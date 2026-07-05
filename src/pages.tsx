import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Item, SourcedField, ConstellationProfile, VehicleProfile, SignalPerson } from "./data/schema";
import { CATEGORIES, DOMAIN_TAGS } from "./data/schema";
import { items, signals, signalOutlets, constellations, vehicles, sweeps, itemsByTag } from "./lib/data";
import { computeHero, computeStats } from "./lib/stats";

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
          <a href="/tag/launch/">launch</a>
          <a href="/registry/">registry</a>
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

export function RegistryIndexPage() {
  const eo = constellations.filter((c) => c.domain === "eo");
  const conn = constellations.filter((c) => c.domain === "connectivity");
  const section = (title: string, list: Array<{ slug: string; name: string }>, base: string) => (
    <section>
      <h2>{title}</h2>
      {list.length === 0 ? (
        <p className="empty">No profiles yet.</p>
      ) : (
        <ul className="index-list">
          {list.map((e) => (
            <li key={e.slug}>
              <a href={`${base}${e.slug}/`}>{e.name}</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <Layout>
      <h1 className="page-title">registry</h1>
      <p className="lede">
        Standardised reference profiles. Every figure carries a source URL and an as-of date;
        unknown fields stay unknown rather than estimated.
      </p>
      {section("EO constellations", eo, "/registry/constellations/")}
      {section("Connectivity constellations", conn, "/registry/constellations/")}
      {section("Launch vehicles", vehicles, "/registry/vehicles/")}
    </Layout>
  );
}

export function ConstellationPage({ profile }: { profile: ConstellationProfile }) {
  const rows: Array<[string, SourcedField<unknown>]> = [
    ["operator", profile.operator],
    ["country", profile.country],
    ["sensor types", profile.sensor_types],
    ["sats on orbit", profile.sats_on_orbit],
    ["sats planned", profile.sats_planned],
    ["orbit", profile.orbit],
    ["first launch", profile.first_launch_date],
    ["latest launch", profile.latest_launch_date],
    ["status", profile.status],
    ["website", profile.website],
  ];
  return (
    <Layout>
      <h1 className="page-title">
        {profile.name} <span className="dim">/ {profile.domain} constellation</span>
      </h1>
      <ProfileTable rows={rows} />
      {profile.notes && <p className="dim">{profile.notes}</p>}
      <GuntersAttribution rows={rows} />
      <p>
        <a href="/registry/">Back to the registry</a>
      </p>
    </Layout>
  );
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
  return (
    <Layout>
      <h1 className="page-title">
        {profile.name} <span className="dim">/ launch vehicle</span>
      </h1>
      <ProfileTable rows={rows} />
      {profile.notes && <p className="dim">{profile.notes}</p>}
      <GuntersAttribution rows={rows} />
      <p>
        <a href="/registry/">Back to the registry</a>
      </p>
    </Layout>
  );
}

// ---------------------------------------------------------------- signals

const BUCKET_LABELS: Record<string, string> = {
  founder_exec: "founders & executives",
  agency_leader: "agency leaders",
  engineer_operator: "engineers & trackers",
  analyst: "analysts",
  journalist: "journalists",
  creator: "creators",
};

function SignalCard({ person }: { person: SignalPerson }) {
  const primary = person.channels.find((c) => c.status === "verified_active") ?? person.channels[0];
  return (
    <article className="card signal-card">
      <div className="card-meta">
        {person.whitelist === "yes" && <span className="chip chip-notable">whitelist</span>}
        {person.whitelist === "review" && <span className="chip chip-reported">under review</span>}
        {primary?.follower_scale_est && (
          <span className="date">{primary.follower_scale_est.split(" ")[0]}</span>
        )}
      </div>
      <h3 className="card-headline">
        {primary ? (
          <a href={primary.url} rel="noopener">
            {person.name}
          </a>
        ) : (
          person.name
        )}
      </h3>
      <p className="signal-role">
        {person.role} · {person.org}
      </p>
      <p className="card-tagline">{person.why}</p>
      <div className="card-foot signal-foot">
        {person.channels.map((c) => (
          <a
            key={c.url}
            className={`chip ${c.status === "verified_active" ? "" : "chip-reported"}`}
            href={c.url}
            rel="noopener"
          >
            {c.type}
            {c.handle ? ` @${c.handle}` : ""}
          </a>
        ))}
      </div>
    </article>
  );
}

export function SignalsPage() {
  const whitelisted = signals.filter((p) => p.whitelist === "yes").length;
  return (
    <Layout>
      <h1 className="page-title">signals</h1>
      <p className="lede">
        People worth following in the new space economy, curated by role. Hand-picked by a human;
        the machine never edits this list. The {whitelisted} on the sourcing whitelist are the only
        voices whose posts can become signal-tier items.
      </p>
      <p className="dim mono">
        {signals.length} people worth following · {whitelisted} on the sourcing whitelist
      </p>
      {signals.length === 0 ? (
        <p className="empty">The list is being curated. First entries land soon.</p>
      ) : (
        Object.entries(BUCKET_LABELS).map(([bucket, label]) => {
          const group = signals.filter((p) => p.bucket === bucket);
          if (group.length === 0) return null;
          return (
            <section key={bucket} className="signal-section">
              <h2 className="signal-heading">
                {label} <span className="badge-acc">{group.length}</span>
              </h2>
              <div className="cards">
                {group.map((p) => (
                  <SignalCard key={p.id} person={p} />
                ))}
              </div>
            </section>
          );
        })
      )}
      {signalOutlets.length > 0 && (
        <section className="signal-section">
          <h2 className="signal-heading">outlets we read</h2>
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
  const hero = computeHero(items, constellations, vehicles, sweeps, now);
  const blocks = computeStats(items, constellations, vehicles, now);
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
