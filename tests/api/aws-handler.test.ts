import { describe, expect, it } from "vitest";
import { functionUrlRequest } from "../../apps/api/src/aws-handler.js";

describe("AWS Lambda Function URL adapter", () => {
  it("preserves method, query, headers, and base64 JSON body", async () => {
    const request = functionUrlRequest({
      rawPath: "/v1/executions/run-1/actions/authorize",
      rawQueryString: "source=agentos",
      headers: { authorization: "Bearer opaque", "content-type": "application/json" },
      body: Buffer.from('{"action":1}').toString("base64"),
      isBase64Encoded: true,
      requestContext: { http: { method: "POST" } },
    });

    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://mandate.aws/v1/executions/run-1/actions/authorize?source=agentos");
    expect(request.headers.get("authorization")).toBe("Bearer opaque");
    expect(await request.json()).toEqual({ action: 1 });
  });

  it("refuses malformed paths before reaching the control plane", () => {
    expect(() => functionUrlRequest({
      rawPath: "https://attacker.invalid/",
      rawQueryString: "",
      headers: {},
      requestContext: { http: { method: "GET" } },
    })).toThrow("Invalid Lambda Function URL event");
  });
});
