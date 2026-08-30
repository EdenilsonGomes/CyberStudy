"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, HelpCircle, Lightbulb, RotateCcw } from "lucide-react";
import { runPilotCommand, startPilot } from "@/app/pilot-actions";
import { LessonProgress } from "./lesson-progress";
import { SubmitButton } from "./submit-button";
import { helpReasons, validateAnswer, validateDraft, type Activity, type Answer, type HelpReason, type InteractiveLesson, type LessonCommand, type LessonFeedback, type LessonState, type summarizeLesson } from "@/lib/interactive-lesson";

type Hint = { reason: HelpReason; text: string; level: number } | null;
export type InteractiveRunnerProps = {
  lesson: InteractiveLesson; sessionId: string; initialState: LessonState;
  initialFeedback: LessonFeedback | null; initialHint: Hint;
  initialSummary: ReturnType<typeof summarizeLesson> | null;
};

function emptyAnswer(step: Activity): Answer {
  return step.type === "switches" ? "0".repeat(step.weights.length) : step.type === "order" ? [] : step.type === "match" ? {} : "";
}

function ActivityInput({ step, answer, onChange, disabled, revealed }: { step: Activity; answer: Answer; onChange: (answer: Answer) => void; disabled: boolean; revealed: boolean }) {
  if (step.type === "switches" || step.type === "choice") {
    const pattern = step.type === "switches" ? String(answer) : step.pattern;
    const sum = step.weights.reduce((value, weight, index) => value + (pattern[index] === "1" ? weight : 0), 0);
    const showSum = (step.type === "switches" && step.showTotal) || revealed;
    return <>
      <div className="bit-lab">
        <div className="lab-caption"><span>Pesos das posições</span>{step.type === "switches" && <span>Alvo <b>{step.target}</b></span>}</div>
        <div className="bit-panel" style={{ gridTemplateColumns: `repeat(${step.weights.length}, minmax(0, 1fr))` }}>
          {step.weights.map((weight, index) => <div key={weight} className="bit-column"><span className="bit-weight">{weight}</span>{step.type === "switches" ? <button type="button" className={`bit-switch ${pattern[index] === "1" ? "bit-on" : ""}`} disabled={disabled} aria-label={`Bit de peso ${weight}`} aria-pressed={pattern[index] === "1"} onClick={() => { const bits = pattern.split(""); bits[index] = bits[index] === "1" ? "0" : "1"; onChange(bits.join("")); }}><strong>{pattern[index]}</strong><span>{pattern[index] === "1" ? "ligado" : "desligado"}</span></button> : <div className={`bit-switch ${pattern[index] === "1" ? "bit-on" : ""}`}><strong>{pattern[index]}</strong></div>}</div>)}
        </div>
        <div className="bit-total" aria-live="polite">{showSum ? <><span>{step.weights.filter((_, index) => pattern[index] === "1").join(" + ") || "Nenhum peso ligado"}</span><strong>= {sum}</strong></> : <><span>Some apenas os pesos ligados</span><strong>= ?</strong></>}</div>
      </div>
      {step.type === "choice" && <div className="lab-choices" role="group" aria-label="Escolha o valor decimal">{step.options.map((option) => <button type="button" className={`lesson-option ${answer === option ? "lesson-option-selected" : ""}`} aria-pressed={answer === option} disabled={disabled} key={option} onClick={() => onChange(option)}><span>{option}</span>{answer === option && <Check size={18}/>}</button>)}</div>}
    </>;
  }
  if (step.type === "match") return <div className="match-lab">{step.items.map((item) => <label className="match-row" key={item.id}><span className="match-source">{item.label}</span><span aria-hidden="true">→</span><select className="field" aria-label={`Valor decimal de ${item.label}`} disabled={disabled} value={(answer as Record<string, string>)[item.id] || ""} onChange={(event) => onChange({ ...(answer as Record<string, string>), [item.id]: event.target.value })}><option value="">Escolher</option>{step.options.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>)}</div>;
  const order = answer as string[];
  return <div className="order-lab"><p className="lab-caption">Sua sequência · esquerda → direita</p><ol className="order-slots" aria-label="Sequência escolhida">{step.items.map((_, index) => { const item = step.items.find((entry) => entry.id === order[index]); return <li key={index}>{item ? <button type="button" disabled={disabled} aria-label={`Remover ${item.label} da posição ${index + 1}`} onClick={() => onChange(order.filter((__, position) => position !== index))}>{item.label}<small>remover</small></button> : <span aria-label={`Posição ${index + 1} vazia`}>?</span>}</li>; })}</ol><div className="order-bank" role="group" aria-label="Pesos disponíveis">{step.items.map((item) => <button type="button" className="btn btn-secondary" key={item.id} disabled={disabled || order.includes(item.id)} onClick={() => onChange([...order, item.id])}>{item.label}</button>)}</div><p className="muted text-sm">Toque em um peso para colocá-lo. Toque na sequência para removê-lo.</p></div>;
}

export function InteractiveLessonRunner({ lesson, sessionId, initialState, initialFeedback, initialHint, initialSummary }: InteractiveRunnerProps) {
  const [state, setState] = useState(initialState);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [hint, setHint] = useState(initialHint);
  const [summary, setSummary] = useState(initialSummary);
  const step = lesson.steps[state.index];
  const [answer, setAnswer] = useState<Answer>(() => {
    const current = lesson.steps[initialState.index];
    return current ? initialState.evidence[current.id]?.attempts.at(-1)?.answer ?? emptyAnswer(current) : "";
  });
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [draftNotice, setDraftNotice] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const clock = useRef({ since: 0, accumulated: 0 });
  const lock = useRef(false);
  const draftKey = `cyberstudy:pilot:${sessionId}`;

  useEffect(() => {
    // A local draft supplements server checkpoints; only the server records attempts/results.
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (!initialState.checked && saved?.revision === initialState.revision && step && validateDraft(step, saved.answer)) {
        // Browser-only draft hydration must happen after SSR; bounded to one render per session.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAnswer(saved.answer); setDraftNotice("Rascunho recuperado neste dispositivo.");
      }
    } catch { /* Storage may be disabled; server checkpoints still work. */ }
    clock.current.since = document.hidden ? 0 : performance.now();
    const visibility = () => {
      const timer = clock.current;
      if (document.hidden) { if (timer.since) timer.accumulated += (performance.now() - timer.since) / 1000; timer.since = 0; }
      else timer.since = performance.now();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
    // Initialize once for this persisted session, not on every answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const changeAnswer = (next: Answer) => {
    setAnswer(next); setDraftNotice("");
    try { sessionStorage.setItem(draftKey, JSON.stringify({ revision: state.revision, answer: next })); } catch { /* optional */ }
  };

  const send = (type: LessonCommand["type"], reason?: HelpReason) => {
    if (lock.current) return;
    lock.current = true; setError("");
    const timer = clock.current;
    const seconds = timer.accumulated + (timer.since ? (performance.now() - timer.since) / 1000 : 0);
    startTransition(async () => {
      try {
        const result = await runPilotCommand(sessionId, { revision: state.revision, type, reason, answer: type === "answer" ? answer : undefined, seconds });
        if (!result.ok) { setError(result.error); return; }
        clock.current = { accumulated: 0, since: document.hidden ? 0 : performance.now() };
        setState(result.state); setFeedback(result.feedback); setHint(result.hint); setSummary(result.summary);
        const nextStep = lesson.steps[result.state.index];
        if (result.state.index !== state.index || type === "retry") {
          setAnswer(nextStep ? result.state.evidence[nextStep.id]?.attempts.at(-1)?.answer ?? emptyAnswer(nextStep) : "");
          setShowHelp(false); setDraftNotice("");
          requestAnimationFrame(() => { titleRef.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); });
        } else if (result.state.checked && nextStep) {
          setAnswer(result.state.evidence[nextStep.id]?.attempts.at(-1)?.answer ?? answer);
        }
        if (type === "hint") setShowHelp(true);
        try {
          if (type === "hint" && !result.state.checked && result.state.index === state.index) sessionStorage.setItem(draftKey, JSON.stringify({ revision: result.state.revision, answer }));
          else sessionStorage.removeItem(draftKey);
        } catch { /* optional */ }
      } catch { setError("A conexão caiu. Tente novamente: respostas já salvas não serão duplicadas."); }
      finally { lock.current = false; }
    });
  };

  if (state.completed && summary) return <section className="lesson-card card interactive-lesson">
    <LessonProgress backHref="/revisoes" label="Piloto concluído" current={lesson.steps.length} total={lesson.steps.length} completed={lesson.steps.length}/>
    <div className="lab-body"><span className="lab-tag"><Check size={16}/>Progresso salvo</span><h1 tabIndex={-1} ref={titleRef} className="lab-title">Você colocou os bits para trabalhar.</h1><p className="muted">{summary.independent} de {summary.total} desafios resolvidos de primeira, sem pistas.</p>
      <div className="lab-result-stats"><div><strong>{summary.independent}</strong><span>sem ajuda</span></div><div><strong>{summary.assisted}</strong><span>com apoio ou correção</span></div><div><strong>{Math.floor(state.elapsedSeconds / 60)}:{String(state.elapsedSeconds % 60).padStart(2, "0")}</strong><span>tempo em primeiro plano</span></div></div>
      <div className="callout"><strong>{summary.reinforce.length ? "O próximo passo é reforçar" : "Você aplicou a regra em novas situações"}</strong><p className="muted mt-2">{summary.reinforce.length ? summary.reinforce.join(" · ") : "Retome outro dia para verificar o que ficou. Uma sessão não comprova domínio duradouro."}</p></div>
      <Link href="/revisoes" className="btn btn-primary w-full">Ir para Praticar <ArrowRight size={18}/></Link><Link href="/progresso" className="btn btn-ghost w-full">Ver meu progresso</Link>
      <details className="lab-evidence"><summary>Como foi cada atividade</summary>{summary.rows.map((row) => <div key={row.id}><strong>{row.title}</strong><p>{!row.assessment ? "Exploração guiada" : row.independent ? "Acertou de primeira, sem ajuda" : row.corrected ? "Acertou com apoio ou correção" : "Ainda precisa de reforço"}</p><small>{row.attempts} tentativa(s) · {row.hints} pista(s)</small></div>)}</details>
      <form action={startPilot}><SubmitButton pendingText="Abrindo..." className="btn btn-ghost w-full"><RotateCcw size={16}/>Praticar novamente</SubmitButton></form>
    </div></section>;

  return <section className="lesson-card card interactive-lesson" aria-busy={pending}>
    <LessonProgress backHref="/aulas/piloto-binario" label="Laboratório de bits" current={state.index + 1} total={lesson.steps.length} completed={state.index + (state.checked ? 1 : 0)}/>
    <div className="lab-body">
      {showHelp ? <section className="lab-help"><button className="focus-back" disabled={pending} onClick={() => setShowHelp(false)}><ArrowLeft size={18}/>Voltar à atividade</button><span className="lab-tag"><Lightbulb size={16}/>CYBER · nesta etapa</span><h1 className="lab-title">Vamos tentar de outra forma.</h1><p className="muted text-sm">{step.title}</p>{hint ? <><div className="lab-hint" role="status"><strong>{helpReasons[hint.reason]}</strong><p>{hint.text}</p></div><button disabled={pending} onClick={() => setShowHelp(false)} className="btn btn-primary w-full">Entendi, quero tentar</button>{hint.level < 2 ? <button disabled={pending} onClick={() => send("hint", hint.reason)} className="btn btn-ghost w-full">Ainda não · outra pista</button> : <p className="muted text-sm">Experimente a atividade. Depois de responder, vamos mostrar o raciocínio completo.</p>}</> : <div className="grid gap-2">{(Object.entries(helpReasons) as [HelpReason, string][]).map(([reason, label]) => <button key={reason} disabled={pending} className="lesson-option" onClick={() => send("hint", reason)}>{label}<ArrowRight size={16}/></button>)}</div>}<p className="muted text-xs">Pedir uma pista é parte do aprendizado. A ajuda fica registrada separadamente.</p></section> : <>
        <div><span className="lab-tag">{step.assessment ? "Sua vez de experimentar" : "Explore com ajuda"}</span><h1 ref={titleRef} tabIndex={-1} className="lab-title">{step.title}</h1><p className="lab-instruction">{step.instruction}</p></div>
        <ActivityInput step={step} answer={answer} onChange={changeAnswer} disabled={pending || state.checked} revealed={state.checked}/>
        {draftNotice && <p className="muted text-xs">{draftNotice}</p>}
        {feedback && state.checked ? <div className={`lab-feedback ${feedback.correct ? "lesson-feedback-correct" : "lesson-feedback-wrong"}`} role="status"><strong>{feedback.correct ? "Isso! Veja o porquê." : "Ainda não. Vamos entender."}</strong><p>{feedback.explanation}</p>{!feedback.correct && <p><b>Resposta:</b> {feedback.solution}</p>}<button disabled={pending} className="btn btn-primary mt-4 w-full" onClick={() => send("next")}>{state.index === lesson.steps.length - 1 ? "Ver meu resultado" : "Próximo desafio"}<ArrowRight size={17}/></button>{!feedback.correct && state.evidence[step.id].attempts.length < 20 && <button disabled={pending} className="btn btn-ghost mt-2 w-full" onClick={() => send("retry")}><RotateCcw size={16}/>Tentar novamente</button>}{state.evidence[step.id].attempts.length > 1 && <p className="muted text-xs mt-3">Sua primeira tentativa foi preservada.</p>}</div> : <button disabled={pending || !validateAnswer(step, answer)} className="btn btn-primary w-full" onClick={() => send("answer")}>{pending ? "Salvando..." : step.assessment ? "Responder" : "Conferir minha montagem"}<ArrowRight size={18}/></button>}
        <button disabled={pending} className="btn btn-ghost w-full" onClick={() => { setShowHelp(true); setHint(null); }}><HelpCircle size={17}/>Não entendi isso</button>
        <p className="lab-save-note">Respostas e pistas salvas a cada ação. Pode sair e continuar depois.</p>
      </>}
      {error && <p className="lab-error" role="alert">{error}</p>}
    </div>
  </section>;
}
