import { describe, expect, it } from "vitest";
import {
  completeMandate,
  evaluateCompletion,
  ingestEvidence,
  type CompletionInput,
} from "../../packages/evidence/src/index.js";
import type { CriterionResult, EvidenceRecord } from "../../packages/protocol/src/index.js";
import { checkoutMandate, fixture } from "../helpers.js";

function completionInput(): CompletionInput {
  const data = fixture<{
    input: Omit<CompletionInput, "mandate"> & { mandateFixture: string };
  }>("completion-evidence.json").input;
  const { mandateFixture: _fixture, ...input } = data;
  return { ...input, mandate: checkoutMandate() };
}

describe("evidence-gated completion", () => {
  it("completes only with all canonical evidence and criteria", () => {
    const input = completionInput();
    expect(evaluateCompletion(input)).toEqual({ canComplete: true, reasons: [] });
    expect(completeMandate(input)).toMatchObject({ status: "COMPLETED", completedAt: input.now });
  });

  it("rejects unverified required evidence", () => {
    const input = completionInput();
    input.evidence[0]!.verified = false;
    expect(evaluateCompletion(input)).toMatchObject({ canComplete: false });
  });

  it("uses the latest criterion result", () => {
    const input = completionInput();
    const prior = input.criterionResults.find((result) => result.criterionId === "checkout-tests")!;
    input.criterionResults.push({
      ...prior,
      status: "FAIL",
      verifiedAt: "2026-10-01T00:20:00.000Z",
    });
    expect(evaluateCompletion(input).reasons).toContain("Required criterion checkout-tests has no current verified pass");
  });

  it("does not trust agent-supplied verification state during ingestion", () => {
    const source = completionInput().evidence[0]!;
    const untrusted = { ...source, verified: true, verifiedBy: "agentos-checkout" } as EvidenceRecord;
    const ingested = ingestEvidence(untrusted);
    expect(ingested.verified).toBe(false);
    expect(ingested.verifiedBy).toBeUndefined();
  });

  it("requires criterion evidence from the configured verifier", () => {
    const input = completionInput();
    const evidence = input.evidence.find((record) => record.id === "evidence-tests-001")!;
    evidence.verifiedBy = "verifier:other";
    expect(evaluateCompletion(input).canComplete).toBe(false);
    expect(evaluateCompletion(input).reasons.some((reason) => reason.includes("from its verifier"))).toBe(true);
  });

  it("does not accept criteria or evidence from another version", () => {
    const input = completionInput();
    input.evidence = input.evidence.map((record): EvidenceRecord => ({ ...record, mandateVersion: 2 }));
    input.criterionResults = input.criterionResults.map((result): CriterionResult => ({ ...result, mandateVersion: 2 }));
    expect(evaluateCompletion(input).canComplete).toBe(false);
  });
});
