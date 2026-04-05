-- V72: Add org_name and org_slug to org_settings for white-label support
-- These allow the app name/slug to be overridden per org without touching the organization table.

ALTER TABLE public.org_settings
    ADD COLUMN IF NOT EXISTS org_name VARCHAR(255) DEFAULT 'Engineering Portfolio Planner',
    ADD COLUMN IF NOT EXISTS org_slug VARCHAR(100) DEFAULT 'epp';

-- Backfill from organization table where possible
UPDATE public.org_settings os
SET    org_name = o.name,
       org_slug = o.slug
FROM   public.organization o
WHERE  o.id = os.org_id
  AND  os.org_name IS NULL;
