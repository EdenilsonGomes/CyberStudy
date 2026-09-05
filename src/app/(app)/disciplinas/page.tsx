import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap, Plus } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { createDiscipline } from "@/app/actions";
import { getUserDb, owned } from "@/db/user-db";
import { disciplines } from "@/db/schema";
import { loadTrail } from "@/lib/trail-data";

export default async function DisciplinesPage() {
  const { db, userId } = await getUserDb();
  const items = await db
    .select()
    .from(disciplines)
    .where(owned(disciplines, userId, eq(disciplines.status, "ATIVA")))
    .orderBy(asc(disciplines.createdAt));

  const courses = await Promise.all(
    items.map(async (discipline) => ({ discipline, trail: await loadTrail(discipline.id) })),
  );

  const totalLessons = courses.reduce((sum, item) => sum + item.trail.total, 0);
  const completedLessons = courses.reduce((sum, item) => sum + item.trail.completed, 0);
  const courseProgress = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
          <GraduationCap size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Área de aprendizado</p>
          <h1 className="page-title mt-1">Faculdade</h1>
          <p className="muted mt-2 text-sm">Escolha uma disciplina para ver suas unidades e aulas.</p>
        </div>
      </header>

      {courses.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-bold">Seu progresso na faculdade</span>
            <strong className="text-[var(--brand)]">{courseProgress}%</strong>
          </div>
          <div className="mt-3 progress"><span style={{ width: `${courseProgress}%` }} /></div>
          <p className="muted mt-2 text-xs">{completedLessons} de {totalLessons} aulas concluídas no conteúdo cadastrado.</p>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="section-title">Disciplinas</h2>
          <span className="muted text-xs">{courses.length} ativa{courses.length === 1 ? "" : "s"}</span>
        </div>

        {courses.length ? (
          <div className="space-y-3">
            {courses.map(({ discipline, trail }) => {
              const progress = trail.total ? Math.round((trail.completed / trail.total) * 100) : 0;
              const currentUnit = trail.currentUnit
                ? trail.groups.findIndex((unit) => unit.id === trail.currentUnit?.id) + 1
                : 0;

              return (
                <Link
                  key={discipline.id}
                  href={`/disciplinas/${discipline.id}`}
                  className="card flex items-center gap-4 p-4 transition-transform hover:-translate-y-0.5 sm:p-5"
                >
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: `${discipline.color}22`, color: discipline.color }}
                  >
                    <BookOpen size={23} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="break-words">{discipline.name}</strong>
                      <span className="text-xs font-extrabold" style={{ color: discipline.color }}>{progress}%</span>
                    </div>
                    <p className="muted mt-1 text-xs">
                      {trail.groups.length
                        ? `${trail.groups.length} unidade${trail.groups.length === 1 ? "" : "s"} · ${trail.total} aulas`
                        : "Nenhuma unidade adicionada"}
                      {currentUnit ? ` · Unidade ${currentUnit} atual` : ""}
                    </p>
                    <div className="mt-3 progress"><span style={{ width: `${progress}%`, background: discipline.color }} /></div>
                  </div>
                  <ArrowRight size={18} className="shrink-0 text-[var(--brand)]" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card p-6 text-center">
            <GraduationCap size={32} className="mx-auto text-[var(--brand)]" />
            <h2 className="mt-3 font-extrabold">Comece pela sua primeira disciplina</h2>
            <p className="muted mt-2 text-sm">Depois você adiciona as unidades em PDF e o CyberStudy organiza as aulas.</p>
          </div>
        )}
      </section>

      <details className="card p-5" open={!courses.length}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-extrabold">
          <span className="flex items-center gap-2"><Plus size={18} /> Adicionar disciplina</span>
          <span className="muted text-xs font-normal">novo conteúdo</span>
        </summary>
        <form action={createDiscipline} className="mt-5 space-y-4">
          <label>
            <span className="label">Nome da disciplina</span>
            <input className="field" name="name" required maxLength={120} placeholder="Ex.: Segurança da Informação" />
          </label>
          <label>
            <span className="label">Semestre</span>
            <input className="field" name="semester" required placeholder="Ex.: 2º semestre" />
          </label>
          <label>
            <span className="label">Descrição (opcional)</span>
            <textarea className="field min-h-20" name="description" maxLength={1000} placeholder="Uma frase sobre a disciplina" />
          </label>
          <input type="hidden" name="color" value="#7c3aed" />
          <button className="btn btn-primary w-full">Criar disciplina</button>
        </form>
      </details>

      <Link href="/explorar" className="btn btn-ghost w-full">Voltar para áreas de aprendizado</Link>
    </div>
  );
}
