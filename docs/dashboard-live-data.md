# Authenticated dashboard data

The mission-control dashboard fetches one Mandate context from the control plane in a dynamically rendered Next.js Server Component. The browser receives only a minimized, validated view model; the control-plane bearer credential never crosses the server/client boundary.

## Live mode

Set these only in the server runtime:

```text
MANDATE_CONTROL_PLANE_URL=https://control-plane.example/
MANDATE_DASHBOARD_CREDENTIAL=<identity-bound principal credential>
MANDATE_DASHBOARD_MANDATE_ID=<mandate id>
MANDATE_DASHBOARD_BASIC_CREDENTIAL=<username:high-entropy-password>
```

Live mode requires an HTTPS control-plane origin, rejects redirects, disables fetch caching, applies an eight-second timeout and a 1 MiB response limit, and validates every displayed field. Missing configuration, authentication failure, malformed data, or an unavailable control plane produces an explicit fail-closed screen with no substituted records.

`src/proxy.ts` protects `/` and `/dashboard` with HTTP Basic authentication before rendering. Deploy it only behind platform HTTPS. This is a narrow operator-view boundary, not multi-user application authentication; replace it with the eventual principal session/OIDC layer before broader access.

## Illustrative mode

The original pinned dashboard simulation remains available only by explicit opt-in:

```text
MANDATE_DASHBOARD_MODE=illustrative
```

Illustrative mode is visibly labeled, does not fetch the control plane, and must not be presented as production evidence.

## AWS deployment

The authenticated view is deployed at:

```text
https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/
```

The public URL grants no record access by itself: unauthenticated requests receive `401`, while the live control-plane bearer remains only in the Lambda environment. The operator viewer password is stored in macOS Keychain under service `mandate-dashboard`, account `operator`; it is not committed or stored in GitHub.

`apps/dashboard/Dockerfile` produces a pinned, single-architecture Next.js standalone image with the AWS Lambda Web Adapter. `infra/aws/dashboard-registry.yaml` owns the encrypted, immutable, scan-on-push ECR repository. `infra/aws/dashboard.yaml` owns the image Lambda, its execution role, a 14-day CloudWatch log group, and an API Gateway HTTP API limited to 25 requests per second with a burst of 50. There is no direct Lambda Function URL.

The protected `aws-dashboard-deploy.yml` workflow can publish an immutable commit-tagged image and update only `mandate-dashboard` through the scoped GitHub OIDC role. Runtime credentials are provisioned separately as CloudFormation `NoEcho` parameters and are not passed to that workflow. The protected image-deployment path is nevertheless trusted because deployed server code can access its runtime environment.

The production endpoint has been browser-verified on desktop and mobile against `M-checkout-live-003`. Responses are private and non-cacheable, and the returned HTML contains no control-plane credential.
