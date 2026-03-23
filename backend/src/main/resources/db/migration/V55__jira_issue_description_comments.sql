-- ============================================================================
-- V55: Store Jira issue descriptions and comments for AI context
-- ============================================================================

-- Add description text column to main issue table
ALTER TABLE jira_issue ADD COLUMN description_text TEXT;

-- Create comments table
CREATE TABLE jira_issue_comment (
    id                  BIGSERIAL PRIMARY KEY,
    comment_jira_id     VARCHAR(30)  NOT NULL,
    issue_key           VARCHAR(30)  NOT NULL REFERENCES jira_issue(issue_key) ON DELETE CASCADE,
    author_account_id   VARCHAR(128),
    author_display_name VARCHAR(255),
    body                TEXT         NOT NULL,
    created             TIMESTAMP,
    updated             TIMESTAMP,
    CONSTRAINT uq_comment_jira_id UNIQUE (comment_jira_id)
);
CREATE INDEX idx_jira_comment_issue   ON jira_issue_comment(issue_key);
CREATE INDEX idx_jira_comment_created ON jira_issue_comment(created);
