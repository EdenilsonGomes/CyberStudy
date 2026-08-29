import { createSession, safeEqual, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { redirectTo } from "@/lib/http";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const expectedEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const expectedPassword = process.env.ADMIN_PASSWORD || "";
  const requestedNext = String(form.get("next") || "");
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
  if (!expectedEmail || !expectedPassword || !safeEqual(email, expectedEmail) || !safeEqual(password, expectedPassword)) {
    return redirectTo(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  const response = redirectTo(next);
  response.cookies.set(SESSION_COOKIE, createSession(email), sessionCookieOptions);
  return response;
}
