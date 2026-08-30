import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { authenticateLocal, allowAuthAttempt } from "@/lib/accounts";
import { redirectTo, sameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Origem inválida", { status: 403 });
  if (!await allowAuthAttempt("login-global", "all", 200)) return new Response("Aguarde alguns minutos e tente novamente.", { status: 429 });
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const requestedNext = String(form.get("next") || "");
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\") ? requestedNext : "/dashboard";
  const user = await authenticateLocal(email, password);
  if (!user) {
    return redirectTo(request, `/login?error=1&next=${encodeURIComponent(next)}`);
  }
  const response = redirectTo(request, next);
  response.cookies.set(SESSION_COOKIE, createSession(user), sessionCookieOptions);
  return response;
}
