import Link from "next/link";
import { PilotEntry } from "@/components/pilot-entry";
import { PilotProgress } from "@/components/pilot-progress";
import { AlertCircle, ArrowRight, CalendarCheck, Check, Dumbbell, RotateCcw, Zap } from "lucide-react";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { disciplines, quizAttempts, quizzes, reviews, topics } from "@/db/schema";
import { completeReview, rescheduleReview } from "@/app/actions";

export default async function ReviewsPage() {
  const db = getDb();
  const [rows, recentAttempts] = await Promise.all([
    db.select({ review: reviews, topic: topics.name, discipline: disciplines.name }).from(reviews).innerJoin(topics, eq(reviews.topicId, topics.id)).innerJoin(disciplines, eq(reviews.disciplineId, disciplines.id)).where(eq(reviews.status, "PENDENTE")).orderBy(asc(reviews.scheduledFor)),
    db.select({ attempt: quizAttempts, quiz: quizzes, topic: topics.name, discipline: disciplines.name }).from(quizAttempts).innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id)).leftJoin(topics, eq(quizzes.topicId, topics.id)).innerJoin(disciplines, eq(quizzes.disciplineId, disciplines.id)).orderBy(desc(quizAttempts.createdAt)).limit(20),
  ]);
  const mistakes = recentAttempts.filter(({ attempt, quiz }) => attempt.weaknesses.length > 0 && quiz.topicId).slice(0, 4);
  const today = new Date().toISOString().slice(0, 10);
  const priority = rows.find(({ review }) => review.scheduledFor <= today) || rows[0];
  const groups = [["Para hoje", rows.filter(({ review }) => review.scheduledFor <= today)], ["Próximas", rows.filter(({ review }) => review.scheduledFor > today)]] as const;

  return <div className="mx-auto max-w-4xl space-y-6">
    <header><p className="eyebrow">Reforce antes de esquecer</p><h1 className="page-title">Praticar</h1><p className="muted mt-2 text-sm">Revisões, erros recentes e sessões curtas em um só lugar.</p></header>
    <PilotEntry/>
    <PilotProgress/>
    {priority ? <section className="practice-hero card cyber-grid"><span className="metric-icon"><Dumbbell size={21}/></span><div className="min-w-0 flex-1"><p className="eyebrow">Sua prática de agora</p><h2 className="text-xl font-black">{priority.topic}</h2><p className="muted mt-1 text-sm">{priority.discipline} · cerca de 5 minutos</p></div><Link className="btn btn-primary w-full sm:w-auto" href={`/estudar?topico=${priority.review.topicId}&sessao=1`}><Zap size={17} fill="currentColor"/>Começar</Link></section> : mistakes[0] ? <section className="practice-hero card"><span className="metric-icon"><AlertCircle size={21}/></span><div className="min-w-0 flex-1"><p className="eyebrow">Ponto fraco recente</p><h2 className="text-xl font-black">{mistakes[0].topic}</h2><p className="muted mt-1 text-sm">Refaça o conceito em que você errou.</p></div><Link className="btn btn-primary w-full sm:w-auto" href={`/estudar?topico=${mistakes[0].quiz.topicId}&sessao=1`}>Praticar agora</Link></section> : <div className="empty"><CalendarCheck className="mx-auto mb-3"/>Tudo em dia. Continue a trilha para liberar novas práticas.</div>}

    {mistakes.length > 0 && <section><div className="mb-3 flex items-center justify-between"><div><p className="eyebrow">Pontos fracos</p><h2 className="section-title">Questões que merecem reforço</h2></div><span className="badge">{mistakes.length}</span></div><div className="grid gap-3 sm:grid-cols-2">{mistakes.map(({ attempt, quiz, topic, discipline }) => <Link key={attempt.id} href={`/estudar?topico=${quiz.topicId}&sessao=1`} className="practice-item"><div className="min-w-0"><strong className="block truncate">{topic}</strong><p className="muted mt-1 truncate text-xs">{discipline} · {attempt.weaknesses[0]}</p></div><ArrowRight className="shrink-0" size={18}/></Link>)}</div></section>}

    {rows.length > 0 && <details className="card p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-extrabold"><span className="flex items-center gap-2"><RotateCcw size={18}/>Revisões programadas</span><span className="badge">{rows.length}</span></summary><div className="mt-5 space-y-6">{groups.map(([label, items]) => items.length > 0 && <section key={label}><h3 className="label">{label}</h3><div className="space-y-3">{items.map(({ review, topic, discipline }) => <div key={review.id} className="rounded-xl bg-[var(--surface-2)] p-4"><div className="flex items-center justify-between gap-3"><Link className="min-w-0" href={`/estudar?topico=${review.topicId}&sessao=1`}><strong className="block truncate">{topic}</strong><p className="muted mt-1 text-xs">{discipline} · {new Date(`${review.scheduledFor}T12:00:00`).toLocaleDateString("pt-BR")}</p></Link><Link className="btn btn-secondary shrink-0 px-3" href={`/estudar?topico=${review.topicId}&sessao=1`}><RotateCcw size={16}/><span className="hidden sm:inline">Revisar</span></Link></div><details className="mt-3"><summary className="muted cursor-pointer text-xs">Reagendar ou concluir</summary><div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr]"><form action={completeReview}><input type="hidden" name="reviewId" value={review.id}/><button className="btn btn-secondary w-full text-xs"><Check size={15}/>Concluir</button></form><form action={rescheduleReview} className="flex min-w-0 gap-2"><input type="hidden" name="reviewId" value={review.id}/><input className="field min-w-0 py-2" type="date" name="scheduledFor" required defaultValue={review.scheduledFor}/><button className="btn btn-secondary shrink-0 text-xs">Reagendar</button></form></div></details></div>)}</div></section>)}</div></details>}
  </div>;
}
