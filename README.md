# Mandate

**Give autonomous agents room to work—without giving them unlimited authority.**

Mandate allows a human to delegate a specific outcome to an agent within clear, machine-readable boundaries. The agent is free to adjust its plan as the work develops, but it cannot give itself more authority. If it needs to go beyond the approved Mandate, it must stop and ask for explicit approval.

The protocol is defined in [`docs/protocol-v0.1.md`](docs/protocol-v0.1.md).

Supporting documentation covers:

* the current architecture and known security gaps in [`docs/architecture.md`](docs/architecture.md) and [`docs/security-model.md`](docs/security-model.md);
* authenticated API routes in [`docs/control-plane-api.md`](docs/control-plane-api.md);
* the deployed AWS boundary in [`docs/aws-deployment.md`](docs/aws-deployment.md);
* the dashboard’s server-only data boundary in [`docs/dashboard-live-data.md`](docs/dashboard-live-data.md);
* Devpost copy, the proof matrix, product feedback, testing instructions, and the 2:50 demo script in [`docs/submission-package.md`](docs/submission-package.md).

## Where the project stands

The core protocol and runtime flow are implemented and have been tested against adversarial scenarios.

The reference dashboard can display live records through a fail-closed, server-authenticated connection. The transactional control-plane API is deployed on AWS Lambda, with Neon providing persistence and CloudWatch correlating requests across the system.

We also completed a real AgentOS checkout rehearsal through the deployed control plane. It began from an approved repository checksum and produced:

* action-specific trace evidence;
* independently authenticated test and review evidence;
* a complete 16-event audit ledger;
* a merged, checksum-approved result.

The public repository now contains the minimum AgentOS host boundary required to reproduce that deterministic rehearsal. It also includes an MCP Streamable HTTP adapter based on the `2025-11-25` specification. The adapter exposes Mandate status, explains denied actions, and can prepare bounded work when explicitly enabled through configuration.

A protected simulated Alexa+ client uses the same live Mandate tools. It is clearly identified as a simulation because access to the required Amazon-side toolkit onboarding is still blocked.

JWT resource-server validation and durable approval challenges are implemented, but they remain disabled until two external requirements are available:

* a compatible OAuth provider;
* a secure interface for presenting and completing approval challenges.

Durable cloud dispatch, general interception of autonomous AgentOS actions, and Amazon Bedrock AgentCore integration remain fail-closed and are not presented as completed features.

## Live proof

* Control-plane endpoint: `https://l0fttxomzi.execute-api.us-east-1.amazonaws.com/`
* Public guided demo: `https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/`
* Authenticated operator dashboard: `https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/dashboard`
* Protected simulated Alexa+ client: `https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/simulator`
* Public failing fixture: [`Mzoratto/checkout-demo`](https://github.com/Mzoratto/checkout-demo) at commit `888784f`
* Merged checksum-approved result: [`checkout-demo` PR #1](https://github.com/Mzoratto/checkout-demo/pull/1) at commit `7cd240f`
* Isolated Neon completion test: [GitHub Actions run 34791128902](https://github.com/Mzoratto/mandate/actions/runs/34791128902)
* Control-plane deployment verification: [GitHub Actions run 34791192125](https://github.com/Mzoratto/mandate/actions/runs/34791192125)
* Dashboard deployment verification: [GitHub Actions run 34818318342](https://github.com/Mzoratto/mandate/actions/runs/34818318342)
* Public AgentOS rehearsal boundary: [`packages/agentos-reference-host`](packages/agentos-reference-host)

The public control-plane endpoint does not grant authority on its own. Every authorized request must include an identity-bound credential.

The dashboard uses a separate viewer credential, while its control-plane bearer token stays on the server and is never exposed to the browser.

Verification artifacts are kept private in AWS. They are encrypted, versioned, and protected with object locking.

## Running Mandate locally

You will need:

* Node.js 24 or newer;
* Corepack;
* Docker for the local database.

Copy the environment template and install the dependencies:

```bash
cp .env.example .env
corepack pnpm install
```

Start the local database:

```bash
docker compose up -d
```

Load the environment variables:

```bash
set -a
source .env
set +a
```

Prepare and verify the database:

```bash
corepack pnpm db:migrate
corepack pnpm db:check
```

Run the tests and type checks:

```bash
corepack pnpm test
corepack pnpm typecheck
```

Build the dashboard:

```bash
corepack pnpm --filter @mandate/dashboard build
```

To start the dashboard locally:

```bash
corepack pnpm --filter @mandate/dashboard dev
```

The local dashboard runs in illustrative mode. It renders the `/simulator` experience but deliberately disables the real work-preparation action.

See [`docs/alexa-integration.md`](docs/alexa-integration.md) for details about:

* the MCP endpoint;
* the simulated Alexa+ fallback;
* protocol-level checks;
* the remaining Alexa+ onboarding work.

The deterministic checkout rehearsal is documented in [`docs/aws-deployment.md`](docs/aws-deployment.md). Reproducing it no longer requires access to a private AgentOS checkout.

## Continuous integration

GitHub Actions uses:

* the `NEON_API_KEY` repository secret;
* the `NEON_PROJECT_ID` repository variable.

Every pull request tests its database migrations on a temporary Neon branch that expires automatically.

Production migrations are intentionally separate: they must be started manually and can run only from the `main` branch.

## License

Apache-2.0
