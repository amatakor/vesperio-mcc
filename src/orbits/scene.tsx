/**
 * The Orbits 3D scene: wireframe tactical globe per ORBITS_SPEC.md 3.
 * Loaded only via dynamic import from stage.tsx; nothing outside
 * src/orbits/ may import this module.
 *
 * Base tier (quiet): ocean sphere in --globe-ocean occluding the far
 * side, 15 degree graticule in --globe-grid, coastlines in
 * --globe-coast (Florian picked coastlines over the dot-matrix
 * prototype, 2026-07-05).
 *
 * All colors come from the shared theme tokens; no hex literals here
 * (acceptance criterion 8).
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { MultiLineString } from "geojson";
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

function Globe() {
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
      <Coastlines color={colors.coast} />
    </group>
  );
}

export default function Scene() {
  const controls = useRef<OrbitControlsImpl>(null);

  return (
    <Canvas
      camera={{ position: [0, 0.4, 2.6], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <Globe />
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
