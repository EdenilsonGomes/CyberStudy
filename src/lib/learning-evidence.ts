import { and, eq } from "drizzle-orm";
import { createEmptyCard } from "ts-fsrs";
import type { getDb } from "../db/index";
import { owned, withOwner } from "../db/ownership.ts";
import { conceptProgress, flashcards, learningEvidence, topics } from "../db/schema.ts";
import { evidenceScore } from "./copilot.ts";
import { solutionLabel, type AuthoredLesson, type LessonState } from "./interactive-lesson.ts";
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
export async function recordLearningEvidence(tx: Tx, userId: string, sessionId: string, disciplineId: string, topicId: string | null, lesson: AuthoredLesson, state: LessonState) {
  const [claimed] = await tx.insert(learningEvidence).values(withOwner(userId, { sessionId })).onConflictDoNothing().returning();
  if (!claimed) return;
  const names = [...new Set(lesson.steps.filter(s => s.assessment).map(s => s.concept))];
  for (const name of names) {
    const steps = lesson.steps.filter(s => s.concept === name && s.assessment && state.evidence[s.id]?.attempts.length);
    if (!steps.length) continue;
    const first = steps.map(s => state.evidence[s.id].attempts[0]);
    const independent = first.filter(a => a.correct && !a.assisted).length;
    const assisted = steps.filter(s => !(state.evidence[s.id].attempts[0].correct && !state.evidence[s.id].attempts[0].assisted) && state.evidence[s.id].attempts.some(a => a.correct)).length;
    const errors = first.filter(a => !a.correct).length;
    const lastError = steps.filter(s => !state.evidence[s.id].attempts[0].correct).map(s => s.misconception).join(" ").slice(0, 1200) || null;
    const [linked] = topicId ? [] : await tx.select({ id: topics.id }).from(topics).where(owned(topics, userId, and(eq(topics.disciplineId, disciplineId), eq(topics.name, name)))).limit(1);
    const linkedId = topicId || linked?.id || null;
    await tx.insert(conceptProgress).values(withOwner(userId, { disciplineId, topicId: linkedId, name })).onConflictDoNothing();
    const [previous] = await tx.select().from(conceptProgress).where(owned(conceptProgress, userId, and(eq(conceptProgress.disciplineId, disciplineId), eq(conceptProgress.name, name)))).for("update");
    const score = evidenceScore(independent, steps.length, assisted);
    const mastery = previous.samples ? Math.round(previous.mastery * .35 + score * .65) : score;
    await tx.update(conceptProgress).set({ topicId: linkedId || previous.topicId, mastery, samples: previous.samples + steps.length, errors: previous.errors + errors, lastError: lastError || previous.lastError, updatedAt: new Date() }).where(owned(conceptProgress, userId, eq(conceptProgress.id, previous.id)));
    if (linkedId) await tx.update(topics).set({ mastery, status: lesson.mode !== "diagnostic" && mastery >= 80 && previous.samples + steps.length >= 3 ? "DOMINADO" : mastery < 70 ? "REVISAR" : "ESTUDANDO", updatedAt: new Date() }).where(owned(topics, userId, eq(topics.id, linkedId)));
    if (lesson.mode !== "diagnostic") {
      const step = steps.find(s => !state.evidence[s.id].attempts[0].correct) || steps[0];
      const schedule = createEmptyCard();
      const details = "items" in step ? step.items.map(i=>i.label).join(" · ") : "scene" in step ? step.scene.map(i=>`${i.label}: ${i.value}`).join(" · ") : "";
      await tx.insert(flashcards).values(withOwner(userId, { disciplineId, topicId: linkedId, sourceKey: `${disciplineId}:${name}`, front: `${step.title}\n${step.instruction}\n${details}${"options" in step ? `\n${step.options.join(" · ")}` : ""}`, back: `${solutionLabel(step)}\n\n${step.explanation}`, schedule, due: schedule.due })).onConflictDoNothing();
    }
  }
}
