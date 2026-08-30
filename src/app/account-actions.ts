"use server";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { issueAccountToken } from "@/lib/accounts";

export async function createAccountLink(_previous: { path?: string; error?: string }, form: FormData): Promise<{ path?: string; error?: string }> {
  const admin = await requireAdmin();
  try {
    const token = await issueAccountToken(admin.id, String(form.get("email") || ""), form.get("kind") === "reset" ? "reset" : "invite", form.get("isTest") === "on");
    revalidatePath("/perfil/contas");
    return { path: `/acesso?token=${token}` };
  } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível criar o link." }; }
}

export async function setAccountActive(form: FormData) {
  const admin = await requireAdmin();
  await getDb().update(users).set({ active: form.get("active") === "1", sessionVersion: sql`${users.sessionVersion} + 1` }).where(and(eq(users.id, String(form.get("userId") || "")), ne(users.id, admin.id), eq(users.role, "student")));
  revalidatePath("/perfil/contas");
}
