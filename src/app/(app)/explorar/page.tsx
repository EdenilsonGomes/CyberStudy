import Link from "next/link";
import { ArrowRight, Code2, GraduationCap, Languages, Sparkles } from "lucide-react";
import { copilotData } from "@/lib/copilot-data";

export default async function ExplorePage() {
  const data = await copilotData();
  const total = data.trails.reduce((sum, item) => sum + item.trail.total, 0);
  const completed = data.trails.reduce((sum, item) => sum + item.trail.completed, 0);
  const progress = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">CyberStudy</p>
        <h1 className="page-title mt-1">Explorar áreas</h1>
        <p className="muted mt-2 text-sm">Escolha o que deseja estudar agora.</p>
      </header>

      <div className="space-y-4">
        <Link
          href="/disciplinas"
          className="card flex items-center gap-4 p-5 transition-transform hover:-translate-y-0.5"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--brand) 18%, var(--surface)), var(--surface))",
          }}
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300">
            <GraduationCap size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-base">Faculdade</strong>
              <span className="text-xs font-extrabold text-violet-300">{progress}%</span>
            </div>
            <p className="muted mt-1 text-sm">Suas disciplinas, unidades, aulas e progresso acadêmico.</p>
            <div className="mt-3 progress"><span style={{ width: `${progress}%` }} /></div>
          </div>
          <ArrowRight className="shrink-0 text-violet-300" size={19} />
        </Link>

        <article
          id="ingles-tech"
          className="card scroll-mt-24 p-5"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, #0ea5e9 16%, var(--surface)), var(--surface))",
          }}
        >
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-300">
              <Languages size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-base">Inglês para Tech</strong>
                <span className="rounded-full bg-sky-500/15 px-2 py-1 text-[10px] font-extrabold text-sky-300">Em breve</span>
              </div>
              <p className="muted mt-2 text-sm">Inglês focado no que você realmente precisa para estudar e trabalhar em tecnologia.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {[
              ["Vocabulário técnico", "Termos e expressões do mundo de tecnologia"],
              ["Leitura e compreensão", "Documentação, artigos e tutoriais reais"],
              ["Comunicação prática", "E-mails, reuniões, entrevistas e tickets"],
              ["Exercícios interativos", "Aprendizado aplicado ao contexto de trabalho"],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl bg-[var(--surface-2)] p-3">
                <strong className="text-sm">{title}</strong>
                <p className="muted mt-1 text-xs">{description}</p>
              </div>
            ))}
          </div>
        </article>

        <article
          id="python"
          className="card scroll-mt-24 p-5"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, #22c55e 14%, var(--surface)), var(--surface))",
          }}
        >
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
              <Code2 size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-base">Python</strong>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-extrabold text-emerald-300">Em breve</span>
              </div>
              <p className="muted mt-2 text-sm">Do básico ao uso prático, com exercícios e projetos ligados à tecnologia.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {[
              ["Fundamentos", "Lógica, sintaxe e boas práticas"],
              ["Projetos reais", "Aprenda construindo"],
              ["Desafios práticos", "Exercícios curtos e progressivos"],
              ["Aplicação no mercado", "Automação, dados e backend"],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl bg-[var(--surface-2)] p-3">
                <strong className="text-sm">{title}</strong>
                <p className="muted mt-1 text-xs">{description}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="card flex items-start gap-3 p-4">
        <Sparkles className="mt-0.5 shrink-0 text-[var(--brand)]" size={18} />
        <p className="muted text-sm">
          A Faculdade continua sendo sua área ativa. Os novos módulos entram sem misturar o progresso acadêmico.
        </p>
      </div>
    </div>
  );
}
