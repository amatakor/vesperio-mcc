/**
 * Minimum-bar network hardening for the standalone data fetchers that hit
 * FIXED, trusted API endpoints (CelesTrak, Launch Library 2, Yahoo Finance,
 * the Yale Bright Star Catalog mirror) and therefore do NOT need the full
 * SSRF machinery in fetch-safe.ts (no scraped/agent-supplied URLs, so no
 * redirect re-validation or DNS-rebinding guard here).
 *
 * What these fetchers DID lack, and this closes, is a request deadline (a
 * hung TLS handshake or a stalled body must not wedge a cron run for
 * minutes) and a response size cap (a broken or hostile upstream must not
 * balloon a run's memory). This mirrors the AbortController pattern in
 * scripts/enrich/lib.ts and the streaming size cap in scripts/lib/fetch-safe.ts.
 *
 * For any URL that originates from scraped HTML or agent input, use
 * fetchSafe/fetchSafeText from fetch-safe.ts instead: those carry the
 * private-IP and DNS-rebinding guards this helper deliberately omits.
 */

export const CAPPED_FETCH_TIMEOUT_MS = 30_000;
/** Default cap: generous for JSON API pages, hostile-blob proof. */
export const CAPPED_FETCH_MAX_BYTES = 25 * 1024 * 1024;

export class CappedResponseTooLargeError extends Error {}

export interface CappedResponse {
  status: number;
  ok: boolean;
  headers: Headers;
  /** Body decoded as UTF-8 text, read under the size cap. */
  text: string;
}

export interface CappedFetchOptions {
  headers?: Record<string, string>;
  /** Overall deadline covering connect + body read. */
  timeoutMs?: number;
  maxBytes?: number;
}

/**
 * fetch() with an AbortController deadline spanning the whole request
 * (connect through body read) and a streaming size cap. Returns the status,
 * headers, and capped body text so callers can still branch on status/headers
 * (e.g. 429 + retry-after backoff) before using the body. Throws
 * CappedResponseTooLargeError past maxBytes; network/timeout errors propagate.
 */
export async function fetchCapped(url: string, opts: CappedFetchOptions = {}): Promise<CappedResponse> {
  const timeoutMs = opts.timeoutMs ?? CAPPED_FETCH_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? CAPPED_FETCH_MAX_BYTES;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: opts.headers, signal: ctrl.signal });
    const reader = res.body?.getReader();
    if (!reader) return { status: res.status, ok: res.ok, headers: res.headers, text: "" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        ctrl.abort();
        throw new CappedResponseTooLargeError(`response exceeded ${maxBytes} bytes: ${url}`);
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }
    return { status: res.status, ok: res.ok, headers: res.headers, text: new TextDecoder().decode(buf) };
  } finally {
    clearTimeout(timer);
  }
}
