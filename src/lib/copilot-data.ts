import { and, asc, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { getUserDb, owned } from "@/db/user-db";
import { academicEvents, conceptProgress, disciplines, exams, examTopics, flashcards, interactiveSessions, learningEvidence, reviews, studyPackages, studySessions } from "@/db/schema";
import { loadTrail } from "@/lib/trail-data";
import { recordLearningEvidence } from "@/lib/learning-evidence";
import { sessionLesson } from "@/lib/study";
import { localDay, type PlanEvent, type PlanTopic } from "@/lib/copilot";
// Replay saved evidence once, in chronological order; never reset existing sessions.
export async function importLearningHistory() {
  const { db, userId } = await getUserDb();
  const history = await db.select({ session: interactiveSessions, pack: studyPackages }).from(interactiveSessions).innerJoin(studyPackages, eq(interactiveSessions.packageId, studyPackages.id)).leftJoin(learningEvidence, eq(learningEvidence.sessionId, interactiveSessions.id)).where(owned(interactiveSessions, userId, and(isNotNull(interactiveSessions.completedAt), isNull(learningEvidence.sessionId)))).orderBy(asc(interactiveSessions.completedAt));
  for (const { session, pack } of history) if (pack.content) await db.transaction(tx => recordLearningEvidence(tx, userId, session.id, pack.disciplineId, pack.topicId, sessionLesson(session, pack.content!), session.state));
}
export async function copilotData() {
  await importLearningHistory();
  const { db, userId } = await getUserDb();
  const today = localDay();
  const [courses, concepts, agenda, oldExams, links, due, cards, diagnosedRows, sessions] = await Promise.all([
    db.select().from(disciplines).where(owned(disciplines, userId, eq(disciplines.status, "ATIVA"))),
    db.select().from(conceptProgress).where(owned(conceptProgress, userId)),
    db.select().from(academicEvents).where(owned(academicEvents, userId, eq(academicEvents.completed, false))).orderBy(asc(academicEvents.date)),
    db.select().from(exams).where(owned(exams, userId)), db.select().from(examTopics).where(owned(examTopics, userId)),
    db.select().from(reviews).where(owned(reviews, userId, and(eq(reviews.status, "PENDENTE"), lte(reviews.scheduledFor, today)))),
    db.select({ id: flashcards.id }).from(flashcards).where(owned(flashcards, userId, lte(flashcards.due, new Date()))),
    db.selectDistinct({ id: studyPackages.disciplineId }).from(interactiveSessions).innerJoin(studyPackages, eq(interactiveSessions.packageId, studyPackages.id)).where(owned(interactiveSessions, userId, and(eq(studyPackages.kind, "diagnostic"), isNotNull(interactiveSessions.completedAt)))),
    db.select().from(studySessions).where(owned(studySessions, userId)),
  ]);
  const trails = await Promise.all(courses.map(async course => ({ course, trail: await loadTrail(course.id) })));
  const planTopics: PlanTopic[] = trails.flatMap(({ course, trail }) => trail.topicRows.filter(t => trail.steps.some(s => s.topicId === t.id && s.done) || trail.next?.topicId === t.id).map(t => {
    const evidence = concepts.filter(c => c.topicId === t.id);
    return { id: t.id, disciplineId: course.id, name: t.name, mastery: evidence.length ? Math.round(evidence.reduce((s,c) => s+c.mastery,0)/evidence.length) : t.mastery, assessed: evidence.length > 0, done: !trail.steps.some(s => s.topicId === t.id && !s.done), href: trail.href, position: t.position };
  }));
  const events: PlanEvent[] = [...agenda.map(e => ({ ...e })), ...oldExams.map(e => ({ id: e.id, disciplineId: e.disciplineId, name: e.name, date: e.examDate, kind: "PROVA", topicIds: links.filter(l => l.examId === e.id).map(l => l.topicId) }))];
  const completedToday=sessions.filter(s=>localDay(s.createdAt)===today&&s.topicId&&["AULA_INTERATIVA","ESTUDO","QUIZ"].includes(s.activityType)).map(s=>s.topicId!);
  const mocksToday=sessions.filter(s=>localDay(s.createdAt)===today&&s.activityType==="SIMULADO").map(s=>s.disciplineId!);
  return { today, courses, concepts, trails, planTopics, events, dueTopicIds: due.map(r => r.topicId), cardsDue: cards.length, diagnosed: diagnosedRows.map(d => d.id), sessions, completedToday, mocksToday };
}
