CREATE TABLE IF NOT EXISTS learning_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_id uuid NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS learning_units_discipline_idx ON learning_units(discipline_id, position);

CREATE TABLE IF NOT EXISTS micro_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES learning_units(id) ON DELETE CASCADE,
  discipline_id uuid NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  title text NOT NULL,
  objective text NOT NULL,
  position integer NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS micro_lessons_unit_idx ON micro_lessons(unit_id, position);
CREATE INDEX IF NOT EXISTS micro_lessons_discipline_idx ON micro_lessons(discipline_id);

CREATE TABLE IF NOT EXISTS lesson_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES micro_lessons(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  correct_count integer NOT NULL,
  total integer NOT NULL,
  answers jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lesson_attempts_lesson_idx ON lesson_attempts(lesson_id, created_at DESC);
