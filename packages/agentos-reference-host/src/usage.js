function tokenCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function normalizeUsage(usage = {}) {
  const inputTokens = tokenCount(usage.input_tokens);
  const cachedInputTokens = Math.min(inputTokens, tokenCount(usage.cached_input_tokens));
  const outputTokens = tokenCount(usage.output_tokens);

  return {
    input_tokens: inputTokens,
    cached_input_tokens: cachedInputTokens,
    output_tokens: outputTokens,
    reasoning_output_tokens: tokenCount(usage.reasoning_output_tokens),
    raw_total_tokens: inputTokens + outputTokens,
    total_tokens: inputTokens - cachedInputTokens + outputTokens,
  };
}

export function budgetedTokens(usage = {}) {
  if (usage.input_tokens !== undefined || usage.output_tokens !== undefined) {
    return normalizeUsage(usage).total_tokens;
  }
  return tokenCount(usage.total_tokens);
}

export function usageError(code) {
  return Object.assign(new Error(code), { code, retryable: false });
}

// Validate new observations without changing historical active-token semantics.
// null means unreported, not a measured zero. Only numeric counters are retained.
export function usageSnapshot(usage) {
  if (usage == null) return null;
  if (typeof usage !== "object" || Array.isArray(usage)) throw usageError("phase-usage-invalid");
  const count = (value) => {
    if (!Number.isSafeInteger(value) || value < 0) throw usageError("phase-usage-invalid");
    return value;
  };
  if (usage.input_tokens === undefined && usage.output_tokens === undefined) {
    if (Object.keys(usage).length === 0) return null;
    return { total_tokens: count(usage.total_tokens) };
  }
  const input = count(usage.input_tokens);
  const output = count(usage.output_tokens);
  const cached = count(usage.cached_input_tokens === undefined ? 0 : usage.cached_input_tokens);
  const reasoning = count(usage.reasoning_output_tokens === undefined ? 0 : usage.reasoning_output_tokens);
  if (cached > input || reasoning > output) throw usageError("phase-usage-invalid");
  count(input + output);
  const snapshot = normalizeUsage({ input_tokens: input, output_tokens: output,
    cached_input_tokens: cached, reasoning_output_tokens: reasoning });
  for (const field of ["total_tokens", "raw_total_tokens"]) {
    if (usage[field] !== undefined && count(usage[field]) !== snapshot[field]) throw usageError("phase-usage-invalid");
  }
  return snapshot;
}
