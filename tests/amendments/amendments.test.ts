import { describe, expect, it } from "vitest";
import {
  amendmentExpandsAuthority,
  approveAmendment,
  rejectAmendment,
} from "../../packages/runtime/src/index.js";
import { checkoutMandate, databaseAmendment } from "../helpers.js";

describe("amendments", () => {
  it("identifies database access as authority expansion", () => {
    expect(amendmentExpandsAuthority(
      checkoutMandate(),
      databaseAmendment(),
      "2026-10-01T00:11:00.000Z",
    )).toBe(true);
  });

  it("approval creates a new immutable active version", () => {
    const base = checkoutMandate();
    base.status = "AMENDMENT_PENDING";
    const oldSnapshot = structuredClone(base);
    const result = approveAmendment(
      base,
      databaseAmendment(),
      base.assumptions,
      "alexa-user-001",
      "2026-10-01T00:11:00.000Z",
      "nonce-amendment-001",
    );

    expect(result.mandate).toMatchObject({ id: "M-1047", version: 2, supersedes: "M-1047@1", status: "ACTIVE" });
    expect(result.approval.mandateVersion).toBe(2);
    expect(result.amendment.status).toBe("APPROVED");
    expect(base).toEqual(oldSnapshot);
  });

  it("rejects stale base versions", () => {
    const base = checkoutMandate();
    base.version = 2;
    base.supersedes = "M-1047@1";
    expect(() => amendmentExpandsAuthority(base, databaseAmendment(), "2026-10-01T00:11:00.000Z"))
      .toThrow("base version is stale");
  });

  it("rejects without changing canonical content", () => {
    const base = checkoutMandate();
    base.status = "AMENDMENT_PENDING";
    const result = rejectAmendment(base, databaseAmendment());
    expect(result.mandate.status).toBe("ACTIVE");
    expect(result.mandate.version).toBe(1);
    expect(result.amendment.status).toBe("REJECTED");
  });
});
