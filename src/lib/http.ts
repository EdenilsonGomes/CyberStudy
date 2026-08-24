import { NextResponse } from "next/server";

export function redirectTo(request: Request, path: string, status = 303) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Destino de redirecionamento inválido");
  }
  return NextResponse.redirect(new URL(path, request.url), status);
}
