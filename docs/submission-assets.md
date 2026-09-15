# Submission assets

These claim-locked assets were captured from the production deployment on September 15, 2026. They contain no credentials, authorization headers, private evidence bodies, third-party logos, or unlicensed imagery. The generated portrait reference is included under the project owner's recorded public-repository, submission, and video authorization.

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

All screenshots are 1440 × 900 PNGs captured from `https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com`. Portrait-bearing screenshots 1, 2, and 4 were recaptured after approved-portrait deployment [34963190128](https://github.com/Mzoratto/mandate/actions/runs/34963190128); screenshot 3 is unchanged because the simulator does not render the portrait.

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
| `assets/screenshots/01-public-guided-simulation.png` | `5b9398866c81fc0bdbfafb302bf5c49ac816ef2e8d09161214008aeac9f08aa4` |
| `assets/screenshots/02-boundary-denial.png` | `ca404503911e76208f1ac11517df95c712fb34d8e48d88f916916f093a582c6d` |
| `assets/screenshots/03-live-mcp-status.png` | `1c38c1b86cb571966d328a62d002d8610d7b62e9a1d4cc8970b526962779616d` |
| `assets/screenshots/04-authenticated-operator-record.png` | `0bc15a9b3e85331bd7956bcf9e616289328024ae59a3937adcbd17efce9c3832` |

Regenerate the PNG architecture rendering from the SVG before updating its manifest entry. Do not replace these production screenshots with fixture or local-development states.
