/**
 * SVG sanitizer for fetched logo/image files (plan Phase 8, should-fix 9;
 * hardened 2026-07-13, qc-hardening).
 *
 * Fetched SVGs get re-hosted under our OWN origin (vesperio.ai) as directly
 * navigable `.svg` files. A `.svg` is a document, not an image: any script it
 * carries runs same-origin, so a hostile logo is stored XSS. The previous
 * implementation was a regex denylist with confirmed bypasses (SMIL `<set>`/
 * `<animate>` href indirection, control-character scheme splitting like
 * `java\tscript:`, `<image>` external refs with leading whitespace).
 *
 * This rewrite is PARSE-AND-ALLOWLIST, FAIL-CLOSED:
 *  - Parse the bytes as XML with a real parser (@rgrove/parse-xml, zero-dep).
 *  - If it does not parse, or the root element is not <svg>, REJECT (return "").
 *  - Walk the tree keeping ONLY an allowlist of static rendering elements and
 *    presentation/geometry attributes. Everything else (script, foreignObject,
 *    animate/set, image, style, event handlers, external refs, comments, PIs,
 *    DOCTYPEs, CDATA, unknown elements-with-subtree) is dropped.
 *  - URL-bearing attributes keep only local fragment refs (`#id`); paint refs
 *    keep only colors / `url(#id)` / `none`. No scheme, ever, reaches output.
 *  - Serialize FROM the parsed tree (never regex over the original text).
 *
 * The parser itself closes the entity surface: custom/undefined entities throw
 * (so billion-laughs and external-entity payloads reject), and DOCTYPE internal
 * subsets are ignored. Character references are decoded BEFORE our URL checks,
 * so `java&#9;script:` is validated as the decoded `java\tscript:` and rejected.
 *
 * Rejection signal: the public `sanitizeSvg` signature stays `(string) => string`
 * so existing callers need no change. A REJECTED document returns the empty
 * string "" — the caller re-hosts an inert 0-byte file rather than the hostile
 * source, which is fail-closed. `svgNeedsSanitizing` reports true whenever the
 * sanitized output differs from the input (including rejection and any
 * re-serialization), so callers log and write the safe version.
 */

import {
  parseXml,
  XmlElement,
  XmlText,
  type XmlNode,
} from "@rgrove/parse-xml";

/** Static rendering elements only. No script/animation/embedding/style. */
const ALLOWED_ELEMENTS = new Set<string>([
  "svg",
  "g",
  "defs",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "textPath",
  "title",
  "desc",
  "use",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "pattern",
  "symbol",
  "marker",
  "filter",
  // filter primitives that do NOT reference external resources.
  // feImage is deliberately excluded: it can pull an external raster.
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
]);

/**
 * Attributes safe to pass through verbatim (escaped) on any allowed element.
 * These carry no execution surface: their values are serialized as escaped
 * text, never evaluated. URL-bearing attributes are handled separately below
 * and are NOT in this set. `style` and any `on*` handler are excluded.
 */
const ALLOWED_ATTRS = new Set<string>([
  // structural / global
  "id",
  "class",
  "xmlns",
  "xmlns:xlink",
  "xml:space",
  "xml:lang",
  "version",
  "viewBox",
  "preserveAspectRatio",
  "transform",
  "opacity",
  // geometry
  "x",
  "y",
  "width",
  "height",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "dx",
  "dy",
  "d",
  "points",
  "rotate",
  "textLength",
  "lengthAdjust",
  "pathLength",
  "startOffset",
  "spreadMethod",
  "gradientUnits",
  "gradientTransform",
  "patternUnits",
  "patternContentUnits",
  "patternTransform",
  "clipPathUnits",
  "maskUnits",
  "maskContentUnits",
  "markerUnits",
  "markerWidth",
  "markerHeight",
  "refX",
  "refY",
  "orient",
  "offset",
  "fx",
  "fy",
  "fr",
  // paint / presentation (non-URL)
  "fill-opacity",
  "fill-rule",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "stroke-opacity",
  "stop-opacity",
  "flood-opacity",
  "visibility",
  "display",
  "overflow",
  "clip-rule",
  "color-interpolation",
  "color-interpolation-filters",
  "shape-rendering",
  "text-rendering",
  "image-rendering",
  "vector-effect",
  "paint-order",
  "mix-blend-mode",
  "isolation",
  // text
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "font-stretch",
  "text-anchor",
  "dominant-baseline",
  "alignment-baseline",
  "letter-spacing",
  "word-spacing",
  "text-decoration",
  "baseline-shift",
  "writing-mode",
  "unicode-bidi",
  "direction",
  "kerning",
  // filter primitive params (all inert scalars/strings)
  "in",
  "in2",
  "result",
  "mode",
  "type",
  "values",
  "stdDeviation",
  "operator",
  "k1",
  "k2",
  "k3",
  "k4",
  "radius",
  "order",
  "kernelMatrix",
  "divisor",
  "bias",
  "targetX",
  "targetY",
  "edgeMode",
  "preserveAlpha",
  "surfaceScale",
  "diffuseConstant",
  "specularConstant",
  "specularExponent",
  "scale",
  "xChannelSelector",
  "yChannelSelector",
  "azimuth",
  "elevation",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "limitingConeAngle",
  "tableValues",
  "slope",
  "intercept",
  "amplitude",
  "exponent",
  "baseFrequency",
  "numOctaves",
  "seed",
  "stitchTiles",
  "filterUnits",
  "primitiveUnits",
]);

/**
 * URL-bearing attributes restricted to LOCAL fragment refs only (`#id`).
 * External URLs and any scheme are dropped.
 */
const HREF_ATTRS = new Set<string>(["href", "xlink:href"]);

/**
 * Paint / functional-ref attributes: colors, `none`, `currentColor`, or a
 * LOCAL `url(#id)` reference. External `url()` or any scheme is dropped.
 */
const PAINT_REF_ATTRS = new Set<string>([
  "fill",
  "stroke",
  "color",
  "stop-color",
  "flood-color",
  "lighting-color",
  "clip-path",
  "mask",
  "filter",
  "marker",
  "marker-start",
  "marker-mid",
  "marker-end",
]);

// Control characters (incl. tab/newline) used to split schemes like java\tscript:
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/** Keep an href/xlink:href only if it is a local fragment ref (`#id`). */
function cleanLocalRef(value: string): string | null {
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  return cleaned.startsWith("#") ? cleaned : null;
}

/**
 * Keep a paint/functional-ref value only if it carries no scheme and any
 * `url(...)` it contains is a local fragment. Colors, keywords, `none`, and
 * `url(#id)` (with optional fallback color) pass; anything with a `:` (i.e. a
 * scheme) or an external `url()` is dropped.
 */
function cleanPaintRef(value: string): string | null {
  const cleaned = value.replace(CONTROL_CHARS, "");
  // A scheme requires a colon; no legitimate color/keyword/local-url value has one.
  if (cleaned.includes(":")) return null;
  const urls = cleaned.match(/url\([^)]*\)/gi);
  if (urls) {
    for (const u of urls) {
      const inner = u
        .slice(4, -1)
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .trim();
      if (!inner.startsWith("#")) return null;
    }
  }
  return cleaned;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface CleanAttr {
  name: string;
  value: string;
}

/** Filter one element's attributes down to the allowlist, cleaning URL refs. */
function cleanAttributes(el: XmlElement): CleanAttr[] {
  const out: CleanAttr[] = [];
  for (const [rawName, rawValue] of Object.entries(el.attributes)) {
    const name = rawName;
    const lower = name.toLowerCase();
    // Reject every event handler outright, regardless of allowlist.
    if (lower.startsWith("on")) continue;
    // Inline style can smuggle url(javascript:) / behaviors: strip entirely.
    if (lower === "style") continue;

    if (HREF_ATTRS.has(lower)) {
      const v = cleanLocalRef(rawValue);
      if (v !== null) out.push({ name, value: v });
      continue;
    }
    if (PAINT_REF_ATTRS.has(lower)) {
      const v = cleanPaintRef(rawValue);
      if (v !== null) out.push({ name, value: v });
      continue;
    }
    if (ALLOWED_ATTRS.has(name) || ALLOWED_ATTRS.has(lower)) {
      out.push({ name, value: rawValue });
    }
    // else: non-allowlisted attribute, dropped.
  }
  return out;
}

/** Serialize an allowed element (and its allowed descendants) to SVG text. */
function serializeElement(el: XmlElement, isRoot: boolean): string {
  const attrs = cleanAttributes(el);

  if (isRoot) {
    // A standalone .svg needs the SVG namespace to render at all.
    const hasNs = attrs.some((a) => a.name === "xmlns");
    if (!hasNs) attrs.unshift({ name: "xmlns", value: SVG_NS });
  }

  const attrStr = attrs
    .map((a) => ` ${a.name}="${escapeAttr(a.value)}"`)
    .join("");

  const childParts: string[] = [];
  for (const child of el.children as XmlNode[]) {
    if (child instanceof XmlElement) {
      if (ALLOWED_ELEMENTS.has(child.name)) {
        childParts.push(serializeElement(child, false));
      }
      // Non-allowlisted element: drop it AND its subtree.
    } else if (child instanceof XmlText) {
      // Text content (incl. former CDATA, which the parser folds into text).
      childParts.push(escapeText(child.text));
    }
    // Comments, PIs, doctypes: dropped.
  }

  const inner = childParts.join("");
  if (inner.length === 0) {
    return `<${el.name}${attrStr}/>`;
  }
  return `<${el.name}${attrStr}>${inner}</${el.name}>`;
}

/**
 * Sanitize an SVG document. Returns cleaned SVG text, or "" if the input does
 * not parse as XML or is not rooted at <svg> (fail-closed rejection).
 */
export function sanitizeSvg(svg: string): string {
  let root: XmlElement | undefined;
  try {
    const doc = parseXml(svg);
    root = doc.root ?? undefined;
  } catch {
    return ""; // unparseable -> reject
  }
  if (!root || root.name !== "svg") return ""; // wrong root -> reject
  return serializeElement(root, true);
}

/** True when sanitizing would change the file (something was stripped/rejected). */
export function svgNeedsSanitizing(svg: string): boolean {
  return sanitizeSvg(svg) !== svg;
}
