-- V130: Seed 5 comprehensive test dashboards covering every widget type
-- in the JiraDashboardBuilderPage WIDGET_CATALOG (38 distinct types).
--
-- Dashboard layout:
--   1. Executive Command Centre  — KPIs, gauges, KPI cards, trend sparks, countdown
--   2. Team Performance Hub      — workload, assignee, velocity, radar, scatter, worklog
--   3. Quality & Health Board    — bugs, cycle time, aging, resolution, funnel, burndown
--   4. Issue Analytics Studio    — donuts, bars, treemap, pivot, heatmap, 2D
--   5. Flow & Delivery Tracker   — trend lines, cumulative flow, epic, release, monthly
--
-- All dashboards are seeded as system defaults (is_default = false) owned by 'admin'
-- so every user sees them in their dashboard list immediately.

INSERT INTO jira_dashboard (
    name, description, username, is_default,
    widgets_json, filters_json,
    created_at, updated_at
) VALUES

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Executive Command Centre
--    Widgets: kpis, singleKpi (×3), gauge (×2), ratioKpi, trendSpark (×2),
--             createdVsResolved, openTrend, countdown, statusCategoryDonut
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Executive Command Centre',
  'Top-level KPI overview — gauges, single metrics, trend sparks, and countdown for leadership reviews',
  'admin',
  false,
  '[
    {"id":"exec-countdown","type":"countdown","title":"Next Release Countdown","size":"full","enabled":true,"targetDate":"2026-05-30","targetLabel":"Q2 Release"},
    {"id":"exec-kpis","type":"kpis","title":"Key Metrics","size":"full","enabled":true},
    {"id":"exec-single-open","type":"singleKpi","title":"Open Issues","size":"quarter","enabled":true,"dataKey":"totalOpen"},
    {"id":"exec-single-cycle","type":"singleKpi","title":"Avg Cycle Time","size":"quarter","enabled":true,"dataKey":"avgCycleTimeDays"},
    {"id":"exec-single-throughput","type":"singleKpi","title":"Throughput / Week","size":"quarter","enabled":true,"dataKey":"throughputPerWeek"},
    {"id":"exec-single-bugs","type":"singleKpi","title":"Bug Count","size":"quarter","enabled":true,"dataKey":"bugCount"},
    {"id":"exec-gauge-bug","type":"gauge","title":"Bug Ratio Gauge","size":"quarter","enabled":true,"dataKey":"bugRatio"},
    {"id":"exec-gauge-cycle","type":"gauge","title":"Cycle Time Gauge","size":"quarter","enabled":true,"dataKey":"avgCycleTimeDays"},
    {"id":"exec-ratio","type":"ratioKpi","title":"Bug Ratio & Done %","size":"quarter","enabled":true},
    {"id":"exec-status-donut","type":"statusCategoryDonut","title":"Status Category Split","size":"quarter","enabled":true},
    {"id":"exec-spark-open","type":"trendSpark","title":"Open Issues Trend","size":"quarter","enabled":true,"dataKey":"totalOpen"},
    {"id":"exec-spark-cycle","type":"trendSpark","title":"Cycle Time Trend","size":"quarter","enabled":true,"dataKey":"avgCycleTimeDays"},
    {"id":"exec-cvr","type":"createdVsResolved","title":"Created vs Resolved","size":"full","enabled":true},
    {"id":"exec-open-trend","type":"openTrend","title":"Running Open Issues","size":"half","enabled":true}
  ]',
  '{"months":3,"pods":[],"versions":[],"types":[],"boards":[]}',
  NOW(), NOW()
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Team Performance Hub
--    Widgets: workload, assigneeLeaderboard, scatterPlot, worklogByAuthor,
--             teamComparison, velocityChart, radarChart, horizontalBar (×3)
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Team Performance Hub',
  'People-centric view — who is doing what, workload balance, velocity, and cross-team comparisons',
  'admin',
  false,
  '[
    {"id":"team-workload","type":"workload","title":"Workload by Assignee","size":"half","enabled":true,"limit":15},
    {"id":"team-scatter","type":"scatterPlot","title":"Workload Bubble Chart","size":"half","enabled":true},
    {"id":"team-leaderboard","type":"assigneeLeaderboard","title":"Assignee Leaderboard","size":"full","enabled":true,"limit":20},
    {"id":"team-velocity","type":"velocityChart","title":"Sprint Velocity","size":"full","enabled":true,"limit":12},
    {"id":"team-comparison","type":"teamComparison","title":"POD Comparison","size":"full","enabled":true},
    {"id":"team-radar","type":"radarChart","title":"Issue Type Radar","size":"half","enabled":true,"dataKey":"byType","limit":8},
    {"id":"team-worklog","type":"worklogByAuthor","title":"Hours Logged by Author","size":"half","enabled":true,"limit":20},
    {"id":"team-hbar-assignee","type":"horizontalBar","title":"Top Assignees","dataKey":"byAssignee","size":"third","enabled":true,"limit":10},
    {"id":"team-hbar-reporter","type":"horizontalBar","title":"Top Reporters","dataKey":"byReporter","size":"third","enabled":true,"limit":10},
    {"id":"team-hbar-pod","type":"horizontalBar","title":"Issues by POD","dataKey":"byPod","size":"third","enabled":true,"limit":10}
  ]',
  '{"months":3,"pods":[],"versions":[],"types":[],"boards":[]}',
  NOW(), NOW()
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Quality & Health Board
--    Widgets: bugTrend, cycleTime, cycleTimeScatter, aging, averageAge,
--             resolutionTime, resolutionDonut, funnelChart, sprintBurndown,
--             lineChart, throughputHist
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Quality & Health Board',
  'Engineering quality signals — bugs, cycle times, aging, resolution trends, and sprint burndown',
  'admin',
  false,
  '[
    {"id":"qual-funnel","type":"funnelChart","title":"Issue Flow Funnel","size":"quarter","enabled":true},
    {"id":"qual-resolution-donut","type":"resolutionDonut","title":"Resolution Breakdown","size":"quarter","enabled":true},
    {"id":"qual-status-donut","type":"statusCategoryDonut","title":"Status Category Split","size":"quarter","enabled":true},
    {"id":"qual-ratio","type":"ratioKpi","title":"Quality Ratios","size":"quarter","enabled":true},
    {"id":"qual-bug-trend","type":"bugTrend","title":"Bug Trend (Monthly)","size":"half","enabled":true},
    {"id":"qual-cycle-time","type":"cycleTime","title":"Cycle Time Distribution","size":"half","enabled":true},
    {"id":"qual-cycle-scatter","type":"cycleTimeScatter","title":"Cycle Time Scatter","size":"half","enabled":true},
    {"id":"qual-aging","type":"aging","title":"Issue Aging Buckets","size":"half","enabled":true},
    {"id":"qual-avg-age","type":"averageAge","title":"Average Age Chart","size":"half","enabled":true},
    {"id":"qual-res-time","type":"resolutionTime","title":"Resolution Time Trend","size":"half","enabled":true},
    {"id":"qual-line","type":"lineChart","title":"Created vs Resolved Line","size":"full","enabled":true},
    {"id":"qual-throughput","type":"throughputHist","title":"Weekly Throughput Histogram","size":"half","enabled":true},
    {"id":"qual-burndown","type":"sprintBurndown","title":"Sprint Burndown (Approx)","size":"full","enabled":true,"limit":12}
  ]',
  '{"months":6,"pods":[],"versions":[],"types":[],"boards":[]}',
  NOW(), NOW()
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Issue Analytics Studio
--    Widgets: donut (×6 dataKeys), stackedBar, treemap, pivotTable,
--             issueTable, twoDimensional, heatmap, horizontalBar (×3)
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Issue Analytics Studio',
  'Drill-down issue analysis — slice by type, status, priority, component, label, epic, and more',
  'admin',
  false,
  '[
    {"id":"anal-donut-type","type":"donut","title":"By Issue Type","dataKey":"byType","size":"quarter","enabled":true},
    {"id":"anal-donut-status","type":"donut","title":"By Status","dataKey":"byStatus","size":"quarter","enabled":true},
    {"id":"anal-donut-priority","type":"donut","title":"By Priority","dataKey":"byPriority","size":"quarter","enabled":true},
    {"id":"anal-donut-pod","type":"donut","title":"By POD / Team","dataKey":"byPod","size":"quarter","enabled":true},
    {"id":"anal-donut-epic","type":"donut","title":"By Epic","dataKey":"byEpic","size":"quarter","enabled":true},
    {"id":"anal-donut-sprint","type":"donut","title":"By Sprint","dataKey":"bySprint","size":"quarter","enabled":true},
    {"id":"anal-donut-label","type":"donut","title":"By Label","dataKey":"byLabel","size":"quarter","enabled":true},
    {"id":"anal-donut-component","type":"donut","title":"By Component","dataKey":"byComponent","size":"quarter","enabled":true},
    {"id":"anal-stacked","type":"stackedBar","title":"Stacked Issues by POD","dataKey":"byPod","size":"full","enabled":true},
    {"id":"anal-treemap","type":"treemap","title":"Treemap by Issue Type","dataKey":"byType","size":"half","enabled":true},
    {"id":"anal-hbar-label","type":"horizontalBar","title":"Top Labels","dataKey":"byLabel","size":"third","enabled":true,"limit":12},
    {"id":"anal-hbar-component","type":"horizontalBar","title":"Top Components","dataKey":"byComponent","size":"third","enabled":true,"limit":12},
    {"id":"anal-hbar-fixver","type":"horizontalBar","title":"Top Fix Versions","dataKey":"byFixVersion","size":"third","enabled":true,"limit":12},
    {"id":"anal-2d","type":"twoDimensional","title":"Status × Priority","dataKey":"byStatus","secondaryDataKey":"byPriority","size":"full","enabled":true},
    {"id":"anal-heatmap","type":"heatmap","title":"Priority Heatmap","dataKey":"byPriority","size":"half","enabled":true},
    {"id":"anal-pivot","type":"pivotTable","title":"Pivot: Status Breakdown","dataKey":"byStatus","size":"full","enabled":true},
    {"id":"anal-issue-table","type":"issueTable","title":"All Issues Table","dataKey":"byAssignee","size":"full","enabled":true,"limit":50}
  ]',
  '{"months":3,"pods":[],"versions":[],"types":[],"boards":[]}',
  NOW(), NOW()
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Flow & Delivery Tracker
--    Widgets: cumulativeFlow, monthlySummary, epicProgress, releaseNotes,
--             supportQueueSummary, openTrend, lineChart, donut (byFixVersion),
--             horizontalBar (byFixVersion), countdown
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Flow & Delivery Tracker',
  'Delivery health — cumulative flow, monthly summaries, epic progress, release notes, and support queue',
  'admin',
  false,
  '[
    {"id":"flow-countdown","type":"countdown","title":"Q3 Planning Deadline","size":"full","enabled":true,"targetDate":"2026-06-30","targetLabel":"Q3 PLANNING"},
    {"id":"flow-cumulative","type":"cumulativeFlow","title":"Cumulative Created vs Resolved","size":"full","enabled":true},
    {"id":"flow-monthly","type":"monthlySummary","title":"Monthly Summary Table","size":"full","enabled":true},
    {"id":"flow-epic","type":"epicProgress","title":"Epic Progress","size":"full","enabled":true,"limit":15},
    {"id":"flow-release","type":"releaseNotes","title":"Release Notes by Version","size":"full","enabled":true,"limit":10},
    {"id":"flow-support","type":"supportQueueSummary","title":"Support Queue Overview","size":"half","enabled":true},
    {"id":"flow-open-trend","type":"openTrend","title":"Open Issues Trend","size":"half","enabled":true},
    {"id":"flow-donut-ver","type":"donut","title":"By Fix Version","dataKey":"byFixVersion","size":"quarter","enabled":true},
    {"id":"flow-donut-month","type":"donut","title":"By Created Month","dataKey":"byCreatedMonth","size":"quarter","enabled":true},
    {"id":"flow-hbar-ver","type":"horizontalBar","title":"Top Fix Versions","dataKey":"byFixVersion","size":"half","enabled":true,"limit":15},
    {"id":"flow-line","type":"lineChart","title":"Velocity Trend Line","size":"full","enabled":true}
  ]',
  '{"months":6,"pods":[],"versions":[],"types":[],"boards":[]}',
  NOW(), NOW()
)

ON CONFLICT DO NOTHING;

-- Reset the sequence so future inserts don't collide
SELECT setval('jira_dashboard_id_seq', (SELECT COALESCE(MAX(id), 10) FROM jira_dashboard), true);
