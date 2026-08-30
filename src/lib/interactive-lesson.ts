// Small, subject-independent activity contract. Answers and hints stay on the server.
export type Answer = string | string[] | Record<string, string>;
export type HelpReason = "explanation" | "purpose" | "term" | "example" | "lost";
export const helpReasons: Record<HelpReason, string> = {
  explanation: "Não entendi a explicação", purpose: "Por que isso importa?",
  term: "Não entendi um termo", example: "Quero um exemplo", lost: "Estou completamente perdido",
};
type StepBase = { id: string; title: string; instruction: string; concept: string; assessment: boolean };
export type Activity = StepBase & (
  | { type: "switches"; weights: number[]; target: number; showTotal: boolean }
  | { type: "choice"; pattern: string; weights: number[]; options: string[] }
  | { type: "match"; items: { id: string; label: string }[]; options: string[] }
  | { type: "order"; items: { id: string; label: string }[] }
);
export type AuthoredActivity = Activity & {
  expected: Answer; explanation: string; misconception: string;
  feedbackByAnswer?: Record<string, string>;
  hints: Record<HelpReason, [string, string]>;
};
export type InteractiveLesson = { id: string; version: number; title: string; objective: string; steps: Activity[] };
export type AuthoredLesson = Omit<InteractiveLesson, "steps"> & { steps: AuthoredActivity[] };
export type ResponseEvidence = { attempts: { answer: Answer; correct: boolean; assisted: boolean }[]; help: HelpReason[] };
export type LessonState = {
  revision: number; index: number; checked: boolean; elapsedSeconds: number;
  evidence: Record<string, ResponseEvidence>; completed: boolean;
};
export type LessonCommand = { revision: number; type: "answer" | "hint" | "retry" | "next"; answer?: Answer; reason?: HelpReason; seconds: number };
export type LessonFeedback = { correct: boolean; explanation: string; solution: string };
export const initialLessonState = (): LessonState => ({ revision: 0, index: 0, checked: false, elapsedSeconds: 0, evidence: {}, completed: false });

export function publicLesson(lesson: AuthoredLesson): InteractiveLesson {
  return { ...lesson, steps: lesson.steps.map((step) => {
    const { expected, explanation, misconception, feedbackByAnswer, hints, ...activity } = step;
    void expected; void explanation; void misconception; void feedbackByAnswer; void hints;
    return activity;
  }) };
}

export function validateAnswer(step: Activity, answer: unknown): answer is Answer {
  if (step.type === "choice") return typeof answer === "string" && step.options.includes(answer);
  if (step.type === "switches") return typeof answer === "string" && new RegExp(`^[01]{${step.weights.length}}$`).test(answer);
  if (step.type === "order") return Array.isArray(answer) && answer.length === step.items.length && new Set(answer).size === step.items.length && answer.every((id) => step.items.some((item) => item.id === id));
  return typeof answer === "object" && answer !== null && !Array.isArray(answer)
    && Object.keys(answer).length === step.items.length
    && step.items.every((item) => step.options.includes((answer as Record<string, string>)[item.id]));
}

export function validateDraft(step: Activity, answer: unknown): answer is Answer {
  if (step.type === "order") return Array.isArray(answer) && answer.length <= step.items.length && new Set(answer).size === answer.length && answer.every((id) => step.items.some((item) => item.id === id));
  if (step.type === "match") return typeof answer === "object" && answer !== null && !Array.isArray(answer) && Object.entries(answer).every(([key, value]) => step.items.some((item) => item.id === key) && (value === "" || step.options.includes(value)));
  return validateAnswer(step, answer);
}

export function isCorrectAnswer(step: AuthoredActivity, answer: Answer) {
  if (step.type === "match") return step.items.every((item) => (answer as Record<string, string>)[item.id] === (step.expected as Record<string, string>)[item.id]);
  return JSON.stringify(answer) === JSON.stringify(step.expected);
}

export function solutionLabel(step: AuthoredActivity) {
  if (step.type === "match") return step.items.map((item) => `${item.label} → ${(step.expected as Record<string, string>)[item.id]}`).join(" · ");
  if (step.type === "order") return (step.expected as string[]).map((id) => step.items.find((item) => item.id === id)?.label).join(" → ");
  return String(step.expected);
}

export function feedbackFor(lesson: AuthoredLesson, state: LessonState): LessonFeedback | null {
  const step = lesson.steps[state.index];
  const attempts = state.evidence[step?.id]?.attempts;
  const last = attempts?.[attempts.length - 1];
  if (!state.checked || !step || !last) return null;
  return { correct: last.correct, solution: solutionLabel(step), explanation: last.correct ? step.explanation : (typeof last.answer === "string" && step.feedbackByAnswer?.[last.answer]) || step.misconception };
}

export function hintFor(lesson: AuthoredLesson, state: LessonState) {
  const step = lesson.steps[state.index];
  const help = state.evidence[step?.id]?.help || [];
  const reason = help[help.length - 1];
  if (!step || !reason) return null;
  return { reason, text: step.hints[reason][Math.min(help.filter((entry) => entry === reason).length - 1, 1)], level: help.filter((entry) => entry === reason).length };
}

// Pure transition, shared by the server and regression tests. The client never supplies a score.
export function transition(lesson: AuthoredLesson, previous: LessonState, command: LessonCommand): LessonState {
  if (command.revision !== previous.revision || previous.completed) return previous;
  const step = lesson.steps[previous.index];
  if (!step) throw new Error("Etapa inválida");
  const state = structuredClone(previous);
  const evidence = state.evidence[step.id] ??= { attempts: [], help: [] };
  switch (command.type) {
    case "answer":
      if (state.checked || !validateAnswer(step, command.answer)) throw new Error("Complete a atividade antes de responder.");
      if (evidence.attempts.length >= 20) throw new Error("Continue para o próximo desafio ou consulte a explicação.");
      evidence.attempts.push({ answer: command.answer, correct: isCorrectAnswer(step, command.answer), assisted: evidence.help.length > 0 || evidence.attempts.length > 0 });
      state.checked = true;
      break;
    case "hint":
      if (!command.reason || !Object.hasOwn(helpReasons, command.reason)) throw new Error("Escolha uma dúvida.");
      if (evidence.help.length >= 30) throw new Error("As pistas desta etapa já foram consultadas. Tente a atividade.");
      evidence.help.push(command.reason);
      break;
    case "retry":
      if (!state.checked || evidence.attempts.at(-1)?.correct) throw new Error("Não há resposta para tentar novamente.");
      state.checked = false;
      break;
    case "next":
      if (!state.checked || !evidence.attempts.length) throw new Error("Responda antes de avançar.");
      state.index++;
      state.checked = false;
      state.completed = state.index === lesson.steps.length;
      break;
    default: throw new Error("Ação inválida");
  }
  state.elapsedSeconds += Number.isFinite(command.seconds) ? Math.max(0, Math.min(120, Math.round(command.seconds))) : 0;
  state.revision++;
  return state;
}

export function summarizeLesson(lesson: AuthoredLesson, state: LessonState) {
  const rows = lesson.steps.map((step) => {
    const evidence = state.evidence[step.id];
    const first = evidence?.attempts[0];
    const independent = Boolean(first?.correct && !first.assisted);
    const corrected = Boolean(evidence?.attempts.some((attempt) => attempt.correct));
    return { id: step.id, title: step.title, concept: step.concept, assessment: step.assessment,
      independent, corrected, attempts: evidence?.attempts.length || 0, hints: evidence?.help.length || 0 };
  });
  const checks = rows.filter((row) => row.assessment);
  return { rows, independent: checks.filter((row) => row.independent).length, total: checks.length,
    assisted: checks.filter((row) => !row.independent && row.corrected).length,
    reinforce: [...new Set(checks.filter((row) => !row.independent).map((row) => row.concept))] };
}
