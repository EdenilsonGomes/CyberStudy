import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseStudyLesson, adaptStudyLesson, diagnosticLevels } from "../src/lib/study-contract.ts";
import { parseGeneratedStudy, studyGenerationSchema } from "../src/lib/study-generation.ts";
import { initialLessonState, transition, publicLesson, feedbackFor, summarizeLesson } from "../src/lib/interactive-lesson.ts";

const source = { id: "source", title: "Material didático", concept: "Observação e registro", content: "Primeiro observe os dados apresentados. Depois registre os dados para consultar posteriormente. Esse registro permite comparar observações." };
const question = (i, assessment = true) => ({ title: `Situação ${i}`, instruction: `Após observar os dados na situação ${i}, o que vem a seguir?`, brief: "Use o processo apresentado no material.", type: "scenario", options: ["Registrar", "Ignorar"], scene: [{ label: "Situação", value: "Dados observados" }], expected: "Registrar", assessment, sourceId: "source", quote: "Primeiro observe os dados apresentados.", explanation: "Registrar permite consultar os dados posteriormente.", misconception: "Ignorar impede consultar o que foi observado.", help: { explanation: "Pense em como consultar depois.", purpose: "O registro permite comparar.", term: "Registrar significa guardar uma observação.", example: "Um caderno guarda os dados observados.", lost: "Comece pelo que aconteceu primeiro." } });
const studyRaw = () => ({ title: "Aprender com dados", objective: "Organizar a observação e o registro.", steps: [question(1, false), question(2), question(3), { ...question(4), type: "order", items: [{ id: "observe", label: "Observar" }, { id: "record", label: "Registrar" }], expected: ["observe", "record"] }] });
const diagnosisRaw = () => ({ ...studyRaw(), steps: [question(1), question(2)] });
const send = (lesson, state, type, fields = {}) => transition(lesson, state, { revision: state.revision, type, seconds: 2, ...fields });

test("generic material activities require action and preserve real source quotes", () => {
  const lesson = parseStudyLesson(studyRaw(), [source], false);
  assert.deepEqual(lesson.steps.map((step) => step.type), ["scenario", "scenario", "scenario", "order"]);
  assert.equal(lesson.steps[0].source.title, source.title);
  assert.notDeepEqual(lesson.steps[3].items.map((item) => item.id), lesson.steps[3].expected);
});
test("provider schema requires common alternatives and rejects extra object fields", () => {
  const schema = studyGenerationSchema([source], false);
  assert.equal(schema.properties.steps.minItems, 6);
  const variants = schema.properties.steps.items.anyOf;
  for (const variant of variants) {
    assert.equal(variant.additionalProperties, false);
    assert.deepEqual(variant.required, Object.keys(variant.properties));
    assert.deepEqual(variant.properties.sourceId.enum, [source.id]);
  }
  for (const variant of variants.filter(v => v.properties.type.enum[0] !== "order")) {
    assert.ok(variant.required.includes("options"));
    assert.equal(variant.properties.options.type, "array");
    assert.equal(variant.properties.options.minItems, 4);
    assert.equal(variant.properties.options.maxItems, 4);
  }
  const diagnostic = studyGenerationSchema([source], true);
  assert.equal(diagnostic.properties.steps.minItems, 2);
  assert.equal(diagnostic.properties.steps.items.anyOf.length, 1);
  const scenario = diagnostic.properties.steps.items.anyOf[0];
  assert.deepEqual(scenario.properties.correctOption.enum, [0, 1, 2, 3]);
  assert.equal("expected" in scenario.properties, false);
});
test("diagnostic answer keys reference options by index and stay server-only", () => {
  const raw = diagnosisRaw();
  raw.steps = raw.steps.map(step => {
    const { expected, ...rest } = step;
    void expected;
    return { ...rest, options: ["Ignorar", " Registrar ", "Apagar", "Adivinhar"], correctOption: 1 };
  });
  const lesson = parseGeneratedStudy(raw, [source], true);
  assert.equal(lesson.steps[0].expected, "Registrar");
  assert.equal(lesson.steps[0].options[1], "Registrar");
  for (const step of publicLesson(lesson).steps) {
    assert.equal("correctOption" in step, false);
    assert.equal("expected" in step, false);
  }
  for (const invalid of [-1, 4, 1.5, "1", null]) {
    const broken = structuredClone(raw); broken.steps[0].correctOption = invalid;
    assert.throws(() => parseGeneratedStudy(broken, [source], true), /INVALID_ANSWER_KEY/);
  }
});
test("matching indices map exactly to alternatives; invalid references are rejected", () => {
  const raw = studyRaw();
  raw.steps[3] = { ...question(4), type: "match", items: [{ id: "observe", label: "Observação" }, { id: "record", label: "Registro" }], options: [" Coletar ", "Guardar", "Descartar", "Inventar"], expected: [{ itemId: "observe", optionIndex: 0 }, { itemId: "record", optionIndex: 1 }] };
  assert.deepEqual(parseGeneratedStudy(raw, [source], false).steps[3].expected, { observe: "Coletar", record: "Guardar" });
  raw.steps[3].expected[1].optionIndex = 4;
  assert.throws(() => parseGeneratedStudy(raw, [source], false), /INVALID_ANSWER_KEY/);
});
test("generated matching pairs adapt to the existing engine without weakening validation", () => {
  const raw = studyRaw();
  raw.steps[3] = { ...question(4), type: "match", items: [{ id: "observe", label: "Observação" }, { id: "record", label: "Registro" }], options: ["Coletar", "Guardar"], expected: [{ itemId: "observe", option: "Coletar" }, { itemId: "record", option: "Guardar" }] };
  const lesson = parseGeneratedStudy(raw, [source], false);
  assert.deepEqual(lesson.steps[3].expected, { observe: "Coletar", record: "Guardar" });
  const original = structuredClone(raw);
  raw.steps[3].expected[1].itemId = "observe";
  assert.throws(() => parseGeneratedStudy(raw, [source], false), /INVALID_ANSWER_KEY/);
  original.steps[3].expected[0].option = "Não existe";
  assert.throws(() => parseGeneratedStudy(original, [source], false), /INVALID_ANSWER_KEY/);
  assert.throws(() => parseGeneratedStudy({ ...studyRaw(), steps: studyRaw().steps.map(step => ({ ...step, quote: "Trecho que não aparece no material original." })) }, [source], false), /UNSUPPORTED_SOURCE/);
});
test("invalid citation, answer key, oversized text and cosmetic-only courses are rejected", () => {
  for (const mutate of [raw => raw.steps[0].quote = "Esta frase não aparece em nenhum material.", raw => raw.steps[1].expected = "Inventado", raw => raw.steps[0].instruction = "x".repeat(351), raw => raw.steps = [question(1), question(2), question(3), question(4)]]) {
    const raw = studyRaw(); mutate(raw); assert.throws(() => parseStudyLesson(raw, [source], false));
  }
});
test("diagnosis requires two distinct probes per concept, not one lucky answer", () => {
  const raw = diagnosisRaw(); raw.steps[1].instruction = raw.steps[0].instruction;
  assert.throws(() => parseStudyLesson(raw, [source], true));
  raw.steps = [question(1)]; assert.throws(() => parseStudyLesson(raw, [source], true));
});
test("diagnosis hides answers, source clues, hints and feedback until completion", () => {
  const lesson = parseStudyLesson(diagnosisRaw(), [source], true);
  for (const step of publicLesson(lesson).steps) for (const field of ["expected", "source", "hints", "explanation", "misconception"]) assert.equal(field in step, false);
  const answered = send(lesson, initialLessonState(), "answer", { answer: "Registrar" });
  assert.equal(feedbackFor(lesson, answered), null);
  assert.throws(() => send(lesson, answered, "hint", { reason: "example" }));
  assert.throws(() => send(lesson, answered, "retry"));
  assert.deepEqual(diagnosticLevels(lesson, answered), {});
});
test("unknown diagnosis answer is not a guess and starts with the base", () => {
  const lesson = parseStudyLesson(diagnosisRaw(), [source], true);
  let state = send(lesson, initialLessonState(), "unknown");
  assert.equal(state.evidence[lesson.steps[0].id].attempts[0].unknown, true);
  state = send(lesson, state, "next");
  state = send(lesson, state, "answer", { answer: "Registrar" });
  state = send(lesson, state, "next");
  assert.equal(diagnosticLevels(lesson, state)[source.concept], "base");
  assert.equal(summarizeLesson(lesson, state).rows[0].solution, "Registrar");
});
test("two independent correct answers select application; other concepts remain unknown", () => {
  const lesson = parseStudyLesson(diagnosisRaw(), [source], true);
  let state = initialLessonState();
  for (const step of lesson.steps) { state = send(lesson, state, "answer", { answer: step.expected }); state = send(lesson, state, "next"); }
  assert.deepEqual(diagnosticLevels(lesson, state), { [source.concept]: "application" });
  const full = parseStudyLesson(studyRaw(), [source], false);
  assert.equal(adaptStudyLesson(full, "base").steps.length, 4);
  assert.equal(adaptStudyLesson(full, "application").steps.length, 3);
  assert.ok(adaptStudyLesson(full, "application").steps.every(step => step.assessment));
});
test("checkpoint saves partial draft without adding an answer or advancing", () => {
  const lesson = parseStudyLesson(studyRaw(), [source], false);
  let state = send(lesson, initialLessonState(), "checkpoint", { answer: "" });
  state = send(lesson, state, "checkpoint", { answer: "Registrar" });
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(restored.index, 0); assert.equal(restored.checked, false); assert.equal(restored.draft, "Registrar");
  assert.equal(restored.evidence[lesson.steps[0].id].attempts.length, 0);
  state = send(lesson, restored, "answer", { answer: restored.draft });
  assert.equal(state.draft, undefined);
});
test("stale checkpoint cannot overwrite saved answer in another tab", () => {
  const lesson = parseStudyLesson(studyRaw(), [source], false);
  const saved = send(lesson, initialLessonState(), "answer", { answer: "Registrar" });
  assert.equal(transition(lesson, saved, { type: "checkpoint", revision: 0, answer: "Ignorar", seconds: 9 }), saved);
});
test("reload preserves answers, hints, retries and the exact next step", () => {
  const lesson = parseStudyLesson(studyRaw(), [source], false);
  let state = send(lesson, initialLessonState(), "hint", { reason: "example" });
  state = send(lesson, state, "answer", { answer: "Ignorar" });
  state = send(lesson, state, "retry"); state = send(lesson, state, "answer", { answer: "Registrar" });
  state = send(lesson, state, "next"); state = JSON.parse(JSON.stringify(state));
  assert.equal(state.index, 1); assert.equal(state.evidence[lesson.steps[0].id].attempts.length, 2);
  assert.deepEqual(state.evidence[lesson.steps[0].id].help, ["example"]);
});
test("normal entry delegates to persisted study; migrations never remove existing history", () => {
  const action = readFileSync(new URL("../src/app/actions.ts", import.meta.url), "utf8");
  const start = action.match(/export async function startGuidedSession[\s\S]*?\n\}/)[0];
  assert.match(start, /startMaterialStudy/); assert.doesNotMatch(start, /insert|tutorReply/);
  const sql = readFileSync(new URL("../migrations/0003_material_study.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /DROP|TRUNCATE|DELETE FROM/i);
  assert.match(sql, /active_key text UNIQUE/);
});
