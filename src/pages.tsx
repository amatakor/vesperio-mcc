import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Item,
  SnrTrace,
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
  ledgerSources,
  itemsByTag,
  itemsMentioning,
  constellationChildren,
} from "./lib/data";
import { computeHero, computeStats } from "./lib/stats";
import aliases from "./data/aliases.json";
import registryLogos from "./data/registry-logos.json";
import { OrbitsStage } from "./orbits/stage";

// -------------------------------------------------------- registry logos

const LOGO_BY_SLUG: Record<string, { file: string; origin: string }> = (
  registryLogos as { logos: Record<string, { file: string; origin: string }> }
).logos;

/** Entity mark: the favicon fetched from the entity's own recorded
 * website (scripts/fetch-logos.ts), or a generated initials tile when
 * none is fetchable. Decorative; the name is always alongside. */
function RegistryLogo({ slug, name, size }: { slug: string; name: string; size?: "lg" }) {
  const logo = LOGO_BY_SLUG[slug];
  const cls = `reg-logo${size === "lg" ? " reg-logo-lg" : ""}`;
  if (logo) return <img className={cls} src={logo.file} alt="" loading="lazy" />;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span className={`${cls} reg-logo-tile`} aria-hidden="true">
      {initials}
    </span>
  );
}

// ------------------------------------------------------------------ layout

const NAV_LINKS: Array<[string, string]> = [
  ["/", "news"],
  ["/registry/", "registry"],
  ["/orbits/", "orbits"],
  ["/signals/", "signals"],
  ["/stats/", "stats"],
  ["/log/", "log"],
  ["/about/", "about"],
];

/** Shared site header. `current` marks the active section (aria-current
 * drives the accent underline); the orbits app frame reuses it so the
 * masthead holds still across every page. */
export function Masthead({ current }: { current?: string }) {
  return (
    <header className="masthead">
      <a href="/" className="brand">
        MCC / MISSION CONTROL CENTER
      </a>
      <nav className="nav">
        {NAV_LINKS.map(([href, label]) => (
          <a key={href} href={href} aria-current={label === current ? "page" : undefined}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}

export function Layout({ children, current }: { children: ReactNode; current?: string }) {
  return (
    <div className="shell">
      <Masthead current={current} />
      <main>{children}</main>
      <footer className="footer">
        <p>
          Machine-maintained. Every item links its sources and wears its signal-to-noise score. Missing a
          story is acceptable; publishing a false one as fact is not.{" "}
          <a href="/about/">Verification policy</a>
        </p>
        <p className="footer-feeds">
          category feeds: <a href="/tag/eo/">eo</a> · <a href="/tag/connectivity/">connectivity</a> ·{" "}
          <a href="/tag/iot/">iot</a> · <a href="/tag/launch/">launch</a>
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

const SNR_LABELS: Record<number, string> = {
  1: "single source, low confidence",
  2: "weakly corroborated",
  3: "a few reputable sources",
  4: "widely reported",
  5: "direct source",
};

const SOURCE_CLASS_LABELS: Record<string, string> = {
  first_party: "first party",
  official_record: "official record",
  computed: "observational data",
  wire_pr: "press wire",
  trade: "trade press",
  mainstream: "mainstream press",
  whitelist: "signals list",
  aggregator: "aggregator",
  informal: "informal",
};

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** The stored calculation, one row per step; shared by popover and panel. */
function SnrTraceRows({ trace }: { trace: SnrTrace }) {
  return (
    <>
      <span className="snr-pop-row">
        <span className="snr-pop-delta">{trace.base.tier}</span>
        <span>
          {trace.base.reason}{" "}
          <a href={trace.base.source} rel="noopener">
            {hostOf(trace.base.source)}
          </a>
        </span>
      </span>
      {trace.modifiers.map((m, i) => (
        <span key={i} className="snr-pop-row">
          <span className="snr-pop-delta">{signed(m.delta)}</span>
          <span>
            {m.reason}
            {m.source && (
              <>
                {" "}
                <a href={m.source} rel="noopener">
                  {hostOf(m.source)}
                </a>
              </>
            )}
          </span>
        </span>
      ))}
      {(trace.history ?? []).length > 0 && (
        <span className="snr-pop-hist">
          {(trace.history ?? []).map((h, i) => (
            <span key={i} className="snr-pop-row">
              <span className="snr-pop-delta">
                {h.from}→{h.to}
              </span>
              <span>
                {h.date} · {h.reason}
              </span>
            </span>
          ))}
        </span>
      )}
      <span className="snr-pop-foot">scorer v{trace.scorer_version}</span>
    </>
  );
}

/**
 * The SNR icon (SNR_SPEC.md §4): 5 flat squares, N lit, warn-colored
 * at 1-2 so low confidence is unmissable. With a trace, clicking opens
 * the stored calculation; the popover renders snr_trace exactly as
 * stored at scoring time, never a reconstruction.
 */
function SnrBars({ snr, trace, compact }: { snr: number; trace?: SnrTrace; compact?: boolean }) {
  const [open, setOpen] = useState(false); // pinned by click
  const [hover, setHover] = useState(false); // transient, hover-to-peek
  const label = `SNR ${snr}/5: ${SNR_LABELS[snr] ?? ""}`;
  const bars = (
    <span className={`snr-bars snr-c${snr}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`snr-bar${n <= snr ? " on" : ""}`} />
      ))}
    </span>
  );
  if (!trace) {
    return (
      <span className={`snr${compact ? " snr-compact" : ""}`} title={label}>
        {bars}
      </span>
    );
  }
  return (
    <span
      className={`snr${compact ? " snr-compact" : ""}`}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="snr-btn"
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
      >
        {bars}
        {!compact && <span className="snr-num">{snr}</span>}
      </button>
      {(open || hover) && (
        <span className="snr-pop" role="dialog" aria-label="SNR calculation">
          <span className="snr-pop-head">
            <span>
              snr {snr}/5 · {SNR_LABELS[snr]}
            </span>
            <button type="button" className="snr-pop-close" onClick={() => setOpen(false)}>
              ×
            </button>
          </span>
          <SnrTraceRows trace={trace} />
        </span>
      )}
    </span>
  );
}

/** Image when the pipeline found one; otherwise a generated text tile.
    The SNR squares sit bottom-left over the media, passive on cards;
    the stored calculation opens in the item modal and item page. */
function CardMedia({ item }: { item: Item }) {
  if (item.image) {
    return (
      <div className={`card-media${item.image.fit === "contain" ? " card-media-contain" : ""}`}>
        <img src={item.image.src} alt="" loading="lazy" />
      </div>
    );
  }
  return (
    <div className="card-media card-tile">
      <span className="tile-cat">{CAT_ABBR[item.category] ?? item.category.toUpperCase()}</span>
      <span className="tile-co">{item.companies[0] ?? item.category}</span>
    </div>
  );
}

/** Assigns every card a column span (3-6) so each grid row fills all
    12 columns exactly: widths follow a 4/3/5 rotation for variety and
    bend when needed so a row's leftover is never an unfillable sliver.
    A seismic card reserves 4 columns on its own row and the next
    (it spans two rows in CSS). */
const CARD_W_CYCLE = [4, 3, 5, 4, 5, 3];

function computeCardWidths(list: Item[]): number[] {
  const widths: number[] = [];
  let cyc = 0;
  // Free columns in the row currently being filled. Seismic cards are
  // pinned to columns 9-12 in CSS, so the space beside them is always
  // the contiguous left part of the row; shadow counts how many
  // upcoming rows are narrowed to 8 columns by a seismic block.
  let rem = 12;
  let shadow = 0;
  const rowDone = () => {
    if (shadow > 0) {
      rem = 8;
      shadow--;
    } else {
      rem = 12;
    }
  };
  for (const item of list) {
    if (item.impact === "seismic") {
      widths.push(4);
      if (rem >= 4) {
        // Takes the right end of this row plus the next row's right end.
        rem -= 4;
        shadow = 1;
      } else {
        // Row's rightmost columns are gone; the block starts on the
        // next two rows, and the small gap here is filled below.
        shadow = 2;
      }
      if (rem === 0) rowDone();
      continue;
    }
    const pref = CARD_W_CYCLE[cyc++ % 6]!;
    let w = Math.min(rem, 4);
    for (const c of [pref, pref + 1, pref - 1, rem]) {
      if (c >= 3 && c <= 6 && c <= rem && (rem - c === 0 || rem - c >= 3)) {
        w = c;
        break;
      }
    }
    widths.push(w);
    rem -= w;
    if (rem === 0) rowDone();
  }
  return widths;
}

/** A feed card. The whole card opens the item modal; the headline and
    details keep real /item/ hrefs for crawlers and middle-click.
    width comes from the row packer; pos rotates thumbnail heights. */
function Card({
  item,
  pos,
  width,
  onOpen,
}: {
  item: Item;
  pos: number;
  width: number;
  onOpen: (item: Item) => void;
}) {
  const sources = item.sources?.length ?? 1 + item.secondary_urls.length;
  const open = (e: ReactMouseEvent) => {
    e.preventDefault();
    onOpen(item);
  };
  return (
    <article
      className={`card card-${item.impact} card-w${width} media-v${pos % 3}`}
      data-item-id={item.id}
      onClick={open}
    >
      <CardMedia item={item} />
      <div className="card-meta">
        <a className="chip" href={`/news/${item.category}/`} onClick={(e) => e.stopPropagation()}>
          {item.category}
        </a>
        <span className={`chip chip-${item.impact}`}>{item.impact}</span>
        {item.disputed && <span className="chip chip-disputed">disputed</span>}
        <span className="card-snr">
          <SnrBars snr={item.snr} />
        </span>
        <span className="date">{item.date}</span>
      </div>
      <h2 className="card-headline">
        <a href={`/item/${item.id}/`}>{item.headline}</a>
      </h2>
      <p className="card-tagline">{item.explainer.tagline}</p>
      {item.impact === "seismic" && (
        <p className="card-extra">{item.explainer.what_happened}</p>
      )}
      <div className="card-foot">
        <span className="card-companies" title={item.companies.join(" · ")}>
          {item.companies.join(" · ")}
        </span>
        <span className="card-sources">
          {sources} source{sources === 1 ? "" : "s"}
        </span>
        <a className="card-details" href={`/item/${item.id}/`}>
          details →
        </a>
      </div>
    </article>
  );
}

/** Card grid plus the item modal. Opening an item pushes /item/{id}/
    onto history so the URL is shareable; back (or close) returns to
    the feed. Direct visits to /item/ URLs get the prerendered page. */
function FeedList({ list, emptyNote }: { list: Item[]; emptyNote: string }) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    function onPop(e: PopStateEvent) {
      const s = e.state as { mccItem?: string } | null;
      setOpenId(s?.mccItem ?? null);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = (item: Item) => {
    setOpenId(item.id);
    history.pushState({ mccItem: item.id }, "", `/item/${item.id}/`);
  };
  const close = () => {
    const s = history.state as { mccItem?: string } | null;
    if (s?.mccItem) history.back();
    else setOpenId(null);
  };

  // Fall back to the full corpus so the modal survives filter changes.
  const openItem = openId
    ? (list.find((i) => i.id === openId) ?? items.find((i) => i.id === openId) ?? null)
    : null;

  const cardWidths = useMemo(() => computeCardWidths(list), [list]);

  if (list.length === 0) return <p className="empty">{emptyNote}</p>;
  return (
    <>
      <div className="cards">
        {list.map((i, n) => (
          <Card key={i.id} item={i} pos={n} width={cardWidths[n]!} onOpen={open} />
        ))}
      </div>
      {openItem && <ItemModal item={openItem} onClose={close} />}
    </>
  );
}

/** Attached sources, with a fallback for items predating the sources block. */
function srcEntriesOf(item: Item) {
  return item.sources && item.sources.length > 0
    ? item.sources
    : [item.source_url, ...item.secondary_urls].map((u) => ({
        url: u,
        outlet: hostOf(u),
        class: "informal" as const,
        added: item.date,
        via: "initial" as const,
      }));
}

function SourceList({ item }: { item: Item }) {
  return (
    <ol className="src-list">
      {srcEntriesOf(item).map((src, i) => (
        <li key={src.url}>
          <a href={src.url} rel="noopener">
            <span className="src-num">[{i + 1}]</span>
            <span>
              <span className="src-kind">
                {SOURCE_CLASS_LABELS[src.class] ?? src.class}
                {src.via !== "initial" ? ` · ${src.via}` : ""}
              </span>
              <span className="src-host">{hostOf(src.url)}</span>
            </span>
            <span className="src-arrow">↗</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/** In-feed item overlay: band with impact and SNR, media and sources
    left, explainer right. Esc, the close button, and the backdrop all
    close it; the full prerendered page stays one click away. */
function ItemModal({ item, onClose }: { item: Item; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <article
        className="item-modal"
        role="dialog"
        aria-modal="true"
        aria-label={item.headline}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`modal-band modal-band-${item.impact}`}>
          <SnrBars snr={item.snr} trace={item.snr_trace} />
          <span className="band-impact">{item.impact}</span>
          <a className="chip" href={`/news/${item.category}/`}>
            {item.category}
          </a>
          {item.disputed && <span className="chip chip-disputed">disputed</span>}
          <span className="date">{item.date}</span>
          <button type="button" className="modal-close" onClick={onClose}>
            × esc
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-left">
            {item.image ? (
              <>
                <div className={`modal-media${item.image.fit === "contain" ? " media-contain" : ""}`}>
                  <img src={item.image.src} alt={item.headline} />
                </div>
                <p className="modal-credit">
                  <a href={item.image.origin_url} rel="noopener">
                    {item.image.credit}
                  </a>
                </p>
              </>
            ) : (
              <div className="modal-media card-tile modal-tile">
                <span className="tile-cat">
                  {CAT_ABBR[item.category] ?? item.category.toUpperCase()}
                </span>
                <span className="tile-co">{item.companies[0] ?? item.category}</span>
              </div>
            )}
            <div className="src-band">
              // sources · {srcEntriesOf(item).length} attached
            </div>
            <SourceList item={item} />
          </div>
          <div className="modal-right">
            <h2 className="modal-title">{item.headline}</h2>
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
            <section className="panel">
              <h2>signal-to-noise</h2>
              <div className="snr-panel">
                <SnrBars snr={item.snr} />
                <span className="snr-panel-label">
                  {item.snr}/5 · {SNR_LABELS[item.snr]}
                </span>
              </div>
              <div className="snr-trace-inline">
                <SnrTraceRows trace={item.snr_trace} />
              </div>
            </section>
            <div className="tag-row">
              {item.tags.map((t) => (
                <a key={t} className="chip chip-tag" href={`/tag/${t}/`}>
                  #{t}
                </a>
              ))}
            </div>
            <p>
              <a href={`/item/${item.id}/`}>full page →</a>
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}

function matchesQuery(item: Item, q: string): boolean {
  const haystack = [item.headline, item.explainer.tagline, ...item.companies, ...item.tags]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** Active feed filter: one category or one domain tag at a time. */
type FeedFilter = { kind: "cat" | "tag"; value: string } | null;

export function HomePage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FeedFilter>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        return;
      }
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
  const shown = useMemo(() => {
    let list = items;
    if (filter?.kind === "cat") list = list.filter((i) => i.category === filter.value);
    if (filter?.kind === "tag") list = list.filter((i) => i.tags.includes(filter.value));
    return q === "" ? list : list.filter((i) => matchesQuery(i, q));
  }, [q, filter]);

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

  const pick = (next: FeedFilter) => {
    setFilter(next);
    setMenuOpen(false);
  };
  const chip = (kind: "cat" | "tag", value: string, count: number) => {
    const active = filter?.kind === kind && filter.value === value;
    return (
      <button
        key={value}
        type="button"
        className={`cat-chip${active ? " active" : ""}`}
        onClick={() => pick(active ? null : { kind, value })}
      >
        {value} <span className="count">{count}</span>
      </button>
    );
  };

  return (
    <Layout current="news">
      <div className="filter-bar">
        <button
          type="button"
          className={`cat-btn${menuOpen ? " open" : ""}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          categories <span className="cat-btn-sel">{filter ? filter.value : "all"}</span>{" "}
          <span className="cat-btn-arrow">{menuOpen ? "▴" : "▾"}</span>
        </button>
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
        {menuOpen && (
          <div className="cat-panel">
            <p className="cat-panel-label">category</p>
            <div className="cat-panel-group">
              <button
                type="button"
                className={`cat-chip${filter === null ? " active" : ""}`}
                onClick={() => pick(null)}
              >
                all <span className="count">{items.length}</span>
              </button>
              {CATEGORIES.filter((c) => (catCounts.get(c) ?? 0) > 0).map((c) =>
                chip("cat", c, catCounts.get(c) ?? 0),
              )}
            </div>
            <p className="cat-panel-label">domain</p>
            <div className="cat-panel-group">
              {DOMAIN_TAGS.map((t) => chip("tag", t, domainCounts.get(t) ?? 0))}
            </div>
          </div>
        )}
      </div>
      {(q !== "" || filter) && shown.length === 0 ? (
        <p className="empty">// no items match: adjust filters</p>
      ) : (
        <FeedList list={shown} emptyNote="No items yet. The first sweep has not run." />
      )}
    </Layout>
  );
}

export function CategoryPage({ category }: { category: string }) {
  return (
    <Layout current="news">
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
    <Layout current="news">
      <h1 className="page-title">#{tag}</h1>
      <FeedList list={itemsByTag(tag)} emptyNote={`No ${tag} items tracked yet.`} />
      <p>
        <a href="/">All news</a>
      </p>
    </Layout>
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
  return (
    <Layout current="news">
      <article className="item-page item-wide">
        <div className="item-band">
          <span className="band-impact">{item.impact}</span>
          <a className="chip" href={`/news/${item.category}/`}>
            {item.category}
          </a>
          {item.disputed && <span className="chip chip-disputed">disputed</span>}
          <span className="band-snr">
            <span className="band-snr-label">snr</span>
            <SnrBars snr={item.snr} trace={item.snr_trace} />
          </span>
          <span className="date">{item.date}</span>
        </div>
        <div className="item-cols">
          <div className="item-side">
            {item.image && (
              <figure className="item-figure">
                <div className={`item-figure-media${item.image.fit === "contain" ? " media-contain" : ""}`}>
                  <img src={item.image.src} alt={item.headline} />
                </div>
                <figcaption className="dim">
                  <a href={item.image.origin_url} rel="noopener">
                    {item.image.credit}
                  </a>
                </figcaption>
              </figure>
            )}
            <div className="src-band">
              // sources · {srcEntriesOf(item).length} attached
            </div>
            <SourceList item={item} />
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
            <section className="panel">
              <h2>signal-to-noise</h2>
              <div className="snr-panel">
                <SnrBars snr={item.snr} />
                <span className="snr-panel-label">
                  {item.snr}/5 · {SNR_LABELS[item.snr]}
                </span>
                {item.disputed && <span className="chip chip-disputed">disputed</span>}
              </div>
              <div className="snr-trace-inline">
                <SnrTraceRows trace={item.snr_trace} />
              </div>
            </section>
            <section className="panel">
              <h2>quick facts</h2>
              <dl className="kv">
                <dt>Companies</dt>
                <dd>{item.companies.join(", ") || "none listed"}</dd>
                <dt>Category</dt>
                <dd>{item.category}</dd>
                <dt>Impact</dt>
                <dd>{item.impact}</dd>
                <dt>SNR</dt>
                <dd>{item.snr} / 5</dd>
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

/** Registry profile hrefs by entity name, for linking provider/operator values. */
const ORG_HREF_BY_NAME = new Map(
  organizations.map((o) => [o.name.toLowerCase(), `/registry/organizations/${o.slug}/`]),
);

/**
 * Curated alias map (src/data/aliases.json): unifies display names and
 * browser grouping for companies that sources phrase differently. The
 * sourced value inside each profile keeps the cited page's wording.
 */
const CANONICAL_BY_ALIAS = new Map<string, { name: string; org?: string }>();
for (const e of aliases.entities) {
  CANONICAL_BY_ALIAS.set(e.name.toLowerCase(), e);
  for (const a of e.aliases) CANONICAL_BY_ALIAS.set(a.toLowerCase(), e);
}

function canonicalName(v: string): string {
  return CANONICAL_BY_ALIAS.get(v.toLowerCase())?.name ?? v;
}

function entityHrefFor(v: string): string | undefined {
  const canon = CANONICAL_BY_ALIAS.get(v.toLowerCase());
  if (canon?.org) return `/registry/organizations/${canon.org}/`;
  return (
    ORG_HREF_BY_NAME.get((canon?.name ?? v).toLowerCase()) ?? ORG_HREF_BY_NAME.get(v.toLowerCase())
  );
}

/** Facts-table rows whose string value names another registry entity. */
const ENTITY_ROW_LABELS = new Set(["provider", "operator"]);

/**
 * Fleet-level display sum of a count field across sub-constellations.
 * Rendered as a computed figure, never stored: the sourced per-child
 * values remain the citable atoms. Null unless every child carries the
 * value; a partial sum shown as a fleet total would be wrong.
 */
function fleetSum(
  children: ConstellationProfile[],
  field: "sats_launched_total" | "sats_active_claimed" | "sats_active_verified",
): SourcedField<number> | null {
  if (children.length === 0) return null;
  let sum = 0;
  let asOf: string | null = null;
  for (const c of children) {
    const f = c[field];
    if (f.value === null || f.value === undefined) return null;
    sum += f.value;
    if (f.as_of && (!asOf || f.as_of > asOf)) asOf = f.as_of;
  }
  return { value: sum, source: null, as_of: asOf };
}

function fieldRow(
  label: string,
  f: SourcedField<unknown>,
  computed?: boolean,
  showAsOf = true,
): ReactNode {
  const value =
    f.value === null || f.value === undefined
      ? "unknown"
      : typeof f.value === "boolean"
        ? f.value
          ? "yes"
          : "no"
        : Array.isArray(f.value)
          ? f.value.join(", ")
          : String(f.value);
  const entityHref =
    ENTITY_ROW_LABELS.has(label) && typeof f.value === "string"
      ? entityHrefFor(f.value)
      : undefined;
  return (
    <tr key={label}>
      <th scope="row">{label}</th>
      <td className={f.value === null ? "empty" : ""}>
        {entityHref ? <a href={entityHref}>{value}</a> : value}
        {f.disputed && (
          <span className="disputed-stack">
            <span className="chip chip-disputed">disputed</span>
            {f.disputed.competing.map((c, i) => (
              <span key={i} className="disputed-claim">
                {Array.isArray(c.value) ? c.value.join(", ") : String(c.value)}{" "}
                <SnrBars snr={c.snr} compact />{" "}
                <a href={c.source} rel="noopener">
                  source
                </a>{" "}
                <span className="dim">{c.as_of}</span>
              </span>
            ))}
          </span>
        )}
      </td>
      {showAsOf && <td>{f.as_of ?? ""}</td>}
      <td className="src-cell">
        {f.source ? (
          <a href={f.source} rel="noopener">
            source
          </a>
        ) : computed ? (
          <span className="dim">computed</span>
        ) : (
          ""
        )}
        {f.snr !== undefined && <SnrBars snr={f.snr} trace={f.snr_trace} compact />}
        {f.tier === "provisional" && <span className="tag-provisional">prov</span>}
      </td>
    </tr>
  );
}

type ProfileRow = [string, SourcedField<unknown>] | [string, SourcedField<unknown>, "computed"];

function ProfileTable({ rows }: { rows: ProfileRow[] }) {
  // When every dated field shares one as-of date, the column is noise:
  // collapse it into a single line under the table (2026-07-07 audit).
  const dates = new Set(rows.map(([, f]) => f.as_of).filter((d): d is string => !!d));
  const showAsOf = dates.size > 1;
  const soleDate = dates.size === 1 ? [...dates][0] : null;
  return (
    <>
      <table className="profile">
        <thead>
          <tr>
            <th>field</th>
            <th>value</th>
            {showAsOf && <th>as of</th>}
            <th>source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f, computed]) => fieldRow(label, f, computed === "computed", showAsOf))}
        </tbody>
      </table>
      {soleDate && <p className="dim table-asof">all fields as of {soleDate}</p>}
    </>
  );
}

/**
 * Gunter's Space Page permits summarization/RAG only with clear
 * attribution and a direct link to the original URL; render both
 * whenever any field on the profile cites it.
 */
function GuntersAttribution({ rows }: { rows: ProfileRow[] }) {
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
    group: c.operator.value ? canonicalName(c.operator.value) : "Operator unconfirmed",
    parent: c.parent ?? null,
    affiliation: c.operator.value ? canonicalName(c.operator.value) : "Operator unconfirmed",
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

/** Registry selection accents follow the Orbits domain palette. */
const DOMAIN_ACCENT: Record<string, string> = {
  eo: "var(--neon-eo)",
  connectivity: "var(--neon-connectivity)",
  iot: "var(--neon-iot)",
};

function matchesRegQuery(e: RegEntry, q: string): boolean {
  return [e.name, e.affiliation, e.slug].join(" ").toLowerCase().includes(q);
}

/** Preview card shared by every section's third (or fourth) pane. */
function RegPreviewCard({ entry, extraChips }: { entry: RegEntry; extraChips?: ReactNode }) {
  return (
    <>
      <div className="reg-pane-head">
        <RegistryLogo slug={entry.slug} name={entry.name} />
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
  groupProfileHref,
  accent,
}: {
  entries: RegEntry[];
  groupLabel: string;
  groupDisplay?: (name: string) => string;
  entityAside: (e: RegEntry) => ReactNode;
  /** Profile URL for a group (e.g. a provider's organization page); renders the company profile button. */
  groupProfileHref?: (group: string) => string | null;
  accent?: string;
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
  const profileHref = group ? (groupProfileHref?.(group[0]) ?? null) : null;

  return (
    <div
      className="reg-browser"
      style={accent ? ({ "--reg-acc": accent } as CSSProperties) : undefined}
    >
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
        {profileHref && (
          <a className="reg-profile-link" href={profileHref}>
            company profile &rarr;
          </a>
        )}
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

/** Operator pane node: a fleet parent (Planet, Sentinel) or a plain operator name. */
interface OpNode {
  key: string;
  label: string;
  /** Company/fleet profile URL for the fleet pane's header button. */
  profileHref: string | null;
  entries: RegEntry[];
}

/**
 * Constellation section browser: domain -> operator -> fleet. A fleet parent
 * (e.g. Planet, Sentinel) is itself the operator-level row: its children list
 * directly in the fleet pane and the parent profile becomes the company
 * profile button at the top of that pane, so no redundant middle column.
 */
function ConstellationBrowser({ entries }: { entries: RegEntry[] }) {
  const [selDomain, setSelDomain] = useState<string | null>(null);
  const [selOp, setSelOp] = useState<string | null>(null);
  const [selSlug, setSelSlug] = useState<string | null>(null);

  const byDomain = new Map<string, RegEntry[]>();
  for (const e of entries) byDomain.set(e.kind, [...(byDomain.get(e.kind) ?? []), e]);
  const domains = (["eo", "connectivity", "iot"] as const)
    .filter((d) => (byDomain.get(d) ?? []).length > 0)
    .map((d) => [d, byDomain.get(d) ?? []] as [string, RegEntry[]]);

  const domain = domains.find(([d]) => d === selDomain) ?? domains[0];
  const domainEntries = domain ? domain[1] : [];

  const inDomain = new Map(domainEntries.map((e) => [e.slug, e]));
  const nodes = new Map<string, OpNode>();
  const nodeFor = (key: string, label: string, profileHref: string | null): OpNode => {
    let n = nodes.get(key);
    if (!n) {
      n = { key, label, profileHref, entries: [] };
      nodes.set(key, n);
    }
    return n;
  };
  // Fleet parents read as operators in their pane, so the suffix is noise there.
  const opLabel = (name: string) => name.replace(/\s*\(fleet\)$/i, "");
  for (const e of domainEntries) {
    if (entries.some((c) => c.parent === e.slug)) {
      // Fleet parent: owns an operator row; children fill its fleet pane.
      const n = nodeFor(e.slug, opLabel(e.name), e.href);
      n.label = opLabel(e.name);
      n.profileHref = e.href;
    } else if (e.parent && inDomain.has(e.parent)) {
      const p = inDomain.get(e.parent)!;
      nodeFor(e.parent, opLabel(p.name), p.href).entries.push(e);
    } else {
      // Standalone constellation (or orphaned child under search filters).
      nodeFor(`op:${e.group}`, e.group, entityHrefFor(e.group) ?? null).entries.push(e);
    }
  }
  // A parent whose children are all filtered out still previews itself.
  for (const n of nodes.values()) {
    if (n.entries.length === 0 && inDomain.has(n.key)) n.entries.push(inDomain.get(n.key)!);
  }
  const operators = [...nodes.values()].sort((a, b) => {
    const aUnk = a.label === "Operator unconfirmed" ? 1 : 0;
    const bUnk = b.label === "Operator unconfirmed" ? 1 : 0;
    return aUnk - bUnk || b.entries.length - a.entries.length || a.label.localeCompare(b.label);
  });

  const op = operators.find((n) => n.key === selOp) ?? operators[0];
  const fleet = (op ? op.entries : []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const sel = fleet.find((e) => e.slug === selSlug) ?? fleet[0];

  const accent = domain ? DOMAIN_ACCENT[domain[0]] : undefined;

  return (
    <div
      className="reg-browser reg-browser-4"
      style={accent ? ({ "--reg-acc": accent } as CSSProperties) : undefined}
    >
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
            }}
          />
        ))}
      </div>
      <div className="reg-pane reg-ops">
        <div className="reg-pane-head">
          operator <span className="dim">{operators.length}</span>
        </div>
        {operators.map((n) => (
          <RegRow
            key={n.key}
            label={n.label}
            aside={n.entries.length}
            selected={!!op && n.key === op.key}
            onClick={() => {
              setSelOp(n.key);
              setSelSlug(null);
            }}
          />
        ))}
      </div>
      <div className="reg-pane reg-ents">
        <div className="reg-pane-head">
          {op ? op.label : ""} <span className="dim">{fleet.length}</span>
        </div>
        {op?.profileHref && (
          <a className="reg-profile-link" href={op.profileHref}>
            company profile &rarr;
          </a>
        )}
        {fleet.map((e) => (
          <RegRow
            key={e.slug}
            label={e.name}
            aside={KIND_LABEL[e.kind]}
            selected={!!sel && e.slug === sel.slug}
            onClick={() => setSelSlug(e.slug)}
          />
        ))}
      </div>
      <div className="reg-pane reg-preview">{sel && <RegPreviewCard entry={sel} />}</div>
    </div>
  );
}

interface RegSection {
  id: string;
  heading: string;
  tagline: string;
  entries: RegEntry[];
  /** Noun for the pane grouping (providers, operators, regions...); the
   * heading badge then reads "N entities · M noun" so it reconciles
   * with the pane header counts (2026-07-07 audit). */
  groupNoun: string;
  /** Noun for the entries themselves ("vehicles", "constellations"). */
  entryNoun: string;
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
      groupNoun: "providers",
      entryNoun: "vehicles",
    },
    {
      id: "constellations",
      heading: "constellations",
      tagline: "What is up, who owns it.",
      entries: constellationEntriesVisible,
      groupNoun: "operators",
      entryNoun: "constellations",
    },
    {
      id: "spaceports",
      heading: "spaceports",
      tagline: "Where it leaves the ground.",
      entries: spaceportEntriesVisible,
      groupNoun: "regions",
      entryNoun: "sites",
    },
    {
      id: "ecosystem",
      heading: "ecosystem",
      tagline: "Everyone else who moves the market.",
      entries: orgEntriesVisible,
      groupNoun: "kinds",
      entryNoun: "organizations",
    },
  ];

  const visibleCount = sections.reduce((n, s) => n + s.entries.length, 0);

  return (
    <Layout current="registry">
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
                  {s.heading} <span className="badge-acc">{s.entries.length}</span>{" "}
                  <span className="dim reg-groupline">
                    {s.entryNoun} · {new Set(s.entries.map((e) => e.group)).size} {s.groupNoun}
                  </span>
                </span>
                <span className="sig-tagline">{s.tagline}</span>
              </h2>
              {s.id === "launch" && (
                <PaneBrowser
                  entries={s.entries}
                  groupLabel="provider"
                  entityAside={() => "vehicle"}
                  groupProfileHref={(p) => entityHrefFor(p) ?? null}
                />
              )}
              {s.id === "constellations" && <ConstellationBrowser entries={s.entries} />}
              {s.id === "spaceports" && (
                <PaneBrowser
                  entries={s.entries}
                  groupLabel="region"
                  groupDisplay={(r) => REGION_LABEL[r] ?? r}
                  entityAside={() => "site"}
                  accent="var(--neon-reserve)"
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
  rows: ProfileRow[];
  overview: SourcedField<string>;
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
  /** Stock ticker for listed entities; renders the stock section. */
  stockTicker?: SourcedField<string> | null;
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

/** Six-month close-price chart for listed entities; data via the Stooq pipeline. */
function StockSection({ slug, ticker }: { slug: string; ticker: SourcedField<string> }) {
  const [series, setSeries] = useState<Array<[string, number]> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch(`/data/stocks/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setSeries(d.closes))
      .catch(() => setFailed(true));
  }, [slug]);
  if (!ticker.value) return null;
  const W = 640;
  const H = 160;
  const PAD = 6;
  let chart: ReactNode = null;
  if (series && series.length > 1) {
    const vals = series.map(([, c]) => c);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const pts = series
      .map(([, c], i) => {
        const x = PAD + (i / (series.length - 1)) * (W - 2 * PAD);
        const y = H - PAD - ((c - min) / span) * (H - 2 * PAD);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const first = vals[0]!;
    const last = vals[vals.length - 1]!;
    const up = last >= first;
    chart = (
      <>
        <svg viewBox={`0 0 ${W} ${H}`} className="stock-chart" role="img" aria-label="6 month close prices">
          <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <p className="dim mono stock-meta">
          {series[0]![0]} to {series[series.length - 1]![0]} | last close {last.toFixed(2)} |{" "}
          {up ? "+" : ""}{(((last - first) / first) * 100).toFixed(1)}% over period | market data: Yahoo Finance,
          end of day
        </p>
      </>
    );
  } else if (failed) {
    chart = <p className="dim">No price series available yet; the daily pipeline fills it.</p>;
  }
  return (
    <section id="stock" className="panel">
      <h2>stock</h2>
      <p>
        {ticker.value}{" "}
        <a href={ticker.source ?? undefined} rel="noopener" className="dim">
          (source, as of {ticker.as_of})
        </a>
      </p>
      {chart}
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

function SourcesSection({ rows }: { rows: ProfileRow[] }) {
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
  if (profile.stockTicker?.value) sections.push(["stock", "stock"]);
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
    <Layout current="registry">
      <div className="registry-profile">
        <Breadcrumbs
          segment={profile.breadcrumbSegment}
          name={profile.name}
          parentLink={profile.parentLink}
        />
        <h1 className="page-title profile-title">
          <RegistryLogo slug={profile.slug} name={profile.name} size="lg" />
          {profile.name} <span className="dim">/ {profile.typeLabel}</span>
        </h1>
        {profile.overview.value && (
          <>
            <p className="overview-block">{profile.overview.value}</p>
            <p className="dim source-line">
              <a href={profile.overview.source ?? undefined} rel="noopener">
                (source, as of {profile.overview.as_of})
              </a>
            </p>
          </>
        )}
        {/* Two columns on wide screens (2026-07-07 design pass): the
            reading flow left, wayfinding (toc / related / sources) in a
            sticky rail right. One column below 64rem, original order. */}
        <div className="profile-cols">
          <div className="profile-main">
            <section id="facts" className="panel">
              <h2>facts</h2>
              <ProfileTable rows={profile.rows} />
              {profile.tableNote && <p className="dim">{profile.tableNote}</p>}
            </section>
            <ChildConstellationsSection children={children} />
            <HistorySection history={history} />
            {profile.stockTicker?.value && (
              <StockSection slug={profile.slug} ticker={profile.stockTicker} />
            )}
            <VehicleRosterSection roster={roster} />
            <EventsSection profile={profile} />
            <FaqSection items={profile.faq} />
            <p>
              <a href="/registry/">Back to the registry</a>
            </p>
          </div>
          <aside className="profile-rail">
            <OnThisPageToc sections={sections} />
            <RelatedSection profile={profile} related={related} prev={prev} next={next} />
            {hasSources && <SourcesSection rows={profile.rows} />}
          </aside>
        </div>
      </div>
    </Layout>
  );
}

export function ConstellationPage({ profile }: { profile: ConstellationProfile }) {
  const childProfiles = constellationChildren(profile.slug);
  // Fleet parents show the sum of their sub-constellations' counts when the
  // parent field itself is unsourced, marked computed in the source column.
  const countRow = (
    label: string,
    field: "sats_launched_total" | "sats_active_claimed" | "sats_active_verified",
  ): ProfileRow => {
    if (profile[field].value === null) {
      const sum = fleetSum(childProfiles, field);
      if (sum) return [label, sum, "computed"];
    }
    return [label, profile[field]];
  };
  const rows: ProfileRow[] = [
    ["operator", profile.operator],
    ["country", profile.country],
    ["sensor types", profile.sensor_types],
    countRow("sats launched (total)", "sats_launched_total"),
    countRow("sats active (claimed)", "sats_active_claimed"),
    countRow("sats active (verified)", "sats_active_verified"),
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
  const children = childProfiles;
  const parent = profile.parent ? constellations.find((c) => c.slug === profile.parent) : undefined;
  const hasComputedRow = rows.some((r) => r[2] === "computed");
  const meta: ProfileMeta = {
    slug: profile.slug,
    name: profile.name,
    typeLabel: `${profile.domain} constellation`,
    affiliation: profile.operator.value,
    rows,
    overview: profile.overview,
    href: `/registry/constellations/${profile.slug}/`,
    siblingsBase: "/registry/constellations/",
    siblings: constellations.map((c) => ({ slug: c.slug, name: c.name, affiliation: c.operator.value })),
    breadcrumbSegment: "constellations",
    history: profile.events ?? [],
    stockTicker: profile.ticker ?? null,
    tableNote:
      [
        profile.sats_active_verified.value !== null || hasComputedRow
          ? "sats active (verified) counts objects currently tracked in CelesTrak's catalog for this constellation. It is a tracking count, not an operator claim about satellite health."
          : null,
        hasComputedRow
          ? "Rows marked computed are the sum of the sub-constellations listed below; each sub-constellation page carries its own sourced figure."
          : null,
      ]
        .filter(Boolean)
        .join(" ") || null,
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
    href: `/registry/organizations/${profile.slug}/`,
    siblingsBase: "/registry/organizations/",
    siblings: organizations
      .filter((o) => o.kind === profile.kind)
      .map((o) => ({ slug: o.slug, name: o.name, affiliation: o.kind })),
    breadcrumbSegment: "organizations",
    faq,
    vehicleRoster,
    history: profile.events ?? [],
    stockTicker: profile.ticker ?? null,
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
  // The X glyph already sits in the chip; "twitter/x" next to it read
  // "X TWITTER/X" (Florian 2026-07-07).
  x: "twitter",
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

/** Orbits app frame: the shared masthead at the shared measure (the
 * header holds still when entering /orbits), then the stage full-bleed
 * below it; footer rendered by the scene. */
export function OrbitsPage() {
  return (
    <div>
      <div className="shell orbits-head-shell">
        <Masthead current="orbits" />
      </div>
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
    <Layout current="signals">
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
    <Layout current="stats">
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
              <a href={`#${b.id}`}>{"//"}</a> {b.question}
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
    "Every item accumulates sources over its life and links each one. The best source sets the base of its signal-to-noise score: the actor itself or an official record scores highest, wide reporting and established aggregators next, trade press next, informal posts lowest. Corroboration raises a score; contradiction lowers it. The copy still names who said what: ICEYE says, per the FCC filing, per SpaceNews.",
  ],
  [
    "What does the SNR score mean?",
    "Every item carries a signal-to-noise score from 1 to 5, drawn as bars. 5 is a direct source: the actor itself or an official record. 4 is wide reporting that nothing has contradicted. 3 is a few reputable sources. 2 and 1 are weak corroboration: single sources, early signals, extraordinary claims. Clicking the bars shows the exact calculation, stored when the item was scored: the base source tier and every adjustment since. Scores move when corroboration, contradiction, or uncontested time changes the picture, and every move is logged.",
  ],
  [
    "What happens when a story cannot be verified?",
    "It publishes with a low score instead of disappearing. The wide net is deliberate: readers see early signals with the uncertainty made explicit, and the score climbs only when corroboration arrives or the claim survives uncontested. A claim contradicted by a stronger fact is marked disputed and stays visible with both sides shown. Whether the scores are honest is measurable: each claim's score at publication is recorded and compared against how it resolves.",
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
    <Layout current="about">
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
    <Layout current="log">
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
            <p className="sweep-summary">{s.summary}</p>
            {s.signals && (
              <p className="sweep-signals mono dim" title={s.signals.note}>
                signals pass: {s.signals.checked} channel{s.signals.checked === 1 ? "" : "s"}{" "}
                checked · {s.signals.x_attempted} X handle
                {s.signals.x_attempted === 1 ? "" : "s"} searched
                <span className="sweep-signals-note"> · {s.signals.note}</span>
              </p>
            )}
            {s.snr_movements && s.snr_movements.length > 0 && (
              <ul className="snr-moves">
                {s.snr_movements.map((m) => (
                  <li key={`${m.id}-${m.to}`}>
                    <a href={`/item/${m.id}/`}>{m.id}</a>{" "}
                    <span className={m.to > m.from ? "snr-up" : "snr-down"}>
                      {m.from}→{m.to}
                    </span>{" "}
                    <span className="dim">{m.reason}</span>
                  </li>
                ))}
              </ul>
            )}
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
      <section className="panel" id="source-ledger">
        <h2>source ledger</h2>
        <p className="dim">
          Rolling per-source reliability record (90-day window): strikes for claims that lost a
          same-metric contradiction, credits for claims that started low and were later confirmed.
          Machine-owned, human-audited; demotions and recoveries follow the thresholds in the
          public spec.
        </p>
        {ledgerSources.length === 0 ? (
          <p className="empty">// no reliability events recorded yet</p>
        ) : (
          <table className="profile">
            <thead>
              <tr>
                <th>source</th>
                <th>strikes</th>
                <th>credits</th>
                <th>claims</th>
                <th>demoted</th>
              </tr>
            </thead>
            <tbody>
              {ledgerSources.map((src) => (
                <tr key={src.domain}>
                  <th scope="row">{src.name ?? src.domain}</th>
                  <td>{src.events.filter((e) => e.kind === "strike").length}</td>
                  <td>{src.events.filter((e) => e.kind === "credit").length}</td>
                  <td>{src.claims.length}</td>
                  <td>{src.class_override ? "yes" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
