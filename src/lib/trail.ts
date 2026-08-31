// Completion is coverage, never a claim of mastery. Reviews do not change ordering.
type Topic = { id: string; name: string; status: string; materialId: string | null; position: number; createdAt: Date };
type Material = { id: string; title: string; createdAt: Date };
type Unit = { id: string; materialId: string | null; title: string; position: number; createdAt: Date };
type Lesson = { id: string; unitId: string; topicId: string | null; title: string; position: number };
type Completion = { lessonId: string | null; topicId: string | null };
export type TrailStep = { key: string; title: string; topicId: string | null; lessonId: string | null; done: boolean; reinforce: boolean; href: string };
export type TrailUnit = { id: string; title: string; materialId: string | null; steps: TrailStep[]; done: boolean };

export function trailStepFor(steps: TrailStep[], target: { key: string; topicId: string | null }) {
  return steps.find(s => s.key === target.key) || steps.find(s => s.topicId && s.topicId === target.topicId && !s.done) || steps.find(s => s.topicId && s.topicId === target.topicId);
}

export function buildTrail(input: { topics: Topic[]; materials: Material[]; units: Unit[]; lessons: Lesson[]; completed: Completion[]; attempts: { lessonId: string }[] }) {
  const finishedLessons = new Set([...input.completed.flatMap(c => c.lessonId ? [c.lessonId] : []), ...input.attempts.map(a => a.lessonId)]);
  const finishedTopics = new Set(input.completed.filter(c => !c.lessonId && c.topicId).map(c => c.topicId));
  const topics = new Map(input.topics.map(t => [t.id, t]));
  const linkedTopics = new Set(input.lessons.map(l => l.topicId));
  const groups: TrailUnit[] = [...input.materials].sort((a, b) => +a.createdAt - +b.createdAt || a.id.localeCompare(b.id)).map(m => ({ id: m.id, materialId: m.id, title: m.title, steps: [], done: false }));
  const legacy: TrailUnit = { id: "legacy", materialId: null, title: "Conteúdo já cadastrado", steps: [], done: false };
  const groupFor = (materialId: string | null) => groups.find(g => g.materialId === materialId) || legacy;
  for (const unit of [...input.units].sort((a, b) => a.position - b.position || +a.createdAt - +b.createdAt || a.id.localeCompare(b.id))) {
    for (const lesson of input.lessons.filter(l => l.unitId === unit.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))) {
      const topic = lesson.topicId ? topics.get(lesson.topicId) : undefined;
      // A historical topic session covers a lesson only when the mapping is unambiguous.
      const soleLesson = lesson.topicId && input.lessons.filter(l => l.topicId === lesson.topicId).length === 1;
      groupFor(unit.materialId).steps.push({ key: `study:${lesson.id}`, lessonId: lesson.id, topicId: lesson.topicId, title: lesson.title, done: finishedLessons.has(lesson.id) || Boolean(soleLesson && finishedTopics.has(lesson.topicId)), reinforce: topic?.status === "REVISAR", href: `/estudar/iniciar?aula=${lesson.id}` });
    }
  }
  for (const topic of [...input.topics].sort((a, b) => a.position - b.position || +a.createdAt - +b.createdAt || a.id.localeCompare(b.id))) {
    if (linkedTopics.has(topic.id)) continue;
    groupFor(topic.materialId).steps.push({ key: `study:${topic.id}`, lessonId: null, topicId: topic.id, title: topic.name, done: finishedTopics.has(topic.id) || topic.status === "DOMINADO", reinforce: topic.status === "REVISAR", href: `/estudar/iniciar?topico=${topic.id}` });
  }
  if (legacy.steps.length) groups.unshift(legacy);
  for (const group of groups) group.done = group.steps.length > 0 && group.steps.every(s => s.done);
  const steps = groups.flatMap(g => g.steps);
  const currentUnit = groups.find(g => !g.done);
  const next = currentUnit?.steps.find(s => !s.done);
  return { groups, steps, next, currentUnit, completed: steps.filter(s => s.done).length, total: steps.length, done: groups.length > 0 && groups.every(g => g.done) };
}

export function studyCoverageComplete(lesson: { mode?: string; steps: { id: string }[] }, state: { completed: boolean; checked: boolean; index: number; evidence: Record<string, { attempts: unknown[] }> }) {
  if (state.completed) return true;
  return lesson.mode !== "diagnostic" && lesson.steps.length > 0 && state.checked && state.index === lesson.steps.length - 1 && lesson.steps.every(step => state.evidence[step.id]?.attempts.length > 0);
}
