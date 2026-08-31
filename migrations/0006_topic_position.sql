-- Preserve the historical insertion order, then make future topic order explicit.
ALTER TABLE topics ADD COLUMN position integer;
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY user_id, discipline_id, coalesce(material_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY created_at, ctid
  ) - 1 AS position
  FROM topics
)
UPDATE topics SET position = ranked.position FROM ranked WHERE topics.id = ranked.id;
ALTER TABLE topics ALTER COLUMN position SET NOT NULL;
ALTER TABLE topics ALTER COLUMN position SET DEFAULT 0;
CREATE INDEX topics_owner_discipline_material_position_idx ON topics(user_id, discipline_id, material_id, position);
