/**
 * 6A layer rail (design handoff 2026-07-06): every row sits on one
 * strict 5-column grid (expander | name | count | SAT | ORB). SAT is
 * the per-layer cloud toggle (square, many on); ORB is the single
 * focus control (circle, one at a time). Categories and fleets
 * collapse; the default state fits every row without internal scroll.
 * Purely presentational; scene.tsx owns all state.
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { ConstellationDomain } from "../data/schema";

/**
 * Scroll container with a fully bespoke scrollbar: the native scrollbar
 * is hidden and a custom thumb overlay is driven in JS, so it looks the
 * same across browsers and never falls back to the OS overlay bar
 * (Florian 2026-07-07). The thumb overlays the right gutter (no reserved
 * width) and is draggable.
 */
function Scroller({ children }: { children: ReactNode }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const update = useCallback(() => {
    const body = bodyRef.current;
    const thumb = thumbRef.current;
    if (!body || !thumb) return;
    const { scrollTop, scrollHeight, clientHeight } = body;
    if (scrollHeight <= clientHeight + 1) {
      thumb.style.opacity = "0";
      return;
    }
    const trackH = clientHeight;
    const h = Math.max(28, (clientHeight / scrollHeight) * trackH);
    const maxScroll = scrollHeight - clientHeight;
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * (trackH - h) : 0;
    thumb.style.opacity = "1";
    thumb.style.height = `${h}px`;
    thumb.style.transform = `translateY(${top}px)`;
  }, []);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    update();
    body.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(body);
    const mo = new MutationObserver(update);
    mo.observe(body, { childList: true, subtree: true });
    return () => {
      body.removeEventListener("scroll", update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [update]);

  const onThumbDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const body = bodyRef.current;
    if (!body) return;
    const startY = e.clientY;
    const startScroll = body.scrollTop;
    const move = (ev: globalThis.PointerEvent) => {
      const b = bodyRef.current;
      if (!b) return;
      const h = Math.max(28, (b.clientHeight / b.scrollHeight) * b.clientHeight);
      const maxTop = b.clientHeight - h;
      const maxScroll = b.scrollHeight - b.clientHeight;
      b.scrollTop = startScroll + (maxTop > 0 ? ((ev.clientY - startY) / maxTop) * maxScroll : 0);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="rl-scroll">
      <div className="rl-body" ref={bodyRef}>
        {children}
      </div>
      <div className="rl-scrollbar" aria-hidden="true">
        <div className="rl-scrollbar-thumb" ref={thumbRef} onPointerDown={onThumbDown} />
      </div>
    </div>
  );
}

export interface RailRow {
  slug: string;
  name: string;
  /** Fleet parent (gets the FLEET suffix + expander). */
  fleet: boolean;
  /** Nested under a fleet (indent + tree rule). */
  child: boolean;
  count: number | null;
  cloudOn: boolean;
  focused: boolean;
  status: "ok" | "loading" | "stale" | "missing";
  staleHours: number | null;
  collapsed: boolean;
}

export interface RailCategory {
  id: ConstellationDomain;
  label: string;
  colorToken: string;
  count: number;
  cloudOn: boolean;
  collapsed: boolean;
  rows: RailRow[];
}

export interface RailProps {
  categories: RailCategory[];
  trackedTotal: number;
  allOff: boolean;
  spaceports: { on: boolean; count: number | null };
  facilities: { on: boolean; count: number | null };
  onToggleCloud(slug: string): void;
  onFocus(slug: string): void;
  onToggleCategoryCloud(id: ConstellationDomain): void;
  onToggleCollapse(key: string): void;
  onToggleSpaceports(): void;
  onToggleFacilities(): void;
  onRestoreDefaults(): void;
}

function SatToggle({
  on,
  label,
  onClick,
  disabled,
}: {
  on: boolean;
  label: string;
  onClick(): void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`rl-sat${on ? " rl-sat-on" : ""}`}
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    />
  );
}

function OrbToggle({
  on,
  label,
  onClick,
  disabled,
}: {
  on: boolean;
  label: string;
  onClick(): void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`rl-orb${on ? " rl-orb-on" : ""}`}
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    />
  );
}

function Row({ row, p }: { row: RailRow; p: RailProps }) {
  const loading = row.status === "loading";
  return (
    <div className={`rl-row${row.child ? " rl-child" : ""}${row.focused ? " rl-focused" : ""}`}>
      <span className="rl-cell-exp">
        {row.fleet && (
          <button
            type="button"
            className="rl-exp"
            aria-label={row.collapsed ? `Expand ${row.name}` : `Collapse ${row.name}`}
            onClick={() => p.onToggleCollapse(row.slug)}
          >
            {row.collapsed ? "+" : "−"}
          </button>
        )}
        {row.child && <span className="rl-tree" aria-hidden="true" />}
      </span>
      <span className={`rl-name${loading ? " rl-name-loading" : ""}`}>
        <a
          className="rl-name-link"
          href={`/registry/constellations/${row.slug}/`}
          title={`${row.name} registry profile`}
        >
          {row.name.toUpperCase()}
        </a>
        {row.fleet && <span className="rl-fleet-tag"> FLEET</span>}
        {row.status === "stale" && row.staleHours !== null && (
          <span className="rl-stale">STALE {row.staleHours}H</span>
        )}
      </span>
      <span className="rl-count">{loading ? "···" : (row.count ?? "")}</span>
      <SatToggle
        on={row.cloudOn}
        disabled={loading}
        label={`${row.cloudOn ? "Hide" : "Show"} the ${row.name} satellite cloud`}
        onClick={() => p.onToggleCloud(row.slug)}
      />
      <OrbToggle
        on={row.focused}
        disabled={loading}
        label={row.focused ? "Clear focus" : `Focus ${row.name}: orbits and labels`}
        onClick={() => p.onFocus(row.slug)}
      />
    </div>
  );
}

export function LayerRail(p: RailProps) {
  return (
    <div className="rail opanel6">
      <div className="rl-head">
        <span className="rl-title">LAYERS</span>
        <span className="rl-tracked">{p.trackedTotal} TRACKED</span>
      </div>
      <div className="rl-cols">
        <span />
        <span>CONSTELLATION</span>
        <span className="rl-count">CT</span>
        <span className="rl-col-c">SAT</span>
        <span className="rl-col-c">ORB</span>
      </div>

      <Scroller>
        {p.allOff ? (
          <div className="rl-empty">
            <div>NO LAYERS ACTIVE</div>
            <button type="button" className="rl-restore" onClick={p.onRestoreDefaults}>
              [ RESTORE DEFAULTS ]
            </button>
          </div>
        ) : null}
        {p.categories.map((cat) => (
          <div key={cat.id}>
            <div className="rl-row rl-cat">
              <span className="rl-cell-exp">
                <button
                  type="button"
                  className="rl-exp"
                  aria-label={cat.collapsed ? `Expand ${cat.label}` : `Collapse ${cat.label}`}
                  onClick={() => p.onToggleCollapse(`cat:${cat.id}`)}
                >
                  {cat.collapsed ? "+" : "−"}
                </button>
              </span>
              <span className="rl-cat-name">
                <i className="rl-swatch" style={{ background: `var(${cat.colorToken})` }} />
                {cat.label}
              </span>
              <span className="rl-count">{cat.count}</span>
              <SatToggle
                on={cat.cloudOn}
                label={`${cat.cloudOn ? "Hide" : "Show"} every ${cat.label} layer`}
                onClick={() => p.onToggleCategoryCloud(cat.id)}
              />
              <span />
            </div>
            {!cat.collapsed && cat.rows.map((row) => <Row key={row.slug} row={row} p={p} />)}
          </div>
        ))}

        <div className="rl-ground-label">GROUND</div>
        <div className="rl-row">
          <span />
          <span className="rl-name">SPACEPORTS</span>
          <span className="rl-count">{p.spaceports.count ?? ""}</span>
          <SatToggle
            on={p.spaceports.on}
            label={`${p.spaceports.on ? "Hide" : "Show"} spaceports`}
            onClick={p.onToggleSpaceports}
          />
          <span />
        </div>
        <div className="rl-row">
          <span />
          <span className="rl-name">FACILITIES &amp; HQS</span>
          <span className="rl-count">{p.facilities.count ?? ""}</span>
          <SatToggle
            on={p.facilities.on}
            label={`${p.facilities.on ? "Hide" : "Show"} facilities and HQs`}
            onClick={p.onToggleFacilities}
          />
          <span />
        </div>
      </Scroller>

      <div className="rl-key">
        <span>
          <b>SAT</b> DRAW SATELLITE CLOUD
        </span>
        <span>
          <b>ORB</b> FOCUS ORBITS + LABELS (ONE AT A TIME)
        </span>
      </div>
    </div>
  );
}
