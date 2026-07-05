/**
 * Orbits Web Worker: owns SGP4 propagation off the render thread. Thin
 * message shell around src/orbits/propagate.ts; no three.js, no DOM
 * beyond `self`. Implements the WorkerIn/WorkerOut protocol from
 * src/orbits/types.ts exactly.
 */

import { buildSatrecs, propagateToScene, subpoint, orbitArcScene, type SatRecLike } from "./propagate";
import type { WorkerIn, WorkerOut, LayoutEntry } from "./types";
import { SNAPSHOT_CADENCE_MS } from "./types";
import type { OmmRecord } from "../data/schema";

interface LoadedConstellation {
  slug: string;
  satrecs: SatRecLike[];
  ids: number[];
  names: string[];
}

/** Everything ever loaded, keyed by slug (arc lookups search all of these). */
const loaded = new Map<string, LoadedConstellation>();

/** Currently enabled slugs, in render order. */
let active: LoadedConstellation[] = [];

let watchId: number | null = null;
let cadenceMs = SNAPSHOT_CADENCE_MS;
let timer: ReturnType<typeof setInterval> | null = null;

function post(message: WorkerOut, transfer?: Transferable[]): void {
  if (transfer && transfer.length > 0) {
    (self as unknown as Worker).postMessage(message, transfer);
  } else {
    (self as unknown as Worker).postMessage(message);
  }
}

function totalActiveCount(): number {
  let total = 0;
  for (const c of active) total += c.satrecs.length;
  return total;
}

function findActiveById(id: number): SatRecLike | null {
  for (const c of active) {
    const idx = c.ids.indexOf(id);
    if (idx !== -1) return c.satrecs[idx] ?? null;
  }
  return null;
}

function findLoadedById(id: number): SatRecLike | null {
  for (const c of loaded.values()) {
    const idx = c.ids.indexOf(id);
    if (idx !== -1) return c.satrecs[idx] ?? null;
  }
  return null;
}

function emitSnapshot(): void {
  const count = totalActiveCount();
  if (count === 0) return;

  const buffer = new Float32Array(count * 3);
  const now = new Date();
  let offset = 0;
  for (const c of active) {
    propagateToScene(c.satrecs, now, buffer, offset);
    offset += c.satrecs.length * 3;
  }

  const snapshotBuffer = buffer.buffer as ArrayBuffer;
  post({ type: "snapshot", time: now.getTime(), positions: snapshotBuffer }, [snapshotBuffer]);

  if (watchId !== null) {
    const satrec = findActiveById(watchId);
    if (satrec) {
      const point = subpoint(satrec, now);
      if (point) {
        post({ type: "watch", id: watchId, lat: point.lat, lon: point.lon, altKm: point.altKm });
      }
    }
  }
}

function restartTimer(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (totalActiveCount() === 0) return;
  timer = setInterval(emitSnapshot, cadenceMs);
}

function handleLoad(slug: string, records: OmmRecord[]): void {
  const { satrecs, ids, names, failed } = buildSatrecs(records);
  loaded.set(slug, { slug, satrecs, ids, names });
  post({ type: "loaded", slug, count: satrecs.length, failed });
}

function handleEnable(slugs: string[]): void {
  const next: LoadedConstellation[] = [];
  for (const slug of slugs) {
    const entry = loaded.get(slug);
    if (entry) next.push(entry);
  }
  active = next;

  const order: LayoutEntry[] = active.map((c) => ({ slug: c.slug, ids: c.ids, names: c.names }));
  post({ type: "layout", order });

  emitSnapshot();
  restartTimer();
}

function handleArc(id: number): void {
  const satrec = findLoadedById(id);
  if (!satrec) return;
  const arc = orbitArcScene(satrec, new Date());
  if (!arc) return;
  const buffer = arc.positions.buffer as ArrayBuffer;
  post({ type: "arc", id, positions: buffer, periodMin: arc.periodMin }, [buffer]);
}

function handleMessage(message: WorkerIn): void {
  switch (message.type) {
    case "load":
      handleLoad(message.slug, message.records);
      break;
    case "enable":
      handleEnable(message.slugs);
      break;
    case "watch":
      watchId = message.id;
      break;
    case "arc":
      handleArc(message.id);
      break;
    case "cadence":
      cadenceMs = message.ms;
      restartTimer();
      break;
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerIn>) => {
  handleMessage(event.data);
});
