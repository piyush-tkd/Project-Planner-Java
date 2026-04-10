-- PP-701: Resource Pools & Demand Modeling
-- Sprint 7: Foundation for supply/demand gap analysis

-- ── Resource Pools ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resource_pools (
    id                BIGSERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL,
    role_type         VARCHAR(50)  NOT NULL,
    specialization    VARCHAR(100),
    target_headcount  INT,
    current_headcount INT NOT NULL DEFAULT 0,
    description       TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Resource Pool Members ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resource_pool_members (
    id              BIGSERIAL PRIMARY KEY,
    pool_id         BIGINT NOT NULL REFERENCES resource_pools(id) ON DELETE CASCADE,
    resource_id     BIGINT NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    seniority_level VARCHAR(20),
    available_from  DATE,
    is_available    BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(pool_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_pool_members_pool     ON resource_pool_members(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_members_resource ON resource_pool_members(resource_id);
CREATE INDEX IF NOT EXISTS idx_pool_members_avail    ON resource_pool_members(is_available);

-- Keep current_headcount in sync via trigger
CREATE OR REPLACE FUNCTION sync_pool_headcount() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE resource_pools
        SET current_headcount = (SELECT COUNT(*) FROM resource_pool_members WHERE pool_id = OLD.pool_id AND is_available = true)
        WHERE id = OLD.pool_id;
    ELSE
        UPDATE resource_pools
        SET current_headcount = (SELECT COUNT(*) FROM resource_pool_members WHERE pool_id = NEW.pool_id AND is_available = true)
        WHERE id = NEW.pool_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sync_pool_headcount
AFTER INSERT OR UPDATE OR DELETE ON resource_pool_members
FOR EACH ROW EXECUTE FUNCTION sync_pool_headcount();

-- ── Demand Requests ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demand_requests (
    id               BIGSERIAL PRIMARY KEY,
    project_id       BIGINT REFERENCES project(id),
    team_id          BIGINT REFERENCES pod(id),
    role_type        VARCHAR(50) NOT NULL,
    seniority_level  VARCHAR(20),
    headcount_needed INT NOT NULL,
    start_date       DATE NOT NULL,
    end_date         DATE,
    priority         VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical','High','Medium','Low')),
    status           VARCHAR(20) NOT NULL DEFAULT 'Open'   CHECK (status IN ('Open','Partially Filled','Filled','Cancelled')),
    justification    TEXT,
    created_by       BIGINT REFERENCES app_user(id),
    created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demand_status    ON demand_requests(status);
CREATE INDEX IF NOT EXISTS idx_demand_project   ON demand_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_demand_role      ON demand_requests(role_type);

-- ── Demand Fulfillments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demand_fulfillments (
    id                BIGSERIAL PRIMARY KEY,
    demand_request_id BIGINT NOT NULL REFERENCES demand_requests(id) ON DELETE CASCADE,
    resource_id       BIGINT NOT NULL REFERENCES resource(id),
    allocation_id     BIGINT,
    fulfilled_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_demand   ON demand_fulfillments(demand_request_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_resource ON demand_fulfillments(resource_id);

-- ── Seed default pools ────────────────────────────────────────────────
INSERT INTO resource_pools (name, role_type, target_headcount) VALUES
    ('Developer Pool', 'Developer', 30),
    ('QA Pool',        'QA',        15),
    ('BSA Pool',       'BSA',       10),
    ('SM Pool',        'SM',         8),
    ('Tech Lead Pool', 'Tech Lead',  6)
ON CONFLICT DO NOTHING;
