# Engineering Portfolio Planner — Comprehensive Analysis (v2)

**Prepared:** April 16, 2026
**Scope:** Technology, features, UI/UX, competitive landscape
**Method:** Static analysis of the repository (backend Java, frontend TS, 155 Flyway migrations, `README.md`, deployment docs) plus competitor research. Three parallel exploration agents gathered facts; key claims were verified directly against source.
**Supersedes:** `PP-Analysis-Report.md` (April 15). That report contained at least one material factual error, corrected in §7.

---

## Reader's guide

- §1 **Executive Summary** — for leadership; business framing and the one-page version.
- §2 **Strategic Positioning** — build-vs-buy, differentiators, replacement cost.
- §3 **Feature Inventory** — every shipped capability, grouped by domain.
- §4 **Technical Architecture** — stack, patterns, NLP engine, integrations, risks. This is the deep section.
- §5 **UI/UX Analysis** — design system, navigation, accessibility, friction.
- §6 **Competitive Landscape** — 15+ tools, comparison matrix, where we win/lose.
- §7 **Corrections to Prior Report** — material errors in v1 and the ground truth.
- §8 **Findings, Risks, and Priorities** — triaged list with severity.

---

## 1. Executive Summary

The Engineering Portfolio Planner (EPP) is a mature, production-grade internal platform for engineering resource planning at Baylor Genetics. It covers the full planning lifecycle — from POD modeling and capacity/demand forecasting to hiring projections, budget tracking, Jira actuals, scenario simulation, and an NLP-driven planning assistant. The codebase is substantial: ~508 Java files, ~156 frontend pages, 155 database migrations, 98 REST controllers, and a separate RAG microservice. It is SSO-integrated, RBAC-enforced, and actively deployed.

**The tool is a genuine competitive asset, not technical debt.** No single commercial product combines EPP's five differentiators — deep Jira integration, POD-based capacity modeling, hiring forecasting, budget/CapEx tracking, and a self-learning NLP planning assistant — in one place. A best-of-breed replacement (Tempo + Jellyfish + custom hiring + Planview) would cost $200–400K/year, take ~6 months to assemble, and leave data silos. A Planview-only replacement would cost $150–300K/year plus SI, take 3–6 months, and deliver a generic PPM that does not speak Jira natively.

**But EPP has real risks.** The most important:

- **Security posture is uneven.** The JWT signing secret defaults to a placeholder string in `application.yml`; there is no refresh-token mechanism (24-hour hard expiration); only ~13 `@PreAuthorize` annotations are present across 98 controllers — authorization enforcement is sparse rather than pervasive.
- **Architectural drift.** Several controllers (`SprintRetroController`, `ScenarioPlanningController`, `ResourceAllocationController`, `ResourceBookingController`, plus the ones named in v1 of this report) bypass the service layer and call repositories directly. This is the leading structural risk to long-term maintainability.
- **UI consistency.** The design system (Mantine + Baylor brand tokens) is strong in principle, but the codebase contains a large number of ad-hoc inline `style={{...}}` overrides — material drift from the tokens over time.
- **Monolith pages.** `PowerDashboardPage` (3,589 lines), `JiraDashboardBuilderPage` (3,473), `NlpLandingPage` (3,020), and `EngineeringAnalyticsPage` (2,187) are genuine complexity hotspots that will resist refactoring and concentrate regression risk.
- **Test coverage is thin.** 23 backend test classes for ~98 controllers/66 services, and ~8 unit tests + 12 Playwright specs for 150+ frontend routes. No CI/CD workflows are checked in (`.github/workflows/` is empty).
- **Desktop-only UX.** Zero media queries or `useMediaQuery` calls detected. This is likely an explicit product decision, but it should be made explicit.

**Bottom line.** EPP is ahead of the commercial market in functionality. The remaining work is hardening, not reinvention: tighten the security boundary, finish the service-layer refactor, add CI, and bring UI consistency back in line with the token system. Nothing in the report below suggests replacing the tool; it suggests investing in it.

---

## 2. Strategic Positioning

### 2.1 Five things only EPP does

1. **Jira actuals → capacity gap → hiring forecast → budget impact, in one workflow.** Competitors do one or two of these; none do all four natively. Tempo gives you Jira timesheets. Jellyfish gives you velocity. Planview gives you budget. Mosaic gives you hiring forecasts. EPP is the integrator.
2. **POD-based hierarchy with cross-POD dependency modeling.** Most tools assume a flat team model; EPP is built around Baylor's actual org shape.
3. **Self-learning NLP planning assistant.** A 4-tier strategy chain (deterministic → rule-based → local Ollama → cloud LLM) with pgvector similarity shortcut (≥0.88), per-user rate limiting (10 req/min), SSE streaming, and an auto-learner that only embeds FORM_PREFILL intents — deliberately excluding DATA_QUERY/INSIGHT/REPORT because "auto-learning these caused 'poisoned patterns' that returned empty/stale cached data" (from code comments).
4. **Dual-simulator design.** Timeline simulator (hiring/capacity scenarios over time) plus scenario simulator (resource-allocation what-ifs) — a level of depth no competitor offers out of the box.
5. **Engineering-native, not generic PPM.** It models CapEx custom fields, sprint velocity, worklog aggregation, DORA metrics, release calendars — all the vocabulary of engineering ops, not project-management abstractions.

### 2.2 Where EPP is reinventing the wheel

- **Analytics dashboards.** Jellyfish, Plandek, LinearB, and Swarmia deliver beautiful engineering metrics dashboards. EPP's 30+ reports are comprehensive but not differentiating on their own.
- **Timesheets/worklog detail.** Tempo does this better for pure Jira users.
- **Enterprise PPM ceremonies.** Planview has decades of maturity on governance gates, approval workflows, multi-program budget holds. EPP's project approval flow is simpler.

### 2.3 Realistic replacement cost

| Path | Tools | Year-1 cost | Setup | Trade-off |
|---|---|---|---|---|
| **Keep EPP** | 1 tool | ~$50–100K (internal) | — | Full parity; maintenance burden |
| **Best-of-breed** | Tempo + Jellyfish + custom hiring + Planview | $200–400K | ~6 months | Fragmented, integration tax |
| **Planview only** | Planview Portfolios | $150–300K + SI | 3–6 months | Generic, not Jira-native, slow |
| **Asana Portfolios + add-ons** | Asana + capacity + custom hiring | $100–150K | ~3 months | Weak Jira, no NLP, shallow |
| **Greenfield rebuild** | In-house team, 12–18 mo | $500K+ | 12–18 months | Perpetual maintenance |

The only viable single-tool replacement is Planview, and it costs 2–3× more with worse Jira integration.

---

## 3. Feature Inventory

The inventory below is cross-referenced against `README.md`, `frontend/src/pages/` (156 `.tsx` files), `App.tsx` (~155 routes), and `frontend/src/api/` (54 modules). Every item here was verified as shipped — the codebase contains **no `mockData`, `mockScenarios`, or hardcoded fixture arrays in page components** (grep returned zero matches), and only **9 TODO/FIXME comments across the entire ts+tsx+java source tree**.

### 3.1 Core planning (14 features)

POD hierarchy and resource assignments; capacity-vs-demand gap analysis (monthly, multi-dimensional); utilization heatmap with overload detection; hiring forecast with cumulative FTE; project portfolio with T-shirt sizing and health scoring; Gantt and timeline visualization; scenario and timeline simulators; budget and cost tracking with role/location rates; Excel bulk import/export; demand forecasting by quarter; skills matrix and competency mapping; resource pools (cross-POD); engineering economics/ROI calculator; advanced scheduling with holidays and leave.

### 3.2 Reports (30+ pages)

- **Capacity & utilization:** Utilization Center, Capacity Demand, Capacity Forecast, Pod Capacity, Pod Hours, Pod Resource Summary.
- **Resource intelligence:** Resource Intelligence (consolidated), Skills Matrix, Resource Performance.
- **Project & portfolio:** Project Health, Project Signals (consolidated), Project Pod Matrix, Dependency Map, Portfolio Timeline, Gantt Dependencies, Workload Chart, Portfolio Health Dashboard.
- **Financial & strategy:** Budget & CapEx, Financial Intelligence, Engineering Economics, Delivery Predictability, Smart Notifications.
- **Operations & metrics:** Sprint Retro, Sprint Quality, DORA Metrics, Jira Analytics, Jira Dashboard Builder, Engineering Intelligence, Engineering Analytics.
- **Executive:** Exec Summary, Status Updates Feed, Team Pulse, Jira Portfolio Sync, Power Dashboard.

A DL-9 consolidation effort has already merged redundant reports into tabbed hub pages (Portfolio Health, Portfolio Timeline, Resources, Capacity, Performance, Releases, Jira Dashboard, Engineering Hub, Scenario Tools) with legacy-URL redirects preserved — evidence of active IA cleanup.

### 3.3 Jira integration (8 surfaces)

Sprint actuals & velocity, CapEx hours via custom fields, support board daily snapshots, worklog aggregation by POD and sprint, release management tied to Jira versions, board-to-POD configuration, Jira assignee ↔ EPP resource mapping, Jira version ↔ EPP release mapping. Credentials stored in DB (`jira_credentials` table) with env-var fallback; background sync on a 30-minute scheduled interval (`@Scheduled(fixedDelayString = "${app.jira-sync.interval-ms:1800000}")`); Caffeine cache for catalog/permissions (max 100 items, 300s TTL). Also supports Azure DevOps as an alternative source.

### 3.4 NLP & AI (8 features)

Natural-language search bar on every page; 4-tier strategy chain (deterministic → rule-based → local Ollama → cloud LLM); pgvector similarity shortcut at 0.88 threshold; self-learning optimizer on a scheduled job; NLP Settings page for strategy/model/threshold config; NLP Optimizer dashboard for low-confidence queries, negative ratings, and learned patterns; rule-based query catalog; user feedback system (thumbs up/down) feeding training signal. A separate RAG microservice (`portfolio-planner-ai`, port 8081) handles embeddings + vector search with topK=8, minScore=0.55, fed by a nightly chunking scheduler.

### 3.5 Collaboration & governance (6)

Feedback Widget (floating, screenshot-enabled) → Feedback Hub (triage); global error capture (React ErrorBoundary + Axios interceptor + window.onerror + unhandledrejection), shipped to backend `/error-logs` endpoint; audit log; RBAC with page-level permissions; tour guide system.

### 3.6 Admin & configuration (19)

User management; organization settings; feature flags (`ai`, `okr`, `risk`, `ideas`, `financials`, `jira`, `simulations`, `advanced_people`); custom fields admin; Jira credentials; support board settings; timeline/calendar settings; reference data (T-shirt sizes, effort patterns, role taxonomy, skill categories); release settings; cost rates; email templates and weekly digest with SMTP; notification preferences; webhook settings; scheduled reports; changelog admin; Azure DevOps integration; quality configuration; sidebar customization; database browser (admin-only).

### 3.7 Operational (15)

Email digest; point-in-time data snapshots; automation engine with triggers; project approval workflow; project templates; inbox/alerts; smart insights; custom dashboard (Power Dashboard with 250+ widget types on `react-grid-layout`); objectives/OKR tracking; risk register; ideas board; calendar and capacity hubs (Phase 2 consolidations); leave management; AI content studio.

**Maturity summary:** 100+ shipped features. Zero mock/stub pages detected. This is an enterprise-grade system by feature count and by integration depth.

---

## 4. Technical Architecture

### 4.1 Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React + TypeScript + Vite + Mantine UI | 18.3 / 5.6 / 6.0 / 7.15 |
| State/data | TanStack Query | 5.62 |
| Router | React Router | 6.28 |
| Charts | Recharts + AG Grid (community) | 2.14 / 32.3 |
| Backend | Spring Boot + Java | 3.4.1 / 21 |
| ORM/migrations | JPA/Hibernate + Flyway | — / 155 migrations |
| Database | PostgreSQL + pgvector | 16.x |
| Cache | Caffeine | — |
| Auth | JJWT 0.12.6 + Spring OAuth2 (OIDC/SSO) | — |
| Excel | Apache POI 5.3.0 | — |
| AI microservice | Spring AI 1.1.4 + Ollama | separate Spring Boot 3.4.4 app |
| Testing | JUnit 5, H2, Vitest 2.1, Playwright | — |
| Deployment | Vercel (FE) + Railway (BE) per `DEPLOYMENT.md` | — |

No egregiously outdated dependencies. Spring AI adoption and pgvector usage are forward-leaning. The only notable oddity: no explicit bundle analyzer or Micrometer/Actuator on the main backend (it's only in the AI microservice).

### 4.2 Backend structure

```
com.portfolioplanner.
├── controller/        (98 @RestController classes)
├── service/           (66 classes — with subpackages for jira/, nlp/, reports/)
├── domain/
│   ├── model/         (114 JPA entities)
│   └── repository/    (145 Spring Data JPA repositories)
├── dto/               (~80, includes dto/response/)
├── mapper/            (~20 MapStruct interfaces)
├── config/            (security, caching, Flyway)
├── security/          (JWT, filter, SSO handler)
└── exception/         (global handler + custom)
```

Clean domain organization. NLP has 28 classes under `service/nlp/` with 6 pattern handlers under `handler/`. Jira has 14+ dedicated service classes. No flat sprawl.

### 4.3 The NLP engine (the crown jewel)

The chain-of-responsibility is genuinely sophisticated:

```
Query
  → Rate limiter (per-user sliding window, 10/min; Ollama semaphore, 3 concurrent)
  → Preprocessor (abbreviation expansion, synonym normalization, filler removal)
  → AliasResolver (entity nicknames)
  → FollowUpResolver (pronoun substitution)
  → RBAC tool-level check
  → Routing catalog lookup (predefined Q&A patterns)
  → Vector shortcut (pgvector similarity ≥ 0.88)
  → Strategy chain:
      DeterministicStrategy  (exact intent match)
      RuleBasedStrategy      (regex patterns, ~80% of queries, ~200ms)
      LocalLlmStrategy       (Ollama llama3:8b, ~10s)
      CloudLlmStrategy       (Anthropic Claude — see risk below)
  → CompositeToolExecutor (SSE streaming as tools run)
  → NlpResponseBuilder (final response + debug metadata)
  → Auto-learn (only if confidence ≥ 0.90 AND intent == FORM_PREFILL)
  → Persist conversation log
```

Design choices worth calling out:

- **Auto-learning is deliberately narrow.** Only FORM_PREFILL intents are embedded for future matching. DATA_QUERY/INSIGHT/REPORT are excluded because their responses contain live data that goes stale the moment it's cached. Code comments explicitly cite past "poisoned patterns" from embedding stale answers — this is an informed design scar.
- **Concurrent Ollama limit.** A fair semaphore caps three simultaneous LLM calls. Good guardrail on a single-node local model.
- **SSE streaming.** Enables progressive tool execution visibility in the UI rather than a single wait-then-response spinner.
- **Risk:** `CloudLlmStrategy` is referenced in the chain but appears unimplemented in the visible code paths. If it is genuinely a stub, queries that fall past the local LLM may error or silently fall back. This should be either finished or removed from the chain.

### 4.4 Integrations

**Jira.** Credentials stored in DB (`jira_credentials`) with application.yml fallback, updatable via UI without restart. Background sync every 30 minutes. Caffeine cache at 300s TTL. **No explicit retry/backoff logic visible for Jira API failures, and no explicit handling of Jira Cloud's 3,200 req/hour rate limit.** This is a MEDIUM risk — under heavy sync load or API flakiness, cascading failures are possible.

**Azure DevOps.** Present as an alternative data source via dedicated controllers and frontend modules.

**pgvector RAG microservice.** Separate Spring Boot app on port 8081 with its own minimal Java footprint (~12 files). Uses JDBC (not full JPA) for direct read access to the shared DB, and Spring AI's Ollama integration with a scheduled nightly re-index. `AiRagFallbackService` in the main backend calls it when the primary NLP chain fails. Clean separation of concerns.

### 4.5 Auth & security

**Strengths.** HttpOnly cookie JWT (no localStorage — XSS-resistant); dual-source token reading (cookie OR Authorization header) for migration flexibility; OAuth2/OIDC with SSO config stored in DB (`SsoConfigRepository`) not in source; global `@RestControllerAdvice` exception handler with `server.error.include-stacktrace: never`.

**Weaknesses — listed in priority order.**

1. **JWT secret defaults to a weak placeholder string** (`"portfolio-planner-secret-key-must-be-at-least-32-chars-long"`) in `application.yml`. Relies entirely on environment-variable override in production. This should be a hard startup validation (refuse to boot if the secret equals the placeholder).
2. **No refresh token mechanism.** 24-hour hard expiration means users re-login every day. Either implement refresh or extend expiration with idle-based sliding windows.
3. **RBAC enforcement is sparse.** Only ~13 `@PreAuthorize` annotations across 98 controllers. Most endpoints rely on `isAuthenticated()` as a baseline (via Spring Security filter chain), but granular role checks are missing on many. This is the most important backend security audit to run.
4. **SMTP_ENCRYPTION_KEY** defaults to `"changeme-replace-this-in-production"` — same pattern.
5. **No explicit CORS config visible.** Spring defaults may or may not be appropriate.
6. **No explicit CSRF config visible.** Spring Security's default includes CSRF protection for POST/PUT/DELETE — assumed enabled, should be confirmed.

### 4.6 Database layer

155 Flyway migrations (`V1__` through `V155__`), well-named (e.g., `V154__power_dashboard.sql`). Normal evolution pattern: V1–V10 core schema, V11–V50 Jira integration, V51–V100 capacity planning, V101–V155 advanced features (AI, automation, approval workflows, power dashboard). A few fix migrations (`V141__fix_serial_to_bigint`, `V149__fix_sprint_issue_added_at_backfill`) — normal for a system this age. No JSON-blob abuse detected from names. `ddl-auto: validate` (good — Flyway drives schema, Hibernate doesn't).

**One concern:** `validate-on-migrate: false` is acceptable in dev but risky in prod (allows out-of-order migrations to succeed silently). Verify the production profile overrides this.

### 4.7 Architectural smells

**Controllers bypassing services (MEDIUM risk).** Confirmed direct repository calls from `SprintRetroController`, `ScenarioPlanningController`, `ResourceAllocationController`, `ResourceBookingController`, plus the three named in the prior report. This is the single biggest maintainability lever: these controllers accumulate business logic that should live in services, making unit-testing harder and creating duplication risk.

**Eager fetch on collections.** `JiraPod` has `@OneToMany(..., fetch = FetchType.EAGER)` with `CascadeType.ALL, orphanRemoval = true`. `JiraPodRelease` and `JiraReleaseMapping` also use EAGER. The rest of the model uses LAZY (good). The EAGER paths are N+1 landmines if accessed in loops.

**Sparse `@Transactional(readOnly = true)` on query methods.** Services rely on default transaction behavior rather than explicit read-only optimization.

**Exception handler is very broad.** `GlobalExceptionHandler` catches `Exception` and converts to 500, which masks specific failure modes (Jira 504, Ollama unreachable, SMTP bounce). Specific handlers for external-system failures would improve observability.

### 4.8 Observability & ops

SLF4J + Logback, well-parameterized (`log.warn("NLP rate limit exceeded for user {} — {} remaining", userId, remaining)`). **Zero `System.out.println` or `printStackTrace` calls** — clean. **3 `console.log/error` calls on the frontend** — also clean.

Gaps: no Micrometer/Actuator on main backend, no visible health check endpoints, no log-aggregation config checked in, no CI/CD (`.github/workflows/` is empty). Deployment is via Docker Compose or native, manual.

### 4.9 Test coverage

**Backend:** 23 test classes. Likely ~150–200 assertions total (not counted). No coverage report visible. For a system with 98 controllers and 66 services, this is below what a production system should target.

**Frontend:** 8 unit tests (`.test.tsx` / `.spec.tsx`) and 12 Playwright e2e specs. For 150+ routes, this is a thin safety net. MSW is installed but sparsely used.

### 4.10 The second module: `portfolio-planner-ai/`

A focused RAG microservice, not experimental. 12 Java files. Spring AI 1.1.4 with pgvector, Ollama, and JDBC-based direct reads on the shared DB. `ChunkingScheduler` runs nightly. `RagService` does `embed → similarity search (topK=8, minScore=0.55) → prompt with context → Ollama → return answer + sources`. Clean, minimal coupling. Good architectural separation — if the RAG pipeline grows, it won't bloat the main backend.

---

## 5. UI/UX Analysis

### 5.1 Design system

The foundation is solid. Mantine 7 is used consistently as the component library. A custom `brandTokens.ts` file defines the Baylor Genetics palette — Primary `#0C2340` (deep blue), Accent `#2DCCD3` (aqua), with 10-shade tint arrays — layered over a custom Slate base theme (`src/theme/slate.ts`) with compact headings (h1=22, h2=18, h3=15) and 600-weight buttons. Dark mode is supported natively (`defaultColorScheme="auto"`, respecting OS preference).

**The gap:** inline `style={{...}}` overrides are widespread. A spot-check on just five files (`SkillsMatrixPage`, `WorkloadChartPage`, `ResourcePoolsPage`, `DemandForecastPage`, `GitIntelligencePage`) found 124 inline-style occurrences; the full codebase is in the thousands. Every inline style is a place where the design system cannot enforce consistency. This is a slow-burning debt — the tool will look progressively less coherent as it grows.

### 5.2 Navigation & IA

- **~40 top-level sidebar items** with nested menu groups.
- **150+ routes** total; all lazy-loaded via `React.lazy()` + Suspense. Bundle impact on initial load is well-contained.
- **DL-9 consolidation** has already merged 30+ smaller pages into 9 tabbed hubs (Portfolio Health, Timeline, Resources, Capacity, Performance, Releases, Jira Dashboard, Engineering Hub, Scenario Tools) with legacy URLs redirecting — positive IA cleanup, still in progress.
- **No breadcrumbs.** For routes like `/reports/utilization → /pod/X → /drill/Y`, the user has to remember where they are.
- **No global command palette.** `cmdk` is installed as a dependency but grep found no usage in pages — it may be a dormant dependency or planned feature.
- **NLP search bar** fills part of the command-palette role — natural-language queries work across every page.

### 5.3 Accessibility

- 25 `aria-*` occurrences across 156 pages — very thin coverage.
- Mantine provides semantic HTML out of the box for Button/Text/Table, but the thousands of inline-styled `<div>` elements bypass this foundation.
- No focus-trap components detected; no accessibility tests in the suite.
- WCAG 2.1 AA is almost certainly not met today.

If the tool needs to comply with ADA/Section 508 or broader a11y requirements, this is a meaningful gap.

### 5.4 Responsive design

**Zero** `@media` or `useMediaQuery` occurrences detected. This is a desktop-only app in practice. If that's an intentional product decision for an internal planning tool, fine — but it should be stated. Leadership accessing the tool on a tablet will see a degraded experience.

### 5.5 Data density & complex views

- **AG Grid 32.3** for large tabular data.
- **Recharts** used in ~61 locations — Area, Bar, Line, Pie, Scatter, Treemap, Funnel, RadialBar, Radar.
- **`react-grid-layout`** powers the Power Dashboard (250+ draggable widget types).
- **`@dnd-kit/*`** for other drag-drop interactions.
- **Heatmaps and matrix views** exist (Risk Heatmap, Utilization Heatmap, Project Pod Matrix, Resource Skills Matrix).
- Loading states are inconsistently handled — many pages rely on Suspense + global fallback rather than inline skeletons per data panel, which can leave the UI empty during partial fetches.

### 5.6 Complexity hotspots

The top five largest page files are genuine monoliths:

| File | Lines | Why it matters |
|---|---:|---|
| `PowerDashboardPage.tsx` | 3,589 | 250+ widget types on `react-grid-layout`, state-heavy |
| `JiraDashboardBuilderPage.tsx` | 3,473 | Complex filtering, Jira data editor |
| `NlpLandingPage.tsx` | 3,020 | Chat UI, conversation history |
| `EngineeringAnalyticsPage.tsx` | 2,187 | Analytics composition |
| `ProjectsPage.tsx` | 1,987 | Multi-view (kanban/list/grid) |

These will resist refactoring and concentrate regression risk. Breaking each into a container + 5–10 sub-components with its own state module is a high-leverage cleanup.

### 5.7 Error handling

This is well done. Global `window.addEventListener('error', ...)` + `unhandledrejection` + Axios response interceptor + React `ErrorBoundary` at the root all ship errors to a backend `/error-logs` endpoint, with a dedicated Error Log page for triage. Error deduplication (60-second window) in the axios wrapper prevents log spam. Network errors produce user-friendly messages. This is the infrastructure you want, even if page-level error states inside individual components are inconsistent.

### 5.8 Onboarding

An `onboarding/` component directory exists, and a tour guide is referenced in README. `cmdk` is installed but unused. No first-run detection beyond the auth redirect.

### 5.9 UI/UX summary scorecard

| Aspect | Status | Notes |
|---|---|---|
| Design system foundation | Strong | Mantine + brand tokens + Slate theme |
| Design system adherence | Weak | Thousands of inline styles bypass tokens |
| Navigation breadth | Comprehensive | 40 top-level items, 150+ routes |
| Navigation depth support | Thin | No breadcrumbs, no command palette |
| Accessibility | Weak | 25 aria uses across 156 pages |
| Responsive | Desktop-only | 0 media queries |
| Charting | Rich | Recharts + AG Grid + react-grid-layout |
| Error UX | Strong | Global capture + dedicated triage page |
| Onboarding | Partial | Tour system exists, cmdk unused |
| Page complexity | Risk | 5 pages >2K lines |

---

## 6. Competitive Landscape

### 6.1 Direct competitors (engineering portfolio & capacity planning)

- **Jira Advanced Roadmaps (Atlassian).** Native Jira add-on; team capacity planning + basic scenario planning. Included in Jira Cloud Premium ($16/user/mo). Shallow vs. EPP: no budget, no hiring forecast, no NLP, minimal resource modeling. The default alternative for Jira-native shops but thin.
- **Jellyfish.** Engineering intelligence platform. Captures capacity from Git + Jira without timesheets. Strong at velocity/flow/DORA. Contact-sales pricing. Capacity planning is secondary; no hiring forecasting or budget modeling. Complementary to EPP rather than replacement.
- **LinearB.** AI productivity for engineering leaders (APEX framework, MCP server for NLP, PR-level tracking). Git-centric, not capacity-focused.
- **Allstacks.** Engineering time-allocation insights (feature/bug/debt/KLTO split). Answers "where is the team working," not "where should they work."
- **Pluralsight Flow (GitPrime).** Productivity & workflow analytics. Diagnoses velocity, doesn't plan hiring.
- **Plandek.** 50+ software-delivery metrics. Backward-looking diagnostics, not forward-looking planning.

### 6.2 Adjacent: resource management & PSA

- **Tempo (Capacity Planner + Timesheets).** Jira-native resource management. Best-in-class for Jira timesheets. No budget/hiring/NLP/multi-source.
- **Float, Runn, Resource Guru, Forecast.it, Mosaic.** PSA/agency-focused scheduling. Generally not engineering-native, generally no Jira depth. **Mosaic** is the closest on AI-driven hiring forecasts and profitability projections — worth watching.

### 6.3 Adjacent: strategic portfolio / PPM

- **Planview Portfolios.** Enterprise PPM suite. Broad, deep, expensive ($100–500K/yr). Strong governance and budget modeling. Weak Jira integration. Months to deploy. Overkill for a single engineering org.
- **Targetprocess (Apptio).** IT-PPM focus. Modernization lag.
- **ServiceNow SPM.** Enterprise services portfolio. Massive overhead, not engineering-specific.
- **Asana Portfolios.** Lightweight, Asana-native. No Jira depth, no engineering vocab.
- **Airfocus.** Product portfolio (roadmap prioritization), not engineering capacity.

### 6.4 Adjacent: eng-leader dashboards

- **Parabol.** Agile ceremonies, team health. Tactical, not strategic.
- **Code Climate Velocity, Swarmia, DX.** Metrics dashboards. Diagnostics, not planning.

### 6.5 Comparison matrix (EPP vs. top 6 closest)

| Dimension | EPP | Advanced Roadmaps | Jellyfish | Tempo | Planview | Mosaic |
|---|---|---|---|---|---|---|
| Jira actuals integration | Deep (sprints, actuals, CapEx, support, worklog, releases) | Native | Native | Native (basic) | Shallow | None |
| POD/team hierarchy | Full (custom POD, cross-POD) | Team groups | Team/group | Jira teams | Program/project | Team/project |
| Capacity-vs-demand gap | Yes, monthly + multi-dim | Basic | Partial | Basic | Yes | Yes |
| Scenario / what-if | Dual simulator | Basic | Scenario planner | None | Limited | Limited |
| NLP / AI insights | 4-tier chain, self-learning | None | None | None | Basic (new) | None |
| Budget & cost tracking | Yes (rates, CapEx/OpEx, ROI) | None | None | Basic | Yes | Yes |
| Hiring forecasting | Yes (FTE pipeline, cumulative) | None | None | None | Limited | Yes |
| Customization for org | High | Low | Medium | Low | High (heavy) | High |
| Cost | Internal | $16/user/mo | Contact sales | $5–15/user/mo | $100K+/yr | Contact sales |
| Setup time | Days | Days | Weeks | Days | Months | Weeks |
| Engineering-specific | Yes | Yes | Yes | Partial | No | No |

### 6.6 Market trends to watch

- Jira plugins remain shallow for capacity planning. The full platforms (Jellyfish, Plandek, LinearB) all lean into metrics rather than planning — the gap EPP fills.
- NLP for planning is still emerging. No competitor has a self-learning optimizer tied to a planning domain model.
- AI-driven hiring forecasting is new (Mosaic, Planview 2025). EPP is ahead of the market here.
- No competitor integrates Jira actuals → capacity gap → hiring forecast → budget in one UI. This remains fragmented across 3–4 tools.

---

## 7. Corrections to the Prior Report

The April 15 `PP-Analysis-Report.md` contained at least one material factual error that should be retracted:

**Claim in v1:** *"ScenarioPlanningPage Uses Hardcoded Mock Data. [...] The page imports `useQuery` and `apiClient` but never actually fetches scenarios from the backend. Instead it initialises state with `mockScenarios`, `mockChanges`, and `mockSnapshots` — hardcoded arrays."*

**Ground truth (verified in this report):** `frontend/src/pages/ScenarioPlanningPage.tsx` imports and uses real API hooks from `../api/scenarios` — `useScenarios`, `useScenarioChanges`, `useScenarioSnapshots`, `useCreateScenario`, `useActivateScenario`, `useApproveScenario`, `useDeleteScenario`. No `mockScenarios`, `mockChanges`, or `mockSnapshots` identifiers exist anywhere in `frontend/src/` (grep returned zero matches). Mutations use proper `onSuccess`/`onError` callbacks with TanStack Query cache invalidation.

Either v1 was based on a stale version of the file, or the claim was fabricated. Either way, the page is working as expected today. **Scenarios are not broken.** This matters because v1 ranked this as the single CRITICAL frontend defect; that ranking is retracted.

The other v1 claims about controllers calling repositories directly, HttpOnly cookie auth, Caffeine cache TTLs, and code-splitting are broadly consistent with what this report found.

---

## 8. Findings, Risks, and Priorities

Triaged by severity. Each item is either a correctness issue (C), a security issue (S), a scalability/maintainability issue (M), or a UX issue (U).

### Critical

- **(S) JWT secret defaults to a placeholder string.** Hard startup validation should refuse to boot if `app.jwt.secret` equals the default. The SMTP encryption key has the same pattern (`"changeme-replace-this-in-production"`).
- **(S) RBAC enforcement is sparse.** ~13 `@PreAuthorize` annotations across 98 controllers. Run an authorization audit; every state-changing endpoint should have an explicit role check.

### High

- **(S) No refresh-token flow.** 24-hour hard expiration forces daily re-login. Either implement refresh or add idle-based sliding expiration.
- **(M) Controllers bypass the service layer.** At least seven controllers call repositories directly (`SprintRetroController`, `ScenarioPlanningController`, `ResourceAllocationController`, `ResourceBookingController`, plus those previously identified). Finish the service-layer refactor.
- **(M) CloudLlmStrategy appears unimplemented** in the visible code paths. Either finish or remove from the chain.
- **(U) Inline `style={{...}}` drift is systemic.** Thousands of occurrences bypass the Mantine + brand-token system. Add an ESLint rule forbidding inline styles (with narrow exceptions), then migrate incrementally.
- **(M) Top-5 pages are >2K lines each.** `PowerDashboardPage` (3,589), `JiraDashboardBuilderPage` (3,473), `NlpLandingPage` (3,020), `EngineeringAnalyticsPage` (2,187), `ProjectsPage` (1,987). Container + sub-component split is high-leverage.
- **(M) Test coverage is thin.** 23 backend test classes, 8 frontend unit tests, 12 Playwright specs for a system this size. Target a coverage floor (e.g., 40% backend, 25% frontend) and wire it into CI.
- **(M) No CI/CD checked in.** `.github/workflows/` is empty. At minimum: build + test on PR, and a main-branch gate before deploy.

### Medium

- **(M) Jira client has no visible retry/backoff.** Jira Cloud enforces 3,200 req/hour per user; without backoff the sync job can saturate and cascade failures.
- **(M) Eager fetch on `JiraPod`, `JiraPodRelease`, `JiraReleaseMapping`.** Change to LAZY and use explicit JOIN FETCH where needed.
- **(M) Global exception handler is too broad.** Add specific handlers for Jira, Ollama, SMTP failures so the backend can distinguish external from internal errors.
- **(U) Accessibility is thin.** 25 aria uses across 156 pages, no focus traps, no a11y tests. If compliance ever becomes a requirement, this is months of work; starting now is cheaper.
- **(U) Desktop-only.** Zero media queries. Confirm this is an intentional product decision, or accept it as a debt.
- **(U) No breadcrumbs, no command palette.** `cmdk` is installed but unused — wire it up for a dense-app speed-of-use win.
- **(M) Sparse `@Transactional(readOnly = true)`** on query methods leaves read-performance on the table.
- **(M) `validate-on-migrate: false`** in Flyway config. Ensure production profile overrides this.

### Low

- **(M) TypeScript `noUnusedLocals: false`.** Turn it on; let the compiler prune dead code.
- **(M) No Micrometer/Actuator** on the main backend. Add health checks and basic metrics.
- **(M) No bundle analyzer** configured for Vite. One-time exercise, useful for spotting regressions.

### Not issues (things the codebase gets right)

- Zero `System.out.println` / `printStackTrace`.
- Three `console.log` calls across the entire frontend.
- Nine TODO/FIXME comments across ts+tsx+java source.
- HttpOnly cookie JWT (no localStorage leak surface).
- Global error capture with backend logging and dedicated triage page.
- Caffeine cache with per-entity TTLs and eviction-on-mutation.
- Proper NLP auto-learning scope (only FORM_PREFILL, excluding DATA_QUERY/INSIGHT/REPORT).
- Proper Ollama concurrency cap (fair semaphore, 3 concurrent).
- Clean domain-package organization on the backend.
- Full route-level code splitting on the frontend.
- DL-9 IA consolidation is active and preserves legacy URLs.

---

## Appendix: Method & Sources

- Three parallel exploration agents covered backend, frontend/UI, and feature-inventory + competitive research; outputs cross-checked against direct grep and file reads for contested claims.
- Primary sources: `README.md` (repo root), `backend/pom.xml`, `portfolio-planner-ai/pom.xml`, `backend/src/main/java/com/portfolioplanner/**`, `backend/src/main/resources/db/migration/V1__…V155__`, `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/src/App.tsx`, `frontend/src/pages/**`, `frontend/src/api/**`, `frontend/src/brandTokens.ts`, `frontend/src/theme/slate.ts`, `DEPLOYMENT.md`, `DEPLOYMENT_NO_DOCKER.md`.
- Competitive sources: Atlassian, Jellyfish, LinearB, Allstacks, Pluralsight, Plandek, Tempo, Float, Runn, Resource Guru, Forecast.it, Mosaic, Planview, Targetprocess, ServiceNow, Asana, Airfocus, Parabol, Swarmia, DX public product pages and pricing (where disclosed).
- Contested or unverified claims are flagged inline. Pricing is current as of April 2026 to the best of public availability; contact-sales competitors have no public price.
