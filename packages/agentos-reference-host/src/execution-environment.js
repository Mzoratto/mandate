import path from "node:path";

function invalidEnvironment() {
  return Object.assign(new Error("execution-environment-invalid"), { retryable: false });
}

export function absoluteEnvironmentPath(value) {
  if (typeof value !== "string" || value.length > 8192 || /[\x00-\x1f\x7f]/u.test(value)
    || !path.isAbsolute(value)) throw invalidEnvironment();
  return value;
}

// Extend the existing pre-model allowlist to every ordinary repository child.
// Locators are host configuration, not proof of filesystem or executable identity.
export function repositoryProcessEnvironment(environment = process.env) {
  if (!environment || typeof environment !== "object" || Array.isArray(environment)) throw invalidEnvironment();
  const env = {};
  const executablePath = environment.PATH === undefined
    ? `${path.dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin` : environment.PATH;
  if (typeof executablePath !== "string" || executablePath.length > 8192) throw invalidEnvironment();
  for (const entry of executablePath.split(path.delimiter)) absoluteEnvironmentPath(entry);
  env.PATH = executablePath;
  for (const name of ["HOME", "TMPDIR"]) {
    if (environment[name] !== undefined) env[name] = absoluteEnvironmentPath(environment[name]);
  }
  return Object.assign(env, {
    HUSKY: "0",
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    NPM_CONFIG_USERCONFIG: "/dev/null",
  });
}
