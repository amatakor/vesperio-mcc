import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// useLayoutEffect runs before the browser paints (so the masonry packs with no
// gap flash), but warns during SSR; fall back to useEffect on the server.
const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;
import type {
  Item,
  SnrTrace,
  SourcedField,
  TimelineEvent,
  ImagingMode,
  Positioning,
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
  calibrationBuckets,
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
function SnrTraceRows({ trace, condensed = false }: { trace: SnrTrace; condensed?: boolean }) {
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
      {!condensed && (trace.history ?? []).length > 0 && (
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

/** Confidence word per score (SNR mark handoff 2026-07-07). */
const SNR_WORDS: Record<number, string> = {
  1: "SINGLE SOURCE",
  2: "CORROBORATED",
  3: "MULTI-SOURCE",
  4: "WIDELY REPORTED",
  5: "FIRST-PARTY",
};

/**
 * The SNR mark: five phosphor-green LED cells in a recessed bezel, N
 * lit = score N (design handoff 2026-07-07). Sizes: compact (tables),
 * card (feed), hero (item page, adds numeral + word). With a trace it
 * shows the stored calculation (rendered from snr_trace exactly as
 * stored, never reconstructed). On interactive surfaces it is a button:
 * click pins the popover. On a feed card (onCard) it peeks a condensed
 * popover on hover instead, fixed-positioned so it escapes the card's
 * overflow, and the click falls through to open the item.
 */
function SnrLed({
  snr,
  trace,
  size = "card",
  onCard = false,
}: {
  snr: number;
  trace?: SnrTrace;
  size?: "compact" | "card" | "hero";
  onCard?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [fixedPos, setFixedPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const v = Math.max(1, Math.min(5, Math.round(snr)));
  const word = SNR_WORDS[v] ?? "";
  const interactive = !!trace;
  const clickable = interactive && !onCard;
  const cells = (
    <span
      className="snr-led-bezel"
      {...(clickable
        ? {
            role: "button",
            tabIndex: 0,
            "aria-expanded": open,
            "aria-label": `SNR ${v} of 5, ${word.toLowerCase()}. Click for the calculation.`,
            title: `SNR ${v}/5 · ${word} — click for calculation`,
            onClick: (e: ReactMouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(!open);
            },
            onKeyDown: (e: ReactKeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(!open);
              }
            },
          }
        : { "aria-label": `SNR ${v} of 5, ${word.toLowerCase()}`, title: `SNR ${v}/5 · ${word}` })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`snr-led-cell${i <= v ? " lit" : ""}`} />
      ))}
    </span>
  );
  const showPop = interactive && (onCard ? hover : open || hover);
  return (
    <span
      ref={rootRef}
      className={`snr-led snr-led-${size}`}
      data-interactive={interactive ? "true" : undefined}
      onClick={clickable ? (e) => e.stopPropagation() : undefined}
      onMouseEnter={
        interactive
          ? () => {
              if (onCard) {
                const r = rootRef.current?.querySelector(".snr-led-bezel")?.getBoundingClientRect();
                if (r) {
                  const W = 304;
                  const below = r.bottom + 6;
                  const flipUp = below + 300 > window.innerHeight;
                  setFixedPos({
                    top: flipUp ? Math.max(8, r.top - 306) : below,
                    left: Math.max(8, Math.min(r.left, window.innerWidth - W - 8)),
                  });
                }
              }
              setHover(true);
            }
          : undefined
      }
      onMouseLeave={interactive ? () => setHover(false) : undefined}
    >
      {cells}
      {size === "hero" && (
        <>
          <span className="snr-led-num">
            {v}
            <span className="snr-led-slash">/5</span>
          </span>
          <span className="snr-led-word">{word}</span>
        </>
      )}
      {clickable && (
        <span className="snr-led-caret" aria-hidden="true">
          ↳
        </span>
      )}
      {showPop && (
        <span
          className={`snr-pop${onCard ? " snr-pop-card" : ""}`}
          role="dialog"
          aria-label="SNR calculation"
          style={
            onCard && fixedPos
              ? { position: "fixed", top: fixedPos.top, left: fixedPos.left }
              : undefined
          }
        >
          <span className="snr-pop-head">
            <span>
              snr {v}/5 · {SNR_LABELS[v]}
            </span>
            {!onCard && (
              <button
                type="button"
                className="snr-pop-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
              >
                ×
              </button>
            )}
          </span>
          <SnrTraceRows trace={trace} condensed={onCard} />
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
    const contain = item.image.fit === "contain";
    // The image's own ratio makes the frame match the photo, so it is shown
    // whole (never cropped). Logos keep the fixed contain tile.
    const style =
      !contain && item.image.width && item.image.height
        ? { aspectRatio: `${item.image.width} / ${item.image.height}` }
        : undefined;
    return (
      <div className={`card-media${contain ? " card-media-contain" : ""}`} style={style}>
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

/** A feed card. The whole card opens the item modal; the headline and
    details keep real /item/ hrefs for crawlers and middle-click. Cards are a
    uniform width (one auto-fill column); their varying heights drive the
    masonry. */
function Card({
  item,
  onOpen,
}: {
  item: Item;
  onOpen: (item: Item) => void;
}) {
  const sources = item.sources?.length ?? 1 + item.secondary_urls.length;
  const open = (e: ReactMouseEvent) => {
    e.preventDefault();
    onOpen(item);
  };
  return (
    <article
      className={`card card-${item.impact}`}
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
        {item.kind === "commentary" && <span className="chip chip-commentary">commentary</span>}
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
        <SnrLed snr={item.snr} trace={item.snr_trace} onCard />
        <span className="card-foot-div" aria-hidden="true" />
        <span className="card-companies" title={item.companies.join(" · ")}>
          {item.companies.join(" · ")}
        </span>
        <a className="card-details" href={`/item/${item.id}/`}>
          {sources} source{sources === 1 ? "" : "s"} →
        </a>
      </div>
    </article>
  );
}

// ------------------------------------------------------ sweep countdown

/** News sweep schedule, UTC hours. Mirrors the cron in
    .github/workflows/update-items.yml ("0 5,17 * * *"); keep in sync by
    hand, the workflow file is not readable from the client. */
const SWEEP_UTC_HOURS = [5, 17];

function nextSweepAfter(now: Date): Date {
  for (const h of SWEEP_UTC_HOURS) {
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h));
    if (t.getTime() > now.getTime()) return t;
  }
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, SWEEP_UTC_HOURS[0]!),
  );
}

/** 7-segment display with a ghost "888" layer underneath, the orbits-page
    LCD language (DSEG7 has the digits, the colon, and the dash). */
function SweepLcd({ value }: { value: string }) {
  return (
    <span className="sweep-lcd">
      <span className="sweep-lcd-ghost" aria-hidden="true">
        {value.replace(/[0-9-]/g, "8")}
      </span>
      <span className="sweep-lcd-lit">{value}</span>
    </span>
  );
}

/** First slot of the news feed: countdown to the next scheduled sweep.
    Renders a placeholder until mounted so SSR and hydration agree; the
    ticking never changes the card's height, so the masonry stays put. */
function SweepCountdownCard() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  let digits = "--:--:--";
  let local = "";
  if (now) {
    const target = nextSweepAfter(now);
    const s = Math.max(0, Math.round((target.getTime() - now.getTime()) / 1000));
    digits = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
    local = target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return (
    <aside className="sweep-card" role="timer" aria-label="Time until the next news sweep">
      <p className="sweep-card-label">T-minus next sweep</p>
      <p className="sweep-card-foot">
        <span className="sweep-card-seg">sweeps 05:00 + 17:00 utc</span>
        {local && <span className="sweep-card-seg">next {local} local</span>}
      </p>
      <SweepLcd value={digits} />
    </aside>
  );
}

/** Card grid plus the item modal. Opening an item pushes /item/{id}/
    onto history so the URL is shareable; back (or close) returns to
    the feed. Direct visits to /item/ URLs get the prerendered page. */
function FeedList({ list, emptyNote, lead }: { list: Item[]; emptyNote: string; lead?: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    function onPop(e: PopStateEvent) {
      const s = e.state as { mccItem?: string } | null;
      setOpenId(s?.mccItem ?? null);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Content-sized masonry: give each card a row-span equal to its own measured
  // height so the feed packs with no gaps (images are shown whole, so card
  // heights vary). Runs before paint; the CSS fallback keeps the pre-hydration
  // and no-JS states gapless (equal-height rows) until this tightens them.
  const gridRef = useRef<HTMLDivElement>(null);
  useIsoLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const pack = () => {
      grid.classList.add("is-packed");
      const cards = Array.from(grid.children) as HTMLElement[];
      for (const c of cards) {
        c.style.gridRowEnd = "";
        c.style.height = "";
      }
      const heights = cards.map((c) => c.getBoundingClientRect().height);
      cards.forEach((c, i) => {
        // Integer height, fraction rounded INTO the card (the footer's
        // margin-top:auto slack absorbs the sub-pixel invisibly): a span of
        // ceil() rows over a fractional card left a 0-1px sliver of page
        // black under every card and kept the two cards' 1px borders from
        // merging (a visible double-line seam, Florian 2026-07-08). The grid
        // area is one row SHORT of the height so each card, pulled up by its
        // -1px top margin, overlaps the previous card's bottom border exactly:
        // one hairline between cards, same as the vertical seams.
        const h = Math.max(2, Math.ceil(heights[i]!));
        c.style.height = `${h}px`;
        c.style.gridRowEnd = `span ${h - 1}`;
      });
    };
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(pack);
    };
    pack();
    // Re-pack on any card reflow: late-decoding images, web fonts, wrapped
    // headlines. pack() clears its own inline height before re-measuring, and
    // re-applying identical values causes no size change, so observing the
    // cards can't feed back into a loop. ResizeObserver's initial callback
    // also gives a guaranteed post-layout pack.
    const ro = new ResizeObserver(schedule);
    for (const c of Array.from(grid.children)) ro.observe(c);
    window.addEventListener("resize", schedule);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
  }, [list]);

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

  if (list.length === 0) return <p className="empty">{emptyNote}</p>;
  return (
    <>
      <div className="cards" ref={gridRef}>
        {lead}
        {list.map((i) => (
          <Card key={i.id} item={i} onOpen={open} />
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
          <SnrLed snr={item.snr} trace={item.snr_trace} />
          <span className="band-impact">{item.impact}</span>
          <a className="chip" href={`/news/${item.category}/`}>
            {item.category}
          </a>
          {item.disputed && <span className="chip chip-disputed">disputed</span>}
        {item.kind === "commentary" && <span className="chip chip-commentary">commentary</span>}
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
                <SnrLed snr={item.snr} size="hero" />
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
        <FeedList
          list={shown}
          emptyNote="No items yet. The first sweep has not run."
          lead={<SweepCountdownCard />}
        />
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

export function KindPage({ kind }: { kind: string }) {
  return (
    <Layout current="news">
      <h1 className="page-title">news / {kind}</h1>
      <p className="lede">
        Takes and analysis from named voices, visibly tagged. The SNR scores the attribution
        (this person said this), never the opinion. Commentary never feeds the Registry.
      </p>
      <FeedList
        list={items.filter((i) => i.kind === kind)}
        emptyNote="No commentary tracked yet."
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
        {item.kind === "commentary" && <span className="chip chip-commentary">commentary</span>}
          <SnrLed snr={item.snr} trace={item.snr_trace} />
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
                <SnrLed snr={item.snr} size="hero" />
                {item.disputed && <span className="chip chip-disputed">disputed</span>}
        {item.kind === "commentary" && <span className="chip chip-commentary">commentary</span>}
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

/** One cell in the key-specs panel: a defining figure with its provenance. */
interface SpecCell {
  /** Anchor suffix and React key; rendered id is `spec-<field>`. */
  field: string;
  label: string;
  /** Already formatted value + unit. */
  value: string;
  as_of?: string | null;
  snr?: number;
  snr_trace?: SnrTrace;
  /** True for derived figures (fleet sums, flight record); no LED, marked computed. */
  computed?: boolean;
}

/** Thousands-separated for readability; leaves non-numbers untouched. */
function fmtNum(v: unknown): string {
  return typeof v === "number" ? v.toLocaleString("en-US") : String(v);
}

/** Build a spec cell from a sourced field, or null when the field is absent/unfilled. */
function specFromField(
  field: string,
  label: string,
  f: SourcedField<unknown> | undefined,
  fmt: (v: unknown) => string,
): SpecCell | null {
  if (!f || f.value === null || f.value === undefined) return null;
  return { field, label, value: fmt(f.value), as_of: f.as_of, snr: f.snr, snr_trace: f.snr_trace };
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
                <SnrLed snr={c.snr} size="compact" />{" "}
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
        {f.snr !== undefined && <SnrLed snr={f.snr} trace={f.snr_trace} size="compact" />}
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

/**
 * GCAT is CC-BY; the license requires visible attribution wherever its
 * data renders. Exact string per the enrichment contract.
 */
function GcatAttribution({ rows }: { rows: ProfileRow[] }) {
  const cited = rows.some(
    ([, f]) => typeof f.source === "string" && f.source.includes("planet4589.org"),
  );
  if (!cited) return null;
  return (
    <p className="dim attribution">
      Includes{" "}
      <a href="https://planet4589.org/space/gcat/" rel="noopener">
        data from GCAT (J. McDowell, planet4589.org/space/gcat)
      </a>
      , CC-BY.
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

/** Registry selection accents follow the Orbits domain palette. All four
    sections carry a deliberate accent (registry v2: launch and ecosystem
    hues pending Florian's palette sign-off, values from the existing neon
    set so nothing new enters the palette). */
const DOMAIN_ACCENT: Record<string, string> = {
  eo: "var(--neon-eo)",
  connectivity: "var(--neon-connectivity)",
  iot: "var(--neon-iot)",
};
const SECTION_ACCENT: Record<string, string> = {
  launch: "var(--neon-hsf)",
  spaceports: "var(--neon-reserve)",
  ecosystem: "var(--neon-nav)",
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
                  accent={SECTION_ACCENT.launch}
                />
              )}
              {s.id === "constellations" && <ConstellationBrowser entries={s.entries} />}
              {s.id === "spaceports" && (
                <PaneBrowser
                  entries={s.entries}
                  groupLabel="region"
                  groupDisplay={(r) => REGION_LABEL[r] ?? r}
                  entityAside={() => "site"}
                  accent={SECTION_ACCENT.spaceports}
                />
              )}
              {s.id === "ecosystem" && (
                <PaneBrowser
                  entries={s.entries}
                  groupLabel="kind"
                  groupDisplay={(k) => ORG_KIND_LABEL[k] ?? k}
                  entityAside={() => "organization"}
                  accent={SECTION_ACCENT.ecosystem}
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
  /** Key-specs panel cells (registry v2); panel hides below 2 cells. */
  specs?: SpecCell[];
  /** Dim note under the key-specs panel (e.g. variant qualifier). */
  specNote?: string | null;
  /** Vehicle configuration qualifier, rendered as a chip beside the name. */
  variant?: string | null;
  /** Per-entity positioning block; renders the positioning section. */
  positioning?: Positioning | null;
  /** Per-mode EO specs; rendered as a sub-table inside the facts section. */
  imagingModes?: ImagingMode[];
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
  const sameLabel = profile.affiliation ?? "same operator";
  return (
    <section id="related" className="panel">
      <h2>related</h2>
      {related.length > 0 && (
        <div className="related-group">
          <span className="related-label">{sameLabel}</span>
          <div className="tag-row">
            {related.map((r) => (
              <a key={r.slug} className="chip chip-tag" href={r.href}>
                {r.name}
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="related-group related-browse">
        <span className="related-label">browse</span>
        <div className="prev-next">
          <span>{prev ? <a href={`${profile.siblingsBase}${prev.slug}/`}>&larr; {prev.name}</a> : <span className="dim">&larr; start</span>}</span>
          <span>{next ? <a href={`${profile.siblingsBase}${next.slug}/`}>{next.name} &rarr;</a> : <span className="dim">end &rarr;</span>}</span>
        </div>
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

/** Close-price chart for listed entities; ~2y series via the Yahoo Finance pipeline
 * (scripts/fetch-stocks.ts), sliced client-side by the 1M/6M/1Y/ALL toggle.
 * Hand-rolled SVG: labeled Y gridlines in real currency, dated X ticks, a
 * pointer/touch crosshair readout, and padded normalization so amplitude reads. */
type StockRangeKey = "1M" | "6M" | "1Y" | "ALL";
const STOCK_RANGES: Array<{ key: StockRangeKey; days: number }> = [
  { key: "1M", days: 31 },
  { key: "6M", days: 186 },
  { key: "1Y", days: 372 },
  { key: "ALL", days: Infinity },
];
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  SEK: "kr ",
  NOK: "kr ",
};
function stockCurrencyPrefix(code: string | null): string {
  if (!code) return "";
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}
/** 3-4 evenly-rounded gridline values spanning [lo, hi]. */
function stockNiceTicks(lo: number, hi: number, count: number): number[] {
  const range = hi - lo;
  if (!(range > 0)) return [lo];
  const rawStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 1e-6; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}
function stockDecimals(step: number): number {
  if (step >= 10) return 0;
  if (step >= 1) return 1;
  return 2;
}

function StockSection({ slug, ticker }: { slug: string; ticker: SourcedField<string> }) {
  const [data, setData] = useState<{ closes: Array<[string, number]>; currency: string | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [range, setRange] = useState<StockRangeKey>("6M");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    fetch(`/data/stocks/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setData({ closes: d.closes, currency: d.currency ?? null }))
      .catch(() => setFailed(true));
  }, [slug]);

  // Geometry (viewBox units); CSS scales the SVG to container width.
  const W = 640;
  const H = 210;
  const ML = 48; // room for Y labels
  const MR = 12;
  const MT = 12;
  const MB = 22; // room for X labels
  const plotL = ML;
  const plotR = W - MR;
  const plotT = MT;
  const plotB = H - MB;
  const plotW = plotR - plotL;
  const plotH = plotB - plotT;

  const closes = data?.closes ?? null;

  // Which range buttons to show: skip any whose window duplicates a shorter one.
  const rangeButtons = useMemo(() => {
    if (!closes || closes.length < 2) return [] as Array<{ key: StockRangeKey; len: number }>;
    const lastDate = new Date(closes[closes.length - 1]![0]).getTime();
    const seen = new Set<number>();
    const out: Array<{ key: StockRangeKey; len: number }> = [];
    for (const r of STOCK_RANGES) {
      const cutoff = r.days === Infinity ? -Infinity : lastDate - r.days * 86400000;
      const len = closes.filter(([d]) => new Date(d).getTime() >= cutoff).length;
      if (len < 2 || seen.has(len)) continue;
      seen.add(len);
      out.push({ key: r.key, len });
    }
    return out;
  }, [closes]);

  // Effective range: fall back to the largest visible window if the pick is hidden.
  const effRange: StockRangeKey =
    rangeButtons.find((b) => b.key === range)?.key ?? rangeButtons[rangeButtons.length - 1]?.key ?? "ALL";

  const sliced = useMemo(() => {
    if (!closes || closes.length < 2) return [] as Array<[string, number]>;
    const def = STOCK_RANGES.find((r) => r.key === effRange)!;
    if (def.days === Infinity) return closes;
    const cutoff = new Date(closes[closes.length - 1]![0]).getTime() - def.days * 86400000;
    return closes.filter(([d]) => new Date(d).getTime() >= cutoff);
  }, [closes, effRange]);

  let chart: ReactNode = null;
  if (sliced.length > 1) {
    const n = sliced.length;
    const vals = sliced.map(([, c]) => c);
    const dmin = Math.min(...vals);
    const dmax = Math.max(...vals);
    const pad = (dmax - dmin || dmax || 1) * 0.08;
    const lo = dmin - pad;
    const hi = dmax + pad;
    const span = hi - lo || 1;
    const cur = stockCurrencyPrefix(data?.currency ?? null);

    const x = (i: number) => plotL + (i / (n - 1)) * plotW;
    const y = (c: number) => plotT + ((hi - c) / span) * plotH;

    const line = sliced.map(([, c], i) => `${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(" ");

    const ticks = stockNiceTicks(lo, hi, 4).filter((t) => t >= lo && t <= hi);
    const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : span;
    const dec = stockDecimals(step);

    // ~4 date ticks across the window.
    const xtCount = Math.min(4, n);
    const longWindow = (STOCK_RANGES.find((r) => r.key === effRange)!.days ?? Infinity) > 300 || effRange === "ALL";
    const fmtDate = (iso: string) => (longWindow ? iso.slice(0, 7) : iso.slice(5));
    const xTicks = Array.from({ length: xtCount }, (_, k) => Math.round((k / (xtCount - 1 || 1)) * (n - 1)));

    const first = vals[0]!;
    const last = vals[n - 1]!;
    const up = last >= first;
    const pct = first ? ((last - first) / first) * 100 : 0;

    const hIdx = hoverIdx == null ? null : Math.max(0, Math.min(n - 1, hoverIdx));
    const hPoint = hIdx == null ? null : sliced[hIdx]!;

    const onMove = (clientX: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const vx = ((clientX - rect.left) / rect.width) * W;
      const frac = (vx - plotL) / plotW;
      setHoverIdx(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))));
    };

    chart = (
      <>
        <div className="stock-head">
          <span className="stock-last mono">
            {cur}
            {last.toFixed(2)}
          </span>
          <span className={`stock-chg mono ${up ? "up" : "down"}`}>
            {up ? "+" : ""}
            {pct.toFixed(1)}%
          </span>
          <span className="stock-attr dim mono">market data: Yahoo Finance, end of day</span>
        </div>
        <div className="sig-tabs stock-tabs">
          {rangeButtons.map((b) => (
            <button
              key={b.key}
              type="button"
              className={`sig-tab${b.key === effRange ? " active" : ""}`}
              aria-pressed={b.key === effRange}
              onClick={() => {
                setRange(b.key);
                setHoverIdx(null);
              }}
            >
              {b.key}
            </button>
          ))}
        </div>
        <div className="stock-chart-wrap">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="stock-chart"
            role="img"
            aria-label={`${effRange} close prices, last ${cur}${last.toFixed(2)}`}
            onPointerMove={(e) => onMove(e.clientX)}
            onPointerDown={(e) => onMove(e.clientX)}
            onPointerLeave={() => setHoverIdx(null)}
          >
            {/* Y gridlines + labels */}
            {ticks.map((t) => {
              const gy = y(t);
              return (
                <g key={`y${t}`}>
                  <line x1={plotL} y1={gy} x2={plotR} y2={gy} stroke="var(--line)" strokeWidth="1" />
                  <text x={plotL - 6} y={gy + 3} textAnchor="end" className="stock-axis-label">
                    {cur}
                    {t.toFixed(dec)}
                  </text>
                </g>
              );
            })}
            {/* X ticks */}
            {xTicks.map((i, k) => (
              <text
                key={`x${i}`}
                x={x(i)}
                y={H - 6}
                textAnchor={k === 0 ? "start" : k === xTicks.length - 1 ? "end" : "middle"}
                className="stock-axis-label"
              >
                {fmtDate(sliced[i]![0])}
              </text>
            ))}
            {/* price line */}
            <polyline points={line} fill="none" stroke="var(--fg)" strokeWidth="1.5" />
            {/* crosshair */}
            {hIdx != null && hPoint && (
              <g>
                <line
                  x1={x(hIdx)}
                  y1={plotT}
                  x2={x(hIdx)}
                  y2={plotB}
                  stroke="var(--acc)"
                  strokeWidth="1"
                />
                <circle cx={x(hIdx)} cy={y(hPoint[1])} r="3" fill="var(--acc)" />
                <text
                  x={x(hIdx) < W / 2 ? x(hIdx) + 6 : x(hIdx) - 6}
                  y={plotT + 10}
                  textAnchor={x(hIdx) < W / 2 ? "start" : "end"}
                  className="stock-readout"
                >
                  {hPoint[0]}  {cur}
                  {hPoint[1].toFixed(2)}
                </text>
              </g>
            )}
          </svg>
        </div>
      </>
    );
  } else if (failed || (data && (!closes || closes.length < 2))) {
    chart = (
      <div className="stock-chart-wrap stock-empty">
        <p className="dim">No price series available yet; the daily pipeline fills it.</p>
      </div>
    );
  } else {
    chart = <div className="stock-chart-wrap" />;
  }

  if (!ticker.value) return null;
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
/** The entity's defining numbers as anchored, citable stat cells (registry v2). */
function KeySpecsPanel({ cells, note }: { cells: SpecCell[]; note?: string | null }) {
  if (cells.length < 2) return null;
  return (
    <section id="specs" className="panel">
      <h2>key specs</h2>
      <div className="specs-grid">
        {cells.map((c) => (
          <div key={c.field} id={`spec-${c.field}`} className="spec-cell">
            <span className="spec-label">
              {c.label}{" "}
              <a className="spec-anchor" href={`#spec-${c.field}`}>
                {"//"}
              </a>
            </span>
            <span className="spec-value">{c.value}</span>
            <span className="spec-meta">
              {c.snr !== undefined && <SnrLed snr={c.snr} trace={c.snr_trace} size="compact" />}
              {c.computed && <span className="dim spec-computed">computed</span>}
              {c.as_of && <span className="dim spec-asof">as of {c.as_of}</span>}
            </span>
          </div>
        ))}
      </div>
      {note && <p className="dim spec-note">{note}</p>}
    </section>
  );
}

/** Where the entity sits: sourced positioning claims, then MCC's own read. */
function PositioningSection({ positioning }: { positioning?: Positioning | null }) {
  if (!positioning) return null;
  const claims = positioning.claims ?? [];
  const read = positioning.mcc_read;
  if (claims.length === 0 && !read) return null;
  return (
    <section id="positioning" className="panel">
      <h2>positioning</h2>
      {claims.length > 0 && (
        <ul className="positioning-claims">
          {claims.map((c, i) => (
            <li key={i}>
              <span>{c.value}</span>{" "}
              {c.source && (
                <a className="src-link" href={c.source} rel="noopener">
                  source
                </a>
              )}{" "}
              {c.snr !== undefined && <SnrLed snr={c.snr} trace={c.snr_trace} size="compact" />}
            </li>
          ))}
        </ul>
      )}
      {read && (
        <div className="mcc-read">
          <span className="mcc-read-label">MCC READ</span>
          <p className="mcc-read-text">{read.text}</p>
          <p className="dim mcc-read-basis">
            basis:{" "}
            {read.basis.map((u, i) => (
              <span key={u}>
                {i > 0 && " "}
                <a className="src-link" href={u} rel="noopener">
                  [{i + 1}]
                </a>
              </span>
            ))}{" "}
            · as of {read.as_of}
          </p>
        </div>
      )}
    </section>
  );
}

/** Orbital-safety and anomaly events, surfaced ahead of the full history. */
function IncidentsSection({ history }: { history: TimelineEvent[] }) {
  const incidents = history
    .filter((e) => e.type === "incident")
    .sort((a, b) => a.date.localeCompare(b.date));
  if (incidents.length === 0) return null;
  return (
    <section id="incidents" className="panel">
      <h2>incidents</h2>
      <ol className="timeline">
        {incidents.map((e) => (
          <li key={`${e.date}-${e.headline}`}>
            <span className="mono timeline-date">{e.date}</span>
            <span>
              {e.headline}
              {e.outcome && <span className="incident-line">outcome: {e.outcome}</span>}
              {e.cause && <span className="incident-line">cause: {e.cause}</span>}{" "}
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
              {e.type && e.type !== "milestone" && (
                <span className="chip chip-tl-type">{e.type}</span>
              )}{" "}
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
      <GcatAttribution rows={rows} />
    </section>
  );
}

interface FaqItem {
  q: string;
  field: SourcedField<unknown>;
  render: (value: unknown) => string;
}

function FaqSection({ items }: { items: FaqItem[] }) {
  const answered = items.filter((i) => i.field.value !== null && i.field.value !== undefined);
  if (answered.length === 0) return null;
  return (
    <section id="faq" className="panel">
      <h2>faq</h2>
      {answered.map(({ q, field, render }) => (
        <details className="cite faq-item" key={q}>
          <summary>{q}</summary>
          <p className="citation">
            {render(field.value)}{" "}
            <a href={field.source ?? undefined} rel="noopener" className="dim">
              (source, as of {field.as_of})
            </a>
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
  const specs = profile.specs ?? [];
  const hasSpecs = specs.length >= 2;
  const positioning = profile.positioning ?? null;
  const hasPositioning =
    !!positioning && ((positioning.claims?.length ?? 0) > 0 || !!positioning.mcc_read);
  const hasIncidents = history.some((e) => e.type === "incident");
  const answeredFaq = profile.faq.filter(
    (i) => i.field.value !== null && i.field.value !== undefined,
  );

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

  const names = [profile.name, profile.affiliation].filter((n): n is string => !!n);
  const hasEvents = itemsMentioning(names).length > 0;
  const hasSources = profile.rows.some(([, f]) => !!f.source);

  // TOC mirrors the rendered sections, in reading-flow order (specs first,
  // then positioning, facts, incidents, history, stock, children/roster,
  // events); related and sources live in the rail but stay in the list.
  const sections: Array<[string, string]> = [];
  if (hasSpecs) sections.push(["specs", "key specs"]);
  if (hasPositioning) sections.push(["positioning", "positioning"]);
  sections.push(["facts", "facts"]);
  if (hasIncidents) sections.push(["incidents", "incidents"]);
  if (history.length > 0) sections.push(["history", "history"]);
  if (profile.stockTicker?.value) sections.push(["stock", "stock"]);
  if (children.length > 0) sections.push(["constellations", "constellations"]);
  if (roster.length > 0) sections.push(["vehicles", "vehicles"]);
  if (hasEvents) sections.push(["events", "events"]);
  if (related.length > 0 || prev || next) sections.push(["related", "related"]);
  if (hasSources) sections.push(["sources", "sources"]);
  if (answeredFaq.length > 0) sections.push(["faq", "faq"]);

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
          {profile.name}
          {profile.variant && <span className="chip chip-variant">{profile.variant}</span>}{" "}
          <span className="dim">/ {profile.typeLabel}</span>
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
            <KeySpecsPanel cells={specs} note={profile.specNote} />
            <PositioningSection positioning={positioning} />
            <section id="facts" className="panel">
              <h2>facts</h2>
              <ProfileTable rows={profile.rows} />
              {profile.imagingModes && profile.imagingModes.length > 0 && (
                <table className="profile imaging-modes">
                  <thead>
                    <tr>
                      <th>mode</th>
                      <th>resolution</th>
                      <th>swath</th>
                      <th>source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.imagingModes.map((m) => (
                      <tr key={m.mode}>
                        <th scope="row">{m.mode}</th>
                        <td>{m.resolution_m !== null ? `${m.resolution_m} m` : "unknown"}</td>
                        <td>{m.swath_km !== null ? `${m.swath_km} km` : "unknown"}</td>
                        <td className="src-cell">
                          <a href={m.source} rel="noopener">
                            source
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {profile.tableNote && <p className="dim">{profile.tableNote}</p>}
            </section>
            <IncidentsSection history={history} />
            <HistorySection history={history} />
            {profile.stockTicker?.value && (
              <StockSection slug={profile.slug} ticker={profile.stockTicker} />
            )}
            <ChildConstellationsSection children={children} />
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
  const verifiedRow = countRow("sats active (verified)", "sats_active_verified");
  const rows: ProfileRow[] = [
    ["operator", profile.operator],
    ["country", profile.country],
    ["sensor types", profile.sensor_types],
    countRow("sats launched (total)", "sats_launched_total"),
    countRow("sats active (claimed)", "sats_active_claimed"),
    verifiedRow,
    ["sats planned", profile.sats_planned],
    ["orbit", profile.orbit],
    ["first launch", profile.first_launch_date],
    ["latest launch", profile.latest_launch_date],
    ["status", profile.status],
    ["website", profile.website],
  ];
  // v2 capability fields join the exhaustive table only when present.
  const addOpt = (label: string, f: SourcedField<unknown> | undefined) => {
    if (f) rows.push([label, f]);
  };
  addOpt("resolution (m)", profile.resolution_m);
  addOpt("swath (km)", profile.swath_km);
  addOpt("revisit", profile.revisit);
  addOpt("spectral bands", profile.spectral_bands);
  addOpt("frequency bands", profile.frequency_bands);
  addOpt("capacity", profile.capacity);
  addOpt("user terminals", profile.user_terminals);
  addOpt("service type", profile.service_type);

  // Key-specs panel: defining figures, capped at 6 in priority order.
  const isConnIot = profile.domain === "connectivity" || profile.domain === "iot";
  const verifiedField = verifiedRow[1];
  const verifiedComputed = verifiedRow[2] === "computed";
  const specCandidates: Array<SpecCell | null> = [
    specFromField("resolution_m", "resolution", profile.resolution_m, (v) => `${fmtNum(v)} m`),
    specFromField("swath_km", "swath", profile.swath_km, (v) => `${fmtNum(v)} km`),
    specFromField("revisit", "revisit", profile.revisit, (v) => String(v)),
    specFromField("spectral_bands", "spectral bands", profile.spectral_bands, (v) =>
      (v as string[]).join(", "),
    ),
    verifiedField.value !== null && verifiedField.value !== undefined
      ? {
          field: "sats_active_verified",
          label: "sats on orbit (verified)",
          value: fmtNum(verifiedField.value),
          as_of: verifiedField.as_of,
          snr: verifiedField.snr,
          snr_trace: verifiedField.snr_trace,
          computed: verifiedComputed,
        }
      : null,
    ...(isConnIot
      ? [
          specFromField("frequency_bands", "frequency bands", profile.frequency_bands, (v) =>
            (v as string[]).join(", "),
          ),
          specFromField("capacity", "capacity", profile.capacity, (v) => String(v)),
          specFromField("service_type", "service type", profile.service_type, (v) => String(v)),
        ]
      : []),
  ];
  const specs = specCandidates.filter((c): c is SpecCell => c !== null).slice(0, 6);
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
    specs,
    positioning: profile.positioning ?? null,
    imagingModes: profile.imaging_modes,
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
  const addOpt = (label: string, f: SourcedField<unknown> | undefined) => {
    if (f) rows.push([label, f]);
  };
  addOpt("payload to SSO (kg)", profile.payload_sso_kg);
  addOpt("payload to GTO (kg)", profile.payload_gto_kg);
  addOpt("height (m)", profile.height_m);
  addOpt("diameter (m)", profile.diameter_m);
  addOpt("mass (kg)", profile.mass_kg);
  addOpt("stages", profile.stages);
  addOpt("stage-1 engines", profile.engines_stage1);

  // Key-specs panel: defining figures, capped at 6 in priority order.
  const st = profile.flights_successful.value;
  const tt = profile.flights_total.value;
  const flightRecord: SpecCell | null =
    st !== null && tt !== null && tt > 0
      ? {
          field: "flight-record",
          label: "flight record",
          // One decimal, never rounded up to a claim the record does not
          // support: 603/604 is 99.8%, not "100% success".
          value: `${st} / ${tt} (${(Math.floor((st / tt) * 1000) / 10).toFixed(1)}% success)`,
          computed: true,
        }
      : null;
  const specCandidates: Array<SpecCell | null> = [
    specFromField("payload_leo_kg", "payload to LEO", profile.payload_leo_kg, (v) => `${fmtNum(v)} kg`),
    specFromField("payload_sso_kg", "payload to SSO", profile.payload_sso_kg, (v) => `${fmtNum(v)} kg`),
    specFromField("payload_gto_kg", "payload to GTO", profile.payload_gto_kg, (v) => `${fmtNum(v)} kg`),
    specFromField("height_m", "height", profile.height_m, (v) => `${fmtNum(v)} m`),
    specFromField(
      "price_per_launch_usd",
      "price per launch",
      profile.price_per_launch_usd,
      (v) => `$${fmtNum(v)}`,
    ),
    flightRecord,
  ];
  const specs = specCandidates.filter((c): c is SpecCell => c !== null).slice(0, 6);
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
    specs,
    variant: profile.variant ?? null,
    specNote: profile.variant
      ? `figures describe the ${profile.variant} configuration where sourced`
      : null,
    history: profile.events ?? [],
    positioning: profile.positioning ?? null,
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
  const specCandidates: Array<SpecCell | null> = [
    specFromField("launches_total", "launches total", profile.launches_total, (v) => fmtNum(v)),
    specFromField("first_launch_date", "first launch", profile.first_launch_date, (v) => String(v)),
    specFromField("status", "status", profile.status, (v) => String(v)),
  ];
  const specs = specCandidates.filter((c): c is SpecCell => c !== null).slice(0, 6);
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
    specs,
    history: profile.events ?? [],
    positioning: profile.positioning ?? null,
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
    positioning: profile.positioning ?? null,
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
              {s.mode === "deep" && <span className="chip chip-deep">deep sweep</span>}
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
            {s.discovery && (
              <p className="sweep-signals mono dim" title={s.discovery.note}>
                discovery pass: {s.discovery.queries} quer{s.discovery.queries === 1 ? "y" : "ies"}
                <span className="sweep-signals-note"> · {s.discovery.note}</span>
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
      <section className="panel" id="calibration">
        <h2>calibration</h2>
        <p className="dim">
          Whether the scores are honest is itself measured: every claim records its SNR at
          publication and how it later resolved. Confirmed means the claim reached SNR 4+
          independent of any whitelist floor, or a direct source landed; debunked means it lost a
          same-metric contradiction. Unresolved counts include claims still maturing and claims
          expired without a signal either way.
        </p>
        {calibrationBuckets.length === 0 ? (
          <p className="empty">// no scored claims recorded yet</p>
        ) : (
          <table className="profile">
            <thead>
              <tr>
                <th>published at</th>
                <th>claims</th>
                <th>confirmed</th>
                <th>debunked</th>
                <th>unresolved</th>
              </tr>
            </thead>
            <tbody>
              {calibrationBuckets.map((b) => (
                <tr key={b.snr}>
                  <th scope="row">SNR {b.snr}</th>
                  <td>{b.total}</td>
                  <td>
                    {b.confirmed}
                    {b.confirmed > 0 && ` (${Math.round((b.confirmed / b.total) * 100)}%)`}
                  </td>
                  <td>
                    {b.debunked}
                    {b.debunked > 0 && ` (${Math.round((b.debunked / b.total) * 100)}%)`}
                  </td>
                  <td>{b.unresolved}</td>
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
