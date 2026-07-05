/**
 * Ground layers: spaceports (triangle), facilities (square), and HQs
 * (dot), drawn as billboarded point sprites in the base line color with
 * a neon accent overlay only on the selected marker (spec 3).
 */

import { useMemo, useRef, type MutableRefObject } from "react";
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

let ringTex: THREE.CanvasTexture | null = null;
function ringTexture(): THREE.CanvasTexture {
  if (!ringTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.stroke();
    ringTex = new THREE.CanvasTexture(c);
  }
  return ringTex;
}

/**
 * Ring-pulse on spaceports with a launch in the last 30 days (spec 3
 * sanctions the ring-pulse glyph; Florian 2026-07-05 asked for the
 * activity signal). Static ring under prefers-reduced-motion.
 */
function ActivityPulse({
  positions,
  color,
  reducedMotion,
}: {
  positions: THREE.Vector3[];
  color: string;
  reducedMotion: boolean;
}) {
  const matRef = useRef<THREE.PointsMaterial>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(positions.length * 3);
    positions.forEach((v, i) => {
      arr[i * 3] = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    });
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, [positions]);

  useFrame(({ clock }) => {
    if (reducedMotion || !matRef.current) return;
    const t = (clock.getElapsedTime() % 2.2) / 2.2;
    matRef.current.size = 0.03 + t * 0.08;
    matRef.current.opacity = 0.85 * (1 - t) ** 1.5;
  });

  if (positions.length === 0) return null;
  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={matRef}
        size={reducedMotion ? 0.055 : 0.03}
        sizeAttenuation
        map={ringTexture()}
        color={color}
        transparent
        opacity={reducedMotion ? 0.7 : 0.85}
        depthWrite={false}
      />
    </points>
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
  /** Resolved --alert red for the recent-activity pulse. */
  alertColor: string;
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
  alertColor,
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
    return { geometry, glyph: target.glyph, size: target.size };
  }, [selected]);

  return (
    <>
      {layers.map((layer, i) => (
        <points
          key={`${layer.glyph}-${i}-${layer.geometry.attributes.position!.count}`}
          geometry={layer.geometry}
          onClick={(e) => {
            // The overall nearest visible hit owns the click; far-side
            // markers are hidden and therefore not pickable.
            const nearest = e.intersections.find(
              (h) => h.index !== undefined && !occludedByGlobe(e.ray, h.distance, OCCLUDER_RADIUS),
            );
            if (!nearest || nearest.object !== e.eventObject) return;
            e.stopPropagation();
            layer.onClick(nearest.index!, e);
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
      <ActivityPulse positions={pulsePositions} color={alertColor} reducedMotion={reducedMotion} />
    </>
  );
}
