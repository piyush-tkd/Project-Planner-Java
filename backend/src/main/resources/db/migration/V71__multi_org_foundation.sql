-- V71: Multi-org SaaS foundation
-- Creates the organizations table and seeds a default org.
-- Adds org_id to core entity tables (projects, pods, resources, app_user).
-- All existing rows are assigned to the default org (backward-compatible).
-- NOTE: org_id columns are nullable initially; downstream enforcement is handled at
--       the application layer via RBAC and future API-level org scoping.

BEGIN;

-- ── 1. Create organizations table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization (
    id          BIGSERIAL PRIMARY KEY,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    plan        VARCHAR(50)  NOT NULL DEFAULT 'FREE',
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_slug ON public.organization (slug);

-- ── 2. Seed the default organization ─────────────────────────────────────────
INSERT INTO public.organization (id, slug, name, plan, active)
VALUES (1, 'default', 'Engineering Portfolio Planner', 'ENTERPRISE', TRUE)
ON CONFLICT (slug) DO NOTHING;

SELECT setval('organization_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.organization), true);

-- ── 3. Add org_id to core entity tables ──────────────────────────────────────

-- Projects
ALTER TABLE public.project
    ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES public.organization(id) ON DELETE CASCADE;
UPDATE public.project SET org_id = 1 WHERE org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_org_id ON public.project (org_id);

-- PODs
ALTER TABLE public.pod
    ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES public.organization(id) ON DELETE CASCADE;
UPDATE public.pod SET org_id = 1 WHERE org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_pod_org_id ON public.pod (org_id);

-- Resources
ALTER TABLE public.resource
    ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES public.organization(id) ON DELETE CASCADE;
UPDATE public.resource SET org_id = 1 WHERE org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_org_id ON public.resource (org_id);

-- App users — link to org (many-to-many via user_org_membership, or simple FK for single-org mode)
ALTER TABLE public.app_user
    ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES public.organization(id) ON DELETE SET NULL;
UPDATE public.app_user SET org_id = 1 WHERE org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_app_user_org_id ON public.app_user (org_id);

-- ── 4. Create org settings table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_settings (
    id              BIGSERIAL PRIMARY KEY,
    org_id          BIGINT NOT NULL UNIQUE REFERENCES public.organization(id) ON DELETE CASCADE,
    primary_color   VARCHAR(20)  NOT NULL DEFAULT '#2DCCD3',
    secondary_color VARCHAR(20)  NOT NULL DEFAULT '#0C2340',
    logo_url        TEXT,
    timezone        VARCHAR(100) NOT NULL DEFAULT 'America/Chicago',
    fiscal_year_start VARCHAR(20) NOT NULL DEFAULT 'January',
    date_format     VARCHAR(50)  NOT NULL DEFAULT 'MMM DD, YYYY',
    features        JSONB        NOT NULL DEFAULT '{"ai":true,"ideas":true,"risk":true,"okr":true,"financials":false}',
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Seed default org settings
INSERT INTO public.org_settings (org_id, primary_color, secondary_color, timezone)
VALUES (1, '#2DCCD3', '#0C2340', 'America/Chicago')
ON CONFLICT (org_id) DO NOTHING;

-- ── 5. RBAC: role definitions table ──────────────────────────────────────────
-- Adds structured RBAC roles beyond the current ADMIN / READ_WRITE / READ_ONLY string enum.
-- This table is additive — the existing string-based role on app_user is unchanged.
CREATE TABLE IF NOT EXISTS public.rbac_role (
    id          BIGSERIAL PRIMARY KEY,
    org_id      BIGINT NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,          -- e.g. ADMIN, MANAGER, VIEWER, ANALYST
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = cannot be deleted by org admins
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, name)
);

-- Seed default RBAC roles for default org
INSERT INTO public.rbac_role (org_id, name, description, is_system) VALUES
  (1, 'ADMIN',    'Full access to all features, users, and org settings',      TRUE),
  (1, 'MANAGER',  'Can create/edit projects and PODs; view all analytics',     TRUE),
  (1, 'ANALYST',  'Read-only access to analytics and portfolio reports',       TRUE),
  (1, 'VIEWER',   'Read-only access to dashboard and project list only',       TRUE)
ON CONFLICT (org_id, name) DO NOTHING;

COMMIT;
