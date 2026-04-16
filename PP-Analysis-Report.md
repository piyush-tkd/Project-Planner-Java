# Engineering Portfolio Planner — Comprehensive Analysis Report
**Date:** April 15, 2026 | **Analyst:** Claude (Cowork)

---

## Executive Summary

The Engineering Portfolio Planner (EPP) is a full-stack, production-grade internal tool for engineering resource planning, portfolio management, and AI-assisted analytics. It is impressively feature-rich — 55+ pages, 97+ backend controllers, 155 Flyway DB migrations, a full NLP engine, Jira integration, SSO, RBAC, and custom dashboards — and is clearly production-deployed and actively used. The code quality is generally high with good patterns throughout.

That said, there are a handful of significant bugs, several architectural concerns that will cap scalability, and notable gaps compared to market-leading tools in this category. This report covers all of these in detail.

---

## 1. Architecture Overview

| Layer | Stack |
|---|---|
| **Frontend** | React 18, TypeScript 5.6, Vite 6, Mantine UI v7, TanStack Query v5, React Router v6, Recharts, AG Grid |
| **Backend** | Spring Boot 3.4.1, Java 21, JPA/Hibernate, Flyway, Caffeine cache, JWT + HttpOnly cookie auth |
| **Database** | PostgreSQL 16, 155 Flyway migrations |
| **AI/NLP** | SSE streaming, Ollama (local), Anthropic Claude (cloud), RAG fallback, self-learning optimizer |
| **Integrations** | Jira Cloud, Azure DevOps, OAuth2/OIDC SSO |
| **Deployment** | Vercel (frontend), Railway (backend) per DEPLOYMENT.md |

Scale stats at a glance: ~198 frontend routes, ~97 REST controllers, ~55 page-level components, 43 API modules on the frontend, and ~20 hooks.

---

## 2. What's Working Well

### Authentication & Security
The auth system is solid. HttpOnly cookies carry the JWT (not localStorage), preventing XSS token theft. The cookie bootstrap on refresh (`/auth/me`) correctly validates session continuity. Role-based access control (ADMIN, SUPER_ADMIN, user with page allowlists) is enforced on both frontend routing and backend via `@PreAuthorize`. SSO via OAuth2/OIDC is supported and configurable per org.

The gitignore correctly excludes `application-local.yml`, keeping secrets out of source control.

### API Client Design
The Axios client (`api/client.ts`) is well-designed: it handles 401 auto-logout via an event bus (avoiding circular imports), deduplicates identical error logs within a 60-second window, normalises Spring Boot "No static resource" errors into human-readable messages, and forwards errors to a backend `/error-logs` endpoint for observability.

### Code Splitting & Performance Foundations
All 55+ page components are lazy-loaded via `React.lazy()` with `Suspense` fallback — a proper approach to keeping the initial bundle small. TanStack Query is used correctly with a 30-second `staleTime` and `retry: 1`, and cache invalidation on mutations is wired up consistently across the project API modules.

### NLP Engine
The NLP system is genuinely impressive. It's a chain-of-responsibility strategy: Rule-Based → Vector Pattern Match (88% similarity threshold) → Ollama LLM → Claude API. SSE streaming gives real-time progress updates. Per-user rate limiting (10 req/min), auto-learning at 90% confidence, session context for follow-up questions, and an NLP Optimizer dashboard for continuous improvement — this is a real differentiator.

### Observability & Error Handling
Global error capture is thorough: React ErrorBoundary wraps each route, `window.onerror` and `unhandledrejection` are captured and shipped to the backend, and the axios interceptor logs API errors. There's a dedicated Error Log page in settings for triage.

### Caching Strategy
Caffeine cache is configured per-entity with appropriate TTLs: Jira projects/epics at 15 min, sprint issues at 5 min, support queue at 2 min, the calculations cache is eviction-only (invalidated on every mutation). This is thoughtful.

### Feature Flags
Org-level feature toggles (`ai`, `okr`, `risk`, `ideas`, `financials`, `jira`, `simulations`, `advanced_people`) allow the app to be configured for different deployment contexts without code changes.

---

## 3. Bugs & Broken Functionality

### 🔴 CRITICAL: ScenarioPlanningPage Uses Hardcoded Mock Data
**File:** `src/pages/ScenarioPlanningPage.tsx`

The page imports `useQuery` and `apiClient` but never actually fetches scenarios from the backend. Instead it initialises state with `mockScenarios`, `mockChanges`, and `mockSnapshots` — hardcoded arrays. The `ScenarioService` exists on the backend (with full CRUD), but the frontend is disconnected from it entirely.

Every create/edit/delete action modifies only the in-memory React state. On page refresh all changes vanish. Users are operating on fake data. **This needs to be replaced with live API calls before anyone relies on it for planning decisions.**

```typescript
// Current (broken):
const [scenarios, setScenarios] = useState<Scenario[]>(mockScenarios);

// Should be:
const { data: scenarios = [] } = useQuery({
  queryKey: ['scenarios'],
  queryFn: () => apiClient.get('/scenarios').then(r => r.data),
});
```

### 🟠 HIGH: Business Logic in Controllers (Architecture Violation)
**Files:** `ProductivityMetricsController.java`, `ExecSummaryController.java`, `DashboardQueryController.java`

Several controllers bypass the service layer and call repositories directly:

```java
// In ProductivityMetricsController — should be in a service:
costRateRepo.findAll().forEach(cr -> ...);
resourceRepo.findAll().forEach(r -> ...);
List<ResourcePodAssignment> assignments = assignmentRepo.findAll();
```

This makes the code harder to test, couples controllers to DB layer, and prevents reuse. These calculations should live in dedicated service classes.

### 🟠 HIGH: SSO Requires Server Restart to Apply Changes
**File:** `SsoClientRegistrationConfig.java`

The `ClientRegistrationRepository` bean is built once at application startup from the `sso_config` DB row. Changing SSO settings in the Admin UI takes effect only after a full server restart. The code comments acknowledge this: *"A future enhancement could make this lazily-refreshing, but for now a server restart is required."* For a production tool, this is a notable operational burden.

### 🟡 MEDIUM: Missing Error/Loading States in ScenarioPlanningPage
The page doesn't have any `isLoading` or `isError` rendering, no empty state component, and no optimistic update rollback — since it's all mock state, none of that was wired up.

### 🟡 MEDIUM: Jira API Token in application-local.yml
A real Jira API token (`ATATT3xFfGF0b28ZW...`) is hardcoded in `application-local.yml`. While this file is gitignored, it exists on disk and any developer's machine that has cloned the repo and run `./start-backend.sh` will have a live credential in plaintext. Consider rotating this token and using `.env` + `dotenv` or a secrets manager even for local dev.

### 🟡 MEDIUM: XHR Timeout Set to 120 Seconds
`axios` is configured with a 120,000ms timeout to accommodate slow Jira API calls. While necessary for Jira live fetches, this means a stuck request will hold the connection for 2 minutes before failing. Requests that don't touch Jira (e.g., CRUD operations on local data) should use a much shorter timeout. Consider per-request timeout overrides.

---

## 4. Code Quality Gaps

### Very Low Test Coverage
The frontend has 9 test files covering a codebase of 55+ pages and 40+ hooks. The backend has ~10 test files. There are no end-to-end tests (Playwright, Cypress). Most critical business logic — capacity calculations, NLP routing, cost engine — is untested at the integration level. A bug in `CapacityCalculatorService` could silently produce wrong numbers across every report page.

**Biggest risk areas without tests:** capacity gap calculation, demand calculation, hiring forecast, cost engine ROI computation, NLP strategy routing.

### Oversized Components
Several files have grown very large and should be decomposed:

| File | Lines | Concern |
|---|---|---|
| `DashboardPage.tsx` | 1,257 | Single component rendering 15+ widget types |
| `AppShell.tsx` | 1,221 | Navigation logic + sidebar + search + keyboard shortcuts |
| `NlpLandingPage.tsx` | ~900+ | Chat UI + history + suggestions + streaming all in one |

`DashboardPage.tsx` in particular imports from 30+ modules and renders charts, tables, health badges, project cards, sprint data, and AI insights all in one tree. Any state change anywhere re-renders the entire page.

### Missing Memoization in Dashboard
`DashboardPage.tsx` has 0 responsive grid breakpoints and 0 `React.memo` wrapping of widget subcomponents. With 10+ API queries each contributing data, every re-render cascades through the entire component tree.

### No Internationalization
The codebase has no i18n library (no `react-intl`, `i18next`, or similar). All strings are hardcoded in English. While the app appears to be for internal Baylor Genetics use, this limits future adoption.

### No Pagination on Major List Endpoints
There are **118** `findAll()` repository calls vs **6** uses of `Pageable`. Every `/api/projects`, `/api/resources`, `/api/pods`, etc. returns the complete table. At current scale this is fine, but at 500+ projects or 200+ resources this becomes a bottleneck — full table scans on every page load.

---

## 5. Usability Assessment

### Strengths
- **Design system is polished.** Mantine UI with custom brand tokens (Deep Blue + Aqua) produces a consistent, professional look. The Baylor Genetics branding is well-applied.
- **Command palette** (⌘K) and **keyboard shortcuts** reduce friction for power users.
- **NLP search bar** on every page is a genuine quality-of-life improvement.
- **Onboarding wizard** and **tour guide** system exist for first-run experience.
- **Feedback widget** on every page encourages continuous user feedback.
- **Dark mode** supported throughout.
- **Inline editing** in tables (AG Grid + custom `InlineEditCell`) removes the need for modal-heavy workflows.

### Weaknesses

**Navigation complexity.** 50+ items in the sidebar is cognitively overwhelming. Users who aren't power users will not discover most features. Consider grouping into fewer top-level sections with progressive disclosure, or a "Home" page that surfaces the 5 most relevant views per role.

**No mobile support.** `DashboardPage.tsx` uses `SimpleGrid` with zero responsive breakpoints. The AppShell uses a mobile hamburger burger but the content pages are desktop-only layouts. Engineering portfolio tools are increasingly used on tablets by managers in meetings.

**Feature discoverability.** With 55+ pages, features like the AI Content Studio, Engineering Economics, Resource Insights, and Demand Forecast likely get zero traffic from most users because they're buried in a long sidebar. Consider adding a "What's New" panel or role-based page suggestions on the dashboard.

**ScenarioPlanningPage shows fake data** (see Bug #1 above) — this is a trust-breaking issue. If a PM uses this for headcount planning and later realizes the data wasn't real, confidence in the entire tool drops.

---

## 6. Scalability Assessment

### Database Layer
| Issue | Risk | Recommendation |
|---|---|---|
| `findAll()` on every list endpoint | High at 500+ rows | Add `Pageable` params to all list controllers |
| No documented composite indexes | Medium | Add indexes on `project.status`, `resource.role+location`, `allocation.pod_id+month` |
| `ExecSummaryController` calls `findAll()` on projects + objectives + risks | High | Introduce a single aggregation query or materialized view |

### Application Layer
| Issue | Risk | Recommendation |
|---|---|---|
| Caffeine cache is in-memory, per-node | High for multi-node | Switch to Redis for distributed caching before horizontal scaling |
| NLP rate limiter is in-memory | High for multi-node | Same — Redis or a distributed token bucket |
| `ProductivityMetricsController` does 5+ `findAll()` in one request | High | Pre-aggregate in a scheduled job; serve from a summary table |
| Jira live-fetch with 120s timeout blocks Tomcat threads | Medium | Use async/reactive or move Jira sync to a background job |

### Single-Tenant Architecture
The app has **no multi-tenancy**. All data is in a single PostgreSQL schema with no `org_id` or `tenant_id` column on business entities. To serve multiple organizations (i.e., sell as SaaS), you'd need a significant schema migration to add tenant isolation. This is not a bug for internal use, but it's a fundamental architecture choice that limits the product's commercial future.

---

## 7. Market Analysis

**Product Category:** Engineering Portfolio Management + Resource Planning + DevOps Intelligence

### Competitive Landscape

| Competitor | Overlap | Where They Win | Where EPP Wins |
|---|---|---|---|
| **Jira** (Atlassian) | Sprint tracking, project management | Ecosystem, integrations, brand | Portfolio view, capacity planning, NLP |
| **LinearB** | DORA metrics, engineering analytics | GitHub/GitLab depth, PR insights | Resource capacity, cost tracking |
| **Jellyfish** | Engineering analytics, allocation | Enterprise scale, BI integrations | Sprint-to-portfolio link, NLP |
| **Planview** | Portfolio management | Enterprise features, Gantt, financials | UX, NLP, cost of entry |
| **Resource Guru** | Resource scheduling | Simplicity, mobile | Jira link, project depth |
| **Forecast.app** | AI project management | AI features, time tracking | Custom reports, DORA |
| **Monday.com** | Project boards, resource views | UX, marketplace | Capacity math, Jira actuals |

### EPP's Genuine Differentiators
1. **NLP query interface with self-learning** — no competitor at this price point has this
2. **Deep Jira actuals integration** — sprint SP → capacity → project actuals in one view
3. **CapEx/OpEx classification** from Jira custom fields — uniquely valuable for finance teams
4. **Combined DORA + capacity + cost** — usually requires 3 separate tools
5. **Scenario planning** (once the mock data is fixed) — what-if headcount modelling

### Market Gaps EPP Has vs. What's Missing

**What EPP has that competitors often don't:** NLP assistant, CapEx tracking tied to Jira, engineering economics (ROI/cost engine), custom dashboard builder, weekly digest emails, automation rules engine, feedback hub with screenshot capture, granular page-level RBAC.

**What EPP is missing vs. the market:**
- **No mobile/responsive design** — all major competitors have apps or at least tablet-optimized layouts
- **No Slack/Teams integration** — notifications only go to email; no team chat alerting
- **No GitHub/GitLab integration** — LinearB and Jellyfish derive deep signal from PRs and commits; EPP only has Jira
- **No real-time collaboration** — no shared cursors, live commenting on dashboards, or conflict resolution
- **Limited export** — no PDF/PPTX report export from report pages (only per-chart PNG export exists)
- **No Gantt drag-and-drop editing** — the Gantt page is read-only; users can't drag tasks to reschedule
- **No time-tracking module** — relies entirely on Jira worklogs; teams not on Jira have no time data
- **Single-tenant only** — cannot be productized for other organizations without major schema work
- **No public API / webhooks for outbound** (inbound webhooks exist per settings page) — limiting for custom integrations

---

## 8. Prioritized Recommendations

### Immediate (this sprint)

1. **Fix ScenarioPlanningPage** — Replace mock data with real API calls to `/api/scenarios`. Add loading/error states and empty state. ~4 hours of work.

2. **Rotate the Jira API token** in `application-local.yml`. The current token (`ATATT3x...`) should be revoked at `baylorgenetics.atlassian.net` and regenerated. Never commit credentials, even in gitignored files, without a secrets scanning tool.

### Short-Term (next 2–4 sprints)

3. **Add pagination to all list endpoints** — Start with `/api/projects`, `/api/resources`, `/api/pods`. Add `?page=0&size=50` params and update frontend to use infinite scroll or paginated tables.

4. **Extract business logic from controllers** — Move `ProductivityMetricsController`, `ExecSummaryController`, and `DashboardQueryController` logic into dedicated service classes. This improves testability and maintainability.

5. **Add integration tests for core calculations** — CapacityCalculatorTest exists; add similar coverage for DemandCalculator, HiringForecastCalculator, and CostEngine.

6. **Break up DashboardPage.tsx** — Extract the 15+ widget types into separate `<Widget*>` components wrapped in `React.memo()`. This alone could dramatically improve perceived performance.

7. **Add responsive breakpoints** to the top 5 most-visited pages (Dashboard, Projects, Pods, Resources, Capacity Hub).

### Medium-Term (next quarter)

8. **Redis for distributed caching** — Replace Caffeine with Redis before any horizontal scaling of the backend. Caffeine caches are node-local.

9. **Slack/Teams integration** — Surface capacity alerts, project health changes, and sprint summaries in team channels. This dramatically increases daily active usage.

10. **Gantt drag-and-drop editing** — The read-only Gantt is useful for visibility but frustrating when users can't reschedule directly on the chart. This is a top UX complaint in tools like this.

11. **Lazy SSO config refresh** — Change `SsoClientRegistrationConfig` to refresh from DB without requiring a server restart. A refreshable `ClientRegistrationRepository` wrapper is the standard pattern.

### Long-Term (6+ months)

12. **Multi-tenancy** — If there's any plan to sell EPP to other organizations, the schema needs `org_id` tenant isolation on all tables. Row-level security in PostgreSQL (`ROW SECURITY`) is the cleanest approach.

13. **GitHub/GitLab integration** — PR cycle time, deployment frequency, and code review throughput are the data LinearB and Jellyfish monetize. Adding git platform integration would make the DORA metrics page self-populating.

14. **Mobile-first redesign of key views** — Dashboard, project health, and capacity summary should work well on a tablet so managers can review before/during meetings.

---

## 9. Summary Scorecard

| Dimension | Score | Notes |
|---|---|---|
| **Code Quality** | 7/10 | Good patterns overall; oversized components and controller/service blurring hurt the score |
| **Test Coverage** | 3/10 | 9 frontend tests for 55+ pages; no E2E; critical calculations untested |
| **Security** | 7/10 | HttpOnly cookies, RBAC, SSO are solid; local credential in flat file is a risk |
| **Performance** | 5/10 | Code splitting and caching are good; `findAll()` everywhere and 1,200-line components are problems |
| **Usability** | 6/10 | Great for power users; overwhelming for casual users; no mobile support |
| **Scalability** | 4/10 | Single-tenant, in-memory cache, no pagination — fine for internal use, not for SaaS |
| **Feature Completeness** | 8/10 | Extraordinarily feature-rich for an internal tool; gaps are mainly in integrations and mobile |
| **Market Fit** | 7/10 | Strong differentiators in NLP + Jira depth + economics; missing Slack, GitHub, mobile |

---

*Report generated by analysing frontend source (React/TypeScript), backend source (Java/Spring Boot), database migrations (Flyway V1–V155), configuration files, and routing structure. Browser automation was unavailable for live UI screenshots; analysis is based on static code and architecture inspection.*
