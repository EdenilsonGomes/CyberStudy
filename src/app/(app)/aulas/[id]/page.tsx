import Link from "next/link";
import { ArrowLeft, CheckCircle2, RotateCcw, ShieldAlert } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { disciplines, learningUnits, lessonAttempts, microLessons, topics } from "@/db/schema";
import { LessonRunner } from "@/components/lesson-runner";

export default async function LessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tentativa?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const db = getDb();
  const [row] = await db.select({ lesson: microLessons, unit: learningUnits, discipline: disciplines.name, topic: topics.name }).from(microLessons).innerJoin(learningUnits, eq(microLessons.unitId, learningUnits.id)).innerJoin(disciplines, eq(microLessons.disciplineId, disciplines.id)).leftJoin(topics, eq(microLessons.topicId, topics.id)).where(eq(microLessons.id, id)).limit(1);
  if (!row) notFound();
  const siblings = await db.select().from(microLessons).where(eq(microLessons.unitId, row.lesson.unitId)).orderBy(asc(microLessons.position));
  const currentIndex = siblings.findIndex((lesson) => lesson.id === id);
  const previousLesson = siblings[currentIndex - 1];
  const nextLesson = siblings[currentIndex + 1];
  let attempt: typeof lessonAttempts.$inferSelect | undefined;
  if (query.tentativa) [attempt] = await db.select().from(lessonAttempts).where(eq(lessonAttempts.id, query.tentativa)).limit(1);

  return <div className="mx-auto max-w-3xl space-y-5">
    <Link href={`/disciplinas/${row.lesson.disciplineId}`} className="muted flex items-center gap-2 text-sm"><ArrowLeft size={16}/>{row.unit.title}</Link>
    <header><p className="muted text-sm">{row.discipline} · {row.unit.title}</p><h1 className="page-title">{row.lesson.title}</h1><p className="muted mt-2">{row.lesson.objective}</p></header>
    {!attempt ? <LessonRunner lessonId={row.lesson.id} disciplineId={row.lesson.disciplineId} topicId={row.lesson.topicId} title={row.lesson.title} content={row.lesson.content}/> : <section className="card p-5 text-center md:p-8">
      <span className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full ${attempt.score >= 60 ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]"}`}>{attempt.score >= 60 ? <CheckCircle2 size={32}/> : <ShieldAlert size={30}/>}</span>
      <p className="muted text-sm">Microaula concluída</p><h2 className="mt-1 text-2xl font-extrabold">{attempt.correctCount} de {attempt.total} respostas corretas</h2><strong className="display mt-3 block text-5xl" style={{ color: attempt.score >= 60 ? "var(--brand)" : "var(--danger)" }}>{attempt.score}%</strong>
      {attempt.score < 60 ? <div className="mt-6 rounded-2xl bg-[var(--surface-2)] p-5 text-left"><strong>Vamos reforçar a base</strong><p className="muted mt-2 text-sm">Você não falhou: encontramos exatamente onde vale revisar antes de avançar.</p></div> : <p className="muted mt-5 text-sm">Seu progresso foi salvo e a revisão já foi programada.</p>}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">{attempt.score < 60 && previousLesson ? <Link className="btn btn-primary" href={`/aulas/${previousLesson.id}`}><RotateCcw size={17}/>Reforçar pré-requisito</Link> : nextLesson ? <Link className="btn btn-primary" href={`/aulas/${nextLesson.id}`}>Próxima microaula</Link> : <Link className="btn btn-primary" href={`/disciplinas/${row.lesson.disciplineId}`}>Voltar para a trilha</Link>}<Link className="btn btn-secondary" href={`/aulas/${row.lesson.id}`}><RotateCcw size={17}/>Refazer esta aula</Link></div>
      <details className="mt-6 rounded-xl border p-4 text-left" style={{ borderColor: "var(--line)" }}><summary className="cursor-pointer font-bold">Ver suas respostas</summary><div className="mt-4 space-y-3">{row.lesson.content.checks.map((check) => { const answer = attempt?.answers[check.id] || "Sem resposta"; const ok = answer.toLowerCase().trim() === check.correctAnswer.toLowerCase().trim(); return <div key={check.id} className="rounded-xl bg-[var(--surface-2)] p-4"><strong className="text-sm">{check.prompt}</strong><p className="mt-2 text-sm">{ok ? "✓ Correta" : `Sua resposta: ${answer}`}</p>{!ok && <p className="muted mt-1 text-sm">Correta: {check.correctAnswer}</p>}</div>; })}</div></details>
    </section>}
  </div>;
}
