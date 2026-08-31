import Link from "next/link";
import { FileText, Plus, Settings2 } from "lucide-react";
import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getUserDb, owned } from "@/db/user-db";
import { disciplines, studySessions } from "@/db/schema";
import { createLearningPath, createTopic, deleteMaterial, deleteTopic, organizeMaterial, updateTopicStatus } from "@/app/actions";
import { ConfirmSubmitButton, MaterialFeedback, SubmitButton } from "@/components/submit-button";
import { learningRhythm } from "@/lib/learning";
import { latestDiagnostic } from "@/lib/study";
import { loadTrail } from "@/lib/trail-data";
import { TrailOverview } from "@/components/trail-overview";
import { uuidPattern } from "@/lib/study-contract";

export default async function DisciplinePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ trilha?: string; material?: string; topicos?: string }> }) {
  const { db, userId } = await getUserDb();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const query = await searchParams;
  const [discipline] = await db.select().from(disciplines).where(owned(disciplines, userId, eq(disciplines.id, id))).limit(1);
  if (!discipline) notFound();
  const [trail, diagnostic, disciplineChoices, recent] = await Promise.all([
    loadTrail(id),
    latestDiagnostic(id),
    db.select().from(disciplines).where(owned(disciplines, userId, eq(disciplines.status, "ATIVA"))).orderBy(asc(disciplines.createdAt)),
    db.select({ createdAt: studySessions.createdAt }).from(studySessions).where(owned(studySessions, userId)).orderBy(desc(studySessions.createdAt)).limit(120),
  ]);
  const { topicRows, materialRows } = trail;
  const rhythm = learningRhythm(recent.map(s => s.createdAt));
  const today = new Date().toISOString().slice(0, 10);
  const completedToday = recent.filter(s => s.createdAt.toISOString().slice(0, 10) === today).length;
  return <div className="mx-auto max-w-2xl space-y-6">
    <p className="label">Disciplina</p>
    <nav aria-label="Escolher disciplina" className="flex flex-wrap gap-2">{disciplineChoices.map(item => <Link key={item.id} href={`/disciplinas/${item.id}`} aria-current={item.id === id ? "page" : undefined} className={`trail-chip ${item.id === id ? "trail-chip-active" : ""}`}>{item.name}</Link>)}</nav>
    <TrailOverview trail={trail} discipline={discipline} streak={rhythm.streak} completedToday={completedToday}/>
    <details className="card p-5"><summary className="cursor-pointer font-bold">Seu diagnóstico inicial</summary><p className="muted mt-3 text-sm">Ajusta o ponto de partida, sem marcar aulas como concluídas.</p><Link className="btn btn-secondary mt-3 w-full" href={diagnostic ? `/estudar/sessao/${diagnostic.session.id}` : `/estudar/iniciar?disciplina=${id}&diagnostico=1`}>{diagnostic ? "Ver meu diagnóstico" : "Fazer diagnóstico opcional"}</Link></details>
    <details id="materiais" open={Boolean(query.trilha || query.material || query.topicos)} className="card p-5 md:p-6"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-extrabold"><span className="flex items-center gap-2"><Settings2 size={19}/>Gerenciar disciplina</span><span className="muted text-xs font-normal">tópicos e materiais</span></summary><div className="mt-7 grid gap-7 lg:grid-cols-2">
      <div className="space-y-6"><section><h3 className="mb-4 flex items-center gap-2 font-extrabold"><Plus size={18}/>Novo tópico</h3><form action={createTopic} className="space-y-4"><input type="hidden" name="disciplineId" value={id}/><input className="field" name="name" required placeholder="Ex.: Subnetting"/><textarea className="field min-h-20" name="description" placeholder="Descrição opcional"/><button className="btn btn-secondary w-full">Adicionar tópico</button></form></section>
        {topicRows.length > 0 && <section><h3 className="mb-3 font-extrabold">Editar etapas</h3><div className="space-y-3">{topicRows.map((topic) => <div key={topic.id} className="rounded-xl bg-[var(--surface-2)] p-3"><strong className="mb-2 block text-sm">{topic.name}</strong><div className="flex gap-2"><form action={updateTopicStatus} className="flex min-w-0 flex-1 gap-2"><input type="hidden" name="topicId" value={topic.id}/><select className="field min-w-0 py-2 text-xs" name="status" defaultValue={topic.status}><option value="NAO_ESTUDADO">Ainda não iniciado</option><option value="ESTUDANDO">Em andamento</option><option value="REVISAR">Revisar</option><option value="DOMINADO">Concluído</option></select><button className="btn btn-secondary px-3 text-xs">Salvar</button></form><form action={deleteTopic}><input type="hidden" name="topicId" value={topic.id}/><ConfirmSubmitButton pendingText="..." confirmText="Excluir este tópico e seus registros?" className="btn btn-secondary px-3 text-xs" style={{ color: "var(--danger)" }}>Excluir</ConfirmSubmitButton></form></div></div>)}</div></section>}
      </div>
      <div className="space-y-6"><section><h3 className="mb-2 flex items-center gap-2 font-extrabold"><FileText size={18}/>Adicionar material</h3><p className="muted mb-4 text-sm">Cada PDF pode representar uma unidade. Envie o material e depois prepare suas aulas abaixo.</p><MaterialFeedback/>{query.trilha && <p className="mb-4 rounded-xl bg-[var(--surface-2)] p-3 text-sm">{query.trilha === "existente" ? "Esta trilha já está salva. Suas aulas e seu histórico foram preservados." : query.trilha === "erro" ? "Não foi possível criar uma trilha confiável. Tente novamente ou use outro material." : query.trilha === "sem_ia" ? "Configure uma chave de IA para criar a trilha." : `${query.trilha} microaulas foram criadas e salvas.`}</p>}<form action="/api/materials" method="post" encType="multipart/form-data" className="space-y-4"><input type="hidden" name="disciplineId" value={id}/><input className="field" name="title" required aria-label="Nome da unidade" placeholder="Ex.: Unidade 2 — Memória e armazenamento"/><select className="field" name="topicId"><option value="">Nova unidade desta disciplina</option>{topicRows.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select><textarea className="field min-h-24" name="content" placeholder="Cole um texto ou envie o PDF abaixo"/><input className="field text-sm" type="file" name="file" accept="application/pdf"/><button className="btn btn-secondary w-full">Processar material</button></form></section>
        {materialRows.length > 0 && <section><h3 className="mb-3 font-extrabold">Materiais enviados</h3><div className="space-y-3">{materialRows.map((material) => <div key={material.id} className="rounded-xl bg-[var(--surface-2)] p-4"><strong className="text-sm">{material.title}</strong><p className="muted mt-1 text-xs">{material.type} · {Math.ceil(material.content.length / 1000)} mil caracteres</p><div className="mt-3 flex flex-wrap gap-2">{trail.groups.find(g => g.materialId === material.id)?.steps.length ? <Link className="btn btn-secondary text-xs" href={`/disciplinas/${id}`}>Trilha já preparada</Link> : <><form action={createLearningPath}><input type="hidden" name="materialId" value={material.id}/><SubmitButton pendingText="Criando microaulas..." className="btn btn-primary text-xs">Criar trilha completa</SubmitButton></form><form action={organizeMaterial}><input type="hidden" name="materialId" value={material.id}/><SubmitButton pendingText="Organizando..." className="btn btn-secondary text-xs">Só organizar tópicos</SubmitButton></form></>}<form action={deleteMaterial}><input type="hidden" name="materialId" value={material.id}/><ConfirmSubmitButton pendingText="..." className="btn btn-secondary text-xs" style={{ color: "var(--danger)" }}>Excluir</ConfirmSubmitButton></form></div></div>)}</div></section>}
      </div>
    </div></details>
  </div>;
}
