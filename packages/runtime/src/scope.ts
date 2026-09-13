import type { EffectType, ResourceScope, ScopeDefinition } from "@mandate/protocol";

interface ParsedResource {
  kind: string;
  resource: string;
  path?: string;
}

export function parseResourceUri(uri: string): ParsedResource | undefined {
  const match = /^([a-z]+):\/\/([^/]+)(?:\/(.+))?$/.exec(uri);
  if (!match) return undefined;
  const [, kind, resource, path] = match;
  if (!kind || !resource || /[%\\*\u0000-\u001f]/.test(uri)) return undefined;
  if (path && path.split("/").some((segment) => !segment || segment === "." || segment === "..")) return undefined;
  return path ? { kind, resource, path } : { kind, resource };
}

export function patternCovers(pattern: string, candidate: string): boolean {
  if (pattern === "**") return true;
  if (!pattern.endsWith("/**")) return pattern === candidate;
  const prefix = pattern.slice(0, -3);
  const candidateBase = candidate.endsWith("/**") ? candidate.slice(0, -3) : candidate;
  return candidateBase === prefix || candidateBase.startsWith(`${prefix}/`);
}

function patternIntersection(left: string, right: string): string | undefined {
  if (patternCovers(left, right)) return right;
  if (patternCovers(right, left)) return left;
  return undefined;
}

function matchingEntry(scope: ScopeDefinition, parsed: ParsedResource): ResourceScope | undefined {
  return scope.resources.find((entry) => entry.kind === parsed.kind && entry.resource === parsed.resource);
}

export function resourceInScope(
  scope: ScopeDefinition,
  resourceUri: string,
  environment: string | undefined,
  effectType: EffectType,
): boolean {
  if (!environment || !scope.environments.includes(environment)) return false;
  const parsed = parseResourceUri(resourceUri);
  if (!parsed) return false;
  const entry = matchingEntry(scope, parsed);
  if (!entry) return false;
  if (!parsed.path) {
    if (parsed.kind === "repository" || parsed.kind === "path") {
      return effectType === "BRANCH_CREATION" && parsed.kind === "repository";
    }
    return true;
  }
  const includes = entry.include ?? ["**"];
  const excludes = entry.exclude ?? [];
  return includes.some((pattern) => patternCovers(pattern, parsed.path!))
    && !excludes.some((pattern) => patternCovers(pattern, parsed.path!));
}

export interface SubsetResult {
  subset: boolean;
  reasons: string[];
}

export function scopeSubset(parent: ScopeDefinition, child: ScopeDefinition): SubsetResult {
  const reasons: string[] = [];
  for (const environment of child.environments) {
    if (!parent.environments.includes(environment)) reasons.push(`Environment ${environment} is outside parent scope`);
  }

  for (const childEntry of child.resources) {
    const parentEntry = parent.resources.find(
      (entry) => entry.kind === childEntry.kind && entry.resource === childEntry.resource,
    );
    if (!parentEntry) {
      reasons.push(`Resource ${childEntry.kind}://${childEntry.resource} is outside parent scope`);
      continue;
    }
    if (childEntry.kind !== "repository" && childEntry.kind !== "path") continue;

    const parentIncludes = parentEntry.include ?? ["**"];
    const parentExcludes = parentEntry.exclude ?? [];
    const childIncludes = childEntry.include ?? ["**"];
    const childExcludes = childEntry.exclude ?? [];

    for (const include of childIncludes) {
      if (!parentIncludes.some((parentInclude) => patternCovers(parentInclude, include))) {
        reasons.push(`Include ${include} is outside parent scope`);
      }
      for (const parentExclude of parentExcludes) {
        const intersection = patternIntersection(parentExclude, include);
        if (intersection && !childExcludes.some((exclude) => patternCovers(exclude, intersection))) {
          reasons.push(`Child scope fails to preserve parent exclusion ${parentExclude}`);
        }
      }
    }
  }

  return { subset: reasons.length === 0, reasons };
}
