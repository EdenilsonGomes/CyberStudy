import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq, isNotNull } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { owned } from "../src/db/ownership.ts";
import { buildTrail, studyCoverageComplete, trailStepFor } from "../src/lib/trail.ts";
import { initialLessonState, transition } from "../src/lib/interactive-lesson.ts";
import { binaryPilot } from "../src/lib/pilot-lesson.ts";
import { applyStudyCommand } from "../src/lib/study-session-core.ts";

const at = i => new Date(2026, 0, i);
const topic = (id, materialId = "pdf1", extra = {}) => ({ id, name: id, materialId, position: Number(id.slice(1)) || 1, status: "NAO_ESTUDADO", createdAt: at(1), ...extra });
const fixture = () => ({ topics: [topic("t1"), topic("t2"), topic("t3", "pdf2")], materials: [{ id: "pdf1", title: "Unidade 1", createdAt: at(1) }, { id: "pdf2", title: "Unidade 2", createdAt: at(2) }], units: [], lessons: [], completed: [], attempts: [] });

test("next step is ordered coverage, independent of reviews, mastery and repeats", () => {
  const input = fixture();
  input.topics[0].status = "REVISAR"; input.topics[0].mastery = 0;
  input.completed = [{ topicId: "t1", lessonId: null }];
  let trail = buildTrail(input);
  assert.equal(trail.next.topicId, "t2"); assert.equal(trail.completed, 1);
  assert.equal(trail.steps[0].done, true); assert.equal(trail.steps[0].reinforce, true);
  input.completed.push(...Array.from({ length: 120 }, () => ({ topicId: "t2", lessonId: null })));
  trail = buildTrail(input);
  assert.equal(trail.next.topicId, "t3"); assert.equal(trail.completed, 2);
  assert.equal(trail.groups[0].done, true); assert.equal(trail.currentUnit.id, "pdf2");
  input.completed.push({ topicId: "t3", lessonId: null });
  trail = buildTrail(input);
  assert.equal(trail.done, true); assert.equal(trail.next, undefined); assert.equal(trail.currentUnit, undefined);
  assert.equal(input.topics[0].mastery, 0, "completion must not fabricate mastery");
});

test("explicit topic position preserves pedagogy when database timestamps are identical", () => {
  const input = fixture();
  input.topics = [topic("random-a", "pdf1", { position: 2 }), topic("random-z", "pdf1", { position: 0 }), topic("random-m", "pdf1", { position: 1 })];
  assert.deepEqual(buildTrail(input).steps.map(step => step.topicId), ["random-z", "random-m", "random-a"]);
});

test("next PDF needs preparation; empty or ambiguous legacy content is not completed", () => {
  const input = fixture(); input.topics = input.topics.slice(0, 2);
  input.completed = input.topics.map(t => ({ topicId: t.id, lessonId: null }));
  let trail = buildTrail(input);
  assert.equal(trail.done, false); assert.equal(trail.currentUnit.id, "pdf2"); assert.equal(trail.next, undefined);
  input.topics.push(topic("t3", null)); trail = buildTrail(input);
  assert.equal(trail.groups[0].id, "legacy"); assert.equal(trail.next.topicId, "t3");
  assert.equal(buildTrail({ ...fixture(), topics: [], materials: [] }).done, false);
});

test("micro-lessons follow stored unit positions and a topic cannot complete multiple lessons", () => {
  const input = fixture();
  input.units = [{ id: "u2", materialId: "pdf1", title: "B", position: 2, createdAt: at(1) }, { id: "u1", materialId: "pdf1", title: "A", position: 1, createdAt: at(2) }];
  input.lessons = [{ id: "l2", topicId: "t1", unitId: "u2", title: "Second", position: 1 }, { id: "l1", topicId: "t1", unitId: "u1", title: "First", position: 1 }];
  input.completed = [{ topicId: "t1", lessonId: null }];
  let trail = buildTrail(input);
  assert.equal(trail.next.lessonId, "l1"); assert.equal(trail.steps[1].done, false);
  input.attempts = [{ lessonId: "l1", score: 20 }]; trail = buildTrail(input);
  assert.equal(trail.next.lessonId, "l2", "finishing a legacy exercise permits progress, not mastery");
  assert.equal(trailStepFor(trail.steps, { key: "study:t1", topicId: "t1" }).lessonId, "l2");
  input.lessons.pop(); trail = buildTrail(input);
  assert.equal(trail.steps[0].done, true, "an unambiguous historical topic completion is retained");
});

test("last answer saves coverage before result navigation; partial and diagnostic answers do not", () => {
  const lesson = binaryPilot;
  let state = initialLessonState();
  assert.equal(studyCoverageComplete(lesson, state), false);
  for (const [index, step] of lesson.steps.entries()) {
    state = transition(lesson, state, { type: "answer", answer: step.expected, revision: state.revision, seconds: 1 });
    assert.equal(studyCoverageComplete(lesson, state), index === lesson.steps.length - 1);
    if (index < lesson.steps.length - 1) state = transition(lesson, state, { type: "next", revision: state.revision, seconds: 1 });
  }
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(restored.completed, false, "feedback still stays on screen");
  assert.equal(studyCoverageComplete(lesson, restored), true);
  assert.equal(studyCoverageComplete({ ...lesson, mode: "diagnostic" }, restored), false);
  delete restored.evidence[lesson.steps[0].id];
  assert.equal(studyCoverageComplete(lesson, restored), false);
});

test("database upgrade preserves legacy history and completion remains visible after 120 repeats", async t => {
  const pg = new PGlite({ extensions: { pgcrypto } }); t.after(() => pg.close());
  for (const f of readdirSync("migrations").filter(f => f.endsWith(".sql") && f < "0005").sort()) await pg.exec(readFileSync(`migrations/${f}`, "utf8"));
  const owner = "00000000-0000-4000-8000-000000000001";
  const course = (await pg.query("INSERT INTO disciplines(user_id,name,semester) VALUES($1,'Synthetic course','1') RETURNING id", [owner])).rows[0];
  const first = (await pg.query("INSERT INTO materials(user_id,discipline_id,title,type,content) VALUES($1,$2,'PDF unit 1','PDF','Synthetic local content') RETURNING id", [owner, course.id])).rows[0];
  const oldTopic = (await pg.query("INSERT INTO topics(user_id,discipline_id,name) VALUES($1,$2,'Original lesson') RETURNING id", [owner, course.id])).rows[0];
  await pg.exec(readFileSync("migrations/0005_trail_material.sql", "utf8"));
  await pg.exec(readFileSync("migrations/0006_topic_position.sql", "utf8"));
  assert.equal((await pg.query("SELECT material_id,mastery FROM topics WHERE id=$1", [oldTopic.id])).rows[0].material_id, first.id);
  const db = drizzle(pg, { schema });
  const other = (await pg.query("INSERT INTO users(name) VALUES('Another test user') RETURNING id")).rows[0];
  const otherCourse = (await pg.query("INSERT INTO disciplines(user_id,name,semester) VALUES($1,'Other course','1') RETURNING id", [other.id])).rows[0];
  await assert.rejects(pg.query("INSERT INTO topics(user_id,discipline_id,material_id,name) VALUES($1,$2,$3,'Foreign material')", [other.id, otherCourse.id, first.id]));
  const pack = (await pg.query("INSERT INTO study_packages(user_id,discipline_id,topic_id,cache_key,kind) VALUES($1,$2,$3,'first','study') RETURNING id", [owner, course.id, oldTopic.id])).rows[0];
  await pg.query("INSERT INTO interactive_sessions(user_id,lesson_key,content_version,package_id,state,completed_at) VALUES($1,'study:original',1,$2,$3,now()-interval '10 days')", [owner, pack.id, JSON.stringify({ completed: true })]);
  const newerTopic = (await pg.query("INSERT INTO topics(user_id,discipline_id,material_id,name) VALUES($1,$2,$3,'Newer lesson') RETURNING id", [owner, course.id, first.id])).rows[0];
  const newerPack = (await pg.query("INSERT INTO study_packages(user_id,discipline_id,topic_id,cache_key,kind) VALUES($1,$2,$3,'newer','study') RETURNING id", [owner, course.id, newerTopic.id])).rows[0];
  await pg.query("INSERT INTO interactive_sessions(user_id,lesson_key,content_version,package_id,state,completed_at) SELECT $1,'study:newer',1,$2,$3,now() FROM generate_series(1,120)", [owner, newerPack.id, JSON.stringify({ completed: true })]);
  const completions = await db.selectDistinct({ lessonId: schema.studyPackages.lessonId, topicId: schema.studyPackages.topicId }).from(schema.interactiveSessions).innerJoin(schema.studyPackages, eq(schema.interactiveSessions.packageId, schema.studyPackages.id)).where(owned(schema.interactiveSessions, owner, and(eq(schema.studyPackages.kind, "study"), isNotNull(schema.interactiveSessions.completedAt))));
  assert.equal(completions.length, 2); assert.ok(completions.some(c => c.topicId === oldTopic.id));
  assert.equal((await db.select().from(schema.topics).where(owned(schema.topics, owner, eq(schema.topics.id, oldTopic.id))))[0].mastery, 0);
  await pg.query("DELETE FROM materials WHERE id=$1", [first.id]);
  assert.equal((await pg.query("SELECT material_id FROM topics WHERE id=$1", [oldTopic.id])).rows[0].material_id, null, "removing attachment does not remove learning history");
});

test("entry points share progress and repeat requires an explicit review intent", () => {
  for (const file of ["src/app/(app)/estudar/iniciar/page.tsx", "src/app/study-actions.ts"]) {
    const source = readFileSync(file, "utf8"); assert.match(source, /loadTrail/); assert.match(source, /trailStepFor/); assert.match(source, /revisao|review/);
  }
  assert.doesNotMatch(readFileSync("src/lib/trail-data.ts", "utf8"), /limit\(100\)|pickNextTopic/);
  assert.match(readFileSync("src/app/(app)/dashboard/page.tsx", "utf8"), /buildDailyPlan/);
  assert.doesNotMatch(readFileSync("src/app/actions.ts", "utf8").split("export async function createLearningPath")[1].split("export async function completeMicroLesson")[0], /delete\(learningUnits\)/);
});

test("actual study transaction saves last answer once, rejects duplicate commands and another owner", async t => {
  const pg = new PGlite({ extensions: { pgcrypto } }); t.after(() => pg.close());
  for (const f of readdirSync("migrations").filter(f => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(`migrations/${f}`, "utf8"));
  const userId = "00000000-0000-4000-8000-000000000001";
  const db = drizzle(pg, { schema });
  const [course] = await db.insert(schema.disciplines).values({ userId, name: "Isolated test", semester: "1" }).returning();
  const [topicRow] = await db.insert(schema.topics).values({ userId, disciplineId: course.id, name: "Bits" }).returning();
  const [pack] = await db.insert(schema.studyPackages).values({ userId, disciplineId: course.id, topicId: topicRow.id, cacheKey: "transaction-test", kind: "study", content: binaryPilot }).returning();
  const [session] = await db.insert(schema.interactiveSessions).values({ userId, packageId: pack.id, lessonKey: `study:${topicRow.id}`, activeKey: `study:${topicRow.id}`, contentVersion: 1, state: initialLessonState() }).returning();
  const send = async (state, type, answer) => applyStudyCommand(db, userId, session.id, { type, answer, revision: state.revision, seconds: 1 });
  let state = session.state;
  for (const [index, step] of binaryPilot.steps.entries()) {
    const result = await send(state, "answer", step.expected); state = result.state;
    if (index < binaryPilot.steps.length - 1) { assert.equal((await db.select().from(schema.studySessions)).length, 0); state = (await send(state, "next")).state; }
  }
  const [saved] = await db.select().from(schema.interactiveSessions).where(eq(schema.interactiveSessions.id, session.id));
  assert.ok(saved.completedAt); assert.equal(saved.activeKey, null); assert.equal(state.completed, false);
  assert.equal((await db.select().from(schema.studySessions)).length, 1);
  const [review] = await db.select().from(schema.reviews); assert.ok(review);
  const duplicate = await applyStudyCommand(db, userId, session.id, { type: "next", revision: 0, seconds: 1 });
  assert.equal(duplicate.applied, false);
  state = (await send(state, "next")).state; assert.equal(state.completed, true);
  assert.equal((await db.select().from(schema.studySessions)).length, 1);
  assert.equal((await db.select().from(schema.reviews)).length, 1);
  assert.equal((await db.select().from(schema.topics))[0].mastery, 100);
  assert.ok((await db.select().from(schema.conceptProgress)).length > 0);
  assert.ok((await db.select().from(schema.flashcards)).length > 0);
  assert.equal((await db.select().from(schema.learningEvidence)).length, 1);
  await assert.rejects(applyStudyCommand(db, "11111111-1111-4111-8111-111111111111", session.id, { type: "next", revision: state.revision, seconds: 1 }), /SESSION_NOT_FOUND/);
});
