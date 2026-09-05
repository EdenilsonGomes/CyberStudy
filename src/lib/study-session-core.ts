// Server-derived identity is supplied by runStudyCommand; this is not a Server Action.
import { and, eq, lte } from "drizzle-orm";
import type { getDb } from "../db/index";
import { owned, withOwner } from "../db/ownership.ts";
import { interactiveSessions, reviews, studyPackages, studySessions } from "../db/schema.ts";
import { adaptStudyLesson } from "./study-contract.ts";
import { feedbackFor, hintFor, summarizeLesson, transition, type LessonCommand } from "./interactive-lesson.ts";
import { studyCoverageComplete } from "./trail.ts";
import { recordLearningEvidence } from "./learning-evidence.ts";

export async function applyStudyCommand(db: ReturnType<typeof getDb>, userId: string, sessionId: string, command: LessonCommand) {
  return db.transaction(async (tx) => {
      const [row] = await tx.select().from(interactiveSessions).where(owned(interactiveSessions, userId, eq(interactiveSessions.id, sessionId))).for("update");
      if (!row?.packageId) throw new Error("SESSION_NOT_FOUND");
      const [pack] = await tx.select().from(studyPackages).where(owned(studyPackages, userId, eq(studyPackages.id, row.packageId))).limit(1);
      if (!pack?.content) throw new Error("CONTENT_NOT_FOUND");
      const lesson = adaptStudyLesson(pack.content, row.level === "application" ? "application" : "base");
      const next = transition(lesson, row.state, { ...command, seconds: Math.min(command.seconds, Math.max(0, (Date.now() - row.updatedAt.getTime()) / 1000)) });
      if (next !== row.state) {
        const finished = studyCoverageComplete(lesson, next);
        await tx.update(interactiveSessions).set({ state: next, updatedAt: new Date(), completedAt: row.completedAt || (finished ? new Date() : null), activeKey: row.completedAt || finished ? null : row.activeKey }).where(owned(interactiveSessions, userId, eq(interactiveSessions.id, sessionId)));
        if (finished && !row.completedAt) await recordLearningEvidence(tx, userId, sessionId, pack.disciplineId, pack.topicId, lesson, next);
        if (finished && !row.completedAt && pack.kind === "study") {
          const summary = summarizeLesson(lesson, next);
          await tx.insert(studySessions).values(withOwner(userId, { id: sessionId, disciplineId: pack.disciplineId, topicId: pack.topicId, activityType: "AULA_INTERATIVA", durationMinutes: Math.round(next.elapsedSeconds / 60), result: `${summary.independent}/${summary.total} sem ajuda · ${summary.assisted} com apoio`, note: `${lesson.title}. Reforçar: ${summary.reinforce.join(", ") || "verificar retenção outro dia"}.` })).onConflictDoNothing();
          if (pack.topicId) {
            const today = new Date().toISOString().slice(0, 10);
            await tx.update(reviews).set({ status: "CONCLUIDA", completedAt: new Date() }).where(owned(reviews, userId, and(eq(reviews.topicId, pack.topicId), eq(reviews.status, "PENDENTE"), lte(reviews.scheduledFor, today))));
            const date = new Date(); date.setUTCDate(date.getUTCDate() + (summary.reinforce.length ? 1 : 3));
            const scheduledFor = date.toISOString().slice(0, 10);
            const [scheduled] = await tx.select({ id: reviews.id }).from(reviews).where(owned(reviews, userId, and(eq(reviews.topicId, pack.topicId), eq(reviews.status, "PENDENTE"), eq(reviews.scheduledFor, scheduledFor)))).limit(1);
            if (!scheduled) await tx.insert(reviews).values(withOwner(userId, { disciplineId: pack.disciplineId, topicId: pack.topicId, scheduledFor }));
          }
        }
      }
      return { applied: next !== row.state, state: next, feedback: feedbackFor(lesson, next), hint: hintFor(lesson, next), summary: next.completed ? summarizeLesson(lesson, next) : null };
    });
}
