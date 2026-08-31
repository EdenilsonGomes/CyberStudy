import { Plus } from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createDiscipline } from "@/app/actions";
import { getUserDb, owned } from "@/db/user-db";
import { disciplines, interactiveSessions, studyPackages } from "@/db/schema";

export default async function DisciplinesPage() {
  const { db, userId } = await getUserDb();
  const items = await db.select().from(disciplines).where(owned(disciplines, userId, eq(disciplines.status, "ATIVA"))).orderBy(asc(disciplines.createdAt));
  const [recent] = await db.select({ disciplineId: studyPackages.disciplineId }).from(interactiveSessions).innerJoin(studyPackages, eq(interactiveSessions.packageId, studyPackages.id)).innerJoin(disciplines, eq(studyPackages.disciplineId, disciplines.id)).where(owned(interactiveSessions, userId, and(eq(disciplines.status, "ATIVA"), eq(studyPackages.kind, "study")))).orderBy(desc(interactiveSessions.updatedAt)).limit(1);
  if (recent) redirect(`/disciplinas/${recent.disciplineId}`);
  if (items[0]) redirect(`/disciplinas/${items[0].id}`);

  return <div className="mx-auto max-w-xl space-y-6">
    <header><p className="eyebrow">Sua trilha</p><h1 className="page-title">Comece pela disciplina</h1><p className="muted mt-2 text-sm">Cadastre uma disciplina; depois você poderá transformar seus materiais em uma sequência de microaulas.</p></header>
    <section className="card p-5 md:p-7"><h2 className="section-title mb-5 flex items-center gap-2"><Plus size={18}/>Nova disciplina</h2><form action={createDiscipline} className="space-y-4"><label><span className="label">Nome</span><input className="field" name="name" required maxLength={120} placeholder="Segurança de Redes"/></label><label><span className="label">Semestre</span><input className="field" name="semester" required placeholder="2º semestre"/></label><label><span className="label">Descrição (opcional)</span><textarea className="field min-h-24" name="description" maxLength={1000}/></label><label><span className="label">Cor</span><input className="h-11 w-full rounded-xl border p-1" style={{ borderColor: "var(--line)", background: "var(--surface)" }} type="color" name="color" defaultValue="#14b8d4"/></label><button className="btn btn-primary w-full">Criar disciplina</button></form></section>
  </div>;
}
