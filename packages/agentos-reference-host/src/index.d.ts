import type { ConformanceResult, EvidenceRecord, NormalizedEffect, ProposedAction } from "@mandate/protocol";

export interface ApprovalPreview {
  rpcId: string | number;
  method: string;
  threadId: string;
  turnId: string;
  itemId: string;
  details: Record<string, unknown>;
  taskId: string;
  requestId: string;
  checksum: `sha256:${string}`;
  expiresAt: string;
}

export declare function relayError(code: string): Error & { code: string; retryable: false };

export declare class HumanApprovalRelay {
  constructor(options?: { timeoutMs?: number });
  connect(taskId: string): { taskId: string; leaseId: string; expiresAt: string };
  available(taskId: string, leaseId?: string | null): boolean;
  binding(taskId: string): string;
  list(taskId: string, leaseId: string): ApprovalPreview[];
  request(
    taskId: string,
    request: Omit<ApprovalPreview, "taskId" | "requestId" | "checksum" | "expiresAt">,
    signal?: AbortSignal,
    onEvent?: (type: string, payload: Record<string, unknown>) => void,
    leaseId?: string | null,
  ): Promise<{ decision: "accept" | "decline" | "cancel" }>;
  answer(input: {
    taskId: string;
    leaseId: string;
    requestId: string;
    checksum: string;
    decision: "accept" | "decline" | "cancel";
  }): { requestId: string; checksum: string; decision: string };
  disconnect(taskId: string): void;
  close(): void;
}

export declare function createHumanApprovalRunner(
  relay: HumanApprovalRelay,
  options?: {
    spawnServer?: (...args: unknown[]) => unknown;
    contextRuntime?: unknown;
    skillRuntime?: unknown;
    applicationSkillRuntime?: unknown;
    actionInterceptor?: {
      beforeAction(request: Record<string, unknown>): Promise<MandateReceipt>;
      afterAction(receipt: MandateReceipt): Promise<void>;
    };
  },
): ((input: Record<string, unknown>) => Promise<Record<string, unknown>>) & {
  humanApprovalAvailable(taskId: string): boolean;
};

export interface MandateReceipt {
  actionId: string;
  taskId: string;
  itemId: string;
  decision: ConformanceResult["decision"];
  reasonCount: number;
  violatedRuleCount: number;
  effectTypes: readonly NormalizedEffect["type"][];
}

export declare const mandateInterceptedRunnerCapabilities: Readonly<{
  isolatedWorktree: true;
  beforeActionInterception: true;
  stopOnDenial: true;
  evidenceCallbacks: true;
}>;

export declare function createMandateActionInterceptor(options: {
  mandateId: string;
  mandateVersion: number;
  repository: string;
  beforeAction: (action: ProposedAction, effects: NormalizedEffect[]) => Promise<ConformanceResult>;
  publishEvidence: (evidence: Omit<EvidenceRecord, "verified" | "verifiedBy"> & { executionActionId: string }) => Promise<void>;
  createId?: () => string;
  now?: () => string;
}): Readonly<{
  capabilities: typeof mandateInterceptedRunnerCapabilities;
  beforeAction(request: {
    taskId: string;
    turnId: string;
    itemId: string;
    requestType: "command" | "file";
    details: Record<string, unknown>;
    cwd: string;
  }): Promise<MandateReceipt>;
  afterAction(receipt: MandateReceipt): Promise<void>;
}>;
