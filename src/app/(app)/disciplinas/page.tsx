import Link from "next/link";
import { BookOpen, ChevronRight, Plus } from "lucide-react";
import { getDb } from "@/db";
import { disciplines, topics } from "@/db/schema";
import { createDiscipline } from "@/app/actions";

export default async function DisciplinesPage() {
  const db = getDb();
  const [items, allTopics] = await Promise.all([
    db.select().from(disciplines),
    db.select().from(topics),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Suas trilhas</p>
        <h1 className="page-title">Estudar</h1>
        <p className="muted mt-1 text-sm">Escolha uma disciplina e continue de onde parou.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          {items.length === 0 ? (
            <div className="empty">Crie sua primeira disciplina para começar.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((item) => {
                const own = allTopics.filter((topic) => topic.disciplineId === item.id);
                const mastery = own.length
                  ? Math.round(own.reduce((sum, topic) => sum + topic.mastery, 0) / own.length)
                  : 0;
                const current = own.find((topic) => topic.status === "ESTUDANDO") ?? own[0];

                return (
                  <Link key={item.id} href={`/disciplinas/${item.id}`} className="card course-card group">
                    <div className="course-icon" style={{ color: item.color }}>
                      <BookOpen size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="eyebrow">{item.semester}</p>
                          <h2 className="truncate text-base font-extrabold">{item.name}</h2>
                        </div>
                        <ChevronRight className="muted shrink-0 transition-transform group-hover:translate-x-1" size={20} />
                      </div>
                      <p className="muted mt-2 truncate text-xs">
                        {current ? `Próximo: ${current.name}` : "Adicione o primeiro assunto"}
                      </p>
                      <div className="mt-4 flex items-center gap-3">
                        <div className="progress flex-1">
                          <span style={{ width: `${mastery}%`, background: item.color }} />
                        </div>
                        <strong className="text-xs">{mastery}%</strong>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <aside className="card h-fit p-5">
          <h2 className="section-title mb-5 flex items-center gap-2"><Plus size={18} /> Nova disciplina</h2>
          <form action={createDiscipline} className="space-y-4">
            <label><span className="label">Nome</span><input className="field" name="name" required maxLength={120} placeholder="Segurança de Redes" /></label>
            <label><span className="label">Semestre</span><input className="field" name="semester" required placeholder="2º semestre" /></label>
            <label><span className="label">Descrição (opcional)</span><textarea className="field min-h-24" name="description" maxLength={1000} /></label>
            <label>
              <span className="label">Cor</span>
              <input className="h-11 w-full rounded-xl border p-1" style={{ borderColor: "var(--line)", background: "var(--surface)" }} type="color" name="color" defaultValue="#14b8d4" />
            </label>
            <button className="btn btn-primary w-full">Criar disciplina</button>
          </form>
        </aside>
      </div>
    </div>
  );
}
