# Submission assets

These claim-locked assets were captured from the production deployment on September 15, 2026. They contain no credentials, authorization headers, private evidence bodies, third-party logos, or unlicensed portrait imagery.

## Architecture

### `assets/architecture.png`

Submission-ready 1600 × 900 rendering of the current architecture and proof boundary. Cyan marks deployed infrastructure, green marks independent verification, amber marks a separate ceremony or external blocker, and dashed gray marks work not yet deployed.

The diagram explicitly distinguishes:

- the blocked Alexa+ primary path from the deployed protected simulator;
- preparation from human approval and execution;
- the deployed Mandate/AWS/Neon boundary from the public AgentOS rehearsal;
- independently verified completion from agent-generated trace evidence; and
- the proposed outbox/SQS durable-worker path from currently deployed infrastructure.

An editable, accessible SVG is available as `assets/architecture.svg`.

## Production screenshots

All screenshots are 1440 × 900 PNGs captured from `https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com` after dashboard deployment [34943694024](https://github.com/Mzoratto/mandate/actions/runs/34943694024).

1. **`assets/screenshots/01-public-guided-simulation.png`** — public, non-executing explanation of outcome delegation and immutable authority.
2. **`assets/screenshots/02-boundary-denial.png`** — public simulation showing a forbidden database schema mutation denied before execution.
3. **`assets/screenshots/03-live-mcp-status.png`** — protected simulated Alexa+ client reading completed record `M-checkout-live-003` through the real production MCP endpoint. The surface explicitly labels itself simulated and states that account linking and voice capture are absent.
4. **`assets/screenshots/04-authenticated-operator-record.png`** — authenticated, read-only production record showing one governed action, bounded effects, zero model tokens, and independent completion evidence.

Recommended Devpost order: public overview, boundary denial, live MCP status, authenticated operator record, architecture.

## Integrity manifest

| Asset | SHA-256 |
| --- | --- |
| `assets/architecture.svg` | `e94c295381c0bc2b36ee9237fa989f84f99817d93984ef1914d46b98ad0b755f` |
| `assets/architecture.png` | `19b9f5dd1ab9d60677b2e5816537aa5d3cfbda2dd51f9e0be034a804e2d6b62b` |
| `assets/screenshots/01-public-guided-simulation.png` | `f63eee915c1e1cc67b21ede4e568512ba89b4aa2d61fab7ffe9810d9226b807e` |
| `assets/screenshots/02-boundary-denial.png` | `35c8610739d338df91d5831c5c1d468f44d490f0338d8ff713107ec448576832` |
| `assets/screenshots/03-live-mcp-status.png` | `1c38c1b86cb571966d328a62d002d8610d7b62e9a1d4cc8970b526962779616d` |
| `assets/screenshots/04-authenticated-operator-record.png` | `e8f0db202362c8ce3856e904c2c272f1ab9d10eb48ed2c3532ab788e9d0ade53` |

Regenerate the PNG architecture rendering from the SVG before updating its manifest entry. Do not replace these production screenshots with fixture or local-development states.
