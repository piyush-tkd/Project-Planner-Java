-- V155: Power Dashboard enhancements
-- Global filter bar, auto-refresh, custom metrics, section headers, templates

-- Global filters persisted per dashboard (date_range, project_key, assignee, sprint, team)
ALTER TABLE power_dashboard
  ADD COLUMN IF NOT EXISTS global_filters JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_metrics JSONB DEFAULT '[]';

-- Auto-refresh interval per widget (0 = off, otherwise minutes)
ALTER TABLE power_dashboard_widget
  ADD COLUMN IF NOT EXISTS refresh_interval_minutes INTEGER DEFAULT 0;

-- Dashboard templates (built-in starters)
CREATE TABLE IF NOT EXISTS power_dashboard_template (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    icon        VARCHAR(50),
    widgets     JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed built-in templates
INSERT INTO power_dashboard_template (name, description, category, icon, widgets) VALUES

('Engineering Health', 'Core engineering metrics: velocity, cycle time, bug rate, aging WIP', 'Engineering',
 '🔧', '[
  {"title":"Velocity (SP/Sprint)","widget_type":"velocity","position":{"x":0,"y":0,"w":6,"h":4},"config":{"source":"issues","metric":"velocity_sp","groupBy":"sprint_name","filters":[],"dateRange":{"preset":"last_6m"},"limit":12,"sortBy":"label_asc"}},
  {"title":"Open Bugs","widget_type":"kpi_card","position":{"x":6,"y":0,"w":3,"h":4},"config":{"source":"issues","metric":"count","filters":[{"field":"status_category","op":"neq","value":"done"},{"field":"issue_type","op":"eq","value":"Bug"}],"dateRange":{"preset":"last_90d"},"limit":1,"sortBy":"metric_desc","threshold_warning":20,"threshold_critical":50,"threshold_direction":"above","value_name":"Open Bugs"}},
  {"title":"Avg Cycle Time","widget_type":"kpi_card","position":{"x":9,"y":0,"w":3,"h":4},"config":{"source":"issues","metric":"avg_lead_time_days","filters":[{"field":"status_category","op":"eq","value":"done"}],"dateRange":{"preset":"last_90d"},"limit":1,"sortBy":"metric_desc","value_name":"Avg Days"}},
  {"title":"Bug Rate (by type)","widget_type":"pie","position":{"x":0,"y":4,"w":4,"h":4},"config":{"source":"issues","metric":"count","groupBy":"issue_type","filters":[],"dateRange":{"preset":"last_90d"},"limit":10,"sortBy":"metric_desc"}},
  {"title":"Cycle Time by Type","widget_type":"box_plot","position":{"x":4,"y":4,"w":8,"h":4},"config":{"source":"issues","metric":"count","filters":[],"dateRange":{"preset":"last_90d"},"limit":20,"sortBy":"metric_desc","special_endpoint":"box-plot","special_params":{"groupBy":"issue_type","days":"90"}}},
  {"title":"Issues by Status Over Time","widget_type":"cfd","position":{"x":0,"y":8,"w":12,"h":5},"config":{"source":"issues","metric":"count","groupBy":"week","groupBy2":"status_name","filters":[],"dateRange":{"preset":"last_6m"},"limit":100,"sortBy":"label_asc"}}
]'),

('Sprint Review', 'Everything you need for a sprint retrospective', 'Delivery',
 '🏃', '[
  {"title":"Sprint Burndown","widget_type":"sprint_burndown","position":{"x":0,"y":0,"w":6,"h":5},"config":{"source":"issues","metric":"count","filters":[],"dateRange":{"preset":"last_90d"},"limit":20,"sortBy":"metric_desc","special_endpoint":"sprint-burndown","special_params":{}}},
  {"title":"Sprint Velocity Trend","widget_type":"velocity","position":{"x":6,"y":0,"w":6,"h":5},"config":{"source":"issues","metric":"velocity_sp","groupBy":"sprint_name","filters":[],"dateRange":{"preset":"last_6m"},"limit":12,"sortBy":"label_asc"}},
  {"title":"Carryover Issues","widget_type":"kpi_card","position":{"x":0,"y":5,"w":3,"h":3},"config":{"source":"issues","metric":"count","filters":[{"field":"status_category","op":"neq","value":"done"}],"dateRange":{"preset":"last_30d"},"limit":1,"sortBy":"metric_desc","value_name":"Open Issues"}},
  {"title":"Throughput This Sprint","widget_type":"kpi_card","position":{"x":3,"y":5,"w":3,"h":3},"config":{"source":"issues","metric":"count_done","filters":[],"dateRange":{"preset":"last_30d"},"limit":1,"sortBy":"metric_desc","value_name":"Completed"}},
  {"title":"Top Contributors","widget_type":"leaderboard","position":{"x":6,"y":5,"w":6,"h":5},"config":{"source":"issues","metric":"count","groupBy":"assignee_display_name","filters":[{"field":"status_category","op":"eq","value":"done"}],"dateRange":{"preset":"last_30d"},"limit":10,"sortBy":"metric_desc"}}
]'),

('Leadership Summary', 'High-level portfolio view for executives', 'Leadership',
 '📊', '[
  {"title":"Total Issues in Flight","widget_type":"kpi_card","position":{"x":0,"y":0,"w":3,"h":3},"config":{"source":"issues","metric":"count","filters":[{"field":"status_category","op":"neq","value":"done"}],"dateRange":{"preset":"last_90d"},"limit":1,"sortBy":"metric_desc","value_name":"In Progress"}},
  {"title":"Completed This Month","widget_type":"kpi_card","position":{"x":3,"y":0,"w":3,"h":3},"config":{"source":"issues","metric":"count_done","filters":[],"dateRange":{"preset":"last_30d"},"limit":1,"sortBy":"metric_desc","value_name":"Done"}},
  {"title":"Active Assignees","widget_type":"kpi_card","position":{"x":6,"y":0,"w":3,"h":3},"config":{"source":"issues","metric":"count_distinct_assignee","filters":[],"dateRange":{"preset":"last_30d"},"limit":1,"sortBy":"metric_desc","value_name":"People"}},
  {"title":"Avg Lead Time","widget_type":"kpi_card","position":{"x":9,"y":0,"w":3,"h":3},"config":{"source":"issues","metric":"avg_lead_time_days","filters":[{"field":"status_category","op":"eq","value":"done"}],"dateRange":{"preset":"last_30d"},"limit":1,"sortBy":"metric_desc","value_name":"Days"}},
  {"title":"Monthly Summary","widget_type":"monthly_summary","position":{"x":0,"y":3,"w":8,"h":5},"config":{"source":"issues","metric":"count","filters":[],"dateRange":{"preset":"last_12m"},"limit":12,"sortBy":"metric_desc","special_endpoint":"monthly-summary","special_params":{"months":"12"}}},
  {"title":"Issues by Project","widget_type":"horizontal_bar","position":{"x":8,"y":3,"w":4,"h":5},"config":{"source":"issues","metric":"count","groupBy":"project_key","filters":[],"dateRange":{"preset":"last_90d"},"limit":12,"sortBy":"metric_desc"}}
]'),

('Worklog Timesheet', 'Hours logged by person, project, and week', 'Team',
 '⏱️', '[
  {"title":"Total Hours Logged","widget_type":"kpi_card","position":{"x":0,"y":0,"w":3,"h":3},"config":{"source":"worklogs","metric":"sum_hours_logged","filters":[],"dateRange":{"preset":"last_30d"},"limit":1,"sortBy":"metric_desc","value_name":"Hours"}},
  {"title":"Hours by Person","widget_type":"horizontal_bar","position":{"x":3,"y":0,"w":5,"h":5},"config":{"source":"worklogs","metric":"sum_hours_logged","groupBy":"author_display_name","filters":[],"dateRange":{"preset":"last_30d"},"limit":15,"sortBy":"metric_desc","label_name":"Assignee","value_name":"Hours"}},
  {"title":"Hours by Project","widget_type":"pie","position":{"x":8,"y":0,"w":4,"h":5},"config":{"source":"worklogs","metric":"sum_hours_logged","groupBy":"project_key","filters":[],"dateRange":{"preset":"last_30d"},"limit":10,"sortBy":"metric_desc","value_name":"Hours"}},
  {"title":"Worklog Timeline","widget_type":"worklog_timeline","position":{"x":0,"y":5,"w":12,"h":5},"config":{"source":"worklogs","metric":"sum_hours_logged","groupBy":"author_display_name","groupBy2":"week","filters":[],"dateRange":{"preset":"last_90d"},"limit":50,"sortBy":"metric_desc","label_name":"Assignee","label2_name":"Week","value_name":"Hours"}}
]');
