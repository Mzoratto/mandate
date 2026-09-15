# AWS control-plane deployment

The authenticated control plane and mission-control dashboard are deployed in `us-east-1` behind separate API Gateway HTTP APIs. Their public URLs grant no authority: `/v1/*` and `/mcp` require a high-entropy server-side credential, while the dashboard requires a separate viewer credential and keeps its control-plane bearer server-only.

Current endpoints:

```text
Control plane: https://l0fttxomzi.execute-api.us-east-1.amazonaws.com/
Dashboard:     https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/
```

## Resources

`infra/aws/control-plane.yaml` owns:

- Lambda function `mandate-control-plane`;
- execution role `mandate-control-plane-lambda-us-east-1`;
- API Gateway HTTP API with a 5 request/second rate and burst limit of 10;
- Lambda invocation permission restricted to that API;
- CloudWatch log group `/aws/lambda/mandate-control-plane` with 14-day retention.

The Lambda runs outside a VPC so it can reach Neon over TLS. Its PostgreSQL pool is capped at two connections per warm execution environment. `DATABASE_URL` is injected as a CloudFormation `NoEcho` parameter by the protected deployment workflow; it is never committed or printed.

`infra/aws/dashboard-registry.yaml` owns the immutable, encrypted, scan-on-push `mandate-dashboard` ECR repository. `infra/aws/dashboard.yaml` owns a Node.js 24 standalone Next.js image Lambda, a 14-day log group, and a separate HTTP API with a 25 request/second rate and burst limit of 50. The image uses a digest-pinned non-root distroless Node runtime and AWS Lambda Web Adapter; there is no direct Function URL. See [`dashboard-live-data.md`](dashboard-live-data.md) for its identity and data boundary.

`infra/aws/github-deploy-role.yaml` bootstraps `mandate-github-control-plane-deploy`. Its trust policy requires:

- GitHub's OIDC provider;
- audience `sts.amazonaws.com`;
- the exact immutable owner/repository IDs; and
- the `Production` GitHub environment.

Its permissions are scoped to the Mandate artifact bucket, control-plane stack, named Lambdas and roles, and the dashboard ECR repository. Dashboard CI can update only the named function's image code and inspect deployment status; it cannot mutate function configuration or deploy arbitrary functions and roles. Image deployment remains a high-trust boundary because deployed server code can access runtime credentials.

## Deployment

The manual workflow requires the literal confirmation `DEPLOY`:

```bash
gh workflow run aws-control-plane-deploy.yml --ref main -f confirm=DEPLOY
```

It resolves the default Neon branch from the existing protected `NEON_API_KEY`, builds a single CommonJS Lambda artifact, uploads it to the private encrypted artifact bucket under the Git commit SHA, and resolves the existing stack URL as the exact `/mcp` resource identity. It passes the optional repository variables `MANDATE_MCP_ALLOWED_ORIGINS`, `MANDATE_MCP_AUTHORIZATION_SERVER_URL`, `MANDATE_MCP_JWKS_URL`, `MANDATE_MCP_OAUTH_CLIENT_IDS`, and `MANDATE_MCP_CHECKOUT_COMMIT_DIGEST` into CloudFormation. It then deploys and verifies public health plus unauthenticated rejection at both `/v1/*` and `/mcp`. A new stack must first be bootstrapped with MCP disabled, then updated once its stable API URL exists. Leave the complete OAuth variable group empty until provider compatibility and subject mappings are proven.

The first successful Lambda deployment is [workflow run 34787693288](https://github.com/Mzoratto/mandate/actions/runs/34787693288). The direct Function URL was then removed and the rate-limited HTTP API verified in [workflow run 34787920994](https://github.com/Mzoratto/mandate/actions/runs/34787920994). Authenticated verifier completion passed on an isolated Neon branch in [run 34791128902](https://github.com/Mzoratto/mandate/actions/runs/34791128902) and the corresponding Lambda plus Node.js 24 OIDC action was verified in [run 34791192125](https://github.com/Mzoratto/mandate/actions/runs/34791192125). Alexa work-request and approval-challenge tables reached production in [migration run 34843291827](https://github.com/Mzoratto/mandate/actions/runs/34843291827), followed by the configuration-gated preparation and optimized status deployment in [run 34843379804](https://github.com/Mzoratto/mandate/actions/runs/34843379804).

Dashboard code deployment is independently manual and confirmation-gated:

```bash
gh workflow run aws-dashboard-deploy.yml --ref main -f confirm=DEPLOY
```

The workflow builds an amd64 single-manifest image, pushes it under the immutable commit SHA, requires the ECR scan to complete with zero critical findings, updates only `mandate-dashboard`, and verifies that the public origin still rejects unauthenticated requests. The scoped deployment and zero-critical-finding scan gate passed in [run 34813074224](https://github.com/Mzoratto/mandate/actions/runs/34813074224). [Run 34941966864](https://github.com/Mzoratto/mandate/actions/runs/34941966864) promoted merge commit `6e53069a2f67d0ac7439b26762088bc2f52ac116`, removing the unlicensed portrait raster and generating the production visualization solely from digest-recorded CC0 geometry, code-owned coloring, and MIT-licensed shader noise.

## Verification artifacts

Bucket `mandate-evidence-889568839972-us-east-1` is private, encrypted, versioned, and configured with 30-day S3 Object Lock governance retention. The completed checkout rehearsal stores the exact patch, raw test output, raw independent-review output, and digest-linked attestations under its Mandate and execution IDs. Database evidence records bind immutable object versions and SHA-256 digests; service-verifier credentials were removed from GitHub after one-time provisioning and remain only in the operator Keychain.

## Observability

Every application response carries an opaque `x-request-id`. Lambda writes one bounded JSON record containing only component name, AWS request ID, application request ID, and HTTP status. Commands and bearer credentials are not logged. Lambda platform logs provide duration, memory, cold-start, and error data in the same CloudWatch stream.

## Governed checkout rehearsal

The public [`Mzoratto/checkout-demo`](https://github.com/Mzoratto/checkout-demo) repository preserves a deliberately failing base commit. `apps/api/scripts/run-agentos-rehearsal.mjs` runs one deterministic, zero-model-usage AgentOS action against an isolated worktree using the public `@mandate/agentos-reference-host` package. The script still crosses both independent gates: the live control plane must authorize the normalized file effect, then the AgentOS relay waits for the exact checksum-bound human answer. It cannot execute the edit before both decisions, and it settles action-bound trace evidence only after trusted usage is available.

This rehearsal proves the deployed path without implying that arbitrary Codex tool calls are fully intercepted. A general autonomous run remains fail-closed until AgentOS can intercept every effect, including commands the underlying runtime might otherwise classify as trusted.

## Remaining production work

The HTTP APIs have global stage throttles but not per-client quotas or WAF rules. Before broader traffic, add those controls, rotate the temporary administrator bootstrap assignment into a narrower operator role, separate Neon migration and append-only application roles, and connect AgentCore policy enforcement. Replace the dashboard's narrow Basic viewer boundary with principal OIDC sessions before multi-user access.
