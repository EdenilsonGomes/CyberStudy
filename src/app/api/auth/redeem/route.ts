import { redeemAccountToken, allowAuthAttempt } from "@/lib/accounts";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { redirectTo, sameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Origem inválida", { status: 403 });
  if (!await allowAuthAttempt("redeem-global", "all", 100)) return new Response("Aguarde alguns minutos.", { status: 429 });
  const form = await request.formData(), token = String(form.get("token") || "");
  const password = String(form.get("password") || "");
  const fail = () => redirectTo(request, `/acesso?token=${encodeURIComponent(token.slice(0, 100))}&erro=1`);
  if (password !== String(form.get("confirm") || "")) return fail();
  try {
    const user = await redeemAccountToken(token, String(form.get("name") || ""), password);
    if (!user) return fail();
    const response = redirectTo(request, "/dashboard");
    response.cookies.set(SESSION_COOKIE, createSession(user), sessionCookieOptions);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch { return fail(); }
}
