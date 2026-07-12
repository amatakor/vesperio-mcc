/**
 * SSRF guard and SVG sanitizer tests (plan Phase 8, should-fixes 8/9).
 * The redirect re-validation test runs a real localhost server that
 * redirects to a private address: the guard must refuse the hop even
 * though the FIRST url was (deliberately, for the test) allowed.
 */

import { describe, expect, test } from "bun:test";
import {
  fetchSafe,
  ipv4ToBytes,
  ipv6ToBytes,
  isPrivateIp,
  isSafeUrl,
  ResponseTooLargeError,
  UnsafeUrlError,
} from "../lib/fetch-safe";
// sanitizeSvg coverage moved to scripts/__tests__/sanitize-svg.test.ts
// (parse-and-allowlist rewrite, 2026-07-13 qc-hardening).

// The loopback fixture servers below resolve to 127.0.0.1, which the new
// DNS-rebinding guard would (correctly) refuse in production. Injecting a
// resolver that reports a public address lets the redirect/size-cap plumbing
// run against a real localhost server without any live DNS lookup.
const resolvePublic = async (): Promise<string[]> => ["93.184.216.34"];

describe("isSafeUrl", () => {
  test("public http(s) hosts pass", () => {
    expect(isSafeUrl("https://www.spacenews.com/feed/")).toBe(true);
    expect(isSafeUrl("http://example.com/a?b=c")).toBe(true);
  });

  test("private, loopback, link-local, CGN, and zeroconf addresses are refused", () => {
    for (const u of [
      "http://127.0.0.1/x",
      "http://localhost/x",
      "http://sub.localhost/x",
      "http://0.0.0.0/",
      "http://10.1.2.3/",
      "http://172.16.0.1/",
      "http://172.31.255.255/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://100.64.0.1/",
      "http://printer.local/",
      "http://svc.internal/",
    ]) {
      expect(isSafeUrl(u)).toBe(false);
    }
    // Public-range IPv4 literals and near-miss ranges stay allowed.
    expect(isSafeUrl("http://172.32.0.1/")).toBe(true);
    expect(isSafeUrl("http://8.8.8.8/")).toBe(true);
  });

  test("non-http schemes and IPv6 literals are refused", () => {
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("ftp://example.com/")).toBe(false);
    expect(isSafeUrl("gopher://example.com/")).toBe(false);
    expect(isSafeUrl("http://[::1]/")).toBe(false);
    expect(isSafeUrl("not a url")).toBe(false);
  });
});

describe("fetchSafe", () => {
  test("refuses an unsafe URL outright", async () => {
    await expect(fetchSafe("http://169.254.169.254/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  test("SSRF: a redirect to a disallowed address is refused mid-chain", async () => {
    using server = Bun.serve({
      port: 0,
      fetch(req) {
        const p = new URL(req.url).pathname;
        if (p === "/redirect") {
          return new Response(null, {
            status: 302,
            headers: { location: "http://169.254.169.254/latest/meta-data/" },
          });
        }
        return new Response("ok");
      },
    });
    // Test guard: allow only this fixture server, so the FIRST hop passes
    // and the redirect target must be refused by the per-hop check.
    const guard = (u: string) => new URL(u).port === String(server.port);
    const entry = `http://127.0.0.1:${server.port}/redirect`;
    await expect(
      fetchSafe(entry, { guard, resolve: resolvePublic }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    // Sanity: the same guard fetches a non-redirecting path fine.
    const ok = await fetchSafe(`http://127.0.0.1:${server.port}/plain`, {
      guard,
      resolve: resolvePublic,
    });
    expect(ok.status).toBe(200);
    expect(new TextDecoder().decode(ok.bytes)).toBe("ok");
  });

  test("the size cap aborts an oversized body; a small body passes", async () => {
    using server = Bun.serve({
      port: 0,
      fetch(req) {
        const p = new URL(req.url).pathname;
        return new Response(new Uint8Array(p === "/big" ? 4 * 1024 * 1024 : 64));
      },
    });
    const guard = (u: string) => new URL(u).port === String(server.port);
    await expect(
      fetchSafe(`http://127.0.0.1:${server.port}/big`, {
        guard,
        resolve: resolvePublic,
        maxBytes: 1024,
      }),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
    const ok = await fetchSafe(`http://127.0.0.1:${server.port}/small`, {
      guard,
      resolve: resolvePublic,
      maxBytes: 1024,
    });
    expect(ok.bytes.byteLength).toBe(64);
  });

  test("DNS-rebinding: a public host that resolves to a private address is refused", async () => {
    // isSafeUrl passes the literal (a real public-looking hostname), but the
    // injected resolver reports the metadata address, so the hop is refused
    // before any socket is opened. No live DNS, no live fetch.
    const resolveMetadata = async () => ["169.254.169.254"];
    await expect(
      fetchSafe("https://rebind.example.com/", { resolve: resolveMetadata }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  test("DNS-rebinding: refused when ANY of several answers is private", async () => {
    const resolveMixed = async () => ["93.184.216.34", "10.0.0.5"];
    await expect(
      fetchSafe("https://split.example.com/", { resolve: resolveMixed }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  test("DNS-rebinding: an empty DNS answer is refused", async () => {
    const resolveNone = async () => [];
    await expect(
      fetchSafe("https://nx.example.com/", { resolve: resolveNone }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  test("overall deadline: a slow-but-under-cap redirect chain aborts once the budget is spent", async () => {
    // Two hops, each delaying ~120ms, against a 150ms overall deadline: the
    // first hop fits, the chain as a whole does not, so the second hop's
    // fetch aborts. Proves the deadline spans the WHOLE chain, not per hop
    // (per-hop, 2 x 120ms would comfortably fit a 150ms-per-hop budget).
    using server = Bun.serve({
      port: 0,
      async fetch(req) {
        const p = new URL(req.url).pathname;
        await Bun.sleep(120);
        if (p === "/one") {
          return new Response(null, { status: 302, headers: { location: `${p}/../two` } });
        }
        return new Response("done");
      },
    });
    const guard = (u: string) => new URL(u).port === String(server.port);
    const entry = `http://127.0.0.1:${server.port}/one`;
    // AbortError from the deadline propagates as a network error (not an
    // UnsafeUrlError / ResponseTooLargeError), so assert a rejection.
    await expect(
      fetchSafe(entry, { guard, resolve: resolvePublic, timeoutMs: 150 }),
    ).rejects.toThrow();
  });
});

describe("IP range validation (isPrivateIp)", () => {
  test("private / special-use IPv4 is flagged", () => {
    for (const ip of [
      "0.0.0.0",
      "0.1.2.3",
      "10.0.0.1",
      "10.255.255.255",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "100.64.0.1",
      "100.127.255.255",
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  test("public IPv4 (incl. near-miss ranges) is not flagged", () => {
    for (const ip of [
      "8.8.8.8",
      "93.184.216.34",
      "1.1.1.1",
      "172.15.0.1",
      "172.32.0.1",
      "192.169.0.1",
      "100.63.0.1",
      "100.128.0.1",
      "11.0.0.1",
      "126.0.0.1",
      "128.0.0.1",
    ]) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });

  test("private / special-use IPv6 is flagged", () => {
    for (const ip of [
      "::1", // loopback
      "::", // unspecified
      "fc00::1", // ULA
      "fd12:3456:789a::1", // ULA
      "fe80::1", // link-local
      "febf::1", // link-local top of range
      "FE80::1", // case-insensitive
      "fe80::1%eth0", // with zone id
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  test("IPv4-mapped IPv6 is re-checked as IPv4", () => {
    expect(isPrivateIp("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
    // Hex-form v4-mapped: ::ffff:a9fe:a9fe == ::ffff:169.254.169.254
    expect(isPrivateIp("::ffff:a9fe:a9fe")).toBe(true);
    // Public v4 mapped stays public.
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
    expect(isPrivateIp("::ffff:93.184.216.34")).toBe(false);
  });

  test("public IPv6 is not flagged", () => {
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false); // Google DNS
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false); // Cloudflare
  });

  test("unparseable address strings fail closed (treated as private)", () => {
    for (const s of ["", "not-an-ip", "999.999.999.999", "::ffff:999.1.1.1", "gg::1"]) {
      expect(isPrivateIp(s)).toBe(true);
    }
  });
});

describe("ipv4ToBytes / ipv6ToBytes parsers", () => {
  test("ipv4ToBytes parses valid dotted quads and rejects the rest", () => {
    expect(ipv4ToBytes("192.168.0.1")).toEqual([192, 168, 0, 1]);
    expect(ipv4ToBytes("255.255.255.255")).toEqual([255, 255, 255, 255]);
    expect(ipv4ToBytes("256.0.0.1")).toBeNull();
    expect(ipv4ToBytes("1.2.3")).toBeNull();
    expect(ipv4ToBytes("::1")).toBeNull();
  });

  test("ipv6ToBytes expands :: compression and embedded IPv4", () => {
    expect(ipv6ToBytes("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(ipv6ToBytes("::")).toEqual(new Array(16).fill(0));
    expect(ipv6ToBytes("::ffff:1.2.3.4")).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 1, 2, 3, 4,
    ]);
    expect(ipv6ToBytes("fe80::1")![0]).toBe(0xfe);
    expect(ipv6ToBytes("not-ipv6")).toBeNull();
    expect(ipv6ToBytes("1:2:3:4:5:6:7:8:9")).toBeNull(); // too many groups
  });
});
