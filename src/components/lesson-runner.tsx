"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Brain, Check, HelpCircle, Lightbulb, Sparkles, X } from "lucide-react";
import { completeMicroLesson, createDifficulty } from "@/app/actions";
import type { LessonContent } from "@/db/schema";
import { SubmitButton } from "@/components/submit-button";

export function LessonRunner({ lessonId, disciplineId, topicId, title, content }: { lessonId: string; disciplineId: string; topicId: string | null; title: string; content: LessonContent }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const totalSteps = content.checks.length + 2;
  const questionIndex = step - 2;
  const question = content.checks[questionIndex];
  const answer = question ? answers[question.id] || "" : "";
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const isCorrect = question ? normalize(answer) === normalize(question.correctAnswer) : false;
  const advance = () => { setChecked(false); setStep((current) => Math.min(current + 1, totalSteps - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <form action={completeMicroLesson} className="card overflow-hidden">
    <input type="hidden" name="lessonId" value={lessonId}/>
    <input type="hidden" name="disciplineId" value={disciplineId}/>
    <input type="hidden" name="topicId" value={topicId || ""}/>
    <input type="hidden" name="level" value="NAO_ENTENDI"/>
    <input type="hidden" name="mode" value="EXPLICAR"/>
    <input type="hidden" name="report" value={`Estou na microaula "${title}" e não entendi a etapa atual: ${step === 0 ? content.explanation : step === 1 ? content.example : question?.prompt || title}`}/>
    {content.checks.map((check) => <input key={check.id} type="hidden" name={`answer_${check.id}`} value={answers[check.id] || ""}/>) }
    <div className="h-1 bg-[var(--brand)]"/><div className="p-5 md:p-8">
      <div className="mb-7"><div className="mb-2 flex justify-between text-xs font-bold"><span>MICROAULA</span><span className="muted">{step + 1} de {totalSteps}</span></div><div className="progress"><span style={{ width: `${((step + 1) / totalSteps) * 100}%` }}/></div></div>
      {showHelp ? <section><button type="button" className="muted mb-5 flex items-center gap-2 text-sm" onClick={()=>setShowHelp(false)}><ArrowLeft size={16}/>Voltar para a aula</button><span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent)] text-[var(--brand)]"><HelpCircle size={24}/></span><h2 className="text-xl font-black">O que aconteceu?</h2><p className="muted mt-2 text-sm">Escolha a opção que mais descreve sua dúvida. O tutor recebe o contexto desta etapa.</p><div className="mt-6 grid gap-3">{["Não entendi a explicação","Não sei por que isso importa","Não entendi um termo","Quero um exemplo mais simples","Estou completamente perdido"].map(reason=><button key={reason} formAction={createDifficulty} name="helpReason" value={reason} className="lesson-option"><span>{reason}</span><ArrowRight size={17}/></button>)}</div></section> : <>
      {step === 0 && <section><span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent)] text-[var(--brand)]"><Lightbulb size={22}/></span><p className="label">Entenda o conceito</p><p className="text-lg font-semibold leading-8 whitespace-pre-wrap">{content.explanation}</p><button type="button" className="btn btn-primary mt-8 w-full" onClick={advance}>Entendi, ver exemplo <ArrowRight size={18}/></button></section>}
      {step === 1 && <section><span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent)]"><Sparkles size={22}/></span><p className="label">Exemplo passo a passo</p><div className="rounded-2xl bg-[var(--surface-2)] p-5 text-base leading-8 whitespace-pre-wrap">{content.example}</div><button type="button" className="btn btn-primary mt-8 w-full" onClick={advance}>Agora quero tentar <ArrowRight size={18}/></button></section>}
      {question && <section><span className="badge mb-4">{question.type === "FILL_BLANK" ? "Complete" : question.type === "ORDER" ? "Coloque em ordem" : question.type === "TRUE_FALSE" ? "Verdadeiro ou falso" : "Escolha uma resposta"}</span><h2 className="text-xl font-extrabold leading-8">{question.prompt}</h2>
        {question.type === "FILL_BLANK" ? <input className="field mt-6" value={answer} disabled={checked} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Digite sua resposta" autoFocus/> : <div className="mt-6 grid gap-3">{question.options.map((option) => <button type="button" disabled={checked} key={option} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))} className={`lesson-option ${answer === option ? "lesson-option-selected" : ""}`}><span>{option}</span>{answer === option && <Check size={18}/>}</button>)}</div>}
        {!checked ? <button type="button" disabled={!answer.trim()} className="btn btn-primary mt-7 w-full" onClick={() => setChecked(true)}>Verificar resposta</button> : <div className={`mt-6 rounded-2xl p-4 ${isCorrect ? "lesson-feedback-correct" : "lesson-feedback-wrong"}`}><div className="flex gap-3">{isCorrect ? <Check className="shrink-0"/> : <X className="shrink-0"/>}<div><strong>{isCorrect ? "Boa! Você entendeu." : "Ainda não — vamos corrigir."}</strong>{!isCorrect && <p className="mt-1 text-sm">Resposta: {question.correctAnswer}</p>}<p className="mt-2 text-sm leading-6">{question.explanation}</p></div></div>{questionIndex === content.checks.length - 1 ? <SubmitButton pendingText="Salvando progresso..." className="btn btn-primary mt-5 w-full">Concluir microaula</SubmitButton> : <button type="button" className="btn btn-primary mt-5 w-full" onClick={advance}>Continuar <ArrowRight size={18}/></button>}</div>}
      </section>}

      {topicId && <button type="button" onClick={()=>setShowHelp(true)} className="btn btn-ghost mt-5 w-full"><Brain size={17}/>Não entendi isso</button>}</>}
    </div>
  </form>;
}
