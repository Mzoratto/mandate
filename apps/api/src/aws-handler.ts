import { randomUUID } from "node:crypto";
import { createControlPlaneHandler } from "./control-plane/handler.js";
import { ControlPlaneRepository } from "./control-plane/repository.js";
import { createDatabase } from "./db/client.js";

interface FunctionUrlEvent {
  rawPath?: unknown;
  rawQueryString?: unknown;
  headers?: unknown;
  body?: unknown;
  isBase64Encoded?: unknown;
  requestContext?: {
    http?: { method?: unknown };
  };
}

interface LambdaContext {
  awsRequestId?: string;
}

let application: ReturnType<typeof createControlPlaneHandler> | undefined;

function app() {
  if (!application) {
    const database = createDatabase(process.env.DATABASE_URL, 2);
    application = createControlPlaneHandler(new ControlPlaneRepository(database.pool));
  }
  return application;
}

function invalidEvent(): never {
  throw new Error("Invalid Lambda Function URL event");
}

export function functionUrlRequest(event: FunctionUrlEvent): Request {
  const method = event.requestContext?.http?.method;
  const path = event.rawPath;
  const query = event.rawQueryString ?? "";
  if (
    typeof method !== "string"
    || typeof path !== "string"
    || !path.startsWith("/")
    || path.includes("\r")
    || path.includes("\n")
    || typeof query !== "string"
    || query.includes("#")
    || !event.headers
    || typeof event.headers !== "object"
    || Array.isArray(event.headers)
  ) invalidEvent();

  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers)) {
    if (typeof value === "string") headers.set(name, value);
  }
  const body = typeof event.body === "string"
    ? event.isBase64Encoded === true ? Buffer.from(event.body, "base64") : event.body
    : undefined;
  return new Request(`https://mandate.aws${path}${query ? `?${query}` : ""}`, {
    method,
    headers,
    ...(["GET", "HEAD"].includes(method.toUpperCase()) || body === undefined ? {} : { body }),
  });
}

export async function handler(event: FunctionUrlEvent, context: LambdaContext = {}) {
  try {
    const response = await app()(functionUrlRequest(event));
    const requestId = response.headers.get("x-request-id");
    console.info(JSON.stringify({
      component: "mandate-control-plane",
      awsRequestId: context.awsRequestId ?? null,
      requestId,
      status: response.status,
    }));
    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers),
      isBase64Encoded: false,
      body: await response.text(),
    };
  } catch {
    const requestId = randomUUID();
    console.error(JSON.stringify({
      component: "mandate-control-plane",
      awsRequestId: context.awsRequestId ?? null,
      requestId,
      status: 500,
      error: "lambda-adapter-failure",
    }));
    return {
      statusCode: 500,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
        "x-request-id": requestId,
      },
      isBase64Encoded: false,
      body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Request failed closed" }, requestId }),
    };
  }
}
