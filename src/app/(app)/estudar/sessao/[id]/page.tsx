import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getUserDb, owned } from "@/db/user-db";
import { interactiveSessions, studyPackages, topics } from "@/db/schema";
import { feedbackFor, hintFor, publicLesson, summarizeLesson } from "@/lib/interactive-lesson";
import { diagnosticLevels, uuidPattern } from "@/lib/study-contract";
import { sessionLesson } from "@/lib/study";
import { LessonRunner } from "@/components/lesson-runner";

export default async function StudySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await getUserDb();

  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const [row] = await db.select({ session: interactiveSessions, package: studyPackages }).from(interactiveSessions).innerJoin(studyPackages, eq(interactiveSessions.packageId, studyPackages.id)).where(owned(interactiveSessions, userId, eq(interactiveSessions.id, id))).limit(1);
  if (!row?.package.content) notFound();
  const lesson = sessionLesson(row.session, row.package.content);
  const topicRows = await db.select().from(topics).where(owned(topics, userId, eq(topics.disciplineId, row.package.disciplineId))).orderBy(topics.createdAt);
  const levels = diagnosticLevels(lesson, row.session.state);
  const next = topicRows.find((topic) => levels[topic.name] === "base") || topicRows[0];
  return <div className="lesson-focus mx-auto max-w-3xl"><LessonRunner key={id} interactive={{ materialStudy: true, lesson: publicLesson(lesson), sessionId: id, initialState: row.session.state, initialFeedback: feedbackFor(lesson, row.session.state), initialHint: hintFor(lesson, row.session.state), initialSummary: row.session.state.completed ? summarizeLesson(lesson, row.session.state) : null, backHref: "/dashboard", level: row.session.level, continueHref: lesson.mode === "diagnostic" && next ? `/estudar/iniciar?topico=${next.id}` : `/disciplinas/${row.package.disciplineId}` }}/></div>;
}
