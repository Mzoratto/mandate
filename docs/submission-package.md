# Amazon Developer Hackathon 2026 submission package

Status date: September 15, 2026

Submission deadline: October 23, 2026 at 12:00 PM Pacific Time

Entry basis: new project created September 13, 2026, inside the submission period

This document is the claim lock and production script for the Devpost entry. Do not strengthen its wording without new executable evidence.

## Entry selection

- **Primary track:** Alexa+
- **Primary eligibility path:** working self-hosted MCP server implementing MCP `2025-11-25` over Streamable HTTP
- **Presentation path:** clearly labeled simulated Alexa+ web experience calling the same deployed MCP server
- **Mini challenges:** AWS Builder and Open Source
- **Entrant GitHub username:** `Mzoratto`
- **Project repository:** https://github.com/Mzoratto/mandate
- **Repository description:** Outcome-bound authority for autonomous agents: immutable scope, fail-closed execution, and independently verified completion.
- **Repository homepage:** https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/
- **Repository topics:** `agent-governance`, `agentos`, `ai-agents`, `alexa`, `authorization`, `aws`, `mcp`, `neon-postgres`, `open-source`, `typescript`
- **Open-source contribution URL:** https://github.com/Mzoratto/mandate/pull/8
- **License:** Apache-2.0, detected from the repository `LICENSE` file

Mandate does not claim to be a deployed Alexa+ add-on. Amazon-side toolkit onboarding rejected every tested principal shape, so the entry uses the rules' permitted self-hosted MCP and simulated-experience path.

## Project title

**Mandate — Outcome-Bound Authority for Autonomous Agents**

## Tagline

**Delegate outcomes, not tool calls.**

## Short description

Mandate lets an agent change its plan without letting it change its authority.

## Submission summary

Mandate is an open-source TypeScript protocol and deployed control plane for outcome-bound agent authority. A person delegates a measurable result inside an immutable envelope of identities, resources, effects, budgets, assumptions, and evidence requirements. AgentOS may replan inside that envelope, but deterministic enforcement stops unknown or forbidden effects before execution. Separate human approval remains required for consequential actions, and only independent evidence can mark the outcome complete.

The Alexa+ track implementation is a working self-hosted MCP `2025-11-25` Streamable HTTP server. Its three tools prepare bounded work, retrieve asynchronous status, and explain blocked actions. A protected simulated Alexa+ client calls the same production MCP endpoint while clearly stating that it is simulated, not Amazon-hosted, and not account-linked.

## Long description

Most agent permission systems answer “what can this identity access?” Mandate answers a different question: “what outcome did this person authorize this agent to pursue, under which exact limits?”

A Mandate binds a principal, agent, desired outcome, resource scope, permitted and forbidden effects, cumulative budgets, trusted assumptions, expiry, delegation policy, and independent completion criteria into a canonical immutable digest. The agent may inspect new information and change its plan autonomously. It may not widen paths, add effects, increase budgets, weaken evidence, or grant itself delegation rights. Deterministic denial wins over semantic allowance, and unknown consequential effects fail closed.

The working Alexa+ track artifact is a self-hosted MCP server implementing protocol version `2025-11-25` over Streamable HTTP. `prepare_agent_work` accepts only the customer's desired checkout outcome and retry identity; the server resolves the principal, AgentOS subject, immutable repository commit, effects, zero-token and zero-spend limits, assumptions, and independent verifiers. Preparation persists a bounded proposal and stops at `AWAITING_APPROVAL`. `get_agent_work_status` returns minimized asynchronous state and verification counts. `explain_blocked_action` describes why a proposed action stopped and what compliant replanning remains available. No model-visible tool can approve, execute, amend, deploy, or merge.

Because Amazon's private Alexa AI toolkit role rejected the registered AWS account, Mandate also ships the rules-permitted simulated Alexa+ web experience. It is explicitly labeled as simulated and calls the same deployed MCP endpoint through an authenticated server-only development bridge. Credentials never reach the browser.

The reference checkout proof crossed a live Mandate authorization gate and a separate checksum-bound human action gate. One repository mutation executed with measured zero model tokens and zero direct spend. Two independent verifier identities bound immutable test and review evidence; an agent-produced trace remained insufficient by itself. The Mandate completed only after all criteria passed, leaving a valid 16-event hash chain.

Mandate runs on AWS Lambda and API Gateway, stores authority state transactionally in Neon Postgres, keeps private immutable evidence in encrypted versioned S3 Object Lock storage, deploys digest-addressed scanned dashboard images through ECR, and correlates requests in CloudWatch. The protocol core remains portable and Apache-2.0 licensed.

## Customer value

Autonomous agents become useful when they can adapt. They become dangerous when adaptation silently becomes authority expansion. Mandate preserves the useful part: the agent can replan without interrupting the person for every tool call, while material changes still require an explicit, digest-bound human decision.

The same protocol can govern software repair, finance operations, procurement, infrastructure changes, research, and other multi-step work where identity permissions alone cannot express why authority was delegated or what evidence should close it.

## Feature list

1. Immutable, canonical, digest-addressed authority envelopes.
2. Deterministic effect normalization with forbid-wins evaluation.
3. Autonomous replanning inside authority; explicit amendments for expansion.
4. Separate Mandate approval and checksum-bound action approval ceremonies.
5. Transactional, identity-scoped control-plane persistence and replay resistance.
6. Evidence-gated completion owned by independent verifier identities.
7. MCP `2025-11-25` Streamable HTTP preparation, status, and denial tools.
8. Protected simulated Alexa+ client using the same production MCP endpoint.
9. Fail-closed AgentOS reference interception and deterministic checkout proof.
10. AWS deployment, encrypted immutable evidence, observability, and scan gates.

## Claim matrix

### Proven and safe to state

| Claim | Evidence |
|---|---|
| Mandate is a new public Apache-2.0 TypeScript project created during the hackathon | Public Git history beginning September 13, 2026; repository license endpoint detects Apache-2.0 |
| A production self-hosted MCP server negotiates exactly `2025-11-25` over Streamable HTTP | `apps/api/src/mcp/handler.ts`, transport tests, deployed `/mcp` |
| The MCP server exposes bounded preparation, status, and blocked-action explanation | Production tool discovery and `tests/api/mcp-handler.test.ts` |
| Preparation can only create an immutable proposal in `AWAITING_APPROVAL` | Work-preparation implementation, transactional tests, no approval/execution tool |
| The simulated Alexa+ client calls the same deployed MCP endpoint | `/simulator`, `apps/dashboard/src/lib/mandate/mcp-client.ts`, deployment run 34891787277 |
| Credentials stay server-side and authenticated routes fail closed | Proxy/client tests; production `401`/`200`, `no-store`, and leak probes |
| One deterministic AgentOS checkout mutation crossed Mandate and separate checksum approval gates | `M-checkout-live-003`, action `c0ffee03:turn-live-003:item-live-003`, public reference host |
| Completion required independent test and review evidence | Two independently verified records, one unverified trace, completed record |
| The completed record has a valid 16-event hash chain | Independent production event-chain verification |
| The proof used measured zero model tokens and zero direct spend | Trusted settled accounting on the completed execution |
| AWS services are used at runtime and in deployment | Lambda, API Gateway, S3 Object Lock, ECR, CloudWatch, IAM/OIDC templates and workflows |
| MCP warm status latency improved to 277 ms median and 326 ms p95 | Persistent-client production sample after the minimized projection deployment |

### Simulated and must be labeled

| Item | Required wording |
|---|---|
| Alexa+ conversation surface | “Simulated Alexa+ client” |
| Voice capture and Alexa-hosted presentation | “No voice capture; not Amazon-hosted” |
| Six-stage delegation, denial, replanning, and verification walkthrough on public `/` | “Public guided simulation; no actions executed” |
| The blocked database proposal shown in the public walkthrough | “Illustrative denial demonstrating the implemented rule” |
| Particle portrait and state transitions | “Operational visualization, not an agent or evidence source” |

### Unproven, blocked, or not implemented

Do not claim any of the following:

- a deployed or Alexa-hosted add-on;
- Alexa Local Inspector or Alexa+ web-simulator completion;
- Login with Amazon or OAuth account linking;
- Alexa app-only approval visibility;
- durable outbox/SQS/CodeBuild autonomous dispatch;
- general interception of arbitrary AgentOS or model tool calls;
- AgentCore Gateway, AgentCore Policy, Bedrock, or Strands runtime use;
- deployment or merge authority;
- multi-user dashboard identity;
- real-model token or provider-cost metering beyond the measured deterministic zero-token rehearsal;
- production-readiness for arbitrary customers.

## Live evidence

- Public guided simulation: https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/
- Protected simulated Alexa+ client: https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/simulator
- Protected operator record: https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/dashboard
- Privacy notice: https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/privacy
- Terms of use: https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/terms
- Claim-locked architecture and screenshot manifest: [`docs/submission-assets.md`](submission-assets.md)
- Control plane: https://l0fttxomzi.execute-api.us-east-1.amazonaws.com/
- Source: https://github.com/Mzoratto/mandate
- Checkout proof repository: https://github.com/Mzoratto/checkout-demo
- Checkout output: https://github.com/Mzoratto/checkout-demo/pull/1
- MCP/control-plane deployment: https://github.com/Mzoratto/mandate/actions/runs/34874824974
- Initial simulator deployment: https://github.com/Mzoratto/mandate/actions/runs/34891787277
- Historical CC0-only dashboard deployment: https://github.com/Mzoratto/mandate/actions/runs/34941966864
- Dashboard and public-policy deployment: https://github.com/Mzoratto/mandate/actions/runs/34943694024
- Current approved-portrait dashboard deployment: https://github.com/Mzoratto/mandate/actions/runs/34963190128
- Production migration: https://github.com/Mzoratto/mandate/actions/runs/34843291827

## Testing instructions for judges

The public guided simulation and source repository require no account.

The protected simulator and operator record use one narrow Basic-auth viewer boundary. Before submission, rotate it to a judging-period credential and place the username/password only in Devpost's judge testing instructions—never in the public repository, video, screenshots, or URL.

Suggested private instructions:

```text
Protected simulator:
https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/simulator

Operator record:
https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/dashboard

Username: judge
Password: [INSERT JUDGING-PERIOD PASSWORD IN DEVPOST ONLY]

Safe read-only test:
1. Open the simulator.
2. In “Read an existing work reference,” enter M-checkout-live-003.
3. Confirm COMPLETED, one action, zero model tokens, and 2 / 3 independently verified records.

Optional preparation test:
Submit a checkout-repair outcome of 10–300 characters. This creates only a new immutable AWAITING APPROVAL record. It cannot approve or execute work.
```

Keep the credential active and the project available free of charge through November 20, 2026. Rotate or remove the judging credential after the judging period.

## Demo video plan — 2:50 maximum

Follow the claim-locked [`demo-recording-runbook.md`](demo-recording-runbook.md) for preflight, operator actions, edit boundaries, and final acceptance.

Record at 1440×900 or 1920×1080, 100% browser zoom, with bookmarks, account identifiers, credentials, and unrelated tabs hidden. Use narration only or original/cleared audio. Do not use an Amazon/Alexa logo or copyrighted music. The particle portrait samples a ChatGPT-generated reference image that the project owner explicitly authorized for the public repository, submission, and video; its anatomical volume is attributed CC0 geometry and its shader noise is MIT-licensed.

### 0:00–0:16 — Problem and promise

**Picture:** Public `/` first viewport.

**Narration:** “Permissions tell an agent what it can access. Mandate records what a person authorized it to accomplish. The agent may change its plan. It may never change its authority.”

### 0:16–0:42 — Show adaptation and enforcement

**Picture:** Start the public guided simulation; jump from Adapt to Block to Replan. Keep “PUBLIC GUIDED SIMULATION · NO ACTIONS EXECUTED” visible.

**Narration:** “This guided simulation makes the distinction visible. Reading code and running tests fit the envelope. A proposed database change hits deterministic denial before execution. AgentOS can replan to a repository-only repair without widening authority.”

### 0:42–1:12 — Show the working track artifact

**Picture:** Open protected `/simulator`. Keep the connection-truth ledger and preparation form visible, but do not submit it during the default read-only recording.

**Narration:** “This is our clearly labeled simulated Alexa+ client. The MCP endpoint is real and implements version 2025-11-25 over Streamable HTTP. Alexa supplies only the desired outcome and retry identity. The server resolves every identity, resource, effect, budget, assumption, and verifier.”

### 1:12–1:34 — Show the safe tool boundary

**Picture:** In “Read an existing work reference,” retrieve `M-checkout-live-003`. Show the live `COMPLETED` response and the absence of approval controls.

**Narration:** “This status call is live and read-only. Preparation is available but intentionally not invoked in this recording. It can only persist an immutable proposal and stop at awaiting approval. Authentication is not approval, and there is no model-visible approval control.”

### 1:34–2:10 — Show real completed proof

**Picture:** Read `M-checkout-live-003`; then open authenticated `/dashboard`. Show one action, zero model tokens, and evidence.

**Narration:** “This separate completed record is live. One checksum-approved repository mutation crossed Mandate's gate and AgentOS's human gate. Trusted accounting recorded zero model tokens and zero direct spend. The agent's own trace could not complete the work.”

### 2:10–2:34 — Independent completion

**Picture:** Hold on the evidence and event record.

**Narration:** “Independent test and review identities bound two immutable evidence records. Only after both criteria passed did Mandate close the outcome, leaving a verified sixteen-event hash chain.”

### 2:34–2:50 — Architecture and honest close

**Picture:** Public architecture/proof section or a clean architecture diagram.

**Narration:** “Mandate runs on AWS Lambda, API Gateway, S3, ECR, and CloudWatch with transactional Neon Postgres. Alexa hosting and OAuth remain externally blocked, so we show the permitted simulated path honestly. Delegate outcomes—not tool calls.”

## Video capture checklist

- [ ] Keep the duration at or below 2:50; judges need not watch beyond 3:00.
- [ ] Say “simulated Alexa+ client” on screen and in narration.
- [ ] Show the project functioning in a desktop web browser.
- [ ] Keep the default recording read-only by retrieving `M-checkout-live-003`; make no preparation call unless separately authorized immediately before capture.
- [ ] Never show a password, bearer, Keychain output, AWS account page, database URL, or private evidence URL.
- [ ] Do not imply that the public six-stage walkthrough executed actions.
- [ ] Do not imply that the Alexa toolkit, OAuth, AgentCore, durable dispatch, deployment, or merge authority is connected.
- [ ] Use no third-party logos or copyrighted music.
- [x] Record the project owner's public-use authorization for the ChatGPT-generated portrait reference and retain the CC0 mesh and MIT noise attribution.
- [ ] Upload publicly to YouTube or Vimeo and verify playback in a signed-out browser.

## Product feedback

### MCP TypeScript SDK and protocol

**Used for:** Web-standard Streamable HTTP transport, tool schemas, structured results, and exact MCP `2025-11-25` negotiation.

**Worked well:** `@modelcontextprotocol/sdk` 1.30.0 provided a small Web `Request`/`Response` transport that fit Lambda and strict Zod tool contracts. JSON-response mode enabled a stateless deployment with no session store.

**Needs work:** The newest package family targets a newer protocol than Alexa currently accepts, and MCP Apps package compatibility crosses major package families. A tested Alexa-specific SDK/version/extension matrix would prevent accidental incompatibility.

**Onboarding:** Core MCP setup was direct after finding the matching version. Selecting that version required inspecting package protocol constants rather than relying on “latest.”

**Build again:** Yes. The protocol boundary is portable and testable, but version selection must remain explicit.

### Alexa+ developer tooling

**Used for:** Documentation and target requirements for MCP version, Streamable HTTP, two-tier authentication, OAuth, and add-on behavior. The private toolkit itself could not be installed because Amazon's target role rejected the AWS account.

**Worked well:** The published functional and tool-schema guidance was detailed enough to implement the server contract and distinguish service discovery from customer tools.

**Needs work:** The onboarding role rejected an IAM Identity Center principal, a dedicated keyless intermediary, and Amazon's documented IAM-user shape. The account's trust eligibility was not observable before credential creation. Documentation also diverges from generic MCP authorization by forbidding `WWW-Authenticate`.

**Onboarding:** Zero-to-toolkit remained blocked at the Amazon-side target-role trust boundary. Every temporary IAM resource and key was deleted after testing.

**Build again:** Yes, conditionally. The MCP model is compelling, but toolkit access needs self-service account registration, Identity Center/OIDC support, and actionable trust diagnostics.

### AWS

**Used for:** Lambda compute, API Gateway HTTP APIs and throttling, S3 encrypted versioned Object Lock evidence, ECR immutable scan-gated images, CloudWatch request correlation, IAM least privilege, and GitHub OIDC deployment.

**Worked well:** The services composed into a narrow serverless control plane with immutable artifacts, private evidence, bounded logs, and separately authorized deployments. OIDC removed CI access keys.

**Needs work:** A single-platform BuildKit command still produced an OCI index until provenance was disabled. ECR's scan waiter failed during the short registration gap instead of waiting for scan creation. Tooling should distinguish image registration from scan completion and validate Lambda-compatible media types before promotion.

**Onboarding:** Existing AWS access made the first Lambda path straightforward; hardening image and scan behavior required targeted iteration.

**Build again:** Yes. The platform fits auditable control planes well when identities, artifact digests, and deployment scope are made explicit.

### Neon Postgres

**Used for:** Transactional authority state, immutable Mandate versions, approval and action replay resistance, trusted accounting, evidence, criteria, and hash-chained events. Ephemeral branches validate migrations before production.

**Worked well:** Fast branch creation made migration and lifecycle testing safe. Standard PostgreSQL transactions, locks, constraints, and advisory locks supported the protocol without proprietary persistence logic.

**Needs work:** Remote round trips dominated the first MCP status projection, and JavaScript arrays sent through node-postgres required explicit JSON serialization for JSONB instead of PostgreSQL array inference.

**Onboarding:** Quick once the branch-first migration loop was established.

**Build again:** Yes. Portable PostgreSQL semantics and ephemeral branches are a strong fit for authority ledgers.

### AgentOS

**Used for:** The reference autonomous runtime, normalized effect interception, stop-on-denial behavior, a separate checksum-bound human gate, trusted accounting order, and action-bound trace evidence.

**Worked well:** A small fail-closed interception seam was enough to prove one governed deterministic mutation without coupling Mandate core to runtime internals.

**Needs work:** General execution still needs comprehensive effect interception, durable workers, and real provider token/cost records. A partial interception claim would be unsafe.

**Onboarding:** The deterministic reference host is reproducible from the public Mandate repository; arbitrary autonomous execution remains intentionally disabled.

**Build again:** Yes, after full interception and accounting become invariant runtime capabilities.

## Feature requests

1. **Critical — Alexa+ self-service AWS account registration:** expose whether an account/principal is trusted for `AddOn3PDeveloperToolsRead` before users create credentials.
2. **Critical — Keyless Alexa+ onboarding:** support IAM Identity Center or OIDC instead of requiring a long-lived IAM-user access key.
3. **Important — Alexa+ MCP compatibility matrix:** publish tested MCP protocol, TypeScript SDK, MCP Apps, OAuth metadata, and Local Inspector version combinations.
4. **Important — Account-linking examples:** provide exact two-tier service/customer flows that explain the absence of `WWW-Authenticate` and the required `401`/`403` behavior.
5. **Nice-to-have — ECR scan registration waiter:** distinguish “scan not registered yet” from terminal scan failure.

## Friction-log highlights

Submit these entries in addition to linking the full [`friction-log.md`](friction-log.md):

- **FL-044, major:** The newest MCP package targets `2026-07-28`, while Alexa requires `2025-11-25`; pinned SDK 1.30.0 after inspecting compatibility.
- **FL-046, major:** Sequential remote database reads put status p95 above one second; a purpose-built projection and combined authentication/read reduced production median to 277 ms and p95 to 326 ms.
- **FL-048, major:** Generic RFC 9728 guidance uses `WWW-Authenticate`, but Alexa explicitly does not support it; implemented metadata plus Alexa-specific `401`/`403` behavior and customer-only advertised scopes.
- **FL-049, major:** Amazon rejected direct SSO and a narrowly scoped keyless intermediary despite local IAM authorization; cleaned up the trial and requested account onboarding.
- **FL-051, blocker:** Amazon also rejected its documented IAM-user credential shape after propagation retries, proving an Amazon-side trust blocker; deleted the user, key, policy, profiles, and Keychain entries.
- **FL-034 and FL-038, minor:** Lambda rejected a provenance-bearing OCI index and ECR's waiter failed before scan registration; disabled provenance and implemented bounded scan polling.

## Judging-criteria map

### Technical implementation

Lead with the exact MCP version, transactional authorization lifecycle, fail-closed AgentOS interception, independent evidence, replay resistance, immutable deployment artifacts, and measured production latency.

### Design

Lead with one interaction principle: people state outcomes, while Mandate owns the authority envelope. Show explicit connection truth, separate human gates, responsive behavior, keyboard access, zero automated axe violations, and green reserved for independent verification.

### Potential impact

Position Mandate as portable governance for consequential autonomous work, not only checkout repair. The protocol separates adaptive plans from non-expandable authority and independently evidenced completion.

### Quality of idea

Contrast Mandate with a basic MCP API wrapper: it maintains durable state across sessions, coordinates a runtime and independent verifiers, permits autonomous replanning, stops authority expansion, and exposes asynchronous conversational status.

### AWS Builder

Describe the multi-service runtime and evidence pipeline. Do not mention Bedrock, AgentCore, Strands, or CodeBuild as implemented.

### Open Source

Mandate is a new public Apache-2.0 repository created during the hackathon. PR #8 adds the tested, protected simulated Alexa+ client and production MCP bridge. The protocol, schemas, adapters, control plane, reference host, fixtures, migrations, infrastructure, tests, and documentation are public so another runtime can implement the same authority contract.

## Remaining submission blockers

- [x] Document the project owner's authorization to use the ChatGPT-generated `portrait-reference.png` publicly in the repository, submission, and video; record its immutable digest alongside the CC0 geometry and MIT noise attribution.
- [x] Add and deploy public privacy and terms pages appropriate to the data actually processed.
- [ ] Rotate the Basic viewer credential to a judging-period credential under separate deployment authorization; place it only in Devpost private testing instructions.
- [x] Set and verify the GitHub repository About description, production homepage, and ten relevant topics under separate publication authorization.
- [ ] Confirm entrant eligibility, representative status if applicable, and absence of conflicts of interest.
- [x] Capture a claim-locked architecture diagram and final production screenshots without secrets, private evidence bodies, third-party logos, or unlicensed imagery.
- [ ] Record and edit the final video to 2:50 or less.
- [ ] Upload the video publicly to YouTube or Vimeo and verify signed-out playback.
- [ ] Paste the reviewed description, feedback, feature requests, contribution data, and selected friction entries into Devpost.
- [ ] Submit before October 23, 2026 at 12:00 PM Pacific Time and preserve project access through November 20, 2026.
