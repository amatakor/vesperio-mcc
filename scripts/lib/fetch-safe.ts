/**
 * Shared safe-fetch plumbing for every script that retrieves URLs the
 * agent or the open web supplied (plan Phase 8, should-fix 8): SSRF
 * guard (no private address space, no localhost, http(s) only, every
 * hop of a redirect chain re-validated) and a streaming size cap so a
 * hostile
 * or broken server cannot balloon a run.
 *
 * Known limitation, documented rather than hidden: the guard checks URL
 * literals, not DNS answers, so a public hostname that RESOLVES to a
 * private address (DNS rebinding) is not caught; Bun's fetch exposes no
 * resolver hook. The fetchers run in throwaway CI containers with
 * nothing else listening, which is the mitigation that matters.
 */

export const SAFE_FETCH_UA = "VesperioMCC-Fetch contact@vesperio.ai";
export const SAFE_FETCH_TIMEOUT_MS = 25_000;
/** Default body cap: generous for pages and images, hostile-blob proof. */
export const SAFE_FETCH_MAX_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 5;

/** Private / special-use IPv4 ranges (RFC 1918, loopback, link-local, CGN, zeroconf). */
function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGN 100.64/10
  return false;
}

/**
 * True only for URLs a data-pipeline script may fetch: http(s), a real
 * public-looking host. IPv6 literals are rejected wholesale (none of
 * our sources need one; parsing the private ranges is not worth it).
 */
export function isSafeUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "" || host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (host.startsWith("[")) return false; // IPv6 literal
  if (host.includes(":")) return false; // IPv6 without brackets
  if (isPrivateIpv4(host)) return false;
  return true;
}

export class UnsafeUrlError extends Error {}
export class ResponseTooLargeError extends Error {}

export interface SafeFetchResult {
  status: number;
  /** The URL that actually answered, after any redirects. */
  finalUrl: string;
  headers: Headers;
  /** Raw body, capped at maxBytes. */
  bytes: Uint8Array;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  /**
   * TEST SEAM ONLY: replaces isSafeUrl so the redirect re-validation and
   * the size cap can be exercised against a loopback fixture server.
   * Production callers must never pass this.
   */
  guard?: (url: string) => boolean;
}

/**
 * Fetch with the SSRF guard applied to the request URL AND to every
 * redirect hop, and the body read as a stream that aborts past
 * maxBytes. Throws UnsafeUrlError / ResponseTooLargeError; network
 * errors propagate for the caller to log (never swallow them: the
 * harvest.ts failure-logging pattern is the house rule).
 */
export async function fetchSafe(raw: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? SAFE_FETCH_MAX_BYTES;
  const guard = opts.guard ?? isSafeUrl;
  let url = raw;
  for (let hop = 0; ; hop++) {
    if (!guard(url)) throw new UnsafeUrlError(`unsafe URL refused: ${url}`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": SAFE_FETCH_UA, ...opts.headers },
        redirect: "manual",
        signal: ctrl.signal,
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || hop >= MAX_REDIRECTS) {
          return { status: res.status, finalUrl: url, headers: res.headers, bytes: new Uint8Array() };
        }
        url = new URL(loc, url).toString();
        continue;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        return { status: res.status, finalUrl: url, headers: res.headers, bytes: new Uint8Array() };
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          ctrl.abort();
          throw new ResponseTooLargeError(`response exceeded ${maxBytes} bytes: ${url}`);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        bytes.set(c, off);
        off += c.byteLength;
      }
      return { status: res.status, finalUrl: url, headers: res.headers, bytes };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** fetchSafe with the body decoded as UTF-8 text. */
export async function fetchSafeText(
  raw: string,
  opts: SafeFetchOptions = {},
): Promise<{ status: number; finalUrl: string; headers: Headers; text: string }> {
  const res = await fetchSafe(raw, opts);
  return {
    status: res.status,
    finalUrl: res.finalUrl,
    headers: res.headers,
    text: new TextDecoder().decode(res.bytes),
  };
}
