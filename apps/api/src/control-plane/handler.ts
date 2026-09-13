import { randomUUID } from "node:crypto";
import {
  MandateSchema,
  NormalizedEffectSchema,
  ProposedActionSchema,
} from "@mandate/schemas";
import { z, ZodError } from "zod";
import {
  ControlPlaneError,
  type AuthenticatedIdentity,
  type ControlPlaneRepository,
} from "./repository.js";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const transitionBody = z.object({ to: z.enum(["PROPOSED", "AWAITING_APPROVAL"]) }).strict();
const approvalBody = z.object({ nonce: id }).strict();
const executionBody = z.object({ executionId: id }).strict();
const assumptionBody = z.object({ valueHash: digest }).strict();
const authorizationBody = z.object({
  proposedAction: ProposedActionSchema,
  normalizedEffects: z.array(NormalizedEffectSchema).max(64),
  projectedTokens: z.number().int().nonnegative().safe().optional(),
  semanticDecision: z.enum(["ALLOW", "DENY", "ESCALATE"]).optional(),
}).strict();
const settlementBody = z.object({
  outcome: z.enum(["SUCCEEDED", "FAILED"]),
  usage: z.object({
    monetarySpentUsd: z.number().finite().nonnegative().refine((value) => {
      const micros = value * 1_000_000;
      return Number.isSafeInteger(Math.round(micros)) && Math.abs(micros - Math.round(micros)) < 1e-7;
    }),
    tokensUsed: z.number().int().nonnegative().safe(),
  }).strict(),
  evidence: z.object({
    id,
    requirementId: id.optional(),
    type: z.enum(["test-report", "review", "artifact", "trace", "signature", "state-check"]),
    artifactUri: z.string().min(1).optional(),
    digest: digest.optional(),
  }).strict().superRefine((evidence, context) => {
    if (evidence.artifactUri && !evidence.digest) {
      context.addIssue({ code: "custom", message: "Artifact evidence requires a digest", path: ["digest"] });
    }
  }),
}).strict();

const jsonHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function json(status: number, body: unknown, requestId: string): Response {
  return new Response(JSON.stringify({ ...body as object, requestId }), {
    status,
    headers: { ...jsonHeaders, "x-request-id": requestId },
  });
}

async function body(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ControlPlaneError(415, "JSON_REQUIRED", "Content-Type must be application/json");
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 1_048_576) {
    throw new ControlPlaneError(413, "BODY_TOO_LARGE", "Request body exceeds 1 MiB");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 1_048_576) {
    throw new ControlPlaneError(413, "BODY_TOO_LARGE", "Request body exceeds 1 MiB");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ControlPlaneError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._~-]{32,512})$/.exec(authorization);
  if (!match) throw new ControlPlaneError(401, "UNAUTHENTICATED", "A valid bearer credential is required");
  return match[1]!;
}

function segment(value: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new ControlPlaneError(400, "INVALID_PATH", "Path contains invalid encoding");
  }
  return id.parse(decoded);
}

export function createControlPlaneHandler(
  repository: ControlPlaneRepository,
  onError: (error: unknown, requestId: string) => void = () => undefined,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const requestId = randomUUID();
    try {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/health") {
        return json(200, { status: "ok" }, requestId);
      }
      if (!url.pathname.startsWith("/v1/")) {
        return json(404, { error: { code: "NOT_FOUND", message: "Route not found" } }, requestId);
      }
      const identity: AuthenticatedIdentity = await repository.authenticate(bearerToken(request));

      if (request.method === "POST" && url.pathname === "/v1/mandates") {
        const mandate = MandateSchema.parse(await body(request));
        return json(201, await repository.createMandate(identity, mandate), requestId);
      }

      let match = /^\/v1\/mandates\/([^/]+)$/.exec(url.pathname);
      if (request.method === "GET" && match) {
        return json(200, await repository.getMandateContext(identity, segment(match[1]!)), requestId);
      }

      match = /^\/v1\/mandates\/([^/]+)\/transitions$/.exec(url.pathname);
      if (request.method === "POST" && match) {
        const input = transitionBody.parse(await body(request));
        return json(200, await repository.transitionMandate(identity, segment(match[1]!), input.to), requestId);
      }

      match = /^\/v1\/mandates\/([^/]+)\/approvals$/.exec(url.pathname);
      if (request.method === "POST" && match) {
        const input = approvalBody.parse(await body(request));
        return json(201, await repository.approveMandate(identity, segment(match[1]!), input.nonce), requestId);
      }

      match = /^\/v1\/mandates\/([^/]+)\/assumptions\/([^/]+)$/.exec(url.pathname);
      if (request.method === "PUT" && match) {
        const input = assumptionBody.parse(await body(request));
        await repository.setAssumption(identity, segment(match[1]!), segment(match[2]!), input.valueHash);
        return json(200, { updated: true }, requestId);
      }

      match = /^\/v1\/mandates\/([^/]+)\/executions$/.exec(url.pathname);
      if (request.method === "POST" && match) {
        const input = executionBody.parse(await body(request));
        return json(201, await repository.startExecution(identity, segment(match[1]!), input.executionId), requestId);
      }

      match = /^\/v1\/executions\/([^/]+)\/actions\/authorize$/.exec(url.pathname);
      if (request.method === "POST" && match) {
        const parsed = authorizationBody.parse(await body(request));
        const input = {
          proposedAction: parsed.proposedAction,
          normalizedEffects: parsed.normalizedEffects.map((effect) => ({
            type: effect.type,
            resources: effect.resources,
            reversible: effect.reversible,
            confidence: effect.confidence,
            ...(effect.environment ? { environment: effect.environment } : {}),
            ...(effect.estimatedCostUsd === undefined ? {} : { estimatedCostUsd: effect.estimatedCostUsd }),
          })),
          ...(parsed.projectedTokens === undefined ? {} : { projectedTokens: parsed.projectedTokens }),
          ...(parsed.semanticDecision ? { semanticDecision: parsed.semanticDecision } : {}),
        };
        return json(200, await repository.authorizeAction(identity, segment(match[1]!), input), requestId);
      }

      match = /^\/v1\/executions\/([^/]+)\/actions\/([^/]+)\/settle$/.exec(url.pathname);
      if (request.method === "POST" && match) {
        const parsed = settlementBody.parse(await body(request));
        const input = {
          outcome: parsed.outcome,
          usage: parsed.usage,
          evidence: {
            id: parsed.evidence.id,
            type: parsed.evidence.type,
            ...(parsed.evidence.requirementId ? { requirementId: parsed.evidence.requirementId } : {}),
            ...(parsed.evidence.artifactUri ? { artifactUri: parsed.evidence.artifactUri } : {}),
            ...(parsed.evidence.digest ? { digest: parsed.evidence.digest } : {}),
          },
        };
        return json(
          200,
          await repository.settleAction(identity, segment(match[1]!), segment(match[2]!), input),
          requestId,
        );
      }

      return json(404, { error: { code: "NOT_FOUND", message: "Route not found" } }, requestId);
    } catch (error) {
      if (error instanceof ZodError) {
        return json(400, {
          error: {
            code: "INVALID_REQUEST",
            message: "Request validation failed",
            issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
          },
        }, requestId);
      }
      if (error instanceof ControlPlaneError) {
        return json(error.status, { error: { code: error.code, message: error.message } }, requestId);
      }
      onError(error, requestId);
      return json(500, { error: { code: "INTERNAL_ERROR", message: "Control plane failed closed" } }, requestId);
    }
  };
}
