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
| `@mandate/api` | Lakebase Postgres Drizzle schema and connection factory |

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

`apps/api/src/db/schema.ts` defines the durable control-plane records for principals, agents, immutable Mandate versions, approvals, amendments, executions, actions, effects, authorization decisions, delegations, evidence, criterion results, and events.

The application uses a pooled `DATABASE_URL`. Migration tooling must use a direct `DATABASE_URL_UNPOOLED`. No Neon project or schema has been provisioned yet.

## AgentOS boundary

Mandate core imports no AgentOS types. A host bridge must prove all four capabilities before live execution:

1. isolated worktree;
2. pre-action interception;
3. stop-on-denial behavior;
4. evidence callbacks.

The available local AgentOS Lite checkout does not currently expose that complete bridge. The adapter therefore permits mapping and dry-run integration but fails closed for live governed execution.

## Not yet implemented

- authenticated HTTP control plane;
- durable transactional repository operations;
- dashboard and amendment UI;
- Alexa+ MCP server and MCP App;
- AgentCore Gateway/Policy enforcement;
- CloudWatch correlation;
- live AgentOS bridge.
