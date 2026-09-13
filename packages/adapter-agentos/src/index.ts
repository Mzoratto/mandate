import { isAbsolute } from "node:path";
import type {
  ConformanceResult,
  EvidenceRecord,
  Mandate,
  NormalizedEffect,
  ProposedAction,
} from "@mandate/protocol";

export interface AgentOsCapabilities {
  isolatedWorktree: boolean;
  beforeActionInterception: boolean;
  stopOnDenial: boolean;
  evidenceCallbacks: boolean;
}

export interface AgentOsTaskRequest {
  externalId: string;
  title: string;
  description: string;
  repository: string;
  includePaths: string[];
  excludePaths: string[];
  maxMinutes?: number;
  maxTokens?: number;
  dryRun: boolean;
  metadata: {
    mandateId: string;
    mandateVersion: number;
  };
}

export type AgentOsEvidenceRecord = Omit<EvidenceRecord, "verified" | "verifiedBy"> & {
  executionActionId: string;
};

export interface AgentOsBridge {
  capabilities(): Promise<AgentOsCapabilities>;
  createTask(request: AgentOsTaskRequest): Promise<{ taskId: string; worktree: string }>;
  runTask(input: {
    taskId: string;
    beforeAction: (action: ProposedAction, effects: NormalizedEffect[]) => Promise<ConformanceResult>;
    publishEvidence: (evidence: AgentOsEvidenceRecord) => Promise<void>;
  }): Promise<void>;
  stopTask(taskId: string): Promise<void>;
}

export interface AgentOsSettlement {
  outcome: "SUCCEEDED" | "FAILED";
  usage: {
    monetarySpentUsd: number;
    tokensUsed: number;
  };
}

export interface AgentOsControlPlaneOptions {
  baseUrl: string;
  credential: string;
  executionId: string;
  mandateVersionDigest: string;
  settlement: (
    evidence: AgentOsEvidenceRecord,
  ) => AgentOsSettlement | Promise<AgentOsSettlement>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function requiredRepositoryScope(mandate: Mandate) {
  const repositories = mandate.scope.resources.filter((scope) => scope.kind === "repository");
  if (repositories.length !== 1) throw new Error("AgentOS v0.1 requires exactly one repository scope");
  return repositories[0]!;
}

export function mandateToAgentOsTask(
  mandate: Mandate,
  dryRun: boolean,
  resolveRepository: (resource: string) => string,
): AgentOsTaskRequest {
  if (mandate.status !== "ACTIVE") throw new Error("AgentOS tasks require an active Mandate");
  const repository = requiredRepositoryScope(mandate);
  const repositoryPath = resolveRepository(repository.resource);
  if (!isAbsolute(repositoryPath)) throw new Error("AgentOS repository resolution must produce an absolute path");
  const request: AgentOsTaskRequest = {
    externalId: `${mandate.id}@${mandate.version}`,
    title: mandate.goal.statement.slice(0, 120),
    description: mandate.goal.statement,
    repository: repositoryPath,
    includePaths: structuredClone(repository.include ?? ["**"]),
    excludePaths: structuredClone(repository.exclude ?? []),
    dryRun,
    metadata: { mandateId: mandate.id, mandateVersion: mandate.version },
  };
  if (mandate.limits.maxExecutionSeconds !== undefined) {
    request.maxMinutes = Math.max(1, Math.ceil(mandate.limits.maxExecutionSeconds / 60));
  }
  if (mandate.limits.tokenBudget !== undefined) request.maxTokens = mandate.limits.tokenBudget;
  return request;
}

export function assertGovernedAgentOsCapabilities(capabilities: AgentOsCapabilities): void {
  const missing = Object.entries(capabilities)
    .filter(([, enabled]) => !enabled)
    .map(([name]) => name);
  if (missing.length) throw new Error(`AgentOS governed execution unavailable: ${missing.join(", ")}`);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function conformanceResult(value: unknown, expectedVersionDigest: string): ConformanceResult {
  if (
    !record(value)
    || !["ALLOW", "DENY", "ESCALATE", "INVALIDATE_APPROVAL"].includes(value.decision as string)
    || !stringArray(value.reasons)
    || !stringArray(value.violatedRules)
    || value.mandateVersionDigest !== expectedVersionDigest
    || (value.amendmentSuggested !== undefined && typeof value.amendmentSuggested !== "boolean")
  ) {
    throw new Error("Mandate control plane returned an invalid authorization result");
  }
  return {
    decision: value.decision as ConformanceResult["decision"],
    reasons: value.reasons,
    violatedRules: value.violatedRules,
    ...(value.amendmentSuggested === undefined ? {} : { amendmentSuggested: value.amendmentSuggested }),
  };
}

function validSettlement(value: AgentOsSettlement): boolean {
  const micros = value.usage.monetarySpentUsd * 1_000_000;
  return ["SUCCEEDED", "FAILED"].includes(value.outcome)
    && Number.isFinite(value.usage.monetarySpentUsd)
    && value.usage.monetarySpentUsd >= 0
    && Number.isSafeInteger(Math.round(micros))
    && Math.abs(micros - Math.round(micros)) < 1e-7
    && Number.isSafeInteger(value.usage.tokensUsed)
    && value.usage.tokensUsed >= 0;
}

export function createAgentOsControlPlaneHandlers(options: AgentOsControlPlaneOptions): {
  beforeAction: (action: ProposedAction, effects: NormalizedEffect[]) => Promise<ConformanceResult>;
  publishEvidence: (evidence: AgentOsEvidenceRecord) => Promise<void>;
} {
  const baseUrl = new URL(options.baseUrl);
  if (
    baseUrl.protocol !== "https:"
    || baseUrl.username
    || baseUrl.password
    || baseUrl.pathname !== "/"
    || baseUrl.search
    || baseUrl.hash
  ) {
    throw new Error("Mandate control-plane URL must be an HTTPS origin without credentials or query data");
  }
  if (typeof options.credential !== "string" || !/^[\x21-\x7e]{32,512}$/u.test(options.credential)) {
    throw new Error("Mandate control-plane credential is invalid");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,126}$/u.test(options.executionId)) {
    throw new Error("Mandate execution ID is invalid");
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(options.mandateVersionDigest)) {
    throw new Error("Mandate version digest is invalid");
  }
  if (typeof options.settlement !== "function") throw new Error("AgentOS settlement callback is required");
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error("Mandate control-plane timeout is invalid");
  }
  const request = async (path: string, body: unknown): Promise<unknown> => {
    const response = await (options.fetch ?? globalThis.fetch)(new URL(path, baseUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Mandate control plane rejected the request (${response.status})`);
    try {
      return await response.json();
    } catch {
      throw new Error("Mandate control plane returned invalid JSON");
    }
  };
  return Object.freeze({
    async beforeAction(action, effects) {
      return conformanceResult(await request(
        `/v1/executions/${encodeURIComponent(options.executionId)}/actions/authorize`,
        { proposedAction: action, normalizedEffects: effects },
      ), options.mandateVersionDigest);
    },
    async publishEvidence(evidence) {
      if (typeof evidence.executionActionId !== "string" || !evidence.executionActionId) {
        throw new Error("AgentOS evidence is not bound to an execution action");
      }
      const settlement = await options.settlement(evidence);
      if (!validSettlement(settlement)) throw new Error("AgentOS action settlement is invalid");
      const result = await request(
        `/v1/executions/${encodeURIComponent(options.executionId)}/actions/${encodeURIComponent(evidence.executionActionId)}/settle`,
        {
          ...settlement,
          evidence: {
            id: evidence.id,
            ...(evidence.requirementId ? { requirementId: evidence.requirementId } : {}),
            type: evidence.type,
            ...(evidence.artifactUri ? { artifactUri: evidence.artifactUri } : {}),
            ...(evidence.digest ? { digest: evidence.digest } : {}),
          },
        },
      );
      const expectedStatus = settlement.outcome === "SUCCEEDED" ? "EXECUTED" : "FAILED";
      if (
        !record(result)
        || result.status !== expectedStatus
        || !record(result.evidence)
        || result.evidence.id !== evidence.id
        || result.evidence.executionActionId !== evidence.executionActionId
      ) {
        throw new Error("Mandate control plane returned an invalid settlement result");
      }
    },
  });
}

export async function startAgentOsExecution(
  mandate: Mandate,
  bridge: AgentOsBridge,
  handlers: {
    beforeAction: (action: ProposedAction, effects: NormalizedEffect[]) => Promise<ConformanceResult>;
    publishEvidence: (evidence: AgentOsEvidenceRecord) => Promise<void>;
  },
  options: { dryRun?: boolean; resolveRepository: (resource: string) => string },
): Promise<{ taskId: string; worktree: string }> {
  const capabilities = await bridge.capabilities();
  if (!options.dryRun) assertGovernedAgentOsCapabilities(capabilities);
  const task = await bridge.createTask(mandateToAgentOsTask(
    mandate,
    options.dryRun ?? false,
    options.resolveRepository,
  ));
  await bridge.runTask({ taskId: task.taskId, ...handlers });
  return task;
}
