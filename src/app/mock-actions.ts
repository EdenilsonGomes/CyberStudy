"use server";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserDb, owned, withOwner } from "@/db/user-db";
import { academicEvents, conceptProgress, exams, examTopics, learningUnits, microLessons, mockExams, studyPackages, studySessions, type MockQuestion } from "@/db/schema";
import { assertStudyScope } from "@/lib/data";
import { uuidPattern } from "@/lib/study-contract";
export async function startMock(form:FormData) {
  const {db,userId}=await getUserDb(); const disciplineId=String(form.get("disciplineId")||"");
  await assertStudyScope(disciplineId);
  const materialId=String(form.get("materialId")||""), eventId=String(form.get("eventId")||"");
  let scope:string[]=[];
  if(eventId) {
    if(!uuidPattern.test(eventId)) throw new Error("Avaliação inválida");
    const [event]=await db.select().from(academicEvents).where(owned(academicEvents,userId,and(eq(academicEvents.id,eventId),eq(academicEvents.disciplineId,disciplineId))));
    if(event) scope=event.topicIds;
    else { const [exam]=await db.select().from(exams).where(owned(exams,userId,and(eq(exams.id,eventId),eq(exams.disciplineId,disciplineId)))); if(!exam) throw new Error("Avaliação não encontrada"); scope=(await db.select().from(examTopics).where(owned(examTopics,userId,eq(examTopics.examId,eventId)))).map(t=>t.topicId); }
  }
  if(materialId&&!uuidPattern.test(materialId)) throw new Error("Material inválido");
  const [lessons,packs,concepts,units]=await Promise.all([
    db.select().from(microLessons).where(owned(microLessons,userId,eq(microLessons.disciplineId,disciplineId))),
    db.select().from(studyPackages).where(owned(studyPackages,userId,and(eq(studyPackages.disciplineId,disciplineId),eq(studyPackages.kind,"study")))),
    db.select().from(conceptProgress).where(owned(conceptProgress,userId,eq(conceptProgress.disciplineId,disciplineId))),
    db.select().from(learningUnits).where(owned(learningUnits,userId,eq(learningUnits.disciplineId,disciplineId))),
  ]);
  const allowedLessons=lessons.filter(l=>(!materialId||units.some(u=>u.id===l.unitId&&u.materialId===materialId))&&(!scope.length||Boolean(l.topicId&&scope.includes(l.topicId))));
  const candidates:MockQuestion[]=allowedLessons.flatMap(l=>l.content.checks.filter(q=>q.options.includes(q.correctAnswer)).map(q=>({id:`${l.id}:${q.id}`,topicId:l.topicId,concept:l.title,prompt:q.prompt,options:q.options,correctAnswer:q.correctAnswer,explanation:q.explanation})));
  for(const pack of packs.filter(p=>(!materialId||allowedLessons.some(l=>l.id===p.lessonId))&&(!scope.length||Boolean(p.topicId&&scope.includes(p.topicId))))) for(const q of pack.content?.steps || []) if(q.assessment && (q.type==="scenario"||q.type==="choice") && typeof q.expected==="string") candidates.push({id:`${pack.id}:${q.id}`,topicId:pack.topicId,concept:q.concept,prompt:`${q.instruction}${q.type === "scenario" ? `\n${q.scene.map(s=>`${s.label}: ${s.value}`).join(" · ")}` : `\n${q.pattern}`}`,options:q.options,correctAnswer:q.expected,explanation:q.explanation});
  const groups=new Map<string,MockQuestion[]>();
  for(const q of candidates) { const group=groups.get(q.topicId||q.concept)||[]; if(!group.some(x=>x.prompt===q.prompt)) group.push(q); groups.set(q.topicId||q.concept,group); }
  const ordered=[...groups.entries()].sort(([a],[b])=>(concepts.find(c=>c.topicId===a)?.mastery||0)-(concepts.find(c=>c.topicId===b)?.mastery||0));
  const questions:MockQuestion[]=[];
  for(let round=0;questions.length<10;round++) { const next=ordered.flatMap(([,rows])=>rows[round]?[rows[round]]:[]); if(!next.length) break; questions.push(...next.slice(0,10-questions.length)); }
  if(!questions.length) redirect(`/simulado?disciplina=${disciplineId}&erro=conteudo`);
  const [mock]=await db.insert(mockExams).values(withOwner(userId,{disciplineId,questions,expiresAt:new Date(Date.now()+questions.length*90000)})).returning();
  redirect(`/simulado?id=${mock.id}`);
}
export async function answerMock(id:string,questionId:string,answer:string) {
  const {db,userId}=await getUserDb(); if(!uuidPattern.test(id)) throw new Error("Simulado inválido");
  return db.transaction(async tx=>{
    const [mock]=await tx.select().from(mockExams).where(owned(mockExams,userId,eq(mockExams.id,id))).for("update");
    if(!mock||mock.completedAt||mock.expiresAt<new Date()) return false;
    const q=mock.questions.find(q=>q.id===questionId); if(!q||!q.options.includes(answer)) throw new Error("Resposta inválida");
    await tx.update(mockExams).set({answers:{...mock.answers,[questionId]:answer}}).where(owned(mockExams,userId,eq(mockExams.id,id)));
    return true;
  });
}
export async function finishMock(form:FormData) {
  const {db,userId}=await getUserDb(); const id=String(form.get("id")||""); if(!uuidPattern.test(id)) throw new Error("Simulado inválido");
  await db.transaction(async tx=>{
    const [mock]=await tx.select().from(mockExams).where(owned(mockExams,userId,and(eq(mockExams.id,id),isNull(mockExams.completedAt)))).for("update"); if(!mock) return;
    const correct=mock.questions.filter(q=>mock.answers[q.id]===q.correctAnswer).length;
    const score=Math.round(correct/mock.questions.length*100);
    await tx.update(mockExams).set({score,completedAt:new Date()}).where(owned(mockExams,userId,eq(mockExams.id,id)));
    for(const name of new Set(mock.questions.map(q=>q.concept))) {
      const rows=mock.questions.filter(q=>q.concept===name), missed=rows.filter(q=>mock.answers[q.id]!==q.correctAnswer), mastery=Math.round((rows.length-missed.length)/rows.length*100);
      await tx.insert(conceptProgress).values(withOwner(userId,{disciplineId:mock.disciplineId,topicId:rows[0].topicId,name})).onConflictDoNothing();
      const [previous]=await tx.select().from(conceptProgress).where(owned(conceptProgress,userId,and(eq(conceptProgress.disciplineId,mock.disciplineId),eq(conceptProgress.name,name)))).for("update");
      await tx.update(conceptProgress).set({mastery:previous.samples?Math.round(previous.mastery*.35+mastery*.65):mastery,samples:previous.samples+rows.length,errors:previous.errors+missed.length,lastError:missed.map(q=>q.explanation).join(" ").slice(0,1200)||previous.lastError,updatedAt:new Date()}).where(owned(conceptProgress,userId,eq(conceptProgress.id,previous.id)));
    }
    await tx.insert(studySessions).values(withOwner(userId,{id,disciplineId:mock.disciplineId,activityType:"SIMULADO",durationMinutes:Math.max(1,Math.round(Math.min(Date.now()-mock.createdAt.getTime(),mock.expiresAt.getTime()-mock.createdAt.getTime())/60000)),result:`${score}%`,note:`${correct}/${mock.questions.length} questões` })).onConflictDoNothing();
  });
  revalidatePath("/dashboard"); revalidatePath("/progresso"); redirect(`/simulado?id=${id}`);
}
