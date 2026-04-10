-- PP-301: Hybrid Team Model — team_types, allocation_types, resource_allocations
-- Sprint 3: Foundation for Core Teams vs Project Teams

-- ── Team Types ────────────────────────────────────────────────────────
CREATE TABLE team_types (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(50)  NOT NULL UNIQUE,   -- 'Core Team', 'Project Team'
    description TEXT,
    is_permanent BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO team_types (name, description, is_permanent) VALUES
    ('Core Team',    'Persistent BAU pod maintaining existing applications', true),
    ('Project Team', 'Time-boxed cross-functional team building a new project', false);

-- ── Allocation Types ──────────────────────────────────────────────────
CREATE TABLE allocation_types (
    id             BIGSERIAL PRIMARY KEY,
    name           VARCHAR(50) NOT NULL UNIQUE,
    max_percentage INT NOT NULL DEFAULT 100,
    description    TEXT
);

INSERT INTO allocation_types (name, max_percentage, description) VALUES
    ('Permanent',      100, 'Full-time permanent member of this team'),
    ('Project-based',  100, 'Assigned for the duration of a project'),
    ('Temporary',       50, 'Short-term cover or spike work'),
    ('Advisory',        20, 'Part-time advisory / SME role');

-- ── Resource Allocations ──────────────────────────────────────────────
CREATE TABLE resource_allocations (
    id                 BIGSERIAL PRIMARY KEY,
    resource_id        BIGINT  NOT NULL REFERENCES resource(id)  ON DELETE CASCADE,
    team_id            BIGINT  NOT NULL REFERENCES pod(id)        ON DELETE CASCADE,
    allocation_type_id BIGINT  NOT NULL REFERENCES allocation_types(id),
    percentage         INT  NOT NULL CHECK (percentage BETWEEN 1 AND 100),
    start_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date           DATE,
    is_primary         BOOLEAN NOT NULL DEFAULT false,
    notes              TEXT,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resource_alloc_resource  ON resource_allocations(resource_id);
CREATE INDEX idx_resource_alloc_team      ON resource_allocations(team_id);
CREATE INDEX idx_resource_alloc_active    ON resource_allocations(resource_id) WHERE end_date IS NULL;

-- ── Extend existing tables ────────────────────────────────────────────
ALTER TABLE pod     ADD COLUMN IF NOT EXISTS team_type_id      INT REFERENCES team_types(id);
ALTER TABLE pod     ADD COLUMN IF NOT EXISTS is_active         BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE pod     ADD COLUMN IF NOT EXISTS start_date        DATE;
ALTER TABLE pod     ADD COLUMN IF NOT EXISTS target_end_date   DATE;
ALTER TABLE project ADD COLUMN IF NOT EXISTS dedicated_team_id INT REFERENCES pod(id);

-- ── Total allocation constraint function ─────────────────────────────
CREATE OR REPLACE FUNCTION check_allocation_total()
RETURNS TRIGGER AS $$
BEGIN
    IF (
        SELECT COALESCE(SUM(percentage), 0)
        FROM   resource_allocations
        WHERE  resource_id = NEW.resource_id
          AND  (end_date IS NULL OR end_date > CURRENT_DATE)
          AND  id <> COALESCE(NEW.id, -1)
    ) + NEW.percentage > 100 THEN
        RAISE EXCEPTION 'Total allocation for resource % would exceed 100%%', NEW.resource_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_allocation_total
    BEFORE INSERT OR UPDATE ON resource_allocations
    FOR EACH ROW EXECUTE FUNCTION check_allocation_total();
