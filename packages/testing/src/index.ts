import {
  completeMandate,
  ingestEvidence,
  verifyEvidence,
} from "@mandate/evidence";
import type {
  ApprovalRecord,
  ConformanceResult,
  CriterionResult,
  EvidenceRecord,
  ExecutionState,
  Mandate,
  MandateAmendment,
  MandateEvent,
  NormalizedEffect,
  ProposedAction,
} from "@mandate/protocol";
import {
  appendEvent,
  approveMandate,
  evaluateConformance,
  markAmendmentPending,
  proposeMandate,
  rejectAmendment,
  requestApproval,
  suspendMandate,
  type MandateEventType,
} from "@mandate/runtime";

const mutationEffects = new Set([
  "CODE_MODIFICATION",
  "TEST_MODIFICATION",
  "DEPENDENCY_MODIFICATION",
  "BRANCH_CREATION",
  "DATABASE_SCHEMA_MUTATION",
  "PRODUCTION_DEPLOYMENT",
  "SECRET_WRITE",
]);

export class MandateHarness {
  mandate: Mandate;
  readonly events: MandateEvent[] = [];
  readonly approvals: ApprovalRecord[] = [];
  readonly evidence: EvidenceRecord[] = [];
  readonly criterionResults: CriterionResult[] = [];
  readonly executionState: ExecutionState;
  pendingAmendment: MandateAmendment | undefined = undefined;
  private readonly usedApprovalNonces = new Set<string>();

  constructor(mandate: Mandate, startedAt: string) {
    this.mandate = structuredClone(mandate);
    this.executionState = {
      startedAt,
      monetarySpentUsd: 0,
      tokensUsed: 0,
      mutationActions: 0,
      externalCallActions: 0,
      delegationDepth: 0,
    };
    this.record("MANDATE_CREATED", mandate.principal.id, {}, mandate.createdAt);
  }

  private record(type: MandateEventType, actor: string, payload: Record<string, unknown>, timestamp: string): void {
    this.events.push(appendEvent(this.events, {
      mandateId: this.mandate.id,
      mandateVersion: this.mandate.version,
      type,
      actor,
      payload,
      timestamp,
    }));
  }

  propose(now: string): void {
    this.mandate = requestApproval(proposeMandate(this.mandate));
    this.record("MANDATE_PROPOSED", this.mandate.subject.agentId, {}, now);
  }

  approve(principalId: string, nonce: string, now: string): ApprovalRecord {
    if (this.usedApprovalNonces.has(nonce)) throw new Error("Approval nonce replayed");
    const result = approveMandate(this.mandate, this.mandate.assumptions, principalId, now, nonce);
    this.usedApprovalNonces.add(nonce);
    this.mandate = result.mandate;
    this.approvals.push(result.approval);
    this.record("MANDATE_APPROVED", principalId, { approvalId: result.approval.id }, now);
    this.record("MANDATE_ACTIVATED", "runtime", {}, now);
    return result.approval;
  }

  runAction<T>(
    action: ProposedAction,
    effects: NormalizedEffect[],
    now: string,
    execute: () => T,
    options: { projectedTokens?: number; semanticDecision?: "ALLOW" | "DENY" | "ESCALATE" } = {},
  ): { result: ConformanceResult; value?: T } {
    this.record("ACTION_PROPOSED", this.mandate.subject.agentId, { action }, now);
    this.record("EFFECT_CLASSIFIED", "runtime", { actionId: action.actionId, effects }, now);
    const conformance = evaluateConformance({
      mandate: this.mandate,
      subject: this.mandate.subject,
      proposedAction: action,
      normalizedEffects: effects,
      executionState: structuredClone(this.executionState),
      eventHistory: this.events,
      currentAssumptions: structuredClone(this.mandate.assumptions),
      now,
      ...options,
    });
    const eventType = conformance.decision === "ALLOW"
      ? "ACTION_ALLOWED"
      : conformance.decision === "ESCALATE"
        ? "ACTION_ESCALATED"
        : "ACTION_DENIED";
    this.record(eventType, "runtime", { actionId: action.actionId, ...conformance }, now);
    if (conformance.decision === "INVALIDATE_APPROVAL") {
      this.mandate = suspendMandate(this.mandate);
      this.record("APPROVAL_INVALIDATED", "runtime", { actionId: action.actionId }, now);
      this.record("MANDATE_SUSPENDED", "runtime", {}, now);
      return { result: conformance };
    }
    if (conformance.decision !== "ALLOW") return { result: conformance };

    const value = execute();
    this.executionState.monetarySpentUsd += effects.reduce((sum, effect) => sum + (effect.estimatedCostUsd ?? 0), 0);
    this.executionState.tokensUsed += options.projectedTokens ?? 0;
    if (effects.some((effect) => mutationEffects.has(effect.type))) this.executionState.mutationActions += 1;
    if (effects.some((effect) => effect.type === "NETWORK_REQUEST")) this.executionState.externalCallActions += 1;
    this.record("ACTION_EXECUTED", this.mandate.subject.agentId, { actionId: action.actionId }, now);
    return { result: conformance, value };
  }

  requestAmendment(amendment: MandateAmendment, now: string): void {
    if (this.pendingAmendment) throw new Error("An amendment is already pending");
    this.mandate = markAmendmentPending(this.mandate);
    this.pendingAmendment = structuredClone(amendment);
    this.record("AMENDMENT_REQUESTED", this.mandate.subject.agentId, { amendmentId: amendment.id }, now);
  }

  rejectPendingAmendment(principalId: string, now: string): void {
    if (principalId !== this.mandate.principal.id) throw new Error("Principal is not eligible to reject this amendment");
    if (!this.pendingAmendment) throw new Error("No amendment is pending");
    const result = rejectAmendment(this.mandate, this.pendingAmendment);
    this.mandate = result.mandate;
    this.pendingAmendment = undefined;
    this.record("AMENDMENT_REJECTED", principalId, { amendmentId: result.amendment.id }, now);
  }

  addEvidence(input: Omit<EvidenceRecord, "verified" | "verifiedBy">, now: string): EvidenceRecord {
    const record = ingestEvidence(input);
    this.evidence.push(record);
    this.record("EVIDENCE_ADDED", input.producer, { evidenceId: record.id }, now);
    return record;
  }

  attestEvidence(evidenceId: string, verifier: string): EvidenceRecord {
    const index = this.evidence.findIndex((record) => record.id === evidenceId);
    if (index < 0) throw new Error("Evidence not found");
    const verified = verifyEvidence(this.evidence[index]!, verifier);
    this.evidence[index] = verified;
    return verified;
  }

  addCriterionResult(result: CriterionResult): void {
    this.criterionResults.push(structuredClone(result));
  }

  complete(now: string): void {
    this.mandate = completeMandate({
      mandate: this.mandate,
      currentAssumptions: structuredClone(this.mandate.assumptions),
      evidence: this.evidence,
      criterionResults: this.criterionResults,
      now,
      openAmendments: this.pendingAmendment ? [this.pendingAmendment] : [],
      unsettledActions: [],
      unresolvedViolations: [],
    });
    this.record("MANDATE_COMPLETED", "runtime", {}, now);
  }
}
