/**
 * Star background behind the globe: the real sky from the Yale Bright
 * Star Catalog (public domain), stars placed at their J2000 RA/Dec and
 * the whole field rotated to the current sidereal time, so the sky sits
 * where it actually is relative to the earth-fixed globe. A gentle
 * parallax factor makes the field trail the camera slightly, so it
 * reads as a distant background rather than a skin on the globe.
 */

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { loadStars } from "./elements";
import { latLonToVec3 } from "./geo";

/** Scene units; beyond every camera fit distance, inside the far plane. */
const STAR_RADIUS = 60;
/** Fraction of the camera's azimuth the field follows: stars appear to
 * move at (1 - PARALLAX) of the globe's rate when the view rotates. */
const PARALLAX = 0.3;
/** Split for the two point sizes; roughly the naked-eye "bright" stars. */
const BRIGHT_MAG = 2.5;

/** Greenwich mean sidereal time in radians (IAU 1982 linear form; more
 * than accurate enough to orient a background). */
function gmstRad(ms: number): number {
  const days = (ms - 946728000000) / 86400000; // since J2000.0 (2000-01-01T12:00Z)
  const deg = ((280.46061837 + 360.98564736629 * days) % 360 + 360) % 360;
  return deg * (Math.PI / 180);
}

/** One Points cloud with per-star brightness baked into vertex colors. */
function makeCloud(
  stars: [number, number, number][],
  baseColor: string,
  sizePx: number,
): THREE.Points {
  const positions = new Float32Array(stars.length * 3);
  const colors = new Float32Array(stars.length * 3);
  const base = new THREE.Color(baseColor);
  stars.forEach(([ra, dec, mag], i) => {
    // RA maps to longitude in the group's inertial frame; the group's
    // rotation carries the frame to ECEF (lon = RA - GMST).
    const v = latLonToVec3(dec, ra, STAR_RADIUS);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    const b = Math.min(1, Math.max(0.18, (5.8 - mag) / 5));
    colors[i * 3] = base.r * b;
    colors[i * 3 + 1] = base.g * b;
    colors[i * 3 + 2] = base.b * b;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  // The field is a fixed shell; pin its bounding sphere so three never
  // computes one (which warns NaN for an empty split during load).
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), STAR_RADIUS + 1);
  const m = new THREE.PointsMaterial({
    // Original point sizes restored (tuning round 3): the dpr-scaled
    // sizes read as chunky squares. Star data remains the Yale Bright
    // Star Catalog at true RA/Dec with sidereal orientation.
    size: sizePx,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  return new THREE.Points(g, m);
}

export function Stars({
  color,
  spinRef,
}: {
  color: string;
  /** The earth-fixed spin group: the parallax follows globe spin (auto-
   * rotate, axis-locked drags) exactly like camera azimuth changes. */
  spinRef: MutableRefObject<THREE.Group | null>;
}) {
  const [stars, setStars] = useState<[number, number, number][] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadStars().then((file) => {
      if (alive && file) setStars(file.stars);
    });
    return () => {
      alive = false;
    };
  }, []);

  const clouds = useMemo(() => {
    if (!stars) return null;
    return [
      makeCloud(stars.filter((s) => s[2] < BRIGHT_MAG), color, 2.2),
      makeCloud(stars.filter((s) => s[2] >= BRIGHT_MAG), color, 1.3),
    ];
  }, [stars, color]);
  useEffect(
    () => () => {
      for (const c of clouds ?? []) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    },
    [clouds],
  );

  const group = useRef<THREE.Group>(null);
  // Unwrapped camera azimuth, accumulated per frame: zero at the initial
  // view (so the sky starts at its true sidereal orientation) and free of
  // the atan2 discontinuity at +-180 degrees.
  const az = useRef<{ last: number | null; unwrapped: number }>({ last: null, unwrapped: 0 });
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const lon = Math.atan2(-camera.position.z, camera.position.x);
    const a = az.current;
    if (a.last !== null) {
      let d = lon - a.last;
      if (d > Math.PI) d -= 2 * Math.PI;
      else if (d < -Math.PI) d += 2 * Math.PI;
      a.unwrapped += d;
    }
    a.last = lon;
    // Sidereal orientation plus the parallax share of the total view
    // rotation: camera azimuth and globe spin combined (positive group
    // rotation.y adds to effective longitude).
    const spin = spinRef.current ? spinRef.current.rotation.y : 0;
    g.rotation.y = -gmstRad(Date.now()) + PARALLAX * (a.unwrapped + spin);
  });

  if (!clouds) return null;
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <primitive key={i} object={c} />
      ))}
    </group>
  );
}
