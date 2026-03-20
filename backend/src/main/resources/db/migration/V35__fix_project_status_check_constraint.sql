-- V35: Expand project_status_check constraint to include NOT_STARTED and IN_DISCOVERY
--
-- The original V1 constraint only covered: ACTIVE, ON_HOLD, COMPLETED, CANCELLED
-- The Java enum (ProjectStatus) also defines NOT_STARTED and IN_DISCOVERY, which were
-- added later without updating the database constraint. This caused a constraint
-- violation when saving/editing projects with those statuses.
--
-- PostgreSQL does not support ALTER CONSTRAINT — the only way to change a check
-- constraint is to drop and recreate it.

ALTER TABLE project DROP CONSTRAINT IF EXISTS project_status_check;

ALTER TABLE project
    ADD CONSTRAINT project_status_check
    CHECK (status IN ('NOT_STARTED','IN_DISCOVERY','ACTIVE','ON_HOLD','COMPLETED','CANCELLED'));
