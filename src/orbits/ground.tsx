/**
 * Ground layers: spaceports (triangle), facilities (square), and HQs
 * (dot), drawn as billboarded point sprites in the base line color with
 * a neon accent overlay only on the selected marker (spec 3).
 */

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { OrbitsFacility, OrbitsGroundStation, OrbitsSpaceport } from "../data/schema";
import { latLonToVec3, occludedByGlobe } from "./geo";
import { FOOTPRINT_EARTH_R_KM } from "./kepler";

const MARKER_RADIUS = 1.005;
/** Must stay just inside the ocean sphere radius in scene.tsx. */
const OCCLUDER_RADIUS = 0.995;

export type GroundPick =
  | { kind: "spaceport"; spaceport: OrbitsSpaceport }
  | { kind: "facility"; facility: OrbitsFacility }
  | { kind: "ground-station"; station: OrbitsGroundStation };

type Glyph = "triangle" | "square" | "dot" | "diamond";

const textures = new Map<Glyph, THREE.CanvasTexture>();
function glyphTexture(glyph: Glyph): THREE.CanvasTexture {
  let tex = textures.get(glyph);
  if (!tex) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    // Strokes stay readable when the sprite renders at ~10px.
    ctx.lineWidth = 10;
    if (glyph === "triangle") {
      ctx.beginPath();
      ctx.moveTo(32, 8);
      ctx.lineTo(58, 54);
      ctx.lineTo(6, 54);
      ctx.closePath();
      ctx.stroke();
    } else if (glyph === "square") {
      ctx.strokeRect(10, 10, 44, 44);
    } else if (glyph === "diamond") {
      // Hollow diamond (rotated square outline): the ground-station glyph,
      // distinct from the spaceport triangle and facility square.
      ctx.beginPath();
      ctx.moveTo(32, 6);
      ctx.lineTo(58, 32);
      ctx.lineTo(32, 58);
      ctx.lineTo(6, 32);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(32, 32, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    tex = new THREE.CanvasTexture(c);
    textures.set(glyph, tex);
  }
  return tex;
}

// ------------------------------------------- active spaceport treatment

/** Concurrent surface waves per active spaceport: small, slow ripples
 * (Florian 2026-07-08; tuned live and locked 2026-07-11, tuner round 7:
 * tighter 7-degree waves on a slower 9.6s cadence). */
const RIPPLE_WAVES = 3;
const RIPPLE_PERIOD_S = 9.6;
/** Peak angular radius of a wave, radians (7 degrees of arc). */
const RIPPLE_MAX_ANGLE = (7 * Math.PI) / 180;
/** Just above the coastlines so the ring hugs the surface. */
const RIPPLE_RADIUS = 1.006;
const RIPPLE_SEGMENTS = 96;

/**
 * A wave that propagates outward across the globe from each spaceport
 * with a launch in the last 30 days: an expanding geodesic circle drawn
 * as a wireframe line that sits ON the sphere and follows its curvature,
 * so its far arc dips over the horizon and is occluded by the globe
 * (Florian 2026-07-08). A unit circle in the tangent plane, scaled by
 * R*sin(theta) and pushed R*cos(theta) along the site normal, traces the
 * small circle at angular distance theta; theta animates outward.
 */
function SurfaceRipple({
  positions,
  color,
  maxAngle,
  periodS,
  waves,
  reducedMotion,
}: {
  positions: THREE.Vector3[];
  color: string;
  /** Peak angular radius of a wave, radians (shipped RIPPLE_MAX_ANGLE). */
  maxAngle: number;
  /** One wave's surface traversal, seconds (shipped RIPPLE_PERIOD_S). */
  periodS: number;
  /** Concurrent waves per site, 1-3 (shipped RIPPLE_WAVES). */
  waves: number;
  reducedMotion: boolean;
}) {
  // One unit circle in the local XY plane, shared by every wave loop.
  const circle = useMemo(() => {
    const arr = new Float32Array((RIPPLE_SEGMENTS + 1) * 3);
    for (let i = 0; i <= RIPPLE_SEGMENTS; i++) {
      const a = (i / RIPPLE_SEGMENTS) * Math.PI * 2;
      arr[i * 3] = Math.cos(a);
      arr[i * 3 + 1] = Math.sin(a);
      arr[i * 3 + 2] = 0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.5);
    return g;
  }, []);
  useEffect(() => () => circle.dispose(), [circle]);

  // Per-spaceport orientation: the site normal is the ring axis (+Z);
  // (u, v) span the tangent plane.
  const bases = useMemo(
    () =>
      positions.map((p) => {
        const axis = p.clone().normalize();
        const ref = Math.abs(axis.y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        const u = new THREE.Vector3().crossVectors(ref, axis).normalize();
        const v = new THREE.Vector3().crossVectors(axis, u).normalize();
        const q = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(u, v, axis),
        );
        return { axis, q };
      }),
    [positions],
  );

  const loops = useMemo(() => {
    const out: { line: THREE.LineLoop; site: number }[] = [];
    for (let s = 0; s < bases.length; s++) {
      for (let w = 0; w < waves; w++) {
        const line = new THREE.LineLoop(
          circle,
          new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
        );
        line.renderOrder = 2;
        line.raycast = noRaycast;
        out.push({ line, site: s });
      }
    }
    return out;
    // color is applied in place below so a live recolor (tuner drag)
    // never reallocates materials mid-stroke; radius and period are
    // per-frame reads and never touch the loop set either.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bases, circle, waves]);
  useEffect(() => () => loops.forEach((l) => (l.line.material as THREE.Material).dispose()), [loops]);
  useEffect(() => {
    for (const l of loops) (l.line.material as THREE.LineBasicMaterial).color.set(color);
  }, [loops, color]);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    for (let i = 0; i < loops.length; i++) {
      const { line, site } = loops[i]!;
      const base = bases[site]!;
      const wave = i % waves;
      const t = reducedMotion ? 0.45 : (now / periodS + wave / waves) % 1;
      const theta = t * maxAngle;
      const r = RIPPLE_RADIUS * Math.sin(theta);
      line.quaternion.copy(base.q);
      line.position.copy(base.axis).multiplyScalar(RIPPLE_RADIUS * Math.cos(theta));
      line.scale.set(r, r, 1);
      // Bright at birth, easing out as it spreads.
      (line.material as THREE.LineBasicMaterial).opacity = reducedMotion
        ? 0.85
        : 0.95 * Math.pow(1 - t, 0.42);
    }
  });

  if (positions.length === 0) return null;
  return (
    <>
      {loops.map((l, i) => (
        <primitive key={i} object={l.line} />
      ))}
    </>
  );
}

/**
 * "Breathe" effect (round 6): an additive triangle overlay at each
 * active spaceport whose opacity oscillates with the effect period, so
 * the glyph itself pulses brightness. Display-only (raycast disabled);
 * reduced motion holds a steady mid-brightness frame instead.
 */
function BreatheMark({
  positions,
  color,
  periodS,
  reducedMotion,
}: {
  positions: THREE.Vector3[];
  color: string;
  periodS: number;
  reducedMotion: boolean;
}) {
  const geometry = useMemo(() => {
    if (positions.length === 0) return null;
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(positions.length * 3);
    positions.forEach((v, i) => {
      arr[i * 3] = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    });
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.3);
    return g;
  }, [positions]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  const matRef = useRef<THREE.PointsMaterial>(null);
  useFrame(({ clock }) => {
    const m = matRef.current;
    if (!m) return;
    m.opacity = reducedMotion
      ? 0.75
      : 0.55 + 0.4 * Math.sin((clock.getElapsedTime() / periodS) * Math.PI * 2);
  });

  if (!geometry) return null;
  return (
    <points geometry={geometry} raycast={noRaycast} renderOrder={2}>
      <pointsMaterial
        ref={matRef}
        size={0.045}
        sizeAttenuation
        map={glyphTexture("triangle")}
        color={color}
        transparent
        opacity={0.75}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Radial segments around each cone's rim; 16 stations x 64 is trivial. */
const CONE_SEGMENTS = 64;
/** Rings of vertices up the cone axis (apex -> rim). More rings give a
 * smoother apex->rim alpha gradient; 6 is plenty for the fade. */
const CONE_RINGS = 6;
/** Vertex rings across the beacon style's footprint disc (centre->edge). */
const DISC_RINGS = 4;
/** Altitude rings of the "rings" style, as fractions of the fade height. */
const RING_FRACTIONS = [1 / 3, 2 / 3, 1] as const;
/** Beacon line length as a fraction of the fade height. */
const BEACON_FRACTION = 0.45;
/** Surface adornments (footprint disc) sit just above the coastlines. */
const DISC_RADIUS = 1.004;

/** Cone render styles (Florian round 2, 2026-07-11): the thin lateral
 * wall reads poorly from a top-down camera, so each style adds a
 * different top-down cue on top of (or instead of) the plain walls. */
export type ConeStyle = "walls" | "rim" | "rings" | "beacon";
export const CONE_STYLES: readonly ConeStyle[] = ["walls", "rim", "rings", "beacon"];

/** Active-spaceport effect variants (round 6): "ripple" is the expanding
 * surface circles, "breathe" the glyph brightness pulse, "both" layers
 * them. */
export type PortEffect = "ripple" | "breathe" | "both";
export const PORT_EFFECTS: readonly PortEffect[] = ["ripple", "breathe", "both"];

/** Everything the DEV tuner drives (scene.tsx); fixed to the committed
 * defaults for normal viewers. Round 6 gave the spaceport group real
 * effect controls (effect / radius / period / rings) alongside the one
 * color that drives mark and effect together. */
export interface ConeParams {
  /** Cone color: resolved CSS color (hex for the tuner's color input).
   * The station diamond glyph and base dot track it (shipped sync). */
  color: string;
  /** Alpha at the apex/base, fading to 0 at the top rim (0..1). */
  apexOpacity: number;
  /** Fade (truncation) height above the surface, km. */
  fadeHeightKm: number;
  /** Minimum elevation mask epsilon, degrees (reshapes the half-angle). */
  minElevDeg: number;
  /** Render style (see ConeStyle). */
  style: ConeStyle;
  /** Spaceport color: the triangle glyph always, plus the active effect
   * (Florian's final pick, round 6). */
  portColor: string;
  /** Active-spaceport effect (see PortEffect). */
  portEffect: PortEffect;
  /** Ripple max angular radius, DEGREES in the tuner/JSON (the engine
   * uses radians; shipped RIPPLE_MAX_ANGLE = 0.26 rad ~= 14.9 deg). */
  portRadius: number;
  /** Effect cadence in seconds: one ripple traversal / one breath. */
  portPeriod: number;
  /** Concurrent ripple rings per site (1-3). */
  portRings: number;
}

/** Shipped look, all values Florian finals: cones from round 4 amended
 * in round 6 (fadeHeightKm 500 -> 600), portColor from round 6
 * (#ff6905, mark + effect). The effect fields mirror the shipped ripple
 * treatment resolved from its own constants (ripple / 0.26 rad / 8.5 s /
 * 3 rings) so the tuner opens on exactly what ships; the suggested 2.4 s
 * HUD-cadence default assumed the breathe effect was shipping and sits
 * inside the slider range instead of being the default. */
export const CONE_DEFAULTS: ConeParams = {
  color: "#00ff2a",
  apexOpacity: 0.3,
  fadeHeightKm: 600,
  minElevDeg: 10,
  style: "rings",
  portColor: "#ff6905",
  portEffect: "ripple",
  // The shipped 0.26 rad expressed in the tuner's degrees, 1-decimal.
  portRadius: Math.round((RIPPLE_MAX_ANGLE * 1800) / Math.PI) / 10,
  portPeriod: RIPPLE_PERIOD_S,
  portRings: RIPPLE_WAVES,
};

/**
 * Defensive rebuild of ConeParams from untrusted input (localStorage:
 * older tuner versions stored fewer keys, and hand-edited values can be
 * any shape). Every field is validated and clamped to the tuner's own
 * ranges; anything unusable falls back to the shipped default. A bad
 * stored value must never be able to crash the scene (Florian round 3).
 */
export function sanitizeConeParams(raw: unknown): ConeParams {
  const d = CONE_DEFAULTS;
  if (typeof raw !== "object" || raw === null) return { ...d };
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  const hex = (v: unknown, fallback: string) =>
    typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  return {
    color: hex(r.color, d.color),
    apexOpacity: num(r.apexOpacity, 0, 1, d.apexOpacity),
    fadeHeightKm: num(r.fadeHeightKm, 100, 2000, d.fadeHeightKm),
    minElevDeg: num(r.minElevDeg, 5, 20, d.minElevDeg),
    style: CONE_STYLES.includes(r.style as ConeStyle) ? (r.style as ConeStyle) : d.style,
    portColor: hex(r.portColor, d.portColor),
    portEffect: PORT_EFFECTS.includes(r.portEffect as PortEffect)
      ? (r.portEffect as PortEffect)
      : d.portEffect,
    portRadius: num(r.portRadius, 5, 35, d.portRadius),
    portPeriod: num(r.portPeriod, 1.2, 9.6, d.portPeriod),
    portRings: Math.round(num(r.portRings, 1, 3, d.portRings)),
  };
}

/** Raycast no-op: cones and their adornments are display-only volumes
 * and must never swallow clicks meant for markers or empty space. */
const noRaycast = () => {};

/**
 * Last-resort guard around the cone layer: if anything in it throws
 * (bad geometry, a future style bug, a poisoned param that slipped the
 * sanitizer), the cones drop out and the rest of the scene keeps
 * rendering — a missing overlay, never a dead canvas (Florian round 3).
 * GroundMarkers keys the guard by the active style, so a switch re-arms
 * it and one bad style cannot disable the others.
 */
export class ConeGuard extends Component<{ children?: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error("ground-station cones disabled after render error:", error);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Station-local frame: n = unit position (local vertical / cone axis),
 * (u, v) span the tangent plane, apex = the station at marker height. */
interface Frame {
  n: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  apex: THREE.Vector3;
}

function stationFrame(lat: number, lon: number): Frame {
  const n = latLonToVec3(lat, lon, 1);
  const ref = Math.abs(n.y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(ref, n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { n, u, v, apex: n.clone().multiplyScalar(MARKER_RADIUS) };
}

function coneBounds(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.8);
  return g;
}

/** The cone's lateral surface: rings of vertices apex->rim with an aFade
 * attribute easing `fadeScale` at the apex to 0 at the top rim. */
function wallsGeometry(
  f: Frame,
  height: number,
  tan: number,
  fadeScale: number,
): THREE.BufferGeometry {
  const rows = CONE_RINGS + 1;
  const pos = new Float32Array(rows * CONE_SEGMENTS * 3);
  const fade = new Float32Array(rows * CONE_SEGMENTS);
  for (let r = 0; r < rows; r++) {
    const fr = r / CONE_RINGS; // 0 at apex, 1 at top rim
    const t = fr * height; // axial distance from apex, globe units
    const radius = t * tan; // cross-section radius at this height
    const cx = f.apex.x + f.n.x * t;
    const cy = f.apex.y + f.n.y * t;
    const cz = f.apex.z + f.n.z * t;
    for (let i = 0; i < CONE_SEGMENTS; i++) {
      const a = (i / CONE_SEGMENTS) * Math.PI * 2;
      const ct = Math.cos(a);
      const st = Math.sin(a);
      const k = (r * CONE_SEGMENTS + i) * 3;
      pos[k] = cx + radius * (ct * f.u.x + st * f.v.x);
      pos[k + 1] = cy + radius * (ct * f.u.y + st * f.v.y);
      pos[k + 2] = cz + radius * (ct * f.u.z + st * f.v.z);
      fade[r * CONE_SEGMENTS + i] = (1 - fr) * fadeScale; // strongest at apex
    }
  }
  // Index the lateral surface as quads between successive rings.
  const idx: number[] = [];
  for (let r = 0; r < CONE_RINGS; r++) {
    for (let i = 0; i < CONE_SEGMENTS; i++) {
      const a = r * CONE_SEGMENTS + i;
      const b = r * CONE_SEGMENTS + ((i + 1) % CONE_SEGMENTS);
      const c = (r + 1) * CONE_SEGMENTS + i;
      const d = (r + 1) * CONE_SEGMENTS + ((i + 1) % CONE_SEGMENTS);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aFade", new THREE.BufferAttribute(fade, 1));
  g.setIndex(idx);
  return coneBounds(g);
}

/** One circle of the cone's cross-section at axial distance `t`, drawn
 * as a LineLoop with a constant fade value (values above 1 read brighter
 * than the walls under the shared alpha shader). */
function ringGeometry(f: Frame, t: number, radius: number, fadeVal: number): THREE.BufferGeometry {
  const pos = new Float32Array(CONE_SEGMENTS * 3);
  const fade = new Float32Array(CONE_SEGMENTS).fill(fadeVal);
  const cx = f.apex.x + f.n.x * t;
  const cy = f.apex.y + f.n.y * t;
  const cz = f.apex.z + f.n.z * t;
  for (let i = 0; i < CONE_SEGMENTS; i++) {
    const a = (i / CONE_SEGMENTS) * Math.PI * 2;
    const ct = Math.cos(a);
    const st = Math.sin(a);
    pos[i * 3] = cx + radius * (ct * f.u.x + st * f.v.x);
    pos[i * 3 + 1] = cy + radius * (ct * f.u.y + st * f.v.y);
    pos[i * 3 + 2] = cz + radius * (ct * f.u.z + st * f.v.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aFade", new THREE.BufferAttribute(fade, 1));
  return coneBounds(g);
}

/** Beacon style's filled footprint disc: a spherical-cap triangle fan ON
 * the surface (following the curvature, so wide discs never dip inside
 * the globe), alpha fading centre -> edge. `phiMax` is the cap's angular
 * radius, matched to the truncation rim as seen from the earth centre. */
function discGeometry(f: Frame, phiMax: number): THREE.BufferGeometry {
  const count = 1 + DISC_RINGS * CONE_SEGMENTS;
  const pos = new Float32Array(count * 3);
  const fade = new Float32Array(count);
  pos[0] = f.n.x * DISC_RADIUS;
  pos[1] = f.n.y * DISC_RADIUS;
  pos[2] = f.n.z * DISC_RADIUS;
  fade[0] = 0.9;
  for (let r = 1; r <= DISC_RINGS; r++) {
    const phi = (r / DISC_RINGS) * phiMax;
    const cp = Math.cos(phi) * DISC_RADIUS;
    const sp = Math.sin(phi) * DISC_RADIUS;
    for (let i = 0; i < CONE_SEGMENTS; i++) {
      const a = (i / CONE_SEGMENTS) * Math.PI * 2;
      const ct = Math.cos(a);
      const st = Math.sin(a);
      const k = (1 + (r - 1) * CONE_SEGMENTS + i) * 3;
      pos[k] = cp * f.n.x + sp * (ct * f.u.x + st * f.v.x);
      pos[k + 1] = cp * f.n.y + sp * (ct * f.u.y + st * f.v.y);
      pos[k + 2] = cp * f.n.z + sp * (ct * f.u.z + st * f.v.z);
      fade[1 + (r - 1) * CONE_SEGMENTS + i] = 0.9 * (1 - r / DISC_RINGS);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < CONE_SEGMENTS; i++) {
    idx.push(0, 1 + i, 1 + ((i + 1) % CONE_SEGMENTS));
  }
  for (let r = 0; r < DISC_RINGS - 1; r++) {
    for (let i = 0; i < CONE_SEGMENTS; i++) {
      const a = 1 + r * CONE_SEGMENTS + i;
      const b = 1 + r * CONE_SEGMENTS + ((i + 1) % CONE_SEGMENTS);
      const c = 1 + (r + 1) * CONE_SEGMENTS + i;
      const d = 1 + (r + 1) * CONE_SEGMENTS + ((i + 1) % CONE_SEGMENTS);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aFade", new THREE.BufferAttribute(fade, 1));
  g.setIndex(idx);
  return coneBounds(g);
}

/** Beacon style's short bright vertical line rising from the station,
 * fading upward (a polyline so the shared shader grades the alpha). */
function beaconGeometry(f: Frame, height: number): THREE.BufferGeometry {
  const S = 8;
  const len = BEACON_FRACTION * height;
  const pos = new Float32Array((S + 1) * 3);
  const fade = new Float32Array(S + 1);
  for (let i = 0; i <= S; i++) {
    const k = i / S;
    const t = k * len;
    pos[i * 3] = f.apex.x + f.n.x * t;
    pos[i * 3 + 1] = f.apex.y + f.n.y * t;
    pos[i * 3 + 2] = f.apex.z + f.n.z * t;
    fade[i] = 2.8 * (1 - k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aFade", new THREE.BufferAttribute(fade, 1));
  return coneBounds(g);
}

/**
 * One translucent 3D receiving cone per ground station (Florian
 * 2026-07-11, replacing the per-constellation footprint rings): apex AT
 * the station, axis along the local vertical (the station's unit position
 * vector), half-angle (90 - epsilon). The lateral surface is a truncated
 * cone rising to `fadeHeightKm` above the surface, built as a BufferGeometry
 * with a per-vertex fade factor (1 at the apex/base, 0 at the top rim) so
 * a lightweight ShaderMaterial fades the volume out into a gradient at
 * higher altitudes. Additive blending matches the satellites' glow;
 * depth-tested (write off) so far-side cones are occluded by the globe
 * like the other surface features and near/far walls sum without z-fights.
 *
 * Geometry rebuilds ONLY when the station set, epsilon, fade height, or
 * style changes (the shape depends only on those); color and apex
 * opacity are live uniforms, so recoloring never rebuilds a buffer. One
 * shared material across every cone and adornment (the aFade attribute
 * carries each piece's brightness profile); geometries and material
 * dispose on cleanup.
 *
 * Styles (Florian round 2): "walls" is the plain lateral surface;
 * "rim" adds a brighter LineLoop at the truncation rim (reads as a
 * circle from above); "rings" dims the walls and stacks three concentric
 * altitude rings at fractions of the fade height (radar-range-ring
 * look), fading upward; "beacon" adds a filled low-alpha footprint disc
 * on the ground plus a short bright vertical beacon line at the station.
 */
function ReceivingCones({
  stations,
  color,
  apexOpacity,
  fadeHeightKm,
  minElevDeg,
  style,
}: {
  stations: OrbitsGroundStation[];
  color: string;
  apexOpacity: number;
  fadeHeightKm: number;
  minElevDeg: number;
  style: ConeStyle;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: apexOpacity },
        },
        vertexShader: `
          attribute float aFade;
          varying float vFade;
          void main() {
            vFade = aFade;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vFade;
          void main() {
            gl_FragColor = vec4(uColor, vFade * uOpacity);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    // Uniforms are updated in place below; the material itself is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Recolor / re-opacity without touching geometry (perf: no rebuild).
  useEffect(() => {
    (material.uniforms.uColor!.value as THREE.Color).set(color);
    material.uniforms.uOpacity!.value = apexOpacity;
  }, [material, color, apexOpacity]);

  const objects = useMemo(() => {
    const halfAngle = ((90 - minElevDeg) * Math.PI) / 180;
    const tan = Math.tan(halfAngle);
    // km -> globe units: globe radius 1 == FOOTPRINT_EARTH_R_KM.
    const height = fadeHeightKm / FOOTPRINT_EARTH_R_KM;
    const rimRadius = height * tan;
    const out: (THREE.Mesh | THREE.Line)[] = [];
    const add = (g: THREE.BufferGeometry, kind: "mesh" | "loop" | "line") => {
      const o =
        kind === "mesh"
          ? new THREE.Mesh(g, material)
          : kind === "loop"
            ? new THREE.LineLoop(g, material)
            : new THREE.Line(g, material);
      o.renderOrder = 1;
      o.raycast = noRaycast;
      out.push(o);
    };
    for (const s of stations) {
      const f = stationFrame(s.lat, s.lon);
      // The walls carry every style; "rings" dims them so its altitude
      // rings read on top.
      add(wallsGeometry(f, height, tan, style === "rings" ? 0.55 : 1), "mesh");
      if (style === "rim") {
        add(ringGeometry(f, height, rimRadius, 2.2), "loop");
      } else if (style === "rings") {
        for (const fr of RING_FRACTIONS) {
          // Brighter low, dimmer high: the stack fades upward like the walls.
          add(ringGeometry(f, fr * height, fr * height * tan, 2.4 * (1 - fr) + 0.5), "loop");
        }
      } else if (style === "beacon") {
        add(discGeometry(f, Math.atan(rimRadius / (1 + height))), "mesh");
        add(beaconGeometry(f, height), "line");
      }
    }
    return out;
  }, [stations, fadeHeightKm, minElevDeg, style, material]);
  useEffect(() => () => objects.forEach((o) => o.geometry.dispose()), [objects]);

  if (stations.length === 0) return null;
  return (
    <>
      {objects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  );
}

/** Which color a marker layer renders with; resolved at render time so a
 * live recolor (tuner glyph sync) is a material tint, never a geometry
 * rebuild (round 3: no stutter, nothing to throttle — the glyph textures
 * are white and static, tinted by the material color). */
type MarkerRole = "spaceport" | "facility" | "hq" | "station";

function markerPoints(
  positions: THREE.Vector3[],
  glyph: Glyph,
  role: MarkerRole,
  size: number,
  onClick: (index: number, e: ThreeEvent<MouseEvent>) => void,
) {
  const geometry = new THREE.BufferGeometry();
  const arr = new Float32Array(positions.length * 3);
  positions.forEach((v, i) => {
    arr[i * 3] = v.x;
    arr[i * 3 + 1] = v.y;
    arr[i * 3 + 2] = v.z;
  });
  geometry.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  // Markers hug the globe; a fixed bounding sphere spares three from
  // computing one (which spams a NaN warning during load races).
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.3);
  return { geometry, glyph, role, size, onClick };
}

interface Props {
  spaceports: OrbitsSpaceport[] | null;
  facilities: OrbitsFacility[] | null;
  groundStations: OrbitsGroundStation[] | null;
  showSpaceports: boolean;
  showFacilities: boolean;
  showGroundStations: boolean;
  /** Tuner-driven parameters (cones + spaceport marks), fixed to the
   * shipped defaults unless the DEV tuner is live. The station diamond
   * tracks `color` and the spaceport triangle `portColor` in BOTH modes
   * (round 4: the sync is the shipped look; the non-tune portColor is
   * the resolved marker base, so nothing changes for normal viewers). */
  coneParams: ConeParams;
  /** Resolved CSS colors (tokens are resolved by the scene root). */
  baseColor: string;
  accentColor: string;
  /** LL2 ids of spaceports with a launch in the last 30 days. */
  recentIds: ReadonlySet<number>;
  reducedMotion: boolean;
  selected: GroundPick | null;
  downPos: MutableRefObject<{ x: number; y: number } | null>;
  onPick(pick: GroundPick): void;
}

function isDragging(e: ThreeEvent<MouseEvent>, down: { x: number; y: number } | null): boolean {
  return (
    down !== null &&
    Math.hypot(e.nativeEvent.clientX - down.x, e.nativeEvent.clientY - down.y) > 8
  );
}

export function GroundMarkers({
  spaceports,
  facilities,
  groundStations,
  showSpaceports,
  showFacilities,
  showGroundStations,
  coneParams,
  baseColor,
  accentColor,
  recentIds,
  reducedMotion,
  selected,
  downPos,
  onPick,
}: Props) {
  const pulsePositions = useMemo(
    () =>
      showSpaceports && spaceports
        ? spaceports
            .filter((s) => recentIds.has(s.ll2_id))
            .map((s) => latLonToVec3(s.lat, s.lon, MARKER_RADIUS))
        : [],
    [spaceports, showSpaceports, recentIds],
  );
  const layers = useMemo(() => {
    const out: ReturnType<typeof markerPoints>[] = [];
    if (showSpaceports && spaceports && spaceports.length > 0) {
      out.push(
        markerPoints(
          spaceports.map((s) => latLonToVec3(s.lat, s.lon, MARKER_RADIUS)),
          "triangle",
          "spaceport",
          0.045,
          (i, e) => {
            if (isDragging(e, downPos.current)) return;
            e.stopPropagation();
            onPick({ kind: "spaceport", spaceport: spaceports[i]! });
          },
        ),
      );
    }
    if (showFacilities && facilities && facilities.length > 0) {
      const plants = facilities.filter((f) => f.type !== "hq");
      const hqs = facilities.filter((f) => f.type === "hq");
      if (plants.length > 0) {
        out.push(
          markerPoints(
            plants.map((f) => latLonToVec3(f.lat, f.lon, MARKER_RADIUS)),
            "square",
            "facility",
            0.024,
            (i, e) => {
              if (isDragging(e, downPos.current)) return;
              e.stopPropagation();
              onPick({ kind: "facility", facility: plants[i]! });
            },
          ),
        );
      }
      if (hqs.length > 0) {
        out.push(
          markerPoints(
            hqs.map((f) => latLonToVec3(f.lat, f.lon, MARKER_RADIUS)),
            "dot",
            "hq",
            0.014,
            (i, e) => {
              if (isDragging(e, downPos.current)) return;
              e.stopPropagation();
              onPick({ kind: "facility", facility: hqs[i]! });
            },
          ),
        );
      }
    }
    if (showGroundStations && groundStations && groundStations.length > 0) {
      // Origin emphasis (Florian round 2): with the layer (and so the
      // cones) on, the station glyph brightens toward white and grows a
      // step, so each cone visibly grows out of its point of origin.
      out.push(
        markerPoints(
          groundStations.map((g) => latLonToVec3(g.lat, g.lon, MARKER_RADIUS)),
          "diamond",
          "station",
          0.037,
          (i, e) => {
            if (isDragging(e, downPos.current)) return;
            e.stopPropagation();
            onPick({ kind: "ground-station", station: groundStations[i]! });
          },
        ),
      );
    }
    return out;
  }, [
    spaceports,
    facilities,
    groundStations,
    showSpaceports,
    showFacilities,
    showGroundStations,
    downPos,
    onPick,
  ]);
  // Marker geometries are rebuilt only when the data or visibility
  // changes; dispose the old set (colors are render-time material tints
  // and never touch these buffers).
  useEffect(() => () => layers.forEach((l) => l.geometry.dispose()), [layers]);

  // Render-time marker colors (round 4, shipped sync): the spaceport
  // triangle always renders in portColor (shipped = the resolved marker
  // base) and the station diamond always in the cone color, matching the
  // base dot, so the cones visibly grow out of like-colored points.
  const roleColor = (role: MarkerRole): string =>
    role === "spaceport"
      ? coneParams.portColor
      : role === "station"
        ? coneParams.color
        : baseColor;

  // Origin emphasis, part two: a small bright base dot in the cone color
  // at every station, additive like the cones, so the apex reads as a
  // lit point. Display-only (raycast disabled on the points below).
  const stationDotGeom = useMemo(() => {
    if (!showGroundStations || !groundStations || groundStations.length === 0) return null;
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(groundStations.length * 3);
    groundStations.forEach((s, i) => {
      const p = latLonToVec3(s.lat, s.lon, MARKER_RADIUS);
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.3);
    return g;
  }, [showGroundStations, groundStations]);
  useEffect(() => () => stationDotGeom?.dispose(), [stationDotGeom]);

  const selectedMarker = useMemo(() => {
    if (!selected) return null;
    const target =
      selected.kind === "spaceport"
        ? { lat: selected.spaceport.lat, lon: selected.spaceport.lon, glyph: "triangle" as Glyph, size: 0.038 }
        : selected.kind === "ground-station"
          ? {
              lat: selected.station.lat,
              lon: selected.station.lon,
              glyph: "diamond" as Glyph,
              size: 0.038,
            }
          : {
              lat: selected.facility.lat,
              lon: selected.facility.lon,
              glyph: selected.facility.type === "hq" ? ("dot" as Glyph) : ("square" as Glyph),
              size: selected.facility.type === "hq" ? 0.02 : 0.032,
            };
    const geometry = new THREE.BufferGeometry();
    const v = latLonToVec3(target.lat, target.lon, MARKER_RADIUS);
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([v.x, v.y, v.z]), 3));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.3);
    return { geometry, glyph: target.glyph, size: target.size };
  }, [selected]);
  useEffect(() => () => selectedMarker?.geometry.dispose(), [selectedMarker]);

  return (
    <>
      {layers.map((layer, i) => (
        <points
          key={`${layer.glyph}-${i}-${layer.geometry.attributes.position!.count}`}
          geometry={layer.geometry}
          onClick={(e) => {
            // Claim the nearest non-occluded marker of THIS layer.
            // Far-side markers are hidden behind the globe and excluded.
            // R3F dispatches nearest-first with stopPropagation, and the
            // unpickable satellite blanket is transparent to picks
            // (satellites.tsx), so if this handler runs the marker is a
            // valid target and no longer gets swallowed (Florian 2026-07-07).
            const own = e.intersections.find(
              (h) =>
                h.object === e.eventObject &&
                h.index !== undefined &&
                !occludedByGlobe(e.ray, h.distance, OCCLUDER_RADIUS),
            );
            if (!own) return;
            e.stopPropagation();
            layer.onClick(own.index!, e);
          }}
        >
          <pointsMaterial
            size={layer.size}
            sizeAttenuation
            map={glyphTexture(layer.glyph)}
            color={roleColor(layer.role)}
            transparent
            alphaTest={0.15}
            depthWrite={false}
          />
        </points>
      ))}
      {selectedMarker && (
        <points geometry={selectedMarker.geometry}>
          <pointsMaterial
            size={selectedMarker.size}
            sizeAttenuation
            map={glyphTexture(selectedMarker.glyph)}
            color={accentColor}
            transparent
            alphaTest={0.15}
            depthWrite={false}
          />
        </points>
      )}
      <ConeGuard key={coneParams.style}>
        {showGroundStations && groundStations && groundStations.length > 0 && (
          <ReceivingCones
            stations={groundStations}
            color={coneParams.color}
            apexOpacity={coneParams.apexOpacity}
            fadeHeightKm={coneParams.fadeHeightKm}
            minElevDeg={coneParams.minElevDeg}
            style={coneParams.style}
          />
        )}
        {stationDotGeom && (
          <points geometry={stationDotGeom} raycast={noRaycast}>
            <pointsMaterial
              size={0.018}
              sizeAttenuation
              map={glyphTexture("dot")}
              color={coneParams.color}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
        )}
      </ConeGuard>
      {(coneParams.portEffect === "ripple" || coneParams.portEffect === "both") && (
        <SurfaceRipple
          positions={pulsePositions}
          color={coneParams.portColor}
          maxAngle={(coneParams.portRadius * Math.PI) / 180}
          periodS={coneParams.portPeriod}
          waves={coneParams.portRings}
          reducedMotion={reducedMotion}
        />
      )}
      {(coneParams.portEffect === "breathe" || coneParams.portEffect === "both") && (
        <BreatheMark
          positions={pulsePositions}
          color={coneParams.portColor}
          periodS={coneParams.portPeriod}
          reducedMotion={reducedMotion}
        />
      )}
    </>
  );
}
