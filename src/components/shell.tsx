import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { MobileNavigation } from "./mobile-navigation";
import { DesktopNavigation } from "./desktop-navigation";

function BrandLockup({ compact = false }: { compact?: boolean }) {
  const size = compact ? 36 : 42;
  return (
    <div className="flex items-center gap-2.5">
      <span className={`brand-mark ${compact ? "h-9 w-9" : ""}`}>
        <Image className="rumevo-mark-image" src="/rumevo-mark.svg" alt="" width={size} height={size} priority />
      </span>
      <div className="min-w-0">
        <strong className={`display rumevo-wordmark ${compact ? "text-lg" : "text-xl"}`}>Rumevo</strong>
        {!compact && <div className="rumevo-tagline">Aprender com direção.</div>}
      </div>
    </div>
  );
}

export function Shell({ children, isTest = false }: { children: React.ReactNode; isTest?: boolean }) {
  return (
    <div className="app-shell min-h-screen md:grid md:grid-cols-[208px_minmax(0,1fr)]">
      <aside className="desktop-only app-sidebar sticky top-0 h-screen border-r p-4">
        <Link href="/dashboard" className="mb-9 block px-2" aria-label="Rumevo - início">
          <BrandLockup />
        </Link>
        <DesktopNavigation />
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <ThemeToggle />
          <form action="/api/auth/logout" method="post">
            <button className="btn btn-ghost w-full"><LogOut size={17}/>Sair</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <MobileNavigation />
        <header className="app-topbar sticky top-0 z-20 flex h-16 items-center justify-between border-b px-4 md:px-8">
          <Link href="/dashboard" className="md:hidden" aria-label="Rumevo - início">
            <BrandLockup compact />
          </Link>
          <div className="hidden md:block">
            <strong className="text-sm">Aprender com direção.</strong>
            <p className="muted text-xs">Pequenos passos. Grandes direções.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link className="btn btn-ghost" href="/perfil">Perfil</Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="app-main mx-auto max-w-[1180px] px-4 py-5 pb-28 md:px-8 md:py-8 md:pb-10">
          {isTest && (
            <div role="status" className="mb-4 rounded-xl border border-amber-400 bg-[var(--surface-2)] px-3 py-2 text-xs font-bold">
              CONTA DE TESTE · progresso separado
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
