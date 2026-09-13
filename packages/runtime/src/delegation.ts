import { sha256Digest, type Mandate } from "@mandate/protocol";
import { authoritySubset, type AuthorityEnvelope } from "./authority.js";
import type { SubsetResult } from "./scope.js";

export interface ContractionResult {
  envelope: AuthorityEnvelope;
  previousDigest: string;
  nextDigest: string;
}

export function mandateEnvelope(mandate: Mandate): AuthorityEnvelope {
  return {
    scope: structuredClone(mandate.scope),
    authority: structuredClone(mandate.authority),
    limits: structuredClone(mandate.limits),
    delegation: structuredClone(mandate.delegation),
    validity: structuredClone(mandate.validity),
  };
}

export function contractAuthority(current: AuthorityEnvelope, proposed: AuthorityEnvelope): ContractionResult {
  const result = authoritySubset(current, proposed);
  if (!result.subset) throw new Error(`Authority contraction would expand authority: ${result.reasons.join("; ")}`);
  return {
    envelope: structuredClone(proposed),
    previousDigest: sha256Digest(current),
    nextDigest: sha256Digest(proposed),
  };
}

function samePrincipal(parent: Mandate, child: Mandate): boolean {
  return parent.principal.type === child.principal.type
    && parent.principal.id === child.principal.id
    && parent.principal.tenantId === child.principal.tenantId;
}

function distinctSubject(parent: Mandate, child: Mandate): boolean {
  return parent.subject.agentId !== child.subject.agentId
    || parent.subject.instanceId !== child.subject.instanceId;
}

function hasExplicitScope(child: Mandate): boolean {
  return child.scope.environments.length > 0
    && child.scope.resources.length > 0
    && child.scope.resources.every((scope) => {
      if (scope.kind !== "repository" && scope.kind !== "path") return true;
      return !!scope.include?.length;
    });
}

function preservesProtectedAssumptions(parent: Mandate, child: Mandate): boolean {
  const childAssumptions = new Map(child.assumptions.map((assumption) => [assumption.key, assumption]));
  return parent.assumptions.every((assumption) => {
    if (!assumption.invalidatesOnChange) return true;
    const inherited = childAssumptions.get(assumption.key);
    return inherited?.invalidatesOnChange === true && inherited.valueHash === assumption.valueHash;
  });
}

export function validateChildMandate(
  parent: Mandate,
  child: Mandate,
  goalRelation: "ALLOW" | "DENY" | "ESCALATE",
): SubsetResult {
  const reasons: string[] = [];
  if (parent.status !== "ACTIVE") reasons.push("Parent Mandate is not active");
  if (!parent.delegation.allowed || parent.delegation.maxDepth === 0) reasons.push("Parent Mandate cannot delegate");
  if (child.parent !== `${parent.id}@${parent.version}`) reasons.push("Child parent reference is incorrect");
  if (!samePrincipal(parent, child)) reasons.push("Child does not preserve the parent principal");
  if (!distinctSubject(parent, child)) reasons.push("Child subject must be distinct from parent subject");
  if (parent.delegation.requireExplicitChildScope && !hasExplicitScope(child)) reasons.push("Child scope is not explicit");
  if (!preservesProtectedAssumptions(parent, child)) reasons.push("Child does not preserve protected assumptions");
  if (goalRelation !== "ALLOW") reasons.push(`Child goal relation is ${goalRelation.toLowerCase()}`);
  reasons.push(...authoritySubset(parent, child, { delegationStep: true }).reasons);
  return { subset: reasons.length === 0, reasons };
}
