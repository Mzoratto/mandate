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

export interface AgentOsBridge {
  capabilities(): Promise<AgentOsCapabilities>;
  createTask(request: AgentOsTaskRequest): Promise<{ taskId: string; worktree: string }>;
  runTask(input: {
    taskId: string;
    beforeAction: (action: ProposedAction, effects: NormalizedEffect[]) => Promise<ConformanceResult>;
    publishEvidence: (evidence: Omit<EvidenceRecord, "verified" | "verifiedBy">) => Promise<void>;
  }): Promise<void>;
  stopTask(taskId: string): Promise<void>;
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

export async function startAgentOsExecution(
  mandate: Mandate,
  bridge: AgentOsBridge,
  handlers: {
    beforeAction: (action: ProposedAction, effects: NormalizedEffect[]) => Promise<ConformanceResult>;
    publishEvidence: (evidence: Omit<EvidenceRecord, "verified" | "verifiedBy">) => Promise<void>;
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
