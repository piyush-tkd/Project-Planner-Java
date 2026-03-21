CREATE TABLE user_feedback (
    id              BIGSERIAL PRIMARY KEY,
    category        VARCHAR(50)  NOT NULL DEFAULT 'OTHER',
    message         TEXT         NOT NULL,
    page_url        VARCHAR(500),
    screenshot      TEXT,
    submitted_by    VARCHAR(255),
    status          VARCHAR(50)  NOT NULL DEFAULT 'NEW',
    admin_notes     TEXT,
    priority        VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_feedback_status     ON user_feedback(status);
CREATE INDEX idx_user_feedback_category   ON user_feedback(category);
CREATE INDEX idx_user_feedback_created_at ON user_feedback(created_at DESC);
