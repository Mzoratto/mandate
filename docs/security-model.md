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
- generic shell commands remain uncertain and cannot receive high-confidence authorization.

## Fail-closed integration rules

A production execution host must prove isolated worktrees, before-action interception, stop on denial, and evidence callbacks. Missing capability blocks startup. Dry-run mapping does not count as governed execution evidence.

Database approval nonces require a unique constraint. Version, approval, authorization-decision, and event records must be append-only to the application identity. Those database permissions and migrations are not active until a Lakebase Postgres branch is provisioned.

Verifier and assumption identities must come from authenticated server context. A string supplied by an agent is not a verifier or trusted assumption source.

## Current security gaps

- no authenticated API exists;
- no database transaction path has been exercised;
- no IAM or network boundary prevents direct tool use;
- the local AgentOS checkout lacks the required live bridge;
- Alexa+, AgentCore, and CloudWatch are not connected;
- generic shell interpretation is intentionally incomplete and escalates;
- local frozen objects do not substitute for database immutability.

The current code is a tested protocol/runtime prototype, not a production authorization service.
