import { describe, expect, it } from "vitest";
import { effectTypes } from "../../packages/protocol/src/index.js";
import {
  authorityRank,
  contractAuthority,
  mandateEnvelope,
  validateChildMandate,
} from "../../packages/runtime/src/index.js";
import { checkoutMandate, childMandate, fixture } from "../helpers.js";

describe("delegation and contraction", () => {
  it("accepts the canonical attenuated child", () => {
    expect(validateChildMandate(checkoutMandate(), childMandate(), "ALLOW")).toEqual({ subset: true, reasons: [] });
  });

  it("rejects the canonical child scope expansion", () => {
    const parent = checkoutMandate();
    const child = childMandate();
    const replacement = fixture<{ input: { replaceChildScope: typeof child.scope } }>(
      "invalid-child-scope-expansion.json",
    ).input.replaceChildScope;
    child.scope = replacement;
    const result = validateChildMandate(parent, child, "ALLOW");
    expect(result.subset).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("catalog"))).toBe(true);
  });

  it("preserves parent exclusions", () => {
    const parent = checkoutMandate();
    parent.scope.resources[0]!.exclude = ["services/checkout/private/**"];
    const child = childMandate();
    child.scope.resources[0]!.include = ["services/checkout/private/**"];
    child.scope.resources[0]!.exclude = [];
    expect(validateChildMandate(parent, child, "ALLOW").reasons)
      .toContain("Child scope fails to preserve parent exclusion services/checkout/private/**");
  });

  it("rejects every generated effect-rank expansion", () => {
    const parent = checkoutMandate();
    for (const type of effectTypes) {
      if (authorityRank(parent.authority, type, "local") === 2) continue;
      const child = childMandate();
      child.authority.forbiddenEffects = child.authority.forbiddenEffects.filter((rule) => rule.type !== type);
      child.authority.approvalRequiredEffects = child.authority.approvalRequiredEffects.filter((rule) => rule.type !== type);
      child.authority.allowedEffects.push({ type });
      expect(validateChildMandate(parent, child, "ALLOW").subset, type).toBe(false);
    }
  });

  it("rejects generated budget and depth expansion", () => {
    const parent = checkoutMandate();
    for (const budget of [5.000001, 6, 10, 100]) {
      const child = childMandate();
      child.limits.monetaryBudgetUsd = budget;
      expect(validateChildMandate(parent, child, "ALLOW").subset, String(budget)).toBe(false);
    }
    const child = childMandate();
    child.delegation.allowed = true;
    child.delegation.maxDepth = 1;
    expect(validateChildMandate(parent, child, "ALLOW").subset).toBe(false);
  });

  it("applies only monotonic authority contraction", () => {
    const parent = checkoutMandate();
    const current = mandateEnvelope(parent);
    const narrower = structuredClone(current);
    narrower.scope.resources[0]!.include = ["services/checkout/payments/**"];
    narrower.scope.environments = ["local"];
    narrower.limits.monetaryBudgetUsd = 2;
    narrower.delegation.allowed = false;
    narrower.delegation.maxDepth = 0;
    const contraction = contractAuthority(current, narrower);
    expect(contraction.nextDigest).not.toBe(contraction.previousDigest);

    const expanded = structuredClone(narrower);
    expanded.scope.resources[0]!.include = ["services/**"];
    expect(() => contractAuthority(narrower, expanded)).toThrow("would expand authority");
  });
});
