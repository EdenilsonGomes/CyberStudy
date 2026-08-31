import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getUserDb, owned } from "@/db/user-db";
import { interactiveSessions, learningUnits, lessonAttempts, materials, microLessons, studyPackages, topics } from "@/db/schema";
import { buildTrail } from "@/lib/trail";

export async function loadTrail(disciplineId: string) {
  const { db, userId } = await getUserDb();
  const [topicRows, materialRows, units, lessons, completed, attempts, active] = await Promise.all([
    db.select().from(topics).where(owned(topics, userId, eq(topics.disciplineId, disciplineId))).orderBy(asc(topics.position), asc(topics.createdAt)),
    db.select().from(materials).where(owned(materials, userId, eq(materials.disciplineId, disciplineId))).orderBy(asc(materials.createdAt)),
    db.select().from(learningUnits).where(owned(learningUnits, userId, eq(learningUnits.disciplineId, disciplineId))),
    db.select().from(microLessons).where(owned(microLessons, userId, eq(microLessons.disciplineId, disciplineId))),
    db.selectDistinct({ lessonId: studyPackages.lessonId, topicId: studyPackages.topicId }).from(interactiveSessions).innerJoin(studyPackages, eq(interactiveSessions.packageId, studyPackages.id)).where(owned(interactiveSessions, userId, and(eq(studyPackages.disciplineId, disciplineId), eq(studyPackages.kind, "study"), isNotNull(interactiveSessions.completedAt)))),
    db.selectDistinct({ lessonId: lessonAttempts.lessonId }).from(lessonAttempts).innerJoin(microLessons, eq(lessonAttempts.lessonId, microLessons.id)).where(owned(lessonAttempts, userId, eq(microLessons.disciplineId, disciplineId))),
    db.select({ id: interactiveSessions.id, key: interactiveSessions.lessonKey, lessonId: studyPackages.lessonId, topicId: studyPackages.topicId }).from(interactiveSessions).innerJoin(studyPackages, eq(interactiveSessions.packageId, studyPackages.id)).where(owned(interactiveSessions, userId, and(eq(studyPackages.disciplineId, disciplineId), eq(studyPackages.kind, "study"), isNull(interactiveSessions.completedAt), isNotNull(interactiveSessions.activeKey)))).orderBy(desc(interactiveSessions.updatedAt)),
  ]);
  const trail = buildTrail({ topics: topicRows, materials: materialRows, units, lessons, completed, attempts });
  const resume = active.find(a => a.key === trail.next?.key || (!a.lessonId && a.topicId === trail.next?.topicId && lessons.filter(l => l.topicId === a.topicId).length === 1));
  const href = resume ? `/estudar/sessao/${resume.id}` : trail.next?.href || `/disciplinas/${disciplineId}?material=${trail.currentUnit ? "preparar" : "novo"}#materiais`;
  const label = resume ? "Continuar de onde parei" : trail.next ? "Continuar trilha" : trail.currentUnit ? "Preparar esta unidade" : "Adicionar PDF da próxima unidade";
  return { ...trail, href, label, topicRows, materialRows, lessons };
}
