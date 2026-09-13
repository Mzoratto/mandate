# Mandate

**Outcome-bound authority for autonomous agents.**

Mandate lets a human delegate an outcome to an agent inside a machine-readable authority envelope. The agent may change its plan, but it may not expand its authority without explicit approval.

Protocol semantics are frozen in [`docs/protocol-v0.1.md`](docs/protocol-v0.1.md). The current architecture and explicit security gaps are documented in [`docs/architecture.md`](docs/architecture.md) and [`docs/security-model.md`](docs/security-model.md); authenticated API routes are in [`docs/control-plane-api.md`](docs/control-plane-api.md), and the live AWS boundary is in [`docs/aws-deployment.md`](docs/aws-deployment.md).

## Current status

The protocol/runtime path is implemented and adversarially tested. The reference dashboard and authenticated transactional control-plane API are implemented. Migration 0002 is active on Neon, and the fail-closed API is live on AWS Lambda with CloudWatch request correlation. Live AgentOS, Alexa+, and AgentCore enforcement remain fail-closed until their external identities and integration boundaries are configured.

## Development

```bash
corepack pnpm install
corepack pnpm test
corepack pnpm typecheck
corepack pnpm --filter @mandate/dashboard build
```

Run the dashboard with `corepack pnpm --filter @mandate/dashboard dev`. Database migrations require a direct `DATABASE_URL`:

```bash
DATABASE_URL='postgresql://…' corepack pnpm --filter @mandate/api db:migrate
DATABASE_URL='postgresql://…' corepack pnpm --filter @mandate/api db:check
```

GitHub Actions uses the repository secret `NEON_API_KEY` and variable `NEON_PROJECT_ID`. Pull requests test migrations on an expiring Neon branch; the production migration workflow is manual and restricted to `main`.

## License

Apache-2.0
