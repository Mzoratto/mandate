import type { Mandate } from "@mandate/protocol";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const principalType = pgEnum("principal_type", ["human", "organization", "service"]);
export const runtimeType = pgEnum("runtime_type", ["agentos", "strands", "custom"]);
export const mandateStatus = pgEnum("mandate_status", [
  "DRAFT", "PROPOSED", "AWAITING_APPROVAL", "ACTIVE", "SUSPENDED",
  "AMENDMENT_PENDING", "COMPLETED", "REJECTED", "REVOKED", "EXPIRED",
]);
export const amendmentStatus = pgEnum("amendment_status", ["PENDING", "APPROVED", "REJECTED", "EXPIRED"]);
export const conformanceDecision = pgEnum("conformance_decision", ["ALLOW", "DENY", "ESCALATE", "INVALIDATE_APPROVAL"]);

export const principals = pgTable("principals", {
  id: text().primaryKey(),
  type: principalType().notNull(),
  tenantId: text("tenant_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const agents = pgTable("agents", {
  id: text().primaryKey(),
  runtime: runtimeType().notNull(),
  instanceId: text("instance_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const controlPlaneCredentials = pgTable("control_plane_credentials", {
  id: text().primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  principalId: text("principal_id").references(() => principals.id),
  agentId: text("agent_id").references(() => agents.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
});

export const mandates = pgTable("mandates", {
  id: text().primaryKey(),
  principalId: text("principal_id").notNull().references(() => principals.id),
  subjectId: text("subject_id").notNull().references(() => agents.id),
  currentVersion: integer("current_version").notNull(),
  status: mandateStatus().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
}, (table) => [
  index("mandates_principal_status_idx").on(table.principalId, table.status),
]);

export const oauthSubjects = pgTable("oauth_subjects", {
  authorizationServer: text("authorization_server").notNull(),
  subject: text().notNull(),
  principalId: text("principal_id").notNull().references(() => principals.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.authorizationServer, table.subject] }),
  index("oauth_subjects_principal_idx").on(table.principalId),
]);

export const mcpWorkRequests = pgTable("mcp_work_requests", {
  principalId: text("principal_id").notNull().references(() => principals.id),
  idempotencyKey: text("idempotency_key").notNull(),
  requestDigest: text("request_digest").notNull(),
  mandateId: text("mandate_id").notNull().unique().references(() => mandates.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.principalId, table.idempotencyKey] }),
  index("mcp_work_requests_mandate_idx").on(table.mandateId),
]);

export const mandateVersions = pgTable("mandate_versions", {
  mandateId: text("mandate_id").notNull().references(() => mandates.id),
  version: integer().notNull(),
  content: jsonb().$type<Mandate>().notNull(),
  contentDigest: text("content_digest").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.mandateId, table.version] }),
  uniqueIndex("mandate_versions_digest_idx").on(table.mandateId, table.contentDigest),
]);

export const mandateAssumptionState = pgTable("mandate_assumption_state", {
  mandateId: text("mandate_id").notNull().references(() => mandates.id),
  key: text().notNull(),
  valueHash: text("value_hash").notNull(),
  invalidatesOnChange: boolean("invalidates_on_change").notNull(),
  source: text().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [primaryKey({ columns: [table.mandateId, table.key] })]);

export const approvals = pgTable("mandate_approvals", {
  id: text().primaryKey(),
  mandateId: text("mandate_id").notNull(),
  mandateVersion: integer("mandate_version").notNull(),
  versionDigest: text("version_digest").notNull(),
  principalId: text("principal_id").notNull().references(() => principals.id),
  assumptionHashes: jsonb("assumption_hashes").notNull(),
  nonce: text().notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }).notNull(),
  supersedesApprovalId: text("supersedes_approval_id"),
}, (table) => [
  foreignKey({
    columns: [table.mandateId, table.mandateVersion],
    foreignColumns: [mandateVersions.mandateId, mandateVersions.version],
  }),
  uniqueIndex("approvals_replay_guard_idx").on(table.principalId, table.mandateId, table.mandateVersion, table.nonce),
]);

export const approvalChallenges = pgTable("approval_challenges", {
  id: text().primaryKey(),
  principalId: text("principal_id").notNull().references(() => principals.id),
  mandateId: text("mandate_id").notNull(),
  mandateVersion: integer("mandate_version").notNull(),
  subjectKind: text("subject_kind").notNull(),
  subjectId: text("subject_id").notNull(),
  subjectDigest: text("subject_digest").notNull(),
  nonceHash: text("nonce_hash").notNull().unique(),
  channel: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "string" }),
  decision: text(),
}, (table) => [
  foreignKey({
    columns: [table.mandateId, table.mandateVersion],
    foreignColumns: [mandateVersions.mandateId, mandateVersions.version],
  }),
  index("approval_challenges_pending_idx").on(table.principalId, table.mandateId, table.expiresAt),
]);

export const amendments = pgTable("mandate_amendments", {
  id: text().primaryKey(),
  mandateId: text("mandate_id").notNull().references(() => mandates.id),
  baseVersion: integer("base_version").notNull(),
  baseVersionDigest: text("base_version_digest").notNull(),
  proposal: jsonb().notNull(),
  status: amendmentStatus().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true, mode: "string" }),
  decidedBy: text("decided_by").references(() => principals.id),
}, (table) => [
  index("amendments_attention_idx").on(table.mandateId, table.status),
]);

export const executions = pgTable("executions", {
  id: text().primaryKey(),
  mandateId: text("mandate_id").notNull(),
  mandateVersion: integer("mandate_version").notNull(),
  subjectId: text("subject_id").notNull().references(() => agents.id),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
  monetarySpentMicroUsd: bigint("monetary_spent_micro_usd", { mode: "bigint" }).notNull().default(0n),
  tokensUsed: bigint("tokens_used", { mode: "bigint" }).notNull().default(0n),
  mutationActions: integer("mutation_actions").notNull().default(0),
  externalCallActions: integer("external_call_actions").notNull().default(0),
  delegationDepth: integer("delegation_depth").notNull().default(0),
}, (table) => [
  foreignKey({
    columns: [table.mandateId, table.mandateVersion],
    foreignColumns: [mandateVersions.mandateId, mandateVersions.version],
  }),
]);

export const executionActions = pgTable("execution_actions", {
  id: text().primaryKey(),
  executionId: text("execution_id").notNull().references(() => executions.id),
  tool: text().notNull(),
  operation: text().notNull(),
  inputs: jsonb().notNull(),
  requestDigest: text("request_digest").notNull(),
  settlementDigest: text("settlement_digest"),
  status: text().notNull(),
  proposedAt: timestamp("proposed_at", { withTimezone: true, mode: "string" }).notNull(),
  executedAt: timestamp("executed_at", { withTimezone: true, mode: "string" }),
}, (table) => [index("execution_actions_execution_idx").on(table.executionId, table.proposedAt)]);

export const executionEffects = pgTable("execution_effects", {
  id: text().primaryKey(),
  actionId: text("action_id").notNull().references(() => executionActions.id),
  type: text().notNull(),
  resources: jsonb().notNull(),
  environment: text(),
  reversible: boolean().notNull(),
  confidence: numeric({ precision: 4, scale: 3 }).notNull(),
  estimatedCostMicroUsd: bigint("estimated_cost_micro_usd", { mode: "bigint" }),
}, (table) => [index("execution_effects_action_idx").on(table.actionId)]);

export const authorizationDecisions = pgTable("authorization_decisions", {
  id: text().primaryKey(),
  actionId: text("action_id").notNull().references(() => executionActions.id),
  decision: conformanceDecision().notNull(),
  reasons: jsonb().notNull(),
  violatedRules: jsonb("violated_rules").notNull(),
  amendmentSuggested: boolean("amendment_suggested").notNull().default(false),
  mandateVersionDigest: text("mandate_version_digest").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [uniqueIndex("authorization_decisions_action_idx").on(table.actionId)]);

export const delegations = pgTable("delegations", {
  parentMandateId: text("parent_mandate_id").notNull().references(() => mandates.id),
  childMandateId: text("child_mandate_id").notNull().references(() => mandates.id),
  parentVersion: integer("parent_version").notNull(),
  childVersion: integer("child_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [primaryKey({ columns: [table.parentMandateId, table.childMandateId] })]);

export const evidence = pgTable("evidence", {
  id: text().primaryKey(),
  mandateId: text("mandate_id").notNull(),
  mandateVersion: integer("mandate_version").notNull(),
  requirementId: text("requirement_id"),
  executionActionId: text("execution_action_id").references(() => executionActions.id),
  type: text().notNull(),
  producer: text().notNull(),
  artifactUri: text("artifact_uri"),
  digest: text(),
  verified: boolean().notNull().default(false),
  verifiedBy: text("verified_by"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.mandateId, table.mandateVersion],
    foreignColumns: [mandateVersions.mandateId, mandateVersions.version],
  }),
  index("evidence_mandate_idx").on(table.mandateId, table.mandateVersion),
]);

export const criterionResults = pgTable("criterion_results", {
  id: text().primaryKey(),
  mandateId: text("mandate_id").notNull(),
  mandateVersion: integer("mandate_version").notNull(),
  criterionId: text("criterion_id").notNull(),
  status: text().notNull(),
  verifier: text().notNull(),
  evidenceIds: jsonb("evidence_ids").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.mandateId, table.mandateVersion],
    foreignColumns: [mandateVersions.mandateId, mandateVersions.version],
  }),
  index("criterion_results_latest_idx").on(table.mandateId, table.mandateVersion, table.criterionId, table.verifiedAt),
]);

export const mandateEvents = pgTable("mandate_events", {
  id: text().primaryKey(),
  mandateId: text("mandate_id").notNull().references(() => mandates.id),
  mandateVersion: integer("mandate_version").notNull(),
  sequence: bigint({ mode: "bigint" }).notNull(),
  type: text().notNull(),
  actor: text().notNull(),
  payload: jsonb().notNull(),
  timestamp: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  previousEventHash: text("previous_event_hash"),
  eventHash: text("event_hash").notNull().unique(),
}, (table) => [
  index("mandate_events_timeline_idx").on(table.mandateId, table.timestamp),
  uniqueIndex("mandate_events_sequence_idx").on(table.mandateId, table.sequence),
]);
