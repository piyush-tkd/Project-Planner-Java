-- V21: Audit log table for tracking significant data changes.
-- Records who changed what entity, when, and what action was taken.

CREATE TABLE IF NOT EXISTS audit_log (
    id            BIGSERIAL PRIMARY KEY,
    entity_type   VARCHAR(100)  NOT NULL,        -- e.g. 'Resource', 'Project', 'Pod'
    entity_id     BIGINT,                         -- the PK of the changed entity (nullable for bulk)
    entity_name   VARCHAR(255),                   -- human-readable label (e.g. resource name)
    action        VARCHAR(20)   NOT NULL,         -- CREATE | UPDATE | DELETE | IMPORT
    changed_by    VARCHAR(100)  NOT NULL,         -- username from JWT / system
    changed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    details       TEXT                            -- optional JSON or free-text summary
);

-- Index for efficient queries by entity type, user, and date
CREATE INDEX IF NOT EXISTS idx_audit_entity     ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user       ON audit_log (changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit_log (changed_at DESC);
