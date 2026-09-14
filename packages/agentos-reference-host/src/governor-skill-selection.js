import { createHash } from "node:crypto";

const CHECKSUM = /^sha256:[a-f0-9]{64}$/u;
const ID = /^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const INVOCATIONS = new Set(["implicit-allowed", "explicit-only"]);
const MAX_SKILLS = 128;
const MAX_SELECTIONS = 8;
const authority = Object.freeze({ execution: false, modelCall: false, skillInvocation: false });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && same(Object.keys(value).sort(), [...keys].sort());
const checksum = value => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const invalid = code => ({ status: "refused", code, selected: null, evidence: null, authority });
const compareNames = (left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0;

function validIdentity(value) {
  return exactKeys(value, ["id", "version", "checksum"])
    && ID.test(value.id ?? "") && VERSION.test(value.version ?? "") && CHECKSUM.test(value.checksum ?? "");
}

function validSkill(value) {
  return exactKeys(value, ["name", "version", "checksum", "enabled", "invocation"])
    && ID.test(value.name ?? "") && VERSION.test(value.version ?? "")
    && CHECKSUM.test(value.checksum ?? "") && typeof value.enabled === "boolean"
    && INVOCATIONS.has(value.invocation);
}

function validNames(value) {
  return Array.isArray(value) && value.length <= MAX_SELECTIONS
    && value.every(name => typeof name === "string" && ID.test(name))
    && new Set(value).size === value.length;
}

function minimizedEvidence(catalog, observation, decision, candidateCount, selected) {
  return {
    matcher: structuredClone(observation.matcher),
    catalogChecksum: checksum(JSON.stringify(catalog)),
    observationChecksum: checksum(JSON.stringify(observation)),
    decision,
    candidateCount,
    selected: structuredClone(selected),
  };
}

function selectedSkill(skill, reason) {
  return { name: skill.name, version: skill.version, checksum: skill.checksum, reason };
}

/**
 * Validate a runtime skill-match observation without reproducing Codex's semantic matcher.
 * The caller must derive the catalog identity and invocation policy from exact skill sources.
 */
export function validateGovernorSkillSelectionEvidence({ expectedMatcher, catalog, observation } = {}) {
  try {
    if (!validIdentity(expectedMatcher) || !Array.isArray(catalog) || catalog.length > MAX_SKILLS
      || !exactKeys(observation, ["matcher", "explicit", "matches"])
      || !validIdentity(observation.matcher) || !same(expectedMatcher, observation.matcher)
      || !validNames(observation.explicit) || !validNames(observation.matches)
      || (observation.explicit.length > 0 && observation.matches.length > 0)) {
      return invalid("skill-selection-input-invalid");
    }
    if (!catalog.every(validSkill)) return invalid("skill-catalog-invalid");

    const normalizedCatalog = [...catalog].sort(compareNames);
    if (new Set(normalizedCatalog.map(skill => skill.name)).size !== normalizedCatalog.length) {
      return invalid("skill-catalog-invalid");
    }
    const byName = new Map(normalizedCatalog.map(skill => [skill.name, skill]));
    const requestedNames = observation.explicit.length > 0 ? observation.explicit : observation.matches;
    if (requestedNames.some(name => !byName.get(name)?.enabled)) return invalid("skill-unavailable");

    if (observation.explicit.length > 0) {
      const selected = observation.explicit.map(name => selectedSkill(byName.get(name), "explicit-request"))
        .sort(compareNames);
      return {
        status: "resolved",
        code: null,
        selected,
        evidence: minimizedEvidence(normalizedCatalog, observation, "explicit", selected.length, selected),
        authority,
      };
    }

    const candidates = observation.matches.map(name => byName.get(name));
    if (candidates.some(skill => skill.invocation === "explicit-only")) {
      return {
        status: "refused",
        code: "explicit-invocation-required",
        selected: null,
        evidence: minimizedEvidence(normalizedCatalog, observation,
          "explicit-invocation-required", candidates.length, []),
        authority,
      };
    }
    if (candidates.length > 1) {
      return {
        status: "refused",
        code: "skill-selection-ambiguous",
        selected: null,
        evidence: minimizedEvidence(normalizedCatalog, observation, "ambiguous", candidates.length, []),
        authority,
      };
    }
    const selected = candidates.length === 1 ? [selectedSkill(candidates[0], "single-runtime-match")] : [];
    return {
      status: "resolved",
      code: null,
      selected,
      evidence: minimizedEvidence(normalizedCatalog, observation,
        candidates.length === 1 ? "single-match" : "no-match", candidates.length, selected),
      authority,
    };
  } catch {
    return invalid("skill-selection-unmeasurable");
  }
}
