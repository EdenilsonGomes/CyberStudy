import { helpReasons, summarizeLesson, validateAnswer, type AuthoredActivity, type AuthoredLesson, type LessonState } from "./interactive-lesson.ts";

export type StudySource = { id: string; title: string; content: string; concept: string };
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_OBJECT");
  return value as Record<string, unknown>;
};
const text = (value: unknown, max: number): string => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("INVALID_TEXT");
  return value.trim();
};
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

// Reject malformed/ungrounded generation; never silently turn failed generation into generic questions.
export function parseStudyLesson(value: unknown, sources: StudySource[], diagnostic: boolean): AuthoredLesson {
  const raw = record(value);
  if (!Array.isArray(raw.steps) || raw.steps.length < (diagnostic ? 2 : 4) || raw.steps.length > 8) throw new Error("INVALID_STEP_COUNT");
  const steps: AuthoredActivity[] = raw.steps.map((item, index) => {
    const row = record(item);
    const source = sources.find((entry) => entry.id === row.sourceId);
    const quote = text(row.quote, 450);
    if (!source || quote.length < 20 || !normalize(source.content).includes(normalize(quote))) throw new Error("UNSUPPORTED_SOURCE");
    const common = {
      id: `step-${index + 1}`, title: text(row.title, 100), instruction: text(row.instruction, 350),
      concept: source.concept, assessment: diagnostic || row.assessment === true,
      brief: diagnostic ? undefined : text(row.brief, 400), source: { title: source.title, quote },
      explanation: text(row.explanation, 450), misconception: text(row.misconception, 450),
      hints: Object.fromEntries(Object.keys(helpReasons).map((reason) => [reason, [
        diagnostic ? "" : text(record(row.help)[reason], 260), text(row.explanation, 450),
      ]])) as AuthoredActivity["hints"],
      expected: row.expected as AuthoredActivity["expected"],
    };
    const options = () => {
      if (!Array.isArray(row.options) || row.options.length < 2 || row.options.length > 5) throw new Error("INVALID_OPTIONS");
      const values = row.options.map((entry) => text(entry, 180));
      if (new Set(values).size !== values.length) throw new Error("DUPLICATE_OPTIONS");
      return values;
    };
    const items = () => {
      if (!Array.isArray(row.items) || row.items.length < 2 || row.items.length > 4) throw new Error("INVALID_ITEMS");
      const values = row.items.map((entry) => { const item = record(entry); return { id: text(item.id, 30), label: text(item.label, 160) }; });
      if (new Set(values.map((entry) => entry.id)).size !== values.length || values.some((entry) => !/^[a-z0-9-]+$/.test(entry.id))) throw new Error("INVALID_ITEM_IDS");
      return values;
    };
    let step: AuthoredActivity;
    if (row.type === "scenario") {
      const scene = Array.isArray(row.scene) ? row.scene.map((entry) => { const panel = record(entry); return { label: text(panel.label, 60), value: text(panel.value, 160) }; }) : [];
      if (scene.length > 3) throw new Error("INVALID_SCENE");
      step = { ...common, type: "scenario", options: options(), scene };
    } else if (!diagnostic && row.type === "match") step = { ...common, type: "match", items: items(), options: options() };
    else if (!diagnostic && row.type === "order") step = { ...common, type: "order", items: items() };
    else throw new Error("UNSUPPORTED_ACTIVITY");
    if (!validateAnswer(step, step.expected)) throw new Error("INVALID_ANSWER_KEY");
    if (step.type === "order" && JSON.stringify(step.items.map((entry) => entry.id)) === JSON.stringify(step.expected)) {
      step.items = [...step.items.slice(1), step.items[0]]; // The bank must not reveal the sequence.
    }
    return step;
  });
  if (diagnostic) {
    if (new Set(steps.map((step) => normalize(step.instruction).toLowerCase())).size !== steps.length) throw new Error("REPEATED_DIAGNOSTIC_PROBE");
    for (const concept of new Set(sources.map((entry) => entry.concept))) {
      if (steps.filter((step) => step.concept === concept).length !== 2) throw new Error("DIAGNOSIS_NEEDS_TWO_PROBES");
    }
  } else if (steps.filter((step) => step.assessment).length < 3 || steps.every((step) => step.assessment) || !steps.some((step) => step.type !== "scenario")) throw new Error("MISSING_INTERACTIVE_LEARNING");
  return { id: "material-study", version: 1, mode: diagnostic ? "diagnostic" : "study", title: text(raw.title, 140), objective: text(raw.objective, 300), steps };
}

export function diagnosticLevels(lesson: AuthoredLesson, state: LessonState) {
  if (lesson.mode !== "diagnostic" || !state.completed) return {} as Record<string, "base" | "application">;
  const rows = summarizeLesson(lesson, state).rows;
  return Object.fromEntries([...new Set(rows.map((row) => row.concept))].map((concept) => {
    const checks = rows.filter((row) => row.concept === concept);
    return [concept, checks.length >= 2 && checks.every((row) => row.independent) ? "application" : "base"];
  })) as Record<string, "base" | "application">;
}

export function adaptStudyLesson(lesson: AuthoredLesson, level: "base" | "application"): AuthoredLesson {
  return level === "application" ? { ...lesson, steps: lesson.steps.filter((step) => step.assessment) } : lesson;
}
