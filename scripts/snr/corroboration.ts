/**
 * Corroboration-unit collapse (SNR integrity, plan 2026-07-11 Phase 3).
 *
 * The scoring engine counts "distinct sources", and until now that was
 * the array length, so syndicated copies of one story legally bought
 * corroboration bumps. This module groups a claim's sources into
 * corroboration UNITS before scoring:
 *
 *   - exact canonical-URL duplicates are one unit (and the duplicate
 *     entry is dropped from the stored list too; a repeated link adds
 *     nothing for the reader),
 *   - sources on one registrable domain are one unit,
 *   - sources whose titles collide under SimHash (Hamming <= 3) are one
 *     unit across domains (the wire-rewrite case).
 *
 * Pure functions, no I/O. The caller passes the collapsed
 * representatives to scoreClaim and keeps the full list on the item;
 * every collapse is logged into the sweep entry so /log shows the
 * machine doing it.
 */

import type { SourceClass } from "../../src/data/schema";
import { BASE_TIER_BY_CLASS } from "./score";
import { canonicalizeUrl, registrableDomain } from "../lib/urls";
import { titlesCollide } from "../lib/simhash";

export interface CollapsibleSource {
  url: string;
  outlet: string;
  class: SourceClass;
  /** Verbatim page headline when the draft attested one; enables the
   * wire-rewrite collapse. Absent titles never collide. */
  title?: string;
}

export interface SourceCollapse {
  kept: string;
  dropped: string;
  rule: "canonical_duplicate" | "same_domain" | "wire_rewrite";
}

export interface CollapseResult<S extends CollapsibleSource> {
  /**
   * The sources to keep listed on the item: the input minus exact
   * canonical duplicates, original order preserved.
   */
  listed: S[];
  /**
   * One representative per corroboration unit, lead first. The lead
   * (input index 0) always represents its own unit; other units are
   * represented by their best-class member (first on ties).
   */
  representatives: S[];
  /** Every merge performed, for the sweep log. */
  collapses: SourceCollapse[];
  /**
   * Set when there are 2+ units and every unit representative shares
   * one source class (coverage-mix flag, display in Phase 7).
   */
  singleClass: SourceClass | null;
}

/** Minimal union-find over source indices. */
function findRoot(parent: number[], i: number): number {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]]!;
    i = parent[i]!;
  }
  return i;
}

export function collapseCorroboration<S extends CollapsibleSource>(
  sources: S[],
): CollapseResult<S> {
  const collapses: SourceCollapse[] = [];

  // Pass 1: drop exact canonical duplicates from the listed set.
  const listed: S[] = [];
  const byCanonical = new Map<string, S>();
  for (const s of sources) {
    const canon = canonicalizeUrl(s.url);
    const kept = byCanonical.get(canon);
    if (kept !== undefined) {
      collapses.push({ kept: kept.url, dropped: s.url, rule: "canonical_duplicate" });
      continue;
    }
    byCanonical.set(canon, s);
    listed.push(s);
  }

  // Pass 2: union the surviving sources into corroboration units.
  const parent = listed.map((_, i) => i);
  const union = (a: number, b: number, rule: SourceCollapse["rule"]): void => {
    const ra = findRoot(parent, a);
    const rb = findRoot(parent, b);
    if (ra === rb) return;
    // Keep the earlier-listed root so the lead's unit stays rooted at 0.
    const [keep, drop] = ra < rb ? [ra, rb] : [rb, ra];
    parent[drop] = keep;
    collapses.push({ kept: listed[keep]!.url, dropped: listed[drop]!.url, rule });
  };

  const domains = listed.map((s) => registrableDomain(s.url));
  for (let i = 0; i < listed.length; i++) {
    for (let j = i + 1; j < listed.length; j++) {
      if (domains[i] !== "" && domains[i] === domains[j]) {
        union(i, j, "same_domain");
      } else if (
        listed[i]!.title !== undefined &&
        listed[j]!.title !== undefined &&
        titlesCollide(listed[i]!.title!, listed[j]!.title!)
      ) {
        union(i, j, "wire_rewrite");
      }
    }
  }

  // Pass 3: one representative per unit; the lead represents unit 0,
  // other units take their best-class member.
  const unitMembers = new Map<number, number[]>();
  for (let i = 0; i < listed.length; i++) {
    const root = findRoot(parent, i);
    const members = unitMembers.get(root);
    if (members === undefined) unitMembers.set(root, [i]);
    else members.push(i);
  }
  const representatives: S[] = [];
  for (const [root, members] of unitMembers) {
    if (root === 0) {
      representatives.push(listed[0]!);
      continue;
    }
    let best = members[0]!;
    for (const m of members) {
      if (BASE_TIER_BY_CLASS[listed[m]!.class] > BASE_TIER_BY_CLASS[listed[best]!.class]) {
        best = m;
      }
    }
    representatives.push(listed[best]!);
  }
  // Lead-first invariant: union() always keeps the lower root, so index
  // 0 is its own root and the map's insertion order puts its unit first.

  const singleClass =
    representatives.length >= 2 &&
    representatives.every((r) => r.class === representatives[0]!.class)
      ? representatives[0]!.class
      : null;

  return { listed, representatives, collapses, singleClass };
}
