import Link from "next/link";
import { Check, Circle, Flame, Play, RotateCcw } from "lucide-react";
import { createLearningPath } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import type { loadTrail } from "@/lib/trail-data";

export function TrailOverview({
  trail,
  discipline,
  streak,
  completedToday,
}: {
  trail: Awaited<ReturnType<typeof loadTrail>>;
  discipline: { id: string; name: string; semester: string; color?: string };
  streak: number;
  completedToday: number;
}) {
  const overallProgress = trail.total ? Math.round((trail.completed / trail.total) * 100) : 0;

  return (
    <>
      <header
        className="overflow-hidden rounded-3xl border p-5 md:p-6"
        style={{
          borderColor: "color-mix(in srgb, var(--brand) 40%, var(--line))",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--brand) 18%, var(--surface)), var(--surface))",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Faculdade · {discipline.semester}</p>
            <h1 className="page-title mt-1 break-words">{discipline.name}</h1>
          </div>
          <span className="streak-pill"><Flame size={17} /> {streak} dias</span>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-bold">Progresso na disciplina</span>
            <strong className="text-[var(--brand)]">{overallProgress}%</strong>
          </div>
          <div className="progress"><span style={{ width: `${overallProgress}%` }} /></div>
          <div className="muted mt-2 flex flex-wrap justify-between gap-2 text-xs">
            <span>{trail.completed} de {trail.total} aulas concluídas</span>
            <span>Meta de hoje · {Math.min(3, completedToday)}/3 atividades</span>
          </div>
        </div>
      </header>

      {trail.next && (
        <section className="card p-5" aria-label="Próxima aula recomendada">
          <p className="eyebrow">Próxima aula recomendada</p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="section-title break-words">{trail.next.title}</h2>
              <p className="muted mt-1 text-sm">O CyberStudy sugere esta aula, mas você pode escolher outra abaixo.</p>
            </div>
            <Link href={trail.href} className="btn btn-primary shrink-0"><Play size={17} /> Continuar</Link>
          </div>
        </section>
      )}

      {!trail.groups.length && (
        <section className="card p-6 text-center">
          <h2 className="section-title">Nenhuma unidade adicionada</h2>
          <p className="muted mt-2 text-sm">Envie o PDF da Unidade 1 para começar sua trilha.</p>
          <Link href="#adicionar-unidade" className="btn btn-primary mt-4">Adicionar Unidade 1</Link>
        </section>
      )}

      <section className="space-y-3" aria-label="Unidades da disciplina">
        {trail.groups.map((unit, index) => {
          const unitCompleted = unit.steps.filter((step) => step.done).length;
          const unitProgress = unit.steps.length
            ? Math.round((unitCompleted / unit.steps.length) * 100)
            : 0;
          const isCurrent = unit.id === trail.currentUnit?.id;
          const isFuture = !unit.done && !isCurrent && Boolean(trail.currentUnit);
          const shouldOpen = isCurrent || (!trail.currentUnit && index === 0);

          return (
            <details
              key={unit.id}
              open={shouldOpen}
              className="card overflow-hidden"
              style={
                isCurrent
                  ? { borderColor: "color-mix(in srgb, var(--brand) 58%, var(--line))" }
                  : undefined
              }
            >
              <summary className="cursor-pointer list-none p-4 sm:p-5">
                <div className="flex items-center gap-4">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      unit.done
                        ? "bg-emerald-500/15 text-emerald-300"
                        : isCurrent
                          ? "bg-violet-500/20 text-violet-300"
                          : "bg-[var(--surface-2)] text-[var(--muted)]"
                    }`}
                  >
                    {unit.done ? <Check size={21} /> : isCurrent ? <Play size={19} /> : <Circle size={18} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="eyebrow">
                          Unidade {index + 1}
                          {unit.done ? " · concluída" : isCurrent ? " · atual" : ""}
                        </span>
                        <h2 className="mt-1 font-extrabold break-words">{unit.title}</h2>
                      </div>
                      <strong
                        className={`text-xs ${
                          unit.done ? "text-emerald-300" : isCurrent ? "text-violet-300" : "muted"
                        }`}
                      >
                        {unit.steps.length ? `${unitProgress}%` : "PDF recebido"}
                      </strong>
                    </div>
                    <div className="mt-3 progress">
                      <span
                        style={{
                          width: `${unitProgress}%`,
                          background: unit.done ? "#34d399" : undefined,
                        }}
                      />
                    </div>
                    <p className="muted mt-2 text-xs">
                      {unit.steps.length
                        ? `${unitCompleted} de ${unit.steps.length} aulas concluídas`
                        : "Falta preparar as aulas desta unidade"}
                      {isFuture ? " · disponível para estudar quando quiser" : ""}
                    </p>
                  </div>
                </div>
              </summary>

              <div className="border-t border-[var(--line)] px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                {unit.steps.length ? (
                  <div className="space-y-2">
                    {unit.steps.map((step, lessonIndex) => {
                      const current = step.key === trail.next?.key;
                      const href = step.done
                        ? `${step.href}&revisao=1`
                        : current
                          ? trail.href
                          : step.href;

                      return (
                        <Link
                          key={step.key}
                          href={href}
                          aria-current={current ? "step" : undefined}
                          className={`flex items-center gap-3 rounded-2xl border p-3 transition-transform hover:-translate-y-0.5 ${
                            current ? "border-violet-500/50 bg-violet-500/10" : "border-[var(--line)] bg-[var(--surface-2)]"
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              step.done
                                ? "bg-emerald-500/15 text-emerald-300"
                                : current
                                  ? "bg-violet-500/20 text-violet-300"
                                  : "bg-[var(--surface)] text-[var(--muted)]"
                            }`}
                          >
                            {step.done ? <Check size={17} /> : <Play size={15} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="muted text-[10px] font-bold uppercase tracking-wide">
                              Aula {lessonIndex + 1}
                            </span>
                            <strong className="block text-sm break-words">{step.title}</strong>
                            <span className="muted mt-0.5 block text-xs">
                              {step.done
                                ? "Concluída · toque para revisar"
                                : current
                                  ? "Recomendada agora"
                                  : lessonIndex === unit.steps.length - 1
                                    ? "Encerramento da unidade"
                                    : "Disponível para estudar"}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : unit.materialId ? (
                  <form action={createLearningPath}>
                    <input type="hidden" name="materialId" value={unit.materialId} />
                    <p className="muted mb-3 text-sm">
                      O PDF já foi salvo. Prepare as 5 aulas para começar a estudar esta unidade.
                    </p>
                    <SubmitButton pendingText="Preparando 5 aulas..." className="btn btn-primary w-full">
                      Preparar 5 aulas
                    </SubmitButton>
                  </form>
                ) : (
                  <p className="muted text-sm">Este conteúdo antigo ainda não está ligado a um PDF.</p>
                )}

                {unit.done && (
                  <div className="mt-4 rounded-2xl bg-emerald-500/10 p-4">
                    <strong className="text-sm text-emerald-300">Unidade concluída</strong>
                    <p className="muted mt-1 text-xs">Você pode avançar e deixar os reforços para a área de revisão.</p>
                    <Link className="btn btn-ghost mt-3 w-full" href="/revisoes">
                      <RotateCcw size={16} /> Revisar em Praticar
                    </Link>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </section>
    </>
  );
}
