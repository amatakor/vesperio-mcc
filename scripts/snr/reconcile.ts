/**
 * Registry crossfeed reconciliation (SNR_SPEC.md §6, SNR_PLAN.md §7.3).
 *
 * Pure, deterministic. Decides what happens when an incoming news claim
 * meets an existing registry fact for the same entity/field. The
 * same-metric judgment (metric mismatch vs genuine contradiction) is the
 * agent's call upstream and is passed in as `sameMetric`; this function
 * applies the numeric rules once that judgment is made.
 *
 * SCOPE NOTE (SNR_PLAN.md §7.3): computed/orbital facts (CelesTrak/LL2/
 * SATCAT) measure only "cataloged on orbit, as_of DATE". They must NEVER
 * be compared against "operational"/"announced" claims. The caller is
 * responsible for only ever passing sameMetric=true for a computed fact
 * when the incoming claim measures the exact same thing; this function
 * trusts that contract and does not re-derive it.
 */

export type ReconcileAction =
  | { action: "annotate_mismatch" }
  | { action: "downgrade_incoming"; markDisputed: true }
  | { action: "flag_refresh" }
  | { action: "both_disputed_queue" }
  | { action: "no_registry_change" };

export interface IncomingClaim {
  snr: number;
  /** The claimed value, when the caller has it; enables the agreement check. */
  value?: unknown;
}

export interface RegistryFact {
  /** Present for scored facts; absent for unscored (Wikipedia/first-party). */
  snr?: number;
  /** "canonical" (SNR 4-5, first-party, Wikipedia, computed) or "provisional" (SNR 3). */
  tier?: "canonical" | "provisional";
  /** Unscored Wikipedia/first-party fact (SNR_SPEC.md §2.3): counts as canonical SNR 5. */
  unscored?: boolean;
  /** The stored value, when the caller has it; enables the agreement check. */
  value?: unknown;
}

/**
 * Two claimed values agree when they are the same after light
 * normalization: numbers and numeric strings compare as numbers, strings
 * trim and ignore case, arrays compare as sorted sets. Null/undefined
 * never agree (an empty fact is a null-fill, not an agreement).
 */
export function valuesAgree(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const norm = (v: unknown): string => {
    if (typeof v === "number") return String(v);
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      const n = Number(s.replace(/,/g, ""));
      return s !== "" && Number.isFinite(n) ? String(n) : s;
    }
    if (Array.isArray(v)) return JSON.stringify(v.map(norm).sort());
    return JSON.stringify(v);
  };
  return norm(a) === norm(b);
}

/**
 * Comparison SNR for a registry fact (SNR_SPEC.md §5/§6): unscored
 * Wikipedia/first-party and computed facts count as canonical SNR 5.
 * A scored fact uses its own snr.
 */
function factSnr(fact: RegistryFact): number {
  if (fact.unscored === true) return 5;
  return fact.snr ?? 5;
}

/**
 * Reconcile an incoming claim against a registry fact.
 *
 *  - !sameMetric                                  -> annotate_mismatch
 *  - provisional fact:
 *      incoming.snr > 3                           -> flag_refresh
 *      else                                       -> no_registry_change
 *  - canonical / unscored fact (same metric):
 *      fact SNR > incoming                        -> downgrade_incoming (disputed)
 *      incoming > fact SNR                         -> flag_refresh
 *      equal                                       -> both_disputed_queue
 *
 * Provisional facts never cause downgrade_incoming (SNR_SPEC.md §6.5) and
 * never adjudicate; a lower-or-equal incoming claim simply publishes with
 * no registry change.
 */
export function reconcile(
  incoming: IncomingClaim,
  registryFact: RegistryFact,
  sameMetric: boolean,
): ReconcileAction {
  // 1. Metric mismatch (the common case, SNR_SPEC.md §6.1): never a
  //    downgrade; annotate the relationship instead.
  if (!sameMetric) return { action: "annotate_mismatch" };

  // 2. Provisional facts never adjudicate (SNR_SPEC.md §6.5, §5).
  if (registryFact.tier === "provisional") {
    if (incoming.snr > 3) return { action: "flag_refresh" };
    return { action: "no_registry_change" };
  }

  // 3. Canonical / unscored / computed fact, same metric.
  const fSnr = factSnr(registryFact);
  // 3a. Agreement is not a dispute (Florian, 2026-09-09): a claim that
  //     states the SAME value as the stored fact confirms it. A stronger
  //     source refreshes the citation; an equal or weaker one changes
  //     nothing and never marks the item disputed. (Sentinel-1 NG: two
  //     SNR 5 sources both saying "2" sat in the held queue as a tie.)
  if (valuesAgree(incoming.value, registryFact.value)) {
    return incoming.snr > fSnr ? { action: "flag_refresh" } : { action: "no_registry_change" };
  }
  if (fSnr > incoming.snr) return { action: "downgrade_incoming", markDisputed: true };
  if (incoming.snr > fSnr) return { action: "flag_refresh" };
  return { action: "both_disputed_queue" };
}
