import { createHash, randomUUID } from "node:crypto";

export function relayError(code) {
  return Object.assign(new Error(`human-approval-${code}`), { code: `human-approval-${code}`, retryable: false });
}

// Only the trusted operator host calls these methods. No session-wide grants,
// automatic answers, credential persistence, or repository-visible IPC files.
export class HumanApprovalRelay {
  constructor({ timeoutMs = 30 * 60_000 } = {}) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30 * 60_000) throw relayError("timeout-invalid");
    this.timeoutMs = timeoutMs;
    this.sessions = new Map();
  }

  connect(taskId) {
    if (!/^[a-f0-9]{8}$/.test(taskId ?? "")) throw relayError("task-invalid");
    if (this.sessions.has(taskId) || this.sessions.size >= 16) throw relayError("session-unavailable");
    const session = { taskId, leaseId: randomUUID(), expiresAt: Date.now() + this.timeoutMs, pending: new Map(), used: new Set() };
    session.timer = setTimeout(() => this.disconnect(taskId), this.timeoutMs);
    session.timer.unref();
    this.sessions.set(taskId, session);
    return { taskId, leaseId: session.leaseId, expiresAt: new Date(session.expiresAt).toISOString() };
  }

  available(taskId, leaseId = null) {
    const session = this.sessions.get(taskId);
    return Boolean(session && Date.now() < session.expiresAt && (leaseId === null || leaseId === session.leaseId));
  }

  binding(taskId) {
    if (!this.available(taskId)) throw relayError("session-unavailable");
    return this.sessions.get(taskId).leaseId;
  }

  session(taskId, leaseId) {
    const session = this.sessions.get(taskId);
    if (!this.available(taskId) || session.leaseId !== leaseId) throw relayError("session-unavailable");
    return session;
  }

  list(taskId, leaseId) {
    return [...this.session(taskId, leaseId).pending.values()].map((entry) => structuredClone(entry.preview));
  }

  request(taskId, request, signal, onEvent = () => {}, leaseId = null) {
    if (!this.available(taskId, leaseId) || signal?.aborted) return Promise.reject(relayError("relay-unavailable"));
    const session = this.sessions.get(taskId);
    const encoded = JSON.stringify(request);
    if (Buffer.byteLength(encoded) > 65536 || session.pending.size >= 8 || session.used.size >= 128) {
      return Promise.reject(relayError("request-bound-exceeded"));
    }
    const key = JSON.stringify(request.rpcId);
    if (session.used.has(key)) return Promise.reject(relayError("request-replayed"));
    session.used.add(key);
    const requestId = randomUUID();
    const checksum = `sha256:${createHash("sha256").update(encoded).digest("hex")}`;
    const preview = { ...structuredClone(request), taskId, requestId, checksum, expiresAt: new Date(session.expiresAt).toISOString() };
    return new Promise((resolve, reject) => {
      const finish = (answer, error) => {
        session.pending.delete(requestId);
        signal?.removeEventListener("abort", abort);
        if (error) reject(error);
        else resolve(answer);
      };
      const abort = () => finish(null, relayError("request-cancelled"));
      session.pending.set(requestId, { preview, finish, onEvent });
      signal?.addEventListener("abort", abort, { once: true });
      try { onEvent("human.approval.requested", { requestId, checksum, method: request.method }); }
      catch { finish(null, relayError("audit-unavailable")); }
    });
  }

  answer({ taskId, leaseId, requestId, checksum, decision }) {
    if (!["accept", "decline", "cancel"].includes(decision)) throw relayError("decision-invalid");
    const entry = this.session(taskId, leaseId).pending.get(requestId);
    if (!entry || entry.preview.checksum !== checksum) throw relayError("request-stale");
    // Audit successfully before granting anything; only minimized metadata persists.
    try { entry.onEvent("human.approval.answered", { requestId, checksum, decision }); }
    catch {
      entry.finish(null, relayError("audit-unavailable"));
      throw relayError("audit-unavailable");
    }
    entry.finish({ decision });
    return { requestId, checksum, decision };
  }

  disconnect(taskId) {
    const session = this.sessions.get(taskId);
    if (!session) return;
    clearTimeout(session.timer);
    this.sessions.delete(taskId);
    for (const entry of session.pending.values()) entry.finish(null, relayError("relay-disconnected"));
  }

  close() {
    for (const taskId of this.sessions.keys()) this.disconnect(taskId);
  }
}
