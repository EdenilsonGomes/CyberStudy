import { NextResponse,type NextRequest } from "next/server";
export function proxy(request:NextRequest){if(!request.cookies.get("cyberstudy_session")?.value){const url=new URL("/login",request.url);url.searchParams.set("next",request.nextUrl.pathname);return NextResponse.redirect(url)}return NextResponse.next()}
export const config={matcher:["/dashboard/:path*","/disciplinas/:path*","/estudar/:path*","/dificuldades/:path*","/revisoes/:path*","/provas/:path*","/historico/:path*"]};
