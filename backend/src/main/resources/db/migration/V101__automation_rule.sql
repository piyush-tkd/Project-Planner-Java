-- V100: Automation Engine — rule-based project workflow triggers
-- Each rule defines: when (trigger) + filter (condition) → do (action)

CREATE TABLE automation_rule (
    id               BIGSERIAL PRIMARY KEY,

    -- Metadata
    name             VARCHAR(255)  NOT NULL,
    description      TEXT,
    enabled          BOOLEAN       NOT NULL DEFAULT TRUE,
    created_by       VARCHAR(255),
    created_at       TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP     NOT NULL DEFAULT now(),

    -- Trigger: what event fires this rule
    -- Values: PROJECT_STATUS_CHANGED | TARGET_DATE_PASSED | PROJECT_CREATED |
    --         UTILIZATION_EXCEEDED   | SPRINT_STARTED     | RESOURCE_OVERALLOCATED
    trigger_event    VARCHAR(100)  NOT NULL,

    -- Optional trigger filter — e.g. only fire when new status = 'ON_HOLD'
    trigger_value    VARCHAR(255),

    -- Optional additional condition on the entity
    -- condition_field: status | priority | owner | pod | durationMonths | utilizationPct
    condition_field    VARCHAR(100),
    -- condition_operator: EQUALS | NOT_EQUALS | CONTAINS | GREATER_THAN | LESS_THAN
    condition_operator VARCHAR(50),
    condition_value    VARCHAR(255),

    -- Action: what to do when the rule fires
    -- Values: SEND_NOTIFICATION | FLAG_PROJECT | CHANGE_STATUS | LOG_ACTIVITY | ADD_RISK
    action_type      VARCHAR(100)  NOT NULL,

    -- JSON blob for action-specific config
    -- SEND_NOTIFICATION: {"recipients": "owner|admin|all", "message": "..."}
    -- CHANGE_STATUS:     {"newStatus": "AT_RISK"}
    -- FLAG_PROJECT:      {"flagColor": "red", "reason": "..."}
    -- LOG_ACTIVITY:      {"logMessage": "..."}
    -- ADD_RISK:          {"title": "...", "severity": "HIGH"}
    action_payload   JSONB         NOT NULL DEFAULT '{}'::jsonb,

    -- Execution stats
    last_fired_at    TIMESTAMP,
    fire_count       INTEGER       NOT NULL DEFAULT 0
);

CREATE INDEX idx_automation_rule_enabled   ON automation_rule (enabled);
CREATE INDEX idx_automation_rule_trigger   ON automation_rule (trigger_event);

COMMENT ON TABLE automation_rule IS 'User-defined automation rules: trigger → optional condition → action pipeline';
