/** Shared geometry helpers for the Orbits scene. */

import * as THREE from "three";

/**
 * Distance along `ray` to its entry into the origin-centered sphere, or
 * null when the ray misses it. Used to reject picks on points that sit
 * behind the occluding globe (visually hidden, so not selectable).
 */
export function sphereEntryDistance(ray: THREE.Ray, radius: number): number | null {
  const b = ray.origin.dot(ray.direction);
  const c = ray.origin.lengthSq() - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

/** True when a raycast hit at `distance` lies behind the occluder. */
export function occludedByGlobe(ray: THREE.Ray, distance: number, radius: number): boolean {
  const entry = sphereEntryDistance(ray, radius);
  return entry !== null && entry < distance - 1e-3;
}

export function latLonToVec3(latDeg: number, lonDeg: number, r: number): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.sin(lat),
    -r * Math.cos(lat) * Math.sin(lon),
  );
}
