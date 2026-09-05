"use client";
import { useState } from "react";
import { saveAcademicEvent } from "@/app/copilot-actions";
import { agendaKinds } from "@/lib/copilot";
import { SubmitButton } from "@/components/submit-button";
export function AgendaForm({ courses, topics, event }: { courses: {id:string;name:string}[]; topics:{id:string;name:string;disciplineId:string}[]; event?:{id:string;disciplineId:string;name:string;kind:string;date:string;notes:string|null;topicIds:string[]} }) {
  const [course,setCourse] = useState(event?.disciplineId || courses[0]?.id || "");
  return <form action={saveAcademicEvent} className="space-y-4">
    {event && <input type="hidden" name="id" value={event.id}/>}
    <label className="block"><span className="label">Compromisso</span><input className="field" name="name" maxLength={140} required defaultValue={event?.name} placeholder="Ex.: P1 de Arquitetura"/></label>
    <label className="block"><span className="label">Tipo</span><select className="field" name="kind" defaultValue={event?.kind || "PROVA"}>{Object.entries(agendaKinds).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <label className="block"><span className="label">Disciplina</span><select className="field" name="disciplineId" required value={course} onChange={e => setCourse(e.target.value)}>{courses.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
    <label className="block"><span className="label">Data</span><input className="field" type="date" name="date" required defaultValue={event?.date}/></label>
    <fieldset key={course}><legend className="label">Conteúdos necessários</legend><p className="muted text-sm mb-2">Sem seleção, o plano considera toda a disciplina.</p><div className="max-h-52 overflow-auto space-y-2">{topics.filter(t => t.disciplineId === course).map(t => <label className="flex gap-3 items-center min-h-11" key={t.id}><input type="checkbox" name="topicIds" value={t.id} defaultChecked={event?.topicIds.includes(t.id)}/><span>{t.name}</span></label>)}</div></fieldset>
    <label className="block"><span className="label">Orientações do professor</span><textarea className="field" name="notes" maxLength={2000} defaultValue={event?.notes || ""}/></label><SubmitButton pendingText="Salvando…" className="btn btn-primary w-full">Salvar compromisso</SubmitButton>
  </form>;
}
