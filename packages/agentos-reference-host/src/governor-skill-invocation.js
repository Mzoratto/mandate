import { createHash } from "node:crypto";
import path from "node:path";
import { TextDecoder } from "node:util";

const CHECKSUM = /^sha256:[a-f0-9]{64}$/u;
const ID = /^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const SCOPES = new Set(["user", "repo", "system", "admin"]);
const MAX_SKILLS = 128;
const MAX_SELECTIONS = 8;
const MAX_SKILL_BYTES = 262_144;
const MAX_PROMPT_BYTES = 1_000_000;
const MAX_APPLICATION_CONTEXT_VALUE_BYTES = 4_000;
const MAX_APPLICATION_CONTEXT_ENTRIES = 128;
const authority = Object.freeze({ execution: false, modelCall: false, skillInvocation: false });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && same(Object.keys(value).sort(), [...keys].sort());
const checksum = value => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const refused = code => ({ status: "refused", code, input: null, evidence: null, authority });
const applicationContextContract = Object.freeze({
  appServerVersion: "0.152.1",
  sourceRevision: "5adb68a49933ae446bf11935662c83dba55a0804",
  requestField: "turn/start.additionalContext",
  requiresExperimentalApi: true,
  kind: "application",
  modelRole: "developer",
  ordering: "key-ascending",
  wrapper: "<key>value</key>",
  appServerValueTokenLimit: 1_000,
  appServerApproxBytesPerToken: 4,
  valueByteLimit: MAX_APPLICATION_CONTEXT_VALUE_BYTES,
});
export const GOVERNOR_SKILL_APPLICATION_CONTEXT_PROTOCOL = Object.freeze({
  id: "codex-additional-context",
  version: applicationContextContract.appServerVersion,
  checksum: checksum(JSON.stringify(applicationContextContract)),
});
const resolvedEvidence = (selectionEvidence, input) => ({
  schemaVersion: 1,
  mode: "explicit",
  selectedCount: selectionEvidence.selected.length,
  selected: selectionEvidence.selected.map(({ name, version, checksum: contentChecksum }) => (
    { name, version, checksum: contentChecksum }
  )),
  requestChecksum: checksum(JSON.stringify(input)),
});

function validSelectedSkill(value) {
  return exactKeys(value, ["name", "version", "checksum", "reason"])
    && ID.test(value.name ?? "") && VERSION.test(value.version ?? "")
    && CHECKSUM.test(value.checksum ?? "") && value.reason === "explicit-request";
}

function validMatcher(value) {
  return exactKeys(value, ["id", "version", "checksum"])
    && ID.test(value.id ?? "") && VERSION.test(value.version ?? "")
    && CHECKSUM.test(value.checksum ?? "");
}

export function validGovernorExplicitSkillSelectionEvidence(value) {
  if (!exactKeys(value, ["matcher", "catalogChecksum", "observationChecksum", "decision",
    "candidateCount", "selected"])
    || value.decision !== "explicit" || !validMatcher(value.matcher)
    || !CHECKSUM.test(value.catalogChecksum ?? "")
    || !CHECKSUM.test(value.observationChecksum ?? "") || !Array.isArray(value.selected)
    || value.selected.length === 0 || value.selected.length > MAX_SELECTIONS
    || value.candidateCount !== value.selected.length || !value.selected.every(validSelectedSkill)) return false;
  const names = value.selected.map(skill => skill.name);
  return names.every((name, index) => index === 0 || names[index - 1] < name);
}

const metadataKeys = new Set(["name", "description", "enabled", "path", "scope",
  "interface", "dependencies", "pluginId", "shortDescription"]);

function validSkillMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !metadataKeys.has(key))
    || !["name", "description", "enabled", "path", "scope"].every(key => Object.hasOwn(value, key))
    || !ID.test(value.name ?? "") || typeof value.description !== "string"
    || value.description.length > 16_000 || typeof value.enabled !== "boolean"
    || typeof value.path !== "string" || !path.isAbsolute(value.path)
    || path.normalize(value.path) !== value.path || path.basename(value.path) !== "SKILL.md"
    || !SCOPES.has(value.scope)) return false;
  if (value.pluginId != null && typeof value.pluginId !== "string") return false;
  if (value.shortDescription != null && typeof value.shortDescription !== "string") return false;
  if (value.interface != null && (typeof value.interface !== "object" || Array.isArray(value.interface))) return false;
  if (value.dependencies != null && (typeof value.dependencies !== "object" || Array.isArray(value.dependencies))) return false;
  return true;
}

export function validGovernorSkillDiscovery(cwd, value) {
  if (!exactKeys(value, ["data"]) || !Array.isArray(value.data) || value.data.length !== 1) return false;
  const entry = value.data[0];
  if (!exactKeys(entry, ["cwd", "errors", "skills"]) || entry.cwd !== cwd
    || !Array.isArray(entry.errors) || entry.errors.length !== 0
    || !Array.isArray(entry.skills) || entry.skills.length > MAX_SKILLS
    || !entry.skills.every(validSkillMetadata)) return false;
  const names = entry.skills.map(skill => skill.name);
  const paths = entry.skills.map(skill => skill.path);
  return new Set(names).size === names.length && new Set(paths).size === paths.length;
}

function applicationContextChunks(source) {
  const bytes = Buffer.from(source);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("source-not-utf8");
  const chunks = [];
  for (let start = 0; start < bytes.length;) {
    let end = Math.min(start + MAX_APPLICATION_CONTEXT_VALUE_BYTES, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    if (end <= start) throw new Error("source-chunk-invalid");
    chunks.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return chunks;
}

function resolveExplicitSkillTurn({ cwd, prompt, selectionEvidence, skillsList,
  readSkillSource }, mode) {
  try {
    if (typeof cwd !== "string" || !path.isAbsolute(cwd) || path.normalize(cwd) !== cwd
      || typeof prompt !== "string" || prompt.length === 0 || prompt.includes("\0")
      || Buffer.byteLength(prompt) > MAX_PROMPT_BYTES || typeof readSkillSource !== "function"
      || !validGovernorExplicitSkillSelectionEvidence(selectionEvidence)) return refused("skill-invocation-input-invalid");
    if (!validGovernorSkillDiscovery(cwd, skillsList)) return refused("skill-invocation-discovery-invalid");

    const discovered = new Map(skillsList.data[0].skills.map(skill => [skill.name, skill]));
    const items = [];
    const injectedSkillInstructions = [];
    const additionalContext = {};
    const modelVisibleSkillInstructions = [];
    for (const [skillIndex, selected] of selectionEvidence.selected.entries()) {
      const skill = discovered.get(selected.name);
      if (!skill?.enabled) return refused("skill-invocation-unavailable");
      let source;
      try { source = readSkillSource(skill.path); } catch { return refused("skill-invocation-source-unavailable"); }
      if (!(source instanceof Uint8Array) || source.byteLength === 0 || source.byteLength > MAX_SKILL_BYTES) {
        return refused("skill-invocation-source-mismatch");
      }
      const sourceSnapshot = Uint8Array.from(source);
      if (checksum(sourceSnapshot) !== selected.checksum) return refused("skill-invocation-source-mismatch");
      if (mode === "application") {
        let chunks;
        try { chunks = applicationContextChunks(sourceSnapshot); }
        catch { return refused("skill-invocation-source-mismatch"); }
        if (Object.keys(additionalContext).length + chunks.length > MAX_APPLICATION_CONTEXT_ENTRIES) {
          return refused("skill-invocation-input-oversized");
        }
        for (const [chunkIndex, value] of chunks.entries()) {
          const safeName = selected.name.replace(/[-_:]/gu, "_");
          const key = `agentos_skill_${String(skillIndex + 1).padStart(3, "0")}_${safeName}_${String(chunkIndex + 1).padStart(3, "0")}`;
          additionalContext[key] = { value, kind: "application" };
          modelVisibleSkillInstructions.push({
            key,
            role: "developer",
            contentKind: `additional_content.${key}`,
            text: `<${key}>${value}</${key}>`,
          });
        }
      } else {
        items.push({ type: "skill", name: selected.name, path: skill.path });
        if (mode === "protocol") injectedSkillInstructions.push({
          name: selected.name,
          path: skill.path,
          bytes: sourceSnapshot,
        });
      }
    }

    const marker = selectionEvidence.selected.map(skill => `$${skill.name}`).join(" ");
    const text = mode === "application" ? prompt : `${marker}\n\n${prompt}`;
    const input = [{ type: "text", text, text_elements: [] }, ...items];
    const request = mode === "application" ? { input, additionalContext } : input;
    return {
      status: "resolved",
      code: null,
      input,
      ...(mode === "protocol" ? {
        injectedSkillInstructions,
        runtimeBindingChecksum: checksum(JSON.stringify({ selectionEvidence, skillsList })),
      } : {}),
      ...(mode === "application" ? {
        additionalContext,
        modelVisibleSkillInstructions,
        protocol: GOVERNOR_SKILL_APPLICATION_CONTEXT_PROTOCOL,
        runtimeBindingChecksum: checksum(JSON.stringify({
          selectionEvidence, skillsList, protocol: GOVERNOR_SKILL_APPLICATION_CONTEXT_PROTOCOL, request,
        })),
      } : {}),
      evidence: resolvedEvidence(selectionEvidence, request),
      authority,
    };
  } catch {
    return refused("skill-invocation-unmeasurable");
  }
}

/**
 * Build the exact documented Codex app-server input for a reviewed explicit skill request.
 * This validates request bytes only; it does not send the request or prove instruction loading.
 */
export function buildGovernorExplicitSkillTurn(input = {}) {
  return resolveExplicitSkillTurn(input, "request");
}

/**
 * Resolve the same request together with private instruction bytes for protocol-aware measurement.
 * The returned instruction bytes are runtime material and must never be persisted as evidence.
 */
export function resolveGovernorExplicitSkillProtocolInput(input = {}) {
  return resolveExplicitSkillTurn(input, "protocol");
}

/**
 * Inline checksum-matched instruction bytes in bounded app-server application context.
 * No path-bearing skill item remains for app-server to resolve after request validation.
 */
export function resolveGovernorExplicitSkillApplicationInput(input = {}) {
  return resolveExplicitSkillTurn(input, "application");
}
