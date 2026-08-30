"use server";

import { and, eq, isNull, lt, lte, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserDb, owned, withOwner } from "@/db/user-db";
import { interactiveSessions, reviews, studyPackages, studySessions, topics } from "@/db/schema";
import { generateInteractiveStudy } from "@/lib/ai";
import { activeStudy, levelFor, resolveStudyTarget, sessionLesson } from "@/lib/study";
import { feedbackFor, hintFor, initialLessonState, summarizeLesson, transition, type LessonCommand } from "@/lib/interactive-lesson";
import { uuidPattern } from "@/lib/study-contract";
import { generationErrorCode } from "@/lib/generation-error";

export async function startMaterialStudy(form: FormData) {
  const { db, userId } = await getUserDb();

  const value = (key: string) => String(form.get(key) || "");
  const target = await resolveStudyTarget({ topicId: value("topicId"), lessonId: value("lessonId"), disciplineId: value("disciplineId"), diagnostic: value("diagnostic") === "1" });
  if (!target) redirect("/disciplinas");
  const active = await activeStudy(target.key);
  if (active) redirect(`/estudar/sessao/${active.session.id}`);
  const params = new URLSearchParams(target.diagnostic ? { disciplina: target.disciplineId, diagnostico: "1" } : target.lessonId ? { aula: target.lessonId } : { topico: target.topicId! });
  const fail = (error: string): never => redirect(`/estudar/iniciar?${params}&erro=${error}`);
  if (!target.sources.length) fail("material");

  let [pack] = await db.insert(studyPackages).values(withOwner(userId, { cacheKey: target.cacheKey, kind: target.diagnostic ? "diagnostic" : "study", disciplineId: target.disciplineId, topicId: target.topicId, lessonId: target.lessonId })).onConflictDoNothing().returning();
  let ownsGeneration = Boolean(pack);
  if (!pack) {
    [pack] = await db.select().from(studyPackages).where(owned(studyPackages, userId, eq(studyPackages.cacheKey, target.cacheKey))).limit(1);
    if (!pack.content) {
      const [claimed] = await db.update(studyPackages).set({ error: null, updatedAt: new Date() }).where(owned(studyPackages, userId, and(eq(studyPackages.id, pack.id), isNull(studyPackages.content), or(eq(studyPackages.error, "generation"), lt(studyPackages.updatedAt, new Date(Date.now() - 180_000)))))).returning();
      ownsGeneration = Boolean(claimed);
      if (!ownsGeneration) fail("preparando");
    }
  }
  if (!pack.content && ownsGeneration) {
    try {
      const content = await generateInteractiveStudy({ title: target.title, sources: target.sources, diagnostic: target.diagnostic });
      [pack] = await db.update(studyPackages).set({ content, error: null, updatedAt: new Date() }).where(owned(studyPackages, userId, eq(studyPackages.id, pack.id))).returning();
    } catch (error) {
      console.error("Falha ao preparar aula estruturada", error instanceof Error ? error.message : "unknown");
      await db.update(studyPackages).set({ error: "generation", updatedAt: new Date() }).where(owned(studyPackages, userId, eq(studyPackages.id, pack.id)));
      fail(`geracao_${generationErrorCode(error)}`);
    }
  }
  const level = target.diagnostic || value("base") === "1" ? "base" : await levelFor(target);
  const [created] = await db.insert(interactiveSessions).values(withOwner(userId, { lessonKey: target.key, packageId: pack.id, activeKey: target.key, contentVersion: 1, state: initialLessonState(), level })).onConflictDoNothing().returning();
  const sessionId = created?.id || (await activeStudy(target.key))?.session.id;
  if (!sessionId) fail("preparando");
  revalidatePath("/dashboard");
  redirect(`/estudar/sessao/${sessionId}`);
}

export async function runStudyCommand(sessionId: string, command: LessonCommand) {
  const { db, userId } = await getUserDb();

  if (!uuidPattern.test(sessionId) || !command || !Number.isInteger(command.revision)) return { ok: false as const, error: "Sessão inválida." };
  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(interactiveSessions).where(owned(interactiveSessions, userId, eq(interactiveSessions.id, sessionId))).for("update");
      if (!row?.packageId) throw new Error("SESSION_NOT_FOUND");
      const [pack] = await tx.select().from(studyPackages).where(owned(studyPackages, userId, eq(studyPackages.id, row.packageId))).limit(1);
      if (!pack?.content) throw new Error("CONTENT_NOT_FOUND");
      const lesson = sessionLesson(row, pack.content);
      const next = transition(lesson, row.state, { ...command, seconds: Math.min(command.seconds, Math.max(0, (Date.now() - row.updatedAt.getTime()) / 1000)) });
      if (next !== row.state) {
        await tx.update(interactiveSessions).set({ state: next, updatedAt: new Date(), completedAt: next.completed ? new Date() : null, activeKey: next.completed ? null : row.activeKey }).where(owned(interactiveSessions, userId, eq(interactiveSessions.id, sessionId)));
        if (next.completed && pack.kind === "study") {
          const summary = summarizeLesson(lesson, next);
          await tx.insert(studySessions).values(withOwner(userId, { id: sessionId, disciplineId: pack.disciplineId, topicId: pack.topicId, activityType: "AULA_INTERATIVA", durationMinutes: Math.round(next.elapsedSeconds / 60), result: `${summary.independent}/${summary.total} sem ajuda · ${summary.assisted} com apoio`, note: `${lesson.title}. Reforçar: ${summary.reinforce.join(", ") || "verificar retenção outro dia"}.` })).onConflictDoNothing();
          if (pack.topicId) {
            await tx.update(topics).set({ status: summary.reinforce.length ? "REVISAR" : "ESTUDANDO", updatedAt: new Date() }).where(owned(topics, userId, eq(topics.id, pack.topicId)));
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
    revalidatePath("/dashboard");
    if (result.state.completed) { revalidatePath("/revisoes"); revalidatePath("/progresso"); revalidatePath("/historico"); revalidatePath("/disciplinas", "layout"); }
    return { ok: true as const, ...result };
  } catch (error) {
    console.error("Falha no checkpoint de estudo", error instanceof Error ? error.message : "unknown");
    return { ok: false as const, error: "Não foi possível salvar. Tente novamente ou recarregue para recuperar a última etapa confirmada." };
  }
}
