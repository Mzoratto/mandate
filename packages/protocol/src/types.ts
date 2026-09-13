export const mandateStatuses = [
  "DRAFT",
  "PROPOSED",
  "AWAITING_APPROVAL",
  "ACTIVE",
  "SUSPENDED",
  "AMENDMENT_PENDING",
  "COMPLETED",
  "REJECTED",
  "REVOKED",
  "EXPIRED",
] as const;
export type MandateStatus = (typeof mandateStatuses)[number];

export const effectTypes = [
  "CODE_READ",
  "CODE_MODIFICATION",
  "TEST_MODIFICATION",
  "DEPENDENCY_MODIFICATION",
  "BRANCH_CREATION",
  "LOCAL_COMMAND_EXECUTION",
  "NETWORK_REQUEST",
  "DATABASE_SCHEMA_MUTATION",
  "PRODUCTION_DEPLOYMENT",
  "SECRET_READ",
  "SECRET_WRITE",
] as const;
export type EffectType = (typeof effectTypes)[number];

export const resourceKinds = [
  "repository",
  "path",
  "service",
  "database",
  "api",
  "generic",
] as const;
export type ResourceKind = (typeof resourceKinds)[number];

export interface PrincipalRef {
  type: "human" | "organization" | "service";
  id: string;
  tenantId?: string;
}

export interface SubjectRef {
  agentId: string;
  runtime: "agentos" | "strands" | "custom";
  instanceId?: string;
}

export interface SuccessCriterion {
  id: string;
  type: "test" | "review" | "state" | "metric" | "human";
  description: string;
  verifier: string;
  required: boolean;
}

export interface GoalDefinition {
  statement: string;
  successCriteria: SuccessCriterion[];
}

export interface ResourceScope {
  kind: ResourceKind;
  resource: string;
  include?: string[];
  exclude?: string[];
}

export interface ScopeDefinition {
  resources: ResourceScope[];
  environments: string[];
}

export interface EffectRule {
  type: EffectType;
  environments?: string[];
}

export interface AuthorityDefinition {
  allowedEffects: EffectRule[];
  forbiddenEffects: EffectRule[];
  approvalRequiredEffects: EffectRule[];
}

export interface LimitDefinition {
  monetaryBudgetUsd?: number;
  tokenBudget?: number;
  maxExecutionSeconds?: number;
  maxMutations?: number;
  maxExternalCalls?: number;
}

export interface DelegationDefinition {
  allowed: boolean;
  maxDepth: number;
  requireExplicitChildScope: boolean;
}

export const escalationTypes = [
  "SCOPE_EXPANSION",
  "FORBIDDEN_EFFECT_REQUIRED",
  "IRREVERSIBLE_EFFECT",
  "RISK_INCREASE",
  "BUDGET_INCREASE",
  "ASSUMPTION_INVALIDATED",
  "UNCERTAIN_CLASSIFICATION",
  "EVIDENCE_FAILURE",
] as const;
export type EscalationType = (typeof escalationTypes)[number];

export interface EscalationCondition {
  type: EscalationType;
  threshold?: number;
}

export interface EscalationDefinition {
  conditions: EscalationCondition[];
  defaultAction: "BLOCK" | "SUSPEND";
}

export const evidenceTypes = [
  "test-report",
  "review",
  "artifact",
  "trace",
  "signature",
  "state-check",
] as const;
export type EvidenceType = (typeof evidenceTypes)[number];

export interface EvidenceRequirement {
  id: string;
  type: EvidenceType;
  required: boolean;
  verifier?: string;
}

export interface EvidenceDefinition {
  requirements: EvidenceRequirement[];
}

export interface ValidityDefinition {
  notBefore?: string;
  expiresAt: string;
}

export interface ApprovalAssumption {
  key: string;
  valueHash: string;
  invalidatesOnChange: boolean;
}

export interface Mandate {
  protocolVersion: "0.1";
  id: string;
  version: number;
  supersedes?: string;
  parent?: string;
  principal: PrincipalRef;
  subject: SubjectRef;
  goal: GoalDefinition;
  scope: ScopeDefinition;
  authority: AuthorityDefinition;
  limits: LimitDefinition;
  delegation: DelegationDefinition;
  escalation: EscalationDefinition;
  evidence: EvidenceDefinition;
  validity: ValidityDefinition;
  assumptions: ApprovalAssumption[];
  status: MandateStatus;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
}

export interface ApprovalRecord {
  id: string;
  mandateId: string;
  mandateVersion: number;
  mandateVersionDigest: string;
  principalId: string;
  assumptionHashes: ApprovalAssumption[];
  nonce: string;
  approvedAt: string;
  supersedesApprovalId?: string;
}

export interface ProposedAction {
  actionId: string;
  tool: string;
  operation: string;
  inputs: Record<string, unknown>;
}

export interface NormalizedEffect {
  type: EffectType;
  resources: string[];
  environment?: string;
  reversible: boolean;
  estimatedCostUsd?: number;
  confidence: number;
}

export interface ExecutionState {
  startedAt: string;
  monetarySpentUsd: number;
  tokensUsed: number;
  mutationActions: number;
  externalCallActions: number;
  delegationDepth: number;
}

export interface MandateEvent {
  id: string;
  mandateId: string;
  mandateVersion: number;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: string;
  previousEventHash?: string;
  eventHash?: string;
}

export type ConformanceDecision =
  | "ALLOW"
  | "DENY"
  | "ESCALATE"
  | "INVALIDATE_APPROVAL";

export interface ConformanceRequest {
  mandate: Mandate;
  subject: SubjectRef;
  proposedAction: ProposedAction;
  normalizedEffects: NormalizedEffect[];
  executionState: ExecutionState;
  eventHistory: MandateEvent[];
  currentAssumptions: ApprovalAssumption[];
  now: string;
  projectedTokens?: number;
  semanticDecision?: "ALLOW" | "DENY" | "ESCALATE";
}

export interface ConformanceResult {
  decision: ConformanceDecision;
  reasons: string[];
  violatedRules: string[];
  amendmentSuggested?: boolean;
}

export type MandatePatchPath =
  | "/goal"
  | "/scope"
  | "/authority"
  | "/limits"
  | "/delegation"
  | "/escalation"
  | "/evidence"
  | "/validity"
  | "/assumptions";

export interface MandatePatch {
  op: "replace";
  path: MandatePatchPath;
  value: unknown;
}

export interface EvidenceRef {
  id: string;
  digest?: string;
}

export interface AmendmentAlternative {
  description: string;
  authorityChangeRequired: boolean;
  reversible: boolean;
}

export interface RiskDelta {
  from: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  to: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasons: string[];
}

export interface MandateAmendment {
  id: string;
  mandateId: string;
  baseVersion: number;
  baseVersionDigest: string;
  requestedChanges: MandatePatch[];
  reason: string;
  discoveryEvidence: EvidenceRef[];
  alternatives: AmendmentAlternative[];
  riskDelta: RiskDelta;
  rollback?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
}

export interface EvidenceRecord {
  id: string;
  mandateId: string;
  mandateVersion: number;
  requirementId?: string;
  type: EvidenceType;
  producer: string;
  artifactUri?: string;
  digest?: string;
  verified: boolean;
  verifiedBy?: string;
  createdAt: string;
}

export interface CriterionResult {
  criterionId: string;
  mandateId: string;
  mandateVersion: number;
  status: "PASS" | "FAIL";
  verifier: string;
  evidenceIds: string[];
  verifiedAt: string;
}
