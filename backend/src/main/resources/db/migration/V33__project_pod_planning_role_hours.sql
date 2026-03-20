-- Replace t-shirt size + complexity model with explicit role hours + contingency.
-- Old columns (tshirt_size, complexity_override) are kept nullable for now so
-- existing rows are not broken; they can be dropped in a future cleanup migration.

ALTER TABLE project_pod_planning
    ADD COLUMN IF NOT EXISTS dev_hours       NUMERIC(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS qa_hours        NUMERIC(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bsa_hours       NUMERIC(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tech_lead_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS contingency_pct NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Also store the target release for a project-pod assignment
ALTER TABLE project_pod_planning
    ADD COLUMN IF NOT EXISTS target_release_id BIGINT REFERENCES release_calendar(id) ON DELETE SET NULL;

-- Make old columns nullable so they don't block existing rows
ALTER TABLE project_pod_planning
    ALTER COLUMN tshirt_size DROP NOT NULL;
