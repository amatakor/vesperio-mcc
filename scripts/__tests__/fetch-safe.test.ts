/**
 * SSRF guard and SVG sanitizer tests (plan Phase 8, should-fixes 8/9).
 * The redirect re-validation test runs a real localhost server that
 * redirects to a private address: the guard must refuse the hop even
 * though the FIRST url was (deliberately, for the test) allowed.
 */

import { describe, expect, test } from "bun:test";
import { fetchSafe, isSafeUrl, ResponseTooLargeError, UnsafeUrlError } from "../lib/fetch-safe";
import { sanitizeSvg, svgNeedsSanitizing } from "../lib/sanitize-svg";

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
    await expect(fetchSafe(entry, { guard })).rejects.toBeInstanceOf(UnsafeUrlError);
    // Sanity: the same guard fetches a non-redirecting path fine.
    const ok = await fetchSafe(`http://127.0.0.1:${server.port}/plain`, { guard });
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
      fetchSafe(`http://127.0.0.1:${server.port}/big`, { guard, maxBytes: 1024 }),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
    const ok = await fetchSafe(`http://127.0.0.1:${server.port}/small`, { guard, maxBytes: 1024 });
    expect(ok.bytes.byteLength).toBe(64);
  });
});

describe("sanitizeSvg", () => {
  test("strips script and foreignObject elements with their content", () => {
    const dirty = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="5"/><foreignObject><iframe src="https://evil.example"/></foreignObject></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("foreignObject");
    expect(clean).toContain('<rect width="5"/>');
  });

  test("strips event handlers and javascript: hrefs, keeps ordinary attrs", () => {
    const dirty = `<svg onload="alert(1)"><a href="javascript:alert(2)" fill="red"><circle r="3" onclick='x()'/></a></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain("onload");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain('fill="red"');
    expect(clean).toContain('<circle r="3"');
  });

  test("strips external references but keeps local ones", () => {
    const dirty = `<svg><use href="https://evil.example/x.svg#a"/><use href="#local"/><style>.a{background:url(https://evil.example/t.png)}</style></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain("evil.example");
    expect(clean).toContain('href="#local"');
  });

  test("a normal logo passes through byte-identical", () => {
    const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><path d="M0 0h100v40H0z" fill="#123456"/><text x="4" y="20">ACME</text></svg>`;
    expect(sanitizeSvg(logo)).toBe(logo);
    expect(svgNeedsSanitizing(logo)).toBe(false);
  });
});
