import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const target = Number(process.argv[2]);
if (!Number.isSafeInteger(target) || target <= 1 || target === process.pid) process.exit(64);

const environment = { PATH: "/usr/bin:/bin", HOME: "/var/empty" };
const identityDeadline = Date.now() + 1_000;
let initialIdentity = identity();
while ((!initialIdentity || initialIdentity.pid !== target || initialIdentity.group !== target)
  && Date.now() < identityDeadline) {
  await delay(10);
  initialIdentity = identity();
}
if (!initialIdentity || initialIdentity.pid !== target || initialIdentity.group !== target) process.exit(65);
process.stdout.write("ready\n");

let input = "";
let stopping = false;
const observation = setInterval(() => {
  if (!identity() && !groupExists()) process.exit(0);
}, 100);

process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => {
  input += chunk;
  if (input === "release\n") process.exit(0);
  if (input.length > 8 || input.includes("\n")) fence();
});
process.stdin.on("end", fence);
process.stdin.on("error", fence);
for (const signal of ["SIGINT", "SIGHUP", "SIGTERM"]) process.on(signal, fence);

function identity() {
  try {
    const output = execFileSync("/bin/ps", ["-p", String(target), "-o", "pid=,pgid=,lstart="], {
      encoding: "utf8", env: environment, stdio: ["ignore", "pipe", "ignore"], timeout: 500,
    }).trim();
    const match = /^(\d+)\s+(\d+)\s+(.+)$/u.exec(output);
    return match ? { pid: Number(match[1]), group: Number(match[2]), started: match[3] } : null;
  } catch { return null; }
}

function groupExists() {
  try { process.kill(-target, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}

function fence() {
  if (stopping) return;
  stopping = true;
  clearInterval(observation);
  const current = identity();
  if (current && (current.pid !== initialIdentity.pid || current.group !== initialIdentity.group
    || current.started !== initialIdentity.started)) process.exit(0);
  if (!current && !groupExists()) process.exit(0);
  try { process.kill(-target, "SIGKILL"); } catch { /* The group may already be exiting. */ }
  const deadline = Date.now() + 2_000;
  const confirmation = setInterval(() => {
    if (!groupExists() || Date.now() >= deadline) {
      clearInterval(confirmation);
      process.exit(0);
    }
  }, 20);
}
