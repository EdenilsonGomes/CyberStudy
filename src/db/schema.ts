import {
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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

export const disciplines = pgTable("disciplines", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  semester: text("semester").notNull(),
  color: text("color").default("#5eead4").notNull(),
  status: text("status").default("ATIVA").notNull(),
  ...timestamps,
});

export const topics = pgTable("topics", {
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("NAO_ESTUDADO").notNull(),
  mastery: integer("mastery").default(0).notNull(),
  ...timestamps,
});

export const learningUnits = pgTable("learning_units", {
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  materialId: uuid("material_id").references(() => materials.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const microLessons = pgTable("micro_lessons", {
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
  id: uuid("id").defaultRandom().primaryKey(),
  lessonId: uuid("lesson_id").references(() => microLessons.id, { onDelete: "cascade" }).notNull(),
  score: integer("score").notNull(),
  correctCount: integer("correct_count").notNull(),
  total: integer("total").notNull(),
  answers: jsonb("answers").$type<Record<string, string>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const materials = pgTable("materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const materialChunks = pgTable("material_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: uuid("material_id").references(() => materials.id, { onDelete: "cascade" }).notNull(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  position: integer("position").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const difficulties = pgTable("difficulties", {
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
  id: uuid("id").defaultRandom().primaryKey(),
  difficultyId: uuid("difficulty_id").references(() => difficulties.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),
  mode: text("mode").default("DIAGNOSTICAR").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studySessions = pgTable("study_sessions", {
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
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  materialId: uuid("material_id").references(() => materials.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  questionCount: integer("question_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const quizQuestions = pgTable("quiz_questions", {
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
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }).notNull(),
  scheduledFor: date("scheduled_for").notNull(),
  status: text("status").default("PENDENTE").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const exams = pgTable("exams", {
  id: uuid("id").defaultRandom().primaryKey(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  examDate: date("exam_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const examTopics = pgTable("exam_topics", {
  examId: uuid("exam_id").references(() => exams.id, { onDelete: "cascade" }).notNull(),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }).notNull(),
}, (table) => [primaryKey({ columns: [table.examId, table.topicId] })]);
