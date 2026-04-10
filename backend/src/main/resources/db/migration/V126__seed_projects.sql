-- V126: Seed additional realistic projects for QA / demo purposes.
-- All inserts use ON CONFLICT DO NOTHING so re-running is safe.
-- Statuses span: ACTIVE, IN_DISCOVERY, NOT_STARTED, ON_HOLD, COMPLETED, CANCELLED
-- Priorities span: P0, P1, P2, P3
-- Owners use the same short-team notation already in the system.

INSERT INTO project
    (name, priority, owner, start_month, target_end_month, duration_months, default_pattern,
     notes, status, start_date, target_date, client, estimated_budget, actual_cost)
VALUES

-- ── P0 — Critical / active ────────────────────────────────────────────────────
('Whole Genome Sequencing Platform Overhaul',   'P0', 'DG',              1, 8,  8,  'Ramp Up',      'Full re-architecture of WGS ingestion pipeline',          'ACTIVE',        '2026-01-05', '2026-08-29', NULL,             1200000.00,  340000.00),
('CLIA Compliance Automation Suite',            'P0', 'Regulatory',      1, 6,  6,  'Flat',         'Automated evidence collection for CLIA/CAP audits',       'ACTIVE',        '2026-01-12', '2026-06-30', NULL,              850000.00,  215000.00),
('Patient Portal Re-Platform',                  'P0', 'Digital Products', 2, 9,  8,  'Ramp Up',      'Migrate from legacy PHP portal to React + Spring Boot',   'ACTIVE',        '2026-02-03', '2026-09-30', NULL,             1500000.00,  410000.00),

-- ── P1 — High priority / active ───────────────────────────────────────────────
('HL7 FHIR R4 Integration — Epic',              'P1', 'BD',              1, 7,  7,  'Flat',         'Epic EHR bidirectional FHIR feed for orders and results',  'ACTIVE',        '2026-01-19', '2026-07-31', 'Epic Systems',    620000.00,  180000.00),
('Variant Interpretation Engine v3',            'P1', 'Genomics',        3, 10, 8,  'Middle Spike', 'ML-assisted pathogenicity scoring for rare variants',      'ACTIVE',        '2026-03-03', '2026-10-30', NULL,              780000.00,   95000.00),
('Lab Order Digitisation — Quest',              'P1', 'BD',              2, 6,  5,  'BSA Early',    'Electronic order integration replacing fax workflow',      'ACTIVE',        '2026-02-17', '2026-06-30', 'Quest',           340000.00,  120000.00),
('Automated Report QC Pipeline',                'P1', 'S2C',             2, 7,  6,  'Ramp Up',      'AI-driven quality gates before report delivery',           'ACTIVE',        '2026-02-10', '2026-07-15', NULL,              490000.00,   88000.00),
('Salesforce CPQ for Genetic Counselling',      'P1', 'S2C',             4, 9,  6,  'Flat',         'Configure-price-quote module for counselling services',    'IN_DISCOVERY',  '2026-04-07', '2026-09-26', NULL,              270000.00,       NULL),
('Reference Lab Network Connectivity',          'P1', 'Integrations',    3, 8,  6,  'Flat',         'Secure API mesh for external reference lab partners',      'ACTIVE',        '2026-03-10', '2026-08-29', NULL,              530000.00,  140000.00),
('Clinical Decision Support — Oncology',        'P1', 'Genomics',        5, 12, 8,  'Middle Spike', 'Evidence-based treatment pathway recommendations',         'NOT_STARTED',   '2026-05-04', '2026-12-18', NULL,              910000.00,       NULL),

-- ── P2 — Medium priority / mixed states ───────────────────────────────────────
('LIMS Upgrade — Starlims to LabVantage',       'P2', 'Lab Systems',     1, 12, 12, 'Flat',         'Full LIMS migration; parallel-run phase Q3',               'ACTIVE',        '2026-01-06', '2026-12-31', NULL,             1100000.00,  230000.00),
('Genetic Counsellor Scheduling App',           'P2', 'Digital Products', 3, 7,  5,  'Ramp Up',      'Self-service appointment booking for patients',            'ACTIVE',        '2026-03-16', '2026-07-31', NULL,              215000.00,   65000.00),
('Biobank Sample Tracking Portal',              'P2', 'Lab Systems',     4, 10, 7,  'Flat',         'Real-time cryo-storage inventory with barcode scanning',   'IN_DISCOVERY',  '2026-04-14', '2026-10-30', NULL,              380000.00,       NULL),
('Insurance Pre-Auth Automation',               'P2', 'S2C',             2, 8,  7,  'BSA Early',    'RPA bots for payer prior-authorisation submissions',       'ON_HOLD',       '2026-02-24', '2026-08-28', NULL,              310000.00,   42000.00),
('Multi-Region Data Residency',                 'P2', 'Infrastructure',  5, 11, 7,  'Flat',         'EU/APAC data residency for international clients',         'NOT_STARTED',   '2026-05-11', '2026-11-27', NULL,              670000.00,       NULL),
('Provider Results Delivery API v2',            'P2', 'BD',              3, 6,  4,  'Flat',         'Versioned REST API replacing SOAP results endpoint',       'ACTIVE',        '2026-03-02', '2026-06-26', NULL,              195000.00,   80000.00),
('Pharmacogenomics Report Redesign',            'P2', 'Digital Products', 6, 10, 5,  'Flat',         'New PDF layout with drug-gene interaction tables',         'NOT_STARTED',   '2026-06-01', '2026-10-30', NULL,              160000.00,       NULL),
('Rare Disease Registry Integration',           'P2', 'Genomics',        4, 9,  6,  'Ramp Up',      'ClinVar + OMIM automated case submission pipeline',        'IN_DISCOVERY',  '2026-04-21', '2026-09-25', NULL,              290000.00,       NULL),
('Batch Result Reprocessing Tool',              'P2', 'Lab Systems',     2, 5,  4,  'Flat',         'Self-service portal to requeue failed result batches',     'COMPLETED',     '2026-02-03', '2026-05-30', NULL,              145000.00,  138000.00),
('HL7 v2.5 Decommission',                       'P2', 'Integrations',    7, 12, 6,  'Flat',         'Retire legacy HL7 v2.5 interfaces after FHIR go-live',     'NOT_STARTED',   '2026-07-06', '2026-12-18', NULL,              220000.00,       NULL),

-- ── P3 — Lower priority / various lifecycle stages ────────────────────────────
('Internal Knowledge Base Modernisation',       'P3', 'Services',        1, 4,  4,  'Flat',         'Migrate Confluence → Notion; unify docs structure',        'COMPLETED',     '2026-01-05', '2026-04-30', NULL,               80000.00,   76500.00),
('Genomics Data Lake — Phase 2',                'P3', 'Infrastructure',  6, 12, 7,  'Ramp Up',      'Extend Phase 1 S3 data lake with dbt transform layer',     'NOT_STARTED',   '2026-06-08', '2026-12-31', NULL,              450000.00,       NULL),
('Legacy Billing System Retirement',            'P3', 'Finance IT',      3, 9,  7,  'Flat',         'Decommission on-prem billing after Quadax cutover',        'ON_HOLD',       '2026-03-09', '2026-09-30', NULL,              175000.00,   28000.00),
('Staff Mobile App — Time & Attendance',        'P3', 'Services',        5, 9,  5,  'Flat',         'iOS/Android shift management for lab staff',               'IN_DISCOVERY',  '2026-05-18', '2026-09-25', NULL,              130000.00,       NULL),
('Vendor API Security Hardening',               'P3', 'Infrastructure',  1, 3,  3,  'Flat',         'mTLS + OAuth2 for all third-party integrations',           'CANCELLED',     '2026-01-12', '2026-03-28', NULL,               95000.00,   18000.00);
