/**
 * Shared helpers for the deterministic registry enrichment scripts under
 * scripts/enrich/. These mirror the conventions in scripts/enrich-registry.ts
 * (UA header, bulk-only LL2 fetches at ~15 req/hr free tier, SNR 4 canonical
 * aggregator trace shape) so the two enrichers stay drop-in compatible.
 */

export const UA = "VesperioMCC-Sweep contact@vesperio.ai";
/** LL2 2.2.0 is the free-tier base used across the registry pipeline. */
export const LL2 = "https://ll.thespacedevs.com/2.2.0";

export type Obj = Record<string, unknown>;

export interface SourcedFieldShape {
  value: unknown;
  source: string | null;
  as_of: string | null;
  snr?: number;
  snr_trace?: Obj;
  tier?: string;
}

/** YYYY-MM-DD in UTC for today. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** YYYY-MM-DD from an ISO datetime; null when unparseable. */
export function isoDay(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** LL2 launcher-config id from any field source URL already on the profile. */
export function ll2ConfigId(profile: Obj): number | null {
  for (const v of Object.values(profile)) {
    if (typeof v !== "object" || v === null) continue;
    const src = (v as SourcedFieldShape).source;
    if (typeof src !== "string") continue;
    const m =
      /ll\.thespacedevs\.com\/2\.\d+\.\d+\/(?:config\/launcher|launcher_configurations)\/(\d+)\//.exec(src);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Search term from a search-shaped LL2 config source URL (those carry no
    numeric id, so ll2ConfigId cannot resolve them). Decoded, or null when
    no field cites one. */
export function ll2SearchName(profile: Obj): string | null {
  for (const v of Object.values(profile)) {
    if (typeof v !== "object" || v === null) continue;
    const src = (v as SourcedFieldShape).source;
    if (typeof src !== "string") continue;
    const m =
      /ll\.thespacedevs\.com\/2\.\d+\.\d+\/(?:config\/launcher|launcher_configurations)\/\?[^\s]*?\bsearch=([^&\s]+)/.exec(
        src,
      );
    if (m) {
      try {
        return decodeURIComponent(m[1].replace(/\+/g, " "));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url: string): Promise<Obj> {
  return JSON.parse(await fetchText(url)) as Obj;
}

/**
 * True when a v2 allowlisted field is fillable. Unlike enrich-registry.ts's
 * isNull(), STRUCTURAL ABSENCE counts as fillable here: the registry v2 spec
 * fields (payload_gto_kg, height_m, ...) are absent from the JSON on disk and
 * this enricher is the one allowed to add them. A present non-null value is
 * never overwritten.
 */
export function isFillableV2(profile: Obj, field: string): boolean {
  const f = profile[field] as SourcedFieldShape | undefined;
  if (f === undefined || f === null) return true; // absent: fillable for v2 fields
  const v = f.value;
  return v === null || v === undefined || (Array.isArray(v) && v.length === 0);
}

/**
 * Null-fill a v2 allowlisted field in place with an aggregator-tier (SNR 4
 * canonical) SourcedField. Returns false and changes nothing when the field
 * already carries a value: this never overwrites. Trace shape copied exactly
 * from enrich-registry.ts's fillAggregator (scorer_version 1, matching the
 * committed vehicle profiles).
 */
export function fillV2(
  profile: Obj,
  field: string,
  value: unknown,
  source: string,
  asOf: string,
  reason: string,
): boolean {
  if (!isFillableV2(profile, field)) return false;
  if (value === null || value === undefined) return false;
  profile[field] = {
    value,
    source,
    as_of: asOf,
    snr: 4,
    snr_trace: {
      base: { tier: 4, source, reason },
      modifiers: [],
      final: 4,
      scorer_version: 1,
    },
    tier: "canonical",
  };
  return true;
}
