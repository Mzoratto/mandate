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

## Current deployment boundary

The authenticated view has been build- and browser-verified locally against `M-checkout-live-003`. It is not publicly hosted yet. A production host must support dynamic Next.js rendering, server-only secrets, HTTPS, and private no-store responses; a static export is not sufficient.
