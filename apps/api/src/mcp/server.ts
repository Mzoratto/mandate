import { readFileSync } from "node:fs";
import type { IncomingMessage, RequestListener } from "node:http";
import { createServer } from "node:https";
import { isIP } from "node:net";
import { ControlPlaneRepository } from "../control-plane/repository.js";
import { createDatabase } from "../db/client.js";
import { createMandateMcpHandlerFromEnv } from "./from-env.js";

const MAX_BODY_BYTES = 1_048_576;

function json(status: number, error: string, message: string): Response {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" },
  });
}

/** The dedicated adapter only ever listens on a literal loopback address over TLS. */
export function loopbackResource(resourceUrl: string | undefined): URL {
  const resource = new URL(resourceUrl ?? "");
  const host = resource.hostname.replace(/^\[|\]$/g, "");
  if (resource.protocol !== "https:" || !resource.port || !isIP(host) || !["127.0.0.1", "::1"].includes(host)) {
    throw new Error("The dedicated Mandate MCP server requires an https://127.0.0.1:<port>/mcp or https://[::1]:<port>/mcp resource URL");
  }
  return resource;
}

async function readBody(incoming: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of incoming as AsyncIterable<Buffer>) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) return undefined;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

/** Bridges node:http(s) to the Web-standard MCP handler, exposing only MCP routes. */
export function createMcpNodeListener(handler: (request: Request) => Promise<Response>, resource: URL): RequestListener {
  const routes = new Set(["/mcp", "/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-protected-resource"]);
  return async (incoming, outgoing) => {
    let response: Response;
    try {
      const path = incoming.url ?? "";
      const method = incoming.method ?? "GET";
      if (!path.startsWith("/") || !routes.has(new URL(path, resource.origin).pathname)) {
        response = json(404, "not_found", "Route not found");
      } else {
        const body = ["GET", "HEAD", "OPTIONS"].includes(method) ? undefined : await readBody(incoming);
        if (body === undefined && !["GET", "HEAD", "OPTIONS"].includes(method)) {
          response = json(413, "body_too_large", "Request body exceeds 1 MiB");
        } else {
          const headers = new Headers();
          for (const [name, values] of Object.entries(incoming.headersDistinct)) {
            for (const value of values ?? []) headers.append(name, value);
          }
          response = await handler(new Request(new URL(path, resource.origin), {
            method,
            headers,
            ...(body ? { body: new Uint8Array(body) } : {}),
          }));
        }
      }
    } catch {
      response = json(500, "internal_error", "Mandate MCP failed closed");
    }
    const payload = Buffer.from(await response.arrayBuffer());
    outgoing.writeHead(response.status, { ...Object.fromEntries(response.headers), "content-length": payload.length });
    outgoing.end(payload);
  };
}

export function startMandateMcpServer(env: Record<string, string | undefined> = process.env) {
  const resource = loopbackResource(env.MANDATE_MCP_RESOURCE_URL);
  if (!env.MANDATE_MCP_TLS_CERT_FILE || !env.MANDATE_MCP_TLS_KEY_FILE) {
    throw new Error("MANDATE_MCP_TLS_CERT_FILE and MANDATE_MCP_TLS_KEY_FILE are required");
  }
  const database = createDatabase(env.DATABASE_URL, 2);
  const handler = createMandateMcpHandlerFromEnv(new ControlPlaneRepository(database.pool), env)!;
  const server = createServer({
    cert: readFileSync(env.MANDATE_MCP_TLS_CERT_FILE),
    key: readFileSync(env.MANDATE_MCP_TLS_KEY_FILE),
    minVersion: "TLSv1.2",
  }, createMcpNodeListener(handler, resource));
  server.listen(Number(resource.port), resource.hostname.replace(/^\[|\]$/g, ""), () => {
    console.info(JSON.stringify({
      component: "mandate-mcp",
      resource: resource.href,
      prepareWork: Boolean(env.MANDATE_MCP_CHECKOUT_COMMIT_DIGEST),
    }));
  });
  const close = () => server.close(() => void database.close());
  return { server, close };
}
