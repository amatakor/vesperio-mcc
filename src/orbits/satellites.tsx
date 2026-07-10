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
import { orbitCatalog } from "./catalog";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { occludedByGlobe } from "./geo";
import type { LayoutEntry } from "./types";

/** Must stay just inside the ocean sphere radius in scene.tsx. */
const OCCLUDER_RADIUS = 0.995;

/** Labels per layer; oversized layers label their first LABEL_LIMIT
 * satellites (catalog order) rather than none at all. */
const LABEL_LIMIT = 150;

function labelTexture(text: string, color: string): THREE.CanvasTexture {
  // 2x texture so labels stay crisp under minification/retina; the
  // backing box derives from the ink's luminance so it works over both
  // the night view (light ink, dark box) and the daylight chart (dark
  // ink, paper box). The canvas takes the text's TRUE width (long names
  // ellipsize rather than squeeze — tuning round 9: no condensed
  // glyphs), and the sprite reads the aspect off the texture.
  const c = document.createElement("canvas");
  c.height = 64;
  const ctx0 = c.getContext("2d")!;
  // Night keeps the light register (tuning round 12: Plex Mono 200);
  // the daylight chart steps up to 400 (rule 47) — dark 200-weight
  // strokes on paper thin out at sprite scale exactly like the stars
  // did (rule 3b), where light-on-night reads optically heavier.
  const ink = new THREE.Color(color);
  const darkInk = ink.r + ink.g + ink.b < 1.5;
  const FONT = `${darkInk ? 400 : 200} 40px 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace`;
  ctx0.font = FONT;
  const MAX_W = 1006;
  let label = text;
  while (label.length > 1 && ctx0.measureText(label).width > MAX_W) {
    label = label.slice(0, -2).trimEnd() + "…";
  }
  const tw = Math.ceil(ctx0.measureText(label).width);
  c.width = Math.max(48, tw + 18);
  const ctx = c.getContext("2d")!; // width change resets state
  ctx.font = FONT;
  // Paper backing goes near-opaque on the daylight chart (rule 47):
  // 0.82 let the blue ocean bleed through and gray the dark ink.
  ctx.fillStyle = darkInk ? "rgba(255, 255, 255, 0.95)" : "rgba(0, 0, 0, 0.78)";
  ctx.fillRect(0, 4, c.width, 56);
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(label, 8, 34);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
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
  /** With a constellation explicitly focused, clicks land only on its
   * layers; null = every layer is pickable (Florian 2026-07-06). */
  pickSlugs: ReadonlySet<string> | null;
  /** Resolved foreground color for the satellite name labels. */
  labelColor: string;
  /** VIEW cluster gate for the per-satellite name labels. */
  showLabels: boolean;
  /** Point-size multiplier. Attenuated point size scales with canvas
   * height, so small embeds (registry OrbitMini3D) pass >1 to keep dots
   * visible; the full scene omits it (default 1, behavior unchanged). */
  dotScale?: number;
  /** The earth-fixed spin group; labels use it to hide when their
   * satellite is behind the globe (far-side occlusion). */
  spinRef: MutableRefObject<THREE.Group | null>;
  /** Pointer-down screen position, for the drag-vs-click filter. */
  downPos: MutableRefObject<{ x: number; y: number } | null>;
  onPick(sat: PickedSat): void;
}

let glowTex: THREE.CanvasTexture | null = null;
function glowTexture(): THREE.CanvasTexture {
  if (!glowTex) {
    // Crisp disc (tuning round 9): solid core with a 2-texel AA rim —
    // the old radial glow blurred into fuzzy blobs when zoomed.
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.82, "rgba(255,255,255,1)");
    g.addColorStop(0.92, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
    glowTex.anisotropy = 4;
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

/** Layers drawn as their own glyph even when nothing is focused. The
 * ISS is special-cased into a small 3D model (buildIssModel) held in the
 * station's real LVLH attitude, so it is excluded from the billboarded
 * points overlay below. */
const GLYPH_SLUGS = new Set(["iss"]);

/**
 * A wireframe ISS, built in body axes so the render loop can drop it into
 * the station's flight attitude: +X is the pressurised module stack
 * (along the velocity vector), the long integrated truss runs along Y
 * (orbit-normal) carrying the solar arrays, and +Z faces nadir. Every
 * part is the wireframe edge set of a box, so it reads as line art with
 * no lighting (Florian 2026-07-08).
 */
function buildIssModel(): THREE.Group {
  const g = new THREE.Group();
  const disposables = new Set<THREE.BufferGeometry | THREE.Material>();
  // Night view keeps the pale wireframe; the daylight chart needs dark
  // inks or the station vanishes on the pale ocean (tuning round 3).
  const lightTheme = document.documentElement.getAttribute("data-theme") === "light";
  const structMat = new THREE.LineBasicMaterial({
    color: lightTheme ? "#22303c" : "#d5deec",
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const arrayMat = new THREE.LineBasicMaterial({
    color: lightTheme ? "#2666d1" : "#7aa8e0",
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  disposables.add(structMat);
  disposables.add(arrayMat);
  const wire = (
    size: [number, number, number],
    mat: THREE.LineBasicMaterial,
    pos: [number, number, number] = [0, 0, 0],
  ) => {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0], size[1], size[2]));
    const ls = new THREE.LineSegments(edges, mat);
    ls.position.set(pos[0], pos[1], pos[2]);
    g.add(ls);
    disposables.add(edges);
  };
  // Integrated truss, one long beam along Y (orbit-normal).
  wire([0.02, 0.44, 0.02], structMat);
  // Pressurised modules: a stack along +X (velocity), a nadir-facing node
  // (Node 3 / cupola), and a laboratory box aft.
  wire([0.19, 0.03, 0.03], structMat);
  wire([0.035, 0.028, 0.06], structMat, [0.03, 0, 0.03]);
  wire([0.05, 0.05, 0.034], structMat, [-0.055, 0, 0]);
  // Eight solar-array wings: a fore and an aft panel at four truss
  // stations, the station's signature spread.
  for (const y of [0.14, 0.205, -0.14, -0.205]) {
    for (const x of [0.075, -0.075]) wire([0.13, 0.048, 0.004], arrayMat, [x, y, 0]);
  }
  // White radiator panels near the centre, canted off the truss.
  wire([0.06, 0.004, 0.05], structMat, [0, 0.055, 0.02]);
  wire([0.06, 0.004, 0.05], structMat, [0, -0.055, 0.02]);
  // Built at working scale, then shrunk to a small on-globe marker
  // (Florian 2026-07-08). The frame loop only sets position/rotation.
  g.scale.setScalar(0.32);
  g.userData.dispose = () => disposables.forEach((d) => d.dispose());
  return g;
}

/** Hard dim for non-highlighted layers (Florian 2026-07-05: dim more). */
function dimmed(c: THREE.Color): THREE.Color {
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  // 0.12 buried the context cloud under focus (tuning round 12).
  return new THREE.Color(l, l, l).lerp(c, 0.25).multiplyScalar(0.18);
}

export function Satellites({
  layout,
  buffers,
  colorBySlug,
  highlightSlugs,
  pickSlugs,
  labelColor,
  showLabels,
  dotScale = 1,
  spinRef,
  downPos,
  onPick,
}: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const { camera } = useThree();
  // Reusable scratch for per-frame far-side label occlusion.
  const labelTmp = useRef({
    camLocal: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    ray: new THREE.Ray(),
    inv: new THREE.Matrix4(),
  });

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
    // Per-point size scale (tuning round 10): the mega-constellations
    // overwhelm the map at full thickness, so connectivity dots render
    // at 0.6x; every other category keeps the standard disc.
    const dotScaleArr = new Float32Array(plan.total).fill(1);
    for (const { entry, start, count } of plan.segments) {
      const cat = orbitCatalog.find((e) => e.slug === entry.slug)?.category;
      if (cat === "connectivity") {
        for (let i = 0; i < count; i++) dotScaleArr[start + i] = 0.5;
      }
    }
    g.setAttribute("aDot", new THREE.BufferAttribute(dotScaleArr, 1));
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

  // Glyph overlays: zero-copy views onto each layer's contiguous segment
  // of the shared position buffer. Highlighted layers always; glyph
  // layers (the ISS) also when nothing is focused.
  const highlights = useMemo(() => {
    // The ISS is drawn by IssGlyph (a rotating sprite), not here.
    const wanted = (slug: string) =>
      !GLYPH_SLUGS.has(slug) && highlightSlugs !== null && highlightSlugs.has(slug);
    const full = geometry.getAttribute("position")!.array as Float32Array;
    return plan.segments
      .filter((s) => wanted(s.entry.slug) && s.count > 0)
      .map((seg) => {
        const view = full.subarray(seg.start * 3, (seg.start + seg.count) * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(view, 3));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
        return {
          slug: seg.entry.slug,
          geometry: g,
          color: colorBySlug.get(seg.entry.slug) ?? "#ffffff",
        };
      });
  }, [geometry, plan, colorBySlug, highlightSlugs]);
  useEffect(() => () => highlights.forEach((h) => h.geometry.dispose()), [highlights]);

  // The ISS: shown as its own glyph even unfocused (GLYPH_SLUGS), drawn
  // as a small 3D model held in its LVLH flight attitude each frame.
  const issStart = useMemo(() => {
    const show = highlightSlugs === null || highlightSlugs.has("iss");
    if (!show) return null;
    const seg = plan.segments.find((s) => s.entry.slug === "iss" && s.count > 0);
    return seg ? seg.start : null;
  }, [plan, highlightSlugs]);
  const issModel = useMemo(() => (issStart === null ? null : buildIssModel()), [issStart]);
  useEffect(
    () => () => (issModel?.userData.dispose as (() => void) | undefined)?.(),
    [issModel],
  );
  const issTmp = useRef({
    x: new THREE.Vector3(),
    y: new THREE.Vector3(),
    z: new THREE.Vector3(),
    v: new THREE.Vector3(),
    m: new THREE.Matrix4(),
  });
  // What clicking the ISS selects, and an invisible sphere that gives the
  // small wireframe a comfortable hit target (follows it each frame).
  const issPick = useMemo((): PickedSat | null => {
    const seg = plan.segments.find((s) => s.entry.slug === "iss" && s.count > 0);
    return seg
      ? { slug: "iss", id: seg.entry.ids[0]!, name: seg.entry.names[0]!, index: seg.start }
      : null;
  }, [plan]);
  const issHitRef = useRef<THREE.Mesh>(null);
  // Cloud material built imperatively (tuning round 10): the shader is
  // patched to multiply each point's size by the aDot attribute, so
  // connectivity dots slim down without a second draw call.
  const lightTheme = document.documentElement.getAttribute("data-theme") === "light";
  const cloudMaterial = useMemo(() => {
    const m = new THREE.PointsMaterial({
      size: 0.014 * dotScale,
      sizeAttenuation: true,
      map: glowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: lightTheme ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float aDot;\n" +
        shader.vertexShader.replace("gl_PointSize = size;", "gl_PointSize = size * aDot;");
    };
    return m;
  }, [lightTheme, dotScale]);
  useEffect(() => () => cloudMaterial.dispose(), [cloudMaterial]);

  // Name labels beside the glyphs (Florian 2026-07-05), one sprite per
  // satellite, positions synced from the shared buffer each frame.
  // Layers past LABEL_LIMIT label their first LABEL_LIMIT satellites in
  // catalog order (Florian 2026-07-06: some labels beat none).
  const labels = useMemo(() => {
    if (highlightSlugs === null || !showLabels) return [];
    const out: { seg: { start: number; count: number }; sprites: THREE.Sprite[] }[] = [];
    for (const seg of plan.segments) {
      if (!highlightSlugs.has(seg.entry.slug) || seg.count === 0) {
        continue;
      }
      const sprites = seg.entry.names.slice(0, LABEL_LIMIT).map((n) => {
        const map = labelTexture(n, labelColor);
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map,
            transparent: true,
            depthWrite: false,
            // Draw over the globe rather than intersecting it (the flat
            // billboard used to clip into the sphere). Far-side labels
            // are culled per-frame below so nothing floats over the map.
            depthTest: false,
          }),
        );
        sprite.renderOrder = 10;
        // Width follows the texture's true aspect (tuning round 9);
        // 0.038 height = round-12 size reduction (~15%).
        const w0 = 0.038 * ((map.image as HTMLCanvasElement).width / 64);
        sprite.userData.w0 = w0;
        sprite.scale.set(w0, 0.038, 1);
        // Anchor left of the texture just right of the glyph.
        sprite.center.set(-0.12 * (0.36 / w0), 0.5);
        return sprite;
      });
      out.push({ seg: { start: seg.start, count: sprites.length }, sprites });
    }
    return out;
  }, [plan, highlightSlugs, labelColor, showLabels]);
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
    // Fixed apparent dot size (tuning round 9): with sizeAttenuation the
    // world size is constant, so zooming inflates the discs; scaling the
    // material size with camera distance holds them pixel-stable.
    {
      const d = camera.position.length();
      cloudMaterial.size = 0.014 * dotScale * (d / 2.8);
    }
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
    // Move the name labels with their satellites, and hide any whose
    // satellite is behind the globe so a depthTest-off label never
    // floats over the far side of the map (Florian 2026-07-07).
    if (labels.length > 0) {
      const t = labelTmp.current;
      const spin = spinRef.current;
      let camReady = false;
      if (spin) {
        spin.updateWorldMatrix(true, false);
        t.inv.copy(spin.matrixWorld).invert();
        // Camera in the spin group's local frame; the globe sphere is
        // at that frame's origin, so occlusion is a plain sphere test.
        t.camLocal.copy(camera.position).applyMatrix4(t.inv);
        camReady = true;
      }
      for (const l of labels) {
        for (let i = 0; i < l.seg.count; i++) {
          const j = (l.seg.start + i) * 3;
          const sprite = l.sprites[i]!;
          const x = out[j]!;
          const y = out[j + 1]!;
          const z = out[j + 2]!;
          sprite.position.set(x, y, z);
          if (camReady) {
            t.dir.set(x - t.camLocal.x, y - t.camLocal.y, z - t.camLocal.z);
            const dist = t.dir.length();
            t.dir.multiplyScalar(1 / dist);
            t.ray.origin.copy(t.camLocal);
            t.ray.direction.copy(t.dir);
            sprite.visible = !occludedByGlobe(t.ray, dist, OCCLUDER_RADIUS);
            // Fixed on-screen size (tuning round 8): scale each label
            // with its camera distance so zooming never grows the type.
            // 2.8 is the reference distance of the default desktop view.
            const k = dist / 2.8;
            const w0 = (sprite.userData.w0 as number) ?? 0.36;
            sprite.scale.set(w0 * k, 0.038 * k, 1);
          }
        }
      }
    }
    // Hold the ISS model in its LVLH +XVV attitude: body +X along the
    // velocity vector, +Z toward nadir, truss along Y (orbit-normal).
    if (issModel && issStart !== null) {
      const j = issStart * 3;
      const px = out[j]!;
      const py = out[j + 1]!;
      const pz = out[j + 2]!;
      issModel.position.set(px, py, pz);
      if (issHitRef.current) issHitRef.current.position.set(px, py, pz);
      if (prev && next && j + 2 < next.length && j + 2 < prev.length) {
        const vx = next[j]! - prev[j]!;
        const vy = next[j + 1]! - prev[j + 1]!;
        const vz = next[j + 2]! - prev[j + 2]!;
        const rlen = Math.hypot(px, py, pz);
        if (!Number.isNaN(vx) && vx * vx + vy * vy + vz * vz > 1e-12 && rlen > 1e-6) {
          const it = issTmp.current;
          // +Z = nadir (toward Earth centre at the origin).
          it.z.set(-px / rlen, -py / rlen, -pz / rlen);
          // +X = velocity, re-orthogonalised against nadir.
          it.v.set(vx, vy, vz).normalize();
          it.x.copy(it.v).addScaledVector(it.z, -it.v.dot(it.z)).normalize();
          // +Y = Z x X (orbit-normal), the truss line.
          it.y.crossVectors(it.z, it.x).normalize();
          it.m.makeBasis(it.x, it.y, it.z);
          issModel.quaternion.setFromRotationMatrix(it.m);
        }
      }
    }
  });

  /** Selects the satellite at a global point index (label clicks). */
  const pickByIndex = (index: number, e: ThreeEvent<MouseEvent>) => {
    const down = downPos.current;
    if (
      down &&
      Math.hypot(e.nativeEvent.clientX - down.x, e.nativeEvent.clientY - down.y) > 8
    ) {
      return;
    }
    if (occludedByGlobe(e.ray, e.distance, OCCLUDER_RADIUS)) return;
    for (const { entry, start, count } of plan.segments) {
      if (index >= start && index < start + count) {
        const i = index - start;
        e.stopPropagation();
        onPick({ slug: entry.slug, id: entry.ids[i]!, name: entry.names[i]!, index });
        return;
      }
    }
  };

  const segFor = (index: number) =>
    plan.segments.find((s) => index >= s.start && index < s.start + s.count) ?? null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const down = downPos.current;
    if (
      down &&
      Math.hypot(e.nativeEvent.clientX - down.x, e.nativeEvent.clientY - down.y) > 8
    ) {
      return;
    }
    // The nearest non-occluded, pickable satellite point under the
    // cursor. Points behind the globe are unpickable (spec 3); with a
    // focus active only the focused layers are pickable, and without one
    // the connectivity blanket (Starlink) is excluded (Florian).
    const sat = e.intersections.find((h) => {
      if (h.object !== pointsRef.current || h.index === undefined) return false;
      if (occludedByGlobe(e.ray, h.distance, OCCLUDER_RADIUS)) return false;
      const seg = segFor(h.index);
      return seg !== null && (pickSlugs === null || pickSlugs.has(seg.entry.slug));
    });
    // No pickable satellite here: stay transparent so the click reaches
    // whatever is behind (a ground marker, another layer). This is why
    // the unpickable satellite blanket no longer swallows ground clicks.
    if (!sat) return;
    // A nearer non-occluded ground marker is a deliberate target and
    // should win; defer so its own handler claims the click.
    const nearerGround = e.intersections.find(
      (h) =>
        h.object !== pointsRef.current &&
        h.index !== undefined &&
        !occludedByGlobe(e.ray, h.distance, OCCLUDER_RADIUS) &&
        h.distance < sat.distance - 1e-4,
    );
    if (nearerGround) return;
    const seg = segFor(sat.index!);
    if (!seg) return;
    const i = sat.index! - seg.start;
    e.stopPropagation();
    onPick({ slug: seg.entry.slug, id: seg.entry.ids[i]!, name: seg.entry.names[i]!, index: sat.index! });
  };

  if (plan.total === 0) return null;
  return (
    <>
      <points
        ref={pointsRef}
        geometry={geometry}
        material={cloudMaterial}
        frustumCulled={false}
        onClick={handleClick}
      />
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
      {issModel && <primitive object={issModel} />}
      {issModel && issPick && (
        <mesh
          ref={issHitRef}
          onClick={(e) => {
            const down = downPos.current;
            if (
              down &&
              Math.hypot(e.nativeEvent.clientX - down.x, e.nativeEvent.clientY - down.y) > 8
            ) {
              return;
            }
            if (occludedByGlobe(e.ray, e.distance, OCCLUDER_RADIUS)) return;
            e.stopPropagation();
            onPick(issPick);
          }}
        >
          <sphereGeometry args={[0.11, 10, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {labels.flatMap((l, li) =>
        l.sprites.map((s, si) => (
          <primitive
            key={`${li}-${si}`}
            object={s}
            onClick={(e: ThreeEvent<MouseEvent>) => pickByIndex(l.seg.start + si, e)}
          />
        )),
      )}
    </>
  );
}
