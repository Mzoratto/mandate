import type { NormalizedEffect, ProposedAction } from "@mandate/protocol";

export interface EffectContext {
  repository: string;
  environment: string;
  database?: string;
  service?: string;
}

function repositoryUri(repository: string, path?: string): string {
  return path ? `repository://${repository}/${path}` : `repository://${repository}`;
}

function normalizedPath(input: unknown): string {
  if (typeof input !== "string" || !input || input.startsWith("/") || /[%\\]/.test(input)) {
    throw new Error("Path must be a normalized repository-relative path");
  }
  const segments = input.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Path must not contain empty or traversal segments");
  }
  return input;
}

function effect(
  type: NormalizedEffect["type"],
  resources: string[],
  environment: string,
  reversible: boolean,
  confidence = 1,
): NormalizedEffect {
  return { type, resources, environment, reversible, confidence };
}

function classifyFileAction(action: ProposedAction, context: EffectContext): NormalizedEffect[] | undefined {
  if (action.tool !== "filesystem") return undefined;
  const path = normalizedPath(action.inputs.path);
  const resource = repositoryUri(context.repository, path);
  if (["readFile", "search", "stat"].includes(action.operation)) {
    if (/(^|\/)\.env(?:\.|$)|(^|\/)(secrets?|credentials?)(\/|$)/i.test(path)) {
      return [effect("SECRET_READ", [resource], context.environment, true)];
    }
    return [effect("CODE_READ", [resource], context.environment, true)];
  }
  if (["writeFile", "editFile", "deleteFile"].includes(action.operation)) {
    if (/(^|\/)\.env(?:\.|$)|(^|\/)(secrets?|credentials?)(\/|$)/i.test(path)) {
      return [effect("SECRET_WRITE", [resource], context.environment, action.operation !== "deleteFile")];
    }
    if (/(^|\/)(migrations?|schema)(\/|\.|$)/i.test(path)) {
      const resources = context.database ? [resource, `database://${context.database}`] : [resource];
      return [effect("DATABASE_SCHEMA_MUTATION", resources, context.environment, true)];
    }
    if (/(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(path)) {
      return [effect("DEPENDENCY_MODIFICATION", [resource], context.environment, true)];
    }
    if (path.startsWith("tests/") || /(?:^|\/)__tests__\//.test(path) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) {
      return [effect("TEST_MODIFICATION", [resource], context.environment, true)];
    }
    return [effect("CODE_MODIFICATION", [resource], context.environment, true)];
  }
  return [effect("LOCAL_COMMAND_EXECUTION", [], context.environment, false, 0)];
}

function classifyShellAction(action: ProposedAction, context: EffectContext): NormalizedEffect[] | undefined {
  if (action.tool !== "shell") return undefined;
  const command = typeof action.inputs.command === "string" ? action.inputs.command.toLowerCase() : "";
  const effects = [effect("LOCAL_COMMAND_EXECUTION", [], context.environment, false, 0)];
  if (/\b(alter|create|drop)\s+(table|index|schema)\b|\b(migrate|migration|drizzle-kit push)\b/.test(command)) {
    effects.push(effect(
      "DATABASE_SCHEMA_MUTATION",
      context.database ? [`database://${context.database}`] : [],
      context.environment,
      false,
    ));
  }
  if (/\b(deploy|promote|release)\b/.test(command) && /\b(prod|production)\b/.test(command)) {
    effects.push(effect(
      "PRODUCTION_DEPLOYMENT",
      context.service ? [`service://${context.service}`] : [],
      "production",
      false,
    ));
  }
  if (/\b(curl|wget|ssh|scp|npm\s+(install|publish)|pnpm\s+(add|install|publish))\b/.test(command)) {
    effects.push(effect("NETWORK_REQUEST", [], context.environment, false));
  }
  return effects;
}

export function classifyAction(action: ProposedAction, context: EffectContext): NormalizedEffect[] {
  const fileEffects = classifyFileAction(action, context);
  if (fileEffects) return fileEffects;
  const shellEffects = classifyShellAction(action, context);
  if (shellEffects) return shellEffects;
  if (action.tool === "git" && action.operation === "createBranch") {
    return [effect("BRANCH_CREATION", [repositoryUri(context.repository)], context.environment, true)];
  }
  if (["testRunner", "reviewer"].includes(action.tool) && action.operation === "run") {
    return [effect("LOCAL_COMMAND_EXECUTION", [], context.environment, true)];
  }
  return [effect("LOCAL_COMMAND_EXECUTION", [], context.environment, false, 0)];
}
