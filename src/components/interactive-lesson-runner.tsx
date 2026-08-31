"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, HelpCircle, Lightbulb, RotateCcw } from "lucide-react";
import { runPilotCommand, startPilot } from "@/app/pilot-actions";
import { runStudyCommand } from "@/app/study-actions";
import { LessonProgress } from "./lesson-progress";
import { SubmitButton } from "./submit-button";
import { helpReasons, validateAnswer, validateDraft, type Activity, type Answer, type HelpReason, type InteractiveLesson, type LessonCommand, type LessonFeedback, type LessonState, type summarizeLesson } from "@/lib/interactive-lesson";

type Hint = { reason: HelpReason; text: string; level: number } | null;
export type InteractiveRunnerProps = {
  lesson: InteractiveLesson; sessionId: string; initialState: LessonState;
  initialFeedback: LessonFeedback | null; initialHint: Hint;
  initialSummary: ReturnType<typeof summarizeLesson> | null;
  materialStudy?: boolean; backHref?: string; level?: string; continueHref?: string;
};

function emptyAnswer(step: Activity): Answer {
  return step.type === "switches" ? "0".repeat(step.weights.length) : step.type === "order" ? [] : step.type === "match" ? {} : "";
}

function ActivityInput({ step, answer, onChange, disabled, revealed }: { step: Activity; answer: Answer; onChange: (answer: Answer) => void; disabled: boolean; revealed: boolean }) {
  if (step.type === "scenario") return <><div className="scenario-panels">{step.scene.map((panel, index) => <div key={index}><span>{panel.label}</span><strong>{panel.value}</strong></div>)}</div><div className="grid gap-3" role="group" aria-label="Escolha sua resposta">{step.options.map((option) => <button type="button" key={option} aria-pressed={answer === option} disabled={disabled} className={`lesson-option ${answer === option ? "lesson-option-selected" : ""}`} onClick={() => onChange(option)}><span>{option}</span>{answer === option && <Check size={18}/>}</button>)}</div></>;
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
  if (step.type === "match") return <div className="match-lab">{step.items.map((item) => <label className="match-row" key={item.id}><span className="match-source">{item.label}</span><span aria-hidden="true">→</span><select className="field" aria-label={`Associar ${item.label}`} disabled={disabled} value={(answer as Record<string, string>)[item.id] || ""} onChange={(event) => onChange({ ...(answer as Record<string, string>), [item.id]: event.target.value })}><option value="">Escolher</option>{step.options.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>)}</div>;
  const order = answer as string[];
  return <div className="order-lab"><p className="lab-caption">Sua sequência · na ordem correta</p><ol className="order-slots" aria-label="Sequência escolhida">{step.items.map((_, index) => { const item = step.items.find((entry) => entry.id === order[index]); return <li key={index}>{item ? <button type="button" disabled={disabled} aria-label={`Remover ${item.label} da posição ${index + 1}`} onClick={() => onChange(order.filter((__, position) => position !== index))}>{item.label}<small>remover</small></button> : <span aria-label={`Posição ${index + 1} vazia`}>?</span>}</li>; })}</ol><div className="order-bank" role="group" aria-label="Itens disponíveis">{step.items.map((item) => <button type="button" className="btn btn-secondary" key={item.id} disabled={disabled || order.includes(item.id)} onClick={() => onChange([...order, item.id])}>{item.label}</button>)}</div><p className="muted text-sm">Toque em um item para colocá-lo. Toque na sequência para removê-lo.</p></div>;
}

export function InteractiveLessonRunner({ lesson, sessionId, initialState, initialFeedback, initialHint, initialSummary, materialStudy = false, backHref = "/aulas/piloto-binario", level, continueHref = "/disciplinas" }: InteractiveRunnerProps) {
  const router = useRouter();
  const diagnostic = lesson.mode === "diagnostic";
  const [exitOpen, setExitOpen] = useState(false);
  const exitDialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState(initialState);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [hint, setHint] = useState(initialHint);
  const [summary, setSummary] = useState(initialSummary);
  const step = lesson.steps[state.index];
  const [answer, setAnswer] = useState<Answer>(() => {
    const current = lesson.steps[initialState.index];
    return current ? initialState.draft ?? initialState.evidence[current.id]?.attempts.at(-1)?.answer ?? emptyAnswer(current) : "";
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
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
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

  useEffect(() => {
    if (exitOpen) exitDialog.current?.showModal();
    else exitDialog.current?.close();
  }, [exitOpen]);

  useEffect(() => {
    if (state.completed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.completed]);

  const changeAnswer = (next: Answer) => {
    setAnswer(next); setDraftNotice("");
    try { localStorage.setItem(draftKey, JSON.stringify({ revision: state.revision, answer: next })); } catch { /* optional */ }
  };

  const send = (type: LessonCommand["type"], reason?: HelpReason, exit = false) => {
    if (lock.current) return;
    lock.current = true; setError("");
    const timer = clock.current;
    const seconds = timer.accumulated + (timer.since ? (performance.now() - timer.since) / 1000 : 0);
    startTransition(async () => {
      try {
        const result = await (materialStudy ? runStudyCommand : runPilotCommand)(sessionId, { revision: state.revision, type, reason, answer: type === "answer" || type === "checkpoint" ? answer : undefined, seconds });
        if (!result.ok) { setError(result.error); return; }
        clock.current = { accumulated: 0, since: document.hidden ? 0 : performance.now() };
        setState(result.state); setFeedback(result.feedback); setHint(result.hint); setSummary(result.summary);
        const nextStep = lesson.steps[result.state.index];
        if (!result.applied) {
          setAnswer(nextStep ? result.state.draft ?? result.state.evidence[nextStep.id]?.attempts.at(-1)?.answer ?? emptyAnswer(nextStep) : "");
          setExitOpen(false); setShowHelp(false);
          setError("Esta sessão mudou em outra aba. Recuperamos a etapa salva; confira sua resposta antes de continuar.");
          try { localStorage.removeItem(draftKey); } catch { /* optional */ }
          return;
        }
        if (result.state.index !== state.index || type === "retry") {
          setAnswer(nextStep ? result.state.draft ?? result.state.evidence[nextStep.id]?.attempts.at(-1)?.answer ?? emptyAnswer(nextStep) : "");
          setShowHelp(false); setDraftNotice("");
          requestAnimationFrame(() => { titleRef.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); });
        } else if (result.state.checked && nextStep) {
          setAnswer(result.state.evidence[nextStep.id]?.attempts.at(-1)?.answer ?? answer);
        }
        if (type === "hint") setShowHelp(true);
        try {
          if ((type === "hint" || type === "checkpoint") && !result.state.checked && result.state.index === state.index) localStorage.setItem(draftKey, JSON.stringify({ revision: result.state.revision, answer: result.state.draft ?? answer }));
          else localStorage.removeItem(draftKey);
        } catch { /* optional */ }
        if (exit) {
          if (result.state.revision === state.revision + 1) router.push(backHref);
          else { setExitOpen(false); setError("Esta sessão mudou em outra aba. Recuperamos a etapa salva; confira antes de sair."); }
        }
      } catch { setError("Não foi possível confirmar o salvamento. Tente novamente ou recarregue a página; seu rascunho fica neste dispositivo."); }
      finally { lock.current = false; }
    });
  };

  if (state.completed && summary) return <section className="lesson-card card interactive-lesson">
    <LessonProgress backHref={diagnostic ? continueHref : "/revisoes"} label={diagnostic ? "Ponto de partida encontrado" : materialStudy ? "Aula concluída" : "Piloto concluído"} current={lesson.steps.length} total={lesson.steps.length} completed={lesson.steps.length}/>
    <div className="lab-body"><span className="lab-tag"><Check size={16}/>Progresso salvo</span><h1 tabIndex={-1} ref={titleRef} className="lab-title">{diagnostic ? "Agora sabemos por onde começar." : materialStudy ? "Você colocou o conhecimento em prática." : "Você colocou os bits para trabalhar."}</h1><p className="muted">{summary.independent} de {summary.total} desafios resolvidos de primeira, sem pistas.</p>
      <div className="lab-result-stats"><div><strong>{summary.independent}</strong><span>sem ajuda</span></div><div><strong>{summary.assisted}</strong><span>com apoio ou correção</span></div><div><strong>{Math.floor(state.elapsedSeconds / 60)}:{String(state.elapsedSeconds % 60).padStart(2, "0")}</strong><span>tempo em primeiro plano</span></div></div>
      <div className="callout"><strong>{summary.reinforce.length ? "O próximo passo é reforçar" : "Você aplicou a regra em novas situações"}</strong><p className="muted mt-2">{summary.reinforce.length ? summary.reinforce.join(" · ") : "Retome outro dia para verificar o que ficou. Uma sessão não comprova domínio duradouro."}</p></div>
      {diagnostic && <div className="grid gap-3">{[...new Set(summary.rows.map((row) => row.concept))].map((concept) => { const rows = summary.rows.filter((row) => row.concept === concept); return <div key={concept} className="callout"><strong>{concept}</strong><p className="muted mt-1">{rows.length >= 2 && rows.every((row) => row.independent) ? "Começar pela aplicação, com novas verificações." : "Começar pela base, com exemplos e pistas."}</p></div>; })}<p className="muted text-sm">Este é um ponto de partida provisório para os conceitos avaliados, não uma certificação de domínio. O restante ainda não foi avaliado.</p></div>}
      <Link href={materialStudy ? continueHref : "/revisoes"} className="btn btn-primary w-full">{diagnostic ? "Começar meu estudo" : materialStudy ? "Continuar trilha" : "Ir para Praticar"} <ArrowRight size={18}/></Link><Link href="/progresso" className="btn btn-ghost w-full">Ver meu progresso</Link>
      <details className="lab-evidence"><summary>Como foi cada atividade</summary>{summary.rows.map((row) => <div key={row.id}><strong>{row.title}</strong><p>{!row.assessment ? "Exploração guiada" : row.independent ? "Acertou de primeira, sem ajuda" : row.corrected ? "Acertou com apoio ou correção" : "Ainda precisa de reforço"}</p><small>{row.attempts} tentativa(s) · {row.hints} pista(s)</small>{diagnostic && <><p><b>Resposta:</b> {row.solution}</p><p>{row.explanation}</p></>}</div>)}</details>
      {!materialStudy && <form action={startPilot}><SubmitButton pendingText="Abrindo..." className="btn btn-ghost w-full"><RotateCcw size={16}/>Praticar novamente</SubmitButton></form>}
    </div></section>;

  return <section className="lesson-card card interactive-lesson" aria-busy={pending}>
    <LessonProgress backHref={backHref} onExit={() => setExitOpen(true)} label={diagnostic ? "Seu ponto de partida" : materialStudy ? "Aprender fazendo" : "Laboratório de bits"} current={state.index + 1} total={lesson.steps.length} completed={state.index + (state.checked ? 1 : 0)}/>
    <div className="lab-body">
      {showHelp ? <section className="lab-help"><button className="focus-back" disabled={pending} onClick={() => setShowHelp(false)}><ArrowLeft size={18}/>Voltar à atividade</button><span className="lab-tag"><Lightbulb size={16}/>CYBER · nesta etapa</span><h1 className="lab-title">Vamos tentar de outra forma.</h1><p className="muted text-sm">{step.title}</p>{hint ? <><div className="lab-hint" role="status"><strong>{helpReasons[hint.reason]}</strong><p>{hint.text}</p></div><button disabled={pending} onClick={() => setShowHelp(false)} className="btn btn-primary w-full">Entendi, quero tentar</button>{hint.level < 2 ? <button disabled={pending} onClick={() => send("hint", hint.reason)} className="btn btn-ghost w-full">Ainda não · outra pista</button> : <p className="muted text-sm">Experimente a atividade. Depois de responder, vamos mostrar o raciocínio completo.</p>}</> : <div className="grid gap-2">{(Object.entries(helpReasons) as [HelpReason, string][]).map(([reason, label]) => <button key={reason} disabled={pending} className="lesson-option" onClick={() => send("hint", reason)}>{label}<ArrowRight size={16}/></button>)}</div>}<p className="muted text-xs">Pedir uma pista é parte do aprendizado. A ajuda fica registrada separadamente.</p></section> : <>
        <div><span className="lab-tag">{step.assessment ? "Sua vez de experimentar" : "Explore com ajuda"}</span><h1 ref={titleRef} tabIndex={-1} className="lab-title">{step.title}</h1><p className="lab-instruction">{step.instruction}</p></div>
        {state.index === 0 && level === "application" && <p className="callout text-sm">Seu diagnóstico indicou familiaridade. Começamos pela aplicação; as pistas continuam disponíveis.</p>}
        {step.brief && <div className="callout"><p>{step.brief}</p></div>}
        <ActivityInput step={step} answer={answer} onChange={changeAnswer} disabled={pending || state.checked} revealed={state.checked}/>
        {diagnostic && state.checked && <div role="status" className="callout"><strong>Resposta salva.</strong><p className="muted mt-2 text-sm">A correção fica para o final para não influenciar as próximas respostas.</p><button disabled={pending} className="btn btn-primary mt-4 w-full" onClick={() => send("next")}>{state.index === lesson.steps.length - 1 ? "Ver meu ponto de partida" : "Próxima questão"}</button></div>}
        {draftNotice && <p className="muted text-xs">{draftNotice}</p>}
        {feedback && state.checked ? <div className={`lab-feedback ${feedback.correct ? "lesson-feedback-correct" : "lesson-feedback-wrong"}`} role="status"><strong>{feedback.correct ? "Isso! Veja o porquê." : "Ainda não. Vamos entender."}</strong><p>{feedback.explanation}</p>{!feedback.correct && <p><b>Resposta:</b> {feedback.solution}</p>}<button disabled={pending} className="btn btn-primary mt-4 w-full" onClick={() => send("next")}>{state.index === lesson.steps.length - 1 ? "Ver meu resultado" : "Próximo desafio"}<ArrowRight size={17}/></button>{!feedback.correct && state.evidence[step.id].attempts.length < 20 && <button disabled={pending} className="btn btn-ghost mt-2 w-full" onClick={() => send("retry")}><RotateCcw size={16}/>Tentar novamente</button>}{state.evidence[step.id].attempts.length > 1 && <p className="muted text-xs mt-3">Sua primeira tentativa foi preservada.</p>}</div> : !state.checked && <button disabled={pending || !validateAnswer(step, answer)} className="btn btn-primary w-full" onClick={() => send("answer")}>{pending ? "Salvando..." : step.assessment ? "Responder" : "Conferir minha montagem"}<ArrowRight size={18}/></button>}
        {diagnostic ? !state.checked && <button disabled={pending} className="btn btn-ghost w-full" onClick={() => send("unknown")}>Ainda não sei</button> : <button disabled={pending} className="btn btn-ghost w-full" onClick={() => { setShowHelp(true); setHint(null); }}><HelpCircle size={17}/>Não entendi isso</button>}
        {step.source && !diagnostic && state.checked && <details className="lab-evidence"><summary>Fonte desta atividade</summary><p>{step.source.title}</p><blockquote className="muted text-sm mt-2">{step.source.quote}</blockquote></details>}
        <p className="lab-save-note">{materialStudy && !diagnostic && state.checked && state.index === lesson.steps.length - 1 ? "Aula concluída e avanço salvo. Veja o resultado para seguir na trilha." : "Respostas e pistas salvas a cada ação. Pode sair e continuar depois."}</p>
      </>}
      {error && <div className="lab-error" role="alert"><p>{error}</p><button type="button" className="btn btn-ghost mt-3" onClick={() => window.location.reload()}>Recarregar e recuperar</button></div>}
    </div>
    <dialog ref={exitDialog} className="study-exit-dialog" onCancel={() => setExitOpen(false)} onClose={() => setExitOpen(false)} aria-labelledby="exit-title"><h2 id="exit-title" className="section-title">Pausar a aula?</h2><p className="muted mt-3">Vamos salvar esta etapa e sua seleção. Na Trilha, toque em Continuar para retomar daqui.</p><div className="grid gap-3 mt-5"><button disabled={pending} className="btn btn-primary" onClick={() => setExitOpen(false)} autoFocus>Continuar estudando</button><button disabled={pending} className="btn btn-secondary" onClick={() => send("checkpoint", undefined, true)}>{pending ? "Salvando..." : "Salvar e sair"}</button></div>{error && <p role="alert" className="lab-error mt-3">{error}</p>}</dialog>
  </section>;
}
