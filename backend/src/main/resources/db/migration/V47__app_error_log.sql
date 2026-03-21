CREATE TABLE app_error_log (
    id              BIGSERIAL PRIMARY KEY,
    source          VARCHAR(50)  NOT NULL DEFAULT 'FRONTEND',
    severity        VARCHAR(20)  NOT NULL DEFAULT 'ERROR',
    error_type      VARCHAR(255),
    message         TEXT         NOT NULL,
    stack_trace     TEXT,
    page_url        VARCHAR(500),
    api_endpoint    VARCHAR(500),
    http_status     INTEGER,
    user_agent      TEXT,
    username        VARCHAR(255),
    component       VARCHAR(255),
    resolved        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_error_log_source     ON app_error_log(source);
CREATE INDEX idx_app_error_log_severity   ON app_error_log(severity);
CREATE INDEX idx_app_error_log_resolved   ON app_error_log(resolved);
CREATE INDEX idx_app_error_log_created_at ON app_error_log(created_at DESC);
