import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const root = dirname(dirname(fileURLToPath(import.meta.url)));
try {
  await sql`create table if not exists _cyberstudy_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const name = "0000_initial.sql";
  const [done] = await sql`select name from _cyberstudy_migrations where name = ${name}`;
  if (!done) {
    const migration = await readFile(join(root, "migrations", name), "utf8");
    await sql.begin(async (tx) => { await tx.unsafe(migration); await tx`insert into _cyberstudy_migrations (name) values (${name})`; });
    console.log(`Migration aplicada: ${name}`);
  } else console.log("Banco já está atualizado.");
} finally { await sql.end(); }
