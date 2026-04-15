-- V151: Quality metrics configuration table
-- Controls what counts as an escaped bug, invalid bug, etc.
-- All values are comma-separated strings for easy UI editing.

CREATE TABLE IF NOT EXISTS jira_quality_config (
    id          BIGSERIAL PRIMARY KEY,
    config_key  VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO jira_quality_config (config_key, config_value, description) VALUES
  -- Phase Defect Found values that represent ESCAPED bugs (post-sprint defects)
  ('escape_phases',
   'Integration,Production,Regression,UAT',
   'Values of "Phase Defect Found" field that count as escaped bugs. Comma-separated.'),

  -- Statuses that mean the ticket is NOT a real bug — exclude from all quality metrics
  ('invalid_bug_statuses',
   'NOT A BUG,CANNOT REPRODUCE,DUPLICATE,WON''T DO,WONT DO,WONT FIX,WON''T FIX,INVALID,REJECTED',
   'Issue statuses indicating invalid/non-real bugs. Comma-separated. Case-insensitive.'),

  -- Issue types that are treated as bugs in quality calculations
  ('bug_issue_types',
   'Bug,Defect,Production Bug,Regression',
   'Issue types considered as defects/bugs. Comma-separated. Case-insensitive.'),

  -- The Jira custom field ID for "Phase Defect Found"
  ('phase_defect_field',
   'customfield_13493',
   'Jira custom field ID that captures when/where a defect was found.'),

  -- In-sprint phases — bugs caught here are NOT escapes (found during normal QA)
  ('in_sprint_phases',
   'Development,Testing,Sprint,QA',
   'Phase values that mean the bug was caught during the sprint (not escaped).')

ON CONFLICT (config_key) DO NOTHING;
