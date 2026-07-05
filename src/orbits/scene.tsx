/**
 * The Orbits 3D scene: wireframe tactical globe per ORBITS_SPEC.md 3.
 * Loaded only via dynamic import from stage.tsx; nothing outside
 * src/orbits/ may import this module.
 *
 * Base tier (quiet): ocean sphere in --globe-ocean occluding the far
 * side, 15 degree graticule in --globe-grid, landmass in --globe-coast.
 * Two landmass prototypes ship behind the ?base= query while Florian
 * picks one: "lines" (coastline segments, default) and "dots"
 * (dot-matrix fill). The loser is deleted before merge (spec 3).
 *
 * All colors come from the shared theme tokens; no hex literals here
 * (acceptance criterion 8).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { MultiPolygon, Polygon, MultiLineString } from "geojson";
import landTopo from "world-atlas/land-110m.json";

const GLOBE_RADIUS = 1;
/** Occluder sits just inside the line layers to hide the far side. */
const OCEAN_RADIUS = 0.995;
const AUTO_ROTATE_RAD_PER_S = 0.05;

// ------------------------------------------------------------- theme

/** Reads a shared theme token; the tokens are the single color source. */
function token(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) throw new Error(`missing theme token ${name}`);
  return v;
}

// ---------------------------------------------------------- geometry

function latLonToVec3(latDeg: number, lonDeg: number, r: number): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.sin(lat),
    -r * Math.cos(lat) * Math.sin(lon),
  );
}

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
  const push = (a: THREE.Vector3, b: THREE.Vector3) =>
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
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

/** Ray-cast point-in-ring test on lon/lat coordinates. */
function inRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]! as [number, number];
    const [xj, yj] = ring[j]! as [number, number];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function inLand(lon: number, lat: number, polys: Polygon[]): boolean {
  for (const p of polys) {
    const [outer, ...holes] = p.coordinates;
    if (outer && inRing(lon, lat, outer as number[][])) {
      return !holes.some((h) => inRing(lon, lat, h as number[][]));
    }
  }
  return false;
}

/**
 * Dot-matrix prototype: Fibonacci-sphere sample points kept where they
 * fall on land.
 */
function landDotPositions(count: number): Float32Array {
  const landFc = feature(topology, topology.objects.land);
  const geoms = landFc.features.map((f) => f.geometry) as (MultiPolygon | Polygon)[];
  const polys: Polygon[] = geoms.flatMap((g) =>
    g.type === "Polygon"
      ? [g]
      : g.coordinates.map((c) => ({ type: "Polygon", coordinates: c }) as Polygon),
  );
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = ((((i * golden * 180) / Math.PI) % 360) + 540) % 360 - 180;
    if (inLand(lon, lat, polys)) {
      const v = latLonToVec3(lat, lon, GLOBE_RADIUS);
      out.push(v.x, v.y, v.z);
    }
  }
  return new Float32Array(out);
}

// ------------------------------------------------------------- scene

function useLineGeometry(positions: Float32Array): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function Graticule({ color }: { color: string }) {
  const positions = useMemo(graticuleSegments, []);
  const geometry = useLineGeometry(positions);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.85} />
    </lineSegments>
  );
}

function Coastlines({ color }: { color: string }) {
  const positions = useMemo(coastlineSegments, []);
  const geometry = useLineGeometry(positions);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}

function LandDots({ color }: { color: string }) {
  const positions = useMemo(() => landDotPositions(42000), []);
  const geometry = useLineGeometry(positions);
  return (
    <points geometry={geometry}>
      <pointsMaterial color={color} size={0.006} sizeAttenuation />
    </points>
  );
}

function Globe({ base }: { base: "lines" | "dots" }) {
  const colors = useMemo(
    () => ({
      ocean: token("--globe-ocean"),
      grid: token("--globe-grid"),
      coast: token("--globe-coast"),
    }),
    [],
  );
  const group = useRef<THREE.Group>(null);
  const autoRotate = useRef(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // Any interaction stops auto-rotation permanently for the session.
  useEffect(() => {
    const stop = () => {
      autoRotate.current = false;
    };
    window.addEventListener("pointerdown", stop, { once: true });
    window.addEventListener("wheel", stop, { once: true });
    return () => {
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("wheel", stop);
    };
  }, []);

  useFrame((_, delta) => {
    if (autoRotate.current && group.current) {
      group.current.rotation.y += delta * AUTO_ROTATE_RAD_PER_S;
    }
  });

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[OCEAN_RADIUS, 64, 64]} />
        <meshBasicMaterial color={colors.ocean} />
      </mesh>
      <Graticule color={colors.grid} />
      {base === "lines" ? <Coastlines color={colors.coast} /> : <LandDots color={colors.coast} />}
    </group>
  );
}

export default function Scene() {
  const controls = useRef<OrbitControlsImpl>(null);
  // Prototype toggle, dev-only: /orbits/?base=dots vs default lines.
  const [base] = useState<"lines" | "dots">(() =>
    new URLSearchParams(window.location.search).get("base") === "dots" ? "dots" : "lines",
  );

  return (
    <Canvas
      camera={{ position: [0, 0.4, 2.6], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <Globe base={base} />
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
        minDistance={1.4}
        maxDistance={4}
      />
    </Canvas>
  );
}
