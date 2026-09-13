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

      const handler = createControlPlaneHandler(new ControlPlaneRepository(pool), (error) => {
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

      const approval = await call("POST", `/v1/mandates/${draft.id}/approvals`, principalToken, { nonce: `nonce-${suffix}` });
      expect(approval.response.status).toBe(201);
      expect(approval.json.mandate.status).toBe("ACTIVE");

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
    } finally {
      await pool.end();
    }
  }, 30_000);
});
