import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarCheck, Check, RotateCcw } from "lucide-react";
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
  const mistakes = recentAttempts.filter(({ attempt, quiz }) => attempt.weaknesses.length > 0 && quiz.topicId).slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);
  const groups = [["Atrasadas", rows.filter(({ review }) => review.scheduledFor < today)], ["Hoje", rows.filter(({ review }) => review.scheduledFor === today)], ["Próximas", rows.filter(({ review }) => review.scheduledFor > today)]] as const;

  return <div className="space-y-7">
    <header><p className="muted text-sm">Relembre antes de esquecer</p><h1 className="page-title">Praticar</h1></header>
    {mistakes.length > 0 && <section className="card overflow-hidden"><div className="h-2 bg-[var(--danger)]"/><div className="p-5 md:p-6"><div className="mb-5"><span className="badge mb-2"><AlertCircle size={14}/> Foco inteligente</span><h2 className="section-title">Praticar meus erros</h2><p className="muted mt-1 text-sm">Volte direto aos assuntos em que você errou recentemente.</p></div><div className="space-y-3">{mistakes.map(({ attempt, quiz, topic, discipline }) => <Link key={attempt.id} href={`/estudar?topico=${quiz.topicId}&sessao=1`} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] p-4"><div className="min-w-0"><strong className="block truncate">{topic}</strong><p className="muted mt-1 truncate text-xs">{discipline} · {attempt.weaknesses[0]}</p></div><ArrowRight className="shrink-0" size={18}/></Link>)}</div></div></section>}
    {rows.length === 0 ? <div className="empty"><CalendarCheck className="mx-auto mb-3"/>Nenhuma revisão pendente.</div> : groups.map(([label, items]) => items.length > 0 && <section key={label} className="space-y-3"><h2 className="section-title">{label} <span className="badge ml-2">{items.length}</span></h2>{items.map(({ review, topic, discipline }) => <div key={review.id} className="card p-4 md:p-5"><div className="flex items-center justify-between gap-3"><Link className="min-w-0" href={`/estudar?topico=${review.topicId}&sessao=1`}><strong className="block truncate">{topic}</strong><p className="muted mt-1 text-sm">{discipline} · {new Date(`${review.scheduledFor}T12:00:00`).toLocaleDateString("pt-BR")}</p></Link><Link className="btn btn-primary shrink-0 px-3" href={`/estudar?topico=${review.topicId}&sessao=1`}><RotateCcw size={16}/><span className="hidden sm:inline">Revisar</span></Link></div><details className="mt-3"><summary className="muted cursor-pointer text-xs">Reagendar ou concluir</summary><div className="mt-3 flex flex-wrap gap-2"><form action={completeReview}><input type="hidden" name="reviewId" value={review.id}/><button className="btn btn-secondary text-xs"><Check size={15}/>Concluir</button></form><form action={rescheduleReview} className="flex flex-1 gap-2"><input type="hidden" name="reviewId" value={review.id}/><input className="field min-w-0 py-2" type="date" name="scheduledFor" required defaultValue={review.scheduledFor}/><button className="btn btn-secondary text-xs">Reagendar</button></form></div></details></div>)}</section>)}
  </div>;
}
