"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { difficulties, disciplines, examTopics, exams, quizAttempts, quizQuestions, quizzes, reviews, studySessions, topics, tutorMessages } from "@/db/schema";
import { evaluateUnderstanding, generateQuizQuestions, tutorReply } from "@/lib/ai";
import { findContext } from "@/lib/data";
import { requireAuth } from "@/lib/auth";

const value = (form: FormData, key: string) => String(form.get(key) || "").trim();
const requireValue = (form: FormData, key: string) => { const result = value(form, key); if (!result) throw new Error(`Campo obrigatório: ${key}`); return result; };

export async function createDiscipline(form: FormData) {
  await requireAuth();
  const db = getDb();
  const [row] = await db.insert(disciplines).values({ name: requireValue(form, "name").slice(0, 120), description: value(form, "description").slice(0, 1000) || null, semester: requireValue(form, "semester").slice(0, 40), color: value(form, "color") || "#5eead4", status: "ATIVA" }).returning({ id: disciplines.id });
  redirect(`/disciplinas/${row.id}`);
}

export async function createTopic(form: FormData) {
  await requireAuth(); const db = getDb(); const disciplineId = requireValue(form, "disciplineId");
  await db.insert(topics).values({ disciplineId, name: requireValue(form, "name").slice(0, 140), description: value(form, "description").slice(0, 600) || null });
  revalidatePath(`/disciplinas/${disciplineId}`);
}

export async function updateTopicStatus(form: FormData) {
  await requireAuth(); const db = getDb(); const id = requireValue(form, "topicId"); const status = requireValue(form, "status");
  const mastery = status === "DOMINADO" ? 90 : status === "REVISAR" ? 55 : status === "ESTUDANDO" ? 30 : 0;
  await db.update(topics).set({ status, mastery, updatedAt: new Date() }).where(eq(topics.id, id)); revalidatePath("/disciplinas");
}

export async function createDifficulty(form: FormData) {
  await requireAuth(); const db = getDb(); const disciplineId = requireValue(form, "disciplineId"); const topicId = requireValue(form, "topicId"); const report = requireValue(form, "report").slice(0, 2500); const level = value(form, "level") || "NAO_ENTENDI"; const mode = value(form, "mode") || "DIAGNOSTICAR";
  const [existing] = await db.select().from(difficulties).where(and(eq(difficulties.topicId, topicId), eq(difficulties.status, "ABERTA"))).limit(1);
  let difficultyId: string;
  if (existing) { difficultyId = existing.id; await db.update(difficulties).set({ lastReport: report, level, occurrences: sql`${difficulties.occurrences} + 1`, updatedAt: new Date() }).where(eq(difficulties.id, existing.id)); }
  else { const [created] = await db.insert(difficulties).values({ disciplineId, topicId, originalReport: report, lastReport: report, level }).returning({ id: difficulties.id }); difficultyId = created.id; }
  await db.insert(tutorMessages).values({ difficultyId, role: "USER", mode, content: report });
  const [subject] = await db.select({ discipline: disciplines.name, topic: topics.name }).from(topics).innerJoin(disciplines, eq(topics.disciplineId, disciplines.id)).where(eq(topics.id, topicId)).limit(1);
  const context = await findContext(disciplineId, topicId, report);
  const reply = await tutorReply({ mode, discipline: subject?.discipline || "Disciplina", topic: subject?.topic || "Tópico", report, context });
  await db.insert(tutorMessages).values({ difficultyId, role: "ASSISTANT", mode, content: reply });
  await db.insert(studySessions).values({ disciplineId, topicId, activityType: "DIFICULDADE", result: level, note: report });
  redirect(`/estudar?dificuldade=${difficultyId}`);
}

export async function continueTutor(form: FormData) {
  await requireAuth(); const db = getDb(); const difficultyId = requireValue(form, "difficultyId"); const report = requireValue(form, "message").slice(0, 2500); const mode = value(form, "mode") || "EXPLICAR";
  const [item] = await db.select({ difficulty: difficulties, discipline: disciplines.name, topic: topics.name }).from(difficulties).innerJoin(disciplines, eq(difficulties.disciplineId, disciplines.id)).innerJoin(topics, eq(difficulties.topicId, topics.id)).where(eq(difficulties.id, difficultyId)).limit(1);
  if (!item) throw new Error("Dificuldade não encontrada");
  const history = await db.select().from(tutorMessages).where(eq(tutorMessages.difficultyId, difficultyId)).orderBy(desc(tutorMessages.createdAt)).limit(6);
  await db.insert(tutorMessages).values({ difficultyId, role: "USER", mode, content: report });
  const context = await findContext(item.difficulty.disciplineId, item.difficulty.topicId, report);
  const reply = await tutorReply({ mode, discipline: item.discipline, topic: item.topic, report, context, recentMessages: history.reverse().map((m) => `${m.role}: ${m.content}`) });
  await db.insert(tutorMessages).values({ difficultyId, role: "ASSISTANT", mode, content: reply });
  await db.update(difficulties).set({ lastReport: report, occurrences: sql`${difficulties.occurrences} + 1`, updatedAt: new Date() }).where(eq(difficulties.id, difficultyId));
  redirect(`/estudar?dificuldade=${difficultyId}`);
}

export async function updateDifficultyStatus(form: FormData) {
  await requireAuth(); const id = requireValue(form, "difficultyId"); const status = requireValue(form, "status"); await getDb().update(difficulties).set({ status, updatedAt: new Date() }).where(eq(difficulties.id, id)); revalidatePath("/dificuldades");
}

export async function generateQuiz(form: FormData) {
  await requireAuth(); const db = getDb(); const disciplineId = requireValue(form, "disciplineId"); const topicId = requireValue(form, "topicId"); const count = value(form, "count") === "10" ? 10 : 5;
  const [subject] = await db.select({ discipline: disciplines.name, topic: topics.name }).from(topics).innerJoin(disciplines, eq(topics.disciplineId, disciplines.id)).where(eq(topics.id, topicId)).limit(1);
  if (!subject) throw new Error("Tópico não encontrado");
  const context = await findContext(disciplineId, topicId, subject.topic);
  const generated = await generateQuizQuestions({ ...subject, count, context });
  if (!generated.length) throw new Error("Não foi possível gerar questões válidas");
  const [quiz] = await db.insert(quizzes).values({ disciplineId, topicId, title: `Quiz: ${subject.topic}`, questionCount: generated.length }).returning({ id: quizzes.id });
  await db.insert(quizQuestions).values(generated.map((q) => ({ quizId: quiz.id, topicId, ...q })));
  redirect(`/estudar?quiz=${quiz.id}`);
}

export async function submitQuiz(form: FormData) {
  await requireAuth(); const db = getDb(); const quizId = requireValue(form, "quizId"); const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId)); const answers: Record<string, string> = {}; const weaknesses: string[] = []; let correct = 0;
  for (const question of questions) { const answer = value(form, `q_${question.id}`); answers[question.id] = answer; if (answer === question.correctAnswer) correct++; else weaknesses.push(question.prompt); }
  const score = Math.round((correct / Math.max(questions.length, 1)) * 100);
  const [attempt] = await db.insert(quizAttempts).values({ quizId, score, correctCount: correct, total: questions.length, answers, weaknesses }).returning({ id: quizAttempts.id });
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (quiz?.topicId) { const [topic] = await db.select().from(topics).where(eq(topics.id, quiz.topicId)).limit(1); const mastery = Math.round((topic?.mastery || 0) * .55 + score * .45); const status = mastery >= 80 ? "DOMINADO" : mastery >= 50 ? "REVISAR" : "ESTUDANDO"; await db.update(topics).set({ mastery, status, updatedAt: new Date() }).where(eq(topics.id, quiz.topicId)); await db.insert(studySessions).values({ disciplineId: quiz.disciplineId, topicId: quiz.topicId, activityType: "QUIZ", result: `${score}%`, note: `${correct}/${questions.length} acertos` }); }
  redirect(`/estudar?quiz=${quizId}&tentativa=${attempt.id}`);
}

export async function testUnderstanding(form: FormData) {
  await requireAuth(); const db = getDb(); const disciplineId = requireValue(form, "disciplineId"); const topicId = requireValue(form, "topicId"); const question = requireValue(form, "question").slice(0, 1000); const answer = requireValue(form, "answer").slice(0, 3000);
  const [subject] = await db.select({ discipline: disciplines.name, topic: topics.name }).from(topics).innerJoin(disciplines, eq(topics.disciplineId, disciplines.id)).where(eq(topics.id, topicId)).limit(1); if (!subject) throw new Error("Tópico não encontrado");
  const context = await findContext(disciplineId, topicId, `${question} ${answer}`); const result = await evaluateUnderstanding({ mode: "ME_TESTAR", ...subject, report: question, answer, context });
  const [session] = await db.insert(studySessions).values({ disciplineId, topicId, activityType: "TESTE_ENTENDIMENTO", result: result.split(/[.\n]/)[0].slice(0, 80), note: `${question}\n\nSua resposta: ${answer}\n\nAvaliação: ${result}` }).returning({ id: studySessions.id });
  redirect(`/estudar?entendimento=${session.id}`);
}

export async function scheduleReview(form: FormData) {
  await requireAuth(); const db = getDb(); const topicId = requireValue(form, "topicId"); const [topic] = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1); if (!topic) throw new Error("Tópico não encontrado"); let scheduledFor = value(form, "scheduledFor"); if (!scheduledFor) { const days = Number(value(form, "days") || 1); const target = new Date(); target.setDate(target.getDate() + days); scheduledFor = target.toISOString().slice(0, 10); }
  await db.insert(reviews).values({ disciplineId: topic.disciplineId, topicId, scheduledFor }); await db.update(topics).set({ status: "REVISAR", updatedAt: new Date() }).where(eq(topics.id, topicId)); revalidatePath("/revisoes");
}

export async function completeReview(form: FormData) {
  await requireAuth(); const db = getDb(); const reviewId = requireValue(form, "reviewId"); const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1); if (!review) return; await db.update(reviews).set({ status: "CONCLUIDA", completedAt: new Date() }).where(eq(reviews.id, reviewId)); await db.insert(studySessions).values({ disciplineId: review.disciplineId, topicId: review.topicId, activityType: "REVISAO", result: "CONCLUIDA" }); revalidatePath("/revisoes");
}

export async function rescheduleReview(form: FormData) { await requireAuth(); const id = requireValue(form, "reviewId"); const scheduledFor = requireValue(form, "scheduledFor"); await getDb().update(reviews).set({ scheduledFor, status: "PENDENTE", completedAt: null }).where(eq(reviews.id, id)); revalidatePath("/revisoes"); }

export async function createExam(form: FormData) {
  await requireAuth(); const db = getDb(); const disciplineId = requireValue(form, "disciplineId"); const [exam] = await db.insert(exams).values({ disciplineId, name: requireValue(form, "name").slice(0, 140), examDate: requireValue(form, "examDate"), notes: value(form, "notes").slice(0, 1000) || null }).returning({ id: exams.id }); const topicIds = form.getAll("topicIds").map(String).filter(Boolean); if (topicIds.length) await db.insert(examTopics).values(topicIds.map((topicId) => ({ examId: exam.id, topicId }))); redirect(`/provas/${exam.id}`);
}
