-- Additive: every existing row stays with the original account.
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  is_test boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  session_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO users (id, name, role) VALUES ('00000000-0000-4000-8000-000000000001', 'Estudante', 'admin');

-- External provider IDs are NOT the primary keys of learning data.
CREATE TABLE auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  provider text NOT NULL,
  subject text NOT NULL,
  password_hash text,
  UNIQUE(provider, subject),
  UNIQUE(user_id, provider)
);
CREATE TABLE account_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('invite', 'reset')),
  email text NOT NULL,
  is_test boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES users(id),
  created_by uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_rate_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL
);

DO $$
DECLARE t text; fk record;
BEGIN
  FOREACH t IN ARRAY ARRAY['disciplines','topics','materials','material_chunks','learning_units','micro_lessons','lesson_attempts','difficulties','tutor_messages','study_sessions','quizzes','quiz_questions','quiz_attempts','reviews','exams','exam_topics','study_packages','interactive_sessions'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN user_id uuid', t);
    EXECUTE format('UPDATE %I SET user_id = %L', t, '00000000-0000-4000-8000-000000000001');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN user_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES users(id)', t, t || '_owner_fk');
    EXECUTE format('CREATE INDEX %I ON %I(user_id)', t || '_owner_idx', t);
    IF t <> 'exam_topics' THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I UNIQUE(user_id, id)', t, t || '_owner_id_unique');
    END IF;
  END LOOP;
  -- The original FK cascade/set-null behavior stays intact. These extra FKs
  -- also reject writes that reference a different account's parent ID.
  FOR fk IN
    SELECT c.conrelid::regclass AS child, c.confrelid::regclass AS parent, a.attname AS column_name, c.conname
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
      AND c.connamespace = 'public'::regnamespace
      AND c.confrelid IN (SELECT attrelid FROM pg_attribute WHERE attname = 'user_id' AND NOT attisdropped)
      AND c.conrelid IN (SELECT attrelid FROM pg_attribute WHERE attname = 'user_id' AND NOT attisdropped)
      AND a.attname <> 'user_id'
  LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (user_id, %I) REFERENCES %s(user_id, id) DEFERRABLE INITIALLY DEFERRED', fk.child, 'owner_' || fk.conname, fk.column_name, fk.parent);
  END LOOP;
END $$;
ALTER TABLE study_packages DROP CONSTRAINT study_packages_cache_key_key;
ALTER TABLE study_packages ADD CONSTRAINT study_packages_owner_cache UNIQUE(user_id, cache_key);
ALTER TABLE interactive_sessions DROP CONSTRAINT interactive_sessions_active_key_key;
ALTER TABLE interactive_sessions ADD CONSTRAINT interactive_sessions_owner_active UNIQUE(user_id, active_key);
