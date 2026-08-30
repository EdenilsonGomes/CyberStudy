import { and, eq, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** The ID comes from the verified server session, never from form fields. */
export function owned(table: { userId: AnyPgColumn }, userId: string, condition?: SQL) {
  if (!/^[a-f0-9-]{36}$/i.test(userId)) throw new Error("Identidade inválida");
  return and(eq(table.userId, userId), condition)!;
}

export function withOwner<T extends object>(userId: string, rows: T[]): (T & { userId: string })[];
export function withOwner<T extends object>(userId: string, rows: T): T & { userId: string };
export function withOwner(userId: string, rows: object | object[]) {
  return Array.isArray(rows) ? rows.map(row => ({ ...row, userId })) : { ...rows, userId };
}
