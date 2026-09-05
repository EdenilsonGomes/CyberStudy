import Link from "next/link";
import { FileText, Plus, Settings2 } from "lucide-react";
import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  createTopic,
  deleteMaterial,
  deleteTopic,
  organizeMaterial,
  updateTopicStatus,
} from "@/app/actions";
import { ConfirmSubmitButton, MaterialFeedback, SubmitButton } from "@/components/submit-button";
import { TrailOverview } from "@/components/trail-overview";
import { getUserDb, owned } from "@/db/user-db";
import { disciplines, studySessions } from "@/db/schema";
import { learningRhythm } from "@/lib/learning";
import { latestDiagnostic } from "@/lib/study";
import { uuidPattern } from "@/lib/study-contract";
import { loadTrail } from "@/lib/trail-data";

export default async function DisciplinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ material?: string; topicos?: string }>;
}) {
  const { db, userId } = await getUserDb();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const query = await searchParams;
  const [discipline] = await db
    .select()
    .from(disciplines)
    .where(owned(disciplines, userId, eq(disciplines.id, id)))
    .limit(1);
  if (!discipline) notFound();

  const [trail, diagnostic, disciplineChoices, recent] = await Promise.all([
    loadTrail(id),
    latestDiagnostic(id),
    db
      .select()
      .from(disciplines)
      .where(owned(disciplines, userId, eq(disciplines.status, "ATIVA")))
      .orderBy(asc(disciplines.createdAt)),
    db
      .select({ createdAt: studySessions.createdAt })
      .from(studySessions)
      .where(owned(studySessions, userId))
      .orderBy(desc(studySessions.createdAt))
      .limit(120),
  ]);

  const { topicRows, materialRows } = trail;
  const rhythm = learningRhythm(recent.map((session) => session.createdAt));
  const today = new Date().toISOString().slice(0, 10);
  const completedToday = recent.filter(
    (session) => session.createdAt.toISOString().slice(0, 10) === today,
  ).length;
  const nextUnitNumber = materialRows.length + 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/disciplinas" className="text-sm font-bold text-[var(--brand)]">← Todas as disciplinas</Link>
        {disciplineChoices.length > 1 && (
          <nav aria-label="Escolher disciplina" className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {disciplineChoices.map((item) => (
              <Link
                key={item.id}
                href={`/disciplinas/${item.id}`}
                aria-current={item.id === id ? "page" : undefined}
                className={`trail-chip shrink-0 ${item.id === id ? "trail-chip-active" : ""}`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <TrailOverview
        trail={trail}
        discipline={discipline}
        streak={rhythm.streak}
        completedToday={completedToday}
      />

      <section
        id="adicionar-unidade"
        className="card scroll-mt-24 p-5 md:p-6"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--brand) 10%, var(--surface)), var(--surface))",
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
            <Plus size={21} />
          </span>
          <div>
            <p className="eyebrow">Próximo conteúdo</p>
            <h2 className="section-title mt-1">Adicionar Unidade {nextUnitNumber}</h2>
            <p className="muted mt-1 text-sm">
              Envie um PDF por unidade. O CyberStudy prepara 5 aulas: 4 de conteúdo e 1 de encerramento.
            </p>
          </div>
        </div>

        {query.material === "ok" && (
          <div className="mt-4 rounded-2xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">
            Material recebido. Agora use “Preparar 5 aulas” no card da nova unidade.
          </div>
        )}

        <MaterialFeedback />

        <form action="/api/materials" method="post" encType="multipart/form-data" className="mt-5 space-y-4">
          <input type="hidden" name="disciplineId" value={id} />
          <label>
            <span className="label">Nome da unidade</span>
            <input
              className="field"
              name="title"
              required
              maxLength={160}
              defaultValue={`Unidade ${nextUnitNumber}`}
              placeholder={`Ex.: Unidade ${nextUnitNumber} — Segurança em redes`}
            />
          </label>
          <label>
            <span className="label">PDF da unidade</span>
            <input className="field text-sm" type="file" name="file" accept="application/pdf" />
          </label>
          <details className="rounded-2xl bg-[var(--surface-2)] p-3">
            <summary className="cursor-pointer text-sm font-bold">Não tenho PDF — colar texto</summary>
            <textarea
              className="field mt-3 min-h-28"
              name="content"
              placeholder="Cole o conteúdo da unidade aqui"
            />
          </details>
          <button className="btn btn-primary w-full">Adicionar unidade</button>
        </form>
      </section>

      <details className="card p-5">
        <summary className="cursor-pointer font-extrabold">Diagnóstico inicial</summary>
        <p className="muted mt-3 text-sm">Opcional. Serve para ajustar o ponto de partida sem marcar aulas como concluídas.</p>
        <Link
          className="btn btn-secondary mt-3 w-full"
          href={
            diagnostic
              ? `/estudar/sessao/${diagnostic.session.id}`
              : `/estudar/iniciar?disciplina=${id}&diagnostico=1`
          }
        >
          {diagnostic ? "Ver meu diagnóstico" : "Fazer diagnóstico"}
        </Link>
      </details>

      <details className="card p-5 md:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-extrabold">
          <span className="flex items-center gap-2"><Settings2 size={19} /> Configurações avançadas</span>
          <span className="muted text-xs font-normal">tópicos e materiais</span>
        </summary>

        <div className="mt-6 grid gap-7 lg:grid-cols-2">
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 font-extrabold">Adicionar tópico manual</h3>
              <form action={createTopic} className="space-y-3">
                <input type="hidden" name="disciplineId" value={id} />
                <input className="field" name="name" required placeholder="Ex.: Subnetting" />
                <textarea className="field min-h-20" name="description" placeholder="Descrição opcional" />
                <button className="btn btn-secondary w-full">Adicionar tópico</button>
              </form>
            </section>

            {topicRows.length > 0 && (
              <section>
                <h3 className="mb-3 font-extrabold">Tópicos</h3>
                <div className="space-y-3">
                  {topicRows.map((topic) => (
                    <div key={topic.id} className="rounded-xl bg-[var(--surface-2)] p-3">
                      <strong className="mb-2 block text-sm">{topic.name}</strong>
                      <div className="flex gap-2">
                        <form action={updateTopicStatus} className="flex min-w-0 flex-1 gap-2">
                          <input type="hidden" name="topicId" value={topic.id} />
                          <select className="field min-w-0 py-2 text-xs" name="status" defaultValue={topic.status}>
                            <option value="NAO_ESTUDADO">Ainda não iniciado</option>
                            <option value="ESTUDANDO">Em andamento</option>
                            <option value="REVISAR">Revisar</option>
                            <option value="DOMINADO">Concluído</option>
                          </select>
                          <button className="btn btn-secondary px-3 text-xs">Salvar</button>
                        </form>
                        <form action={deleteTopic}>
                          <input type="hidden" name="topicId" value={topic.id} />
                          <ConfirmSubmitButton
                            pendingText="..."
                            confirmText="Excluir este tópico e seus registros?"
                            className="btn btn-secondary px-3 text-xs"
                            style={{ color: "var(--danger)" }}
                          >
                            Excluir
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 font-extrabold"><FileText size={18} /> Materiais enviados</h3>
            {materialRows.length ? (
              <div className="space-y-3">
                {materialRows.map((material, index) => (
                  <div key={material.id} className="rounded-xl bg-[var(--surface-2)] p-4">
                    <span className="badge">Unidade {index + 1}</span>
                    <strong className="mt-2 block text-sm">{material.title}</strong>
                    <p className="muted mt-1 text-xs">
                      {material.type} · {Math.ceil(material.content.length / 1000)} mil caracteres
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={organizeMaterial}>
                        <input type="hidden" name="materialId" value={material.id} />
                        <SubmitButton pendingText="Organizando..." className="btn btn-secondary text-xs">
                          Organizar tópicos
                        </SubmitButton>
                      </form>
                      <form action={deleteMaterial}>
                        <input type="hidden" name="materialId" value={material.id} />
                        <ConfirmSubmitButton
                          pendingText="..."
                          className="btn btn-secondary text-xs"
                          style={{ color: "var(--danger)" }}
                        >
                          Excluir
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted text-sm">Nenhum material enviado ainda.</p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
