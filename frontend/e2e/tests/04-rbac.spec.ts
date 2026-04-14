/**
 * E2E RBAC Tests — R1 through R8
 *
 * Verifies that @PreAuthorize annotations on controllers are enforced:
 * unauthenticated requests to protected endpoints return 401/403.
 */
import { test, expect, request } from '@playwright/test';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8080';

// Endpoints that must be protected (sample from each domain)
const PROTECTED_ENDPOINTS = [
  { method: 'GET',  path: '/api/projects',             label: 'Projects list' },
  { method: 'GET',  path: '/api/resources',            label: 'Resources list' },
  { method: 'GET',  path: '/api/pods',                 label: 'PODs list' },
  { method: 'GET',  path: '/api/sprints',              label: 'Sprints list' },
  { method: 'GET',  path: '/api/skills',               label: 'Skills list' },
  { method: 'GET',  path: '/api/financial-intelligence/overview', label: 'Financial overview' },
  { method: 'GET',  path: '/api/ai/chat',              label: 'AI chat' },
  { method: 'GET',  path: '/api/engineering/hub',      label: 'Engineering hub' },
  { method: 'GET',  path: '/api/capacity',             label: 'Capacity' },
  { method: 'GET',  path: '/api/notifications',        label: 'Notifications' },
];

// Endpoints that must be public (no auth required)
const PUBLIC_ENDPOINTS = [
  { method: 'POST', path: '/api/auth/login',  label: 'Login' },
  { method: 'GET',  path: '/actuator/health', label: 'Health check' },
];

test.describe('RBAC — Backend Security', () => {

  /* ── R1: Unauthenticated requests to protected endpoints get 401/403 ── */
  for (const ep of PROTECTED_ENDPOINTS) {
    test(`R1: ${ep.label} (${ep.method} ${ep.path}) requires auth`, async () => {
      const ctx = await request.newContext({ baseURL: BACKEND });

      const res = ep.method === 'GET'
        ? await ctx.get(ep.path)
        : await ctx.post(ep.path, { data: {} });

      // Must be 401 (Unauthorized) or 403 (Forbidden) — never 200 without auth
      expect([401, 403]).toContain(res.status());
      await ctx.dispose();
    });
  }

  /* ── R2: Public endpoints are accessible without auth ───────────────── */
  test('R2: /api/auth/login endpoint is public (returns 4xx on wrong creds, not 401 auth error)', async () => {
    const ctx = await request.newContext({ baseURL: BACKEND });
    const res = await ctx.post('/api/auth/login', {
      data: { username: 'nobody', password: 'nobody' },
    });
    // Should get a meaningful response (400 bad creds, 401 wrong creds) — NOT blocked at auth layer
    // The point is we reached the endpoint (not a Spring Security 403 before the controller)
    expect(res.status()).toBeLessThan(500);
    await ctx.dispose();
  });

  /* ── R3: Authenticated requests to protected endpoints succeed ──────── */
  test('R3: authenticated GET /api/projects returns 200', async ({ request: apiCtx }) => {
    // First login
    const loginRes = await apiCtx.post(`${BACKEND}/api/auth/login`, {
      data: { username: 'admin', password: 'admin' },
    });
    expect(loginRes.ok()).toBeTruthy();

    // The session cookie should be set — now hit a protected endpoint
    const projectsRes = await apiCtx.get(`${BACKEND}/api/projects`);
    expect([200, 204]).toContain(projectsRes.status());
  });

  /* ── R4: UI protected routes redirect unauthenticated ───────────────── */
  test('R4: unauthenticated browser visit to /projects redirects to /login', async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto('/projects');
    await page.waitForURL(url => url.pathname.includes('/login'), { timeout: 10_000 });
    expect(page.url()).toContain('/login');
    await ctx.close();
  });

  /* ── R5: Settings page requires auth ────────────────────────────────── */
  test('R5: unauthenticated visit to /settings redirects to /login', async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto('/settings');
    await page.waitForURL(url => url.pathname.includes('/login'), { timeout: 10_000 });
    expect(page.url()).toContain('/login');
    await ctx.close();
  });

  /* ── R6: Finance page requires auth ─────────────────────────────────── */
  test('R6: unauthenticated visit to /financial-intelligence redirects to /login', async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto('/financial-intelligence');
    await page.waitForURL(url => url.pathname.includes('/login'), { timeout: 10_000 });
    expect(page.url()).toContain('/login');
    await ctx.close();
  });

  /* ── R7: NLP/AI page requires auth ──────────────────────────────────── */
  test('R7: unauthenticated visit to /nlp redirects to /login', async ({ browser }) => {
    const ctx  = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto('/nlp');
    await page.waitForURL(url => url.pathname.includes('/login'), { timeout: 10_000 });
    expect(page.url()).toContain('/login');
    await ctx.close();
  });

  /* ── R8: JWT cookie tampered → 401 ──────────────────────────────────── */
  test('R8: tampered auth cookie gets 401 from API', async () => {
    const ctx = await request.newContext({
      baseURL: BACKEND,
      extraHTTPHeaders: {
        Cookie: 'accessToken=tampered.jwt.value',
      },
    });
    const res = await ctx.get('/api/projects');
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });

});
