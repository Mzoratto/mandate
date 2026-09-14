import { createHash } from "node:crypto";

import {
  GOVERNOR_SKILL_APPLICATION_CONTEXT_PROTOCOL,
  validGovernorExplicitSkillSelectionEvidence,
} from "./governor-skill-invocation.js";
import { usageSnapshot } from "./usage.js";

const CHECKSUM = /^sha256:[a-f0-9]{64}$/u;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const CONTEXT_CATEGORIES = ["governance", "task-contract", "required-decisions-and-current-evidence",
  "approved-capabilities", "repository-context", "optional-history"];
const CONTEXT_EVIDENCE_KEYS = ["tokenizer", "budget", "mandatoryTokens", "includedOptionalItems",
  "prunedOptionalItems", "inputChecksum", "promptChecksum", "framingChecksum", "toolContextChecksum",
  "protocolRequestChecksum", "protocolBindingChecksum", "injectedSkillInstructionsChecksum",
  "categoryChecksums", "selectionEvidenceChecksum", "protocol"];
const MAX_OUTPUT_BYTES = 1_000_000;
const MAX_CONTEXT_EVIDENCE_BYTES = 100_000;
const authority = Object.freeze({ execution: false, modelCall: false, skillInvocation: false });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && same(Object.keys(value).sort(), [...keys].sort());
const checksum = value => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const refused = code => ({ status: "refused", code, evidence: null, authority });
const boundedId = value => typeof value === "string" && value.length > 0 && value.length <= 256
  && !/[\u0000-\u001f\u007f]/u.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0;

function validContextEvidence(value, selectionEvidenceChecksum) {
  return exactKeys(value, CONTEXT_EVIDENCE_KEYS)
    && exactKeys(value.tokenizer, ["id", "version", "checksum"])
    && ID.test(value.tokenizer.id ?? "") && VERSION.test(value.tokenizer.version ?? "")
    && CHECKSUM.test(value.tokenizer.checksum ?? "")
    && Number.isSafeInteger(value.budget) && value.budget > 0 && value.budget <= 16_000
    && count(value.mandatoryTokens) && value.mandatoryTokens <= value.budget
    && count(value.includedOptionalItems) && count(value.prunedOptionalItems)
    && exactKeys(value.categoryChecksums, CONTEXT_CATEGORIES)
    && Object.values(value.categoryChecksums).every(item => CHECKSUM.test(item ?? ""))
    && [value.inputChecksum, value.promptChecksum, value.framingChecksum, value.toolContextChecksum,
      value.protocolRequestChecksum, value.protocolBindingChecksum,
      value.injectedSkillInstructionsChecksum].every(item => CHECKSUM.test(item ?? ""))
    && value.selectionEvidenceChecksum === selectionEvidenceChecksum
    && same(value.protocol, GOVERNOR_SKILL_APPLICATION_CONTEXT_PROTOCOL);
}

/**
 * Bind selected source identities and exact application-context evidence to one
 * completed app-server turn. This records transport lineage, not instruction compliance.
 */
export function resolveGovernorSkillConsumptionLineage({ selectionEvidence, contextEvidence,
  completion } = {}) {
  try {
    if (!validGovernorExplicitSkillSelectionEvidence(selectionEvidence)) {
      return refused("skill-consumption-selection-invalid");
    }
    const selectionEvidenceChecksum = checksum(JSON.stringify(selectionEvidence));
    let serializedContextEvidence;
    try { serializedContextEvidence = JSON.stringify(contextEvidence); }
    catch { return refused("skill-consumption-context-invalid"); }
    if (!validContextEvidence(contextEvidence, selectionEvidenceChecksum)
      || Buffer.byteLength(serializedContextEvidence ?? "", "utf8") > MAX_CONTEXT_EVIDENCE_BYTES) {
      return refused("skill-consumption-context-invalid");
    }
    if (!exactKeys(completion, ["threadId", "turnId", "status", "output", "usage"])
      || completion.status !== "completed" || !boundedId(completion.threadId)
      || !boundedId(completion.turnId) || typeof completion.output !== "string"
      || completion.output.length === 0 || completion.output.includes("\0")
      || Buffer.byteLength(completion.output, "utf8") > MAX_OUTPUT_BYTES
      || Buffer.from(completion.output, "utf8").toString("utf8") !== completion.output) {
      return refused("skill-consumption-completion-invalid");
    }
    if (!completion.usage || typeof completion.usage !== "object" || Array.isArray(completion.usage)
      || Object.keys(completion.usage).some(key => !["input_tokens", "cached_input_tokens",
        "output_tokens", "reasoning_output_tokens", "raw_total_tokens", "total_tokens"].includes(key))) {
      return refused("skill-consumption-completion-invalid");
    }
    let usage;
    try { usage = usageSnapshot(completion.usage); }
    catch { return refused("skill-consumption-completion-invalid"); }
    if (!usage || usage.input_tokens === undefined) return refused("skill-consumption-completion-invalid");

    const evidence = {
      schemaVersion: 1,
      state: "transport-completed",
      claim: "request-response-lineage-only",
      selected: selectionEvidence.selected.map(({ name, version, checksum: sourceChecksum }) => ({
        name, version, checksum: sourceChecksum,
      })),
      selectionEvidenceChecksum,
      contextEvidenceChecksum: checksum(serializedContextEvidence),
      protocol: GOVERNOR_SKILL_APPLICATION_CONTEXT_PROTOCOL,
      protocolRequestChecksum: contextEvidence.protocolRequestChecksum,
      protocolBindingChecksum: contextEvidence.protocolBindingChecksum,
      injectedSkillInstructionsChecksum: contextEvidence.injectedSkillInstructionsChecksum,
      threadChecksum: checksum(completion.threadId),
      turnChecksum: checksum(completion.turnId),
      outputChecksum: checksum(completion.output),
      outputByteLength: Buffer.byteLength(completion.output, "utf8"),
      usageChecksum: checksum(JSON.stringify(usage)),
    };
    evidence.lineageChecksum = checksum(JSON.stringify(evidence));
    return { status: "resolved", code: null, evidence, authority };
  } catch {
    return refused("skill-consumption-unmeasurable");
  }
}

/** Convert the three pinned app-server terminal notifications into one lineage receipt. */
export function resolveGovernorSkillAppServerConsumptionLineage({ selectionEvidence, contextEvidence,
  threadId, turnId, notifications } = {}) {
  try {
    const methods = ["item/completed", "thread/tokenUsage/updated", "turn/completed"];
    if (!boundedId(threadId) || !boundedId(turnId) || !Array.isArray(notifications)
      || notifications.length !== methods.length || notifications.at(-1)?.method !== "turn/completed"
      || notifications.some(item => !exactKeys(item, ["method", "params", "emittedAtMs"])
        || !count(item.emittedAtMs) || !methods.includes(item.method)
        || !item.params || typeof item.params !== "object"
        || Array.isArray(item.params))) return refused("skill-consumption-app-server-invalid");
    const byMethod = new Map(notifications.map(item => [item.method, item.params]));
    if (byMethod.size !== methods.length) return refused("skill-consumption-app-server-invalid");
    const [message, tokenUsage, completed] = methods.map(method => byMethod.get(method));
    if (message.threadId !== threadId || message.turnId !== turnId
      || message.item?.type !== "agentMessage"
      || tokenUsage.threadId !== threadId || tokenUsage.turnId !== turnId
      || completed.threadId !== threadId || completed.turn?.id !== turnId) {
      return refused("skill-consumption-app-server-invalid");
    }
    const total = tokenUsage.tokenUsage?.total;
    return resolveGovernorSkillConsumptionLineage({
      selectionEvidence,
      contextEvidence,
      completion: {
        threadId,
        turnId,
        status: completed.turn.status,
        output: message.item.text,
        usage: {
          input_tokens: total?.inputTokens,
          cached_input_tokens: total?.cachedInputTokens,
          output_tokens: total?.outputTokens,
          reasoning_output_tokens: total?.reasoningOutputTokens,
          raw_total_tokens: total?.totalTokens,
        },
      },
    });
  } catch {
    return refused("skill-consumption-app-server-invalid");
  }
}
