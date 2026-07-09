/**
 * The heavy (three.js) half of the registry OrbitMini3D. Kept in its own
 * module so it loads only behind the dynamic import in mini3d.tsx, exactly
 * as scene.tsx sits behind stage.tsx: the SSR prerender and every page
 * that never opens a constellation's orbit tab ship none of this bundle.
 *
 * It renders the SAME wireframe globe as the full /orbits/ scene (the
 * exported Globe, tilt, spin, and popup-anchor pieces are reused verbatim,
 * so the earth is visually identical, just smaller), showing ONLY the one
 * constellation's satellites, live-propagated in the shared Web Worker.
 * Everything else (rail, chrome, ground layers, arcs, shells, stars) is
 * stripped. Clicking a dot opens the same Popup with the same fields the
 * full scene shows for a picked satellite.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";

import { AXIAL_TILT_DEG, AutoSpin, FitCamera, Globe, PopupAnchor, token } from "./scene";
import { Satellites, type PickedSat, type SnapshotBuffers } from "./satellites";
import { Popup, type PopupField } from "./popup";
import { catalogBySlug } from "./catalog";
import { maxApogeeSceneUnits } from "./kepler";
import { RESERVE_TOKEN, SNAPSHOT_CADENCE_MS, type LayoutEntry, type WorkerIn, type WorkerOut } from "./types";
import type { OmmRecord } from "../data/schema";

/** Human labels for the popup CATEGORY row; mirrors the full scene. */
const CATEGORY_LABEL: Record<string, string> = {
  eo: "EO",
  connectivity: "CONNECTIVITY",
  iot: "IOT",
  "human-spaceflight": "HUMAN SF",
  navigation: "NAVIGATION",
};

/** Snapshot cadence used while the view is hidden or off-screen: rare
 * enough to idle the worker without tearing down its state. */
const IDLE_CADENCE_MS = 60000;

type Selection = { kind: "sat"; sat: PickedSat };

export interface Mini3DSceneProps {
  slug: string;
  /** Optional dot color; falls back to the constellation's category neon. */
  accent?: string;
  /** The constellation's element set, already loaded by the gate. */
  records: OmmRecord[];
}

export default function Mini3DScene({ slug, accent, records }: Mini3DSceneProps) {
  const colors = useMemo(
    () => ({
      ocean: token("--globe-ocean"),
      grid: token("--globe-grid"),
      coast: token("--globe-coast"),
      fg: token("--fg"),
    }),
    [],
  );
  const entry = catalogBySlug.get(slug) ?? null;
  const dotColor = useMemo(
    () => accent ?? (entry ? token(entry.colorToken) : token(RESERVE_TOKEN)),
    [accent, entry],
  );
  const colorBySlug = useMemo(() => new Map([[slug, dotColor]]), [slug, dotColor]);
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // The globe fits the constellation's own altitude: LEO fleets sit close,
  // while MEO/GEO constellations pull the camera back so they stay in frame.
  const fitRadius = useMemo(
    () => Math.max(1.3, maxApogeeSceneUnits(records) * 1.08),
    [records],
  );

  const [layout, setLayout] = useState<LayoutEntry[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  selectionRef.current = selection;
  const [watch, setWatch] = useState<{ id: number; lat: number; lon: number; altKm: number } | null>(null);
  // Slow auto-rotate that stops on the first drag (as the full scene does);
  // reduced motion disables it outright.
  const [autoRotate, setAutoRotate] = useState(!reducedMotion);
  // Frame loop runs only while the view is visible on screen (below).
  const [active, setActive] = useState(true);

  const buffersRef = useRef<SnapshotBuffers>({ prev: null, next: null, prevTime: 0, nextTime: 0 });
  const recordsRef = useRef<Map<string, OmmRecord[]>>(new Map([[slug, records]]));
  recordsRef.current = new Map([[slug, records]]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const popupEl = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const spinGroup = useRef<THREE.Group | null>(null);
  // Last pointer X while dragging; null when not dragging.
  const dragLastX = useRef<number | null>(null);

  const post = useCallback((msg: WorkerIn) => workerRef.current?.postMessage(msg), []);

  // Worker lifecycle: load this one constellation, enable it, stream
  // snapshots. Same worker module and protocol as the full scene.
  useEffect(() => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerOut>) => {
      const msg = event.data;
      if (msg.type === "layout") {
        buffersRef.current = { prev: null, next: null, prevTime: 0, nextTime: 0 };
        setLayout(msg.order);
      } else if (msg.type === "snapshot") {
        const b = buffersRef.current;
        buffersRef.current = {
          prev: b.next,
          next: new Float32Array(msg.positions),
          prevTime: b.nextTime,
          nextTime: msg.time,
        };
      } else if (msg.type === "watch") {
        const sel = selectionRef.current;
        if (sel && sel.sat.id === msg.id) {
          setWatch({ id: msg.id, lat: msg.lat, lon: msg.lon, altKm: msg.altKm });
        }
      }
    };
    // Messages are processed in order: the worker builds satrecs on load,
    // then enable finds this slug in its loaded map and starts the timer.
    worker.postMessage({ type: "load", slug, records } satisfies WorkerIn);
    worker.postMessage({ type: "enable", slugs: [slug] } satisfies WorkerIn);
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [slug, records]);

  // Pause the worker's propagation while the view is hidden or scrolled
  // off screen, and resume it when it comes back.
  useEffect(() => {
    post({ type: "cadence", ms: active ? SNAPSHOT_CADENCE_MS : IDLE_CADENCE_MS });
  }, [active, post]);

  // Visibility gate: an IntersectionObserver on the wrapper plus the tab's
  // own visibility. Either being false stops the frame loop (below).
  useEffect(() => {
    const el = wrapRef.current;
    let onScreen = true;
    const update = () => setActive(onScreen && !document.hidden);
    const io =
      el && "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              onScreen = entries.some((e) => e.isIntersecting);
              update();
            },
            { threshold: 0.05 },
          )
        : null;
    if (io && el) io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setWatch(null);
    post({ type: "watch", id: null });
  }, [post]);

  const pickSat = useCallback(
    (sat: PickedSat) => {
      setSelection({ kind: "sat", sat });
      setWatch(null);
      post({ type: "watch", id: sat.id });
    },
    [post],
  );

  // ECEF scene coords -> world coords through the spin group.
  const toWorld = useCallback((v: THREE.Vector3): THREE.Vector3 => {
    const g = spinGroup.current;
    if (g) {
      g.updateWorldMatrix(true, false);
      v.applyMatrix4(g.matrixWorld);
    }
    return v;
  }, []);

  // World position for the popup anchor, read per frame; the satellite's
  // interpolated position from the same buffers the point layer reads.
  const getPopupWorldPos = useCallback((): THREE.Vector3 | null => {
    const sel = selectionRef.current;
    if (!sel) return null;
    let index = 0;
    let found = false;
    for (const e of layoutRef.current) {
      if (e.slug === sel.sat.slug) {
        const i = e.ids.indexOf(sel.sat.id);
        if (i === -1) return null;
        index += i;
        found = true;
        break;
      }
      index += e.ids.length;
    }
    if (!found) return null;
    const { prev, next, prevTime, nextTime } = buffersRef.current;
    if (!next || index * 3 + 2 >= next.length) return null;
    const span = nextTime - prevTime;
    const alpha = prev && span > 0 ? Math.min(Math.max((Date.now() - prevTime) / span, 0), 1.5) : 1;
    const read = (arr: Float32Array, k: number) => arr[index * 3 + k]!;
    const lerp = (k: number) => {
      const b = read(next, k);
      const a = prev && index * 3 + k < prev.length ? read(prev, k) : b;
      return a + (b - a) * alpha;
    };
    const x = lerp(0);
    const y = lerp(1);
    const z = lerp(2);
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return null;
    return toWorld(new THREE.Vector3(x, y, z));
  }, [toWorld]);

  const popup = useMemo(() => {
    if (!selection) return null;
    const { sat } = selection;
    const e = catalogBySlug.get(sat.slug);
    const record = recordsRef.current.get(sat.slug)?.find((r) => r.NORAD_CAT_ID === sat.id);
    const fields: PopupField[] = [
      ...(e?.operator ? [{ label: "OPERATOR", value: e.operator }] : []),
      { label: "CONSTELLATION", value: e?.name ?? sat.slug },
      { label: "CATEGORY", value: e ? CATEGORY_LABEL[e.category] ?? e.category : "?" },
      ...(record ? [{ label: "INC", value: `${record.INCLINATION.toFixed(2)}°` }] : []),
      ...(watch && watch.id === sat.id
        ? [
            { label: "ALT", value: `${Math.round(watch.altKm)} KM` },
            {
              label: "LAT / LON",
              value: `${Math.abs(watch.lat).toFixed(1)}${watch.lat < 0 ? "S" : "N"} ${Math.abs(watch.lon).toFixed(1)}${watch.lon < 0 ? "W" : "E"}`,
            },
          ]
        : []),
    ];
    return {
      title: sat.name,
      swatchToken: e?.colorToken ?? RESERVE_TOKEN,
      fields,
      href: e ? `/registry/constellations/${e.slug}/` : null,
      hrefLabel: "Constellation profile",
    };
  }, [selection, watch]);

  return (
    <div ref={wrapRef} className="omini3d">
      <div
        className="omini3d-canvas"
        onPointerDown={(ev) => {
          downPos.current = { x: ev.clientX, y: ev.clientY };
          dragLastX.current = ev.clientX;
        }}
        onPointerMove={(ev) => {
          if (dragLastX.current === null || !spinGroup.current) return;
          const dx = ev.clientX - dragLastX.current;
          dragLastX.current = ev.clientX;
          if (dx === 0) return;
          spinGroup.current.rotation.y += dx * 0.006;
          if (autoRotate) setAutoRotate(false);
        }}
        onPointerUp={() => {
          dragLastX.current = null;
        }}
        onPointerLeave={() => {
          dragLastX.current = null;
        }}
      >
        <Canvas
          frameloop={active ? "always" : "never"}
          camera={{ position: [0, 0, 2.7], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ raycaster }) => {
            raycaster.params.Points.threshold = 0.04;
          }}
          onPointerMissed={() => {
            if (downPos.current === null) return;
            clearSelection();
          }}
        >
          <FitCamera fitRadius={fitRadius} sidePad={0} shiftX={0} />
          <group rotation={[0, 0, (-AXIAL_TILT_DEG * Math.PI) / 180]}>
            <group ref={spinGroup}>
              <Globe colors={colors} />
              <Satellites
                layout={layout}
                buffers={buffersRef}
                colorBySlug={colorBySlug}
                highlightSlugs={null}
                pickSlugs={null}
                labelColor={colors.fg}
                showLabels={false}
                spinRef={spinGroup}
                downPos={downPos}
                onPick={pickSat}
              />
            </group>
          </group>
          <PopupAnchor getWorldPos={getPopupWorldPos} popupEl={popupEl} />
          <AutoSpin on={autoRotate && !reducedMotion} spinRef={spinGroup} />
        </Canvas>
      </div>
      {popup && (
        <div ref={popupEl} className="opopup-anchor">
          <Popup
            title={popup.title}
            swatchToken={popup.swatchToken}
            fields={popup.fields}
            href={popup.href}
            hrefLabel={popup.hrefLabel}
            onClose={clearSelection}
          />
        </div>
      )}
      <div className="omini3d-caption" style={{ color: dotColor }}>
        LIVE // {records.length} TRACKED
      </div>
      <style>{`
        .omini3d { position: relative; width: 100%; height: 100%; }
        .omini3d-canvas { position: absolute; inset: 0; touch-action: none; }
        .omini3d-caption {
          position: absolute;
          left: 6px;
          top: 5px;
          font-family: inherit;
          font-size: 9px;
          letter-spacing: 0.04em;
          pointer-events: none;
          z-index: 1;
        }
      `}</style>
    </div>
  );
}
