import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {drizzle} from 'drizzle-orm/pglite';
import {createEmptyCard,fsrs,Rating} from 'ts-fsrs';
import * as schema from '../src/db/schema.ts';
import {recordLearningEvidence} from '../src/lib/learning-evidence.ts';
import {buildDailyPlan,localDay,validDay,materialState,evidenceScore,preparationPlan} from '../src/lib/copilot.ts';
const topic=(id,extras={})=>({id,disciplineId:'d',name:id,mastery:0,assessed:false,done:false,position:0,href:`/learn/${id}`,...extras});
const base={today:'2026-09-04',minutes:30,topics:[],events:[],dueTopicIds:[],cardsDue:0,diagnosed:[]};
test('planner respects budget, diagnoses unknown concepts, separates reviews, and avoids same-day repetition',()=>{
 const input={...base,minutes:15,topics:[topic('old',{mastery:40,assessed:true,done:true}),topic('next')],dueTopicIds:['old'],cardsDue:3};
 const plan=buildDailyPlan(input);
 assert.ok(plan.minutes<=15);assert.equal(plan.items[0].kind,'Diagnóstico');assert.ok(plan.items.some(i=>i.key==='cards'));
 assert.ok(plan.items.find(i=>i.key==='old').href.includes('revisao=1'));
 const later=buildDailyPlan({...input,completedToday:['old']});assert.ok(!later.items.some(i=>i.key==='old'));
 assert.ok(buildDailyPlan({...input,minutes:NaN}).budget===30);
});
test('deadlines prioritize weak scoped concepts and do not include expired exams',()=>{
 const event={id:'e',disciplineId:'d',name:'Prova',kind:'PROVA',date:'2026-09-05',topicIds:['weak']};
 const plan=buildDailyPlan({...base,topics:[topic('weak',{mastery:25,assessed:true,done:true}),topic('strong',{mastery:95,assessed:true,done:true})],events:[event]});
 assert.equal(plan.items[0].kind,'Modo prova');assert.ok(plan.items.some(i=>i.key==='weak'));assert.ok(!plan.items.some(i=>i.key==='strong'));
 assert.ok(!buildDailyPlan({...base,events:[{...event,date:'2026-09-03'}]}).items.length);
 assert.equal(preparationPlan(event,[{id:'weak',mastery:25,assessed:true}],base.today).perDay,1);
});
test('coverage cannot imply mastery and Brazilian day boundaries remain stable',()=>{
 assert.equal(materialState(3,3,[]),'Conteúdo concluído');assert.equal(materialState(3,3,[{mastery:100,samples:2}]),'Revisão pendente');assert.equal(materialState(3,3,[{mastery:90,samples:4}]),'Dominado');
 assert.equal(evidenceScore(0,4,4),35);assert.equal(evidenceScore(4,4),100);
 assert.equal(localDay(new Date('2026-09-05T01:00:00Z')),'2026-09-04');assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2026-09-04'),true);
});
test('FSRS serializes scheduling state and distinguishes forgetting from recall',()=>{
 const now=new Date('2026-09-04T12:00:00Z'),scheduler=fsrs({enable_fuzz:false}),card=createEmptyCard(now);
 const outcomes=scheduler.repeat(JSON.parse(JSON.stringify(card)),now);
 assert.ok(outcomes[Rating.Easy].card.due>outcomes[Rating.Again].card.due);
 const saved=JSON.parse(JSON.stringify(outcomes[Rating.Good].card));const next=scheduler.next(saved,new Date('2026-09-05T12:00:00Z'),Rating.Again);
 assert.equal(next.card.reps,2);assert.equal(next.log.rating,Rating.Again);
});
test('real database imports evidence once, preserves assisted errors and rejects cross-owner relationships',async t=>{
 const pg=new PGlite({extensions:{pgcrypto}});t.after(()=>pg.close());for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await pg.exec(readFileSync(`migrations/${f}`,'utf8'));
 const db=drizzle(pg,{schema}),userId='00000000-0000-4000-8000-000000000001';
 const [course]=await db.insert(schema.disciplines).values({userId,name:'Test',semester:'1'}).returning();
 const [topic]=await db.insert(schema.topics).values({userId,disciplineId:course.id,name:'Memória'}).returning();
 const [session]=await db.insert(schema.interactiveSessions).values({userId,lessonKey:'test',contentVersion:1,state:{}}).returning();
 const step={id:'s',title:'Memória',concept:'Memória',assessment:true,instruction:'Qual preserva dados?',type:'scenario',scene:[],options:['SSD','RAM'],expected:'SSD',explanation:'SSD preserva dados sem alimentação.',misconception:'RAM depende de alimentação.',hints:{}};
 const lesson={id:'test',version:1,title:'Test',objective:'Test',steps:[step]},state={completed:true,evidence:{s:{attempts:[{answer:'RAM',correct:false,assisted:false},{answer:'SSD',correct:true,assisted:true}],help:[]}}};
 await db.transaction(tx=>recordLearningEvidence(tx,userId,session.id,course.id,topic.id,lesson,state));
 await db.transaction(tx=>recordLearningEvidence(tx,userId,session.id,course.id,topic.id,lesson,state));
 const [concept]=await db.select().from(schema.conceptProgress);assert.equal(concept.mastery,35);assert.equal(concept.samples,1);assert.equal(concept.errors,1);assert.match(concept.lastError,/RAM/);
 assert.equal((await db.select().from(schema.flashcards)).length,1);assert.equal((await db.select().from(schema.learningEvidence)).length,1);
 const [other]=await db.insert(schema.users).values({name:'Other'}).returning();
 await assert.rejects(db.insert(schema.academicEvents).values({userId:other.id,disciplineId:course.id,name:'Foreign',kind:'PROVA',date:'2026-09-10'}));
 await assert.rejects(db.insert(schema.flashcards).values({userId:other.id,disciplineId:course.id,sourceKey:'foreign',front:'f',back:'b',schedule:createEmptyCard()}));
});
