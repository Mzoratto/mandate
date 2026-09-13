# Security model

The normative rules are in [`protocol-v0.1.md`](protocol-v0.1.md). This page describes the implemented enforcement boundaries and current gaps.

## Trusted components

- the control plane that authenticates principals and subjects;
- deterministic effect adapters and their typed metadata;
- the conformance runtime;
- cumulative accounting storage;
- configured evidence verifiers;
- the event store;
- an execution host that cannot bypass pre-action interception.

## Untrusted inputs

- agent plans, messages, and tool proposals;
- semantic-classifier output;
- repository content and instructions;
- MCP tool responses;
- evidence submitted by an agent before independent verification;
- caller-provided resource names, costs, and assumption values unless supplied through a trusted adapter.

## Enforced locally

- forbid-wins effect decisions;
- default denial for effects without allowed rules;
- escalation below `0.95` classification confidence;
- normalized resource-scope checks with traversal rejection;
- cumulative cost, token, mutation, external-call, and wall-clock limits;
- immutable approved snapshots returned by lifecycle helpers;
- principal-bound approvals and version digests;
- child authority attenuation and protected-assumption inheritance;
- stale-approval invalidation;
- top-level-only immutable amendment candidates;
- evidence- and criterion-gated completion;
- event hash-chain verification;
- generic shell commands remain uncertain and cannot receive high-confidence authorization;
- opaque bearer credentials are stored only as SHA-256 hashes and resolve to exactly one principal or agent;
- protected repository operations enforce owning-principal or bound-subject access;
- authorization and settlement replays require matching canonical request digests;
- action, effect, decision, usage, evidence, status, and event writes share locked database transactions.

## Fail-closed integration rules

A production execution host must prove isolated worktrees, before-action interception, stop on denial, and evidence callbacks. Missing capability blocks startup. Dry-run mapping does not count as governed execution evidence.

Database approval nonces have a unique replay-guard index. Action authorization and settlement payloads are digest-bound for idempotency. Migration files are digest-pinned after application and serialized with a Postgres advisory lock. Version, approval, authorization-decision, and event records must still be made append-only to the eventual application identity; the migration owner necessarily retains schema privileges.

Bearer tokens are server credentials, require TLS, and must not enter browser bundles or logs. The reference handler authenticates and authorizes requests but deliberately leaves public-edge rate limiting and identity-provider sessions to its deployment adapter.

Verifier and assumption identities must come from authenticated server context. A string supplied by an agent is not a verifier or trusted assumption source.

## Current security gaps

- the authenticated handler is not deployed and has no public-edge rate limiter or federated human session provider;
- database roles have not yet separated migration ownership from append-only application access;
- no IAM or network boundary prevents direct tool use;
- the AgentOS interception seam is implemented but not yet injected by an authenticated control plane;
- Alexa+, AgentCore, and CloudWatch are not connected;
- generic shell interpretation is intentionally incomplete and escalates;
- local frozen objects do not substitute for database immutability.

The current code is a tested protocol/runtime prototype, not a production authorization service.
