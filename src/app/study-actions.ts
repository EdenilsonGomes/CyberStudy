"use server";

import { and, eq, isNull, lt, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserDb, owned, withOwner } from "@/db/user-db";
import { interactiveSessions, studyPackages } from "@/db/schema";
import { generateInteractiveStudy } from "@/lib/ai";
import { activeStudy, levelFor, resolveStudyTarget } from "@/lib/study";
import { initialLessonState, type LessonCommand } from "@/lib/interactive-lesson";
import { uuidPattern } from "@/lib/study-contract";
import { generationErrorCode } from "@/lib/generation-error";
import { trailStepFor } from "@/lib/trail";
import { applyStudyCommand } from "@/lib/study-session-core";
import { loadTrail } from "@/lib/trail-data";

export async function startMaterialStudy(form: FormData) {
  const { db, userId } = await getUserDb();

  const value = (key: string) => String(form.get(key) || "");
  const target = await resolveStudyTarget({ topicId: value("topicId"), lessonId: value("lessonId"), disciplineId: value("disciplineId"), diagnostic: value("diagnostic") === "1" });
  if (!target) redirect("/disciplinas");
  if (!target.diagnostic && value("review") !== "1") {
    const trail = await loadTrail(target.disciplineId);
    const step = trailStepFor(trail.steps, target);
    if (step?.done) redirect(`/disciplinas/${target.disciplineId}/continuar?de=${encodeURIComponent(step.key)}`);
    if (step && step.key !== trail.next?.key) redirect(`/disciplinas/${target.disciplineId}`);
    if (step && step.key !== target.key) redirect(trail.href);
  }
  const active = await activeStudy(target.key);
  if (active) redirect(`/estudar/sessao/${active.session.id}`);
  const params = new URLSearchParams(target.diagnostic ? { disciplina: target.disciplineId, diagnostico: "1" } : target.lessonId ? { aula: target.lessonId } : { topico: target.topicId! });
  if (value("review") === "1") params.set("revisao", "1");
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
    const result = await applyStudyCommand(db, userId, sessionId, command);
    revalidatePath("/dashboard");
    revalidatePath("/revisoes"); revalidatePath("/progresso"); revalidatePath("/historico"); revalidatePath("/disciplinas", "layout");
    return { ok: true as const, ...result };
  } catch (error) {
    console.error("Falha no checkpoint de estudo", error instanceof Error ? error.message : "unknown");
    return { ok: false as const, error: "Não foi possível salvar. Tente novamente ou recarregue para recuperar a última etapa confirmada." };
  }
}
