import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { runMigrations } from "../scripts/migration-runner.mjs";

const directory = fileURLToPath(new URL("../migrations", import.meta.url));
function fakeDatabase(applied = [], fail = false) {
  const calls = [], ledger = new Set(applied);
  const sql = { begin: async (fn) => {
    calls.push("begin"); const transactionLedger = new Set(ledger);
    const tx = async (strings, ...values) => {
      const query = strings.join("?"); calls.push(query);
      if (query.startsWith("select name")) return transactionLedger.has(values[0]) ? [{ name: values[0] }] : [];
      if (query.startsWith("insert into")) transactionLedger.add(values[0]);
      return [];
    };
    tx.unsafe = async () => { calls.push("ddl"); if (fail) throw Object.assign(new Error("hidden connection details"), { code: "42P07" }); };
    try { const result = await fn(tx); calls.push("commit"); for (const name of transactionLedger) ledger.add(name); return result; }
    catch (error) { calls.push("rollback"); throw error; }
  } };
  return { sql, calls, ledger };
}
test("migration ledger and DDL are checked under the same transaction lock", async () => {
  const db = fakeDatabase();
  assert.equal(await runMigrations(db.sql, directory, () => {}), 4);
  assert.equal(db.calls[0], "begin"); assert.equal(db.calls.at(-1), "commit");
  assert.ok(db.calls.indexOf("select pg_advisory_xact_lock(934011, 1)") < db.calls.findIndex((query) => query.startsWith("select name")));
  assert.equal(db.calls.filter((query) => query === "ddl").length, 4);
  db.calls.length = 0;
  assert.equal(await runMigrations(db.sql, directory, () => {}), 0);
  assert.equal(db.calls.includes("ddl"), false);
});
test("failed migration rolls back, names the failing stage and hides raw error details", async () => {
  const db = fakeDatabase(["0000_initial.sql", "0001_learning_path.sql", "0002_interactive_sessions.sql"], true);
  await assert.rejects(runMigrations(db.sql, directory, () => {}), /Migration 0003_material_study.sql falhou \(SQLSTATE 42P07\)/);
  assert.equal(db.calls.at(-1), "rollback"); assert.equal(db.ledger.has("0003_material_study.sql"), false);
});
