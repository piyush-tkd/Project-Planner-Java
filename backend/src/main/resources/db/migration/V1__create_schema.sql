-- Core schema for Engineering Portfolio Planner

CREATE TABLE pod (
    id                    BIGSERIAL PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL UNIQUE,
    complexity_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    display_order         INT NOT NULL DEFAULT 0,
    active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE resource (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(200) NOT NULL,
    role               VARCHAR(20) NOT NULL CHECK (role IN ('DEVELOPER','QA','BSA','TECH_LEAD')),
    location           VARCHAR(10) NOT NULL CHECK (location IN ('US','INDIA')),
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    counts_in_capacity BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE resource_pod_assignment (
    id           BIGSERIAL PRIMARY KEY,
    resource_id  BIGINT NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    pod_id       BIGINT NOT NULL REFERENCES pod(id) ON DELETE CASCADE,
    capacity_fte NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(resource_id)
);

CREATE TABLE project (
    id               BIGSERIAL PRIMARY KEY,
    name             VARCHAR(300) NOT NULL,
    priority         VARCHAR(5) NOT NULL CHECK (priority IN ('P0','P1','P2','P3')),
    owner            VARCHAR(200),
    start_month      INT NOT NULL CHECK (start_month BETWEEN 1 AND 12),
    target_end_month INT CHECK (target_end_month BETWEEN 1 AND 12),
    duration_months  INT NOT NULL DEFAULT 1,
    default_pattern  VARCHAR(50) NOT NULL DEFAULT 'Flat',
    notes            TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ON_HOLD','COMPLETED','CANCELLED')),
    blocked_by_id    BIGINT REFERENCES project(id),
    target_date      DATE,
    start_date       DATE,
    capacity_note    TEXT,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE project_pod_planning (
    id                  BIGSERIAL PRIMARY KEY,
    project_id          BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    pod_id              BIGINT NOT NULL REFERENCES pod(id) ON DELETE CASCADE,
    tshirt_size         VARCHAR(5) NOT NULL CHECK (tshirt_size IN ('XS','S','M','L','XL')),
    complexity_override NUMERIC(4,2),
    effort_pattern      VARCHAR(50),
    pod_start_month     INT,
    duration_override   INT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, pod_id)
);

CREATE TABLE resource_availability (
    id          BIGSERIAL PRIMARY KEY,
    resource_id BIGINT NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    month_index INT NOT NULL CHECK (month_index BETWEEN 1 AND 12),
    hours       NUMERIC(6,2) NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(resource_id, month_index)
);

CREATE TABLE temporary_override (
    id              BIGSERIAL PRIMARY KEY,
    resource_id     BIGINT NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    to_pod_id       BIGINT NOT NULL REFERENCES pod(id),
    start_month     INT NOT NULL CHECK (start_month BETWEEN 1 AND 12),
    end_month       INT NOT NULL CHECK (end_month BETWEEN 1 AND 12),
    allocation_pct  NUMERIC(5,2) NOT NULL CHECK (allocation_pct BETWEEN 0 AND 100),
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE bau_assumption (
    id       BIGSERIAL PRIMARY KEY,
    pod_id   BIGINT NOT NULL REFERENCES pod(id) ON DELETE CASCADE,
    role     VARCHAR(20) NOT NULL CHECK (role IN ('DEVELOPER','QA','BSA','TECH_LEAD')),
    bau_pct  NUMERIC(5,2) NOT NULL DEFAULT 20.0,
    UNIQUE(pod_id, role)
);

CREATE TABLE timeline_config (
    id                  BIGSERIAL PRIMARY KEY,
    start_year          INT NOT NULL,
    start_month         INT NOT NULL,
    current_month_index INT NOT NULL DEFAULT 1,
    working_hours       JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE effort_pattern (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(500),
    weights     JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE role_effort_mix (
    id      BIGSERIAL PRIMARY KEY,
    role    VARCHAR(20) NOT NULL UNIQUE CHECK (role IN ('DEVELOPER','QA','BSA','TECH_LEAD')),
    mix_pct NUMERIC(5,2) NOT NULL
);

CREATE TABLE scenario (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE scenario_override (
    id             BIGSERIAL PRIMARY KEY,
    scenario_id    BIGINT NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
    entity_type    VARCHAR(30) NOT NULL,
    entity_id      BIGINT NOT NULL,
    field_name     VARCHAR(50) NOT NULL,
    override_value TEXT NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_resource_active ON resource(active);
CREATE INDEX idx_project_status ON project(status);
CREATE INDEX idx_project_pod_planning_project ON project_pod_planning(project_id);
CREATE INDEX idx_project_pod_planning_pod ON project_pod_planning(pod_id);
CREATE INDEX idx_resource_availability_resource ON resource_availability(resource_id);
CREATE INDEX idx_resource_pod_assignment_pod ON resource_pod_assignment(pod_id);
CREATE INDEX idx_temporary_override_resource ON temporary_override(resource_id);
CREATE INDEX idx_bau_assumption_pod ON bau_assumption(pod_id);
CREATE INDEX idx_scenario_override_scenario ON scenario_override(scenario_id);
