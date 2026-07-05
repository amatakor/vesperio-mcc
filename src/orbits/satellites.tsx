/**
 * The satellite layer: every enabled constellation's satellites in one
 * additive-blended THREE.Points draw call (inside the spec's one-per-
 * category budget), colored per category with per-point selection
 * dimming, positions interpolated between worker snapshots on the
 * render thread (spec 6).
 *
 * Correctness-critical and owned by the integrator; the worker feeding
 * it lives in worker.ts/propagate.ts.
 */

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { occludedByGlobe } from "./geo";
import type { LayoutEntry } from "./types";

/** Must stay just inside the ocean sphere radius in scene.tsx. */
const OCCLUDER_RADIUS = 0.995;

/** No name labels above this layer size; they would be unreadable. */
const LABEL_LIMIT = 150;

function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  ctx.font = "600 20px ui-monospace, 'SF Mono', Menlo, monospace";
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 4, 17, 248);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 2;
  return t;
}

/** Double-buffered worker snapshots; the render loop lerps between them. */
export interface SnapshotBuffers {
  prev: Float32Array | null;
  next: Float32Array | null;
  prevTime: number;
  nextTime: number;
}

export interface PickedSat {
  slug: string;
  id: number;
  name: string;
  /** Global point index, for popup position lookups. */
  index: number;
}

interface Props {
  layout: LayoutEntry[];
  buffers: MutableRefObject<SnapshotBuffers>;
  /** Resolved CSS color per constellation slug (category neon). */
  colorBySlug: Map<string, string>;
  /** Highlighted layer slugs (a fleet parent expands to its children);
   * everything else dims hard. */
  highlightSlugs: ReadonlySet<string> | null;
  /** Resolved foreground color for the satellite name labels. */
  labelColor: string;
  /** Pointer-down screen position, for the drag-vs-click filter. */
  downPos: MutableRefObject<{ x: number; y: number } | null>;
  onPick(sat: PickedSat): void;
}

let glowTex: THREE.CanvasTexture | null = null;
function glowTexture(): THREE.CanvasTexture {
  if (!glowTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  return glowTex;
}

/** Miniature satellite glyph (body + solar wings) for highlighted layers. */
let satTex: THREE.CanvasTexture | null = null;
function satTexture(): THREE.CanvasTexture {
  if (!satTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    // Solar wings, boom, body.
    ctx.fillRect(2, 24, 20, 16);
    ctx.fillRect(42, 24, 20, 16);
    ctx.beginPath();
    ctx.moveTo(22, 32);
    ctx.lineTo(42, 32);
    ctx.stroke();
    ctx.fillRect(25, 25, 14, 14);
    satTex = new THREE.CanvasTexture(c);
  }
  return satTex;
}

/** Hard dim for non-highlighted layers (Florian 2026-07-05: dim more). */
function dimmed(c: THREE.Color): THREE.Color {
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return new THREE.Color(l, l, l).lerp(c, 0.25).multiplyScalar(0.12);
}

export function Satellites({
  layout,
  buffers,
  colorBySlug,
  highlightSlugs,
  labelColor,
  downPos,
  onPick,
}: Props) {
  const pointsRef = useRef<THREE.Points>(null);

  const plan = useMemo(() => {
    let total = 0;
    const segments = layout.map((entry) => {
      const start = total;
      total += entry.ids.length;
      return { entry, start, count: entry.ids.length };
    });
    return { total, segments };
  }, [layout]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(plan.total * 3);
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(plan.total * 3), 3));
    // Positions stream in place; skip three.js bounds bookkeeping.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
    return g;
  }, [plan]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Per-point colors change only with layout, palette, or highlight.
  // With a highlight active, the highlighted layer's points go black in
  // this additive base layer (black renders as nothing) and reappear as
  // satellite glyphs in the overlay below; everything else dims hard.
  useEffect(() => {
    const attr = geometry.getAttribute("color") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const black = new THREE.Color(0, 0, 0);
    for (const { entry, start, count } of plan.segments) {
      const base = new THREE.Color(colorBySlug.get(entry.slug) ?? "#ffffff");
      const c =
        highlightSlugs === null
          ? base
          : highlightSlugs.has(entry.slug)
            ? black
            : dimmed(base);
      for (let i = 0; i < count; i++) {
        arr[(start + i) * 3] = c.r;
        arr[(start + i) * 3 + 1] = c.g;
        arr[(start + i) * 3 + 2] = c.b;
      }
    }
    attr.needsUpdate = true;
  }, [geometry, plan, colorBySlug, highlightSlugs]);

  // Highlight overlays: zero-copy views onto each highlighted layer's
  // contiguous segment of the shared position buffer.
  const highlights = useMemo(() => {
    if (highlightSlugs === null) return [];
    const full = geometry.getAttribute("position")!.array as Float32Array;
    return plan.segments
      .filter((s) => highlightSlugs.has(s.entry.slug) && s.count > 0)
      .map((seg) => {
        const view = full.subarray(seg.start * 3, (seg.start + seg.count) * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(view, 3));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
        return { slug: seg.entry.slug, geometry: g, color: colorBySlug.get(seg.entry.slug) ?? "#ffffff" };
      });
  }, [geometry, plan, colorBySlug, highlightSlugs]);
  useEffect(() => () => highlights.forEach((h) => h.geometry.dispose()), [highlights]);

  // Name labels beside the glyphs (Florian 2026-07-05), one sprite per
  // satellite, positions synced from the shared buffer each frame.
  // Skipped for very large layers where labels would be unreadable soup.
  const labels = useMemo(() => {
    if (highlightSlugs === null) return [];
    const out: { seg: { start: number; count: number }; sprites: THREE.Sprite[] }[] = [];
    for (const seg of plan.segments) {
      if (!highlightSlugs.has(seg.entry.slug) || seg.count === 0 || seg.count > LABEL_LIMIT) {
        continue;
      }
      const sprites = seg.entry.names.map((n) => {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: labelTexture(n, labelColor),
            transparent: true,
            depthWrite: false,
          }),
        );
        sprite.scale.set(0.36, 0.045, 1);
        // Anchor left of the texture just right of the glyph.
        sprite.center.set(-0.12, 0.5);
        return sprite;
      });
      out.push({ seg: { start: seg.start, count: seg.count }, sprites });
    }
    return out;
  }, [plan, highlightSlugs, labelColor]);
  useEffect(
    () => () =>
      labels.forEach((l) =>
        l.sprites.forEach((s) => {
          s.material.map?.dispose();
          s.material.dispose();
        }),
      ),
    [labels],
  );

  useFrame(() => {
    const { prev, next, prevTime, nextTime } = buffers.current;
    if (!next) return;
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const out = attr.array as Float32Array;
    const overlayAttrs = highlights.map(
      (h) => h.geometry.getAttribute("position") as THREE.BufferAttribute,
    );
    const n = Math.min(out.length, next.length);
    const span = nextTime - prevTime;
    const alpha =
      prev && span > 0 ? Math.min(Math.max((Date.now() - prevTime) / span, 0), 1.5) : 1;
    for (let i = 0; i < n; i += 3) {
      const bx = next[i]!;
      // Failed propagations arrive as NaN; park them far outside the
      // frustum where they can neither render nor be raycast.
      if (Number.isNaN(bx)) {
        out[i] = 0;
        out[i + 1] = -50;
        out[i + 2] = 0;
        continue;
      }
      for (let k = 0; k < 3; k++) {
        const b = next[i + k]!;
        const a = prev && i + k < prev.length && !Number.isNaN(prev[i + k]!) ? prev[i + k]! : b;
        out[i + k] = a + (b - a) * alpha;
      }
    }
    attr.needsUpdate = true;
    // The overlays' attributes view the same memory; only flag them.
    for (const oa of overlayAttrs) oa.needsUpdate = true;
    // Move the name labels with their satellites.
    for (const l of labels) {
      for (let i = 0; i < l.seg.count; i++) {
        const j = (l.seg.start + i) * 3;
        l.sprites[i]!.position.set(out[j]!, out[j + 1]!, out[j + 2]!);
      }
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const down = downPos.current;
    if (
      down &&
      Math.hypot(e.nativeEvent.clientX - down.x, e.nativeEvent.clientY - down.y) > 8
    ) {
      return;
    }
    // The overall nearest visible hit owns the click; anything hidden
    // behind the occluding globe is unpickable (spec 3), and hits that
    // belong to another layer propagate to that layer's handler.
    const nearest = e.intersections.find(
      (h) => h.index !== undefined && !occludedByGlobe(e.ray, h.distance, OCCLUDER_RADIUS),
    );
    if (!nearest || nearest.object !== pointsRef.current) return;
    for (const { entry, start, count } of plan.segments) {
      if (nearest.index! >= start && nearest.index! < start + count) {
        const i = nearest.index! - start;
        e.stopPropagation();
        onPick({ slug: entry.slug, id: entry.ids[i]!, name: entry.names[i]!, index: nearest.index! });
        return;
      }
    }
  };

  if (plan.total === 0) return null;
  return (
    <>
      <points ref={pointsRef} geometry={geometry} frustumCulled={false} onClick={handleClick}>
        <pointsMaterial
          size={0.014}
          sizeAttenuation
          map={glowTexture()}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {highlights.map((h) => (
        <points key={h.slug} geometry={h.geometry} frustumCulled={false}>
          <pointsMaterial
            size={0.13}
            sizeAttenuation
            map={satTexture()}
            color={h.color}
            transparent
            alphaTest={0.1}
            depthWrite={false}
          />
        </points>
      ))}
      {labels.flatMap((l, li) =>
        l.sprites.map((s, si) => <primitive key={`${li}-${si}`} object={s} />),
      )}
    </>
  );
}
