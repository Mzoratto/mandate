import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HumanApprovalRelay,
  createHumanApprovalRunner,
  createMandateActionInterceptor,
  mandateInterceptedRunnerCapabilities,
} from "../../packages/agentos-reference-host/src/index.js";

const base = {
  mandateId: "M-1047",
  mandateVersion: 1,
  repository: "checkout-demo",
  publishEvidence: async () => undefined,
};

function appServerFixture(worktree: string, codexHome: string, completeOnAccept = false) {
  const messages: Array<Record<string, any>> = [];
  let child: EventEmitter & { stdout: PassThrough; stderr: PassThrough; stdin: Writable; kill: () => boolean };
  const emit = (message: unknown) => child.stdout.write(`${JSON.stringify(message)}\n`);
  const complete = () => {
    emit({ method: "item/completed", params: { threadId: "thread-1", turnId: "turn-1", item: { id: "item-1", type: "commandExecution" } } });
    emit({ method: "item/completed", params: { threadId: "thread-1", turnId: "turn-1", item: { type: "agentMessage", text: "Inspection complete." } } });
    emit({ method: "thread/tokenUsage/updated", params: { threadId: "thread-1", turnId: "turn-1", tokenUsage: { total: { inputTokens: 10, cachedInputTokens: 0, outputTokens: 2 } } } });
    emit({ method: "turn/completed", params: { threadId: "thread-1", turn: { id: "turn-1", status: "completed" } } });
  };
  const spawnServer = () => {
    child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      stdin: new Writable({
        write(chunk, _encoding, callback) {
          const message = JSON.parse(chunk.toString()) as Record<string, any>;
          messages.push(message);
          queueMicrotask(() => {
            if (message.method === "initialize") emit({ id: message.id, result: { codexHome } });
            if (message.method === "config/read") emit({ id: message.id, result: { config: { apps: {} } } });
            if (message.method === "environment/status") emit({ id: message.id, result: { status: "ready" } });
            if (message.method === "environment/info") emit({ id: message.id, result: { cwd: pathToFileURL(worktree).href, shell: { name: "sh", path: "/bin/sh" } } });
            if (message.method === "thread/start") emit({ id: message.id, result: { thread: { id: "thread-1", ephemeral: true }, cwd: worktree, approvalPolicy: "untrusted", approvalsReviewer: "user", sandbox: { type: "workspaceWrite" } } });
            if (message.method === "turn/start") {
              emit({ id: message.id, result: { turn: { id: "turn-1" } } });
              emit({ method: "turn/started", params: { threadId: "thread-1", turn: { id: "turn-1" } } });
              emit({ id: 71, method: "item/commandExecution/requestApproval", params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1", command: "git status --short", cwd: worktree, environmentId: "local" } });
            }
            if (completeOnAccept && message.id === 71 && message.result?.decision === "accept") complete();
          });
          callback();
        },
      }),
      kill: () => {
        queueMicrotask(() => child.emit("close", 0));
        return true;
      },
    });
    return child;
  };
  return { messages, spawnServer };
}

function runnerInput(taskId: string, worktree: string) {
  return {
    task: { id: taskId, title: "Fixture", description: "Inspect status", worktree_path: worktree, repo_root: worktree, base_ref: "1".repeat(40), max_minutes: 1, total_tokens: 0, max_total_tokens: 1000 },
    step: { step_id: "implementation" },
    agent: { sandbox: "workspace-write", prompt: "Inspect only." },
    priorOutputs: [],
  };
}

describe("public AgentOS reference host", () => {
  it("releases a request only for the exact one-time human answer", async () => {
    const relay = new HumanApprovalRelay();
    const taskId = "a1b2c3d4";
    const lease = relay.connect(taskId);
    const request = {
      rpcId: 71,
      method: "item/commandExecution/requestApproval",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
      details: { command: "git status --short" },
    };
    const pending = relay.request(taskId, request);
    const preview = relay.list(taskId, lease.leaseId)[0]!;
    expect(() => relay.answer({ ...lease, requestId: preview.requestId, checksum: "stale", decision: "accept" })).toThrow("request-stale");
    relay.answer({ ...lease, requestId: preview.requestId, checksum: preview.checksum, decision: "accept" });
    await expect(pending).resolves.toEqual({ decision: "accept" });
    expect(() => relay.answer({ ...lease, requestId: preview.requestId, checksum: preview.checksum, decision: "accept" })).toThrow("request-stale");
    await expect(relay.request(taskId, request)).rejects.toThrow("request-replayed");
    relay.close();
  });

  it("normalizes exact file effects before authorization", async () => {
    let proposed: { action: unknown; effects: Array<{ type: string; resources: string[] }> } | undefined;
    const interceptor = createMandateActionInterceptor({
      ...base,
      beforeAction: async (action, effects) => {
        proposed = { action, effects };
        return { decision: "ESCALATE", reasons: ["scope expansion"], violatedRules: [] };
      },
    });
    const receipt = await interceptor.beforeAction({
      taskId: "task-1",
      turnId: "turn-1",
      itemId: "item-1",
      requestType: "file",
      cwd: "/tmp/worktree",
      details: {
        changes: [
          { path: "/tmp/worktree/migrations/0002.sql", kind: { type: "add" } },
          { path: "/tmp/worktree/tests/checkout.test.js", kind: { type: "update" } },
        ],
      },
    });
    expect(proposed?.effects).toMatchObject([
      { type: "DATABASE_SCHEMA_MUTATION", resources: ["repository://checkout-demo/migrations/0002.sql"] },
      { type: "TEST_MODIFICATION", resources: ["repository://checkout-demo/tests/checkout.test.js"] },
    ]);
    expect(receipt.decision).toBe("ESCALATE");
    expect(mandateInterceptedRunnerCapabilities).toEqual({
      isolatedWorktree: true,
      beforeActionInterception: true,
      stopOnDenial: true,
      evidenceCallbacks: true,
    });
  });

  it("classifies both source and destination effects for file moves", async () => {
    let effects: Array<{ type: string; resources: string[] }> = [];
    const interceptor = createMandateActionInterceptor({
      ...base,
      beforeAction: async (_action, proposedEffects) => {
        effects = proposedEffects;
        return { decision: "DENY", reasons: ["secret destination"], violatedRules: ["forbid-secret-write"] };
      },
    });
    await interceptor.beforeAction({
      taskId: "task-move",
      turnId: "turn-1",
      itemId: "item-1",
      requestType: "file",
      cwd: "/tmp/worktree",
      details: {
        changes: [{
          path: "/tmp/worktree/config.txt",
          kind: { type: "update", move_path: "/tmp/worktree/.env.production" },
        }],
      },
    });
    expect(effects).toMatchObject([
      { type: "CODE_MODIFICATION", resources: ["repository://checkout-demo/config.txt"], reversible: false },
      { type: "SECRET_WRITE", resources: ["repository://checkout-demo/.env.production"], reversible: true },
    ]);
  });

  it("declines at the app-server boundary before exposing a denied action to the human gate", async () => {
    const relay = new HumanApprovalRelay();
    const taskId = "a1b2c3d4";
    const worktree = "/tmp/mandate-agentos-fixture";
    const codexHome = mkdtempSync(join(tmpdir(), "mandate-agentos-home-"));
    const { messages, spawnServer } = appServerFixture(worktree, codexHome);
    const actionInterceptor = createMandateActionInterceptor({
      ...base,
      beforeAction: async () => ({ decision: "DENY", reasons: ["forbidden"], violatedRules: ["forbid-wins"] }),
      publishEvidence: async () => { throw new Error("denied actions cannot publish evidence"); },
    });
    const lease = relay.connect(taskId);
    try {
      await expect(createHumanApprovalRunner(relay, { spawnServer, actionInterceptor })(
        runnerInput(taskId, worktree),
      )).rejects.toMatchObject({ code: "human-approval-mandate-denied", retryable: false });
      expect(messages.find((message) => message.id === 71 && "result" in message)?.result).toEqual({ decision: "decline" });
      expect(() => relay.list(taskId, lease.leaseId)).toThrow("session-unavailable");
    } finally {
      relay.close();
      rmSync(codexHome, { recursive: true, force: true });
    }
  });

  it("publishes completion evidence only after trusted usage is available", async () => {
    const relay = new HumanApprovalRelay();
    const taskId = "b1c2d3e4";
    const worktree = "/tmp/mandate-agentos-usage-fixture";
    const codexHome = mkdtempSync(join(tmpdir(), "mandate-agentos-home-"));
    const { spawnServer } = appServerFixture(worktree, codexHome, true);
    const order: string[] = [];
    const actionInterceptor = createMandateActionInterceptor({
      ...base,
      beforeAction: async () => ({ decision: "ALLOW", reasons: [], violatedRules: [] }),
      publishEvidence: async () => { order.push("evidence"); },
    });
    const lease = relay.connect(taskId);
    try {
      const running = createHumanApprovalRunner(relay, { spawnServer, actionInterceptor })({
        ...runnerInput(taskId, worktree),
        onUsage: () => { order.push("usage"); },
      });
      let preview;
      for (let attempt = 0; attempt < 100 && !preview; attempt += 1) {
        preview = relay.list(taskId, lease.leaseId)[0];
        if (!preview) await new Promise((resolve) => setImmediate(resolve));
      }
      expect(preview).toBeDefined();
      relay.answer({ ...lease, requestId: preview!.requestId, checksum: preview!.checksum, decision: "accept" });
      await expect(running).resolves.toMatchObject({ output: "Inspection complete.", usage: { total_tokens: 12 } });
      expect(order).toEqual(["usage", "evidence"]);
    } finally {
      relay.close();
      rmSync(codexHome, { recursive: true, force: true });
    }
  });

  it("rejects paths outside the isolated worktree before authorization", async () => {
    let called = false;
    const interceptor = createMandateActionInterceptor({
      ...base,
      beforeAction: async () => {
        called = true;
        return { decision: "ALLOW", reasons: [], violatedRules: [] };
      },
    });
    await expect(interceptor.beforeAction({
      taskId: "task-1",
      turnId: "turn-1",
      itemId: "item-1",
      requestType: "file",
      cwd: "/tmp/worktree",
      details: { changes: [{ path: "/tmp/outside.txt", kind: { type: "add" } }] },
    })).rejects.toThrow("mandate-interceptor-request-invalid");
    expect(called).toBe(false);
  });
});
