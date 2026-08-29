import { ShieldCheck } from "lucide-react";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next = "/dashboard" } = await searchParams;
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return <main className="grid min-h-screen place-items-center p-5">
    <section className="card w-full max-w-md p-7 md:p-9">
      <div className="mb-8 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: "var(--brand)" }}><ShieldCheck/></span><div><h1 className="text-2xl font-extrabold">CyberStudy</h1><p className="muted text-sm">Seu espaço de estudo seguro</p></div></div>
      <h2 className="mb-2 text-xl font-extrabold">Bem-vindo de volta</h2><p className="muted mb-7 text-sm">Entre para continuar de onde parou.</p>
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">E-mail ou senha incorretos.</p>}
      <form action="/api/auth/login" method="post" className="space-y-5"><input type="hidden" name="next" value={safeNext}/><label><span className="label">E-mail</span><input className="field" name="email" type="email" autoComplete="email" required/></label><label><span className="label">Senha</span><input className="field" name="password" type="password" autoComplete="current-password" required/></label><button className="btn btn-primary w-full" type="submit">Entrar</button></form>
    </section>
  </main>;
}
