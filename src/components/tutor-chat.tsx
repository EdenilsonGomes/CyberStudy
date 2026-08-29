"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { Bot, CheckCircle2, Sparkles } from "lucide-react";
import { useFormStatus } from "react-dom";
import { continueTutor, retryTutorResponse } from "@/app/actions";

type ChatMessage = {
  id: string;
  role: string;
  mode: string;
  content: string;
};

const modes = [
  ["EXPLICAR", "Explicar"],
  ["DIAGNOSTICAR", "Diagnosticar"],
  ["DAR_EXEMPLO", "Dar exemplo"],
  ["CRIAR_EXERCICIO", "Criar exercício"],
  ["RESUMIR", "Resumir"],
] as const;

function ChatContent({ messages, needsRetry, focus, returnTo }: { messages: ChatMessage[]; needsRetry: boolean; focus: boolean; returnTo: string }) {
  const { pending } = useFormStatus();
  const scrollArea = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const area = scrollArea.current;
    if (!area) return;
    area.scrollTo({ top: area.scrollHeight, behavior: pending ? "smooth" : "auto" });
  }, [messages.length, pending]);

  return <>
    <div ref={scrollArea} className="chat-scroll space-y-3 overflow-y-auto px-4 py-5 md:px-6">
      {messages.map((message) => <div key={message.id} className={`chat-message rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "USER" ? "chat-message-user ml-auto text-white" : "bg-[var(--surface-2)]"}`}>
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest opacity-70">{message.role === "USER" ? "Você" : message.mode.replaceAll("_", " ")}</span>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>)}
      {pending && <div aria-live="polite" className="chat-message flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-sm">
        <Bot size={18}/><span>Estou pensando</span><span className="thinking-dots" aria-hidden="true"><i/><i/><i/></span>
      </div>}
    </div>
    <div className="border-t p-3 md:p-4" style={{ borderColor: "var(--line)" }}>
      {focus && returnTo && <div className="mb-3 grid gap-2 sm:grid-cols-2"><Link className="btn btn-primary" href={returnTo}><CheckCircle2 size={17}/>Entendi agora</Link><a className="btn btn-secondary" href="#tutor-message">Ainda não</a></div>}
      {needsRetry && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--danger)" }}>
        <span>A resposta anterior não foi concluída.</span>
        <button formAction={retryTutorResponse} formNoValidate className="btn btn-secondary min-h-9 px-3 py-1 text-xs">Tentar novamente</button>
      </div>}
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
        {modes.map(([value, label]) => <label key={value} className="badge shrink-0 cursor-pointer px-3 py-2">
          <input className="mr-1" type="radio" name="mode" value={value} defaultChecked={value === "EXPLICAR"}/>{label}
        </label>)}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          id="tutor-message"
          className="field max-h-32 min-h-12 resize-none"
          name="message"
          rows={1}
          required
          disabled={pending}
          aria-label="Mensagem para o tutor"
          placeholder="Escreva sua resposta..."
          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button disabled={pending} className="btn btn-primary h-12 shrink-0 px-4" aria-label="Enviar mensagem">
          <Sparkles size={18}/><span className="hidden sm:inline">Enviar</span>
        </button>
      </div>
      <p className="muted mt-2 px-1 text-[11px]">Enter envia · Shift + Enter quebra a linha</p>
    </div>
  </>;
}

export function TutorChat({ difficultyId, messages, guided = false, focus = false, returnTo = "" }: { difficultyId: string; messages: ChatMessage[]; guided?: boolean; focus?: boolean; returnTo?: string }) {
  const visibleMessages = messages.filter((message) => message.content.trim());
  const lastMessage = messages.at(-1);
  const needsRetry = lastMessage?.role === "USER" || !lastMessage?.content.trim();
  return <form action={continueTutor} className="card overflow-hidden">
    <input type="hidden" name="difficultyId" value={difficultyId}/>
    <input type="hidden" name="guided" value={guided ? "1" : "0"}/>
    <input type="hidden" name="focus" value={focus ? "1" : "0"}/>
    <input type="hidden" name="returnTo" value={returnTo}/>
    <div className="border-b px-4 py-4 md:px-5" style={{ borderColor: "var(--line)" }}>
      <p className="eyebrow">Cyber</p><h2 className="section-title flex items-center gap-2"><Bot size={20}/>{focus ? "Vamos tentar de outra forma" : "Tutor em ação"}</h2>
      <p className="muted mt-1 text-sm">{focus ? "Estou usando o assunto e a etapa da sua aula como contexto." : guided ? "Microlição: explique com suas palavras e depois pratique" : "Uma explicação por vez, sem perguntas repetidas"}</p>
    </div>
    <ChatContent messages={visibleMessages} needsRetry={needsRetry} focus={focus} returnTo={returnTo}/>
  </form>;
}
