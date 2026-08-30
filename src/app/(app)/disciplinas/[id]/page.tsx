import Link from "next/link";
import { PilotEntry } from "@/components/pilot-entry";
import { BookOpen, Check, Dumbbell, FileText, LockKeyhole, Play, Plus, RotateCcw, Settings2 } from "lucide-react";
import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { disciplines, learningUnits, lessonAttempts, materials, microLessons, topics } from "@/db/schema";
import { createLearningPath, createTopic, deleteMaterial, deleteTopic, organizeMaterial, updateTopicStatus } from "@/app/actions";
import { ConfirmSubmitButton, MaterialFeedback, SubmitButton } from "@/components/submit-button";
import { pickNextTopic, topicStatusLabel } from "@/lib/learning";
import { studyProgress, latestDiagnostic } from "@/lib/study";

export default async function DisciplinePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ trilha?: string; material?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const db = getDb();
  const [discipline] = await db.select().from(disciplines).where(eq(disciplines.id, id)).limit(1);
  if (!discipline) notFound();
  const [topicRows, materialRows, unitRows, lessonRows, attemptRows, disciplineChoices] = await Promise.all([
    db.select().from(topics).where(eq(topics.disciplineId, id)).orderBy(topics.createdAt),
    db.select().from(materials).where(eq(materials.disciplineId, id)).orderBy(desc(materials.createdAt)),
    db.select().from(learningUnits).where(eq(learningUnits.disciplineId, id)).orderBy(learningUnits.position),
    db.select().from(microLessons).where(eq(microLessons.disciplineId, id)).orderBy(microLessons.createdAt),
    db.select({ attempt: lessonAttempts, lessonId: microLessons.id }).from(lessonAttempts).innerJoin(microLessons, eq(lessonAttempts.lessonId, microLessons.id)).where(eq(microLessons.disciplineId, id)).orderBy(desc(lessonAttempts.createdAt)),
    db.select().from(disciplines).where(eq(disciplines.status, "ATIVA")).orderBy(asc(disciplines.createdAt)),
  ]);
  const completedLessonIds = new Set(attemptRows.filter(({ attempt }) => attempt.score >= 60).map(({ lessonId }) => lessonId));
  const [completedStudies, diagnostic] = await Promise.all([studyProgress(id), latestDiagnostic(id)]);
  for (const row of completedStudies) if (row.package.lessonId) completedLessonIds.add(row.package.lessonId);
  const practicedTopicIds = new Set(completedStudies.map((row) => row.package.topicId));
  const unpracticedTopics = topicRows.filter((topic) => !practicedTopicIds.has(topic.id));
  const nextTopic = pickNextTopic(unpracticedTopics.length ? unpracticedTopics : topicRows);
  const nextLesson = lessonRows.find((lesson) => !completedLessonIds.has(lesson.id));
  const completed = lessonRows.length ? completedLessonIds.size : topicRows.filter((topic) => topic.status === "DOMINADO" || practicedTopicIds.has(topic.id)).length;
  const total = lessonRows.length || topicRows.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const topicById = new Map(topicRows.map((topic) => [topic.id, topic]));

  return <div className="mx-auto max-w-5xl space-y-6">
    <section className="card p-5"><p className="eyebrow">Seu ponto de partida</p><p className="muted mt-2 text-sm">{diagnostic ? "O diagnóstico ajusta as próximas aulas. Conceitos não avaliados continuam pela base." : "Já sabe parte do conteúdo? Descubra por onde começar, sem repetir tudo."}</p><Link className="btn btn-secondary mt-4" href={diagnostic ? `/estudar/sessao/${diagnostic.session.id}` : `/estudar/iniciar?disciplina=${id}&diagnostico=1`}>{diagnostic ? "Ver meu diagnóstico" : "Fazer diagnóstico opcional"}</Link></section>
    <PilotEntry/>
    <div><p className="eyebrow">Trilha</p><div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">{disciplineChoices.map((item) => <Link key={item.id} href={`/disciplinas/${item.id}`} aria-current={item.id === id ? "page" : undefined} className={`trail-chip ${item.id === id ? "trail-chip-active" : ""}`}>{item.name}</Link>)}</div></div>
    <header className="card overflow-hidden"><div className="h-2" style={{ background: discipline.color }}/><div className="p-5 md:p-8"><span className="badge mb-3">{discipline.semester}</span><h1 className="page-title">{discipline.name}</h1><p className="muted mt-2 max-w-2xl">{discipline.description || "Avance um assunto por vez."}</p><div className="mt-6"><div className="mb-2 flex justify-between text-sm"><span>{completed} de {total} etapas concluídas</span><strong>{progress}%</strong></div><div className="progress"><span style={{ width: `${progress}%`, background: discipline.color }}/></div></div>{nextLesson ? <Link className="btn btn-primary mt-6 w-full md:w-auto" href={`/aulas/${nextLesson.id}`}><Play size={18} fill="currentColor"/>Continuar trilha</Link> : nextTopic && <Link className="btn btn-primary mt-6 w-full md:w-auto" href={`/estudar?topico=${nextTopic.id}&sessao=1`}><Play size={18} fill="currentColor"/>Continuar trilha</Link>}</div></header>

    <section className="card p-5 md:p-7"><div className="mb-6 flex items-center justify-between"><div><p className="muted text-xs font-bold uppercase tracking-widest">Sua sequência</p><h2 className="section-title flex items-center gap-2"><BookOpen size={19}/>Trilha de aprendizagem</h2></div><span className="badge">{topicRows.length} etapas</span></div>
      {lessonRows.length > 0 ? <div className="space-y-9">{unitRows.map((unit, unitIndex) => {
        const ownLessons = lessonRows.filter((lesson) => lesson.unitId === unit.id);
        const unitDone = ownLessons.length > 0 && ownLessons.every((lesson) => completedLessonIds.has(lesson.id));
        return <section key={unit.id}><div className="mb-4"><span className="badge">Unidade {unitIndex + 1}</span><h3 className="mt-2 text-lg font-extrabold">{unit.title}</h3>{unit.description && <p className="muted mt-1 text-sm">{unit.description}</p>}</div><div className="learning-path">{ownLessons.map((lesson) => {
          const done = completedLessonIds.has(lesson.id);
          const current = lesson.id === nextLesson?.id;
          const review = Boolean(lesson.topicId && topicById.get(lesson.topicId)?.status === "REVISAR");
          const accessible = done || current || review;
          const content = <><span className={`learning-node ${done ? "learning-node-done" : current ? "learning-node-current" : review ? "learning-node-review" : ""}`}>{done ? <Check size={19}/> : review ? <RotateCcw size={17}/> : current ? <Play size={16} fill="currentColor"/> : <LockKeyhole size={16}/>}</span><div className="min-w-0 flex-1"><strong>{lesson.title}</strong><p className="muted mt-1 text-xs">{current ? "Seu próximo passo" : review ? "Revisão recomendada" : done ? "Concluída" : "Conclua a etapa anterior"}</p></div></>;
          return accessible ? <Link key={lesson.id} href={`/aulas/${lesson.id}`} className={`learning-step ${current ? "learning-step-current" : ""} ${review ? "learning-step-review" : ""}`}>{content}</Link> : <div key={lesson.id} className="learning-step learning-step-locked" aria-disabled="true">{content}</div>;
        })}<Link href={unitDone ? "/revisoes" : "#"} aria-disabled={!unitDone} className={`learning-step learning-step-practice ${unitDone ? "" : "learning-step-locked"}`}><span className={`learning-node ${unitDone ? "learning-node-practice" : ""}`}>{unitDone ? <Dumbbell size={17}/> : <LockKeyhole size={16}/>}</span><div className="min-w-0 flex-1"><strong>Prática da unidade</strong><p className="muted mt-1 text-xs">{unitDone ? "Fixe o que aprendeu" : "Disponível ao concluir a unidade"}</p></div></Link></div></section>;
      })}</div> : topicRows.length === 0 ? <div className="empty">Envie um material e crie sua primeira trilha.</div> : <div className="learning-path">{topicRows.map((topic) => {
        const done = topic.status === "DOMINADO" || practicedTopicIds.has(topic.id);
        const current = topic.id === nextTopic?.id;
        const review = topic.status === "REVISAR";
        const accessible = done || current || review;
        const content = <><span className={`learning-node ${done ? "learning-node-done" : current ? "learning-node-current" : review ? "learning-node-review" : ""}`}>{done ? <Check size={19}/> : review ? <RotateCcw size={17}/> : current ? <Play size={16} fill="currentColor"/> : <LockKeyhole size={16}/>}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><strong>{topic.name}</strong><span className="badge shrink-0">{topic.mastery}%</span></div><p className="muted mt-1 text-xs">{current ? "Seu próximo passo" : review ? "Revisar" : done ? "Concluído" : topicStatusLabel[topic.status] || topic.status}</p></div></>;
        return accessible ? <Link key={topic.id} href={`/estudar?topico=${topic.id}&sessao=1`} className={`learning-step ${current ? "learning-step-current" : ""}`}>{content}</Link> : <div key={topic.id} className="learning-step learning-step-locked" aria-disabled="true">{content}</div>;
      })}</div>}
    </section>

    <details open={Boolean(query.trilha || query.material)} className="card p-5 md:p-6"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-extrabold"><span className="flex items-center gap-2"><Settings2 size={19}/>Gerenciar disciplina</span><span className="muted text-xs font-normal">tópicos e materiais</span></summary><div className="mt-7 grid gap-7 lg:grid-cols-2">
      <div className="space-y-6"><section><h3 className="mb-4 flex items-center gap-2 font-extrabold"><Plus size={18}/>Novo tópico</h3><form action={createTopic} className="space-y-4"><input type="hidden" name="disciplineId" value={id}/><input className="field" name="name" required placeholder="Ex.: Subnetting"/><textarea className="field min-h-20" name="description" placeholder="Descrição opcional"/><button className="btn btn-secondary w-full">Adicionar tópico</button></form></section>
        {topicRows.length > 0 && <section><h3 className="mb-3 font-extrabold">Editar etapas</h3><div className="space-y-3">{topicRows.map((topic) => <div key={topic.id} className="rounded-xl bg-[var(--surface-2)] p-3"><strong className="mb-2 block text-sm">{topic.name}</strong><div className="flex gap-2"><form action={updateTopicStatus} className="flex min-w-0 flex-1 gap-2"><input type="hidden" name="topicId" value={topic.id}/><select className="field min-w-0 py-2 text-xs" name="status" defaultValue={topic.status}><option value="NAO_ESTUDADO">Ainda não iniciado</option><option value="ESTUDANDO">Em andamento</option><option value="REVISAR">Revisar</option><option value="DOMINADO">Concluído</option></select><button className="btn btn-secondary px-3 text-xs">Salvar</button></form><form action={deleteTopic}><input type="hidden" name="topicId" value={topic.id}/><ConfirmSubmitButton pendingText="..." confirmText="Excluir este tópico e seus registros?" className="btn btn-secondary px-3 text-xs" style={{ color: "var(--danger)" }}>Excluir</ConfirmSubmitButton></form></div></div>)}</div></section>}
      </div>
      <div className="space-y-6"><section><h3 className="mb-2 flex items-center gap-2 font-extrabold"><FileText size={18}/>Adicionar material</h3><p className="muted mb-4 text-sm">O conteúdo do PDF vira uma trilha de microaulas, exercícios e revisões.</p><MaterialFeedback/>{query.trilha && <p className="mb-4 rounded-xl bg-[var(--surface-2)] p-3 text-sm">{query.trilha === "erro" ? "Não foi possível criar uma trilha confiável. Tente novamente ou use outro material." : query.trilha === "sem_ia" ? "Configure uma chave de IA para criar a trilha." : `${query.trilha} microaulas foram criadas e salvas.`}</p>}<form action="/api/materials" method="post" encType="multipart/form-data" className="space-y-4"><input type="hidden" name="disciplineId" value={id}/><input className="field" name="title" required placeholder="Título do material"/><select className="field" name="topicId"><option value="">Disciplina inteira</option>{topicRows.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select><textarea className="field min-h-24" name="content" placeholder="Cole um texto ou envie o PDF abaixo"/><input className="field text-sm" type="file" name="file" accept="application/pdf"/><button className="btn btn-secondary w-full">Processar material</button></form></section>
        {materialRows.length > 0 && <section><h3 className="mb-3 font-extrabold">Materiais enviados</h3><div className="space-y-3">{materialRows.map((material) => <div key={material.id} className="rounded-xl bg-[var(--surface-2)] p-4"><strong className="text-sm">{material.title}</strong><p className="muted mt-1 text-xs">{material.type} · {Math.ceil(material.content.length / 1000)} mil caracteres</p><div className="mt-3 flex flex-wrap gap-2"><form action={createLearningPath}><input type="hidden" name="materialId" value={material.id}/><SubmitButton pendingText="Criando microaulas..." className="btn btn-primary text-xs">Criar trilha completa</SubmitButton></form><form action={organizeMaterial}><input type="hidden" name="materialId" value={material.id}/><SubmitButton pendingText="Organizando..." className="btn btn-secondary text-xs">Só organizar tópicos</SubmitButton></form><form action={deleteMaterial}><input type="hidden" name="materialId" value={material.id}/><ConfirmSubmitButton pendingText="..." className="btn btn-secondary text-xs" style={{ color: "var(--danger)" }}>Excluir</ConfirmSubmitButton></form></div></div>)}</div></section>}
      </div>
    </div></details>
  </div>;
}
