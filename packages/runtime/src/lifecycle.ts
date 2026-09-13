import {
  deterministicId,
  frozenSnapshot,
  mandateVersionDigest,
  type ApprovalAssumption,
  type ApprovalRecord,
  type Mandate,
  type MandateStatus,
} from "@mandate/protocol";

const transitions: Readonly<Record<MandateStatus, readonly MandateStatus[]>> = {
  DRAFT: ["PROPOSED"],
  PROPOSED: ["AWAITING_APPROVAL", "REJECTED"],
  AWAITING_APPROVAL: ["ACTIVE", "REJECTED", "EXPIRED"],
  ACTIVE: ["SUSPENDED", "AMENDMENT_PENDING", "COMPLETED", "REVOKED", "EXPIRED"],
  AMENDMENT_PENDING: ["ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"],
  SUSPENDED: ["ACTIVE", "REVOKED", "EXPIRED"],
  COMPLETED: [],
  REJECTED: [],
  REVOKED: [],
  EXPIRED: [],
};

function move(mandate: Mandate, status: MandateStatus): Mandate {
  if (!transitions[mandate.status].includes(status)) {
    throw new Error(`Illegal Mandate transition: ${mandate.status} -> ${status}`);
  }
  return frozenSnapshot({ ...mandate, status });
}

function assertNotExpired(mandate: Mandate, now: string): void {
  if (now >= mandate.validity.expiresAt) throw new Error("Mandate has expired");
  if (mandate.validity.notBefore && now < mandate.validity.notBefore) throw new Error("Mandate is not yet valid");
}

function createApproval(
  mandate: Mandate,
  assumptions: ApprovalAssumption[],
  now: string,
  nonce: string,
  supersedesApprovalId?: string,
): ApprovalRecord {
  const common = {
    id: deterministicId("approval", { mandateId: mandate.id, version: mandate.version, nonce }),
    mandateId: mandate.id,
    mandateVersion: mandate.version,
    mandateVersionDigest: mandateVersionDigest(mandate),
    principalId: mandate.principal.id,
    assumptionHashes: structuredClone(assumptions),
    nonce,
    approvedAt: now,
  };
  return frozenSnapshot(supersedesApprovalId ? { ...common, supersedesApprovalId } : common);
}

export function proposeMandate(mandate: Mandate): Mandate {
  return move(mandate, "PROPOSED");
}

export function requestApproval(mandate: Mandate): Mandate {
  return move(mandate, "AWAITING_APPROVAL");
}

export function approveMandate(
  mandate: Mandate,
  currentAssumptions: ApprovalAssumption[],
  approvingPrincipalId: string,
  now: string,
  nonce: string,
): { mandate: Mandate; approval: ApprovalRecord } {
  if (mandate.status !== "AWAITING_APPROVAL") throw new Error("Only awaiting Mandates can be approved");
  if (approvingPrincipalId !== mandate.principal.id) throw new Error("Principal is not eligible to approve this Mandate");
  assertNotExpired(mandate, now);
  if (!assumptionsMatch(mandate.assumptions, currentAssumptions)) throw new Error("Approval assumptions do not match current state");
  const active = frozenSnapshot({ ...move(mandate, "ACTIVE"), approvedAt: now });
  return { mandate: active, approval: createApproval(active, currentAssumptions, now, nonce) };
}

export function rejectMandate(mandate: Mandate): Mandate {
  if (mandate.status === "PROPOSED") return move(mandate, "REJECTED");
  return move(mandate, "REJECTED");
}

export function suspendMandate(mandate: Mandate): Mandate {
  return move(mandate, "SUSPENDED");
}

export function markAmendmentPending(mandate: Mandate): Mandate {
  return move(mandate, "AMENDMENT_PENDING");
}

export function resumeMandate(
  mandate: Mandate,
  currentAssumptions: ApprovalAssumption[],
  now: string,
  clearance: { noOpenAmendment: boolean; noUnresolvedViolation: boolean },
): Mandate {
  if (mandate.status !== "SUSPENDED") throw new Error("Only suspended Mandates can resume");
  assertNotExpired(mandate, now);
  if (!clearance.noOpenAmendment || !clearance.noUnresolvedViolation) {
    throw new Error("Mandate cannot resume with unresolved governance state");
  }
  if (!assumptionsMatch(mandate.assumptions, currentAssumptions)) {
    throw new Error("Stale approval requires an assumption amendment");
  }
  return move(mandate, "ACTIVE");
}

export function revokeMandate(mandate: Mandate): Mandate {
  return move(mandate, "REVOKED");
}

export function expireMandate(mandate: Mandate, now: string): Mandate {
  if (now < mandate.validity.expiresAt) throw new Error("Mandate is not expired");
  return move(mandate, "EXPIRED");
}

export function assumptionsMatch(expected: ApprovalAssumption[], current: ApprovalAssumption[]): boolean {
  const byKey = new Map(current.map((assumption) => [assumption.key, assumption]));
  if (byKey.size !== current.length) return false;
  return expected.every((assumption) => {
    if (!assumption.invalidatesOnChange) return true;
    return byKey.get(assumption.key)?.valueHash === assumption.valueHash;
  });
}
