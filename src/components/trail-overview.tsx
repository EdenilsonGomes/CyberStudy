import Link from "next/link";
import { Check, Flame, LockKeyhole, Play, RotateCcw } from "lucide-react";
import type { loadTrail } from "@/lib/trail-data";

export function TrailOverview({ trail, discipline, streak, completedToday }: { trail: Awaited<ReturnType<typeof loadTrail>>; discipline: { id: string; name: string; semester: string }; streak: number; completedToday: number }) {
  return <>
    <header className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="eyebrow">Sua trilha · {discipline.semester}</span><span className="streak-pill"><Flame size={17}/>{streak} dias</span></div>
      <h1 className="page-title break-words">{discipline.name}</h1>
      <div className="daily-goal"><span className="muted text-sm">Meta de hoje · {Math.min(3, completedToday)}/3 atividades</span><div className="goal-dots" aria-hidden="true">{[0, 1, 2].map(i => <span key={i} className={i < completedToday ? "goal-dot-filled" : ""}/>)}</div></div>
    </header>
    <section className="card p-5 space-y-4" aria-label="Seu próximo passo">
      <p className="eyebrow">{trail.done ? "Conteúdo cadastrado concluído" : trail.currentUnit ? "Unidade atual" : "Vamos começar"}</p>
      <h2 className="section-title break-words">{trail.done ? "Você chegou ao fim desta sequência." : trail.next?.title || trail.currentUnit?.title || "Adicione o material da primeira unidade"}</h2>
      <p className="muted text-sm">{trail.done ? "As revisões continuam em Praticar. Envie o próximo PDF quando estiver disponível." : trail.currentUnit && !trail.next ? "O material já está salvo. Prepare suas aulas para continuar." : "Uma aula por vez. Seus avanços ficam salvos."}</p>
      <Link href={trail.href} className="btn btn-primary w-full"><Play size={17}/>{trail.total || trail.currentUnit ? trail.label : "Adicionar primeiro PDF"}</Link>
      {trail.total > 0 && <div><div className="flex flex-wrap justify-between gap-2 text-sm mb-2"><span>{trail.completed} de {trail.total} aulas concluídas</span><strong>{Math.round(trail.completed / trail.total * 100)}%</strong></div><div className="progress" aria-label="Avanço nas aulas"><span style={{ width: `${trail.completed / trail.total * 100}%` }}/></div><p className="muted mt-2 text-xs">Avanço na sequência, não percentual de domínio.</p></div>}
    </section>
    {trail.groups.map((unit, index) => <section key={unit.id} className="card p-4 sm:p-6 space-y-4" aria-label={`Unidade ${index + 1}: ${unit.title}`}>
      <header><span className="badge">Unidade {index + 1}{unit.done ? " · concluída" : unit.id === trail.currentUnit?.id ? " · atual" : ""}</span><h2 className="section-title mt-2 break-words">{unit.title}</h2><p className="muted text-xs mt-1">{unit.steps.filter(s => s.done).length}/{unit.steps.length} aulas concluídas</p></header>
      {unit.steps.length ? <div className="learning-path">{unit.steps.map(step => {
        const current = step.key === trail.next?.key;
        const content = <><span className={`learning-node ${step.done ? "learning-node-done" : current ? "learning-node-current" : ""}`}>{step.done ? <Check size={19}/> : current ? <Play size={17}/> : <LockKeyhole size={17}/>}</span><span className="min-w-0 flex-1"><strong className="block break-words">{step.title}</strong><span className="muted block mt-1 text-xs">{step.done ? step.reinforce ? "Concluída · reforço em Praticar" : "Concluída · pode revisar" : current ? "Seu próximo passo" : "Conclua a aula anterior"}</span></span></>;
        return step.done || current ? <Link key={step.key} href={step.done ? `${step.href}&revisao=1` : trail.href} aria-current={current ? "step" : undefined} className={`learning-step ${current ? "learning-step-current" : ""}`}>{content}</Link> : <div key={step.key} className="learning-step learning-step-locked" aria-disabled="true">{content}</div>;
      })}</div> : <p className="muted text-sm">Material recebido. Falta preparar as aulas desta unidade.</p>}
      {unit.done && <div className="callout"><strong>Unidade concluída</strong><p className="muted mt-2 text-sm">{unit.steps.filter(s => s.reinforce).length} assunto(s) para reforçar. Você pode avançar e revisar depois.</p><Link className="btn btn-ghost mt-3 w-full" href="/revisoes"><RotateCcw size={16}/>Revisar em Praticar</Link></div>}
    </section>)}
  </>;
}
