import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { configuredViewerAuthorization, viewerAuthorizationMatches } from "./lib/viewer-auth";

function response(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      ...(status === 401 ? { "www-authenticate": 'Basic realm="Mandate Mission Control", charset="UTF-8"' } : {}),
      "x-content-type-options": "nosniff",
    },
  });
}

export function proxy(request: NextRequest): Response {
  if (process.env.MANDATE_DASHBOARD_MODE === "illustrative") return NextResponse.next();
  if (!configuredViewerAuthorization()) return response(503, "Mission control authentication is unavailable.");
  if (!viewerAuthorizationMatches(request.headers.get("authorization"))) {
    return response(401, "Authentication required.");
  }
  const next = NextResponse.next();
  next.headers.set("cache-control", "private, no-store");
  return next;
}

export const config = { matcher: ["/dashboard/:path*", "/simulator/:path*"] };
