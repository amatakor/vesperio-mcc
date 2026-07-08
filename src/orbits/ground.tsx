/**
 * Ground layers: spaceports (triangle), facilities (square), and HQs
 * (dot), drawn as billboarded point sprites in the base line color with
 * a neon accent overlay only on the selected marker (spec 3).
 */

import { useEffect, useMemo, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { OrbitsFacility, OrbitsSpaceport } from "../data/schema";
import { latLonToVec3, occludedByGlobe } from "./geo";

const MARKER_RADIUS = 1.005;
/** Must stay just inside the ocean sphere radius in scene.tsx. */
const OCCLUDER_RADIUS = 0.995;

export type GroundPick =
  | { kind: "spaceport"; spaceport: OrbitsSpaceport }
  | { kind: "facility"; facility: OrbitsFacility };

type Glyph = "triangle" | "square" | "dot";

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

/** Concurrent surface waves per active spaceport: small, slow ripples
 * (Florian 2026-07-08). */
const RIPPLE_WAVES = 3;
const RIPPLE_PERIOD_S = 8.5;
/** Peak angular radius of a wave, radians (~15 degrees of arc). */
const RIPPLE_MAX_ANGLE = 0.26;
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
  reducedMotion,
}: {
  positions: THREE.Vector3[];
  color: string;
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
      for (let w = 0; w < RIPPLE_WAVES; w++) {
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
        out.push({ line, site: s });
      }
    }
    return out;
  }, [bases, circle, color]);
  useEffect(() => () => loops.forEach((l) => (l.line.material as THREE.Material).dispose()), [loops]);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    for (let i = 0; i < loops.length; i++) {
      const { line, site } = loops[i]!;
      const base = bases[site]!;
      const wave = i % RIPPLE_WAVES;
      const t = reducedMotion ? 0.45 : (now / RIPPLE_PERIOD_S + wave / RIPPLE_WAVES) % 1;
      const theta = t * RIPPLE_MAX_ANGLE;
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

function markerPoints(
  positions: THREE.Vector3[],
  glyph: Glyph,
  color: string,
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
  return { geometry, glyph, color, size, onClick };
}

interface Props {
  spaceports: OrbitsSpaceport[] | null;
  facilities: OrbitsFacility[] | null;
  showSpaceports: boolean;
  showFacilities: boolean;
  /** Resolved CSS colors (tokens are resolved by the scene root). */
  baseColor: string;
  accentColor: string;
  /** Resolved colour for the surface-ripple wave (mint green). */
  pulseColor: string;
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
  showSpaceports,
  showFacilities,
  baseColor,
  accentColor,
  pulseColor,
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
          baseColor,
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
            baseColor,
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
            baseColor,
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
    return out;
  }, [spaceports, facilities, showSpaceports, showFacilities, baseColor, downPos, onPick]);

  const selectedMarker = useMemo(() => {
    if (!selected) return null;
    const target =
      selected.kind === "spaceport"
        ? { lat: selected.spaceport.lat, lon: selected.spaceport.lon, glyph: "triangle" as Glyph, size: 0.038 }
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
            color={layer.color}
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
      <SurfaceRipple positions={pulsePositions} color={pulseColor} reducedMotion={reducedMotion} />
    </>
  );
}
