"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserDb, owned, withOwner } from "@/db/user-db";
import { difficulties, disciplines, examTopics, exams, learningUnits, lessonAttempts, materials, microLessons, quizAttempts, quizQuestions, quizzes, reviews, studySessions, topics, tutorMessages } from "@/db/schema";
import { evaluateUnderstanding, generateCourseFromMaterial, generateQuizQuestions, suggestTopicsFromMaterial, tutorReply, type GeneratedQuestion } from "@/lib/ai";
import { assertStudyScope, findContext } from "@/lib/data";

const value = (form: FormData, key: string) => String(form.get(key) || "").trim();
const requireValue = (form: FormData, key: string) => { const result = value(form, key); if (!result) throw new Error(`Campo obrigatório: ${key}`); return result; };
const safeLocalPath = (candidate: string) => candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "";
const tutorQuery = (difficultyId: string, guided: boolean, focus: boolean, returnTo: string, error = "") => {
  const params = new URLSearchParams({ dificuldade: difficultyId });
  if (guided) params.set("guiada", "1");
  if (focus) params.set("foco", "1");
  if (returnTo) params.set("voltar", returnTo);
  if (error) params.set("erro", error);
  return `/estudar?${params}`;
};

export async function createDiscipline(form: FormData) {
  const { db, userId } = await getUserDb();

  const [row] = await db.insert(disciplines).values(withOwner(userId, { name: requireValue(form, "name").slice(0, 120), description: value(form, "description").slice(0, 1000) || null, semester: requireValue(form, "semester").slice(0, 40), color: value(form, "color") || "#5eead4", status: "ATIVA" })).returning({ id: disciplines.id });
  redirect(`/disciplinas/${row.id}`);
}

export async function createTopic(form: FormData) {
  const { db, userId } = await getUserDb();
    const disciplineId = requireValue(form, "disciplineId");
  await assertStudyScope(disciplineId);
  await db.insert(topics).values(withOwner(userId, { disciplineId, name: requireValue(form, "name").slice(0, 140), description: value(form, "description").slice(0, 600) || null }));
  revalidatePath(`/disciplinas/${disciplineId}`);
}

export async function updateTopicStatus(form: FormData) {
  const { db, userId } = await getUserDb();
    const id = requireValue(form, "topicId"); const status = requireValue(form, "status");
  const mastery = status === "DOMINADO" ? 90 : status === "REVISAR" ? 55 : status === "ESTUDANDO" ? 30 : 0;
  await db.update(topics).set({ status, mastery, updatedAt: new Date() }).where(owned(topics, userId, eq(topics.id, id))); revalidatePath("/disciplinas");
}

export async function deleteTopic(form: FormData) {
  const { db, userId } = await getUserDb();

  const topicId = requireValue(form, "topicId");
  const [topic] = await db.select({ disciplineId: topics.disciplineId }).from(topics).where(owned(topics, userId, eq(topics.id, topicId))).limit(1);
  if (!topic) return;
  await db.delete(topics).where(owned(topics, userId, eq(topics.id, topicId)));
  redirect(`/disciplinas/${topic.disciplineId}?topico=excluido`);
}

export async function createDifficulty(form: FormData) {
  await assertStudyScope(requireValue(form, "disciplineId"), requireValue(form, "topicId"));
  const { db, userId } = await getUserDb();
    const disciplineId = requireValue(form, "disciplineId"); const topicId = requireValue(form, "topicId"); const helpReason = value(form, "helpReason"); const report = `${requireValue(form, "report")}${helpReason ? `\n\nO que aconteceu: ${helpReason}` : ""}`.slice(0, 2500); const level = value(form, "level") || "NAO_ENTENDI"; const mode = value(form, "mode") || "DIAGNOSTICAR"; const focus = value(form, "focus") === "1"; const returnTo = safeLocalPath(value(form, "returnTo"));
  const [existing] = await db.select().from(difficulties).where(owned(difficulties, userId, and(eq(difficulties.topicId, topicId), eq(difficulties.status, "ABERTA")))).limit(1);
  let difficultyId: string;
  if (existing) { difficultyId = existing.id; await db.update(difficulties).set({ lastReport: report, level, occurrences: sql`${difficulties.occurrences} + 1`, updatedAt: new Date() }).where(owned(difficulties, userId, eq(difficulties.id, existing.id))); }
  else { const [created] = await db.insert(difficulties).values(withOwner(userId, { disciplineId, topicId, originalReport: report, lastReport: report, level })).returning({ id: difficulties.id }); difficultyId = created.id; }
  await db.insert(tutorMessages).values(withOwner(userId, { difficultyId, role: "USER", mode, content: report }));
  const [subject] = await db.select({ discipline: disciplines.name, topic: topics.name }).from(topics).innerJoin(disciplines, eq(topics.disciplineId, disciplines.id)).where(owned(topics, userId, eq(topics.id, topicId))).limit(1);
  const context = await findContext(disciplineId, topicId, report);
  let reply: string;
  try { reply = await tutorReply({ mode, discipline: subject?.discipline || "Disciplina", topic: subject?.topic || "Tópico", report, context }); }
  catch { redirect(tutorQuery(difficultyId, false, focus, returnTo, "tutor")); }
  await db.insert(tutorMessages).values(withOwner(userId, { difficultyId, role: "ASSISTANT", mode, content: reply }));
  await db.insert(studySessions).values(withOwner(userId, { disciplineId, topicId, activityType: "DIFICULDADE", result: level, note: report }));
  redirect(tutorQuery(difficultyId, false, focus, returnTo));
}

export async function startGuidedSession(form: FormData) {
  const { startMaterialStudy } = await import("@/app/study-actions");
  return startMaterialStudy(form);
}

export async function continueTutor(form: FormData) {
  const { db, userId } = await getUserDb();
    const difficultyId = requireValue(form, "difficultyId"); const report = requireValue(form, "message").slice(0, 2500); const mode = value(form, "mode") || "EXPLICAR"; const guided = value(form, "guided") === "1"; const focus = value(form, "focus") === "1"; const returnTo = safeLocalPath(value(form, "returnTo"));
  const [item] = await db.select({ difficulty: difficulties, discipline: disciplines.name, topic: topics.name }).from(difficulties).innerJoin(disciplines, eq(difficulties.disciplineId, disciplines.id)).innerJoin(topics, eq(difficulties.topicId, topics.id)).where(owned(difficulties, userId, eq(difficulties.id, difficultyId))).limit(1);
  if (!item) throw new Error("Dificuldade não encontrada");
  const history = await db.select().from(tutorMessages).where(owned(tutorMessages, userId, eq(tutorMessages.difficultyId, difficultyId))).orderBy(desc(tutorMessages.createdAt)).limit(8);
  await db.insert(tutorMessages).values(withOwner(userId, { difficultyId, role: "USER", mode, content: report }));
  const context = await findContext(item.difficulty.disciplineId, item.difficulty.topicId, report);
  let reply: string;
  try { reply = await tutorReply({ mode, discipline: item.discipline, topic: item.topic, report, context, recentMessages: history.reverse().map(({ role, mode: messageMode, content }) => ({ role, mode: messageMode, content })) }); }
  catch { redirect(tutorQuery(difficultyId, guided, focus, returnTo, "tutor")); }
  await db.insert(tutorMessages).values(withOwner(userId, { difficultyId, role: "ASSISTANT", mode, content: reply }));
  await db.update(difficulties).set({ lastReport: report, occurrences: sql`${difficulties.occurrences} + 1`, updatedAt: new Date() }).where(owned(difficulties, userId, eq(difficulties.id, difficultyId)));
  redirect(tutorQuery(difficultyId, guided, focus, returnTo));
}

export async function retryTutorResponse(form: FormData) {
  const { db, userId } = await getUserDb();

  const difficultyId = requireValue(form, "difficultyId");
  const guided = value(form, "guided") === "1";
  const focus = value(form, "focus") === "1";
  const returnTo = safeLocalPath(value(form, "returnTo"));
  const [item] = await db.select({ difficulty: difficulties, discipline: disciplines.name, topic: topics.name }).from(difficulties).innerJoin(disciplines, eq(difficulties.disciplineId, disciplines.id)).innerJoin(topics, eq(difficulties.topicId, topics.id)).where(owned(difficulties, userId, eq(difficulties.id, difficultyId))).limit(1);
  if (!item) throw new Error("Dificuldade não encontrada");
  const recent = await db.select().from(tutorMessages).where(owned(tutorMessages, userId, eq(tutorMessages.difficultyId, difficultyId))).orderBy(desc(tutorMessages.createdAt)).limit(12);
  const lastUser = recent.find((message) => message.role === "USER" && message.content.trim());
  if (!lastUser) redirect(tutorQuery(difficultyId, guided, focus, returnTo));
  const history = recent.filter((message) => message.id !== lastUser.id && message.content.trim()).reverse().slice(-8);
  const context = await findContext(item.difficulty.disciplineId, item.difficulty.topicId, lastUser.content);
  let reply: string;
  try { reply = await tutorReply({ mode: lastUser.mode || "EXPLICAR", discipline: item.discipline, topic: item.topic, report: lastUser.content, context, recentMessages: history.map(({ role, mode, content }) => ({ role, mode, content })) }); }
  catch { redirect(tutorQuery(difficultyId, guided, focus, returnTo, "tutor")); }
  await db.insert(tutorMessages).values(withOwner(userId, { difficultyId, role: "ASSISTANT", mode: lastUser.mode || "EXPLICAR", content: reply }));
  redirect(tutorQuery(difficultyId, guided, focus, returnTo));
}

export async function updateDifficultyStatus(form: FormData) {
  const { db, userId } = await getUserDb();
   const id = requireValue(form, "difficultyId"); const status = requireValue(form, "status"); await db.update(difficulties).set({ status, updatedAt: new Date() }).where(owned(difficulties, userId, eq(difficulties.id, id))); revalidatePath("/dificuldades");
}

export async function generateQuiz(form: FormData) {
  await assertStudyScope(requireValue(form, "disciplineId"), requireValue(form, "topicId"));
  const { db, userId } = await getUserDb();
    const disciplineId = requireValue(form, "disciplineId"); const topicId = requireValue(form, "topicId"); const count = value(form, "count") === "10" ? 10 : 5;
  const [subject] = await db.select({ discipline: disciplines.name, topic: topics.name }).from(topics).innerJoin(disciplines, eq(topics.disciplineId, disciplines.id)).where(owned(topics, userId, eq(topics.id, topicId))).limit(1);
  if (!subject) throw new Error("Tópico não encontrado");
  const context = await findContext(disciplineId, topicId, subject.topic);
  let generated: GeneratedQuestion[];
  try { generated = await generateQuizQuestions({ ...subject, count, context }); }
  catch { redirect("/estudar?erro=quiz"); }
  if (!generated.length) throw new Error("Não foi possível gerar questões válidas");
  const [quiz] = await db.insert(quizzes).values(withOwner(userId, { disciplineId, topicId, title: `Quiz: ${subject.topic}`, questionCount: generated.length })).returning({ id: quizzes.id });
  await db.insert(quizQuestions).values(withOwner(userId, generated.map((q) => ({ quizId: quiz.id, topicId, ...q }))));
  redirect(`/estudar?quiz=${quiz.id}`);
}

export async function submitQuiz(form: FormData) {
  const { db, userId } = await getUserDb();
  const [quiz] = await db.select().from(quizzes).where(owned(quizzes, userId, eq(quizzes.id, requireValue(form, "quizId")))).limit(1);
  if (!quiz) throw new Error("Quiz não encontrado");
    const quizId = requireValue(form, "quizId"); const questions = await db.select().from(quizQuestions).where(owned(quizQuestions, userId, eq(quizQuestions.quizId, quizId))); const answers: Record<string, string> = {}; const weaknesses: string[] = []; let correct = 0;
  for (const question of questions) { const answer = value(form, `q_${question.id}`); answers[question.id] = answer; if (answer === question.correctAnswer) correct++; else weaknesses.push(question.prompt); }
  const score = Math.round((correct / Math.max(questions.length, 1)) * 100);
  const [attempt] = await db.insert(quizAttempts).values(withOwner(userId, { quizId, score, correctCount: correct, total: questions.length, answers, weaknesses })).returning({ id: quizAttempts.id });
  if (quiz?.topicId) {
    const [topic] = await db.select().from(topics).where(owned(topics, userId, eq(topics.id, quiz.topicId))).limit(1);
    const mastery = Math.round((topic?.mastery || 0) * .55 + score * .45);
    const status = mastery >= 80 ? "DOMINADO" : mastery >= 50 ? "REVISAR" : "ESTUDANDO";
    await db.update(topics).set({ mastery, status, updatedAt: new Date() }).where(owned(topics, userId, eq(topics.id, quiz.topicId)));
    await db.insert(studySessions).values(withOwner(userId, { disciplineId: quiz.disciplineId, topicId: quiz.topicId, activityType: "QUIZ", durationMinutes: 10, result: `${score}%`, note: `${correct}/${questions.length} acertos` }));
    const [pendingReview] = await db.select({ id: reviews.id }).from(reviews).where(owned(reviews, userId, and(eq(reviews.topicId, quiz.topicId), eq(reviews.status, "PENDENTE")))).limit(1);
    if (!pendingReview) {
      const target = new Date();
      target.setDate(target.getDate() + (score < 50 ? 1 : score < 80 ? 3 : 7));
      await db.insert(reviews).values(withOwner(userId, { disciplineId: quiz.disciplineId, topicId: quiz.topicId, scheduledFor: target.toISOString().slice(0, 10) }));
    }
  }
  redirect(`/estudar?quiz=${quizId}&tentativa=${attempt.id}`);
}

export async function testUnderstanding(form: FormData) {
  await assertStudyScope(requireValue(form, "disciplineId"), requireValue(form, "topicId"));
  const { db, userId } = await getUserDb();
    const disciplineId = requireValue(form, "disciplineId"); const topicId = requireValue(form, "topicId"); const question = requireValue(form, "question").slice(0, 1000); const answer = requireValue(form, "answer").slice(0, 3000);
  const [subject] = await db.select({ discipline: disciplines.name, topic: topics.name }).from(topics).innerJoin(disciplines, eq(topics.disciplineId, disciplines.id)).where(owned(topics, userId, eq(topics.id, topicId))).limit(1); if (!subject) throw new Error("Tópico não encontrado");
  const context = await findContext(disciplineId, topicId, `${question} ${answer}`); let result: string;
  try { result = await evaluateUnderstanding({ mode: "ME_TESTAR", ...subject, report: question, answer, context }); }
  catch { redirect("/estudar?erro=entendimento"); }
  const [session] = await db.insert(studySessions).values(withOwner(userId, { disciplineId, topicId, activityType: "TESTE_ENTENDIMENTO", result: result.split(/[.\n]/)[0].slice(0, 80), note: `${question}\n\nSua resposta: ${answer}\n\nAvaliação: ${result}` })).returning({ id: studySessions.id });
  redirect(`/estudar?entendimento=${session.id}`);
}

export async function scheduleReview(form: FormData) {
  const { db, userId } = await getUserDb();
    const topicId = requireValue(form, "topicId"); const [topic] = await db.select().from(topics).where(owned(topics, userId, eq(topics.id, topicId))).limit(1); if (!topic) throw new Error("Tópico não encontrado"); let scheduledFor = value(form, "scheduledFor"); if (!scheduledFor) { const days = Number(value(form, "days") || 1); const target = new Date(); target.setDate(target.getDate() + days); scheduledFor = target.toISOString().slice(0, 10); }
  await db.insert(reviews).values(withOwner(userId, { disciplineId: topic.disciplineId, topicId, scheduledFor })); await db.update(topics).set({ status: "REVISAR", updatedAt: new Date() }).where(owned(topics, userId, eq(topics.id, topicId))); revalidatePath("/revisoes");
}

export async function completeReview(form: FormData) {
  const { db, userId } = await getUserDb();
    const reviewId = requireValue(form, "reviewId"); const [review] = await db.select().from(reviews).where(owned(reviews, userId, eq(reviews.id, reviewId))).limit(1); if (!review) return; await db.update(reviews).set({ status: "CONCLUIDA", completedAt: new Date() }).where(owned(reviews, userId, eq(reviews.id, reviewId))); await db.insert(studySessions).values(withOwner(userId, { disciplineId: review.disciplineId, topicId: review.topicId, activityType: "REVISAO", result: "CONCLUIDA" })); revalidatePath("/revisoes");
}

export async function rescheduleReview(form: FormData) {
  const { db, userId } = await getUserDb();  const id = requireValue(form, "reviewId"); const scheduledFor = requireValue(form, "scheduledFor"); await db.update(reviews).set({ scheduledFor, status: "PENDENTE", completedAt: null }).where(owned(reviews, userId, eq(reviews.id, id))); revalidatePath("/revisoes"); }

export async function createExam(form: FormData) {
  const { db, userId } = await getUserDb();
  const disciplineId = requireValue(form, "disciplineId");
  const topicIds = [...new Set(form.getAll("topicIds").map(String).filter(Boolean))];
  await assertStudyScope(disciplineId);
  for (const topicId of topicIds) await assertStudyScope(disciplineId, topicId);
  const exam = await db.transaction(async tx => {
    const [created] = await tx.insert(exams).values(withOwner(userId, { disciplineId, name: requireValue(form, "name").slice(0, 140), examDate: requireValue(form, "examDate"), notes: value(form, "notes").slice(0, 1000) || null })).returning({ id: exams.id });
    if (topicIds.length) await tx.insert(examTopics).values(withOwner(userId, topicIds.map(topicId => ({ examId: created.id, topicId }))));
    return created;
  });
  redirect(`/provas/${exam.id}`);
}

export async function organizeMaterial(form: FormData) {
  const { db, userId } = await getUserDb();

  const materialId = requireValue(form, "materialId");
  const [row] = await db.select({ material: materials, discipline: disciplines.name }).from(materials).innerJoin(disciplines, eq(materials.disciplineId, disciplines.id)).where(owned(materials, userId, eq(materials.id, materialId))).limit(1);
  if (!row) throw new Error("Material não encontrado");
  let suggestions: Awaited<ReturnType<typeof suggestTopicsFromMaterial>>;
  try {
    suggestions = await suggestTopicsFromMaterial({ discipline: row.discipline, title: row.material.title, content: row.material.content });
  } catch (error) {
    const reason = error instanceof Error && error.message === "AI_NOT_CONFIGURED" ? "sem_ia" : "erro";
    redirect(`/disciplinas/${row.material.disciplineId}?topicos=${reason}`);
  }
  const existing = await db.select({ name: topics.name }).from(topics).where(owned(topics, userId, eq(topics.disciplineId, row.material.disciplineId)));
  const normalize = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const names = new Set(existing.map((topic) => normalize(topic.name)));
  const fresh = suggestions.filter((topic) => {
    const key = normalize(topic.name);
    if (!key || names.has(key)) return false;
    names.add(key);
    return true;
  });
  if (fresh.length) await db.insert(topics).values(withOwner(userId, fresh.map((topic) => ({ disciplineId: row.material.disciplineId, name: topic.name, description: topic.description || null }))));
  redirect(`/disciplinas/${row.material.disciplineId}?topicos=${fresh.length}`);
}

export async function createLearningPath(form: FormData) {
  const { db, userId } = await getUserDb();

  const materialId = requireValue(form, "materialId");
  const [row] = await db.select({ material: materials, discipline: disciplines.name }).from(materials).innerJoin(disciplines, eq(materials.disciplineId, disciplines.id)).where(owned(materials, userId, eq(materials.id, materialId))).limit(1);
  if (!row) throw new Error("Material não encontrado");
  let generated: Awaited<ReturnType<typeof generateCourseFromMaterial>>;
  try { generated = await generateCourseFromMaterial({ discipline: row.discipline, title: row.material.title, content: row.material.content }); }
  catch (error) {
    const reason = error instanceof Error && error.message === "AI_NOT_CONFIGURED" ? "sem_ia" : "erro";
    redirect(`/disciplinas/${row.material.disciplineId}?trilha=${reason}`);
  }
  const existingTopics = await db.select().from(topics).where(owned(topics, userId, eq(topics.disciplineId, row.material.disciplineId)));
  const normalize = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const byName = new Map(existingTopics.map((topic) => [normalize(topic.name), topic]));
  await db.transaction(async (tx) => {
    await tx.delete(learningUnits).where(owned(learningUnits, userId, eq(learningUnits.materialId, materialId)));
    for (const [unitPosition, unit] of generated.entries()) {
      const [createdUnit] = await tx.insert(learningUnits).values(withOwner(userId, { disciplineId: row.material.disciplineId, materialId, title: unit.title, description: unit.description || null, position: unitPosition })).returning({ id: learningUnits.id });
      for (const [lessonPosition, lesson] of unit.lessons.entries()) {
        let topic = byName.get(normalize(lesson.title));
        if (!topic) {
          const [createdTopic] = await tx.insert(topics).values(withOwner(userId, { disciplineId: row.material.disciplineId, name: lesson.title, description: lesson.objective })).returning();
          topic = createdTopic;
          byName.set(normalize(lesson.title), topic);
        }
        await tx.insert(microLessons).values(withOwner(userId, { unitId: createdUnit.id, disciplineId: row.material.disciplineId, topicId: topic.id, title: lesson.title, objective: lesson.objective, position: lessonPosition, content: { explanation: lesson.explanation, example: lesson.example, cards: lesson.cards.map((card, index) => ({ ...card, id: `card-${index + 1}` })), checks: lesson.checks.map((check, index) => ({ ...check, id: `q${index + 1}` })) } }));
      }
    }
  });
  redirect(`/disciplinas/${row.material.disciplineId}?trilha=${generated.reduce((total, unit) => total + unit.lessons.length, 0)}`);
}

export async function completeMicroLesson(form: FormData) {
  const { db, userId } = await getUserDb();

  const lessonId = requireValue(form, "lessonId");
  const [lesson] = await db.select().from(microLessons).where(owned(microLessons, userId, eq(microLessons.id, lessonId))).limit(1);
  if (!lesson) throw new Error("Microaula não encontrada");
  const normalize = (answer: string) => answer.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const answers: Record<string, string> = {};
  let correct = 0;
  for (const check of lesson.content.checks) {
    const answer = value(form, `answer_${check.id}`);
    answers[check.id] = answer;
    if (normalize(answer) === normalize(check.correctAnswer)) correct++;
  }
  const total = lesson.content.checks.length;
  const score = Math.round((correct / Math.max(total, 1)) * 100);
  const [attempt] = await db.insert(lessonAttempts).values(withOwner(userId, { lessonId, score, correctCount: correct, total, answers })).returning({ id: lessonAttempts.id });
  if (lesson.topicId) {
    const [topic] = await db.select().from(topics).where(owned(topics, userId, eq(topics.id, lesson.topicId))).limit(1);
    const mastery = Math.round((topic?.mastery || 0) * .45 + score * .55);
    const status = score >= 70 ? "DOMINADO" : score >= 50 ? "REVISAR" : "ESTUDANDO";
    await db.update(topics).set({ mastery, status, updatedAt: new Date() }).where(owned(topics, userId, eq(topics.id, lesson.topicId)));
    const [pending] = await db.select({ id: reviews.id }).from(reviews).where(owned(reviews, userId, and(eq(reviews.topicId, lesson.topicId), eq(reviews.status, "PENDENTE")))).limit(1);
    if (!pending) {
      const target = new Date();
      target.setDate(target.getDate() + (score < 50 ? 1 : score < 80 ? 3 : 7));
      await db.insert(reviews).values(withOwner(userId, { disciplineId: lesson.disciplineId, topicId: lesson.topicId, scheduledFor: target.toISOString().slice(0, 10) }));
    }
  }
  await db.insert(studySessions).values(withOwner(userId, { disciplineId: lesson.disciplineId, topicId: lesson.topicId, activityType: "ESTUDO", durationMinutes: 8, result: `${score}%`, note: `Microaula: ${lesson.title} · ${correct}/${total} acertos` }));
  redirect(`/aulas/${lessonId}?tentativa=${attempt.id}`);
}

export async function deleteMaterial(form: FormData) {
  const { db, userId } = await getUserDb();

  const materialId = requireValue(form, "materialId");
  const [material] = await db.select({ disciplineId: materials.disciplineId }).from(materials).where(owned(materials, userId, eq(materials.id, materialId))).limit(1);
  if (!material) return;
  await db.delete(materials).where(owned(materials, userId, eq(materials.id, materialId)));
  redirect(`/disciplinas/${material.disciplineId}?material=excluido`);
}
