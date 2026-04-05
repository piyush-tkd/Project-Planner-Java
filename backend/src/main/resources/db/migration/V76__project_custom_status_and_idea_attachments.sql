-- V76: Allow custom project status strings + add attachment support to ideas

-- ── 1. Drop the CHECK constraint on project.status so custom lane names are allowed ──
-- PostgreSQL stores the constraint name from V35. We drop it and change the column type.
ALTER TABLE project DROP CONSTRAINT IF EXISTS project_status_check;

-- Change the status column from enum-backed to a plain VARCHAR so Spring Boot
-- can persist any string (including custom swimlane names) without a DB error.
-- The Java side will keep accepting the well-known values via a DTO string field.
ALTER TABLE project ALTER COLUMN status TYPE VARCHAR(100);

-- ── 2. Add attachment columns to idea ─────────────────────────────────────────
ALTER TABLE idea
    ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
    ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(50);
