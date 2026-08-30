import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { getDb } from "../db/index";
import { accountTokens, authIdentities, authRateLimits, users } from "../db/schema.ts";
import { hashPassword, LEGACY_USER_ID, newToken, normalizeEmail, tokenHash, validEmail, validPassword, verifyPassword } from "./account-security.ts";

export function createAccountService(db: ReturnType<typeof getDb>, legacy: { email: string; password: string }) {
/** One-time claim of the legacy owner. Never overwrites an existing password. */
async function ensureLegacyAccount() {
  const [owner] = await db.select().from(users).where(eq(users.id, LEGACY_USER_ID)).limit(1);
  if (owner?.email) return;
  const email = normalizeEmail(legacy.email);
  const password = legacy.password;
  if (!validEmail(email) || !password) throw new Error("Conta original não configurada");
  const passwordHash = await hashPassword(password);
  await db.transaction(async tx => {
    const [locked] = await tx.select().from(users).where(eq(users.id, LEGACY_USER_ID)).for("update");
    if (!locked || locked.email) return;
    await tx.update(users).set({ email, name: email.split("@")[0] }).where(eq(users.id, LEGACY_USER_ID));
    await tx.insert(authIdentities).values({ userId: LEGACY_USER_ID, provider: "local", subject: email, passwordHash });
  });
}

// Persistent atomic limit, shared by app workers. No trust in caller-supplied IPs.
async function allowAuthAttempt(scope: string, identifier: string, maximum = 10) {
  const now = new Date();
  await db.delete(authRateLimits).where(lt(authRateLimits.expiresAt, now));
  const key = tokenHash(`${scope}:${identifier}`);
  const [row] = await db.insert(authRateLimits).values({ key, expiresAt: new Date(Date.now() + 15 * 60_000) }).onConflictDoUpdate({ target: authRateLimits.key, set: { attempts: sql`${authRateLimits.attempts} + 1` } }).returning();
  return row.attempts <= maximum;
}

/** Local adapter. A future Supabase adapter must verify its token, then resolve
 * (provider, subject). Never auto-link just because two emails match. */
async function authenticateLocal(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  if (!validEmail(email) || password.length > 128 || !await allowAuthAttempt("login", email)) return null;
  await ensureLegacyAccount();
  const [row] = await db.select({ user: users, identity: authIdentities }).from(authIdentities).innerJoin(users, eq(users.id, authIdentities.userId)).where(and(eq(authIdentities.provider, "local"), eq(authIdentities.subject, email), eq(users.active, true))).limit(1);
  const dummy = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
  const valid = await verifyPassword(password, row?.identity.passwordHash || dummy);
  return valid && row ? row.user : null;
}

async function issueAccountToken(adminId: string, emailInput: string, kind: "invite" | "reset", isTest = false) {
  const email = normalizeEmail(emailInput);
  const [admin] = await db.select().from(users).where(and(eq(users.id, adminId), eq(users.active, true), eq(users.role, "admin"))).limit(1);
  if (!admin || !validEmail(email)) throw new Error("Não foi possível criar o link.");
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if ((kind === "invite" && existing) || (kind === "reset" && !existing)) throw new Error(kind === "invite" ? "Esse e-mail já tem uma conta." : "Conta não encontrada.");
  const token = newToken();
  await db.transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, adminId)).for("update");
    await tx.update(accountTokens).set({ usedAt: new Date() }).where(and(eq(accountTokens.email, email), eq(accountTokens.kind, kind), isNull(accountTokens.usedAt)));
    await tx.insert(accountTokens).values({ tokenHash: tokenHash(token), kind, email, isTest, userId: existing?.id, createdBy: adminId, expiresAt: new Date(Date.now() + (kind === "invite" ? 72 * 60 : 30) * 60_000) });
  });
  return token;
}

async function redeemAccountToken(token: string, name: string, password: string) {
  if (!/^[\w-]{43}$/.test(token) || !validPassword(password)) return null;
  if (!await allowAuthAttempt("redeem", tokenHash(token))) return null;
  const passwordHash = await hashPassword(password);
  return db.transaction(async tx => {
    const [link] = await tx.select().from(accountTokens).where(and(eq(accountTokens.tokenHash, tokenHash(token)), isNull(accountTokens.usedAt), gt(accountTokens.expiresAt, new Date()))).for("update");
    if (!link) return null;
    const [issuer] = await tx.select().from(users).where(and(eq(users.id, link.createdBy), eq(users.role, "admin"), eq(users.active, true))).limit(1);
    if (!issuer) return null;
    let user: typeof users.$inferSelect;
    if (link.kind === "invite") {
      if (name.trim().length < 2 || name.trim().length > 80) return null;
      const [created] = await tx.insert(users).values({ email: link.email, name: name.trim(), isTest: link.isTest }).onConflictDoNothing().returning();
      if (!created) return null;
      user = created;
      await tx.insert(authIdentities).values({ userId: user.id, provider: "local", subject: link.email, passwordHash });
    } else {
      if (!link.userId) return null;
      const [existing] = await tx.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(and(eq(users.id, link.userId), eq(users.active, true))).returning();
      if (!existing) return null;
      user = existing;
      const [identity] = await tx.update(authIdentities).set({ passwordHash }).where(and(eq(authIdentities.userId, user.id), eq(authIdentities.provider, "local"))).returning({ id: authIdentities.id });
      if (!identity) throw new Error("Conta sem autenticação local");
    }
    await tx.update(accountTokens).set({ usedAt: new Date() }).where(eq(accountTokens.id, link.id));
    return user;
  });
}

return { ensureLegacyAccount, allowAuthAttempt, authenticateLocal, issueAccountToken, redeemAccountToken };
}
