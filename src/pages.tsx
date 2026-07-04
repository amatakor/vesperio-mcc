import type { ReactNode } from "react";
import type { Item, SourcedField, ConstellationProfile, VehicleProfile } from "./data/schema";
import { CATEGORIES } from "./data/schema";
import { items, signals, constellations, vehicles } from "./lib/data";
import { computeStats } from "./lib/stats";

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
          <a href="/registry/">registry</a>
          <a href="/signals/">signals</a>
          <a href="/stats/">stats</a>
          <a href="/about/">about</a>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <p>
          Machine-maintained. Every item links its primary source. Missing a story is acceptable;
          publishing a false one is not. <a href="/about/">Verification policy</a>
        </p>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------- feed

function FeedRow({ item }: { item: Item }) {
  return (
    <article className="feed-row">
      <div className="feed-meta">
        <span className="date">{item.date}</span>
        <a className={`chip chip-${item.impact}`} href={`/news/${item.category}/`}>
          {item.category}
        </a>
        {item.confidence === "reported" && <span className="chip chip-reported">reported</span>}
      </div>
      <h2 className="feed-headline">
        <a href={`/item/${item.id}/`}>{item.headline}</a>
      </h2>
      <p className="tagline">{item.explainer.tagline}</p>
    </article>
  );
}

function FeedList({ list, emptyNote }: { list: Item[]; emptyNote: string }) {
  if (list.length === 0) return <p className="empty">{emptyNote}</p>;
  return <div className="feed">{list.map((i) => <FeedRow key={i.id} item={i} />)}</div>;
}

export function HomePage() {
  return (
    <Layout>
      <p className="lede">
        The new space economy, tracked by machine: Earth observation, connectivity, launch,
        commercial human spaceflight. Every item carries a plain-English explainer and a primary
        source.
      </p>
      <nav className="cat-row">
        {CATEGORIES.map((c) => (
          <a key={c} href={`/news/${c}/`}>
            {c}
          </a>
        ))}
      </nav>
      <FeedList list={items} emptyNote="No items yet. The first sweep has not run." />
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

export function ItemPage({ item }: { item: Item }) {
  return (
    <Layout>
      <article className="item-page">
        <div className="feed-meta">
          <span className="date">{item.date}</span>
          <a className={`chip chip-${item.impact}`} href={`/news/${item.category}/`}>
            {item.category}
          </a>
          <span className="chip">{item.impact}</span>
          <span className={`chip ${item.confidence === "reported" ? "chip-reported" : ""}`}>
            {item.confidence}
          </span>
        </div>
        <h1 className="page-title">{item.headline}</h1>
        <p className="tagline">{item.explainer.tagline}</p>
        <h2>What happened</h2>
        <p>{item.explainer.what_happened}</p>
        <h2>Why it matters</h2>
        <p>{item.explainer.why_it_matters}</p>
        {item.explainer.for_who && (
          <p className="for-who">Most relevant to: {item.explainer.for_who}</p>
        )}
        <dl className="kv">
          <dt>Companies</dt>
          <dd>{item.companies.join(", ") || "none listed"}</dd>
          <dt>Tags</dt>
          <dd>{item.tags.join(", ") || "none"}</dd>
          <dt>Primary source</dt>
          <dd>
            <a href={item.source_url} rel="noopener">
              {item.source_url}
            </a>
          </dd>
          {item.secondary_urls.length > 0 && (
            <>
              <dt>Secondary</dt>
              <dd>
                {item.secondary_urls.map((u) => (
                  <div key={u}>
                    <a href={u} rel="noopener">
                      {u}
                    </a>
                  </div>
                ))}
              </dd>
            </>
          )}
        </dl>
        <p>
          <a href="/">Back to the feed</a>
        </p>
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
  return (
    <Layout>
      <h1 className="page-title">
        {profile.name} <span className="dim">/ {profile.domain} constellation</span>
      </h1>
      <ProfileTable
        rows={[
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
        ]}
      />
      {profile.notes && <p className="dim">{profile.notes}</p>}
      <p>
        <a href="/registry/">Back to the registry</a>
      </p>
    </Layout>
  );
}

export function VehiclePage({ profile }: { profile: VehicleProfile }) {
  return (
    <Layout>
      <h1 className="page-title">
        {profile.name} <span className="dim">/ launch vehicle</span>
      </h1>
      <ProfileTable
        rows={[
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
        ]}
      />
      {profile.notes && <p className="dim">{profile.notes}</p>}
      <p>
        <a href="/registry/">Back to the registry</a>
      </p>
    </Layout>
  );
}

// ---------------------------------------------------------------- signals

export function SignalsPage() {
  return (
    <Layout>
      <h1 className="page-title">signals</h1>
      <p className="lede">
        People worth following in the new space economy. Hand-curated by a human; the machine never
        edits this list.
      </p>
      {signals.length === 0 ? (
        <p className="empty">The list is being curated. First entries land soon.</p>
      ) : (
        <ul className="index-list">
          {signals.map((p) => (
            <li key={p.name}>
              {p.url ? (
                <a href={p.url} rel="noopener">
                  {p.name}
                </a>
              ) : (
                p.name
              )}
              {p.handle ? <span className="dim"> ({p.handle})</span> : null}
              <div className="dim">{p.why}</div>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}

// ------------------------------------------------------------------ stats

export function StatsPage({ generatedAt }: { generatedAt: string }) {
  const blocks = computeStats(items, constellations, vehicles, new Date(generatedAt));
  return (
    <Layout>
      <h1 className="page-title">stats</h1>
      <p className="lede">
        Basic indices computed from MCC data at build time. Each block has a stable anchor and a
        pre-formatted citation. Machine-readable copy at{" "}
        <a href="/stats.json">/stats.json</a>.
      </p>
      {blocks.map((b) => (
        <section key={b.id} id={b.id} className="stat-block">
          <h2>
            <a href={`#${b.id}`}>#</a> {b.title}
          </h2>
          {b.rows.length === 0 ? (
            <p className="empty">No data yet; this index reads zero until the feed and registry fill.</p>
          ) : (
            <table className="stat-table">
              <tbody>
                {b.rows.map(([label, value]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="dim">{b.method}</p>
          <p className="citation">
            <code>{b.citation}</code>
          </p>
        </section>
      ))}
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
    "Every published item links a primary source: the actor itself (press release, filing, webcast) or an official record of the event (regulator, court, procurement register, orbital tracking data). Wire services and trade press are used for discovery only and are never the basis of an item.",
  ],
  [
    "What do the confidence labels mean?",
    "confirmed means the linked source is the actor itself or an official record. reported means the source is credible and primary-adjacent, but the actor has not confirmed; claims from state media outside facts of record are labelled per source, unverified.",
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
