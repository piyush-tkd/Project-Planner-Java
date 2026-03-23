-- Custom Jira analytics dashboards with configurable widgets
CREATE TABLE jira_dashboard (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(200)  NOT NULL,
    description     VARCHAR(500),
    username        VARCHAR(100)  NOT NULL,
    is_default      BOOLEAN       NOT NULL DEFAULT false,
    widgets_json    TEXT          NOT NULL DEFAULT '[]',
    filters_json    TEXT          NOT NULL DEFAULT '{}',
    created_at      TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX idx_jira_dashboard_username ON jira_dashboard(username);

-- Seed a default dashboard
INSERT INTO jira_dashboard (name, description, username, is_default, widgets_json, filters_json)
VALUES (
    'Default Dashboard',
    'Pre-built analytics overview with all key charts',
    'system',
    true,
    '[
      {"id":"kpis","type":"kpis","title":"Key Metrics","size":"full","enabled":true},
      {"id":"created-vs-resolved","type":"createdVsResolved","title":"Created vs Resolved","size":"full","enabled":true},
      {"id":"by-type","type":"donut","title":"By Issue Type","dataKey":"byType","size":"quarter","enabled":true},
      {"id":"by-status","type":"donut","title":"By Status","dataKey":"byStatus","size":"quarter","enabled":true},
      {"id":"by-priority","type":"donut","title":"By Priority","dataKey":"byPriority","size":"quarter","enabled":true},
      {"id":"by-pod","type":"donut","title":"By POD / Team","dataKey":"byPod","size":"quarter","enabled":true},
      {"id":"workload","type":"workload","title":"Workload by Assignee","size":"half","enabled":true},
      {"id":"cycle-time","type":"cycleTime","title":"Cycle Time Distribution","size":"half","enabled":true},
      {"id":"aging","type":"aging","title":"Issue Aging","size":"half","enabled":true},
      {"id":"bug-trend","type":"bugTrend","title":"Bug Trend","size":"half","enabled":true},
      {"id":"by-label","type":"horizontalBar","title":"Top Labels","dataKey":"byLabel","size":"third","enabled":true},
      {"id":"by-component","type":"horizontalBar","title":"Top Components","dataKey":"byComponent","size":"third","enabled":true},
      {"id":"by-fixversion","type":"horizontalBar","title":"Top Fix Versions","dataKey":"byFixVersion","size":"third","enabled":true},
      {"id":"assignee-board","type":"assigneeLeaderboard","title":"Assignee Leaderboard","size":"full","enabled":true}
    ]',
    '{"months":3}'
);
