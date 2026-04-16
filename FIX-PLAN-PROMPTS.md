# Engineering Portfolio Planner — Sequenced Fix Plan

**Companion to:** `PP-Analysis-Report-v2.md`
**Purpose:** A sequenced list of ready-to-paste prompts for Claude Code to execute, one at a time. Each prompt is self-contained, scopes exactly what to change, names what NOT to touch, and includes verification steps so we don't break what's working.

---

## How to use this document

1. **Do the phases in order.** Phase 0 is non-negotiable — it builds the local safety net (`scripts/verify.sh` + git hooks) that catches regressions introduced by later phases.
2. **One prompt per branch.** Each prompt is a single, reviewable change. Don't combine. Merge to main only after self-review.
3. **Paste the "Prompt to copy" block verbatim** into Claude Code. The prompt already includes context, scope, non-goals, and a test checklist — don't abbreviate it.
4. **Verify before merging.** Each prompt ends with a verification checklist. All items must pass. `./scripts/verify.sh` must be green. If any fail, don't merge — either fix forward in the same branch or `git reset` back to a clean state and start over.
5. **Commit style.** Conventional Commits (`fix(auth): …`, `refactor(controller): …`, `chore(tooling): …`). One logical change per commit.
6. **Never skip the "Non-goals" section** when pasting — it's what prevents scope creep.
7. **No hosted CI yet — everything is local.** Git pre-commit and pre-push hooks (set up in Phase 0) will run `verify.sh` automatically. Do not bypass with `--no-verify`.
8. **New tests are deferred to Phase 7.** The product is still evolving — writing tests against contracts that will change is wasteful. Every prompt below keeps this rule: *existing tests must still pass*, but **do not author new tests** per feature/fix. A dedicated hardening pass at the end (Phase 7) catches up on coverage once the shape is stable. Exceptions: if a prompt explicitly calls out a security regression test, write it.

### Universal guardrails — applied to every prompt

Every prompt below inherits these rules. Do not remove them when pasting.

> **Universal rules for every task:**
> 1. Do not modify unrelated files. If you discover another bug or smell, log it as a TODO and move on.
> 2. Do not upgrade any dependency unless the task explicitly requires it.
> 3. Do not refactor code outside the declared scope, even if it looks tempting.
> 4. Every change must compile cleanly before you stop — the single check that matters is `./scripts/verify.sh` (from the repo root).
> 5. Preserve all existing tests. If a test breaks, the fix is almost certainly wrong — investigate, don't delete the test.
> 6. **Do NOT author new tests.** The product is still evolving; test work is deferred to Phase 7. Keep existing tests green as a regression guard — that is the full bar. (Exception: if a prompt explicitly requests a security regression test, write that one.)
> 7. Before finishing, run `./scripts/verify.sh` (default level). For anything touching a high-traffic page or security-sensitive code, run `./scripts/verify.sh --full` to include Playwright e2e.
> 8. Provide a commit message and a short change summary (scope, test results, risk) — since there's no PR-review tool today, this goes in the commit body and/or a local `CHANGES-<branch>.md` file that's deleted after merge.

---

## Phase 0 — Safety net (do this first, in order)

These three prompts build the foundation. Skipping them means later phases have no objective way to prove they didn't regress anything.

> **Note on environment.** This project currently runs locally — no GitHub Actions, no hosted CI. Phase 0 therefore builds a **local-first safety net**: a single `scripts/verify.sh` script that acts as our "CI," plus git hooks that run it automatically before commit and push. Everywhere later prompts say "verify script passes," they mean a clean run of `scripts/verify.sh`. If you ever move to hosted CI (GitHub Actions, GitLab CI, etc.), the same script is the thing to invoke from the workflow.

### Prompt 0.1: Build the local verification script + git hooks

**Priority:** Critical (blocking)
**Estimated time:** 2–3 hours
**Prereqs:** none

#### Context
There is no CI today — everything is local. Every subsequent prompt relies on a repeatable "is this green?" signal to catch regressions. We build it once, locally, so every fix PR has a single command to trust.

#### Prompt to copy

```
Set up a local verification pipeline. Deliverables: (A) a single master script that runs everything, (B) git hooks that invoke it automatically, (C) a way to skip slow checks for fast iteration.

A. Create `scripts/verify.sh` at the repo root (make it executable, `chmod +x`). It must:

1. Accept these flags:
   - `--fast`  → run lint + compile only (no tests). Target runtime <30s.
   - `--full`  → run everything including Playwright e2e. Target runtime <10 min.
   - (no flag) → run backend build+test + frontend build+test. Target runtime <5 min. This is the default "pre-push" level.

2. Run in this order, fail-fast on first error, print a clear section header for each step:
   Step 1: Backend compile        → ./mvnw -pl backend,portfolio-planner-ai compile -q
   Step 2: Backend tests          → ./mvnw -pl backend,portfolio-planner-ai test -q    (skip if --fast)
   Step 3: Frontend lint          → (cd frontend && npm run lint)    (add "lint": "eslint src --max-warnings 9999" to package.json if missing — set to 9999 to not fail on existing warnings; we'll lower this gate over time)
   Step 4: Frontend typecheck     → (cd frontend && npx tsc -b --noEmit)
   Step 5: Frontend unit tests    → (cd frontend && npm test -- --run)    (skip if --fast)
   Step 6: Frontend build         → (cd frontend && npm run build)
   Step 7: Playwright e2e         → (cd frontend && npm run test:e2e)    (only if --full)

3. Prints a final summary:
   ✓ PASS  (duration: Xm Ys)
   OR
   ✗ FAIL at step N: <step name>
     <last 20 lines of the failing command's output>

4. Writes a machine-readable result to `.verify-last-run.json` at repo root (in .gitignore):
   { "timestamp": "...", "result": "pass"|"fail", "failed_step": null | "...", "duration_seconds": N }

5. Exits with code 0 on pass, 1 on fail.

B. Install git hooks using Husky:
   - `cd frontend && npm install --save-dev husky lint-staged` (install in frontend since that's where the package.json is; alternatively put it at the repo root — pick whichever is cleanest).
   - Initialize: `npx husky init`.
   - Create `.husky/pre-commit` that runs `./scripts/verify.sh --fast`. (Fast gate: lint + compile only, keeps commits snappy.)
   - Create `.husky/pre-push` that runs `./scripts/verify.sh`. (Default gate: full build + unit tests. Blocks push if red.)

C. Add `.verify-last-run.json` to `.gitignore`.

D. Add two npm scripts to `frontend/package.json` for convenience:
   - `"verify": "cd .. && ./scripts/verify.sh"`
   - `"verify:full": "cd .. && ./scripts/verify.sh --full"`

E. Update README's "Getting Started" section with a new subsection "Before committing":
   "Run `./scripts/verify.sh` before every push. Git hooks enforce this automatically. To run slow e2e checks too, use `--full`. Do not bypass hooks with `--no-verify`."

Non-goals:
- Do not add GitHub Actions or any hosted CI.
- Do not modify any existing code under backend/, frontend/, or portfolio-planner-ai/.
- Do not add branch-protection or require-reviews rules (no hosted SCM assumed).
- Do not remove any existing npm/maven scripts.

Verification:
- Run `./scripts/verify.sh` on the current main branch. It MUST pass.
- If it fails on main as-is, STOP. We have a pre-existing breakage that needs diagnosis first — fix is NOT part of this PR. Report back with the failing step and output.
- Make a trivial commit (whitespace) and confirm the pre-commit hook runs `--fast`.
- Attempt `git push` and confirm the pre-push hook runs the default gate.
- Try `git commit --no-verify` — this works by design (an escape hatch) but must be forbidden by team convention, not tooling.

Commit: `chore(tooling): add local verify.sh and git hooks for pre-commit/pre-push`
```

#### Verification checklist
- [ ] `./scripts/verify.sh` passes on main.
- [ ] `./scripts/verify.sh --fast` runs in <30s.
- [ ] `./scripts/verify.sh --full` runs (may take longer) and passes.
- [ ] Pre-commit hook fires on a test commit.
- [ ] Pre-push hook fires on a test push.
- [ ] `.verify-last-run.json` is gitignored.

---

### Prompt 0.2: Test-coverage baseline — **DEFERRED to Phase 7**

**Status:** Deferred. Moved to Phase 7 (Test hardening) because the product is still evolving and we are not authoring new tests per PR. A coverage baseline captured now would need to be re-captured anyway once contracts settle. Skip and proceed to 0.3.

---

### Prompt 0.3: Document engineering guardrails

**Priority:** High
**Estimated time:** 30 min
**Prereqs:** none

#### Prompt to copy

```
Create `/CONTRIBUTING.md` at the repo root with the following sections. Write it tersely — aim for <200 lines total. Use real examples from this codebase.

Sections:

1. **Branch & PR conventions**
   - Branch naming: `fix/`, `feat/`, `refactor/`, `chore/`, `docs/` prefixes.
   - Conventional Commits for commit messages.
   - One logical change per PR; no mixed refactor + feature.

2. **Backend rules**
   - Controllers must NOT call repositories directly. All data access goes through a service.
   - Every state-changing endpoint MUST have an explicit `@PreAuthorize` with the minimum role required.
   - New entities and query methods should default to `FetchType.LAZY` and `@Transactional(readOnly = true)`.
   - Secrets never go in `application.yml` except as env-var placeholders (`${JWT_SECRET}`). Defaults must fail-loud if unset in production profile.
   - Log via SLF4J; never `System.out.println` or `e.printStackTrace()`.

3. **Frontend rules**
   - Use Mantine components and the `brandTokens.ts` palette. Inline `style={{...}}` is forbidden except for dynamic layout values that cannot be expressed in Mantine props.
   - All new pages must be lazy-loaded via `React.lazy()` in `App.tsx`.
   - Use TanStack Query for all server state; do not store server data in local state.
   - Forms use Mantine's `useForm`; validation errors surface via Mantine's notification system.
   - Every page must handle loading, error, and empty states.

4. **Testing expectations (current posture)**
   - We are in a rapid-evolution phase — **new tests are deferred to a dedicated Phase 7 "Test hardening" pass** once the product stabilizes.
   - Every PR's bar is: *existing tests must still pass.* Do not author new tests per feature/fix.
   - Security-sensitive changes are the ONE exception — add a regression test when a change closes an auth/authz hole.
   - Do not disable existing tests to make `scripts/verify.sh` pass. Fix the code.

5. **What NOT to do**
   - Do not upgrade dependencies in unrelated PRs.
   - Do not re-introduce `mockData` or hardcoded fixtures in page components.
   - Do not disable existing tests to make a PR pass.
   - Do not bypass `scripts/verify.sh`; if it's red, fix the root cause.
   - Do not write new tests outside Phase 7 except in the explicit security-regression case above.

Also add an ESLint rule to flag inline styles — append to the existing ESLint config:
   `"react/forbid-dom-props": ["warn", { "forbid": ["style"] }]`
Set it to `warn` (not `error`) for now so we can migrate incrementally.

Non-goals:
- Do not attempt to migrate any inline styles in this PR.
- Do not modify any business-logic code.

Verification:
- `CONTRIBUTING.md` exists at the repo root.
- ESLint runs cleanly (with warnings expected) on the existing codebase.
- `./scripts/verify.sh` still passes.

Commit: `docs: add CONTRIBUTING.md and lint rule for inline styles`
```

---

## Phase 1 — Critical security

### Prompt 1.1: Harden JWT & SMTP secret handling

**Priority:** Critical
**Estimated time:** 2–3 hours
**Prereqs:** 0.1, 0.2

#### Context
`app.jwt.secret` defaults to a placeholder in `application.yml`. `SMTP_ENCRYPTION_KEY` defaults to `"changeme-replace-this-in-production"`. Either default makes it possible to deploy a boot-able server with insecure secrets. Fix: refuse to start if a production profile is active and secrets equal placeholder values.

#### Prompt to copy

```
Harden secret configuration so the backend refuses to start with placeholder values in a production profile.

Scope:
1. Locate the JWT config class (likely `JwtUtil` or a `@ConfigurationProperties` class binding `app.jwt.*`).
2. Add a `@PostConstruct` (or `SmartInitializingSingleton`) validator that:
   - Reads the active Spring profile via `Environment`.
   - If any profile in { "prod", "production", "railway" } is active AND the secret equals any known placeholder string ("portfolio-planner-secret-key-must-be-at-least-32-chars-long" OR contains "changeme" OR is shorter than 32 chars), throw IllegalStateException with a clear message and prevent startup.
   - In non-prod profiles, log a WARN but allow startup (so dev isn't blocked).

3. Do the same for the SMTP encryption key: find where `SMTP_ENCRYPTION_KEY` is read. Apply the same validator. Placeholder includes "changeme-replace-this-in-production".

4. Update `application.yml` to remove the literal placeholder strings and replace with `${JWT_SECRET:#{null}}` and `${SMTP_ENCRYPTION_KEY:#{null}}`. Null values in prod must fail the validator above.

5. Update `README.md` and `DEPLOYMENT.md` to document the required env vars under "Required environment variables in production" with a one-line warning: "App will refuse to start without these."

Non-goals:
- Do not rotate or change the actual secret values used in any deployed environment.
- Do not touch JWT signing logic, cookie handling, or session expiration.
- Do not change any other config properties.
- Do not add a new encryption library.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: assert context-fail-to-start on placeholder secret in prod profile; assert context-starts on valid 32+ char secret.)
- Existing tests must still pass.

Verification:
- `./mvnw -pl backend test` passes (existing suite only).
- Locally: `SPRING_PROFILES_ACTIVE=prod ./mvnw -pl backend spring-boot:run` fails to start with no JWT_SECRET.
- Locally: `SPRING_PROFILES_ACTIVE=prod JWT_SECRET=$(openssl rand -hex 32) SMTP_ENCRYPTION_KEY=$(openssl rand -hex 32) ./mvnw -pl backend spring-boot:run` starts cleanly.
- Frontend behavior is unchanged (it should still connect in dev).

Commit: `fix(security): refuse startup in prod profile with placeholder JWT/SMTP secrets`
```

---

### Prompt 1.2: RBAC audit — enforce `@PreAuthorize` on every state-changing endpoint

**Priority:** Critical
**Estimated time:** 1–2 days (audit + implementation)
**Prereqs:** 1.1

#### Context
Only ~13 `@PreAuthorize` annotations exist across 98 controllers. This is the highest-impact security fix.

#### Prompt to copy

```
Audit and enforce authorization on every state-changing REST endpoint.

Step 1 — Audit (output only, no code changes yet):
- Enumerate every @RestController class. For each @RequestMapping/@GetMapping/@PostMapping/@PutMapping/@DeleteMapping/@PatchMapping method, record:
  (controller, http method, path, current @PreAuthorize if any, required role per business intent)
- Produce this as a Markdown table at `docs/rbac-audit.md`, committed in the same branch.
- Flag each method as one of: AUTHENTICATED_OK (read-only, all logged-in users), ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_USER_SPECIFIC (needs ownership check).
- Stop here and ask me to review `docs/rbac-audit.md` before proceeding to Step 2. DO NOT continue until I approve.

Step 2 — Implementation (only after I approve the audit):
- For each unprotected state-changing method (POST/PUT/PATCH/DELETE), add the minimum-necessary @PreAuthorize per the audit.
- For GET methods that return cross-tenant or sensitive data, add @PreAuthorize too.
- Use SpEL for ownership checks where relevant (e.g., `@PreAuthorize("hasRole('USER') and #userId == authentication.principal.id")`).
- **Security exception to the "no new tests" rule:** Add ONE lean parameterized integration test (`RbacEnforcementTest.java`) that walks a representative sample of endpoints and asserts 401 for anonymous / 403 for wrong-role / 2xx for correct role using Spring Security Test's `@WithMockUser`. Aim for ~20 endpoints in a single data-driven test, not 20 test classes. This is the *only* new test we write in this prompt — do not expand.

Non-goals:
- Do not change existing business logic inside any endpoint.
- Do not refactor controller classes (that's Phase 2).
- Do not change the role model itself (ADMIN / SUPER_ADMIN / USER hierarchy stays as-is).
- Do not touch UI permission filters.
- Do not write per-controller test classes — only the one consolidated RBAC test.

Verification:
- `docs/rbac-audit.md` exists and was reviewed.
- Every mutating endpoint has @PreAuthorize.
- The single `RbacEnforcementTest` proves 401 / 403 / 2xx paths across ≥20 endpoints.
- All existing tests still pass.
- Manual smoke test: log in as a non-admin user and confirm admin-only pages return 403, not a blank UI.

Commit message: `fix(security): enforce @PreAuthorize on all state-changing endpoints`
```

---

## Phase 2 — Architecture refactor

### Prompt 2.1: Add refresh-token flow

**Priority:** High
**Estimated time:** 1–2 days
**Prereqs:** 1.1

#### Prompt to copy

```
Add a refresh-token flow to replace the current 24-hour hard-expiration JWT.

Design:
- Access token: short-lived (15 min), as HttpOnly cookie. Same signing mechanism as today.
- Refresh token: long-lived (30 days), as HttpOnly, SameSite=Strict, Path=/api/auth cookie. Signed separately or stored in DB with a hash lookup.
- `/api/auth/refresh` endpoint: reads refresh cookie, validates, issues a new access token and rotates the refresh token.
- Frontend Axios interceptor: on 401, calls `/api/auth/refresh` once; if it succeeds, retries the original request; if it fails, calls existing `fireAuthExpired()`.

Scope:
1. Backend:
   - Create `refresh_tokens` table via a new Flyway migration (V156__create_refresh_tokens.sql): columns (id BIGSERIAL, user_id BIGINT, token_hash VARCHAR(255), issued_at TIMESTAMP, expires_at TIMESTAMP, revoked BOOLEAN, user_agent VARCHAR(500)). Indexes on (user_id) and (token_hash).
   - Service: `RefreshTokenService` with issue(userId), rotate(oldToken), revoke(userId), validate(token). Use SecureRandom + SHA-256 hash stored; never store raw tokens.
   - Controller: `AuthController` — add `POST /api/auth/refresh`, `POST /api/auth/logout-all`. Modify existing login to issue both cookies.
   - JwtUtil: reduce access-token expiration to 15 min. Keep existing 24h config as fallback if feature flag disabled.
   - Add a feature flag `app.auth.refresh-token-enabled` defaulting to true in dev and prod.

2. Frontend:
   - `api/client.ts`: add 401-interceptor logic described above. Use a per-request "has retried" flag to prevent infinite loops.
   - Ensure the refresh request goes to `/api/auth/refresh` with `withCredentials: true`.

Non-goals:
- Do not change the existing login flow's credentials check.
- Do not change SSO/OIDC flows.
- Do not store raw refresh tokens in the DB (only hashes).
- Do not change the role model.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: RefreshTokenService unit tests [issue/rotate/revoke/validate]; integration test for the full login→expire→refresh→rotate loop; frontend Vitest test for the axios 401-interceptor.)
- Existing tests must still pass.

Verification:
- Run all existing auth tests; all pass.
- Manual: log in, wait 16 min, click a protected action — it should succeed silently via auto-refresh, not redirect to login.
- Manual: delete the access cookie in DevTools, click something — same as above.
- Manual: delete both cookies, click something — redirect to login as today.
- `./scripts/verify.sh` passes.

Commit: `feat(auth): add refresh-token flow with 15-min access + 30-day rotating refresh`
```

---

### Prompt 2.2: Move business logic from controllers to services (service-layer refactor)

**Priority:** High
**Estimated time:** 2–3 days, one PR per controller
**Prereqs:** 0.1, 0.2, 1.2

#### Context
Known offenders: `SprintRetroController`, `ScenarioPlanningController`, `ResourceAllocationController`, `ResourceBookingController`, `ProductivityMetricsController`, `ExecSummaryController`, `DashboardQueryController`. Do them one at a time — **never all at once**.

#### Prompt to copy (run this once per controller)

```
Refactor ONE controller — <CONTROLLER_NAME> — to delegate all business logic to a service. The controller should end up with:
- Request deserialization
- @PreAuthorize checks
- Service invocation
- Response serialization (via MapStruct mapper or a DTO constructor)
- HTTP status code selection

Nothing else. No repository calls, no loops, no transformations, no transaction boundaries.

Procedure:
1. Read the controller file <CONTROLLER_NAME>.java end-to-end.
2. For each endpoint, identify logic that is NOT one of the five responsibilities above — this is the logic to move.
3. If a corresponding service exists (e.g., SprintRetroService for SprintRetroController), add methods there. If not, create one under the same package pattern (`service/`).
4. Move repository dependencies from the controller to the service. Controller should no longer import any `*Repository` class.
5. Where the controller did multi-step work inside a single method, wrap the moved service method in `@Transactional`.
6. For read-heavy service methods, use `@Transactional(readOnly = true)`.
7. Keep public API identical: same paths, same HTTP methods, same request/response DTO shapes. Zero breaking changes.

Non-goals:
- Do not refactor any other controller in this PR.
- Do not change any DTO shape.
- Do not change any SQL or JPQL query.
- Do not "clean up" unrelated code you notice.
- Do not rename methods or classes.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: per-moved-method smoke test at the service level; `@WebMvcTest` coverage confirming controller→service delegation and status/body shape.)
- Run the full existing backend test suite — it must stay green. If any existing test breaks, your refactor is wrong (likely dropped a transaction boundary or changed a DTO).

Verification:
- `./scripts/verify.sh` passes.
- Diff-check: controller file no longer imports `*Repository`.
- Manual regression: exercise 2–3 representative endpoints from the refactored controller via Bruno (the API collection in `/bruno`) and confirm same response as before.

Commit: `refactor(<domain>): move <CONTROLLER_NAME> logic into service layer`

Run this prompt once per controller. Do NOT batch them.
```

---

### Prompt 2.3: `CloudLlmStrategy` — implement or remove

**Priority:** High
**Estimated time:** 3–5 days if implementing; 2 hours if removing
**Prereqs:** 0.1

#### Prompt to copy

```
Decide the fate of CloudLlmStrategy in the NLP chain. Step 1: investigate. Step 2: act.

Step 1 — Investigation (NO code changes):
- Read NlpStrategyEngine and any class implementing CloudLlmStrategy or similarly-named strategy.
- Determine: is CloudLlmStrategy currently wired into the chain? Does it have a working implementation, a stub, or nothing?
- Check logs/telemetry mentions in the code that suggest it's being hit in production.
- Look at configuration for cloud LLM API keys (likely Anthropic).
- Post findings in the PR description as a short report (<300 words). STOP HERE and ask me whether to (A) implement it fully or (B) remove it from the chain. Do not proceed to Step 2 without my decision.

Step 2A — If I say "implement":
- Implement CloudLlmStrategy against Anthropic Claude via the official Java SDK or a thin HTTP client.
- Add config: `app.nlp.cloud.enabled`, `app.nlp.cloud.api-key`, `app.nlp.cloud.model`, `app.nlp.cloud.timeout-ms`, `app.nlp.cloud.max-retries`.
- Apply same rate limiting as Ollama (semaphore, per-user quotas).
- Stream responses via SSE into the existing NlpService pipeline.
- Fallback: if cloud LLM fails, log a WARN and degrade to the existing "sorry, can't answer" response — do NOT silently retry the local LLM.
- **Tests deferred** — do not add an integration test for this in-PR. (Logged for Phase 7: mock-HTTP-server integration test covering happy path + retry/backoff + final-failure degradation.)

Step 2B — If I say "remove":
- Remove CloudLlmStrategy from NlpStrategyEngine's chain.
- Delete the class and any related config.
- Update NLP Settings page to remove the "Cloud LLM" toggle.
- Update README's NLP section to reflect a 3-tier chain (rule-based → vector → local LLM), not 4-tier.

Non-goals:
- Do not modify other strategies (Deterministic, RuleBased, LocalLlm).
- Do not change pgvector threshold (0.88) or auto-learn threshold (0.90).
- Do not change the rate limiter.

Verification:
- `./scripts/verify.sh` passes.
- Manual: submit 10 NLP queries of varying complexity and confirm the chain behaves as documented (either path A or path B).
- NLP Optimizer dashboard still loads and records queries correctly.

Commit: either `feat(nlp): implement CloudLlmStrategy backed by Anthropic Claude` OR `refactor(nlp): remove unimplemented CloudLlmStrategy from chain`
```

---

## Phase 3 — Data & performance

### Prompt 3.1: Fix eager-fetch landmines on Jira entities

**Priority:** Medium
**Estimated time:** 1 day
**Prereqs:** 0.1

#### Prompt to copy

```
Convert remaining `FetchType.EAGER` relationships to LAZY on Jira-related JPA entities.

Known offenders (verify each — don't touch anything that isn't confirmed EAGER):
- `JiraPod` — `@OneToMany(..., fetch = FetchType.EAGER)` collection
- `JiraPodRelease` — EAGER
- `JiraReleaseMapping` — EAGER

Procedure (per entity):
1. Change to LAZY.
2. Run the test suite. Any test that now fails with LazyInitializationException points to a service method that accessed the relationship outside a transaction boundary — fix that method by either:
   - Wrapping the access in `@Transactional(readOnly = true)`.
   - Using an explicit JOIN FETCH in the query.
   - Loading the child collection explicitly in the service before returning the DTO.
3. Do NOT "fix" LazyInitializationException by reverting to EAGER.
4. Add a `@NamedEntityGraph` or JPQL `JOIN FETCH` variant for each call site that actually needs the collection eagerly.

Non-goals:
- Do not change any non-Jira entity.
- Do not add/remove any column or table.
- Do not change DTO shapes.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: per-touched-service-method, assert the relationship collection loads correctly via a service call within a transaction.)
- Existing tests stay green — any LazyInitializationException in the existing suite points to a real bug you just exposed; fix the service method, don't revert to EAGER.

Verification:
- Load heaviest Jira report pages manually: Jira Dashboard Builder, Jira Analytics, Pod Project Matrix. Confirm they still render correctly.
- Check application logs for "no Session" or "LazyInitializationException" warnings — there should be none.

Commit: `perf(jira): convert EAGER fetches to LAZY with explicit JOIN FETCH where needed`
```

---

### Prompt 3.2: Add retry/backoff to Jira client

**Priority:** Medium
**Estimated time:** 1 day
**Prereqs:** 0.1

#### Prompt to copy

```
Add HTTP retry, exponential backoff, and rate-limit awareness to the Jira client.

Target: Every Jira HTTP call in service/jira/*Service.java classes.

Use Spring Retry (or Resilience4j — pick whichever is already in the pom; if neither, add Spring Retry).

Configuration:
- Max retries: 3
- Backoff: exponential, base 500ms, max 8s
- Retry only on: IOException, SocketTimeoutException, HTTP 429, HTTP 5xx (except 501).
- On 429: honor the Retry-After header if present; fall back to exponential backoff otherwise.
- Circuit breaker: optional in this PR — if you add it, default to closed (no behavior change) and open after 10 consecutive failures within 60s.

Wire retry around the HTTP call site (not the whole service method). A sync job fetching 500 issues should not retry the entire batch on one failure.

Log every retry attempt at WARN with: endpoint, attempt number, error class, next-retry-ms.

Non-goals:
- Do not change the sync schedule (`@Scheduled` interval stays 30 min).
- Do not change Jira data model or DB schema.
- Do not change credential handling.
- Do not change the Caffeine cache.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: WireMock-based retry-behavior tests covering 429 with Retry-After, 5xx, connection-reset, and total-bounded-time assertions.)
- Existing tests must still pass.

Verification:
- Turn off the Jira mock / actual Jira briefly in a staging environment and confirm sync job doesn't crash — it should log retries and give up gracefully.
- Existing Jira pages still work.

Commit: `feat(jira): add retry + exponential backoff with Retry-After honoring`
```

---

### Prompt 3.3: `@Transactional(readOnly = true)` sweep on query services

**Priority:** Low-Medium
**Estimated time:** 0.5 day
**Prereqs:** 2.2 (service layer must be clean first)

#### Prompt to copy

```
Add `@Transactional(readOnly = true)` to all query (non-mutating) service methods.

Procedure:
1. For each service class under `service/`:
   - Class-level: if >80% of methods are read-only, annotate the class `@Transactional(readOnly = true)` and override write methods with `@Transactional`.
   - Else: annotate individual read methods `@Transactional(readOnly = true)`.
2. Do NOT change behavior of any write method — just ensure it has a non-read-only @Transactional if it doesn't already.

Non-goals:
- Do not change any controller.
- Do not add new queries.
- Do not touch the NLP strategy chain.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: none specifically needed; the readOnly sweep is a pure annotation pass whose correctness is proven by the existing green suite + manual Hibernate-log spot check.)
- Existing test suite must stay green.
- Spot-check a read endpoint with DEBUG Hibernate logging enabled — connection should be marked read-only.

Commit: `perf(services): add @Transactional(readOnly = true) to query methods`
```

---

## Phase 4 — Observability

### Prompt 4.1: Add Actuator + Micrometer on main backend

**Priority:** Medium
**Estimated time:** 0.5 day
**Prereqs:** 0.1

#### Prompt to copy

```
Add Spring Actuator and Micrometer to the main backend (it's already present on the portfolio-planner-ai microservice).

Scope:
1. Add `spring-boot-starter-actuator` to `backend/pom.xml`.
2. Enable only these endpoints (via `management.endpoints.web.exposure.include`): health, info, metrics, prometheus. Explicitly do NOT expose env, beans, heapdump, loggers.
3. Configure `/actuator/health` with readiness + liveness probes. Add a custom `HealthIndicator` for: DB connectivity, Jira API reachability (cached 60s), Ollama reachability (cached 60s).
4. Add Micrometer common tags: application=portfolio-planner, environment=${spring.profiles.active}.
5. Secure actuator endpoints: `/actuator/health` public; everything else requires ROLE_ADMIN via Spring Security.
6. Update README with a "Monitoring" section documenting the endpoints.

Non-goals:
- Do not wire this to an external metrics system (Prometheus scraping, Datadog, etc.) — that's a deployment concern for later.
- Do not add custom metrics yet.
- Do not change logging config.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: integration tests for `/actuator/health` UP response, role-gating on `/actuator/metrics`, and simulated DB-outage flipping health to DOWN.)
- Existing tests must still pass.

Verification:
- Start the app locally, hit `/actuator/health` — confirm response.
- `./scripts/verify.sh` passes.

Commit: `feat(ops): add Actuator health and Micrometer metrics endpoints`
```

---

### Prompt 4.2: Replace catch-all exception handler with specific handlers

**Priority:** Medium
**Estimated time:** 0.5 day
**Prereqs:** 4.1

#### Prompt to copy

```
Replace the catch-all `handleException(Exception)` in GlobalExceptionHandler with specific handlers so external-system failures are distinguishable from internal bugs.

Add handlers for:
1. Jira API failures (wrap with a custom `JiraApiException` at the service layer if needed) → return 502 Bad Gateway with body `{ "type": "jira_unavailable", "retry_after_seconds": N }`.
2. Ollama / LLM failures (custom `LlmUnavailableException`) → return 503 with body `{ "type": "llm_unavailable" }`.
3. SMTP failures (custom `EmailSendException`) → return 202 Accepted + log ERROR (don't fail user-facing action on email bounce).
4. Validation errors (already handled — leave alone).
5. Not-found (already handled — leave alone).
6. Generic `Exception` catch-all STAYS as the last resort, but now returns 500 with a correlation-id in the body. Add a correlation-id filter upstream to generate and log request IDs.

Each new handler increments a Micrometer counter (`app.errors{type=jira_unavailable}`, etc.) — these become visible on `/actuator/metrics`.

Non-goals:
- Do not change HTTP status codes of currently-handled exceptions (ConstraintViolation, NotFound, etc.).
- Do not remove the include-stacktrace=never setting.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: integration test per new handler — mock source exception, assert response body, HTTP status, and Micrometer counter increment.)
- Existing tests must still pass.

Verification:
- Trigger a Jira outage in staging; confirm UI shows a sensible error rather than a blank "Something went wrong."
- `./scripts/verify.sh` passes.

Commit: `feat(errors): add specific handlers for Jira/LLM/SMTP failures with correlation IDs`
```

---

## Phase 5 — UI/UX

### Prompt 5.1: Migrate inline styles to Mantine props / brand tokens (incremental)

**Priority:** High
**Estimated time:** 3–5 days, incremental (one folder per PR)
**Prereqs:** 0.3 (ESLint warn rule), 0.1

#### Prompt to copy (run ONCE per folder)

```
Migrate inline `style={{...}}` occurrences in ONE target folder to Mantine props or brand tokens. Target folder: <TARGET_FOLDER> (e.g., `src/pages/reports/`, `src/components/common/`, etc.).

Hard rules:
1. For every `style={{ key: value }}`, replace with the Mantine equivalent:
   - style={{ padding: X }} → `p={X}` or `px`, `py`
   - style={{ margin: X }} → `m={X}`
   - style={{ color: '#abc' }} → use Mantine's `c="brand.7"` with appropriate brand-token reference, not a hex.
   - style={{ display: 'flex' }} → use Mantine's <Group> or <Flex> component.
   - style={{ backgroundColor: ... }} → `bg="brand.0"` etc.
   - Dynamic values that truly must be inline (e.g., `style={{ width: percent + '%' }}`) may stay as a last resort, and MUST reference a computed constant rather than a hex.
2. Never replace a token-referenced color with a new hex literal. If a color isn't in brandTokens.ts, pause and ask me whether to add it.
3. Every file you modify must still render identically in visual diff — screenshot or Playwright snapshot before and after if uncertain.

Non-goals:
- Do not modify files outside <TARGET_FOLDER>.
- Do not change component props or behavior.
- Do not "improve" layout while migrating — 1:1 visual result only.
- Do not rename components or move files.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: snapshot/visual-regression coverage for 2–3 high-traffic pages per folder.)
- If visual regression tests exist for any touched page, run them. A changed snapshot means you regressed visual output — investigate, don't accept the change blindly.

Verification:
- `npm run build` succeeds.
- ESLint shows reduced warnings for `react/forbid-dom-props`.
- Spot-check each touched page in the browser against main; no visual difference.

Commit: `refactor(ui): migrate inline styles to Mantine props in <TARGET_FOLDER>`

Progress tracking: After this PR merges, post the updated count of inline-style occurrences (`grep -r "style={{" src/ | wc -l`) in the PR description so we can track the migration burn-down.
```

---

### Prompt 5.2: Split the `PowerDashboardPage` monolith (3,589 lines)

**Priority:** High
**Estimated time:** 2–3 days
**Prereqs:** 0.1, 0.2

#### Prompt to copy

```
Decompose `frontend/src/pages/reports/PowerDashboardPage.tsx` (currently ~3,589 lines) into a container + subcomponents. Keep user-visible behavior identical.

Target structure:
src/pages/reports/power-dashboard/
  ├── PowerDashboardPage.tsx         # container (<400 lines; routing, state wiring, layout)
  ├── state/
  │   ├── useDashboardState.ts       # custom hook owning layout, widgets, persistence
  │   └── types.ts
  ├── widgets/
  │   ├── WidgetRegistry.tsx         # the 250+ widget types map
  │   ├── <WidgetName>.tsx           # one file per widget family (group related ones; aim for 10-20 files, not 250)
  │   └── common/
  │       ├── WidgetCard.tsx
  │       ├── WidgetError.tsx
  │       └── WidgetSkeleton.tsx
  ├── toolbars/
  │   ├── DashboardToolbar.tsx
  │   └── WidgetLibrary.tsx
  └── __tests__/
      ├── PowerDashboardPage.test.tsx
      └── useDashboardState.test.ts

Hard rules:
1. The existing route `/reports/power-dashboard` must continue to work with zero perceptible difference.
2. Widget-level API calls must not change.
3. User-saved dashboard layouts must continue to load and render identically (backward compatibility on any persisted JSON shape).
4. Keep lazy-loading of the main page intact in App.tsx.
5. Widget-level lazy loading is fine (Suspense per widget) but don't over-engineer.

Non-goals:
- Do not add or remove any widget type.
- Do not redesign the UI.
- Do not change drag-drop behavior or react-grid-layout usage.
- Do not touch other dashboard pages.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: `useDashboardState` unit tests for load/add/remove/persist/reset; container-renders-default-layout test.)
- Existing tests must still pass.
- Manual regression (required in-PR): open the page in dev, add/remove 3 widgets, reload, confirm state persists and renders correctly.

Verification:
- `./scripts/verify.sh` passes.
- `wc -l src/pages/reports/power-dashboard/PowerDashboardPage.tsx` < 400.
- Each widget file <300 lines.
- Visual diff against main: zero regression.
- Interaction check: drag, resize, add, remove all work.

Commit: `refactor(ui): decompose PowerDashboardPage monolith into container + subcomponents`
```

> **Repeat this prompt pattern** for `JiraDashboardBuilderPage` (3,473 lines), `NlpLandingPage` (3,020), `EngineeringAnalyticsPage` (2,187), `ProjectsPage` (1,987). One PR per page. Same procedure, same non-goals.

---

### Prompt 5.3: Wire up `cmdk` command palette

**Priority:** Medium
**Estimated time:** 1 day
**Prereqs:** 0.1

#### Prompt to copy

```
`cmdk` is installed as a dependency but unused. Wire up a global command palette accessible via Cmd/Ctrl+K.

Scope:
1. Create `src/components/command-palette/CommandPalette.tsx` using `cmdk`.
2. Render it from AppShell — mount once at the top level.
3. Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Win/Linux) toggles.
4. Commands to include:
   - Navigate to any page the user has permission to see (pull from the existing page registry / sidebar config).
   - Quick actions: "Create project", "Create scenario", "Open NLP search", "View my feedback submissions".
   - Recent: last 5 visited pages (use a small localStorage-backed hook).
5. Styling: match Mantine + brand tokens.
6. Respect feature flags — hide commands tied to disabled features.

Non-goals:
- Do not replace the existing NLP search bar. They coexist: cmdk is for navigation, NLP is for data questions.
- Do not add fuzzy search across arbitrary data (projects, pods, resources) in this PR. That's Phase 2 of command palette.
- Do not add theme-toggle or other app-config commands.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: unit test for the command-list hook; Playwright end-to-end covering Cmd+K → type → Enter → navigate.)
- Existing tests must still pass.

Verification:
- Palette opens on shortcut, closes on Escape.
- Keyboard navigation with arrow keys works.
- Commands filter by the logged-in user's permissions.
- No visual regression on any existing page.

Commit: `feat(ui): add global command palette (Cmd+K) using cmdk`
```

---

### Prompt 5.4: Add breadcrumbs to nested routes

**Priority:** Medium
**Estimated time:** 0.5 day
**Prereqs:** 0.1

#### Prompt to copy

```
Add breadcrumb navigation for routes two or more levels deep.

Scope:
1. Create `src/components/layout/Breadcrumbs.tsx` using Mantine's Breadcrumbs component.
2. Pull the current route's label hierarchy from the same page/sidebar registry used in AppShell.
3. Mount in AppShell above the page content, below the topbar. Hide on level-1 routes (Dashboard, etc.).
4. Last segment is non-clickable plain text; all preceding segments are links.

Non-goals:
- Do not change any existing route.
- Do not restructure the route hierarchy.
- Do not add breadcrumbs to modals or drawers.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: unit test for Breadcrumbs label-chain generation; Playwright test for mid-breadcrumb click navigation.)
- Existing tests must still pass.

Verification:
- Breadcrumbs appear on deep routes.
- Hidden on dashboard and other level-1 pages.
- No visual regression.

Commit: `feat(ui): add breadcrumbs for nested routes`
```

---

### Prompt 5.5: Accessibility foundation

**Priority:** Medium
**Estimated time:** 2–3 days (first pass)
**Prereqs:** 5.1 (at least partial inline-style migration)

#### Prompt to copy

```
First-pass accessibility hardening. Focus on highest-traffic pages only.

Targets (highest-traffic, by analytics if available; otherwise start with): Dashboard, Projects, Resources, Portfolio Health, NLP Landing, Login, User Management.

Scope per page:
1. Ensure every interactive element is reachable via Tab in a logical order.
2. Every icon-only button has `aria-label`.
3. Every form input is labeled (Mantine usually handles this; verify).
4. Every chart has a text description (`aria-label` on the container, or a visually-hidden summary).
5. Color contrast: check all brand-token colors against a WCAG 2.1 AA contrast checker. If any pair fails, DO NOT silently change the token — file an issue and note it in the PR description.
6. Add `skip-to-main-content` link as the first focusable element in AppShell.
7. Ensure modals trap focus on open and restore focus on close (Mantine Modal does this by default; verify).

Also add:
- `eslint-plugin-jsx-a11y` to the ESLint config with `recommended` rules, set to `warn`.
- **Axe-core smoke test deferred to Phase 7.** Do NOT set up Playwright + @axe-core/playwright in this PR. Instead, run axe in the browser DevTools manually on the 7 target pages and paste the "serious"/"critical" violation count into the commit message. The automated smoke gets built later.

Non-goals:
- Do not redesign any page for a11y — minimum viable changes only.
- Do not change the brand palette.
- Do not enable ESLint jsx-a11y rules as `error` in this PR (too much churn).
- Do not attempt WCAG AAA.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: axe-core Playwright smoke on 7 target pages, zero "serious"/"critical" violations.)
- Manual in-PR: keyboard-only navigation walkthrough for each target page, results documented as a checklist in the commit body.
- Existing tests must still pass.

Verification:
- `./scripts/verify.sh` passes.
- Manual screen-reader spot check on Login page (VoiceOver or NVDA) — form is usable.

Commit: `feat(a11y): first-pass accessibility hardening on highest-traffic pages`
```

---

### Prompt 5.6: Make the desktop-only decision explicit (and possibly relax it)

**Priority:** Low
**Estimated time:** 0.5 day for decision; 1–2 weeks for implementation if we go responsive
**Prereqs:** none

#### Prompt to copy

```
STEP 1 — Decision (no code): Write a short ADR at `docs/adr/0001-desktop-only-or-responsive.md` using this template:

    # ADR 0001 — Desktop-only vs. responsive UX
    ## Status: proposed
    ## Context: <why this matters — exec use on tablets, field use, etc.>
    ## Decision options:
      A. Keep desktop-only, document it, and auto-display a "Please use a desktop" message on <1024px widths.
      B. Add responsive layouts to ~20 highest-traffic pages.
      C. Full responsive across the app.
    ## Recommendation: <your view, with rationale>
    ## Consequences: <engineering cost, UX upside, maintenance burden>

Commit this ADR and wait for my review before Step 2.

STEP 2 — Implementation (only after I approve):
Based on my choice, proceed with A, B, or C.

For option A: add a <1024px-width detection in AppShell that renders a polite "Unsupported device" message with a recommendation.

For option B/C: implement with Mantine's `useMediaQuery`, hide sidebar below 1024px behind a drawer, stack dense grids into cards on mobile, verify chart libraries behave.

Non-goals:
- Do not speculate about option B/C implementation until the ADR is approved.

Commit: `docs(adr): ADR-0001 desktop-only vs responsive` (step 1), then a feature commit in step 2.
```

---

## Phase 6 — Hygiene

### Prompt 6.1: Enable `noUnusedLocals` and `noUnusedParameters` in TypeScript

**Priority:** Low
**Estimated time:** 1 day
**Prereqs:** 0.1

#### Prompt to copy

```
Turn on TypeScript's `noUnusedLocals: true` and `noUnusedParameters: true` in `frontend/tsconfig.json`. Fix every resulting error without changing behavior.

Procedure:
1. Enable both flags.
2. Run `tsc -b` and collect errors.
3. For each unused local: delete it if truly unused, or prefix with `_` if intentionally retained (e.g., destructuring the 3rd element of a tuple when only 1st/2nd used).
4. For each unused parameter: prefix with `_`.
5. Do NOT delete function parameters — they may be part of an interface contract.

Non-goals:
- Do not refactor any function body beyond deleting the unused variable.
- Do not change any import path.
- Do not "improve" code while you're there.

Tests:
- **Deferred** — do not author new tests. (No new test work logged; this is a pure annotation-and-prune pass.)
- `npm run build` must succeed.
- Existing test suite must pass.

Verification:
- `./scripts/verify.sh` passes.
- `grep -n "noUnusedLocals" frontend/tsconfig.json` shows `true`.

Commit: `chore(ts): enable noUnusedLocals and noUnusedParameters`
```

---

### Prompt 6.2: Set `validate-on-migrate: true` in Flyway production profile

**Priority:** Medium
**Estimated time:** 1 hour
**Prereqs:** 1.1

#### Prompt to copy

```
Ensure Flyway validates migrations on startup in production.

Scope:
1. In `application.yml` (default profile), keep `spring.flyway.validate-on-migrate: false` if it's currently set that way — this is for dev convenience.
2. Create or edit `application-prod.yml` to set `spring.flyway.validate-on-migrate: true` AND `spring.flyway.out-of-order: false`.
3. Add a startup log line that prints the active Flyway config at INFO level.

Non-goals:
- Do not re-order or modify any existing migration file.
- Do not add new migrations.

Tests:
- **Deferred** — do not author new tests. (Logged for Phase 7: Spring Boot test that activates prod profile and asserts Flyway validate-on-migrate is true.)
- Existing tests must still pass.

Verification:
- Locally: `SPRING_PROFILES_ACTIVE=prod ./mvnw -pl backend spring-boot:run` uses strict validation.
- `./scripts/verify.sh` passes.

Commit: `fix(db): enforce Flyway validate-on-migrate in production profile`
```

---

### Prompt 6.3: Add a Vite bundle analyzer script

**Priority:** Low
**Estimated time:** 30 min
**Prereqs:** 0.1

#### Prompt to copy

```
Add `rollup-plugin-visualizer` to the frontend and wire up a `build:analyze` npm script.

Scope:
1. `npm install --save-dev rollup-plugin-visualizer` (pick a version compatible with Vite 6).
2. Conditional Vite plugin: visualizer runs only when `ANALYZE=true` env var is set.
3. Output `stats.html` to `frontend/dist/` on analyze builds.
4. Add script `"build:analyze": "ANALYZE=true vite build"` to package.json.

Non-goals:
- Do not add this to the default build in CI (we don't want stats.html shipped).
- Do not change any runtime code.

Verification:
- `npm run build` produces no stats.html (behavior unchanged).
- `npm run build:analyze` produces stats.html and opens it.

Commit: `chore(build): add optional bundle analyzer via rollup-plugin-visualizer`
```

---

## Phase 7 — Test hardening (run ONLY once the product stabilizes)

> **When to start this phase.** Only after the product's feature set and data contracts have stopped churning week-to-week. Writing these tests earlier would waste tokens on targets that keep moving. Signal to start Phase 7: two consecutive months where no new entity/DTO shape broke an existing test and no endpoint signature changed.

### Backlog of deferred test work (collected from earlier phases)

Every earlier prompt that said "tests deferred" wrote its intended test into this list. When you run Phase 7, do them in this order and commit one logical grouping per PR.

1. **Coverage baseline** (was Prompt 0.2)
   - Add JaCoCo to `backend/pom.xml` and `portfolio-planner-ai/pom.xml`.
   - Add `@vitest/coverage-v8` + `test:coverage` script + `coverage.reporter` config.
   - Write `scripts/capture-coverage-baseline.sh` producing `.coverage-baseline.json` (committed).
   - Write `scripts/check-coverage-regression.sh` with >0.5pp regression guard.
   - Wire the regression script into `scripts/verify.sh --full` only.
   - `.gitignore` the raw coverage dirs; commit the baseline JSON.

2. **Security (1.1) — JWT/SMTP placeholder-refusal tests**
   - SpringBootTest: prod profile + placeholder secret → context fails to start with expected message.
   - SpringBootTest: prod profile + valid 32+ char secret → context starts.

3. **Auth (2.1) — Refresh-token flow**
   - `RefreshTokenService` unit tests (issue / rotate / revoke / validate).
   - Integration test: login → access-cookie expiry → refresh endpoint → old refresh token rejected.
   - Frontend Vitest: axios 401-interceptor calls `/refresh` once and retries the original request.

4. **Refactor (2.2) — Service-layer delegation**
   - Per-moved-method smoke tests at the service layer.
   - `@WebMvcTest` per refactored controller confirming service delegation + status/body shape.

5. **NLP (2.3) — CloudLlmStrategy**
   - Mock HTTP server test: happy path, retry/backoff, rate-limit, final degradation path.

6. **Data (3.1) — LAZY fetch behavior**
   - Per-touched-service-method: assert relationship collection loads within a transaction; assert it is null/LazyInitializationException outside one.

7. **Data (3.2) — Jira retry/backoff**
   - WireMock scenarios: 429 with Retry-After, 5xx, connection-reset, bounded-total-time.

8. **Ops (4.1) — Actuator + Micrometer**
   - `/actuator/health` UP when deps up.
   - `/actuator/metrics` 403 for non-admin, 200 for admin.
   - Simulated DB outage flips health to DOWN.

9. **Errors (4.2) — Specific exception handlers**
   - Per new handler: mock source exception, assert body + status + Micrometer counter increment.

10. **UI (5.1) — Inline-style migrations**
    - Snapshot / visual-regression tests on 2–3 high-traffic pages per migrated folder.

11. **UI (5.2) — Monolith page splits**
    - `useDashboardState` unit tests: load / add / remove / persist / reset.
    - Container rendering test for each split page.

12. **UI (5.3) — cmdk command palette**
    - Unit test: command-list hook builds commands from registry + filters by permission.
    - Playwright: Cmd+K → type → Enter → navigate.

13. **UI (5.4) — Breadcrumbs**
    - Unit test: label-chain generation for deep routes.
    - Playwright: middle-breadcrumb click navigates correctly.

14. **Accessibility (5.5) — axe-core automation**
    - Playwright + `@axe-core/playwright` smoke on 7 target pages, zero "serious"/"critical" violations.

15. **DB (6.2) — Flyway prod validation**
    - SpringBootTest: prod profile → `validate-on-migrate` true.

### Phase 7 universal rules

- Each grouping above is its own PR / branch.
- Do not write tests whose assertions reach into implementation detail — test observable behavior at API boundaries.
- If you discover the implementation has drifted since the prompt was authored (likely), write the test against the CURRENT behavior and flag any discrepancy in the PR description for a follow-up product decision.
- When Phase 7 completes, rewrite Universal Guardrail #6 in this document to require a new test with every behavior-changing PR going forward (the deferral ends).
- Capture a coverage baseline as the FIRST Phase 7 PR so all subsequent phase-7 PRs show measurable lift.

---

## Progress tracker

| # | Prompt | Phase | Priority | Status | PR |
|---|---|---|---|---|---|
| 0.1 | Local verify.sh + git hooks | 0 | Critical | | |
| 0.2 | Test-coverage baseline (local) | 0 | **Deferred → 7** | Deferred | — |
| 0.3 | CONTRIBUTING.md + lint rule | 0 | High | | |
| 1.1 | JWT/SMTP secret hardening | 1 | Critical | | |
| 1.2 | RBAC audit + enforcement | 1 | Critical | | |
| 2.1 | Refresh-token flow | 2 | High | | |
| 2.2 | Service-layer refactor (× 7 PRs) | 2 | High | | |
| 2.3 | CloudLlmStrategy finish or remove | 2 | High | | |
| 3.1 | EAGER → LAZY on Jira entities | 3 | Medium | | |
| 3.2 | Jira retry/backoff | 3 | Medium | | |
| 3.3 | `readOnly` transactional sweep | 3 | Low-Med | | |
| 4.1 | Actuator + Micrometer | 4 | Medium | | |
| 4.2 | Specific exception handlers | 4 | Medium | | |
| 5.1 | Inline-style migration (per folder) | 5 | High | | |
| 5.2 | Monolith page split (× 5 PRs) | 5 | High | | |
| 5.3 | cmdk command palette | 5 | Medium | | |
| 5.4 | Breadcrumbs | 5 | Medium | | |
| 5.5 | Accessibility first pass | 5 | Medium | | |
| 5.6 | Desktop-only ADR + action | 5 | Low | | |
| 6.1 | TS noUnusedLocals/Parameters | 6 | Low | | |
| 6.2 | Flyway validate-on-migrate | 6 | Medium | | |
| 6.3 | Bundle analyzer | 6 | Low | | |
| 7.* | Test hardening (15 groupings) | 7 | Deferred | Gated on product stability | — |

---

## Meta-rules for this project (re-read before every prompt)

1. **Never merge a branch with a failing `verify.sh`.** The git hooks will block push, but if you bypass with `--no-verify`, merging anyway is a hard no. The fix is in the code, not in the script.
2. **Never disable a test to make the verify script pass.** Either the test is wrong (rare) or the code is wrong (usual). The *existing* test suite is the regression guard we rely on while new tests are deferred — deleting/skipping tests removes the one safety net we have.
3. **Never combine phases in one branch.** Phase 1 (security) branches must not touch Phase 5 (UI) code, etc. One logical change per branch, even though there's no PR tool to enforce it.
4. **If a prompt discovers unexpected scope, stop and ask.** Don't silently expand the change.
5. **Keep the Progress tracker table updated** as you merge each branch.
6. **After every merge to main, run the app locally** and click through the five highest-traffic pages (Dashboard, Projects, Utilization, NLP Landing, Jira Dashboard). If any is broken, the change was not ready — revert with `git revert` (never `git reset --hard` on shared history). Manual smoke is doing extra heavy lifting while new tests are deferred; don't skip it.
7. **No dependency upgrades inside a fix branch.** Dependency updates are their own type of change with their own verification.
8. **Preserve the existing URL structure.** Legacy URL redirects exist for a reason; don't remove them.
9. **Do not remove feature flags** even if they look unused — they may be set by ops.
10. **Self-review with fresh eyes.** Before merging a branch, run `git diff main..HEAD` and read every line as if someone else wrote it. If anything looks off, pause. You're the only reviewer today — be a tough one.
11. **Do not author new tests outside Phase 7.** The product is still evolving; tests written against shifting contracts get rewritten and burn tokens twice. Sole exception: a security regression test when a prompt explicitly calls for one (e.g., Prompt 1.2 RBAC enforcement). Every deferred test is logged in the Phase 7 backlog so nothing is lost.

### When you eventually move to hosted CI

`scripts/verify.sh` is designed to be the single command invoked by any CI system. The day you add GitHub Actions / GitLab CI / self-hosted, the workflow is a 10-line file that runs `./scripts/verify.sh --full`. Don't fork the validation logic — keep the script as the source of truth and let CI call it.
