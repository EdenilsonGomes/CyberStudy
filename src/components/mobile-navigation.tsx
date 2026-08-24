"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Brain, CalendarCheck, Gauge, GraduationCap, History, LogOut, Menu, MessageCircleQuestion, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

const allItems = [
  ["Dashboard", "/dashboard", Gauge],
  ["Disciplinas", "/disciplinas", BookOpen],
  ["Estudar agora", "/estudar", Brain],
  ["Dificuldades", "/dificuldades", MessageCircleQuestion],
  ["Revisões", "/revisoes", CalendarCheck],
  ["Provas", "/provas", GraduationCap],
  ["Histórico", "/historico", History],
] as const;

const bottomItems = [allItems[0], allItems[1], allItems[2], allItems[4], allItems[5]] as const;

export function MobileNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return <div className="md:hidden">
    <button type="button" className="fixed left-4 top-2.5 z-30 flex min-h-11 items-center gap-2" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}>
      <Menu size={21}/><strong>CyberStudy</strong>
    </button>
    {open && <>
      <button className="fixed inset-0 z-40 bg-black/50" type="button" aria-label="Fechar menu" onClick={() => setOpen(false)}/>
      <aside className="fixed bottom-0 left-0 top-0 z-50 w-[min(84vw,320px)] overflow-y-auto border-r p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <div className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: "var(--brand)" }}><ShieldCheck size={21}/></span><strong className="display text-lg">CyberStudy</strong></div>
          <button className="btn btn-secondary px-3" type="button" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={19}/></button>
        </div>
        <nav className="space-y-1">{allItems.map(([label, href, Icon]) => <Link onClick={() => setOpen(false)} key={href} href={href} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active(href) ? "bg-[var(--surface-2)]" : ""}`}><Icon size={19}/>{label}</Link>)}</nav>
        <form className="mt-8" action="/api/auth/logout" method="post"><button className="btn btn-secondary w-full"><LogOut size={17}/>Sair</button></form>
      </aside>
    </>}
    <nav aria-label="Navegação principal" className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      {bottomItems.map(([label, href, Icon], index) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`flex min-w-0 flex-col items-center justify-center gap-1 py-2 text-[10px] ${active(href) ? "text-[var(--brand)]" : "muted"} ${index === 2 ? "font-extrabold" : ""}`}>
        <span className={index === 2 ? "grid h-9 w-11 place-items-center rounded-xl bg-[var(--brand)] text-white" : "grid h-9 place-items-center"}><Icon size={index === 2 ? 20 : 19}/></span><span className="truncate">{label === "Estudar agora" ? "Estudar" : label}</span>
      </Link>)}
    </nav>
  </div>;
}
