import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { interactiveSessions } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { binaryPilot } from "@/lib/pilot-lesson";
import { feedbackFor, hintFor, publicLesson, summarizeLesson } from "@/lib/interactive-lesson";
import { LessonRunner } from "@/components/lesson-runner";
import { SubmitButton } from "@/components/submit-button";
import { startPilot } from "@/app/pilot-actions";

export default async function PilotPage({ searchParams }: { searchParams: Promise<{ sessao?: string }> }) {
  await requireAuth();
  const { sessao } = await searchParams;
  const db = getDb();
  if (sessao) {
    if (!/^[0-9a-f-]{36}$/i.test(sessao)) notFound();
    const [row] = await db.select().from(interactiveSessions).where(and(eq(interactiveSessions.id, sessao), eq(interactiveSessions.lessonKey, binaryPilot.id), eq(interactiveSessions.contentVersion, binaryPilot.version))).limit(1);
    if (!row) notFound();
    return <div className="lesson-focus mx-auto max-w-3xl"><LessonRunner key={row.id} interactive={{ lesson: publicLesson(binaryPilot), sessionId: row.id, initialState: row.state, initialFeedback: feedbackFor(binaryPilot, row.state), initialHint: hintFor(binaryPilot, row.state), initialSummary: row.state.completed ? summarizeLesson(binaryPilot, row.state) : null }}/></div>;
  }
  const [resume] = await db.select().from(interactiveSessions).where(and(eq(interactiveSessions.lessonKey, binaryPilot.id), eq(interactiveSessions.contentVersion, binaryPilot.version), isNull(interactiveSessions.completedAt))).orderBy(desc(interactiveSessions.updatedAt)).limit(1);
  return <div className="lesson-focus mx-auto max-w-3xl"><section className="lesson-card card interactive-lesson"><div className="lab-body"><Link className="focus-back" href="/estudar"><ArrowLeft size={18}/>Voltar para Praticar</Link><span className="lab-tag">Aula-piloto · aprender fazendo</span><h1 className="lab-title">Como os bits viram números</h1><p className="lab-instruction">{binaryPilot.objective}</p><div className="pilot-preview" aria-label="Exemplo: oito mais um é nove"><span>8</span><b>+</b><span>1</span><b>=</b><strong>9</strong></div><p>Você vai acender bits, prever valores, associar representações e reconstruir um painel. Uma atividade por vez, com explicação após cada resposta.</p><div className="callout"><strong>Não precisa saber binário.</strong><p className="muted mt-2">6 etapas · cerca de 5 minutos. As pistas ficam dentro da aula. Seu progresso é salvo sem alterar suas disciplinas.</p></div>{resume ? <><Link className="btn btn-primary w-full" href={`/aulas/piloto-binario?sessao=${resume.id}`}>Continuar da etapa {resume.state.index + 1}<ArrowRight size={18}/></Link><form action={startPilot}><SubmitButton className="btn btn-ghost w-full" pendingText="Abrindo...">Começar outra sessão</SubmitButton></form></> : <form action={startPilot}><SubmitButton pendingText="Preparando laboratório..." className="btn btn-primary w-full">Começar a experimentar<ArrowRight size={18}/></SubmitButton></form>}<p className="muted text-xs">Conteúdo preparado para este piloto. Não utiliza geração automática nem declara domínio com base em uma única sessão.</p></div></section></div>;
}
