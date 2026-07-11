/**
 * 6A chrome around the globe (design handoff 2026-07-06): the left HUD
 * column (LCD readouts, launch countdown, orbital flow chart, vehicle
 * ranking), the VIEW cluster, and the footer bar. Purely presentational;
 * scene.tsx owns state and data.
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { OrbitsStatsFile } from "../data/schema";

// ------------------------------------------------ launch/vehicle links

/**
 * Compact link lookups the countdown and vehicle rail need, threaded
 * from OrbitsPage's PageData slice via context (chrome must not import
 * the dataset: it would drag item headlines into the lazy scene chunk).
 * The default is empty so SSR and any render outside a provider are safe.
 */
export interface OrbitsLinkData {
  linkItems: { id: string; headline: string; tagline: string }[];
  vehicleLinks: { name: string; slug: string }[];
}

const OrbitsLinkContext = createContext<OrbitsLinkData>({ linkItems: [], vehicleLinks: [] });

export const OrbitsLinkProvider = OrbitsLinkContext.Provider;

// ---------------------------------------------------------------- LCD

/** Amber 7-segment display with a ghost "888" layer underneath. */
function Lcd({ value, className }: { value: string; className: string }) {
  // DSEG7 has digits and the colon but no comma; commas render as lit
  // mono glyphs between segment groups.
  const parts = value.split(",");
  // Optical ink centering: a leading 7-seg "1" leaves its cell's left
  // half dark; shift the grid by half that dead space (rounds 12/34).
  // A sign cell doesn't count — the first DIGIT decides.
  const core = value.startsWith("-") ? value.slice(1) : value;
  const lead1 = core.startsWith("1") ? " lcd-lead-1" : "";
  return (
    <span className={`lcd ${className}${lead1}`}>
      {parts.map((part, i) => (
        <span key={i} className="lcd-part">
          {i > 0 && <span className="lcd-comma">,</span>}
          <span className="lcd-cell">
            <span className="lcd-ghost" aria-hidden="true">
              {part.replace(/[0-9]/g, "8")}
            </span>
            <span className="lcd-lit">{part}</span>
          </span>
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------- countdown

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Where a countdown click lands (Florian 2026-07-06): the feed item
 * covering the mission when one exists, else the vehicle's registry
 * profile, else nowhere. LL2 names launches "Vehicle | Mission".
 */
function launchHref(
  next: OrbitsStatsFile["upcoming"][number],
  links: OrbitsLinkData,
): string | null {
  // Hyphen/space variants ("Transporter 17" vs "Transporter-17") match.
  const norm = (s: string) => s.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
  const missionRaw = next.name.split(" | ")[1] ?? next.name;
  const mission = norm(missionRaw.replace(/\(.*?\)/g, "").trim());
  if (mission.length >= 4) {
    const item = links.linkItems.find(
      (i) => norm(i.headline).includes(mission) || norm(i.tagline).includes(mission),
    );
    if (item) return `/item/${item.id}/`;
  }
  const vname = next.vehicle.toLowerCase();
  const veh = links.vehicleLinks
    .filter((v) => {
      const n = v.name.toLowerCase();
      return vname.startsWith(n) || n.startsWith(vname);
    })
    .sort((a, b) => b.name.length - a.name.length)[0];
  return veh ? `/registry/vehicles/${veh.slug}/` : null;
}

/** Ticks locally each second; rolls to the next launch at T-0. */
function Countdown({ upcoming }: { upcoming: OrbitsStatsFile["upcoming"] }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const links = useContext(OrbitsLinkContext);
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const next = upcoming.find((u) => new Date(u.net).getTime() > nowMs);
  if (!next) return null;

  const diff = Math.max(0, new Date(next.net).getTime() - nowMs);
  const days = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000) % 24;
  const m = Math.floor(diff / 60000) % 60;
  const s = Math.floor(diff / 1000) % 60;
  const netDate = new Date(next.net);
  const netLabel = `${pad2(netDate.getUTCMonth() + 1)}-${pad2(netDate.getUTCDate())} ${pad2(netDate.getUTCHours())}:${pad2(netDate.getUTCMinutes())}Z`;
  const href = launchHref(next, links);

  // The instrument shows the sign (tuning round 9): T-minus reads
  // negative, like the pad clocks.
  const clock = `-${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  const body = (
    <>
      {/* The launch countdown instrument (tuning rounds 4-7): module
          title in the shared HUD label class (like ORBITAL FLOW /
          LAUNCHES), digits dead-centered on the smoked stage, remaining
          facts in the framed footer. Days ride the stage's top-right
          slot instead of a second LCD. */}
      <div className="hud-label">T-MINUS NEXT LAUNCH</div>
      <div className="hud-launch">
        <div className="hud-launch-stage">
          {days > 0 && <span className="hud-launch-days">T-{days}D</span>}
          <div className="hud-launch-mid">
            <Lcd className="lcd-launch" value={clock} />
          </div>
        </div>
        <div className="hud-launch-foot">
          <div className="hud-launch-foot-row">
            {next.name.split(" | ").map((part, i) => (
              <span key={i}>{part.toUpperCase()}</span>
            ))}
          </div>
          <div className="hud-launch-foot-row">
            {[next.pad, netLabel].filter(Boolean).map((part, i) => (
              <span key={i}>{String(part).toUpperCase()}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
  return (
    <div className="hud-module">
      {href ? (
        <a className="hud-countdown-link" href={href}>
          {body}
        </a>
      ) : (
        body
      )}
    </div>
  );
}

// --------------------------------------------------------- flow chart

function FlowChart({ stats }: { stats: OrbitsStatsFile }) {
  const launched = stats.launched_30d.weekly;
  const scheduled = stats.scheduled_30d.weekly;
  const decayed = stats.deorbited_30d.weekly;
  const topMax = Math.max(1, ...launched.map((w) => w.launched), ...scheduled.map((w) => w.count));
  const botMax = Math.max(1, ...decayed.map((w) => w.count));
  const topH = (n: number) => Math.round((n / topMax) * 34);
  const botH = (n: number) => Math.round((n / botMax) * 22);

  return (
    <div className="hud-module">
      <div className="hud-label">ORBITAL FLOW · PAST 30D / NEXT 30D</div>
      <div className="flow">
        <div className="flow-top">
          {launched.map((w, i) => (
            <div key={`p${i}`} className="flow-col">
              <span className="flow-fig">{w.launched}</span>
              <span className="flow-bar" style={{ height: topH(w.launched) }}>
                {w.failed > 0 && <span className="flow-fail" />}
              </span>
            </div>
          ))}
          <div className="flow-now">
            <span className="flow-now-line" />
            <span className="flow-now-label">NOW</span>
          </div>
          {scheduled.map((w, i) => (
            <div key={`s${i}`} className="flow-col">
              <span className="flow-fig">{w.count}</span>
              <span className="flow-bar flow-bar-sched" style={{ height: topH(w.count) }} />
            </div>
          ))}
        </div>
        <div className="flow-base" />
        <div className="flow-bottom">
          {decayed.map((w, i) => (
            <div key={`d${i}`} className="flow-col">
              <span className="flow-bar flow-bar-decay" style={{ height: botH(w.count) }} />
              <span className="flow-fig">{w.count}</span>
            </div>
          ))}
          {/* Empty slots under NOW + the scheduled columns so the deorbit
              bars line up beneath the launched (past) bars. */}
          {Array.from({ length: scheduled.length + 1 }, (_, i) => (
            <div key={`e${i}`} className="flow-col" aria-hidden="true" />
          ))}
        </div>
      </div>
      <div className="flow-legend">
        <span>
          <i className="flow-sw" style={{ background: "var(--fg)" }} /> LAUNCHED{" "}
          <b>{stats.launched_30d.total}</b>
        </span>
        <span>
          <i className="flow-sw" style={{ background: "var(--alert)" }} /> FAILED{" "}
          <b>{stats.launched_30d.failed}</b>
        </span>
        <span>
          <i className="flow-sw flow-sw-sched" /> SCHEDULED <b>{stats.scheduled_30d.total}</b>
        </span>
        <span>
          <i className="flow-sw" style={{ background: "var(--dim-deep)" }} /> DEORBITED{" "}
          <b>{stats.deorbited_30d.total}</b>
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------ vehicle bars

/** Where a vehicle-family row links (Florian 2026-07-06): the registry
 * vehicle profile when the family names exactly one, else the launch
 * section of the registry browser. */
function familyHref(family: string, vehicleLinks: OrbitsLinkData["vehicleLinks"]): string {
  const f = family.toLowerCase();
  const matches = vehicleLinks.filter((v) => v.name.toLowerCase().startsWith(f));
  return matches.length === 1
    ? `/registry/vehicles/${matches[0]!.slug}/`
    : "/registry/#launch";
}

function VehicleBars({ vehicles: families }: { vehicles: OrbitsStatsFile["vehicles_6mo"] }) {
  const { vehicleLinks } = useContext(OrbitsLinkContext);
  const top = families.slice(0, 4);
  const rest = families.slice(4);
  const restCount = rest.reduce((a, v) => a + v.count, 0);
  const max = Math.max(1, ...top.map((v) => v.count), restCount);
  const rows = [
    ...top.map((v) => ({
      label: v.family.toUpperCase(),
      count: v.count,
      href: familyHref(v.family, vehicleLinks),
    })),
    ...(rest.length > 0
      ? [{ label: `OTHER (${rest.length})`, count: restCount, href: null }]
      : []),
  ];
  return (
    <div className="hud-module">
      <div className="hud-label">LAUNCHES · 6 MO / BY VEHICLE</div>
      <div className="veh">
        {rows.map((r) => (
          <div key={r.label} className="veh-row">
            <div className="veh-head">
              <span className="veh-name">
                {r.href ? (
                  <a className="veh-link" href={r.href}>
                    {r.label}
                  </a>
                ) : (
                  r.label
                )}
              </span>
              <span className="veh-count">{r.count}</span>
            </div>
            <div className="veh-track">
              <span className="veh-fill" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------- HUD column

/**
 * The satellites-tracked counter as a rail module (rule 58f: the
 * floating hero seat is retired; the count lives in the panel under
 * the full module grammar — hud-label header carrying the AS OF stamp
 * in the label's · convention, hairline separation, shared module
 * padding). The count is the DISPLAY voice at natural tracking, SIZED
 * to fill the module measure (rule 58g: type size, never letter
 * spacing, closes the line). Tabular figures keep a moving count from
 * shuffling or re-fitting within a digit count (the 2026-07-07 lock);
 * only a digit-count change re-measures.
 */
function SatCount({ tracked, asOf }: { tracked: number; asOf: string | null }) {
  const text = tracked.toLocaleString("en-US");
  const stamp = zTime(asOf);
  const countRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    const el = countRef.current;
    if (!el || tracked <= 0) {
      setSize(null);
      return;
    }
    let live = true;
    const fit = () => {
      if (!live) return;
      // Measure the TEXT, not the box (a block's scrollWidth floors
      // at its container), then scale from the current size to the
      // module measure, floored so the line never overflows. Repeated
      // calls converge; waiting on fonts.ready keeps a fallback-face
      // measure from fitting the wrong font.
      const range = document.createRange();
      range.selectNodeContents(el);
      const w = range.getBoundingClientRect().width;
      if (w <= 0) return;
      const cur = parseFloat(getComputedStyle(el).fontSize);
      setSize(Math.floor((cur * el.clientWidth) / w));
    };
    void document.fonts.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => {
      live = false;
      window.removeEventListener("resize", fit);
    };
  }, [text, tracked]);
  return (
    <div className="hud-module">
      <div className="hud-label">
        SATELLITES TRACKED{stamp ? ` · AS OF ${stamp}` : ""}
      </div>
      <div className="osat-count" ref={countRef} style={size ? { fontSize: size } : undefined}>
        {text}
      </div>
    </div>
  );
}

/**
 * The left rail panel, centered to the page by the column's auto
 * margins. Module order (rules 58c/58f, Florian 2026-07-11): the
 * tracked counter leads, then orbital flow, vehicle ranking, and the
 * T-minus clock anchoring the panel's foot.
 */
export function HudColumn({
  tracked,
  asOf,
  stats,
}: {
  tracked: number;
  asOf: string | null;
  stats: OrbitsStatsFile | null;
}) {
  return (
    <div className="hud">
      <SatCount tracked={tracked} asOf={asOf} />
      {stats && (
        <>
          <FlowChart stats={stats} />
          <VehicleBars vehicles={stats.vehicles_6mo} />
          <Countdown upcoming={stats.upcoming} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------- VIEW cluster

export interface ViewClusterProps {
  onZoomIn(): void;
  onZoomOut(): void;
  autoRotate: boolean;
  onToggleAutoRotate(): void;
  axisLock: boolean;
  onToggleAxisLock(): void;
  labelsOn: boolean;
  onToggleLabels(): void;
  onReset(): void;
}

export function ViewCluster(p: ViewClusterProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("orbits:view-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("orbits:view-collapsed", next ? "1" : "0");
      } catch {
        // Best-effort persistence only.
      }
      return next;
    });
  return (
    <div className="view opanel6">
      <button
        type="button"
        className="view-head"
        onClick={toggle}
        aria-expanded={!collapsed}
        title={collapsed ? "Show view controls" : "Hide view controls"}
      >
        <span className="view-title">VIEW</span>
        <span className="view-caret" aria-hidden="true">
          {collapsed ? "+" : "−"}
        </span>
      </button>
      {!collapsed && (
        <div className="view-body">
          <div className="view-row">
            <span>ZOOM</span>
            <span className="view-zoom">
              <button type="button" className="view-btn" onClick={p.onZoomIn} title="Zoom in">
                [+]
              </button>
              <button type="button" className="view-btn" onClick={p.onZoomOut} title="Zoom out">
                [−]
              </button>
            </span>
          </div>
          <div className="view-row">
            <span>AUTO-ROTATE</span>
            <button type="button" className="view-btn" onClick={p.onToggleAutoRotate}>
              [{p.autoRotate ? "ON" : "OFF"}]
            </button>
          </div>
          <div className="view-row">
            <span>LOCK AXIS</span>
            <button
              type="button"
              className="view-btn"
              onClick={p.onToggleAxisLock}
              title="Locked: dragging spins the globe about its tilted axis"
            >
              [{p.axisLock ? "ON" : "OFF"}]
            </button>
          </div>
          <div className="view-row">
            <span>SAT LABELS</span>
            <button type="button" className="view-btn" onClick={p.onToggleLabels}>
              [{p.labelsOn ? "ON" : "OFF"}]
            </button>
          </div>
          <div className="view-row">
            <span>RESET VIEW</span>
            <button type="button" className="view-btn" onClick={p.onReset} title="Reset view (R)">
              [R]
            </button>
          </div>
          <div className="view-rule" />
          <div className="view-legend">
            <span>
              <i className="gm gm-tri" /> SPACEPORT
            </span>
            <span>
              <i className="gm gm-sq" /> FACILITY
            </span>
            <span>
              <i className="gm gm-dot" /> OPERATOR HQ
            </span>
            <span>
              <i className="gm gm-ring" /> ACTIVITY &lt; 30D
            </span>
            <span>
              <i className="gm gm-diamond" /> GROUND STATION
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- footer

/** Freshness stamps carry the date, not just the time (Florian 2026-07-06). */
function zTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}Z`;
}

export function FooterBar({
  tle,
  launch,
  registry,
  tleStale,
}: {
  tle: string | null;
  launch: string | null;
  registry: string | null;
  tleStale: boolean;
}) {
  const entries = [
    { label: "ORBITS DB", value: zTime(tle), stale: tleStale },
    { label: "LAUNCH", value: zTime(launch), stale: false },
    { label: "REGISTRY", value: zTime(registry), stale: false },
  ].filter((e) => e.value !== null);
  return (
    <div className="obar">
      <span className="obar-attr">
        ORBITAL DATA: CELESTRAK (DR. T.S. KELSO) · LAUNCH DATA: THE SPACE DEVS / LAUNCH LIBRARY 2
        · SGP4 PROPAGATIONS, ACCURATE TO A FEW KM; NOT FOR OPERATIONAL USE
      </span>
      <span className="obar-fresh">
        {entries.map((e, i) => (
          <span key={e.label}>
            {i > 0 && " · "}
            <span className="obar-fresh-label">{e.label} </span>
            <span className={e.stale ? "obar-fresh-stale" : "obar-fresh-value"}>{e.value}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
