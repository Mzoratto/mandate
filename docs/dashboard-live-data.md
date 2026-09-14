# Public demonstration and authenticated dashboard data

The dashboard application exposes two deliberately separate surfaces. `/` is a public, non-executing guided simulation that explains the protocol and links to public proof. `/dashboard` is mission control: it fetches one Mandate context from the control plane in a dynamically rendered Next.js Server Component. The browser receives only a minimized, validated view model; the control-plane bearer credential never crosses the server/client boundary.

## Live mode

Set these only in the server runtime:

```text
MANDATE_CONTROL_PLANE_URL=https://control-plane.example/
MANDATE_DASHBOARD_CREDENTIAL=<identity-bound principal credential>
MANDATE_DASHBOARD_MANDATE_ID=<mandate id>
MANDATE_DASHBOARD_BASIC_CREDENTIAL=<username:high-entropy-password>
```

Live mode requires an HTTPS control-plane origin, rejects redirects, disables fetch caching, applies an eight-second timeout and a 1 MiB response limit, and validates every displayed field. Missing configuration, authentication failure, malformed data, or an unavailable control plane produces an explicit fail-closed screen with no substituted records.

`src/proxy.ts` protects `/dashboard` with HTTP Basic authentication before rendering; `/` remains outside the matcher. Deploy the application only behind platform HTTPS. Basic authentication is a narrow operator-view boundary, not multi-user application authentication; replace it with the eventual principal session/OIDC layer before broader access.

## Illustrative mode

The original pinned dashboard simulation remains available only by explicit opt-in:

```text
MANDATE_DASHBOARD_MODE=illustrative
```

Illustrative mode is visibly labeled, does not fetch the control plane, and must not be presented as production evidence. It affects only the operator dashboard. The public guided run is always labeled as a simulation and executes no action.

## AWS deployment

The public demonstration is served at the deployment root, and the authenticated operator record is served at `/dashboard`:

```text
https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/
```

The root returns the public simulation without record data. Unauthenticated `/dashboard` requests receive `401`, while the live control-plane bearer remains only in the Lambda environment. The operator viewer password is stored in macOS Keychain under service `mandate-dashboard`, account `operator`; it is not committed or stored in GitHub.

`apps/dashboard/Dockerfile` produces a pinned, single-architecture Next.js standalone image on a non-root distroless Node.js runtime with the AWS Lambda Web Adapter. `infra/aws/dashboard-registry.yaml` owns the encrypted, immutable, scan-on-push ECR repository. `infra/aws/dashboard.yaml` owns the image Lambda, its execution role, a 14-day CloudWatch log group, and an API Gateway HTTP API limited to 25 requests per second with a burst of 50. There is no direct Lambda Function URL.

The protected `aws-dashboard-deploy.yml` workflow can publish an immutable commit-tagged image and update only `mandate-dashboard` through the scoped GitHub OIDC role. Runtime credentials are provisioned separately as CloudFormation `NoEcho` parameters and are not passed to that workflow. The protected image-deployment path is nevertheless trusted because deployed server code can access its runtime environment.

The public route and production operator route are browser-verified on desktop and mobile; the latter is checked against `M-checkout-live-003`. Operator responses are private and non-cacheable, the returned HTML contains no control-plane credential, and the deployed image's ECR scan completed with no findings.
