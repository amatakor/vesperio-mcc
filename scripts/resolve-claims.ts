/**
 * Claim resolution job (SNR_SPEC §7.1/§7.2, SNR_PLAN §A4/§A5).
 *
 * For every unresolved ledger claim older than CLAIM_RESOLUTION_MIN_AGE_DAYS,
 * decides confirmed / debunked / expired deterministically from the item's
 * current SNR and trace, calls the existing resolveClaim() (ledger state is
 * never hand-written), emits the strike/credit events the resolutions imply,
 * and finally writes promotionCandidates() output to signals_suggestions.json
 * (the agent never edits signals.json itself).
 *
 * Decision rules (all deterministic; anything needing judgment is left
 * unresolved and listed for the weekly registry agent or Florian):
 *   - disputed item (dispute modifier on the trace, or item.disputed) that
 *     is NOT queued in held.json -> debunked, strike ("lost a same-metric
 *     contradiction"). Queued disputes await Florian: adjudication list.
 *   - floor-independent SNR >= PROMOTION_MIN_SNR (final recomputed without
 *     the whitelist floor), or any direct source attached (first_party /
 *     official_record / computed) -> confirmed. Credit when the claim
 *     entered at SNR <= 2 ("early, not wrong").
 *   - no signal either way past LEDGER_WINDOW_DAYS -> expired.
 *   - claim id that is not a published item (registry-fact claims, removed
 *     items) -> adjudication list, untouched.
 *
 * Weekly cadence (maintain-registry.yml). Exit non-zero only on
 * catastrophic failure; an empty run is a valid result.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Item,
  ItemsFile,
  HeldFile,
  LedgerClaim,
  LedgerEvent,
  LedgerSource,
  SourceLedgerFile,
  SignalsSuggestionsFile,
  SignalSuggestion,
  SnrValue,
} from "../src/data/schema";
import {
  CLAIM_RESOLUTION_MIN_AGE_DAYS,
  LEDGER_WINDOW_DAYS,
  PROMOTION_MIN_SNR,
} from "../src/data/schema";
import { resolveClaim, promotionCandidates } from "./snr/ledger";
import { daysBetween } from "./snr/match";
import {
  validateItemsFile,
  validateHeldFile,
  validateSourceLedgerFile,
  validateSignalsSuggestionsFile,
} from "./lib/validate";

const DIRECT_CLASSES = ["first_party", "official_record", "computed"] as const;

export interface ClaimDecision {
  /** null = leave unresolved (still maturing, or needs judgment). */
  resolution: "confirmed" | "debunked" | "expired" | null;
  /** The reliability event the resolution implies, when one does. */
  event?: LedgerEvent;
  /** Present when a human or the registry agent must adjudicate. */
  adjudicate?: string;
}

/**
 * The item's final SNR recomputed without the whitelist floor: base tier
 * plus every non-floor modifier delta, clamped 1-5. "Reached >= 4" must be
 * floor-independent (SNR_PLAN §A5); the floor asserts trust in a person,
 * not corroboration of the claim.
 */
export function floorIndependentSnr(item: Item): SnrValue {
  const base = item.snr_trace.base.tier;
  const sum = item.snr_trace.modifiers
    .filter((m) => m.type !== "whitelist_floor")
    .reduce((n, m) => n + m.delta, 0);
  return Math.min(5, Math.max(1, base + sum)) as SnrValue;
}

export function decideClaim(
  claim: LedgerClaim,
  item: Item | undefined,
  heldIds: Set<string>,
  today: string,
): ClaimDecision {
  const age = daysBetween(claim.date, today);
  if (age < CLAIM_RESOLUTION_MIN_AGE_DAYS) return { resolution: null };

  if (item === undefined) {
    return {
      resolution: null,
      adjudicate: `claim "${claim.claim}" is not a published item id (registry fact or removed item); needs the registry agent or Florian`,
    };
  }

  const disputed =
    item.disputed === true || item.snr_trace.modifiers.some((m) => m.type === "dispute");
  if (disputed) {
    if (heldIds.has(item.id)) {
      return {
        resolution: null,
        adjudicate: `"${item.id}" is disputed and queued in held.json; Florian adjudicates before the ledger records an outcome`,
      };
    }
    return {
      resolution: "debunked",
      event: {
        date: today,
        kind: "strike",
        claim: claim.claim,
        reason: "lost a same-metric contradiction (dispute modifier on the item)",
      },
    };
  }

  const confirmedByScore = floorIndependentSnr(item) >= PROMOTION_MIN_SNR;
  const confirmedDirect = (item.sources ?? []).some((s) =>
    (DIRECT_CLASSES as readonly string[]).includes(s.class),
  );
  if (confirmedByScore || confirmedDirect) {
    const event: LedgerEvent | undefined =
      claim.snr_at_publication <= 2
        ? {
            date: today,
            kind: "credit",
            claim: claim.claim,
            reason: `early, not wrong: published at SNR ${claim.snr_at_publication}, later ${
              confirmedByScore ? `reached ${floorIndependentSnr(item)} floor-independently` : "confirmed by a direct source"
            }`,
          }
        : undefined;
    return event ? { resolution: "confirmed", event } : { resolution: "confirmed" };
  }

  if (age > LEDGER_WINDOW_DAYS) return { resolution: "expired" };
  return { resolution: null };
}

/** kebab-case a ledger domain into a suggestion id. */
export function suggestionId(domain: string): string {
  return domain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

interface RunResult {
  examined: number;
  confirmed: number;
  debunked: number;
  expired: number;
  adjudicate: string[];
  suggestionsAdded: string[];
}

export function runResolution(dataDir: string, today: string, nowIso: string): RunResult {
  const ledgerPath = join(dataDir, "source_ledger.json");
  const suggestionsPath = join(dataDir, "signals_suggestions.json");

  const items = JSON.parse(readFileSync(join(dataDir, "items.json"), "utf8")) as ItemsFile;
  const held = JSON.parse(readFileSync(join(dataDir, "held.json"), "utf8")) as HeldFile;
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as SourceLedgerFile;
  const suggestions = JSON.parse(
    readFileSync(suggestionsPath, "utf8"),
  ) as SignalsSuggestionsFile;

  const preErrors = [
    ...validateItemsFile(items),
    ...validateHeldFile(held),
    ...validateSourceLedgerFile(ledger),
    ...validateSignalsSuggestionsFile(suggestions),
  ];
  if (preErrors.length > 0) {
    throw new Error(`pre-existing data invalid, refusing to run:\n  ${preErrors.join("\n  ")}`);
  }

  const itemById = new Map(items.items.map((i) => [i.id, i]));
  const heldIds = new Set<string>();
  for (const h of held.held) {
    const c = h.candidate as { id?: unknown };
    if (typeof c.id === "string") heldIds.add(c.id);
  }

  const result: RunResult = {
    examined: 0,
    confirmed: 0,
    debunked: 0,
    expired: 0,
    adjudicate: [],
    suggestionsAdded: [],
  };

  ledger.sources = ledger.sources.map((source) => {
    let next: LedgerSource = source;
    for (const claim of source.claims) {
      if (claim.resolution !== "unresolved") continue;
      result.examined += 1;
      const decision = decideClaim(claim, itemById.get(claim.claim), heldIds, today);
      if (decision.adjudicate !== undefined) result.adjudicate.push(decision.adjudicate);
      if (decision.resolution === null) continue;
      next = resolveClaim(next, claim.claim, decision.resolution, today, decision.event);
      result[decision.resolution] += 1;
    }
    return next;
  });
  ledger.updated = nowIso;

  // ---- promotion suggestions (SNR_PLAN §A5) --------------------------------
  const existingSuggestionIds = new Set(suggestions.suggestions.map((s) => s.id));
  for (const cand of promotionCandidates(ledger.sources, today)) {
    const id = suggestionId(cand.domain);
    if (existingSuggestionIds.has(id)) continue;
    const evidence = cand.claims
      .map((c) => {
        const item = itemById.get(c.claim);
        if (item === undefined) return null;
        return {
          claim: c.claim,
          final_snr: item.snr,
          corroborating_sources: (item.sources ?? [])
            .filter((s) => s.url !== item.source_url)
            .map((s) => s.url),
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
    if (evidence.length === 0) continue;
    const suggestion: SignalSuggestion = {
      id,
      name: cand.name ?? cand.domain,
      channel_url: `https://${cand.domain}/`,
      proposed_on: today,
      evidence,
      status: "pending",
      notes:
        "Auto-proposed by resolve-claims: met the A5 thresholds (confirmed claims spanning the promotion window, zero strikes).",
    };
    suggestions.suggestions.push(suggestion);
    existingSuggestionIds.add(id);
    result.suggestionsAdded.push(id);
  }

  const postErrors = [
    ...validateSourceLedgerFile(ledger),
    ...validateSignalsSuggestionsFile(suggestions),
  ];
  if (postErrors.length > 0) {
    throw new Error(`post-run validation failed, nothing written:\n  ${postErrors.join("\n  ")}`);
  }

  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
  writeFileSync(suggestionsPath, JSON.stringify(suggestions, null, 2) + "\n");
  return result;
}

if (import.meta.main) {
  try {
    const now = new Date();
    const r = runResolution("src/data", now.toISOString().slice(0, 10), now.toISOString());
    console.log(
      `resolve-claims: ${r.examined} unresolved claim(s) examined; ` +
        `${r.confirmed} confirmed, ${r.debunked} debunked, ${r.expired} expired; ` +
        `${r.suggestionsAdded.length} promotion suggestion(s) written`,
    );
    if (r.suggestionsAdded.length > 0) {
      console.log(`  suggestions: ${r.suggestionsAdded.join(", ")}`);
    }
    if (r.adjudicate.length > 0) {
      console.log("  needs judgment (left unresolved):");
      for (const a of r.adjudicate) console.log(`  - ${a}`);
    }
  } catch (e) {
    console.error("resolve-claims: catastrophic failure:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
