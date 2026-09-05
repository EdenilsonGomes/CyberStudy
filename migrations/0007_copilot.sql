CREATE TABLE academic_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 discipline_id uuid NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE, name text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('PROVA','EXERCICIO','TRABALHO','AULA','OUTRO')), date date NOT NULL,
 notes text, topic_ids jsonb NOT NULL DEFAULT '[]', completed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academic_events_owner_date ON academic_events(user_id,date);
CREATE TABLE concept_progress (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 discipline_id uuid NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
 topic_id uuid REFERENCES topics(id) ON DELETE CASCADE, name text NOT NULL,
 mastery integer NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 100), samples integer NOT NULL DEFAULT 0,
 errors integer NOT NULL DEFAULT 0, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,discipline_id,name)
);
CREATE TABLE flashcards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 discipline_id uuid NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
 topic_id uuid REFERENCES topics(id) ON DELETE CASCADE, source_key text NOT NULL,
 front text NOT NULL, back text NOT NULL, schedule jsonb NOT NULL, due timestamptz NOT NULL DEFAULT now(),
 revision integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,source_key)
);
CREATE INDEX flashcards_owner_due ON flashcards(user_id,due);
CREATE TABLE card_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 card_id uuid NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE, rating integer NOT NULL CHECK(rating BETWEEN 1 AND 4),
 log jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE material_decisions (
 user_id uuid NOT NULL REFERENCES users(id), material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
 decision text NOT NULL CHECK(decision IN ('ENCERRADO','AGUARDANDO','FINALIZADO')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,material_id)
);
CREATE TABLE learning_evidence (session_id uuid PRIMARY KEY REFERENCES interactive_sessions(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id));
CREATE TABLE mock_exams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 discipline_id uuid NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE, questions jsonb NOT NULL, answers jsonb NOT NULL DEFAULT '{}',
 score integer, expires_at timestamptz NOT NULL, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE flashcards ADD CONSTRAINT flashcards_owner_id_unique UNIQUE(user_id,id);
DO $$
DECLARE fk record;
BEGIN
 FOR fk IN
  SELECT c.conrelid::regclass AS child,c.confrelid::regclass AS parent,a.attname AS column_name,c.conname
  FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
  WHERE c.contype='f' AND cardinality(c.conkey)=1 AND c.connamespace='public'::regnamespace
   AND c.conrelid IN ('academic_events'::regclass,'concept_progress'::regclass,'flashcards'::regclass,'card_reviews'::regclass,'material_decisions'::regclass,'learning_evidence'::regclass,'mock_exams'::regclass)
   AND c.confrelid IN (SELECT attrelid FROM pg_attribute WHERE attname='user_id' AND NOT attisdropped)
   AND a.attname <> 'user_id'
 LOOP
  EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY(user_id,%I) REFERENCES %s(user_id,id) DEFERRABLE INITIALLY DEFERRED',fk.child,'owner_'||fk.conname,fk.column_name,fk.parent);
 END LOOP;
END $$;
