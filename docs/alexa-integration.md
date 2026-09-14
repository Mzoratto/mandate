# Alexa+ MCP integration

## Current boundary

Mandate includes a real MCP `2025-11-25` Streamable HTTP adapter at `POST /mcp`. It uses `@modelcontextprotocol/sdk` 1.30.0 because that release negotiates the exact Alexa-supported protocol version. The adapter is stateless and uses JSON responses so it can run behind the existing API Gateway and Lambda boundary.

The deployed endpoint is not enabled until `MANDATE_MCP_RESOURCE_URL` is set to its exact public HTTPS URL. This is deliberate: an inferred host or placeholder URL must not become an OAuth resource identity.

Current model-visible tools are read-only:

- `get_agent_work_status` returns minimized status, authority, usage, and verification counts;
- `explain_blocked_action` explains the latest denied or escalated action and the compliant next step.

Both tools require an authenticated human or organization principal that can already read the referenced Mandate. A service credential may initialize the server and discover tools, but it cannot read customer records. There are no MCP approval, amendment, or execution tools yet.

## Request requirements

`POST /mcp` requires:

```http
Accept: application/json, text/event-stream
Authorization: Bearer <server-side credential>
Content-Type: application/json
MCP-Protocol-Version: 2025-11-25
```

The protocol-version header is not required on the initial `initialize` request. Bodies are limited to 1 MiB. A present `Origin` must exactly match `MANDATE_MCP_ALLOWED_ORIGINS`; absent origins are permitted for server-to-server Alexa requests. A present `Host` must match the configured resource URL. Allowed browser origins receive a bounded `OPTIONS` preflight and exact-origin CORS response; unlisted origins fail before authentication. `GET` and stateful transport methods return `405` because this first slice has no server-initiated notifications or resumable streams.

When `MANDATE_MCP_AUTHORIZATION_SERVER_URL` is configured, the server publishes RFC 9728 metadata at the path-bound `/.well-known/oauth-protected-resource/mcp` location and the root fallback. It otherwise returns `503` rather than advertising a placeholder authorization server.

The current opaque credential path is a development bridge, not Alexa account linking. Production Alexa integration still requires:

- OAuth 2.1 authorization code with PKCE S256 for customers;
- `client_credentials` for service discovery;
- exact RFC 8707 resource binding to the public `/mcp` URL;
- authorization-server metadata and verified token validation;
- refresh and revocation behavior;
- an OAuth subject-to-Mandate-principal mapping.

An OAuth token authenticates an account. It never constitutes approval of a Mandate or action.

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
corepack pnpm test -- tests/api/mcp-handler.test.ts
```

The tests prove exact protocol negotiation, read-only tool discovery, minimized completed/paused/blocked status, separation of service and customer authority, no-`WWW-Authenticate` `401` behavior, bounded CORS, origin and host rejection, method restrictions, and body limits.

## Alexa onboarding gate

The Alexa AI CLI and account registration require interactive external authentication and may require US Preview access. Once available:

```bash
alexa-ai configure
alexa-ai new mcp --name "Mandate" --locale en-US --mcp-server-url "https://<host>/mcp"
alexa-ai configure-account-linking --addon-id <id> --stage development --client-id <id>
alexa-ai deploy
```

Test with the standard MCP Inspector, Alexa Local Inspector, and Alexa+ web simulator. Alexa caches tools and authentication metadata at deployment, so redeploy after changing either.
