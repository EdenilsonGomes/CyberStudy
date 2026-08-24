import Link from "next/link";
import { ArrowRight, BookOpen, CalendarCheck, Flame, GraduationCap, Play, Target } from "lucide-react";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { disciplines, exams, reviews, studySessions, topics } from "@/db/schema";
import { learningRhythm, pickNextTopic } from "@/lib/learning";

export default async function DashboardPage() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const [activeDisciplines, allTopics, dueReviews, nextExams, recentSessions] = await Promise.all([
    db.select().from(disciplines).where(eq(disciplines.status, "ATIVA")),
    db.select().from(topics).orderBy(asc(topics.createdAt)),
    db.select({ review: reviews, topic: topics.name, discipline: disciplines.name }).from(reviews).innerJoin(topics, eq(reviews.topicId, topics.id)).innerJoin(disciplines, eq(reviews.disciplineId, disciplines.id)).where(and(eq(reviews.status, "PENDENTE"), lte(reviews.scheduledFor, today))).orderBy(asc(reviews.scheduledFor)),
    db.select({ exam: exams, discipline: disciplines.name }).from(exams).innerJoin(disciplines, eq(exams.disciplineId, disciplines.id)).where(gte(exams.examDate, today)).orderBy(asc(exams.examDate)).limit(1),
    db.select({ createdAt: studySessions.createdAt }).from(studySessions).orderBy(desc(studySessions.createdAt)).limit(120),
  ]);
  const activeTopics = allTopics.filter((topic) => activeDisciplines.some((discipline) => discipline.id === topic.disciplineId));
  const nextTopic = pickNextTopic(activeTopics, dueReviews.map(({ review }) => review.topicId));
  const nextDiscipline = activeDisciplines.find((discipline) => discipline.id === nextTopic?.disciplineId);
  const rhythm = learningRhythm(recentSessions.map((session) => session.createdAt));
  const nextExam = nextExams[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return <div className="space-y-6">
    <header><p className="muted text-sm">{greeting} 👋</p><h1 className="page-title">Qual é o próximo passo?</h1></header>
    <section className="card overflow-hidden"><div className="h-2 bg-[var(--brand)]"/><div className="p-5 md:p-8">
      <span className="badge mb-4"><Target size={14}/> Meta de hoje · uma sessão curta</span>
      {nextTopic ? <><p className="muted text-sm">Continuar em {nextDiscipline?.name}</p><h2 className="mt-1 text-2xl font-extrabold md:text-3xl">{nextTopic.name}</h2><p className="muted mt-2 text-sm">Explicação, exemplo e 5 questões · cerca de 10 minutos</p><Link className="btn btn-primary mt-6 w-full md:w-auto" href={`/estudar?topico=${nextTopic.id}&sessao=1`}><Play size={18} fill="currentColor"/> Continuar aprendendo</Link></> : <><h2 className="text-xl font-extrabold">Sua trilha começa com um tópico</h2><p className="muted mt-2 text-sm">Crie uma disciplina e adicione o primeiro assunto.</p><Link className="btn btn-primary mt-5" href="/disciplinas"><BookOpen size={18}/> Criar disciplina</Link></>}
    </div></section>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="card p-4"><Flame className="mb-3 text-orange-500" size={21}/><strong className="display text-2xl">{rhythm.streak}</strong><p className="muted text-xs">dias de ritmo</p></div>
      <div className="card p-4"><Target className="mb-3 text-[var(--brand)]" size={21}/><strong className="display text-2xl">{rhythm.completedToday ? "Feita" : "Pendente"}</strong><p className="muted text-xs">meta de hoje</p></div>
      <Link href="/revisoes" className="card p-4"><CalendarCheck className="mb-3 text-[var(--brand)]" size={21}/><strong className="display text-2xl">{dueReviews.length}</strong><p className="muted text-xs">para revisar</p></Link>
      <Link href={nextExam ? `/provas/${nextExam.exam.id}` : "/provas"} className="card p-4"><GraduationCap className="mb-3 text-[var(--brand)]" size={21}/><strong className="display block truncate text-base">{nextExam?.exam.name ?? "Nenhuma"}</strong><p className="muted text-xs">próxima prova</p></Link>
    </section>
    <section className="card p-5 md:p-6"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="muted text-xs font-bold uppercase tracking-widest">Sua evolução</p><h2 className="section-title">Trilhas em andamento</h2></div><Link href="/disciplinas" className="btn btn-secondary px-3 text-xs">Ver todas <ArrowRight size={15}/></Link></div>
      {activeDisciplines.length === 0 ? <div className="empty">Nenhuma disciplina ativa.</div> : <div className="space-y-5">{activeDisciplines.map((discipline) => { const own = allTopics.filter((topic) => topic.disciplineId === discipline.id); const completed = own.filter((topic) => topic.status === "DOMINADO").length; const progress = own.length ? Math.round((completed / own.length) * 100) : 0; return <Link href={`/disciplinas/${discipline.id}`} key={discipline.id} className="block"><div className="mb-2 flex justify-between gap-3 text-sm"><strong>{discipline.name}</strong><span className="muted">{completed}/{own.length} etapas</span></div><div className="progress"><span style={{ width: `${progress}%`, background: discipline.color }}/></div></Link>; })}</div>}
    </section>
  </div>;
}
