/**
 * DEV cone tuner (Florian 2026-07-11, rounds 2-3): a small floating
 * panel, gated on ?tune=1 by scene.tsx, for playing with the
 * ground-station receiving cones and the spaceport ripple rings before
 * we commit values. Plain HTML in the instrument register (mono caps),
 * MCC panel chrome. Purely presentational: scene.tsx owns the state,
 * persists it to localStorage, and feeds the live values to the scene.
 * The copyable JSON line is what Florian pastes back so we can lock his
 * choice into the shipped defaults.
 */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CONE_STYLES, PORT_EFFECTS, type ConeParams } from "./ground";

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange(v: number): void;
}) {
  return (
    <label className="ct-row">
      <span className="ct-label">{label}</span>
      <input
        type="range"
        className="ct-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="ct-val">
        {value}
        {suffix ?? ""}
      </span>
    </label>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
}) {
  return (
    <label className="ct-row">
      <span className="ct-label">{label}</span>
      <input
        type="color"
        className="ct-color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="ct-val">{value.toUpperCase()}</span>
    </label>
  );
}

export function ConeTuner({
  params,
  onChange,
}: {
  params: ConeParams;
  onChange: Dispatch<SetStateAction<ConeParams>>;
}) {
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<ConeParams>) => onChange((prev) => ({ ...prev, ...patch }));

  // The panel floats INSIDE the canvas wrap, whose React pointer
  // handlers spin the globe (axis-locked drag) and whose native wheel
  // listener steps the zoom. Any pointer/wheel interaction that STARTS
  // in the panel must never reach them (Florian round 3: dragging a
  // slider also rotated the globe). Native listeners on the panel root
  // stop propagation before the wrap sees anything; the panel's own
  // controls (inputs, buttons) are descendants and fire first, and
  // globe interaction outside the panel is untouched.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    const types = ["pointerdown", "pointermove", "pointerup", "wheel"] as const;
    for (const t of types) el.addEventListener(t, stop);
    return () => {
      for (const t of types) el.removeEventListener(t, stop);
    };
  }, []);

  // Fixed key order so the pasted-back JSON reads the same every time.
  const json = JSON.stringify({
    color: params.color,
    apexOpacity: params.apexOpacity,
    fadeHeightKm: params.fadeHeightKm,
    minElevDeg: params.minElevDeg,
    style: params.style,
    portColor: params.portColor,
    portEffect: params.portEffect,
    portRadius: params.portRadius,
    portPeriod: params.portPeriod,
    portRings: params.portRings,
  });
  const copy = () => {
    void navigator.clipboard?.writeText(json).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {
        /* clipboard blocked; the line is still selectable */
      },
    );
  };

  return (
    <div className="cone-tuner opanel6" ref={rootRef}>
      <div className="ct-head">DEV · CONE TUNER</div>
      <div className="ct-sub">CONES</div>
      <div className="ct-row">
        <span className="ct-label">STYLE</span>
        <div className="ct-seg" role="radiogroup" aria-label="Cone style">
          {CONE_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={params.style === s}
              className={`ct-seg-btn${params.style === s ? " ct-seg-on" : ""}`}
              onClick={() => set({ style: s })}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <ColorRow label="COLOR" value={params.color} onChange={(v) => set({ color: v })} />
      <Slider
        label="APEX OPACITY"
        value={params.apexOpacity}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => set({ apexOpacity: v })}
      />
      <Slider
        label="FADE HEIGHT"
        value={params.fadeHeightKm}
        min={100}
        max={2000}
        step={10}
        suffix=" KM"
        onChange={(v) => set({ fadeHeightKm: v })}
      />
      <Slider
        label="MIN ELEV ε"
        value={params.minElevDeg}
        min={5}
        max={20}
        step={1}
        suffix="°"
        onChange={(v) => set({ minElevDeg: v })}
      />
      <div className="ct-sub">SPACEPORTS</div>
      <div className="ct-row">
        <span className="ct-label">EFFECT</span>
        <div className="ct-seg" role="radiogroup" aria-label="Active spaceport effect">
          {PORT_EFFECTS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={params.portEffect === s}
              className={`ct-seg-btn${params.portEffect === s ? " ct-seg-on" : ""}`}
              onClick={() => set({ portEffect: s })}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <ColorRow
        label="COLOR"
        value={params.portColor}
        onChange={(v) => set({ portColor: v })}
      />
      <Slider
        label="RADIUS"
        value={params.portRadius}
        min={5}
        max={35}
        step={0.1}
        suffix="°"
        onChange={(v) => set({ portRadius: v })}
      />
      <Slider
        label="PERIOD"
        value={params.portPeriod}
        min={1.2}
        max={9.6}
        step={0.1}
        suffix=" S"
        onChange={(v) => set({ portPeriod: v })}
      />
      <Slider
        label="RINGS"
        value={params.portRings}
        min={1}
        max={3}
        step={1}
        onChange={(v) => set({ portRings: v })}
      />
      <button type="button" className="ct-json" onClick={copy} title="Copy JSON">
        {copied ? "COPIED" : json}
      </button>
    </div>
  );
}
