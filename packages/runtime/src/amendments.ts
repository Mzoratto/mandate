import {
  deterministicId,
  frozenSnapshot,
  mandateVersionDigest,
  type ApprovalAssumption,
  type ApprovalRecord,
  type Mandate,
  type MandateAmendment,
} from "@mandate/protocol";
import { MandateSchema } from "@mandate/schemas";
import { authoritySubset } from "./authority.js";
import { assumptionsMatch } from "./lifecycle.js";

const patchKeys = {
  "/goal": "goal",
  "/scope": "scope",
  "/authority": "authority",
  "/limits": "limits",
  "/delegation": "delegation",
  "/escalation": "escalation",
  "/evidence": "evidence",
  "/validity": "validity",
  "/assumptions": "assumptions",
} as const;

export function amendmentCandidate(base: Mandate, amendment: MandateAmendment, now: string): Mandate {
  if (amendment.mandateId !== base.id) throw new Error("Amendment targets another Mandate");
  if (amendment.baseVersion !== base.version || amendment.baseVersionDigest !== mandateVersionDigest(base)) {
    throw new Error("Amendment base version is stale");
  }
  const candidate: Record<string, unknown> = structuredClone(base) as unknown as Record<string, unknown>;
  for (const patch of amendment.requestedChanges) candidate[patchKeys[patch.path]] = structuredClone(patch.value);
  candidate.version = base.version + 1;
  candidate.supersedes = `${base.id}@${base.version}`;
  candidate.status = "ACTIVE";
  candidate.createdAt = now;
  candidate.approvedAt = now;
  delete candidate.completedAt;
  return frozenSnapshot(MandateSchema.parse(candidate) as Mandate);
}

export function amendmentExpandsAuthority(base: Mandate, amendment: MandateAmendment, now: string): boolean {
  return !authoritySubset(base, amendmentCandidate(base, amendment, now)).subset;
}

export function approveAmendment(
  base: Mandate,
  amendment: MandateAmendment,
  currentAssumptions: ApprovalAssumption[],
  approvingPrincipalId: string,
  now: string,
  nonce: string,
): { mandate: Mandate; amendment: MandateAmendment; approval: ApprovalRecord } {
  if (base.status !== "AMENDMENT_PENDING") throw new Error("Mandate has no pending amendment");
  if (approvingPrincipalId !== base.principal.id) throw new Error("Principal is not eligible to approve this amendment");
  if (amendment.status !== "PENDING") throw new Error("Amendment is not pending");
  if (now >= base.validity.expiresAt) throw new Error("Mandate has expired");
  const mandate = amendmentCandidate(base, amendment, now);
  if (!assumptionsMatch(mandate.assumptions, currentAssumptions)) {
    throw new Error("Amendment assumptions do not match current state");
  }
  const approval: ApprovalRecord = frozenSnapshot({
    id: deterministicId("approval", { mandateId: mandate.id, version: mandate.version, nonce }),
    mandateId: mandate.id,
    mandateVersion: mandate.version,
    mandateVersionDigest: mandateVersionDigest(mandate),
    principalId: mandate.principal.id,
    assumptionHashes: structuredClone(currentAssumptions),
    nonce,
    approvedAt: now,
  });
  return { mandate, amendment: frozenSnapshot({ ...amendment, status: "APPROVED" }), approval };
}

export function rejectAmendment(
  base: Mandate,
  amendment: MandateAmendment,
  suspend = false,
): { mandate: Mandate; amendment: MandateAmendment } {
  if (base.status !== "AMENDMENT_PENDING" || amendment.status !== "PENDING") {
    throw new Error("Amendment is not pending for this Mandate");
  }
  return {
    mandate: frozenSnapshot({ ...base, status: suspend ? "SUSPENDED" : "ACTIVE" }),
    amendment: frozenSnapshot({ ...amendment, status: "REJECTED" }),
  };
}
