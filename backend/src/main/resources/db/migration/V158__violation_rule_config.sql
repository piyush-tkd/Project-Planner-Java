-- V158: Violation rule configuration table
-- Stores a single JSON blob that defines which fields/conditions are checked
-- for sprint hygiene violations in the Sprint Command Center.

CREATE TABLE IF NOT EXISTS jira_violation_rule_config (
    id         BIGSERIAL PRIMARY KEY,
    rules_json TEXT NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the default built-in rules (all enabled out of the box)
INSERT INTO jira_violation_rule_config (rules_json) VALUES (
  '[
    {"id":"missing-date","label":"Missing Due Date","enabled":true,"builtIn":true,"ruleType":"required"},
    {"id":"overdue","label":"Overdue","enabled":true,"builtIn":true,"ruleType":"not-overdue"},
    {"id":"no-version","label":"No Fix Version","enabled":true,"builtIn":true,"ruleType":"required"},
    {"id":"long-running","label":"Long Running","enabled":true,"builtIn":true,"ruleType":"threshold","threshold":5},
    {"id":"no-story-points","label":"Missing Story Points","enabled":false,"builtIn":true,"ruleType":"required"}
  ]'
);
