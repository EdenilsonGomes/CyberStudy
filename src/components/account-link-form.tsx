"use client";
import { useActionState, useState } from "react";
import { createAccountLink } from "@/app/account-actions";

export function AccountLinkForm() {
  const [state, action, pending] = useActionState(createAccountLink, {});
  const [copied, setCopied] = useState(false);
  return <section className="card space-y-4 p-5"><h2 className="section-title">Convite ou recuperação</h2>
    <p className="muted text-sm">Convite: 72 horas. Recuperação: 30 minutos. Cada link funciona uma vez e deve ser entregue em particular. Um novo link invalida o anterior do mesmo tipo.</p>
    <form action={action} onSubmit={() => setCopied(false)} className="space-y-4">
      <label><span className="label">E-mail da conta</span><input className="field" name="email" type="email" autoComplete="off" maxLength={254} required/></label>
      <label><span className="label">Ação</span><select className="field" name="kind"><option value="invite">Convidar nova pessoa</option><option value="reset">Recuperar senha de conta existente</option></select></label>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="isTest"/><span>Nova conta para testes</span></label>
      <p className="muted text-xs">Para sua conta de teste, use outro e-mail ou um alias seu. A conta real não será alterada.</p>
      <button disabled={pending} className="btn btn-primary w-full">{pending ? "Preparando…" : "Gerar link privado"}</button>
    </form>
    {state.error && <p role="alert">{state.error}</p>}
    {state.path && <div className="space-y-3 rounded-xl bg-[var(--surface-2)] p-4"><p className="text-sm">Link criado. Copie antes de sair desta tela; guardamos apenas o hash no banco.</p><button className="btn btn-secondary w-full" onClick={async () => { try { await navigator.clipboard.writeText(new URL(state.path!, window.location.origin).href); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copiado!" : "Copiar link"}</button><details><summary className="min-h-11 cursor-pointer text-sm">Mostrar endereço para copiar manualmente</summary><input className="field" aria-label="Link privado" readOnly value={typeof window !== "undefined" ? new URL(state.path, window.location.origin).href : state.path} onFocus={event => event.target.select()}/></details></div>}
  </section>;
}
