import { and, desc, eq } from "drizzle-orm";
import { getUserDb, owned, withOwner } from "@/db/user-db";
import { academicEvents, conceptProgress, materials, studySessions, topics } from "@/db/schema";
export async function recordScoredActivity(disciplineId:string,topicId:string,score:number,total:number,errors:number,lastError:string|null) {
  const {db,userId}=await getUserDb();
  const [topic]=await db.select().from(topics).where(owned(topics,userId,and(eq(topics.id,topicId),eq(topics.disciplineId,disciplineId))));
  if(!topic||!total)return;
  await db.transaction(async tx=>{
    await tx.insert(conceptProgress).values(withOwner(userId,{disciplineId,topicId,name:topic.name})).onConflictDoNothing();
    const [previous]=await tx.select().from(conceptProgress).where(owned(conceptProgress,userId,and(eq(conceptProgress.disciplineId,disciplineId),eq(conceptProgress.name,topic.name)))).for("update");
    await tx.update(conceptProgress).set({mastery:previous.samples?Math.round(previous.mastery*.35+score*.65):score,samples:previous.samples+total,errors:previous.errors+errors,lastError:lastError||previous.lastError,updatedAt:new Date()}).where(owned(conceptProgress,userId,eq(conceptProgress.id,previous.id)));
  });
}
export async function studentMemory(disciplineId:string,topicId:string|null) {
  const {db,userId}=await getUserDb();
  const [concepts,sessions,agenda,pdfs]=await Promise.all([
    db.select().from(conceptProgress).where(owned(conceptProgress,userId,and(eq(conceptProgress.disciplineId,disciplineId),topicId?eq(conceptProgress.topicId,topicId):undefined))),
    db.select().from(studySessions).where(owned(studySessions,userId,and(eq(studySessions.disciplineId,disciplineId),topicId?eq(studySessions.topicId,topicId):undefined))).orderBy(desc(studySessions.createdAt)).limit(5),
    db.select().from(academicEvents).where(owned(academicEvents,userId,and(eq(academicEvents.disciplineId,disciplineId),eq(academicEvents.completed,false)))).limit(5),
    db.select({title:materials.title}).from(materials).where(owned(materials,userId,eq(materials.disciplineId,disciplineId))).orderBy(desc(materials.createdAt)).limit(3),
  ]);
  return JSON.stringify({concepts:concepts.map(c=>({name:c.name,mastery:c.mastery,samples:c.samples,errors:c.errors,lastError:c.lastError})),recent:sessions.map(s=>({date:s.createdAt,result:s.result,note:s.note?.slice(0,500)})),agenda:agenda.map(e=>({name:e.name,date:e.date,kind:e.kind})),materials:pdfs}).slice(0,6000);
}
