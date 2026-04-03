-- ─────────────────────────────────────────────────────────────────────────────
-- Phase Scheduling Tables and Columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Add phase scheduling columns to project_pod_planning table
ALTER TABLE project_pod_planning ADD COLUMN IF NOT EXISTS dev_start_date DATE;
ALTER TABLE project_pod_planning ADD COLUMN IF NOT EXISTS dev_end_date DATE;
ALTER TABLE project_pod_planning ADD COLUMN IF NOT EXISTS qa_start_date DATE;
ALTER TABLE project_pod_planning ADD COLUMN IF NOT EXISTS qa_end_date DATE;
ALTER TABLE project_pod_planning ADD COLUMN IF NOT EXISTS uat_start_date DATE;
ALTER TABLE project_pod_planning ADD COLUMN IF NOT EXISTS uat_end_date DATE;
ALTER TABLE project_pod_planning ADD COLUMN IF NOT EXISTS schedule_locked BOOLEAN DEFAULT FALSE;

-- Add project-level milestone columns to project table
ALTER TABLE project ADD COLUMN IF NOT EXISTS e2e_start_date DATE;
ALTER TABLE project ADD COLUMN IF NOT EXISTS e2e_end_date DATE;
ALTER TABLE project ADD COLUMN IF NOT EXISTS code_freeze_date DATE;
ALTER TABLE project ADD COLUMN IF NOT EXISTS release_date DATE;

-- Create scheduling_rules table for per-project scheduling config
CREATE TABLE IF NOT EXISTS scheduling_rules (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL UNIQUE,
    qa_lag_days INT DEFAULT 7,
    uat_gap_days INT DEFAULT 1,
    uat_duration_days INT DEFAULT 5,
    e2e_gap_days INT DEFAULT 2,
    e2e_duration_days INT DEFAULT 7,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scheduling_rules_project FOREIGN KEY (project_id) REFERENCES project(id)
);
