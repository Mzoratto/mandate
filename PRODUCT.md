# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are people delegating consequential, multi-step work to autonomous agents. In the hackathon scenario, a human uses Alexa+ to authorize and supervise an AgentOS checkout repair without approving each plan change or tool call.

Secondary users are agent-runtime and governance engineers integrating the open protocol into other control surfaces and execution frameworks.

## Product Purpose

Mandate lets a principal delegate a measurable outcome inside an explicit, machine-readable authority envelope. The subject may replan autonomously within that envelope; expanding scope, effects, budgets, validity, or delegation rights requires a structured amendment and explicit eligible-principal approval.

Success means preserving non-expandable authority, interrupting the human only for material authority decisions, and closing work only with independently verified evidence.

## Positioning

Permissions define what an agent can do. Mandate defines what a human delegated the agent to accomplish.

Unlike plan-bound intent authorization, Mandate permits execution-strategy changes without renewed approval when authority does not expand.

## Operating Context

- Alexa+ is the reference human authority interface.
- AgentOS is the first reference autonomous runtime, not a core dependency.
- Amazon Bedrock AgentCore Gateway and Policy are intended enforcement infrastructure.
- CloudWatch complements the protocol event ledger with infrastructure traces.
- Lakebase Postgres on Neon is the intended durable control-plane store.
- The checkout-repair demonstration includes one rejected database-authority amendment followed by a compliant alternative.

## Capabilities and Constraints

- Canonical protocol and implementation language: TypeScript.
- Approved Mandate versions are immutable and content-digested.
- Child authority must be a deterministic subset of parent authority.
- Deterministic denial always overrides semantic output.
- Unknown consequential effects default to denial or escalation.
- Protected assumption changes invalidate approval.
- Completion requires configured criteria and verified evidence.
- Consequential production paths must pass through enforcement boundaries; unverifiable integrations fail closed.
- The open-source core must remain independent of Alexa+, AWS, Neon, and AgentOS internals.
- v0.1 does not provide generic enterprise policy administration, universal shell interpretation, reusable per-action approvals, or production deployment authority.

## Brand Commitments

- Name: Mandate.
- Tagline: “Delegate outcomes, not tool calls.”
- Core line: “The agent was free to change its plan. It was never free to change its authority.”
- Voice is direct, precise, calm, and explicit about authority changes. It avoids generic warnings and hidden scope expansion.
- The approved dashboard world is a dark mission-control instrument centered on a procedural authority portrait; `DESIGN.md` owns its durable visual rules.

## Evidence on Hand

- Normative semantics: `docs/protocol-v0.1.md`.
- Canonical protocol fixtures: `tests/fixtures/protocol-v0.1/`.
- Local conformance, lifecycle, delegation, amendment, evidence, and adversarial tests.
- The authenticated control plane is live on AWS Lambda with Neon persistence and CloudWatch request correlation.
- A deterministic AgentOS checkout rehearsal completed through separate Mandate and checksum-bound human gates, with independently authenticated test/review evidence and a merged output PR.
- Alexa+ and AgentCore remain unconfigured; interfaces must not imply those integrations are live.

## Product Principles

1. Delegate outcomes, not implementation plans.
2. Permit autonomous adaptation without autonomous authority expansion.
3. Show authority deltas and consequences instead of generic confirmation prompts.
4. Prefer deterministic enforcement and independently produced evidence over model assertions.
5. Fail closed when identity, classification, freshness, provenance, or interception cannot be proven.

## Accessibility & Inclusion

Authority decisions must work beyond voice alone. Material amendments require a visual, keyboard-operable review surface with explicit scope and risk changes, alternatives, reversibility, and clear approve/reject actions. Status, severity, and decisions must never rely on color alone.

## Open Decisions

The final Alexa+ interaction surface, broad AgentOS interception boundary, and AgentCore policy integration remain open. The dashboard visual system is approved; live records require authenticated server retrieval, while fixture states remain available only in explicitly illustrative mode.
