// Pure planning rules: no completion percentage is used as learning evidence.
export const agendaKinds = { PROVA: "Prova", EXERCICIO: "Exercício", TRABALHO: "Trabalho", AULA: "Aula", OUTRO: "Outro compromisso" } as const;
export function localDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function daysUntil(date: string, today: string) { return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000); }
export function validDay(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export type ConceptEvidence = { name: string; mastery: number; samples: number; errors: number; lastError: string | null };
export function evidenceScore(independent: number, total: number, assisted = 0) {
  return total ? Math.min(100, Math.max(0, Math.round((independent + assisted * .35) / total * 100))) : 0;
}
export function materialState(total: number, completed: number, concepts: { mastery: number; samples: number }[]) {
  if (!completed) return "Não iniciado";
  if (completed < total) return "Estudando";
  if (!concepts.length || concepts.some(c => !c.samples)) return "Conteúdo concluído";
  return concepts.every(c => c.mastery >= 80 && c.samples >= 3) ? "Dominado" : "Revisão pendente";
}
export type PlanTopic = { id: string; disciplineId: string; name: string; mastery: number; assessed: boolean; href: string; done: boolean; position: number };
export type PlanEvent = { id: string; disciplineId: string; name: string; date: string; kind: string; topicIds: string[] };
export type PlanItem = { key: string; title: string; reason: string; href: string; minutes: number; kind: string; priority: number };
export function buildDailyPlan(input: { minutes: number; today: string; topics: PlanTopic[]; events: PlanEvent[]; dueTopicIds: string[]; cardsDue: number; diagnosed: string[]; completedToday?: string[]; mocksToday?: string[] }) {
  const budget = Number.isFinite(input.minutes) ? Math.max(5, Math.min(120, Math.floor(input.minutes))) : 30;
  const candidates: PlanItem[] = [];
  const upcoming = input.events.filter(e => daysUntil(e.date, input.today) >= 0).sort((a,b) => a.date.localeCompare(b.date));
  const diagnoses = new Set<string>();
  for (const topic of input.topics) {
    if (input.completedToday?.includes(topic.id)) continue;
    const event = upcoming.find(e => e.disciplineId === topic.disciplineId && (!e.topicIds.length || e.topicIds.includes(topic.id)));
    const days = event ? daysUntil(event.date, input.today) : 999;
    const due = input.dueTopicIds.includes(topic.id);
    const weak = topic.assessed && topic.mastery < 70;
    if (!topic.assessed && !diagnoses.has(topic.disciplineId)) {
      diagnoses.add(topic.disciplineId);
      candidates.push({ key: `diagnostic:${topic.disciplineId}`, title: "Descobrir seu ponto de partida", reason: `Diagnóstico antes de estudar ${topic.name}.`, href: `/estudar/iniciar?disciplina=${topic.disciplineId}&topico=${topic.id}&diagnostico=1`, minutes: 5, kind: "Diagnóstico", priority: 105 + Math.max(0, 25-days) });
    }
    if (topic.done && !due && !weak && days > 7) continue;
    const reviewing = due || weak || topic.done;
    candidates.push({ key: topic.id, title: `${reviewing ? "Reforçar" : "Aprender"}: ${topic.name}`, reason: event ? `${event.name} ${days === 0 ? "hoje" : `em ${days} dia(s)`}. ${event.kind === "EXERCICIO" || event.kind === "TRABALHO" ? "Entenda o conceito antes de fazer a atividade." : days <= 3 ? "Recupere de memória e teste os pontos frágeis." : "Prepare um pouco a cada dia."}` : due ? "Revisão programada para agora." : weak ? "Os últimos resultados mostram uma lacuna." : "Próximo passo do material.", href: reviewing ? `/estudar/iniciar?topico=${topic.id}&revisao=1` : topic.href, minutes: reviewing ? 5 : 8, kind: reviewing ? "Revisão" : "Aprender", priority: (due ? 80 : weak ? 70 : 20) + Math.max(0, 40-days*2) - topic.position * .01 });
  }
  if (input.cardsDue) candidates.push({ key: "cards", title: `Revisar ${Math.min(input.cardsDue, 10)} flashcard${input.cardsDue === 1 ? "" : "s"}`, reason: "Recuperação ativa no momento programado pelo FSRS.", href: "/flashcards", minutes: Math.min(5, input.cardsDue), kind: "Flashcards", priority: 95 });
  for (const event of upcoming.filter(e => e.kind === "PROVA" && daysUntil(e.date, input.today) <= 7 && !input.mocksToday?.includes(e.disciplineId))) candidates.push({ key: `exam:${event.id}`, title: `Simulado: ${event.name}`, reason: "Teste conteúdos antigos e novos; use os erros para ajustar a preparação.", href: `/simulado?disciplina=${event.disciplineId}&evento=${event.id}`, minutes: 15, kind: "Modo prova", priority: daysUntil(event.date, input.today) <= 3 ? 110 : 65 });
  const items: PlanItem[] = []; let remaining = budget;
  for (const item of candidates.sort((a,b) => b.priority-a.priority || a.key.localeCompare(b.key))) {
    if (item.minutes <= remaining) { items.push(item); remaining -= item.minutes; }
  }
  return { items, minutes: budget - remaining, budget };
}
export function preparationPlan(event: PlanEvent, topics: {id:string;mastery:number;assessed:boolean}[], today:string) {
  const days=Math.max(1,daysUntil(event.date,today)+1), scope=topics.filter(t=>!event.topicIds.length||event.topicIds.includes(t.id));
  const remaining=scope.filter(t=>!t.assessed||t.mastery<80).length;
  return { remaining, perDay:Math.ceil(remaining/days), phase:days<=3?"Simular e corrigir lacunas":days<=8?"Recuperar de memória e praticar":"Aprender e consolidar", unknown:scope.filter(t=>!t.assessed).length };
}
