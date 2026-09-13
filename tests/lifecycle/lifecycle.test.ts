import { describe, expect, it } from "vitest";
import { mandateVersionDigest } from "../../packages/protocol/src/index.js";
import {
  approveMandate,
  proposeMandate,
  requestApproval,
  revokeMandate,
  resumeMandate,
  suspendMandate,
} from "../../packages/runtime/src/index.js";
import { checkoutMandate } from "../helpers.js";

function draftMandate() {
  const mandate = structuredClone(checkoutMandate());
  mandate.status = "DRAFT";
  delete mandate.approvedAt;
  return mandate;
}

describe("Mandate lifecycle", () => {
  it("creates, proposes, approves, and binds an immutable version digest", () => {
    const draft = draftMandate();
    const digest = mandateVersionDigest(draft);
    const awaiting = requestApproval(proposeMandate(draft));
    const { mandate, approval } = approveMandate(
      awaiting,
      awaiting.assumptions,
      "alexa-user-001",
      "2026-10-01T00:01:00.000Z",
      "nonce-001",
    );

    expect(mandate.status).toBe("ACTIVE");
    expect(approval.mandateVersionDigest).toBe(digest);
    expect(mandateVersionDigest(mandate)).toBe(digest);
    expect(Object.isFrozen(mandate)).toBe(true);
    expect(Object.isFrozen(mandate.authority.allowedEffects)).toBe(true);
    expect(() => { mandate.goal.statement = "Mutated"; }).toThrow();
    expect(draft.status).toBe("DRAFT");
  });

  it("rejects approval by the wrong principal", () => {
    const awaiting = requestApproval(proposeMandate(draftMandate()));
    expect(() => approveMandate(
      awaiting,
      awaiting.assumptions,
      "another-user",
      "2026-10-01T00:01:00.000Z",
      "nonce-wrong-principal",
    )).toThrow("not eligible");
  });

  it("rejects illegal and terminal transitions", () => {
    expect(() => proposeMandate(checkoutMandate())).toThrow("Illegal Mandate transition");
    const revoked = revokeMandate(checkoutMandate());
    expect(() => suspendMandate(revoked)).toThrow("Illegal Mandate transition");
  });

  it("will not use resume to bypass amendment review", () => {
    const pending = { ...checkoutMandate(), status: "AMENDMENT_PENDING" as const };
    expect(() => resumeMandate(
      pending,
      pending.assumptions,
      "2026-10-01T00:10:00.000Z",
      { noOpenAmendment: false, noUnresolvedViolation: true },
    )).toThrow("Only suspended Mandates can resume");
  });

  it("will not resume against changed protected assumptions", () => {
    const suspended = suspendMandate(checkoutMandate());
    const changed = suspended.assumptions.map((assumption) => ({
      ...assumption,
      valueHash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    }));
    expect(() => resumeMandate(
      suspended,
      changed,
      "2026-10-01T00:10:00.000Z",
      { noOpenAmendment: true, noUnresolvedViolation: true },
    )).toThrow("Stale approval requires an assumption amendment");
  });
});
