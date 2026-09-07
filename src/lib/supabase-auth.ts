import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { authIdentities, users } from "@/db/schema";
import { normalizeEmail, validEmail } from "./account-security";

type SupabaseUserPayload = {
  id?: unknown;
  email?: unknown;
  email_confirmed_at?: unknown;
  confirmed_at?: unknown;
};

function authConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url, key };
}

export function supabaseAuthConfigured() {
  return authConfig() !== null;
}

/**
 * Uses Supabase only as the credential/identity provider. Rumevo keeps issuing
 * its existing signed application session so the current authorization and
 * per-user ownership model do not need a risky all-at-once migration.
 */
export async function authenticateSupabase(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  if (!validEmail(email) || password.length < 1 || password.length > 128) return null;
  const config = authConfig();
  if (!config) return null;

  let user: SupabaseUserPayload | undefined;
  try {
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: config.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json() as { user?: SupabaseUserPayload };
    user = payload.user;
  } catch {
    return null;
  }

  const subject = typeof user?.id === "string" ? user.id : "";
  const authEmail = typeof user?.email === "string" ? normalizeEmail(user.email) : "";
  const confirmed = Boolean(user?.email_confirmed_at || user?.confirmed_at);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subject)) return null;
  if (!validEmail(authEmail) || authEmail !== email) return null;

  const db = getDb();
  const [linked] = await db
    .select({ user: users })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(and(
      eq(authIdentities.provider, "supabase"),
      eq(authIdentities.subject, subject),
      eq(users.active, true),
    ))
    .limit(1);
  if (linked) return linked.user;

  // Migration path: only a confirmed Supabase email may claim an already-existing
  // local profile. We never create a new Rumevo profile from a login attempt.
  if (!confirmed) return null;
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, authEmail), eq(users.active, true)))
    .limit(1);
  if (!existing) return null;

  await db.insert(authIdentities).values({
    userId: existing.id,
    provider: "supabase",
    subject,
  }).onConflictDoNothing();

  const [resolved] = await db
    .select({ user: users })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(and(
      eq(authIdentities.provider, "supabase"),
      eq(authIdentities.subject, subject),
      eq(users.active, true),
    ))
    .limit(1);
  return resolved?.user ?? null;
}
