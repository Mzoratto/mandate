import { createHash } from "node:crypto";

const PRIORITY = Object.freeze(["governance", "task-contract",
  "required-decisions-and-current-evidence", "approved-capabilities", "repository-context", "optional-history"]);
const MANDATORY = PRIORITY.slice(0, -1);
const CHECKSUM = /^sha256:[a-f0-9]{64}$/u;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const MAX_INPUT_BYTES = 262_144;
const MAX_PROTOCOL_BYTES = 3_000_000;
const authority = Object.freeze({ execution: false, modelCall: false });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && same(Object.keys(value).sort(), [...keys].sort());
const checksum = value => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const refused = code => ({ status: "refused", code, prompt: null, tokens: null, evidence: null, authority });

function validIdentity(value) {
  return exactKeys(value, ["id", "version", "checksum"])
    && ID.test(value.id ?? "") && VERSION.test(value.version ?? "") && CHECKSUM.test(value.checksum ?? "");
}

function validTokenizer(value) {
  return exactKeys(value, ["id", "version", "checksum", "count"])
    && validIdentity({ id: value.id, version: value.version, checksum: value.checksum })
    && typeof value.count === "function";
}

function validParts(value, minimum, maximum) {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum
    && value.every(part => typeof part === "string" && part.length > 0);
}

function promptFor(sections, optionalCount) {
  return [...MANDATORY.flatMap(name => sections[name]),
    ...sections["optional-history"].slice(0, optionalCount)].join("\n\n");
}

function protocolFingerprint(resolved) {
  return checksum(JSON.stringify({
    input: resolved.input,
    injectedSkillInstructions: resolved.injectedSkillInstructions.map(item => ({
      name: item.name,
      path: item.path,
      bytes: checksum(item.bytes),
      byteLength: item.bytes.byteLength,
    })),
    runtimeBindingChecksum: resolved.runtimeBindingChecksum,
  }));
}

function validProtocolResolution(value) {
  if (!exactKeys(value, ["status", "code", "input", "injectedSkillInstructions", "runtimeBindingChecksum", "evidence", "authority"])
    || value.status !== "resolved" || value.code !== null || !CHECKSUM.test(value.runtimeBindingChecksum ?? "")
    || !Array.isArray(value.input)
    || value.input.length < 2 || !Array.isArray(value.injectedSkillInstructions)
    || value.injectedSkillInstructions.length !== value.input.length - 1) return false;
  return value.injectedSkillInstructions.every((item, index) => exactKeys(item, ["name", "path", "bytes"])
    && typeof item.name === "string" && typeof item.path === "string"
    && item.bytes instanceof Uint8Array && item.bytes.byteLength > 0
    && value.input[index + 1]?.type === "skill" && value.input[index + 1].name === item.name
    && value.input[index + 1].path === item.path);
}

function resolveProtocol(protocolInput, prompt, driftCheck = false) {
  let value;
  try { value = protocolInput.resolve(prompt); } catch {
    throw Object.assign(new Error("context-protocol-input-unavailable"), { contextCode: driftCheck
      ? "context-protocol-drift" : "context-protocol-input-unavailable" });
  }
  if (!validProtocolResolution(value)) {
    throw Object.assign(new Error("context-protocol-input-unavailable"), { contextCode: driftCheck
      ? "context-protocol-drift" : "context-protocol-input-unavailable" });
  }
  return value;
}

function measuredTokens(tokenizer, framing, toolContext, prompt, protocolInput) {
  const resolved = protocolInput ? resolveProtocol(protocolInput, prompt) : null;
  const measured = resolved ? {
    framing: [...framing],
    toolContext: [...toolContext],
    input: structuredClone(resolved.input),
    injectedSkillInstructions: resolved.injectedSkillInstructions.map(item => ({
      name: item.name, path: item.path, bytes: Uint8Array.from(item.bytes),
    })),
  } : { framing: [...framing], toolContext: [...toolContext], prompt };
  const serializedBytes = Buffer.byteLength(JSON.stringify(resolved
    ? { framing, toolContext, input: resolved.input } : measured), "utf8")
    + (resolved ? resolved.injectedSkillInstructions.reduce((sum, item) => sum + item.bytes.byteLength, 0) : 0);
  if (serializedBytes > (resolved ? MAX_PROTOCOL_BYTES : MAX_INPUT_BYTES)) {
    throw Object.assign(new Error("context-input-oversized"), { contextCode: "context-input-oversized" });
  }
  const value = tokenizer.count(measured);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("token-count-invalid");
  return { tokens: value, resolved, fingerprint: resolved ? protocolFingerprint(resolved) : null };
}

/**
 * Assemble one reviewed model input without estimating tokens or truncating mandatory content.
 * The caller must provide the actual protocol framing and tool context sent to the runtime.
 */
export function assembleGovernorContext({ controls, sections, tokenizer, framing, toolContext, protocolInput }) {
  try {
    if (!controls || !sections || !tokenizer) return refused("context-input-invalid");
    const context = controls.context;
    const budget = controls.budgets?.assembledInputTokens;
    if (!context || !Number.isSafeInteger(budget) || budget < 1 || budget > 16_000
      || !same(context.priorityOrder, PRIORITY) || context.mandatoryOverflow !== "stop"
      || context.unmeasurableUsage !== "stop" || context.includesToolContext !== true
      || context.includesFraming !== true || context.includesCachedInput !== true
      || context.includesReasoningOutput !== true) return refused("context-controls-invalid");
    if (!validIdentity(context.tokenizer) || !validTokenizer(tokenizer)
      || !same(context.tokenizer, { id: tokenizer.id, version: tokenizer.version, checksum: tokenizer.checksum })
    ) return refused("tokenizer-unavailable");
    if (!exactKeys(sections, PRIORITY) || MANDATORY.some(name => !validParts(sections[name], 1, 64))
      || !validParts(sections["optional-history"], 0, 128)
      || !validParts(framing, 1, 64) || !validParts(toolContext, 1, 128)
      || (protocolInput !== undefined
        && (!exactKeys(protocolInput, ["resolve"]) || typeof protocolInput.resolve !== "function"))) {
      return refused("context-sections-invalid");
    }

    const expectedTokenizer = { id: tokenizer.id, version: tokenizer.version, checksum: tokenizer.checksum };
    const tokenizerUnchanged = () => same(context.tokenizer,
      { id: tokenizer.id, version: tokenizer.version, checksum: tokenizer.checksum })
      && same(expectedTokenizer, { id: tokenizer.id, version: tokenizer.version, checksum: tokenizer.checksum });
    const expectedAssemblyBinding = checksum(JSON.stringify({ context, budget, sections, framing, toolContext }));
    const assemblyUnchanged = () => expectedAssemblyBinding
      === checksum(JSON.stringify({ context, budget: controls.budgets?.assembledInputTokens,
        sections, framing, toolContext }));
    const driftCode = protocolInput ? "context-protocol-drift" : "context-usage-unmeasurable";
    const mandatoryPrompt = promptFor(sections, 0);
    let measured = measuredTokens(tokenizer, framing, toolContext, mandatoryPrompt, protocolInput);
    if (!tokenizerUnchanged()) return refused("tokenizer-unavailable");
    if (!assemblyUnchanged()) return refused(driftCode);
    const mandatoryTokens = measured.tokens;
    if (mandatoryTokens > budget) return refused("mandatory-context-overflow");

    let includedOptionalItems = 0;
    let prompt = mandatoryPrompt;
    let tokens = mandatoryTokens;
    let protocolResolution = measured.resolved;
    let protocolResolutionFingerprint = measured.fingerprint;
    for (let count = 1; count <= sections["optional-history"].length; count += 1) {
      const candidate = promptFor(sections, count);
      try { measured = measuredTokens(tokenizer, framing, toolContext, candidate, protocolInput); }
      catch (error) {
        if (error.contextCode === "context-input-oversized") break;
        throw error;
      }
      if (!tokenizerUnchanged()) return refused("tokenizer-unavailable");
      if (!assemblyUnchanged()) return refused(driftCode);
      if (measured.tokens > budget) break;
      prompt = candidate;
      tokens = measured.tokens;
      protocolResolution = measured.resolved;
      protocolResolutionFingerprint = measured.fingerprint;
      includedOptionalItems = count;
    }

    if (protocolInput) {
      const fenced = resolveProtocol(protocolInput, prompt, true);
      if (protocolFingerprint(fenced) !== protocolResolutionFingerprint || !tokenizerUnchanged()
        || !assemblyUnchanged()) return refused("context-protocol-drift");
      protocolResolution = fenced;
    }

    const categoryChecksums = Object.fromEntries(PRIORITY.map(name => [name,
      checksum(JSON.stringify(name === "optional-history"
        ? sections[name].slice(0, includedOptionalItems) : sections[name]))]));
    const measuredInputChecksum = protocolResolutionFingerprint
      ?? checksum(JSON.stringify({ framing, toolContext, prompt }));
    return {
      status: "assembled",
      code: null,
      prompt,
      tokens,
      ...(protocolResolution ? { input: structuredClone(protocolResolution.input) } : {}),
      evidence: {
        tokenizer: expectedTokenizer,
        budget,
        mandatoryTokens,
        includedOptionalItems,
        prunedOptionalItems: sections["optional-history"].length - includedOptionalItems,
        inputChecksum: measuredInputChecksum,
        promptChecksum: checksum(prompt),
        framingChecksum: checksum(JSON.stringify(framing)),
        toolContextChecksum: checksum(JSON.stringify(toolContext)),
        ...(protocolResolution ? {
          protocolRequestChecksum: checksum(JSON.stringify(protocolResolution.input)),
          protocolBindingChecksum: protocolResolution.runtimeBindingChecksum,
          injectedSkillInstructionsChecksum: checksum(JSON.stringify(
            protocolResolution.injectedSkillInstructions.map(item => ({
              name: item.name, path: item.path, checksum: checksum(item.bytes), byteLength: item.bytes.byteLength,
            })))),
        } : {}),
        categoryChecksums,
      },
      authority,
    };
  } catch (error) {
    return refused(error?.contextCode ?? "context-usage-unmeasurable");
  }
}
