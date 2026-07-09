/**
 * OrbitMini3D: a compact live 3D orbital view for a registry profile,
 * reusing the exact wireframe globe of the full /orbits/ scene at a
 * smaller size. It shows only the given constellation's satellites,
 * live-propagated, and clicking a dot opens the same popup the full
 * scene shows for a picked satellite.
 *
 * This module is the light gate, safe to import statically anywhere: it
 * pulls in no three.js. The heavy render module (mini3d-scene.tsx, which
 * loads three.js and the shared orbits scene) sits behind the dynamic
 * import below, exactly as stage.tsx gates scene.tsx, so the SSR
 * prerender and every page that never opens an orbit tab ship none of it.
 *
 * No-WebGL / no-data contract: the parent layers the SVG fallback
 * (OrbitMini) underneath and lets this sit on top. When WebGL is missing
 * or the constellation has no elements file, this renders null so the
 * fallback shows through untouched.
 */

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { loadElements } from "./elements";
import type { OmmRecord } from "../data/schema";

const Mini3DScene = lazy(() => import("./mini3d-scene"));

type Gate =
  | { phase: "idle" }
  | { phase: "no-webgl" }
  | { phase: "failed" }
  | { phase: "ready"; records: OmmRecord[] };

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function OrbitMini3D({ slug, accent }: { slug: string; accent?: string }) {
  // "idle" is also the prerendered/hydration state: it renders null, so
  // the SVG fallback the parent placed underneath is what shows first.
  const [gate, setGate] = useState<Gate>({ phase: "idle" });
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!hasWebGL()) {
      setGate({ phase: "no-webgl" });
      return;
    }
    startedFor.current = slug;
    let cancelled = false;
    void loadElements(slug).then((res) => {
      if (cancelled || startedFor.current !== slug) return;
      setGate(res.ok ? { phase: "ready", records: res.file.records } : { phase: "failed" });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (gate.phase !== "ready") return null;
  return (
    <Suspense fallback={null}>
      <Mini3DScene slug={slug} accent={accent} records={gate.records} />
    </Suspense>
  );
}
