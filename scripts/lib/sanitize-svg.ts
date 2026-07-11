/**
 * SVG sanitizer for fetched logo files (plan Phase 8, should-fix 9):
 * SVGs are documents, not images, and a hostile one can carry script.
 * This strips the executable and external-reference surface while
 * leaving ordinary vector artwork untouched. Zero dependencies,
 * regex-based over the small closed threat surface that matters for
 * files we re-host and render via <img>:
 *
 *  - <script> and <foreignObject> elements (with content)
 *  - on* event-handler attributes
 *  - javascript: URLs in href/xlink:href
 *  - external http(s) references in href/src attributes and CSS url()
 *    (a re-hosted logo must be self-contained; remote loads are either
 *    tracking or a mistake)
 *
 * Applied at fetch time by the logo pipeline and once to the existing
 * re-hosted files. A sanitized file that changed is worth eyeballing:
 * legitimate logos almost never trip any of these.
 */

const SCRIPT_ELEMENTS = /<\s*(script|foreignObject)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const SELF_CLOSED_SCRIPT = /<\s*(script|foreignObject)\b[^>]*\/\s*>/gi;
const EVENT_ATTRS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_HREF = /\s+(href|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi;
const EXTERNAL_REF = /\s+(href|xlink:href|src)\s*=\s*(?:"https?:\/\/[^"]*"|'https?:\/\/[^']*')/gi;
const CSS_EXTERNAL_URL = /url\(\s*(?:"|')?\s*https?:\/\/[^)]*\)/gi;

export function sanitizeSvg(svg: string): string {
  return svg
    .replace(SCRIPT_ELEMENTS, "")
    .replace(SELF_CLOSED_SCRIPT, "")
    .replace(EVENT_ATTRS, "")
    .replace(JS_HREF, "")
    .replace(EXTERNAL_REF, "")
    .replace(CSS_EXTERNAL_URL, "url()");
}

/** True when sanitizing would change the file (something was stripped). */
export function svgNeedsSanitizing(svg: string): boolean {
  return sanitizeSvg(svg) !== svg;
}
