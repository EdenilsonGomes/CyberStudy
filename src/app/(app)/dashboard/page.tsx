/* eslint-disable react-hooks/purity -- request-time dashboard clock */
import Link from "next/link";
import { AlertCircle, ArrowRight, BookOpen, Brain, CalendarCheck, GraduationCap } from "lucide-react";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { difficulties, disciplines, exams, reviews, topics } from "@/db/schema";

export default async function DashboardPage(){
  const db=getDb();const today=new Date().toISOString().slice(0,10);
  const [allDisciplines,openDifficulties,dueReviews,nextExams,allTopics]=await Promise.all([
    db.select().from(disciplines).where(eq(disciplines.status,"ATIVA")),
    db.select().from(difficulties).where(eq(difficulties.status,"ABERTA")),
    db.select({review:reviews,topic:topics.name,discipline:disciplines.name}).from(reviews).innerJoin(topics,eq(reviews.topicId,topics.id)).innerJoin(disciplines,eq(reviews.disciplineId,disciplines.id)).where(and(eq(reviews.status,"PENDENTE"),lte(reviews.scheduledFor,today))).orderBy(asc(reviews.scheduledFor)).limit(6),
    db.select({exam:exams,discipline:disciplines.name}).from(exams).innerJoin(disciplines,eq(exams.disciplineId,disciplines.id)).where(gte(exams.examDate,today)).orderBy(asc(exams.examDate)).limit(4),
    db.select().from(topics),
  ]);
  const hour=new Date().getHours();const greeting=hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";
  const statCards=[["Disciplinas ativas",allDisciplines.length,BookOpen,"/disciplinas"],["Revisar hoje",dueReviews.length,CalendarCheck,"/revisoes"],["Dificuldades abertas",openDifficulties.length,AlertCircle,"/dificuldades"],["Próximas provas",nextExams.length,GraduationCap,"/provas"]] as const;
  return <div className="space-y-8"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="muted mb-1 text-sm">{greeting} 👋</p><h1 className="page-title">Vamos avançar um pouco hoje?</h1></div><Link className="btn btn-primary" href="/estudar"><Brain size={18}/>Estudar agora</Link></header>
    <section className="grid-auto">{statCards.map(([label,count,Icon,href])=><Link href={href} key={label} className="card p-5"><div className="mb-6 flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-2)]"><Icon size={19}/></span><ArrowRight size={16} className="muted"/></div><strong className="display text-3xl">{count}</strong><p className="muted mt-1 text-sm">{label}</p></Link>)}</section>
    <div className="grid gap-6 lg:grid-cols-[1.35fr_.85fr]"><section className="card p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="section-title">Progresso das disciplinas</h2><Link href="/disciplinas" className="muted text-sm">Ver todas</Link></div>{allDisciplines.length===0?<div className="empty">Crie sua primeira disciplina para começar.</div>:<div className="space-y-5">{allDisciplines.map((discipline)=>{const own=allTopics.filter(t=>t.disciplineId===discipline.id);const mastery=own.length?Math.round(own.reduce((s,t)=>s+t.mastery,0)/own.length):0;return <Link href={`/disciplinas/${discipline.id}`} key={discipline.id} className="block"><div className="mb-2 flex justify-between gap-3 text-sm"><strong>{discipline.name}</strong><span className="muted">{mastery}%</span></div><div className="progress"><span style={{width:`${mastery}%`,background:discipline.color}}/></div></Link>})}</div>}</section>
      <section className="card p-5 md:p-6"><h2 className="section-title mb-5">Próximas provas</h2>{nextExams.length===0?<div className="empty">Nenhuma prova cadastrada.</div>:<div className="space-y-3">{nextExams.map(({exam,discipline})=>{const days=Math.ceil((new Date(`${exam.examDate}T12:00:00`).getTime()-Date.now())/86400000);return <Link href={`/provas/${exam.id}`} key={exam.id} className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-4"><div><strong className="text-sm">{exam.name}</strong><p className="muted mt-1 text-xs">{discipline}</p></div><span className="badge">{days===0?"Hoje":`${days} dias`}</span></Link>})}</div>}</section></div>
    <section className="card p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="section-title">Revisar hoje</h2><Link href="/revisoes" className="muted text-sm">Ver agenda</Link></div>{dueReviews.length===0?<div className="empty">Tudo em dia. Quando estudar um tópico, programe a próxima revisão.</div>:<div className="grid-auto">{dueReviews.map(({review,topic,discipline})=><Link href={`/estudar?topico=${review.topicId}`} key={review.id} className="rounded-xl border p-4" style={{borderColor:"var(--line)"}}><span className="badge mb-3">{review.scheduledFor<today?"Atrasada":"Hoje"}</span><strong className="block">{topic}</strong><span className="muted text-sm">{discipline}</span></Link>)}</div>}</section>
  </div>
}
