import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const databaseUrl = required("DATABASE_URL");
const controlPlaneUrl = new URL(required("MANDATE_CONTROL_PLANE_URL"));
const principalToken = required("MANDATE_DEMO_PRINCIPAL_TOKEN");
const agentToken = required("MANDATE_DEMO_AGENT_TOKEN");
const principalId = "mandate-demo-principal";
const agentId = "agentos-checkout";
const mandateId = "M-checkout-live-001";
const executionId = "execution-checkout-live-001";
const hash = (token) => `sha256:${createHash("sha256").update(token, "utf8").digest("hex")}`;
const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();
try {
  await client.query("BEGIN");
  await client.query(
    "INSERT INTO principals (id, type) VALUES ($1, 'human') ON CONFLICT (id) DO NOTHING",
    [principalId],
  );
  await client.query(
    `INSERT INTO agents (id, runtime, instance_id)
     VALUES ($1, 'agentos', 'run-001')
     ON CONFLICT (id) DO NOTHING`,
    [agentId],
  );
  const identities = await client.query(
    `SELECT
       (SELECT type FROM principals WHERE id = $1) AS principal_type,
       (SELECT runtime FROM agents WHERE id = $2) AS agent_runtime,
       (SELECT instance_id FROM agents WHERE id = $2) AS agent_instance`,
    [principalId, agentId],
  );
  const identity = identities.rows[0];
  if (identity?.principal_type !== "human" || identity?.agent_runtime !== "agentos" || identity?.agent_instance !== "run-001") {
    throw new Error("Existing demo identity does not match the reviewed binding");
  }
  for (const credential of [
    { id: "credential-demo-principal", token: principalToken, principal: principalId, agent: null },
    { id: "credential-demo-agent", token: agentToken, principal: null, agent: agentId },
  ]) {
    const saved = await client.query(
      `INSERT INTO control_plane_credentials
        (id, token_hash, principal_id, agent_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET token_hash = EXCLUDED.token_hash,
             revoked_at = NULL,
             expires_at = NULL
       RETURNING principal_id, agent_id`,
      [
        credential.id,
        hash(credential.token),
        credential.principal,
        credential.agent,
      ],
    );
    const binding = saved.rows[0];
    if (binding?.principal_id !== credential.principal || binding?.agent_id !== credential.agent) {
      throw new Error("Existing demo credential has a different identity binding");
    }
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

const api = async (method, path, token, body) => {
  const response = await fetch(new URL(path, controlPlaneUrl), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "error",
  });
  const result = await response.json();
  return { response, result };
};

let context = await api("GET", `/v1/mandates/${mandateId}`, principalToken);
if (context.response.status === 404) {
  const fixture = JSON.parse(await readFile(
    new URL("../../../tests/fixtures/protocol-v0.1/valid-checkout-mandate.json", import.meta.url),
    "utf8",
  )).input;
  const now = Date.now();
  fixture.id = mandateId;
  fixture.principal = { type: "human", id: principalId };
  fixture.subject = { agentId, runtime: "agentos", instanceId: "run-001" };
  fixture.createdAt = new Date(now).toISOString();
  fixture.validity.notBefore = new Date(now - 60_000).toISOString();
  fixture.validity.expiresAt = new Date(now + 180 * 24 * 60 * 60 * 1_000).toISOString();
  fixture.status = "DRAFT";
  delete fixture.approvedAt;
  const created = await api("POST", "/v1/mandates", principalToken, fixture);
  if (created.response.status !== 201) throw new Error(`Demo Mandate creation failed (${created.response.status})`);
  context = await api("GET", `/v1/mandates/${mandateId}`, principalToken);
}
if (!context.response.ok) throw new Error(`Demo Mandate lookup failed (${context.response.status})`);
if (context.result.mandate?.principal?.id !== principalId || context.result.mandate?.subject?.agentId !== agentId) {
  throw new Error("Existing demo Mandate has a different identity binding");
}

let status = context.result.mandate.status;
for (const transition of ["PROPOSED", "AWAITING_APPROVAL"]) {
  if (status === (transition === "PROPOSED" ? "DRAFT" : "PROPOSED")) {
    const changed = await api("POST", `/v1/mandates/${mandateId}/transitions`, principalToken, { to: transition });
    if (!changed.response.ok) throw new Error(`Demo transition failed (${changed.response.status})`);
    status = changed.result.mandate.status;
  }
}
if (status === "AWAITING_APPROVAL") {
  const approved = await api("POST", `/v1/mandates/${mandateId}/approvals`, principalToken, {
    nonce: "checkout-live-v1-approval",
  });
  if (approved.response.status !== 201) throw new Error(`Demo approval failed (${approved.response.status})`);
  status = approved.result.mandate.status;
}
if (status !== "ACTIVE") throw new Error(`Demo Mandate is not active (${status})`);

const execution = await api("POST", `/v1/mandates/${mandateId}/executions`, agentToken, { executionId });
if (execution.response.status !== 201) throw new Error(`Demo execution start failed (${execution.response.status})`);
context = await api("GET", `/v1/mandates/${mandateId}`, principalToken);
if (!context.response.ok || context.result.execution?.id !== executionId) {
  throw new Error("Demo execution was not durably visible");
}
console.log(JSON.stringify({
  mandateId,
  executionId,
  status: context.result.mandate.status,
  versionDigest: context.result.versionDigest,
}));
