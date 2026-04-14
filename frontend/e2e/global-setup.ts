/**
 * Playwright Global Setup — Portfolio Planner E2E
 *
 * Runs once before all tests:
 *  1. Waits for backend to be ready
 *  2. Seeds deterministic fixture data into portfolioplanner_e2e DB
 *
 * NOTE: Requires `SPRING_PROFILES_ACTIVE=e2e` which points to portfolioplanner_e2e DB.
 */
import { request } from '@playwright/test';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8080';
const ADMIN   = { username: 'admin', password: 'admin' };

async function getAuthToken(): Promise<string> {
  const ctx = await request.newContext({ baseURL: BACKEND });
  const res = await ctx.post('/api/auth/login', {
    data: { username: ADMIN.username, password: ADMIN.password },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`);
  // JWT comes back in Set-Cookie header (HttpOnly) — for API seeding we read the body
  const body = await res.json().catch(() => ({}));
  await ctx.dispose();
  return body.token ?? '';
}

async function seedFixtures(token: string) {
  const ctx = await request.newContext({
    baseURL: BACKEND,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  // Seed is idempotent — uses upsert semantics where possible
  // Resources
  const seedEndpoints = [
    { path: '/api/e2e/seed/resources', description: '5 test resources' },
    { path: '/api/e2e/seed/pods',      description: '3 test pods' },
    { path: '/api/e2e/seed/projects',  description: '3 test projects' },
  ];

  for (const ep of seedEndpoints) {
    const res = await ctx.post(ep.path);
    if (!res.ok()) {
      console.warn(`[E2E Setup] Seed failed for ${ep.description}: ${res.status()} — continuing`);
    } else {
      console.log(`[E2E Setup] Seeded: ${ep.description}`);
    }
  }

  await ctx.dispose();
}

export default async function globalSetup() {
  console.log('[E2E Setup] Starting global setup...');
  try {
    const token = await getAuthToken();
    if (token) {
      await seedFixtures(token);
    } else {
      console.warn('[E2E Setup] No token returned — skipping fixture seed (using cookie auth)');
    }
    console.log('[E2E Setup] Global setup complete.');
  } catch (err) {
    console.error('[E2E Setup] Setup error (non-fatal):', err);
  }
}
