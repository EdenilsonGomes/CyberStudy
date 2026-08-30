import Link from "next/link";
import { PilotEntry } from "@/components/pilot-entry";
import { ArrowRight, CalendarDays, Flame, Play, Target } from "lucide-react";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { disciplines, exams, learningUnits, lessonAttempts, microLessons, reviews, studySessions, topics } from "@/db/schema";
import { learningRhythm, pickNextTopic } from "@/lib/learning";
import { activeStudy, studyProgress } from "@/lib/study";

export default async function DashboardPage() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const [activeDisciplines, allTopics, dueReviews, nextExams, recentSessions, lessonRows, attemptRows] = await Promise.all([
    db.select().from(disciplines).where(eq(disciplines.status, "ATIVA")),
    db.select().from(topics).orderBy(asc(topics.createdAt)),
    db.select({ review: reviews, topic: topics.name, discipline: disciplines.name }).from(reviews).innerJoin(topics, eq(reviews.topicId, topics.id)).innerJoin(disciplines, eq(reviews.disciplineId, disciplines.id)).where(and(eq(reviews.status, "PENDENTE"), lte(reviews.scheduledFor, today))).orderBy(asc(reviews.scheduledFor)).limit(3),
    db.select({ exam: exams, discipline: disciplines.name }).from(exams).innerJoin(disciplines, eq(exams.disciplineId, disciplines.id)).where(gte(exams.examDate, today)).orderBy(asc(exams.examDate)).limit(1),
    db.select({ createdAt: studySessions.createdAt }).from(studySessions).orderBy(desc(studySessions.createdAt)).limit(120),
    db.select({ lesson: microLessons, unit: learningUnits }).from(microLessons).innerJoin(learningUnits, eq(microLessons.unitId, learningUnits.id)).orderBy(learningUnits.position, microLessons.position),
    db.select({ lessonId: lessonAttempts.lessonId, score: lessonAttempts.score }).from(lessonAttempts).orderBy(desc(lessonAttempts.createdAt)),
  ]);

  const completedIds = new Set(attemptRows.filter((attempt) => attempt.score >= 60).map((attempt) => attempt.lessonId));
  const [resume, completedStudies] = await Promise.all([activeStudy(), studyProgress()]);
  for (const row of completedStudies) if (row.package.lessonId) completedIds.add(row.package.lessonId);
  const activeIds = new Set(activeDisciplines.map((discipline) => discipline.id));
  const activeLessons = lessonRows.filter(({ lesson }) => activeIds.has(lesson.disciplineId));
  const nextLessonRow = activeLessons.find(({ lesson }) => !completedIds.has(lesson.id));
  const activeTopics = allTopics.filter((topic) => activeIds.has(topic.disciplineId));
  const practicedTopicIds = new Set(completedStudies.map((row) => row.package.topicId));
  const unpracticedTopics = activeTopics.filter((topic) => !practicedTopicIds.has(topic.id));
  const nextTopic = pickNextTopic(unpracticedTopics.length ? unpracticedTopics : activeTopics, dueReviews.map(({ review }) => review.topicId));
  const rhythm = learningRhythm(recentSessions.map((session) => session.createdAt));
  const completedToday = recentSessions.filter((session) => session.createdAt.toISOString().slice(0, 10) === today).length;
  const nextExam = nextExams[0];
  const rawName = (process.env.ADMIN_EMAIL?.split("@")[0] || "estudante").split(/[._-]/)[0];
  const studentName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const missions: Array<{ title: string; detail: string; href: string }> = [];
  if (dueReviews[0]) missions.push({ title: `Revisar ${dueReviews[0].topic}`, detail: "4 min", href: `/estudar?topico=${dueReviews[0].review.topicId}&sessao=1` });
  if (nextLessonRow) missions.push({ title: nextLessonRow.lesson.title, detail: "8 min", href: `/aulas/${nextLessonRow.lesson.id}` });
  if (nextTopic && missions.length < 3) missions.push({ title: `Praticar ${nextTopic.name}`, detail: "Aula", href: `/estudar?topico=${nextTopic.id}&sessao=1` });
  if (resume) missions.unshift({ title: resume.package.content?.title || "Seu estudo em andamento", detail: `Etapa ${resume.session.state.index + 1}`, href: `/estudar/sessao/${resume.session.id}` });
  missions.splice(3);
  if (!missions.length) missions.push({ title: "Escolher a próxima trilha", detail: "2 min", href: "/disciplinas" });
  const mainAction = missions[0];
  const dailyGoal = Math.min(completedToday, 3);

  return <div className="today-layout">
    <section className="min-w-0">
      <header className="today-heading"><div><p className="muted text-sm">{greeting}, {studentName}</p><h1 className="page-title mt-1">O que fazer agora?</h1></div><span className="streak-pill"><Flame size={17} fill="currentColor"/>{rhythm.streak} dias</span></header>
      <section className="mission-card cyber-grid">
        <div className="mission-kicker"><Target size={16}/>Sua missão de hoje</div>
        <div className="mission-list">{missions.map((mission, index) => <Link key={`${mission.title}-${index}`} href={mission.href} className="mission-item"><span className={`mission-number ${index === 0 ? "mission-current" : ""}`}>{index + 1}</span><span className="min-w-0 flex-1"><strong>{mission.title}</strong><small>{index === 0 ? "Próximo passo" : "Depois"}</small></span><span className="mission-time">{mission.detail}</span></Link>)}</div>
        <Link className="btn btn-primary mt-6 w-full" href={mainAction.href}><Play size={18} fill="currentColor"/>{resume ? "Continuar de onde parei" : "Começar"}</Link>
      </section>
      <section className="daily-goal" aria-label={`Meta diária: ${dailyGoal} de 3 atividades`}><div><strong>Meta diária</strong><p className="muted text-xs">Três passos curtos</p></div><div className="goal-dots" aria-hidden="true">{[0, 1, 2].map((index) => <span key={index} className={index < dailyGoal ? "goal-dot-filled" : ""}/>)}</div></section>
      <PilotEntry/>
    </section>
    <aside className="today-rail">
      <section className="today-note"><p className="label">Próximo estudo</p><strong>{nextLessonRow?.lesson.title || nextTopic?.name || "Monte sua primeira trilha"}</strong><p className="muted mt-1 text-sm">{nextLessonRow?.unit.title || activeDisciplines[0]?.name || "CyberStudy"}</p><Link href="/disciplinas" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--brand)]">Ver trilha <ArrowRight size={15}/></Link></section>
      <section className="today-note"><p className="label">Próxima prova</p>{nextExam ? <><strong>{nextExam.exam.name}</strong><p className="muted mt-2 flex items-center gap-2 text-sm"><CalendarDays size={15}/>{new Date(`${nextExam.exam.examDate}T12:00:00`).toLocaleDateString("pt-BR")}</p></> : <p className="muted text-sm">Nenhuma prova cadastrada.</p>}</section>
    </aside>
  </div>;
}
