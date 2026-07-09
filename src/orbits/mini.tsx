/**
 * OrbitMini: a small, self-contained live orbital view for one
 * constellation, sized for a registry profile page. It loads that
 * constellation's element set client-side, groups the satellites into a
 * few altitude bands drawn as faint dashed track ellipses, and advances
 * one dot per satellite in real time along its band using the shared
 * SGP4 propagation (src/orbits/propagate.ts). This is a situational
 * display, not an ephemeris: altitude is banded and the projection is a
 * flat bearing-onto-ellipse read, not a full 3D globe.
 *
 * SSR/prerender safe: nothing fetches or touches window until mounted,
 * and a static Earth frame renders in the meantime. On a missing or bad
 * elements file the component renders null so the parent can drop it.
 */

import { useEffect, useRef, useState } from "react";
import { loadElements } from "./elements";
import { buildSatrecs, propagateToScene } from "./propagate";
import type { SatRecLike } from "./propagate";

/** SVG geometry (viewBox units). Earth colors are hardcoded to match the scene. */
const VIEW_W = 300;
const VIEW_H = 200;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const EARTH_R = 34;
const EARTH_FILL = "#0e2233";
const EARTH_STROKE = "#1e4258";
const DEFAULT_ACCENT = "#3dff9e";

/** Track ring radii live between just outside Earth and the frame edge. */
const RING_MIN = 46;
const RING_MAX = 90;
/** Vertical foreshortening that gives the rings their tilted look. */
const SQUASH = 0.42;
/** At most this many dots render; larger sets are sampled evenly. */
const MAX_DOTS = 60;

interface Band {
  /** Ellipse semi-axes and in-plane tilt, in viewBox units. */
  rx: number;
  ry: number;
  rot: number;
}

interface View {
  /** Real satellite total for the caption, before sampling. */
  total: number;
  bands: Band[];
  /** Per built satrec: which band it belongs to, index-aligned with satrecs. */
  dotBands: number[];
}

/** Even sample of `records` down to at most `cap`, preserving order. */
function sample<T>(records: T[], cap: number): T[] {
  if (records.length <= cap) return records.slice();
  const out: T[] = [];
  const stride = records.length / cap;
  for (let i = 0; i < cap; i++) out.push(records[Math.floor(i * stride)]!);
  return out;
}

/** Tiny 1D k-means; returns a cluster index per value. */
function cluster1d(values: number[], k: number): number[] {
  const n = values.length;
  if (k <= 1 || n === 0) return values.map(() => 0);
  const sorted = [...values].sort((a, b) => a - b);
  const centers: number[] = [];
  for (let i = 0; i < k; i++) centers.push(sorted[Math.floor(((i + 0.5) / k) * n)] ?? sorted[n - 1]!);
  const assign = new Array<number>(n).fill(0);
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = Math.abs(values[i]! - centers[c]!);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      assign[i] = best;
    }
    const sum = new Array<number>(k).fill(0);
    const count = new Array<number>(k).fill(0);
    for (let i = 0; i < n; i++) {
      sum[assign[i]!]! += values[i]!;
      count[assign[i]!]! += 1;
    }
    for (let c = 0; c < k; c++) if (count[c]! > 0) centers[c] = sum[c]! / count[c]!;
  }
  return assign;
}

/**
 * Group satrecs into up to three altitude bands from an initial
 * propagation, and lay those bands out as tilted track ellipses ordered
 * low to high. Satrecs whose first frame failed fall to the middle band.
 */
function buildView(satrecs: SatRecLike[], total: number, buf: Float32Array): View {
  propagateToScene(satrecs, new Date(), buf, 0);

  const alt = new Array<number>(satrecs.length).fill(NaN);
  const validIdx: number[] = [];
  const validAlt: number[] = [];
  for (let i = 0; i < satrecs.length; i++) {
    const sx = buf[i * 3]!;
    const sy = buf[i * 3 + 1]!;
    const sz = buf[i * 3 + 2]!;
    const r = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (Number.isFinite(r) && r > 0) {
      alt[i] = r - 1; // altitude above the surface, in Earth radii
      validIdx.push(i);
      validAlt.push(r - 1);
    }
  }

  const distinct = new Set(validAlt.map((a) => Math.round(a * 1000))).size;
  const k = Math.max(1, Math.min(3, distinct, validAlt.length));
  const assign = cluster1d(validAlt, k);

  // Order clusters low altitude to high so ring radius tracks altitude.
  const centerSum = new Array<number>(k).fill(0);
  const centerCount = new Array<number>(k).fill(0);
  for (let j = 0; j < validIdx.length; j++) {
    centerSum[assign[j]!]! += validAlt[j]!;
    centerCount[assign[j]!]! += 1;
  }
  const order = Array.from({ length: k }, (_, c) => c).sort((a, b) => {
    const ca = centerCount[a]! ? centerSum[a]! / centerCount[a]! : 0;
    const cb = centerCount[b]! ? centerSum[b]! / centerCount[b]! : 0;
    return ca - cb;
  });
  const rankOf = new Array<number>(k).fill(0);
  order.forEach((clusterId, rank) => (rankOf[clusterId] = rank));

  const bands: Band[] = [];
  for (let rank = 0; rank < k; rank++) {
    const rx = k === 1 ? 68 : RING_MIN + (RING_MAX - RING_MIN) * (rank / (k - 1));
    const rot = k === 1 ? 0 : -14 + 28 * (rank / (k - 1));
    bands.push({ rx, ry: rx * SQUASH, rot });
  }

  const middle = Math.floor(k / 2);
  const dotBands = new Array<number>(satrecs.length).fill(middle);
  for (let j = 0; j < validIdx.length; j++) dotBands[validIdx[j]!] = rankOf[assign[j]!]!;

  return { total, bands, dotBands };
}

type Status = "loading" | "ready" | "failed";

export function OrbitMini({ slug, accent }: { slug: string; accent?: string }) {
  const color = accent ?? DEFAULT_ACCENT;
  const [status, setStatus] = useState<Status>("loading");
  const [view, setView] = useState<View | null>(null);

  const satrecsRef = useRef<SatRecLike[] | null>(null);
  const bufRef = useRef<Float32Array | null>(null);
  const viewRef = useRef<View | null>(null);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  // Load elements once mounted. Never runs during SSR/prerender.
  useEffect(() => {
    let cancelled = false;
    loadElements(slug).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setStatus("failed");
        return;
      }
      const records = res.file.records;
      const picked = sample(records, MAX_DOTS);
      const { satrecs } = buildSatrecs(picked);
      const buf = new Float32Array(Math.max(satrecs.length, 1) * 3);
      const built = buildView(satrecs, records.length, buf);
      satrecsRef.current = satrecs;
      bufRef.current = buf;
      viewRef.current = built;
      dotRefs.current = new Array(satrecs.length).fill(null);
      setView(built);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Position (and, unless reduced motion is set, keep advancing) the dots.
  useEffect(() => {
    if (status !== "ready") return;

    const place = (date: Date) => {
      const satrecs = satrecsRef.current;
      const buf = bufRef.current;
      const current = viewRef.current;
      if (!satrecs || !buf || !current) return;
      propagateToScene(satrecs, date, buf, 0);
      for (let i = 0; i < satrecs.length; i++) {
        const el = dotRefs.current[i];
        if (!el) continue;
        const sx = buf[i * 3]!;
        const sy = buf[i * 3 + 1]!;
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
          el.setAttribute("opacity", "0");
          continue;
        }
        const theta = Math.atan2(sy, sx);
        const band = current.bands[current.dotBands[i]!]!;
        el.setAttribute("cx", String(CX + band.rx * Math.cos(theta)));
        el.setAttribute("cy", String(CY - band.ry * Math.sin(theta)));
        el.setAttribute("opacity", "1");
      }
    };

    place(new Date());

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const tick = () => {
      place(new Date());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [status]);

  if (status === "failed") return null;

  const svgStyle = { width: "100%", height: "auto", display: "block" } as const;

  // Loading and SSR both render the static Earth frame with no dots.
  if (status !== "ready" || !view) {
    return (
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={svgStyle} aria-hidden="true">
        <circle cx={CX} cy={CY} r={EARTH_R} fill={EARTH_FILL} stroke={EARTH_STROKE} strokeWidth={1} />
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={svgStyle} aria-hidden="true">
      {view.bands.map((band, bi) => (
        <g key={bi} transform={`rotate(${band.rot} ${CX} ${CY})`}>
          <ellipse
            cx={CX}
            cy={CY}
            rx={band.rx}
            ry={band.ry}
            fill="none"
            stroke={color}
            strokeWidth={0.6}
            strokeDasharray="3 3"
            opacity={0.32}
          />
          {view.dotBands.map((db, di) =>
            db === bi ? (
              <circle
                key={di}
                ref={(el) => {
                  dotRefs.current[di] = el;
                }}
                cx={CX}
                cy={CY}
                r={2.5}
                fill={color}
              />
            ) : null,
          )}
        </g>
      ))}
      <circle cx={CX} cy={CY} r={EARTH_R} fill={EARTH_FILL} stroke={EARTH_STROKE} strokeWidth={1} />
      <text x={6} y={13} fontFamily="inherit" fontSize={9} fill={color}>
        LIVE // {view.total} TRACKED
      </text>
    </svg>
  );
}
