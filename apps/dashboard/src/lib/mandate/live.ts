import { connection } from "next/server";
import type { DashboardSource, LiveMandate } from "./types";

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("record expected");
  return value as Record<string, unknown>;
};
const text = (value: unknown): string => {
  if (typeof value !== "string" || !value) throw new Error("text expected");
  return value;
};
const number = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("number expected");
  return value;
};
const decimal = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("decimal expected");
  return value;
};
const boolean = (value: unknown): boolean => {
  if (typeof value !== "boolean") throw new Error("boolean expected");
  return value;
};
const list = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new Error("array expected");
  return value;
};
const optionalText = (value: unknown): string | undefined => value == null ? undefined : text(value);
const timestamp = (value: unknown): string => {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error("timestamp expected");
  return result;
};
const optionalTimestamp = (value: unknown): string | undefined => value == null ? undefined : timestamp(value);
const mandateStatuses = new Set(["DRAFT", "PROPOSED", "AWAITING_APPROVAL", "ACTIVE", "SUSPENDED", "AMENDMENT_PENDING", "COMPLETED", "REJECTED", "REVOKED", "EXPIRED"]);
const MAX_RESPONSE_BYTES = 1_048_576;

async function readLimitedText(response: Response): Promise<string | undefined> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    return undefined;
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return body + decoder.decode();
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return undefined;
    }
    body += decoder.decode(value, { stream: true });
  }
}

export function parseLiveMandate(value: unknown): LiveMandate {
  const context = record(value);
  const mandate = record(context.mandate);
  const subject = record(mandate.subject);
  const principal = record(mandate.principal);
  const authority = record(mandate.authority);
  const scope = record(mandate.scope);
  const resources = list(scope.resources).map(record);
  const limits = record(mandate.limits);
  const goal = record(mandate.goal);
  const status = text(mandate.status);
  if (!mandateStatuses.has(status)) throw new Error("mandate status expected");
  const versionDigest = text(context.versionDigest);
  if (!/^sha256:[a-f0-9]{64}$/.test(versionDigest)) throw new Error("version digest expected");
  const approvedAt = optionalTimestamp(mandate.approvedAt);
  const completedAt = optionalTimestamp(mandate.completedAt);
  const executionValue = context.execution == null ? undefined : record(context.execution);
  const executionFinishedAt = executionValue ? optionalTimestamp(executionValue.finishedAt) : undefined;
  const execution = executionValue ? {
    id: text(executionValue.id),
    startedAt: timestamp(executionValue.startedAt),
    ...(executionFinishedAt ? { finishedAt: executionFinishedAt } : {}),
    tokensUsed: number(executionValue.tokensUsed),
    monetarySpentMicroUsd: number(executionValue.monetarySpentMicroUsd),
    mutationActions: number(executionValue.mutationActions),
    actions: list(executionValue.actions).map((item) => {
      const action = record(item);
      const effects = list(action.effects).map(record);
      const executedAt = optionalTimestamp(action.executedAt);
      return {
        id: text(action.id),
        status: text(action.status),
        decision: text(action.decision),
        tool: text(action.tool),
        operation: text(action.operation),
        proposedAt: timestamp(action.proposedAt),
        ...(executedAt ? { executedAt } : {}),
        effectTypes: effects.map((effect) => text(effect.type)),
        resources: effects.flatMap((effect) => list(effect.resources).map(text)),
      };
    }),
  } : undefined;
  return {
    id: text(mandate.id),
    status,
    goal: text(goal.statement),
    principalId: text(principal.id),
    subjectId: text(subject.agentId),
    subjectRuntime: text(subject.runtime),
    versionDigest,
    allowedEffects: list(authority.allowedEffects).map((item) => text(record(item).type)),
    forbiddenEffects: list(authority.forbiddenEffects).map((item) => text(record(item).type)),
    includePaths: resources.flatMap((resource) => list(resource.include).map(text)),
    environments: list(scope.environments).map(text),
    ...(limits.monetaryBudgetUsd == null ? {} : { monetaryBudgetUsd: decimal(limits.monetaryBudgetUsd) }),
    ...(approvedAt ? { approvedAt } : {}),
    ...(completedAt ? { completedAt } : {}),
    ...(execution ? { execution } : {}),
    evidence: list(context.evidence).map((item) => {
      const evidence = record(item);
      const requirementId = optionalText(evidence.requirementId);
      const verifiedBy = optionalText(evidence.verifiedBy);
      return {
        id: text(evidence.id),
        ...(requirementId ? { requirementId } : {}),
        type: text(evidence.type),
        producer: text(evidence.producer),
        verified: boolean(evidence.verified),
        ...(verifiedBy ? { verifiedBy } : {}),
        createdAt: timestamp(evidence.createdAt),
      };
    }),
    events: list(context.events).map((item) => {
      const event = record(item);
      return { type: text(event.type), actor: text(event.actor), timestamp: timestamp(event.timestamp) };
    }),
    requestId: text(context.requestId),
  };
}

export async function loadDashboardSource(): Promise<DashboardSource> {
  await connection();
  return fetchDashboardSource();
}

export async function fetchDashboardSource(): Promise<DashboardSource> {
  if (process.env.MANDATE_DASHBOARD_MODE === "illustrative") return { kind: "illustrative" };
  const baseUrl = process.env.MANDATE_CONTROL_PLANE_URL;
  const credential = process.env.MANDATE_DASHBOARD_CREDENTIAL;
  const mandateId = process.env.MANDATE_DASHBOARD_MANDATE_ID;
  if (!baseUrl || !credential || !mandateId) return { kind: "unavailable" };
  try {
    const origin = new URL(baseUrl);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) {
      return { kind: "unavailable" };
    }
    const response = await fetch(new URL(`/v1/mandates/${encodeURIComponent(mandateId)}`, origin), {
      headers: { authorization: `Bearer ${credential}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { kind: "unavailable" };
    const body = await readLimitedText(response);
    if (body === undefined) return { kind: "unavailable" };
    return { kind: "live", mandate: parseLiveMandate(JSON.parse(body) as unknown) };
  } catch {
    return { kind: "unavailable" };
  }
}
