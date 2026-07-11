/**
 * URL normalization helpers shared by the corroboration and dedup passes.
 * Pure functions, zero dependencies, deterministic. Both functions are
 * defensive by contract: a URL a scheduled sweep fetched from the open web
 * is not guaranteed parseable, and neither function may ever throw (they
 * feed a hasher used for dedup keys in the pipeline).
 */

/**
 * Tracking query params stripped by canonicalizeUrl, beyond the blanket
 * "utm_*" prefix rule. Short, curated, ClearURLs-derived list plus a few
 * peers judged standard (ad click ids, mail-campaign ids, share-referral
 * ids). Exported so tests can assert against the exact set rather than
 * duplicating it.
 */
export const TRACKING_PARAMS: readonly string[] = [
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "twclid",
  "ref_src",
  "ref_url",
  "cmpid",
  "s_kwcid",
  "sc_cid",
  "wt.mc_id",
  "oc",
];

/** Host prefixes stripped once (leftmost only) by canonicalizeUrl. */
const STRIPPED_HOST_PREFIXES = ["www.", "m.", "amp."];

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith("utm_") || TRACKING_PARAMS.includes(lower);
}

/**
 * Canonicalizes a URL for dedup hashing: lowercases scheme and host (never
 * the path or query, which can be case-sensitive), drops the fragment,
 * strips tracking params, collapses one leading www./m./amp. host prefix,
 * sorts remaining params by key (stable, so duplicate keys keep their
 * original relative order), and trims a trailing slash from the path.
 * Root paths canonicalize to "" after the host (i.e. https://example.com/
 * and https://example.com are identical); this mirrors the URL class's own
 * default and keeps the function a no-op on already-bare hosts.
 *
 * Never throws: an unparseable URL is returned trimmed, unchanged. This
 * feeds a hasher in a scheduled pipeline, so a bad input must degrade, not
 * crash the run.
 */
export function canonicalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url.trim();
  }

  const scheme = parsed.protocol.toLowerCase();
  let host = parsed.hostname.toLowerCase();
  for (const prefix of STRIPPED_HOST_PREFIXES) {
    if (host.startsWith(prefix) && host.length > prefix.length) {
      host = host.slice(prefix.length);
      break;
    }
  }
  const port = parsed.port ? `:${parsed.port}` : "";

  let path = parsed.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/") path = "";

  const kept: [string, string][] = [];
  for (const [key, value] of parsed.searchParams) {
    if (isTrackingParam(key)) continue;
    kept.push([key, value]);
  }
  // Stable sort by key: Array#sort is stable in the JS engines Bun targets,
  // so duplicate keys keep their original relative order.
  kept.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const query = kept.length > 0
    ? `?${kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}`
    : "";

  return `${scheme}//${host}${port}${path}${query}`;
}

/**
 * Multi-part public suffixes seen in this repo's own source and signals
 * URLs (feeds.bbci.co.uk, www.isro.gov.in) plus common peers, hardcoded
 * instead of shipping the full Public Suffix List. Any multi-part suffix
 * not in this list degrades to a plain 2-label result (e.g. an unlisted
 * "example.co.nz" would resolve to "co.nz", not "example.co.nz"); this is
 * an approximation, not a PSL implementation.
 */
const MULTI_PART_SUFFIXES = new Set([
  "co.uk",
  "com.au",
  "co.jp",
  "gov.uk",
  "org.uk",
  "com.cn",
  "co.in",
  "gov.in",
  "go.jp",
  "ac.uk",
]);

/**
 * eTLD+1 approximation: the host minus subdomains. Uses MULTI_PART_SUFFIXES
 * to keep known two-label suffixes intact (bbci.co.uk stays three labels:
 * feeds.bbci.co.uk -> bbci.co.uk); otherwise takes the last two labels.
 * Never throws: an unparseable URL returns "".
 */
export function registrableDomain(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
  if (host === "") return "";

  const labels = host.split(".").filter((l) => l.length > 0);
  if (labels.length <= 2) return labels.join(".");

  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_PART_SUFFIXES.has(lastTwo)) return labels.slice(-3).join(".");
  return lastTwo;
}
