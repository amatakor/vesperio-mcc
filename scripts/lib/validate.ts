/**
 * Runtime validation for the data files, kept in sync with the types in
 * src/data/schema.ts. Each validator returns a list of human-readable
 * errors; empty list means valid. No dependencies, fully deterministic.
 */

import {
  CATEGORIES,
  IMPACTS,
  CONFIDENCES,
  SOURCE_STATUSES,
  FEED_TYPES,
  SOURCE_TIERS,
  CONSTELLATION_DOMAINS,
  SPACEPORT_REGIONS,
  ORG_KINDS,
  HEADLINE_MAX_CHARS,
  TAGLINE_MAX_CHARS,
  SIGNAL_BUCKETS,
  SIGNAL_WHITELIST,
  CHANNEL_STATUSES,
  FACILITY_TYPES,
  OMM_STRING_FIELDS,
  OMM_NUMBER_FIELDS,
} from "../../src/data/schema";

const ID_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TAG_RE = /^[a-z0-9][a-z0-9-]*$/;
const EM_DASH = "—";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isHttpUrl(v: unknown): boolean {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function isIsoDatetime(s: unknown): boolean {
  return typeof s === "string" && !Number.isNaN(new Date(s).getTime());
}

function reqString(o: Obj, key: string, path: string, errors: string[]): string | null {
  const v = o[key];
  if (typeof v !== "string" || v.trim() === "") {
    errors.push(`${path}.${key}: required non-empty string`);
    return null;
  }
  return v;
}

function checkNoEmDash(text: string | null, path: string, errors: string[]): void {
  if (text !== null && text.includes(EM_DASH)) {
    errors.push(`${path}: contains an em dash; not allowed anywhere on the site`);
  }
}

function reqStringArray(o: Obj, key: string, path: string, errors: string[]): string[] | null {
  const v = o[key];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    errors.push(`${path}.${key}: required array of strings`);
    return null;
  }
  return v as string[];
}

// ---------------------------------------------------------------- items

export function validateItem(v: unknown, path: string, errors: string[]): void {
  if (!isObj(v)) {
    errors.push(`${path}: item must be an object`);
    return;
  }

  const id = reqString(v, "id", path, errors);
  if (id !== null && !ID_RE.test(id)) {
    errors.push(`${path}.id: must match YYYY-MM-DD-slug (lowercase), got "${id}"`);
  }

  const date = reqString(v, "date", path, errors);
  if (date !== null && !isValidDate(date)) {
    errors.push(`${path}.date: must be a valid YYYY-MM-DD date, got "${date}"`);
  }

  const headline = reqString(v, "headline", path, errors);
  if (headline !== null && headline.length > HEADLINE_MAX_CHARS) {
    errors.push(`${path}.headline: ${headline.length} chars, max ${HEADLINE_MAX_CHARS}`);
  }
  checkNoEmDash(headline, `${path}.headline`, errors);

  if (!isObj(v.explainer)) {
    errors.push(`${path}.explainer: required object`);
  } else {
    const e = v.explainer;
    const ePath = `${path}.explainer`;
    const tagline = reqString(e, "tagline", ePath, errors);
    if (tagline !== null && tagline.length > TAGLINE_MAX_CHARS) {
      errors.push(`${ePath}.tagline: ${tagline.length} chars, max ${TAGLINE_MAX_CHARS}`);
    }
    checkNoEmDash(tagline, `${ePath}.tagline`, errors);
    checkNoEmDash(reqString(e, "what_happened", ePath, errors), `${ePath}.what_happened`, errors);
    checkNoEmDash(reqString(e, "why_it_matters", ePath, errors), `${ePath}.why_it_matters`, errors);
    if (e.for_who !== undefined && typeof e.for_who !== "string") {
      errors.push(`${ePath}.for_who: must be a string when present`);
    }
    if (typeof e.for_who === "string") checkNoEmDash(e.for_who, `${ePath}.for_who`, errors);
  }

  const tags = reqStringArray(v, "tags", path, errors);
  if (tags !== null) {
    for (const t of tags) {
      if (!TAG_RE.test(t)) errors.push(`${path}.tags: "${t}" must be lowercase kebab-case`);
    }
  }

  if (!CATEGORIES.includes(v.category as never)) {
    errors.push(`${path}.category: "${String(v.category)}" not in [${CATEGORIES.join(", ")}]`);
  }
  if (!IMPACTS.includes(v.impact as never)) {
    errors.push(`${path}.impact: "${String(v.impact)}" not in [${IMPACTS.join(", ")}]`);
  }
  if (!CONFIDENCES.includes(v.confidence as never)) {
    errors.push(`${path}.confidence: "${String(v.confidence)}" not in [${CONFIDENCES.join(", ")}]`);
  }

  reqStringArray(v, "companies", path, errors);

  if (!isHttpUrl(v.source_url)) {
    errors.push(`${path}.source_url: required http(s) URL; no primary source, no publish`);
  }
  const secondary = reqStringArray(v, "secondary_urls", path, errors);
  if (secondary !== null) {
    for (const u of secondary) {
      if (!isHttpUrl(u)) errors.push(`${path}.secondary_urls: "${u}" is not an http(s) URL`);
    }
  }

  if (v.publishDate !== undefined && !isIsoDatetime(v.publishDate)) {
    errors.push(`${path}.publishDate: must be an ISO datetime when present`);
  }

  // Non-confirmed items must carry their evidence block; confirmed items need none.
  if (v.confidence === "reported" || v.confidence === "signal") {
    if (!isObj(v.evidence)) {
      errors.push(`${path}.evidence: required for ${String(v.confidence)} items ({ said_by, basis, confirmation })`);
    }
  }
  if (v.evidence !== undefined && v.evidence !== null) {
    if (!isObj(v.evidence)) {
      errors.push(`${path}.evidence: must be null or { said_by, basis, confirmation }`);
    } else {
      reqString(v.evidence, "said_by", `${path}.evidence`, errors);
      reqString(v.evidence, "basis", `${path}.evidence`, errors);
      if (v.evidence.confirmation !== null && typeof v.evidence.confirmation !== "string") {
        errors.push(`${path}.evidence.confirmation: must be a string or null`);
      }
      checkNoEmDash(
        typeof v.evidence.basis === "string" ? v.evidence.basis : null,
        `${path}.evidence.basis`,
        errors,
      );
    }
  }

  if (v.image !== undefined && v.image !== null) {
    if (!isObj(v.image)) {
      errors.push(`${path}.image: must be null or { src, credit, origin_url }`);
    } else {
      const img = v.image;
      const src = reqString(img, "src", `${path}.image`, errors);
      if (src !== null && !src.startsWith("/img/") && !isHttpUrl(src)) {
        errors.push(`${path}.image.src: must be a /img/ path or an http(s) URL`);
      }
      reqString(img, "credit", `${path}.image`, errors);
      if (!isHttpUrl(img.origin_url)) {
        errors.push(`${path}.image.origin_url: required http(s) URL`);
      }
    }
  }
}

export function validateItemsFile(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(data) || !Array.isArray(data.items)) {
    return ['items.json: root must be { "items": [...] }'];
  }
  const seen = new Set<string>();
  data.items.forEach((item, i) => {
    validateItem(item, `items[${i}]`, errors);
    if (isObj(item) && typeof item.id === "string") {
      if (seen.has(item.id)) errors.push(`items[${i}].id: duplicate id "${item.id}"`);
      seen.add(item.id);
    }
  });
  return errors;
}

// ----------------------------------------------------------- held/state

export function validateHeldFile(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(data) || !Array.isArray(data.held)) {
    return ['held.json: root must be { "held": [...] }'];
  }
  data.held.forEach((entry, i) => {
    const path = `held[${i}]`;
    if (!isObj(entry)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    if (!isObj(entry.candidate)) errors.push(`${path}.candidate: required object`);
    reqString(entry, "reason", path, errors);
    if (entry.date !== undefined && !(typeof entry.date === "string" && isValidDate(entry.date))) {
      errors.push(`${path}.date: must be YYYY-MM-DD when present`);
    }
  });
  return errors;
}

export function validateStateFile(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(data)) return ["state.json: root must be an object"];
  if (data.lastSweep !== null && !isIsoDatetime(data.lastSweep)) {
    errors.push("state.lastSweep: must be null or an ISO datetime");
  }
  if (!Array.isArray(data.sweeps)) {
    errors.push('state.sweeps: required array');
    return errors;
  }
  data.sweeps.forEach((s, i) => {
    const path = `state.sweeps[${i}]`;
    if (!isObj(s)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    if (!isIsoDatetime(s.at)) errors.push(`${path}.at: required ISO datetime`);
    for (const key of ["added", "updated", "held"]) {
      const n = s[key];
      if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
        errors.push(`${path}.${key}: required non-negative integer`);
      }
    }
    reqString(s, "summary", path, errors);
    reqStringArray(s, "coverage", path, errors);
  });
  return errors;
}

// -------------------------------------------------------------- sources

export function validateSourcesFile(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(data)) return ["sources.json: root must be an object"];
  if (typeof data.version !== "string") errors.push("sources.version: required string");
  if (!isObj(data.categories)) {
    errors.push("sources.categories: required object of category arrays");
    return errors;
  }
  for (const [cat, list] of Object.entries(data.categories)) {
    if (!Array.isArray(list)) {
      errors.push(`sources.categories.${cat}: must be an array`);
      continue;
    }
    list.forEach((src, i) => {
      const path = `sources.categories.${cat}[${i}]`;
      if (!isObj(src)) {
        errors.push(`${path}: must be an object`);
        return;
      }
      reqString(src, "name", path, errors);
      if (!isHttpUrl(src.url)) errors.push(`${path}.url: required http(s) URL`);
      if (!FEED_TYPES.includes(src.feed_type as never)) {
        errors.push(`${path}.feed_type: "${String(src.feed_type)}" not in [${FEED_TYPES.join(", ")}]`);
      }
      if (src.rss !== undefined && src.rss !== null && !isHttpUrl(src.rss)) {
        errors.push(`${path}.rss: must be null or an http(s) URL`);
      }
      reqString(src, "cadence", path, errors);
      reqString(src, "language", path, errors);
      if (!SOURCE_TIERS.includes(src.tier as never)) {
        errors.push(`${path}.tier: must be 1 or 2`);
      }
      if (!SOURCE_STATUSES.includes(src.status as never)) {
        errors.push(`${path}.status: "${String(src.status)}" not in [${SOURCE_STATUSES.join(", ")}]`);
      }
      if (src.notes !== undefined && typeof src.notes !== "string") {
        errors.push(`${path}.notes: must be a string when present`);
      }
      if (
        src.fail_count !== undefined &&
        (typeof src.fail_count !== "number" || !Number.isInteger(src.fail_count) || src.fail_count < 0)
      ) {
        errors.push(`${path}.fail_count: must be a non-negative integer when present`);
      }
    });
  }
  return errors;
}

// -------------------------------------------------------------- signals

export function validateSignalsFile(data: unknown): string[] {
  const errors: string[] = [];
  if (
    !isObj(data) ||
    !isObj(data.meta) ||
    !Array.isArray(data.people) ||
    !Array.isArray(data.outlets) ||
    !Array.isArray(data.excluded)
  ) {
    return ['signals.json: root must be { meta, people[], outlets[], excluded[] }'];
  }

  const seen = new Set<string>();
  data.people.forEach((p, i) => {
    const path = `people[${i}]`;
    if (!isObj(p)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    const id = reqString(p, "id", path, errors);
    if (id !== null) {
      if (!TAG_RE.test(id)) errors.push(`${path}.id: must be lowercase kebab-case`);
      if (seen.has(id)) errors.push(`${path}.id: duplicate id "${id}"`);
      seen.add(id);
    }
    reqString(p, "name", path, errors);
    reqString(p, "role", path, errors);
    reqString(p, "org", path, errors);
    reqString(p, "why", path, errors);
    if (!SIGNAL_BUCKETS.includes(p.bucket as never)) {
      errors.push(`${path}.bucket: "${String(p.bucket)}" not in [${SIGNAL_BUCKETS.join(", ")}]`);
    }
    if (!SIGNAL_WHITELIST.includes(p.whitelist as never)) {
      errors.push(`${path}.whitelist: must be one of [${SIGNAL_WHITELIST.join(", ")}]`);
    }
    reqStringArray(p, "domains", path, errors);
    reqStringArray(p, "regions", path, errors);
    for (const key of ["ingest_rules", "notes"]) {
      if (p[key] !== undefined && typeof p[key] !== "string") {
        errors.push(`${path}.${key}: must be a string when present`);
      }
    }
    if (!Array.isArray(p.channels) || p.channels.length === 0) {
      errors.push(`${path}.channels: required non-empty array`);
      return;
    }
    let hasActive = false;
    p.channels.forEach((c, j) => {
      const cPath = `${path}.channels[${j}]`;
      if (!isObj(c)) {
        errors.push(`${cPath}: must be an object`);
        return;
      }
      reqString(c, "type", cPath, errors);
      if (!isHttpUrl(c.url)) errors.push(`${cPath}.url: required http(s) URL`);
      if (!CHANNEL_STATUSES.includes(c.status as never)) {
        errors.push(`${cPath}.status: "${String(c.status)}" not in [${CHANNEL_STATUSES.join(", ")}]`);
      }
      if (c.status === "verified_active") hasActive = true;
      for (const key of ["last_seen", "verified_on"]) {
        const v = c[key];
        if (v !== null && v !== undefined && !(typeof v === "string" && isValidDate(v))) {
          errors.push(`${cPath}.${key}: must be null or YYYY-MM-DD`);
        }
      }
      for (const key of ["handle", "rss", "follower_scale_est", "notes"]) {
        if (c[key] !== undefined && typeof c[key] !== "string") {
          errors.push(`${cPath}.${key}: must be a string when present`);
        }
      }
    });
    if (p.whitelist === "yes" && !hasActive) {
      errors.push(`${path}: whitelist "yes" requires at least one verified_active channel`);
    }
  });

  data.outlets.forEach((o, i) => {
    const path = `outlets[${i}]`;
    if (!isObj(o)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    reqString(o, "id", path, errors);
    reqString(o, "name", path, errors);
    reqString(o, "why", path, errors);
    if (!isHttpUrl(o.url)) errors.push(`${path}.url: required http(s) URL`);
    reqStringArray(o, "domains", path, errors);
  });

  data.excluded.forEach((e, i) => {
    const path = `excluded[${i}]`;
    if (!isObj(e)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    reqString(e, "id", path, errors);
    reqString(e, "name", path, errors);
    reqString(e, "reason", path, errors);
    if (typeof e.recheck !== "boolean") errors.push(`${path}.recheck: required boolean`);
  });

  return errors;
}

// ------------------------------------------------------------- registry

function checkSourcedField(
  o: Obj,
  key: string,
  kind: "string" | "number" | "boolean" | "string[]",
  path: string,
  errors: string[],
): void {
  const v = o[key];
  if (!isObj(v)) {
    errors.push(`${path}.${key}: required SourcedField object { value, source, as_of }`);
    return;
  }
  for (const k of ["value", "source", "as_of"]) {
    if (!(k in v)) errors.push(`${path}.${key}.${k}: required (use null when unknown)`);
  }
  const { value, source, as_of } = v;
  if (value !== null && value !== undefined) {
    const ok =
      kind === "string[]"
        ? Array.isArray(value) && value.every((x) => typeof x === "string")
        : typeof value === kind;
    if (!ok) errors.push(`${path}.${key}.value: must be null or ${kind}`);
    // A filled value needs provenance: no source, no fact.
    if (source === null || source === undefined) {
      errors.push(`${path}.${key}: has a value but no source`);
    }
    if (as_of === null || as_of === undefined) {
      errors.push(`${path}.${key}: has a value but no as_of date`);
    }
  }
  if (source !== null && source !== undefined && !isHttpUrl(source)) {
    errors.push(`${path}.${key}.source: must be null or an http(s) URL`);
  }
  if (as_of !== null && as_of !== undefined && !(typeof as_of === "string" && isValidDate(as_of))) {
    errors.push(`${path}.${key}.as_of: must be null or YYYY-MM-DD`);
  }
}

const CONSTELLATION_FIELDS: Array<[string, "string" | "number" | "boolean" | "string[]"]> = [
  ["overview", "string"],
  ["operator", "string"],
  ["country", "string"],
  ["sensor_types", "string[]"],
  ["sats_on_orbit", "number"],
  ["sats_planned", "number"],
  ["orbit", "string"],
  ["first_launch_date", "string"],
  ["latest_launch_date", "string"],
  ["status", "string"],
  ["website", "string"],
];

const VEHICLE_FIELDS: Array<[string, "string" | "number" | "boolean" | "string[]"]> = [
  ["overview", "string"],
  ["provider", "string"],
  ["country", "string"],
  ["vehicle_class", "string"],
  ["payload_leo_kg", "number"],
  ["reusable", "boolean"],
  ["first_flight_date", "string"],
  ["flights_total", "number"],
  ["flights_successful", "number"],
  ["last_flight_date", "string"],
  ["next_flight_date", "string"],
  ["status", "string"],
  ["price_per_launch_usd", "number"],
];

const SPACEPORT_FIELDS: Array<[string, "string" | "number" | "boolean" | "string[]"]> = [
  ["overview", "string"],
  ["country", "string"],
  ["operator", "string"],
  ["first_launch_date", "string"],
  ["launches_total", "number"],
  ["status", "string"],
  ["website", "string"],
];

const ORG_FIELDS: Array<[string, "string" | "number" | "boolean" | "string[]"]> = [
  ["overview", "string"],
  ["country", "string"],
  ["founded", "number"],
  ["focus", "string"],
  ["status", "string"],
  ["website", "string"],
];

// --------------------------------------------------------------- orbits

function checkLatLon(o: Obj, path: string, errors: string[]): void {
  const { lat, lon } = o;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.push(`${path}.lat: required number in [-90, 90]`);
  }
  if (typeof lon !== "number" || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    errors.push(`${path}.lon: required number in [-180, 180]`);
  }
}

export function validateElementsFile(data: unknown, fileName: string): string[] {
  const errors: string[] = [];
  if (!isObj(data)) return [`${fileName}: root must be an object`];
  if (!isIsoDatetime(data.fetched_at)) errors.push(`${fileName}.fetched_at: required ISO datetime`);
  if (!isHttpUrl(data.source)) errors.push(`${fileName}.source: required http(s) URL`);
  reqString(data, "constellation", fileName, errors);
  if (!Array.isArray(data.records)) {
    errors.push(`${fileName}.records: required array`);
    return errors;
  }
  const seen = new Set<number>();
  data.records.forEach((r, i) => {
    const path = `${fileName}.records[${i}]`;
    if (!isObj(r)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    for (const key of OMM_STRING_FIELDS) {
      if (typeof r[key] !== "string" || r[key] === "") errors.push(`${path}.${key}: required string`);
    }
    for (const key of OMM_NUMBER_FIELDS) {
      if (typeof r[key] !== "number" || !Number.isFinite(r[key])) {
        errors.push(`${path}.${key}: required finite number`);
      }
    }
    const extra = Object.keys(r).filter(
      (k) =>
        !(OMM_STRING_FIELDS as readonly string[]).includes(k) &&
        !(OMM_NUMBER_FIELDS as readonly string[]).includes(k),
    );
    if (extra.length > 0) {
      errors.push(`${path}: unexpected fields [${extra.join(", ")}]; strip to the json2satrec set`);
    }
    if (typeof r.NORAD_CAT_ID === "number") {
      if (seen.has(r.NORAD_CAT_ID)) errors.push(`${path}: duplicate NORAD_CAT_ID ${r.NORAD_CAT_ID}`);
      seen.add(r.NORAD_CAT_ID);
    }
  });
  return errors;
}

export function validateSpaceportsFile(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(data)) return ["spaceports.json: root must be an object"];
  if (!isIsoDatetime(data.fetched_at)) errors.push("spaceports.json.fetched_at: required ISO datetime");
  if (!isHttpUrl(data.source)) errors.push("spaceports.json.source: required http(s) URL");
  if (!Array.isArray(data.spaceports)) {
    errors.push("spaceports.json.spaceports: required array");
    return errors;
  }
  data.spaceports.forEach((s, i) => {
    const path = `spaceports[${i}]`;
    if (!isObj(s)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    if (typeof s.ll2_id !== "number" || !Number.isInteger(s.ll2_id)) {
      errors.push(`${path}.ll2_id: required integer`);
    }
    reqString(s, "name", path, errors);
    reqString(s, "country", path, errors);
    checkLatLon(s, path, errors);
    for (const key of ["total_launch_count", "upcoming_count"]) {
      const n = s[key];
      if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
        errors.push(`${path}.${key}: required non-negative integer`);
      }
    }
    for (const key of ["next_launch", "last_launch"] as const) {
      const launch = s[key];
      if (launch === null) continue;
      if (!isObj(launch)) {
        errors.push(`${path}.${key}: must be null or { name, vehicle, net }`);
      } else {
        reqString(launch, "name", `${path}.${key}`, errors);
        reqString(launch, "vehicle", `${path}.${key}`, errors);
        if (!isIsoDatetime(launch.net)) {
          errors.push(`${path}.${key}.net: required ISO datetime`);
        }
      }
    }
    reqStringArray(s, "vehicles", path, errors);
    if (s.info_url !== null && !isHttpUrl(s.info_url)) {
      errors.push(`${path}.info_url: must be null or an http(s) URL`);
    }
  });
  return errors;
}

export function validateFacilitiesFile(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(data)) return ["facilities.json: root must be an object"];
  if (!(typeof data.as_of === "string" && isValidDate(data.as_of))) {
    errors.push("facilities.json.as_of: required YYYY-MM-DD date");
  }
  if (!Array.isArray(data.facilities)) {
    errors.push("facilities.json.facilities: required array");
    return errors;
  }
  data.facilities.forEach((f, i) => {
    const path = `facilities[${i}]`;
    if (!isObj(f)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    reqString(f, "name", path, errors);
    const slug = reqString(f, "operator_slug", path, errors);
    if (slug !== null && !TAG_RE.test(slug)) {
      errors.push(`${path}.operator_slug: must be lowercase kebab-case`);
    }
    if (!FACILITY_TYPES.includes(f.type as never)) {
      errors.push(`${path}.type: "${String(f.type)}" not in [${FACILITY_TYPES.join(", ")}]`);
    }
    checkLatLon(f, path, errors);
    checkNoEmDash(reqString(f, "blurb", path, errors), `${path}.blurb`, errors);
    if (!isHttpUrl(f.source_url)) {
      errors.push(`${path}.source_url: required http(s) URL; no source, no pin`);
    }
  });
  return errors;
}

export function validateRegistryProfile(
  data: unknown,
  expectedType: "constellation" | "vehicle" | "spaceport" | "organization",
  expectedSlug: string,
): string[] {
  const errors: string[] = [];
  const path = `${expectedType}/${expectedSlug}`;
  if (!isObj(data)) return [`${path}: root must be an object`];

  const slug = reqString(data, "slug", path, errors);
  if (slug !== null && slug !== expectedSlug) {
    errors.push(`${path}.slug: "${slug}" must match filename "${expectedSlug}"`);
  }
  reqString(data, "name", path, errors);
  if (data.entity_type !== expectedType) {
    errors.push(`${path}.entity_type: must be "${expectedType}"`);
  }
  if (data.notes !== undefined && data.notes !== null && typeof data.notes !== "string") {
    errors.push(`${path}.notes: must be null or a string when present`);
  }

  if (expectedType === "constellation") {
    if (!CONSTELLATION_DOMAINS.includes(data.domain as never)) {
      errors.push(`${path}.domain: must be one of [${CONSTELLATION_DOMAINS.join(", ")}]`);
    }
    if (data.parent !== undefined && data.parent !== null && typeof data.parent !== "string") {
      errors.push(`${path}.parent: must be null or a constellation slug`);
    }
    if (data.orbits !== undefined && data.orbits !== null) {
      const o = data.orbits;
      if (!isObj(o)) {
        errors.push(`${path}.orbits: must be null or { celestrak_group, celestrak_name, name_pattern }`);
      } else {
        for (const key of ["celestrak_group", "celestrak_name", "name_pattern"]) {
          if (!(key in o)) errors.push(`${path}.orbits.${key}: required (use null)`);
          else if (o[key] !== null && typeof o[key] !== "string") {
            errors.push(`${path}.orbits.${key}: must be null or a string`);
          }
        }
        if (o.celestrak_group === null && o.celestrak_name === null) {
          errors.push(`${path}.orbits: needs celestrak_group or celestrak_name (or set orbits to null)`);
        }
        if (typeof o.name_pattern === "string") {
          try {
            new RegExp(o.name_pattern);
          } catch {
            errors.push(`${path}.orbits.name_pattern: not a valid regex`);
          }
        }
      }
    }
    for (const [key, kind] of CONSTELLATION_FIELDS) checkSourcedField(data, key, kind, path, errors);
  } else if (expectedType === "vehicle") {
    for (const [key, kind] of VEHICLE_FIELDS) checkSourcedField(data, key, kind, path, errors);
  } else if (expectedType === "spaceport") {
    if (!SPACEPORT_REGIONS.includes(data.region as never)) {
      errors.push(`${path}.region: must be one of [${SPACEPORT_REGIONS.join(", ")}]`);
    }
    for (const [key, kind] of SPACEPORT_FIELDS) checkSourcedField(data, key, kind, path, errors);
    if (data.ll2_location_id !== undefined) {
      checkSourcedField(data, "ll2_location_id", "number", path, errors);
    }
  } else {
    if (!ORG_KINDS.includes(data.kind as never)) {
      errors.push(`${path}.kind: must be one of [${ORG_KINDS.join(", ")}]`);
    }
    for (const [key, kind] of ORG_FIELDS) checkSourcedField(data, key, kind, path, errors);
  }
  return errors;
}
