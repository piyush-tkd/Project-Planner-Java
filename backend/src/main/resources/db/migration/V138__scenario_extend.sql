-- V138: Extend scenario table with status, base_date, and created_by for scenario planning (Sprint 14)
ALTER TABLE scenario
  ADD COLUMN IF NOT EXISTS base_date  DATE,
  ADD COLUMN IF NOT EXISTS status     VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- Add status constraint (only if it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scenario_status_check'
  ) THEN
    ALTER TABLE scenario ADD CONSTRAINT scenario_status_check
      CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED','APPROVED'));
  END IF;
END$$;
