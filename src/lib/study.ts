import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getUserDb, owned } from "@/db/user-db";
import { disciplines, interactiveSessions, learningUnits, materialChunks, materials, microLessons, studyPackages, topics } from "@/db/schema";
import { adaptStudyLesson, diagnosticLevels, uuidPattern, type StudySource } from "@/lib/study-contract";

export type StudyTarget = { disciplineId: string; topicId: string | null; lessonId: string | null; title: string; concept: string; diagnostic: boolean; key: string; sources: StudySource[]; cacheKey: string };

export async function resolveStudyTarget(input: { topicId?: string; lessonId?: string; disciplineId?: string; diagnostic?: boolean }): Promise<StudyTarget | null> {
  const { db, userId } = await getUserDb();

  for (const id of [input.topicId, input.lessonId, input.disciplineId]) if (id && !uuidPattern.test(id)) return null;
  const [lesson] = input.lessonId ? await db.select().from(microLessons).where(owned(microLessons, userId, eq(microLessons.id, input.lessonId))).limit(1) : [];
  if (input.lessonId && !lesson) return null;
  const topicId = lesson?.topicId || input.topicId;
  const [topic] = topicId ? await db.select().from(topics).where(owned(topics, userId, eq(topics.id, topicId))).limit(1) : [];
  const disciplineId = lesson?.disciplineId || topic?.disciplineId || input.disciplineId;
  if (!disciplineId) return null;
  const [discipline] = await db.select().from(disciplines).where(owned(disciplines, userId, eq(disciplines.id, disciplineId))).limit(1);
  if (!discipline) return null;
  const diagnostic = Boolean(input.diagnostic);
  const scope = diagnostic ? await db.select().from(topics).where(owned(topics, userId, eq(topics.disciplineId, disciplineId))).orderBy(asc(topics.createdAt)).limit(3) : [{ id: topic?.id || "", name: topic?.name || lesson?.title || discipline.name }];
  const [unit] = lesson ? await db.select().from(learningUnits).where(owned(learningUnits, userId, eq(learningUnits.id, lesson.unitId))).limit(1) : [];
  const materialId = unit?.materialId || (!diagnostic ? topic?.materialId : null);
  const chunks = await db.select({ id: materialChunks.id, topicId: materialChunks.topicId, title: materials.title, content: materialChunks.content }).from(materialChunks).innerJoin(materials, eq(materialChunks.materialId, materials.id)).where(owned(materialChunks, userId, and(eq(materialChunks.disciplineId, disciplineId), materialId ? eq(materialChunks.materialId, materialId) : undefined))).orderBy(asc(materialChunks.position)).limit(120);
  const sources: StudySource[] = [];
  for (const concept of scope) {
    const terms = `${concept.name} ${lesson?.title || ""}`.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
    const ranked = chunks.filter((chunk) => !chunk.topicId || chunk.topicId === concept.id).map((chunk) => ({ ...chunk, score: terms.reduce((score, term) => score + (chunk.content.toLowerCase().includes(term) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
    // Existing micro-lesson content remains usable when its source attachment was removed.
    const content = ranked.slice(0, 2).map((chunk) => chunk.content).join("\n");
    if (content.length >= 80) sources.push({ id: concept.id || lesson?.id || disciplineId, title: ranked[0].title, concept: concept.name, content });
    else if (lesson) sources.push({ id: lesson.id, title: `Microaula existente: ${lesson.title}`, concept: concept.name, content: `${lesson.content.explanation}\n${lesson.content.example}\n${lesson.content.checks.map((check) => check.explanation).join("\n")}` });
  }
  const key = diagnostic ? `diagnostic:${disciplineId}` : `study:${lesson?.id || topic?.id}`;
  if (!diagnostic && !lesson && !topic) return null;
  const cacheKey = createHash("sha256").update(JSON.stringify({ version: 1, key, sources })).digest("hex");
  return { disciplineId, topicId: diagnostic ? null : topic?.id || null, lessonId: diagnostic ? null : lesson?.id || null, title: diagnostic ? `Seu ponto de partida · ${discipline.name}` : lesson?.title || topic!.name, concept: topic?.name || lesson?.title || "", diagnostic, key, sources, cacheKey };
}

export async function activeStudy(key?: string) {
  const { db, userId } = await getUserDb();
  const [row] = await db.select({ session: interactiveSessions, package: studyPackages }).from(interactiveSessions).innerJoin(studyPackages, eq(interactiveSessions.packageId, studyPackages.id)).where(owned(interactiveSessions, userId, and(isNull(interactiveSessions.completedAt), isNotNull(interactiveSessions.activeKey), key ? eq(interactiveSessions.activeKey, key) : undefined))).orderBy(desc(interactiveSessions.updatedAt)).limit(1);
  return row;
}

export async function latestDiagnostic(disciplineId: string) {
  const { db, userId } = await getUserDb();
  const [row] = await db.select({ session: interactiveSessions, package: studyPackages }).from(interactiveSessions).innerJoin(studyPackages, eq(interactiveSessions.packageId, studyPackages.id)).where(owned(interactiveSessions, userId, and(eq(studyPackages.disciplineId, disciplineId), eq(studyPackages.kind, "diagnostic"), isNotNull(interactiveSessions.completedAt)))).orderBy(desc(interactiveSessions.completedAt)).limit(1);
  return row;
}

export async function levelFor(target: StudyTarget) {
  const diagnostic = await latestDiagnostic(target.disciplineId);
  return diagnostic?.package.content ? diagnosticLevels(diagnostic.package.content, diagnostic.session.state)[target.concept] || "base" : "base";
}

export function sessionLesson(row: typeof interactiveSessions.$inferSelect, content: NonNullable<typeof studyPackages.$inferSelect.content>) {
  return adaptStudyLesson(content, row.level === "application" ? "application" : "base");
}

export async function studyProgress(disciplineId?: string) {
  const { db, userId } = await getUserDb();
  const rows = await db.selectDistinctOn([interactiveSessions.lessonKey], { session: interactiveSessions, package: studyPackages }).from(interactiveSessions).innerJoin(studyPackages, eq(interactiveSessions.packageId, studyPackages.id)).where(owned(interactiveSessions, userId, and(eq(studyPackages.kind, "study"), isNotNull(interactiveSessions.completedAt), disciplineId ? eq(studyPackages.disciplineId, disciplineId) : undefined))).orderBy(interactiveSessions.lessonKey, desc(interactiveSessions.completedAt));
  return rows.sort((a, b) => +b.session.completedAt! - +a.session.completedAt!);
}
