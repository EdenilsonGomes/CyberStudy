import Link from "next/link";
import { BookOpenCheck, Brain, Check, CheckCircle2, Flame, FlaskConical, MessageCircleQuestion, Play, RotateCcw, Sparkles } from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { difficulties, disciplines, quizAttempts, quizQuestions, quizzes, reviews, studySessions, topics, tutorMessages } from "@/db/schema";
import { createDifficulty, generateQuiz, startGuidedSession, submitQuiz, testUnderstanding } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { TutorChat } from "@/components/tutor-chat";
import { learningRhythm, pickNextTopic } from "@/lib/learning";

type StudyQuery = { topico?: string; dificuldade?: string; quiz?: string; tentativa?: string; entendimento?: string; erro?: string; sessao?: string; guiada?: string };

export default async function StudyPage({ searchParams }: { searchParams: Promise<StudyQuery> }) {
  const query = await searchParams;
  const db = getDb();
  const [disciplineRows, topicRows] = await Promise.all([
    db.select().from(disciplines).where(eq(disciplines.status, "ATIVA")),
    db.select().from(topics).orderBy(asc(topics.createdAt)),
  ]);
  let activeDifficulty: typeof difficulties.$inferSelect | undefined;
  let messages: typeof tutorMessages.$inferSelect[] = [];
  if (query.dificuldade) {
    [activeDifficulty] = await db.select().from(difficulties).where(eq(difficulties.id, query.dificuldade)).limit(1);
    if (activeDifficulty) messages = await db.select().from(tutorMessages).where(eq(tutorMessages.difficultyId, activeDifficulty.id)).orderBy(asc(tutorMessages.createdAt));
  }
  let activeQuiz: typeof quizzes.$inferSelect | undefined;
  let questions: typeof quizQuestions.$inferSelect[] = [];
  let attempt: typeof quizAttempts.$inferSelect | undefined;
  if (query.quiz) {
    [activeQuiz] = await db.select().from(quizzes).where(eq(quizzes.id, query.quiz)).limit(1);
    questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, query.quiz));
    if (query.tentativa) [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, query.tentativa)).limit(1);
  }
  let understanding: typeof studySessions.$inferSelect | undefined;
  if (query.entendimento) [understanding] = await db.select().from(studySessions).where(eq(studySessions.id, query.entendimento)).limit(1);

  const selectedTopicId = query.topico || activeDifficulty?.topicId || activeQuiz?.topicId || "";
  const selectedTopic = topicRows.find((topic) => topic.id === selectedTopicId) ?? pickNextTopic(topicRows);
  const selectedDisciplineId = selectedTopic?.disciplineId || activeDifficulty?.disciplineId || activeQuiz?.disciplineId || disciplineRows[0]?.id || "";
  const selectedDiscipline = disciplineRows.find((discipline) => discipline.id === selectedDisciplineId);
  let nextReview: typeof reviews.$inferSelect | undefined;
  let rhythm = { streak: 0, completedToday: false };
  if (attempt) {
    const [reviewRows, recentSessions] = await Promise.all([
      activeQuiz?.topicId ? db.select().from(reviews).where(and(eq(reviews.topicId, activeQuiz.topicId), eq(reviews.status, "PENDENTE"))).orderBy(asc(reviews.scheduledFor)).limit(1) : Promise.resolve([]),
      db.select({ createdAt: studySessions.createdAt }).from(studySessions).orderBy(desc(studySessions.createdAt)).limit(120),
    ]);
    nextReview = reviewRows[0];
    rhythm = learningRhythm(recentSessions.map((session) => session.createdAt));
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <header><p className="muted text-sm">Sessões curtas, progresso real</p><h1 className="page-title">Estudar agora</h1></header>
    {query.erro && <p className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>Não foi possível concluir esta ação. Verifique a configuração da IA e tente novamente.</p>}

    {query.sessao === "1" && selectedTopic && !activeDifficulty && !activeQuiz && <section className="card overflow-hidden">
      <div className="h-2 bg-[var(--brand)]"/><div className="p-5 md:p-8">
        <span className="badge mb-4">Sessão guiada · cerca de 10 minutos</span>
        <p className="muted text-sm">{selectedDiscipline?.name}</p><h2 className="mt-1 text-2xl font-extrabold md:text-3xl">{selectedTopic.name}</h2>
        <div className="mt-7 grid grid-cols-4 gap-2" aria-label="Etapas da sessão">
          {["Entender", "Ver exemplo", "Responder", "Praticar"].map((label, index) => <div key={label} className="text-center"><span className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${index === 0 ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] muted"}`}>{index + 1}</span><span className="muted mt-2 hidden text-xs sm:block">{label}</span></div>)}
        </div>
        <p className="muted mt-7 text-sm leading-6">O tutor começa com uma explicação simples, mostra um exemplo e verifica o que você entendeu. No final, você faz 5 questões e a próxima revisão fica agendada.</p>
        <form action={startGuidedSession} className="mt-6"><input type="hidden" name="topicId" value={selectedTopic.id}/><SubmitButton pendingText="Preparando sua aula..." className="btn btn-primary w-full md:w-auto"><Play size={18} fill="currentColor"/> Começar sessão</SubmitButton></form>
      </div>
    </section>}

    {activeDifficulty && <section className="space-y-4">
      {query.guiada === "1" && <div className="card p-4"><div className="mb-3 flex items-center justify-between text-xs font-bold"><span>SESSÃO GUIADA</span><span className="muted">Explicação e compreensão</span></div><div className="progress"><span style={{ width: "65%" }}/></div></div>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <TutorChat difficultyId={activeDifficulty.id} guided={query.guiada === "1"} messages={messages.map(({ id, role, mode, content }) => ({ id, role, mode, content }))}/>
        <aside className="space-y-4">
          {query.guiada === "1" && <div className="card p-5"><span className="badge mb-3"><Check size={14}/> Depois de responder</span><h3 className="font-extrabold">Pratique o que aprendeu</h3><p className="muted mt-2 text-sm">Cinco questões encerram a sessão e atualizam seu progresso.</p><form action={generateQuiz} className="mt-4"><input type="hidden" name="disciplineId" value={activeDifficulty.disciplineId}/><input type="hidden" name="topicId" value={activeDifficulty.topicId}/><input type="hidden" name="count" value="5"/><SubmitButton pendingText="Criando prática..." className="btn btn-primary w-full"><FlaskConical size={17}/> Ir para as 5 questões</SubmitButton></form></div>}
          <div className="card p-5"><span className="label">Assunto</span><strong>{selectedTopic?.name}</strong><p className="muted mt-2 text-sm">{activeDifficulty.originalReport}</p></div>
        </aside>
      </div>
    </section>}

    {activeQuiz && <section className="card p-5 md:p-7">
      {attempt ? <div className="space-y-6">
        <div className="text-center"><span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--accent)]"><CheckCircle2 size={28}/></span><p className="muted text-sm">Sessão concluída</p><h2 className="text-2xl font-extrabold">Você fez {attempt.correctCount} de {attempt.total}</h2><strong className="display mt-2 block text-4xl" style={{ color: attempt.score >= 70 ? "var(--brand)" : "var(--danger)" }}>{attempt.score}%</strong></div>
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[var(--surface-2)] p-4"><Flame className="mb-2 text-orange-500" size={19}/><strong>{rhythm.streak} dias</strong><p className="muted text-xs">ritmo atual</p></div><div className="rounded-xl bg-[var(--surface-2)] p-4"><RotateCcw className="mb-2 text-[var(--brand)]" size={19}/><strong>{nextReview ? new Date(`${nextReview.scheduledFor}T12:00:00`).toLocaleDateString("pt-BR") : "Em breve"}</strong><p className="muted text-xs">próxima revisão</p></div><div className="rounded-xl bg-[var(--surface-2)] p-4"><Brain className="mb-2 text-[var(--brand)]" size={19}/><strong>{attempt.weaknesses.length || "Nenhum"}</strong><p className="muted text-xs">pontos a reforçar</p></div></div>
        {attempt.weaknesses[0] && <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)" }}><span className="label">Principal ponto para reforçar</span><p className="text-sm">{attempt.weaknesses[0]}</p></div>}
        <details className="rounded-xl border p-4" style={{ borderColor: "var(--line)" }}><summary className="cursor-pointer font-bold">Ver correção das questões</summary><div className="mt-4 space-y-4">{questions.map((question, index) => { const answer = attempt.answers[question.id]; const ok = answer === question.correctAnswer; return <div key={question.id} className="rounded-xl bg-[var(--surface-2)] p-4"><strong>{index + 1}. {question.prompt}</strong><p className="mt-2 text-sm">{ok ? "✓ Você acertou" : `Sua resposta: ${answer || "Sem resposta"}`}</p>{!ok && <p className="mt-1 text-sm">Correta: {question.correctAnswer}</p>}<p className="muted mt-2 text-sm">{question.explanation}</p></div>; })}</div></details>
        <div className="grid gap-3 sm:grid-cols-2"><Link className="btn btn-primary" href="/dashboard">Concluir e voltar ao início</Link>{activeQuiz.topicId && <Link className="btn btn-secondary" href={`/estudar?topico=${activeQuiz.topicId}&sessao=1`}><RotateCcw size={17}/> Praticar novamente</Link>}</div>
      </div> : <><div className="mb-6"><span className="badge mb-3">Etapa final · 5 questões</span><h2 className="section-title flex items-center gap-2"><FlaskConical size={20}/>{activeQuiz.title}</h2><p className="muted mt-1 text-sm">Responda sem consultar. A correção não faz nova chamada de IA.</p></div><form action={submitQuiz} className="space-y-6"><input type="hidden" name="quizId" value={activeQuiz.id}/>{questions.map((question, index) => <fieldset key={question.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)" }}><legend className="px-2 font-bold">{index + 1}. {question.prompt}</legend><div className="mt-3 grid gap-2">{question.options.map((option) => <label key={option} className="flex cursor-pointer gap-3 rounded-xl bg-[var(--surface-2)] p-3 text-sm"><input type="radio" name={`q_${question.id}`} value={option} required/><span>{option}</span></label>)}</div></fieldset>)}<SubmitButton pendingText="Corrigindo..." className="btn btn-primary w-full">Finalizar sessão</SubmitButton></form></>}
    </section>}

    {understanding && <section className="card p-6"><h2 className="section-title mb-4 flex items-center gap-2"><CheckCircle2 size={20}/>Avaliação de entendimento</h2><p className="whitespace-pre-wrap text-sm leading-7">{understanding.note}</p><Link className="btn btn-primary mt-5" href="/dashboard">Voltar ao início</Link></section>}

    {!activeDifficulty && !activeQuiz && !understanding && query.sessao !== "1" && <>
      {selectedTopic ? <section className="card p-5 md:p-7"><p className="muted text-sm">Próximo assunto · {selectedDiscipline?.name}</p><h2 className="mt-1 text-2xl font-extrabold">{selectedTopic.name}</h2><p className="muted mt-2 text-sm">Siga uma sessão curta, com um passo de cada vez.</p><Link className="btn btn-primary mt-5 w-full md:w-auto" href={`/estudar?topico=${selectedTopic.id}&sessao=1`}><Play size={18} fill="currentColor"/> Começar sessão guiada</Link></section> : <div className="empty">Adicione um tópico em uma disciplina para começar.</div>}
      <details className="card p-5"><summary className="cursor-pointer font-extrabold">Outras formas de estudar</summary><div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section><h3 className="mb-2 flex items-center gap-2 font-extrabold"><MessageCircleQuestion size={19}/>Estou com dificuldade</h3><p className="muted mb-4 text-sm">Conte com suas palavras onde travou.</p><form action={createDifficulty} className="space-y-4"><SubjectFields disciplines={disciplineRows} topics={topicRows} disciplineId={selectedDisciplineId} topicId={selectedTopic?.id || ""}/><textarea className="field min-h-28" name="report" required maxLength={2500} placeholder="Estou confundindo..."/><input type="hidden" name="level" value="NAO_ENTENDI"/><input type="hidden" name="mode" value="DIAGNOSTICAR"/><SubmitButton pendingText="Analisando..." className="btn btn-secondary w-full"><Brain size={17}/>Diagnosticar dificuldade</SubmitButton></form></section>
        <section><h3 className="mb-2 flex items-center gap-2 font-extrabold"><BookOpenCheck size={19}/>Testar minha explicação</h3><p className="muted mb-4 text-sm">Explique sem consultar e receba uma avaliação curta.</p><form action={testUnderstanding} className="space-y-4"><SubjectFields disciplines={disciplineRows} topics={topicRows} disciplineId={selectedDisciplineId} topicId={selectedTopic?.id || ""}/><input className="field" name="question" required placeholder="O que este conceito significa?"/><textarea className="field min-h-24" name="answer" required placeholder="Explique com suas palavras..."/><SubmitButton pendingText="Avaliando..." className="btn btn-secondary w-full"><Sparkles size={17}/>Avaliar entendimento</SubmitButton></form></section>
      </div></details>
    </>}
  </div>;
}

function SubjectFields({ disciplines: disciplineRows, topics: topicRows, disciplineId, topicId }: { disciplines: typeof disciplines.$inferSelect[]; topics: typeof topics.$inferSelect[]; disciplineId: string; topicId: string }) {
  return <><label><span className="label">Disciplina</span><select className="field" name="disciplineId" required defaultValue={disciplineId}><option value="">Selecione</option>{disciplineRows.map((discipline) => <option key={discipline.id} value={discipline.id}>{discipline.name}</option>)}</select></label><label><span className="label">Tópico</span><select className="field" name="topicId" required defaultValue={topicId}><option value="">Selecione</option>{topicRows.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label></>;
}
