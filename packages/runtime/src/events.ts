import {
  deterministicId,
  eventDigest,
  type MandateEvent,
} from "@mandate/protocol";

export const mandateEventTypes = [
  "MANDATE_CREATED",
  "MANDATE_PROPOSED",
  "MANDATE_APPROVAL_REQUESTED",
  "MANDATE_APPROVED",
  "MANDATE_REJECTED",
  "MANDATE_ACTIVATED",
  "ACTION_PROPOSED",
  "EFFECT_CLASSIFIED",
  "ACTION_ALLOWED",
  "ACTION_DENIED",
  "ACTION_ESCALATED",
  "ACTION_EXECUTED",
  "AUTHORITY_CONTRACTED",
  "CHILD_MANDATE_CREATED",
  "AMENDMENT_REQUESTED",
  "AMENDMENT_APPROVED",
  "AMENDMENT_REJECTED",
  "APPROVAL_INVALIDATED",
  "MANDATE_SUSPENDED",
  "MANDATE_RESUMED",
  "EVIDENCE_ADDED",
  "CRITERION_VERIFIED",
  "MANDATE_COMPLETED",
  "MANDATE_REVOKED",
  "MANDATE_EXPIRED",
] as const;

export type MandateEventType = (typeof mandateEventTypes)[number];

export interface AppendEventInput {
  mandateId: string;
  mandateVersion: number;
  type: MandateEventType;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export function appendEvent(history: readonly MandateEvent[], input: AppendEventInput): MandateEvent {
  const previous = history.at(-1);
  if (previous && previous.mandateId !== input.mandateId) {
    throw new Error("Cannot chain events from different Mandates");
  }
  const previousEventHash = previous?.eventHash;
  if (previous && !previousEventHash) throw new Error("Previous event has no hash");
  const identity = previousEventHash ? { ...input, previousEventHash } : input;
  const base = {
    id: deterministicId("event", identity),
    ...structuredClone(input),
  };
  const unhashed: Omit<MandateEvent, "eventHash"> = previousEventHash
    ? { ...base, previousEventHash }
    : base;
  return { ...unhashed, eventHash: eventDigest(unhashed) };
}

export function verifyEventChain(history: readonly MandateEvent[]): boolean {
  let previous: string | undefined;
  for (const event of history) {
    if (event.previousEventHash !== previous || !event.eventHash) return false;
    const { eventHash, ...unhashed } = event;
    if (eventDigest(unhashed) !== eventHash) return false;
    previous = eventHash;
  }
  return true;
}
