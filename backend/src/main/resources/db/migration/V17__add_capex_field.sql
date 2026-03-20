-- Add configurable CapEx/OpEx custom field ID to jira credentials
ALTER TABLE jira_credentials
    ADD COLUMN IF NOT EXISTS capex_field_id VARCHAR(100);
