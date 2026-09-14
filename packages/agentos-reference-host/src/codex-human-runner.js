import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { StringDecoder } from "node:string_decoder";
import { normalizeUsage } from "./usage.js";
import { agentEnvironment, prepareAgentApplicationTurn, prepareAgentPrompt, runAgentPhase } from "./runner.js";
import { relayError } from "./human-approval-relay.js";
import { confirmProcessGroupStopped } from "./process.js";
import { resolveGovernorSkillAppServerConsumptionLineage } from "./governor-skill-lineage.js";

// Explicitly opt in at the host. This transport is not the mobile app itself.
export function createHumanApprovalRunner(relay,
  { spawnServer = spawn, contextRuntime, skillRuntime, applicationSkillRuntime, actionInterceptor } = {}) {
  if (actionInterceptor !== undefined
    && (typeof actionInterceptor?.beforeAction !== "function" || typeof actionInterceptor?.afterAction !== "function")) {
    throw relayError("mandate-interceptor-invalid");
  }
  const run = (input) => input.task.dry_run ? runAgentPhase(input)
    : runHumanPhase(input, relay, spawnServer, contextRuntime, skillRuntime, applicationSkillRuntime, actionInterceptor);
  run.humanApprovalAvailable = (taskId) => relay.available(taskId);
  return run;
}

function containedFile(cwd, file, refuse) {
  if (typeof file !== "string") refuse("file-path-type");
  const relative = path.relative(cwd, path.resolve(cwd, file));
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) refuse("file-path-not-contained");
  // No symlink component may redirect a reviewed path outside the sandbox root.
  let candidate = cwd;
  for (const part of relative.split(path.sep)) {
    candidate = path.join(candidate, part);
    let stat;
    try { stat = fs.lstatSync(candidate); }
    catch (error) {
      if (error.code !== "ENOENT") refuse("file-path-inspection-failed");
      continue;
    }
    if (stat.isSymbolicLink()) refuse("file-path-symlink");
  }
}

// This transport supports only the built-in local registry. Never interpret a
// configured environment's name, a ready status, or a matching path as identity.
function requireDefaultEnvironmentRegistry(codexHome) {
  if (typeof codexHome !== "string" || !path.isAbsolute(codexHome)) throw relayError("environment-binding-invalid");
  try { if (!fs.statSync(codexHome).isDirectory()) throw new Error(); }
  catch { throw relayError("environment-binding-invalid"); }
  try { fs.lstatSync(path.join(codexHome, "environments.toml")); }
  catch (error) {
    if (error.code === "ENOENT") return;
    throw relayError("environment-binding-invalid");
  }
  throw relayError("environment-registry-unsupported");
}

async function runHumanPhase(input, relay, spawnServer, contextRuntime, skillRuntime,
  applicationSkillRuntime, actionInterceptor) {
  const { task, agent, onEvent = () => {}, signal } = input;
  if (signal !== undefined && !(signal instanceof AbortSignal)) throw relayError("signal-invalid");
  if (signal?.aborted) throw relayError("operator-aborted");
  if (!relay.available(task.id)) throw relayError("relay-unavailable");
  const leaseId = relay.binding(task.id);
  if (!["workspace-write", "read-only"].includes(agent?.sandbox)) throw relayError("sandbox-invalid");
  const cwd = task.worktree_path;
  if (!path.isAbsolute(cwd ?? "")) throw relayError("worktree-invalid");
  const prepared = applicationSkillRuntime
    ? prepareAgentApplicationTurn(input, contextRuntime, applicationSkillRuntime)
    : prepareAgentPrompt(input, contextRuntime, skillRuntime);
  if (prepared.skillEvidence) onEvent("governor.skill.selection", prepared.skillEvidence);
  if (prepared.evidence) onEvent("governor.context.assembled", prepared.evidence);
  let env;
  try { env = agentEnvironment(cwd, process.env); }
  catch { throw relayError("environment-invalid"); }
  const args = ["app-server", "--listen", "stdio://", "-c", 'approvals_reviewer="user"'];
  let child;
  const detached = process.platform !== "win32";
  try { child = spawnServer("codex", args, { cwd, env, stdio: ["pipe", "pipe", "pipe"], detached }); }
  catch { throw relayError("transport-unavailable"); }
  const abort = new AbortController();
  let nextId = 0;
  let buffer = "";
  let totalBytes = 0;
  let threadId;
  let turnId;
  let lastMessage = "";
  let usage;
  let ended = false;
  let failure;
  let turnFinished = false;
  let scopeRefusalReported = false;
  const lineageNotifications = [];
  let localEnvironmentBound = false;
  let codexHome;
  let complete;
  let failComplete;
  let operatorAborted = false;
  const done = new Promise((resolve, reject) => { complete = resolve; failComplete = reject; });
  done.catch(() => {});
  const pending = new Map();
  const items = new Map();
  const authorizedActions = new Map();
  const completedActions = new Map();
  const pendingEvidence = new Set();
  const publishCompletedActions = () => {
    if (!usage) return;
    for (const [itemId, mandateReceipt] of completedActions) {
      completedActions.delete(itemId);
      const publication = Promise.resolve(actionInterceptor.afterAction(mandateReceipt))
        .then(() => onEvent("mandate.evidence.published", {
          actionId: mandateReceipt.actionId,
          effectTypes: mandateReceipt.effectTypes,
        }))
        .catch(() => fail("mandate-evidence-unavailable"))
        .finally(() => pendingEvidence.delete(publication));
      pendingEvidence.add(publication);
    }
  };
  const stop = (signal) => {
    try {
      if (detached && Number.isSafeInteger(child.pid) && child.pid > 0) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch (error) { if (error.code !== "ESRCH") child.kill(signal); }
  };
  const fail = (code) => {
    if (ended) return;
    ended = true;
    failure = relayError(code);
    if (usage) failure.usage = usage;
    abort.abort();
    for (const call of pending.values()) call.reject(failure);
    pending.clear();
    failComplete(failure);
    stop("SIGTERM");
  };
  const operatorAbort = () => {
    operatorAborted = true;
    fail("operator-aborted");
    stop("SIGKILL");
  };
  signal?.addEventListener("abort", operatorAbort, { once: true });
  if (signal?.aborted) operatorAbort();
  const send = (message) => {
    if (ended) throw failure ?? relayError("transport-closed");
    child.stdin.write(JSON.stringify(message) + "\n");
  };
  const request = (method, params) => new Promise((resolve, reject) => {
    if (ended) return reject(failure ?? relayError("transport-closed"));
    const id = ++nextId;
    pending.set(id, { resolve, reject, method });
    try { send({ id, method, params }); } catch { fail("transport-write-failed"); }
  });
  const bound = (params) => {
    if (!threadId || params?.threadId !== threadId || !turnId || params.turnId !== turnId) throw relayError("request-binding-invalid");
  };
  const refuseScope = (requestType, reason, checks) => {
    // One bounded record per phase. Every value is a literal enum or a boolean,
    // never a command, path, identifier, permission payload, or server error.
    if (!scopeRefusalReported) {
      scopeRefusalReported = true;
      try { onEvent("human.approval.refused", { schemaVersion: 1, requestType, reason, checks }); }
      catch { throw relayError("audit-unavailable"); }
    }
    throw relayError("request-scope-unsupported");
  };
  const handleApproval = async (message) => {
    if (turnFinished) throw relayError("request-after-turn");
    if (!relay.available(task.id, leaseId)) throw relayError("relay-disconnected");
    const p = message.params;
    bound(p);
    if (!(typeof message.id === "string" || Number.isSafeInteger(message.id))
      || typeof p.itemId !== "string") throw relayError("request-invalid");
    let details;
    if (message.method === "item/commandExecution/requestApproval") {
      const checks = {
        networkContextPresent: Boolean(p.networkApprovalContext),
        additionalPermissionsPresent: Boolean(p.additionalPermissions),
        additionalFileSystemPresent: Boolean(p.additionalPermissions?.fileSystem),
        additionalNetworkPresent: Boolean(p.additionalPermissions?.network),
        kindSupported: !p.kind || p.kind === "command",
        environmentIdPresent: Boolean(p.environmentId),
        commandValid: typeof p.command === "string" && Boolean(p.command.trim()),
        cwdMatches: p.cwd === cwd,
      };
      const refuse = reason => refuseScope("command", reason, checks);
      // Environment matching only narrows which requests reach a human; it grants nothing.
      if (checks.networkContextPresent) refuse("network-context");
      if (checks.additionalPermissionsPresent) refuse("additional-permissions");
      if (!checks.kindSupported) refuse("command-kind");
      if (!localEnvironmentBound || (p.environmentId != null && p.environmentId !== "local")) refuse("environment-id");
      if (!checks.commandValid) refuse("command-invalid");
      if (!checks.cwdMatches) refuse("cwd-mismatch");
      requireDefaultEnvironmentRegistry(codexHome);
      details = { command: p.command, cwd, environmentId: "local", reason: p.reason ?? null };
    } else if (message.method === "item/fileChange/requestApproval") {
      const item = items.get(p.itemId);
      const checks = {
        grantRootPresent: Boolean(p.grantRoot),
        pendingFileChange: item?.type === "fileChange",
        changesArray: Array.isArray(item?.changes),
        changesNonEmpty: Array.isArray(item?.changes) && item.changes.length > 0,
      };
      const refuse = (reason, moveTarget = false) => refuseScope("file", reason, { ...checks, moveTarget });
      if (checks.grantRootPresent) refuse("file-grant-root");
      if (!checks.pendingFileChange) refuse("file-item-missing");
      if (!checks.changesArray) refuse("file-changes-invalid");
      if (!checks.changesNonEmpty) refuse("file-changes-empty");
      for (const change of item.changes) {
        if (!change || !["add", "delete", "update"].includes(change.kind?.type)) refuse("file-change-kind");
        if (typeof change.diff !== "string") refuse("file-diff-invalid");
        containedFile(cwd, change.path, reason => refuse(reason));
        if (change.kind.move_path != null) containedFile(cwd, change.kind.move_path, reason => refuse(reason, true));
      }
      if (!localEnvironmentBound || (p.environmentId != null && p.environmentId !== "local")) throw relayError("environment-binding-invalid");
      requireDefaultEnvironmentRegistry(codexHome);
      details = { changes: item.changes, environmentId: "local", reason: p.reason ?? null };
    } else throw relayError("request-method-unsupported");
    const preview = { rpcId: message.id, method: message.method, threadId, turnId, itemId: p.itemId, details };
    // Refuse likely secrets instead of redacting a command/diff and approving hidden bytes.
    if (/(?:(?<![A-Za-z0-9_-])sk-(?:proj-)?[A-Za-z0-9_-]{12,}|-----BEGIN .*PRIVATE KEY|(?:password|api[_-]?key|access[_-]?token)\s*[:=]\s*\S+|postgres(?:ql)?:\/\/[^\s]+@)/iu.test(JSON.stringify(preview))) {
      throw relayError("request-sensitive");
    }
    const mandateReceipt = actionInterceptor ? await actionInterceptor.beforeAction({
      taskId: task.id,
      turnId,
      itemId: p.itemId,
      requestType: message.method === "item/commandExecution/requestApproval" ? "command" : "file",
      details,
      cwd,
    }) : null;
    if (mandateReceipt) {
      onEvent("mandate.authorization", {
        actionId: mandateReceipt.actionId,
        decision: mandateReceipt.decision,
        effectTypes: mandateReceipt.effectTypes,
        reasonCount: mandateReceipt.reasonCount,
        violatedRuleCount: mandateReceipt.violatedRuleCount,
      });
      if (mandateReceipt.decision !== "ALLOW") {
        if (!ended) send({ id: message.id, result: { decision: "decline" } });
        const reason = mandateReceipt.decision === "DENY" ? "denied"
          : mandateReceipt.decision === "ESCALATE" ? "escalated" : "approval-invalidated";
        return fail(`mandate-${reason}`);
      }
    }
    const answer = await relay.request(task.id, preview, abort.signal, onEvent, leaseId);
    requireDefaultEnvironmentRegistry(codexHome);
    if (!ended) send({ id: message.id, result: answer });
    if (answer.decision !== "accept") return fail("request-declined");
    if (mandateReceipt) authorizedActions.set(p.itemId, mandateReceipt);
  };
  const handle = (message) => {
    if (ended) return;
    if (message.id !== undefined && !message.method) {
      const call = pending.get(message.id);
      if (!call) return fail("unexpected-response");
      pending.delete(message.id);
      if (message.error || !Object.hasOwn(message, "result")) {
        call.reject(relayError("server-refused"));
        return fail("server-refused");
      }
      if (call.method === "turn/start") {
        const id = message.result?.turn?.id;
        if (typeof id !== "string" || (turnId && turnId !== id)) {
          call.reject(relayError("turn-binding-invalid"));
          return fail("turn-binding-invalid");
        }
        turnId = id;
      }
      call.resolve(message.result);
      return;
    }
    if (message.id !== undefined) {
      void handleApproval(message).catch((error) => fail(
        /^human-approval-[a-z-]+$/u.test(error?.code ?? "")
          ? error.code.slice("human-approval-".length) : "approval-refused",
      ));
      return;
    }
    const p = message.params;
    if (["thread/environment/connected", "thread/environment/disconnected"].includes(message.method)) {
      if (!localEnvironmentBound || p?.threadId !== threadId || p.environmentId !== "local"
        || message.method === "thread/environment/disconnected") return fail("environment-binding-invalid");
    } else if (message.method === "turn/started") {
      if (p?.threadId !== threadId || typeof p.turn?.id !== "string" || (turnId && turnId !== p.turn.id)) return fail("turn-binding-invalid");
      turnId = p.turn.id;
    } else if (["item/started", "item/completed", "thread/tokenUsage/updated", "turn/completed"].includes(message.method)) {
      // turn/completed carries the turn id inside turn, other notifications use turnId.
      bound(message.method === "turn/completed" ? { ...p, turnId: p.turn?.id } : p);
      if (message.method === "item/started" && p.item?.type === "fileChange") {
        if (items.size >= 128) return fail("item-bound-exceeded");
        items.set(p.item.id, p.item);
      }
      if (message.method === "item/completed") {
        items.delete(p.item?.id);
        const mandateReceipt = authorizedActions.get(p.item?.id);
        if (mandateReceipt) {
          authorizedActions.delete(p.item.id);
          completedActions.set(p.item.id, mandateReceipt);
          publishCompletedActions();
        }
        if (p.item?.type === "agentMessage") {
          lastMessage = p.item.text;
          if (applicationSkillRuntime) {
            lineageNotifications.push(message);
            if (lineageNotifications.length > 3) return fail("skill-consumption-invalid");
          }
        }
      }
      if (message.method === "thread/tokenUsage/updated") {
        if (applicationSkillRuntime) {
          lineageNotifications.push(message);
          if (lineageNotifications.length > 3) return fail("skill-consumption-invalid");
        }
        const total = p.tokenUsage?.total;
        if (![total?.inputTokens, total?.cachedInputTokens, total?.outputTokens].every((n) => Number.isSafeInteger(n) && n >= 0)
          || total.cachedInputTokens > total.inputTokens
          || !Number.isSafeInteger(total.inputTokens + total.outputTokens)) return fail("usage-invalid");
        usage = normalizeUsage({ input_tokens: total.inputTokens, cached_input_tokens: total.cachedInputTokens, output_tokens: total.outputTokens });
        input.onUsage?.(usage);
        onEvent("human.model.usage", usage);
        if (usage.total_tokens > task.max_total_tokens - task.total_tokens) return fail("token-bound-exceeded");
        publishCompletedActions();
      }
      if (message.method === "turn/completed") {
        if (p.turn?.status !== "completed" || !lastMessage || !usage || relay.list(task.id, leaseId).length
          || authorizedActions.size || completedActions.size) return fail("turn-incomplete");
        if (applicationSkillRuntime) {
          lineageNotifications.push(message);
          if (lineageNotifications.length > 3) return fail("skill-consumption-invalid");
          const lineage = resolveGovernorSkillAppServerConsumptionLineage({
            selectionEvidence: prepared.skillEvidence,
            contextEvidence: prepared.evidence,
            threadId,
            turnId,
            notifications: lineageNotifications,
          });
          if (lineage.status !== "resolved") return fail("skill-consumption-invalid");
          onEvent("governor.skill.consumed", lineage.evidence);
        }
        turnFinished = true;
        void Promise.all([...pendingEvidence]).then(() => {
          if (!ended) complete({ output: lastMessage, usage, threadId });
        }, () => fail("mandate-evidence-unavailable"));
      }
    } else if (message.method === "serverRequest/resolved") {
      // A request cleared elsewhere must never be re-granted by a delayed mobile answer.
      if (relay.available(task.id) && relay.list(task.id, leaseId).some((entry) => entry.rpcId === p?.requestId)) fail("request-cleared");
    }
  };
  // Keep the lease private to this host process; it is not supplied to Codex.
  const decoder = new StringDecoder("utf8");
  child.stdout.on("data", (chunk) => {
    totalBytes += chunk.length;
    buffer += decoder.write(chunk);
    if (totalBytes > 16_000_000 || Buffer.byteLength(buffer) > 1_000_000) return fail("output-bound-exceeded");
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      try { handle(JSON.parse(line)); } catch { fail("protocol-invalid"); }
    }
  });
  child.stderr.on("data", () => {}); // Provider diagnostics may contain sensitive text.
  child.stdin.on("error", () => fail("transport-write-failed"));
  child.on("error", () => fail("transport-unavailable"));
  child.on("close", () => { if (!ended && !turnFinished) fail("transport-closed"); });
  const timer = setTimeout(() => fail("turn-timeout"), Math.min(task.max_minutes * 60_000, 30 * 60_000));
  const relayTimer = setInterval(() => { if (!relay.available(task.id, leaseId)) fail("relay-disconnected"); }, 250);
  try {
    const initialized = await request("initialize", { clientInfo: { name: "agentos_human_relay", version: "0.1.0" }, capabilities: { experimentalApi: true } });
    codexHome = initialized?.codexHome;
    requireDefaultEnvironmentRegistry(codexHome);
    send({ method: "initialized", params: {} });
    // Per-app reviewers override the top-level reviewer. Inspect only in memory,
    // refuse automatic overrides, and pin every discovered app reviewer for this thread.
    const configuration = await request("config/read", { cwd, includeLayers: false });
    if (!configuration?.config || typeof configuration.config !== "object") throw relayError("config-unavailable");
    const apps = configuration.config.apps ?? {};
    if (typeof apps !== "object" || Array.isArray(apps)) throw relayError("config-unavailable");
    const overrides = { "apps._default.approvals_reviewer": "user" };
    for (const [id, app] of Object.entries(apps)) {
      if (!/^[A-Za-z0-9_-]+$/.test(id) || !app || typeof app !== "object" || Array.isArray(app)) throw relayError("config-unavailable");
      if (app.enabled !== false && app.approvals_reviewer != null && app.approvals_reviewer !== "user") throw relayError("app-reviewer-invalid");
      overrides[`apps.${id}.approvals_reviewer`] = "user";
    }
    // Pin both sticky and turn environment selection; never inherit a default or
    // bind to an identifier learned from an approval request. Unsupported servers fail closed.
    const status = await request("environment/status", { environmentId: "local" });
    if (status?.status !== "ready") throw relayError("environment-binding-invalid");
    const info = await request("environment/info", { environmentId: "local" });
    let environmentCwd;
    try { environmentCwd = fileURLToPath(info?.cwd); } catch { throw relayError("environment-binding-invalid"); }
    if (environmentCwd !== cwd) throw relayError("environment-binding-invalid");
    const environments = [{ environmentId: "local", cwd, runtimeWorkspaceRoots: [cwd] }];
    const started = await request("thread/start", { cwd, environments, sandbox: agent.sandbox, approvalPolicy: "untrusted", approvalsReviewer: "user", config: overrides, ephemeral: true, ...(agent.model ? { model: agent.model } : {}) });
    if (started.cwd !== cwd || started.approvalPolicy !== "untrusted" || started.approvalsReviewer !== "user"
      || started.sandbox?.type !== (agent.sandbox === "workspace-write" ? "workspaceWrite" : "readOnly")
      || typeof started.thread?.id !== "string" || started.thread.ephemeral !== true) throw relayError("effective-policy-invalid");
    threadId = started.thread.id;
    localEnvironmentBound = true;
    requireDefaultEnvironmentRegistry(codexHome);
    onEvent("human.relay.ready", { approvalPolicy: "untrusted", approvalsReviewer: "user" });
    const sandboxPolicy = agent.sandbox === "workspace-write"
      ? { type: "workspaceWrite", writableRoots: [cwd], networkAccess: false, excludeTmpdirEnvVar: true, excludeSlashTmp: true }
      : { type: "readOnly", networkAccess: false };
    const startedTurn = await request("turn/start", { threadId, cwd, environments,
      input: prepared.input ?? [{ type: "text", text: prepared.prompt, text_elements: [] }],
      ...(prepared.additionalContext ? { additionalContext: prepared.additionalContext } : {}),
      approvalPolicy: "untrusted", approvalsReviewer: "user", sandboxPolicy });
    if (turnId && turnId !== startedTurn.turn?.id) throw relayError("turn-binding-invalid");
    turnId = startedTurn.turn?.id;
    if (typeof turnId !== "string") throw relayError("turn-binding-invalid");
    const result = await done;
    if (failure) throw failure;
    ended = true;
    return result;
  } catch (error) {
    fail("runner-stopped");
    const safeError = error?.retryable === false ? error : relayError("runner-stopped");
    if (usage) safeError.usage = usage;
    throw safeError;
  } finally {
    ended = true;
    clearTimeout(timer);
    clearInterval(relayTimer);
    abort.abort();
    signal?.removeEventListener("abort", operatorAbort);
    if (relay.available(task.id, leaseId)) relay.disconnect(task.id);
    child.stdin.end();
    stop(operatorAborted ? "SIGKILL" : "SIGTERM");
    // Keep the host alive through the escalation deadline so orphaned tools are stopped too.
    if (Number.isSafeInteger(child.pid) && child.pid > 0) {
      if (!operatorAborted) await new Promise((resolve) => setTimeout(resolve, 2000));
      stop("SIGKILL");
      try { await confirmProcessGroupStopped(child.pid); }
      catch { throw relayError("termination-unconfirmed"); }
    }
  }
}
