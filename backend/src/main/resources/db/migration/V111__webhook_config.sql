-- V111: Slack / Teams / Custom outbound webhook configuration
-- Stores one row per configured webhook endpoint.
-- 'events' is a comma-separated list of event types that trigger this webhook.
-- Supported event types:
--   project.status_changed | approval.approved | approval.rejected | automation.rule_fired

CREATE TABLE webhook_config (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255)  NOT NULL,
    url         VARCHAR(2000) NOT NULL,
    provider    VARCHAR(50)   NOT NULL DEFAULT 'SLACK',   -- SLACK | TEAMS | CUSTOM
    secret      VARCHAR(500),                              -- optional HMAC signing secret
    enabled     BOOLEAN       NOT NULL DEFAULT TRUE,
    events      TEXT          NOT NULL DEFAULT 'project.status_changed,approval.approved,approval.rejected,automation.rule_fired',
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE webhook_config IS 'Outbound webhook endpoints for Slack, Teams, or custom receivers';
