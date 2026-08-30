"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { interactiveSessions, studySessions } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { binaryPilot } from "@/lib/pilot-lesson";
import { feedbackFor, hintFor, initialLessonState, summarizeLesson, transition, type LessonCommand } from "@/lib/interactive-lesson";

export async function startPilot() {
  await requireAuth();
  const [session] = await getDb().insert(interactiveSessions).values({
    lessonKey: binaryPilot.id, contentVersion: binaryPilot.version, state: initialLessonState(),
  }).returning({ id: interactiveSessions.id });
  redirect(`/aulas/piloto-binario?sessao=${session.id}`);
}

export async function runPilotCommand(sessionId: string, command: LessonCommand) {
  await requireAuth();
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !command || !Number.isInteger(command.revision)) {
    return { ok: false as const, error: "Sessão inválida. Reabra o piloto." };
  }
  try {
    const result = await getDb().transaction(async (tx) => {
      // Serialize concurrent tabs/retries. Stale revisions return the saved state without a second mutation.
      const [row] = await tx.select().from(interactiveSessions).where(and(eq(interactiveSessions.id, sessionId), eq(interactiveSessions.lessonKey, binaryPilot.id))).for("update");
      if (!row || row.contentVersion !== binaryPilot.version) throw new Error("Esta versão da aula não está disponível. Abra uma nova sessão.");
      const availableSeconds = Math.max(0, (Date.now() - row.updatedAt.getTime()) / 1000);
      const next = transition(binaryPilot, row.state, { ...command, seconds: Math.min(command.seconds, availableSeconds) });
      if (next !== row.state) {
        await tx.update(interactiveSessions).set({ state: next, updatedAt: new Date(), completedAt: next.completed ? new Date() : null }).where(eq(interactiveSessions.id, sessionId));
        if (next.completed) {
          const summary = summarizeLesson(binaryPilot, next);
          // Reuse the existing study history; PK guarantees one completion per session.
          await tx.insert(studySessions).values({ id: sessionId, activityType: "PILOTO_INTERATIVO",
            durationMinutes: Math.round(next.elapsedSeconds / 60),
            result: `${summary.independent}/${summary.total} sem ajuda · ${summary.assisted} com apoio`,
            note: `${binaryPilot.title}. Tempo em primeiro plano: ${next.elapsedSeconds}s. ${summary.reinforce.length ? `Reforçar: ${summary.reinforce.join(", ")}.` : "Praticado nesta sessão; não equivale a domínio duradouro."}`,
          }).onConflictDoNothing();
        }
      }
      return { state: next, feedback: feedbackFor(binaryPilot, next), hint: hintFor(binaryPilot, next), summary: next.completed ? summarizeLesson(binaryPilot, next) : null };
    });
    if (result.state.completed) {
      revalidatePath("/dashboard"); revalidatePath("/estudar"); revalidatePath("/progresso"); revalidatePath("/historico");
    }
    return { ok: true as const, ...result };
  } catch (error) {
    console.error("Falha na atividade interativa", error instanceof Error ? error.message : "unknown");
    return { ok: false as const, error: "Não foi possível salvar esta ação. Sua última etapa continua guardada. Confira a conexão e tente novamente." };
  }
}
