/**
 * Unit tests for the date-scoped backfill harvester's URL scoping
 * (scripts/backfill-harvest.ts): only Google News query feeds accept
 * after:/before: operators, everything else must be skipped.
 */

import { describe, expect, test } from "bun:test";
import { scopeGoogleNewsUrl } from "../backfill-harvest";

describe("scopeGoogleNewsUrl", () => {
  const feed =
    "https://news.google.com/rss/search?q=spacex%20OR%20starlink%20OR%20%22rocket%20launch%22&hl=en-US&gl=US&ceid=US:en";

  test("appends after:/before: to the q param and keeps the rest", () => {
    const scoped = scopeGoogleNewsUrl(feed, "2026-06-08", "2026-06-15");
    expect(scoped).not.toBeNull();
    const u = new URL(scoped!);
    expect(u.hostname).toBe("news.google.com");
    expect(u.searchParams.get("q")).toBe(
      'spacex OR starlink OR "rocket launch" after:2026-06-08 before:2026-06-15',
    );
    expect(u.searchParams.get("hl")).toBe("en-US");
    expect(u.searchParams.get("ceid")).toBe("US:en");
  });

  test("non-Google-News and non-search URLs return null", () => {
    expect(scopeGoogleNewsUrl("https://feeds.bbci.co.uk/news/rss.xml", "2026-06-08", "2026-06-15")).toBeNull();
    expect(scopeGoogleNewsUrl("https://news.google.com/rss?hl=en-US", "2026-06-08", "2026-06-15")).toBeNull();
    expect(scopeGoogleNewsUrl("not a url", "2026-06-08", "2026-06-15")).toBeNull();
  });

  test("a query feed with no q param returns null rather than guessing", () => {
    expect(scopeGoogleNewsUrl("https://news.google.com/rss/search?hl=en-US", "2026-06-08", "2026-06-15")).toBeNull();
  });
});
