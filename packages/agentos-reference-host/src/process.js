import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { repositoryProcessEnvironment } from "./execution-environment.js";

const execFileAsync = promisify(execFile);
const processError = code => Object.assign(new Error(code), { code, retryable: false });
const watchdogPath = fileURLToPath(new URL("./process-watchdog.js", import.meta.url));

function groupExists(pid) {
  try { process.kill(-pid, 0); return true; }
  catch (error) {
    if (error.code === "ESRCH") return false;
    // macOS can report EPERM while a killed orphan is being reaped. That is
    // not proof of absence: require the bounded state observation below.
    if (error.code === "EPERM") return true;
    throw processError("process-termination-unconfirmed");
  }
}

export async function confirmProcessGroupStopped(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 1 || pid === process.pid) {
    throw processError("process-termination-unconfirmed");
  }
  const deadline = performance.now() + 2000;
  while (groupExists(pid)) {
    // A killed orphan can remain a zombie until its new parent reaps it. Observe only
    // group IDs and states, never host command lines or environments.
    const { stdout } = await execFileAsync("/bin/ps", ["-axo", "pgid=,stat="], {
      env: { PATH: "/usr/bin:/bin", HOME: "/var/empty" }, timeout: 500, maxBuffer: 2_000_000,
    });
    const rows = stdout.trim().split("\n");
    if (!rows.length || rows.some(row => !/^\s*\d+\s+\S+\s*$/u.test(row))) {
      throw processError("process-termination-unconfirmed");
    }
    if (!rows.some(row => {
      const [, group, state] = /^\s*(\d+)\s+(\S+)\s*$/u.exec(row);
      return Number(group) === pid && !state.startsWith("Z");
    })) return;
    if (performance.now() >= deadline) throw processError("process-termination-unconfirmed");
    await delay(20);
  }
}

export function runProcess(command, args, options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    timeoutMs = 30 * 60 * 1000,
    maxOutputBytes = 2_000_000,
    onStdoutLine,
    onStderrLine,
    parentDeathFence = false,
    signal,
  } = options;

  return new Promise((resolve, reject) => {
    if (!["darwin", "linux"].includes(process.platform)) throw processError("process-platform-unsupported");
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647
      || !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0 || maxOutputBytes > 2_000_000
      || typeof parentDeathFence !== "boolean"
      || (signal !== undefined && !(signal instanceof AbortSignal))) throw processError("process-options-invalid");
    if (signal?.aborted) throw processError("process-aborted");
    const childEnvironment = repositoryProcessEnvironment(env);
    let child;
    let watchdog;
    try {
      const launchCommand = parentDeathFence ? "/bin/sh" : command;
      const launchArgs = parentDeathFence
        ? ["-c", "kill -STOP \"$$\"; exec \"$@\"", "agentos-process-gate", command, ...args]
        : args;
      child = spawn(launchCommand, launchArgs, {
        cwd, env: childEnvironment, detached: true, stdio: ["ignore", "pipe", "pipe"],
      });
      if (parentDeathFence) {
        watchdog = spawn(process.execPath, [watchdogPath, String(child.pid)], {
          cwd: "/", detached: true, env: { PATH: "/usr/bin:/bin", HOME: "/var/empty" },
          stdio: ["pipe", "pipe", "ignore"],
        });
        watchdog.unref();
        watchdog.stdin.unref?.();
      }
    } catch { throw processError("process-start-failed"); }
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let failure;
    let settling = false;
    let drainTimer;
    let watchdogReady = false;
    let watchdogHandshake = Buffer.alloc(0);
    const finish = async (code, exitSignal, closed = true) => {
      if (settling) return;
      settling = true;
      clearTimeout(timer);
      clearTimeout(drainTimer);
      signal?.removeEventListener("abort", abort);
      if (!closed) {
        failure = processError("process-termination-unconfirmed");
        child.stdout.destroy(); child.stderr.destroy(); child.unref();
      }
      try { if (child.pid) await confirmProcessGroupStopped(child.pid); }
      catch { failure = processError("process-termination-unconfirmed"); }
      if (watchdog?.stdin && !watchdog.stdin.destroyed) watchdog.stdin.end("release\n");
      if (failure) reject(failure);
      else resolve({ code: code ?? 1, signal: exitSignal, stdout, stderr, timedOut: false });
    };
    const stop = error => {
      if (settling || failure) return;
      failure = error;
      if (child.pid) {
        // No graceful execution window after a revoked/failed boundary. Only the
        // group created by this spawn is targeted, never the supervisor's group.
        try { process.kill(-child.pid, "SIGKILL"); }
        catch {
          // A group may already be exiting while its output is still draining.
          // Keep the original failure only if finish independently confirms no
          // executing members; a failed signal is never proof of termination.
        }
      }
      drainTimer = setTimeout(() => { void finish(null, null, false); }, 2000);
    };
    const notifyLine = (callback, line) => {
      if (failure || settling) return;
      try { callback?.(line); }
      catch { stop(processError("process-observer-failed")); }
    };

    const readOutput = (stream, capture, callback) => {
      const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
      let pending = "";
      let afterCR = false;
      const deliver = text => {
        capture(text);
        if (callback === undefined) return;
        let start = 0;
        for (const match of text.matchAll(/[\r\n]/gu)) {
          const index = match.index;
          if (afterCR && index === start && match[0] === "\n") {
            afterCR = false;
            start = index + 1;
            continue;
          }
          afterCR = match[0] === "\r";
          notifyLine(callback, pending + text.slice(start, index));
          pending = "";
          start = index + 1;
          if (failure) return;
        }
        if (start < text.length) {
          pending += text.slice(start);
          afterCR = false;
        }
      };
      stream.on("data", chunk => {
        if (failure || settling) return;
        outputBytes += chunk.length;
        // Bound raw bytes before decoding or buffering lines, including data with
        // no newline. Both streams spend from the same invocation ceiling.
        if (outputBytes > maxOutputBytes) return stop(processError("process-output-limit"));
        try { deliver(decoder.decode(chunk, { stream: true })); }
        catch { stop(processError("process-output-invalid-utf8")); }
      });
      stream.on("end", () => {
        if (failure || settling) return;
        try {
          deliver(decoder.decode());
          if (pending) notifyLine(callback, pending);
          pending = "";
        } catch { stop(processError("process-output-invalid-utf8")); }
      });
      stream.on("error", () => stop(processError("process-output-read-failed")));
    };
    readOutput(child.stdout, text => { stdout += text; }, onStdoutLine);
    readOutput(child.stderr, text => { stderr += text; }, onStderrLine);

    if (watchdog) {
      watchdog.stdout.on("data", chunk => {
        if (failure || settling || watchdogReady) return;
        watchdogHandshake = Buffer.concat([watchdogHandshake, chunk]);
        if (watchdogHandshake.length > 6) return stop(processError("process-watchdog-failed"));
        if (watchdogHandshake.length === 6) {
          if (!watchdogHandshake.equals(Buffer.from("ready\n"))) return stop(processError("process-watchdog-failed"));
          watchdogReady = true;
          watchdog.stdout.destroy();
          try { process.kill(child.pid, "SIGCONT"); }
          catch { stop(processError("process-watchdog-failed")); }
        }
      });
      watchdog.stdout.on("end", () => {
        if (!watchdogReady && !settling) stop(processError("process-watchdog-failed"));
      });
      watchdog.stdout.on("error", () => stop(processError("process-watchdog-failed")));
    }

    const timer = setTimeout(() => stop(processError("process-timeout")), timeoutMs);
    const abort = () => stop(processError("process-aborted"));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();

    child.on("error", () => stop(processError("process-start-failed")));
    watchdog?.on("error", () => stop(processError("process-watchdog-failed")));
    watchdog?.on("exit", () => {
      if (!settling) stop(processError("process-watchdog-failed"));
    });
    child.on("exit", () => {
      if (failure || settling || !child.pid) return;
      try {
        if (groupExists(child.pid)) stop(processError("process-descendants-active"));
      } catch { stop(processError("process-termination-unconfirmed")); }
    });
    child.on("close", (code, exitSignal) => { void finish(code, exitSignal); });
  });
}

export async function shell(command, options = {}) {
  return runProcess("/bin/zsh", ["-f", "-c", command], options);
}
