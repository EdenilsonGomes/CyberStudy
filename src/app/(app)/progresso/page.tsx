import Link from "next/link";
import { PilotProgress } from "@/components/pilot-progress";
import { AlertTriangle, BookOpenCheck, CheckCircle2, Clock3, Flame, Target } from "lucide-react";
import { desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { disciplines, lessonAttempts, microLessons, studySessions, topics } from "@/db/schema";
import { learningRhythm } from "@/lib/learning";

export default async function ProgressPage() {
  const db = getDb();
  const week = new Date(); week.setDate(week.getDate() - 7);
  const [disciplineRows, topicRows, attemptRows, sessions] = await Promise.all([
    db.select().from(disciplines).where(eq(disciplines.status, "ATIVA")),
    db.select().from(topics),
    db.select({ attempt: lessonAttempts, lesson: microLessons }).from(lessonAttempts).innerJoin(microLessons, eq(lessonAttempts.lessonId, microLessons.id)).orderBy(desc(lessonAttempts.createdAt)),
    db.select().from(studySessions).where(gte(studySessions.createdAt, week)).orderBy(desc(studySessions.createdAt)),
  ]);
  const rhythm = learningRhythm(sessions.map((session) => session.createdAt));
  const uniqueLessons = new Map(attemptRows.map((row) => [row.lesson.id, row]));
  const scores = [...uniqueLessons.values()].map((row) => row.attempt.score);
  const accuracy = scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0;
  const minutes = sessions.reduce((sum, session) => sum + (session.durationMinutes || 0), 0);
  const disciplineById = new Map(disciplineRows.map((discipline) => [discipline.id, discipline.name]));
  const strongTopics = [...topicRows].filter((topic) => topic.mastery >= 70).sort((a, b) => b.mastery - a.mastery).slice(0, 4);
  const weakTopics = [...topicRows].filter((topic) => topic.mastery < 60 && topic.status !== "NAO_ESTUDADO").sort((a, b) => a.mastery - b.mastery).slice(0, 4);

  return <div className="mx-auto max-w-5xl space-y-6"><header><p className="eyebrow">Evolução que ajuda a decidir</p><h1 className="page-title">Progresso</h1></header>
    <section className="progress-summary"><div><Flame className="text-orange-400" size={20}/><strong>{rhythm.streak}</strong><span>dias estudando</span></div><div><Clock3 className="text-[var(--brand)]" size={20}/><strong>{Math.floor(minutes / 60)}h {minutes % 60}m</strong><span>últimos 7 dias</span></div><div><BookOpenCheck className="text-[var(--success)]" size={20}/><strong>{uniqueLessons.size}</strong><span>aulas praticadas</span></div><div><Target className="text-[var(--brand)]" size={20}/><strong>{accuracy}%</strong><span>média de acertos</span></div></section>

    <PilotProgress/>
    <section className="card p-5 md:p-6"><h2 className="section-title mb-5">Avanço por disciplina</h2><div className="space-y-4">{disciplineRows.map((discipline) => { const own = topicRows.filter((topic) => topic.disciplineId === discipline.id); const mastery = own.length ? Math.round(own.reduce((sum, topic) => sum + topic.mastery, 0) / own.length) : 0; return <Link href={`/disciplinas/${discipline.id}`} key={discipline.id} className="block rounded-xl bg-[var(--surface-2)] p-4"><div className="mb-2 flex min-w-0 justify-between gap-3"><span className="min-w-0 truncate font-bold">{discipline.name}</span><strong>{mastery}%</strong></div><div className="progress"><span style={{ width: `${mastery}%`, background: discipline.color }}/></div></Link>; })}</div></section>

    <div className="grid gap-5 md:grid-cols-2"><section className="card p-5"><div className="mb-4 flex items-center gap-3"><span className="metric-icon text-[var(--success)]"><CheckCircle2 size={19}/></span><div><p className="eyebrow">Conceitos fortes</p><h2 className="section-title">Você já domina</h2></div></div>{strongTopics.length ? <div className="space-y-2">{strongTopics.map((topic) => <div key={topic.id} className="concept-row"><span className="min-w-0"><strong className="block truncate text-sm">{topic.name}</strong><small className="muted">{disciplineById.get(topic.disciplineId)}</small></span><span className="badge">{topic.mastery}%</span></div>)}</div> : <p className="muted text-sm">Continue a trilha para formar seus primeiros pontos fortes.</p>}</section>
      <section className="card p-5"><div className="mb-4 flex items-center gap-3"><span className="metric-icon text-[var(--warning)]"><AlertTriangle size={19}/></span><div><p className="eyebrow">Conceitos fracos</p><h2 className="section-title">Vale reforçar</h2></div></div>{weakTopics.length ? <div className="space-y-2">{weakTopics.map((topic) => <Link key={topic.id} href={`/estudar?topico=${topic.id}&sessao=1`} className="concept-row"><span className="min-w-0"><strong className="block truncate text-sm">{topic.name}</strong><small className="muted">{disciplineById.get(topic.disciplineId)}</small></span><span className="badge">{topic.mastery}%</span></Link>)}</div> : <p className="muted text-sm">Nenhum ponto fraco identificado nas atividades recentes.</p>}</section></div>
  </div>;
}
