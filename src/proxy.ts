import { NextResponse, type NextRequest } from "next/server";
import { redirectTo } from "@/lib/http";

export function proxy(request: NextRequest) {
  if (!request.cookies.get("cyberstudy_session")?.value) {
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    return redirectTo(request, `/login?next=${encodeURIComponent(next)}`, 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/disciplinas/:path*", "/aulas/:path*", "/estudar/:path*", "/progresso/:path*", "/perfil/:path*", "/dificuldades/:path*", "/revisoes/:path*", "/provas/:path*", "/historico/:path*"],
};
