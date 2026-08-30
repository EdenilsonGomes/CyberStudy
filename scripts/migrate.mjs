import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runMigrations } from "./migration-runner.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
const root = dirname(dirname(fileURLToPath(import.meta.url)));
try {
  console.log("Verificando banco antes de iniciar CyberStudy...");
  const applied = await runMigrations(sql, join(root, "migrations"));
  console.log(applied ? `${applied} migration(s) confirmadas. Iniciando aplicação.` : "Banco já está atualizado. Iniciando aplicação.");
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith("Migration ") ? error.message : `Inicialização do banco falhou (código ${error?.code || "unknown"}).`);
  process.exitCode = 1;
} finally { await sql.end({ timeout: 5 }); }
