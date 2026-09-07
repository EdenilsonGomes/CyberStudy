import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { AccountLinkForm } from "@/components/account-link-form";
import { setAccountActive } from "@/app/account-actions";
import { supabaseAuthConfigured } from "@/lib/supabase-auth";

export default async function AccountsPage() {
  const admin = await requireAdmin();
  const usesSupabase = supabaseAuthConfigured();
  const accounts = await getDb().select({ id: users.id, name: users.name, email: users.email, isTest: users.isTest, active: users.active }).from(users).orderBy(asc(users.createdAt));
  return <div className="mx-auto max-w-xl space-y-5"><Link className="btn btn-ghost" href="/perfil">← Perfil</Link><header><p className="eyebrow">Administração</p><h1 className="page-title">Contas e convites</h1><p className="muted mt-3 text-sm">Todos usam a mesma versão. Materiais, conversas e progresso são privados por conta. O administrador gerencia acesso, não navega pelos estudos dos outros.</p></header>{usesSupabase ? <section className="card space-y-3 p-4"><strong>Supabase Auth ativo</strong><p className="muted text-sm">Nesta primeira etapa, crie ou recupere usuários em Authentication → Users no Supabase usando o mesmo e-mail que já existe no Rumevo. No primeiro login confirmado, a identidade do Supabase é vinculada ao perfil existente sem perder o progresso.</p></section> : <AccountLinkForm/>}
    <section className="space-y-3"><h2 className="section-title">Pessoas</h2>{accounts.map(account => <article className="card space-y-3 p-4" key={account.id}><div className="min-w-0"><strong className="break-words">{account.name}</strong><p className="muted break-all text-sm">{account.email}</p><span className="badge mt-2">{account.isTest ? "TESTE" : "Pessoal"} · {account.active ? "Ativa" : "Suspensa"}</span></div>{account.id !== admin.id && <form action={setAccountActive}><input type="hidden" name="userId" value={account.id}/><input type="hidden" name="active" value={account.active ? "0" : "1"}/><button className="btn btn-secondary w-full">{account.active ? "Suspender acesso (preservar dados)" : "Reativar acesso"}</button></form>}</article>)}</section>
  </div>;
}
