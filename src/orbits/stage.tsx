/**
 * Client-only gate for the 3D scene. This module is safe to import
 * statically anywhere: the heavy bundle (three.js, satellite.js) lives
 * behind the dynamic import below and is fetched only after this
 * component mounts in a WebGL-capable browser on /orbits/. The SSR
 * prerender and every other page ship none of it (spec 2, criterion 7).
 */

import { lazy, Suspense, useEffect, useState } from "react";

const Scene = lazy(() => import("./scene"));

/** Current theme, tracked live off <html data-theme>. The 3D scene reads
 * its colors from CSS tokens once on mount, so theme switches remount it
 * (keyed below) to re-read the themed values — V1.1 light MCC. */
export function useTheme(): string {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") ?? "dark",
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setTheme(document.documentElement.getAttribute("data-theme") ?? "dark"),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

function Fallback({ reason }: { reason: "loading" | "no-webgl" }) {
  if (reason === "no-webgl") {
    return (
      <div className="orbits-fallback">
        <div className="orbits-fallback-card opanel6">
          <div className="orbits-fallback-title">3D VIEW UNAVAILABLE</div>
          <p>
            This view needs WebGL, which this browser does not provide. The same constellations,
            spaceports, and operators are in the Registry.
          </p>
          <a className="orbits-fallback-link" href="/registry/">
            OPEN REGISTRY →
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="orbits-fallback">
      <p>Loading the globe.</p>
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
  // Scene owns the stage/rail layout (orbits.css).
  return (
    <Suspense fallback={<Fallback reason="loading" />}>
      <ThemedScene />
    </Suspense>
  );
}

function ThemedScene() {
  const theme = useTheme();
  return <Scene key={theme} />;
}
