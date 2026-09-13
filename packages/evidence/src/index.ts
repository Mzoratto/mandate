import { frozenSnapshot } from "@mandate/protocol";
import type {
  ApprovalAssumption,
  CriterionResult,
  EvidenceRecord,
  Mandate,
} from "@mandate/protocol";
import { assumptionsMatch } from "@mandate/runtime";

export function ingestEvidence(
  input: Omit<EvidenceRecord, "verified" | "verifiedBy">,
): EvidenceRecord {
  const { verified: _verified, verifiedBy: _verifiedBy, ...safe } = input as EvidenceRecord;
  return { ...structuredClone(safe), verified: false };
}

export function verifyEvidence(record: EvidenceRecord, verifier: string): EvidenceRecord {
  if (record.artifactUri && !record.digest) throw new Error("Artifact evidence requires a digest");
  if (record.verified) throw new Error("Evidence is already verified");
  return { ...record, verified: true, verifiedBy: verifier };
}

export interface CompletionInput {
  mandate: Mandate;
  currentAssumptions: ApprovalAssumption[];
  evidence: EvidenceRecord[];
  criterionResults: CriterionResult[];
  now: string;
  openAmendments: unknown[];
  unsettledActions: unknown[];
  unresolvedViolations: unknown[];
  unresolvedChildDependencies?: unknown[];
}

export interface CompletionResult {
  canComplete: boolean;
  reasons: string[];
}

export function evaluateCompletion(input: CompletionInput): CompletionResult {
  const { mandate } = input;
  const reasons: string[] = [];
  if (mandate.status !== "ACTIVE") reasons.push("Mandate is not active");
  if (mandate.validity.notBefore && input.now < mandate.validity.notBefore) reasons.push("Mandate is not yet valid");
  if (input.now >= mandate.validity.expiresAt) reasons.push("Mandate has expired");
  if (!assumptionsMatch(mandate.assumptions, input.currentAssumptions)) reasons.push("Approval assumptions are stale");
  if (input.openAmendments.length) reasons.push("An amendment is still open");
  if (input.unsettledActions.length) reasons.push("An action is reserved or unsettled");
  if (input.unresolvedViolations.length) reasons.push("A violation is unresolved");
  if (input.unresolvedChildDependencies?.length) reasons.push("A child completion dependency is unresolved");

  const versionEvidence = input.evidence.filter(
    (record) => record.mandateId === mandate.id && record.mandateVersion === mandate.version,
  );
  for (const requirement of mandate.evidence.requirements.filter((item) => item.required)) {
    const matching = versionEvidence.some((record) => record.requirementId === requirement.id
      && record.type === requirement.type
      && record.verified
      && record.verifiedBy === requirement.verifier
      && (!record.artifactUri || !!record.digest));
    if (!matching) reasons.push(`Required evidence ${requirement.id} is missing or unverified`);
  }

  const evidenceById = new Map(versionEvidence.map((record) => [record.id, record]));
  for (const criterion of mandate.goal.successCriteria.filter((item) => item.required)) {
    const results = input.criterionResults
      .filter((result) => result.mandateId === mandate.id
        && result.mandateVersion === mandate.version
        && result.criterionId === criterion.id)
      .sort((left, right) => right.verifiedAt.localeCompare(left.verifiedAt));
    const latest = results[0];
    if (!latest || latest.status !== "PASS" || latest.verifier !== criterion.verifier) {
      reasons.push(`Required criterion ${criterion.id} has no current verified pass`);
      continue;
    }
    const referencesValidEvidence = latest.evidenceIds.length > 0
      && latest.evidenceIds.every((id) => {
        const record = evidenceById.get(id);
        return record?.verified === true && record.verifiedBy === criterion.verifier;
      });
    if (!referencesValidEvidence) reasons.push(`Criterion ${criterion.id} lacks evidence from its verifier`);
    if (criterion.type === "human" && latest.verifier !== mandate.principal.id) {
      reasons.push(`Human criterion ${criterion.id} was not verified by the principal`);
    }
  }

  return { canComplete: reasons.length === 0, reasons };
}

export function completeMandate(input: CompletionInput): Mandate {
  const result = evaluateCompletion(input);
  if (!result.canComplete) throw new Error(`Mandate cannot complete: ${result.reasons.join("; ")}`);
  return frozenSnapshot({ ...input.mandate, status: "COMPLETED", completedAt: input.now });
}
