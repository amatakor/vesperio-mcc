/**
 * Phase 8 validator hardening: writing-style lint, future-date bound
 * inputs, numeric plausibility, and the no-dangerouslySetInnerHTML
 * repo invariant.
 */

import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { validateItem } from "../lib/validate";

const BASE = {
  id: "2026-07-04-acme-launch",
  date: "2026-07-04",
  headline: "Acme wins launch contract",
  explainer: {
    tagline: "Acme won a contract.",
    what_happened: "Acme signed a launch contract with a customer.",
    why_it_matters: "Manifest competition affects rideshare pricing.",
  },
  kind: "event",
  tags: ["launch"],
  category: "launch",
  impact: "noise",
  companies: ["Acme"],
  source_url: "https://example.com/a",
  secondary_urls: [],
  snr: 3,
  snr_trace: {
    base: { tier: 3, source: "https://example.com/a", reason: "trade press" },
    modifiers: [],
    final: 3,
    scorer_version: 1,
  },
};

function errorsFor(overrides: Record<string, unknown>): string[] {
  const errors: string[] = [];
  validateItem({ ...BASE, ...overrides }, "item", errors);
  return errors;
}

describe("writing-style lint", () => {
  test("the clean baseline item passes", () => {
    expect(errorsFor({})).toEqual([]);
  });

  test("exclamation marks are rejected in any copy field", () => {
    expect(errorsFor({ headline: "Acme wins!" }).join("\n")).toContain("exclamation");
    expect(
      errorsFor({ explainer: { ...BASE.explainer, why_it_matters: "Big deal!" } }).join("\n"),
    ).toContain("exclamation");
  });

  test("hype voice is rejected wherever it appears", () => {
    expect(errorsFor({ headline: "Acme ships revolutionary engine" }).join("\n")).toContain("hype");
    expect(
      errorsFor({ explainer: { ...BASE.explainer, tagline: "A game-changing deal." } }).join("\n"),
    ).toContain("hype");
    expect(
      errorsFor({ explainer: { ...BASE.explainer, what_happened: "A groundbreaking pact." } }).join("\n"),
    ).toContain("hype");
  });

  test("milestone is rejected in headlines but allowed as a term of art in body copy", () => {
    expect(errorsFor({ headline: "Acme reaches launch milestone" }).join("\n")).toContain(
      "milestone",
    );
    expect(
      errorsFor({
        explainer: { ...BASE.explainer, what_happened: "The FCC waived the deployment milestone." },
      }),
    ).toEqual([]);
  });
});

describe("repo invariants", () => {
  test("no dangerouslySetInnerHTML anywhere in src/", () => {
    const out = execSync(
      "grep -rn dangerouslySetInnerHTML src/ --include='*.tsx' --include='*.ts' || true",
      { encoding: "utf8" },
    );
    expect(out.trim()).toBe("");
  });
});
