import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq, getTableName } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { owned, withOwner } from "../src/db/ownership.ts";
import { createAccountService } from "../src/lib/accounts-core.ts";
import { hashPassword, verifyPassword, signSession, readSession, LEGACY_USER_ID, tokenHash } from "../src/lib/account-security.ts";

const password = "Only-for-local-fixtures-123";

test("signed sessions reject tampering; old cookies identify only the original owner", async () => {
  const secret = "synthetic-secret", user = { id: LEGACY_USER_ID, sessionVersion: 3 };
  const token = signSession(user, secret);
  assert.deepEqual(readSession(token, secret, "owner@example.test"), { id: user.id, version: 3 });
  assert.equal(readSession(token + ".extra", secret, "owner@example.test"), null);
  assert.equal(readSession(token, "wrong", "owner@example.test"), null);
  const legacy = Buffer.from(JSON.stringify({ email: "owner@example.test", exp: Date.now() + 10000 })).toString("base64url");
  const oldCookie = `${legacy}.${createHmac("sha256", secret).update(legacy).digest("base64url")}`;
  assert.deepEqual(readSession(oldCookie, secret, "owner@example.test"), { id: LEGACY_USER_ID, version: 1 });
  assert.equal(readSession(oldCookie, secret, "stranger@example.test"), null);
  const hash = await hashPassword(password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
  assert.notEqual(await hashPassword(password), hash);
});

test("real PostgreSQL migrations, invite lifecycle and cross-account isolation", async t => {
  const pg = new PGlite({ extensions: { pgcrypto } });
  t.after(() => pg.close());
  for (const file of readdirSync("migrations").filter(f => f.endsWith(".sql") && f < "0004" ).sort()) await pg.exec(readFileSync(`migrations/${file}`, "utf8"));
  // Representative pre-migration history, including a pilot without a discipline.
  const original = (await pg.query("INSERT INTO disciplines(name,semester) VALUES('Original course','1') RETURNING id")).rows[0];
  const oldTopic = (await pg.query("INSERT INTO topics(discipline_id,name) VALUES($1,'Original concept') RETURNING id", [original.id])).rows[0];
  await pg.query("INSERT INTO study_sessions(activity_type,note) VALUES('PILOTO_INTERATIVO','Preserve my real history')");
  await pg.exec(readFileSync("migrations/0004_accounts.sql", "utf8"));
  for (const file of readdirSync("migrations").filter(f => f.endsWith(".sql") && f > "0004_accounts.sql").sort()) await pg.exec(readFileSync(`migrations/${file}`, "utf8"));
  const db = drizzle(pg, { schema });
  const service = createAccountService(db, { email: "owner@example.test", password });
  await service.ensureLegacyAccount();
  const owner = await service.authenticateLocal("OWNER@example.test", password);
  assert.equal(owner.id, LEGACY_USER_ID);
  assert.equal(owner.role, "admin");
  assert.equal((await db.select().from(schema.studySessions))[0].note, "Preserve my real history");
  assert.equal((await db.select().from(schema.disciplines))[0].userId, owner.id);
  await createAccountService(db, { email: "changed@example.test", password: "changed" }).ensureLegacyAccount();
  assert.equal((await service.authenticateLocal("owner@example.test", password)).id, owner.id);

  const invite = await service.issueAccountToken(owner.id, "test@example.test", "invite", true);
  const stored = (await db.select().from(schema.accountTokens))[0];
  assert.equal(stored.tokenHash, tokenHash(invite));
  assert.notEqual(stored.tokenHash, invite);
  assert.equal(await service.redeemAccountToken(invite, "Tester", "short"), null);
  const tester = await service.redeemAccountToken(invite, "Tester", password);
  assert.ok(tester.isTest);
  assert.equal(tester.role, "student");
  assert.equal(await service.redeemAccountToken(invite, "Again", password), null);
  assert.equal((await service.authenticateLocal("test@example.test", password)).id, tester.id);
  assert.equal(await service.authenticateLocal("test@example.test", "wrong"), null);
  await assert.rejects(service.issueAccountToken(tester.id, "friend@example.test", "invite"));

  const friendInvite = await service.issueAccountToken(owner.id, "friend@example.test", "invite");
  const replacement = await service.issueAccountToken(owner.id, "friend@example.test", "invite");
  assert.equal(await service.redeemAccountToken(friendInvite, "Friend", password), null);
  const friend = await service.redeemAccountToken(replacement, "Friend", password);
  assert.equal(friend.isTest, false);
  for (const user of [tester, friend]) {
    // Every learning table is empty for a new account, even with known legacy IDs.
    for (const table of Object.values(schema).filter(v => v?.userId && ![schema.authIdentities, schema.accountTokens].includes(v))) {
      assert.equal((await db.select().from(table).where(owned(table, user.id))).length, 0, getTableName(table));
    }
    assert.equal((await db.select().from(schema.disciplines).where(owned(schema.disciplines, user.id, eq(schema.disciplines.id, original.id)))).length, 0);
    assert.equal((await db.update(schema.topics).set({ name: "Hacked" }).where(owned(schema.topics, user.id, eq(schema.topics.id, oldTopic.id))).returning()).length, 0);
    assert.equal((await db.delete(schema.disciplines).where(owned(schema.disciplines, user.id, eq(schema.disciplines.id, original.id))).returning()).length, 0);
    await assert.rejects(db.insert(schema.topics).values(withOwner(user.id, { disciplineId: original.id, name: "Foreign reference" })));
  }
  const [testCourse] = await db.insert(schema.disciplines).values(withOwner(tester.id, { name: "Test course", semester: "1", userId: owner.id })).returning();
  assert.equal(testCourse.userId, tester.id, "form input cannot override the owner");
  const [testTopic] = await db.insert(schema.topics).values(withOwner(tester.id, { disciplineId: testCourse.id, name: "Test concept" })).returning();
  const [testPack] = await db.insert(schema.studyPackages).values(withOwner(tester.id, { cacheKey: "shared-key", kind: "study", disciplineId: testCourse.id, topicId: testTopic.id })).returning();
  await db.insert(schema.studyPackages).values(withOwner(owner.id, { cacheKey: "shared-key", kind: "study", disciplineId: original.id }));
  await assert.rejects(db.insert(schema.interactiveSessions).values(withOwner(friend.id, { lessonKey: "x", contentVersion: 1, state: {}, packageId: testPack.id })));
  for (const user of [tester, friend]) await db.insert(schema.interactiveSessions).values(withOwner(user.id, { lessonKey: "pilot", contentVersion: 1, state: {}, activeKey: "same-pilot" }));
  assert.equal((await db.select().from(schema.interactiveSessions).where(owned(schema.interactiveSessions, tester.id))).length, 1);
  // Cascades/set-null still work with the additional ownership constraints.
  await db.delete(schema.topics).where(owned(schema.topics, tester.id, eq(schema.topics.id, testTopic.id)));
  assert.equal((await db.select().from(schema.studyPackages).where(eq(schema.studyPackages.id, testPack.id)))[0].topicId, null);

  const reset = await service.issueAccountToken(owner.id, "test@example.test", "reset");
  const resetUser = await service.redeemAccountToken(reset, "", password + "-new");
  assert.equal(resetUser.id, tester.id);
  assert.equal(resetUser.sessionVersion, tester.sessionVersion + 1);
  assert.equal(await service.authenticateLocal("test@example.test", password), null);
  assert.equal((await service.authenticateLocal("test@example.test", password + "-new")).id, tester.id);
  assert.equal((await db.select().from(schema.disciplines).where(owned(schema.disciplines, tester.id)))[0].id, testCourse.id);
  await db.update(schema.users).set({ active: false }).where(eq(schema.users.id, tester.id));
  assert.equal(await service.authenticateLocal("test@example.test", password + "-new"), null);
  const expiry = await service.issueAccountToken(owner.id, "expired@example.test", "invite");
  await db.update(schema.accountTokens).set({ expiresAt: new Date(0) }).where(eq(schema.accountTokens.tokenHash, tokenHash(expiry)));
  assert.equal(await service.redeemAccountToken(expiry, "Expired", password), null);
  for (let i = 0; i < 3; i++) assert.equal(await service.allowAuthAttempt("test", "same", 3), true);
  assert.equal(await service.allowAuthAttempt("test", "same", 3), false);
  // Provider replacement adds an identity, not a new learning owner.
  await db.insert(schema.authIdentities).values({ userId: friend.id, provider: "supabase", subject: "future-verified-provider-uuid" });
  assert.equal((await db.select().from(schema.authIdentities).where(and(eq(schema.authIdentities.provider, "supabase"), eq(schema.authIdentities.subject, "future-verified-provider-uuid"))))[0].userId, friend.id);
  const [{ count }] = (await pg.query("SELECT count(*)::int count FROM pg_constraint WHERE conname LIKE 'owner_%' AND contype='f'")).rows;
  assert.ok(count >= 30, `${count} cross-object constraints installed`);
  const { rows: missing } = await pg.query(`
    SELECT c.conname FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND cardinality(c.conkey)=1 AND a.attname <> 'user_id'
      AND c.conrelid IN (SELECT attrelid FROM pg_attribute WHERE attname='user_id' AND NOT attisdropped)
      AND c.confrelid IN (SELECT attrelid FROM pg_attribute WHERE attname='user_id' AND NOT attisdropped)
      AND NOT EXISTS (SELECT 1 FROM pg_constraint pair WHERE pair.conrelid=c.conrelid AND pair.confrelid=c.confrelid AND cardinality(pair.conkey)=2 AND c.conkey[1]=ANY(pair.conkey))
  `);
  assert.deepEqual(missing, [], "every learning FK also checks account ownership");
});
