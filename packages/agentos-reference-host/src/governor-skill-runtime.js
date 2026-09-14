import { createHash } from "node:crypto";
import fs from "node:fs";

import { assembleGovernorContext } from "./governor-context.js";
import {
  resolveGovernorExplicitSkillApplicationInput,
  resolveGovernorExplicitSkillProtocolInput,
} from "./governor-skill-invocation.js";

const MAX_PROTOCOL_BYTES = 3_000_000;
const authority = Object.freeze({ execution: false, modelCall: false, skillInvocation: false });
const checksum = value => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const refused = code => ({ status: "refused", code, prompt: null, input: null,
  tokens: null, evidence: null, authority });
const refusedApplication = code => ({ ...refused(code), additionalContext: null });

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode
    && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

/** Read one stable, regular, non-symlink source without exposing filesystem diagnostics. */
export function readGovernorSkillSource(file) {
  let descriptor;
  try {
    if (fs.realpathSync.native(file) !== file) throw new Error("source-path-redirected");
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.size < 1n || before.size > 262_144n) throw new Error("source-type-invalid");
    const bytes = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(file, { bigint: true });
    if (!sameFile(before, after) || !sameFile(after, pathAfter) || pathAfter.isSymbolicLink()) {
      throw new Error("source-drift");
    }
    return bytes;
  } catch {
    throw Object.assign(new Error("skill-source-unavailable"), { retryable: false });
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* A failed close cannot turn a refused read into authority. */ }
    }
  }
}

/**
 * Assemble and exactly measure an explicit app-server skill input, including the
 * instruction bytes app-server would inject. A second resolution fences drift
 * during measurement. This adapter deliberately has no transport or spawn hook.
 */
export function assembleGovernorExplicitSkillContext({ controls, sections, tokenizer, framing,
  toolContext, cwd, selectionEvidence, skillsList, readSkillSource = readGovernorSkillSource } = {}) {
  try {
    const assembled = assembleGovernorContext({
      controls,
      sections,
      tokenizer,
      framing,
      toolContext,
      protocolInput: {
        resolve: prompt => resolveGovernorExplicitSkillProtocolInput({
          cwd,
          prompt,
          selectionEvidence,
          skillsList,
          readSkillSource,
        }),
      },
    });
    if (assembled.status !== "assembled" || !Array.isArray(assembled.input)) {
      return refused(assembled.code ?? "context-protocol-input-unavailable");
    }
    return {
      status: "assembled",
      code: null,
      prompt: assembled.prompt,
      input: assembled.input,
      tokens: assembled.tokens,
      evidence: assembled.evidence,
      authority,
    };
  } catch {
    return refused("context-protocol-input-unavailable");
  }
}

function applicationFingerprint(resolved) {
  return checksum(JSON.stringify({
    input: resolved.input,
    additionalContext: resolved.additionalContext,
    modelVisibleSkillInstructions: resolved.modelVisibleSkillInstructions,
    protocol: resolved.protocol,
    runtimeBindingChecksum: resolved.runtimeBindingChecksum,
  }));
}

function resolveApplicationInput(input, prompt, driftCheck = false) {
  const resolved = resolveGovernorExplicitSkillApplicationInput({ ...input, prompt });
  if (resolved.status !== "resolved" || !Array.isArray(resolved.input)
    || !resolved.additionalContext || !Array.isArray(resolved.modelVisibleSkillInstructions)) {
    throw Object.assign(new Error("context-protocol-input-unavailable"), {
      contextCode: driftCheck ? "context-protocol-drift" : "context-protocol-input-unavailable",
    });
  }
  return resolved;
}

/**
 * Assemble an exact app-server request that carries reviewed skill instructions
 * inline as developer-role application context. This remains a no-send adapter.
 */
export function assembleGovernorExplicitSkillApplicationContext({ controls, sections, tokenizer,
  framing, toolContext, cwd, selectionEvidence, skillsList,
  readSkillSource = readGovernorSkillSource } = {}) {
  try {
    const tokenizerValid = () => tokenizer && typeof tokenizer === "object" && !Array.isArray(tokenizer)
      && JSON.stringify(Object.keys(tokenizer).sort()) === JSON.stringify(["checksum", "count", "id", "version"])
      && typeof tokenizer.count === "function";
    if (!tokenizerValid()) return refusedApplication("tokenizer-unavailable");
    const input = { cwd, selectionEvidence, skillsList, readSkillSource };
    const measured = new Map();
    const measuredTokenizer = {
      get id() { return tokenizerValid() ? tokenizer.id : undefined; },
      get version() { return tokenizerValid() ? tokenizer.version : undefined; },
      get checksum() { return tokenizerValid() ? tokenizer.checksum : undefined; },
      count: value => {
        const resolved = resolveApplicationInput(input, value.prompt);
        const exactInput = {
          framing: value.framing,
          toolContext: value.toolContext,
          input: resolved.input,
          additionalContext: resolved.additionalContext,
          modelVisibleSkillInstructions: resolved.modelVisibleSkillInstructions,
          protocol: resolved.protocol,
        };
        if (Buffer.byteLength(JSON.stringify(exactInput), "utf8") > MAX_PROTOCOL_BYTES) {
          throw Object.assign(new Error("context-input-oversized"), {
            contextCode: "context-input-oversized",
          });
        }
        const tokens = tokenizer.count(exactInput);
        measured.set(checksum(value.prompt), applicationFingerprint(resolved));
        return tokens;
      },
    };
    const assembled = assembleGovernorContext({
      controls, sections, tokenizer: measuredTokenizer, framing, toolContext,
    });
    if (assembled.status !== "assembled") return refusedApplication(assembled.code);

    const resolved = resolveApplicationInput(input, assembled.prompt, true);
    if (measured.get(checksum(assembled.prompt)) !== applicationFingerprint(resolved)) {
      return refusedApplication("context-protocol-drift");
    }
    const requestChecksum = checksum(JSON.stringify({
      input: resolved.input, additionalContext: resolved.additionalContext,
    }));
    const instructionChecksum = checksum(JSON.stringify(resolved.modelVisibleSkillInstructions.map(item => ({
      key: item.key,
      role: item.role,
      contentKind: item.contentKind,
      checksum: checksum(item.text),
      byteLength: Buffer.byteLength(item.text, "utf8"),
    }))));
    return {
      status: "assembled",
      code: null,
      prompt: assembled.prompt,
      input: structuredClone(resolved.input),
      additionalContext: structuredClone(resolved.additionalContext),
      tokens: assembled.tokens,
      evidence: {
        ...assembled.evidence,
        inputChecksum: checksum(JSON.stringify({
          framing, toolContext, requestChecksum, instructionChecksum, protocol: resolved.protocol,
        })),
        protocolRequestChecksum: requestChecksum,
        selectionEvidenceChecksum: checksum(JSON.stringify(selectionEvidence)),
        protocolBindingChecksum: resolved.runtimeBindingChecksum,
        injectedSkillInstructionsChecksum: instructionChecksum,
        protocol: resolved.protocol,
      },
      authority,
    };
  } catch (error) {
    return refusedApplication(error?.contextCode ?? "context-protocol-input-unavailable");
  }
}
