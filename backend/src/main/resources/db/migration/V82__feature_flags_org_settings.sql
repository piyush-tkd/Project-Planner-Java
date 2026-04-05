-- V82: Ensure feature flag defaults exist in org_settings.features JSONB column.
-- The features column already exists. This migration ensures all 5 flag keys
-- are present with safe defaults for any rows missing them.
UPDATE org_settings
SET features = '{"ai": true, "okr": true, "risk": true, "ideas": true, "financials": true}'::jsonb
           || features
WHERE features IS NOT NULL;

-- Seed default for any rows where features is NULL
UPDATE org_settings
SET features = '{"ai": true, "okr": true, "risk": true, "ideas": true, "financials": true}'::jsonb
WHERE features IS NULL;
