-- V73: Strategic Objectives, Risk Register, Ideas Board, Resource Bookings
-- New full-stack feature tables

-- ── Strategic Objectives (OKR) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strategic_objective (
    id            BIGSERIAL PRIMARY KEY,
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    owner         VARCHAR(120),
    status        VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',   -- NOT_STARTED, ON_TRACK, AT_RISK, COMPLETED
    progress      INT NOT NULL DEFAULT 0,                        -- 0–100 %
    target_date   DATE,
    quarter       VARCHAR(10),                                   -- e.g. Q1-2026
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Objective Key Results ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS key_result (
    id              BIGSERIAL PRIMARY KEY,
    objective_id    BIGINT NOT NULL REFERENCES strategic_objective(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    current_value   NUMERIC(10,2) DEFAULT 0,
    target_value    NUMERIC(10,2) NOT NULL DEFAULT 100,
    unit            VARCHAR(50) DEFAULT '%',
    status          VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Risk Register ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_item (
    id                BIGSERIAL PRIMARY KEY,
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    item_type         VARCHAR(20) NOT NULL DEFAULT 'RISK',         -- RISK, ISSUE, DECISION
    severity          VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',       -- CRITICAL, HIGH, MEDIUM, LOW
    probability       VARCHAR(20) DEFAULT 'MEDIUM',                -- HIGH, MEDIUM, LOW (for risks)
    status            VARCHAR(30) NOT NULL DEFAULT 'OPEN',         -- OPEN, IN_PROGRESS, MITIGATED, CLOSED
    owner             VARCHAR(120),
    project_id        BIGINT REFERENCES project(id) ON DELETE SET NULL,
    mitigation_plan   TEXT,
    due_date          DATE,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Ideas Board ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS idea (
    id                BIGSERIAL PRIMARY KEY,
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    submitter_name    VARCHAR(120),
    status            VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',    -- SUBMITTED, IN_REVIEW, APPROVED, REJECTED, IN_PROGRESS, CONVERTED
    votes             INT NOT NULL DEFAULT 0,
    tags              VARCHAR(500),                                 -- comma-separated
    estimated_effort  VARCHAR(20),                                  -- XS, S, M, L, XL
    linked_project_id BIGINT REFERENCES project(id) ON DELETE SET NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Resource Bookings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resource_booking (
    id               BIGSERIAL PRIMARY KEY,
    resource_id      BIGINT NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    project_id       BIGINT REFERENCES project(id) ON DELETE SET NULL,
    project_label    VARCHAR(255),                                  -- shown even if project_id is null
    start_date       DATE NOT NULL,
    end_date         DATE NOT NULL,
    allocation_pct   INT NOT NULL DEFAULT 100,                      -- 1-100
    booking_type     VARCHAR(30) NOT NULL DEFAULT 'PROJECT',        -- PROJECT, TRAINING, LEAVE, OTHER
    notes            TEXT,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_booking_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_alloc_pct     CHECK (allocation_pct BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_resource_booking_resource ON resource_booking(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_booking_project  ON resource_booking(project_id);
CREATE INDEX IF NOT EXISTS idx_resource_booking_dates    ON resource_booking(start_date, end_date);

-- ── Page permissions for new pages ──────────────────────────────────────────
INSERT INTO page_permission (role, page_key, allowed)
SELECT r.role, 'objectives', true
FROM (VALUES ('ADMIN'), ('READ_WRITE'), ('READ_ONLY')) AS r(role)
WHERE NOT EXISTS (SELECT 1 FROM page_permission WHERE page_key = 'objectives' AND role = r.role);

INSERT INTO page_permission (role, page_key, allowed)
SELECT r.role, 'risk_register', true
FROM (VALUES ('ADMIN'), ('READ_WRITE'), ('READ_ONLY')) AS r(role)
WHERE NOT EXISTS (SELECT 1 FROM page_permission WHERE page_key = 'risk_register' AND role = r.role);

INSERT INTO page_permission (role, page_key, allowed)
SELECT r.role, 'ideas_board', true
FROM (VALUES ('ADMIN'), ('READ_WRITE'), ('READ_ONLY')) AS r(role)
WHERE NOT EXISTS (SELECT 1 FROM page_permission WHERE page_key = 'ideas_board' AND role = r.role);

INSERT INTO page_permission (role, page_key, allowed)
SELECT r.role, 'resource_bookings', true
FROM (VALUES ('ADMIN'), ('READ_WRITE'), ('READ_ONLY')) AS r(role)
WHERE NOT EXISTS (SELECT 1 FROM page_permission WHERE page_key = 'resource_bookings' AND role = r.role);
