import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = { referrer: "no-referrer" as const };

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ token?: string; erro?: string }> }) {
  const { token = "", erro } = await searchParams;
  return <main className="grid min-h-dvh place-items-center p-4"><section className="card w-full max-w-md space-y-5 p-5 sm:p-8">
    <p className="eyebrow">CyberStudy · acesso pessoal</p><h1 className="page-title">Seu espaço para aprender</h1>
    {!/^[\w-]{43}$/.test(token) ? <p>Peça um convite ao administrador para criar sua conta. Se esqueceu a senha, peça um link de recuperação. Ainda não enviamos e-mails automáticos.</p> : <>
      <p className="muted text-sm">Use seu convite ou link de recuperação para definir uma senha. Seu progresso fica separado das outras contas.</p>
      {erro && <p role="alert" className="rounded-xl border border-red-400 p-3 text-sm">Confira o nome e as senhas. O link também pode estar usado ou expirado; nesse caso, peça outro ao administrador.</p>}
      <form method="post" action="/api/auth/redeem" className="space-y-4"><input type="hidden" name="token" value={token}/>
        <label><span className="label">Nome (obrigatório para conta nova)</span><input className="field" name="name" autoComplete="name" minLength={2} maxLength={80}/></label>
        <label><span className="label">Nova senha · 12 a 128 caracteres</span><input className="field" type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <label><span className="label">Repita a senha</span><input className="field" type="password" name="confirm" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <button className="btn btn-primary w-full">Salvar senha e entrar</button>
      </form></>}
    <Link href="/login" className="btn btn-ghost w-full">Voltar ao login</Link>
  </section></main>;
}
