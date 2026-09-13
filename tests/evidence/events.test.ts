import { describe, expect, it } from "vitest";
import { appendEvent, verifyEventChain } from "../../packages/runtime/src/index.js";

describe("event ledger", () => {
  it("builds and verifies a hash chain", () => {
    const first = appendEvent([], {
      mandateId: "M-1047",
      mandateVersion: 1,
      type: "MANDATE_CREATED",
      actor: "alexa-user-001",
      payload: {},
      timestamp: "2026-10-01T00:00:00.000Z",
    });
    const second = appendEvent([first], {
      mandateId: "M-1047",
      mandateVersion: 1,
      type: "MANDATE_APPROVED",
      actor: "alexa-user-001",
      payload: { approvalId: "approval-001" },
      timestamp: "2026-10-01T00:01:00.000Z",
    });
    expect(verifyEventChain([first, second])).toBe(true);
    expect(second.previousEventHash).toBe(first.eventHash);
  });

  it("detects payload and chain tampering", () => {
    const event = appendEvent([], {
      mandateId: "M-1047",
      mandateVersion: 1,
      type: "ACTION_DENIED",
      actor: "runtime",
      payload: { reason: "forbidden" },
      timestamp: "2026-10-01T00:10:00.000Z",
    });
    const tampered = { ...event, payload: { reason: "allowed" } };
    expect(verifyEventChain([tampered])).toBe(false);
  });
});
