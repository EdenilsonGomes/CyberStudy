-- Additive pilot storage; no existing lessons, attempts or materials are modified.
CREATE TABLE IF NOT EXISTS interactive_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_key text NOT NULL,
  content_version integer NOT NULL,
  state jsonb NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interactive_sessions_lesson_created_idx
  ON interactive_sessions (lesson_key, created_at DESC);
