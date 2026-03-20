-- Add optional client field to project so projects can be associated with an external client.
-- Also make target_date nullable (already was in Java model, this is a no-op safety guard).

ALTER TABLE project
    ADD COLUMN IF NOT EXISTS client VARCHAR(150);
