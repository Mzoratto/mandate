# Authenticated control-plane API

`@mandate/api` exposes a Web `Request`/`Response` handler and a transactional Lakebase Postgres repository. Deployment adapters may place the handler behind Node, Lambda, AgentCore, or another HTTPS host without moving authentication or authority decisions into that adapter.

```ts
import { createDatabase, ControlPlaneRepository, createControlPlaneHandler } from "@mandate/api";

const database = createDatabase();
const handle = createControlPlaneHandler(new ControlPlaneRepository(database.pool));
const response = await handle(request);
```

## Authentication

Every `/v1/*` route requires `Authorization: Bearer <opaque-token>`. Tokens carry at least 256 bits of entropy, are stored only as SHA-256 hashes in `control_plane_credentials`, may expire, and can be revoked immediately. A credential resolves to exactly one registered principal or agent.

Bearer tokens are server credentials: require TLS, keep them out of browser bundles and logs, and provision separate credentials for each runtime instance or authority channel. An agent credential belongs to the trusted execution host/interceptor; it must never be exposed to model context or an untrusted tool process. The reference credential command prints the secret once:

```bash
DATABASE_URL='postgresql://…' corepack pnpm --filter @mandate/api \
  credential:create agent agentos-checkout
```

Identity records must already exist. Neon Auth or an external identity provider may replace principal bearer credentials later; authenticated principal and subject IDs must still be mapped to the protocol records server-side.

## Routes

| Method | Route | Identity | Purpose |
|---|---|---|---|
| `GET` | `/health` | public | Process health only; no database or readiness claim |
| `POST` | `/v1/mandates` | principal | Create an unapproved version-1 draft |
| `GET` | `/v1/mandates/:id` | owning principal or subject | Read the current Mandate, approval, latest execution, actions, evidence, amendments, and event chain |
| `POST` | `/v1/mandates/:id/transitions` | owning principal | Move `DRAFT → PROPOSED → AWAITING_APPROVAL` |
| `POST` | `/v1/mandates/:id/approvals` | eligible principal | Bind a replay-protected nonce and activate the current immutable version |
| `PUT` | `/v1/mandates/:id/assumptions/:key` | owning principal | Update trusted current assumption state |
| `POST` | `/v1/mandates/:id/executions` | bound agent | Start or idempotently recover an execution |
| `POST` | `/v1/executions/:id/actions/authorize` | bound agent | Persist the proposal/effects and return a fail-closed conformance decision before execution |
| `POST` | `/v1/executions/:id/actions/:actionId/settle` | bound agent | Settle one allowed action, trusted usage, and unverified trace evidence |
| `POST` | `/v1/executions/:id/verifications` | bound service verifier | Submit digest-bound evidence and criterion results; complete only when every required check passes |

The authorization request contains the protocol `ProposedAction`, deterministic `NormalizedEffect[]`, and optional projected token or semantic decisions. Subject identity, active version, current assumptions, accumulated usage, and event history come from authenticated server state—not caller-provided identity fields.

## Transaction and replay guarantees

- Mandate and execution rows are locked before lifecycle or conformance decisions.
- Stored immutable content is schema-validated and its canonical digest is recomputed on every protected read.
- Action IDs are idempotent only when the execution and canonical request digest match; changed replays return `409`.
- Settlement is idempotent only when its canonical digest matches; changed replays return `409`.
- Proposal, effects, decision, status change, usage, evidence, and hash-chained events commit or roll back together.
- Agent-produced evidence is stored as unverified.
- A verification credential must resolve to a `service` principal whose ID exactly matches each requirement and criterion verifier. A submission binds one immutable artifact digest to one evidence requirement and one or more verifier-owned criterion results. Exact retries are idempotent; changed replays fail.
- The final required verification transaction re-evaluates assumptions, open amendments, unsettled actions, violations, verified evidence, and criterion results before atomically completing the Mandate and execution.
- Unknown routes, invalid identities, stale assumptions, malformed effects, and internal errors fail closed.

## Alexa+ MCP read boundary

`POST /mcp` is a stateless MCP `2025-11-25` Streamable HTTP endpoint backed by the same authenticated repository. It currently exposes only `get_agent_work_status` and `explain_blocked_action`; both are read-only and require the owning customer principal. Service principals may initialize and list tools but cannot read a customer's Mandate. The endpoint is disabled unless `MANDATE_MCP_RESOURCE_URL` is configured as the exact public HTTPS `/mcp` resource URL. See [`alexa-integration.md`](alexa-integration.md).

The existing opaque credentials are only the pre-OAuth development boundary. They must not be registered as Alexa account-linking credentials or converted into automated approval.

## AgentOS callback client

`@mandate/adapter-agentos` exports `createAgentOsControlPlaneHandlers`. It converts the AgentOS interceptor's `beforeAction` and action-bound `publishEvidence` callbacks into authenticated authorization and settlement requests:

```ts
const handlers = createAgentOsControlPlaneHandlers({
  baseUrl: "https://mandate.example",
  credential: process.env.MANDATE_AGENT_CREDENTIAL!,
  executionId,
  mandateVersionDigest,
  settlement: async (evidence) => trustedMeter.settlementFor(evidence.executionActionId),
});
```

The adapter accepts only an HTTPS origin, refuses redirects, applies a bounded timeout, binds authorization responses to the expected immutable version digest, validates settlement identity, and requires an `executionActionId` on evidence. The settlement callback is mandatory because cost, token usage, and success must come from the trusted execution host. A deployment must fail closed rather than substitute guessed or zero usage when a governed limit depends on unavailable metering.

## Current boundary

The package does not choose an HTTP host, issue browser sessions, run verifier tools, host evidence artifacts, or grant database roles. Those are deployment concerns. The branch-isolated integration test exercises authenticated proposal, authorization, settlement, verifier isolation, replay safety, and evidence-gated completion against the real migration schema.
