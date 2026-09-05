import Link from "next/link";
import { ArrowRight, CalendarDays, Flame } from "lucide-react";
import { copilotData } from "@/lib/copilot-data";
import { buildDailyPlan, daysUntil } from "@/lib/copilot";
import { learningRhythm } from "@/lib/learning";
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ minutos?: string }> }) {
  const data = await copilotData(); const query = await searchParams;
  const plan = buildDailyPlan({ ...data, topics: data.planTopics, minutes: Number(query.minutos || 30) });
  const rhythm = learningRhythm(data.sessions.map(s => s.createdAt));
  const masteryXp = data.concepts.filter(c=>c.mastery>=80&&c.samples>=3).length*10;
  const nextEvents = data.events.filter(e => e.date >= data.today).sort((a,b) => a.date.localeCompare(b.date)).slice(0,3);
  return <div className="mx-auto max-w-4xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Seu copiloto acadêmico</p><h1 className="page-title">Hoje</h1></div><span className="badge"><Flame size={16}/>{rhythm.streak} dias de estudo</span></header>
    <p className="muted text-sm">{masteryXp} XP de domínio · 10 por conceito com bons resultados em pelo menos 3 respostas.</p>
    <form className="card flex flex-wrap items-end gap-3 p-4"><label className="min-w-0 flex-1"><span className="label">Quanto tempo você tem hoje?</span><select className="field" name="minutos" defaultValue={plan.budget}>{[5,15,30,45,60,90,120].map(n => <option key={n} value={n}>{n} minutos</option>)}</select></label><button className="btn btn-secondary">Ajustar plano</button></form>
    {plan.items.length ? <section className="space-y-3"><div className="flex justify-between gap-3"><h2 className="section-title">Seu próximo passo</h2><span className="muted text-sm">≈ {plan.minutes} min</span></div>{plan.items.map((item,i) => <article key={item.key} className={`card p-5 ${i === 0 ? "copilot-priority" : ""}`}><div className="flex items-center justify-between gap-3"><span className="badge">{i+1} · {item.kind}</span><span className="muted text-sm">≈ {item.minutes} min</span></div><h3 className="mt-4 text-xl font-bold break-words">{item.title}</h3><p className="muted mt-2">{item.reason}</p><Link className={`btn mt-4 w-full sm:w-auto ${i === 0 ? "btn-primary" : "btn-secondary"}`} href={item.href}>{i === 0 ? "Começar agora" : "Abrir atividade"}<ArrowRight size={17}/></Link></article>)}<p className="muted text-sm">O plano se ajusta aos resultados. As durações são estimativas.</p></section> : <section className="card p-6 space-y-3"><h2 className="section-title">{data.courses.length ? "Revisões em dia" : "Vamos preparar seu semestre"}</h2><p className="muted">{data.courses.length ? "Confira seu material ou adicione a próxima unidade para continuar." : "Cadastre sua disciplina e envie o PDF. Depois vamos descobrir seu ponto de partida."}</p><Link className="btn btn-primary" href="/disciplinas">Abrir Aprender</Link></section>}
    <section className="card p-5"><div className="mb-4 flex flex-wrap justify-between gap-3"><h2 className="section-title flex items-center gap-2"><CalendarDays size={20}/>Próximos compromissos</h2><Link className="text-sm font-bold text-[var(--brand)]" href="/agenda">Abrir agenda →</Link></div>{nextEvents.length ? nextEvents.map(e => <div className="border-b border-[var(--line)] py-3 last:border-0" key={e.id}><strong className="block break-words">{e.name}</strong><p className="muted text-sm">{data.courses.find(c => c.id === e.disciplineId)?.name} · {daysUntil(e.date,data.today) === 0 ? "Hoje" : `em ${daysUntil(e.date,data.today)} dias`}</p></div>) : <p className="muted">Cadastre provas, exercícios e trabalhos para orientar seu plano diário.</p>}</section>
    <Link className="btn btn-ghost w-full" href="/semestre">Ver preparação do semestre</Link>
  </div>;
}
