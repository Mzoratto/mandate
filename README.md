# Mandate

**Outcome-bound authority for autonomous agents.**

Mandate lets a human delegate an outcome to an agent inside a machine-readable authority envelope. The agent may change its plan, but it may not expand its authority without explicit approval.

Protocol semantics are frozen in [`docs/protocol-v0.1.md`](docs/protocol-v0.1.md). The current architecture and explicit security gaps are documented in [`docs/architecture.md`](docs/architecture.md) and [`docs/security-model.md`](docs/security-model.md).

## Current status

The local protocol/runtime path is implemented and adversarially tested. Live AgentOS, Neon, Alexa+, and AWS enforcement remain fail-closed until their external identities and integration boundaries are approved and configured.

## Development

```bash
corepack pnpm install
corepack pnpm test
corepack pnpm typecheck
```

## License

Apache-2.0
