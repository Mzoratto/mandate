import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import { createAgentOsControlPlaneHandlers } from "../../../packages/adapter-agentos/src/index.ts";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const agentOsRoot = path.resolve(required("AGENTOS_ROOT"));
const worktree = path.resolve(required("CHECKOUT_WORKTREE"));
const approvalFile = path.resolve(required("MANDATE_APPROVAL_FILE"));
const decisionFile = path.resolve(required("MANDATE_DECISION_FILE"));
const resultFile = path.resolve(required("MANDATE_RESULT_FILE"));
const credential = required("MANDATE_AGENT_CREDENTIAL");
const mandateId = "M-checkout-live-003";
const executionId = "execution-checkout-live-003";
const mandateVersionDigest = "sha256:2863afaba75658bc929d29ef2de8660073f4a1cd83f106eea9f0efda39ceb203";
const taskId = "c0ffee03";
const target = path.join(worktree, "services/checkout/total.js");
const before = "  return Math.round((subtotal - discount - discount) * 100) / 100;";
const after = "  return Math.round((subtotal - discount) * 100) / 100;";

const [{ HumanApprovalRelay }, { createHumanApprovalRunner }, { createMandateActionInterceptor }] = await Promise.all([
  import(pathToFileURL(path.join(agentOsRoot, "src/human-approval-relay.js"))),
  import(pathToFileURL(path.join(agentOsRoot, "src/codex-human-runner.js"))),
  import(pathToFileURL(path.join(agentOsRoot, "src/mandate-interceptor.js"))),
]);

const codexHome = mkdtempSync(path.join(tmpdir(), "mandate-rehearsal-codex-"));
let child;
const emit = (message) => child.stdout.write(`${JSON.stringify(message)}\n`);
const complete = () => {
  emit({ method: "item/completed", params: { threadId: "thread-live-003", turnId: "turn-live-003", item: { id: "item-live-003", type: "fileChange" } } });
  emit({ method: "item/completed", params: { threadId: "thread-live-003", turnId: "turn-live-003", item: { type: "agentMessage", text: "Applied the single coupon calculation repair for independent verification." } } });
  emit({ method: "thread/tokenUsage/updated", params: { threadId: "thread-live-003", turnId: "turn-live-003", tokenUsage: { total: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 } } } });
  emit({ method: "turn/completed", params: { threadId: "thread-live-003", turn: { id: "turn-live-003", status: "completed" } } });
};
const spawnServer = (_command, _args, options) => {
  if (options.cwd !== worktree) throw new Error("Unexpected worktree binding");
  child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new Writable({
    write(chunk, _encoding, callback) {
      const message = JSON.parse(chunk.toString());
      queueMicrotask(() => {
        if (message.method === "initialize") emit({ id: message.id, result: { codexHome } });
        if (message.method === "config/read") emit({ id: message.id, result: { config: { apps: {} } } });
        if (message.method === "environment/status") emit({ id: message.id, result: { status: "ready" } });
        if (message.method === "environment/info") emit({ id: message.id, result: { cwd: pathToFileURL(worktree).href, shell: { name: "sh", path: "/bin/sh" } } });
        if (message.method === "thread/start") emit({ id: message.id, result: { thread: { id: "thread-live-003", ephemeral: true }, cwd: worktree, approvalPolicy: "untrusted", approvalsReviewer: "user", sandbox: { type: "workspaceWrite" } } });
        if (message.method === "turn/start") {
          emit({ id: message.id, result: { turn: { id: "turn-live-003" } } });
          emit({ method: "turn/started", params: { threadId: "thread-live-003", turn: { id: "turn-live-003" } } });
          emit({ method: "item/started", params: { threadId: "thread-live-003", turnId: "turn-live-003", item: { id: "item-live-003", type: "fileChange", changes: [{ path: target, kind: { type: "update" }, diff: `-${before}\n+${after}` }] } } });
          emit({ id: 71, method: "item/fileChange/requestApproval", params: { threadId: "thread-live-003", turnId: "turn-live-003", itemId: "item-live-003", environmentId: "local", reason: "Repair the double-applied checkout discount." } });
        }
        if (message.id === 71 && message.result?.decision === "accept") {
          const source = readFileSync(target, "utf8");
          if (!source.includes(before) || source.includes(after)) throw new Error("Checkout source no longer matches the reviewed base");
          writeFileSync(target, source.replace(before, after));
          complete();
        }
      });
      callback();
    },
  });
  child.kill = () => {
    queueMicrotask(() => child.emit("close", 0));
    return true;
  };
  return child;
};

let currentUsage;
const handlers = createAgentOsControlPlaneHandlers({
  baseUrl: required("MANDATE_CONTROL_PLANE_URL"),
  credential,
  executionId,
  mandateVersionDigest,
  settlement: async () => {
    if (!currentUsage) throw new Error("Trusted turn usage is unavailable");
    return { outcome: "SUCCEEDED", usage: { monetarySpentUsd: 0, tokensUsed: currentUsage.total_tokens } };
  },
});
const actionInterceptor = createMandateActionInterceptor({
  mandateId,
  mandateVersion: 1,
  repository: "checkout-demo",
  beforeAction: handlers.beforeAction,
  publishEvidence: handlers.publishEvidence,
});
const relay = new HumanApprovalRelay({ timeoutMs: 30 * 60_000 });
const lease = relay.connect(taskId);
const events = [];
const running = createHumanApprovalRunner(relay, { spawnServer, actionInterceptor })({
  task: {
    id: taskId,
    title: "Repair checkout coupon regression",
    description: "Apply only the reviewed checkout calculation repair.",
    worktree_path: worktree,
    repo_root: worktree,
    base_ref: "888784f50a3bead74c0adffeef2d7cc5d757eebc",
    max_minutes: 30,
    total_tokens: 0,
    max_total_tokens: 1,
  },
  step: { step_id: "implementation" },
  agent: { sandbox: "workspace-write", prompt: "Apply only the reviewed checkout calculation repair." },
  priorOutputs: [],
  onUsage: (usage) => { currentUsage = usage; },
  onEvent: (kind, payload) => events.push({ kind, payload }),
});
let settled = false;
let result;
let failure;
running.then((value) => { result = value; settled = true; }, (error) => { failure = error; settled = true; });
let publishedRequest;
while (!settled) {
  const pending = relay.available(taskId, lease.leaseId) ? relay.list(taskId, lease.leaseId)[0] : undefined;
  if (pending && !publishedRequest) {
    publishedRequest = pending;
    writeFileSync(approvalFile, `${JSON.stringify(pending, null, 2)}\n`, { flag: "wx" });
  }
  if (pending) {
    try {
      const decision = JSON.parse(readFileSync(decisionFile, "utf8"));
      relay.answer({
        taskId,
        leaseId: lease.leaseId,
        requestId: decision.requestId,
        checksum: decision.checksum,
        decision: decision.decision,
      });
      rmSync(decisionFile);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
relay.close();
rmSync(codexHome, { recursive: true, force: true });
if (failure) {
  writeFileSync(resultFile, `${JSON.stringify({ ok: false, code: failure.code ?? "unknown", events }, null, 2)}\n`);
  throw failure;
}
writeFileSync(resultFile, `${JSON.stringify({ ok: true, result, events }, null, 2)}\n`);
