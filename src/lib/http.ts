import { NextResponse } from "next/server";

export function redirectTo(path: string, status = 303) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Destino de redirecionamento inválido");
  }
  // Keep redirects relative to the public origin. EasyPanel terminates HTTPS and
  // forwards requests to the container over its internal HTTP address, so
  // deriving Location from request.url can leak that internal host to browsers.
  return new NextResponse(null, {
    status,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}
