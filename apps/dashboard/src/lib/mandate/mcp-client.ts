import { randomUUID } from "node:crypto";

const MAX_RESPONSE_BYTES = 1_048_576;
const MCP_VERSION = "2025-11-25";
const referencePattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const states = new Set([
  "DRAFT",
  "PROPOSED",
  "AWAITING_APPROVAL",
  "ACTIVE",
  "SUSPENDED",
  "AMENDMENT_PENDING",
  "COMPLETED",
  "REJECTED",
  "REVOKED",
  "EXPIRED",
]);

export interface PreparedWork {
  reference: string;
  state: "AWAITING_APPROVAL";
  summary: string;
  nextStep: string;
}

export interface AgentWorkStatus {
  state: string;
  summary: string;
  nextStep: string;
  outcome: string;
  authority: {
    resources: string[];
    allowedEffects: string[];
    forbiddenEffects: string[];
  };
  execution: null | {
    running: boolean;
    actions: number;
    tokensUsed: number;
    monetarySpentMicroUsd: number;
  };
  verification: {
    records: number;
    independentlyVerified: number;
  };
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("record expected");
  return value as Record<string, unknown>;
};
const text = (value: unknown): string => {
  if (typeof value !== "string" || !value) throw new Error("text expected");
  return value;
};
const boolean = (value: unknown): boolean => {
  if (typeof value !== "boolean") throw new Error("boolean expected");
  return value;
};
const count = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("count expected");
  return value;
};
const textList = (value: unknown): string[] => {
  if (!Array.isArray(value)) throw new Error("array expected");
  return value.map(text);
};

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error("MCP response exceeded its size limit");
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
      throw new Error("MCP response exceeded its size limit");
    }
    body += decoder.decode(value, { stream: true });
  }
}

function configuration(): { endpoint: URL; credential: string } {
  const baseUrl = process.env.MANDATE_CONTROL_PLANE_URL;
  const credential = process.env.MANDATE_DASHBOARD_CREDENTIAL;
  if (!baseUrl || !credential) throw new Error("MCP client is unavailable");
  const origin = new URL(baseUrl);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) {
    throw new Error("MCP client is unavailable");
  }
  return { endpoint: new URL("/mcp", origin), credential };
}

async function callTool(name: string, args: Record<string, string>): Promise<Record<string, unknown>> {
  const { endpoint, credential } = configuration();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${credential}`,
      "content-type": "application/json",
      "mcp-protocol-version": MCP_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("MCP request failed");
  }
  const body = record(JSON.parse(await readLimitedText(response)) as unknown);
  const result = record(body.result);
  if (result.isError === true) throw new Error("MCP tool failed");
  return record(result.structuredContent);
}

export function validWorkReference(value: string): boolean {
  return referencePattern.test(value);
}

export function parsePreparedWork(value: unknown): PreparedWork {
  const result = record(value);
  const reference = text(result.reference);
  if (!validWorkReference(reference) || result.state !== "AWAITING_APPROVAL") throw new Error("prepared work expected");
  return {
    reference,
    state: "AWAITING_APPROVAL",
    summary: text(result.summary),
    nextStep: text(result.nextStep),
  };
}

export function parseAgentWorkStatus(value: unknown): AgentWorkStatus {
  const result = record(value);
  const state = text(result.state);
  if (result.success !== true || !states.has(state)) throw new Error("work status expected");
  const authority = record(result.authority);
  const verification = record(result.verification);
  const verificationRecords = count(verification.records);
  const independentlyVerified = count(verification.independentlyVerified);
  if (independentlyVerified > verificationRecords) throw new Error("verification count expected");
  const executionValue = result.execution;
  const executionRecord = executionValue === null ? undefined : record(executionValue);
  return {
    state,
    summary: text(result.summary),
    nextStep: text(result.nextStep),
    outcome: text(result.outcome),
    authority: {
      resources: textList(authority.resources),
      allowedEffects: textList(authority.allowedEffects),
      forbiddenEffects: textList(authority.forbiddenEffects),
    },
    execution: executionRecord ? {
      running: boolean(executionRecord.running),
      actions: count(executionRecord.actions),
      tokensUsed: count(executionRecord.tokensUsed),
      monetarySpentMicroUsd: count(executionRecord.monetarySpentMicroUsd),
    } : null,
    verification: {
      records: verificationRecords,
      independentlyVerified,
    },
  };
}

export async function prepareAgentWork(outcome: string, requestKey: string): Promise<PreparedWork> {
  return parsePreparedWork(await callTool("prepare_agent_work", { outcome, requestKey }));
}

export async function getAgentWorkStatus(reference: string): Promise<AgentWorkStatus> {
  if (!validWorkReference(reference)) throw new Error("work reference expected");
  return parseAgentWorkStatus(await callTool("get_agent_work_status", { reference }));
}
