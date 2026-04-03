-- Leave entries table: tracks planned/sick leave per resource per month
CREATE TABLE IF NOT EXISTS leave_entry (
    id           BIGSERIAL     PRIMARY KEY,
    resource_id  BIGINT        NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    month_index  INT           NOT NULL CHECK (month_index BETWEEN 1 AND 12),
    leave_year   INT           NOT NULL,
    leave_hours  NUMERIC(7,2)  NOT NULL CHECK (leave_hours > 0),
    leave_type   VARCHAR(20)   NOT NULL DEFAULT 'PL' CHECK (leave_type IN ('PL','SL','HD','OTHER')),
    notes        VARCHAR(500),
    created_at   TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_entry_resource ON leave_entry(resource_id);
CREATE INDEX IF NOT EXISTS idx_leave_entry_year_month ON leave_entry(leave_year, month_index);

-- Page permission for leave management
INSERT INTO page_permission (role, page_key, allowed) VALUES
    ('READ_WRITE', 'leave_management', true),
    ('READ_ONLY',  'leave_management', true)
ON CONFLICT (role, page_key) DO NOTHING;
