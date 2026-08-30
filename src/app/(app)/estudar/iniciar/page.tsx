import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { activeStudy, latestDiagnostic, levelFor, resolveStudyTarget } from "@/lib/study";
import { startMaterialStudy } from "@/app/study-actions";
import { SubmitButton } from "@/components/submit-button";
import { requireAuth } from "@/lib/auth";

export default async function StartStudyPage({ searchParams }: { searchParams: Promise<{ topico?: string; aula?: string; disciplina?: string; diagnostico?: string; erro?: string }> }) {
  await requireAuth();
  const query = await searchParams;
  const target = await resolveStudyTarget({ topicId: query.topico, lessonId: query.aula, disciplineId: query.disciplina, diagnostic: query.diagnostico === "1" });
  if (!target) notFound();
  const active = await activeStudy(target.key);
  if (active) redirect(`/estudar/sessao/${active.session.id}`);
  const diagnostic = await latestDiagnostic(target.disciplineId);
  const level = target.diagnostic ? "base" : await levelFor(target);
  const errors: Record<string, string> = {
    material: "Ainda falta material suficiente para criar atividades confiáveis. Adicione um material à disciplina.",
    geracao: "A preparação não produziu atividades válidas. Nenhuma sessão foi perdida. Você pode tentar novamente.",
    preparando: "A aula já está sendo preparada. Aguarde um momento e toque novamente para abrir, sem duplicar a geração.",
  };
  return <div className="lesson-focus mx-auto max-w-3xl"><section className="lesson-card card"><div className="lab-body">
    <Link href={`/disciplinas/${target.disciplineId}`} className="focus-back"><ArrowLeft size={18}/>Voltar à trilha</Link>
    <span className="lab-tag">{target.diagnostic ? "Diagnóstico opcional" : "Aula interativa · com seu material"}</span>
    <h1 className="lab-title">{target.title}</h1>
    <p className="lab-instruction">{target.diagnostic ? "Vamos descobrir o que você já sabe. Sem nota para passar e sem precisar adivinhar: existe a opção Ainda não sei." : "Resolva situações, associe ideias e receba uma explicação após cada resposta. Uma atividade por vez."}</p>
    {target.diagnostic ? <div className="callout"><strong>{target.sources.length * 2} questões · {target.sources.length} conceito(s)</strong><p className="muted mt-2">{target.sources.map((source) => source.concept).join(" · ")}</p><p className="muted mt-2 text-sm">Dois acertos independentes sugerem começar pela aplicação daquele conceito. Os demais começam pela base. Conceitos fora desta amostra continuam não avaliados.</p></div> : !diagnostic ? <div className="callout"><strong>Já conhece parte da disciplina?</strong><p className="muted mt-2 text-sm">Faça um diagnóstico curto para ajustar seu ponto de partida. Ou comece direto, com a base.</p><Link className="btn btn-secondary mt-4 w-full" href={`/estudar/iniciar?disciplina=${target.disciplineId}&diagnostico=1`}>Descobrir meu ponto de partida</Link></div> : <p className="callout">{level === "application" ? "Seu diagnóstico sugere começar pela aplicação. Você pode pedir pistas ou escolher rever a base." : "Vamos começar pela base e avançar com suas respostas."}</p>}
    {query.erro && <p role="alert" className="lab-error">{query.erro.startsWith("geracao_") ? `${errors.geracao} Código: ${query.erro.slice(8).replace(/[^A-Z_]/g, "").slice(0, 50)}.` : errors[query.erro] || "Não foi possível abrir o estudo."}</p>}
    {target.sources.length ? <form action={startMaterialStudy} className="grid gap-3"><input type="hidden" name="topicId" value={target.topicId || ""}/><input type="hidden" name="lessonId" value={target.lessonId || ""}/><input type="hidden" name="disciplineId" value={target.disciplineId}/><input type="hidden" name="diagnostic" value={target.diagnostic ? "1" : "0"}/><SubmitButton className="btn btn-primary w-full" pendingText="Preparando e salvando atividades...">{target.diagnostic ? "Começar diagnóstico" : diagnostic ? "Começar aula" : "Começar pela base"}</SubmitButton>{!target.diagnostic && level === "application" && <button name="base" value="1" className="btn btn-ghost w-full">Prefiro rever a base</button>}</form> : <Link className="btn btn-primary" href={`/disciplinas/${target.disciplineId}`}>Adicionar material à disciplina</Link>}
    <p className="lab-save-note">A primeira preparação pode levar até dois minutos. O conteúdo é salvo e reaproveitado nas retomadas. Respostas e pistas ficam no banco; aguarde a preparação terminar antes de fechar.</p>
  </div></section></div>;
}
