import Image from "next/image";
import Link from "next/link";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next = "/dashboard" } = await searchParams;
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <main className="grid min-h-screen place-items-center p-5">
      <section className="card rumevo-login-card w-full max-w-md p-7 md:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="brand-mark h-12 w-12 shrink-0">
            <Image className="rumevo-mark-image" src="/rumevo-mark.svg" alt="" width={48} height={48} priority />
          </span>
          <div>
            <h1 className="rumevo-wordmark text-2xl">Rumevo</h1>
            <p className="muted text-sm">Aprender com direção.</p>
          </div>
        </div>

        <h2 className="mb-2 text-xl font-extrabold">Bem-vindo de volta</h2>
        <p className="muted mb-7 text-sm">Continue sua jornada de onde parou.</p>

        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Não foi possível entrar. Confira e-mail e senha; se tentou várias vezes, aguarde 15 minutos.
          </p>
        )}

        <form action="/api/auth/login" method="post" className="space-y-5">
          <input type="hidden" name="next" value={safeNext}/>
          <label>
            <span className="label">E-mail</span>
            <input className="field" name="email" type="email" autoComplete="email" required/>
          </label>
          <label>
            <span className="label">Senha</span>
            <input className="field" name="password" type="password" autoComplete="current-password" required/>
          </label>
          <button className="btn btn-primary w-full" type="submit">Entrar</button>
        </form>

        <Link className="btn btn-ghost mt-4 w-full" href="/acesso">
          Esqueci minha senha / tenho um convite
        </Link>
      </section>
    </main>
  );
}
