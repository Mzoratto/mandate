import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

const decisions = new Set(["ALLOW", "DENY", "ESCALATE", "INVALIDATE_APPROVAL"]);
const changeKinds = new Set(["add", "delete", "update"]);

export const mandateInterceptedRunnerCapabilities = Object.freeze({
  isolatedWorktree: true,
  beforeActionInterception: true,
  stopOnDenial: true,
  evidenceCallbacks: true,
});

const effect = (type, resources, reversible, confidence = 1, environment = "local") => ({
  type,
  resources,
  environment,
  reversible,
  confidence,
});

function repositoryResource(repository, relativePath) {
  return relativePath ? `repository://${repository}/${relativePath}` : `repository://${repository}`;
}

function relativeFile(cwd, file) {
  if (typeof cwd !== "string" || !path.isAbsolute(cwd) || typeof file !== "string") {
    throw new Error("mandate-interceptor-request-invalid");
  }
  const relative = path.relative(cwd, path.resolve(cwd, file)).split(path.sep).join("/");
  if (!relative || relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error("mandate-interceptor-request-invalid");
  }
  return relative;
}

function fileEffect(repository, relative, kind) {
  const resource = repositoryResource(repository, relative);
  const reversible = kind !== "delete";
  if (/(^|\/)\.env(?:\.|$)|(^|\/)(secrets?|credentials?)(\/|$)/iu.test(relative)) {
    return effect("SECRET_WRITE", [resource], reversible);
  }
  if (/(^|\/)(migrations?|schema)(\/|\.|$)/iu.test(relative)) {
    return effect("DATABASE_SCHEMA_MUTATION", [resource], reversible);
  }
  if (/(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/u.test(relative)) {
    return effect("DEPENDENCY_MODIFICATION", [resource], reversible);
  }
  if (relative.startsWith("tests/") || /(?:^|\/)__tests__\//u.test(relative)
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(relative)) {
    return effect("TEST_MODIFICATION", [resource], reversible);
  }
  return effect("CODE_MODIFICATION", [resource], reversible);
}

function commandEffects(command) {
  const normalized = command.toLowerCase();
  const effects = [effect("LOCAL_COMMAND_EXECUTION", [], false, 0)];
  if (/\b(alter|create|drop)\s+(table|index|schema)\b|\b(migrate|migration|drizzle-kit push)\b/u.test(normalized)) {
    effects.push(effect("DATABASE_SCHEMA_MUTATION", [], false));
  }
  if (/\b(deploy|promote|release)\b/u.test(normalized) && /\b(prod|production)\b/u.test(normalized)) {
    effects.push(effect("PRODUCTION_DEPLOYMENT", [], false, 1, "production"));
  }
  if (/\b(curl|wget|ssh|scp|npm\s+(install|publish)|pnpm\s+(add|install|publish))\b/u.test(normalized)) {
    effects.push(effect("NETWORK_REQUEST", [], false));
  }
  return effects;
}

function proposedAction({ taskId, turnId, itemId, requestType, details, cwd, repository }) {
  const actionId = `${taskId}:${turnId}:${itemId}`;
  if (requestType === "command") {
    if (typeof details?.command !== "string" || !details.command.trim()) {
      throw new Error("mandate-interceptor-request-invalid");
    }
    return {
      action: { actionId, tool: "shell", operation: "execute", inputs: { command: details.command } },
      effects: commandEffects(details.command),
    };
  }
  if (requestType === "file") {
    if (!Array.isArray(details?.changes) || !details.changes.length) {
      throw new Error("mandate-interceptor-request-invalid");
    }
    const changes = details.changes.map((change) => {
      const kind = change?.kind?.type;
      if (!changeKinds.has(kind)) throw new Error("mandate-interceptor-request-invalid");
      const movePath = change.kind.move_path == null ? undefined : relativeFile(cwd, change.kind.move_path);
      return { path: relativeFile(cwd, change.path), kind, ...(movePath ? { movePath } : {}) };
    });
    return {
      action: { actionId, tool: "filesystem", operation: "applyChanges", inputs: { changes } },
      effects: changes.flatMap((change) => change.movePath
        ? [fileEffect(repository, change.path, "delete"), fileEffect(repository, change.movePath, "add")]
        : [fileEffect(repository, change.path, change.kind)]),
    };
  }
  throw new Error("mandate-interceptor-request-invalid");
}

function validateConformance(result) {
  if (!result || !decisions.has(result.decision) || !Array.isArray(result.reasons)
    || !result.reasons.every((value) => typeof value === "string")
    || !Array.isArray(result.violatedRules)
    || !result.violatedRules.every((value) => typeof value === "string")) {
    throw new Error("mandate-interceptor-result-invalid");
  }
}

export function createMandateActionInterceptor({
  mandateId,
  mandateVersion,
  repository,
  beforeAction,
  publishEvidence,
  createId = randomUUID,
  now = () => new Date().toISOString(),
}) {
  if (typeof mandateId !== "string" || !mandateId || !Number.isSafeInteger(mandateVersion)
    || mandateVersion < 1 || typeof repository !== "string" || !repository
    || typeof beforeAction !== "function" || typeof publishEvidence !== "function"
    || typeof createId !== "function" || typeof now !== "function") {
    throw new Error("mandate-interceptor-configuration-invalid");
  }

  const seenActions = new Set();
  const allowedReceipts = new WeakSet();
  return Object.freeze({
    capabilities: mandateInterceptedRunnerCapabilities,
    async beforeAction(request) {
      if (typeof request?.taskId !== "string" || !request.taskId || typeof request.turnId !== "string" || !request.turnId
        || typeof request.itemId !== "string" || !request.itemId) {
        throw new Error("mandate-interceptor-request-invalid");
      }
      const normalized = proposedAction({ ...request, repository });
      if (seenActions.has(normalized.action.actionId)) throw new Error("mandate-interceptor-action-replayed");
      seenActions.add(normalized.action.actionId);
      const result = await beforeAction(normalized.action, normalized.effects);
      validateConformance(result);
      const receipt = Object.freeze({
        actionId: normalized.action.actionId,
        taskId: request.taskId,
        itemId: request.itemId,
        decision: result.decision,
        reasonCount: result.reasons.length,
        violatedRuleCount: result.violatedRules.length,
        effectTypes: Object.freeze(normalized.effects.map(({ type }) => type)),
      });
      if (receipt.decision === "ALLOW") allowedReceipts.add(receipt);
      return receipt;
    },
    async afterAction(receipt) {
      if (!receipt || receipt.decision !== "ALLOW" || !allowedReceipts.has(receipt)) {
        throw new Error("mandate-interceptor-evidence-invalid");
      }
      allowedReceipts.delete(receipt);
      const createdAt = now();
      const evidenceId = createId();
      if (typeof createdAt !== "string" || !createdAt || typeof evidenceId !== "string" || !evidenceId) {
        throw new Error("mandate-interceptor-evidence-invalid");
      }
      const digest = `sha256:${createHash("sha256").update(JSON.stringify({
        actionId: receipt.actionId,
        decision: receipt.decision,
        effectTypes: receipt.effectTypes,
        status: "completed",
      })).digest("hex")}`;
      await publishEvidence({
        id: evidenceId,
        mandateId,
        mandateVersion,
        executionActionId: receipt.actionId,
        type: "trace",
        producer: "agentos",
        artifactUri: `agentos://tasks/${encodeURIComponent(receipt.taskId)}/actions/${encodeURIComponent(receipt.actionId)}`,
        digest,
        createdAt,
      });
    },
  });
}
