import { createSession, safeEqual, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { redirectTo } from "@/lib/http";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const expectedEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const expectedPassword = process.env.ADMIN_PASSWORD || "";
  if (!expectedEmail || !expectedPassword || !safeEqual(email, expectedEmail) || !safeEqual(password, expectedPassword)) {
    return redirectTo(request, "/login?error=1");
  }
  const response = redirectTo(request, "/dashboard");
  response.cookies.set(SESSION_COOKIE, createSession(email), sessionCookieOptions);
  return response;
}
