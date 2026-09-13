import {
  effectTypes,
  type AuthorityDefinition,
  type EffectType,
  type EffectRule,
  type DelegationDefinition,
  type LimitDefinition,
  type ScopeDefinition,
  type ValidityDefinition,
} from "@mandate/protocol";
import { scopeSubset, type SubsetResult } from "./scope.js";

export type AuthorityRank = 0 | 1 | 2;

function ruleMatches(rule: EffectRule, type: EffectType, environment: string): boolean {
  return rule.type === type && (!rule.environments || rule.environments.includes(environment));
}

export function authorityRank(authority: AuthorityDefinition, type: EffectType, environment: string): AuthorityRank {
  if (authority.forbiddenEffects.some((rule) => ruleMatches(rule, type, environment))) return 0;
  if (authority.approvalRequiredEffects.some((rule) => ruleMatches(rule, type, environment))) return 1;
  if (authority.allowedEffects.some((rule) => ruleMatches(rule, type, environment))) return 2;
  return 0;
}

const limitKeys = [
  "monetaryBudgetUsd",
  "tokenBudget",
  "maxExecutionSeconds",
  "maxMutations",
  "maxExternalCalls",
] as const satisfies readonly (keyof LimitDefinition)[];

function limitSubset(parent: LimitDefinition, child: LimitDefinition): string[] {
  const reasons: string[] = [];
  for (const key of limitKeys) {
    const parentValue = parent[key] ?? Number.POSITIVE_INFINITY;
    const childValue = child[key] ?? Number.POSITIVE_INFINITY;
    if (childValue > parentValue) reasons.push(`Limit ${key} expands from ${parentValue} to ${childValue}`);
  }
  return reasons;
}

export interface AuthorityEnvelope {
  scope: ScopeDefinition;
  authority: AuthorityDefinition;
  limits: LimitDefinition;
  delegation: DelegationDefinition;
  validity: ValidityDefinition;
}

export function authoritySubset(
  parent: AuthorityEnvelope,
  child: AuthorityEnvelope,
  options: { delegationStep?: boolean } = {},
): SubsetResult {
  const reasons = [...scopeSubset(parent.scope, child.scope).reasons, ...limitSubset(parent.limits, child.limits)];

  for (const environment of child.scope.environments) {
    for (const effect of effectTypes) {
      if (authorityRank(child.authority, effect, environment) > authorityRank(parent.authority, effect, environment)) {
        reasons.push(`Effect ${effect} has broader authority in ${environment}`);
      }
    }
  }

  const parentStart = parent.validity.notBefore ?? "";
  const childStart = child.validity.notBefore ?? "";
  if (childStart < parentStart) reasons.push("Child validity starts before parent validity");
  if (child.validity.expiresAt > parent.validity.expiresAt) reasons.push("Child validity ends after parent validity");

  if (child.delegation.allowed && !parent.delegation.allowed) reasons.push("Child enables delegation disabled by parent");
  const maxDepth = options.delegationStep ? parent.delegation.maxDepth - 1 : parent.delegation.maxDepth;
  if (child.delegation.maxDepth > maxDepth) reasons.push("Child delegation depth exceeds parent allowance");
  if (parent.delegation.requireExplicitChildScope && !child.delegation.requireExplicitChildScope) {
    reasons.push("Child weakens explicit-scope requirement");
  }

  return { subset: reasons.length === 0, reasons };
}

export function assertAuthoritySubset(
  parent: AuthorityEnvelope,
  child: AuthorityEnvelope,
  options: { delegationStep?: boolean } = {},
): void {
  const result = authoritySubset(parent, child, options);
  if (!result.subset) throw new Error(`Authority expansion rejected: ${result.reasons.join("; ")}`);
}
