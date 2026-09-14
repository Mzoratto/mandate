import {
  deterministicId,
  sha256Digest,
  type Mandate,
  type SubjectRef,
} from "@mandate/protocol";
import type {
  AuthenticatedIdentity,
  ControlPlaneRepository,
} from "../control-plane/repository.js";

export interface CheckoutWorkPreparationConfig {
  subject: SubjectRef;
  repositoryResource: string;
  repositoryCommitDigest: `sha256:${string}`;
  testVerifier: string;
  reviewVerifier: string;
  validitySeconds?: number;
  now?: () => string;
}

export interface PrepareAgentWorkInput {
  outcome: string;
  requestKey: string;
}

export interface PreparedAgentWork {
  reference: string;
  state: "AWAITING_APPROVAL";
  summary: string;
  nextStep: string;
}

const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const digest = /^sha256:[0-9a-f]{64}$/u;

export function createCheckoutWorkPreparer(
  repository: Pick<ControlPlaneRepository, "prepareAgentWork">,
  config: CheckoutWorkPreparationConfig,
): (identity: AuthenticatedIdentity, input: PrepareAgentWorkInput) => Promise<PreparedAgentWork> {
  const validitySeconds = config.validitySeconds ?? 7 * 24 * 60 * 60;
  if (
    !identifier.test(config.subject.agentId)
    || config.subject.runtime !== "agentos"
    || (config.subject.instanceId !== undefined && !identifier.test(config.subject.instanceId))
    || !identifier.test(config.repositoryResource)
    || !digest.test(config.repositoryCommitDigest)
    || !identifier.test(config.testVerifier)
    || !identifier.test(config.reviewVerifier)
    || !Number.isSafeInteger(validitySeconds)
    || validitySeconds < 300
    || validitySeconds > 7 * 24 * 60 * 60
  ) {
    throw new Error("MCP checkout work preparation is not safely configured");
  }
  const now = config.now ?? (() => new Date().toISOString());

  return async (identity, input) => {
    if (identity.kind !== "principal" || identity.principalType === "service") {
      throw new Error("A linked customer account is required");
    }
    if (!identifier.test(input.requestKey) || typeof input.outcome !== "string") {
      throw new Error("The work request is invalid");
    }
    const outcome = input.outcome.trim();
    if (outcome.length < 10 || outcome.length > 300) throw new Error("The requested outcome must be between 10 and 300 characters");
    const createdAt = now();
    if (!Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString() !== createdAt) {
      throw new Error("Trusted work preparation time is invalid");
    }
    const mandateId = deterministicId("M-alexa", { principalId: identity.id, requestKey: input.requestKey });
    const mandate: Mandate = {
      protocolVersion: "0.1",
      id: mandateId,
      version: 1,
      principal: {
        type: identity.principalType,
        id: identity.id,
        ...(identity.tenantId ? { tenantId: identity.tenantId } : {}),
      },
      subject: structuredClone(config.subject),
      goal: {
        statement: outcome,
        successCriteria: [
          {
            id: "checkout-tests",
            type: "test",
            description: "The checkout regression test suite passes.",
            verifier: config.testVerifier,
            required: true,
          },
          {
            id: "independent-review",
            type: "review",
            description: "An independent review finds no blocking issue.",
            verifier: config.reviewVerifier,
            required: true,
          },
        ],
      },
      scope: {
        resources: [{
          kind: "repository",
          resource: config.repositoryResource,
          include: ["services/checkout/**", "tests/checkout/**"],
          exclude: [],
        }],
        environments: ["local", "test"],
      },
      authority: {
        allowedEffects: [
          { type: "CODE_READ" },
          { type: "CODE_MODIFICATION" },
          { type: "TEST_MODIFICATION" },
          { type: "LOCAL_COMMAND_EXECUTION", environments: ["local", "test"] },
        ],
        forbiddenEffects: [
          { type: "DATABASE_SCHEMA_MUTATION" },
          { type: "DEPENDENCY_MODIFICATION" },
          { type: "NETWORK_REQUEST" },
          { type: "PRODUCTION_DEPLOYMENT" },
          { type: "SECRET_WRITE" },
        ],
        approvalRequiredEffects: [],
      },
      limits: {
        monetaryBudgetUsd: 0,
        tokenBudget: 0,
        maxExecutionSeconds: 1800,
        maxMutations: 1,
        maxExternalCalls: 0,
      },
      delegation: { allowed: false, maxDepth: 0, requireExplicitChildScope: true },
      escalation: {
        conditions: [
          { type: "SCOPE_EXPANSION" },
          { type: "FORBIDDEN_EFFECT_REQUIRED" },
          { type: "RISK_INCREASE" },
          { type: "BUDGET_INCREASE" },
          { type: "ASSUMPTION_INVALIDATED" },
          { type: "UNCERTAIN_CLASSIFICATION" },
          { type: "EVIDENCE_FAILURE" },
        ],
        defaultAction: "BLOCK",
      },
      evidence: {
        requirements: [
          { id: "test-report", type: "test-report", required: true, verifier: config.testVerifier },
          { id: "review-report", type: "review", required: true, verifier: config.reviewVerifier },
        ],
      },
      validity: {
        notBefore: createdAt,
        expiresAt: new Date(Date.parse(createdAt) + validitySeconds * 1000).toISOString(),
      },
      assumptions: [{
        key: "repositoryCommit",
        valueHash: config.repositoryCommitDigest,
        invalidatesOnChange: true,
      }],
      status: "DRAFT",
      createdAt,
    };
    const requestDigest = sha256Digest({ outcome });
    const prepared = await repository.prepareAgentWork(identity, mandate, input.requestKey, requestDigest);
    if (prepared.mandate.id !== mandateId || prepared.mandate.status !== "AWAITING_APPROVAL") {
      throw new Error("Prepared work did not remain at the human approval boundary");
    }
    return {
      reference: mandateId,
      state: "AWAITING_APPROVAL",
      summary: "I prepared a bounded checkout repair mandate. Nothing has executed.",
      nextStep: "Review the exact authority envelope before approving it.",
    };
  };
}
