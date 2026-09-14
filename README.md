# Mandate

**Outcome-bound authority for autonomous agents.**

Mandate lets a human delegate an outcome to an agent inside a machine-readable authority envelope. The agent may change its plan, but it may not expand its authority without explicit approval.

Protocol semantics are frozen in [`docs/protocol-v0.1.md`](docs/protocol-v0.1.md). The current architecture and explicit security gaps are documented in [`docs/architecture.md`](docs/architecture.md) and [`docs/security-model.md`](docs/security-model.md); authenticated API routes are in [`docs/control-plane-api.md`](docs/control-plane-api.md), the live AWS boundary is in [`docs/aws-deployment.md`](docs/aws-deployment.md), and the server-only dashboard data boundary is in [`docs/dashboard-live-data.md`](docs/dashboard-live-data.md).

## Current status

The protocol/runtime path is implemented and adversarially tested. The reference dashboard supports fail-closed, server-authenticated live records, and the transactional control-plane API is live on AWS Lambda with Neon persistence and CloudWatch request correlation. A checksum-approved AgentOS checkout rehearsal completed through the deployed control plane with action-bound trace evidence, independently authenticated test/review evidence, and an intact 16-event ledger. The public source now includes the minimum AgentOS host boundary needed to reproduce that deterministic rehearsal and an MCP 2025-11-25 Streamable HTTP adapter exposing status, denial explanations, and configuration-gated bounded work preparation. A protected, clearly labeled simulated Alexa+ client uses those same live tools while Amazon-side toolkit onboarding remains blocked. JWT resource-server validation and durable approval challenges are implemented but remain disabled until a compatible OAuth provider and secure approval presentation boundary are configured. Durable cloud dispatch, general autonomous AgentOS interception, and AgentCore remain fail-closed.

## Live proof

- Control-plane endpoint: `https://l0fttxomzi.execute-api.us-east-1.amazonaws.com/`
- Public guided demo: `https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/`
- Authenticated operator record: `https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/dashboard`
- Public failing fixture: [`Mzoratto/checkout-demo`](https://github.com/Mzoratto/checkout-demo) at `888784f`
- Merged checksum-approved output: [`checkout-demo` PR #1](https://github.com/Mzoratto/checkout-demo/pull/1) at `7cd240f`
- Isolated Neon completion test: [run 34791128902](https://github.com/Mzoratto/mandate/actions/runs/34791128902)
- Control-plane deployment verification: [run 34791192125](https://github.com/Mzoratto/mandate/actions/runs/34791192125)
- Dashboard deployment verification: [run 34818318342](https://github.com/Mzoratto/mandate/actions/runs/34818318342)
- Public AgentOS rehearsal boundary: [`packages/agentos-reference-host`](packages/agentos-reference-host)

The control-plane endpoint grants no authority without an identity-bound credential, and the dashboard requires a separate viewer credential while keeping its control-plane bearer server-only. Verification artifacts remain private, encrypted, versioned, and object-locked in AWS.

## Development

Prerequisites: Node.js 24+, Corepack, and Docker for the local database.

```bash
cp .env.example .env
corepack pnpm install
docker compose up -d
set -a; source .env; set +a
corepack pnpm db:migrate
corepack pnpm db:check
corepack pnpm test
corepack pnpm typecheck
corepack pnpm --filter @mandate/dashboard build
```

Run the illustrative dashboard with `corepack pnpm --filter @mandate/dashboard dev`. Illustrative mode renders `/simulator` but disables its real preparation action. See [`docs/alexa-integration.md`](docs/alexa-integration.md) for the MCP endpoint, simulated fallback boundary, protocol checks, and remaining Alexa+ onboarding work. The deterministic checkout rehearsal is documented in [`docs/aws-deployment.md`](docs/aws-deployment.md); it no longer requires a private AgentOS checkout.

GitHub Actions uses the repository secret `NEON_API_KEY` and variable `NEON_PROJECT_ID`. Pull requests test migrations on an expiring Neon branch; the production migration workflow is manual and restricted to `main`.

## License

Apache-2.0
