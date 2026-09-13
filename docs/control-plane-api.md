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

The authorization request contains the protocol `ProposedAction`, deterministic `NormalizedEffect[]`, and optional projected token or semantic decisions. Subject identity, active version, current assumptions, accumulated usage, and event history come from authenticated server state—not caller-provided identity fields.

## Transaction and replay guarantees

- Mandate and execution rows are locked before lifecycle or conformance decisions.
- Stored immutable content is schema-validated and its canonical digest is recomputed on every protected read.
- Action IDs are idempotent only when the execution and canonical request digest match; changed replays return `409`.
- Settlement is idempotent only when its canonical digest matches; changed replays return `409`.
- Proposal, effects, decision, status change, usage, evidence, and hash-chained events commit or roll back together.
- Agent-produced evidence is stored as unverified. Independent verifier endpoints are intentionally not exposed yet.
- Unknown routes, invalid identities, stale assumptions, malformed effects, and internal errors fail closed.

## Current boundary

The package does not choose an HTTP host, issue browser sessions, create initial identities, rate-limit public traffic, verify independent completion evidence, or grant database roles. Those are deployment and next-milestone concerns. The branch-isolated integration test exercises the complete authenticated draft-to-authorization path against the real migration schema.
