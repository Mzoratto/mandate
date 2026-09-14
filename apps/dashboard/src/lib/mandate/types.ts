export type MandateState = "within" | "attention" | "boundary";

export interface LiveAction {
  id: string;
  status: string;
  decision: string;
  tool: string;
  operation: string;
  proposedAt: string;
  executedAt?: string;
  effectTypes: string[];
  resources: string[];
}

export interface LiveEvidence {
  id: string;
  requirementId?: string;
  type: string;
  producer: string;
  verified: boolean;
  verifiedBy?: string;
  createdAt: string;
}

export interface LiveEvent {
  type: string;
  actor: string;
  timestamp: string;
}

export interface LiveMandate {
  id: string;
  status: string;
  goal: string;
  principalId: string;
  subjectId: string;
  subjectRuntime: string;
  versionDigest: string;
  allowedEffects: string[];
  forbiddenEffects: string[];
  includePaths: string[];
  environments: string[];
  monetaryBudgetUsd?: number;
  approvedAt?: string;
  completedAt?: string;
  execution?: {
    id: string;
    startedAt: string;
    finishedAt?: string;
    tokensUsed: number;
    monetarySpentMicroUsd: number;
    mutationActions: number;
    actions: LiveAction[];
  };
  evidence: LiveEvidence[];
  events: LiveEvent[];
  requestId: string;
}

export type DashboardSource =
  | { kind: "live"; mandate: LiveMandate }
  | { kind: "illustrative" }
  | { kind: "unavailable" };
