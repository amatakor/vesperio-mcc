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
  type ReactNode,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { gstime } from "satellite.js";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { MultiLineString } from "geojson";
import landTopo from "world-atlas/land-110m.json";
import "./orbits.css";

import type {
  OmmRecord,
  OrbitsFacility,
  OrbitsGroundStation,
  OrbitsSpaceport,
  OrbitsStatsFile,
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
import { maxApogeeSceneUnits } from "./kepler";
import {
  loadElements,
  loadFacilities,
  loadGroundStations,
  loadSpaceports,
  loadStats,
} from "./elements";
import { latLonToVec3, occludedByGlobe } from "./geo";
import {
  GroundMarkers,
  CONE_DEFAULTS,
  sanitizeConeParams,
  type ConeParams,
  type GroundPick,
} from "./ground";
import { ConeTuner } from "./cone-tuner";
import { FooterBar, HudColumn, ViewCluster } from "./chrome";
import { LayerRail, type RailCategory, type RailRow } from "./rail";
import { Popup, type PopupField } from "./popup";
import { Satellites, type PickedSat, type SnapshotBuffers } from "./satellites";
import { Stars } from "./stars";
import type { LayoutEntry, WorkerIn, WorkerOut } from "./types";
import { CATEGORY_TOKENS, RESERVE_TOKEN, SNAPSHOT_CADENCE_MS } from "./types";

const GLOBE_RADIUS = 1;
const OCEAN_RADIUS = 0.995; // occluder

/** Earth's axial tilt (obliquity), degrees; the pole leans screen-right
 * from the default front view (Florian 2026-07-06). Exported so the
 * registry OrbitMini3D can lean its globe by the exact same obliquity. */
export const AXIAL_TILT_DEG = 23.44;

/** Auto-rotate spins the earth about its own tilted axis (so the tilt
 * holds on screen), eastward like the real one. Rad/s; ~150s per turn,
 * matching the old camera-orbit pace. */
const SPIN_RAD_PER_S = (2 * Math.PI) / 150;

/** Worker snapshot cadence while the tab is hidden or backgrounded (QC
 * hardening 2026-07-13): rare enough to idle the ~12,300-satellite
 * propagation without tearing down worker state, mirroring the registry
 * mini's IDLE_CADENCE_MS (src/orbits/mini3d-scene.tsx). */
const IDLE_CADENCE_MS = 60000;

// ------------------------------------------------------------- theme

/** Reads a shared theme token; the tokens are the single color source.
 * Exported for the registry OrbitMini3D, which reuses the same globe. */
export function token(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) throw new Error(`missing theme token ${name}`);
  return v;
}

/** One localStorage key for the whole DEV cone tuner state. */
const CONE_STORAGE_KEY = "orbits:cone-tuner";

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
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.1);
    return g;
  }, [positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * Equirectangular ocean+land texture from the same Natural Earth 110m
 * topology as the coastlines (tuning round 8): a very light shading
 * step between water and continents. The projection matches
 * latLonToVec3 against three's SphereGeometry UVs exactly
 * (u = (lon+180)/360, v = (90-lat)/180), so the fill sits precisely
 * under the coastline strokes.
 */
function landTexture(ocean: string, land: string): THREE.CanvasTexture {
  const W = 2048;
  const H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, W, H);
  const featOrColl = feature(topology, topology.objects.land) as unknown as {
    type: string;
    geometry?: MultiPolygonGeo;
    features?: Array<{ geometry: MultiPolygonGeo }>;
  };
  const geos: MultiPolygonGeo[] =
    featOrColl.type === "FeatureCollection"
      ? (featOrColl.features ?? []).map((f) => f.geometry)
      : [featOrColl.geometry!];
  const polys: [number, number][][][] = geos.flatMap((geo) =>
    geo.type === "Polygon"
      ? [geo.coordinates as unknown as [number, number][][]]
      : (geo.coordinates as unknown as [number, number][][][]),
  );
  ctx.fillStyle = land;
  // Antimeridian handling (2026-07-10): 7 rings in the 110m land data
  // cross lon +-180 (Fiji, Chukotka, Wrangel, Antarctica). Drawn
  // naively, each crossing edge strokes a straight line across the
  // whole canvas and evenodd mis-fills a thin wedge that wraps the
  // globe as a pale band (glaring on the saturated daylight ocean).
  // Fix: unwrap each ring to monotonic longitude, close pole-encircling
  // rings via their pole, and fill per polygon at the three seam
  // offsets so both canvas edges stay covered.
  const unwrapRing = (ring: [number, number][]): [number, number][] => {
    const out: [number, number][] = [];
    let prev: number | null = null;
    let shift = 0;
    for (const [lon, lat] of ring) {
      let l = lon + shift;
      if (prev !== null) {
        while (l - prev > 180) {
          shift -= 360;
          l -= 360;
        }
        while (l - prev < -180) {
          shift += 360;
          l += 360;
        }
      }
      out.push([l, lat]);
      prev = l;
    }
    return out;
  };
  for (const poly of polys) {
    for (const dx of [-W, 0, W]) {
      ctx.beginPath();
      for (const ring of poly) {
        let pts = unwrapRing(ring as [number, number][]);
        const lons = pts.map(([l]) => l);
        if (Math.max(...lons) - Math.min(...lons) >= 359) {
          // Pole-encircling ring (Antarctica): close it across its pole
          // so the cap fills instead of leaving a wrapped sliver.
          const meanLat = pts.reduce((s, [, la]) => s + la, 0) / pts.length;
          const pole = meanLat < 0 ? -90 : 90;
          pts = [...pts, [pts[pts.length - 1]![0], pole], [pts[0]![0], pole]];
        }
        pts.forEach(([lon, lat], i) => {
          const x = ((lon + 180) / 360) * W + dx;
          const y = ((90 - lat) / 180) * H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
interface MultiPolygonGeo {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export function Globe({
  colors,
}: {
  colors: { ocean: string; land: string; grid: string; coast: string };
}) {
  const grat = useLineGeometry(useMemo(graticuleSegments, []));
  const coast = useLineGeometry(useMemo(coastlineSegments, []));
  const map = useMemo(() => landTexture(colors.ocean, colors.land), [colors.ocean, colors.land]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[OCEAN_RADIUS, 64, 64]} />
        <meshBasicMaterial map={map} />
      </mesh>
      {colors.grid !== "none" && (
        <lineSegments geometry={grat}>
          <lineBasicMaterial color={colors.grid} transparent opacity={0.85} />
        </lineSegments>
      )}
      <lineSegments geometry={coast}>
        <lineBasicMaterial color={colors.coast} />
      </lineSegments>
    </group>
  );
}

// ---------------------------------------------------------- overlays

/**
 * The selected satellite's orbit: dashed ahead in the direction of
 * flight, solid behind (Florian 2026-07-07, reversed). The worker
 * samples the arc chronologically with the satellite at the midpoint,
 * so the second half (mid -> end) is the future track.
 */
function ArcLine({ positions, color }: { positions: Float32Array; color: string }) {
  const lines = useMemo(() => {
    const mid = Math.floor(positions.length / 3 / 2);
    const ahead = new THREE.BufferGeometry();
    ahead.setAttribute("position", new THREE.BufferAttribute(positions.subarray(mid * 3), 3));
    ahead.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
    const behind = new THREE.BufferGeometry();
    behind.setAttribute(
      "position",
      new THREE.BufferAttribute(positions.subarray(0, (mid + 1) * 3), 3),
    );
    behind.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
    const solid = new THREE.Line(
      behind,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    const dashed = new THREE.Line(
      ahead,
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
 * any aspect ratio. `sidePad` shrinks the effective width: the canvas
 * runs full-bleed under the floating side panels, but on wide screens
 * the globe should still fit between them. `shiftX` slides the view
 * horizontally (px, positive = scene moves left) so the globe centers
 * between the unequal side panels. Zoom is disabled, so this distance
 * holds until the fit target changes.
 */
export function FitCamera({
  fitRadius,
  padLeft,
  padRight,
}: {
  fitRadius: number;
  /** Real pixel spans the floating panels occupy on each side (gutter +
   * panel + gap); the globe fits and centers in the space BETWEEN them
   * at any window size (Florian 2026-07-10: the fixed side-pad + step
   * approximation over- or under-sized the globe between breakpoints). */
  padLeft: number;
  padRight: number;
}) {
  const { camera, size } = useThree();
  useEffect(() => {
    // A zero-sized container during the first layout pass would push the
    // camera to Infinity and poison the position with NaN for the whole
    // session; skip until the size is real and self-heal a bad position.
    if (size.width < 2 || size.height < 2) return;
    const width = Math.max(size.width - padLeft - padRight, 120);
    const shiftX = (padRight - padLeft) / 2;
    const persp = camera as THREE.PerspectiveCamera;
    if (shiftX !== 0) {
      persp.setViewOffset(size.width, size.height, shiftX, 0, size.width, size.height);
    } else {
      persp.clearViewOffset();
    }
    const vHalf = (persp.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * (width / size.height));
    const denom = Math.sin(Math.min(vHalf, hHalf));
    if (!Number.isFinite(denom) || denom < 1e-3) return;
    const d = fitRadius / denom;
    const len = persp.position.length();
    if (!Number.isFinite(len) || len < 1e-6) persp.position.set(0, 0, d);
    else persp.position.multiplyScalar(d / len);
    persp.updateProjectionMatrix();
  }, [camera, size, fitRadius, padLeft, padRight]);
  return null;
}

/** One faint ellipse per satellite of a highlighted constellation. */
export function ShellLines({ positions, color }: { positions: Float32Array; color: string }) {
  const seg = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
    return new THREE.LineSegments(
      g,
      // 0.22 read too dim under focus (tuning round 8).
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.36 }),
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
export function PopupAnchor({
  getWorldPos,
  popupEl,
}: {
  getWorldPos: () => THREE.Vector3 | null;
  popupEl: MutableRefObject<HTMLDivElement | null>;
}) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Ray(), []);
  useFrame(() => {
    const el = popupEl.current;
    if (!el) return;
    const world = getWorldPos();
    if (!world) {
      el.style.visibility = "hidden";
      return;
    }
    // The card follows its object behind the earth (Florian 2026-07-10):
    // same occlusion test as the satellite labels, same fudged radius.
    ray.origin.copy(camera.position);
    ray.direction.copy(world).sub(camera.position).normalize();
    if (occludedByGlobe(ray, world.distanceTo(camera.position), 0.995)) {
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

/** Controlled orbit controls for user drags; auto-rotate is the globe
 * spinning (AutoSpin), not a camera orbit, so the axial tilt holds.
 * With the axis locked (default) camera rotation is off entirely and
 * dragging spins the globe instead (handler on the canvas wrap).
 * Scroll/pinch zoom stays off (the [+]/[-] buttons step FitCamera). */
function Controls({
  enableRotate,
  onInteract,
}: {
  enableRotate: boolean;
  onInteract(): void;
}) {
  return (
    <OrbitControls
      enablePan={false}
      enableZoom={false}
      enableRotate={enableRotate}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      onStart={onInteract}
    />
  );
}

/** Spins the earth-fixed group about its own (tilted) axis. */
export function AutoSpin({
  on,
  spinRef,
}: {
  on: boolean;
  spinRef: MutableRefObject<THREE.Group | null>;
}) {
  useFrame((_, delta) => {
    const g = spinRef.current;
    if (on && g) g.rotation.y += SPIN_RAD_PER_S * delta;
  });
  return null;
}

/**
 * Holds the inertial (ECI) overlays: the orbit shells and the selected
 * satellite's arc are emitted in ECI (no GMST bake), so rotating this
 * group by -GMST(now) every frame earth-fixes them to exactly where the
 * live ECEF dots are, killing the old drift (Florian 2026-07-07). Sits
 * inside the spin group so the auto-rotate turntable carries it too.
 */
export function InertialFrame({
  groupRef,
  children,
}: {
  groupRef: MutableRefObject<THREE.Group | null>;
  children: ReactNode;
}) {
  useFrame(() => {
    const g = groupRef.current;
    if (g) g.rotation.y = -gstime(new Date());
  });
  return <group ref={groupRef}>{children}</group>;
}

/** One-shot load pitch (Florian, 2026-07-12, part of the ISS load aim):
 * when the station rides a high latitude, the tilted front view can put
 * it outside the frame at the closer default zoom. If its projected
 * vertical NDC exceeds the target, orbit the camera just enough (bisected
 * against the real fov and distance) to clamp it back into view. The
 * globe stays centered (lookAt origin); Reset restores the plain front
 * view as before. */
function LoadPitch({
  pendingRef,
}: {
  pendingRef: MutableRefObject<{ yw: number; zw: number } | null>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    const persp = camera as THREE.PerspectiveCamera;
    const d = persp.position.length();
    if (!Number.isFinite(d) || d < 1e-3) return;
    const t = Math.tan((persp.fov * Math.PI) / 360);
    const TARGET = 0.8;
    const ndcAt = (chi: number) => {
      const y = p.yw * Math.cos(chi) - p.zw * Math.sin(chi);
      const z = p.yw * Math.sin(chi) + p.zw * Math.cos(chi);
      return y / ((d - z) * t);
    };
    const n0 = ndcAt(0);
    if (!Number.isFinite(n0) || Math.abs(n0) <= TARGET) return;
    // Full centering (camera boresight through the station) is the far
    // bound; bisect down to the clamp target so the composition moves as
    // little as possible.
    let lo = 0;
    let hi = Math.atan2(p.yw, p.zw);
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (Math.abs(ndcAt(mid)) > TARGET) lo = mid;
      else hi = mid;
    }
    const chi = hi;
    persp.position.set(0, d * Math.sin(chi), d * Math.cos(chi));
    persp.up.set(0, 1, 0);
    persp.lookAt(0, 0, 0);
  });
  return null;
}

/** Snaps the camera to the front view and the spin to zero when `nonce`
 * changes. */
function CameraReset({
  nonce,
  spinRef,
}: {
  nonce: number;
  spinRef: MutableRefObject<THREE.Group | null>;
}) {
  const { camera } = useThree();
  useEffect(() => {
    if (nonce === 0) return;
    const d = camera.position.length() || 2.7;
    camera.position.set(0, 0, d);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    if (spinRef.current) spinRef.current.rotation.y = 0;
  }, [camera, nonce, spinRef]);
  return null;
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

/** Every token the scene paints with, in one stable read; the joined
 * string is the change-detection key. */
function readSceneTokens() {
  return {
    ocean: token("--globe-ocean"),
    land: token("--globe-land"),
    grid: token("--globe-grid"),
    coast: token("--globe-coast"),
    accent: token(RESERVE_TOKEN),
    alert: token("--alert"),
    acc: token("--acc"),
    fg: token("--mcc-fg"),
    // Selection is volt (rule 46, Florian 2026-07-10): the picked
    // satellite's orbit renders in the shell accent, volt on night,
    // volt-ink on the daylight chart.
    volt: token("--shell-accent"),
  };
}
function sceneTokensKey(): string {
  return (
    Object.values(readSceneTokens()).join("|") +
    "|" +
    orbitCatalog.map((e) => token(e.colorToken)).join("|")
  );
}

export default function Scene() {
  // Live token tracking (2026-07-10): mount-time reads meant the globe
  // rendered stale colors after hot style updates — theme toggles
  // remounted, but live palette tuning lagged in any open tab. A 1s
  // poll re-keys the palette only when a VALUE changes (the Scene has
  // no render cadence of its own to piggyback on); downstream memos
  // key on the values, so the land texture rebuilds only on change.
  const [tokensKey, setTokensKey] = useState(sceneTokensKey);
  useEffect(() => {
    const id = setInterval(() => {
      const k = sceneTokensKey();
      setTokensKey((prev) => (prev === k ? prev : k));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colors = useMemo(() => readSceneTokens(), [tokensKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colorBySlug = useMemo(
    () => new Map(orbitCatalog.map((e) => [e.slug, token(e.colorToken)])),
    [tokensKey],
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
  void facilitiesAsOf;
  // Ground stations (round 7 rework, Florian: "the menu logic is
  // broken"). The old model stacked an independent layer flag
  // (showGroundStations) on top of a per-station disabled set with no
  // reconciliation: all children off left the master lit over an empty
  // globe, and master off->on visibly did nothing. ONE source of truth
  // now: the ENABLED station-name set. Every level follows the fleet
  // grammar (lit = any descendant on; click = all on / all off), layer
  // visibility is derived (any station enabled), and the default empty
  // set is the old "layer off". Data loads eagerly (16-entry static
  // file) so the tree, counts, and toggles exist before first enable.
  const [groundStations, setGroundStations] = useState<OrbitsGroundStation[] | null>(null);
  useEffect(() => {
    void loadGroundStations().then((file) => {
      if (file) {
        setGroundStations(file.ground_stations);
        // Ground stations default ON at load (Florian, 2026-07-12):
        // seed the enabled set with every station once the data lands.
        // Session-only, like the other layer toggles.
        setEnabledStations(new Set(file.ground_stations.map((s) => s.name)));
      }
    });
  }, []);
  const [enabledStations, setEnabledStations] = useState<ReadonlySet<string>>(new Set());
  const showGroundStations = enabledStations.size > 0;
  const visibleGroundStations = useMemo(
    () => (groundStations ? groundStations.filter((s) => enabledStations.has(s.name)) : null),
    [groundStations, enabledStations],
  );
  // Exactly three rail groups (round 7): KSAT, SSC, OTHERS.
  const gsGroupOf = (s: OrbitsGroundStation): string =>
    s.operator === "KSAT" ? "KSAT" : s.operator === "SSC" ? "SSC" : "OTHERS";
  const toggleStation = useCallback((key: string) => {
    setEnabledStations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  // Group toggle, fleet grammar: any on -> all off, none on -> all on.
  const toggleStationOperator = useCallback(
    (id: string) => {
      const names = (groundStations ?? []).filter((s) => gsGroupOf(s) === id).map((s) => s.name);
      if (names.length === 0) return;
      setEnabledStations((prev) => {
        const anyOn = names.some((n) => prev.has(n));
        const next = new Set(prev);
        for (const n of names) {
          if (anyOn) next.delete(n);
          else next.add(n);
        }
        return next;
      });
    },
    [groundStations],
  );
  // Master toggle, same grammar over every station.
  const toggleGroundStations = useCallback(() => {
    if (!groundStations) return;
    setEnabledStations((prev) =>
      prev.size > 0 ? new Set() : new Set(groundStations.map((s) => s.name)),
    );
  }, [groundStations]);

  // 6A chrome state: HUD stats feed, VIEW controls, rail collapse map.
  const [stats, setStats] = useState<OrbitsStatsFile | null>(null);
  useEffect(() => {
    void loadStats().then(setStats);
  }, []);
  const [autoRotate, setAutoRotate] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  // Locked (default): dragging spins the globe about its own tilted
  // axis, so the tilt never changes; unlocked frees the camera orbit.
  const [axisLock, setAxisLock] = useState(true);
  const [labelsOn, setLabelsOn] = useState(true);
  // Default zoom by frame: desktop opens HALF a step closer than the base
  // panel-gap fit (Florian, 2026-07-12; a full step read as too much).
  // fitRadius takes fractional steps (0.82^z); the [+]/[-] buttons, wheel,
  // clamps, and FitCamera math are unchanged and step whole units from
  // here, and Reset returns here. Mobile keeps two steps wider than base
  // to clear the stacked panels.
  const defaultZoom = () => {
    if (window.matchMedia("(max-width: 900px)").matches) return -2;
    return 0.5;
  };
  const [zoomStep, setZoomStep] = useState(defaultZoom);
  const [resetNonce, setResetNonce] = useState(0);
  // Wide screens keep the globe fitted between the floating panels even
  // though the canvas itself runs full-bleed underneath them; on every
  // desktop width the view shifts left so the globe centers between the
  // unequal panels (left column 296px incl. padding, right rail 376px).
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 901px)").matches);
  useEffect(() => {
    const pairs: [MediaQueryList, (e: MediaQueryListEvent) => void][] = [
      [window.matchMedia("(min-width: 901px)"), (e) => setDesktop(e.matches)],
    ];
    for (const [mq, fn] of pairs) mq.addEventListener("change", fn);
    return () => {
      for (const [mq, fn] of pairs) mq.removeEventListener("change", fn);
    };
  }, []);

  // v2 key: categories now default open (Florian 2026-07-06); the bump
  // clears everyone's stored v1 collapse state so the new default shows.
  const [collapse, setCollapse] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("orbits:collapse:v2");
      if (saved) return JSON.parse(saved) as Record<string, boolean>;
    } catch {
      // localStorage unavailable; fall through to defaults.
    }
    // Defaults: every category open, fleets collapsed (fit guarantee).
    const init: Record<string, boolean> = {};
    for (const node of catalogTree) {
      if (node.children.length > 0) init[node.entry.slug] = true;
    }
    return init;
  });
  useEffect(() => {
    try {
      localStorage.setItem("orbits:collapse:v2", JSON.stringify(collapse));
    } catch {
      // Best-effort persistence only.
    }
  }, [collapse]);
  const toggleCollapse = useCallback((key: string) => {
    // Unseeded keys must flip from their EFFECTIVE default, not from
    // undefined: categories default open; fleets are seeded at init; the
    // ground-station tree ("gs", "gs:<operator>", round 4) defaults
    // collapsed and its keys only exist once toggled.
    const fallback = key.startsWith("cat:") ? false : true;
    setCollapse((prev) => ({ ...prev, [key]: !(prev[key] ?? fallback) }));
  }, []);

  // Selection state. The deep link (?constellation=slug) preselects.
  const [selectedConstellation, setSelectedConstellation] = useState<string | null>(() => {
    const q = new URLSearchParams(window.location.search).get("constellation");
    return q && catalogBySlug.has(q) ? q : null;
  });
  // Load state (Florian 2026-07-07): the full satellite cloud PLUS the
  // ISS orbit focused. This is the only state where focus and cloud
  // combine (no dimming); the first explicit focus, pick, or layer
  // change leaves it for the normal exclusive-focus behaviour. A deep
  // link supersedes it.
  const [bootIss, setBootIss] = useState(
    () => !new URLSearchParams(window.location.search).get("constellation"),
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  selectionRef.current = selection;
  const [watch, setWatch] = useState<{ id: number; lat: number; lon: number; altKm: number } | null>(null);
  // The dashed/solid orbit line. It is requested both for a picked
  // satellite and, in the default view, for the ISS (which has no
  // selection), so the arc carries its own slug for colouring and the
  // wanted-arc id gates which worker reply we accept.
  const [arc, setArc] = useState<{ id: number; positions: Float32Array; slug: string } | null>(null);
  const arcWantRef = useRef<{ id: number; slug: string } | null>(null);
  // SGP4-sampled focus shells, keyed by slug, filled by the worker; stale
  // entries for a previous focus are never read (shells maps focusSlugs).
  const [shellSegs, setShellSegs] = useState<Map<string, Float32Array>>(new Map());

  const buffersRef = useRef<SnapshotBuffers>({ prev: null, next: null, prevTime: 0, nextTime: 0 });
  const recordsRef = useRef(new Map<string, OmmRecord[]>());
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const popupEl = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  // The earth-fixed group AutoSpin rotates; everything ECEF lives inside.
  const spinGroup = useRef<THREE.Group | null>(null);
  // The inertial (ECI) overlay group: orbit shells + arc, rotated by
  // -GMST(now) each frame so they earth-fix onto the live dots.
  const inertialGroup = useRef<THREE.Group | null>(null);
  // Axis-locked manual drag: last pointer X while the primary button is
  // down; null when not dragging.
  const dragLastX = useRef<number | null>(null);
  // Load aim (Florian, 2026-07-12): the first snapshot that carries the
  // ISS spins the globe so the station faces the camera. Refs, not state:
  // snapshots never re-render, and the aim must lose to any user drag.
  const aimOrderRef = useRef<LayoutEntry[] | null>(null);
  const issAimedRef = useRef(false);
  const userSpunRef = useRef(false);
  // The station's post-aim world position, handed to LoadPitch (which
  // clamps it into frame when a high latitude would crop it).
  const aimPitchRef = useRef<{ yw: number; zw: number } | null>(null);
  // Wheel zoom (tuning round 8): scroll steps the same FitCamera zoom
  // the [+]/[-] buttons drive. Non-passive so the page never scrolls
  // under the globe; deltas accumulate so trackpads step sanely.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const wheelAcc = useRef(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelAcc.current += e.deltaY;
      while (wheelAcc.current <= -60) {
        wheelAcc.current += 60;
        setZoomStep((z) => Math.min(4, z + 1));
      }
      while (wheelAcc.current >= 60) {
        wheelAcc.current -= 60;
        setZoomStep((z) => Math.max(-2, z - 1));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const axisLockRef = useRef(axisLock);
  axisLockRef.current = axisLock;
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

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
        aimOrderRef.current = msg.order;
        setLayout(msg.order);
      } else if (msg.type === "snapshot") {
        const b = buffersRef.current;
        buffersRef.current = {
          prev: b.next,
          next: new Float32Array(msg.positions),
          prevTime: b.nextTime,
          nextTime: msg.time,
        };
        // Load aim: center the ISS to the camera once real positions
        // exist. The spin group lives INSIDE the axial-tilt group (a
        // rotation about the camera's own Z axis), so a point on the spin
        // frame's front meridian still lands off the screen's center line
        // by an offset that grows with its height. Solve for world x = 0:
        // with tilt Rz(phi) after spin Ry(theta), x_world =
        // r sin(alpha+theta) cos(phi) - y sin(phi), which zeroes at
        // theta = asin((y/r) tan(phi)) - alpha. AutoSpin and drags then
        // behave exactly as before.
        if (!issAimedRef.current && !userSpunRef.current && spinGroup.current && aimOrderRef.current) {
          let index = 0;
          for (const entry of aimOrderRef.current) {
            if (entry.slug !== "iss") {
              index += entry.ids.length;
              continue;
            }
            if (entry.ids.length > 0) {
              const p = buffersRef.current.next!;
              const x = p[index * 3];
              const y = p[index * 3 + 1];
              const z = p[index * 3 + 2];
              const r = x !== undefined && z !== undefined ? Math.hypot(x, z) : 0;
              if (
                x !== undefined && y !== undefined && z !== undefined &&
                Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) &&
                r > 1e-6
              ) {
                const tiltRad = (-AXIAL_TILT_DEG * Math.PI) / 180;
                const s = Math.max(-1, Math.min(1, (y / r) * Math.tan(tiltRad)));
                spinGroup.current.rotation.y = Math.asin(s) - Math.atan2(x, z);
                // World position after spin + tilt (x_world = 0 by
                // construction; the tilt is about Z, so z is unchanged).
                // LoadPitch clamps it into frame.
                aimPitchRef.current = {
                  yw: r * s * Math.sin(tiltRad) + y * Math.cos(tiltRad),
                  zw: r * Math.sqrt(1 - s * s),
                };
                issAimedRef.current = true;
              }
            }
            break;
          }
        }
      } else if (msg.type === "watch") {
        const sel = selectionRef.current;
        if (sel?.kind === "sat" && sel.sat.id === msg.id) {
          setWatch({ id: msg.id, lat: msg.lat, lon: msg.lon, altKm: msg.altKm });
        }
      } else if (msg.type === "arc") {
        const want = arcWantRef.current;
        if (want && want.id === msg.id) {
          setArc({ id: msg.id, positions: new Float32Array(msg.positions), slug: want.slug });
        }
      } else if (msg.type === "shell") {
        setShellSegs((prev) => {
          const next = new Map(prev);
          next.set(msg.slug, new Float32Array(msg.positions));
          return next;
        });
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Background throttling (QC hardening 2026-07-13): the full scene
  // propagates ~12,300 satellites every second and renders every frame
  // even when the tab is hidden or backgrounded. Same gate as the
  // registry mini (src/orbits/mini3d-scene.tsx lines ~170-196): an
  // IntersectionObserver on the canvas wrap plus document.hidden decide
  // whether the view is actually visible; either being false idles the
  // worker's snapshot cadence and switches the Canvas to on-demand
  // rendering (see the Canvas frameloop prop below).
  const [sceneVisible, setSceneVisible] = useState(true);
  useEffect(() => {
    const el = wrapRef.current;
    let onScreen = true;
    const update = () => setSceneVisible(onScreen && !document.hidden);
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
    update();
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // WebGL context-loss recovery (QC hardening 2026-07-13): a mid-session
  // GPU context loss otherwise leaves a permanently blank canvas with no
  // handlers to recover it. glCanvas is captured from Canvas's onCreated
  // once the renderer exists; the listeners live on that DOM node and are
  // torn down whenever it changes or the scene unmounts.
  const [glCanvas, setGlCanvas] = useState<HTMLCanvasElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  useEffect(() => {
    if (!glCanvas) return;
    const onLost = (e: Event) => {
      // preventDefault is what allows the browser to fire
      // webglcontextrestored later; without it the loss is permanent.
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
    };
    glCanvas.addEventListener("webglcontextlost", onLost, false);
    glCanvas.addEventListener("webglcontextrestored", onRestored, false);
    return () => {
      glCanvas.removeEventListener("webglcontextlost", onLost);
      glCanvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [glCanvas]);

  // Nothing worth rendering or propagating while the tab is hidden,
  // off-screen, or the GPU context is lost: one flag idles the worker's
  // snapshot cadence and switches the Canvas to on-demand rendering (see
  // the Canvas frameloop prop below).
  const renderActive = sceneVisible && !contextLost;
  useEffect(() => {
    post({ type: "cadence", ms: renderActive ? SNAPSHOT_CADENCE_MS : IDLE_CADENCE_MS });
  }, [renderActive, post]);

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
    setBootIss(false);
    setSelection(null);
    setWatch(null);
    setArc(null);
    arcWantRef.current = null;
    post({ type: "watch", id: null });
  }, [post]);

  // A station disabled in the rail cannot stay selected: its marker just
  // left the globe, so the popup goes with it (round 4).
  useEffect(() => {
    const sel = selectionRef.current;
    if (
      sel?.kind === "ground" &&
      sel.pick.kind === "ground-station" &&
      !enabledStations.has(sel.pick.station.name)
    ) {
      clearSelection();
    }
  }, [enabledStations, clearSelection]);

  const pickSat = useCallback(
    (sat: PickedSat) => {
      setBootIss(false);
      setSelection({ kind: "sat", sat });
      setWatch(null);
      setArc(null);
      arcWantRef.current = { id: sat.id, slug: sat.slug };
      post({ type: "watch", id: sat.id });
      post({ type: "arc", id: sat.id });
    },
    [post],
  );

  const pickGround = useCallback(
    (pick: GroundPick) => {
      setBootIss(false);
      setSelection({ kind: "ground", pick });
      setWatch(null);
      setArc(null);
      arcWantRef.current = null;
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
      setBootIss(false);
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
    setBootIss(false);
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

  // Ask the worker for the ISS orbit arc (the dashed/solid line of the
  // default view). Stable id and orbit, so a repeat is harmless.
  const requestIssArc = useCallback(() => {
    const entry = layout.find((e) => e.slug === "iss" && e.ids.length > 0);
    if (!entry) return;
    arcWantRef.current = { id: entry.ids[0]!, slug: "iss" };
    post({ type: "arc", id: entry.ids[0]! });
  }, [layout, post]);

  // Default view: the ISS keeps its arc while the whole cloud stays up.
  // (Re)request once the ISS layer is present in the layout.
  useEffect(() => {
    if (bootIss) requestIssArc();
  }, [bootIss, requestIssArc]);

  // Constellation shells render only for an explicit focus. The default
  // view marks the ISS with its dashed/solid arc instead (see below), not
  // a faint shell, so bootIss no longer feeds shellFocus.
  const shellFocus = selectedConstellation;

  // Rail model, nested like the Registry (fleet parents with children).
  const staleHoursOf = (fetchedAt: string | null): number | null => {
    if (!fetchedAt) return null;
    const h = Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 3600000);
    return Number.isFinite(h) && h >= 0 ? h : null;
  };
  const railRow = (
    e: (typeof orbitCatalog)[number],
    child: boolean,
  ): RailRow => {
    const s = layerState.get(e.slug) ?? { status: "loading" as const, count: null, fetchedAt: null };
    return {
      slug: e.slug,
      name: e.name,
      fleet: false,
      child,
      count: s.count,
      cloudOn: enabled.has(e.slug),
      focused: shellFocus === e.slug,
      status: s.status,
      staleHours: s.status === "stale" ? staleHoursOf(s.fetchedAt) : null,
      collapsed: false,
    };
  };
  const railCategories: RailCategory[] = [];
  for (const cat of ["eo", "connectivity", "iot", "human-spaceflight"] as const) {
    const nodes = catalogTree.filter((n) => n.entry.category === cat);
    if (nodes.length === 0) continue;
    const catCollapsed = collapse[`cat:${cat}`] ?? false;
    const rows: RailRow[] = [];
    let constellationCount = 0;
    for (const node of nodes) {
      constellationCount += node.children.length > 0 ? 1 + node.children.length : 1;
      if (node.children.length === 0) {
        rows.push(railRow(node.entry, false));
        continue;
      }
      const children = node.children.map((c) => railRow(c, true));
      const counts = children.map((c) => c.count).filter((c): c is number => c !== null);
      const fleetCollapsed = collapse[node.entry.slug] ?? true;
      rows.push({
        slug: node.entry.slug,
        name: node.entry.name.replace(/\s*\(fleet\)$/i, ""),
        fleet: true,
        child: false,
        count: counts.length > 0 ? counts.reduce((a, b) => a + b, 0) : null,
        cloudOn: children.some((c) => c.cloudOn),
        focused: shellFocus === node.entry.slug,
        status: children.some((c) => c.status === "loading")
          ? "loading"
          : children.some((c) => c.status === "stale")
            ? "stale"
            : children.every((c) => c.status === "missing")
              ? "missing"
              : "ok",
        staleHours: null,
        collapsed: fleetCollapsed,
      });
      if (!fleetCollapsed) rows.push(...children);
    }
    railCategories.push({
      id: cat,
      label: cat === "human-spaceflight" ? "HUMAN SPACEFLIGHT" : cat.toUpperCase(),
      colorToken: CATEGORY_TOKENS[cat],
      count: constellationCount,
      cloudOn: nodes.some((n) =>
        n.children.length > 0
          ? n.children.some((c) => enabled.has(c.slug))
          : enabled.has(n.entry.slug),
      ),
      collapsed: catCollapsed,
      rows,
    });
  }
  // Ground-station groups for the rail: KSAT and SSC
  // (the two multi-site networks), then OTHERS for everything
  // else (round 7: exactly three groups). Child rows drop a leading
  // group prefix from the station name (KSAT Svalbard -> SVALBARD) like
  // fleet children do; OTHERS keeps full names.
  const gsOperators = useMemo(() => {
    if (!groundStations) return [];
    const byGroup = new Map<string, OrbitsGroundStation[]>([
      ["KSAT", []],
      ["SSC", []],
      ["OTHERS", []],
    ]);
    for (const s of groundStations) byGroup.get(gsGroupOf(s))!.push(s);
    return [...byGroup.entries()]
      .filter(([, stations]) => stations.length > 0)
      .map(([group, stations]) => ({
        id: group,
        label: group,
        collapsed: collapse[`gs:${group}`] ?? true,
        on: stations.some((s) => enabledStations.has(s.name)),
        stations: stations.map((s) => ({
          key: s.name,
          name: s.name.startsWith(`${group} `) ? s.name.slice(group.length + 1) : s.name,
          on: enabledStations.has(s.name),
        })),
      }));
    // gsGroupOf is a pure module-scope-style helper defined inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groundStations, enabledStations, collapse]);

  const trackedRows = catalogTree.reduce(
    (a, n) => a + 1 + n.children.length,
    0,
  );
  const trackedSats = [...layerState.values()].reduce((a, s) => a + (s.count ?? 0), 0);

  // Footer freshness: oldest enabled elements timestamp + feed stamps.
  const enabledStates = orbitCatalog
    .filter((e) => enabled.has(e.slug))
    .map((e) => layerState.get(e.slug)!)
    .filter((s) => s.fetchedAt !== null);
  const oldestElements = enabledStates.reduce<string | null>(
    (acc, s) => (acc === null || (s.fetchedAt && s.fetchedAt < acc) ? s.fetchedAt : acc),
    null,
  );
  const anyStale = enabledStates.some((s) => s.status === "stale");

  // An explicit constellation focus restricts picking to its layers
  // (Florian 2026-07-06: no more stray Starlink hits under focus).
  // Without a focus, connectivity layers are not pickable at all
  // (Florian 2026-07-07): Starlink's ~10k points otherwise win every
  // near-miss against the constellation the user is aiming at.
  const pickSlugs = useMemo(() => {
    if (selectedConstellation) return new Set(expandHighlight(selectedConstellation));
    return new Set(
      orbitCatalog.filter((e) => e.category !== "connectivity").map((e) => e.slug),
    );
  }, [selectedConstellation]);

  // A selected fleet parent highlights all of its child layers.
  const highlightSlugs = useMemo(() => {
    const base = selectedConstellation
      ? expandHighlight(selectedConstellation)
      : selection?.kind === "sat"
        ? [selection.sat.slug]
        : null;
    return base && base.length > 0 ? new Set(base) : null;
  }, [selectedConstellation, selection]);

  // Orbit shells: every orbit of the effective focus (explicit
  // selection, or the ISS load state with the cloud intact).
  // SGP4-sampled on the worker so each ring passes through its live dot
  // (the old two-body ellipse froze RAAN at the element-set epoch and
  // drifted off stale-epoch dots); request on focus/records change,
  // render whatever the worker returns.
  const focusSlugs = useMemo(
    () => (shellFocus ? expandHighlight(shellFocus).filter((s) => enabled.has(s)) : []),
    [shellFocus, enabled],
  );
  useEffect(() => {
    const slugs = focusSlugs.filter((s) => (recordsRef.current.get(s)?.length ?? 0) > 0);
    if (slugs.length > 0) post({ type: "shell", slugs });
    // layout signals fresh records having arrived for enabled slugs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSlugs, layout, post]);
  const shells = useMemo(
    () =>
      focusSlugs.flatMap((s) => {
        const positions = shellSegs.get(s);
        if (!positions || positions.length === 0) return [];
        return [{ slug: s, positions, color: colorBySlug.get(s) ?? colors.accent }];
      }),
    [focusSlugs, shellSegs, colorBySlug, colors.accent],
  );

  // DEV tuner (Florian 2026-07-11, rounds 2-6): live play for the
  // ground-station cones and the active-spaceport effect, gated on
  // ?tune=1. Values persist in one localStorage key and, while the panel
  // is open, drive the scene live; normal viewers get the shipped look.
  // Stored state is ALWAYS run through sanitizeConeParams: older or
  // hand-edited JSON (missing fields, wrong types, junk values) merges
  // with the defaults instead of ever reaching the scene raw.
  const tuneOn = useMemo(
    () => new URLSearchParams(window.location.search).get("tune") === "1",
    [],
  );
  const [coneTune, setConeTune] = useState<ConeParams>(() => {
    try {
      const saved = localStorage.getItem(CONE_STORAGE_KEY);
      if (saved) return sanitizeConeParams(JSON.parse(saved));
    } catch {
      // localStorage unavailable or unparseable; fall through to defaults.
    }
    return CONE_DEFAULTS;
  });
  useEffect(() => {
    if (!tuneOn) return;
    try {
      localStorage.setItem(CONE_STORAGE_KEY, JSON.stringify(coneTune));
    } catch {
      // Best-effort persistence only.
    }
  }, [coneTune, tuneOn]);
  // The scene reads the tuner only while it is open; otherwise the
  // shipped committed look (CONE_DEFAULTS, every field a Florian final).
  const coneParams: ConeParams = tuneOn ? coneTune : CONE_DEFAULTS;

  // Camera fit: the globe plus generous air for the LEO cloud, widened
  // if a MEO layer is ever enabled, stepped by the VIEW zoom buttons.
  const fitRadius = useMemo(() => {
    // 1.28 -> 1.22 (Florian 2026-07-10, rule 50b): the globe fills the
    // panel gap slightly more; the LEO cloud's outer edge cropping under
    // the chrome is by design (the fades own the top and bottom).
    let max = 1.22;
    for (const e of orbitCatalog) {
      if (e.category !== "navigation" || !enabled.has(e.slug)) continue;
      const recs = recordsRef.current.get(e.slug);
      if (recs && recs.length > 0) max = Math.max(max, maxApogeeSceneUnits(recs) * 1.06);
    }
    return max * Math.pow(0.82, zoomStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, layout, zoomStep]);

  // Spaceports with a launch inside the last 30 days pulse yellow.
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
    if (pick.kind === "ground-station") {
      const g = pick.station;
      return {
        title: g.name,
        swatchToken: RESERVE_TOKEN,
        fields: [
          { label: "OPERATOR", value: g.operator },
          { label: "COUNTRY", value: g.country || "?" },
          { label: "TYPE", value: "GROUND STATION" },
        ],
        href: g.source_url,
        hrefLabel: "Source",
        secondaryHref: null as string | null,
        secondaryLabel: null as string | null,
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
  // ECEF scene coords -> world coords through the tilt/spin groups.
  const toWorld = useCallback((v: THREE.Vector3): THREE.Vector3 => {
    const g = spinGroup.current;
    if (g) {
      g.updateWorldMatrix(true, false);
      v.applyMatrix4(g.matrixWorld);
    }
    return v;
  }, []);
  const getPopupWorldPos = useCallback((): THREE.Vector3 | null => {
    const sel = selectionRef.current;
    if (!sel) return null;
    if (sel.kind === "ground") {
      const t =
        sel.pick.kind === "spaceport"
          ? { lat: sel.pick.spaceport.lat, lon: sel.pick.spaceport.lon }
          : sel.pick.kind === "ground-station"
            ? { lat: sel.pick.station.lat, lon: sel.pick.station.lon }
            : { lat: sel.pick.facility.lat, lon: sel.pick.facility.lon };
      return toWorld(latLonToVec3(t.lat, t.lon, 1.005));
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
    return toWorld(new THREE.Vector3(x, y, z));
  }, [toWorld]);

  // The picked orbit is a hero element: always the shell accent (volt on
  // night, volt-ink on daylight), never the constellation color (rule 46).
  const arcColor = arc ? colors.volt : null;

  // Reset returns to the default view: front camera, default zoom, earth
  // spinning, no focus/selection, and the ISS arc + full cloud back up.
  const resetView = useCallback(() => {
    setResetNonce((n) => n + 1);
    setZoomStep(defaultZoom());
    setAutoRotate(!reducedMotion);
    setSelectedConstellation(null);
    setSelection(null);
    setWatch(null);
    arcWantRef.current = null;
    post({ type: "watch", id: null });
    setBootIss(true);
    requestIssArc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, post, requestIssArc]);

  // Keyboard: ESC clears focus, R resets the view (6A handoff).
  const focusRef = useRef(selectConstellation);
  focusRef.current = selectConstellation;
  const resetRef = useRef(resetView);
  resetRef.current = resetView;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        focusRef.current(null);
        clearSelection();
      } else if (e.key === "r" || e.key === "R") {
        resetRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  return (
    <div className="oframe">
      <div className="oframe-main">
        <div className="ocol-left">
          <HudColumn tracked={trackedSats} asOf={oldestElements} stats={stats} />
        </div>
        <div
          className="orbits-canvas-wrap"
          ref={wrapRef}
          onPointerDown={(e) => {
            downPos.current = { x: e.clientX, y: e.clientY };
            dragLastX.current = e.clientX;
          }}
          onPointerMove={(e) => {
            // Axis-locked drag: horizontal motion spins the earth about
            // its own tilted axis; the camera (and the tilt) stays put.
            if (!axisLockRef.current || dragLastX.current === null) return;
            const dx = e.clientX - dragLastX.current;
            dragLastX.current = e.clientX;
            if (dx === 0 || !spinGroup.current) return;
            spinGroup.current.rotation.y += dx * 0.006;
            userSpunRef.current = true;
            if (autoRotateRef.current) setAutoRotate(false);
          }}
          onPointerUp={() => {
            dragLastX.current = null;
          }}
          onPointerLeave={() => {
            dragLastX.current = null;
          }}
        >
        <Canvas
          camera={{ position: [0, 0, 2.7], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          // "demand" (not "never") while hidden/off-screen/context-lost:
          // the scene still paints its mount/state frames, matching the
          // registry mini's pattern, and resumes "always" the moment
          // renderActive flips back.
          frameloop={renderActive ? "always" : "demand"}
          onCreated={({ raycaster, gl }) => {
            // Tap-friendly pick radius (~10px, spec 4: touch-first,
            // primary selection is tap).
            raycaster.params.Points.threshold = 0.04;
            setGlCanvas(gl.domElement);
          }}
          onPointerMissed={() => {
            const down = downPos.current;
            if (down === null) return;
            clearSelection();
          }}
        >
          {/* Pads = gutter 28 + left HUD 272 + gap 16, and gap 16 + rail
              352 + gutter 28: the true spans the floating panels occupy
              on every desktop width (the panels float from 901px up). */}
          <FitCamera
            fitRadius={fitRadius}
            padLeft={desktop ? 316 : 0}
            padRight={desktop ? 396 : 0}
          />
          {/* The earth's axis leans by its real obliquity; the sky shares
              the axis (declination is measured from the equator), while
              AutoSpin turns only the earth-fixed inner group, so the tilt
              holds on screen during auto-rotate. */}
          <group rotation={[0, 0, (-AXIAL_TILT_DEG * Math.PI) / 180]}>
            <Stars color={colors.fg} spinRef={spinGroup} />
            <group ref={spinGroup}>
              <Globe colors={colors} />
              <InertialFrame groupRef={inertialGroup}>
                {shells.map((s) => (
                  <ShellLines key={s.slug} positions={s.positions} color={s.color} />
                ))}
                {arc && arcColor && <ArcLine positions={arc.positions} color={arcColor} />}
              </InertialFrame>
              <Satellites
                layout={layout}
                buffers={buffersRef}
                colorBySlug={colorBySlug}
                highlightSlugs={highlightSlugs}
                pickSlugs={pickSlugs}
                labelColor={colors.fg}
                showLabels={labelsOn}
                spinRef={spinGroup}
                downPos={downPos}
                onPick={pickSat}
              />
              <GroundMarkers
                spaceports={spaceports}
                facilities={facilities}
                groundStations={visibleGroundStations}
                showSpaceports={showSpaceports}
                showFacilities={showFacilities}
                showGroundStations={showGroundStations}
                coneParams={coneParams}
                baseColor={colors.coast}
                accentColor={colors.accent}
                recentIds={recentIds}
                reducedMotion={reducedMotion}
                selected={selection?.kind === "ground" ? selection.pick : null}
                downPos={downPos}
                onPick={pickGround}
              />
            </group>
          </group>
          <PopupAnchor getWorldPos={getPopupWorldPos} popupEl={popupEl} />
          <CameraReset nonce={resetNonce} spinRef={spinGroup} />
          <LoadPitch pendingRef={aimPitchRef} />
          <AutoSpin on={autoRotate && !reducedMotion} spinRef={spinGroup} />
          <Controls enableRotate={!axisLock} onInteract={() => setAutoRotate(false)} />
        </Canvas>
        {contextLost && (
          // WebGL context-loss fallback (QC hardening 2026-07-13): reuses
          // the styling/placement of the WebGL-unsupported card
          // (src/orbits/stage.tsx Fallback, reason "no-webgl") via the
          // shared .orbits-fallback classes, positioned as an overlay over
          // the now-blank canvas instead of the whole-page state. Stays up
          // until webglcontextrestored fires; if it never does, this is
          // the permanent state.
          <div className="orbits-fallback orbits-fallback-overlay">
            <div className="orbits-fallback-card opanel6">
              <div className="orbits-fallback-title">3D VIEW INTERRUPTED</div>
              <p>
                The browser reclaimed the graphics context for this view. It will resume
                automatically if the browser restores it.
              </p>
            </div>
          </div>
        )}
        <div className="ostatus">
          STATUS: {contextLost ? "RECONNECTING" : "LIVE"} <i className="hud-live-dot" />
        </div>
        {tuneOn && <ConeTuner params={coneTune} onChange={setConeTune} />}
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
        <div className="ocol-right">
          <LayerRail
            categories={railCategories}
            trackedTotal={trackedRows}
            allOff={enabled.size === 0}
            spaceports={{ on: showSpaceports, count: spaceports?.length ?? null }}
            facilities={{ on: showFacilities, count: facilities?.length ?? null }}
            groundStations={{
              on: showGroundStations,
              count: groundStations?.length ?? null,
              collapsed: collapse["gs"] ?? true,
              operators: gsOperators,
            }}
            onToggleCloud={toggleConstellation}
            onFocus={(slug) =>
              selectConstellation(selectedConstellation === slug ? null : slug)
            }
            onToggleCategoryCloud={toggleCategory}
            onToggleCollapse={toggleCollapse}
            onToggleSpaceports={() => setShowSpaceports((v) => !v)}
            onToggleFacilities={() => setShowFacilities((v) => !v)}
            onToggleGroundStations={toggleGroundStations}
            onToggleStation={toggleStation}
            onToggleStationOperator={toggleStationOperator}
            onRestoreDefaults={() => setEnabled(new Set(orbitCatalog.map((e) => e.slug)))}
          />
          <ViewCluster
            onZoomIn={() => setZoomStep((z) => Math.min(4, z + 1))}
            onZoomOut={() => setZoomStep((z) => Math.max(-2, z - 1))}
            autoRotate={autoRotate}
            onToggleAutoRotate={() => setAutoRotate((v) => !v)}
            axisLock={axisLock}
            onToggleAxisLock={() => setAxisLock((v) => !v)}
            labelsOn={labelsOn}
            onToggleLabels={() => setLabelsOn((v) => !v)}
            onReset={resetView}
          />
        </div>
      </div>
      <FooterBar
        tle={oldestElements}
        launch={stats?.fetched_at ?? null}
        registry={spaceportsFetchedAt}
        tleStale={anyStale}
      />
    </div>
  );
}
