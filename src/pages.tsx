import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// useLayoutEffect runs before the browser paints (so the masonry packs with no
// gap flash), but warns during SSR; fall back to useEffect on the server.
const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;
import type {
  Item,
  SnrTrace,
  SourcedField,
  TimelineEvent,
  ImagingMode,
  GenerationRow,
  Positioning,
  ConstellationProfile,
  SignalPerson,
  SweepLogEntry,
} from "./data/schema";
import { OrbitMini } from "./orbits/mini";
import { OrbitMini3D } from "./orbits/mini3d";
import { loadElements } from "./orbits/elements";
import { CATEGORIES, DOMAIN_TAGS, ORG_KINDS } from "./data/schema";
import registryLogos from "./data/registry-logos.json";
import { OrbitsStage } from "./orbits/stage";
import { OrbitsLinkProvider } from "./orbits/chrome";
import type { PageData, ProfileEventRef, OrgHrefs } from "./lib/page-data";
import type { RegEntry } from "./lib/reg-entries";
import { entityHrefFor, ORG_KIND_LABEL } from "./lib/reg-entries";
import { getAllItems, allItemsIfLoaded } from "./lib/loaders";

// Per-page prop data: each page renders from its own PageData variant.
type DataFor<P extends PageData["page"]> = Extract<PageData, { page: P }>;

// -------------------------------------------------------- registry logos

const LOGO_BY_SLUG: Record<
  string,
  { file: string; origin: string; license?: string; author?: string | null }
> = (
  registryLogos as {
    logos: Record<string, { file: string; origin: string; license?: string; author?: string | null }>;
  }
).logos;

/**
 * Attribution line for Creative Commons logo marks (Wikimedia Commons,
 * reviewed per file in logo-approvals.json). Public-domain marks and
 * own-site favicons render nothing; CC licenses require the credit.
 */
function LogoCredit({ slug }: { slug: string }) {
  const logo = LOGO_BY_SLUG[slug];
  if (!logo?.license || !logo.license.startsWith("CC")) return null;
  return (
    <p className="dim logo-credit">
      logo: {logo.author ? `${logo.author}, ` : ""}
      <a href={logo.origin} rel="noopener">
        {logo.license}, via Wikimedia Commons
      </a>
    </p>
  );
}

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
  ["/mcc/", "mcc"],
  ["/registry/", "registry"],
  ["/signals/", "signals"],
  ["/system/", "system"],
  ["/about/", "about"],
];

/** Light/dark switch (V1.1): bracket-style control at the right end of the
 * nav. Sets data-theme="light" on <html>, persists as vesperio-theme;
 * default dark. index.html applies the saved theme before paint, so this
 * only needs to read the attribute after mount (SSR renders the dark
 * label; the effect corrects it before the user can blink). */
function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    setLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);
  const flip = () => {
    const next = !light;
    setLight(next);
    if (next) document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.setItem("vesperio-theme", next ? "light" : "dark");
    } catch {
      /* storage unavailable: the switch still works for the session */
    }
  };
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={flip}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      title={light ? "Switch to dark theme" : "Switch to light theme"}
      suppressHydrationWarning
    >
      {/* Sun / moon, drawn (Florian, 2026-07-12, third round: the font
          glyphs read as dingbats). Shows the theme the click goes TO —
          sun on night, moon on paper. The moon carries the brand mark's
          square star; the sun's rays are square-cut. currentColor, so the
          pair follows the nav's text-3 -> text-1 hover. */}
      {light ? (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path d="M14 8.53A6 6 0 1 1 7.47 2 4.67 4.67 0 0 0 14 8.53Z" fill="currentColor" />
          <rect x="11.4" y="1.6" width="2.4" height="2.4" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <circle cx="8" cy="8" r="3.1" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.3">
            <line x1="8" y1="0.9" x2="8" y2="3.1" />
            <line x1="8" y1="12.9" x2="8" y2="15.1" />
            <line x1="0.9" y1="8" x2="3.1" y2="8" />
            <line x1="12.9" y1="8" x2="15.1" y2="8" />
            <line x1="2.98" y1="2.98" x2="4.54" y2="4.54" />
            <line x1="11.46" y1="11.46" x2="13.02" y2="13.02" />
            <line x1="11.46" y1="4.54" x2="13.02" y2="2.98" />
            <line x1="2.98" y1="13.02" x2="4.54" y2="11.46" />
          </g>
        </svg>
      )}
    </button>
  );
}

/** Newsletter control in the masthead (Florian, 2026-07-11: the subscribe
 * field lives in the menu bar; 2026-07-12: badge register, same style as
 * the coffee button). Drops a compact panel under the bar carrying the
 * Buttondown form; closes on Escape or an outside click. SSR renders it
 * closed. */
function SubscribeControl() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span className="nav-subscribe" ref={rootRef}>
      <button
        type="button"
        className="nav-badge nav-badge-sub"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        SUBSCRIBE
      </button>
      {open && (
        <div className="subscribe-panel">
          <SubscribeForm />
        </div>
      )}
    </span>
  );
}

/** Shared site header. `current` marks the active section (aria-current
 * drives the volt underline); the orbits app frame reuses it so the
 * masthead holds still across every page. The wordmark's square i-dot is
 * ALWAYS LIT (brand amendment 2026-07-10): the dotless ı carries the stem
 * and the .brand-dot square carries the volt dot. */
export function Masthead({ current }: { current?: string }) {
  return (
    <header className="masthead">
      <a href="/" className="brand" aria-label="Vesperio home">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-word" aria-hidden="true">
          vesper
          <span className="brand-i">
            ı<span className="brand-dot" />
          </span>
          o
        </span>
      </a>
      <span className="brand-tag">/ NEW SPACE INTELLIGENCE</span>
      <nav className="nav">
        {NAV_LINKS.map(([href, label]) => (
          <a key={href} href={href} aria-current={label === current ? "page" : undefined}>
            {label}
          </a>
        ))}
        {/* The theme switch rides with the words; the two framed badges
            close the bar together (Florian, 2026-07-12: the glyph must not
            sit between the framed elements). */}
        <ThemeToggle />
      </nav>
      {/* The framed badges live in their own cluster so the narrow-window
          grid can seat them on the brand row while the word menu takes a
          clean full-width second row (the old single flex bar orphaned the
          coffee badge onto a third row at mid widths). */}
      <span className="nav-controls">
        <SubscribeControl />
        {/* Support button (Florian, 2026-07-11, corrected same day): FRAMED,
            never filled — accent border + accent text — at the FAR RIGHT of
            the menu. Links ko-fi.com/vesperio (Florian switched from
            Buy Me a Coffee, 2026-07-12).
            The cup glyph is drawn (Florian, 2026-07-12: a real coffee cup,
            not the ◆); on narrow windows the badge collapses to the cup. */}
        <a className="coffee-btn nav-badge nav-badge-coffee" href="https://ko-fi.com/vesperio" target="_blank" rel="noopener">
          <svg className="badge-glyph" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.1">
            <rect x="1.5" y="4.5" width="6.5" height="5.5" />
            <path d="M8 5.5h2.2v2.6H8" />
            <line x1="3.6" y1="1" x2="3.6" y2="3" />
            <line x1="5.9" y1="1" x2="5.9" y2="3" />
          </svg>
          <span className="nav-badge-label">BUY ME A COFFEE</span>
        </a>
      </span>
    </header>
  );
}

export function Layout({ children, current }: { children: ReactNode; current?: string }) {
  return (
    <div className="shell">
      <Masthead current={current} />
      <main>{children}</main>
      <footer className="footer">
        <p className="footer-mission">
          Machine-maintained. Every item links its sources and wears its signal-to-noise score.
          Missing a story is acceptable; publishing a false one as fact is not.
        </p>
        <p>
          <a href="/about/">Verification policy →</a> ·{" "}
          <a href="/about/#methodology">How the SNR score works →</a> ·{" "}
          <a href="/system/">Sweep log →</a> · <a href="/stats.json">stats.json →</a>
        </p>
        <p className="footer-feeds">
          Category feeds: <a href="/tag/eo/">EO</a> · <a href="/tag/connectivity/">Connectivity</a> ·{" "}
          <a href="/tag/iot/">IoT</a> · <a href="/tag/launch/">Launch</a>
        </p>
        <p className="footer-ident">Vesperio / new space intelligence · © 2026</p>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------- feed

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

/**
 * Company names with registry-profile links where the item's stamped
 * entities resolve them (plan Phase 7); plain text otherwise. Used on
 * cards (inside the clickable article, so links stop propagation) and
 * item pages.
 */
function CompanyLinks({ item, sep = " · " }: { item: Item; sep?: string }) {
  const refFor = (name: string) => item.entities?.find((e) => e.name === name)?.ref;
  return (
    <>
      {item.companies.map((name, i) => {
        const ref = refFor(name);
        return (
          <span key={name + i}>
            {i > 0 && sep}
            {ref ? (
              <a className="company-link" href={`/registry/${ref}/`} onClick={(e) => e.stopPropagation()}>
                {name}
              </a>
            ) : (
              name
            )}
          </span>
        );
      })}
    </>
  );
}

/**
 * The two axes fused into the integer (C3.2, Admiralty-style): what the
 * lead source is worth on its own, and what the corroboration record
 * added or cost. Rendered as summary lines above the per-step rows; the
 * displayed score stays the fused integer.
 */
const CORROBORATION_MODIFIERS = new Set([
  "corroboration_2plus",
  "corroboration_4plus",
  "mainstream_pickup",
  "corroboration_none",
  "reinforcement",
]);

function SnrAxes({ trace }: { trace: SnrTrace }) {
  const corr = trace.modifiers.filter((m) => CORROBORATION_MODIFIERS.has(m.type));
  const sum = corr.reduce((n, m) => n + m.delta, 0);
  const corrText =
    corr.length === 0
      ? "not tested yet"
      : `${signed(sum)} earned from ${corr.length} rule${corr.length === 1 ? "" : "s"}`;
  return (
    <span className="snr-pop-axes">
      <span className="snr-pop-row">
        <span className="snr-pop-delta">src</span>
        <span>Lead source: tier {trace.base.tier} of 5 on its own</span>
      </span>
      <span className="snr-pop-row">
        <span className="snr-pop-delta">cor</span>
        <span>Corroboration: {corrText}</span>
      </span>
      {trace.single_class_corroboration && (
        <span className="snr-pop-row">
          <span className="snr-pop-delta">mix</span>
          <span>All corroboration is one source class ({trace.single_class_corroboration})</span>
        </span>
      )}
    </span>
  );
}

/** The stored calculation, one row per step; shared by popover and panel. */
function SnrTraceRows({ trace, condensed = false }: { trace: SnrTrace; condensed?: boolean }) {
  return (
    <>
      <SnrAxes trace={trace} />
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
          <span className={`snr-pop-delta ${m.delta > 0 ? "delta-pos" : m.delta < 0 ? "delta-neg" : "delta-zero"}`}>{signed(m.delta)}</span>
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
      <span className="snr-pop-foot">
        Scorer v{trace.scorer_version} ·{" "}
        <a href="/about/#methodology" onClick={(e) => e.stopPropagation()}>
          how scores work
        </a>
      </span>
    </>
  );
}

/** Item-detail scoring readout (Florian redesign, 2026-07-12): an
    instrument ledger. Hero row (LEDs + verdict left, display numeral
    right), an axes strip, the calculation as an accounting ledger with
    the deltas on one right-aligned gutter, a sum row, and a footer.
    The hover popover keeps its own compact renderer (SnrTraceRows). */
function SnrLedger({ item }: { item: Item }) {
  const trace = item.snr_trace;
  const corr = trace.modifiers.filter((m) => CORROBORATION_MODIFIERS.has(m.type));
  const corrSum = corr.reduce((n, m) => n + m.delta, 0);
  const history = trace.history ?? [];
  return (
    <div className="snrl">
      <div className="snrl-hero">
        <div className="snrl-hero-left">
          <SnrLed snr={item.snr} />
          <span className="snrl-word">
            {SNR_WORDS[item.snr]}
            {item.disputed && <span className="chip chip-disputed">disputed</span>}
            {item.kind === "commentary" && <span className="chip chip-commentary">commentary</span>}
          </span>
        </div>
        <div className="snrl-hero-num" aria-label={`SNR ${item.snr} of 5`}>
          <span className="snrl-num">{item.snr}</span>
          <span className="snrl-den">/5</span>
        </div>
      </div>
      <div className="snrl-grid snrl-axes">
        <span className="snrl-tag">lead</span>
        <span>tier {trace.base.tier} of 5 on its own</span>
        <span className="snrl-tag">corrob</span>
        <span>
          {corr.length === 0
            ? "not tested yet"
            : `${signed(corrSum)} earned from ${corr.length} rule${corr.length === 1 ? "" : "s"}`}
        </span>
        {trace.single_class_corroboration && (
          <>
            <span className="snrl-tag">mix</span>
            <span>one source class ({trace.single_class_corroboration})</span>
          </>
        )}
      </div>
      <div className="snrl-label">calculation</div>
      <div className="snrl-grid snrl-ledger">
        <span className="snrl-delta">{trace.base.tier}</span>
        <span>
          {trace.base.reason}{" "}
          <a href={trace.base.source} rel="noopener">
            {hostOf(trace.base.source)}
          </a>
        </span>
        {trace.modifiers.map((m, i) => (
          <Fragment key={i}>
            <span className={`snrl-delta ${m.delta > 0 ? "delta-pos" : m.delta < 0 ? "delta-neg" : "delta-zero"}`}>{signed(m.delta)}</span>
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
          </Fragment>
        ))}
      </div>
      <div className="snrl-grid snrl-sum">
        <span className="snrl-delta">= {trace.final ?? item.snr}</span>
        <span>current score, recomputed by the engine on every change</span>
      </div>
      {history.length > 0 && (
        <>
          <div className="snrl-label">movements</div>
          <div className="snrl-grid snrl-ledger">
            {history.map((h, i) => (
              <Fragment key={i}>
                <span className="snrl-delta">
                  {h.from}&rarr;{h.to}
                </span>
                <span>
                  {h.date} · {h.reason}
                </span>
              </Fragment>
            ))}
          </div>
        </>
      )}
      <div className="snrl-foot">
        <span>scorer v{trace.scorer_version}</span>
        <a href="/about/#methodology">how scores work &rarr;</a>
      </div>
    </div>
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
 * Hover popover shared by the card SNR mark and the impact badge: a
 * fixed-positioned condensed panel that escapes the card's overflow. The
 * close is a 250ms timer, cancelled when the pointer enters the panel or
 * returns to the trigger, so the gap between trigger and panel is
 * crossable (the panel's link was unclickable before, 2026-07-11). The
 * caller wires `show` on the trigger's mouseenter and `scheduleHide` on
 * its mouseleave, and the same pair (cancelHide/scheduleHide) on the
 * panel element. `show` positions the panel flush at the trigger edge
 * (no spatial gap); the panel carries its own transparent hover bridge
 * as top padding (.snr-pop-card). estHeight only steers the up/down flip.
 */
function useHoverPopover(width: number) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHide = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const scheduleHide = () => {
    cancelHide();
    timer.current = setTimeout(() => setHover(false), 250);
  };
  useEffect(() => cancelHide, []);
  const show = (anchor?: HTMLElement | null, estHeight = 300) => {
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      const flipUp = r.bottom + estHeight > window.innerHeight;
      setPos({
        top: flipUp ? Math.max(8, r.top - estHeight) : r.bottom,
        left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      });
    }
    cancelHide();
    setHover(true);
  };
  const hideNow = () => {
    cancelHide();
    setHover(false);
  };
  return { hover, pos, show, scheduleHide, cancelHide, hideNow };
}

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
  const pop = useHoverPopover(304);
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
  const showPop = interactive && (onCard ? pop.hover : open || pop.hover);
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
                const bezel = rootRef.current?.querySelector(".snr-led-bezel") as HTMLElement | null;
                pop.show(bezel, 300);
              } else {
                pop.show();
              }
            }
          : undefined
      }
      onMouseLeave={interactive ? () => (onCard ? pop.scheduleHide() : pop.hideNow()) : undefined}
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
            onCard && pop.pos
              ? { position: "fixed", top: pop.pos.top, left: pop.pos.left }
              : undefined
          }
          {...(onCard ? { onMouseEnter: pop.cancelHide, onMouseLeave: pop.scheduleHide } : {})}
        >
          <span className="snr-pop-head">
            <span>
              SNR {v}/5 · {word}
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
  // No thumbnail: no media block at all (Florian 2026-07-10, rule 57 —
  // the generated text tile is retired; the card is text-only).
  return null;
}

/** The four importance tiers and their one-line reads (CLAUDE.md's impact
    scale, condensed). Order is high to low; the popover marks the item's
    own tier and mutes the rest. */
const IMPACT_TIERS: Array<[string, string]> = [
  ["seismic", "Reshapes competitive dynamics"],
  ["major", "A commercial director acts on it the same day"],
  ["notable", "Worth the morning read"],
  ["noise", "Logged for the record, not pushed"],
];

/**
 * The impact badge with a condensed hover popover (same mechanics as the
 * card SNR mark, useHoverPopover): the four importance tiers listed, the
 * item's own tier shown as its real badge and the rest muted. `variant`
 * preserves the badge's existing look — a .chip on cards, .band-impact on
 * item/modal bands. Importance and confidence are independent axes, so
 * this popover never touches the SNR mark; it points at /about/#impact.
 */
function ImpactBadge({ impact, variant }: { impact: string; variant: "chip" | "band" }) {
  const pop = useHoverPopover(304);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const badgeClass = variant === "chip" ? `chip chip-${impact}` : "band-impact";
  return (
    <span
      className="impact-badge"
      onMouseEnter={() => pop.show(anchorRef.current, 180)}
      onMouseLeave={pop.scheduleHide}
    >
      <span ref={anchorRef} className={badgeClass}>
        {impact}
      </span>
      {pop.hover && (
        <span
          className="snr-pop snr-pop-card impact-pop"
          role="dialog"
          aria-label="Impact tiers"
          style={pop.pos ? { position: "fixed", top: pop.pos.top, left: pop.pos.left } : undefined}
          onMouseEnter={pop.cancelHide}
          onMouseLeave={pop.scheduleHide}
        >
          <span className="snr-pop-head">
            <span>importance</span>
          </span>
          {IMPACT_TIERS.map(([tier, desc]) => {
            const self = tier === impact;
            return (
              <span key={tier} className="snr-pop-row impact-row">
                <span className="impact-pop-tier">
                  {self ? (
                    <span className={`chip chip-${tier}`}>{tier}</span>
                  ) : (
                    <span className="impact-tier-muted">{tier}</span>
                  )}
                </span>
                <span className={self ? "impact-desc-self" : "impact-desc-muted"}>{desc}</span>
              </span>
            );
          })}
          <span className="snr-pop-foot">
            Importance and confidence are independent axes.{" "}
            <a href="/about/#impact" onClick={(e) => e.stopPropagation()}>
              What the tiers mean
            </a>
          </span>
        </span>
      )}
    </span>
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
        <ImpactBadge impact={item.impact} variant="chip" />
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
        {item.companies.length > 0 ? (
          <>
            <span className="card-foot-div" aria-hidden="true" />
            <span className="card-companies" title={item.companies.join(" · ")}>
              <CompanyLinks item={item} />
            </span>
          </>
        ) : (
          // No companies. The actor belongs in item.companies even when
          // untracked (Florian, 2026-07-11) — an empty array is legitimate
          // only when the story truly names no actor (e.g. debris with no
          // operator identified). Then the slot shows the item's domain,
          // one muted word, never a dead gap.
          (() => {
            const domain = item.tags.find((t) => (DOMAIN_TAGS as readonly string[]).includes(t));
            return domain ? (
              <span className="card-companies">{domain.replace(/-/g, " ").toUpperCase()}</span>
            ) : null;
          })()
        )}
        <a className="card-details" href={`/item/${item.id}/`}>
          {sources} source{sources === 1 ? "" : "s"} →
        </a>
      </div>
    </article>
  );
}

// ------------------------------------------------------ sweep countdown

/** News sweep schedule, UTC hours. The workflow cron actually fires at
    minute 15 ("15 5,17 * * *", the anti-pile-up offset; keep in sync by
    hand, the workflow file is not readable from the client) but the clock
    deliberately displays the NOMINAL top-of-hour schedule (Florian,
    2026-07-12: the offset is plumbing, not a promise). HOLD_GRACE below
    absorbs the offset plus a normal run before the clock cries late. */
const SWEEP_UTC_HOURS = [5, 17];
/** Offset (15m) + agent run (~20m) + Pages deploy (~2m) + margin. HOLD
    now means "genuinely overdue", not "the deliberate off-minute cron is
    doing its normal work". */
const HOLD_GRACE_MS = 45 * 60_000;

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
  // Optical ink centering (DESIGN_TUNING_LOG round 12): a leading 7-seg
  // "1" lights only its right segments, leaving 22px of dark cell at
  // 45px; the grid shifts left by half that so the INK centers. The
  // class changes only when the leading digit does (at most hourly).
  const lead1 = value.startsWith("1") ? " lcd-lead-1" : "";
  return (
    <span className={`sweep-lcd${lead1}`}>
      <span className="sweep-lcd-ghost" aria-hidden="true">
        {value.replace(/[0-9-]/g, "8")}
      </span>
      {/* The digits tick every second; the aside's aria-label (derived from
          minutes, not seconds) carries the accessible announcement instead
          of this text, so it doesn't get read out on every tick. */}
      <span className="sweep-lcd-lit" aria-hidden="true">
        {value}
      </span>
    </span>
  );
}

/** One face of the sweep instrument: corner labels + centered LCD. The
    stage renders it twice — base (black ground, volt digits) and flood
    overlay (volt ground, black digits) — so the seam cuts through
    identical content. */
function SweepFace({
  digits,
  schedule,
  hold,
}: {
  digits: string;
  schedule: { last: string | null; next: string | null; local: string | null };
  /** Scheduler-late state (Florian, 2026-07-12): the slot passed but the
      deployed data predates it. Null when the countdown is nominal. */
  hold: { heldFor: string } | null;
}) {
  return (
    <div className="sweep-layer">
      <span className="sweep-lab">{hold ? "SWEEP WINDOW REACHED" : "T-MINUS NEXT SWEEP"}</span>
      {hold ? (
        <span className="sweep-armed sweep-hold">
          <span className="hold-dot">●</span> HOLD
        </span>
      ) : (
        <span className="sweep-armed">● ARMED</span>
      )}
      <div className="sweep-mid">
        <SweepLcd value={digits} />
      </div>
      {/* The schedule line lives ON the instrument (rule 55): rendered in
          both face copies so the flood clips and re-inks it like every
          other on-stage label. */}
      <span className="sweep-lab sweep-sched">
        {schedule.last && <span>LAST {schedule.last}</span>}
        <span>SWEEPS EVERY 12H</span>
        {hold ? (
          <span>SCHEDULER LATE · HOLDING {hold.heldFor}</span>
        ) : (
          schedule.next && (
            <span>
              NEXT {schedule.next} · {schedule.local} LOCAL
            </span>
          )
        )}
      </span>
    </div>
  );
}

/** First slot of the news feed, V1.1 flood-fill instrument ("options 4a"):
    the whole card face is the countdown. A volt flood advances left→right
    as the 12h sweep window elapses; the ~30° seam (lean ±31px over the
    86px stage) cuts through the doubled content, and the .85s linear
    clip-path transition glides it between ticks. Renders a placeholder
    until mounted so SSR and hydration agree; ticking never changes the
    card's height, so the masonry stays put. */
function SweepCountdownCard({ lastSweepAt }: { lastSweepAt: string | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const WINDOW_S = 12 * 3600;
  let digits = "--:--:--";
  let last = "";
  let next = "";
  let local = "";
  let elapsedPct = 0;
  let hold: { heldFor: string } | null = null;
  // Human-readable stand-in for the ticking digits (which are aria-hidden):
  // derived from minutes, not seconds, so the string is only ever the same
  // 59 seconds out of 60 and React only touches the DOM attribute on the
  // minute rollover, not once a second. Long waits speak hours and minutes
  // ("7 hours 47 minutes", Florian 2026-07-13), never "467 minutes".
  const fmtMinutes = (m: number): string => {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    const hours = `${h} hour${h === 1 ? "" : "s"}`;
    const minutes = `${rest} minute${rest === 1 ? "" : "s"}`;
    if (h === 0) return minutes;
    return rest === 0 ? hours : `${hours} ${minutes}`;
  };
  let ariaLabel = "Time until the next news sweep";
  if (now) {
    const fmtZ = (d: Date) =>
      `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}Z`;
    // HOLD (Florian, 2026-07-12): the slot the DEPLOYED data should
    // already cover has passed by more than HOLD_GRACE_MS, so the
    // countdown freezes at zero and says so, instead of silently
    // re-arming for the next slot. Clears itself: the sweep commit
    // redeploys the site with a fresh lastSweepAt. ?hold=1 forces the
    // state for design review (the ?tune=1 pattern).
    const dueSlot = lastSweepAt ? nextSweepAfter(new Date(lastSweepAt)) : null;
    const forced =
      typeof window !== "undefined" && new URLSearchParams(window.location.search).get("hold") === "1";
    const heldMs = dueSlot ? now.getTime() - dueSlot.getTime() : 0;
    if (forced || (dueSlot && heldMs > HOLD_GRACE_MS)) {
      const mins = forced ? 41 : Math.floor(heldMs / 60000);
      hold = { heldFor: mins < 100 ? `+${mins}M` : `+${Math.round(mins / 60)}H` };
      digits = "00:00:00";
      elapsedPct = 100;
      last = lastSweepAt ? fmtZ(new Date(lastSweepAt)) : "";
      ariaLabel = `Sweep window reached, running ${fmtMinutes(mins)} late`;
    } else if (dueSlot && heldMs > 0) {
      // Grace window: the off-minute cron and a normal run are doing
      // their work. Freeze at zero without the HOLD lamp; the sweep
      // commit redeploys and re-arms the countdown. Without this branch
      // the clock re-armed to the NEXT slot (a 12h jump) and then
      // flipped back to HOLD if the scheduler was genuinely late.
      digits = "00:00:00";
      elapsedPct = 100;
      last = lastSweepAt ? fmtZ(new Date(lastSweepAt)) : "";
      next = fmtZ(dueSlot);
      local = dueSlot.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      ariaLabel = "Sweep window reached";
    } else {
      const target = nextSweepAfter(now);
      const s = Math.max(0, Math.round((target.getTime() - now.getTime()) / 1000));
      digits = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
        .map((n) => String(n).padStart(2, "0"))
        .join(":");
      elapsedPct = (1 - Math.min(s, WINDOW_S) / WINDOW_S) * 100;
      // LAST shows the actual last sweep when the data carries one, the
      // schedule fiction only as fallback (pre-hold-signal behavior).
      last = lastSweepAt ? fmtZ(new Date(lastSweepAt)) : fmtZ(new Date(target.getTime() - WINDOW_S * 1000));
      next = fmtZ(target);
      local = target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      const minsLeft = Math.max(0, Math.ceil(s / 60));
      ariaLabel = `Next sweep in ${fmtMinutes(minsLeft)}`;
    }
  }
  const p = `${elapsedPct.toFixed(2)}%`;
  return (
    <aside className="sweep-card" role="timer" aria-label={ariaLabel}>
      {/* The clock is the door to the sweep log (rule 54): the negative
          hover announces a real destination, like every card. */}
      <a className="sweep-link" href="/system/" aria-label="Open the sweep log">
      <div className="sweep-stage">
        <SweepFace digits={digits} schedule={{ last, next, local }} hold={hold} />
        <div
          className="sweep-flood"
          aria-hidden="true"
          style={{
            clipPath: `polygon(0 0, calc(${p} + 31px) 0, calc(${p} - 31px) 100%, 0 100%)`,
          }}
        >
          <SweepFace digits={digits} schedule={{ last, next, local }} hold={hold} />
        </div>
      </div>
      </a>
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
      // Clearing every pin collapses the grid for one layout pass; deep in
      // the feed the browser clamps the scroll position to the shortened
      // document and the reader lands hundreds of cards up (Florian,
      // 2026-07-12: infinite-scroll batches "jump back up"). Capture and
      // restore around the repack.
      const y = window.scrollY;
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
        // The sweep clock is a fixed-height instrument and is never
        // PINNED (2026-07-10: stale pins clipped its schedule row twice
        // across live height tunings) — its span reserves the rows and
        // the natural height can then never be cut. Ordinary cards keep
        // the pin (it absorbs sub-pixels into the footer slack).
        if (!c.classList.contains("sweep-card")) c.style.height = `${h}px`;
        c.style.gridRowEnd = `span ${h - 1}`;
      });
      if (window.scrollY !== y) window.scrollTo(0, y);
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
    for (const c of Array.from(grid.children)) {
      ro.observe(c);
      // pack() pins each card with an inline height, so the card's own
      // box can never fire the observer when its CONTENT grows (the
      // sweep clock's stage growing under HMR clipped its schedule row,
      // 2026-07-10). Observe the card's direct children too: content
      // growth fires there, and re-packing re-measures the true height.
      for (const k of Array.from(c.children)) ro.observe(k);
    }
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

  // Fall back to the full corpus so the modal survives filter changes, but
  // only if it is already loaded (the home search fetches it); never block
  // the modal on a fetch. A miss just renders from the current list.
  const openItem = openId
    ? (list.find((i) => i.id === openId) ??
        allItemsIfLoaded()?.find((i) => i.id === openId) ??
        null)
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

/** Focusable descendants of a container, in DOM (tab) order, restricted to
    elements actually reachable by keyboard (visible, not disabled, not
    explicitly removed from the tab order). Used to trap Tab inside a modal. */
function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  // getClientRects() catches display:none and detached nodes without the
  // offsetParent pitfall (offsetParent is null for position:fixed elements
  // even when they're visible, which this modal can legitimately use).
  return Array.from(nodes).filter((el) => el.getClientRects().length > 0);
}

/** In-feed item overlay: band with impact and SNR, media and sources
    left, explainer right. Esc, the close button, and the backdrop all
    close it; the full prerendered page stays one click away. Follows the
    WAI-ARIA dialog pattern: focus moves into the dialog on open, Tab/
    Shift+Tab are trapped among its own focusable elements, and focus
    returns to whatever triggered the open once it closes. */
function ItemModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Move focus in on mount, restore it on unmount. Empty deps: this is the
  // open/close lifecycle, not a reaction to `item` changing while the modal
  // stays mounted (e.g. history back/forward between two open items), which
  // intentionally leaves focus wherever the reader put it.
  useEffect(() => {
    triggerRef.current = document.activeElement;
    closeBtnRef.current?.focus();
    return () => {
      const el = triggerRef.current;
      if (el instanceof HTMLElement) el.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        // Nothing to tab to: keep focus pinned on the dialog itself rather
        // than letting it leak out to the page behind the backdrop.
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
      // Every Tab press is handled explicitly (never left to native tab
      // order) so the trap holds regardless of what else is in the page's
      // DOM order around the modal.
      e.preventDefault();
      if (e.shiftKey) {
        (activeIndex <= 0 ? last : focusable[activeIndex - 1]!).focus();
      } else {
        (activeIndex === -1 || activeIndex === focusable.length - 1 ? first : focusable[activeIndex + 1]!).focus();
      }
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
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`modal-band modal-band-${item.impact}`}>
          <SnrLed snr={item.snr} trace={item.snr_trace} />
          <ImpactBadge impact={item.impact} variant="band" />
          <a className="chip" href={`/news/${item.category}/`}>
            {item.category}
          </a>
          {item.disputed && <span className="chip chip-disputed">disputed</span>}
        {item.kind === "commentary" && <span className="chip chip-commentary">commentary</span>}
          <span className="date">{item.date}</span>
          <button type="button" className="modal-close" ref={closeBtnRef} onClick={onClose}>
            × esc
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-left">
            {/* Title module leads the LEFT column, above the artwork
                (Florian, 2026-07-12, round 3). */}
            <h2 className="modal-title">{item.headline}</h2>
            <p className="actor">{item.companies.length > 0 ? <CompanyLinks item={item} /> : item.category}</p>
            <p className="tagline-acc">{item.explainer.tagline}</p>
            {item.image ? (
              <>
                <div className={`modal-media${item.image.fit === "contain" ? " media-contain" : ""}`}>
                  <img src={item.image.src} alt="" />
                </div>
                <p className="modal-credit">
                  <a href={item.image.origin_url} rel="noopener">
                    {item.image.credit}
                  </a>
                </p>
              </>
            ) : null}
            <div className="src-band">
              // sources · {srcEntriesOf(item).length} attached
            </div>
            <SourceList item={item} />
          </div>
          <div className="modal-right">
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
              <SnrLedger item={item} />
            </section>
            <div className="tag-row">
              {item.tags.map((t) => (
                <a key={t} className="chip chip-tag" href={`/tag/${t}/`}>
                  #{t}
                </a>
              ))}
            </div>
            <p>
              <a href={`/item/${item.id}/`}>FULL PAGE →</a>
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

/** Foot-of-feed pager (deep archive nav): plain mono links, current page
 * as plain text. Page 1 is the home feed at "/". */
function Pager({ current, pageCount }: { current: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const hrefFor = (n: number) => (n === 1 ? "/" : `/feed/${n}/`);
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  return (
    <nav className="feed-pager mono" aria-label="Feed pages">
      {current > 1 ? (
        <a className="feed-pager-link" href={hrefFor(current - 1)}>
          &larr; prev
        </a>
      ) : (
        <span className="feed-pager-end dim">&larr; prev</span>
      )}
      <span className="feed-pager-nums">
        {pages.map((n) =>
          n === current ? (
            <span key={n} className="feed-pager-cur" aria-current="page">
              {n}
            </span>
          ) : (
            <a key={n} className="feed-pager-link" href={hrefFor(n)}>
              {n}
            </a>
          ),
        )}
      </span>
      {current < pageCount ? (
        <a className="feed-pager-link" href={hrefFor(current + 1)}>
          next &rarr;
        </a>
      ) : (
        <span className="feed-pager-end dim">next &rarr;</span>
      )}
    </nav>
  );
}

/** Items appended per IntersectionObserver step on the home feed (the
    first batch is the prerendered page-1 slice; see HomePage). */
const FEED_BATCH = 30;

export function HomePage({ data }: { data: DataFor<"home"> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FeedFilter>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // The full corpus, fetched lazily on the first filter/search interaction
  // OR when the reader scrolls past the first page; null until it resolves,
  // so we filter over the page-1 slice until then.
  const [corpus, setCorpus] = useState<Item[] | null>(null);
  // Progressive rendering: SSR and the first client render both emit the
  // deterministic page-1 batch (data.items.length, keeps hydration stable);
  // an IntersectionObserver sentinel then appends BATCH more until every
  // item matching the active filter is shown. loadCorpus arms the corpus
  // fetch from a scroll (the filter/search path arms it via `active`).
  const [visible, setVisible] = useState(data.items.length);
  const [loadCorpus, setLoadCorpus] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
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
  const active = q !== "" || filter !== null;

  // On the first filter/search OR the first scroll past page 1, load the
  // full corpus so search/filter/scroll cover every item, not just the
  // prerendered first page. getAllItems caches.
  useEffect(() => {
    if ((!active && !loadCorpus) || corpus !== null) return;
    let live = true;
    void getAllItems()
      .then((all) => {
        if (live) setCorpus(all);
      })
      .catch(() => {
        /* offline: keep filtering the page-1 slice */
      });
    return () => {
      live = false;
    };
  }, [active, loadCorpus, corpus]);

  // Base corpus to filter: the full set once loaded, else the page-1 slice.
  const base = corpus ?? data.items;
  const shown = useMemo(() => {
    let list = base;
    if (filter?.kind === "cat") list = list.filter((i) => i.category === filter.value);
    if (filter?.kind === "tag") list = list.filter((i) => i.tags.includes(filter.value));
    return q === "" ? list : list.filter((i) => matchesQuery(i, q));
  }, [q, filter, base]);

  // The batch actually rendered, and whether more remain. Two ways to have
  // more: reveal already-loaded items (canRenderMore), or fetch the rest of
  // the corpus first (canFetchMore, only on the un-filtered home before the
  // corpus is in). hasMore drives the sentinel; it is deterministic at SSR
  // (corpus null, visible = page size), so first client render matches.
  const visibleList = useMemo(() => shown.slice(0, visible), [shown, visible]);
  const canRenderMore = visibleList.length < shown.length;
  const canFetchMore = corpus === null && !active && data.counts.total > data.items.length;
  const hasMore = canRenderMore || canFetchMore;

  // A new filter/search restarts batching from the first page.
  useEffect(() => {
    setVisible(data.items.length);
  }, [q, filter, data.items.length]);

  // Append the next batch as the sentinel nears the viewport; arm the corpus
  // fetch the first time we run out of already-loaded items. The observer is
  // rebuilt when the branch flags change so its closure stays current (e.g.
  // canRenderMore flips true once the corpus lands, resuming the reveal).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (canFetchMore) setLoadCorpus(true);
        if (canRenderMore) setVisible((v) => v + FEED_BATCH);
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, canFetchMore, canRenderMore]);

  // Counts come precomputed over the FULL corpus (from the page slice).
  const catCounts = useMemo(
    () => new Map(Object.entries(data.counts.categories)),
    [data.counts.categories],
  );
  const domainCounts = useMemo(
    () => new Map(Object.entries(data.counts.domains)),
    [data.counts.domains],
  );

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
      <h1 className="sr-only">Vesperio: new space intelligence</h1>
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
          placeholder="/ SEARCH"
          aria-label="Search items"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="filter-tally mono">
          {visibleList.length} / {active ? base.length : data.counts.total}
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
                all <span className="count">{data.counts.total}</span>
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
      {active && shown.length === 0 ? (
        <p className="empty">No items match: adjust filters</p>
      ) : (
        <FeedList
          list={visibleList}
          emptyNote="No items yet. The first sweep has not run."
          lead={<SweepCountdownCard lastSweepAt={data.lastSweepAt} />}
        />
      )}
      {hasMore && <div ref={sentinelRef} className="feed-sentinel" aria-hidden="true" />}
      {!active && <Pager current={1} pageCount={data.pageCount} />}
    </Layout>
  );
}

/** Deep-archive feed page: the card grid and pager, no filter bar or search. */
export function FeedPagePage({ data }: { data: DataFor<"feed-page"> }) {
  return (
    <Layout current="news">
      <h1 className="page-title sec-mark">feed · page {data.n}</h1>
      <FeedList list={data.items} emptyNote="No items on this page." />
      <Pager current={data.n} pageCount={data.pageCount} />
    </Layout>
  );
}

export function CategoryPage({ data }: { data: DataFor<"category"> }) {
  return (
    <Layout current="news">
      <h1 className="page-title">news / {data.category}</h1>
      <FeedList list={data.items} emptyNote={`No ${data.category} items tracked yet.`} />
      <p>
        <a href="/">All news</a>
      </p>
    </Layout>
  );
}

export function KindPage({ data }: { data: DataFor<"kind"> }) {
  return (
    <Layout current="news">
      <h1 className="page-title">news / {data.kind}</h1>
      <p className="lede">
        Takes and analysis from named voices, visibly tagged. The SNR scores the attribution
        (this person said this), never the opinion. Commentary never feeds the Registry.
      </p>
      <FeedList list={data.items} emptyNote="No commentary tracked yet." />
      <p>
        <a href="/">All news</a>
      </p>
    </Layout>
  );
}

export function TagPage({ data }: { data: DataFor<"tag"> }) {
  return (
    <Layout current="news">
      <h1 className="page-title">#{data.tag}</h1>
      <FeedList list={data.items} emptyNote={`No ${data.tag} items tracked yet.`} />
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
          <ImpactBadge impact={item.impact} variant="band" />
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
            {/* Title module leads the LEFT column, above the artwork
                (Florian, 2026-07-12, round 3). */}
            <h1 className="page-title item-side-title">{item.headline}</h1>
            <p className="actor">{item.companies.length > 0 ? <CompanyLinks item={item} /> : item.category}</p>
            <p className="tagline-acc">{item.explainer.tagline}</p>
            {item.image && (
              <figure className="item-figure">
                <div className={`item-figure-media${item.image.fit === "contain" ? " media-contain" : ""}`}>
                  <img src={item.image.src} alt="" />
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
            <section className="panel">
              <h2>what happened</h2>
              <p className="prose">{item.explainer.what_happened}</p>
            </section>
            <section className="panel">
              <h2>why it matters</h2>
              <p className="prose">{item.explainer.why_it_matters}</p>
            </section>
            {item.explainer.for_who && (
              <section className="panel">
                <h2>for who</h2>
                <p>{item.explainer.for_who}</p>
              </section>
            )}
            <section className="panel">
              <h2>signal-to-noise</h2>
              <SnrLedger item={item} />
            </section>
            <section className="panel">
              <h2>quick facts</h2>
              <dl className="kv">
                <dt>Companies</dt>
                <dd>{item.companies.length > 0 ? <CompanyLinks item={item} sep=", " /> : "none listed"}</dd>
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
              <a href="/">BACK TO THE FEED</a>
            </p>
          </div>
        </div>
      </article>
    </Layout>
  );
}

// --------------------------------------------------------------- registry
// canonicalName/entityHrefFor and the RegEntry builders now live in
// lib/reg-entries (server-side, over the full dataset); entityHrefFor takes
// the page's data.orgHrefs map. Alias/org-href maps are no longer built here.

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

type ProfileRow = [string, SourcedField<unknown>] | [string, SourcedField<unknown>, "computed"];

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

// RegEntry/RegSpec types and the constellation/vehicle/spaceport/org entry
// builders now live in lib/reg-entries (run server-side over the full
// dataset; the client receives the built data.entries.* arrays). Only the
// render-side labels and predicates remain here.

const KIND_LABEL: Record<string, string> = {
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

/** Status strings are free text; treat these phrasings as operational. */
function isOperational(status: string | null): boolean {
  return status !== null && /oper|active|in service|in operation|commercial|deployed|widespread|in use/i.test(status);
}
function isRetired(status: string | null): boolean {
  return status !== null && /retired/i.test(status);
}

/**
 * A section-scoped filter chip: a labelled predicate. Each section derives its
 * own chip set from its own entries (so no chip is ever dead) and holds its own
 * active-chip state, so a filter in one section can never empty another.
 */
interface RegFilterDef {
  id: string;
  label: string;
  test: (e: RegEntry) => boolean;
}

function constellationFilters(entries: RegEntry[]): RegFilterDef[] {
  const defs: RegFilterDef[] = [];
  for (const k of ["eo", "connectivity", "iot"] as const)
    if (entries.some((e) => e.kind === k))
      defs.push({ id: `domain:${k}`, label: k, test: (e) => e.kind === k });
  for (const m of ["sar", "optical", "hyperspectral", "rf"])
    if (entries.some((e) => e.sensors.includes(m)))
      defs.push({ id: `mod:${m}`, label: m, test: (e) => e.sensors.includes(m) });
  if (entries.some((e) => isOperational(e.status)))
    defs.push({ id: "status:op", label: "operational", test: (e) => isOperational(e.status) });
  return defs;
}

function vehicleFilters(entries: RegEntry[]): RegFilterDef[] {
  const defs: RegFilterDef[] = [];
  for (const c of ["super-heavy", "heavy-lift", "medium-lift", "small-lift"])
    if (entries.some((e) => e.vehicleClass === c))
      defs.push({ id: `class:${c}`, label: c, test: (e) => e.vehicleClass === c });
  if (entries.some((e) => e.reusable === true))
    defs.push({ id: "reusable", label: "reusable", test: (e) => e.reusable === true });
  if (entries.some((e) => isOperational(e.status)))
    defs.push({ id: "status:op", label: "operational", test: (e) => isOperational(e.status) });
  if (entries.some((e) => isRetired(e.status)))
    defs.push({ id: "status:retired", label: "retired", test: (e) => isRetired(e.status) });
  return defs;
}

function spaceportFilters(entries: RegEntry[]): RegFilterDef[] {
  const defs: RegFilterDef[] = [];
  for (const r of Object.keys(REGION_LABEL))
    if (entries.some((e) => e.group === r))
      defs.push({ id: `region:${r}`, label: REGION_LABEL[r], test: (e) => e.group === r });
  if (entries.some((e) => isOperational(e.status)))
    defs.push({ id: "status:op", label: "operational", test: (e) => isOperational(e.status) });
  return defs;
}

function orgFilters(entries: RegEntry[]): RegFilterDef[] {
  const defs: RegFilterDef[] = [];
  for (const k of ORG_KINDS)
    if (entries.some((e) => e.group === k))
      defs.push({ id: `kind:${k}`, label: ORG_KIND_LABEL[k] ?? k, test: (e) => e.group === k });
  return defs;
}

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

/**
 * Status badge descriptor: the normalized label plus an optional role-color
 * glyph (governed mode: the glyph carries the color, ≤12px, never the text).
 * Maps only statuses the data actually carries; anything else shows text-only
 * or, when too long/absent, no badge at all.
 */
function statusBadge(status: string | null): { text: string; glyph: "live" | "state" | null } | null {
  if (isOperational(status)) return { text: "operational", glyph: "live" };
  if (!status || status.length > 24) return null;
  // Display casing is normalized here, at render, only: the underlying data
  // keeps whatever casing the source used ("Active" / "active" / "In
  // Development"), this just lowercases the chip text so drift doesn't show.
  // Distinct words (e.g. "active" vs "operational") are never merged.
  const s = status.toLowerCase();
  if (/plan|develop|deploy|early deployment|manufactur|engineering/.test(s))
    return { text: s, glyph: "state" };
  return { text: s, glyph: null };
}

/**
 * Hero-spec accents (Florian's ruling, 2026-07-11; DESIGN_TUNING_LOG rule 63):
 * registry CARD SPEC VALUES ONLY may carry role color, an explicit exception
 * to the "no role color on counts" default. Scope: the .reg-spec dd figures
 * and the 2px tile edge, nothing else (no prose, dates, or names). The map
 * mirrors the orbits domain palette hue-for-hue, translated into the governed
 * --acc-* set so the light theme's ink overrides apply: eo green, connectivity
 * magenta, iot cyan, launch orange, spaceports uv, ecosystem blue.
 */
const CARD_ACCENT: Record<string, string> = {
  eo: "var(--acc-green)",
  connectivity: "var(--acc-magenta)",
  iot: "var(--acc-cyan)",
  vehicle: "var(--acc-orange)",
  spaceport: "var(--acc-uv)",
  org: "var(--acc-blue)",
};

/** The entity card: status badges, display-voice name, the accented spec
 * grid, a clamped overview, modality chips, and the cyan open link. Clicking
 * navigates to the entity's profile page. */
function RegCard({ entry }: { entry: RegEntry }) {
  const status = statusBadge(entry.status);
  const acc = CARD_ACCENT[entry.kind];
  return (
    <a
      className="reg-card"
      href={entry.href}
      style={acc ? ({ "--card-acc": acc } as CSSProperties) : undefined}
    >
      <div className="card-meta">
        <span className="chip">{KIND_LABEL[entry.kind]}</span>
        {status && (
          <span className="chip">
            {status.glyph && (
              <span className={`stat-glyph stat-glyph-${status.glyph}`} aria-hidden="true">
                {status.glyph === "live" ? "●" : "◆"}
              </span>
            )}
            {status.text}
          </span>
        )}
        {entry.asOf && <span className="date">{entry.asOf}</span>}
      </div>
      <h3 className="sig-name">{entry.name}</h3>
      {entry.specs.length > 0 && (
        <dl className="reg-specs">
          {entry.specs.map((s) => (
            <div key={s.label} className="reg-spec">
              <dt>{s.label}</dt>
              <dd className="mono">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {entry.snippet ? (
        <p className="reg-snippet">
          {entry.snippet.length > 220 ? entry.snippet.slice(0, 220) + "..." : entry.snippet}
        </p>
      ) : (
        <p className="reg-snippet dim">
          No sourced overview yet. Unknowns stay unknown rather than estimated.
        </p>
      )}
      {entry.sensors.length > 0 && (
        <div className="tag-row">
          {entry.sensors.map((s) => (
            <span key={s} className="chip sig-tag">
              {s}
            </span>
          ))}
        </div>
      )}
      <span className="reg-open">facts, events &amp; sources &rarr;</span>
    </a>
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

/** A group-pane node: a provider/region/kind, or a constellation operator
 * (which may be a fleet parent whose children fill the entity pane). */
interface GroupNode {
  key: string;
  label: string;
  /** Company/fleet profile URL for the entity pane's header button. */
  profileHref: string | null;
  entries: RegEntry[];
}

/** Builds the default group pane: one node per e.group, biggest first. */
function simpleGroups(
  display: (name: string) => string,
  profileHref: (group: string) => string | null,
): (scoped: RegEntry[]) => GroupNode[] {
  return (scoped) => {
    const byGroup = new Map<string, RegEntry[]>();
    for (const e of scoped) byGroup.set(e.group, [...(byGroup.get(e.group) ?? []), e]);
    return [...byGroup.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([name, list]) => ({
        key: name,
        label: display(name),
        profileHref: profileHref(name),
        entries: list,
      }));
  };
}

/**
 * Builds the constellation operator pane. A fleet parent (Planet, Sentinel) is
 * itself the operator row: its children list in the entity pane and the parent
 * profile becomes the company-profile button, so no redundant column. `scoped`
 * is the entries within the selected domain; `all` is every constellation entry
 * (needed to detect fleet parents whose children may be filtered out).
 */
function constellationGroups(scoped: RegEntry[], all: RegEntry[], orgHrefs: OrgHrefs): GroupNode[] {
  const inScope = new Map(scoped.map((e) => [e.slug, e]));
  const nodes = new Map<string, GroupNode>();
  const nodeFor = (key: string, label: string, profileHref: string | null): GroupNode => {
    let n = nodes.get(key);
    if (!n) {
      n = { key, label, profileHref, entries: [] };
      nodes.set(key, n);
    }
    return n;
  };
  // Fleet parents read as operators in their pane, so the suffix is noise there.
  const opLabel = (name: string) => name.replace(/\s*\(fleet\)$/i, "");
  for (const e of scoped) {
    if (all.some((c) => c.parent === e.slug)) {
      // Fleet parent: owns an operator row; children fill its entity pane.
      const n = nodeFor(e.slug, opLabel(e.name), e.href);
      n.label = opLabel(e.name);
      n.profileHref = e.href;
    } else if (e.parent && inScope.has(e.parent)) {
      const p = inScope.get(e.parent)!;
      nodeFor(e.parent, opLabel(p.name), p.href).entries.push(e);
    } else {
      // Standalone constellation (or orphaned child under search filters).
      // The operator row must lead somewhere: the alias-mapped company
      // profile when one exists, else the constellation's own page (for a
      // single-constellation operator like ICEYE that IS the company page).
      nodeFor(`op:${e.group}`, e.group, entityHrefFor(e.group, orgHrefs) ?? e.href).entries.push(e);
    }
  }
  // A parent whose children are all filtered out still previews itself.
  for (const n of nodes.values()) {
    if (n.entries.length === 0 && inScope.has(n.key)) n.entries.push(inScope.get(n.key)!);
  }
  return [...nodes.values()].sort((a, b) => {
    const aUnk = a.label === "Operator unconfirmed" ? 1 : 0;
    const bUnk = b.label === "Operator unconfirmed" ? 1 : 0;
    return aUnk - bUnk || b.entries.length - a.entries.length || a.label.localeCompare(b.label);
  });
}

/** Optional leading pane (constellations: domain). */
interface SuperGroupConfig {
  label: string;
  keyOf: (e: RegEntry) => string;
  order: string[];
  display: (k: string) => string;
  accent?: (k: string) => string | undefined;
}

/**
 * The one registry browser, used by every section. Group pane(s) on the left
 * (constellations pass an optional leading super-group pane: domain ->
 * operator); the selected group's entities render as a full-width vertical
 * CARD STACK on the right, topped by a company-profile bar when the group has
 * a profile (Florian's rework, 2026-07-11: the old entity-list pane and
 * detail panel merged into one card-stack region). Selection state is
 * client-side; the deterministic first-group default keeps SSR and hydration
 * identical.
 */
function PaneBrowser({
  entries,
  superGroup,
  groupLabel,
  groupsFor,
  accent,
}: {
  entries: RegEntry[];
  superGroup?: SuperGroupConfig;
  groupLabel: string;
  groupsFor: (scoped: RegEntry[], all: RegEntry[]) => GroupNode[];
  accent?: string;
}) {
  const [selSuper, setSelSuper] = useState<string | null>(null);
  const [selGroup, setSelGroup] = useState<string | null>(null);

  let supers: Array<[string, RegEntry[]]> = [];
  let scoped = entries;
  let curSuper: string | null = null;
  if (superGroup) {
    const bySuper = new Map<string, RegEntry[]>();
    for (const e of entries) {
      const k = superGroup.keyOf(e);
      bySuper.set(k, [...(bySuper.get(k) ?? []), e]);
    }
    supers = superGroup.order
      .filter((k) => (bySuper.get(k) ?? []).length > 0)
      .map((k) => [k, bySuper.get(k)!] as [string, RegEntry[]]);
    const cur = supers.find(([k]) => k === selSuper) ?? supers[0];
    curSuper = cur ? cur[0] : null;
    scoped = cur ? cur[1] : [];
  }

  const groups = groupsFor(scoped, entries);
  const group = groups.find((g) => g.key === selGroup) ?? groups[0];
  const groupEntries = (group ? group.entries : []).slice().sort((a, b) => a.name.localeCompare(b.name));
  // The profile bar is omitted when the group has no profile, or when it
  // would only duplicate a lone card's own link (ICEYE > ICEYE is noise).
  const profileHref =
    group?.profileHref && !(groupEntries.length === 1 && groupEntries[0]!.href === group.profileHref)
      ? group.profileHref
      : null;

  const acc = superGroup && curSuper ? (superGroup.accent?.(curSuper) ?? accent) : accent;

  return (
    <div
      className={`reg-browser${superGroup ? " reg-browser-4" : ""}`}
      style={acc ? ({ "--reg-acc": acc } as CSSProperties) : undefined}
    >
      {superGroup && (
        <div className="reg-pane reg-ops">
          <div className="reg-pane-head">
            {superGroup.label} <span className="reg-pane-count">{supers.length}</span>
          </div>
          {supers.map(([k, list]) => (
            <RegRow
              key={k}
              label={superGroup.display(k)}
              aside={list.length}
              selected={k === curSuper}
              onClick={() => {
                setSelSuper(k);
                setSelGroup(null);
              }}
            />
          ))}
        </div>
      )}
      <div className="reg-pane reg-ops">
        <div className="reg-pane-head">
          {groupLabel} <span className="reg-pane-count">{groups.length}</span>
        </div>
        {groups.map((g) => (
          <RegRow
            key={g.key}
            label={g.label}
            // A count of 1 on a group that is just its own entity (ICEYE >
            // ICEYE) is noise; the suffix only earns its place at 2+.
            aside={
              g.entries.length === 1 &&
              g.entries[0]!.name.toLowerCase() === g.label.toLowerCase()
                ? ""
                : g.entries.length
            }
            selected={!!group && g.key === group.key}
            onClick={() => setSelGroup(g.key)}
          />
        ))}
      </div>
      <div className="reg-pane reg-stack">
        {profileHref && (
          <a className="reg-profile-bar" href={profileHref}>
            company profile &rarr;
          </a>
        )}
        {groupEntries.map((e) => (
          <RegCard key={e.slug} entry={e} />
        ))}
      </div>
    </div>
  );
}

interface RegSection {
  id: string;
  heading: string;
  tagline: string;
  /** Noun for the pane grouping (providers, operators, regions...); the
   * heading badge then reads "N entries · M noun" so it reconciles
   * with the pane header counts (2026-07-07 audit). */
  groupNoun: string;
  /** Noun for the entries themselves ("vehicles", "constellations"). */
  entryNoun: string;
  /** Every entry in scope for this section (before text/chip filtering). */
  base: RegEntry[];
  /** Chip set, derived from base so no chip is ever dead. */
  filters: RegFilterDef[];
  /** Renders the section's browser for the finally-filtered entries. */
  browser: (entries: RegEntry[]) => ReactNode;
}

/** Registry index: four stacked sections. Text search is global; each section
 * carries its own chip set and its own active-chip state, so a filter in one
 * section can never touch another. */
export function RegistryIndexPage({ data }: { data: DataFor<"registry"> }) {
  // Per-section active chip; a section id maps to its active filter id or null.
  const [chip, setChip] = useState<Record<string, string | null>>({});
  const [query, setQuery] = useState("");

  // The entry summaries are built server-side over the full dataset.
  const allConstellations = data.entries.constellations;
  const allVehicles = data.entries.vehicles;
  const allSpaceports = data.entries.spaceports;
  const allOrgs = data.entries.orgs;
  const orgHrefs = data.orgHrefs;
  const all = useMemo(
    () => [...allConstellations, ...allVehicles, ...allSpaceports, ...allOrgs],
    [allConstellations, allVehicles, allSpaceports, allOrgs],
  );

  const q = query.trim().toLowerCase();
  const textPass = (e: RegEntry) => q === "" || matchesRegQuery(e, q);

  const domainSuper: SuperGroupConfig = {
    label: "domain",
    keyOf: (e) => e.kind,
    order: ["eo", "connectivity", "iot"],
    display: (k) => k,
    accent: (k) => DOMAIN_ACCENT[k],
  };

  const sections: RegSection[] = [
    {
      id: "launch",
      heading: "launch service providers",
      tagline: "Who flies, and on what.",
      groupNoun: "providers",
      entryNoun: "vehicles",
      base: allVehicles,
      filters: vehicleFilters(allVehicles),
      browser: (ents) => (
        <PaneBrowser
          entries={ents}
          groupLabel="provider"
          groupsFor={simpleGroups((n) => n, (g) => entityHrefFor(g, orgHrefs) ?? null)}
          accent={SECTION_ACCENT.launch}
        />
      ),
    },
    {
      id: "constellations",
      heading: "constellations",
      tagline: "What is up, who owns it.",
      groupNoun: "operators",
      entryNoun: "constellations",
      base: allConstellations,
      filters: constellationFilters(allConstellations),
      browser: (ents) => (
        <PaneBrowser
          entries={ents}
          superGroup={domainSuper}
          groupLabel="operator"
          groupsFor={(scoped, allEntries) => constellationGroups(scoped, allEntries, orgHrefs)}
        />
      ),
    },
    {
      id: "spaceports",
      heading: "spaceports",
      tagline: "Where it leaves the ground.",
      groupNoun: "regions",
      entryNoun: "sites",
      base: allSpaceports,
      filters: spaceportFilters(allSpaceports),
      browser: (ents) => (
        <PaneBrowser
          entries={ents}
          groupLabel="region"
          groupsFor={simpleGroups((r) => REGION_LABEL[r] ?? r, () => null)}
          accent={SECTION_ACCENT.spaceports}
        />
      ),
    },
    {
      id: "ecosystem",
      heading: "ecosystem",
      tagline: "Everyone else who moves the market.",
      groupNoun: "kinds",
      entryNoun: "organizations",
      base: allOrgs,
      filters: orgFilters(allOrgs),
      browser: (ents) => (
        <PaneBrowser
          entries={ents}
          groupLabel="kind"
          // Kind rows are category labels, not names: caps (Florian,
          // 2026-07-12 casing pass), unlike the proper-cased company panes.
          groupsFor={simpleGroups((k) => (ORG_KIND_LABEL[k] ?? k).toUpperCase(), () => null)}
          accent={SECTION_ACCENT.ecosystem}
        />
      ),
    },
  ];

  return (
    <Layout current="registry">
      <div className="reg-index">
      <div className="reg-head">
        <h1 className="page-title">registry</h1>
        <input
          type="text"
          className="filter-input reg-search"
          placeholder="/ FILTER: ENTITY, OPERATOR OR PROVIDER..."
          aria-label="Search registry"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="reg-counts mono">
          <strong>{all.length}</strong> profiles{" "}
          <strong>{new Set(all.map((e) => e.affiliation)).size}</strong> operators
        </span>
      </div>
      {sections.map((s) => {
        const activeId = chip[s.id] ?? null;
        const activeDef = s.filters.find((f) => f.id === activeId) ?? null;
        const visible = s.base.filter((e) => textPass(e) && (!activeDef || activeDef.test(e)));
        const groupCount = new Set(visible.map((e) => e.group)).size;
        return (
          <section key={s.id} className="signal-section reg-section">
            <h2 className="signal-heading">
              <span>
                {s.heading} <span className="badge-acc">{visible.length}</span>{" "}
                <span className="dim reg-groupline">
                  {s.entryNoun} · {groupCount} {s.groupNoun}
                </span>
              </span>
              <span className="sig-tagline">{s.tagline}</span>
            </h2>
            {s.filters.length > 0 && (
              <div className="sig-tabs reg-chips reg-section-chips">
                {s.filters.map((f) => (
                  <button
                    key={f.id}
                    className={`sig-tab${activeId === f.id ? " active" : ""}`}
                    onClick={() =>
                      setChip((c) => ({ ...c, [s.id]: activeId === f.id ? null : f.id }))
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {visible.length === 0 ? (
              <p className="empty">Nothing matches this filter</p>
            ) : (
              s.browser(visible)
            )}
          </section>
        );
      })}
      <p className="dim reg-footnote">
        A registry of constellations, launch vehicles, spaceports, and the wider ecosystem. Pick
        a group, then an entity, to open its profile; every figure carries its source and as-of
        date, and unknown fields stay unknown. Numbers refresh on the weekly maintenance sweep.
      </p>
      </div>
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
  /** News items mentioning this entity (built server-side); the events tab. */
  events: ProfileEventRef[];
  /** Name -> profile href map, for linking provider/operator fact values. */
  orgHrefs: OrgHrefs;
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
  /** Sourced per-generation capability rows (registry v3). */
  generations?: GenerationRow[];
  /** Orbit-tab data (constellations): fact rows plus whether an Orbits layer exists. */
  orbitTab?: { rows: ProfileRow[]; hasLayer: boolean } | null;
  /** Uppercase micro-chips under the title (sensor types, country, status...). */
  headerChips?: Array<{ label: string; kind?: "status" }>;
  /** Section/domain accent for the page chrome; falls back to the brand accent. */
  accent?: string;
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

function EventsSection({ events }: { events: ProfileEventRef[] }) {
  if (events.length === 0) return null;
  return (
    <section id="events" className="panel">
      <h2>events</h2>
      <ul className="index-list event-list">
        {events.map((i) => (
          <li key={i.id} className="event-row">
            <span className={`chip chip-${i.impact}`}>{i.impact}</span>
            <span className="date">{i.date}</span>
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
                  stroke="var(--acc-cyan)"
                  strokeWidth="1"
                />
                {/* telemetry cursor: cyan is the DATA constant */}
                <circle cx={x(hIdx)} cy={y(hPoint[1])} r="3" fill="var(--acc-cyan)" />
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

/**
 * Cumulative cataloged-on-orbit count by launch year, computed client-side
 * from the constellation's committed element set (OBJECT_ID international
 * designators carry the launch year). Honest framing matters: this buckets
 * TODAY's catalog by launch year; decayed satellites are absent, so it is
 * a fleet-composition read, never a historical fleet-size series.
 */
function OrbitYearsChart({ slug }: { slug: string }) {
  const [data, setData] = useState<{ pts: Array<[number, number]>; asOf: string | null } | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    void loadElements(slug).then((res) => {
      if (cancelled || !res.ok) return;
      const byYear = new Map<number, number>();
      for (const r of res.file.records) {
        const y = Number(r.OBJECT_ID?.slice(0, 4));
        if (Number.isFinite(y) && y > 1950) byYear.set(y, (byYear.get(y) ?? 0) + 1);
      }
      if (byYear.size === 0) return;
      const min = Math.min(...byYear.keys());
      const max = Math.max(new Date().getUTCFullYear(), ...byYear.keys());
      const pts: Array<[number, number]> = [];
      let cum = 0;
      for (let y = min; y <= max; y++) {
        cum += byYear.get(y) ?? 0;
        pts.push([y, cum]);
      }
      setData({ pts, asOf: res.file.fetched_at?.slice(0, 10) ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);
  if (!data || data.pts.length < 2) return null;
  const { pts, asOf } = data;
  // A compact, boxy drawing frame: the hero count carries the module,
  // the curve is its companion. Year ticks, marker on today's count.
  const W = 360;
  const H = 150;
  const padX = 6;
  const padTop = 12;
  const padBot = 22;
  const total = pts[pts.length - 1]![1];
  const x = (i: number) => padX + ((W - padX * 2) * i) / (pts.length - 1);
  const y = (v: number) => H - padBot - ((H - padTop - padBot) * v) / total;
  // Step path: each year holds its level until the next launch year.
  let d = `M ${x(0)} ${y(pts[0]![1])}`;
  for (let i = 1; i < pts.length; i++) d += ` H ${x(i)} V ${y(pts[i]![1])}`;
  const area = `${d} V ${H - padBot} H ${x(0)} Z`;
  return (
    <section id="on-orbit" className="panel">
      <h2>on orbit</h2>
      <div className="onorbit-grid">
        <div className="onorbit-stat">
          <span className="fact-label">sats on orbit (verified)</span>
          <span className="onorbit-value">{fmtNum(total)}</span>
          <span className="fact-meta">
            <span className="dim">cataloged by CelesTrak</span>
            {asOf && <span className="dim">as of {asOf}</span>}
          </span>
        </div>
        <div className="onorbit-chart">
          <svg viewBox={`0 0 ${W} ${H}`} className="onorbit-svg" aria-hidden="true">
            <line
              x1={padX}
              y1={H - padBot}
              x2={W - padX}
              y2={H - padBot}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <path d={area} fill="var(--reg-acc, var(--acc))" opacity={0.08} />
            <path d={d} fill="none" stroke="var(--reg-acc, var(--acc))" strokeWidth={1.5} />
            <circle
              cx={x(pts.length - 1)}
              cy={y(total)}
              r={3}
              fill="var(--reg-acc, var(--acc))"
            />
            <text x={padX} y={H - 6} className="onorbit-tick">
              {pts[0]![0]}
            </text>
            <text x={W - padX} y={H - 6} textAnchor="end" className="onorbit-tick">
              {pts[pts.length - 1]![0]}
            </text>
          </svg>
          <p className="dim onorbit-note">
            cumulative by launch year; counts objects in today's catalog, so satellites since
            deorbited are absent
          </p>
        </div>
      </div>
    </section>
  );
}

/** The entity's defining numbers as anchored, citable stat cells (registry v2). */
function KeySpecsPanel({ cells, note }: { cells: SpecCell[]; note?: string | null }) {
  if (cells.length < 2) return null;
  return (
    <section id="specs" className="panel">
      <h2>key details</h2>
      <div className="specs-grid">
        {cells.map((c) => (
          <div key={c.field} id={`spec-${c.field}`} className="spec-cell">
            <span className="spec-label">
              {c.label}{" "}
              <a className="spec-anchor" href={`#spec-${c.field}`}>
                {"//"}
              </a>
            </span>
            {/* Numbers earn the display size; stated phrases ("under 6 hour
                global revisit") read at body scale so they never tower. */}
            <span className={`spec-value${c.value.length > 14 ? " spec-value-long" : ""}`}>
              {c.value}
            </span>
            <span className="spec-meta">
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
              )}
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

/**
 * The profile header's ONE sourcing mark (registry v3, Florian 2026-07-09):
 * the median of the page's scored facts on the LED bezel, with the honest
 * mix (count per score, weakest fact, unscored-sourced count) in a hover/
 * focus popover. Display-only and computed at render; per-fact scores stay
 * the record and render in the Sources tab.
 */
function PageSourcingMark({
  scored,
  unscored,
}: {
  scored: number[];
  unscored: number;
}) {
  const [open, setOpen] = useState(false);
  const total = scored.length + unscored;
  if (total === 0) return null;
  const sorted = [...scored].sort((a, b) => a - b);
  // Lower median: the conservative middle when the count is even.
  const median = sorted.length > 0 ? sorted[Math.floor((sorted.length - 1) / 2)]! : null;
  const weakest = sorted[0] ?? null;
  const perScore = [5, 4, 3, 2, 1]
    .map((v) => [v, sorted.filter((s) => s === v).length] as const)
    .filter(([, n]) => n > 0);
  return (
    <span
      className="snr-agg"
      tabIndex={0}
      role="note"
      aria-label={
        median !== null
          ? `Sourcing: typical fact scores ${median} of 5 across ${total} sourced facts`
          : `Sourcing: ${total} sourced facts, unscored`
      }
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span className="snr-agg-label">sourcing</span>
      {median !== null && <SnrLed snr={median} size="compact" />}
      <span className="snr-agg-count dim">
        {median !== null ? `typical ${median}/5 · ` : ""}
        {total} facts
      </span>
      {open && (
        <span className="snr-pop snr-agg-pop" role="status">
          <span className="snr-agg-pop-title">source mix</span>
          {perScore.map(([v, n]) => (
            <span key={v} className="snr-agg-row">
              <span>{v}/5</span>
              <span>{n}</span>
            </span>
          ))}
          {unscored > 0 && (
            <span className="snr-agg-row">
              <span>first-party / reference (unscored)</span>
              <span>{unscored}</span>
            </span>
          )}
          {weakest !== null && (
            <span className="snr-agg-foot">weakest fact {weakest}/5 · per-fact detail in sources</span>
          )}
        </span>
      )}
    </span>
  );
}

/** Sourced per-generation capability rows (registry v3); hidden when empty. */
function GenerationsSection({ generations }: { generations?: GenerationRow[] }) {
  if (!generations || generations.length === 0) return null;
  return (
    <section id="generations" className="panel">
      <h2>generations</h2>
      <div className="gen-rows">
        {generations.map((g) => (
          <div key={g.name} className="gen-row">
            <span className="gen-name">{g.name}</span>
            <span className="gen-text">
              {g.text}{" "}
              <a href={g.source} rel="noopener" className="dim">
                (source, as of {g.as_of})
              </a>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// The honest class label for a sourced-but-unscored field: computed
// figures (CelesTrak-derived counts) are the pipeline's, Wikipedia is a
// reference, everything else unscored is the actor speaking directly.
function unscoredLabel(f: SourcedField<unknown>, computed?: boolean): string {
  if (computed || (f.source ?? "").includes("celestrak.org")) return "computed";
  if ((f.source ?? "").includes("wikipedia.org")) return "wikipedia";
  return "first-party";
}

/** Every sourced fact on the profile, positioning claims included. */
function factEntries(
  rows: ProfileRow[],
  positioning?: Positioning | null,
): Array<{ label: string; f: SourcedField<unknown>; computed?: boolean }> {
  const entries: Array<{ label: string; f: SourcedField<unknown>; computed?: boolean }> = [];
  for (const [label, f, computed] of rows) {
    if (f.source) entries.push({ label, f, computed: computed === "computed" });
  }
  (positioning?.claims ?? []).forEach((c, i) => {
    if (c.source) entries.push({ label: `positioning claim ${i + 1}`, f: c });
  });
  return entries;
}

/** Per-mode EO specs as spec cards (registry v3.1), not a spreadsheet row. */
function ImagingModeCards({ modes }: { modes?: ImagingMode[] }) {
  if (!modes || modes.length === 0) return null;
  return (
    <div className="mode-cards">
      {modes.map((m) => (
        <div key={m.mode} className="mode-card">
          <span className="mode-name">{m.mode}</span>
          <span className="mode-figs">
            <span className="mode-fig">
              <span className="fact-label">resolution</span>
              <span className="mode-fig-val">
                {m.resolution_m !== null ? `${m.resolution_m} m` : <span className="dim">not stated</span>}
              </span>
            </span>
            <span className="mode-fig">
              <span className="fact-label">swath</span>
              <span className="mode-fig-val">
                {m.swath_km !== null ? `${m.swath_km} km` : <span className="dim">not stated</span>}
              </span>
            </span>
          </span>
          <span className="fact-meta">
            <a href={m.source} rel="noopener">
              source
            </a>{" "}
            <span className="dim">as of {m.as_of}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The exhaustive reference as a data grid of fact cells (registry v3.1):
 * micro label, prominent value, dim meta line. Same information as the old
 * table, none of the spreadsheet reading.
 */
function FactGrid({ rows, orgHrefs }: { rows: ProfileRow[]; orgHrefs: OrgHrefs }) {
  const cell = (label: string, f: SourcedField<unknown>, computed: boolean) => {
    const raw = f.value;
    const text =
      raw === null || raw === undefined
        ? "unknown"
        : typeof raw === "boolean"
          ? raw
            ? "yes"
            : "no"
          : Array.isArray(raw)
            ? raw.join(", ")
            : String(raw);
    const entityHref =
      ENTITY_ROW_LABELS.has(label) && typeof raw === "string"
        ? entityHrefFor(raw, orgHrefs)
        : undefined;
    const isUrl = typeof raw === "string" && /^https?:\/\//.test(raw);
    return (
      <div key={label} className="fact-cell">
        <span className="fact-label">{label}</span>
        <span className={`fact-value${raw === null || raw === undefined ? " empty" : ""}`}>
          {isUrl ? (
            <a href={raw as string} rel="noopener">
              {hostOf(raw as string)}
            </a>
          ) : entityHref ? (
            <a href={entityHref}>{text}</a>
          ) : (
            text
          )}
        </span>
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
        <span className="fact-meta">
          {f.source ? (
            <a href={f.source} rel="noopener">
              source
            </a>
          ) : computed ? (
            <span className="dim">computed</span>
          ) : null}
          {f.as_of && <span className="dim">as of {f.as_of}</span>}
          {f.tier === "provisional" && <span className="tag-provisional">prov</span>}
        </span>
      </div>
    );
  };
  return (
    <div className="fact-grid">
      {rows.map(([label, f, computed]) => cell(label, f, computed === "computed"))}
    </div>
  );
}

/**
 * The chronology as an interactive timeline (registry v3.1): newest first,
 * type filter chips, year dividers, a spine with type-aware markers
 * (incidents carry the warn ink). Renamed from history per Florian.
 */
function TimelineSection({ history }: { history: TimelineEvent[] }) {
  const [filter, setFilter] = useState<string | null>(null);
  if (history.length === 0) return null;
  const typeOf = (e: TimelineEvent) => e.type ?? "milestone";
  const present = [...new Set(history.map(typeOf))].sort();
  const shown = (filter ? history.filter((e) => typeOf(e) === filter) : history)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  let lastYear = "";
  return (
    <section id="history" className="panel">
      <h2>timeline</h2>
      {present.length > 1 && (
        <div className="sig-tabs tl-filter">
          <button
            className={`sig-tab${filter === null ? " active" : ""}`}
            onClick={() => setFilter(null)}
          >
            all
          </button>
          {present.map((t) => (
            <button
              key={t}
              className={`sig-tab${filter === t ? " active" : ""}`}
              onClick={() => setFilter(filter === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <ol className="tl">
        {shown.map((e) => {
          const year = e.date.slice(0, 4);
          const divider = year !== lastYear;
          lastYear = year;
          const incident = typeOf(e) === "incident";
          return (
            <li key={`${e.date}-${e.headline}`} className={incident ? "tl-incident" : undefined}>
              {divider && <span className="tl-year">{year}</span>}
              <span className="tl-row">
                <span className="tl-mark" aria-hidden="true" />
                <span className="tl-head">
                  <span className="tl-date">{e.date}</span>
                  {e.type && e.type !== "milestone" && (
                    <span className="chip chip-tl-type">{e.type}</span>
                  )}
                </span>
                <span className="tl-title">
                  {e.headline}
                  {e.outcome && <span className="incident-line">outcome: {e.outcome}</span>}
                  {e.cause && <span className="incident-line">cause: {e.cause}</span>}{" "}
                  <a href={e.source} rel="noopener" className="dim">
                    (source, as of {e.as_of})
                  </a>
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The Sources tab as provenance cards (registry v3.1): one card per source
 * host, listing the facts it backs, each with its own SNR mark (trace on
 * click) or honest class word. This is where per-fact marks live now that
 * the header carries the one aggregate.
 */
function SourceCardsSection({
  rows,
  positioning,
}: {
  rows: ProfileRow[];
  positioning?: Positioning | null;
}) {
  const entries = factEntries(rows, positioning);
  if (entries.length === 0) return null;
  const byHost = new Map<string, typeof entries>();
  for (const e of entries) {
    const host = hostOf(e.f.source!);
    byHost.set(host, [...(byHost.get(host) ?? []), e]);
  }
  const cards = [...byHost.entries()].sort((a, b) => b[1].length - a[1].length);
  return (
    <section id="sources" className="panel">
      <h2>sources</h2>
      <div className="source-cards">
        {cards.map(([host, list], i) => (
          <div key={host} className="source-card">
            <a className="source-card-head" href={list[0]!.f.source!} rel="noopener">
              <span className="src-num">[{i + 1}]</span> {host}{" "}
              <span className="src-arrow">↗</span>
            </a>
            <div className="source-card-facts">
              {list.map(({ label, f, computed }) => (
                <span key={label} className="source-fact">
                  <a href={f.source!} rel="noopener" className="source-fact-label">
                    {label}
                  </a>
                  <span className="source-fact-class">
                    {f.snr !== undefined ? (
                      <>
                        <SnrLed snr={f.snr} trace={f.snr_trace} size="compact" />
                        {f.tier === "provisional" && <span className="tag-provisional">prov</span>}
                      </>
                    ) : (
                      <span className="dim">{unscoredLabel(f, computed)}</span>
                    )}
                  </span>
                  <span className="dim source-fact-asof">{f.as_of ?? ""}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <GuntersAttribution rows={rows} />
      <GcatAttribution rows={rows} />
    </section>
  );
}

/** Which tab owns each legacy in-page anchor, for #hash deep links. */
const TAB_OF_ANCHOR: Record<string, string> = {
  specs: "overview",
  "on-orbit": "overview",
  generations: "overview",
  stock: "overview",
  constellations: "overview",
  vehicles: "overview",
  faq: "overview",
  facts: "specs",
  incidents: "history",
  events: "history",
  positioning: "overview",
  sources: "sources",
  "fact-ledger": "sources",
};

/** Shared destination-page shell for every registry profile type (tabbed, registry v3). */
function ProfilePage({ profile }: { profile: ProfileMeta }) {
  const children = profile.children ?? [];
  const roster = profile.vehicleRoster ?? [];
  const timeline = profile.history ?? [];
  const specs = profile.specs ?? [];
  const positioning = profile.positioning ?? null;

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

  const hasEvents = profile.events.length > 0;
  const hasSources = profile.rows.some(([, f]) => !!f.source);
  const orbitTab = profile.orbitTab ?? null;
  const hasOrbit =
    !!orbitTab && (orbitTab.hasLayer || orbitTab.rows.some(([, f]) => f.value !== null && f.value !== undefined));

  // The page-level sourcing mix: scored facts feed the median mark, sourced
  // but unscored fields (first-party, Wikipedia, computed) are counted.
  const scored: number[] = [];
  let unscored = 0;
  for (const [, f] of profile.rows) {
    if (typeof f.snr === "number") scored.push(f.snr);
    else if (f.source) unscored++;
  }
  for (const c of positioning?.claims ?? []) {
    if (typeof c.snr === "number") scored.push(c.snr);
    else if (c.source) unscored++;
  }

  const tabs: Array<[string, string]> = [["overview", "overview"]];
  // Display label is "details" (Florian, 2026-07-12: "specs" fits vehicles
  // and spacecraft, not spaceports or organizations); the tab id and its
  // #specs deep-link anchors stay unchanged.
  tabs.push(["specs", profile.imagingModes && profile.imagingModes.length > 0 ? "details & sensors" : "details"]);
  if (hasOrbit) tabs.push(["orbit", "orbit"]);
  if (timeline.length > 0 || hasEvents) tabs.push(["history", "history"]);
  if (hasSources) tabs.push(["sources", "sources"]);

  const [tab, setTab] = useState("overview");
  const tabIds = tabs.map(([id]) => id).join(",");
  useEffect(() => {
    const ids = tabIds.split(",");
    const apply = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (!h) return;
      const direct = ids.includes(h) ? h : null;
      const owner =
        direct ?? TAB_OF_ANCHOR[h] ?? (h.startsWith("spec-") ? "overview" : null);
      if (owner && ids.includes(owner)) {
        setTab(owner);
        if (!direct) {
          requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView());
        }
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [tabIds]);
  const pick = (id: string) => {
    setTab(id);
    window.history.replaceState(null, "", `#${id}`);
  };
  // The 3D view (three.js, lazy chunk) mounts only once the orbit tab has
  // actually been opened; until then profile pages ship none of it.
  const [orbitSeen, setOrbitSeen] = useState(false);
  useEffect(() => {
    if (tab === "orbit") setOrbitSeen(true);
  }, [tab]);

  return (
    <Layout current="registry">
      <div
        className="registry-profile"
        style={profile.accent ? ({ "--reg-acc": profile.accent } as CSSProperties) : undefined}
      >
        <Breadcrumbs
          segment={profile.breadcrumbSegment}
          name={profile.name}
          parentLink={profile.parentLink}
        />
        <div className="profile-head">
          <h1 className="page-title profile-title">
            <RegistryLogo slug={profile.slug} name={profile.name} size="lg" />
            {profile.name}
            {profile.variant && <span className="chip chip-variant">{profile.variant}</span>}{" "}
            <span className="dim">/ {profile.typeLabel}</span>
          </h1>
          <PageSourcingMark scored={scored} unscored={unscored} />
        </div>
        {profile.headerChips && profile.headerChips.length > 0 && (
          <div className="profile-chips">
            {profile.headerChips.map((c) => (
              <span key={c.label} className={`chip${c.kind === "status" ? " chip-status" : ""}`}>
                {/* Status casing drifts in the source data ("Active" /
                    "active" / "In Development"); normalize to lowercase at
                    render only, never touching the stored value. Non-status
                    chips (sensor types, country) keep their sourced casing. */}
                {c.kind === "status" ? c.label.toLowerCase() : c.label}
              </span>
            ))}
          </div>
        )}
        <div className="profile-tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`profile-tab${tab === id ? " active" : ""}`}
              onClick={() => pick(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="tab-panel" hidden={tab !== "overview"}>
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
          <KeySpecsPanel cells={specs} note={profile.specNote} />
          {orbitTab?.hasLayer && <OrbitYearsChart slug={profile.slug} />}
          <GenerationsSection generations={profile.generations} />
          <ChildConstellationsSection children={children} />
          <VehicleRosterSection roster={roster} />
          {profile.stockTicker?.value && (
            <StockSection slug={profile.slug} ticker={profile.stockTicker} />
          )}
          {/* The house read closes the overview, just before the FAQ
              (Florian 2026-07-09). */}
          <PositioningSection positioning={positioning} />
          <FaqSection items={profile.faq} />
        </div>

        <div className="tab-panel" hidden={tab !== "specs"}>
          {profile.imagingModes && profile.imagingModes.length > 0 && (
            <section id="imaging-modes" className="panel">
              <h2>imaging modes</h2>
              <ImagingModeCards modes={profile.imagingModes} />
            </section>
          )}
          <section id="facts" className="panel">
            <h2>facts</h2>
            <FactGrid rows={profile.rows} orgHrefs={profile.orgHrefs} />
            {profile.tableNote && <p className="dim">{profile.tableNote}</p>}
          </section>
        </div>

        {hasOrbit && orbitTab && (
          <div className="tab-panel" hidden={tab !== "orbit"}>
            <section id="orbit-view" className="panel">
              <h2>orbit</h2>
              <div className="orbit-grid">
                {orbitTab.hasLayer && (
                  <div className="orbit-view">
                    {/* The SVG schematic defines the box and doubles as the
                        no-WebGL / no-data fallback; the real 3D globe (same
                        render as /orbits/, this constellation only) overlays
                        it once loaded. No accent is passed to the 3D view:
                        it resolves the constellation's own orbits palette
                        token, so colors match the /orbits/ page exactly. */}
                    <OrbitMini slug={profile.slug} accent={profile.accent} />
                    {orbitSeen && (
                      <div className="orbit-3d">
                        <OrbitMini3D slug={profile.slug} />
                      </div>
                    )}
                    <a className="orbit-open" href="/mcc/">
                      open in mcc &rarr;
                    </a>
                  </div>
                )}
                <div className="orbit-facts">
                  <FactGrid rows={orbitTab.rows} orgHrefs={profile.orgHrefs} />
                </div>
              </div>
            </section>
          </div>
        )}

        {(timeline.length > 0 || hasEvents) && (
          <div className="tab-panel" hidden={tab !== "history"}>
            <EventsSection events={profile.events} />
            <TimelineSection history={timeline} />
          </div>
        )}

        {hasSources && (
          <div className="tab-panel" hidden={tab !== "sources"}>
            <SourceCardsSection rows={profile.rows} positioning={positioning} />
          </div>
        )}

        <footer className="profile-foot">
          <RelatedSection profile={profile} related={related} prev={prev} next={next} />
          <LogoCredit slug={profile.slug} />
          <p>
            <a href="/registry/">BACK TO THE REGISTRY</a>
          </p>
        </footer>
      </div>
    </Layout>
  );
}

export function ConstellationPage({ data }: { data: DataFor<"constellation"> }) {
  const profile = data.profile;
  const childProfiles = data.children;
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
  const hasOrbitsLayer =
    !!profile.orbits && (!!profile.orbits.celestrak_group || !!profile.orbits.celestrak_name);
  const specCandidates: Array<SpecCell | null> = [
    specFromField("resolution_m", "max resolution", profile.resolution_m, (v) => `${fmtNum(v)} m`),
    specFromField("swath_km", "swath", profile.swath_km, (v) => `${fmtNum(v)} km`),
    specFromField("revisit", "revisit", profile.revisit, (v) => String(v)),
    specFromField("spectral_bands", "spectral bands", profile.spectral_bands, (v) =>
      (v as string[]).join(", "),
    ),
    // With an Orbits layer, the launch-year chart cell IS the on-orbit
    // stat (same CelesTrak-derived count), so the plain cell would repeat it.
    !hasOrbitsLayer && verifiedField.value !== null && verifiedField.value !== undefined
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
    siblings: data.siblings,
    events: data.events,
    orgHrefs: data.orgHrefs,
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
    parentLink: data.parent,
    children: children.map((c) => ({ slug: c.slug, name: c.name })),
    specs,
    positioning: profile.positioning ?? null,
    imagingModes: profile.imaging_modes,
    generations: profile.generations,
    orbitTab: {
      rows: [
        ["orbit", profile.orbit],
        countRow("sats launched (total)", "sats_launched_total"),
        countRow("sats active (claimed)", "sats_active_claimed"),
        verifiedRow,
        ["sats planned", profile.sats_planned],
      ],
      hasLayer: hasOrbitsLayer,
    },
    headerChips: [
      ...(profile.sensor_types.value ?? []).map((s) => ({ label: s })),
      ...(profile.country.value ? [{ label: profile.country.value }] : []),
      ...(profile.status.value ? [{ label: profile.status.value, kind: "status" as const }] : []),
    ],
    accent: DOMAIN_ACCENT[profile.domain],
  };
  return <ProfilePage profile={meta} />;
}

export function VehiclePage({ data }: { data: DataFor<"vehicle"> }) {
  const profile = data.profile;
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
    siblings: data.siblings,
    events: data.events,
    orgHrefs: data.orgHrefs,
    breadcrumbSegment: "vehicles",
    faq,
    specs,
    variant: profile.variant ?? null,
    specNote: profile.variant
      ? `figures describe the ${profile.variant} configuration where sourced`
      : null,
    history: profile.events ?? [],
    positioning: profile.positioning ?? null,
    headerChips: [
      ...(profile.vehicle_class.value ? [{ label: String(profile.vehicle_class.value) }] : []),
      ...(profile.country.value ? [{ label: profile.country.value }] : []),
      ...(profile.reusable.value === true ? [{ label: "reusable" }] : []),
      ...(profile.status.value ? [{ label: profile.status.value, kind: "status" as const }] : []),
    ],
    accent: SECTION_ACCENT.launch,
  };
  return <ProfilePage profile={meta} />;
}

export function SpaceportPage({ data }: { data: DataFor<"spaceport"> }) {
  const profile = data.profile;
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
    // affiliation carries the region for spaceports; narrow to same-region.
    siblings: data.siblings.filter((s) => s.affiliation === profile.region),
    events: data.events,
    orgHrefs: data.orgHrefs,
    breadcrumbSegment: "spaceports",
    faq,
    specs,
    history: profile.events ?? [],
    positioning: profile.positioning ?? null,
    headerChips: [
      ...(profile.country.value ? [{ label: profile.country.value }] : []),
      ...(profile.status.value ? [{ label: String(profile.status.value), kind: "status" as const }] : []),
    ],
    accent: SECTION_ACCENT.spaceports,
  };
  return <ProfilePage profile={meta} />;
}

export function OrgPage({ data }: { data: DataFor<"org"> }) {
  const profile = data.profile;
  const rows: Array<[string, SourcedField<unknown>]> = [
    ["country", profile.country],
    ["founded", profile.founded],
    ["focus", profile.focus],
    ["status", profile.status],
    ["website", profile.website],
  ];
  // Full roster, active and retired alike, matched on the vehicle's stated
  // provider (built server-side); sorted by name for the roster section.
  const vehicleRoster = data.vehicleRoster
    .slice()
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
    // affiliation carries the org kind; narrow to same-kind organizations.
    siblings: data.siblings.filter((o) => o.affiliation === profile.kind),
    events: data.events,
    orgHrefs: data.orgHrefs,
    breadcrumbSegment: "organizations",
    faq,
    vehicleRoster,
    history: profile.events ?? [],
    stockTicker: profile.ticker ?? null,
    positioning: profile.positioning ?? null,
    headerChips: [
      { label: ORG_KIND_LABEL[profile.kind] ?? profile.kind },
      ...(profile.country.value ? [{ label: profile.country.value }] : []),
      ...(profile.status.value ? [{ label: String(profile.status.value), kind: "status" as const }] : []),
    ],
    accent: SECTION_ACCENT.ecosystem,
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

function SignalCard({ person, avatars }: { person: SignalPerson; avatars: Record<string, string> }) {
  const primary =
    person.channels.find((c) => c.status === "verified_active") ?? person.channels[0];
  const followers = followerBadge(person);
  const avatar = avatars[person.id];
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
export function OrbitsPage({ data }: { data: DataFor<"orbits"> }) {
  return (
    <OrbitsLinkProvider
      value={{ linkItems: data.linkItems, vehicleLinks: data.vehicleLinks }}
    >
      <div>
        <div className="shell orbits-head-shell">
          <Masthead current="mcc" />
        </div>
        <OrbitsStage />
      </div>
    </OrbitsLinkProvider>
  );
}

export function SignalsPage({ data }: { data: DataFor<"signals"> }) {
  const signals = data.people;
  const signalOutlets = data.outlets;
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
          placeholder="/ SEARCH NAME, HANDLE, TOPIC"
          aria-label="Search signals"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <p className="empty">Nobody matches: adjust filters</p>
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
                  <SignalCard key={p.id} person={p} avatars={data.avatars} />
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

/** The stats rail of the merged /system/ page (Florian, 2026-07-11): the
 * hero tiles plus every stat block, each keeping its anchor id, table,
 * method note, and cite-this element. Rendered as an <aside> that the
 * SystemPage grid pins as a sticky right rail on desktop and stacks first
 * on mobile. No Layout wrapper: SystemPage owns the shell. */
export function StatsRail({
  hero,
  blocks,
  generatedAt,
}: {
  hero: DataFor<"system">["hero"];
  blocks: DataFor<"system">["blocks"];
  generatedAt: string;
}) {
  return (
    <aside className="system-rail" aria-label="Indices">
      <h2 className="system-rail-title">indices</h2>
      <p className="lede system-rail-lede">
        Live indices computed from Vesperio data on every build. Each block answers one question,
        states its method, and offers a ready-made citation. Machine-readable copy at{" "}
        <a href="/stats.json">/stats.json →</a>.
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
            <p className="prose stat-answer">{b.answer}</p>
            {b.rows.length === 0 ? (
              <p className="empty">No data yet; this index fills as the feed and registry grow</p>
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
    </aside>
  );
}

// ------------------------------------------------------------------ about

const QA: Array<[string, string]> = [
  [
    "What is Vesperio?",
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
    "Can I cite Vesperio?",
    "Yes. Every stat block on the system page has a stable anchor and a pre-formatted citation string with a retrieval date, and the same numbers are served machine-readable at /stats.json.",
  ],
];

/** Engine pipeline diagram, color-coded by owner (Florian round 2,
    2026-07-12): cyan = deterministic code, magenta = the drafting agent,
    green = data files, yellow = the human editor, bright frame = the
    reader-facing output. Geometry (round 3): 140px boxes on a 184px
    column rhythm leave 44px gaps, wide enough for every centered wire
    label; nothing sits on a border. */
function EngineDiagram() {
  const lbl = {
    fill: "var(--text-1)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.08em",
  } as const;
  const sub = { ...lbl, fill: "var(--text-3)", fontSize: 8, fontWeight: 400 } as const;
  const wireLbl = { ...lbl, fill: "var(--text-3)", fontSize: 7.5, fontWeight: 400 } as const;
  const wire = { stroke: "var(--text-3)", strokeWidth: 1, fill: "none", markerEnd: "url(#eng-arr)" } as const;
  const OWNER = {
    code: "var(--acc-cyan-dim)",
    agent: "var(--acc-magenta-dim)",
    data: "var(--acc-green-dim)",
    human: "var(--acc-yellow-dim)",
    out: "var(--text-1)",
  };
  const Box = ({ x, y, w = 140, h = 56, owner, title, s1, s2 }: {
    x: number; y: number; w?: number; h?: number;
    owner: keyof typeof OWNER; title: string; s1?: string; s2?: string;
  }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="var(--bg-panel)" stroke={OWNER[owner]} strokeWidth={owner === "out" ? 1.5 : 1} />
      <text x={x + 12} y={y + 20} {...lbl}>{title}</text>
      {s1 && <text x={x + 12} y={y + 34} {...sub}>{s1}</text>}
      {s2 && <text x={x + 12} y={y + 45} {...sub}>{s2}</text>}
    </g>
  );
  return (
    <svg viewBox="0 0 752 468" role="img" aria-label="DATA ENGINE PIPELINE" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <marker id="eng-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--text-3)" />
        </marker>
      </defs>

      {/* legend */}
      {(
        [
          ["code", "CODE"],
          ["agent", "AGENT"],
          ["data", "DATA"],
          ["human", "HUMAN"],
          ["out", "OUTPUT"],
        ] as const
      ).map(([k, name], i) => (
        <g key={k}>
          <rect x={28 + i * 120} y={6} width={10} height={10} fill="none" stroke={OWNER[k]} strokeWidth={k === "out" ? 1.5 : 1} />
          <text x={44 + i * 120} y={15} {...sub}>{name}</text>
        </g>
      ))}

      {/* row 1: intake */}
      <Box x={28} y={40} owner="data" title="SOURCE REGISTRY" s1="98 REGISTERED FEEDS," s2="PAGES, SIGNAL CHANNELS" />
      <Box x={212} y={40} owner="code" title="HARVESTER" s1="DETERMINISTIC FETCH," s2="SYNDICATE COLLAPSE" />
      <Box x={396} y={40} owner="data" title="CANDIDATE QUEUE" s1="TRIAGED ONCE," s2="THEN CONSUMED" />
      <Box x={580} y={40} owner="agent" title="DISCOVERY" s1="OPEN-WEB QUERIES," s2="WHITELISTED CHANNELS" />
      <line x1={168} y1={68} x2={210} y2={68} {...wire} />
      <text x={189} y={84} textAnchor="middle" {...wireLbl}>FETCH</text>
      <line x1={352} y1={68} x2={394} y2={68} {...wire} />
      <text x={373} y={84} textAnchor="middle" {...wireLbl}>QUEUE</text>

      {/* row 2: judgment and arithmetic, right to left */}
      <Box x={396} y={168} owner="agent" title="SWEEP AGENT" s1="SCOPES, CRAWLS, DRAFTS," s2="ATTESTS ITS SOURCES" />
      <Box x={212} y={168} owner="code" title="FINALIZE GATE" s1="VALIDATES, DEDUPS," s2="COMPUTES EVERY SCORE" />
      <Box x={28} y={168} owner="data" title="DATA FILES" s1="ITEMS, TRACES, LOG," s2="GIT-VERSIONED" />
      <polyline points="466,96 466,166" {...wire} />
      <text x={472} y={130} {...wireLbl}>TRIAGE</text>
      <polyline points="650,96 650,196 538,196" {...wire} />
      <text x={656} y={130} {...wireLbl}>FINDS</text>
      <line x1={396} y1={196} x2={354} y2={196} {...wire} />
      <text x={375} y={212} textAnchor="middle" {...wireLbl}>DRAFT</text>
      <line x1={212} y1={196} x2={170} y2={196} {...wire} />
      <text x={191} y={212} textAnchor="middle" {...wireLbl}>MERGE</text>

      {/* row 3: outputs and records */}
      <Box x={28} y={296} owner="code" title="SITE BUILD" s1="SCHEMA CHECKS," s2="EVERY ROUTE STATIC" />
      <Box x={228} y={296} owner="out" title="READER" s1="VESPERIO.AI · RSS" s2="· STATS.JSON" />
      <Box x={396} y={296} owner="data" title="HELD QUEUE" s1="OPEN QUESTIONS; ANSWERS" s2="FEED THE NEXT SWEEP" />
      <Box x={580} y={296} owner="data" title="SOURCE LEDGER" s1="STRIKES + CREDITS PER" s2="CLAIM, 90-DAY WINDOW" />
      <polyline points="98,224 98,294" {...wire} />
      <text x={104} y={262} {...wireLbl}>BUILD</text>
      <line x1={168} y1={324} x2={226} y2={324} {...wire} />
      <text x={197} y={340} textAnchor="middle" {...wireLbl}>PUBLISH</text>
      <polyline points="282,224 282,268 466,268 466,294" {...wire} />
      <text x={294} y={262} {...wireLbl}>OPEN QUESTIONS</text>
      <polyline points="330,224 330,246 650,246 650,294" {...wire} markerStart="url(#eng-arr)" />
      <text x={356} y={240} {...wireLbl}>CALIBRATION CLAIMS DOWN, SOURCE CLASSES BACK UP</text>

      {/* row 4: the human seam */}
      <Box x={396} y={404} owner="human" title="HUMAN EDITOR" s1="RULES ON HELD ITEMS," s2="APPROVES NEW SOURCES" />
      <polyline points="466,352 466,402" {...wire} />
      <text x={472} y={382} {...wireLbl}>RULES</text>

      {/* discovery suggestions rail: agent finds, human reviews */}
      <polyline points="720,68 736,68 736,428 538,428" {...wire} />
      <text x={727} y={248} textAnchor="middle" {...wireLbl} transform="rotate(90 727 248)">SUGGESTED SOURCES + VOICES</text>

      {/* human-approved sources rail: back into the registry */}
      <polyline points="396,428 12,428 12,68 26,68" {...wire} />
      <text x={204} y={444} textAnchor="middle" {...wireLbl}>NEW SOURCES, HUMAN-REVIEWED</text>
    </svg>
  );
}

/** Scoring anatomy diagram: attested inputs, deterministic engine, stored output. */
function ScoringDiagram() {
  const box = { fill: "var(--bg-panel)", stroke: "var(--border-2)", strokeWidth: 1 };
  const lbl = {
    fill: "var(--text-1)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.08em",
  } as const;
  const sub = { ...lbl, fill: "var(--text-3)", fontSize: 8.5, fontWeight: 400 } as const;
  const wire = { stroke: "var(--border-2)", strokeWidth: 1 } as const;
  return (
    <svg viewBox="0 0 720 208" role="img" aria-label="SNR SCORING ANATOMY" style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x="8" y="20" width="200" height="168" {...box} />
      <text x="20" y="40" {...lbl}>INPUTS (ATTESTED)</text>
      <text x="20" y="62" {...sub}>LEAD SOURCE CLASS</text>
      <text x="20" y="78" {...sub}>EVERY SOURCE, WITH ITS CLASS</text>
      <text x="20" y="94" {...sub}>CORROBORATION CRAWL OUTCOME</text>
      <text x="20" y="110" {...sub}>EXTRAORDINARY-CLAIM FLAG</text>
      <text x="20" y="126" {...sub}>WHITELIST STANDING</text>
      <text x="20" y="150" {...sub}>THE AGENT SWEARS TO FACTS.</text>
      <text x="20" y="162" {...sub}>IT NEVER WRITES A NUMBER.</text>

      <rect x="260" y="20" width="200" height="168" {...box} />
      <text x="272" y="40" {...lbl}>ENGINE (CODE)</text>
      <text x="272" y="62" {...sub}>BASE TIER FROM LEAD CLASS</text>
      <text x="272" y="78" {...sub}>WIRE REWRITES COLLAPSE TO ONE</text>
      <text x="272" y="94" {...sub}>+1 PER CORROBORATION RULE</text>
      <text x="272" y="110" {...sub}>ANTI-SPOOF DOMAIN CHECKS</text>
      <text x="272" y="126" {...sub}>CEILINGS, FLOORS, PERSISTENCE</text>
      <text x="272" y="150" {...sub}>DETERMINISTIC: SAME INPUTS,</text>
      <text x="272" y="162" {...sub}>SAME SCORE, EVERY TIME.</text>

      <rect x="512" y="20" width="200" height="168" {...box} />
      <text x="524" y="40" {...lbl}>OUTPUT (STORED)</text>
      <text x="524" y="62" {...sub}>SNR 1-5, DRAWN AS BARS</text>
      <text x="524" y="78" {...sub}>FULL TRACE, APPEND-ONLY</text>
      <text x="524" y="94" {...sub}>EVERY MOVE ON THE PUBLIC LOG</text>
      <text x="524" y="110" {...sub}>CALIBRATION CLAIM IN LEDGER</text>
      <text x="524" y="150" {...sub}>SCORE AT PUBLICATION IS KEPT</text>
      <text x="524" y="162" {...sub}>AND CHECKED AGAINST OUTCOME.</text>

      <line x1="208" y1="104" x2="260" y2="104" {...wire} />
      <line x1="460" y1="104" x2="512" y2="104" {...wire} />
    </svg>
  );
}

const ABOUT_IMPACT_TIERS: Array<[string, string]> = [
  [
    "seismic",
    "Reshapes competitive dynamics: major M&A between tracked operators, an operator failure or bankruptcy, a flagship program cancelled, the first flight of a new orbital vehicle. A seismic claim resting on weak sourcing is auto-queued for human review while it publishes.",
  ],
  [
    "major",
    "A commercial director acts on it or briefs the team the same day: a contract or funding round with a stated value that changes the actor's trajectory, a regulatory grant or denial that changes what an operator may sell or where, a first-of-kind capability offered on commercial terms. The stated-value test is hard: the money or market access must be in the source, never inferred.",
  ],
  [
    "notable",
    "Worth the morning read: a routine-sized or unvalued award, an ordinary funding round, a milestone arriving on schedule, a partnership with named scope but unstated money. Commentary items cap here.",
  ],
  [
    "noise",
    "Belongs in the record, not the push: a scheduled launch succeeding on schedule, a routine product update, a minor partnership without stated money, capacity, or regulatory effect. Routine megaconstellation batch launches publish here, US and Chinese cadence alike.",
  ],
];

export function AboutPage() {
  return (
    <Layout current="about">
      <div className="about-page">
      <h1 className="page-title">about</h1>
      <p className="lede">
        Vesperio is a machine-maintained tracker for the new space economy. A deterministic data
        engine sweeps the industry twice a day, publishes everything on-scope at an honest
        confidence score, and shows its work: every source, every calculation, every correction,
        on the record. This page is the whole system, documented.
      </p>

      <section id="concept" className="qa">
        <h2>The site and the concept</h2>
        <p className="prose">
          Vesperio covers commercial Earth observation, connectivity constellations, launch,
          commercial human spaceflight, and the regulatory, financial, procurement, and
          geopolitical events that move them. Chinese, Indian, Japanese, and European activity
          gets equal weight to US activity. Coverage arrives on four surfaces: a news feed with a
          plain-English explainer per event, a registry of reference profiles for constellations,
          vehicles, spaceports, and organizations, computed statistics served with citation
          anchors, and a public log of every sweep the machine runs.
        </p>
        <p className="prose">
          The product promise is honest calibration. Nothing on-scope is withheld for sourcing
          reasons; instead, every item and every scored registry fact carries a visible
          signal-to-noise score from 1 to 5 whose calculation is stored and shown. A reader should
          never catch this site claiming more confidence than its sources support. Publishing an
          early signal at SNR 1 is the model working; publishing a weak claim dressed as a
          certainty is the failure the whole system exists to prevent. Whether the scores are
          honest is itself measured: each claim's score at publication is recorded and compared
          against how the claim resolves.
        </p>
      </section>

      <section id="engine" className="qa">
        <h2>The data engine</h2>
        <p className="prose">
          The engine separates fetching, judgment, and arithmetic, and trusts each to a different
          worker. A deterministic harvester fetches every feed-capable source on schedule,
          normalizes the entries, and collapses syndicated retellings of one story into a single
          candidate. A sweeping agent then works the queue: it filters against the published
          scope, fetches the pages feeds cannot cover, reads the whitelisted expert channels, runs
          an open-web discovery pass across a fixed query matrix, and crawls for corroboration on
          every candidate within a per-sweep fetch budget. What the agent produces is only a
          draft: facts, copy, and sworn statements about its sources.
        </p>
        <figure className="prose">
          <EngineDiagram />
        </figure>
        <p className="prose">
          The finalize gate is where drafts become data, and it is code, not prose. It validates
          the schema, enforces deduplication as arithmetic rather than agent memory, collapses
          wire rewrites into single corroboration units, verifies that first-party and
          official-record claims come from domains the registry actually records for the actor,
          computes every SNR score from the attested inputs, stamps the full trace, and records a
          calibration claim for each scored source in the ledger. A draft that skipped a mandatory
          pass, hand-wrote a score, or misclassified a source is rejected with the reason stated.
          The agent cannot bypass the gate, and the scheduled runs cannot reach anything else: they
          run without push credentials, with fetching as their only network capability, behind a
          diff guard that fails the run if anything outside the data files changed.
        </p>
        <p className="prose">
          Two feedback loops close the system. The source ledger scores the sources themselves: a
          claim that loses a same-metric contradiction is a strike against the source that carried
          it, a claim that started low and was later confirmed is a credit (early, not wrong), and
          repeated strikes demote a source's class inside a rolling window until confirmed claims
          win it back. The held queue is the human seam: schema conflicts, genuine same-metric
          contradictions, and open scope questions queue for the editor instead of being silently
          decided, and every quiet sweep still writes a public log entry saying why it was quiet.
        </p>
      </section>

      <section id="snr" className="qa">
        <h2>SNR and impact tiers</h2>
        <p className="prose">
          The name is borrowed from signal engineering. In a radio receiver, the signal-to-noise
          ratio measures how much of what comes through the antenna is the transmission you want
          versus the static behind it; a high ratio means you can trust what you are hearing, a
          low one means the message may be an artifact of the noise. Space news has the same
          physics: for every event there is a small amount of genuine, verifiable information and
          an unbounded amount of static around it, syndicated rewrites, rumours, embellished
          claims, outright fakes. The SNR score is this site's reading of that ratio for each
          claim: how much verified signal stands behind it relative to the noise it arrived in.
        </p>
        <p className="prose">
          Confidence and importance are independent axes, scored separately on every item. SNR
          reads how well the sources support the claim; impact reads how much the event matters
          commercially. A seismic rumour is seismic and low-SNR at once, and the two never blend.
        </p>
        <figure className="prose">
          <ScoringDiagram />
        </figure>
        <table className="tier-table">
          <tbody>
            {SNR_SCALE.map(([n, meaning]) => (
              <tr key={n}>
                <th scope="row">
                  <SnrLed snr={n} />
                  <span className="tier-tag">
                    {n}/5 · {SNR_WORDS[n]}
                  </span>
                </th>
                <td>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="prose">
          The mechanics in brief: the lead source's class sets the base tier, corroboration raises
          it once per rule (a second distinct source, a fourth, pickup by a mainstream outlet
          beyond the lead), and no amount of indirect corroboration reaches 5, which is reserved
          for direct sources: the actor itself or an official record. Extraordinary claims start
          at 1 regardless of source count. Fourteen uncontested days earn one point, once, never
          above 4. A vetted expert on the signals whitelist floors an on-topic factual claim at 4
          as an observer and 5 when the concerned party speaks about itself. Scores move over an
          item's life, traces are append-only, and every movement renders on the public log. The
          full rulebook follows.
        </p>
        <div id="methodology">
        <div className="qa-pair">
          <h3>where a score starts</h3>
          <table className="tier-table">
            <tbody>
              <tr>
                <th scope="row">
                  <SnrLed snr={5} />
                  <span className="tier-tag">STARTS AT 5</span>
                </th>
                <td>First-party statements, official records, directly computed data.</td>
              </tr>
              <tr>
                <th scope="row">
                  <SnrLed snr={4} />
                  <span className="tier-tag">STARTS AT 4</span>
                </th>
                <td>Press-wire copy and established aggregators.</td>
              </tr>
              <tr>
                <th scope="row">
                  <SnrLed snr={3} />
                  <span className="tier-tag">STARTS AT 3</span>
                </th>
                <td>Trade and mainstream press; a whitelisted voice before any floor applies.</td>
              </tr>
              <tr>
                <th scope="row">
                  <SnrLed snr={1} />
                  <span className="tier-tag">STARTS AT 1</span>
                </th>
                <td>Informal but identifiable sources. A source no one can name never publishes.</td>
              </tr>
            </tbody>
          </table>
          <p className="prose">
            The first-party test is strict: could the linked page be wrong about the fact without
            the actor or an official record being wrong? If yes, it is not first-party.
          </p>
        </div>
        <div className="qa-pair">
          <h3>what counts as one source</h3>
          <div className="rule-grid">
            <span className="rule-delta">= 1</span>
            <span>URL variants of one article.</span>
            <span className="rule-delta">= 1</span>
            <span>Multiple pages on one registrable domain.</span>
            <span className="rule-delta">= 1</span>
            <span>
              Near-identical headlines across domains (64-bit SimHash fingerprint, Hamming
              distance 3 or less): one wire story, rewritten.
            </span>
          </div>
          <p className="prose">
            Syndication is the cheapest way to fake breadth, so sources collapse into units before
            any corroboration is counted. The item keeps every link for the reader; the units
            drive the math; every collapse is logged.
          </p>
        </div>
        <div className="qa-pair">
          <h3>how corroboration moves it</h3>
          <div className="rule-grid">
            <span className="rule-delta delta-pos">+1</span>
            <span>A second distinct unit.</span>
            <span className="rule-delta delta-pos">+1</span>
            <span>A fourth distinct unit.</span>
            <span className="rule-delta delta-pos">+1</span>
            <span>Pickup by a mainstream outlet beyond the lead reporter.</span>
            <span className="rule-delta delta-neg">-1</span>
            <span>
              A corroboration crawl that ran and found nothing. "Nothing else reports this" is a
              claim about the world; it should hurt to be wrong about it.
            </span>
            <span className="rule-delta delta-zero">0</span>
            <span>
              A crawl the budget never reached: recorded as not attempted, never dressed up as a
              result. Direct sources prove their own statements and pay no crawl penalty.
            </span>
          </div>
          <p className="prose">
            Each rule fires at most once per claim, and there is a hard ceiling: no amount of
            second-hand corroboration reaches 5. Wide reporting IS the definition of 4; 5 is
            reserved for the actor speaking for itself or an official record.
          </p>
        </div>
        <div className="qa-pair">
          <h3>scores keep moving after publication</h3>
          <div className="rule-grid">
            <span className="rule-delta delta-pos">+1</span>
            <span>
              REINFORCEMENT: a matching event lands 8 to 30 days after an item published at 1 or
              2. Once per item. Early, not wrong, and the score says so retroactively.
            </span>
            <span className="rule-delta delta-pos">+1</span>
            <span>
              PERSISTENCE: 14 days uncontested, once, never past 4. Time is weak evidence; it
              counts a little and caps early.
            </span>
          </div>
          <p className="prose">
            Every movement is appended to the stored calculation and listed on the log. History is
            append-only: earlier steps are never rewritten to flatter the present score.
          </p>
        </div>
        <div className="qa-pair">
          <h3>extraordinary claims</h3>
          <div className="rule-grid">
            <span className="rule-delta">&rarr; 1</span>
            <span>
              An out-of-pattern claim resets to 1 whatever its source count and climbs only
              through corroboration and survival.
            </span>
            <span className="rule-delta">&rarr; 1</span>
            <span>
              Any market-reshaping claim led by anything below first-party: extraordinary
              automatically, by code, and queued for human review even while it publishes.
            </span>
          </div>
        </div>
        <div className="qa-pair">
          <h3>when sources disagree</h3>
          <div className="rule-grid">
            <span className="rule-delta delta-zero">0</span>
            <span>
              Different metrics (launched satellites versus operational ones): annotated, never
              punished. Both numbers can be true.
            </span>
            <span className="rule-delta delta-neg">-1</span>
            <span>Same metric, unequal sourcing: the better-sourced side leads, the loser pays.</span>
            <span className="rule-delta">HOLD</span>
            <span>
              Same metric, equal sourcing: both claims marked disputed, kept visible side by side,
              queued for a human ruling.
            </span>
          </div>
        </div>
        <div className="qa-pair">
          <h3>the signals-list floor</h3>
          <div className="rule-grid">
            <span className="rule-delta">&ge; 4</span>
            <span>A whitelisted person states an on-topic fact on a verified channel.</span>
            <span className="rule-delta">&ge; 5</span>
            <span>The person speaks for the actor concerned, about itself.</span>
            <span className="rule-delta delta-zero">0</span>
            <span>Jokes, opinions, off-topic posts: no floor.</span>
          </div>
          <p className="prose">
            The list is curated by a human; the software that ingests the web cannot edit it.
          </p>
        </div>
        <div className="qa-pair">
          <h3>fakes and spoofs</h3>
          <div className="rule-grid">
            <span className="rule-delta">GATE</span>
            <span>
              First-party and official record count only when the domain matches the actor's
              registry-recorded website or an official register. Fake press releases are a
              documented attack.
            </span>
            <span className="rule-delta">&le; 4</span>
            <span>A press-wire copy caps until the actor's own domain confirms.</span>
            <span className="rule-delta delta-zero">0</span>
            <span>
              A superlative in a release ("largest constellation") is attributed as a statement,
              never scored or repeated as fact.
            </span>
          </div>
        </div>
        <div className="qa-pair">
          <h3>sources are graded too</h3>
          <div className="rule-grid">
            <span className="rule-delta">STRIKE</span>
            <span>A claim that lost a same-metric contradiction.</span>
            <span className="rule-delta">CREDIT</span>
            <span>A claim that started at 1 or 2 and was later confirmed. Early, not wrong.</span>
          </div>
          <p className="prose">
            Repeated strikes inside a rolling 90-day window demote a source's class in future
            scoring; demotion decays, and confirmed claims win the class back. Sources that keep
            producing independently confirmed early claims are suggested for the signals list; a
            human makes that call.
          </p>
        </div>
        <div className="qa-pair">
          <h3>what the score is not</h3>
          <p className="prose">
            Not importance: that is the impact label, an independent axis, and a seismic rumour is
            seismic AND low-SNR at once. Not an endorsement of opinions: commentary items score
            the attribution, never the take. And not a promise of truth: a promise that the
            confidence shown matches the evidence held.
          </p>
        </div>
        <div className="qa-pair">
          <h3>stored, shown, and checked</h3>
          <p className="prose">
            Every score is saved with its full calculation and can be opened under any mark on the
            site. Each claim's score at publication is kept permanently, even after later bumps,
            and compared against how the claim resolves: confirmed, debunked, or expired quiet.
            The running tally per level is public on the{" "}
            <a href="/system/#calibration">sweep log</a>. If our 2s turn out right as often as our
            4s, the scale is broken and the record will show it.
          </p>
        </div>
        </div>
        <div className="qa-pair" id="impact">
          <h3>The four impact tiers</h3>
          <table className="tier-table">
            <tbody>
              {ABOUT_IMPACT_TIERS.map(([tier, meaning]) => (
                <tr key={tier}>
                  <th scope="row">
                    <span className={`chip chip-${tier}`}>{tier}</span>
                  </th>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="prose">
            When torn between two tiers, the machine takes the lower one. The feed's credibility
            is spent on restraint.
          </p>
        </div>
      </section>

      <section id="registry-method" className="qa">
        <h2>How the registry is populated</h2>
        <p className="prose">
          Registry profiles are reference data, so the bar is different from news: a fact needs
          SNR 3 or better to enter at all, and it enters as one of two tiers. Facts at SNR 3 are
          provisional, visibly badged, and never adjudicate a dispute; facts at SNR 4 and 5,
          first-party statements, Wikipedia reference fields, and computed figures are canonical.
          Every field carries its source URL and an as-of date. Unknown fields stay null: nothing
          is ever estimated, interpolated, or summed across sources.
        </p>
        <p className="prose">Population runs through four channels:</p>
        <table className="profile">
          <thead>
            <tr>
              <th>channel</th>
              <th>what enters</th>
              <th>cadence</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">COMPUTED</th>
              <td>
                Satellite counts from public orbital catalogs, launch cadence from the Launch
                Library. Authoritative only for exactly what they measure: cataloged objects on a
                date, never claims like operational or announced.
              </td>
              <td>DAILY</td>
            </tr>
            <tr>
              <th scope="row">CROSSFEED</th>
              <td>
                Registry-grade metrics stated by published news items, after a like-for-like
                metric test. Fills only null fields, never overwrites.
              </td>
              <td>EVERY SWEEP</td>
            </tr>
            <tr>
              <th scope="row">MAINTENANCE</th>
              <td>
                Factual-field refresh from primary pages and established aggregators. Appends
                sourced values; never restructures a profile.
              </td>
              <td>WEEKLY</td>
            </tr>
            <tr>
              <th scope="row">CURATED</th>
              <td>
                Fill crawls and new profiles, built interactively and reviewed by the editor
                before merge. The only channel that may add fields or entities.
              </td>
              <td>REVIEWED</td>
            </tr>
          </tbody>
        </table>
        <p className="prose">
          Source preference is fixed at every step: primary beats aggregator, aggregator beats
          Wikipedia and press, a quantified figure beats a vague one, and a disputed field keeps
          both claims visible with their own scores. Structural changes, new fields or new
          entities, happen only through reviewed changes, never inside a scheduled run.
        </p>
      </section>

      <section id="verification-policy" className="qa">
        <h2>FAQ</h2>
        {QA.map(([q, a]) => (
          <div className="qa-pair" key={q}>
            <h3>{q}</h3>
            <p className="prose">{a}</p>
          </div>
        ))}
      </section>
      </div>
    </Layout>
  );
}

// ------------------------------------------------------------- methodology

/** Reader-facing SNR scale: the 1-5 meanings, rewritten from the spec
    for a commercial reader (the spec table is written for the agent). */
const SNR_SCALE: Array<[number, string]> = [
  [
    1,
    "Low confidence. A single source, a rumour, or an out-of-pattern claim with little behind it.",
  ],
  [
    2,
    "A little more: more than one source, one usually-reliable source, or an early signal that later reporting matched (a 1 upgraded retroactively; see below).",
  ],
  [
    3,
    "A few reputable sources: trade press, established media, or an industry-leader account.",
  ],
  [
    4,
    "Widely reported: many sources, an established aggregator, or a long-standing claim nothing has contradicted.",
  ],
  [
    5,
    "Quasi-certainty. The actor itself or an official record: a release on the company's own site, an official filing, or direct observational data.",
  ],
];



// ------------------------------------------------------------------ digest

/** One item row in the weekly digest: headline link, tagline, date, chip. */
function DigestList({ items }: { items: DataFor<"digest">["seismic"] }) {
  return (
    <ul className="digest-list">
      {items.map((it) => (
        <li key={it.id} className="digest-item">
          <div className="card-meta">
            <a className="chip" href={`/news/${it.category}/`}>
              {it.category}
            </a>
            <span className="date">{it.date}</span>
          </div>
          <h3 className="digest-headline">
            <a href={`/item/${it.id}/`}>{it.headline}</a>
          </h3>
          <p className="digest-tagline">{it.tagline}</p>
        </li>
      ))}
    </ul>
  );
}

export function DigestPage({ data }: { data: DataFor<"digest"> }) {
  const { seismic, major, notable, movements, quietSweeps, from, to, windowDays } = data;
  const total = seismic.length + major.length + notable.length;
  const empty = total === 0 && movements.length === 0 && quietSweeps.length === 0;
  return (
    <Layout current="system">
      <h1 className="page-title">weekly digest</h1>
      <p className="lede">
        The last {windowDays} days at a glance: the week's items by importance, the scores that
        moved, and the sweeps that were quiet. <a href="/system/">← sweep log</a>
      </p>
      <p className="dim mono">
        // {from} to {to} · {total} item{total === 1 ? "" : "s"}
      </p>
      {empty ? (
        <p className="empty">Nothing to report in the last {windowDays} days</p>
      ) : (
        <>
          {seismic.length > 0 && (
            <section className="panel">
              <h2>seismic</h2>
              <DigestList items={seismic} />
            </section>
          )}
          {major.length > 0 && (
            <section className="panel">
              <h2>major</h2>
              <DigestList items={major} />
            </section>
          )}
          {notable.length > 0 && (
            <section className="panel">
              <h2>notable</h2>
              <DigestList items={notable} />
            </section>
          )}
          {movements.length > 0 && (
            <section className="panel">
              <h2>snr movements this week</h2>
              <ul className="snr-moves">
                {movements.map((m) => (
                  <li key={`${m.id}-${m.from}-${m.to}`}>
                    <a href={`/item/${m.id}/`}>{m.id}</a>{" "}
                    <span className={m.to > m.from ? "snr-up" : "snr-down"}>
                      {m.from}→{m.to}
                    </span>{" "}
                    <span className="dim">{m.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {quietSweeps.length > 0 && (
            <section className="panel">
              <h2>quiet sweeps</h2>
              <p className="dim">
                Sweeps that added nothing, and why. A quiet day explained is a trust signal, not a
                gap.
              </p>
              <ul className="mono dim">
                {quietSweeps.map((s) => (
                  <li key={s.at}>
                    {formatSweepTimestamp(s.at)} · {s.summary}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
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

/** One sweep's panel: timestamp, counters, summary, passes, SNR moves,
    and coverage tags. Shared by /system and the monthly archive pages. */
function SweepEntry({ sweep: s }: { sweep: SweepLogEntry }) {
  return (
    <section className="panel">
      <div className="card-meta">
        <span
          className={`sweep-status ${s.added > 0 ? "sweep-status-live" : "sweep-status-quiet"}`}
          aria-hidden="true"
        >
          {s.added > 0 ? "●" : "◆"}
        </span>
        <span>{formatSweepTimestamp(s.at)}</span>
        <span className="chip">+{s.added}</span>
        <span className="chip">~{s.updated}</span>
        {s.held > 0 && <span className="chip">{s.held} held</span>}
        {s.mode === "deep" && <span className="chip chip-deep">deep sweep</span>}
      </div>
      <p className="sweep-summary">{s.summary}</p>
      {s.signals && (
        <p className="sweep-signals mono dim" title={s.signals.note}>
          Signals pass: {s.signals.checked} channel{s.signals.checked === 1 ? "" : "s"}{" "}
          checked · {s.signals.x_attempted} X handle
          {s.signals.x_attempted === 1 ? "" : "s"} searched
          <span className="sweep-signals-note"> · {s.signals.note}</span>
        </p>
      )}
      {s.discovery && (
        <p className="sweep-signals mono dim" title={s.discovery.note}>
          Discovery pass: {s.discovery.queries} quer{s.discovery.queries === 1 ? "y" : "ies"}
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
  );
}

/** Trailing-30-day KPI row at the top of the /system/ log spine. Compact fact grid, mono
    data voice; each cell states exactly what it measures. All numbers are
    computed at build time (page-data-server), never stored as facts. */
function LogKpiRow({ kpis }: { kpis: DataFor<"system">["kpis"] }) {
  // Tooltip notes start uppercase in source (no sentence starts lowercase,
  // Florian): native title bubbles cannot be styled by CSS guards.
  const cells: Array<[string, string, string]> = [
    ["items / day", kpis.itemsPerDay.toFixed(1), "Published items in the window, per day"],
    ["lead domains", String(kpis.leadDomains), "Distinct lead-source domains in the window"],
    ["snr ≤2 share", `${kpis.pctLowSnr}%`, "Share of window items scored 1 or 2"],
    [
      "crossfeed queued",
      String(kpis.crossfeedQueued),
      "Registry crossfeed candidates queued, proposed in the window",
    ],
    [
      "claims resolved",
      String(kpis.claimsResolved),
      "Calibration claims confirmed or debunked in the window",
    ],
    [
      "signals-sourced",
      String(kpis.signalsSourced),
      "Window items floored by a signals-list source",
    ],
  ];
  return (
    <div className="log-kpis">
      <p className="dim mono kpi-caption">
        Trailing {kpis.windowDays} days · {kpis.itemCount} item
        {kpis.itemCount === 1 ? "" : "s"} published
      </p>
      <div className="fact-grid">
        {cells.map(([label, value, note]) => (
          <div className="fact-cell" key={label} title={note}>
            <span className="fact-label">{label}</span>
            <span className="fact-value mono">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Techmeme-style lead-source presence: which outlets led the window's
    items. Full list computed server-side; capped at 20 rows here with an
    explicit "+N more" so nothing is silently dropped. */
function LogPresence({
  presence,
  windowDays,
}: {
  presence: DataFor<"system">["presence"];
  windowDays: number;
}) {
  const CAP = 20;
  const rows = presence.slice(0, CAP);
  const more = presence.length - rows.length;
  return (
    <section className="panel" id="lead-source-presence">
      <h2>lead-source presence ({windowDays}d)</h2>
      <p className="prose">
        Which outlets led the window's items, most-cited first. The lead source sets each item's
        base score, so a feed leaning on a few domains is a concentration worth seeing.
      </p>
      {presence.length === 0 ? (
        <p className="empty">No items in the window</p>
      ) : (
        <table className="profile">
          <thead>
            <tr>
              <th>lead source</th>
              <th>items</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.domain}>
                <th scope="row">{r.domain}</th>
                <td>{r.count}</td>
              </tr>
            ))}
            {more > 0 && (
              <tr>
                <td className="dim" colSpan={2}>
                  +{more} more domain{more === 1 ? "" : "s"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Compact email subscribe unit: a native Buttondown embed form posting to
 * the live account (buttondown.com/vesperio, Florian 2026-07-12) in THIS
 * tab. Deliberately no target="_blank" (popup blockers swallowed the whole
 * submission silently) and no fetch/XHR (Buttondown risk-screens posts; a
 * challenged submission answers 400 with a "Verify Your Subscription" page
 * the human must SEE and complete — a background fetch reports success
 * while recording nothing; both failure modes verified 2026-07-12). The
 * same-tab native post always renders Buttondown's response: confirmation
 * on success, the verification page when challenged. */
function SubscribeForm() {
  return (
    <div className="subscribe">
      <p className="subscribe-label">The week&rsquo;s signal, mailed</p>
      <p className="subscribe-copy">One email a week. The same feed, ranked, nothing extra.</p>
      <form
        action="https://buttondown.com/api/emails/embed-subscribe/vesperio"
        method="post"
        className="subscribe-form"
        aria-label="Newsletter subscription"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="you@company.com"
          className="subscribe-input"
          aria-label="Email address"
        />
        <button type="submit" className="subscribe-btn">
          subscribe
        </button>
      </form>
    </div>
  );
}

/** The log spine of the merged /system/ page (Florian, 2026-07-11): the
 * lede, KPI band, sweep entries, archive chips, source health, ledger,
 * lead-source presence, and calibration. No Layout wrapper and no page
 * title: SystemPage owns the shell and the shared <h1>. */
function LogBody({ data }: { data: DataFor<"system"> }) {
  const { sweeps, totals, ledgerSources, calibrationBuckets, archiveMonths, sourceProblems, kpis, presence } =
    data;
  return (
    <div className="system-log">
      <p className="lede">
        Every sweep the machine ran, including the quiet ones. No items is a valid result; an
        unexplained gap is not.
      </p>
      <p className="dim mono">
        {totals.count} sweep{totals.count === 1 ? "" : "s"} · +{totals.added} added · ~
        {totals.updated} updated · {totals.held} held
      </p>
      <LogKpiRow kpis={kpis} />
      {sweeps.length === 0 ? (
        <p className="empty">No sweeps logged yet</p>
      ) : (
        sweeps.map((s) => <SweepEntry key={s.at} sweep={s} />)
      )}
      {archiveMonths.length > 0 && (
        <section className="panel" id="archive">
          <h2>archive</h2>
          <p className="dim mono sec-mark">Older sweeps, by month</p>
          <div className="tag-row">
            {archiveMonths.map((m) => (
              <a key={m} className="chip chip-tag" href={`/system/${m}/`}>
                {m}
              </a>
            ))}
          </div>
        </section>
      )}
      <section className="panel" id="source-health">
        <h2>source health</h2>
        <p className="prose">
          Sources the harvester currently cannot use: dead means the fetch itself fails (three
          consecutive failures; re-probed weekly), stale means the source answers but its content
          stopped moving. An honest gap list beats a silent one.
        </p>
        {sourceProblems.length === 0 ? (
          <p className="empty">Every registered source is fetchable and fresh</p>
        ) : (
          <ul className="mono dim">
            {sourceProblems.map((s) => (
              <li key={s.name}>
                {s.status}: {s.name}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel" id="source-ledger">
        <h2>source ledger</h2>
        <p className="prose">
          Rolling per-source reliability record (90-day window): strikes for claims that lost a
          same-metric contradiction, credits for claims that started low and were later confirmed.
          Machine-owned, human-audited; demotions and recoveries follow the thresholds in the
          public spec.
        </p>
        {ledgerSources.length === 0 ? (
          <p className="empty">No reliability events recorded yet</p>
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
      <LogPresence presence={presence} windowDays={kpis.windowDays} />
      <section className="panel" id="calibration">
        <h2>calibration</h2>
        <p className="prose">
          Whether the scores are honest is itself measured: every claim records its SNR at
          publication and how it later resolved. Confirmed means the claim reached SNR 4+
          independent of any whitelist floor, or a direct source landed; debunked means it lost a
          same-metric contradiction. Unresolved counts include claims still maturing and claims
          expired without a signal either way.
        </p>
        {calibrationBuckets.length === 0 ? (
          <p className="empty">No scored claims recorded yet</p>
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
    </div>
  );
}

/** The merged System page (Florian, 2026-07-11): Stats and Log fused at
 * /system/. Desktop grid = the log spine on the LEFT (the page's backbone:
 * lede, KPIs, sweeps, ledger, calibration, archive) and the stats rail
 * STICKY on the right (~340px). Mobile stacks to one column with the stats
 * band FIRST (CSS order), then the log. Both old URLs (/stats/, /log/)
 * 301-redirect here via public/_redirects; the anchor ids on every stat
 * block are preserved so #launch-cadence etc. keep resolving. */
export function SystemPage({
  data,
  generatedAt,
}: {
  data: DataFor<"system">;
  generatedAt: string;
}) {
  return (
    <Layout current="system">
      <h1 className="page-title">system</h1>
      <div className="system-grid">
        <LogBody data={data} />
        <StatsRail hero={data.hero} blocks={data.blocks} generatedAt={generatedAt} />
      </div>
    </Layout>
  );
}

/** A month's archived sweeps, rendered from the same entry component as the
 * /system/ log spine. */
export function LogArchivePage({ data }: { data: DataFor<"log-archive"> }) {
  return (
    <Layout current="system">
      <div className="log-archive">
        <h1 className="page-title sec-mark">sweep log · {data.month}</h1>
        <p className="lede">Archived sweep entries from {data.month}.</p>
        {data.sweeps.length === 0 ? (
          <p className="empty">No sweeps in this month</p>
        ) : (
          data.sweeps.map((s) => <SweepEntry key={s.at} sweep={s} />)
        )}
        <p>
          <a href="/system/">Back to the sweep log</a>
        </p>
      </div>
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
