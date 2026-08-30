import Link from "next/link";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getUserDb, owned } from "@/db/user-db";
import { interactiveSessions } from "@/db/schema";
import { binaryPilot } from "@/lib/pilot-lesson";
import { summarizeLesson } from "@/lib/interactive-lesson";

export async function PilotProgress() {
  const { db, userId } = await getUserDb();
  const [row] = await db.select().from(interactiveSessions).where(owned(interactiveSessions, userId, and(eq(interactiveSessions.lessonKey, binaryPilot.id), eq(interactiveSessions.contentVersion, binaryPilot.version), isNotNull(interactiveSessions.completedAt)))).orderBy(desc(interactiveSessions.completedAt)).limit(1);
  if (!row) return null;
  const summary = summarizeLesson(binaryPilot, row.state);
  return <section className="card p-5"><p className="eyebrow">Última aula-piloto</p><h2 className="section-title mt-2">{binaryPilot.title}</h2><p className="mt-3"><strong>{summary.independent}/{summary.total}</strong> desafios de primeira, sem ajuda · {summary.assisted} com apoio ou correção.</p><p className="muted mt-2 text-sm">{summary.reinforce.length ? `Vale reforçar: ${summary.reinforce.join(" · ")}.` : "Você aplicou o conceito nesta sessão. Retome outro dia para verificar a retenção."}</p><Link className="btn btn-secondary mt-4" href={`/aulas/piloto-binario?sessao=${row.id}`}>Ver atividades e tentativas</Link></section>;
}
