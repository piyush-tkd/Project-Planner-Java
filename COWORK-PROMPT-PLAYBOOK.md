# Portfolio Planner — Cowork Prompt Playbook

## How to Use This File

Each prompt below is a **self-contained Cowork session**. Copy-paste one prompt at a time. Do NOT combine prompts. Wait for one to complete and verify before starting the next.

**The golden rule: One prompt = one change = one verification.**

---

## The Anti-Breakage System

Every prompt in this playbook follows a 4-part structure that prevents Cowork from going rogue:

1. **SCOPE LOCK** — Tells Cowork exactly which files it CAN touch and which it CANNOT
2. **TASK** — The single thing to do (never more than one feature per prompt)
3. **VALIDATION** — How to prove it worked without breaking anything
4. **STOP CONDITION** — Tells Cowork to stop and report back, not keep going

---

## Before You Start: Set Up Your CLAUDE.md

Put this at the top of your project's `CLAUDE.md` file. This is the persistent instruction set that every Cowork session will read:

```markdown
# CLAUDE.md — Portfolio Planner Working Rules

## CRITICAL RULES (never violate these)

1. **ONE CHANGE PER SESSION.** Do not add features, refactor code, or "improve" things beyond what was explicitly asked. If you see something you want to fix — DON'T. Note it and move on.

2. **NEVER modify these files/folders without explicit permission:**
   - Any Flyway migration V1–V79 (src/main/resources/db/migration/V1* through V79*)
   - SecurityConfig.java (unless the task is specifically about auth)
   - App.tsx or main routing file (unless the task is specifically about routing)
   - theme.ts (unless the task is specifically about theming)
   - Any file in node_modules/ or target/

3. **NEVER delete or rename:**
   - Any existing REST endpoint URL
   - Any existing React route/path
   - Any existing database table or column
   - Any sidebar navigation item
   - Any existing component that is imported elsewhere

4. **Before writing ANY code:**
   - Read the files you plan to modify
   - Identify all imports/usages of functions you'll change (grep first)
   - List the files you will touch in your response BEFORE making changes

5. **After writing code:**
   - Run: mvn clean compile (backend) — report result
   - Run: npm run build (frontend) — report result
   - Run: npm run lint (frontend) — report result
   - If ANY of these fail, fix before marking complete

6. **Testing:**
   - If you create a new service, write a JUnit test
   - If you create a new component, verify it renders without errors
   - If you modify an existing file, verify the page that uses it still loads

7. **Git discipline:**
   - Work on the branch specified in the prompt
   - Commit with the message format specified in the prompt
   - Do NOT commit if the build is failing

## Tech Stack
- Frontend: React 18 + TypeScript + Mantine v7 + Vite
- Backend: Spring Boot 3.4 + Java 21 + Maven
- Database: PostgreSQL + pgvector
- Existing migrations: V1 through V79 (NEVER TOUCH)
- Current entities: 78+ across 8 domains
- Current controllers: 50+ (NEVER change their URLs)
```

---

## Phase 0: Design System Foundation

### Prompt 0.1 — Install Core Dependencies

```
SCOPE: Only modify package.json and package-lock.json. Do NOT modify any other files.

TASK: Install these npm packages as production dependencies:
- cmdk
- framer-motion
- recharts

Run: npm install cmdk framer-motion recharts

VALIDATION:
1. Run: npm run build — must pass with zero errors
2. Run: npm run lint — must pass
3. Verify package.json has the 3 new dependencies listed
4. Do NOT import these packages anywhere yet. Just install them.

STOP: Report the installed versions and build result. Do nothing else.
```

### Prompt 0.2 — Create PageHeader Component

```
SCOPE: Create ONE new file only: src/components/ui/PageHeader.tsx
Do NOT modify any existing files. Do NOT apply this component to any pages yet.

TASK: Create a reusable PageHeader component with these props:
- title: string (required)
- subtitle?: string (optional)
- actions?: React.ReactNode (optional, renders right-aligned)

Use Mantine components: Title, Text, Group, Stack.
Match the existing app's styling (look at any page that has a heading to match font sizes).
Export as default.

VALIDATION:
1. Run: npm run build — must pass
2. Run: npm run lint — must pass
3. Show me the complete file contents

STOP: Do not apply this to any pages. Just create the component file and verify it compiles.
```

### Prompt 0.3 — Create EmptyState Component

```
SCOPE: Create ONE new file only: src/components/ui/EmptyState.tsx
Do NOT modify any existing files.

TASK: Create a reusable EmptyState component with these props:
- icon: React.ComponentType (a Tabler icon component)
- title: string
- description: string
- actionLabel?: string
- onAction?: () => void

Render: centered layout with the icon (48px, muted color), title (h3), description (muted text), and a Mantine Button if actionLabel is provided.

Use Mantine: Stack, Title, Text, Button, Center, ThemeIcon.

VALIDATION:
1. Run: npm run build — must pass
2. Run: npm run lint — must pass
3. Show me the complete file contents

STOP: Do not apply this to any pages yet.
```

### Prompt 0.4 — Create StatusBadge Component

```
SCOPE: Create ONE new file only: src/components/ui/StatusBadge.tsx
Do NOT modify any existing files.

TASK: Create a StatusBadge component with these props:
- status: 'ACTIVE' | 'AT_RISK' | 'BLOCKED' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'IN_DISCOVERY' | 'PAUSED'
- size?: 'sm' | 'md' (default 'md')

Map each status to a color:
- ACTIVE → green (teal.6)
- AT_RISK → yellow (yellow.7)
- BLOCKED → red (red.6)
- ON_HOLD → gray (gray.6)
- COMPLETED → blue (blue.6)
- CANCELLED → gray (gray.5)
- IN_DISCOVERY → violet (violet.6)
- PAUSED → orange (orange.6)

Use Mantine Badge with a colored dot (small circle) as leftSection.

VALIDATION:
1. npm run build — must pass
2. npm run lint — must pass
3. Show me the file

STOP: Do not apply anywhere yet.
```

### Prompt 0.5 — Create KpiCard Component

```
SCOPE: Create ONE new file only: src/components/ui/KpiCard.tsx
Do NOT modify any existing files.

TASK: Create a KpiCard component with these props:
- label: string
- value: string | number
- trend?: 'up' | 'down' | 'flat'
- trendValue?: string (e.g., "+2.3%")
- color?: string (Mantine color, default 'blue')

Render: Mantine Paper with padding, label on top (muted, small), value large and bold below, trend arrow + trendValue on the right side. Use IconTrendingUp / IconTrendingDown / IconMinus from @tabler/icons-react for the trend arrow.

Do NOT add sparklines yet (Recharts integration comes later).

VALIDATION:
1. npm run build — must pass
2. npm run lint — must pass
3. Show me the file

STOP: Do not apply anywhere yet.
```

### Prompt 0.6 — Create AvatarStack Component

```
SCOPE: Create ONE new file only: src/components/ui/AvatarStack.tsx
Do NOT modify any existing files.

TASK: Create an AvatarStack component with these props:
- users: Array<{ name: string; avatar?: string }>
- max?: number (default 3)

Render: Mantine Avatar.Group with overlapping circles. Show initials (first letter of first + last name) if no avatar URL. If users.length > max, show a "+N" avatar at the end. Add Mantine Tooltip on hover showing full name.

VALIDATION:
1. npm run build — must pass
2. npm run lint — must pass
3. Show me the file

STOP: Do not apply anywhere yet.
```

### Prompt 0.7 — Create Component Index

```
SCOPE: Create ONE new file: src/components/ui/index.ts
Do NOT modify any existing files.

TASK: Create a barrel export file that re-exports all 5 components:
- PageHeader
- EmptyState
- StatusBadge
- KpiCard
- AvatarStack

VALIDATION:
1. npm run build — must pass
2. Verify all 5 components are importable via: import { PageHeader, EmptyState, StatusBadge, KpiCard, AvatarStack } from '@/components/ui'

STOP: Report result. Design system foundation is complete.
```

### Prompt 0.8 — Jira Avatar Sync (resource.avatar_url)

```
SCOPE:
- CREATE: backend/src/main/resources/db/migration/V81__resource_avatar_url.sql
- MODIFY: Resource entity (add avatarUrl field)
- MODIFY: ResourceResponse DTO (add avatarUrl field)
- MODIFY: The Jira user sync service (find by grepping for "jiraAccountId" or "JiraUserSync")
- DO NOT modify any frontend files
- DO NOT modify any other migration

TASK: Store Jira avatar URLs on the resource record so AvatarStack can show real profile photos.

Steps:
1. Create V81 migration: ALTER TABLE resource ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512)
2. Add avatarUrl field to the Resource JPA entity
3. Add avatarUrl to ResourceResponse DTO
4. In the Jira user sync flow, when a Jira user is matched to a resource, read avatarUrls["48x48"]
   from the Jira API response and write it to resource.avatar_url
5. Expose avatarUrl in the existing GET /api/resources endpoint (already returns ResourceResponse)

IMPORTANT: Jira's avatarUrls map has keys "16x16", "24x24", "32x32", "48x48". Always use "48x48".
The column is nullable — resources without a Jira match will have avatar_url = NULL.

VALIDATION:
1. mvn clean compile — must pass
2. Migration V81 runs on startup without error
3. After a Jira sync, SELECT name, avatar_url FROM resource WHERE avatar_url IS NOT NULL — verify rows populated
4. GET /api/resources — verify avatarUrl appears in the response JSON

STOP: Report how many resources got avatar URLs after sync. Do not modify frontend yet.
```

---

## Phase 1: v13 Foundation & Security

### Prompt 1.1 — Feature Flags Migration (V82) ✅ Done

```
SCOPE:
- CREATE: src/main/resources/db/migration/V82__feature_flags_org_settings.sql
- MODIFY: OrgSettings entity (add features JSONB field)
- MODIFY: OrgSettingsController (add features to DTO + all handlers)
- DO NOT touch any controller, frontend file, or other migration

NOTE: V80 and V81 were already applied. V82 is the correct next migration.
Implementation uses a single JSONB column `features` (Map<String, Boolean>) instead of
5 separate boolean columns — more flexible for future flag additions.

Flags: ai, okr, risk, ideas, financials — all default TRUE.

VALIDATION:
1. mvn clean compile — must pass
2. Start the app and verify migration V82 runs without error
3. GET /api/org/settings — verify `features` object appears in the response JSON
4. Verify the app still loads (no startup errors)

STOP: Report migration result. Do NOT add backend enforcement or frontend changes yet.
```

### Prompt 1.2 — Feature Flag Backend Enforcement

```
SCOPE:
- MODIFY: Spring Security config or create a new filter/interceptor
- CREATE: A FeatureFlagFilter or FeatureFlagInterceptor class
- DO NOT touch any frontend files
- DO NOT touch migration files

PREREQUISITE: V82 migration must have run successfully (Prompt 1.1)

TASK: Create backend enforcement for feature flags.
When ai_enabled = false, all /api/nlp/* endpoints should return 403 Forbidden.
When financial_enabled = false, all /api/budget/* and /api/capex/* endpoints should return 403.

Implementation approach:
1. Read the current org_settings from DB (cache with short TTL)
2. Create a Spring interceptor or filter that checks the flag before allowing the request
3. Map: ai_enabled → /api/nlp/*, financial_enabled → /api/budget/*, /api/capex/*

IMPORTANT: First, grep for all controller classes to understand the URL patterns.
List the actual @RequestMapping values before writing the filter.

VALIDATION:
1. mvn clean compile — must pass
2. mvn test — all existing tests must still pass
3. Write a test: when ai_enabled=false, GET /api/nlp/query returns 403
4. Write a test: when ai_enabled=true, GET /api/nlp/query returns 200 (or normal response)
5. Start the app, verify all pages still load normally (flags are TRUE by default)

STOP: Report test results. Do not touch frontend.
```

### Prompt 1.3 — Feature Flags Frontend Wiring

```
SCOPE:
- MODIFY: The Admin Settings Workspace tab component (find it by grepping for "Feature Flags" or "ai_enabled" or the Workspace tab)
- DO NOT modify any other page
- DO NOT modify backend code

PREREQUISITE: Prompts 1.1 and 1.2 must be complete.

TASK: Wire the existing feature flag toggles in Admin Settings → Workspace tab to save via API.

Steps:
1. First, READ the current Workspace tab component to understand how flags are currently managed
2. Find the API endpoint for saving org settings (grep for OrgSettingsController or similar)
3. On toggle change, call the API to persist the flag value
4. On page load, fetch current flag values from the API
5. Show a success toast on save

IMPORTANT: The toggles already exist in the UI. Do NOT redesign them. Just wire them to the backend.

VALIDATION:
1. npm run build — must pass
2. Open Admin Settings → Workspace tab
3. Toggle "AI Features" off → refresh page → verify it's still off (persisted)
4. Toggle it back on → refresh → verify it's on
5. Navigate to Ask AI page — should still work (flag is on)
6. Check all other pages in the sidebar still load

STOP: Report which file you modified and the test results.
```

### Prompt 1.4 — Empty States (Batch 1: Delivery Group)

```
SCOPE:
- MODIFY: Only pages in the Delivery nav group:
  - Releases page component
  - Release Notes page component
  - Jira Actuals page component
  - Support Queue page component
  - Worklog page component
- USE: The EmptyState component from src/components/ui/
- DO NOT modify any other pages
- DO NOT modify any backend code

TASK: Add graceful empty states to the 5 Delivery pages that currently render blank when no data is available.

For each page:
1. READ the current component file first
2. Find where data is loaded (useEffect, useQuery, or similar)
3. Add a loading state (Mantine Skeleton or loading spinner)
4. Add an empty state using the EmptyState component when data array is empty or API returns no results
5. The empty state should have an appropriate icon, title, description, and CTA

Empty state copy:
- Releases: icon=IconRocket, "No releases configured", "Create release milestones to track delivery timelines", CTA="Create Release"
- Release Notes: icon=IconNotes, "No release notes yet", "Release notes auto-generate from Jira fix versions when releases are configured"
- Jira Actuals: icon=IconBrandJira, "Jira actuals sync from sprint data", "Configure Jira boards in Admin Settings to see actual vs planned delivery", CTA="Go to Integrations"
- Support Queue: icon=IconHeadset, "No support boards configured", "Configure Jira support boards in Admin Settings to track ticket health", CTA="Go to Integrations"
- Worklog: icon=IconClock, "Worklog data syncs from Jira", "Time tracking entries appear here once Jira integration is active"

IMPORTANT: Do NOT change the page layout, routing, or data fetching logic. Only ADD the empty state as a conditional render when data is empty/null.

VALIDATION:
1. npm run build — must pass
2. npm run lint — must pass
3. Navigate to each of the 5 pages — verify they show the empty state (not a blank screen)
4. Navigate to ALL other pages in the sidebar — verify nothing else changed
5. Specifically check: Dashboard, Projects, Capacity Hub, Ask AI — must be unaffected

STOP: Report which 5 files you modified and screenshot/describe each empty state.
```

### Prompt 1.5 — Empty States (Batch 2: Engineering Group)

```
SCOPE:
- MODIFY: Only pages in the Engineering nav group:
  - DORA Metrics page component
  - Delivery Predictability page component
  - Jira Analytics page component
  - Dashboard Builder page component (if it has an empty state issue)
- USE: The EmptyState component from src/components/ui/
- DO NOT modify any other pages

TASK: Same pattern as Prompt 1.4 — add empty states to Engineering group pages.

Empty state copy:
- DORA Metrics: icon=IconChartBar, "Connect Jira to see DORA metrics", "Deployment frequency, lead time, MTTR, and change failure rate populate from Jira and Git data", CTA="Go to Integrations"
- Delivery Predictability: icon=IconTrendingUp, "Prediction models need sprint history", "After 3+ sprints of data, delivery predictions will forecast completion dates automatically"
- Jira Analytics: icon=IconChartDots, "Jira analytics need board data", "Sprint velocity, cycle time, and throughput analytics populate once Jira boards are synced", CTA="Go to Integrations"
- Dashboard Builder: icon=IconLayoutDashboard, "Create your first custom dashboard", "Build personalized views combining any metrics across portfolio, delivery, and capacity", CTA="Create Dashboard"

VALIDATION:
1. npm run build — must pass
2. Navigate to each of the 4 pages — verify empty states render
3. Navigate to ALL Delivery group pages (from Prompt 1.4) — verify they still show their empty states
4. Check Dashboard, Projects, Capacity — unaffected

STOP: Report which files modified.
```

### Prompt 1.6 — Empty States (Batch 3: Portfolio + Simulations)

```
SCOPE:
- MODIFY: Only these page components:
  - Project Health
  - Portfolio Timeline
  - Project Signals
  - Dependency Map
  - Gantt & Dependencies
  - Scenario Simulator
  - Smart Notifications
  - Jira Portfolio Sync
- USE: EmptyState component
- DO NOT touch any other files

TASK: Add empty states to the remaining 8 pages. Same pattern.

Empty state copy:
- Project Health: icon=IconHeartbeat, "Project health scores aggregate signals", "Health scores combine timeline adherence, budget status, risk count, and velocity trends"
- Portfolio Timeline: icon=IconTimeline, "Projects with dates appear on the timeline", "Add start and end dates to your projects to see the portfolio timeline view"
- Project Signals: icon=IconAlertTriangle, "Project signals surface hidden risks", "Signals detect deadline gaps, owner overload, and POD split conflicts automatically"
- Dependency Map: icon=IconShare, "No dependencies mapped yet", "Link projects with dependencies to visualize the critical path and cross-team impacts"
- Gantt & Dependencies: icon=IconChartGantt, "Gantt chart needs project dates", "Projects with start dates, end dates, and dependencies render as an interactive Gantt chart"
- Scenario Simulator: icon=IconTestPipe, "Create what-if scenarios", "Simulate project changes without affecting live data — test date shifts, resource moves, and priority changes", CTA="Create Scenario"
- Smart Notifications: icon=IconBell, "Configure alert rules", "Set up proactive notifications for budget overruns, deadline risks, and capacity warnings", CTA="Configure Alerts"
- Jira Portfolio Sync: icon=IconRefresh, "Jira sync status", "View sync health, last sync time, and data flow between Jira and Portfolio Planner", CTA="Go to Integrations"

VALIDATION:
1. npm run build — must pass
2. Navigate to all 8 pages — verify empty states
3. Navigate to Delivery group pages — still have their empty states
4. Navigate to Engineering group pages — still have their empty states
5. Dashboard, Projects, Capacity, Ask AI — all unaffected

STOP: Report. All 20 blank pages should now have empty states.
```

### Prompt 1.7 — Empty States (Batch 4: People Group)

```
SCOPE:
- MODIFY: Only these page components:
  - Bookings
  - Resource Performance
  - Resource Intelligence
- USE: EmptyState component
- DO NOT touch any other files

TASK: Add empty states to the last 3 pages.

- Bookings: icon=IconCalendarEvent, "Resource bookings populate from allocations", "Bookings are generated from project assignments and temporary overrides"
- Resource Performance: icon=IconChartArcs, "Performance data needs Jira velocity", "Individual performance metrics populate from sprint velocity and utilization data"
- Resource Intelligence: icon=IconBrain, "AI allocation suggestions coming soon", "Resource Intelligence uses skills, availability, and project needs to suggest optimal assignments"

VALIDATION:
1. npm run build — must pass
2. Navigate to ALL 37 routes in the sidebar one by one. Every single page must either show real data OR a graceful empty state. Zero blank screens.
3. Report any page that still shows blank

STOP: Report the full 37-page verification result.
```

### Prompt 1.8 — Command Palette (Cmd+K)

```
SCOPE:
- CREATE: src/components/ui/CommandPalette.tsx
- MODIFY: The root App layout component (to mount the palette globally) — find it by looking for the component that renders the sidebar + main content area
- DO NOT modify any page components
- DO NOT modify any backend code

TASK: Add a global command palette using the cmdk library.

Steps:
1. READ the app's root layout to understand where to mount a global component
2. Create CommandPalette.tsx using cmdk's Command component
3. Register all sidebar navigation items as searchable (use the same labels and routes as the sidebar)
4. Add keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows)
5. Group items by nav section: Home, Portfolio, People, Calendar, Delivery, Engineering, Simulations, Admin
6. On select: navigate to the route using React Router's useNavigate
7. Also connect it to the existing "Search…" button in the header bar (if one exists — read the header component first)

Styling: use Mantine's Modal or Overlay for the backdrop. Style the cmdk list to match the app's dark theme (read the current theme tokens from theme.ts).

IMPORTANT: Do NOT modify the sidebar. Do NOT change routing. Just add the overlay palette.

VALIDATION:
1. npm run build — must pass
2. Press Cmd+K — palette opens
3. Type "Dashboard" — shows Dashboard option
4. Press Enter — navigates to Dashboard
5. Type "Resources" — shows Resources under People group
6. Press Escape — palette closes
7. All sidebar navigation still works normally
8. All pages still load

STOP: Report which files you created/modified.
```

### Prompt 1.9 — JWT to HttpOnly Cookies (Backend)

```
SCOPE:
- MODIFY: Security configuration (SecurityConfig or WebSecurityConfig)
- CREATE: A cookie-based auth filter if needed
- MODIFY: The auth/login controller/endpoint
- MODIFY: The auth/logout controller/endpoint
- DO NOT touch any frontend files in this prompt
- DO NOT touch any non-auth controllers

PREREQUISITE: Have the test foundation ready, or at minimum be able to run mvn compile.

TASK: Migrate JWT from response body to HttpOnly secure cookie.

Steps:
1. READ the current auth flow: find the login endpoint, see how it currently returns the JWT
2. READ SecurityConfig: understand the current filter chain
3. On successful login: instead of returning JWT in response body, set it as a cookie:
   - HttpOnly = true
   - Secure = true (set to false for localhost dev)
   - SameSite = Lax
   - Path = /
   - Name = "pp_token" (or similar)
4. Create/modify the security filter to read the token from the cookie instead of Authorization header
5. Add CSRF protection: CookieCsrfTokenRepository.withHttpOnlyFalse()
6. Logout endpoint: clear the cookie (set MaxAge=0)
7. KEEP the Authorization header reading as a fallback (for API key auth in v15)

IMPORTANT: This is backend-only. The frontend still sends the old way. We'll update frontend in the next prompt. Both methods (cookie and header) should work simultaneously during transition.

VALIDATION:
1. mvn clean compile — must pass
2. mvn test — all existing tests still pass
3. Use curl to test login: curl -c cookies.txt -X POST localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"..."}'
4. Verify Set-Cookie header in response
5. Use curl with cookie: curl -b cookies.txt localhost:8080/api/projects — should return data
6. App still starts without errors

STOP: Report the curl test results. Do NOT touch frontend yet.
```

### Prompt 1.10 — JWT to HttpOnly Cookies (Frontend)

```
SCOPE:
- MODIFY: The axios/fetch configuration file (find it by grepping for "Authorization" or "Bearer" or "localStorage" in src/)
- MODIFY: The login page/component
- MODIFY: The logout function
- DO NOT modify any page components
- DO NOT modify any backend code

PREREQUISITE: Prompt 1.9 must be complete (backend cookie auth working).

TASK: Update the frontend to use cookie-based auth instead of localStorage JWT.

Steps:
1. grep -r "localStorage" src/ — find all JWT token storage
2. grep -r "Authorization" src/ — find all header injection
3. grep -r "Bearer" src/ — find token usage
4. Remove all localStorage.getItem/setItem for the auth token
5. Add withCredentials: true to axios defaults (or fetch credentials: 'include')
6. Add CSRF token handling: read XSRF-TOKEN cookie and include as X-XSRF-TOKEN header
7. Update login handler: don't store token from response body (cookie is set automatically)
8. Update logout: call logout endpoint (cookie cleared by server), redirect to login

IMPORTANT: List every file you found in steps 1-3 BEFORE making changes. I want to see the scope.

VALIDATION:
1. npm run build — must pass
2. Open browser DevTools → Application → Local Storage — should have NO JWT token
3. Open browser DevTools → Application → Cookies — should show pp_token (HttpOnly)
4. Login → navigate to Dashboard → data loads
5. Navigate to Projects → data loads
6. Navigate to Admin Settings → data loads
7. Navigate to Ask AI → submit a query → works
8. Logout → redirected to login → cookie cleared
9. Try accessing Dashboard without login → redirected to login

STOP: Report all verification results. This is security-critical — be thorough.
```

### Prompt 1.11 — Email SMTP Setup (Backend Only)

```
SCOPE:
- ADD: spring-boot-starter-mail to pom.xml
- CREATE: EmailService.java
- CREATE: email templates (Thymeleaf HTML templates in src/main/resources/templates/email/)
- MODIFY: application.yml (add SMTP config section with env vars)
- DO NOT modify any controllers
- DO NOT modify any frontend code

TASK: Set up the email delivery infrastructure.

Steps:
1. Add spring-boot-starter-mail and spring-boot-starter-thymeleaf to pom.xml
2. Add SMTP config to application.yml using environment variables:
   spring.mail.host=${SMTP_HOST:smtp.gmail.com}
   spring.mail.port=${SMTP_PORT:587}
   spring.mail.username=${SMTP_USER:}
   spring.mail.password=${SMTP_PASS:}
3. Create EmailService with method: sendAlert(String to, String subject, Map<String,Object> context, String templateName)
4. Create 2 HTML email templates:
   - weekly-digest.html: portfolio summary with project counts, risk highlights, capacity alerts
   - support-staleness.html: list of stale support tickets with age and assignee
5. Both templates should have Portfolio Planner branding (simple header with app name)

VALIDATION:
1. mvn clean compile — must pass
2. mvn test — existing tests pass
3. App starts without errors (SMTP creds not required to start — only to send)
4. Write a unit test for EmailService that uses a mock MailSender

STOP: Report compilation result. Do NOT wire to notifications yet (that's next prompt).
```

---

## How to Continue This Pattern

Every remaining feature follows the same structure. Here's the template:

```
SCOPE:
- CREATE: [exact file paths]
- MODIFY: [exact file paths]
- DO NOT touch: [files that must not change]

PREREQUISITE: [which previous prompts must be done]

TASK: [single, specific task]

Steps:
1. First, READ [files] to understand current state
2. grep for [patterns] to find all usages
3. [specific implementation steps]

IMPORTANT: [constraints and warnings]

VALIDATION:
1. [build command] — must pass
2. [specific functional tests]
3. [regression checks on related pages]

STOP: Report results. Do not continue to next feature.
```

---

## Key Principles That Prevent Breakage

### 1. Always Start with READ
Never let Cowork modify a file it hasn't read first. Start every prompt with "First, READ the current [file]". This forces it to understand the existing code before changing it.

### 2. Grep Before Modify
Before changing any function, class, or component, tell Cowork to grep for all usages. "grep for 'ProjectService' across the codebase" prevents it from breaking callers.

### 3. Explicit File Lists
Tell Cowork EXACTLY which files it can touch. "MODIFY: only src/pages/Releases/ReleasesPage.tsx" is much safer than "update the Releases page."

### 4. Batch by Nav Group, Not by Feature Type
Don't say "add empty states to all pages." Say "add empty states to the 5 Delivery group pages." This limits blast radius and makes verification tractable.

### 5. Validate Related Pages
After every change, tell Cowork to verify that RELATED pages still work. Changed a component? Check every page that imports it. Changed a service? Check every controller that calls it.

### 6. Build Gates in Every Prompt
Always include "npm run build — must pass" and "mvn clean compile — must pass." If the build breaks, Cowork must fix it before reporting success.

### 7. STOP Conditions
Always end with "STOP: Report results. Do not continue." Without this, Cowork will helpfully keep going and start "improving" things you didn't ask for.

### 8. One Branch Per Feature
Never let Cowork commit multiple features to one branch. If it breaks, you need to be able to revert one feature without losing another.

---

## Verification Checkpoint Prompts

Use these between feature prompts to catch drift:

### Full Build Check
```
TASK: Run a full build verification. Do NOT modify any files.

1. Run: mvn clean compile — report result
2. Run: mvn test — report result (list any failing tests)
3. Run: npm run build — report result
4. Run: npm run lint — report result
5. Start the app and verify these 8 pages load without errors:
   - /dashboard
   - /projects (or wherever the projects list is)
   - /capacity
   - /nlp (Ask AI)
   - /eng-intelligence
   - /jira-pods
   - /inbox
   - /settings/org

Report: pass/fail for each step. Do NOT fix anything — just report.
```

### Full Route Smoke Test
```
TASK: Navigate to every route in the application and report status. Do NOT modify any files.

Check each of these routes. For each one, report:
- ✅ Shows data (page renders with real content)
- 🔲 Shows empty state (page renders with EmptyState component)
- ❌ Blank/broken (page shows nothing or has errors)

Routes to check:
/dashboard, /inbox, /nlp,
/portfolio-health, /project-health, /portfolio-timeline, /project-signals, /dependency-map, /gantt,
/resources, /availability, /overrides, /bookings, /capacity, /leave, /resource-performance, /resource-intelligence,
/calendar, /sprint-planner, /project-templates,
/jira-pods, /releases, /release-notes, /jira-actuals, /jira-support, /jira-worklog, /budget-capex,
/eng-intelligence, /dora-metrics, /delivery-predictability, /jira-analytics, /dashboard-builder,
/timeline-simulator, /scenario-simulator, /smart-notifications, /jira-portfolio-sync,
/settings/org

Expected result: ZERO ❌ entries. Every route should be either ✅ or 🔲.
```

---

## When Things Go Wrong

### If Cowork breaks something:
```
TASK: Revert the last change and diagnose the issue.

1. Run: git diff — show me exactly what changed
2. Run: git stash — save the changes temporarily
3. Run: npm run build — verify the app builds without the changes
4. Run the app — verify the broken page now works again
5. Show me the git diff output so I can see what went wrong

Do NOT attempt to fix the issue. Just revert and report.
```

### If a build fails after Cowork's changes:
```
TASK: The build is failing. Fix ONLY the build error. Do not make any other changes.

1. Run: npm run build (or mvn clean compile) — show me the EXACT error message
2. Read the file mentioned in the error
3. Fix ONLY the line(s) causing the error
4. Run the build again — must pass
5. Run the app — verify the affected page still works

Do NOT refactor, improve, or change anything beyond the exact build error fix.
```

---

## Session Cadence

Recommended workflow for each development day:

1. **Start session**: Run the "Full Build Check" prompt
2. **Feature work**: Run ONE feature prompt (e.g., Prompt 1.4)
3. **Verify**: Run the "Full Route Smoke Test" prompt
4. **Commit**: `git add -A && git commit -m "feat(v13): [description]"`
5. **End session**: Run the "Full Build Check" prompt again

If any verification fails between steps 2 and 3, revert and investigate before continuing.

---

*This playbook was generated alongside the Portfolio Planner Implementation Guide (the .docx file). Use the .docx for the full roadmap context. Use this file for the actual Cowork prompts.*

---

## Phase 4: Executive Layer & Collaboration (v14)

### Prompt 4.1 — Executive Summary Dashboard

**Goal:** Add a new `/reports/executive-summary` page that aggregates KPIs from all existing modules into a clean, executive-facing one-pager. New `ExecSummaryController` assembles data from existing repos.

**Files to create:**
- `backend/.../controller/ExecSummaryController.java`
- `frontend/src/pages/reports/ExecSummaryPage.tsx`

**Files to modify:**
- `frontend/src/App.tsx` — add route `/reports/executive-summary`
- `frontend/src/components/layout/AppShell.tsx` — add nav entry under Portfolio group
- `frontend/src/pages/settings/UserManagementPage.tsx` — add `exec_summary` page key

**Backend — ExecSummaryController (`GET /api/reports/exec-summary`):**
Aggregate into one response:
- Portfolio: total projects, % on-track (status IN_PROGRESS, health GREEN+AMBER), % at-risk (health RED)
- Capacity: overall utilization % from `/api/reports/capacity-gap` (avg gap across all pods)
- OKRs: total objectives, % COMPLETED, % ACTIVE, avg progress
- Risks: total open risks, count CRITICAL (probability=HIGH & severity=HIGH), count HIGH
- DORA: latest deploymentFrequency and leadTimeDays from ProductivityMetrics or DoraMetrics endpoint
- Sprint velocity: avg storyPointsDone across last 3 SprintRetroSummary records

**Frontend — ExecSummaryPage.tsx:**
- Top KPI bar: 6 metric tiles (Portfolio Health, Capacity Utilization, OKR Progress, Critical Risks, Deploy Frequency, Sprint Velocity)
- Portfolio status breakdown: 3 colored segments (On Track / At Risk / Completed)
- Capacity section: per-POD utilization progress bars (reuse data from capacity-gap)
- OKR section: ring chart showing COMPLETED / ACTIVE / NOT_STARTED split
- Risk summary: traffic-light risk count by severity
- Sprint velocity trend: small Recharts LineChart of last 5 sprints avg velocity
- "Last refreshed" timestamp + Refresh button

**Build gates:** `tsc --noEmit` → 0 errors. Version → v14.0.

---

### Prompt 4.2 — Project Status Updates

**Goal:** Let teams post weekly RAG (Red/Amber/Green) status updates on each project. V92 migration, new controller, status feed tab on Project Detail page + cross-project `/reports/status-updates` feed.

**Files to create:**
- `backend/.../db/migration/V92__project_status_update.sql`
- `backend/.../model/ProjectStatusUpdate.java`
- `backend/.../repository/ProjectStatusUpdateRepository.java`
- `backend/.../controller/ProjectStatusUpdateController.java`
- `frontend/src/pages/reports/StatusUpdatesFeedPage.tsx`

**Files to modify:**
- `frontend/src/pages/ProjectDetailPage.tsx` — add "Status Updates" tab
- `frontend/src/App.tsx` — add route `/reports/status-updates`
- `frontend/src/components/layout/AppShell.tsx` — add nav entry under Portfolio
- `frontend/src/pages/settings/UserManagementPage.tsx` — add `status_updates` page key

**V92 migration:**
```sql
CREATE TABLE IF NOT EXISTS project_status_update (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  rag_status  VARCHAR(10) NOT NULL CHECK (rag_status IN ('RED','AMBER','GREEN')),
  summary     TEXT NOT NULL,
  what_done   TEXT,
  whats_next  TEXT,
  blockers    TEXT,
  author      VARCHAR(120),
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ON project_status_update(project_id, created_at DESC);
```

**Controller endpoints:**
- `GET /api/projects/{id}/status-updates` — list all for project, ordered by created_at DESC
- `POST /api/projects/{id}/status-updates` — create new update
- `GET /api/reports/status-updates/feed` — cross-project feed, optional `?limit=50`
- `DELETE /api/projects/{id}/status-updates/{updateId}` — admin delete

**Frontend — ProjectDetailPage tab:** Show timeline of status posts, RAG badge, summary + expandable details. "Post Update" button opens modal (Select RAG, text fields for summary/done/next/blockers).

**Frontend — StatusUpdatesFeedPage:** Card-based timeline feed across all projects. Filter by project, RAG status, date range. Each card shows project name, RAG badge, author, date, summary.

**Build gates:** `mvn clean compile` → BUILD SUCCESS. `tsc --noEmit` → 0 errors. Version → v14.1.

---

### Prompt 4.3 — Team Pulse & Morale Tracker

**Goal:** Weekly mood check-in (score 1–5 + optional comment) per resource. V93 migration, `TeamPulseController`, new page `/reports/team-pulse` with heatmap by POD and trend chart.

**Files to create:**
- `backend/.../db/migration/V93__team_pulse.sql`
- `backend/.../model/TeamPulse.java`
- `backend/.../repository/TeamPulseRepository.java`
- `backend/.../controller/TeamPulseController.java`
- `frontend/src/pages/reports/TeamPulsePage.tsx`

**Files to modify:**
- `frontend/src/App.tsx` — add route `/reports/team-pulse`
- `frontend/src/components/layout/AppShell.tsx` — add nav entry under People
- `frontend/src/pages/settings/UserManagementPage.tsx` — add `team_pulse` page key

**V93 migration:**
```sql
CREATE TABLE IF NOT EXISTS team_pulse (
  id          BIGSERIAL PRIMARY KEY,
  resource_id BIGINT NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
  week_start  DATE NOT NULL,
  score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_pulse_resource_week UNIQUE (resource_id, week_start)
);
CREATE INDEX ON team_pulse(week_start DESC);
```

**Controller endpoints:**
- `GET /api/pulse/summary` — weekly avg score by POD for last 8 weeks
- `GET /api/pulse/trend` — overall team avg per week for last 12 weeks
- `GET /api/pulse/entries` — paginated raw entries (admin)
- `POST /api/pulse` — submit a pulse entry `{resourceId, weekStart, score, comment}`
- `GET /api/pulse/week/{weekStart}` — all entries for a given week

**Frontend — TeamPulsePage:**
- KPI tiles: Current Week Avg, Team Trend (↑/↓), % Responded This Week, Happiest POD
- Heatmap grid: rows = PODs, columns = last 8 weeks, cells colored by avg score (1=red → 5=green), shows score number
- Trend line chart (Recharts LineChart): overall avg score per week, last 12 weeks
- "Submit Check-in" button: modal with resource Select, score (1–5 emoji/star picker), optional comment
- Raw entries accordion (admin only): collapsible table of all entries

**Build gates:** `mvn clean compile` → BUILD SUCCESS. `tsc --noEmit` → 0 errors. Version → v14.2.

---

### Prompt 4.4 — App Changelog / What's New

**Goal:** Admins post versioned changelog entries. All users see a "What's New" badge on the header bell area. V94 migration, `ChangelogController`, admin editor page, user-facing drawer.

**Files to create:**
- `backend/.../db/migration/V94__app_changelog.sql`
- `backend/.../model/AppChangelog.java`
- `backend/.../repository/AppChangelogRepository.java`
- `backend/.../controller/AppChangelogController.java`
- `frontend/src/pages/settings/ChangelogAdminPage.tsx`
- `frontend/src/components/common/WhatsNewDrawer.tsx`

**Files to modify:**
- `frontend/src/components/layout/AppShell.tsx` — add WhatsNewDrawer + badge on header
- `frontend/src/App.tsx` — add route `/settings/changelog`
- `frontend/src/pages/settings/UserManagementPage.tsx` — add `changelog_admin` page key

**V94 migration:**
```sql
CREATE TABLE IF NOT EXISTS app_changelog (
  id           BIGSERIAL PRIMARY KEY,
  version      VARCHAR(20) NOT NULL,
  title        VARCHAR(200) NOT NULL,
  description  TEXT NOT NULL,
  change_type  VARCHAR(30) NOT NULL DEFAULT 'feature' CHECK (change_type IN ('feature','improvement','fix','breaking')),
  published    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMP NOT NULL DEFAULT now()
);
```

**Controller endpoints:**
- `GET /api/changelog` — all published entries, ordered by created_at DESC
- `GET /api/changelog/all` — admin: all entries including drafts
- `POST /api/changelog` — admin: create entry
- `PUT /api/changelog/{id}` — admin: update (publish/edit)
- `DELETE /api/changelog/{id}` — admin: delete
- `GET /api/changelog/unread-count` — returns count of entries newer than user's last_seen_changelog (stored in localStorage)

**Frontend — WhatsNewDrawer:** Slide-in drawer from right. Shows list of published changelog entries as cards (version badge, type badge, title, description, date). Triggered by new `IconSparkles` button in header (shows red badge dot when unread > 0). Marks all as read on open (saves timestamp to localStorage).

**Frontend — ChangelogAdminPage `/settings/changelog`:** Table of all entries with publish toggle, edit modal, delete. "New Entry" button. Type color-coded badges.

**Build gates:** `tsc --noEmit` → 0 errors. Version → v14.3.

---

### Prompt 4.5 — Custom Project Fields

**Goal:** Admins define extra metadata fields (text/number/date/select) for projects. Fields appear on Project Detail and Project create/edit form. V95 + V96 migrations, `CustomFieldController`, admin config page, ProjectDetailPage updated.

**Files to create:**
- `backend/.../db/migration/V95__custom_field_definition.sql`
- `backend/.../db/migration/V96__custom_field_value.sql`
- `backend/.../model/CustomFieldDefinition.java`
- `backend/.../model/CustomFieldValue.java`
- `backend/.../repository/CustomFieldDefinitionRepository.java`
- `backend/.../repository/CustomFieldValueRepository.java`
- `backend/.../controller/CustomFieldController.java`
- `frontend/src/pages/settings/CustomFieldsAdminPage.tsx`
- `frontend/src/components/common/CustomFieldsRenderer.tsx`

**Files to modify:**
- `frontend/src/pages/ProjectDetailPage.tsx` — add custom fields section
- `frontend/src/App.tsx` — add route `/settings/custom-fields`
- `frontend/src/components/layout/AppShell.tsx` — add nav entry under Admin
- `frontend/src/pages/settings/UserManagementPage.tsx` — add `custom_fields_admin` page key

**V95 migration:**
```sql
CREATE TABLE IF NOT EXISTS custom_field_definition (
  id           BIGSERIAL PRIMARY KEY,
  field_name   VARCHAR(100) NOT NULL UNIQUE,
  field_label  VARCHAR(100) NOT NULL,
  field_type   VARCHAR(20)  NOT NULL CHECK (field_type IN ('text','number','date','select')),
  options_json TEXT,
  required     BOOLEAN NOT NULL DEFAULT false,
  sort_order   INT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMP NOT NULL DEFAULT now()
);
```

**V96 migration:**
```sql
CREATE TABLE IF NOT EXISTS custom_field_value (
  id           BIGSERIAL PRIMARY KEY,
  field_def_id BIGINT NOT NULL REFERENCES custom_field_definition(id) ON DELETE CASCADE,
  project_id   BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  value_text   TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_field_project UNIQUE (field_def_id, project_id)
);
CREATE INDEX ON custom_field_value(project_id);
```

**Controller endpoints:**
- `GET /api/custom-fields/definitions` — all active definitions
- `POST /api/custom-fields/definitions` — admin: create definition
- `PUT /api/custom-fields/definitions/{id}` — admin: update (rename, reorder, toggle active)
- `DELETE /api/custom-fields/definitions/{id}` — admin: soft-delete (set active=false)
- `GET /api/custom-fields/values/{projectId}` — all field values for a project
- `PUT /api/custom-fields/values/{projectId}` — upsert values for a project `{fieldDefId → value}` map

**Frontend — CustomFieldsAdminPage `/settings/custom-fields`:** Table of field definitions with drag-to-reorder (sort_order), type badge, required toggle, active toggle, edit/delete buttons. "Add Field" modal with name, label, type, options (for select type), required checkbox.

**Frontend — CustomFieldsRenderer component:** Takes `definitions[]` + `values{}` + `onChange`. Renders each field as appropriate Mantine input (TextInput / NumberInput / DatePickerInput / Select). Used inside ProjectDetailPage in a "Custom Fields" section (collapsible Card, edit mode saves via PUT values endpoint).

**Build gates:** `mvn clean compile` → BUILD SUCCESS. `tsc --noEmit` → 0 errors. Version → v14.4.
