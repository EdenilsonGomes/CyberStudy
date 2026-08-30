import test from "node:test";
import assert from "node:assert/strict";
import { binaryPilot } from "../src/lib/pilot-lesson.ts";
import { feedbackFor, hintFor, initialLessonState, publicLesson, summarizeLesson, transition, validateAnswer, validateDraft } from "../src/lib/interactive-lesson.ts";

const send = (state, type, fields = {}) => transition(binaryPilot, state, { revision: state.revision, type, seconds: 3, ...fields });
const finishExplore = () => send(send(initialLessonState(), "answer", { answer: "1001" }), "next");

test("public activities contain no answer keys, feedback or hidden hints", () => {
  for (const step of publicLesson(binaryPilot).steps) {
    for (const key of ["expected", "explanation", "misconception", "feedbackByAnswer", "hints"]) assert.equal(key in step, false);
  }
});
test("cannot skip an unanswered step or submit an invalid activity", () => {
  assert.throws(() => send(initialLessonState(), "next"));
  assert.throws(() => send(initialLessonState(), "answer", { answer: "2222" }));
  assert.throws(() => send(initialLessonState(), "answer", { answer: { score: 100 } }));
});
test("wrong choice produces specific feedback, not immediate advancement", () => {
  const state = send(finishExplore(), "answer", { answer: "2" });
  assert.equal(state.index, 1); assert.equal(state.checked, true);
  assert.match(feedbackFor(binaryPilot, state).explanation, /contou dois bits/);
});
test("retry preserves first answer and cannot inflate independent accuracy", () => {
  const original = send(finishExplore(), "answer", { answer: "2" });
  const retry = send(original, "retry");
  const corrected = send(retry, "answer", { answer: "10" });
  assert.equal(original.evidence.predict.attempts.length, 1);
  assert.deepEqual(corrected.evidence.predict.attempts.map((item) => item.answer), ["2", "10"]);
  assert.equal(summarizeLesson(binaryPilot, corrected).independent, 0);
  assert.equal(summarizeLesson(binaryPilot, corrected).assisted, 1);
});
test("help stays contextual and a first correct answer after a hint is assisted", () => {
  let state = send(finishExplore(), "hint", { reason: "example" });
  const firstHint = hintFor(binaryPilot, state).text;
  state = send(state, "hint", { reason: "example" });
  assert.notEqual(hintFor(binaryPilot, state).text, firstHint);
  assert.equal(state.index, 1);
  state = send(state, "answer", { answer: "10" });
  assert.equal(summarizeLesson(binaryPilot, state).assisted, 1);
  assert.equal(summarizeLesson(binaryPilot, state).independent, 0);
});
test("invalid help reasons and invalid order/matches are rejected", () => {
  assert.throws(() => send(initialLessonState(), "hint", { reason: "__proto__" }));
  assert.equal(validateAnswer(binaryPilot.steps[3], ["one", "one", "one", "one"]), false);
  assert.equal(validateAnswer(binaryPilot.steps[2], { eleven: "3", one: "1" }), false);
  assert.equal(validateAnswer(binaryPilot.steps[2], { eleven: "3", one: "1", ten: "99" }), false);
});
test("duplicate/stale command cannot add a second answer or advance twice", () => {
  const initial = initialLessonState();
  const command = { revision: 0, type: "answer", answer: "1001", seconds: 3 };
  const saved = transition(binaryPilot, initial, command);
  assert.equal(transition(binaryPilot, saved, command), saved);
});
test("complete lesson is serializable and separates exploration from assessment", () => {
  let state = initialLessonState();
  for (const step of binaryPilot.steps) {
    state = send(state, "answer", { answer: step.expected });
    state = JSON.parse(JSON.stringify(state)); // Database/reload roundtrip.
    assert.equal(feedbackFor(binaryPilot, state).correct, true);
    state = send(state, "next");
  }
  assert.equal(state.completed, true);
  const summary = summarizeLesson(binaryPilot, state);
  assert.equal(summary.total, 5); assert.equal(summary.independent, 5);
  assert.deepEqual(summary.reinforce, []);
  assert.equal(send(state, "next"), state);
});
test("elapsed time clamps malformed and unbounded durations", () => {
  assert.equal(send(initialLessonState(), "hint", { reason: "term", seconds: Infinity }).elapsedSeconds, 0);
  assert.equal(send(initialLessonState(), "hint", { reason: "term", seconds: 99999 }).elapsedSeconds, 120);
  assert.equal(send(initialLessonState(), "hint", { reason: "term", seconds: -5 }).elapsedSeconds, 0);
});
test("interaction templates also accept non-computing content", () => {
  const generic = structuredClone(binaryPilot);
  generic.steps = [{ ...binaryPilot.steps[3], id: "process", title: "Organize o processo", items: [{ id: "observe", label: "Observar" }, { id: "record", label: "Registrar" }], expected: ["observe", "record"] }];
  const state = transition(generic, initialLessonState(), { revision: 0, type: "answer", answer: ["observe", "record"], seconds: 1 });
  assert.equal(feedbackFor(generic, state).correct, true);
});

test("corrupt local drafts cannot crash matching or ordering", () => {
  for (const step of binaryPilot.steps) {
    assert.equal(validateDraft(step, null), false);
    assert.equal(validateDraft(step, 42), false);
  }
  assert.equal(validateDraft(binaryPilot.steps[3], ["eight", "four"]), true);
  assert.equal(validateDraft(binaryPilot.steps[3], ["eight", "eight"]), false);
  assert.equal(validateDraft(binaryPilot.steps[2], { eleven: "3" }), true);
  assert.equal(validateDraft(binaryPilot.steps[2], { invalid: "3" }), false);
});

test("authored answer keys agree with positional arithmetic", () => {
  for (const step of binaryPilot.steps) {
    if (step.type === "switches") assert.equal(Number.parseInt(step.expected, 2), step.target);
    if (step.type === "choice") assert.equal(Number.parseInt(step.pattern, 2), Number(step.expected));
    assert.equal(validateAnswer(step, step.expected), true);
  }
});
