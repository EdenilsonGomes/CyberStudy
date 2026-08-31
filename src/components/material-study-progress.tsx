import Link from "next/link";
import { studyProgress, sessionLesson } from "@/lib/study";
import { summarizeLesson } from "@/lib/interactive-lesson";

export async function MaterialStudyProgress({ practice = false }: { practice?: boolean }) {
  const rows = await studyProgress();
  const seen = new Set<string>();
  const latest = rows.filter((row) => { if (seen.has(row.session.lessonKey)) return false; seen.add(row.session.lessonKey); return Boolean(row.package.content); }).slice(0, 4);
  if (!latest.length) return null;
  return <section className="card p-5"><h2 className="section-title">{practice ? "Reforçar o que você praticou" : "Aprendizado nas aulas interativas"}</h2><div className="grid gap-3 mt-4">{latest.map(({ session, package: pack }) => {
    const summary = summarizeLesson(sessionLesson(session, pack.content!), session.state);
    const startHref = pack.lessonId ? `/estudar/iniciar?aula=${pack.lessonId}` : pack.topicId ? `/estudar/iniciar?topico=${pack.topicId}` : `/disciplinas/${pack.disciplineId}`;
    return <div key={session.id} className="callout"><strong>{pack.content!.title}</strong><p className="muted mt-2 text-sm">{summary.independent}/{summary.total} de primeira · {summary.assisted} com apoio ou correção.</p><p className="muted text-sm mt-2">{summary.reinforce.length ? `Reforçar: ${summary.reinforce.join(" · ")}` : "Boa aplicação nesta sessão. Verifique a retenção em outro dia."}</p><Link className="btn btn-secondary mt-3" href={practice ? `${startHref}&revisao=1` : `/estudar/sessao/${session.id}`}>{practice ? "Praticar este conteúdo" : "Ver tentativas"}</Link></div>;
  })}</div></section>;
}
