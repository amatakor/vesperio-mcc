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
 * URLs (feeds.bbci.co.uk, www.isro.gov.in) plus a curated set of common
 * two-level ccTLD suffixes for the geographies this product prioritizes
 * (China, India, Japan, Korea, Brazil and peers). Hardcoded instead of
 * shipping the full Public Suffix List: any multi-part suffix NOT in this
 * list degrades to a plain 2-label result (e.g. an unlisted "example.co.ke"
 * would resolve to "co.ke", over-collapsing distinct sites), so the list is
 * kept broad for the priority geographies but is still an approximation,
 * not a PSL implementation.
 */
const MULTI_PART_SUFFIXES = new Set([
  // United Kingdom
  "co.uk",
  "gov.uk",
  "org.uk",
  "ac.uk",
  "net.uk",
  "sch.uk",
  "nhs.uk",
  "police.uk",
  "ltd.uk",
  "plc.uk",
  "me.uk",
  // Korea
  "co.kr",
  "ne.kr",
  "or.kr",
  "re.kr",
  "go.kr",
  "ac.kr",
  "pe.kr",
  // Brazil
  "com.br",
  "net.br",
  "org.br",
  "gov.br",
  "edu.br",
  // Japan
  "co.jp",
  "go.jp",
  "or.jp",
  "ne.jp",
  "ac.jp",
  "ad.jp",
  "ed.jp",
  "gr.jp",
  "lg.jp",
  // India
  "co.in",
  "net.in",
  "org.in",
  "gen.in",
  "firm.in",
  "ind.in",
  "gov.in",
  "ac.in",
  "edu.in",
  "res.in",
  "nic.in",
  // China
  "com.cn",
  "net.cn",
  "org.cn",
  "gov.cn",
  "edu.cn",
  "ac.cn",
  // Taiwan
  "com.tw",
  "net.tw",
  "org.tw",
  "gov.tw",
  "edu.tw",
  "idv.tw",
  // Australia
  "com.au",
  "net.au",
  "org.au",
  "edu.au",
  "gov.au",
  "asn.au",
  "id.au",
  // New Zealand
  "co.nz",
  "net.nz",
  "org.nz",
  "govt.nz",
  "ac.nz",
  "school.nz",
  // South Africa
  "co.za",
  "org.za",
  "net.za",
  "gov.za",
  "ac.za",
  "web.za",
  // Mexico
  "com.mx",
  "org.mx",
  "net.mx",
  "gob.mx",
  "edu.mx",
  // Argentina
  "com.ar",
  "net.ar",
  "org.ar",
  "gob.ar",
  "gov.ar",
  "edu.ar",
  // Indonesia
  "co.id",
  "or.id",
  "net.id",
  "web.id",
  "go.id",
  "ac.id",
  "sch.id",
  "my.id",
  "biz.id",
  // Thailand
  "co.th",
  "or.th",
  "net.th",
  "in.th",
  "go.th",
  "ac.th",
  // Turkey
  "com.tr",
  "net.tr",
  "org.tr",
  "gov.tr",
  "edu.tr",
  "gen.tr",
  "web.tr",
  "k12.tr",
  // Poland
  "com.pl",
  "net.pl",
  "org.pl",
  "gov.pl",
  "edu.pl",
  // Israel
  "co.il",
  "org.il",
  "net.il",
  "gov.il",
  "ac.il",
  "muni.il",
  "k12.il",
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
