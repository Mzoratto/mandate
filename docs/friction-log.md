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
