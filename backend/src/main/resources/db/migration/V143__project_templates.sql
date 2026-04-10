-- V143: Project Templates — persistent reusable project blueprints
CREATE TABLE project_template (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    duration    VARCHAR(100),
    team_desc   VARCHAR(200),
    effort      VARCHAR(100),
    tags        TEXT,          -- comma-separated tag list
    starred     BOOLEAN        NOT NULL DEFAULT false,
    usage_count INTEGER        NOT NULL DEFAULT 0,
    last_used   DATE,
    phases      JSONB          NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Seed the 6 built-in starter templates
INSERT INTO project_template (name, description, category, duration, team_desc, effort, tags, starred, usage_count, last_used, phases)
VALUES
(
  'Standard Feature Release',
  'A standard 3-month project template for new feature development with discovery, build, and QA phases.',
  'Standard', '3 months', 'Mixed', 'Flat',
  'Feature,Development,QA',
  true, 12, '2026-03-01',
  '[{"name":"Discovery & Design","duration":"2 weeks","description":"Requirements gathering, UX design, technical spec"},{"name":"Development","duration":"8 weeks","description":"Frontend + backend implementation"},{"name":"QA & Testing","duration":"2 weeks","description":"Regression, UAT, performance testing"}]'
),
(
  'Data Migration Project',
  'Template for large-scale data migration with validation, ETL build, and cutover phases.',
  'Engineering', '4 months', 'Backend + Data', 'Steady',
  'Data,Migration,ETL',
  false, 5, '2026-02-01',
  '[{"name":"Data Audit & Mapping","duration":"2 weeks","description":"Source/target schema analysis"},{"name":"ETL Build","duration":"10 weeks","description":"Transform scripts + pipeline build"},{"name":"Validation & Cutover","duration":"4 weeks","description":"Data quality checks + go-live"}]'
),
(
  'Analytics Dashboard Build',
  'Template for building internal analytics dashboards — from data model to front-end delivery.',
  'Analytics', '2 months', 'Data + Frontend', 'Flat',
  'Dashboard,Analytics,Reporting',
  true, 8, '2026-04-01',
  '[{"name":"Requirements & KPI Definition","duration":"1 week","description":"Stakeholder interviews, metric definitions"},{"name":"Data Modelling","duration":"3 weeks","description":"Data warehouse queries, calculated fields"},{"name":"UI Build & Testing","duration":"4 weeks","description":"Dashboard implementation and UAT"}]'
),
(
  'Product Launch',
  'End-to-end product launch template covering engineering, QA, marketing readiness, and go-live.',
  'Launch', '6 months', 'Cross-functional', 'Ramp-up',
  'Launch,Cross-team,Go-live',
  false, 3, NULL,
  '[{"name":"Planning & Architecture","duration":"3 weeks","description":"Scope finalization, tech design"},{"name":"Build Phase 1 - Core","duration":"10 weeks","description":"Core features, APIs, integrations"},{"name":"Build Phase 2 - Polish","duration":"6 weeks","description":"UI polish, edge cases, docs"},{"name":"QA & Stabilization","duration":"3 weeks","description":"Full regression, load tests, fixes"},{"name":"Launch & Hypercare","duration":"2 weeks","description":"Go-live, 24/7 monitoring, rapid fixes"}]'
),
(
  'Quick Fix / Patch',
  'Lightweight template for bug fixes and minor enhancements. Streamlined with minimal process.',
  'Engineering', '2 weeks', 'Dev only', 'Flat',
  'Bug Fix,Patch,Quick',
  false, 24, '2026-04-01',
  '[{"name":"Investigation","duration":"2 days","description":"Root cause analysis"},{"name":"Fix + Test","duration":"1 week","description":"Implementation and unit tests"},{"name":"Deploy","duration":"2 days","description":"Staged rollout and monitoring"}]'
),
(
  'API Integration',
  'Template for third-party API integrations including contracts, build, security review, and testing.',
  'Engineering', '6 weeks', 'Backend', 'Flat',
  'API,Integration,Backend',
  false, 7, NULL,
  '[{"name":"API Contract & Auth Design","duration":"1 week","description":"Endpoint mapping, auth scheme"},{"name":"Integration Build","duration":"3 weeks","description":"Implementation + error handling"},{"name":"Security Review + Testing","duration":"2 weeks","description":"Pen test, QA, performance"}]'
);
