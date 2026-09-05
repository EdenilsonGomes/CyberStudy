"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Dumbbell, Map, Sun } from "lucide-react";

const items = [["Hoje", "/dashboard", Sun], ["Aprender", "/disciplinas", Map], ["Praticar", "/revisoes", Dumbbell], ["Progresso", "/progresso", BarChart3]] as const;

export function DesktopNavigation() {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`) || (href === "/disciplinas" && pathname.startsWith("/aulas/")) || (href === "/disciplinas" && pathname.startsWith("/estudar")) || (href === "/revisoes" && (pathname.startsWith("/flashcards") || pathname.startsWith("/simulado"))) || (href === "/dashboard" && pathname.startsWith("/agenda")) || (href === "/progresso" && pathname.startsWith("/semestre"));
  return <nav className="space-y-1" aria-label="Navegação principal">{items.map(([label, href, Icon]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`side-link ${active(href) ? "side-link-active" : ""}`}><Icon size={19}/>{label}</Link>)}</nav>;
}
