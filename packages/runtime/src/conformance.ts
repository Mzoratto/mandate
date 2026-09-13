import type {
  ConformanceDecision,
  ConformanceRequest,
  ConformanceResult,
  EffectRule,
  EffectType,
  SubjectRef,
} from "@mandate/protocol";
import { authorityRank } from "./authority.js";
import { assumptionsMatch } from "./lifecycle.js";
import { resourceInScope } from "./scope.js";

const mutationEffects = new Set<EffectType>([
  "CODE_MODIFICATION",
  "TEST_MODIFICATION",
  "DEPENDENCY_MODIFICATION",
  "BRANCH_CREATION",
  "DATABASE_SCHEMA_MUTATION",
  "PRODUCTION_DEPLOYMENT",
  "SECRET_WRITE",
]);

function sameSubject(expected: SubjectRef, actual: SubjectRef): boolean {
  return expected.agentId === actual.agentId
    && expected.runtime === actual.runtime
    && (!expected.instanceId || expected.instanceId === actual.instanceId);
}

function matchingRule(rules: EffectRule[], type: EffectType, environment: string | undefined): boolean {
  return rules.some((rule) => rule.type === type && (!rule.environments || (!!environment && rule.environments.includes(environment))));
}

function microUsd(value: number): number {
  return Math.round(value * 1_000_000);
}

export function evaluateConformance(request: ConformanceRequest): ConformanceResult {
  const { mandate, normalizedEffects, executionState, now } = request;
  if (!assumptionsMatch(mandate.assumptions, request.currentAssumptions)) {
    return {
      decision: "INVALIDATE_APPROVAL",
      reasons: ["A protected approval assumption changed or could not be loaded"],
      violatedRules: ["ASSUMPTION_CHANGED"],
    };
  }

  const findings: Array<{ decision: Exclude<ConformanceDecision, "INVALIDATE_APPROVAL">; reason: string; rule: string; amendment?: boolean }> = [];
  const add = (
    decision: "DENY" | "ESCALATE",
    reason: string,
    rule: string,
    amendment = false,
  ) => findings.push({ decision, reason, rule, amendment });

  if (mandate.status !== "ACTIVE") add("DENY", `Mandate status is ${mandate.status}`, "MANDATE_NOT_ACTIVE");
  if (mandate.validity.notBefore && now < mandate.validity.notBefore) add("DENY", "Mandate is not yet valid", "VALIDITY_NOT_STARTED");
  if (now >= mandate.validity.expiresAt) add("DENY", "Mandate has expired", "VALIDITY_EXPIRED");
  if (!sameSubject(mandate.subject, request.subject)) add("DENY", "Execution subject does not match the Mandate subject", "SUBJECT_MISMATCH");
  if (normalizedEffects.length === 0) add("ESCALATE", "The action has no deterministic effect classification", "UNCERTAIN_CLASSIFICATION");

  for (const effect of normalizedEffects) {
    const rank = effect.environment ? authorityRank(mandate.authority, effect.type, effect.environment) : 0;
    if (matchingRule(mandate.authority.forbiddenEffects, effect.type, effect.environment)) {
      add("DENY", `${effect.type} is explicitly forbidden`, "FORBIDDEN_EFFECT", true);
    } else if (matchingRule(mandate.authority.approvalRequiredEffects, effect.type, effect.environment)) {
      add("ESCALATE", `${effect.type} requires an approved amendment`, "APPROVAL_REQUIRED_EFFECT", true);
    } else if (rank !== 2) {
      add("DENY", `${effect.type} is not allowed in ${effect.environment ?? "an unspecified environment"}`, "EFFECT_NOT_ALLOWED", true);
    }

    if (effect.confidence < 0.95) {
      add("ESCALATE", `${effect.type} classification confidence is below 0.95`, "UNCERTAIN_CLASSIFICATION");
    }
    if (!effect.reversible && mandate.escalation.conditions.some((condition) => condition.type === "IRREVERSIBLE_EFFECT")) {
      add("ESCALATE", `${effect.type} is irreversible`, "IRREVERSIBLE_EFFECT");
    }

    if (effect.resources.length === 0 && effect.type !== "LOCAL_COMMAND_EXECUTION") {
      add("DENY", `${effect.type} requires a normalized resource`, "RESOURCE_REQUIRED");
    }
    for (const resource of effect.resources) {
      if (!resourceInScope(mandate.scope, resource, effect.environment, effect.type)) {
        add("DENY", `${resource} is outside the Mandate scope`, "RESOURCE_OUT_OF_SCOPE", true);
      }
    }
  }

  const projectedCost = normalizedEffects.reduce((sum, effect) => sum + (effect.estimatedCostUsd ?? 0), 0);
  if (mandate.limits.monetaryBudgetUsd !== undefined) {
    if (normalizedEffects.some((effect) => effect.type === "NETWORK_REQUEST" && effect.estimatedCostUsd === undefined)) {
      add("ESCALATE", "A network request has unknown cost", "COST_UNKNOWN");
    }
    if (microUsd(executionState.monetarySpentUsd + projectedCost) > microUsd(mandate.limits.monetaryBudgetUsd)) {
      add("DENY", "Projected monetary usage exceeds the Mandate budget", "MONETARY_BUDGET_EXCEEDED", true);
    }
  }

  if (mandate.limits.tokenBudget !== undefined
      && executionState.tokensUsed + (request.projectedTokens ?? 0) > mandate.limits.tokenBudget) {
    add("DENY", "Projected token usage exceeds the Mandate budget", "TOKEN_BUDGET_EXCEEDED", true);
  }
  if (mandate.limits.maxMutations !== undefined
      && executionState.mutationActions + (normalizedEffects.some((effect) => mutationEffects.has(effect.type)) ? 1 : 0) > mandate.limits.maxMutations) {
    add("DENY", "Projected mutation count exceeds the Mandate limit", "MUTATION_LIMIT_EXCEEDED", true);
  }
  if (mandate.limits.maxExternalCalls !== undefined
      && executionState.externalCallActions + (normalizedEffects.some((effect) => effect.type === "NETWORK_REQUEST") ? 1 : 0) > mandate.limits.maxExternalCalls) {
    add("DENY", "Projected external call count exceeds the Mandate limit", "EXTERNAL_CALL_LIMIT_EXCEEDED", true);
  }
  if (mandate.limits.maxExecutionSeconds !== undefined) {
    const elapsed = Math.max(0, (Date.parse(now) - Date.parse(executionState.startedAt)) / 1000);
    if (elapsed >= mandate.limits.maxExecutionSeconds) {
      add("DENY", "Execution time limit has been reached", "EXECUTION_TIME_EXCEEDED", true);
    }
  }

  if (request.semanticDecision === "DENY") add("DENY", "Semantic outcome check denied the action", "SEMANTIC_DENY");
  if (request.semanticDecision === "ESCALATE") add("ESCALATE", "Semantic outcome check requires review", "SEMANTIC_ESCALATE");

  const decision: ConformanceDecision = findings.some((finding) => finding.decision === "DENY")
    ? "DENY"
    : findings.some((finding) => finding.decision === "ESCALATE")
      ? "ESCALATE"
      : "ALLOW";
  const winning = findings.filter((finding) => finding.decision === decision);
  const result: ConformanceResult = {
    decision,
    reasons: winning.map((finding) => finding.reason),
    violatedRules: winning.map((finding) => finding.rule),
  };
  if (winning.some((finding) => finding.amendment)) result.amendmentSuggested = true;
  return result;
}
