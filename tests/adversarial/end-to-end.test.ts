import { describe, expect, it } from "vitest";
import { classifyAction } from "../../packages/effects/src/index.js";
import type { CriterionResult, EvidenceRecord } from "../../packages/protocol/src/index.js";
import { verifyEventChain } from "../../packages/runtime/src/index.js";
import { MandateHarness } from "../../packages/testing/src/index.js";
import { checkoutMandate, databaseAmendment, fixture } from "../helpers.js";

describe("checkout-repair acceptance story", () => {
  it("replans without approval, blocks expansion, accepts rejection, and completes with evidence", () => {
    const draft = checkoutMandate();
    draft.status = "DRAFT";
    delete draft.approvedAt;
    const harness = new MandateHarness(draft, "2026-10-01T00:00:00.000Z");
    harness.propose("2026-10-01T00:00:30.000Z");
    harness.approve("alexa-user-001", "nonce-e2e-001", "2026-10-01T00:01:00.000Z");

    const diagnosticAction = {
      actionId: "action-diagnose",
      tool: "filesystem",
      operation: "readFile",
      inputs: { path: "services/checkout/payments/stripe.ts" },
    };
    expect(harness.runAction(
      diagnosticAction,
      classifyAction(diagnosticAction, { repository: "checkout-demo", environment: "local" }),
      "2026-10-01T00:03:00.000Z",
      () => "diagnosed",
    ).result.decision).toBe("ALLOW");

    let forbiddenCallbackRan = false;
    const migrationAction = {
      actionId: "action-migration",
      tool: "shell",
      operation: "execute",
      inputs: { command: "drizzle-kit push" },
    };
    const denied = harness.runAction(
      migrationAction,
      classifyAction(migrationAction, {
        repository: "checkout-demo",
        environment: "test",
        database: "checkout-db",
      }),
      "2026-10-01T00:05:00.000Z",
      () => { forbiddenCallbackRan = true; },
    );
    expect(denied.result).toMatchObject({ decision: "DENY", amendmentSuggested: true });
    expect(forbiddenCallbackRan).toBe(false);

    harness.requestAmendment(databaseAmendment(), "2026-10-01T00:06:00.000Z");
    harness.rejectPendingAmendment("alexa-user-001", "2026-10-01T00:07:00.000Z");

    let compliantAlternativeRan = false;
    const alternativeAction = {
      actionId: "action-metadata-alternative",
      tool: "filesystem",
      operation: "editFile",
      inputs: { path: "services/checkout/payments/stripe.ts" },
    };
    expect(harness.runAction(
      alternativeAction,
      classifyAction(alternativeAction, { repository: "checkout-demo", environment: "local" }),
      "2026-10-01T00:08:00.000Z",
      () => { compliantAlternativeRan = true; },
    ).result.decision).toBe("ALLOW");
    expect(compliantAlternativeRan).toBe(true);
    expect(harness.approvals).toHaveLength(1);

    const completion = fixture<{
      input: { evidence: EvidenceRecord[]; criterionResults: CriterionResult[] };
    }>("completion-evidence.json").input;
    for (const source of completion.evidence) {
      const { verified: _verified, verifiedBy, ...record } = source;
      harness.addEvidence(record, source.createdAt);
      harness.attestEvidence(source.id, verifiedBy!);
    }
    for (const result of completion.criterionResults) harness.addCriterionResult(result);
    harness.complete("2026-10-01T00:21:00.000Z");

    expect(harness.mandate.status).toBe("COMPLETED");
    expect(verifyEventChain(harness.events)).toBe(true);
    expect(harness.events.some((event) => event.type === "ACTION_DENIED")).toBe(true);
    expect(harness.events.some((event) => event.type === "AMENDMENT_REJECTED")).toBe(true);
  });

  it("rejects replayed approval nonces", () => {
    const draft = checkoutMandate();
    draft.status = "DRAFT";
    delete draft.approvedAt;
    const first = new MandateHarness(draft, "2026-10-01T00:00:00.000Z");
    first.propose("2026-10-01T00:00:30.000Z");
    first.approve("alexa-user-001", "same-nonce", "2026-10-01T00:01:00.000Z");
    expect(() => first.approve("alexa-user-001", "same-nonce", "2026-10-01T00:01:01.000Z"))
      .toThrow();
  });
});
