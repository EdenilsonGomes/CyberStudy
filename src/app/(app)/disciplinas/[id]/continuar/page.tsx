import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getUserDb, owned } from "@/db/user-db";
import { conceptProgress, disciplines, materialDecisions } from "@/db/schema";
import { decideMaterial } from "@/app/copilot-actions";
import { materialState } from "@/lib/copilot";
import { loadTrail } from "@/lib/trail-data";
import { uuidPattern } from "@/lib/study-contract";

export default async function ContinueTrail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ de?: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const { db, userId } = await getUserDb();
  const [discipline] = await db.select({ id: disciplines.id }).from(disciplines).where(owned(disciplines, userId, eq(disciplines.id, id)));
  if (!discipline) notFound();
  const query = await searchParams;
  const trail = await loadTrail(id);
  const unit = trail.groups.find(g => g.steps.some(s => s.key === query.de));
  const concepts=(await db.select().from(conceptProgress).where(owned(conceptProgress,userId,eq(conceptProgress.disciplineId,id)))).filter(c=>unit?.steps.some(s=>s.topicId===c.topicId));
  const [decision]=unit?.materialId?await db.select().from(materialDecisions).where(owned(materialDecisions,userId,eq(materialDecisions.materialId,unit.materialId))):[];
  if (!unit?.done && trail.next) redirect(trail.href);
  return <div className="mx-auto max-w-xl space-y-5"><Link className="focus-back" href={`/disciplinas/${id}`}>← Voltar à trilha</Link><section className="card p-5 sm:p-8 space-y-5">
    <p className="eyebrow">Progresso salvo</p><h1 className="page-title">{unit?.done ? "Unidade concluída!" : "Continue sua sequência"}</h1>
    {unit && <><h2 className="section-title break-words">{unit.title}</h2><p>{unit.steps.filter(s => s.done).length} de {unit.steps.length} aulas concluídas.</p><p className="muted text-sm">{unit.steps.filter(s => s.reinforce).length} assunto(s) para reforçar em Praticar. Concluir não significa dominar tudo; suas revisões continuam disponíveis.</p></>}
    <div className="callout"><strong>{trail.next ? `Próxima unidade: ${trail.currentUnit?.title}` : trail.currentUnit ? "O próximo material já está salvo" : "Pronto para a próxima unidade?"}</strong><p className="muted mt-2 text-sm">{trail.next ? trail.next.title : trail.currentUnit ? "Prepare as aulas do material cadastrado para seguir." : "Adicione o PDF quando sua faculdade disponibilizar. Não precisa repetir esta sequência para manter seu progresso."}</p></div>
    {unit?.done && <section className="space-y-3"><span className="badge">{materialState(unit.steps.length,unit.steps.length,concepts)}</span><h2 className="section-title">Como ficou seu aprendizado?</h2>{concepts.length?<p>{Math.round(concepts.reduce((s,c)=>s+c.mastery,0)/concepts.length)}% de domínio observado · {concepts.filter(c=>c.mastery<70).length} conceito(s) frágeis.</p>:<p>Ainda falta avaliar os conceitos deste material.</p>}{concepts.filter(c=>c.mastery<70).map(c=><Link key={c.id} className="btn btn-secondary w-full" href={`/estudar/iniciar?topico=${c.topicId}&revisao=1`}>Revisar {c.name} · {c.mastery}%</Link>)}<Link className="btn btn-secondary w-full" href={`/simulado?disciplina=${id}${unit.materialId?`&material=${unit.materialId}`:""}`}>Fazer simulado da unidade</Link>{concepts.some(c=>c.mastery<70)&&<p className="callout">Vale reforçar os pontos frágeis antes da próxima unidade.</p>}{decision&&<p role="status">{decision.decision==="AGUARDANDO"?"Aguardando o próximo material da faculdade.":"Unidade encerrada. As revisões continuam disponíveis."}</p>}{unit.materialId&&<form action={decideMaterial} className="space-y-2"><input type="hidden" name="materialId" value={unit.materialId}/><button className="btn btn-secondary w-full" name="decision" value="ENCERRADO">Encerrar unidade</button><button className="btn btn-ghost w-full" name="decision" value="AGUARDANDO">Ainda não tenho o próximo PDF</button><button className="btn btn-ghost w-full" name="decision" value="FINALIZADO">Finalizar disciplina</button></form>}</section>}
    <Link className="btn btn-primary w-full" href={trail.href}>{trail.next ? "Começar próxima unidade" : trail.label}</Link><Link className="btn btn-ghost w-full" href="/revisoes">Revisar conteúdos anteriores</Link>
  </section></div>;
}
