-- V114: Convert approval_status column from PostgreSQL ENUM to VARCHAR(20).
--
-- Root cause: Hibernate @Enumerated(EnumType.STRING) sends enum values as
-- 'character varying' in WHERE clauses, but PostgreSQL custom ENUM types have
-- no implicit cast from varchar, causing:
--   ERROR: operator does not exist: approval_status = character varying
--
-- Casting to text first safely preserves all existing string values (PENDING,
-- APPROVED, REJECTED, WITHDRAWN) before changing the storage type.

ALTER TABLE project_approval
    ALTER COLUMN status TYPE VARCHAR(20) USING status::text;

-- Also drop the now-unused custom type if no other table uses it.
-- Wrapped in a DO block so it gracefully skips if other tables still reference it.
DO $$
BEGIN
    DROP TYPE IF EXISTS approval_status;
EXCEPTION WHEN dependent_objects_still_exist THEN
    RAISE NOTICE 'approval_status type still in use elsewhere — skipping DROP';
END
$$;
