/**
 * Client-only gate for the 3D scene. This module is safe to import
 * statically anywhere: the heavy bundle (three.js, satellite.js) lives
 * behind the dynamic import below and is fetched only after this
 * component mounts in a WebGL-capable browser on /orbits/. The SSR
 * prerender and every other page ship none of it (spec 2, criterion 7).
 */

import { lazy, Suspense, useEffect, useState } from "react";

const Scene = lazy(() => import("./scene"));

function Fallback({ reason }: { reason: "loading" | "no-webgl" }) {
  return (
    <div className="orbits-fallback">
      {reason === "no-webgl" ? (
        <p>
          This view needs WebGL, which this browser does not provide. The same constellations,
          spaceports, and operators are in the <a href="/registry/">Registry</a>.
        </p>
      ) : (
        <p>Loading the globe.</p>
      )}
    </div>
  );
}

export function OrbitsStage() {
  // "idle" is also what the prerendered HTML contains; hydration matches.
  const [state, setState] = useState<"idle" | "ready" | "no-webgl">("idle");

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    setState(gl ? "ready" : "no-webgl");
  }, []);

  if (state === "no-webgl") return <Fallback reason="no-webgl" />;
  if (state === "idle") return <Fallback reason="loading" />;
  return (
    <div className="orbits-stage">
      <Suspense fallback={<Fallback reason="loading" />}>
        <Scene />
      </Suspense>
    </div>
  );
}
