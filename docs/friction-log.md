# Friction Log

Record real implementation issues when they occur. Do not add hypothetical or reconstructed entries.

## Entry template

```markdown
## FL-000

### Task

### Expected

### Actual

### Severity
blocking | major | minor

### Time lost

### Workaround

### Suggested improvement
```

## FL-001

### Task
Bootstrap the TypeScript workspace with the blueprint's required pnpm package manager.

### Expected
`pnpm` to be available with the installed Node.js toolchain.

### Actual
Node.js v24.18.1 and Corepack 0.35.0 were installed, but invoking `pnpm` returned `command not found`.

### Severity
minor

### Time lost
Less than one minute.

### Workaround
Use Corepack to provision the project-pinned pnpm version.

### Suggested improvement
Document `corepack enable` or `corepack pnpm install` as the first setup command for environments where pnpm is not globally installed.

## FL-002

### Task
Validate the restricted v0.1 path-pattern grammar.

### Expected
The schema to reject embedded glob syntax such as `services/**/secrets`.

### Actual
The first validator removed only a terminal `/**` and otherwise treated `*` as ordinary path text, so the invalid fixture passed schema validation.

### Severity
minor

### Time lost
About one minute.

### Workaround
Reject wildcard, backslash, and percent-encoded text in the normalized path before accepting exact or terminal-prefix patterns.

### Suggested improvement
Keep an explicit negative-fixture table for every deliberately unsupported path syntax.

## FL-003

### Task
Implement stale-approval recovery without mutating an approved Mandate version.

### Expected
A suspended Mandate could be re-approved against a changed assumption snapshot while keeping its version unchanged.

### Actual
Assumption hashes are part of the immutable version digest, so replacing them during same-version re-approval would violate version immutability and make the approval digest ambiguous.

### Severity
major

### Time lost
About five minutes.

### Workaround
Require an approved assumption amendment and a new Mandate version whenever a protected assumption changes. Resume without amendment is allowed only when the original assumption hashes still match.

### Suggested improvement
State explicitly in approval-system guidance whether approval assumptions belong to immutable authorization content or to a separate mutable approval record; do not place them in both without precedence rules.

## FL-004

### Task
Connect Mandate to the local AgentOS reference runtime.

### Expected
A stable runtime SDK or interception hook that can submit every consequential action to Mandate before execution and publish evidence afterward.

### Actual
The available `/Users/marco/AgentOS` checkout is a private CLI-oriented AgentOS Lite. Its own execution-governor documentation says production model execution remains fail-closed and key adapters are intentionally inactive. It exposes no stable package API for Mandate action interception.

### Severity
blocking

### Time lost
About fifteen minutes of repository and governance-boundary inspection.

### Workaround
Implement a narrow, runtime-neutral AgentOS bridge contract and fail closed unless a host proves isolated worktrees, pre-action interception, stop-on-denial, and evidence callbacks. Dry-run task mapping can proceed without claiming governed execution.

### Suggested improvement
AgentOS should expose a versioned adapter interface for task creation, pre-effect authorization, cumulative accounting, cancellation, and evidence publication independently of its CLI and private governor activation process.

## FL-005

### Task
Install Drizzle schema tooling for the Lakebase Postgres persistence layer.

### Expected
The workspace install to complete without executing unreviewed lifecycle code.

### Actual
pnpm blocked build scripts from three transitive `esbuild` versions and exited with `ERR_PNPM_IGNORED_BUILDS`, requiring an explicit `pnpm approve-builds` decision.

### Severity
major

### Time lost
About five minutes.

### Workaround
Keep the runtime Drizzle schema and remove Drizzle Kit from the unattended install. Generate migrations only after the exact build scripts are reviewed and explicitly approved.

### Suggested improvement
Migration-tool setup guides should document pnpm's dependency build-script approval step and identify which exact transitive packages require lifecycle execution.

## FL-006

### Task
Initialize shadcn/ui non-interactively in the pnpm workspace.

### Expected
The shadcn CLI to use the project-pinned package manager through Corepack.

### Actual
The CLI detected pnpm from the lockfile but spawned the literal `pnpm` binary, which was not on `PATH`; `corepack pnpm` being available was insufficient. Initialization stopped after writing `components.json` and before dependencies were installed.

### Severity
minor

### Time lost
About two minutes.

### Workaround
Enable Corepack's pnpm shim, verify the pinned version, and rerun the idempotent initialization command.

### Suggested improvement
The shadcn CLI should invoke Corepack when a repository pins pnpm but no global pnpm binary exists, or document the shim prerequisite in its preflight error.

## FL-007

### Task
Persist the dashboard surface brief after updating Impeccable.

### Expected
The `surface-brief.mjs` command referenced by the loaded workflow to remain available for the current session.

### Actual
The authorized update replaced the Node `.mjs` command set with the v4.3.1 `impeccable` launcher, so the previously loaded command path no longer existed.

### Severity
minor

### Time lost
About two minutes.

### Workaround
Reload the updated skill instructions and invoke the equivalent `impeccable surface-brief` command through the new launcher.

### Suggested improvement
The updater should retain compatibility shims for command paths used by active sessions or warn that in-progress workflows must switch launchers immediately.

## FL-008

### Task
Run the production dashboard on a non-default port for final browser verification.

### Expected
Passing `-- -p 3002` through the pnpm script to configure Next.js.

### Actual
The extra separator was forwarded literally, so Next.js interpreted `-p` as a project directory; the next available port was also occupied by an unrelated unresponsive process.

### Severity
minor

### Time lost
About two minutes.

### Workaround
Set `PORT` in the command environment and choose a verified free port before starting the server.

### Suggested improvement
Document `PORT=<port> pnpm start` as the portable production-server invocation and check the target port before launch.

## FL-009

### Task
Run the complete AgentOS regression suite after adding the Mandate interception seam.

### Expected
The full suite to provide one clean integration signal after the new targeted tests passed.

### Actual
The suite reported one stale dashboard-copy assertion unrelated to the touched bridge files, and one immutable-launcher test failed only under the concurrent full run before passing 10/10 in isolation. The dashboard assertion remained reproducible in isolation against the pre-existing warm-workspace render.

### Severity
minor

### Time lost
About four minutes.

### Workaround
Run the bridge and human-runner tests directly, rerun the immutable-launcher suite in isolation, and preserve the unrelated dashboard mismatch for its existing owner instead of rewriting that surface during this integration.

### Suggested improvement
Keep dashboard copy assertions synchronized with approved visual refreshes, and isolate process-heavy immutable-launcher tests from unrelated concurrent suites when resource contention can cause false negatives.

## FL-010

### Task
Commit the new Next.js dashboard without generated build output.

### Expected
The repository ignore rules to exclude framework output beneath the new workspace.

### Actual
The root ignore file covered `dist/` but not `.next/`, so the first commit staged generated development and production artifacts before the oversized status output exposed the mistake.

### Severity
major

### Time lost
About three minutes.

### Workaround
Add `.next/` to the root ignore file, remove generated output from the index, and rewrite only the two just-pushed local commits into one clean commit with `--force-with-lease`.

### Suggested improvement
Add framework output directories to the root ignore rules before the first dev server or production build, and inspect `git status --short` for generated directories before committing.

## FL-011

### Task
Run the Neon schema workflow with pnpm dependency caching.

### Expected
`actions/setup-node` to configure Node and restore the pnpm cache before Corepack enabled the repository-pinned pnpm binary.

### Actual
The setup action resolves the package manager before the later `corepack enable` step and failed with `Unable to locate executable file: pnpm`. Removing the explicit cache setting fixed v4, but v5 enables `package-manager-cache` by default when `packageManager` declares pnpm, reproducing the failure until explicitly disabled.

### Severity
minor

### Time lost
About two minutes.

### Workaround
Set setup-node's `package-manager-cache: false`, then enable Corepack before installing dependencies.

### Suggested improvement
Examples for pnpm caching should either provision pnpm before setup-node evaluates cache metadata or show the explicit `package-manager-cache: false` baseline for a Corepack-only toolchain.

## FL-012

### Task
Install the dashboard's pinned Next.js and React Three Fiber dependencies in the pnpm workspace.

### Expected
The lockfile update and install to reuse or download the selected package versions normally.

### Actual
The registry downloads for `next@16.1.6` and its Darwin SWC binary repeatedly aborted with pnpm error code 23, including one command timeout and one failed retry cycle.

### Severity
minor

### Time lost
About seven minutes.

### Workaround
Use the already-resolved `next@16.3.5` and compatible `@react-three/fiber@9.7.0`, while pinning React below the peer dependency's `19.3` upper bound.

### Suggested improvement
Keep frontend runtime versions exact in the dashboard package and prefer versions already validated by the workspace's supply-chain and package caches when no protocol behavior depends on an older patch.

## FL-013

### Task
Exercise the authenticated control-plane approval flow against an ephemeral Neon branch.

### Expected
Node-postgres to encode all JavaScript values passed to `jsonb` columns as JSON.

### Actual
Node-postgres encoded JavaScript arrays as PostgreSQL array literals rather than JSON. The first integration run failed while inserting approval assumption hashes with `invalid input syntax for type json`; the same latent defect affected effect resources and decision reason arrays.

### Severity
major

### Time lost
About four minutes.

### Workaround
Serialize every object or array bound to a `jsonb` parameter explicitly with `JSON.stringify`, then rerun the real-database integration test.

### Suggested improvement
Treat explicit JSON serialization as part of the repository boundary and retain the Neon integration flow as the regression test; static TypeScript checks cannot distinguish PostgreSQL array encoding from JSON encoding.

## FL-014

### Task
Move the verified control-plane handler from branch-tested code to the live AWS integration boundary.

### Expected
An authenticated AWS CLI context to be available for inspecting the target account and choosing the smallest deployable adapter from real account constraints.

### Actual
No `aws` executable or authenticated AWS context is available in the development environment. Creating speculative infrastructure without an account, region, identity boundary, or deployment target would weaken the fail-closed design.

### Severity
blocker

### Time lost
None; the preflight stopped before infrastructure changes.

### Workaround
Obtain an AWS account/role and region, install and authenticate the AWS CLI, then inspect available AgentCore and API hosting capabilities before adding deployment configuration.

### Suggested improvement
Add a documented AWS bootstrap preflight that checks caller identity, region, least-privilege deployment role, and required service availability without printing account credentials.

## FL-015

### Task
Assume the scoped AWS deployment role from GitHub Actions using OIDC.

### Expected
The conventional GitHub subject `repo:Mzoratto/mandate:environment:Production` to match the workflow identity.

### Actual
The 2026 GitHub OIDC token uses immutable owner and repository IDs in its subject: `repo:Mzoratto@149188019/mandate@1368354563:environment:Production`. AWS CloudTrail exposed the mismatch without exposing the token, and STS correctly denied every attempt.

### Severity
major

### Time lost
About five minutes.

### Workaround
Bind the role trust policy to the exact ID-bearing subject observed in CloudTrail, retain the audience check, and redeploy the bootstrap stack.

### Suggested improvement
Derive and record current OIDC claims before creating a trust policy instead of relying on historical GitHub subject examples.

## FL-016

### Task
Encrypt the private S3 deployment bucket from the scoped GitHub role.

### Expected
The policy action `s3:PutBucketEncryption` to authorize the `put-bucket-encryption` CLI operation.

### Actual
The IAM action is named `s3:PutEncryptionConfiguration`; AWS created the already-private bucket but denied its explicit encryption configuration.

### Severity
minor

### Time lost
About two minutes.

### Workaround
Correct the least-privilege role action and update the bootstrap stack. No broad permission was added.

### Suggested improvement
Validate CLI operation names against IAM service-authorization action names when authoring scoped deployment policies.

## FL-017

### Task
Cold-start the bundled control plane on the AWS Lambda Node.js 22 runtime.

### Expected
The esbuild ESM bundle to load the bundled `pg` dependency.

### Actual
`pg` retains CommonJS dynamic requires for Node built-ins. The ESM bundle failed during Lambda initialization with `Dynamic require of "events" is not supported`, so the Function URL correctly returned `502` before application code ran.

### Severity
major

### Time lost
About three minutes.

### Workaround
Emit the single Lambda bundle as CommonJS `index.js` and add a local import smoke test before redeployment.

### Suggested improvement
Match bundle module format to transitive dependency behavior and test loading the exact deployment artifact, not only its syntax.

## FL-018

### Task
Provision durable demo identities and rotate their production credentials.

### Expected
The provisioning insert to match migration 0002 exactly.

### Actual
The first script revision attempted to write a speculative `metadata` column that does not exist in `control_plane_credentials`. PostgreSQL rejected the transaction before any identity or credential persisted. The same run surfaced pg's announced future weakening of `sslmode=require` semantics.

### Severity
major

### Time lost
About three minutes.

### Workaround
Remove the unneeded metadata field, keep the existing minimal credential schema, and request `sslmode=verify-full` from Neon in every workflow.

### Suggested improvement
Use the checked-in schema as the only persistence contract for operational scripts, and make certificate verification explicit rather than relying on driver compatibility aliases.

## FL-019

### Task
Authenticate the newly provisioned demo principal through the live API.

### Expected
The provisioning script's SHA-256 output to match the repository authentication helper.

### Actual
The script stored the raw hexadecimal digest while `hashCredential` intentionally stores the algorithm-qualified form `sha256:<hex>`. Identity and credential rows committed, but the API returned `401`; no Mandate was created.

### Severity
major

### Time lost
About two minutes.

### Workaround
Use the same algorithm-qualified storage representation and rerun the idempotent credential rotation.

### Suggested improvement
Export credential hashing through an executable package boundary or assert the persisted format in provisioning tests instead of duplicating its representation.

## FL-020

### Task
Stage a production checkout Mandate for a live AgentOS exercise.

### Expected
Automation to create the draft and stop at `AWAITING_APPROVAL` for a separate human decision.

### Actual
The first provisioning workflow also called the principal approval endpoint and started an execution. Although the credential was identity-bound, workflow possession of it did not constitute a distinct human review. No AgentOS action was executed and no completion evidence was published.

### Severity
critical

### Time lost
About five minutes.

### Workaround
Change the protected repository assumption, force the next authorization check to emit `APPROVAL_INVALIDATED`, and confirm the mistakenly activated Mandate moved to `SUSPENDED`. Stage a new Mandate that stops at `AWAITING_APPROVAL`; require the user to approve its disclosed digest before execution starts.

### Suggested improvement
Keep credential provisioning, proposal staging, principal approval, and agent execution as separate authority ceremonies. Automation must never translate possession of a principal credential into approval.

## FL-021

### Task
Present the staged checkout Mandate for informed human approval.

### Expected
Its protected `repositoryCommit` assumption to identify the exact repository state AgentOS would receive.

### Actual
The canonical protocol fixture intentionally uses a placeholder `sha256:aaaa…` value and no checkout repository existed. The mismatch was found before requesting approval; the staged Mandate remained unapproved.

### Severity
major

### Time lost
About four minutes.

### Workaround
Create the minimal public `Mzoratto/checkout-demo` regression repository, reproduce its failing test, hash the exact initial Git commit object, and stage a new Mandate bound to that digest.

### Suggested improvement
Never promote protocol fixtures directly into live authority records. Live provisioning must require an independently resolved resource identity and reject fixture placeholders.

## FL-022

### Task
Settle a governed AgentOS action with trusted usage.

### Expected
The action evidence callback to run after the host receives usage for the bound turn.

### Actual
AgentOS originally published action evidence on `item/completed`, before the later `thread/tokenUsage/updated` notification. A fail-closed settlement callback therefore could not supply trusted accounting.

### Severity
major

### Time lost
About seven minutes plus CI time.

### Workaround
Delay evidence publication until the turn is complete and usage has been validated. The focused 87-test suite and deterministic CI passed; the fix shipped through AgentOS PR #118.

### Suggested improvement
Treat usage availability as a prerequisite in the AgentOS evidence lifecycle and preserve this event ordering in integration tests.

## FL-023

### Task
Run an independent read-only Codex review with custom criteria over an uncommitted repair.

### Expected
`codex exec review --uncommitted 'custom prompt'` to accept the documented positional prompt.

### Actual
The CLI rejected `--uncommitted` together with a positional prompt despite showing both in usage output.

### Severity
minor

### Time lost
Less than a minute.

### Workaround
Use `codex exec` with an explicit read-only sandbox, ephemeral session, ignored user configuration, and the verifier prompt.

### Suggested improvement
Align the review subcommand parser with its usage text or document that custom prompts require a different invocation mode.

## FL-024

### Task
Provision production verifier credentials with the same hashing representation as the API.

### Expected
Node.js to execute a script that imports the TypeScript repository helper.

### Actual
Local Node.js 24 stripped the imported types successfully, but the workflow's Node.js 22 runtime rejected the repository's constructor parameter properties with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` before opening a transaction.

### Severity
minor

### Time lost
About two minutes.

### Workaround
Keep the tiny algorithm-qualified SHA-256 expression inside the JavaScript provisioning boundary and retain API authentication tests for the stored representation.

### Suggested improvement
Do not rely on Node type stripping for operational scripts until every supported runtime handles the repository's TypeScript syntax, or publish a compiled utility boundary.

## FL-025

### Task
Deploy the updated Lambda through GitHub OIDC.

### Expected
The pinned AWS credential action to run without runtime deprecation warnings.

### Actual
GitHub reported that the pinned action targets deprecated Node.js 20 and forced it onto Node.js 24.

### Severity
minor

### Time lost
No deployment time; follow-up required.

### Workaround
The deployment completed successfully under GitHub's forced Node.js 24 compatibility path.

### Suggested improvement
Upgrade to a reviewed digest of an AWS credential-action release that declares a supported Node runtime, then rerun the OIDC deployment check.

### Resolution
Pinned `aws-actions/configure-aws-credentials` v6.2.4 by commit digest; it declares Node.js 24. Production deployment run 34790981908 passed without the deprecation warning.

## FL-026

### Task
Independently re-run event-chain verification over the authenticated production context from a bare Node command.

### Expected
Node.js 24 type stripping to load the workspace TypeScript entry point.

### Actual
The entry point's source imports use emitted `.js` specifiers, so bare Node could not resolve the sibling `.ts` files. The authenticated API read still verified the chain server-side and returned all 16 events; isolated Neon tests also exercised `verifyEventChain` directly.

### Severity
minor

### Time lost
Less than a minute.

### Workaround
Use the compiled application/test boundary rather than importing source TypeScript with bare Node.

### Suggested improvement
Provide a standard build artifact or project-local TypeScript runner for operational verification commands.

## FL-027

### Task
Inspect CloudWatch correlation for the production verifier requests.

### Expected
Only bounded request records and Lambda platform metrics.

### Actual
The first verification request emitted a node-postgres deprecation warning: multiple `client.query()` calls were started concurrently on one transaction client. The request committed successfully, but pg 9 will remove that implicit queueing behavior.

### Severity
major

### Time lost
About two minutes.

### Workaround
Execute all completion-state reads serially on the locked transaction client. Queries that use the pool outside a transaction may remain parallel.

### Suggested improvement
Treat one `PoolClient` as a serial resource and reserve `Promise.all` for independent pool acquisitions.

## FL-028

### Task
Start the filtered dashboard workspace on a non-default port for live browser verification.

### Expected
A separator before `--port` to forward the option to Next.js.

### Actual
`pnpm --filter @mandate/dashboard dev -- --port 3010` preserved the extra separator, so Next.js interpreted `--port` as a project directory.

### Severity
minor

### Time lost
Less than a minute.

### Workaround
Use `pnpm --filter @mandate/dashboard dev --port 3010`.

### Suggested improvement
Document the workspace-filter argument-forwarding form beside the development command.

## FL-029

### Task
Verify production dashboard response headers and credential non-disclosure.

### Expected
The selected local port to serve the new Mandate dashboard.

### Actual
Port 3012 was already occupied by an unrelated Next.js application. The new server failed with `EADDRINUSE`, while the first probe reached that unrelated app and returned misleading cache headers.

### Severity
minor

### Time lost
About one minute.

### Workaround
Check the listener and launched process before accepting an HTTP response, then repeat on unused port 31987. The actual dashboard returned `private, no-store`, the expected security headers, authenticated Mandate content, and no control-plane credential.

### Suggested improvement
Make local verification choose an unused port and assert both process health and a product-specific response marker.

## FL-030

### Task
Exercise the Next.js server loader and proxy from the root Vitest suite.

### Expected
Mocking `next/server` and importing `NextRequest` from a root-level test to resolve through the dashboard workspace.

### Actual
The `connection()` mock did not replace Next.js's resolved request-scope implementation, and the root workspace does not directly expose the dashboard's `next/server` dependency.

### Severity
minor

### Time lost
About three minutes.

### Workaround
Keep the request-scope wrapper thin, test an exported framework-independent fetch boundary, and pass a structural request object to the proxy test instead of importing a dashboard-private dependency.

### Suggested improvement
Preserve narrow framework seams for root integration tests and avoid depending on transitive workspace package resolution.

## FL-031

### Task
Create the immutable dashboard ECR repository through CloudFormation.

### Expected
`validate-template` to catch malformed embedded lifecycle-policy JSON before stack creation.

### Actual
The YAML was valid but the lifecycle-policy string was missing its final `}`. ECR rejected the resource, and the new stack entered `ROLLBACK_COMPLETE`, which cannot be updated.

### Severity
minor

### Time lost
About three minutes.

### Workaround
Close the JSON object, delete the rolled-back stack, and recreate it. The repository then reached `CREATE_COMPLETE`.

### Suggested improvement
Parse embedded JSON documents separately in CI instead of relying only on CloudFormation template validation.

## FL-032

### Task
Bound dashboard Lambda cost with two reserved concurrent executions.

### Expected
The account to permit a reservation of two.

### Actual
Lambda rejected the reservation because it would reduce the account's unreserved concurrency below the required minimum of ten.

### Severity
minor

### Time lost
About three minutes.

### Workaround
Remove reserved concurrency and retain the API Gateway stage throttle. The stack then created successfully.

### Suggested improvement
Check account concurrency quotas before declaring a reservation in environment-specific infrastructure.

## FL-033

### Task
Wait for a failed create stack to finish rolling back before deletion.

### Expected
`aws cloudformation wait stack-rollback-complete` to accept the create failure's `ROLLBACK_COMPLETE` state.

### Actual
The waiter did not terminate and consumed the full 20-minute command timeout even though the stack had already reached `ROLLBACK_COMPLETE`.

### Severity
minor

### Time lost
Twenty minutes.

### Workaround
Inspect `StackStatus` directly, then call `delete-stack` and `wait stack-delete-complete`.

### Suggested improvement
Use an explicit status poll for create rollback rather than the update-oriented rollback waiter.

## FL-034

### Task
Publish a Lambda-compatible amd64 container image.

### Expected
A single-platform Docker build to push a single image manifest.

### Actual
BuildKit attached provenance and pushed an OCI image index even with `--platform linux/amd64`. Lambda container deployments require a single-architecture manifest.

### Severity
minor

### Time lost
About two minutes.

### Workaround
Rebuild with `--provenance=false`; ECR then reported `application/vnd.oci.image.manifest.v1+json`.

### Suggested improvement
Assert ECR `imageManifestMediaType` before updating Lambda and keep provenance disabled for this deployment target.

## FL-035

### Task
Verify the live dashboard in a browser after moving the server from the local timezone to AWS Lambda UTC.

### Expected
Server and browser text to hydrate identically.

### Actual
React reported minified error `#418` because `Intl.DateTimeFormat` rendered event times in the server timezone while the browser rendered the same timestamps in the operator timezone.

### Severity
medium

### Time lost
About five minutes.

### Workaround
Format the validated ISO timestamp as an explicit UTC clock value with `toISOString()`. A regression test now fixes the expected output independently of host timezone.

### Suggested improvement
Never use an implicit host timezone for server-rendered text; choose a fixed timezone or defer localized formatting until after hydration.

## FL-036

### Task
Wait for the scoped GitHub dashboard deployment to finish updating Lambda.

### Expected
`lambda:GetFunctionConfiguration` to satisfy the `function-updated-v2` waiter.

### Actual
The image update succeeded, but AWS CLI v2's waiter called `lambda:GetFunction`; the scoped role lacked that exact action and the workflow failed after deployment.

### Severity
minor

### Time lost
About three minutes.

### Workaround
Replace the unused `lambda:GetFunctionConfiguration` permission with `lambda:GetFunction`, redeploy the scoped role, and rerun the workflow.

### Suggested improvement
Derive least-privilege waiter permissions from CloudTrail or a dry run of the exact pinned AWS CLI version rather than from similarly named API operations.

## FL-037

### Task
Review the ECR scan for the first deployed dashboard image.

### Expected
The minimal runtime image to avoid critical operating-system findings.

### Actual
The Debian slim runtime reported three critical and thirteen high findings, primarily in Perl and utility packages the Next.js server does not need at runtime.

### Severity
medium

### Time lost
About five minutes.

### Workaround
Keep Debian slim only for the build stage and run the standalone output on a digest-pinned, non-root distroless Node.js image. The local runtime remained functional, the image shrank from about 98 MB to 70 MB, and the preflight ECR scan returned no findings.

### Suggested improvement
Keep the deployment gate that waits for completed ECR scanning and rejects critical findings before Lambda update.

## FL-038

### Task
Wait for scan-on-push findings immediately after publishing an ECR image.

### Expected
The AWS `image-scan-complete` waiter to retry until the automatically scheduled scan existed and completed.

### Actual
The waiter exited immediately with `ScanNotFoundException` during ECR's short registration gap; the scan appeared as `IN_PROGRESS` seconds later.

### Severity
minor

### Time lost
About two minutes.

### Workaround
Poll `describe-image-scan-findings`, tolerate the initial not-found response, fail on `FAILED`, and require `COMPLETE` within three minutes.

### Suggested improvement
Treat scan registration and scan completion as separate asynchronous states in deployment tooling.

## FL-039

### Task
Run an automated axe accessibility scan against the production-mode public demonstration.

### Expected
The ephemeral axe CLI to discover a compatible local Chrome installation.

### Actual
The first run could not find Chrome. Pointing it at the existing Playwright browser then failed because the CLI's ChromeDriver supported version 153 while the browser was version 151.

### Severity
minor

### Time lost
About two minutes.

### Workaround
Install a synchronized Chrome 153 and ChromeDriver pair with `browser-driver-manager`, pass both exact paths to axe, and disable GPU rendering for the WebGL page. The final scan completed with zero detected violations.

### Suggested improvement
Accessibility CLIs should resolve or provision a browser and driver as a synchronized pair rather than discovering them independently.

## FL-040

### Task
Deploy a public guided demonstration while retaining authentication on the operator record.

### Expected
The deployment workflow to verify both route boundaries after the image update.

### Actual
The image deployed successfully, but the inherited smoke test still required the root URL to return `401`. The root now intentionally returns the public, non-executing demonstration with `200`, so the post-deploy job failed.

### Severity
minor

### Time lost
About four minutes.

### Workaround
Verify a product-specific marker and `200` at `/`, then independently require `401` at `/dashboard`.

### Suggested improvement
Keep deployment probes tied to explicit route contracts rather than assuming that one authentication policy covers an entire application.

## FL-041

### Task
Promote the follow-up dashboard image after its mandatory ECR basic scan.

### Expected
The existing three-minute explicit scan poll to reach `COMPLETE`.

### Actual
The scan remained pending beyond all 36 five-second attempts, so promotion stopped before Lambda update. A rerun found the same immutable image already scanned and safely promoted it without rebuilding.

### Severity
minor

### Time lost
About four minutes.

### Workaround
Rerun against the already-pushed immutable image, then extend the bounded polling window from three to six minutes for future scan queue variance.

### Suggested improvement
Expose ECR scan queue latency or an event-driven completion signal so deploy gates do not need to guess a polling deadline.

## FL-042

### Task
Verify that a judge could reproduce the governed AgentOS checkout path from the required public repository.

### Expected
Every runtime component needed by the published rehearsal to be available from the public Mandate source tree.

### Actual
The rehearsal required `AGENTOS_ROOT` and dynamically imported three files from a separate private AgentOS checkout. The public README also linked to private pull requests that returned `404` to unauthenticated judges.

### Severity
major

### Time lost
About fifteen minutes.

### Workaround
Extract the rehearsal's AgentOS runner dependency closure, including its checksum-bound approval relay and deterministic Mandate interceptor, into the Apache-2.0 `@mandate/agentos-reference-host` workspace package; update the rehearsal to import that package and replace private proof links with public source.

### Suggested improvement
Include an unauthenticated public-clone rehearsal in submission readiness checks; authenticated repository access can hide missing-source failures from maintainers.

## FL-043

### Task
Create the stateless Web-standard MCP Streamable HTTP transport under strict TypeScript settings.

### Expected
Passing `sessionIdGenerator: undefined`, as shown conceptually in the SDK documentation, to enable stateless mode.

### Actual
The SDK option is optional but does not explicitly include `undefined`; TypeScript's `exactOptionalPropertyTypes` therefore rejected the documented object shape.

### Severity
minor

### Time lost
Less than one minute.

### Workaround
Omit `sessionIdGenerator` entirely. The transport then uses its documented stateless default.

### Suggested improvement
MCP SDK examples should compile with `exactOptionalPropertyTypes`, either by omitting optional properties or declaring explicit `undefined` where supported.

## FL-044

### Task
Select an MCP TypeScript SDK that matches Alexa+'s required MCP `2025-11-25` protocol version.

### Expected
The latest stable major release to be the safest default.

### Actual
The split `@modelcontextprotocol/server` 2.0.0 package targets the newer `2026-07-28` protocol, while Alexa+'s current onboarding documentation specifies `2025-11-25`. The current MCP Apps 2.0 package also requires the split 2.0 package family and cannot be mixed with the v1 SDK.

### Severity
major

### Time lost
About five minutes.

### Workaround
Pin `@modelcontextprotocol/sdk` 1.30.0 for the first transport slice; that release declares `2025-11-25` as its latest negotiated version and still supports Web-standard Streamable HTTP. Defer MCP Apps until Alexa's supported extension/package combination is verified in its Local Inspector.

### Suggested improvement
Alexa+ documentation should publish a tested SDK/package compatibility matrix for the required MCP protocol and MCP Apps extension versions.

## FL-045

### Task
Run the independent pre-PR Codex review against the uncommitted Alexa/MCP foundation.

### Expected
`codex exec review --uncommitted` to use the configured default model and complete read-only review.

### Actual
Codex selected `gpt-6-astra`, warned that its model metadata was missing, then returned HTTP `400` because that model requires a newer CLI.

### Severity
minor

### Time lost
About one minute.

### Workaround
Rerun as `codex exec -m gpt-5.6-sol review --uncommitted`. The review completed and found three actionable ordering, file-move, and paused-status issues, all covered by regression fixes.

### Suggested improvement
Codex should validate configured model/CLI compatibility before starting a review and automatically suggest an installed compatible model.

## FL-046

### Task
Measure the deployed MCP status path against Alexa+'s latency guidance.

### Expected
A representative warm request sample to separate application work from connection setup.

### Actual
One-process-per-request `curl` samples repeatedly paid DNS/TLS setup and showed a `1.46 s` p95. A persistent Node.js client reduced the health p95 to `473 ms`, but the authenticated status path still reached `1.11 s` because authentication plus the generic operator-context loader performed several sequential Neon round trips.

### Severity
major

### Time lost
About ten minutes.

### Workaround
Add a minimized MCP-specific context query, combine opaque-token authentication and owned-record loading into one SQL round trip for customer status tools, and retain the full multi-query context only for the operator API.

### Suggested improvement
Benchmark the exact persistent transport used by the target client and design read models around bounded remote-database round trips rather than reusing an expansive operator projection.

### Resolution
The merged minimized projection and combined opaque-credential lookup were deployed in run 34843379804. After five warm-up calls, 30 persistent-client production status reads measured a `277 ms` median and `326 ms` p95, down from `751 ms` and `1.113 s` respectively. OAuth and Alexa-hosted latency remain separate unproven boundaries.

## FL-047

### Task
Run the expanded transactional control-plane integration suite against an ephemeral Neon CI branch.

### Expected
The comprehensive authorization-flow test to remain within its existing 30-second per-test bound.

### Actual
The new OAuth subject and minimized MCP read probes added five real remote database round trips to that already broad flow. Under the CI branch's observed latency, the test reached the 30-second timeout while sibling flows took about six and twenty-one seconds; the same full suite passed locally in under three seconds.

### Severity
minor

### Time lost
About two minutes.

### Workaround
Raise only the comprehensive flow's bounded timeout to 60 seconds while retaining the original limits on the smaller integration cases and keeping runtime MCP latency tests separate.

### Suggested improvement
Keep remote branch correctness suites tolerant of bounded network variance and enforce endpoint latency with dedicated warm-client measurements rather than a wall-clock limit on a multi-step lifecycle test.

## FL-048

### Task
Reconcile the implemented RFC 9728 authentication challenge with Alexa+'s account-linking behavior.

### Expected
A standards-oriented `WWW-Authenticate` response pointing to protected-resource metadata to be accepted by the MCP client.

### Actual
Alexa+'s authentication documentation explicitly lists `WWW-Authenticate` headers as unsupported and initiates linking from an HTTP `401` or `403` on a customer-specific tool. Advertising the reserved `mcp:service` scope in customer protected-resource metadata could also request service authority during the user flow.

### Severity
major

### Time lost
About five minutes.

### Workaround
Keep RFC 9728 metadata at the documented well-known paths, advertise only `mcp:tools mcp:resources`, omit `WWW-Authenticate` on all failures, and return transport-level `403` when a service token attempts a customer tool.

### Suggested improvement
Alexa+'s MCP documentation should clearly distinguish its discovery mechanism from the general MCP authorization challenge flow and publish exact protected-resource metadata examples for two-tier authentication.
