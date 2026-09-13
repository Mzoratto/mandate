import { createHash } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import {
  deterministicId,
  mandateVersionDigest,
  sha256Digest,
  type ApprovalAssumption,
  type ConformanceDecision,
  type Mandate,
  type MandateEvent,
  type MandateStatus,
  type NormalizedEffect,
  type ProposedAction,
} from "@mandate/protocol";
import { parseMandate } from "@mandate/schemas";
import {
  appendEvent,
  approveMandate,
  evaluateConformance,
  proposeMandate,
  requestApproval,
  verifyEventChain,
  type MandateEventType,
} from "@mandate/runtime";

export class ControlPlaneError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type AuthenticatedIdentity =
  | {
      kind: "principal";
      id: string;
      principalType: "human" | "organization" | "service";
      tenantId?: string;
    }
  | {
      kind: "agent";
      id: string;
      runtime: "agentos" | "strands" | "custom";
      instanceId?: string;
    };

export interface AuthorizeActionInput {
  proposedAction: ProposedAction;
  normalizedEffects: NormalizedEffect[];
  projectedTokens?: number;
  semanticDecision?: "ALLOW" | "DENY" | "ESCALATE";
}

export interface AuthorizationResponse {
  decision: ConformanceDecision;
  reasons: string[];
  violatedRules: string[];
  amendmentSuggested: boolean;
  mandateVersionDigest: string;
}

export interface SettleActionInput {
  outcome: "SUCCEEDED" | "FAILED";
  usage: {
    monetarySpentUsd: number;
    tokensUsed: number;
  };
  evidence: {
    id: string;
    requirementId?: string;
    type: "test-report" | "review" | "artifact" | "trace" | "signature" | "state-check";
    artifactUri?: string;
    digest?: string;
  };
}

type SqlClient = Pick<Pool | PoolClient, "query">;

type Timestamp = string | Date;

interface MandateRow extends QueryResultRow {
  id: string;
  principal_id: string;
  subject_id: string;
  current_version: number;
  status: MandateStatus;
  created_at: Timestamp;
  approved_at: Timestamp | null;
  completed_at: Timestamp | null;
  content: unknown;
  content_digest: string;
}

interface ExecutionRow extends QueryResultRow {
  id: string;
  mandate_id: string;
  mandate_version: number;
  subject_id: string;
  started_at: Timestamp;
  finished_at: Timestamp | null;
  monetary_spent_micro_usd: string | bigint;
  tokens_used: string | bigint;
  mutation_actions: number;
  external_call_actions: number;
  delegation_depth: number;
}

interface EventRow extends QueryResultRow {
  id: string;
  mandate_id: string;
  mandate_version: number;
  sequence: string | bigint;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: Timestamp;
  previous_event_hash: string | null;
  event_hash: string;
}

function fail(status: number, code: string, message: string): never {
  throw new ControlPlaneError(status, code, message);
}

function jsonb(value: unknown): string {
  return JSON.stringify(value);
}

function iso(value: Timestamp): string {
  return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
}

function safeInteger(value: string | bigint, field: string): number {
  const parsed = typeof value === "bigint" ? value : BigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER) || parsed < 0n) {
    return fail(500, "DATA_INTEGRITY", `${field} is outside the supported range`);
  }
  return Number(parsed);
}

function microUsd(value: number): bigint {
  return BigInt(Math.round(value * 1_000_000));
}

function mapEvent(row: EventRow): MandateEvent {
  const event: MandateEvent = {
    id: row.id,
    mandateId: row.mandate_id,
    mandateVersion: row.mandate_version,
    type: row.type,
    actor: row.actor,
    payload: row.payload,
    timestamp: iso(row.timestamp),
    eventHash: row.event_hash,
  };
  if (row.previous_event_hash) event.previousEventHash = row.previous_event_hash;
  return event;
}

function materializeMandate(row: MandateRow): Mandate {
  if (!row.content || typeof row.content !== "object" || Array.isArray(row.content)) {
    return fail(500, "DATA_INTEGRITY", "Stored Mandate content is invalid");
  }
  const raw = structuredClone(row.content) as Record<string, unknown>;
  raw.status = row.status;
  raw.createdAt = iso(row.created_at);
  if (row.approved_at) raw.approvedAt = iso(row.approved_at);
  else delete raw.approvedAt;
  if (row.completed_at) raw.completedAt = iso(row.completed_at);
  else delete raw.completedAt;

  let mandate: Mandate;
  try {
    mandate = parseMandate(raw);
  } catch {
    return fail(500, "DATA_INTEGRITY", "Stored Mandate content failed protocol validation");
  }
  if (mandate.id !== row.id || mandate.version !== row.current_version) {
    return fail(500, "DATA_INTEGRITY", "Stored Mandate identity does not match its version row");
  }
  if (mandateVersionDigest(mandate) !== row.content_digest) {
    return fail(500, "DATA_INTEGRITY", "Stored Mandate version digest does not match its content");
  }
  return mandate;
}

function mapEvidenceRow(record: QueryResultRow): Record<string, unknown> {
  return {
    id: record.id,
    mandateId: record.mandate_id,
    mandateVersion: record.mandate_version,
    requirementId: record.requirement_id,
    executionActionId: record.execution_action_id,
    type: record.type,
    producer: record.producer,
    artifactUri: record.artifact_uri,
    digest: record.digest,
    verified: record.verified,
    verifiedBy: record.verified_by,
    createdAt: iso(record.created_at),
  };
}

function lifecycle<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof Error) return fail(409, "ILLEGAL_STATE", error.message);
    throw error;
  }
}

function postgresConflict(error: unknown): ControlPlaneError | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "23505") return new ControlPlaneError(409, "CONFLICT", "The record already exists");
  if (code === "23503" || code === "23514") {
    return new ControlPlaneError(409, "CONSTRAINT_VIOLATION", "The request conflicts with stored control-plane state");
  }
  return undefined;
}

export function hashCredential(token: string): string {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

export class ControlPlaneRepository {
  constructor(private readonly pool: Pool) {}

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof ControlPlaneError) throw error;
      throw postgresConflict(error) ?? error;
    } finally {
      client.release();
    }
  }

  async authenticate(token: string): Promise<AuthenticatedIdentity> {
    const result = await this.pool.query<{
      principal_id: string | null;
      agent_id: string | null;
      principal_type: "human" | "organization" | "service" | null;
      tenant_id: string | null;
      runtime: "agentos" | "strands" | "custom" | null;
      instance_id: string | null;
    }>(
      `SELECT credential.principal_id,
              credential.agent_id,
              principal.type AS principal_type,
              principal.tenant_id,
              agent.runtime,
              agent.instance_id
         FROM control_plane_credentials AS credential
         LEFT JOIN principals AS principal ON principal.id = credential.principal_id
         LEFT JOIN agents AS agent ON agent.id = credential.agent_id
        WHERE credential.token_hash = $1
          AND credential.revoked_at IS NULL
          AND (credential.expires_at IS NULL OR credential.expires_at > now())`,
      [hashCredential(token)],
    );
    const row = result.rows[0];
    if (!row) return fail(401, "UNAUTHENTICATED", "Bearer credential is invalid or expired");
    if (row.principal_id && row.principal_type) {
      return {
        kind: "principal",
        id: row.principal_id,
        principalType: row.principal_type,
        ...(row.tenant_id ? { tenantId: row.tenant_id } : {}),
      };
    }
    if (row.agent_id && row.runtime) {
      return {
        kind: "agent",
        id: row.agent_id,
        runtime: row.runtime,
        ...(row.instance_id ? { instanceId: row.instance_id } : {}),
      };
    }
    return fail(500, "DATA_INTEGRITY", "Credential does not resolve to one identity");
  }

  private async loadMandate(
    client: SqlClient,
    mandateId: string,
    identity: AuthenticatedIdentity,
    lock: boolean,
  ): Promise<{ mandate: Mandate; versionDigest: string }> {
    const ownership = identity.kind === "principal"
      ? "mandate.principal_id = $2"
      : "mandate.subject_id = $2";
    const result = await client.query<MandateRow>(
      `SELECT mandate.*,
              version.content,
              version.content_digest
         FROM mandates AS mandate
         JOIN mandate_versions AS version
           ON version.mandate_id = mandate.id
          AND version.version = mandate.current_version
        WHERE mandate.id = $1
          AND ${ownership}
        ${lock ? "FOR UPDATE OF mandate" : ""}`,
      [mandateId, identity.id],
    );
    const row = result.rows[0];
    if (!row) return fail(404, "MANDATE_NOT_FOUND", "Mandate was not found for this identity");
    return { mandate: materializeMandate(row), versionDigest: row.content_digest };
  }

  private async currentAssumptions(client: SqlClient, mandateId: string): Promise<ApprovalAssumption[]> {
    const result = await client.query<{
      key: string;
      value_hash: string;
      invalidates_on_change: boolean;
    }>(
      `SELECT key, value_hash, invalidates_on_change
         FROM mandate_assumption_state
        WHERE mandate_id = $1
        ORDER BY key`,
      [mandateId],
    );
    return result.rows.map((row) => ({
      key: row.key,
      valueHash: row.value_hash,
      invalidatesOnChange: row.invalidates_on_change,
    }));
  }

  private async events(client: SqlClient, mandateId: string): Promise<MandateEvent[]> {
    const result = await client.query<EventRow>(
      `SELECT id, mandate_id, mandate_version, sequence, type, actor, payload,
              timestamp, previous_event_hash, event_hash
         FROM mandate_events
        WHERE mandate_id = $1
        ORDER BY sequence`,
      [mandateId],
    );
    const events = result.rows.map(mapEvent);
    if (!verifyEventChain(events)) return fail(500, "EVENT_CHAIN_INVALID", "Stored event chain failed verification");
    return events;
  }

  private async appendLedgerEvent(
    client: SqlClient,
    mandate: Mandate,
    type: MandateEventType,
    actor: string,
    payload: Record<string, unknown>,
    timestamp: string,
  ): Promise<MandateEvent> {
    const history = await this.events(client, mandate.id);
    const result = await client.query<EventRow>(
      `SELECT id, mandate_id, mandate_version, sequence, type, actor, payload,
              timestamp, previous_event_hash, event_hash
         FROM mandate_events
        WHERE mandate_id = $1
        ORDER BY sequence DESC
        LIMIT 1`,
      [mandate.id],
    );
    const previousRow = result.rows[0];
    if ((history.at(-1)?.eventHash ?? null) !== (previousRow?.event_hash ?? null)) {
      return fail(500, "EVENT_CHAIN_INVALID", "Stored event sequence does not match its hash chain");
    }
    const event = appendEvent(history, {
      mandateId: mandate.id,
      mandateVersion: mandate.version,
      type,
      actor,
      payload,
      timestamp,
    });
    const sequence = previousRow ? BigInt(previousRow.sequence) + 1n : 1n;
    await client.query(
      `INSERT INTO mandate_events
        (id, mandate_id, mandate_version, sequence, type, actor, payload,
         timestamp, previous_event_hash, event_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        event.id,
        event.mandateId,
        event.mandateVersion,
        sequence.toString(),
        event.type,
        event.actor,
        jsonb(event.payload),
        event.timestamp,
        event.previousEventHash ?? null,
        event.eventHash,
      ],
    );
    return event;
  }

  async createMandate(identity: AuthenticatedIdentity, input: unknown): Promise<{ mandate: Mandate; versionDigest: string }> {
    if (identity.kind !== "principal") return fail(403, "PRINCIPAL_REQUIRED", "A principal credential is required");
    const mandate = parseMandate(input);
    if (mandate.version !== 1 || mandate.status !== "DRAFT" || mandate.approvedAt || mandate.completedAt) {
      return fail(422, "INVALID_INITIAL_STATE", "A new Mandate must be an unapproved version 1 draft");
    }
    if (
      mandate.principal.id !== identity.id
      || mandate.principal.type !== identity.principalType
      || (mandate.principal.tenantId ?? null) !== (identity.tenantId ?? null)
    ) {
      return fail(403, "PRINCIPAL_MISMATCH", "Authenticated principal does not match the Mandate principal");
    }
    const digest = mandateVersionDigest(mandate);
    return this.transaction(async (client) => {
      const agent = await client.query<{
        runtime: "agentos" | "strands" | "custom";
        instance_id: string | null;
      }>("SELECT runtime, instance_id FROM agents WHERE id = $1", [mandate.subject.agentId]);
      const subject = agent.rows[0];
      if (
        !subject
        || subject.runtime !== mandate.subject.runtime
        || (mandate.subject.instanceId && subject.instance_id !== mandate.subject.instanceId)
      ) {
        return fail(422, "SUBJECT_NOT_FOUND", "Mandate subject is not a registered matching agent");
      }

      await client.query(
        `INSERT INTO mandates
          (id, principal_id, subject_id, current_version, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [mandate.id, identity.id, mandate.subject.agentId, mandate.version, mandate.status, mandate.createdAt],
      );
      await client.query(
        `INSERT INTO mandate_versions
          (mandate_id, version, content, content_digest, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [mandate.id, mandate.version, jsonb(mandate), digest, mandate.createdAt],
      );
      for (const assumption of mandate.assumptions) {
        await client.query(
          `INSERT INTO mandate_assumption_state
            (mandate_id, key, value_hash, invalidates_on_change, source, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [mandate.id, assumption.key, assumption.valueHash, assumption.invalidatesOnChange, `principal:${identity.id}`, mandate.createdAt],
        );
      }
      await this.appendLedgerEvent(
        client,
        mandate,
        "MANDATE_CREATED",
        `principal:${identity.id}`,
        { versionDigest: digest },
        mandate.createdAt,
      );
      return { mandate, versionDigest: digest };
    });
  }

  async transitionMandate(
    identity: AuthenticatedIdentity,
    mandateId: string,
    to: "PROPOSED" | "AWAITING_APPROVAL",
    now = new Date().toISOString(),
  ): Promise<{ mandate: Mandate; versionDigest: string }> {
    if (identity.kind !== "principal") return fail(403, "PRINCIPAL_REQUIRED", "A principal credential is required");
    return this.transaction(async (client) => {
      const current = await this.loadMandate(client, mandateId, identity, true);
      const mandate = lifecycle(() => to === "PROPOSED"
        ? proposeMandate(current.mandate)
        : requestApproval(current.mandate));
      await client.query("UPDATE mandates SET status = $2 WHERE id = $1", [mandate.id, mandate.status]);
      await this.appendLedgerEvent(
        client,
        mandate,
        to === "PROPOSED" ? "MANDATE_PROPOSED" : "MANDATE_APPROVAL_REQUESTED",
        `principal:${identity.id}`,
        { status: mandate.status },
        now,
      );
      return { mandate, versionDigest: current.versionDigest };
    });
  }

  async approveMandate(
    identity: AuthenticatedIdentity,
    mandateId: string,
    nonce: string,
    now = new Date().toISOString(),
  ): Promise<{ mandate: Mandate; approvalId: string; versionDigest: string }> {
    if (identity.kind !== "principal") return fail(403, "PRINCIPAL_REQUIRED", "A principal credential is required");
    return this.transaction(async (client) => {
      const current = await this.loadMandate(client, mandateId, identity, true);
      const assumptions = await this.currentAssumptions(client, mandateId);
      const approved = lifecycle(() => approveMandate(current.mandate, assumptions, identity.id, now, nonce));
      await client.query(
        `INSERT INTO mandate_approvals
          (id, mandate_id, mandate_version, version_digest, principal_id,
           assumption_hashes, nonce, approved_at, supersedes_approval_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          approved.approval.id,
          mandateId,
          approved.approval.mandateVersion,
          approved.approval.mandateVersionDigest,
          identity.id,
          jsonb(approved.approval.assumptionHashes),
          approved.approval.nonce,
          approved.approval.approvedAt,
          approved.approval.supersedesApprovalId ?? null,
        ],
      );
      await client.query(
        "UPDATE mandates SET status = 'ACTIVE', approved_at = $2 WHERE id = $1",
        [mandateId, now],
      );
      await this.appendLedgerEvent(
        client,
        approved.mandate,
        "MANDATE_APPROVED",
        `principal:${identity.id}`,
        { approvalId: approved.approval.id, versionDigest: current.versionDigest },
        now,
      );
      await this.appendLedgerEvent(
        client,
        approved.mandate,
        "MANDATE_ACTIVATED",
        `principal:${identity.id}`,
        { approvalId: approved.approval.id },
        now,
      );
      return {
        mandate: approved.mandate,
        approvalId: approved.approval.id,
        versionDigest: current.versionDigest,
      };
    });
  }

  async setAssumption(
    identity: AuthenticatedIdentity,
    mandateId: string,
    key: string,
    valueHash: string,
    now = new Date().toISOString(),
  ): Promise<void> {
    if (identity.kind !== "principal") return fail(403, "PRINCIPAL_REQUIRED", "A principal credential is required");
    await this.transaction(async (client) => {
      const current = await this.loadMandate(client, mandateId, identity, true);
      if (!current.mandate.assumptions.some((assumption) => assumption.key === key)) {
        return fail(404, "ASSUMPTION_NOT_FOUND", "Protected assumption was not found");
      }
      await client.query(
        `UPDATE mandate_assumption_state
            SET value_hash = $3, source = $4, updated_at = $5
          WHERE mandate_id = $1 AND key = $2`,
        [mandateId, key, valueHash, `principal:${identity.id}`, now],
      );
    });
  }

  async startExecution(
    identity: AuthenticatedIdentity,
    mandateId: string,
    executionId: string,
    now = new Date().toISOString(),
  ): Promise<{ id: string; mandateId: string; mandateVersion: number; startedAt: string }> {
    if (identity.kind !== "agent") return fail(403, "AGENT_REQUIRED", "An agent credential is required");
    return this.transaction(async (client) => {
      const current = await this.loadMandate(client, mandateId, identity, true);
      const existing = await client.query<ExecutionRow>("SELECT * FROM executions WHERE id = $1", [executionId]);
      const row = existing.rows[0];
      if (row) {
        if (
          row.mandate_id !== mandateId
          || row.mandate_version !== current.mandate.version
          || row.subject_id !== identity.id
        ) {
          return fail(409, "EXECUTION_ID_REUSED", "Execution ID is already bound to different authority");
        }
        return {
          id: row.id,
          mandateId: row.mandate_id,
          mandateVersion: row.mandate_version,
          startedAt: iso(row.started_at),
        };
      }
      if (current.mandate.status !== "ACTIVE") {
        return fail(409, "MANDATE_NOT_ACTIVE", "Only an active Mandate can start execution");
      }
      await client.query(
        `INSERT INTO executions (id, mandate_id, mandate_version, subject_id, started_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [executionId, mandateId, current.mandate.version, identity.id, now],
      );
      return { id: executionId, mandateId, mandateVersion: current.mandate.version, startedAt: now };
    });
  }

  private async lockedExecution(
    client: PoolClient,
    executionId: string,
    identity: Extract<AuthenticatedIdentity, { kind: "agent" }>,
  ): Promise<{ execution: ExecutionRow; mandate: Mandate; versionDigest: string }> {
    const reference = await client.query<{ mandate_id: string }>(
      "SELECT mandate_id FROM executions WHERE id = $1",
      [executionId],
    );
    const mandateId = reference.rows[0]?.mandate_id;
    if (!mandateId) return fail(404, "EXECUTION_NOT_FOUND", "Execution was not found");
    const current = await this.loadMandate(client, mandateId, identity, true);
    const result = await client.query<ExecutionRow>("SELECT * FROM executions WHERE id = $1 FOR UPDATE", [executionId]);
    const execution = result.rows[0];
    if (!execution || execution.subject_id !== identity.id) {
      return fail(404, "EXECUTION_NOT_FOUND", "Execution was not found for this agent");
    }
    if (execution.finished_at) return fail(409, "EXECUTION_FINISHED", "Execution is already finished");
    if (execution.mandate_version !== current.mandate.version) {
      return fail(409, "STALE_EXECUTION", "Execution is bound to a stale Mandate version");
    }
    return { execution, mandate: current.mandate, versionDigest: current.versionDigest };
  }

  private async storedAuthorization(client: SqlClient, actionId: string): Promise<AuthorizationResponse> {
    const result = await client.query<{
      decision: ConformanceDecision;
      reasons: string[];
      violated_rules: string[];
      amendment_suggested: boolean;
      mandate_version_digest: string;
    }>(
      `SELECT decision, reasons, violated_rules, amendment_suggested, mandate_version_digest
         FROM authorization_decisions
        WHERE action_id = $1`,
      [actionId],
    );
    const row = result.rows[0];
    if (!row) return fail(500, "DATA_INTEGRITY", "Action has no authorization decision");
    return {
      decision: row.decision,
      reasons: row.reasons,
      violatedRules: row.violated_rules,
      amendmentSuggested: row.amendment_suggested,
      mandateVersionDigest: row.mandate_version_digest,
    };
  }

  async authorizeAction(
    identity: AuthenticatedIdentity,
    executionId: string,
    input: AuthorizeActionInput,
    now = new Date().toISOString(),
  ): Promise<AuthorizationResponse> {
    if (identity.kind !== "agent") return fail(403, "AGENT_REQUIRED", "An agent credential is required");
    const requestDigest = sha256Digest(input);
    return this.transaction(async (client) => {
      const current = await this.lockedExecution(client, executionId, identity);
      const existing = await client.query<{
        execution_id: string;
        request_digest: string;
      }>("SELECT execution_id, request_digest FROM execution_actions WHERE id = $1", [input.proposedAction.actionId]);
      const existingAction = existing.rows[0];
      if (existingAction) {
        if (existingAction.execution_id !== executionId || existingAction.request_digest !== requestDigest) {
          return fail(409, "ACTION_ID_REUSED", "Action ID was replayed with different content or execution");
        }
        return this.storedAuthorization(client, input.proposedAction.actionId);
      }

      const assumptions = await this.currentAssumptions(client, current.mandate.id);
      const eventHistory = await this.events(client, current.mandate.id);
      const result = evaluateConformance({
        mandate: current.mandate,
        subject: {
          agentId: identity.id,
          runtime: identity.runtime,
          ...(identity.instanceId ? { instanceId: identity.instanceId } : {}),
        },
        proposedAction: input.proposedAction,
        normalizedEffects: input.normalizedEffects,
        executionState: {
          startedAt: iso(current.execution.started_at),
          monetarySpentUsd: safeInteger(current.execution.monetary_spent_micro_usd, "monetary_spent_micro_usd") / 1_000_000,
          tokensUsed: safeInteger(current.execution.tokens_used, "tokens_used"),
          mutationActions: current.execution.mutation_actions,
          externalCallActions: current.execution.external_call_actions,
          delegationDepth: current.execution.delegation_depth,
        },
        eventHistory,
        currentAssumptions: assumptions,
        now,
        ...(input.projectedTokens === undefined ? {} : { projectedTokens: input.projectedTokens }),
        ...(input.semanticDecision ? { semanticDecision: input.semanticDecision } : {}),
      });
      const status = result.decision === "ALLOW" ? "AUTHORIZED" : result.decision;
      await client.query(
        `INSERT INTO execution_actions
          (id, execution_id, tool, operation, inputs, request_digest, status, proposed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          input.proposedAction.actionId,
          executionId,
          input.proposedAction.tool,
          input.proposedAction.operation,
          jsonb(input.proposedAction.inputs),
          requestDigest,
          status,
          now,
        ],
      );
      for (const [index, effect] of input.normalizedEffects.entries()) {
        await client.query(
          `INSERT INTO execution_effects
            (id, action_id, type, resources, environment, reversible, confidence, estimated_cost_micro_usd)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            deterministicId("effect", { actionId: input.proposedAction.actionId, index, effect }),
            input.proposedAction.actionId,
            effect.type,
            jsonb(effect.resources),
            effect.environment ?? null,
            effect.reversible,
            effect.confidence.toFixed(3),
            effect.estimatedCostUsd === undefined ? null : microUsd(effect.estimatedCostUsd).toString(),
          ],
        );
      }
      const authorizationId = deterministicId("authorization", {
        actionId: input.proposedAction.actionId,
        requestDigest,
      });
      await client.query(
        `INSERT INTO authorization_decisions
          (id, action_id, decision, reasons, violated_rules, amendment_suggested,
           mandate_version_digest, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          authorizationId,
          input.proposedAction.actionId,
          result.decision,
          jsonb(result.reasons),
          jsonb(result.violatedRules),
          result.amendmentSuggested ?? false,
          current.versionDigest,
          now,
        ],
      );

      await this.appendLedgerEvent(
        client,
        current.mandate,
        "ACTION_PROPOSED",
        `agent:${identity.id}`,
        { actionId: input.proposedAction.actionId, requestDigest },
        now,
      );
      await this.appendLedgerEvent(
        client,
        current.mandate,
        "EFFECT_CLASSIFIED",
        `agent:${identity.id}`,
        { actionId: input.proposedAction.actionId, effectTypes: input.normalizedEffects.map((effect) => effect.type) },
        now,
      );
      const decisionEvent: MandateEventType = result.decision === "ALLOW"
        ? "ACTION_ALLOWED"
        : result.decision === "DENY"
          ? "ACTION_DENIED"
          : result.decision === "ESCALATE"
            ? "ACTION_ESCALATED"
            : "APPROVAL_INVALIDATED";
      if (result.decision === "INVALIDATE_APPROVAL") {
        await client.query("UPDATE mandates SET status = 'SUSPENDED' WHERE id = $1", [current.mandate.id]);
      }
      await this.appendLedgerEvent(
        client,
        current.mandate,
        decisionEvent,
        `agent:${identity.id}`,
        { actionId: input.proposedAction.actionId, decision: result.decision, authorizationId },
        now,
      );
      return {
        decision: result.decision,
        reasons: result.reasons,
        violatedRules: result.violatedRules,
        amendmentSuggested: result.amendmentSuggested ?? false,
        mandateVersionDigest: current.versionDigest,
      };
    });
  }

  async settleAction(
    identity: AuthenticatedIdentity,
    executionId: string,
    actionId: string,
    input: SettleActionInput,
    now = new Date().toISOString(),
  ): Promise<{ status: "EXECUTED" | "FAILED"; evidence: Record<string, unknown> }> {
    if (identity.kind !== "agent") return fail(403, "AGENT_REQUIRED", "An agent credential is required");
    const settlementDigest = sha256Digest(input);
    return this.transaction(async (client) => {
      const current = await this.lockedExecution(client, executionId, identity);
      const actionResult = await client.query<{
        execution_id: string;
        status: string;
        settlement_digest: string | null;
        decision: ConformanceDecision;
      }>(
        `SELECT action.execution_id, action.status, action.settlement_digest, decision.decision
           FROM execution_actions AS action
           JOIN authorization_decisions AS decision ON decision.action_id = action.id
          WHERE action.id = $1
          FOR UPDATE OF action`,
        [actionId],
      );
      const action = actionResult.rows[0];
      if (!action || action.execution_id !== executionId) {
        return fail(404, "ACTION_NOT_FOUND", "Action was not found for this execution");
      }
      if (action.settlement_digest) {
        if (action.settlement_digest !== settlementDigest) {
          return fail(409, "SETTLEMENT_REPLAY", "Action settlement was replayed with different content");
        }
        const existing = await client.query<QueryResultRow>(
          "SELECT * FROM evidence WHERE execution_action_id = $1 ORDER BY created_at LIMIT 1",
          [actionId],
        );
        const evidence = existing.rows[0];
        if (!evidence) return fail(500, "DATA_INTEGRITY", "Settled action has no evidence");
        return {
          status: action.status === "EXECUTED" ? "EXECUTED" : "FAILED",
          evidence: mapEvidenceRow(evidence),
        };
      }
      if (action.decision !== "ALLOW" || action.status !== "AUTHORIZED") {
        return fail(409, "ACTION_NOT_AUTHORIZED", "Only an allowed unsettled action can be settled");
      }
      const effectResult = await client.query<{ type: string }>(
        "SELECT type FROM execution_effects WHERE action_id = $1",
        [actionId],
      );
      const effectTypes = new Set(effectResult.rows.map((row) => row.type));
      const mutation = [
        "CODE_MODIFICATION",
        "TEST_MODIFICATION",
        "DEPENDENCY_MODIFICATION",
        "BRANCH_CREATION",
        "DATABASE_SCHEMA_MUTATION",
        "PRODUCTION_DEPLOYMENT",
        "SECRET_WRITE",
      ].some((type) => effectTypes.has(type));
      const external = effectTypes.has("NETWORK_REQUEST");
      const status = input.outcome === "SUCCEEDED" ? "EXECUTED" : "FAILED";
      const evidence = {
        id: input.evidence.id,
        mandateId: current.mandate.id,
        mandateVersion: current.mandate.version,
        requirementId: input.evidence.requirementId ?? null,
        executionActionId: actionId,
        type: input.evidence.type,
        producer: `agent:${identity.id}`,
        artifactUri: input.evidence.artifactUri ?? null,
        digest: input.evidence.digest ?? null,
        verified: false,
        verifiedBy: null,
        createdAt: now,
      };
      await client.query(
        `INSERT INTO evidence
          (id, mandate_id, mandate_version, requirement_id, execution_action_id,
           type, producer, artifact_uri, digest, verified, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10)`,
        [
          evidence.id,
          evidence.mandateId,
          evidence.mandateVersion,
          input.evidence.requirementId ?? null,
          actionId,
          evidence.type,
          evidence.producer,
          input.evidence.artifactUri ?? null,
          input.evidence.digest ?? null,
          now,
        ],
      );
      await client.query(
        `UPDATE execution_actions
            SET status = $2, settlement_digest = $3, executed_at = $4
          WHERE id = $1`,
        [actionId, status, settlementDigest, now],
      );
      await client.query(
        `UPDATE executions
            SET monetary_spent_micro_usd = monetary_spent_micro_usd + $2,
                tokens_used = tokens_used + $3,
                mutation_actions = mutation_actions + $4,
                external_call_actions = external_call_actions + $5
          WHERE id = $1`,
        [
          executionId,
          microUsd(input.usage.monetarySpentUsd).toString(),
          input.usage.tokensUsed,
          mutation ? 1 : 0,
          external ? 1 : 0,
        ],
      );
      await this.appendLedgerEvent(
        client,
        current.mandate,
        "ACTION_EXECUTED",
        `agent:${identity.id}`,
        { actionId, outcome: input.outcome, settlementDigest },
        now,
      );
      await this.appendLedgerEvent(
        client,
        current.mandate,
        "EVIDENCE_ADDED",
        `agent:${identity.id}`,
        { actionId, evidenceId: evidence.id, verified: false },
        now,
      );
      return { status, evidence };
    });
  }

  async getMandateContext(identity: AuthenticatedIdentity, mandateId: string): Promise<Record<string, unknown>> {
    const current = await this.loadMandate(this.pool, mandateId, identity, false);
    const [approval, execution, amendments, evidence, events] = await Promise.all([
      this.pool.query<QueryResultRow>(
        `SELECT id, principal_id, approved_at, version_digest
           FROM mandate_approvals
          WHERE mandate_id = $1 AND mandate_version = $2
          ORDER BY approved_at DESC
          LIMIT 1`,
        [mandateId, current.mandate.version],
      ),
      this.pool.query<ExecutionRow>(
        `SELECT * FROM executions
          WHERE mandate_id = $1 AND mandate_version = $2
          ORDER BY started_at DESC
          LIMIT 1`,
        [mandateId, current.mandate.version],
      ),
      this.pool.query<QueryResultRow>(
        `SELECT id, base_version, base_version_digest, proposal, status, created_at, decided_at, decided_by
           FROM mandate_amendments
          WHERE mandate_id = $1
          ORDER BY created_at`,
        [mandateId],
      ),
      this.pool.query<QueryResultRow>(
        `SELECT id, requirement_id, execution_action_id, type, producer, artifact_uri,
                digest, verified, verified_by, created_at
           FROM evidence
          WHERE mandate_id = $1 AND mandate_version = $2
          ORDER BY created_at`,
        [mandateId, current.mandate.version],
      ),
      this.events(this.pool, mandateId),
    ]);
    const executionRow = execution.rows[0];
    const [actions, effects] = executionRow
      ? await Promise.all([
          this.pool.query<QueryResultRow>(
            `SELECT action.id, action.tool, action.operation, action.status,
                    action.proposed_at, action.executed_at,
                    decision.decision, decision.reasons, decision.violated_rules,
                    decision.amendment_suggested
               FROM execution_actions AS action
               JOIN authorization_decisions AS decision ON decision.action_id = action.id
              WHERE action.execution_id = $1
              ORDER BY action.proposed_at, action.id`,
            [executionRow.id],
          ),
          this.pool.query<QueryResultRow>(
            `SELECT effect.action_id, effect.type, effect.resources, effect.environment,
                    effect.reversible, effect.confidence, effect.estimated_cost_micro_usd
               FROM execution_effects AS effect
               JOIN execution_actions AS action ON action.id = effect.action_id
              WHERE action.execution_id = $1
              ORDER BY action.proposed_at, effect.id`,
            [executionRow.id],
          ),
        ])
      : [{ rows: [] as QueryResultRow[] }, { rows: [] as QueryResultRow[] }];
    const effectsByAction = new Map<string, Record<string, unknown>[]>();
    for (const effect of effects.rows) {
      const item = {
        type: effect.type,
        resources: effect.resources,
        environment: effect.environment ?? null,
        reversible: effect.reversible,
        confidence: Number(effect.confidence),
        estimatedCostMicroUsd: effect.estimated_cost_micro_usd === null
          ? null
          : safeInteger(effect.estimated_cost_micro_usd, "estimated_cost_micro_usd"),
      };
      const list = effectsByAction.get(effect.action_id as string) ?? [];
      list.push(item);
      effectsByAction.set(effect.action_id as string, list);
    }
    const approvalRow = approval.rows[0];
    return {
      mandate: current.mandate,
      versionDigest: current.versionDigest,
      approval: approvalRow
        ? {
            id: approvalRow.id,
            principalId: approvalRow.principal_id,
            approvedAt: iso(approvalRow.approved_at),
            versionDigest: approvalRow.version_digest,
          }
        : null,
      execution: executionRow
        ? {
            id: executionRow.id,
            startedAt: iso(executionRow.started_at),
            finishedAt: executionRow.finished_at ? iso(executionRow.finished_at) : null,
            monetarySpentMicroUsd: safeInteger(executionRow.monetary_spent_micro_usd, "monetary_spent_micro_usd"),
            tokensUsed: safeInteger(executionRow.tokens_used, "tokens_used"),
            mutationActions: executionRow.mutation_actions,
            externalCallActions: executionRow.external_call_actions,
            actions: actions.rows.map((action) => ({
              id: action.id,
              tool: action.tool,
              operation: action.operation,
              status: action.status,
              proposedAt: iso(action.proposed_at),
              executedAt: action.executed_at ? iso(action.executed_at) : null,
              decision: action.decision,
              reasons: action.reasons,
              violatedRules: action.violated_rules,
              amendmentSuggested: action.amendment_suggested,
              effects: effectsByAction.get(action.id as string) ?? [],
            })),
          }
        : null,
      amendments: amendments.rows.map((amendment) => ({
        id: amendment.id,
        baseVersion: amendment.base_version,
        baseVersionDigest: amendment.base_version_digest,
        proposal: amendment.proposal,
        status: amendment.status,
        createdAt: iso(amendment.created_at),
        decidedAt: amendment.decided_at ? iso(amendment.decided_at) : null,
        decidedBy: amendment.decided_by,
      })),
      evidence: evidence.rows.map(mapEvidenceRow),
      events,
    };
  }
}
