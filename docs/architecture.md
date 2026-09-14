# Mandate architecture

## Current local implementation

```text
Protocol types + canonical hashing
              │
              ├── Zod validation
              ├── deterministic effect adapters
              ├── lifecycle and amendments
              ├── conformance and accumulated limits
              ├── delegation and contraction
              ├── evidence-gated completion
              └── hash-chained event ledger
                         │
                  testing harness
```

Packages remain runtime-neutral:

| Package | Responsibility |
|---|---|
| `@mandate/protocol` | Wire types, immutable content projection, canonical JSON, hashes, IDs |
| `@mandate/schemas` | Strict v0.1 input validation |
| `@mandate/effects` | Demo-only deterministic action-to-effect adapters |
| `@mandate/runtime` | Lifecycle, conformance, subset checks, amendments, delegation, event chain |
| `@mandate/evidence` | Evidence ingestion, verifier binding, completion guard |
| `@mandate/testing` | In-memory end-to-end governance harness; not production enforcement |
| `@mandate/adapter-agentos` | Runtime-neutral bridge contract and fail-closed AgentOS capability gate |
| `@mandate/agentos-reference-host` | Public checksum-bound approval relay and deterministic AgentOS effect interceptor used by the checkout rehearsal |
| `@mandate/api` | Authenticated Web request handler, transactional Lakebase Postgres repository, MCP 2025-11-25 read adapter, migrations, and schema verification |
| `@mandate/dashboard` | Responsive authenticated authority console with an explicit illustrative boundary-demo mode |

## Enforcement path

```text
untrusted agent proposal
  → deterministic effect adapter
  → active version + trusted identity + assumption snapshot
  → conformance evaluation
  → deny or escalate wins over allow
  → host executes only an allowed proposal
  → trusted accounting settles cumulative state
  → event and evidence records
```

Semantic classification may add effects, deny, or escalate. It cannot remove deterministic effects or override denial.

## Persistence

`apps/api/src/db/schema.ts` defines the durable control-plane records for principals, agents, hashed credentials, trusted assumption state, immutable Mandate versions, approvals, amendments, executions, actions, effects, authorization decisions, delegations, evidence, criterion results, and sequenced events. Ordered SQL migrations live in `apps/api/migrations`; the runner records immutable SHA-256 digests under an advisory lock and rejects modified applied migrations.

`apps/api/src/control-plane` exposes a Web `Request`/`Response` handler over a PostgreSQL repository. Every protected route resolves an opaque bearer token to one server-side principal or agent identity. Lifecycle changes, action reservation, deterministic effects, conformance decisions, usage settlement, evidence, and hash-chained events are written under Mandate/execution row locks. Reusing an action or settlement ID with changed canonical content fails with `409`; database corruption, stale assumptions, and unknown internal failures fail closed. See [`control-plane-api.md`](control-plane-api.md).

Application connections may use a pooled `DATABASE_URL`; schema migrations use a direct `DATABASE_URL`. `.github/workflows/neon-schema-check.yml` creates an expiring branch from the configured Neon project, runs every migration twice to prove idempotency, verifies required tables and columns, exercises the authenticated lifecycle, and deletes the branch. Production migration is an explicit manual workflow from `main` through the `Production` GitHub environment.

Migration 0002 and its authenticated action flow passed [workflow run 34780277350](https://github.com/Mzoratto/mandate/actions/runs/34780277350), then applied and verified on the default Neon branch in [workflow run 34780329367](https://github.com/Mzoratto/mandate/actions/runs/34780329367).

## AWS boundary

The Web handler is bundled as a Node.js 22 Lambda behind an API Gateway HTTP API with a global stage throttle. A GitHub OIDC role bound to immutable repository IDs and the protected `Production` environment may update only the named artifact bucket, CloudFormation stack, Lambda, execution role, and log group. The deployment workflow injects the Neon URL without printing it, then proves public health and unauthenticated `401` behavior. CloudWatch correlates the AWS request ID with Mandate's opaque request ID without retaining action inputs. See [`aws-deployment.md`](aws-deployment.md) and successful hardened deployment [run 34787920994](https://github.com/Mzoratto/mandate/actions/runs/34787920994).

## AgentOS boundary

Mandate core imports no AgentOS types. A host bridge must prove all four capabilities before live execution:

1. isolated worktree;
2. pre-action interception;
3. stop-on-denial behavior;
4. evidence callbacks.

`@mandate/agentos-reference-host` publishes the minimum reviewed AgentOS boundary used by the deterministic checkout rehearsal. Bound command and file-change requests are normalized and sent to Mandate before the separate checksum-bound human gate; denial stops the action, and allowed items must publish action-bound completion evidence. `@mandate/adapter-agentos` provides the authenticated HTTPS callback client. This makes the historical rehearsal reproducible without a private repository, but it is not the full AgentOS supervisor. General live execution remains fail-closed until a trusted host intercepts every effect and provides actual per-action cost/token settlement.

## Alexa+ MCP boundary

`apps/api/src/mcp/handler.ts` is a stateless JSON-response Streamable HTTP adapter built on `@modelcontextprotocol/sdk` 1.30.0, whose negotiated protocol version is MCP `2025-11-25`. It currently exposes only read-only customer intents for status and blocked-action explanations. Requests require an authenticated server-side identity, exact host binding, optional-origin allowlisting, strict body limits, and no-store responses. Service principals may discover tools but cannot read customer records. The adapter deliberately does not expose approval, execution, or amendment tools until Alexa+ OAuth identity and digest-bound approval challenges are implemented.

## Not yet implemented

- per-client quotas/WAF and federated principal sessions for the control plane;
- Alexa+ OAuth 2.1 account linking, MCP App decisions, and add-on registration;
- AgentCore Gateway/Policy enforcement;
- cross-service CloudWatch/AgentCore correlation beyond the Lambda request boundary;
- live AgentOS orchestration and trusted usage metering.
