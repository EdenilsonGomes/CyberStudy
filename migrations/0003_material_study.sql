CREATE TABLE study_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  kind text NOT NULL,
  discipline_id uuid NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES micro_lessons(id) ON DELETE SET NULL,
  content jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE interactive_sessions ADD COLUMN package_id uuid REFERENCES study_packages(id) ON DELETE SET NULL;
ALTER TABLE interactive_sessions ADD COLUMN active_key text UNIQUE;
ALTER TABLE interactive_sessions ADD COLUMN level text NOT NULL DEFAULT 'base';
CREATE INDEX study_packages_discipline_idx ON study_packages(discipline_id);
CREATE INDEX interactive_sessions_package_idx ON interactive_sessions(package_id);
