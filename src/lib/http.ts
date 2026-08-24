import { NextResponse } from "next/server";

export function redirectTo(path: string, status = 303) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Destino de redirecionamento inválido");
  }
  return new NextResponse(null, { status, headers: { Location: path } });
}
