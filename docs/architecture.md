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
| `@mandate/api` | Lakebase Postgres schema, migration runner, schema verifier, and connection factory |
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

`apps/api/src/db/schema.ts` defines the durable control-plane records for principals, agents, immutable Mandate versions, approvals, amendments, executions, actions, effects, authorization decisions, delegations, evidence, criterion results, and events. Ordered SQL migrations live in `apps/api/migrations`; the runner records immutable SHA-256 digests under an advisory lock and rejects modified applied migrations.

Application connections may use a pooled `DATABASE_URL`; schema migrations use a direct `DATABASE_URL`. `.github/workflows/neon-schema-check.yml` creates an expiring branch from the configured Neon project, runs every migration twice to prove idempotency, verifies the expected tables, and deletes the branch. Production migration is an explicit manual workflow from `main` through the `Production` GitHub environment.

## AgentOS boundary

Mandate core imports no AgentOS types. A host bridge must prove all four capabilities before live execution:

1. isolated worktree;
2. pre-action interception;
3. stop-on-denial behavior;
4. evidence callbacks.

The companion AgentOS Lite checkout now exposes an opt-in interceptor on its app-server human-approval path. Bound command and file-change requests are normalized and sent to Mandate before the existing human gate; denial stops the phase, and allowed items must publish completion evidence. The default AgentOS supervisor does not activate this hook, so live execution remains fail-closed until the authenticated Mandate control plane injects the callbacks.

## Not yet implemented

- authenticated HTTP control plane;
- durable transactional repository operations;
- dashboard-backed authenticated data flows;
- Alexa+ MCP server and MCP App;
- AgentCore Gateway/Policy enforcement;
- CloudWatch correlation;
- live AgentOS bridge.
