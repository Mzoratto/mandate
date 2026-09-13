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
