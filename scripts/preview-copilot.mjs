// Isolated in-memory fixtures. Never reads DATABASE_URL or production credentials.
import {readFileSync,readdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {drizzle} from 'drizzle-orm/pglite';
import {hashPassword} from '../src/lib/account-security.ts';
import {initialLessonState,transition} from '../src/lib/interactive-lesson.ts';
import {recordLearningEvidence} from '../src/lib/learning-evidence.ts';
import * as schema from '../src/db/schema.ts';
const pg=new PGlite({extensions:{pgcrypto}});for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await pg.exec(readFileSync(`migrations/${f}`,'utf8'));
const db=drizzle(pg,{schema}),userId='00000000-0000-4000-8000-000000000001';
await pg.query("UPDATE users SET email='preview@example.test',name='Estudante de teste',is_test=true WHERE id=$1",[userId]);
await db.insert(schema.authIdentities).values({userId,provider:'local',subject:'preview@example.test',passwordHash:await hashPassword('Local-preview-only-123')});
const [course]=await db.insert(schema.disciplines).values({userId,name:'Arquitetura de Computadores',semester:'2026.2'}).returning();
const [material]=await db.insert(schema.materials).values({userId,disciplineId:course.id,title:'Unidade 1 · Memórias',type:'TEXT',content:'RAM é volátil e depende de alimentação. SSD armazena dados sem alimentação. Cache mantém dados acessados recentemente para reduzir latência.'}).returning();
const [unit]=await db.insert(schema.learningUnits).values({userId,disciplineId:course.id,materialId:material.id,title:material.title,position:0}).returning();
for(const [position,name] of ['Memória RAM','Armazenamento SSD','Memória cache'].entries()){
 const [topic]=await db.insert(schema.topics).values({userId,disciplineId:course.id,materialId:material.id,name,position}).returning();
 const options=['RAM','SSD','Cache','Registrador'];const expected=options[position];
 const prompt=position===0?'Qual memória principal depende de alimentação?':position===1?'Qual mantém dados sem alimentação?':'Qual guarda dados recentes para reduzir a latência?';
 const lesson={id:`fixture-${position}`,version:1,title:name,objective:'Distinguir os tipos de memória',steps:Array.from({length:6},(_,i)=>({id:`s${i}`,title:name,concept:name,assessment:i>1,instruction:prompt,brief:'Compare a finalidade e a persistência de cada memória.',type:'scenario',scene:[],options,expected,explanation:`Neste contexto, a resposta é ${expected}.`,misconception:'Compare persistência e finalidade antes de escolher.',hints:Object.fromEntries(['explanation','purpose','term','example','lost'].map(k=>[k,['Observe a persistência.','Compare com os demais dispositivos.']]))}))};
 const [micro]=await db.insert(schema.microLessons).values({userId,disciplineId:course.id,topicId:topic.id,unitId:unit.id,title:name,objective:lesson.objective,position,content:{explanation:'Material sintético para testes.',example:'Exemplo sintético.',checks:lesson.steps.slice(2).map(s=>({id:s.id,type:'MULTIPLE_CHOICE',prompt:s.instruction,options:s.options,correctAnswer:s.expected,explanation:s.explanation}))}}).returning();
 const [pack]=await db.insert(schema.studyPackages).values({userId,disciplineId:course.id,topicId:topic.id,lessonId:micro.id,cacheKey:`fixture-${position}`,kind:'study',content:lesson}).returning();
 if(position===0){let state=initialLessonState();for(const step of lesson.steps){state=transition(lesson,state,{type:'answer',revision:state.revision,seconds:step.assessment?3:2,answer:'SSD'});state=transition(lesson,state,{type:'next',revision:state.revision,seconds:1});}
 const [session]=await db.insert(schema.interactiveSessions).values({userId,packageId:pack.id,lessonKey:`study:${micro.id}`,contentVersion:1,state,completedAt:new Date()}).returning();
 await db.transaction(tx=>recordLearningEvidence(tx,userId,session.id,course.id,topic.id,lesson,state));}
}
await db.insert(schema.academicEvents).values({userId,disciplineId:course.id,name:'P1 de Arquitetura',kind:'PROVA',date:new Date(Date.now()+3*86400000).toISOString().slice(0,10)});
const server=new PGLiteSocketServer({db:pg,host:'127.0.0.1',port:5439,maxConnections:10});await server.start();
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3100','-H','127.0.0.1'],{stdio:'inherit',windowsHide:true,env:{...process.env,NODE_ENV:'development',DATABASE_POOL_SIZE:'1',DATABASE_URL:'postgresql://postgres:postgres@127.0.0.1:5439/postgres',AUTH_SECRET:'local-preview-secret-not-for-production',ADMIN_EMAIL:'preview@example.test',ADMIN_PASSWORD:'Local-preview-only-123',OPENAI_API_KEY:'',MISTRAL_API_KEY:'',APP_URL:'http://127.0.0.1:3100'}});
process.on('SIGINT',async()=>{child.kill();await server.stop();await pg.close();process.exit(0);});
