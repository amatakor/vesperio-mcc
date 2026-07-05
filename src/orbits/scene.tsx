/**
 * The Orbits 3D scene: wireframe tactical globe (ORBITS_SPEC.md 3) plus
 * the live data layers (spec 4-6): satellites propagated in a Web
 * Worker, orbit arc and popup on selection, spaceport and facility
 * ground markers, and the right-rail HUD.
 *
 * Loaded only via dynamic import from stage.tsx; nothing outside
 * src/orbits/ may import this module.
 *
 * The globe is earth-fixed (satellite positions are ECEF); idle motion
 * is the camera auto-orbiting via OrbitControls, stopped permanently by
 * the first interaction, disabled under prefers-reduced-motion.
 *
 * All colors come from the shared theme tokens; no hex literals here
 * (acceptance criterion 8).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { MultiLineString } from "geojson";
import landTopo from "world-atlas/land-110m.json";
import "./orbits.css";

import type {
  OmmRecord,
  OrbitsFacility,
  OrbitsSpaceport,
} from "../data/schema";
import { organizations } from "../lib/data";
import type { ConstellationDomain } from "../data/schema";
import {
  catalogBySlug,
  catalogTree,
  expandHighlight,
  ll2ToRegistrySlug,
  orbitCatalog,
} from "./catalog";
import { maxApogeeSceneUnits, orbitShellSegments } from "./kepler";
import { loadElements, loadFacilities, loadSpaceports } from "./elements";
import { latLonToVec3 } from "./geo";
import { GroundMarkers, type GroundPick } from "./ground";
import { DataPanel, LayersPanel, type LegendConstellation } from "./hud";
import { Popup, type PopupField } from "./popup";
import { Satellites, type PickedSat, type SnapshotBuffers } from "./satellites";
import type { LayoutEntry, WorkerIn, WorkerOut } from "./types";
import { RESERVE_TOKEN } from "./types";

const GLOBE_RADIUS = 1;
const OCEAN_RADIUS = 0.995; // occluder

// ------------------------------------------------------------- theme

/** Reads a shared theme token; the tokens are the single color source. */
function token(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) throw new Error(`missing theme token ${name}`);
  return v;
}

// ---------------------------------------------------------- geometry

const topology = landTopo as unknown as Topology<{ land: GeometryCollection }>;

/** Coastline (land boundary) line segments from Natural Earth 110m. */
function coastlineSegments(): Float32Array {
  const lines = mesh(topology, topology.objects.land) as MultiLineString;
  const out: number[] = [];
  for (const line of lines.coordinates) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = latLonToVec3(line[i]![1]!, line[i]![0]!, GLOBE_RADIUS);
      const b = latLonToVec3(line[i + 1]![1]!, line[i + 1]![0]!, GLOBE_RADIUS);
      out.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  return new Float32Array(out);
}

/** 15 degree graticule as line segments, sampled every 2 degrees. */
function graticuleSegments(): Float32Array {
  const out: number[] = [];
  const push = (a: THREE.Vector3, b: THREE.Vector3) => out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  for (let lat = -75; lat <= 75; lat += 15) {
    for (let lon = -180; lon < 180; lon += 2) {
      push(latLonToVec3(lat, lon, GLOBE_RADIUS), latLonToVec3(lat, lon + 2, GLOBE_RADIUS));
    }
  }
  for (let lon = -180; lon < 180; lon += 15) {
    for (let lat = -88; lat < 88; lat += 2) {
      push(latLonToVec3(lat, lon, GLOBE_RADIUS), latLonToVec3(lat + 2, lon, GLOBE_RADIUS));
    }
  }
  return new Float32Array(out);
}

function useLineGeometry(positions: Float32Array): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function Globe({ colors }: { colors: { ocean: string; grid: string; coast: string } }) {
  const grat = useLineGeometry(useMemo(graticuleSegments, []));
  const coast = useLineGeometry(useMemo(coastlineSegments, []));
  return (
    <group>
      <mesh>
        <sphereGeometry args={[OCEAN_RADIUS, 64, 64]} />
        <meshBasicMaterial color={colors.ocean} />
      </mesh>
      <lineSegments geometry={grat}>
        <lineBasicMaterial color={colors.grid} transparent opacity={0.85} />
      </lineSegments>
      <lineSegments geometry={coast}>
        <lineBasicMaterial color={colors.coast} />
      </lineSegments>
    </group>
  );
}

// ---------------------------------------------------------- overlays

/**
 * The selected satellite's orbit: solid ahead in the direction of
 * flight, dashed behind (Florian 2026-07-05). The worker samples the
 * arc chronologically with the satellite at the midpoint.
 */
function ArcLine({ positions, color }: { positions: Float32Array; color: string }) {
  const lines = useMemo(() => {
    const mid = Math.floor(positions.length / 3 / 2);
    const ahead = new THREE.BufferGeometry();
    ahead.setAttribute("position", new THREE.BufferAttribute(positions.subarray(mid * 3), 3));
    const behind = new THREE.BufferGeometry();
    behind.setAttribute(
      "position",
      new THREE.BufferAttribute(positions.subarray(0, (mid + 1) * 3), 3),
    );
    const solid = new THREE.Line(
      ahead,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    const dashed = new THREE.Line(
      behind,
      new THREE.LineDashedMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        dashSize: 0.02,
        gapSize: 0.025,
      }),
    );
    dashed.computeLineDistances();
    return [solid, dashed];
  }, [positions, color]);
  useEffect(
    () => () => {
      for (const l of lines) {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      }
    },
    [lines],
  );
  return (
    <>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </>
  );
}

/**
 * Fits the camera distance so everything up to `fitRadius` (the globe,
 * or the highest enabled navigation shell) is inside the viewport at
 * any aspect ratio. Zoom is disabled, so this distance holds until the
 * fit target changes.
 */
function FitCamera({ fitRadius }: { fitRadius: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    // A zero-sized container during the first layout pass would push the
    // camera to Infinity and poison the position with NaN for the whole
    // session; skip until the size is real and self-heal a bad position.
    if (size.width < 2 || size.height < 2) return;
    const persp = camera as THREE.PerspectiveCamera;
    const vHalf = (persp.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * (size.width / size.height));
    const denom = Math.sin(Math.min(vHalf, hHalf));
    if (!Number.isFinite(denom) || denom < 1e-3) return;
    const d = fitRadius / denom;
    const len = persp.position.length();
    if (!Number.isFinite(len) || len < 1e-6) persp.position.set(0, 0, d);
    else persp.position.multiplyScalar(d / len);
    persp.updateProjectionMatrix();
  }, [camera, size, fitRadius]);
  return null;
}

/** One faint ellipse per satellite of a highlighted constellation. */
function ShellLines({ positions, color }: { positions: Float32Array; color: string }) {
  const seg = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22 }),
    );
  }, [positions, color]);
  useEffect(
    () => () => {
      seg.geometry.dispose();
      (seg.material as THREE.Material).dispose();
    },
    [seg],
  );
  return <primitive object={seg} />;
}

/**
 * Projects the selected object's world position to container pixels
 * every frame and moves the popup DOM node directly (no react state at
 * frame rate).
 */
function PopupAnchor({
  getWorldPos,
  popupEl,
}: {
  getWorldPos: () => THREE.Vector3 | null;
  popupEl: MutableRefObject<HTMLDivElement | null>;
}) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const el = popupEl.current;
    if (!el) return;
    const world = getWorldPos();
    if (!world) {
      el.style.visibility = "hidden";
      return;
    }
    v.copy(world).project(camera);
    const x = (v.x * 0.5 + 0.5) * size.width;
    const y = (-v.y * 0.5 + 0.5) * size.height;
    el.style.visibility = "visible";
    el.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y - 10)}px)`;
  });
  return null;
}

function Controls({ reducedMotion }: { reducedMotion: boolean }) {
  const [autoRotate, setAutoRotate] = useState(!reducedMotion);
  // Zoom disabled for now (Florian 2026-07-05); FitCamera owns distance.
  return (
    <OrbitControls
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      autoRotate={autoRotate}
      autoRotateSpeed={0.4}
      onStart={() => setAutoRotate(false)}
    />
  );
}

// ------------------------------------------------------------- state

interface LayerState {
  status: "loading" | "ok" | "stale" | "missing";
  count: number | null;
  fetchedAt: string | null;
}

type Selection = { kind: "sat"; sat: PickedSat } | { kind: "ground"; pick: GroundPick };

const CATEGORY_LABEL: Record<string, string> = {
  eo: "EO",
  connectivity: "CONNECTIVITY",
  iot: "IOT",
  "human-spaceflight": "HUMAN SF",
  navigation: "NAVIGATION",
};

function formatNet(net: string): string {
  const d = new Date(net);
  if (Number.isNaN(d.getTime())) return net;
  return d.toISOString().slice(0, 10);
}

function registryHrefForOperator(slug: string): string | null {
  if (catalogBySlug.has(slug)) return `/registry/constellations/${slug}/`;
  if (organizations.some((o) => o.slug === slug)) return `/registry/organizations/${slug}/`;
  return null;
}

// -------------------------------------------------------------- scene

export default function Scene() {
  const colors = useMemo(
    () => ({
      ocean: token("--globe-ocean"),
      grid: token("--globe-grid"),
      coast: token("--globe-coast"),
      accent: token(RESERVE_TOKEN),
      alert: token("--alert"),
      fg: token("--fg"),
    }),
    [],
  );
  const colorBySlug = useMemo(
    () => new Map(orbitCatalog.map((e) => [e.slug, token(e.colorToken)])),
    [],
  );
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Layers and data state. Navigation (public GNSS at MEO) starts off:
  // enabling it widens the camera fit to the whole shell.
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(orbitCatalog.filter((e) => e.category !== "navigation").map((e) => e.slug)),
  );
  const [layerState, setLayerState] = useState<Map<string, LayerState>>(
    () => new Map(orbitCatalog.map((e) => [e.slug, { status: "loading", count: null, fetchedAt: null }])),
  );
  const [layout, setLayout] = useState<LayoutEntry[]>([]);
  const [showSpaceports, setShowSpaceports] = useState(true);
  const [showFacilities, setShowFacilities] = useState(false);
  const [spaceports, setSpaceports] = useState<OrbitsSpaceport[] | null>(null);
  const [spaceportsFetchedAt, setSpaceportsFetchedAt] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<OrbitsFacility[] | null>(null);
  const [facilitiesAsOf, setFacilitiesAsOf] = useState<string | null>(null);

  // Selection state. The deep link (?constellation=slug) preselects.
  const [selectedConstellation, setSelectedConstellation] = useState<string | null>(() => {
    const q = new URLSearchParams(window.location.search).get("constellation");
    return q && catalogBySlug.has(q) ? q : null;
  });
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  selectionRef.current = selection;
  const [watch, setWatch] = useState<{ id: number; lat: number; lon: number; altKm: number } | null>(null);
  const [arc, setArc] = useState<{ id: number; positions: Float32Array } | null>(null);

  const buffersRef = useRef<SnapshotBuffers>({ prev: null, next: null, prevTime: 0, nextTime: 0 });
  const recordsRef = useRef(new Map<string, OmmRecord[]>());
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const popupEl = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const post = useCallback((msg: WorkerIn) => workerRef.current?.postMessage(msg), []);

  // Worker lifecycle.
  useEffect(() => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerOut>) => {
      const msg = event.data;
      if (msg.type === "loaded") {
        setLayerState((prev) => {
          const next = new Map(prev);
          const cur = next.get(msg.slug);
          const stale = cur?.status === "stale";
          next.set(msg.slug, {
            status: msg.count === 0 ? "missing" : stale ? "stale" : "ok",
            count: msg.count,
            fetchedAt: cur?.fetchedAt ?? null,
          });
          return next;
        });
      } else if (msg.type === "layout") {
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
        if (sel?.kind === "sat" && sel.sat.id === msg.id) {
          setWatch({ id: msg.id, lat: msg.lat, lon: msg.lon, altKm: msg.altKm });
        }
      } else if (msg.type === "arc") {
        const sel = selectionRef.current;
        if (sel?.kind === "sat" && sel.sat.id === msg.id) {
          setArc({ id: msg.id, positions: new Float32Array(msg.positions) });
        }
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Load element files once per constellation and hand them to the worker.
  useEffect(() => {
    for (const entry of orbitCatalog) {
      if (!enabled.has(entry.slug) || recordsRef.current.has(entry.slug)) continue;
      recordsRef.current.set(entry.slug, []);
      void loadElements(entry.slug).then((res) => {
        if (!res.ok) {
          setLayerState((prev) => {
            const next = new Map(prev);
            next.set(entry.slug, { status: "missing", count: null, fetchedAt: null });
            return next;
          });
          return;
        }
        recordsRef.current.set(entry.slug, res.file.records);
        setLayerState((prev) => {
          const next = new Map(prev);
          next.set(entry.slug, {
            status: res.stale ? "stale" : "loading",
            count: null,
            fetchedAt: res.file.fetched_at,
          });
          return next;
        });
        post({ type: "load", slug: entry.slug, records: res.file.records });
      });
    }
  }, [enabled, post]);

  // Keep the worker's active set in sync with the UI.
  useEffect(() => {
    const slugs = orbitCatalog
      .filter((e) => enabled.has(e.slug))
      .filter((e) => {
        const s = layerState.get(e.slug);
        return s !== undefined && (s.status === "ok" || s.status === "stale") && (s.count ?? 0) > 0;
      })
      .map((e) => e.slug);
    post({ type: "enable", slugs });
  }, [enabled, layerState, post]);

  // Ground data on demand.
  useEffect(() => {
    if (!showSpaceports || spaceports) return;
    void loadSpaceports().then((file) => {
      if (file) {
        setSpaceports(file.spaceports);
        setSpaceportsFetchedAt(file.fetched_at);
      }
    });
  }, [showSpaceports, spaceports]);
  useEffect(() => {
    if (!showFacilities || facilities) return;
    void loadFacilities().then((file) => {
      if (file) {
        setFacilities(file.facilities);
        setFacilitiesAsOf(file.as_of);
      }
    });
  }, [showFacilities, facilities]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setWatch(null);
    setArc(null);
    post({ type: "watch", id: null });
  }, [post]);

  const pickSat = useCallback(
    (sat: PickedSat) => {
      setSelection({ kind: "sat", sat });
      setWatch(null);
      setArc(null);
      post({ type: "watch", id: sat.id });
      post({ type: "arc", id: sat.id });
    },
    [post],
  );

  const pickGround = useCallback(
    (pick: GroundPick) => {
      setSelection({ kind: "ground", pick });
      setWatch(null);
      setArc(null);
      post({ type: "watch", id: null });
    },
    [post],
  );

  // Turning layers off also clears any selection or highlight that
  // depended on them (a hidden layer cannot stay selected).
  const dropSelectionFor = useCallback(
    (slugs: string[]) => {
      const sel = selectionRef.current;
      if (sel?.kind === "sat" && slugs.includes(sel.sat.slug)) clearSelection();
      setSelectedConstellation((cur) =>
        cur && expandHighlight(cur).some((s) => slugs.includes(s)) ? null : cur,
      );
    },
    [clearSelection],
  );

  // Toggling a fleet parent toggles all of its child layers together.
  const toggleConstellation = useCallback(
    (slug: string) => {
      const slugs = expandHighlight(slug);
      if (slugs.length === 0) return;
      const anyOn = slugs.some((s) => enabled.has(s));
      setEnabled((prev) => {
        const next = new Set(prev);
        for (const s of slugs) {
          if (anyOn) next.delete(s);
          else next.add(s);
        }
        return next;
      });
      if (anyOn) dropSelectionFor(slugs);
    },
    [enabled, dropSelectionFor],
  );

  // Category header click: every layer in the category on or off.
  const toggleCategory = useCallback(
    (category: ConstellationDomain) => {
      const slugs = orbitCatalog.filter((e) => e.category === category).map((e) => e.slug);
      if (slugs.length === 0) return;
      const anyOn = slugs.some((s) => enabled.has(s));
      setEnabled((prev) => {
        const next = new Set(prev);
        for (const s of slugs) {
          if (anyOn) next.delete(s);
          else next.add(s);
        }
        return next;
      });
      if (anyOn) dropSelectionFor(slugs);
    },
    [enabled, dropSelectionFor],
  );

  // Highlighting a constellation force-enables its layers: a selection
  // and an unchecked box cannot coexist.
  const selectConstellation = useCallback((slug: string | null) => {
    setSelectedConstellation(slug);
    if (slug) {
      const slugs = expandHighlight(slug);
      setEnabled((prev) => {
        const next = new Set(prev);
        for (const s of slugs) next.add(s);
        return next;
      });
    }
  }, []);

  // The deep-linked constellation also gets its layers enabled.
  useEffect(() => {
    if (selectedConstellation) selectConstellation(selectedConstellation);
    // Run once on mount for the ?constellation= deep link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Legend model, nested like the Registry (fleet parents with children).
  const legendEntry = (e: (typeof orbitCatalog)[number]): LegendConstellation => {
    const s = layerState.get(e.slug) ?? { status: "loading" as const, count: null, fetchedAt: null };
    return {
      slug: e.slug,
      name: e.name,
      category: e.category,
      colorToken: e.colorToken,
      enabled: enabled.has(e.slug),
      status: s.status === "loading" ? "loading" : s.status,
      count: s.count,
    };
  };
  const legend: LegendConstellation[] = catalogTree.map((node) => {
    if (node.children.length === 0) return legendEntry(node.entry);
    const children = node.children.map(legendEntry);
    const counts = children.map((c) => c.count).filter((c): c is number => c !== null);
    return {
      slug: node.entry.slug,
      name: node.entry.name,
      category: node.entry.category,
      colorToken: node.entry.colorToken,
      enabled: children.some((c) => c.enabled),
      status: children.some((c) => c.status === "loading")
        ? "loading"
        : children.some((c) => c.status === "stale")
          ? "stale"
          : children.every((c) => c.status === "missing")
            ? "missing"
            : "ok",
      count: counts.length > 0 ? counts.reduce((a, b) => a + b, 0) : null,
      children,
    };
  });

  // Data panel: oldest elements timestamp across enabled layers.
  const enabledStates = orbitCatalog
    .filter((e) => enabled.has(e.slug))
    .map((e) => layerState.get(e.slug)!)
    .filter((s) => s.fetchedAt !== null);
  const oldestElements = enabledStates.reduce<string | null>(
    (acc, s) => (acc === null || (s.fetchedAt && s.fetchedAt < acc) ? s.fetchedAt : acc),
    null,
  );
  const anyStale = enabledStates.some((s) => s.status === "stale");
  const dataEntries = [
    { label: "Elements as of", fetchedAt: oldestElements, stale: anyStale },
    ...(showSpaceports
      ? [{ label: "Spaceports as of", fetchedAt: spaceportsFetchedAt, stale: false }]
      : []),
    ...(showFacilities
      ? [{ label: "Facilities as of", fetchedAt: facilitiesAsOf, stale: false }]
      : []),
  ];

  // A selected fleet parent highlights all of its child layers.
  const highlightSlugs = useMemo(() => {
    const base = selectedConstellation
      ? expandHighlight(selectedConstellation)
      : selection?.kind === "sat"
        ? [selection.sat.slug]
        : null;
    return base && base.length > 0 ? new Set(base) : null;
  }, [selectedConstellation, selection]);

  // Orbit shells: every orbit of an explicitly selected constellation.
  const shells = useMemo(() => {
    if (!selectedConstellation) return [];
    const now = new Date();
    return expandHighlight(selectedConstellation)
      .filter((s) => enabled.has(s))
      .flatMap((s) => {
        const recs = recordsRef.current.get(s) ?? [];
        if (recs.length === 0) return [];
        return [
          {
            slug: s,
            positions: orbitShellSegments(recs, now),
            color: colorBySlug.get(s) ?? colors.accent,
          },
        ];
      });
    // layout signals fresh records having arrived for enabled slugs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConstellation, enabled, layout, colorBySlug, colors.accent]);

  // Camera fit: the globe plus generous air for the LEO cloud (Florian
  // 2026-07-05: let the design breathe); widens further if a MEO layer
  // is ever enabled.
  const fitRadius = useMemo(() => {
    let max = 1.28;
    for (const e of orbitCatalog) {
      if (e.category !== "navigation" || !enabled.has(e.slug)) continue;
      const recs = recordsRef.current.get(e.slug);
      if (recs && recs.length > 0) max = Math.max(max, maxApogeeSceneUnits(recs) * 1.06);
    }
    return max;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, layout]);

  // Spaceports with a launch inside the last 30 days pulse red.
  const recentIds = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    return new Set(
      (spaceports ?? [])
        .filter((s) => s.last_launch && new Date(s.last_launch.net).getTime() > cutoff)
        .map((s) => s.ll2_id),
    );
  }, [spaceports]);

  // Popup content.
  const popup = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "sat") {
      const { sat } = selection;
      const entry = catalogBySlug.get(sat.slug);
      const record = recordsRef.current.get(sat.slug)?.find((r) => r.NORAD_CAT_ID === sat.id);
      const fields: PopupField[] = [
        ...(entry?.operator ? [{ label: "OPERATOR", value: entry.operator }] : []),
        { label: "CONSTELLATION", value: entry?.name ?? sat.slug },
        { label: "CATEGORY", value: entry ? CATEGORY_LABEL[entry.category] ?? entry.category : "?" },
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
        swatchToken: entry?.colorToken ?? RESERVE_TOKEN,
        fields,
        href: entry ? `/registry/constellations/${entry.slug}/` : null,
        hrefLabel: "Constellation profile",
        secondaryHref: null as string | null,
        secondaryLabel: null as string | null,
      };
    }
    const { pick } = selection;
    if (pick.kind === "spaceport") {
      const sp = pick.spaceport;
      const registrySlug = ll2ToRegistrySlug.get(sp.ll2_id) ?? null;
      const fields: PopupField[] = [
        { label: "COUNTRY", value: sp.country || "?" },
        { label: "TOTAL LAUNCHES", value: String(sp.total_launch_count) },
        { label: "UPCOMING", value: String(sp.upcoming_count) },
        ...(sp.next_launch
          ? [{ label: "NEXT", value: `${sp.next_launch.vehicle} ${formatNet(sp.next_launch.net)}` }]
          : []),
        ...(sp.last_launch
          ? [{ label: "LAST", value: `${sp.last_launch.vehicle} ${formatNet(sp.last_launch.net)}` }]
          : []),
        ...(sp.vehicles.length > 0 ? [{ label: "VEHICLES", value: sp.vehicles.join(", ") }] : []),
      ];
      return {
        title: sp.name,
        swatchToken: RESERVE_TOKEN,
        fields,
        href: registrySlug ? `/registry/spaceports/${registrySlug}/` : sp.info_url,
        hrefLabel: registrySlug ? "Spaceport profile" : sp.info_url ? "Source (LL2)" : null,
        secondaryHref: registrySlug ? sp.info_url : null,
        secondaryLabel: registrySlug && sp.info_url ? "Source (LL2)" : null,
      };
    }
    const f = pick.facility;
    const href = registryHrefForOperator(f.operator_slug);
    return {
      title: f.name,
      swatchToken: RESERVE_TOKEN,
      fields: [
        { label: "TYPE", value: f.type.toUpperCase() },
        { label: "OPERATOR", value: f.operator_slug },
        { label: "ABOUT", value: f.blurb },
      ],
      href,
      hrefLabel: href ? "Registry profile" : null,
      secondaryHref: f.source_url,
      secondaryLabel: "Source",
    };
  }, [selection, watch]);

  // World position for the popup anchor, read per frame.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const getPopupWorldPos = useCallback((): THREE.Vector3 | null => {
    const sel = selectionRef.current;
    if (!sel) return null;
    if (sel.kind === "ground") {
      const t =
        sel.pick.kind === "spaceport"
          ? { lat: sel.pick.spaceport.lat, lon: sel.pick.spaceport.lon }
          : { lat: sel.pick.facility.lat, lon: sel.pick.facility.lon };
      return latLonToVec3(t.lat, t.lon, 1.005);
    }
    // Interpolate the selected satellite's position, matching the layer.
    let index = 0;
    let found = false;
    for (const entry of layoutRef.current) {
      if (entry.slug === sel.sat.slug) {
        const i = entry.ids.indexOf(sel.sat.id);
        if (i === -1) return null;
        index += i;
        found = true;
        break;
      }
      index += entry.ids.length;
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
    return new THREE.Vector3(x, y, z);
  }, []);

  const arcColor =
    arc && selection?.kind === "sat" ? colorBySlug.get(selection.sat.slug) ?? colors.accent : null;

  return (
    <div className="orbits-layout">
      <div
        className="orbits-stage orbits-canvas-wrap"
        onPointerDown={(e) => {
          downPos.current = { x: e.clientX, y: e.clientY };
        }}
      >
        <Canvas
          camera={{ position: [0, 0, 2.7], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ raycaster }) => {
            // Tap-friendly pick radius (~10px, spec 4: touch-first,
            // primary selection is tap).
            raycaster.params.Points.threshold = 0.04;
          }}
          onPointerMissed={() => {
            const down = downPos.current;
            if (down === null) return;
            clearSelection();
          }}
        >
          <FitCamera fitRadius={fitRadius} />
          <Globe colors={colors} />
          {shells.map((s) => (
            <ShellLines key={s.slug} positions={s.positions} color={s.color} />
          ))}
          <Satellites
            layout={layout}
            buffers={buffersRef}
            colorBySlug={colorBySlug}
            highlightSlugs={highlightSlugs}
            labelColor={colors.fg}
            downPos={downPos}
            onPick={pickSat}
          />
          <GroundMarkers
            spaceports={spaceports}
            facilities={facilities}
            showSpaceports={showSpaceports}
            showFacilities={showFacilities}
            baseColor={colors.coast}
            accentColor={colors.accent}
            alertColor={colors.alert}
            recentIds={recentIds}
            reducedMotion={reducedMotion}
            selected={selection?.kind === "ground" ? selection.pick : null}
            downPos={downPos}
            onPick={pickGround}
          />
          {arc && arcColor && <ArcLine positions={arc.positions} color={arcColor} />}
          <PopupAnchor getWorldPos={getPopupWorldPos} popupEl={popupEl} />
          <Controls reducedMotion={reducedMotion} />
        </Canvas>
        {popup && (
          <div ref={popupEl} className="opopup-anchor">
            <Popup
              title={popup.title}
              swatchToken={popup.swatchToken}
              fields={popup.fields}
              href={popup.href}
              hrefLabel={popup.hrefLabel}
              secondaryHref={popup.secondaryHref}
              secondaryLabel={popup.secondaryLabel}
              onClose={clearSelection}
            />
          </div>
        )}
      </div>
      <div className="orbits-rail">
        <LayersPanel
          constellations={legend}
          selectedSlug={selectedConstellation}
          onToggleConstellation={toggleConstellation}
          onSelectConstellation={selectConstellation}
          onToggleCategory={toggleCategory}
          spaceportsOn={showSpaceports}
          onToggleSpaceports={() => setShowSpaceports((v) => !v)}
          facilitiesOn={showFacilities}
          onToggleFacilities={() => setShowFacilities((v) => !v)}
        />
        <DataPanel entries={dataEntries} />
      </div>
    </div>
  );
}
