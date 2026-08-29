import { NextResponse } from "next/server";

function configuredOrigin() {
  const value = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!value) return "";
  try { return new URL(value).origin; } catch { return ""; }
}

function publicOrigin(request: Request) {
  const configured = configuredOrigin();
  if (configured) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const requestHost = request.headers.get("host")?.split(",")[0].trim();
  const host = forwardedHost || requestHost;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
  const protocol = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : new URL(request.url).protocol.slice(0, -1);

  if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return `${protocol}://${host}`;
  return new URL(request.url).origin;
}

export function redirectTo(request: Request, path: string, status = 303) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Destino de redirecionamento inválido");
  }
  const response = NextResponse.redirect(new URL(path, publicOrigin(request)), status);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
