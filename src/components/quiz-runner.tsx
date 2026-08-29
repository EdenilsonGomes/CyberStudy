"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { submitQuiz } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

type QuizQuestionData = { id: string; prompt: string; options: string[]; correctAnswer: string; explanation: string };

export function QuizRunner({ quizId, title, questions, reviewHref }: { quizId: string; title: string; questions: QuizQuestionData[]; reviewHref: string }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const question = questions[index];
  if (!question) return <div className="empty">Este quiz ainda não tem questões.</div>;
  const answer = answers[question.id] || "";
  const correct = answer === question.correctAnswer;
  const next = () => { setChecked(false); setIndex((current) => Math.min(current + 1, questions.length - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const retry = () => { setAnswers((current) => { const copy = { ...current }; delete copy[question.id]; return copy; }); setChecked(false); };

  return <form action={submitQuiz} className="quiz-runner">
    <input type="hidden" name="quizId" value={quizId}/>{questions.map((item) => <input key={item.id} type="hidden" name={`q_${item.id}`} value={answers[item.id] || ""}/>) }
    <div className="quiz-head"><Link href="/revisoes" className="focus-icon-button" aria-label="Sair do exercício"><ArrowLeft size={20}/></Link><div className="min-w-0 flex-1"><div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold"><span className="truncate">{title}</span><span className="muted shrink-0">{index + 1}/{questions.length}</span></div><div className="progress"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }}/></div></div></div>
    <div className="quiz-body"><p className="eyebrow">Exercício</p><h2 className="text-xl font-extrabold leading-8">{question.prompt}</h2><div className="mt-6 grid gap-3">{question.options.map((option, optionIndex) => <button key={option} type="button" disabled={checked} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))} className={`quiz-choice ${answer === option ? "quiz-choice-selected" : ""}`}><span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong>{answer === option && <Check size={18}/>}</button>)}</div>
      {!checked ? <button type="button" disabled={!answer} className="btn btn-primary mt-7 w-full" onClick={() => setChecked(true)}>Responder</button> : <section className={`quiz-feedback ${correct ? "quiz-feedback-correct" : "quiz-feedback-wrong"}`}><div className="flex gap-3">{correct ? <Check className="shrink-0"/> : <X className="shrink-0"/>}<div><h3 className="font-black">{correct ? "Resposta correta" : "Ainda não."}</h3>{!correct && <p className="mt-1 text-sm">A resposta correta é: <strong>{question.correctAnswer}</strong></p>}<p className="muted mt-2 text-sm leading-6">{question.explanation}</p></div></div>{index === questions.length - 1 ? <SubmitButton pendingText="Salvando resultado..." className="btn btn-primary mt-5 w-full">Ver resultado</SubmitButton> : correct ? <><button type="button" className="btn btn-primary mt-5 w-full" onClick={next}>Próxima questão <ArrowRight size={17}/></button><Link className="btn btn-ghost mt-2 w-full" href={reviewHref}>Revisar conceito</Link></> : <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" className="btn btn-primary" onClick={retry}><RotateCcw size={17}/>Tentar de novo</button><button type="button" className="btn btn-secondary" onClick={next}>Continuar</button></div>}</section>}
    </div>
  </form>;
}
