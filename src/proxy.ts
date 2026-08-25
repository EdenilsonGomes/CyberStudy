import { NextResponse, type NextRequest } from "next/server";
import { redirectTo } from "@/lib/http";

export function proxy(request: NextRequest) {
  if (!request.cookies.get("cyberstudy_session")?.value) {
    return redirectTo(request, `/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/disciplinas/:path*", "/aulas/:path*", "/estudar/:path*", "/progresso/:path*", "/perfil/:path*", "/dificuldades/:path*", "/revisoes/:path*", "/provas/:path*", "/historico/:path*"],
};
