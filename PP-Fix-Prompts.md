# Portfolio Planner v30.0 — Fix & Navigation Redesign Prompts

> **Generated:** April 14, 2026 | **Source:** Live testing + codebase audit of 82 sidebar items
> **Excludes:** Mobile PWA, Go-to-Market Readiness, Test Coverage (handled separately)

---

## PROMPT 1: Fix Board/Kanban Status Mapping (P0 — ½ day)

```
Fix the Kanban board view on the Projects page. Currently when switching to Board view 
(/projects?view=board), ALL columns show "No projects" (0 in each column) despite 70 
projects existing in the table view (37 active, 22 critical).

ROOT CAUSE: The board columns use internal status names (NOT STARTED, IN DISCOVERY, 
ACTIVE, ON HOLD) but Jira-synced projects use Jira statuses (IN PROGRESS, BACKLOG, 
DONE, ON HOLD). The mapping between Jira statuses and board columns is broken.

FILES TO EDIT:
- /frontend/src/components/projects/KanbanBoardView.tsx (29KB)
- /frontend/src/pages/ProjectsPage.tsx

FIX:
1. In KanbanBoardView.tsx, find where projects are filtered into columns
2. Add a status mapping function that maps Jira statuses to board columns:
   - "In Progress" / "IN PROGRESS" / "IN_PROGRESS" → "ACTIVE" column
   - "Backlog" / "BACKLOG" / "To Do" → "NOT STARTED" column  
   - "Done" / "DONE" / "Closed" → "COMPLETED" column (add this column if missing)
   - "On Hold" / "ON HOLD" / "ON_HOLD" → "ON HOLD" column
   - "In Discovery" → "IN DISCOVERY" column
3. The mapping should be case-insensitive
4. Also check if the board is reading from a different API endpoint than the table — 
   both should use the same project list
5. After fix, verify all 70 projects appear distributed across the correct columns

TEST: Switch between Table and Board views — project counts should match.
```

---

## PROMPT 2: Fix Dashboard & Executive Summary "Active Projects: 0" Bug (P1 — ½ day)

```
Fix the KPI cards on Dashboard (/) and Executive Summary (/reports/executive-summary) 
that show "Active Projects: 0" and "0 active" despite the Projects page (/projects) 
correctly showing 37 active projects.

The Projects page KPI bar correctly shows: Total 70, Active 37, On Hold 1, Critical 22.
But Dashboard shows: Active Projects 0.
And Executive Summary shows: 70 Total Projects, 0 active.

ROOT CAUSE: The Dashboard and Executive Summary likely use a different API endpoint or 
a different status filter than the Projects page.

FILES TO CHECK:
- /frontend/src/pages/DashboardPage.tsx — find the KPI widget that shows "Active Projects"
- /frontend/src/pages/reports/ExecSummaryPage.tsx — find the "0 active" KPI
- Compare the API call / query filter with ProjectsPage.tsx

FIX:
1. Find what API endpoint Dashboard uses for "Active Projects" count
2. Compare with /projects page — the Projects page correctly counts status="In Progress" 
   as active
3. The Dashboard widget likely filters by status="ACTIVE" (literal) instead of 
   "In Progress" or "IN_PROGRESS" — same enum mismatch as the Board bug
4. Apply the same status mapping normalization
5. Fix in both DashboardPage.tsx AND ExecSummaryPage.tsx

TEST: Dashboard and Exec Summary should both show "Active Projects: 37" matching the 
Projects page.
```

---

## PROMPT 3: Configure AI Backend — Ask AI + AI Content Studio (P1 — Config)

```
The Ask AI (/nlp) page and AI Content Studio (/ai-content-studio) are blocked because 
no AI key is configured. When querying Ask AI, it returns "UNKNOWN • 0%" error. AI 
Content Studio shows "No AI key configured."

TASKS:
1. Navigate to Settings → find the AI key configuration 
   (check /settings/org or the UserAiConfigController endpoint)
2. The app supports per-user AI keys with org-level priority (added in v28.8 commit)
3. Set an org-level OpenAI/Anthropic API key via the Settings UI or directly via:
   - POST /api/user-ai-config with the API key
   - Or check if there's an org-level config in OrgSettingsController
4. After configuring, test:
   - Ask AI: Type "Which projects are at risk?" — should return real portfolio data
   - AI Content Studio: Select a project, choose "Status Email", click Generate Draft
   - AI Scope Recommender in Sprint Planner should also activate

FILES RELEVANT:
- /backend/src/main/java/com/portfolioplanner/controller/UserAiConfigController.java
- /backend/src/main/java/com/portfolioplanner/controller/AiContentController.java
- /frontend/src/pages/settings/UserAiSettingsPage.tsx
- /frontend/src/pages/NlpLandingPage.tsx
- /frontend/src/pages/AiContentStudioPage.tsx

If the backend /api/ai/generate endpoint isn't fully implemented, complete it:
- It should accept { type: "status_email"|"retro"|"risk_brief"|"meeting_actions", 
  projectId, tone }
- Route to the configured AI provider (OpenAI/Anthropic)
- Return generated content
```

---

## PROMPT 4: Add @PreAuthorize to All 92 Controllers (P1 — 1 sprint)

```
Add server-side authorization to all 92 Spring Boot controllers. Currently the app has 
frontend-only RBAC (ProtectedRoute + canAccess()) but NO server-side @PreAuthorize 
annotations on any controller endpoint. This is a critical security gap.

APPROACH:
1. Create a role hierarchy: ADMIN > MANAGER > MEMBER > VIEWER
2. Add @PreAuthorize annotations to every controller method based on this mapping:

ADMIN-only endpoints (require @PreAuthorize("hasRole('ADMIN')")):
- UserManagementController (all methods)
- OrgSettingsController (write methods)
- SsoConfigController (all methods)
- AuditLogController (all methods)
- WebhookConfigController (write methods)
- AutomationRuleController (write methods)
- RoleDefinitionController (write methods)

MANAGER+ endpoints (require @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")):
- ProjectController (create, update, delete)
- ProjectApprovalController (approve, reject)
- PodController (create, update, delete)
- ResourceController (create, update, delete)
- SprintController (create, update)
- CostRateController (write methods)
- BulkImportController (all methods)
- JiraController (sync, push operations)

MEMBER+ endpoints (require @PreAuthorize("hasAnyRole('ADMIN','MANAGER','MEMBER')")):
- ProjectController (read)
- All report controllers (read)
- ResourceController (read)
- CommentController (create own)
- UserFeedbackController (create own)

VIEWER endpoints (@PreAuthorize("isAuthenticated()")):
- DashboardController, ReportController (read-only)
- All GET endpoints on non-sensitive controllers

3. Add @EnableMethodSecurity to the Spring Security configuration class
4. Ensure existing JWT token includes role claims
5. Test that unauthorized access returns 403, not 500

FILES:
- All 92 files in /backend/src/main/java/com/portfolioplanner/controller/
- /backend/src/main/java/com/portfolioplanner/config/SecurityConfig.java (or similar)
```

---

## PROMPT 5: Populate Cost Rates for Engineering Economics (P1 — 1 hour)

```
The Engineering Economics page (/engineering-economics) shows $0 for all KPIs because 
Cost Rates haven't been configured. The Performance page already shows $1.7M YTD value 
and hourly rates ($50/h), so some rate data exists.

TASKS:
1. Navigate to Settings → Cost Rates (/settings/cost-rates)
2. Configure rates for each role:
   - Developer (Onshore): $85/hr
   - Developer (Offshore/India): $50/hr  
   - QA (Onshore): $75/hr
   - QA (Offshore): $45/hr
   - BSA: $90/hr
   - Tech Lead: $110/hr
   - Scrum Master: $95/hr
3. After setting rates, navigate to Engineering Economics and verify:
   - Total Spend (YTD) should calculate from (rate × hours logged per resource)
   - Monthly Burn Rate should show current month
   - CapEx / OpEx split should populate based on sprint classification
4. Also check Budget & CapEx page for data population

If the CostRatesPage doesn't have a bulk import option, use the API:
- POST /api/cost-rates with rate card data
```

---

## PROMPT 6: Assign Resources to Resource Pools (P1 — 30 min)

```
The Resource Pools page (/resource-pools) shows 5 pools all at 0% utilization with 
"BELOW TARGET" for every pool. The pools exist (Developer target 30, QA 15, BSA 10, 
SM 8, Tech Lead 6) but no resources are assigned.

Meanwhile, the Resources page shows 79 active resources with roles already tagged 
(45 Developers, 17 QA, 10 BSA, 7 Tech Lead).

TASKS:
1. The pool assignment likely needs to map resources to pools based on their role
2. Check if there's an auto-assign feature or if it's manual
3. If manual: navigate to each pool and add the matching resources
4. If API-based: POST /api/resource-pools/{poolId}/assign with resource IDs
5. After assignment, verify:
   - Developer Pool: 45 assigned / target 30 (150% — over target!)
   - QA Pool: 17 / 15 (113%)
   - BSA Pool: 10 / 10 (100%)
   - Tech Lead Pool: 7 / 6 (117%)
   - SM Pool: check how many SMs exist

This will also populate the Supply vs Demand page and Hiring Forecast.
```

---

## PROMPT 7: Tag Skills in Skills Matrix (P1 — 1 hour)

```
The Skills Matrix (/reports/skills-matrix) shows all 79 real people with Jira avatars 
but "No skills tagged" for everyone. The page has a + button per resource to add skills.

TASKS:
1. Check if there's a bulk import option (the page has Export PDF and Export CSV — 
   is there an Import?)
2. If not, check the Skills Matrix (New) page — it might have a newer interface with 
   bulk capabilities
3. Create a standard skill taxonomy and tag at minimum the top 20 resources:

Skill categories to create:
- Languages: Java, TypeScript, Python, SQL
- Frameworks: Spring Boot, React, Angular
- Databases: PostgreSQL, Oracle, MongoDB
- Cloud: AWS, Azure, GCP
- Tools: Jira, Git, Docker, Kubernetes
- Domain: Genomics, Healthcare, Bioinformatics

4. Use the ResourceSkillController API if the UI is too slow:
   POST /api/resource-skills with { resourceId, skillId, proficiency: 1-10 }

5. After tagging, verify:
   - Skills Matrix shows skill badges per resource
   - Resource Intelligence → Top 6 Skills chart populates
   - Hiring Forecast may update based on skill gaps
```

---

## PROMPT 8: Create Demand Requests for Supply/Demand (P1 — 30 min)

```
The Supply vs Demand page (/supply-demand) shows "No gap analysis data available. 
Create demand requests to see supply/demand gaps."

TASKS:
1. Find where demand requests are created — likely via DemandRequestController
2. Create demand requests for each active project that needs resources:
   - Map at least the top 10 projects to their resource needs
   - Example: Portal V2 Phase 2 needs 5 Developers, 2 QA for Apr-Jul 2026
3. After creating demands:
   - Supply vs Demand should show gap analysis
   - Demand Forecast chart should update
   - Hiring Forecast table should show deficit hours if demand > supply

API: POST /api/demands with { projectId, role, startDate, endDate, fte }
```

---

## PROMPT 9: Set Up OKRs in Objectives (P2 — 30 min)

```
The Objectives page (/objectives) shows "No objectives yet." Create organizational 
OKRs to populate this page and the Executive Summary's OKR Completion widget.

Create these OKRs:
1. Objective: "Accelerate Clinical Test Delivery"
   - KR1: Reduce average project duration from 3.9m to 3.0m
   - KR2: Achieve 90% on-time delivery rate
   - KR3: Zero P0 projects past target date

2. Objective: "Optimize Engineering Investment"
   - KR1: CapEx ratio > 70% of total engineering spend
   - KR2: Reduce support queue from 19 to <10 open items
   - KR3: All PODs within ±15% of capacity target

3. Objective: "Platform Modernization"
   - KR1: Migrate 100% of projects to PP as source of truth
   - KR2: Achieve ELITE DORA metrics across all 4 dimensions
   - KR3: Zero mock data pages (DONE ✅)

Link relevant projects to each objective.
```

---

## PROMPT 10: Log Initial Risks in Risk Register (P2 — 30 min)

```
The Risk Register (/risk-register) and Risk Heatmap (/reports/risk-heatmap) are empty.
Log the known risks discovered during the v30.0 analysis:

1. Risk: "AI Backend Not Connected" | Likelihood: High | Impact: Medium
   Mitigation: Configure org-level AI key in Settings
   
2. Risk: "Board View Status Mapping Bug" | Likelihood: Certain | Impact: High
   Mitigation: Fix KanbanBoardView enum mapping
   
3. Risk: "No Server-Side Authorization" | Likelihood: Medium | Impact: Critical
   Mitigation: Add @PreAuthorize to 92 controllers
   
4. Risk: "Single Point of Failure — No Horizontal Scaling" | Likelihood: Low | Impact: High
   Mitigation: Plan Kubernetes migration
   
5. Risk: "38.7% Change Failure Rate" | Likelihood: High | Impact: Medium
   Mitigation: Increase test coverage, add E2E tests

After logging, verify:
- Risk Register shows 5 items with tabs (Risks, Issues, Decisions)
- Risk Heatmap populates the Likelihood × Impact grid
- Dashboard AI Insights may update
```

---

## PROMPT 11: Create First Automation Rule (P2 — 15 min)

```
The Automation Engine (/automation-engine) shows 0 rules. Create the first automation 
rule to demonstrate the feature.

Create this rule:
- Name: "Alert on Overdue Projects"
- Trigger: Project target date < today AND status != "Done"
- Action: Send notification to project owner + portfolio manager
- Schedule: Nightly at 6am

Also create:
- Name: "Auto-flag P0 Projects Past 80% Duration"
- Trigger: Project priority = Highest AND elapsed > 80% of duration
- Action: Add "AT_RISK" flag to project, notify in Inbox

Use the AutomationRuleController API if needed:
POST /api/automation-rules with { name, trigger, action, schedule, enabled: true }

Test using the ▶ test-fire button to simulate execution.
```

---

# NAVIGATION REDESIGN

## Current State: 82 sidebar items across 8 sections — CHAOS

The navRegistry.ts defines 82 items. Live testing confirmed 53 visible at once. Here are the problems:

### CONFIRMED DUPLICATES (remove from sidebar — keep in hub tabs only):

| Sidebar Item | Already Accessible Via | Action |
|---|---|---|
| DORA Metrics | Engineering Hub → DORA tab | Remove from sidebar |
| Engineering Intelligence | Engineering Hub → tab | Remove from sidebar |
| Delivery Predictability | Engineering Hub → tab | Remove from sidebar |
| Project Health | Portfolio Health → Project Health tab | Remove from sidebar |
| Resource Bookings | Resources → Bookings tab | Remove from sidebar |
| Resource Intelligence | Performance → Resource Intelligence tab | Remove from sidebar |
| Overrides | Resources → Overrides tab AND Capacity → Overrides tab | Remove from sidebar (keep in hubs) |
| Skills Matrix (old) | Duplicate of Skills Matrix (New) | Remove old, rename new to "Skills Matrix" |

### PAGES TO MERGE:

| Pages | Merge Into | Reason |
|---|---|---|
| Portfolio Timeline + Advanced Timeline | Single "Timeline" page with view toggle | Same concept, two entries |
| Gantt Dependencies + Dependency Map | "Dependencies" page with Gantt/Map/DAG tabs | Overlapping dependency views |
| Workload Chart + Capacity Hub | "Capacity" hub with Workload as a tab | Workload is a view of capacity |
| Hiring Forecast + Demand Forecast | "Workforce Planning" page with both views | Related forecasting |

---

## PROMPT 12: Navigation Redesign — Restructure Sidebar

```
Restructure the Portfolio Planner sidebar from 82 items / 8 sections down to ~40 items / 
6 sections. The goal: reduce cognitive overload while ensuring ZERO pages are lost or 
unlinked.

CURRENT FILE: /frontend/src/utils/navRegistry.ts
This file defines all sidebar navigation items. Edit this file to implement the new 
structure below.

=== NEW NAVIGATION STRUCTURE (6 sections, ~40 items) ===

SECTION 1: HOME (4 items)
├── Dashboard          → /                          [KEEP]
├── Inbox              → /inbox                     [KEEP]
├── Ask AI             → /nlp                       [KEEP]
└── AI Content Studio  → /ai-content-studio         [KEEP]

SECTION 2: PORTFOLIO (8 items)
├── Projects           → /projects                  [KEEP - has Table/Board/Timeline views]
├── Portfolio Health    → /portfolio/health          [KEEP - has Project Health + Status Updates tabs]
├── Objectives         → /objectives                [KEEP]
├── Risk & Issues      → /risk-register             [KEEP - rename from "Risk Register"]
├── Risk Heatmap       → /reports/risk-heatmap      [KEEP]
├── Dependencies       → /reports/dependency-map    [KEEP - merge Gantt Dependencies into tabs here]
├── Timeline           → /portfolio/timeline        [KEEP - merge Advanced Timeline into this]
└── Executive Summary  → /reports/executive-summary [KEEP]

SECTION 3: TEAMS & RESOURCES (8 items)
├── People             → /people/resources          [RENAME from "Resources" - has Directory/Availability/Bookings/Overrides tabs]
├── Core Teams         → /teams?type=core           [KEEP]
├── Project Teams      → /teams?type=project        [KEEP]
├── Capacity           → /people/capacity           [KEEP - merge Workload Chart as tab here]
├── Performance        → /people/performance        [KEEP - has Resource Performance + Resource Intelligence tabs]
├── Skills Matrix      → /skills-matrix             [KEEP - use the NEW version, remove old]
├── Team Pulse         → /reports/team-pulse        [KEEP]
└── Workforce Planning → /demand-forecast           [RENAME - merge Hiring Forecast + Supply vs Demand as tabs]

SECTION 4: DELIVERY & SPRINTS (8 items)
├── PODs               → /pods                      [KEEP]
├── Sprint Planner     → /sprint-planner            [KEEP]
├── Sprint Backlog     → /sprint-backlog            [KEEP]
├── Sprint Retro       → /reports/sprint-retro      [KEEP]
├── Releases           → /delivery/releases         [KEEP]
├── Calendar           → /calendar                  [RENAME from "Strategic Calendar"]
├── Engineering Hub    → /engineering-hub            [KEEP - has DORA/Intelligence/Predictability tabs]
└── Ideas Board        → /ideas                     [KEEP]

SECTION 5: FINANCE (4 items)
├── Budget & CapEx     → /reports/budget-capex      [KEEP]
├── Engineering Economics → /engineering-economics   [KEEP]
├── ROI Calculator     → /reports/roi-calculator    [KEEP]
└── Scenario Planning  → /scenario-planning         [KEEP]

SECTION 6: ADMIN (6 items)
├── Settings           → /settings/org              [KEEP - has General/Users/Integrations/Notifications/System/Approvals tabs]
├── Jira Dashboard     → /delivery/jira             [MOVE from JIRA section - has POD Dashboard/Actuals/Support Queue/Worklog tabs]
├── Approval Queue     → /approvals                 [KEEP]
├── Automation Engine  → /automation-engine          [KEEP]
├── Smart Notifications→ /smart-notifications       [KEEP]
└── Smart Insights     → /smart-insights            [MOVE from DELIVERY]

=== ITEMS REMOVED FROM SIDEBAR (accessible via hub tabs) ===
These pages are NOT deleted — they remain accessible via their parent hub's tab navigation:

- "Project Health" → accessible via Portfolio Health → "Project Health" tab
- "Delivery Predictability" → accessible via Engineering Hub → tab
- "DORA Metrics" → accessible via Engineering Hub → tab  
- "Engineering Intelligence" → accessible via Engineering Hub → tab
- "Resource Intelligence" → accessible via Performance → tab
- "Resource Bookings" → accessible via People → "Bookings" tab
- "Overrides" → accessible via People → "Overrides" tab AND Capacity → "Overrides" tab
- "Skills Matrix (old)" → replaced by Skills Matrix (New), rename to just "Skills Matrix"
- "Resource Pools" → merge into Workforce Planning as a tab
- "Supply vs Demand" → merge into Workforce Planning as a tab
- "Hiring Forecast" → merge into Workforce Planning as a tab
- "Workload Chart" → merge into Capacity as a tab
- "Advanced Timeline" → merge into Timeline
- "Gantt Dependencies" → merge into Dependencies as a tab
- "Team Calendar" → accessible via Calendar page (add as tab view)
- "Sprint Calendar" → accessible via Calendar page (add as tab view)
- "Release Calendar" → merge into Releases page
- "Project Templates" → move to Settings or Scenario Tools
- "Jira Analytics" → merge into Jira Dashboard as a tab

=== REDIRECTS TO ADD ===
For every removed sidebar item, add a URL redirect so bookmarks don't break:
- /reports/delivery-predictability → /engineering-hub (with tab=predictability)
- /reports/dora-metrics → /engineering-hub (with tab=dora)
- /reports/workload-chart → /people/capacity (with tab=workload)
- /reports/hiring-forecast → /demand-forecast (with tab=hiring)
- /supply-demand → /demand-forecast (with tab=supply-demand)
- /resource-pools → /demand-forecast (with tab=pools)
- /reports/gantt-dependencies → /reports/dependency-map (with tab=gantt)

=== IMPLEMENTATION STEPS ===

Step 1: Edit /frontend/src/utils/navRegistry.ts
- Restructure the 82 items into the 6-section / ~40-item layout above
- Update section headers, ordering, and grouping

Step 2: Add tabs to hub pages that are absorbing standalone pages:
- Capacity Hub: add "Workload" tab (import WorkloadChartPage content)
- Demand Forecast: add "Supply vs Demand", "Hiring Forecast", "Resource Pools" tabs
- Dependency Map: add "Gantt View" tab (import GanttDependenciesPage content)
- Calendar: add "Team", "Sprint", "Release" tabs (import content from those pages)

Step 3: Add redirects in App.tsx for all removed routes

Step 4: Verify NO pages are orphaned — every page must be reachable via 
sidebar OR hub tab OR redirect

CRITICAL: Do NOT delete any page component files. Only reorganize the sidebar 
and add hub tabs. All routes must remain accessible.
```

---

## Summary Checklist

| # | Prompt | Priority | Effort | Category |
|---|--------|----------|--------|----------|
| 1 | Fix Board Kanban status mapping | P0 | ½ day | Bug fix |
| 2 | Fix Dashboard/Exec "Active: 0" | P1 | ½ day | Bug fix |
| 3 | Configure AI backend key | P1 | Config | Config |
| 4 | Add @PreAuthorize to 92 controllers | P1 | 1 sprint | Security |
| 5 | Populate Cost Rates | P1 | 1 hour | Data setup |
| 6 | Assign Resource Pools | P1 | 30 min | Data setup |
| 7 | Tag Skills in Matrix | P1 | 1 hour | Data setup |
| 8 | Create Demand Requests | P1 | 30 min | Data setup |
| 9 | Set up OKRs | P2 | 30 min | Data setup |
| 10 | Log initial Risks | P2 | 30 min | Data setup |
| 11 | Create Automation Rule | P2 | 15 min | Data setup |
| 12 | Navigation Redesign (82→40 items) | P1 | 2-3 days | UX overhaul |

**Total estimated effort: ~2 weeks (excluding Mobile PWA, GTM, Test Coverage)**
