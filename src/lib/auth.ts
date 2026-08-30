import { ensureLegacyAccount } from "./accounts";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { LEGACY_USER_ID, readSession, SESSION_MAX_AGE, signSession } from "./account-security";

export const SESSION_COOKIE = "cyberstudy_session";
function secret() {
  const value = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!value) throw new Error("Segredo de autenticação não configurado");
  return value;
}

export const currentUser = cache(async () => {
  const claims = readSession((await cookies()).get(SESSION_COOKIE)?.value, secret(), process.env.ADMIN_EMAIL || "");
  if (!claims) return null;
  if (claims.id === LEGACY_USER_ID) await ensureLegacyAccount();
  const [user] = await getDb().select().from(users).where(and(eq(users.id, claims.id), eq(users.active, true), eq(users.sessionVersion, claims.version))).limit(1);
  return user || null;
});

export async function requireAuth() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "admin") throw new Error("Acesso restrito ao administrador");
  return user;
}

export function createSession(user: typeof users.$inferSelect) { return signSession(user, secret()); }
export async function revokeSessions(userId: string) {
  await getDb().update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
}
export const sessionCookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const,
  path: "/", maxAge: SESSION_MAX_AGE,
};
