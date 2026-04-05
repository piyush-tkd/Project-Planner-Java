# Portfolio Planner — Build Progress Checklist

> **How to use:** After completing each prompt from the Cowork Prompt Playbook, tick the checkbox and fill in the date + notes column.
> One prompt = one session = one checkbox. Never mark complete until build passes.

---

## Pre-Flight

| # | Task | Status | Date | Notes |
|---|------|--------|------|-------|
| - | CLAUDE.md installed at top of project | ✅ Done | 2026-04-05 | Critical rules + tech stack added |
| - | COWORK-PROMPT-PLAYBOOK.md read and understood | ✅ Done | 2026-04-05 | — |
| - | PRD v12.5 created | ✅ Done | 2026-04-05 | PortfolioPlanner_PRD_v12.5.docx |
| - | Sidebar reorganised into 8 groups | ✅ Done | 2026-04-05 | v12.5 — Portfolio, Engineering, Simulations, People+2 |
| - | Analytics section split (4 groups) | ✅ Done | 2026-04-05 | Portfolio / Engineering / Simulations / People |
| - | Azure DevOps backend + frontend | ✅ Done | 2026-04-05 | V78+V79 migrations, controller, settings page, Git Intelligence tab |
| - | Engineering Intelligence merged page | ✅ Done | 2026-04-05 | 3-tab hub: Financial + Productivity + Git |
| - | OrgSettings /settings/org Tooltip fix | ✅ Done | 2026-04-05 | Missing Tooltip import causing crash |
| - | Integrations tab (Jira + Azure DevOps) | ✅ Done | 2026-04-05 | Merged into single Integrations tab in Admin Settings |

---

## Phase 0 — Design System Foundation

| # | Prompt | Status | Date | Notes |
|---|--------|--------|------|-------|
| 0.1 | Install core deps: `cmdk`, `framer-motion`, `recharts` | ✅ Done | 2026-04-05 | recharts already present. cmdk ^1.0.4 + framer-motion ^11.15.0 added. 35 pre-existing TS errors fixed. Build passes 0 errors. |
| 0.2 | Create `PageHeader` component | ✅ Done | 2026-04-05 | src/components/ui/PageHeader.tsx — build ✓ 0 errors |
| 0.3 | Create `EmptyState` component | ✅ Done | 2026-04-05 | src/components/ui/EmptyState.tsx — build ✓ 0 errors |
| 0.4 | Create `StatusBadge` component | ✅ Done | 2026-04-05 | src/components/ui/StatusBadge.tsx — build ✓ 0 errors |
| 0.5 | Create `KpiCard` component | ✅ Done | 2026-04-05 | src/components/ui/KpiCard.tsx — build ✓ 0 errors |
| 0.6 | Create `AvatarStack` component | ✅ Done | 2026-04-05 | src/components/ui/AvatarStack.tsx — build ✓ 0 errors |
| 0.7 | Create `src/components/ui/index.ts` barrel export | ✅ Done | 2026-04-05 | src/components/ui/index.ts — all 5 exports verified, build ✓ |
| 0.8 | Jira avatar sync → `resource.avatar_url` (V81 migration + DTO + sync) | ✅ Done | 2026-04-05 | V81 migration, Resource entity, ResourceResponse DTO, EntityMapper, JiraClient.getUserAvatarUrl(), JiraResourceMappingService.saveMapping() + syncAllAvatars(), frontend type updated |

**Phase 0 complete:** ✅ (7 / 7)

---

## Phase 1 — v13 Foundation & Security

| # | Prompt | Status | Date | Notes |
|---|--------|--------|------|-------|
| 1.1 | Feature Flags — V82 migration + Java entity + controller DTO | ✅ Done | 2026-04-05 | JSONB `features` column; 5 flags (ai/okr/risk/ideas/financials) default true; GET+PUT wired |
| 1.2 | Feature Flags — Backend enforcement (Spring interceptor) | ✅ Done | 2026-04-05 | FeatureFlagInterceptor.java + registered in WebConfig; 60s cache; 8 tests; /api/auth + /api/org excluded |
| 1.3 | Feature Flags — Frontend wiring (toggle → API) | ✅ Done | 2026-04-05 | Switches controlled via draft.features; handleFeatureToggle added; features included in PUT payload; tsc 0 errors |
| 1.4 | Empty States — Delivery group (5 pages) | ✅ Done | 2026-04-05 | EmptyState added to Releases, ReleaseNotes, JiraActuals, JiraSupport, JiraWorklog; icon prop changed to ReactNode; tsc 0 errors |
| 1.5 | Empty States — Engineering group (4 pages) | ✅ Done | 2026-04-05 | DoraMetricsPage, DeliveryPredictabilityPage, JiraAnalyticsPage, JiraDashboardBuilderPage; tsc 0 errors |
| 1.6 | Empty States — Portfolio + Simulations (8 pages) | ✅ Done | 2026-04-05 | ProjectHealth, PortfolioTimeline, ProjectSignals, DependencyMap, ProjectGantt, ScenarioSimulator, SmartNotifications, JiraPortfolioSync; tsc 0 errors |
| 1.7 | Empty States — People group (3 pages) | ✅ Done | 2026-04-05 | ResourceBookingsPage, ResourcePerformancePage, ResourceIntelligencePage; tsc 0 errors. Smoke test: 85/85 imports resolve, 76 routes verified, tsc exit 0 |
| 1.8 | Command Palette — Cmd+K global search | ✅ Done | 2026-04-05 | GlobalSearch.tsx already wired (Cmd+K, keyboard nav, categories). Expanded PAGE_RESULTS from ~20 → 52 items covering all navGroups; tsc exit 0 |
| 1.9 | JWT → HttpOnly Cookie — Backend | ✅ Done | 2026-04-05 | JwtUtil.getExpirationMs(); filter dual-read (header→cookie); AuthController addTokenCookie/clearTokenCookie; app.cookie.secure=false in local yml; 5 AuthCookieTests |
| 1.10 | JWT → HttpOnly Cookie — Frontend | ✅ Done | 2026-04-05 | client.ts: withCredentials=true, removed localStorage interceptor; AuthContext: cookie bootstrap on mount, no pp_token persisted, initialising state; ProtectedRoute: bootstrap spinner; auth.test.ts updated |
| 1.11 | Email SMTP — Infrastructure (EmailService + templates) | ✅ Done | 2026-04-05 | spring-boot-starter-thymeleaf added; EmailService.sendAlert(to,subject,ctx,template); weekly-digest.html + support-staleness.html Thymeleaf templates; 5 EmailServiceTests (mock MailSender). Note: SMTP config to be moved to UI/DB (follow-up) |

| 1.3b | Feature Flags sidebar + Dynamic Roles | ✅ Done | 2026-04-05 | AppShell hides items by featureFlag; V83 role_definition; RoleDefinitionController; UserManagementPage dynamic + Roles tab |

**Phase 1 complete:** ✅ (12 / 12)

---

## Phase 4 — Executive Layer & Collaboration (v14)

| # | Prompt | Status | Date | Notes |
|---|--------|--------|------|-------|
| 4.1 | Executive Summary Dashboard | ✅ Complete | 2026-04-05 | ExecSummaryPage + ExecSummaryController; KPI bar, OKR ring, velocity chart |
| 4.2 | Project Status Updates (RAG feed) | ✅ Complete | 2026-04-05 | V92 migration; ProjectStatusUpdateController; StatusUpdatesFeedPage + per-project tab |
| 4.3 | Team Pulse & Morale Tracker | ✅ Complete | 2026-04-05 | V93 migration; TeamPulseController; TeamPulsePage with POD heatmap |
| 4.4 | App Changelog / What's New | ✅ Complete | 2026-04-05 | V94 migration; AppChangelogController; WhatsNewDrawer + ChangelogAdminPage |
| 4.5 | Custom Project Fields | ✅ Complete | 2026-04-05 | V95+V96 migrations; CustomFieldController; CustomFieldsRenderer + CustomFieldsAdminPage + ProjectDetailPage integration |

---

## Phase 3 — v14 Features

| # | Prompt | Status | Date | Notes |
|---|--------|--------|------|-------|
| 3.1 | Gantt Drag View on Timeline Simulator | ✅ Done | 2026-04-05 | Added "List View" \| "Gantt View" SegmentedControl to TimelineSimulatorPage; GanttBar component uses pointer events for drag-to-move + resize-handle; GanttView grid with month columns + status legend; simulation results shown below Gantt or in right panel depending on view; tsc 0 errors; v12.9 |
| 3.2 | AI Impact Measurement Dashboard | ✅ Done | 2026-04-05 | V88 migration creates ai_impact_metric table seeded with 6 months of data (4 PODs, 4 metric types); AiImpactMetric entity + repo + AiImpactController (/api/reports/ai-impact/summary,trend,pods); AiImpactPage.tsx with KPI cards, Recharts LineChart (trend by POD), BarChart (AI vs Baseline velocity); "AI Impact" tab added to EngineeringIntelligencePage; tsc 0 errors; v13.0 |
| 3.3 | Capacity Forecast Report | ✅ Done | 2026-04-05 | CapacityForecastPage.tsx: uses /api/reports/capacity-gap, 3-month traffic-light per POD (critical/warning/healthy), RingProgress utilization gauge, progress bar per month, 3-KPI summary; added Forecast tab to CapacityHubPage; route /reports/capacity-forecast; nav: People→Capacity Forecast (IconRadar); page key: capacity_forecast |
| 3.4 | Sprint Retro Summaries | ✅ Done | 2026-04-05 | V90__sprint_retro_summary.sql; SprintRetroSummary entity+repo; SprintRetroController (/api/retro/sprints, /api/retro/summaries, /api/retro/generate/{id}); velocity delta computed vs prior retro; SprintRetroPage.tsx with pending alerts+generate buttons, KPI summary, Accordion of retro cards; route /reports/sprint-retro; nav: Engineering→Sprint Retro (IconListCheck); page key: sprint_retro |
| 3.5 | Resource Skills Matrix | ✅ Done | 2026-04-05 | V91__resource_skill.sql; ResourceSkill entity+repo; ResourceSkillController (/api/resources/{id}/skills CRUD + /matrix + /summary); upsert pattern; ResourceSkillsMatrixPage.tsx with skill coverage cards, ProficiencyDots (4 colored circles), add/remove skills modal with Autocomplete; route /reports/skills-matrix; nav: People→Skills Matrix (IconStars); page key: skills_matrix |
| 3.6 | Portfolio Risk Heatmap | ✅ Done | 2026-04-05 | RiskHeatmapPage.tsx: frontend-only, uses /api/risks; 3×4 probability×severity heatmap grid, color-coded by score, click-to-drill-down modal; KPI cards (critical/high/total/mitigated); full sorted risk table; route /reports/risk-heatmap; nav: Portfolio→Risk Heatmap (IconChartDots3); page key: risk_heatmap |
| 3.7 | Strategic Calendar + Sprint/Release Calendar Fix | ✅ Done | 2026-04-05 | Removed duplicate redirect routes /sprint-calendar→/calendar and /release-calendar→/calendar from App.tsx that were blocking SprintCalendarPage and ReleaseCalendarPage (React Router v6 first-match bug); Sprint Calendar + Release Calendar now accessible; added to Calendar nav group (IconCalendarEvent / IconCalendarPlus); page permissions moved from Legacy→Calendar group; v13.5 |

---

## Phase 2 — Notifications & Digest

| # | Prompt | Status | Date | Notes |
|---|--------|--------|------|-------|
| 2.1 | Wire SMTP Notifications (WeeklyDigestService + SupportStalenessService + DigestController) | ✅ Done | 2026-04-05 | WeeklyDigestService uses EmailService + weekly-digest.html; SupportStalenessService.sendStalenessAlert(); JiraSyncedIssueRepository.findStaleByProjectKeys(); DigestController adds POST /api/digest/send-staleness |
| 2.2 | Notification Scheduling — DB-driven cron + UI | ✅ Done | 2026-04-05 | V85 notification_schedule table; NotificationSchedule entity/repo/DTO/service/controller; NotificationSchedulerConfig (SchedulingConfigurer — dynamic cron from DB); WeeklyDigestService + SupportStalenessService read recipients/enabled from DB; OrgSettingsPage Email tab gets schedule panel; v12.6 |
| 2.3 | AI Proactive Insights Engine | ✅ Done | 2026-04-05 | V86 insight table; Insight entity/repo/DTO; InsightService with 5 detectors (DEADLINE_RISK, OVERALLOCATION, RESOURCE_CONFLICT, STALE_PROJECT, OPEN_HIGH_RISK); InsightController (GET/POST /run, PUT /ack); daily cron in NotificationSchedulerConfig; SmartNotificationsPage wired to /api/insights with Acknowledge button; v12.7 |
| 2.4 | Dashboard Insights Widget | ✅ Done | 2026-04-05 | AI Insights Widget added to DashboardPage WidgetGrid (id="ai-insights"); fetches GET /api/insights/summary; shows High/Medium/Low/Total severity count tiles; "View all" button → SmartNotificationsPage; tsc 0 errors; v12.8 |
| 2.5 | Gantt Live Data | ✅ Done | 2026-04-05 | GanttDependenciesPage: removed 8-item hardcoded PROJECTS and 6-pod POD_CAPACITIES; wired useProjects()+useProjectPodMatrix() for projects (startWeek from startDate, durationWeeks from targetDate/durationMonths, pod from primary matrix row, devCount estimated from devHours/FTE); wired useResources() for POD headcount (active+countsInCapacity grouped by pod+role); dynamic livePods for filter Select and legend; tsc 0 errors |
| 2.6 | Page Permissions V87 | ✅ Done | 2026-04-05 | V87__page_permissions_phase2.sql: seeds smtp_settings (ADMIN=true, RW/RO=false) and notification_schedule (ADMIN=true, RW/RO=false); smart_notifications+gantt_dependencies confirmed already in V77/V69; UserManagementPage.tsx page list updated with smtp_settings+notification_schedule entries in Admin group; tsc 0 errors |

---

## Verification Checkpoints

| Checkpoint | Last Run | Result | Notes |
|------------|----------|--------|-------|
| Full Build Check (mvn + npm) | 2026-04-05 | ✅ Pass | npm build: 0 TS errors, 7818 modules transformed |
| Full Route Smoke Test (37 routes) | — | — | Run after Prompt 1.7 |
| Security Audit (JWT in localStorage) | — | — | Run after Prompt 1.10 |

---

## Overall Progress

```
Pre-Flight   ████████████████████  9/9   ✅
Phase 0      ████████████████████  8/8   ✅
Phase 1      ████████████████████  12/12 ✅
Phase 2      ████████████████████  6/6   ✅ COMPLETE
Phase 3      ████████████████████  7/7   ✅ COMPLETE
Phase 4      ████████████████████  5/5   ✅ COMPLETE
─────────────────────────────────────────
Total        ████████████████████  41/41 ✅
```

---

## Notes & Blockers

| Date | Note |
|------|------|
| 2026-04-05 | V78 Flyway migration fixed (wrong table name `page_permissions` → `page_permission`, repair-on-migrate enabled) |
| 2026-04-05 | V79 created for ADO page permissions |
| 2026-04-05 | Backend must be started with `mvn clean spring-boot:run` for migration to apply |
| 2026-04-05 | SMTP config moved to DB (V84 migration). UI: Admin Settings → Email / SMTP tab. SmtpConfigService builds JavaMailSender dynamically — no restart needed. EmailService updated to read from DB. |

---

| 2026-04-05 | 35 pre-existing TS errors fixed: Mantine v7 API (SimpleGrid spacing, Progress.Root, SegmentedControl), null safety, NumberInput types, PodResponse fields |

*Updated: 2026-04-05 — v13.5 (Phase 3 COMPLETE — Prompts 3.3–3.7 done: Capacity Forecast, Sprint Retro, Skills Matrix, Risk Heatmap, Calendar fix)*
