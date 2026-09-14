import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";
import type { Mandate } from "../../packages/protocol/src/index.js";
import { verifyEventChain } from "../../packages/runtime/src/index.js";
import {
  ControlPlaneRepository,
  createControlPlaneHandler,
  hashCredential,
} from "../../apps/api/src/index.js";

const connectionString = process.env.MANDATE_INTEGRATION_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

function checkoutDraft(suffix: string, principalId: string, agentId: string): Mandate {
  const path = fileURLToPath(new URL("../fixtures/protocol-v0.1/valid-checkout-mandate.json", import.meta.url));
  const fixture = JSON.parse(readFileSync(path, "utf8")) as { input: Mandate };
  const now = Date.now();
  const mandate = structuredClone(fixture.input);
  mandate.id = `M-api-${suffix}`;
  mandate.principal.id = principalId;
  mandate.subject.agentId = agentId;
  mandate.subject.instanceId = `run-${suffix}`;
  mandate.createdAt = new Date(now - 60_000).toISOString();
  mandate.validity.notBefore = new Date(now - 3_600_000).toISOString();
  mandate.validity.expiresAt = new Date(now + 3_600_000).toISOString();
  mandate.status = "DRAFT";
  delete mandate.approvedAt;
  return mandate;
}

integration("authenticated control plane", () => {
  it("persists a fail-closed AgentOS authorization flow transactionally", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const principalId = `principal-${suffix}`;
    const agentId = `agent-${suffix}`;
    const principalToken = `mandate_${randomBytes(32).toString("base64url")}`;
    const agentToken = `mandate_${randomBytes(32).toString("base64url")}`;
    const identity = { kind: "principal", id: principalId, principalType: "human" } as const;
    const pool = new pg.Pool({ connectionString, max: 3 });

    try {
      await pool.query("INSERT INTO principals (id, type) VALUES ($1, 'human')", [principalId]);
      await pool.query(
        "INSERT INTO agents (id, runtime, instance_id) VALUES ($1, 'agentos', $2)",
        [agentId, `run-${suffix}`],
      );
      await pool.query(
        "INSERT INTO control_plane_credentials (id, token_hash, principal_id) VALUES ($1, $2, $3)",
        [`credential-principal-${suffix}`, hashCredential(principalToken), principalId],
      );
      await pool.query(
        "INSERT INTO control_plane_credentials (id, token_hash, agent_id) VALUES ($1, $2, $3)",
        [`credential-agent-${suffix}`, hashCredential(agentToken), agentId],
      );

      const repository = new ControlPlaneRepository(pool);
      await pool.query(
        "INSERT INTO oauth_subjects (authorization_server, subject, principal_id) VALUES ($1, $2, $3)",
        ["https://auth.example/", `subject-${suffix}`, principalId],
      );
      await expect(repository.resolveOAuthSubject("https://auth.example/", `subject-${suffix}`)).resolves.toEqual(identity);
      await expect(repository.resolveOAuthSubject("https://auth.example/", "unknown-subject"))
        .rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
      const handler = createControlPlaneHandler(repository, (error) => {
        throw error;
      });
      const call = async (
        method: string,
        path: string,
        token?: string,
        requestBody?: unknown,
      ): Promise<{ response: Response; json: Record<string, any> }> => {
        const response = await handler(new Request(`https://control.mandate.test${path}`, {
          method,
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(requestBody === undefined ? {} : { "content-type": "application/json" }),
          },
          ...(requestBody === undefined ? {} : { body: JSON.stringify(requestBody) }),
        }));
        return { response, json: await response.json() as Record<string, any> };
      };

      expect((await call("GET", `/v1/mandates/missing`, "invalid-token-that-is-long-enough-1234567890")).response.status).toBe(401);

      const draft = checkoutDraft(suffix, principalId, agentId);
      expect((await call("POST", "/v1/mandates", principalToken, draft)).response.status).toBe(201);
      expect((await call("POST", `/v1/mandates/${draft.id}/transitions`, principalToken, { to: "PROPOSED" })).response.status).toBe(200);
      expect((await call("POST", `/v1/mandates/${draft.id}/transitions`, principalToken, { to: "AWAITING_APPROVAL" })).response.status).toBe(200);

      const legacyApproval = await call("POST", `/v1/mandates/${draft.id}/approvals`, principalToken, { nonce: `nonce-${suffix}` });
      expect(legacyApproval).toMatchObject({ response: { status: 409 }, json: { error: { code: "APPROVAL_CHALLENGE_REQUIRED" } } });

      const superseded = await repository.createMandateApprovalChallenge(identity, draft.id, "external-review");
      const challenge = await repository.createMandateApprovalChallenge(identity, draft.id, "external-review");
      await expect(repository.decideMandateApprovalChallenge(
        identity,
        superseded.id,
        superseded.nonce,
        "APPROVE",
      )).rejects.toMatchObject({ status: 409, code: "APPROVAL_CHALLENGE_USED" });
      await expect(repository.decideMandateApprovalChallenge(
        identity,
        challenge.id,
        `approval_${"x".repeat(43)}`,
        "APPROVE",
      )).rejects.toMatchObject({ status: 404, code: "APPROVAL_CHALLENGE_NOT_FOUND" });
      const approval = await repository.decideMandateApprovalChallenge(
        identity,
        challenge.id,
        challenge.nonce,
        "APPROVE",
      );
      expect(approval.mandate.status).toBe("ACTIVE");
      await expect(repository.decideMandateApprovalChallenge(
        identity,
        challenge.id,
        challenge.nonce,
        "APPROVE",
      )).rejects.toMatchObject({ status: 409, code: "APPROVAL_CHALLENGE_USED" });

      const executionId = `execution-${suffix}`;
      expect((await call("POST", `/v1/mandates/${draft.id}/executions`, agentToken, { executionId })).response.status).toBe(201);

      const allowedRequest = {
        proposedAction: {
          actionId: `action-read-${suffix}`,
          tool: "filesystem",
          operation: "readFile",
          inputs: { path: "services/checkout/payments/stripe.ts" },
        },
        normalizedEffects: [{
          type: "CODE_READ",
          resources: ["repository://checkout-demo/services/checkout/payments/stripe.ts"],
          environment: "local",
          reversible: true,
          confidence: 1,
        }],
      };
      const allowed = await call("POST", `/v1/executions/${executionId}/actions/authorize`, agentToken, allowedRequest);
      expect(allowed.json).toMatchObject({ decision: "ALLOW", amendmentSuggested: false });
      expect((await call("POST", `/v1/executions/${executionId}/actions/authorize`, agentToken, allowedRequest)).json.decision).toBe("ALLOW");

      const replay = structuredClone(allowedRequest);
      replay.proposedAction.operation = "writeFile";
      expect((await call("POST", `/v1/executions/${executionId}/actions/authorize`, agentToken, replay)).response.status).toBe(409);

      const settlement = {
        outcome: "SUCCEEDED",
        usage: { monetarySpentUsd: 0, tokensUsed: 0 },
        evidence: { id: `evidence-trace-${suffix}`, type: "trace" },
      };
      const settled = await call(
        "POST",
        `/v1/executions/${executionId}/actions/${allowedRequest.proposedAction.actionId}/settle`,
        agentToken,
        settlement,
      );
      expect(settled.json).toMatchObject({ status: "EXECUTED", evidence: { verified: false } });
      expect((await call(
        "POST",
        `/v1/executions/${executionId}/actions/${allowedRequest.proposedAction.actionId}/settle`,
        agentToken,
        settlement,
      )).json.status).toBe("EXECUTED");

      const denied = await call("POST", `/v1/executions/${executionId}/actions/authorize`, agentToken, {
        proposedAction: {
          actionId: `action-database-${suffix}`,
          tool: "shell",
          operation: "execute",
          inputs: { command: "drizzle-kit push" },
        },
        normalizedEffects: [{
          type: "DATABASE_SCHEMA_MUTATION",
          resources: ["database://checkout-db"],
          environment: "test",
          reversible: false,
          confidence: 1,
        }],
      });
      expect(denied.json).toMatchObject({ decision: "DENY", amendmentSuggested: true });

      const changedHash = `sha256:${"b".repeat(64)}`;
      expect((await call(
        "PUT",
        `/v1/mandates/${draft.id}/assumptions/repositoryCommit`,
        principalToken,
        { valueHash: changedHash },
      )).response.status).toBe(200);
      const invalidated = await call("POST", `/v1/executions/${executionId}/actions/authorize`, agentToken, {
        ...allowedRequest,
        proposedAction: { ...allowedRequest.proposedAction, actionId: `action-stale-${suffix}` },
      });
      expect(invalidated.json.decision).toBe("INVALIDATE_APPROVAL");

      const context = await call("GET", `/v1/mandates/${draft.id}`, principalToken);
      expect(context.response.status).toBe(200);
      expect(context.json.mandate.status).toBe("SUSPENDED");
      expect(context.json.execution.actions).toHaveLength(3);
      expect(context.json.evidence).toHaveLength(1);
      expect(verifyEventChain(context.json.events)).toBe(true);
      const mcpContext = await repository.getMcpMandateContext(identity, draft.id) as Record<string, any>;
      expect(mcpContext).toMatchObject({
        mandate: { id: draft.id, status: "SUSPENDED" },
        execution: { actions: [{ decision: "ALLOW" }, { decision: "DENY" }, { decision: "INVALIDATE_APPROVAL" }] },
        evidenceSummary: { records: 1, independentlyVerified: 0 },
      });
      const authenticatedMcp = await repository.authenticateMcpMandateContext(principalToken, draft.id);
      expect(authenticatedMcp).toMatchObject({
        identity: { kind: "principal", id: principalId, principalType: "human" },
        context: { mandate: { id: draft.id }, evidenceSummary: { records: 1 } },
      });
      await expect(repository.authenticateMcpMandateContext("invalid-token-that-is-long-enough-1234567890", draft.id))
        .rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    } finally {
      await pool.end();
    }
  }, 30_000);

  it("prepares one awaiting-approval Mandate per principal idempotency key", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const principalId = `principal-${suffix}`;
    const agentId = `agent-${suffix}`;
    const pool = new pg.Pool({ connectionString, max: 2 });
    const repository = new ControlPlaneRepository(pool);
    const identity = { kind: "principal", id: principalId, principalType: "human" } as const;
    try {
      await pool.query("INSERT INTO principals (id, type) VALUES ($1, 'human')", [principalId]);
      await pool.query(
        "INSERT INTO agents (id, runtime, instance_id) VALUES ($1, 'agentos', $2)",
        [agentId, `run-${suffix}`],
      );
      const draft = checkoutDraft(suffix, principalId, agentId);
      const requestDigest = `sha256:${"c".repeat(64)}`;
      const first = await repository.prepareAgentWork(identity, draft, `request-${suffix}`, requestDigest);
      expect(first.mandate.status).toBe("AWAITING_APPROVAL");
      const replay = await repository.prepareAgentWork(identity, draft, `request-${suffix}`, requestDigest);
      expect(replay).toMatchObject({ mandate: { id: draft.id, status: "AWAITING_APPROVAL" }, versionDigest: first.versionDigest });
      await expect(repository.prepareAgentWork(
        identity,
        draft,
        `request-${suffix}`,
        `sha256:${"d".repeat(64)}`,
      )).rejects.toMatchObject({ status: 409, code: "WORK_REQUEST_REPLAY" });
      const events = await pool.query("SELECT type FROM mandate_events WHERE mandate_id = $1 ORDER BY sequence", [draft.id]);
      expect(events.rows.map(({ type }) => type)).toEqual([
        "MANDATE_CREATED",
        "MANDATE_PROPOSED",
        "MANDATE_APPROVAL_REQUESTED",
      ]);
    } finally {
      await pool.end();
    }
  }, 30_000);

  it("accepts only bound verifier evidence and completes after all requirements pass", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const principalId = `principal-${suffix}`;
    const agentId = `agent-${suffix}`;
    const principalToken = `mandate_${randomBytes(32).toString("base64url")}`;
    const agentToken = `mandate_${randomBytes(32).toString("base64url")}`;
    const testVerifierToken = `mandate_${randomBytes(32).toString("base64url")}`;
    const reviewVerifierToken = `mandate_${randomBytes(32).toString("base64url")}`;
    const identity = { kind: "principal", id: principalId, principalType: "human" } as const;
    const pool = new pg.Pool({ connectionString, max: 3 });

    try {
      await pool.query("INSERT INTO principals (id, type) VALUES ($1, 'human'), ('verifier:test-runner', 'service'), ('verifier:independent-review', 'service') ON CONFLICT (id) DO NOTHING", [principalId]);
      await pool.query("INSERT INTO agents (id, runtime, instance_id) VALUES ($1, 'agentos', $2)", [agentId, `run-${suffix}`]);
      for (const [credentialId, token, column, identityId] of [
        [`credential-principal-${suffix}`, principalToken, "principal_id", principalId],
        [`credential-agent-${suffix}`, agentToken, "agent_id", agentId],
        [`credential-test-verifier-${suffix}`, testVerifierToken, "principal_id", "verifier:test-runner"],
        [`credential-review-verifier-${suffix}`, reviewVerifierToken, "principal_id", "verifier:independent-review"],
      ] as const) {
        await pool.query(
          `INSERT INTO control_plane_credentials (id, token_hash, ${column}) VALUES ($1, $2, $3)`,
          [credentialId, hashCredential(token), identityId],
        );
      }
      const repository = new ControlPlaneRepository(pool);
      const handler = createControlPlaneHandler(repository, (error) => { throw error; });
      const call = async (method: string, path: string, token: string, requestBody?: unknown) => {
        const response = await handler(new Request(`https://control.mandate.test${path}`, {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            ...(requestBody === undefined ? {} : { "content-type": "application/json" }),
          },
          ...(requestBody === undefined ? {} : { body: JSON.stringify(requestBody) }),
        }));
        return { response, json: await response.json() as Record<string, any> };
      };
      const draft = checkoutDraft(suffix, principalId, agentId);
      await call("POST", "/v1/mandates", principalToken, draft);
      await call("POST", `/v1/mandates/${draft.id}/transitions`, principalToken, { to: "PROPOSED" });
      await call("POST", `/v1/mandates/${draft.id}/transitions`, principalToken, { to: "AWAITING_APPROVAL" });
      const challenge = await repository.createMandateApprovalChallenge(identity, draft.id, "external-review");
      await repository.decideMandateApprovalChallenge(identity, challenge.id, challenge.nonce, "APPROVE");
      const executionId = `execution-verification-${suffix}`;
      await call("POST", `/v1/mandates/${draft.id}/executions`, agentToken, { executionId });

      const testVerification = {
        evidence: {
          id: `evidence-test-${suffix}`,
          requirementId: "test-report",
          type: "test-report",
          artifactUri: `s3://verification/${suffix}/tests.txt`,
          digest: `sha256:${"c".repeat(64)}`,
        },
        criteria: [
          { criterionId: "checkout-tests", status: "PASS" },
          { criterionId: "regression-tests", status: "PASS" },
        ],
      };
      expect((await call("POST", `/v1/executions/${executionId}/verifications`, reviewVerifierToken, testVerification)).response.status).toBe(403);
      const tests = await call("POST", `/v1/executions/${executionId}/verifications`, testVerifierToken, testVerification);
      expect(tests.response.status).toBe(201);
      expect(tests.json.completion.completed).toBe(false);

      const reviewVerification = {
        evidence: {
          id: `evidence-review-${suffix}`,
          requirementId: "review-report",
          type: "review",
          artifactUri: `s3://verification/${suffix}/review.txt`,
          digest: `sha256:${"d".repeat(64)}`,
        },
        criteria: [{ criterionId: "independent-review", status: "PASS" }],
      };
      const review = await call("POST", `/v1/executions/${executionId}/verifications`, reviewVerifierToken, reviewVerification);
      expect(review.response.status).toBe(201);
      expect(review.json.completion).toEqual({ completed: true, reasons: [] });
      expect((await call("POST", `/v1/executions/${executionId}/verifications`, reviewVerifierToken, reviewVerification)).json.completion.completed).toBe(true);
      expect((await call("POST", `/v1/executions/${executionId}/verifications`, reviewVerifierToken, {
        ...reviewVerification,
        criteria: [{ criterionId: "independent-review", status: "FAIL" }],
      })).response.status).toBe(409);

      const context = await call("GET", `/v1/mandates/${draft.id}`, principalToken);
      expect(context.json.mandate.status).toBe("COMPLETED");
      expect(context.json.execution.finishedAt).toBeTruthy();
      expect(context.json.evidence.filter((item: { verified: boolean }) => item.verified)).toHaveLength(2);
      expect(context.json.events.at(-1).type).toBe("MANDATE_COMPLETED");
      expect(verifyEventChain(context.json.events)).toBe(true);
    } finally {
      await pool.end();
    }
  }, 30_000);
});
