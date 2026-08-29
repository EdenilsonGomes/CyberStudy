"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Brain, Check, HelpCircle, Lightbulb, RotateCcw, Sparkles, X } from "lucide-react";
import { completeMicroLesson, createDifficulty } from "@/app/actions";
import type { LessonContent } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";

function splitIntoShortBlocks(text: string, limit = 420) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const source = paragraphs.length ? paragraphs : [text.trim()];
  return source.flatMap((paragraph) => {
    if (paragraph.length <= limit) return [paragraph];
    const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) || [paragraph];
    const blocks: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      if (current && `${current} ${sentence}`.length > limit) { blocks.push(current); current = sentence; }
      else current = current ? `${current} ${sentence}` : sentence;
    }
    if (current) blocks.push(current);
    return blocks;
  });
}

type LessonRunnerProps = {
  lessonId: string;
  disciplineId: string;
  topicId: string | null;
  title: string;
  objective: string;
  contextLabel: string;
  backHref: string;
  content: LessonContent;
};

export function LessonRunner({ lessonId, disciplineId, topicId, title, objective, contextLabel, backHref, content }: LessonRunnerProps) {
  const contentSteps = useMemo(() => [
    ...splitIntoShortBlocks(content.explanation).map((body) => ({ type: "explanation" as const, body })),
    ...splitIntoShortBlocks(content.example).map((body) => ({ type: "example" as const, body })),
  ], [content.example, content.explanation]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const totalSteps = contentSteps.length + content.checks.length;
  const lessonStep = contentSteps[step];
  const questionIndex = step - contentSteps.length;
  const question = content.checks[questionIndex];
  const answer = question ? answers[question.id] || "" : "";
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const isCorrect = question ? normalize(answer) === normalize(question.correctAnswer) : false;
  const currentContext = lessonStep?.body || question?.prompt || title;
  const advance = () => { setChecked(false); setStep((current) => Math.min(current + 1, totalSteps - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const retry = () => { if (!question) return; setAnswers((current) => { const next = { ...current }; delete next[question.id]; return next; }); setChecked(false); };
  const reviewConcept = () => { setChecked(false); setStep(0); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <form action={completeMicroLesson} className="lesson-card card overflow-hidden">
    <input type="hidden" name="lessonId" value={lessonId}/><input type="hidden" name="disciplineId" value={disciplineId}/><input type="hidden" name="topicId" value={topicId || ""}/><input type="hidden" name="level" value="NAO_ENTENDI"/><input type="hidden" name="mode" value="EXPLICAR"/><input type="hidden" name="focus" value="1"/><input type="hidden" name="returnTo" value={`/aulas/${lessonId}`}/><input type="hidden" name="report" value={`Estou na microaula "${title}" e não entendi esta parte: ${currentContext}`}/>
    {content.checks.map((check) => <input key={check.id} type="hidden" name={`answer_${check.id}`} value={answers[check.id] || ""}/>) }
    <div className="lesson-progress-head"><Link href={backHref} aria-label="Voltar para a trilha" className="focus-icon-button"><ArrowLeft size={20}/></Link><div className="min-w-0 flex-1"><div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold"><span className="truncate">{contextLabel}</span><span className="muted shrink-0">{step + 1} / {totalSteps}</span></div><div className="progress"><span style={{ width: `${((step + 1) / totalSteps) * 100}%` }}/></div></div></div>
    <div className="lesson-body">
      {showHelp ? <section><button type="button" className="focus-back mb-6" onClick={() => setShowHelp(false)}><ArrowLeft size={17}/>Voltar para a aula</button><span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent)] text-[var(--brand)]"><HelpCircle size={24}/></span><p className="eyebrow">Tutor com contexto</p><h2 className="text-2xl font-black">O que aconteceu?</h2><p className="muted mt-2 text-sm">Escolha o que mais descreve sua dúvida. O Cyber já receberá esta etapa da aula.</p><div className="mt-6 grid gap-3">{["Não entendi a explicação", "Não sei por que isso importa", "Não entendi um termo", "Quero um exemplo", "Estou completamente perdido"].map((reason) => <button key={reason} formAction={createDifficulty} name="helpReason" value={reason} className="lesson-option"><span>{reason}</span><ArrowRight size={17}/></button>)}</div></section> : <>
        {lessonStep && <section><span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent)] text-[var(--brand)]">{lessonStep.type === "explanation" ? <Lightbulb size={22}/> : <Sparkles size={22}/>}</span><p className="eyebrow">{lessonStep.type === "explanation" ? "Entenda o conceito" : "Exemplo passo a passo"}</p><h1 className="mb-4 text-2xl font-black leading-tight">{title}</h1>{step === 0 && <p className="muted mb-5 text-sm">{objective}</p>}<div className={lessonStep.type === "example" ? "lesson-content-block" : "lesson-copy"}>{lessonStep.body}</div><button type="button" className="btn btn-primary mt-8 w-full" onClick={advance}>{step === contentSteps.length - 1 ? "Agora quero tentar" : "Entendi"}<ArrowRight size={18}/></button></section>}
        {question && <section><span className="badge mb-4">Exercício {questionIndex + 1} de {content.checks.length}</span><h1 className="text-xl font-extrabold leading-8">{question.prompt}</h1>
          {question.type === "FILL_BLANK" ? <input className="field mt-6" value={answer} disabled={checked} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Digite sua resposta" autoFocus/> : <div className="mt-6 grid gap-3">{question.options.map((option) => <button type="button" disabled={checked} key={option} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))} className={`lesson-option ${answer === option ? "lesson-option-selected" : ""}`}><span>{option}</span>{answer === option && <Check size={18}/>}</button>)}</div>}
          {!checked ? <button type="button" disabled={!answer.trim()} className="btn btn-primary mt-7 w-full" onClick={() => setChecked(true)}>Responder</button> : <div className={`mt-6 rounded-2xl p-4 ${isCorrect ? "lesson-feedback-correct" : "lesson-feedback-wrong"}`}><div className="flex gap-3">{isCorrect ? <Check className="shrink-0"/> : <X className="shrink-0"/>}<div><strong>{isCorrect ? "Resposta correta" : "Ainda não."}</strong>{!isCorrect && <p className="mt-1 text-sm">A resposta correta é: {question.correctAnswer}</p>}<p className="mt-2 text-sm leading-6">{question.explanation}</p></div></div>{questionIndex === content.checks.length - 1 ? <SubmitButton pendingText="Salvando progresso..." className="btn btn-primary mt-5 w-full">Concluir microaula</SubmitButton> : isCorrect ? <><button type="button" className="btn btn-primary mt-5 w-full" onClick={advance}>Próxima questão <ArrowRight size={18}/></button><button type="button" className="btn btn-ghost mt-2 w-full" onClick={reviewConcept}>Revisar conceito</button></> : <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" className="btn btn-primary" onClick={retry}><RotateCcw size={17}/>Tentar de novo</button><button type="button" className="btn btn-secondary" onClick={advance}>Continuar</button></div>}</div>}
        </section>}
        {topicId && <button type="button" onClick={() => setShowHelp(true)} className="btn btn-ghost mt-5 w-full"><Brain size={17}/>Não entendi isso</button>}
      </>}
    </div>
  </form>;
}
