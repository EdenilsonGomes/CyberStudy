import { parseStudyLesson, type StudySource } from "./study-contract.ts";

type Schema = Record<string, unknown>;
const string = (max: number, min = 1): Schema => ({ type: "string", minLength: min, maxLength: max });
const object = (properties: Record<string, Schema>): Schema => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const array = (items: Schema, min: number, max: number): Schema => ({ type: "array", items, minItems: min, maxItems: max });
const id: Schema = { ...string(30), pattern: "^[a-z0-9-]+$" };

export function studyEvidence(sources: StudySource[]) {
  return sources.flatMap((source, sourceIndex) => {
    const excerpts: { id: string; sourceId: string; quote: string }[] = [];
    for (let start = 0; start < source.content.length;) {
      let end = Math.min(start + 420, source.content.length);
      if (source.content.length - end < 20) end = source.content.length;
      else {
        const boundary = Math.max(source.content.lastIndexOf(". ", end - 1), source.content.lastIndexOf("\n", end - 1));
        if (boundary > start + 100) end = boundary + 1;
      }
      const quote = source.content.slice(start, end).trim();
      if (quote.length >= 20) excerpts.push({ id: `s${sourceIndex}q${excerpts.length}`, sourceId: source.id, quote });
      start = end;
    }
    return excerpts;
  });
}

// The provider must produce the same shape the runner consumes, not merely valid JSON.
export function studyGenerationSchema(sources: StudySource[], diagnostic: boolean): Schema {
  const evidence = studyEvidence(sources);
  if (!evidence.length || sources.some(source => !evidence.some(excerpt => excerpt.sourceId === source.id))) throw new Error("UNSUPPORTED_SOURCE");
  const common = {
    title: string(100), instruction: string(350), assessment: { type: "boolean" },
    evidenceId: { type: "string", enum: evidence.map(excerpt => excerpt.id) },
    explanation: string(450), misconception: string(450),
    ...(!diagnostic ? { brief: string(400), help: object(Object.fromEntries(["explanation", "purpose", "term", "example", "lost"].map(reason => [reason, string(260)]))) } : {}),
  };
  const options = array(string(180), 4, 4);
  const optionIndex: Schema = { type: "integer", enum: [0, 1, 2, 3] };
  const items = array(object({ id, label: string(160) }), 2, 4);
  const scenarioFields = { ...common, type: { type: "string", enum: ["scenario"] }, options, correctOption: optionIndex, scene: array(object({ label: string(60), value: string(160) }), 0, 3) };
  const scenario = object(scenarioFields);
  if (diagnostic) return object({ title: string(140), objective: string(300), concepts: object(Object.fromEntries(sources.map((source, index) => [
    `concept_${index + 1}`, array(object({ ...scenarioFields, evidenceId: { type: "string", enum: evidence.filter(excerpt => excerpt.sourceId === source.id).map(excerpt => excerpt.id) } }), 2, 2),
  ]))) });
  const variants = [
    scenario,
    object({ ...common, type: { type: "string", enum: ["match"] }, items, options, expected: array(object({ itemId: id, optionIndex }), 2, 4) }),
    object({ ...common, type: { type: "string", enum: ["order"] }, items, expected: array(id, 2, 4) }),
  ];
  return object({ title: string(140), objective: string(300), steps: array({ anyOf: variants }, 6, 6) });
}

export function parseGeneratedStudy(value: unknown, sources: StudySource[], diagnostic: boolean) {
  const evidence = studyEvidence(sources);
  if (diagnostic && value && typeof value === "object" && "concepts" in value) {
    const groups = value.concepts;
    if (!groups || typeof groups !== "object" || Array.isArray(groups) || Object.keys(groups).length !== sources.length) throw new Error("DIAGNOSIS_NEEDS_TWO_PROBES");
    value = { ...value, steps: sources.flatMap((source, index) => {
      const steps = (groups as Record<string, unknown>)[`concept_${index + 1}`];
      if (!Array.isArray(steps) || steps.length !== 2) throw new Error("DIAGNOSIS_NEEDS_TWO_PROBES");
      if (steps.some(step => !step || !evidence.some(excerpt => excerpt.id === step.evidenceId && excerpt.sourceId === source.id))) throw new Error("UNSUPPORTED_SOURCE");
      return steps;
    }) };
  }
  const optionAt = (options: unknown, index: unknown) => {
    if (!Array.isArray(options) || !Number.isInteger(index) || Number(index) < 0 || Number(index) >= options.length || typeof options[Number(index)] !== "string") throw new Error("INVALID_ANSWER_KEY");
    return options[Number(index)].trim();
  };
  // Strict schemas cannot use arbitrary object keys; convert explicit matching pairs
  // to the existing runner contract. No change to saved packages or old sessions.
  if (value && typeof value === "object" && "steps" in value && Array.isArray(value.steps)) {
    value = { ...value, steps: value.steps.map((step: Record<string, unknown>) => {
      if (step && "evidenceId" in step) {
        const excerpt = evidence.find(entry => entry.id === step.evidenceId);
        if (!excerpt) throw new Error("UNSUPPORTED_SOURCE");
        const { evidenceId, ...activity } = step;
        void evidenceId;
        step = { ...activity, sourceId: excerpt.sourceId, quote: excerpt.quote };
      }
      if (step?.type === "scenario" && "correctOption" in step) {
        const { correctOption, ...activity } = step;
        return { ...activity, expected: optionAt(step.options, correctOption) };
      }
      if (!step || step.type !== "match" || !Array.isArray(step.expected)) return step;
      const pairs = step.expected.map(pair => pair && typeof pair === "object" && "optionIndex" in pair ? { itemId: pair.itemId, option: optionAt(step.options, pair.optionIndex) } : pair);
      if (pairs.some(pair => !pair || typeof pair.itemId !== "string" || typeof pair.option !== "string") || new Set(pairs.map(pair => pair.itemId)).size !== pairs.length) throw new Error("INVALID_ANSWER_KEY");
      return { ...step, expected: Object.fromEntries(pairs.map(pair => [pair.itemId, pair.option])) };
    }) };
  }
  // Semantic checks (literal citations, answer membership, learning mix) remain mandatory.
  return parseStudyLesson(value, sources, diagnostic);
}
