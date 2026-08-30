import test from "node:test";
import assert from "node:assert/strict";
import { generationErrorCode } from "../src/lib/generation-error.ts";

test("generation diagnostics distinguish timeout, invalid material and provider limits", () => {
  assert.equal(generationErrorCode(Object.assign(new Error("private"), { name: "APIConnectionTimeoutError" })), "GENERATION_TIMEOUT");
  assert.equal(generationErrorCode(new Error("UNSUPPORTED_SOURCE")), "UNSUPPORTED_SOURCE");
  assert.equal(generationErrorCode(new SyntaxError("private response")), "INVALID_JSON");
  assert.equal(generationErrorCode(Object.assign(new Error("private"), { status: 429 })), "AI_LIMIT");
  assert.equal(generationErrorCode(new Error("Mistral respondeu 401")), "AI_AUTH");
});
test("unexpected errors never leak provider responses or credentials", () => {
  assert.equal(generationErrorCode(new Error("Token abc, private response")), "GENERATION_FAILED");
  assert.equal(generationErrorCode({ message: "PRIVATE" }), "GENERATION_FAILED");
});
