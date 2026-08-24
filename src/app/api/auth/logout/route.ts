import { SESSION_COOKIE } from "@/lib/auth";
import { redirectTo } from "@/lib/http";

export async function POST() {
  const response = redirectTo("/login");
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
  return response;
}
