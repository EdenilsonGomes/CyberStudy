import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  const configuredPool = Number(process.env.DATABASE_POOL_SIZE || 5);
  const max = Number.isInteger(configuredPool) && configuredPool >= 1 && configuredPool <= 20 ? configuredPool : 5;
  client ??= postgres(url, { max, prepare: false });
  return drizzle(client, { schema });
}
