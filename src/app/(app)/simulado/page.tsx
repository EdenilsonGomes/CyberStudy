import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getUserDb, owned } from "@/db/user-db";
import { disciplines, mockExams } from "@/db/schema";
import { startMock } from "@/app/mock-actions";
import { MockRunner } from "@/components/mock-runner";
import { SubmitButton } from "@/components/submit-button";
import { uuidPattern } from "@/lib/study-contract";
export default async function MockPage({searchParams}:{searchParams:Promise<{id?:string;disciplina?:string;material?:string;evento?:string;erro?:string}>}) {
  const query=await searchParams;const {db,userId}=await getUserDb();
  if(query.id){
    if(!uuidPattern.test(query.id))notFound();
    const [mock]=await db.select().from(mockExams).where(owned(mockExams,userId,eq(mockExams.id,query.id)));if(!mock)notFound();
    return <div className="mx-auto max-w-2xl space-y-5"><Link className="focus-back" href="/revisoes">← Praticar</Link><h1 className="page-title">{mock.completedAt?"Seu resultado":"Modo prova"}</h1>{mock.completedAt?<><section className="card p-6 space-y-3"><strong className="text-4xl text-[var(--brand)]">{mock.score}%</strong><p>Acertos neste simulado. Esse resultado não é uma previsão da nota da faculdade.</p><Link className="btn btn-primary" href="/dashboard">Ajustar meu estudo</Link></section>{mock.questions.map(q=><article key={q.id} className="card p-5 space-y-2"><span className="badge">{mock.answers[q.id]===q.correctAnswer?"Acertou":"Reforçar"} · {q.concept}</span><h2 className="font-bold">{q.prompt}</h2><p className="muted">Sua resposta: {mock.answers[q.id]||"Em branco"}</p><p>Resposta: {q.correctAnswer}</p><p>{q.explanation}</p>{q.topicId&&<Link className="btn btn-secondary" href={`/estudar/iniciar?topico=${q.topicId}&revisao=1`}>Revisar conceito</Link>}</article>)}</>:<MockRunner id={mock.id} questions={mock.questions.map(({id,prompt,options})=>({id,prompt,options}))} answers={mock.answers} expiresAt={mock.expiresAt.toISOString()}/>}</div>;
  }
  const courses=await db.select().from(disciplines).where(owned(disciplines,userId));
  return <div className="mx-auto max-w-xl space-y-5"><Link className="focus-back" href="/revisoes">← Praticar</Link><h1 className="page-title">Modo prova</h1><section className="card p-6 space-y-4"><p>Até 10 questões dos materiais preparados, misturando conceitos e priorizando lacunas. Você terá 90 segundos por questão e correção ao final.</p>{query.erro&&<p role="alert" className="callout">Ainda não há questões preparadas para esse conteúdo. Faça uma aula ou prepare o material em Aprender.</p>}<form action={startMock} className="space-y-4"><label className="block"><span className="label">Disciplina</span><select className="field" name="disciplineId" required defaultValue={query.disciplina}>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{query.material&&<input type="hidden" name="materialId" value={query.material}/>} {query.evento&&<input type="hidden" name="eventId" value={query.evento}/>}<SubmitButton pendingText="Preparando…" className="btn btn-primary w-full">Começar simulado</SubmitButton></form><Link className="btn btn-ghost w-full" href="/disciplinas">Abrir materiais</Link></section></div>;
}
