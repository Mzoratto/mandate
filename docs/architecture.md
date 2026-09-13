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
| `@mandate/api` | Authenticated Web request handler, transactional Lakebase Postgres repository, migrations, and schema verification |
| `@mandate/dashboard` | Responsive illustrative authority console and amendment-review flow |

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

Application connections may use a pooled `DATABASE_URL`; schema migrations use a direct `DATABASE_URL`. `.github/workflows/neon-schema-check.yml` creates an expiring branch from the configured Neon project, runs every migration twice to prove idempotency, verifies the expected tables, and deletes the branch. Production migration is an explicit manual workflow from `main` through the `Production` GitHub environment.

The initial schema was verified on an ephemeral branch by [workflow run 34761092644](https://github.com/Mzoratto/mandate/actions/runs/34761092644), then applied to the default Neon branch and verified as 15 tables by [workflow run 34761126817](https://github.com/Mzoratto/mandate/actions/runs/34761126817).

## AgentOS boundary

Mandate core imports no AgentOS types. A host bridge must prove all four capabilities before live execution:

1. isolated worktree;
2. pre-action interception;
3. stop-on-denial behavior;
4. evidence callbacks.

The companion AgentOS Lite checkout now exposes an opt-in interceptor on its app-server human-approval path. Bound command and file-change requests are normalized and sent to Mandate before the existing human gate; denial stops the phase, and allowed items must publish completion evidence. The default AgentOS supervisor does not activate this hook, so live execution remains fail-closed until the authenticated Mandate control plane injects the callbacks.

## Not yet implemented

- deployed HTTP adapter, rate limiting, and federated principal sessions for the control plane;
- dashboard-backed authenticated data flows;
- Alexa+ MCP server and MCP App;
- AgentCore Gateway/Policy enforcement;
- CloudWatch correlation;
- live AgentOS bridge.
