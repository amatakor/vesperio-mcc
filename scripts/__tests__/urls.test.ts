/**
 * Unit tests for the URL normalization helpers (scripts/lib/urls.ts) used
 * by the corroboration and dedup passes.
 */

import { describe, expect, test } from "bun:test";
import { canonicalizeUrl, registrableDomain, TRACKING_PARAMS } from "../lib/urls";

describe("canonicalizeUrl", () => {
  test("two utm-variant URLs of one article canonicalize identically", () => {
    const a = "https://spacenews.com/iceye-gen4-order?utm_source=twitter&utm_medium=social";
    const b = "https://spacenews.com/iceye-gen4-order?utm_campaign=fall2026";
    expect(canonicalizeUrl(a)).toBe(canonicalizeUrl(b));
    expect(canonicalizeUrl(a)).toBe("https://spacenews.com/iceye-gen4-order");
  });

  test("www., m., and amp. host prefixes collapse to the same form", () => {
    const bare = canonicalizeUrl("https://spacenews.com/article");
    expect(canonicalizeUrl("https://www.spacenews.com/article")).toBe(bare);
    expect(canonicalizeUrl("https://m.spacenews.com/article")).toBe(bare);
    expect(canonicalizeUrl("https://amp.spacenews.com/article")).toBe(bare);
  });

  test("only one leading host prefix is stripped", () => {
    // www.amp.example.com: strip the leading "www." only, not "amp." too.
    expect(canonicalizeUrl("https://www.amp.example.com/x")).toBe("https://amp.example.com/x");
  });

  test("fragment is stripped", () => {
    expect(canonicalizeUrl("https://example.com/article#section-2")).toBe(
      "https://example.com/article",
    );
  });

  test("query params are sorted by key regardless of input order", () => {
    const a = canonicalizeUrl("https://example.com/x?a=1&b=2");
    const b = canonicalizeUrl("https://example.com/x?b=2&a=1");
    expect(a).toBe(b);
    expect(a).toBe("https://example.com/x?a=1&b=2");
  });

  test("duplicate keys keep their original relative order after a stable sort", () => {
    expect(canonicalizeUrl("https://example.com/x?b=2&a=1&b=3")).toBe(
      "https://example.com/x?a=1&b=2&b=3",
    );
  });

  test("trailing slash on a non-root path is trimmed; root path is unaffected", () => {
    expect(canonicalizeUrl("https://example.com/article/")).toBe(
      "https://example.com/article",
    );
    expect(canonicalizeUrl("https://example.com/")).toBe(canonicalizeUrl("https://example.com"));
    expect(canonicalizeUrl("https://example.com")).toBe("https://example.com");
  });

  test("scheme and host are lowercased but path case is preserved", () => {
    expect(canonicalizeUrl("HTTPS://Example.COM/Article-Title")).toBe(
      "https://example.com/Article-Title",
    );
  });

  test("tracking params are stripped while real params survive", () => {
    const url = "https://example.com/list?page=2&fbclid=abc123&gclid=xyz&sort=asc";
    expect(canonicalizeUrl(url)).toBe("https://example.com/list?page=2&sort=asc");
  });

  test("every declared tracking param is stripped, case-insensitively", () => {
    for (const key of TRACKING_PARAMS) {
      const url = `https://example.com/x?${encodeURIComponent(key.toUpperCase())}=1&keep=1`;
      expect(canonicalizeUrl(url)).toBe("https://example.com/x?keep=1");
    }
  });

  test("unparseable input is returned trimmed, never throws", () => {
    expect(canonicalizeUrl("  not a url at all  ")).toBe("not a url at all");
    expect(canonicalizeUrl("")).toBe("");
    expect(() => canonicalizeUrl("://///")).not.toThrow();
  });

  test("port is preserved", () => {
    expect(canonicalizeUrl("https://example.com:8443/x")).toBe("https://example.com:8443/x");
  });
});

describe("registrableDomain", () => {
  test("plain .com host returns itself", () => {
    expect(registrableDomain("https://spacenews.com/article")).toBe("spacenews.com");
  });

  test("www. subdomain on a plain .com collapses to the registrable domain", () => {
    expect(registrableDomain("https://www.spacenews.com/x")).toBe("spacenews.com");
  });

  test("a multi-part suffix from the hardcoded list keeps its full eTLD+1", () => {
    expect(registrableDomain("https://www.bbc.co.uk/news/x")).toBe("bbc.co.uk");
    expect(registrableDomain("https://feeds.bbci.co.uk/news/rss.xml")).toBe("bbci.co.uk");
    expect(registrableDomain("https://www.isro.gov.in/update")).toBe("isro.gov.in");
  });

  test("a deep subdomain collapses to the registrable domain", () => {
    expect(registrableDomain("https://ir.spire.com/press-releases")).toBe("spire.com");
    expect(registrableDomain("https://a.b.c.spacenews.com/x")).toBe("spacenews.com");
  });

  test("an unlisted multi-part suffix degrades to a 2-label result", () => {
    // example.co.nz is not in MULTI_PART_SUFFIXES, so this is the
    // documented degradation, not a bug.
    expect(registrableDomain("https://example.co.nz/x")).toBe("co.nz");
  });

  test("garbage input returns empty string, never throws", () => {
    expect(registrableDomain("not a url")).toBe("");
    expect(registrableDomain("")).toBe("");
    expect(() => registrableDomain("://///")).not.toThrow();
  });
});
