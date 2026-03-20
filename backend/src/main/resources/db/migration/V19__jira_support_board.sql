-- Support queue board configuration
CREATE TABLE jira_support_board (
    id       BIGSERIAL    PRIMARY KEY,
    name     VARCHAR(100) NOT NULL,
    board_id BIGINT       NOT NULL UNIQUE,
    enabled  BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Page permission seeds for jira_support
-- READ_WRITE: allowed
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'jira_support', true);
-- READ_ONLY: allowed (view-only dashboard)
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY', 'jira_support', true);
