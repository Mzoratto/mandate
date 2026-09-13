import type { Mandate } from "@mandate/protocol";
import {
  effectTypes,
  escalationTypes,
  evidenceTypes,
  mandateStatuses,
  resourceKinds,
} from "@mandate/protocol";
import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const versionRef = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}@[1-9][0-9]*$/);
const timestamp = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine((value) => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value, "Must be a real UTC timestamp");
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const environment = z.string().regex(/^[a-z][a-z0-9-]{0,62}$/);
const nonnegativeSafeInteger = z.number().int().nonnegative().safe();
const monetaryUsd = z.number().finite().nonnegative().refine((value) => {
  const micros = value * 1_000_000;
  return Number.isSafeInteger(Math.round(micros)) && Math.abs(micros - Math.round(micros)) < 1e-7;
}, "Must be representable as integer micro-USD");
const pathPattern = z.string().refine((value) => {
  if (value === "**") return true;
  const raw = value.endsWith("/**") ? value.slice(0, -3) : value;
  const segments = raw.split("/");
  return raw.length > 0
    && !raw.startsWith("/")
    && !/[\\*%]/.test(raw)
    && segments.every((segment) => segment && segment !== "." && segment !== "..");
}, "Must be an exact path or a directory prefix ending in /**");

function sortedUniqueBy<T>(items: T[], key: (item: T) => string): boolean {
  const keys = items.map(key);
  return new Set(keys).size === keys.length && keys.every((value, index) => index === 0 || keys[index - 1]! <= value);
}

export const PrincipalRefSchema = z.object({
  type: z.enum(["human", "organization", "service"]),
  id,
  tenantId: id.optional(),
}).strict();

export const SubjectRefSchema = z.object({
  agentId: id,
  runtime: z.enum(["agentos", "strands", "custom"]),
  instanceId: id.optional(),
}).strict();

export const SuccessCriterionSchema = z.object({
  id,
  type: z.enum(["test", "review", "state", "metric", "human"]),
  description: z.string().min(1),
  verifier: z.string().min(1),
  required: z.boolean(),
}).strict();

export const GoalDefinitionSchema = z.object({
  statement: z.string().min(1),
  successCriteria: z.array(SuccessCriterionSchema).superRefine((items, context) => {
    if (!sortedUniqueBy(items, (item) => item.id)) context.addIssue({ code: "custom", message: "Criteria must be unique and sorted by ID" });
  }),
}).strict();

export const ResourceScopeSchema = z.object({
  kind: z.enum(resourceKinds),
  resource: id,
  include: z.array(pathPattern).optional(),
  exclude: z.array(pathPattern).optional(),
}).strict().superRefine((scope, context) => {
  if (!sortedUniqueBy(scope.include ?? [], String) || !sortedUniqueBy(scope.exclude ?? [], String)) {
    context.addIssue({ code: "custom", message: "Scope patterns must be unique and sorted" });
  }
  if (!(["repository", "path"] as const).includes(scope.kind as "repository" | "path") && (scope.include || scope.exclude)) {
    context.addIssue({ code: "custom", message: "Only repository and path scopes may use include or exclude" });
  }
});

export const ScopeDefinitionSchema = z.object({
  resources: z.array(ResourceScopeSchema).superRefine((items, context) => {
    if (!sortedUniqueBy(items, (item) => `${item.kind}:${item.resource}`)) {
      context.addIssue({ code: "custom", message: "Resource scope entries must be unique and sorted" });
    }
  }),
  environments: z.array(environment).superRefine((items, context) => {
    if (!sortedUniqueBy(items, String)) context.addIssue({ code: "custom", message: "Environments must be unique and sorted" });
  }),
}).strict();

export const EffectRuleSchema = z.object({
  type: z.enum(effectTypes),
  environments: z.array(environment).optional(),
}).strict().superRefine((rule, context) => {
  if (!sortedUniqueBy(rule.environments ?? [], String)) context.addIssue({ code: "custom", message: "Rule environments must be unique and sorted" });
});

const effectRuleSet = z.array(EffectRuleSchema).superRefine((items, context) => {
  if (!sortedUniqueBy(items, (item) => `${item.type}:${(item.environments ?? []).join(",")}`)) {
    context.addIssue({ code: "custom", message: "Effect rules must be unique and sorted" });
  }
});

export const AuthorityDefinitionSchema = z.object({
  allowedEffects: effectRuleSet,
  forbiddenEffects: effectRuleSet,
  approvalRequiredEffects: effectRuleSet,
}).strict();

export const LimitDefinitionSchema = z.object({
  monetaryBudgetUsd: monetaryUsd.optional(),
  tokenBudget: nonnegativeSafeInteger.optional(),
  maxExecutionSeconds: nonnegativeSafeInteger.optional(),
  maxMutations: nonnegativeSafeInteger.optional(),
  maxExternalCalls: nonnegativeSafeInteger.optional(),
}).strict();

export const DelegationDefinitionSchema = z.object({
  allowed: z.boolean(),
  maxDepth: nonnegativeSafeInteger,
  requireExplicitChildScope: z.boolean(),
}).strict().superRefine((delegation, context) => {
  if (!delegation.allowed && delegation.maxDepth !== 0) {
    context.addIssue({ code: "custom", message: "Delegation maxDepth must be zero when delegation is disabled" });
  }
});

export const EscalationConditionSchema = z.object({
  type: z.enum(escalationTypes),
  threshold: z.number().finite().optional(),
}).strict();

export const EscalationDefinitionSchema = z.object({
  conditions: z.array(EscalationConditionSchema).superRefine((items, context) => {
    if (!sortedUniqueBy(items, (item) => item.type)) context.addIssue({ code: "custom", message: "Escalation conditions must be unique and sorted" });
  }),
  defaultAction: z.enum(["BLOCK", "SUSPEND"]),
}).strict();

export const EvidenceRequirementSchema = z.object({
  id,
  type: z.enum(evidenceTypes),
  required: z.boolean(),
  verifier: z.string().min(1).optional(),
}).strict().superRefine((requirement, context) => {
  if (requirement.required && !requirement.verifier) {
    context.addIssue({ code: "custom", message: "Required evidence must name a verifier" });
  }
});

export const EvidenceDefinitionSchema = z.object({
  requirements: z.array(EvidenceRequirementSchema).superRefine((items, context) => {
    if (!sortedUniqueBy(items, (item) => item.id)) context.addIssue({ code: "custom", message: "Evidence requirements must be unique and sorted by ID" });
  }),
}).strict();

export const ValidityDefinitionSchema = z.object({
  notBefore: timestamp.optional(),
  expiresAt: timestamp,
}).strict().superRefine((validity, context) => {
  if (validity.notBefore && validity.notBefore >= validity.expiresAt) {
    context.addIssue({ code: "custom", message: "expiresAt must be after notBefore" });
  }
});

export const ApprovalAssumptionSchema = z.object({
  key: id,
  valueHash: digest,
  invalidatesOnChange: z.boolean(),
}).strict();

export const MandateSchema = z.object({
  protocolVersion: z.literal("0.1"),
  id,
  version: z.number().int().positive().safe(),
  supersedes: versionRef.optional(),
  parent: versionRef.optional(),
  principal: PrincipalRefSchema,
  subject: SubjectRefSchema,
  goal: GoalDefinitionSchema,
  scope: ScopeDefinitionSchema,
  authority: AuthorityDefinitionSchema,
  limits: LimitDefinitionSchema,
  delegation: DelegationDefinitionSchema,
  escalation: EscalationDefinitionSchema,
  evidence: EvidenceDefinitionSchema,
  validity: ValidityDefinitionSchema,
  assumptions: z.array(ApprovalAssumptionSchema),
  status: z.enum(mandateStatuses),
  createdAt: timestamp,
  approvedAt: timestamp.optional(),
  completedAt: timestamp.optional(),
}).strict().superRefine((mandate, context) => {
  if (!sortedUniqueBy(mandate.assumptions, (item) => item.key)) {
    context.addIssue({ code: "custom", message: "Assumptions must be unique and sorted by key" });
  }
  if (mandate.version === 1 && mandate.supersedes) {
    context.addIssue({ code: "custom", message: "Version 1 cannot supersede another version" });
  }
  if (mandate.version > 1 && !mandate.supersedes) {
    context.addIssue({ code: "custom", message: "Versions above 1 must identify the superseded version" });
  }
  if (["ACTIVE", "SUSPENDED", "AMENDMENT_PENDING", "COMPLETED", "REVOKED"].includes(mandate.status) && !mandate.approvedAt) {
    context.addIssue({ code: "custom", message: "Authorized states require approvedAt" });
  }
  if (mandate.status === "COMPLETED" && !mandate.completedAt) {
    context.addIssue({ code: "custom", message: "Completed Mandates require completedAt" });
  }
  if (mandate.status !== "COMPLETED" && mandate.completedAt) {
    context.addIssue({ code: "custom", message: "Only completed Mandates may have completedAt" });
  }
});

export const ProposedActionSchema = z.object({
  actionId: id,
  tool: z.string().min(1),
  operation: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()),
}).strict();

export const NormalizedEffectSchema = z.object({
  type: z.enum(effectTypes),
  resources: z.array(z.string()).min(0),
  environment: environment.optional(),
  reversible: z.boolean(),
  estimatedCostUsd: monetaryUsd.optional(),
  confidence: z.number().min(0).max(1),
}).strict();

export const MandatePatchSchema = z.object({
  op: z.literal("replace"),
  path: z.enum(["/goal", "/scope", "/authority", "/limits", "/delegation", "/escalation", "/evidence", "/validity", "/assumptions"]),
  value: z.unknown(),
}).strict();

export const MandateAmendmentSchema = z.object({
  id,
  mandateId: id,
  baseVersion: z.number().int().positive().safe(),
  baseVersionDigest: digest,
  requestedChanges: z.array(MandatePatchSchema).min(1),
  reason: z.string().min(1),
  discoveryEvidence: z.array(z.object({ id, digest: digest.optional() }).strict()),
  alternatives: z.array(z.object({
    description: z.string().min(1),
    authorityChangeRequired: z.boolean(),
    reversible: z.boolean(),
  }).strict()).min(1),
  riskDelta: z.object({
    from: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    to: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    reasons: z.array(z.string().min(1)).min(1),
  }).strict(),
  rollback: z.string().min(1).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]),
}).strict().superRefine((amendment, context) => {
  if (!sortedUniqueBy(amendment.requestedChanges, (patch) => patch.path)) {
    context.addIssue({ code: "custom", message: "Amendment paths must be unique and sorted" });
  }
});

export function parseMandate(input: unknown): Mandate {
  return MandateSchema.parse(input) as Mandate;
}
