# Alexa+ MCP integration

## Current boundary

Mandate includes a real MCP `2025-11-25` Streamable HTTP adapter at `POST /mcp`. It uses `@modelcontextprotocol/sdk` 1.30.0 because that release negotiates the exact Alexa-supported protocol version. The adapter is stateless and uses JSON responses so it can run behind the existing API Gateway and Lambda boundary.

The deployed endpoint is not enabled until `MANDATE_MCP_RESOURCE_URL` is set to its exact public HTTPS URL. This is deliberate: an inferred host or placeholder URL must not become an OAuth resource identity.

The deployed model-visible tools are:

- `get_agent_work_status`, which returns minimized status, authority, usage, and verification counts;
- `explain_blocked_action`, which explains the latest denied or escalated action and the compliant next step;
- `prepare_agent_work`, which is configuration-gated by an exact server-side checkout commit resolver.

Alexa provides only the desired outcome and a retry key to preparation. Mandate resolves the principal, AgentOS instance, immutable repository commit, paths, effects, zero-token/zero-spend budgets, validity, and independent verifiers. Preparation atomically stops at `AWAITING_APPROVAL` and cannot approve, execute, deploy, or merge anything. The September 14 production verification discovered the tool without invoking it, so verification created no live Mandate.

Customer tools require an authenticated human or organization principal. A service credential may initialize the server and discover tools, but it cannot read or prepare customer records. There are no model-visible approval, amendment, or execution tools.

## Request requirements

`POST /mcp` requires:

```http
Accept: application/json, text/event-stream
Authorization: Bearer <OAuth access token or development-bridge credential>
Content-Type: application/json
MCP-Protocol-Version: 2025-11-25
```

The protocol-version header is not required on the initial `initialize` request. Bodies are limited to 1 MiB. A present `Origin` must exactly match `MANDATE_MCP_ALLOWED_ORIGINS`; absent origins are permitted for server-to-server Alexa requests. A present `Host` must match the configured resource URL. Allowed browser origins receive a bounded `OPTIONS` preflight and exact-origin CORS response; unlisted origins fail before authentication. `GET` and stateful transport methods return `405` because this first slice has no server-initiated notifications or resumable streams.

When the complete OAuth configuration is present, the server publishes RFC 9728 metadata at the path-bound `/.well-known/oauth-protected-resource/mcp` location and the root fallback. The protected-resource document advertises only the customer scopes `mcp:tools mcp:resources`; `mcp:service` remains reserved for the authorization server's client-credentials flow. Metadata otherwise returns `503` rather than advertising a placeholder authorization server. Alexa+ explicitly does not support `WWW-Authenticate`, so authentication failures omit that header; a customer-tool call made with only service authority returns HTTP `403` to trigger account linking.

The resource server now validates JWT access tokens fail closed using the configured remote JWKS. It requires an exact issuer and `/mcp` audience, an explicit `RS256`/`ES256` algorithm allowlist, a registered static Alexa client ID, `iat`/`exp` with at most a one-hour lifetime, an access-token marker when present, and a durable `(authorization server, subject)` mapping to a Mandate principal. Service principals may receive only `mcp:service`; customer principals require `mcp:tools mcp:resources` and cannot inherit service authority. Configure all of:

- `MANDATE_MCP_AUTHORIZATION_SERVER_URL`
- `MANDATE_MCP_JWKS_URL`
- `MANDATE_MCP_OAUTH_CLIENT_IDS`
- the existing exact `MANDATE_MCP_RESOURCE_URL`

The current opaque credential path remains a development bridge when OAuth is unset; it is not Alexa account linking. A compatible authorization server still must prove Alexa's OAuth 2.1 authorization-code flow with PKCE S256, refresh and revocation behavior, `client_credentials`, static client registration, and exact RFC 8707 `resource` handling before these settings may be enabled in production. After that proof, link each provider subject to an existing Mandate principal through the server-only database boundary:

```bash
DATABASE_URL='postgresql://…' corepack pnpm --filter @mandate/api oauth:link-subject -- \
  'https://auth.example.com/' '<provider-subject>' '<mandate-principal-id>'
```

The command is replay-safe and refuses to remap an existing issuer/subject pair to another principal.

An OAuth token authenticates an account. It never constitutes approval of a Mandate or action. The direct bearer-plus-nonce approval route is disabled. Approval requires a separately created ten-minute challenge bound to the principal, Mandate ID, version digest, channel, expiry, and a hashed high-entropy nonce. Challenge repository operations exist for a future app-only MCP surface or authenticated principal review page, but deliberately have no HTTP route until one of those presentation boundaries is proven.

## Planned customer flow

```text
Alexa+ → prepare bounded work proposal → review exact digest
       → app-only principal decision → durable execution dispatch
       → AgentOS proposes action → Mandate authorize/deny
       → separate exact-action decision → execution and settlement
       → independent verification → Alexa+ status/result
```

The server, not Alexa's model, must resolve the subject agent, repository commit, effect rules, trusted assumptions, budgets, and verifier identities. Agent work is asynchronous; Alexa receives an immediate durable state and retrieves the result through a later status call.

## Local verification

The protocol contract is executable without Alexa credentials:

```bash
corepack pnpm test -- tests/api/mcp-handler.test.ts tests/api/mcp-oauth.test.ts
```

The tests prove exact protocol negotiation, bounded work preparation, minimized completed/paused/blocked status, service discovery versus customer-tool separation, protected-resource discovery without unsupported challenge headers, JWT resource/client/scope/lifetime checks, development-bridge `401` behavior, bounded CORS, origin and host rejection, method restrictions, and body limits.

## Alexa onboarding gate

The Alexa AI CLI and account registration require interactive external authentication and may require US Preview access. A direct attempt to assume Amazon's documented `AddOn3PDeveloperToolsRead` role from the existing Identity Center administrator session was locally authorized but rejected by the Amazon account's trust policy. Before creating Amazon's recommended IAM user or any long-lived key, `infra/aws/alexa-toolkit-bootstrap-role.yaml` provides a keyless intermediary role with only `sts:AssumeRole` permission to that exact Amazon role. Deploy it only through a separate AWS authorization, then configure role chaining:

```ini
[profile mandate-alexa-bootstrap]
role_arn = arn:aws:iam::889568839972:role/mandate-alexa-toolkit-bootstrap
source_profile = mandate
region = us-west-2

[profile alexa-ai]
role_arn = arn:aws:iam::372468808636:role/AddOn3PDeveloperToolsRead
source_profile = mandate-alexa-bootstrap
region = us-west-2
```

A successful `aws sts get-caller-identity --profile alexa-ai` must resolve account `372468808636`. The September 14 trial reached the local intermediary but Amazon rejected its target-role assumption. The stack, role, and temporary profiles were then deleted. Do not redeploy the intermediary unless Amazon confirms role-based trust; confirm Alexa+ onboarding with Amazon or obtain separate approval for the documented narrow IAM-user fallback.

Once toolkit access is available:

```bash
alexa-ai configure
alexa-ai new mcp --name "Mandate" --locale en-US --mcp-server-url "https://<host>/mcp"
alexa-ai configure-account-linking --addon-id <id> --stage development --client-id <id>
alexa-ai deploy
```

Test with the standard MCP Inspector, Alexa Local Inspector, and Alexa+ web simulator. Alexa caches tools and authentication metadata at deployment, so redeploy after changing either.

## Production verification

Migration [run 34843291827](https://github.com/Mzoratto/mandate/actions/runs/34843291827) and control-plane deployment [run 34843379804](https://github.com/Mzoratto/mandate/actions/runs/34843379804) promoted merge commit `dff01f29d690cef810deea7531c17ea94dd667b2`. Production negotiated MCP `2025-11-25`, advertised all three tools, returned distinct request IDs with `Cache-Control: no-store`, preserved `M-checkout-live-003` as `COMPLETED` with two independent verifications, and kept OAuth metadata fail closed at `503` because account linking is not configured.

After five warm-up calls, 30 persistent-client reads of the completed record measured `257 ms` minimum, `277 ms` median, `326 ms` p95, and `735 ms` maximum from the verification client. This measures the existing opaque development bridge and the minimized single-query status projection; OAuth and Alexa-hosted latency remain unmeasured.
