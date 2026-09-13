# AWS control-plane deployment

The authenticated control plane is deployed in `us-east-1` as a Node.js 22 Lambda behind an API Gateway HTTP API. The public URL grants no authority: `/v1/*` still requires a high-entropy Mandate bearer credential, resolves identity from Lakebase Postgres, and fails closed before repository operations when authentication is absent or invalid.

Current endpoint:

```text
https://l0fttxomzi.execute-api.us-east-1.amazonaws.com/
```

## Resources

`infra/aws/control-plane.yaml` owns:

- Lambda function `mandate-control-plane`;
- execution role `mandate-control-plane-lambda-us-east-1`;
- API Gateway HTTP API with a 5 request/second rate and burst limit of 10;
- Lambda invocation permission restricted to that API;
- CloudWatch log group `/aws/lambda/mandate-control-plane` with 14-day retention.

The Lambda runs outside a VPC so it can reach Neon over TLS. Its PostgreSQL pool is capped at two connections per warm execution environment. `DATABASE_URL` is injected as a CloudFormation `NoEcho` parameter by the protected deployment workflow; it is never committed or printed.

`infra/aws/github-deploy-role.yaml` bootstraps `mandate-github-control-plane-deploy`. Its trust policy requires:

- GitHub's OIDC provider;
- audience `sts.amazonaws.com`;
- the exact immutable owner/repository IDs; and
- the `Production` GitHub environment.

Its permissions are scoped to the Mandate artifact bucket, control-plane stack, Lambda, execution role, and log group. It cannot deploy arbitrary named functions or roles.

## Deployment

The manual workflow requires the literal confirmation `DEPLOY`:

```bash
gh workflow run aws-control-plane-deploy.yml --ref main -f confirm=DEPLOY
```

It resolves the default Neon branch from the existing protected `NEON_API_KEY`, builds a single CommonJS Lambda artifact, uploads it to the private encrypted artifact bucket under the Git commit SHA, deploys CloudFormation, and verifies both public health and unauthenticated rejection.

The first successful Lambda deployment is [workflow run 34787693288](https://github.com/Mzoratto/mandate/actions/runs/34787693288). The direct Function URL was then removed and the rate-limited HTTP API verified in [workflow run 34787920994](https://github.com/Mzoratto/mandate/actions/runs/34787920994).

## Observability

Every application response carries an opaque `x-request-id`. Lambda writes one bounded JSON record containing only component name, AWS request ID, application request ID, and HTTP status. Commands and bearer credentials are not logged. Lambda platform logs provide duration, memory, cold-start, and error data in the same CloudWatch stream.

## Remaining production work

The HTTP API has a global stage throttle but not per-client quotas or WAF rules. Before broader traffic, add those controls, rotate the temporary administrator bootstrap assignment into a narrower operator role, separate Neon migration and append-only application roles, and connect AgentCore policy enforcement. The dashboard remains explicitly offline until a principal credential and live Mandate are provisioned server-side.
