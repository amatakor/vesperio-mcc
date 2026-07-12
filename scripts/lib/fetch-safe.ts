/**
 * Shared safe-fetch plumbing for every script that retrieves URLs the
 * agent or the open web supplied (plan Phase 8, should-fix 8): SSRF
 * guard (no private address space, no localhost, http(s) only, every
 * hop of a redirect chain re-validated), a DNS-rebinding guard (every
 * hop's hostname is resolved and EVERY resolved address is checked
 * against the private/loopback/link-local/metadata ranges before the
 * request is made), one overall deadline for the whole redirect chain,
 * and a streaming size cap so a hostile or broken server cannot balloon
 * a run.
 *
 * DNS rebinding: isSafeUrl only inspects the URL literal, so a public
 * hostname that RESOLVES to a private address (169.254.169.254,
 * 127.0.0.1, ...) would slip past it. fetchSafe now resolves each hop's
 * hostname via node:dns and refuses the hop if ANY answer is private.
 *
 * Residual TOCTOU: Bun's fetch exposes no resolver/dispatcher hook, so
 * we cannot pin the socket to the exact address we validated. Between
 * our dns.lookup and fetch's own internal resolution a rebinding
 * attacker with sub-second TTL control could return a public address to
 * us and a private one to fetch. We cannot close this window without a
 * custom dispatcher (Bun has none) or rewriting the URL to an IP literal
 * (which breaks TLS SNI and certificate validation for https). The
 * re-resolve-and-validate-per-hop below is the strongest available
 * pinning; the fetchers also run in throwaway CI containers with nothing
 * private listening, which bounds the blast radius of the residual gap.
 */

import { lookup } from "node:dns/promises";

export const SAFE_FETCH_UA = "VesperioMCC-Fetch contact@vesperio.ai";
export const SAFE_FETCH_TIMEOUT_MS = 25_000;
/** Default body cap: generous for pages and images, hostile-blob proof. */
export const SAFE_FETCH_MAX_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 5;

/**
 * Parse a dotted-quad IPv4 string to 4 bytes, or null if it is not one.
 * Pure and DNS-free so the range table can be unit-tested directly.
 */
export function ipv4ToBytes(host: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const b: [number, number, number, number] = [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
  ];
  if (b.some((x) => x > 255)) return null;
  return b;
}

/**
 * Parse an IPv6 string (with optional zone id and optional embedded
 * dotted-quad tail) to its 16 bytes, or null if it is not a valid IPv6
 * literal. Handles "::" compression. Pure and DNS-free.
 */
export function ipv6ToBytes(input: string): number[] | null {
  let s = input.trim().toLowerCase();
  const pct = s.indexOf("%");
  if (pct !== -1) s = s.slice(0, pct); // drop the zone id (fe80::1%eth0)
  if (s === "" || !s.includes(":")) return null;

  // An embedded IPv4 tail (::ffff:1.2.3.4) becomes two hextets.
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = ipv4ToBytes(tail);
    if (!v4) return null;
    const h1 = ((v4[0] << 8) | v4[1]).toString(16);
    const h2 = ((v4[2] << 8) | v4[3]).toString(16);
    s = s.slice(0, lastColon + 1) + `${h1}:${h2}`;
  }

  const parts = s.split("::");
  if (parts.length > 2) return null;

  const parseGroups = (str: string): number[] | null => {
    if (str === "") return [];
    const out: number[] = [];
    for (const g of str.split(":")) {
      if (g === "" || g.length > 4 || !/^[0-9a-f]+$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  const head = parseGroups(parts[0]!);
  if (head === null) return null;
  let full: number[];
  if (parts.length === 2) {
    const back = parseGroups(parts[1]!);
    if (back === null) return null;
    const missing = 8 - head.length - back.length;
    if (missing < 0) return null; // "::" must stand in for at least one zero group
    full = [...head, ...new Array(missing).fill(0), ...back];
  } else {
    full = head;
  }
  if (full.length !== 8) return null;

  const bytes: number[] = [];
  for (const hextet of full) {
    if (hextet < 0 || hextet > 0xffff) return null;
    bytes.push((hextet >> 8) & 0xff, hextet & 0xff);
  }
  return bytes;
}

/** Private / special-use IPv4 ranges (RFC 1918, loopback, link-local, CGN, zeroconf). */
function isPrivateIpv4Bytes(b: readonly number[]): boolean {
  const [a, c] = [b[0]!, b[1]!];
  if (a === 0 || a === 10 || a === 127) return true; // 0/8, 10/8, 127/8
  if (a === 169 && c === 254) return true; // 169.254/16 link-local
  if (a === 172 && c >= 16 && c <= 31) return true; // 172.16/12
  if (a === 192 && c === 168) return true; // 192.168/16
  if (a === 100 && c >= 64 && c <= 127) return true; // 100.64/10 CGN
  return false;
}

/**
 * True when `ip` (an IPv4 or IPv6 literal, as node:dns hands them back)
 * falls in a private, loopback, link-local, metadata, or ULA range and
 * therefore must never be fetched. Fails CLOSED: an address string this
 * helper cannot parse is treated as unsafe. Pure and DNS-free, so the
 * whole range table is directly unit-testable.
 */
export function isPrivateIp(ip: string): boolean {
  const v4 = ipv4ToBytes(ip);
  if (v4) return isPrivateIpv4Bytes(v4);

  const b = ipv6ToBytes(ip);
  if (!b) return true; // unparseable: fail closed

  // IPv4-mapped ::ffff:a.b.c.d -> re-check the embedded v4 address.
  if (b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff) {
    return isPrivateIpv4Bytes(b.slice(12, 16));
  }
  // Loopback ::1
  if (b.slice(0, 15).every((x) => x === 0) && b[15] === 1) return true;
  // Unspecified ::
  if (b.every((x) => x === 0)) return true;
  // Unique-local fc00::/7 (fc00..fdff)
  if ((b[0]! & 0xfe) === 0xfc) return true;
  // Link-local fe80::/10 (fe80..febf)
  if (b[0] === 0xfe && (b[1]! & 0xc0) === 0x80) return true;
  return false;
}

/**
 * True only for URLs a data-pipeline script may fetch: http(s), a real
 * public-looking host. IPv6 literals are rejected wholesale (none of
 * our sources need one; hostnames that resolve to IPv6 are caught by the
 * DNS-resolution guard in fetchSafe instead).
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
  const v4 = ipv4ToBytes(host);
  if (v4 && isPrivateIpv4Bytes(v4)) return false;
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

/** Resolve a hostname to its list of IP addresses. Injectable for tests. */
export type HostResolver = (hostname: string) => Promise<string[]>;

async function defaultResolve(hostname: string): Promise<string[]> {
  const answers = await lookup(hostname, { all: true });
  return answers.map((a) => a.address);
}

export interface SafeFetchOptions {
  /** Overall deadline for the WHOLE redirect chain (connect + all hops + body read). */
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  /**
   * TEST SEAM ONLY: replaces isSafeUrl so the redirect re-validation and
   * the size cap can be exercised against a loopback fixture server.
   * Production callers must never pass this.
   */
  guard?: (url: string) => boolean;
  /**
   * TEST SEAM ONLY: replaces the node:dns resolver so the DNS-rebinding
   * guard can be exercised (and so loopback fixture servers, whose host
   * resolves to a private address, can be reached in tests) without a
   * live lookup. Production callers must never pass this.
   */
  resolve?: HostResolver;
}

/**
 * Fetch with the SSRF guard applied to the request URL AND to every
 * redirect hop, each hop's hostname resolved and every resolved address
 * checked against the private ranges (DNS-rebinding guard), one overall
 * deadline across the whole chain, and the body read as a stream that
 * aborts past maxBytes. Throws UnsafeUrlError / ResponseTooLargeError;
 * network errors (including an overall-deadline abort) propagate for the
 * caller to log (never swallow them: the harvest.ts failure-logging
 * pattern is the house rule).
 */
export async function fetchSafe(raw: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? SAFE_FETCH_MAX_BYTES;
  const guard = opts.guard ?? isSafeUrl;
  const resolve = opts.resolve ?? defaultResolve;
  // Single deadline for the entire redirect chain: per-hop aborts still
  // fire, but their timers are sized from what remains of this budget, so
  // 5 hops can never sum past one timeoutMs (the old model allowed
  // MAX_REDIRECTS * timeoutMs worst case).
  const deadline = Date.now() + timeoutMs;
  let url = raw;
  for (let hop = 0; ; hop++) {
    if (!guard(url)) throw new UnsafeUrlError(`unsafe URL refused: ${url}`);

    // DNS-rebinding guard: resolve this hop's host and refuse if ANY
    // answer is private. See the module header for the residual TOCTOU.
    const hostname = new URL(url).hostname;
    const addrs = await resolve(hostname);
    if (addrs.length === 0) throw new UnsafeUrlError(`no DNS answer for ${hostname}: ${url}`);
    for (const addr of addrs) {
      if (isPrivateIp(addr)) {
        throw new UnsafeUrlError(`${hostname} resolves to a private address (${addr}): ${url}`);
      }
    }

    const ctrl = new AbortController();
    const remaining = deadline - Date.now();
    if (remaining <= 0) ctrl.abort();
    const timer = setTimeout(() => ctrl.abort(), Math.max(0, remaining));
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
