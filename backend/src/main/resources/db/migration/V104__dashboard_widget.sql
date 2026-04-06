-- Sprint 15: Custom Dashboards
-- Stores per-user dashboard widget configurations with grid positions and settings.

CREATE TABLE dashboard_widget (
    id           BIGSERIAL    PRIMARY KEY,
    username     VARCHAR(255) NOT NULL,
    widget_type  VARCHAR(80)  NOT NULL,
    title        VARCHAR(255),
    grid_col     INT          NOT NULL DEFAULT 0,
    grid_row     INT          NOT NULL DEFAULT 0,
    col_span     INT          NOT NULL DEFAULT 1,
    row_span     INT          NOT NULL DEFAULT 1,
    config       JSONB,
    created_at   TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_widget_username ON dashboard_widget (username);
