import { currentUser, revokeSessions, SESSION_COOKIE } from "@/lib/auth";
import { redirectTo, sameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Origem inválida", { status: 403 });
  const user = await currentUser();
  if (user) await revokeSessions(user.id);
  const response = redirectTo(request, "/login");
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  return response;
}
