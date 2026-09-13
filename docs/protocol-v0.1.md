# Mandate Protocol v0.1

**Status:** Semantics freeze candidate 1  
**Protocol version:** `0.1`  
**Scope:** Checkout-repair reference scenario only

This document is normative. The terms **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are interpreted as requirements. A v0.1 implementation must not add authority through behavior not defined here.

## 1. Core rule

A Mandate authorizes a subject to pursue a goal inside an authority envelope.

> A subject may change its plan. It may not increase its effective authority without approval from the Mandate principal.

Plans are runtime data and are not part of the Mandate version. Changing a plan never changes authority. Changes to scope, effect permissions, limits, validity, or delegation rights are authority changes.

## 2. Canonical data model

All API and stored JSON uses camelCase field names. Unknown fields are rejected in signed or persisted protocol objects.

```ts
export type MandateStatus =
  | "DRAFT"
  | "PROPOSED"
  | "AWAITING_APPROVAL"
  | "ACTIVE"
  | "SUSPENDED"
  | "AMENDMENT_PENDING"
  | "COMPLETED"
  | "REJECTED"
  | "REVOKED"
  | "EXPIRED";

export type PrincipalType = "human" | "organization" | "service";
export type RuntimeType = "agentos" | "strands" | "custom";
export type CriterionType = "test" | "review" | "state" | "metric" | "human";
export type ResourceKind =
  | "repository"
  | "path"
  | "service"
  | "database"
  | "api"
  | "generic";

export type EffectType =
  | "CODE_READ"
  | "CODE_MODIFICATION"
  | "TEST_MODIFICATION"
  | "DEPENDENCY_MODIFICATION"
  | "BRANCH_CREATION"
  | "LOCAL_COMMAND_EXECUTION"
  | "NETWORK_REQUEST"
  | "DATABASE_SCHEMA_MUTATION"
  | "PRODUCTION_DEPLOYMENT"
  | "SECRET_READ"
  | "SECRET_WRITE";

export interface PrincipalRef {
  type: PrincipalType;
  id: string;
  tenantId?: string;
}

export interface SubjectRef {
  agentId: string;
  runtime: RuntimeType;
  instanceId?: string;
}

export interface SuccessCriterion {
  id: string;
  type: CriterionType;
  description: string;
  verifier: string;
  required: boolean;
}

export interface GoalDefinition {
  statement: string;
  successCriteria: SuccessCriterion[];
}

export interface ResourceScope {
  kind: ResourceKind;
  resource: string;
  include?: string[];
  exclude?: string[];
}

export interface ScopeDefinition {
  resources: ResourceScope[];
  environments: string[];
}

export interface EffectRule {
  type: EffectType;
  environments?: string[];
}

export interface AuthorityDefinition {
  allowedEffects: EffectRule[];
  forbiddenEffects: EffectRule[];
  approvalRequiredEffects: EffectRule[];
}

export interface LimitDefinition {
  monetaryBudgetUsd?: number;
  tokenBudget?: number;
  maxExecutionSeconds?: number;
  maxMutations?: number;
  maxExternalCalls?: number;
}

export interface DelegationDefinition {
  allowed: boolean;
  maxDepth: number;
  requireExplicitChildScope: boolean;
}

export type EscalationType =
  | "SCOPE_EXPANSION"
  | "FORBIDDEN_EFFECT_REQUIRED"
  | "IRREVERSIBLE_EFFECT"
  | "RISK_INCREASE"
  | "BUDGET_INCREASE"
  | "ASSUMPTION_INVALIDATED"
  | "UNCERTAIN_CLASSIFICATION"
  | "EVIDENCE_FAILURE";

export interface EscalationCondition {
  type: EscalationType;
  threshold?: number;
}

export interface EscalationDefinition {
  conditions: EscalationCondition[];
  defaultAction: "BLOCK" | "SUSPEND";
}

export type EvidenceType =
  | "test-report"
  | "review"
  | "artifact"
  | "trace"
  | "signature"
  | "state-check";

export interface EvidenceRequirement {
  id: string;
  type: EvidenceType;
  required: boolean;
  verifier?: string;
}

export interface EvidenceDefinition {
  requirements: EvidenceRequirement[];
}

export interface ValidityDefinition {
  notBefore?: string;
  expiresAt: string;
}

export interface ApprovalAssumption {
  key: string;
  valueHash: string;
  invalidatesOnChange: boolean;
}

export interface Mandate {
  protocolVersion: "0.1";
  id: string;
  version: number;
  supersedes?: string;
  parent?: string;

  principal: PrincipalRef;
  subject: SubjectRef;
  goal: GoalDefinition;
  scope: ScopeDefinition;
  authority: AuthorityDefinition;
  limits: LimitDefinition;
  delegation: DelegationDefinition;
  escalation: EscalationDefinition;
  evidence: EvidenceDefinition;
  validity: ValidityDefinition;
  assumptions: ApprovalAssumption[];

  status: MandateStatus;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
}
```

### 2.1 Scalar rules

- IDs MUST match `[A-Za-z0-9][A-Za-z0-9._:-]{0,127}`.
- `version` MUST be a positive safe integer.
- `supersedes` and `parent` MUST use `<mandate-id>@<version>`.
- Timestamps MUST be UTC RFC 3339 with milliseconds: `YYYY-MM-DDTHH:mm:ss.sssZ`.
- Hashes MUST use `sha256:<64 lowercase hexadecimal characters>`.
- Arrays representing sets MUST be duplicate-free. Canonical producers sort string arrays lexicographically and object sets by `id`, then `key`, then `type`, then `kind` plus `resource`, whichever first applies.
- Descriptive arrays, including amendment alternatives, preserve author order.
- Limits MUST be non-negative safe integers, except `monetaryBudgetUsd`, which MUST be finite, non-negative, and have at most six decimal places. Runtime accounting converts it to integer micro-USD.
- An empty environment list or empty `resources` list grants no scope.
- Environment names MUST match `[a-z][a-z0-9-]{0,62}`.
- Required criteria and evidence requirements MUST name a non-empty verifier. A missing verifier is allowed only when `required` is `false`.

### 2.2 Immutable content

The approved content projection contains every Mandate field except:

- `status`;
- `approvedAt`;
- `completedAt`.

Its RFC 8785 canonical JSON digest is the **version digest**. The content projection, including `createdAt`, MUST NOT change after entering `AWAITING_APPROVAL`. Operational status and timestamps are stored separately even if an API returns the combined shape above.

## 3. Resource scope

### 3.1 Demo resource grammar

A normalized resource is:

```text
<kind>://<resource>[/<relative-path>]
```

Examples:

```text
repository://checkout-demo/services/checkout/validation.ts
database://checkout-db/schema
service://checkout-api
```

`kind` and `resource` MUST equal the corresponding `ResourceScope` values. Relative paths use `/`, MUST NOT begin with `/`, and MUST NOT contain empty, `.`, or `..` segments. Percent-encoded traversal is decoded and rejected before matching. A path is required for repository reads and file mutations. `BRANCH_CREATION` may target the repository container URI without a path.

For `repository` and `path`, `include` and `exclude` contain only:

- an exact normalized relative path; or
- a normalized directory prefix ending in `/**`.

No other glob syntax is valid in v0.1. Omitted `include` means `["**"]`. Omitted `exclude` means `[]`. For non-path resource kinds, `include` and `exclude` MUST be omitted.

### 3.2 Matching

A prefix pattern `a/b/**` matches `a/b` and every descendant. `**` matches every relative path. An exact pattern matches only itself.

A normalized resource is in scope when:

1. its environment is listed in `scope.environments`;
2. a scope entry has the same kind and resource identifier;
3. for a path-bearing resource, an include pattern matches its path; and
4. for a path-bearing resource, no exclude pattern matches its path.

Exclusion wins over inclusion. A pathless repository container is in scope only for `BRANCH_CREATION`; include and exclude patterns do not change that permission. Every resource attached to an effect MUST be in scope unless the matching forbidden rule already denies that effect. A resource-free effect is valid only for `LOCAL_COMMAND_EXECUTION`; it is bound to the execution's declared worktree resource and environment.

### 3.3 Scope subset

A child or contracted scope `C` is a subset of parent scope `P` only if:

- `C.environments ⊆ P.environments`;
- every child scope entry has a parent entry with the same `kind` and `resource`;
- every child include is covered by a parent include; and
- every parent exclusion that intersects a child include is covered by an equal or broader child exclusion.

Because v0.1 permits only exact and terminal-prefix patterns, these checks are deterministic. If the checker cannot prove inclusion, it MUST reject the subset claim.

## 4. Demo effect taxonomy

| Effect | Meaning | Demo classification examples |
|---|---|---|
| `CODE_READ` | Read repository content that is not a secret | file read, search, diff |
| `CODE_MODIFICATION` | Change non-test source or configuration | edit under `services/checkout/**` |
| `TEST_MODIFICATION` | Change tests or test fixtures | edit under `tests/checkout/**` |
| `DEPENDENCY_MODIFICATION` | Change dependency declarations or lockfiles | edit `package.json` or lockfile |
| `BRANCH_CREATION` | Create a local or remote VCS branch | `git switch -c` |
| `LOCAL_COMMAND_EXECUTION` | Start a process in the isolated demo environment | test, formatter, or review command |
| `NETWORK_REQUEST` | Make an outbound request not intrinsic to the trusted runtime | package download or external API call |
| `DATABASE_SCHEMA_MUTATION` | Create, alter, or drop database schema objects | migration file execution or DDL |
| `PRODUCTION_DEPLOYMENT` | Change production runtime state or release code | deploy/promote command |
| `SECRET_READ` | Read secret material | secret manager read or `.env` credential access |
| `SECRET_WRITE` | Create, rotate, or alter secret material | secret manager write |

Classification returns all effects an action may produce. `LOCAL_COMMAND_EXECUTION` never masks nested effects; for example, a shell migration is both `LOCAL_COMMAND_EXECUTION` and `DATABASE_SCHEMA_MUTATION`.

A deterministic adapter or typed tool declaration is required to allow an action. A semantic classifier MAY add effects, lower confidence, or request escalation. It MUST NOT remove a deterministic effect or turn a deterministic deny into an allow.

```ts
export interface ProposedAction {
  actionId: string;
  tool: string;
  operation: string;
  inputs: Record<string, unknown>;
}

export interface NormalizedEffect {
  type: EffectType;
  resources: string[];
  environment?: string;
  reversible: boolean;
  estimatedCostUsd?: number;
  confidence: number;
}
```

`confidence` is in `[0, 1]`. Consequential effects below `0.95` MUST escalate. An action that may be consequential but cannot be classified MUST escalate as `UNCERTAIN_CLASSIFICATION`; it is never default-allowed.

## 5. Effect-rule semantics

An effect rule matches when its `type` equals the effect type and either:

- `environments` is omitted; or
- the effect environment is listed in `environments`.

For each effect, the authority rank is:

```text
DENY = 0 < ESCALATE = 1 < ALLOW = 2
```

The rank is selected in this order:

1. matching `forbiddenEffects` rule → `DENY`;
2. matching `approvalRequiredEffects` rule → `ESCALATE`;
3. matching `allowedEffects` rule → `ALLOW`;
4. no matching rule → `DENY`.

A matching forbidden rule always wins. Approval-required effects cannot execute in v0.1. They require rejection or an approved amendment that grants suitably bounded allowed authority. v0.1 has no reusable per-action approval token.

A proposed action is allowed only if every normalized effect is allowed, every resource is in scope, all limits admit the projected action, the approval is fresh, and the Mandate is active and valid.

Overall decision precedence is:

```text
INVALIDATE_APPROVAL > DENY > ESCALATE > ALLOW
```

The engine SHOULD return every deterministic reason at the winning precedence, without allowing a lower-precedence result to override it.

## 6. Limits and accumulated state

Absent limits mean unbounded for that dimension. A child or contraction cannot replace a finite limit with an absent limit.

Trusted runtime state contains at least:

```ts
export interface ExecutionState {
  startedAt: string;
  monetarySpentUsd: number;
  tokensUsed: number;
  mutationActions: number;
  externalCallActions: number;
  delegationDepth: number;
}
```

Accounting rules:

- Money is compared as integer micro-USD.
- `maxExecutionSeconds` is wall-clock time from `startedAt`, including suspension.
- `maxMutations` counts executed actions containing one or more mutating effects; one action counts once.
- Mutating effects are `CODE_MODIFICATION`, `TEST_MODIFICATION`, `DEPENDENCY_MODIFICATION`, `BRANCH_CREATION`, `DATABASE_SCHEMA_MUTATION`, `PRODUCTION_DEPLOYMENT`, and `SECRET_WRITE`.
- `maxExternalCalls` counts executed actions containing `NETWORK_REQUEST`; one action counts once.
- Token and money usage come from trusted runtime/provider records, not agent claims.
- The runtime MUST reserve projected usage before execution and settle actual usage afterward. An action is denied if the reservation would exceed a limit.
- Starting a new process, agent session, or child Mandate MUST NOT reset accumulated parent limits.

## 7. Exact authority subset relation

`authority(B) ⊆ authority(A)` is true only when all checks below pass:

1. B's resource scope is a subset of A's scope under section 3.3.
2. For every effect type and every environment reachable in B, B's authority rank is less than or equal to A's rank.
3. Every numeric limit in B is less than or equal to A's corresponding limit, treating absence as infinity.
4. B's validity interval is contained by A's validity interval.
5. B cannot delegate if A cannot delegate.
6. B's `maxDepth` is no greater than A's remaining permitted depth.
7. B cannot change `requireExplicitChildScope` from `true` to `false`.

For direct child Mandates, `child.delegation.maxDepth <= parent.delegation.maxDepth - 1`. A parent with `maxDepth: 0` cannot create a child.

Principal, subject, goal, evidence, assumptions, and escalation copy are not used to prove authority subset. They have separate creation rules: a child MUST preserve the parent principal and every protected parent assumption, name a distinct subject, include `parent`, define an explicit scope, and pass a goal-relation check. A deterministic adapter may establish goal relation; otherwise the runtime MUST escalate. Semantic relation can block or escalate but never compensate for a failed authority subset check.

If subset cannot be proven, the operation is an expansion.

## 8. Authority contraction

Contraction narrows effective runtime authority without changing the approved Mandate version.

A contraction overlay MAY narrow only:

- resource scope;
- effect authority rank;
- limits;
- validity end time;
- delegation rights.

It MUST pass the subset algorithm against the currently effective envelope. Applied overlays are monotonic and cannot be removed during the execution. Each application emits `AUTHORITY_CONTRACTED` with the previous and next envelope digests.

Contraction cannot alter the principal, subject, goal, required criteria, required evidence, or assumptions. It requires no new human approval because the original version and approval remain unchanged.

## 9. Versioning and lifecycle

### 9.1 Version rules

- A new Mandate starts at version `1`.
- Draft content may change only while status is `DRAFT`.
- Entering `PROPOSED` freezes content.
- Validation and identity binding move `PROPOSED` to `AWAITING_APPROVAL`.
- Approval records the principal, version, version digest, approval time, and approval assumption hashes.
- Only an approved amendment creates the next version.
- The new version uses the same `id`, increments `version` by exactly one, and sets `supersedes` to the prior `<id>@<version>`.
- At most one version of a Mandate is current. Activating a new version atomically changes the current-version pointer; prior version content remains immutable.
- Old approval records never authorize a newer version.
- Rejected or expired amendment candidates do not consume a version number.

### 9.2 Legal transitions

```text
DRAFT -> PROPOSED
PROPOSED -> AWAITING_APPROVAL | REJECTED
AWAITING_APPROVAL -> ACTIVE | REJECTED | EXPIRED
ACTIVE -> SUSPENDED | AMENDMENT_PENDING | COMPLETED | REVOKED | EXPIRED
AMENDMENT_PENDING -> ACTIVE | SUSPENDED | REVOKED | EXPIRED
SUSPENDED -> ACTIVE | REVOKED | EXPIRED
```

All other transitions are illegal. `COMPLETED`, `REJECTED`, `REVOKED`, and `EXPIRED` are terminal. Resume to `ACTIVE` requires a fresh approval, valid time window, no pending amendment, and no unresolved safety violation.

While `AMENDMENT_PENDING`, new consequential actions are blocked. If escalation `defaultAction` is `SUSPEND`, an escalation without an amendment moves directly to `SUSPENDED`; otherwise the failed action is blocked and the Mandate remains `ACTIVE`.

## 10. Amendments

```ts
export type MandatePatchPath =
  | "/goal"
  | "/scope"
  | "/authority"
  | "/limits"
  | "/delegation"
  | "/escalation"
  | "/evidence"
  | "/validity"
  | "/assumptions";

export interface MandatePatch {
  op: "replace";
  path: MandatePatchPath;
  value: unknown;
}

export interface EvidenceRef {
  id: string;
  digest?: string;
}

export interface AmendmentAlternative {
  description: string;
  authorityChangeRequired: boolean;
  reversible: boolean;
}

export interface RiskDelta {
  from: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  to: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasons: string[];
}

export interface MandateAmendment {
  id: string;
  mandateId: string;
  baseVersion: number;
  baseVersionDigest: string;
  requestedChanges: MandatePatch[];
  reason: string;
  discoveryEvidence: EvidenceRef[];
  alternatives: AmendmentAlternative[];
  riskDelta: RiskDelta;
  rollback?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
}
```

Rules:

1. Patches replace complete top-level sections. Array-index and nested patches are forbidden.
2. A path may appear at most once.
3. Applying patches must produce a schema-valid candidate.
4. IDs, version, principal, subject, `createdAt`, and state fields cannot be patched. Principal or subject transfer requires a new Mandate.
5. A pending amendment is immutable. Any edit creates a new amendment.
6. Approval fails if `baseVersion` or `baseVersionDigest` is no longer current.
7. Approval fails if candidate assumptions do not match approval-time state.
8. Approval atomically creates and activates the next immutable version and marks the amendment approved.
9. Rejecting an amendment performs no content change. The Mandate returns to `ACTIVE` unless the principal chose suspension or another violation prevents resumption.
10. `riskDelta`, alternatives, and rollback are mandatory human context but never grant authority.

Automatic contraction does not use amendments. Every expansion and every weakening of required success criteria or evidence does.

## 11. Stale approval

At approval, each assumption is bound to the approval record. Before every consequential action, amendment approval, resume, and completion:

1. load each assumption with `invalidatesOnChange: true` from a trusted source;
2. compare by exact key and hash;
3. treat a missing, unreadable, or different current value as changed.

Additional current assumptions do not invalidate approval. Informational assumptions with `invalidatesOnChange: false` do not invalidate approval.

Any protected change returns `INVALIDATE_APPROVAL`, emits `APPROVAL_INVALIDATED`, and moves the Mandate to `SUSPENDED`. The old approval cannot be revived. Because assumption hashes are immutable version content, resumption after an assumption change requires an approved amendment containing the new assumption snapshot. A new approval of unchanged content cannot silently replace those hashes.

Approval tokens MUST include principal ID, Mandate ID, version, version digest, and a unique nonce. Tokens are single-version and replay-protected.

## 12. Evidence and completion

```ts
export interface EvidenceRecord {
  id: string;
  mandateId: string;
  mandateVersion: number;
  requirementId?: string;
  type: EvidenceType;
  producer: string;
  artifactUri?: string;
  digest?: string;
  verified: boolean;
  verifiedBy?: string;
  createdAt: string;
}

export interface CriterionResult {
  criterionId: string;
  mandateId: string;
  mandateVersion: number;
  status: "PASS" | "FAIL";
  verifier: string;
  evidenceIds: string[];
  verifiedAt: string;
}
```

Evidence rules:

- Runtime ingestion always creates evidence as unverified.
- Only the configured verifier identity may mark a required record verified.
- A verified artifact MUST have a digest. A signature MAY serve as both artifact and digest-bearing proof.
- Evidence and criterion results are bound to one Mandate version and cannot satisfy another version automatically.
- Agent text claiming success is not evidence.
- A required human criterion must be signed by the Mandate principal.
- A criterion result is valid only when its verifier equals the criterion's verifier and all referenced evidence exists for the same version.

Completion is allowed only when all conditions are true:

```text
status is ACTIVE
and validity window is open
and approval is fresh
and every required success criterion has a valid PASS result
and every required evidence requirement has a matching verified record
and no required criterion has a later FAIL result
and no amendment is open
and no action is reserved or unsettled
and no unresolved denial, violation, or child completion dependency exists
```

Completion emits `MANDATE_COMPLETED` and sets `completedAt`. Failure of required evidence blocks completion and may escalate as `EVIDENCE_FAILURE`; it never silently waives the requirement.

Parent evidence that relies on a child MUST reference the child's Mandate ID, version, evidence ID, and digest. Child completion alone does not automatically complete the parent.

## 13. Canonical serialization and hashes

- Canonical bytes are RFC 8785 JSON Canonicalization Scheme UTF-8 bytes.
- Digests use SHA-256 and are encoded as `sha256:<lowercase-hex>`.
- Version digest input is the immutable content projection from section 2.2.
- Event hash input is canonical JSON for the event without `eventHash`, including `previousEventHash` when present.
- The first event omits `previousEventHash`.
- Hash chaining is optional in development and required in production mode for v0.1.

## 14. Canonical fixture suite

Fixtures live in `tests/fixtures/protocol-v0.1/` and are normative examples:

| Fixture | Expected assertion |
|---|---|
| `valid-checkout-mandate.json` | Schema valid; represents the demo authority exactly |
| `valid-child-mandate.json` | Schema valid; child authority is a strict subset |
| `invalid-child-scope-expansion.json` | Schema valid; subset check returns false |
| `database-amendment.json` | Schema valid; patch is an authority expansion and requires principal approval |
| `stale-approval.json` | Conformance result is `INVALIDATE_APPROVAL` |
| `completion-evidence.json` | Completion guard returns true only with all listed records verified |

Tests MUST treat fixture `expected` objects as assertions, not protocol payload fields.

## 15. Adversarial freeze checklist

The semantics freeze is accepted only when tests prove:

- a shell command classified as both allowed command execution and forbidden database mutation is denied;
- a child cannot add a resource, environment, effect rank, budget, validity, or delegation depth;
- parent excludes survive child derivation;
- a missing current assumption invalidates approval;
- approval for version 1 cannot approve execution under version 2;
- an amendment against a stale base version fails;
- an agent-produced `verified: true` value is ignored unless a trusted verifier attests it;
- starting a child or new session does not reset cumulative limits;
- a semantic allow cannot override any deterministic deny;
- completion fails when any required criterion or evidence record is absent, failed, stale, or unverified.

## 16. Explicitly deferred from v0.1

- arbitrary glob syntax;
- generic effect ontology;
- reusable one-action approval tokens;
- organization policy layering;
- cross-Mandate authority unions;
- automatic semantic authorization;
- production deployment support;
- direct secret access;
- universal shell-command interpretation.

These omissions default to deny or escalation. They do not create implicit authority.
