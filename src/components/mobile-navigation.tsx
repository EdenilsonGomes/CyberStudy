"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Dumbbell, Map, Sun } from "lucide-react";

const items = [["Hoje", "/dashboard", Sun], ["Aprender", "/disciplinas", Map], ["Praticar", "/revisoes", Dumbbell], ["Progresso", "/progresso", BarChart3]] as const;
export function MobileNavigation() { const pathname = usePathname(); const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`) || (href === "/disciplinas" && pathname.startsWith("/aulas/")) || (href === "/disciplinas" && pathname.startsWith("/estudar")) || (href === "/revisoes" && (pathname.startsWith("/flashcards") || pathname.startsWith("/simulado"))) || (href === "/dashboard" && pathname.startsWith("/agenda")) || (href === "/progresso" && pathname.startsWith("/semestre")); return <nav aria-label="Navegação principal" className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t md:hidden">{items.map(([label, href, Icon]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`mobile-nav-link ${active(href) ? "mobile-nav-active" : ""}`}><Icon size={20}/><span>{label}</span></Link>)}</nav>; }
