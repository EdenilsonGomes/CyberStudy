"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Compass, Dumbbell, Home } from "lucide-react";

const items = [
  ["Início", "/dashboard", Home],
  ["Explorar", "/explorar", Compass],
  ["Revisão", "/revisoes", Dumbbell],
  ["Progresso", "/progresso", BarChart3],
] as const;

export function DesktopNavigation() {
  const pathname = usePathname();

  const active = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/explorar" &&
      (pathname.startsWith("/disciplinas") ||
        pathname.startsWith("/aulas/") ||
        pathname.startsWith("/estudar"))) ||
    (href === "/revisoes" &&
      (pathname.startsWith("/flashcards") || pathname.startsWith("/simulado"))) ||
    (href === "/dashboard" && pathname.startsWith("/agenda")) ||
    (href === "/progresso" && pathname.startsWith("/semestre"));

  return (
    <nav className="space-y-1" aria-label="Navegação principal">
      {items.map(([label, href, Icon]) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={`side-link ${active(href) ? "side-link-active" : ""}`}
        >
          <Icon size={19} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
