-- V100: Fix foreign-key constraints on tables that reference project(id)
--       so that deleting a project cascades correctly and doesn't leave
--       orphaned rows or raise constraint violations.
--
-- Tables fixed:
--   scheduling_rules  → ON DELETE CASCADE  (was: no action)
--   project_actual    → ON DELETE CASCADE  (was: no action)
--   project.blocked_by_id → ON DELETE SET NULL (was: no action / no explicit rule)

-- ── scheduling_rules ────────────────────────────────────────────────────────
ALTER TABLE scheduling_rules
    DROP CONSTRAINT IF EXISTS fk_scheduling_rules_project;

ALTER TABLE scheduling_rules
    ADD CONSTRAINT fk_scheduling_rules_project
        FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE;

-- ── project_actual ──────────────────────────────────────────────────────────
-- Drop the implicit unnamed FK first (Postgres names it project_actual_project_id_fkey)
ALTER TABLE project_actual
    DROP CONSTRAINT IF EXISTS project_actual_project_id_fkey;

ALTER TABLE project_actual
    ADD CONSTRAINT project_actual_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE;

-- ── project.blocked_by_id (self-referencing) ────────────────────────────────
-- When a blocking project is deleted, dependents should just lose the link.
ALTER TABLE project
    DROP CONSTRAINT IF EXISTS project_blocked_by_id_fkey;

ALTER TABLE project
    ADD CONSTRAINT project_blocked_by_id_fkey
        FOREIGN KEY (blocked_by_id) REFERENCES project(id) ON DELETE SET NULL;
