-- Release calendar: monthly regular releases + special ad-hoc releases
CREATE TABLE release_calendar (
    id              BIGSERIAL    PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    release_date    DATE         NOT NULL,
    code_freeze_date DATE        NOT NULL,
    type            VARCHAR(20)  NOT NULL DEFAULT 'REGULAR',  -- REGULAR | SPECIAL
    notes           TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Sprint calendar: 2-week sprints and IP weeks
CREATE TABLE sprint (
    id                       BIGSERIAL    PRIMARY KEY,
    name                     VARCHAR(100) NOT NULL,
    type                     VARCHAR(20)  NOT NULL DEFAULT 'SPRINT',  -- SPRINT | IP_WEEK
    start_date               DATE         NOT NULL,
    end_date                 DATE         NOT NULL,
    requirements_lock_in_date DATE,
    created_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Per-project per-pod hours allocated to a specific sprint
CREATE TABLE project_sprint_allocation (
    id              BIGSERIAL    PRIMARY KEY,
    project_id      BIGINT       NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    pod_id          BIGINT       NOT NULL REFERENCES pod(id)     ON DELETE CASCADE,
    sprint_id       BIGINT       NOT NULL REFERENCES sprint(id)  ON DELETE CASCADE,
    dev_hours       NUMERIC(8,2) NOT NULL DEFAULT 0,
    qa_hours        NUMERIC(8,2) NOT NULL DEFAULT 0,
    bsa_hours       NUMERIC(8,2) NOT NULL DEFAULT 0,
    tech_lead_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, pod_id, sprint_id)
);

CREATE INDEX idx_psa_project  ON project_sprint_allocation(project_id);
CREATE INDEX idx_psa_pod      ON project_sprint_allocation(pod_id);
CREATE INDEX idx_psa_sprint   ON project_sprint_allocation(sprint_id);

-- Page permissions
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'sprint_calendar',   true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'sprint_calendar',   true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'release_calendar',  true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'release_calendar',  true) ON CONFLICT (role, page_key) DO NOTHING;

-- Seed release calendar from Technology Sprint and Release Calendar.xlsx
INSERT INTO release_calendar (name, release_date, code_freeze_date, type) VALUES
('November 2025 Release', '2025-11-09', '2025-10-31', 'REGULAR'),
('December 2025 Release', '2025-12-07', '2025-11-28', 'REGULAR'),
('January 2026 Release',  '2026-01-11', '2026-01-02', 'REGULAR'),
('February 2026 Release', '2026-02-08', '2026-01-30', 'REGULAR'),
('March 2026 Release',    '2026-03-08', '2026-02-27', 'REGULAR'),
('April 2026 Release',    '2026-04-12', '2026-04-03', 'REGULAR'),
('May 2026 Release',      '2026-05-10', '2026-05-01', 'REGULAR'),
('June 2026 Release',     '2026-06-07', '2026-05-29', 'REGULAR'),
('July 2026 Release',     '2026-07-12', '2026-07-03', 'REGULAR'),
('August 2026 Release',   '2026-08-09', '2026-07-31', 'REGULAR'),
('September 2026 Release','2026-09-06', '2026-08-28', 'REGULAR'),
('October 2026 Release',  '2026-10-11', '2026-10-02', 'REGULAR'),
('November 2026 Release', '2026-11-08', '2026-10-30', 'REGULAR'),
('December 2026 Release', '2026-12-06', '2026-11-25', 'REGULAR');

-- Seed sprint calendar from Technology Sprint and Release Calendar.xlsx
INSERT INTO sprint (name, type, start_date, end_date, requirements_lock_in_date) VALUES
('Sprint - 29-Oct-2025 - 11-Nov-2025', 'SPRINT',  '2025-10-29', '2025-11-11', NULL),
('Sprint - 12-Nov-2025 - 25-Nov-2025', 'SPRINT',  '2025-11-12', '2025-11-25', '2025-10-29'),
('Sprint - 26-Nov-2025 - 09-Dec-2025', 'SPRINT',  '2025-11-26', '2025-12-09', '2025-11-12'),
('Sprint - 10-Dec-2025 - 23-Dec-2025', 'SPRINT',  '2025-12-10', '2025-12-23', '2025-11-26'),
('IP Week - 24-Dec-2025 - 30-Dec-2025','IP_WEEK', '2025-12-24', '2025-12-30', NULL),
('Sprint - 31-Dec-2025 - 13-Jan-2026', 'SPRINT',  '2025-12-31', '2026-01-13', '2025-12-17'),
('Sprint - 14-Jan-2026 - 27-Jan-2026', 'SPRINT',  '2026-01-14', '2026-01-27', '2025-12-31'),
('Sprint - 28-Jan-2026 - 10-Feb-2026', 'SPRINT',  '2026-01-28', '2026-02-10', '2026-01-14'),
('Sprint - 11-Feb-2026 - 24-Feb-2026', 'SPRINT',  '2026-02-11', '2026-02-24', '2026-01-28'),
('Sprint - 25-Feb-2026 - 10-Mar-2026', 'SPRINT',  '2026-02-25', '2026-03-10', '2026-02-11'),
('Sprint - 11-Mar-2026 - 24-Mar-2026', 'SPRINT',  '2026-03-11', '2026-03-24', '2026-02-25'),
('IP Week - 25-Mar-2026 - 31-Mar-2026','IP_WEEK', '2026-03-25', '2026-03-31', NULL),
('Sprint - 01-Apr-2026 - 14-Apr-2026', 'SPRINT',  '2026-04-01', '2026-04-14', '2026-03-18'),
('Sprint - 15-Apr-2026 - 28-Apr-2026', 'SPRINT',  '2026-04-15', '2026-04-28', '2026-04-01'),
('Sprint - 29-Apr-2026 - 12-May-2026', 'SPRINT',  '2026-04-29', '2026-05-12', '2026-04-15'),
('Sprint - 13-May-2026 - 26-May-2026', 'SPRINT',  '2026-05-13', '2026-05-26', '2026-04-29'),
('Sprint - 27-May-2026 - 09-Jun-2026', 'SPRINT',  '2026-05-27', '2026-06-09', '2026-05-13'),
('Sprint - 10-Jun-2026 - 23-Jun-2026', 'SPRINT',  '2026-06-10', '2026-06-23', '2026-05-27'),
('IP Week - 24-Jun-2026 - 30-Jun-2026','IP_WEEK', '2026-06-24', '2026-06-30', NULL),
('Sprint - 01-Jul-2026 - 14-Jul-2026', 'SPRINT',  '2026-07-01', '2026-07-14', '2026-06-17'),
('Sprint - 15-Jul-2026 - 28-Jul-2026', 'SPRINT',  '2026-07-15', '2026-07-28', '2026-07-01'),
('Sprint - 29-Jul-2026 - 11-Aug-2026', 'SPRINT',  '2026-07-29', '2026-08-11', '2026-07-15'),
('Sprint - 12-Aug-2026 - 25-Aug-2026', 'SPRINT',  '2026-08-12', '2026-08-25', '2026-07-29'),
('Sprint - 26-Aug-2026 - 08-Sep-2026', 'SPRINT',  '2026-08-26', '2026-09-08', '2026-08-12'),
('Sprint - 09-Sep-2026 - 22-Sep-2026', 'SPRINT',  '2026-09-09', '2026-09-22', '2026-08-26'),
('IP Week - 23-Sep-2026 - 29-Sep-2026','IP_WEEK', '2026-09-23', '2026-09-29', NULL),
('Sprint - 30-Sep-2026 - 13-Oct-2026', 'SPRINT',  '2026-09-30', '2026-10-13', '2026-09-16'),
('Sprint - 14-Oct-2026 - 27-Oct-2026', 'SPRINT',  '2026-10-14', '2026-10-27', '2026-09-30'),
('Sprint - 28-Oct-2026 - 10-Nov-2026', 'SPRINT',  '2026-10-28', '2026-11-10', '2026-10-14');
