import {
  boolean,
  unique,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { AuthoredLesson, LessonState } from "../lib/interactive-lesson";

export type LessonCheck = {
  id: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK" | "ORDER";
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export type LessonCardType = "CONCEPT" | "ANALOGY" | "COMPARISON" | "STEPS" | "SCENARIO";

export type LessonCardItem = {
  label: string;
  description: string;
  emoji?: string;
};

export type LessonLearningCard = {
  id: string;
  type: LessonCardType;
  title: string;
  eyebrow?: string;
  body: string;
  emoji?: string;
  items?: LessonCardItem[];
};

export type LessonContent = {
  explanation: string;
  example: string;
  cards?: LessonLearningCard[];
  checks: LessonCheck[];
};

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique(),
  name: text("name").notNull(),
  role: text("role").default("student").notNull(),
  isTest: boolean("is_test").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  sessionVersion: integer("session_version").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authIdentities = pgTable("auth_identities", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  provider: text("provider").notNull(),
  subject: text("subject").notNull(),
  passwordHash: text("password_hash"),
}, t => [unique().on(t.provider, t.subject), unique().on(t.userId, t.provider)]);

export const accountTokens = pgTable("account_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenHash: text("token_hash").unique().notNull(),
  kind: text("kind").notNull(),
  email: text("email").notNull(),
  isTest: boolean("is_test").default(false).notNull(),
  userId: uuid("user_id").references(() => users.id),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authRateLimits = pgTable("auth_rate_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").default(1).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const interactiveSessions = pgTable("interactive_sessions", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  lessonKey: text("lesson_key").notNull(),
  contentVersion: integer("content_version").notNull(),
  state: jsonb("state").$type<LessonState>().notNull(),
  packageId: uuid("package_id").references(() => studyPackages.id, { onDelete: "set null" }),
  activeKey: text("active_key"),
  level: text("level").default("base").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, t => [unique("interactive_sessions_owner_active").on(t.userId, t.activeKey)]);

export const studyPackages = pgTable("study_packages", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  cacheKey: text("cache_key").notNull(),
  kind: text("kind").notNull(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  lessonId: uuid("lesson_id").references(() => microLessons.id, { onDelete: "set null" }),
  content: jsonb("content").$type<AuthoredLesson>(),
  error: text("error"),
  ...timestamps,
}, t => [unique("study_packages_owner_cache").on(t.userId, t.cacheKey)]);

export const disciplines = pgTable("disciplines", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  semester: text("semester").notNull(),
  color: text("color").default("#5eead4").notNull(),
  status: text("status").default("ATIVA").notNull(),
  ...timestamps,
});

export const topics = pgTable("topics", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  materialId: uuid("material_id").references((): AnyPgColumn => materials.id, { onDelete: "set null" }),
  position: integer("position").default(0).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("NAO_ESTUDADO").notNull(),
  mastery: integer("mastery").default(0).notNull(),
  ...timestamps,
});

export const learningUnits = pgTable("learning_units", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  materialId: uuid("material_id").references(() => materials.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const microLessons = pgTable("micro_lessons", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  unitId: uuid("unit_id").references(() => learningUnits.id, { onDelete: "cascade" }).notNull(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  objective: text("objective").notNull(),
  position: integer("position").notNull(),
  content: jsonb("content").$type<LessonContent>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const lessonAttempts = pgTable("lesson_attempts", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  lessonId: uuid("lesson_id").references(() => microLessons.id, { onDelete: "cascade" }).notNull(),
  score: integer("score").notNull(),
  correctCount: integer("correct_count").notNull(),
  total: integer("total").notNull(),
  answers: jsonb("answers").$type<Record<string, string>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const materials = pgTable("materials", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const materialChunks = pgTable("material_chunks", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: uuid("material_id").references(() => materials.id, { onDelete: "cascade" }).notNull(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  position: integer("position").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const difficulties = pgTable("difficulties", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }).notNull(),
  originalReport: text("original_report").notNull(),
  lastReport: text("last_report").notNull(),
  occurrences: integer("occurrences").default(1).notNull(),
  level: text("level").default("NAO_ENTENDI").notNull(),
  status: text("status").default("ABERTA").notNull(),
  ...timestamps,
});

export const tutorMessages = pgTable("tutor_messages", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  difficultyId: uuid("difficulty_id").references(() => difficulties.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),
  mode: text("mode").default("DIAGNOSTICAR").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studySessions = pgTable("study_sessions", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "set null" }),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  activityType: text("activity_type").notNull(),
  durationMinutes: integer("duration_minutes"),
  result: text("result"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const quizzes = pgTable("quizzes", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  materialId: uuid("material_id").references(() => materials.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  questionCount: integer("question_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const quizQuestions = pgTable("quiz_questions", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id").references(() => quizzes.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  prompt: text("prompt").notNull(),
  type: text("type").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation").notNull(),
});

export const quizAttempts = pgTable("quiz_attempts", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id").references(() => quizzes.id, { onDelete: "cascade" }).notNull(),
  score: integer("score").notNull(),
  correctCount: integer("correct_count").notNull(),
  total: integer("total").notNull(),
  answers: jsonb("answers").$type<Record<string, string>>().notNull(),
  weaknesses: jsonb("weaknesses").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }).notNull(),
  scheduledFor: date("scheduled_for").notNull(),
  status: text("status").default("PENDENTE").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const exams = pgTable("exams", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  examDate: date("exam_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const examTopics = pgTable("exam_topics", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  examId: uuid("exam_id").references(() => exams.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }).notNull(),
}, (table) => [primaryKey({ columns: [table.examId, table.topicId] })]);

export const academicEvents = pgTable("academic_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), kind: text("kind").notNull(),
  date: date("date").notNull(), notes: text("notes"),
  topicIds: jsonb("topic_ids").$type<string[]>().default([]).notNull(),
  completed: boolean("completed").default(false).notNull(), ...timestamps,
});
export const conceptProgress = pgTable("concept_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }),
  name: text("name").notNull(), mastery: integer("mastery").default(0).notNull(),
  samples: integer("samples").default(0).notNull(), errors: integer("errors").default(0).notNull(),
  lastError: text("last_error"), ...timestamps,
}, t => [unique().on(t.userId, t.disciplineId, t.name)]);
export const flashcards = pgTable("flashcards", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").references(() => users.id).notNull(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }),
  sourceKey: text("source_key").notNull(), front: text("front").notNull(), back: text("back").notNull(),
  schedule: jsonb("schedule").$type<import("ts-fsrs").Card>().notNull(),
  due: timestamp("due", { withTimezone: true }).defaultNow().notNull(),
  revision: integer("revision").default(0).notNull(), ...timestamps,
}, t => [unique().on(t.userId, t.sourceKey)]);
export const cardReviews = pgTable("card_reviews", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").references(() => users.id).notNull(),
  cardId: uuid("card_id").references(() => flashcards.id, { onDelete: "cascade" }).notNull(),
  rating: integer("rating").notNull(), log: jsonb("log").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const materialDecisions = pgTable("material_decisions", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  materialId: uuid("material_id").references(() => materials.id, { onDelete: "cascade" }).notNull(),
  decision: text("decision").notNull(), ...timestamps,
}, t => [primaryKey({ columns: [t.userId, t.materialId] })]);
export const learningEvidence = pgTable("learning_evidence", {
  sessionId: uuid("session_id").references(() => interactiveSessions.id, { onDelete: "cascade" }).primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
});
export type MockQuestion = { id:string; topicId:string|null; concept:string; prompt:string; options:string[]; correctAnswer:string; explanation:string };
export const mockExams = pgTable("mock_exams", {
  id:uuid("id").defaultRandom().primaryKey(), userId:uuid("user_id").references(()=>users.id).notNull(),
  disciplineId:uuid("discipline_id").references(()=>disciplines.id,{onDelete:"cascade"}).notNull(),
  questions:jsonb("questions").$type<MockQuestion[]>().notNull(), answers:jsonb("answers").$type<Record<string,string>>().default({}).notNull(),
  score:integer("score"), expiresAt:timestamp("expires_at",{withTimezone:true}).notNull(),
  completedAt:timestamp("completed_at",{withTimezone:true}), createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
});
