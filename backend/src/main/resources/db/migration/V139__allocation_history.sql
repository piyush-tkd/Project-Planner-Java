-- PP-306: Allocation History & Audit Trail
CREATE TABLE allocation_history (
    id              BIGSERIAL PRIMARY KEY,
    allocation_id   BIGINT       NOT NULL,  -- NOT a FK — we keep history after deletion
    resource_id     BIGINT       NOT NULL REFERENCES resource(id),
    team_id         BIGINT       NOT NULL REFERENCES pod(id),
    action          VARCHAR(10)  NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    changed_by      BIGINT       REFERENCES app_user(id),
    changed_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    old_percentage  INT,
    new_percentage  INT,
    old_end_date    DATE,
    new_end_date    DATE,
    notes           TEXT
);

CREATE INDEX idx_alloc_history_resource ON allocation_history(resource_id);
CREATE INDEX idx_alloc_history_team     ON allocation_history(team_id);
CREATE INDEX idx_alloc_history_changed  ON allocation_history(changed_at DESC);

-- Trigger to auto-log changes
CREATE OR REPLACE FUNCTION log_allocation_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO allocation_history
            (allocation_id, resource_id, team_id, action, new_percentage, new_end_date)
        VALUES (NEW.id, NEW.resource_id, NEW.team_id, 'CREATE', NEW.percentage, NEW.end_date);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO allocation_history
            (allocation_id, resource_id, team_id, action, old_percentage, new_percentage, old_end_date, new_end_date)
        VALUES (NEW.id, NEW.resource_id, NEW.team_id, 'UPDATE',
                OLD.percentage, NEW.percentage, OLD.end_date, NEW.end_date);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO allocation_history
            (allocation_id, resource_id, team_id, action, old_percentage, old_end_date)
        VALUES (OLD.id, OLD.resource_id, OLD.team_id, 'DELETE', OLD.percentage, OLD.end_date);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_allocation_history
    AFTER INSERT OR UPDATE OR DELETE ON resource_allocations
    FOR EACH ROW EXECUTE FUNCTION log_allocation_change();
