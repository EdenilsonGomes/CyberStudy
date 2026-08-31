-- Additive link; no learning history or saved activities are removed.
ALTER TABLE topics ADD COLUMN material_id uuid REFERENCES materials(id) ON DELETE SET NULL;
ALTER TABLE topics ADD CONSTRAINT topics_material_owner_fk FOREIGN KEY (user_id, material_id) REFERENCES materials(user_id, id);

-- Legacy topic-only trails can be attributed safely only with a single material.
UPDATE topics t SET material_id = m.id
FROM materials m
WHERE t.material_id IS NULL AND t.user_id = m.user_id AND t.discipline_id = m.discipline_id
  AND NOT EXISTS (SELECT 1 FROM materials other WHERE other.user_id = m.user_id AND other.discipline_id = m.discipline_id AND other.id <> m.id);
CREATE INDEX topics_owner_material_idx ON topics(user_id, material_id);
