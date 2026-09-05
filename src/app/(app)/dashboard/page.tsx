import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Code2,
  Flame,
  GraduationCap,
  Languages,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { copilotData } from "@/lib/copilot-data";
import { buildDailyPlan, daysUntil } from "@/lib/copilot";
import { learningRhythm } from "@/lib/learning";

export default async function DashboardPage() {
  const data = await copilotData();
  const plan = buildDailyPlan({ ...data, topics: data.planTopics, minutes: 30 });
  const rhythm = learningRhythm(data.sessions.map((session) => session.createdAt));

  const activeTrail =
    data.trails.find(({ trail }) => trail.steps.length > 0 && !trail.done) ||
    data.trails.find(({ trail }) => trail.steps.length > 0) ||
    data.trails[0];

  const facultyTotal = data.trails.reduce((total, item) => total + item.trail.total, 0);
  const facultyCompleted = data.trails.reduce((total, item) => total + item.trail.completed, 0);
  const facultyProgress = facultyTotal ? Math.round((facultyCompleted / facultyTotal) * 100) : 0;

  const activeUnitIndex = activeTrail?.trail.currentUnit
    ? activeTrail.trail.groups.findIndex((unit) => unit.id === activeTrail.trail.currentUnit?.id) + 1
    : 0;

  const recommended = plan.items[0];
  const nextEvents = data.events
    .filter((event) => event.date >= data.today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Seu espaço de aprendizado</p>
          <h1 className="page-title mt-1">O que vamos estudar hoje?</h1>
          <p className="muted mt-2 text-sm">Continue de onde parou ou escolha outra área.</p>
        </div>
        <span className="badge shrink-0">
          <Flame size={16} />
          {rhythm.streak} dias
        </span>
      </header>

      <section aria-labelledby="continuar-estudando">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="continuar-estudando" className="section-title">Continuar estudando</h2>
          {activeTrail && (
            <Link href={`/disciplinas/${activeTrail.course.id}`} className="text-xs font-bold text-[var(--brand)]">
              Ver trilha
            </Link>
          )}
        </div>

        <Link
          href={activeTrail?.trail.href || "/disciplinas"}
          className="block overflow-hidden rounded-3xl border p-5 transition-transform hover:-translate-y-0.5"
          style={{
            borderColor: "color-mix(in srgb, var(--brand) 50%, var(--line))",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--brand) 24%, var(--surface)), color-mix(in srgb, #2563eb 10%, var(--surface)))",
          }}
        >
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-lg">
              <GraduationCap size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="badge">Faculdade</span>
                <span className="muted text-xs">
                  {activeTrail?.trail.total
                    ? `${activeTrail.trail.completed}/${activeTrail.trail.total} aulas`
                    : "Começar"}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-extrabold break-words">
                {activeTrail?.course.name || "Adicione sua primeira disciplina"}
              </h3>
              <p className="muted mt-1 text-sm">
                {activeTrail?.trail.next
                  ? `${activeUnitIndex ? `Unidade ${activeUnitIndex} · ` : ""}${activeTrail.trail.next.title}`
                  : activeTrail?.trail.done
                    ? "Conteúdo cadastrado concluído. Continue pelas revisões."
                    : "Organize suas disciplinas, unidades e aulas."}
              </p>

              <div className="mt-4 flex items-center gap-3">
                <div className="progress flex-1" aria-label="Progresso da disciplina">
                  <span
                    style={{
                      width: `${
                        activeTrail?.trail.total
                          ? Math.round((activeTrail.trail.completed / activeTrail.trail.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-xs font-extrabold text-[var(--brand)]">
                  {activeTrail?.trail.total
                    ? `${Math.round((activeTrail.trail.completed / activeTrail.trail.total) * 100)}%`
                    : "Abrir"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 text-sm font-extrabold text-[var(--brand)]">
                {activeTrail?.trail.label || "Abrir Faculdade"} <ArrowRight size={16} />
              </div>
            </div>
          </div>
        </Link>
      </section>

      {recommended && (
        <section className="card overflow-hidden p-0">
          <div className="flex items-start gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Sparkles size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="eyebrow">Recomendado para hoje</p>
                <span className="muted text-xs">≈ {recommended.minutes} min</span>
              </div>
              <h2 className="mt-2 font-extrabold break-words">{recommended.title}</h2>
              <p className="muted mt-1 text-sm">{recommended.reason}</p>
              <Link href={recommended.href} className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-emerald-400">
                Fazer agora <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      <section id="areas" aria-labelledby="suas-areas">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="suas-areas" className="section-title">Suas áreas de aprendizado</h2>
          <Link href="/explorar" className="text-xs font-bold text-[var(--brand)]">Ver todas</Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/disciplinas"
            className="card flex min-h-40 flex-col justify-between p-3 transition-transform hover:-translate-y-0.5 sm:p-4"
            style={{
              background:
                "linear-gradient(160deg, color-mix(in srgb, var(--brand) 17%, var(--surface)), var(--surface))",
            }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
              <GraduationCap size={22} />
            </span>
            <div>
              <strong className="block text-sm">Faculdade</strong>
              <span className="muted mt-1 hidden text-[11px] leading-4 sm:block">Disciplinas, unidades e aulas</span>
            </div>
            <div>
              <div className="progress"><span style={{ width: `${facultyProgress}%` }} /></div>
              <span className="mt-2 block text-[11px] font-bold text-violet-300">{facultyProgress}%</span>
            </div>
          </Link>

          <Link
            href="/explorar#ingles-tech"
            className="card flex min-h-40 flex-col justify-between p-3 transition-transform hover:-translate-y-0.5 sm:p-4"
            style={{
              background:
                "linear-gradient(160deg, color-mix(in srgb, #0ea5e9 17%, var(--surface)), var(--surface))",
            }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
              <Languages size={22} />
            </span>
            <div>
              <strong className="block text-sm">Inglês Tech</strong>
              <span className="muted mt-1 hidden text-[11px] leading-4 sm:block">Inglês para estudar e trabalhar</span>
            </div>
            <span className="w-fit rounded-full bg-sky-500/15 px-2 py-1 text-[10px] font-extrabold text-sky-300">Em breve</span>
          </Link>

          <Link
            href="/explorar#python"
            className="card flex min-h-40 flex-col justify-between p-3 transition-transform hover:-translate-y-0.5 sm:p-4"
            style={{
              background:
                "linear-gradient(160deg, color-mix(in srgb, #22c55e 15%, var(--surface)), var(--surface))",
            }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <Code2 size={22} />
            </span>
            <div>
              <strong className="block text-sm">Python</strong>
              <span className="muted mt-1 hidden text-[11px] leading-4 sm:block">Lógica, prática e projetos</span>
            </div>
            <span className="w-fit rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-extrabold text-emerald-300">Em breve</span>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="section-title flex items-center gap-2"><CalendarDays size={19} /> Próximos compromissos</h2>
            <Link href="/agenda" className="text-xs font-bold text-[var(--brand)]">Agenda</Link>
          </div>
          {nextEvents.length ? (
            <div className="space-y-3">
              {nextEvents.map((event) => (
                <div key={event.id} className="rounded-2xl bg-[var(--surface-2)] p-3">
                  <strong className="block text-sm break-words">{event.name}</strong>
                  <p className="muted mt-1 text-xs">
                    {data.courses.find((course) => course.id === event.disciplineId)?.name || "Faculdade"} ·{" "}
                    {daysUntil(event.date, data.today) === 0 ? "hoje" : `em ${daysUntil(event.date, data.today)} dias`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted text-sm">Sem compromissos próximos cadastrados.</p>
          )}
        </div>

        <Link href="/revisoes" className="card flex items-center gap-4 p-5 transition-transform hover:-translate-y-0.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
            <RotateCcw size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Praticar</p>
            <strong className="mt-1 block">Revisão inteligente</strong>
            <p className="muted mt-1 text-sm">Reforce o que está perto de ser esquecido.</p>
          </div>
          <ArrowRight size={18} className="shrink-0 text-[var(--brand)]" />
        </Link>
      </section>
    </div>
  );
}
