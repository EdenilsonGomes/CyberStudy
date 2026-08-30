import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export async function runMigrations(sql, directory, log = console.log) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  // Serialize container starts before checking the ledger, not only before DDL.
  return sql.begin(async (tx) => {
    await tx`set local lock_timeout = '30s'`;
    await tx`set local statement_timeout = '90s'`;
    await tx`select pg_advisory_xact_lock(934011, 1)`;
    await tx`create table if not exists _cyberstudy_migrations (name text primary key, applied_at timestamptz not null default now())`;
    let applied = 0;
    for (const name of names) {
      const [done] = await tx`select name from _cyberstudy_migrations where name = ${name}`;
      if (done) continue;
      log(`Aplicando migration: ${name}`);
      try {
        await tx.unsafe(await readFile(join(directory, name), "utf8"));
        await tx`insert into _cyberstudy_migrations (name) values (${name})`;
      } catch (error) {
        // Report the failing stage without printing connection strings or credentials.
        throw new Error(`Migration ${name} falhou (SQLSTATE ${error?.code || "unknown"}).`);
      }
      applied++;
    }
    return applied;
  });
}
