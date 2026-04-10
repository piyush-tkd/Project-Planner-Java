-- V120: Scheduled Reports + new page permissions for v23.5 features
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. scheduled_report table — stores per-org recurring report delivery configs
-- 2. scheduled_report_run   — audit log of individual report run attempts
-- 3. Page permissions for:
--      • scheduled_reports   (Settings → Scheduled Reports)
--      • cost_rates          (Settings → Cost Rate Tables — mockup)
--      • ai_content_studio   (Home    → AI Content Studio)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. scheduled_report ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_report (
    id              BIGSERIAL      PRIMARY KEY,
    org_id          BIGINT         NOT NULL DEFAULT 1,   -- multi-org ready
    report_type     VARCHAR(64)    NOT NULL,              -- e.g. 'portfolio_health'
    report_name     VARCHAR(255)   NOT NULL,
    cadence         VARCHAR(16)    NOT NULL DEFAULT 'WEEKLY',  -- DAILY | WEEKLY | MONTHLY
    day_of_week     INTEGER,                              -- 1=Mon … 7=Sun (WEEKLY only)
    day_of_month    INTEGER,                              -- 1..28 (MONTHLY only)
    delivery_time   TIME           NOT NULL DEFAULT '07:00:00',
    timezone        VARCHAR(64)    NOT NULL DEFAULT 'America/Chicago',
    output_format   VARCHAR(16)    NOT NULL DEFAULT 'PDF',  -- PDF | CSV | EXCEL
    recipients      TEXT[]         NOT NULL DEFAULT '{}',  -- email addresses
    subject_template VARCHAR(512)  NOT NULL DEFAULT '{{reportName}} — {{date}}',
    enabled         BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(128),
    last_run_at     TIMESTAMPTZ,
    next_run_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scheduled_report_org
    ON scheduled_report (org_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_report_enabled
    ON scheduled_report (org_id, enabled);

-- ── 2. scheduled_report_run ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_report_run (
    id                  BIGSERIAL   PRIMARY KEY,
    scheduled_report_id BIGINT      NOT NULL REFERENCES scheduled_report(id) ON DELETE CASCADE,
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trigger_type        VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED',  -- SCHEDULED | MANUAL
    status              VARCHAR(16) NOT NULL DEFAULT 'PENDING',    -- PENDING | SUCCESS | FAILED
    recipients_count    INTEGER,
    error_message       TEXT,
    duration_ms         INTEGER,
    triggered_by        VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_report_run_report_id
    ON scheduled_report_run (scheduled_report_id, triggered_at DESC);

-- ── 3. Page permissions ──────────────────────────────────────────────────────
-- scheduled_reports: admin-only (configuring scheduled deliveries)
-- cost_rates: read/write and above can view rates; admin can edit
-- ai_content_studio: all authenticated roles can use (gated by 'ai' feature flag)

INSERT INTO page_permission (role, page_key, allowed) VALUES
  -- Scheduled Reports
  ('ADMIN',      'scheduled_reports',   true),
  ('READ_WRITE', 'scheduled_reports',   true),
  ('READ_ONLY',  'scheduled_reports',   false),
  -- Cost Rates (mockup)
  ('ADMIN',      'cost_rates',          true),
  ('READ_WRITE', 'cost_rates',          true),
  ('READ_ONLY',  'cost_rates',          true),
  -- AI Content Studio
  ('ADMIN',      'ai_content_studio',   true),
  ('READ_WRITE', 'ai_content_studio',   true),
  ('READ_ONLY',  'ai_content_studio',   true)
ON CONFLICT (role, page_key) DO NOTHING;

SELECT setval('page_permission_id_seq',
    (SELECT COALESCE(MAX(id), 1) FROM page_permission), true);
