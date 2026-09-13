import { describe, expect, it } from "vitest";
import { classifyAction } from "../../packages/effects/src/index.js";
import type { ConformanceRequest, Mandate, ProposedAction } from "../../packages/protocol/src/index.js";
import { evaluateConformance } from "../../packages/runtime/src/index.js";
import { checkoutMandate } from "../helpers.js";

function request(mandate: Mandate, action: ProposedAction): ConformanceRequest {
  return {
    mandate,
    subject: structuredClone(mandate.subject),
    proposedAction: action,
    normalizedEffects: classifyAction(action, {
      repository: "checkout-demo",
      environment: "local",
      database: "checkout-db",
      service: "checkout-api",
    }),
    executionState: {
      startedAt: "2026-10-01T00:01:00.000Z",
      monetarySpentUsd: 0,
      tokensUsed: 0,
      mutationActions: 0,
      externalCallActions: 0,
      delegationDepth: 0,
    },
    eventHistory: [],
    currentAssumptions: structuredClone(mandate.assumptions),
    now: "2026-10-01T00:10:00.000Z",
  };
}

describe("conformance", () => {
  it("allows an in-scope code edit", () => {
    const action = {
      actionId: "action-edit",
      tool: "filesystem",
      operation: "editFile",
      inputs: { path: "services/checkout/validation.ts" },
    };
    expect(evaluateConformance(request(checkoutMandate(), action))).toMatchObject({ decision: "ALLOW" });
  });

  it("hard-denies a disguised database migration despite semantic allow", () => {
    const action = {
      actionId: "action-migrate",
      tool: "shell",
      operation: "execute",
      inputs: { command: "pnpm drizzle-kit push --env test" },
    };
    const input = request(checkoutMandate(), action);
    input.semanticDecision = "ALLOW";
    const result = evaluateConformance(input);
    expect(result.decision).toBe("DENY");
    expect(result.violatedRules).toContain("FORBIDDEN_EFFECT");
    expect(result.amendmentSuggested).toBe(true);
  });

  it("denies scope expansion", () => {
    const action = {
      actionId: "action-catalog",
      tool: "filesystem",
      operation: "editFile",
      inputs: { path: "services/catalog/index.ts" },
    };
    const result = evaluateConformance(request(checkoutMandate(), action));
    expect(result.decision).toBe("DENY");
    expect(result.violatedRules).toContain("RESOURCE_OUT_OF_SCOPE");
  });

  it("invalidates stale approval before any lower-precedence decision", () => {
    const action = {
      actionId: "action-stale",
      tool: "filesystem",
      operation: "editFile",
      inputs: { path: "services/catalog/index.ts" },
    };
    const input = request(checkoutMandate(), action);
    input.currentAssumptions[0]!.valueHash = "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
    expect(evaluateConformance(input)).toEqual({
      decision: "INVALIDATE_APPROVAL",
      reasons: ["A protected approval assumption changed or could not be loaded"],
      violatedRules: ["ASSUMPTION_CHANGED"],
    });
  });

  it("invalidates ambiguous duplicate assumption snapshots", () => {
    const action = {
      actionId: "action-duplicate-assumptions",
      tool: "filesystem",
      operation: "readFile",
      inputs: { path: "services/checkout/index.ts" },
    };
    const input = request(checkoutMandate(), action);
    input.currentAssumptions.push(structuredClone(input.currentAssumptions[0]!));
    expect(evaluateConformance(input).decision).toBe("INVALIDATE_APPROVAL");
  });

  it("enforces accumulated external-call limits across actions", () => {
    const mandate = checkoutMandate();
    mandate.scope.resources.push({ kind: "api", resource: "payments-api" });
    mandate.authority.allowedEffects.push({ type: "NETWORK_REQUEST" });
    mandate.limits.maxExternalCalls = 500;
    const action = {
      actionId: "action-network-501",
      tool: "typed-http",
      operation: "get",
      inputs: {},
    };
    const input = request(mandate, action);
    input.normalizedEffects = [{
      type: "NETWORK_REQUEST",
      resources: ["api://payments-api"],
      environment: "test",
      reversible: true,
      estimatedCostUsd: 0,
      confidence: 1,
    }];
    input.executionState.externalCallActions = 500;
    const result = evaluateConformance(input);
    expect(result.decision).toBe("DENY");
    expect(result.violatedRules).toContain("EXTERNAL_CALL_LIMIT_EXCEEDED");
  });

  it("escalates an unclassified shell command", () => {
    const action = {
      actionId: "action-unknown",
      tool: "shell",
      operation: "execute",
      inputs: { command: "custom-script" },
    };
    const result = evaluateConformance(request(checkoutMandate(), action));
    expect(result.decision).toBe("ESCALATE");
    expect(result.violatedRules).toContain("UNCERTAIN_CLASSIFICATION");
  });
});
