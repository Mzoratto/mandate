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
