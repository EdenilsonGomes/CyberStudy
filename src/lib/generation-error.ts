const validationCodes = new Set(["INVALID_OBJECT", "INVALID_TEXT", "INVALID_STEP_COUNT", "UNSUPPORTED_SOURCE", "INVALID_OPTIONS", "DUPLICATE_OPTIONS", "INVALID_ITEMS", "INVALID_ITEM_IDS", "INVALID_SCENE", "UNSUPPORTED_ACTIVITY", "INVALID_ANSWER_KEY", "DIAGNOSIS_NEEDS_TWO_PROBES", "MISSING_INTERACTIVE_LEARNING", "REPEATED_DIAGNOSTIC_PROBE", "AI_NOT_CONFIGURED", "AI_INCOMPLETE", "AI_EMPTY_RESPONSE"]);

// Only allowlisted codes may cross the server boundary; never serialize provider errors.
export function generationErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "GENERATION_FAILED";
  if (validationCodes.has(error.message)) return error.message;
  if (error instanceof SyntaxError) return "INVALID_JSON";
  if (/abort|timeout/i.test(error.name)) return "GENERATION_TIMEOUT";
  const status = "status" in error ? Number(error.status) : Number(error.message.match(/^Mistral respondeu (\d{3})$/)?.[1]);
  if (status === 401 || status === 403) return "AI_AUTH";
  if (status === 429) return "AI_LIMIT";
  return "GENERATION_FAILED";
}
