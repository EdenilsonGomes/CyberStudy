import { parseStudyLesson, type StudySource } from "./study-contract.ts";

type Schema = Record<string, unknown>;
const string = (max: number, min = 1): Schema => ({ type: "string", minLength: min, maxLength: max });
const object = (properties: Record<string, Schema>): Schema => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const array = (items: Schema, min: number, max: number): Schema => ({ type: "array", items, minItems: min, maxItems: max });
const id: Schema = { ...string(30), pattern: "^[a-z0-9-]+$" };

// The provider must produce the same shape the runner consumes, not merely valid JSON.
export function studyGenerationSchema(sources: StudySource[], diagnostic: boolean): Schema {
  const common = {
    title: string(100), instruction: string(350), assessment: { type: "boolean" },
    sourceId: { type: "string", enum: sources.map(source => source.id) }, quote: string(450, 20),
    explanation: string(450), misconception: string(450),
    ...(!diagnostic ? { brief: string(400), help: object(Object.fromEntries(["explanation", "purpose", "term", "example", "lost"].map(reason => [reason, string(260)]))) } : {}),
  };
  const options = array(string(180), 2, 4);
  const items = array(object({ id, label: string(160) }), 2, 4);
  const scenario = object({ ...common, type: { type: "string", enum: ["scenario"] }, options, expected: string(180), scene: array(object({ label: string(60), value: string(160) }), 0, 3) });
  const variants = diagnostic ? [scenario] : [
    scenario,
    object({ ...common, type: { type: "string", enum: ["match"] }, items, options, expected: array(object({ itemId: id, option: string(180) }), 2, 4) }),
    object({ ...common, type: { type: "string", enum: ["order"] }, items, expected: array(id, 2, 4) }),
  ];
  const count = diagnostic ? sources.length * 2 : 6;
  return object({ title: string(140), objective: string(300), steps: array({ anyOf: variants }, count, count) });
}

export function parseGeneratedStudy(value: unknown, sources: StudySource[], diagnostic: boolean) {
  // Strict schemas cannot use arbitrary object keys; convert explicit matching pairs
  // to the existing runner contract. No change to saved packages or old sessions.
  if (value && typeof value === "object" && "steps" in value && Array.isArray(value.steps)) {
    value = { ...value, steps: value.steps.map((step: Record<string, unknown>) => {
      if (!step || step.type !== "match" || !Array.isArray(step.expected)) return step;
      const pairs = step.expected;
      if (pairs.some(pair => !pair || typeof pair.itemId !== "string" || typeof pair.option !== "string") || new Set(pairs.map(pair => pair.itemId)).size !== pairs.length) throw new Error("INVALID_ANSWER_KEY");
      return { ...step, expected: Object.fromEntries(pairs.map(pair => [pair.itemId, pair.option])) };
    }) };
  }
  // Semantic checks (literal citations, answer membership, learning mix) remain mandatory.
  return parseStudyLesson(value, sources, diagnostic);
}
