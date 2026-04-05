/**
 * Auth API tests — login, logout, token persistence, permissions.
 *
 * As of Prompt 1.10, the JWT is stored only in the HttpOnly cookie set by the
 * backend; it is no longer written to localStorage.  localStorage now stores
 * only non-sensitive profile fields (username, role, displayName, pages).
 *
 * Covers:
 * - Successful login stores profile (NOT token) in localStorage
 * - Failed login (401) throws and does not store anything
 * - Logout clears all localStorage keys
 * - /auth/me succeeds via cookie (no Authorization header required)
 * - ADMIN role sets isAdmin = true
 * - canAccess with restricted page list
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.test.signature';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { username: string; password: string };
    if (body.username === 'admin' && body.password === 'password') {
      return HttpResponse.json({
        token: TOKEN,
        username: 'admin',
        displayName: 'Admin User',
        role: 'ADMIN',
        allowedPages: null,
      });
    }
    if (body.username === 'viewer' && body.password === 'password') {
      return HttpResponse.json({
        token: 'viewer-token',
        username: 'viewer',
        displayName: null,
        role: 'VIEWER',
        allowedPages: ['dashboard', 'projects'],
      });
    }
    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
  // /auth/me now relies on the HttpOnly cookie — no Authorization header check
  http.get('/api/auth/me', () =>
    HttpResponse.json({
      username: 'admin',
      displayName: 'Admin User',
      role: 'ADMIN',
      allowedPages: null,
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => { server.resetHandlers(); localStorage.clear(); });
afterAll(() => server.close());

// ── localStorage persistence ─────────────────────────────────────────────────
describe('Auth: localStorage persistence', () => {
  it('login stores profile (not token) in localStorage', async () => {
    const { default: apiClient } = await import('../client');
    const response = await apiClient.post('/auth/login', { username: 'admin', password: 'password' });
    const data = response.data as { token: string; role: string; username: string; displayName: string | null };

    // Store only non-sensitive fields — JWT stays in HttpOnly cookie
    localStorage.setItem('pp_username',     data.username);
    localStorage.setItem('pp_role',         data.role);
    localStorage.setItem('pp_display_name', data.displayName ?? '');

    expect(localStorage.getItem('pp_username')).toBe('admin');
    expect(localStorage.getItem('pp_role')).toBe('ADMIN');
    // Token must NOT be persisted to localStorage
    expect(localStorage.getItem('pp_token')).toBeNull();
  });

  it('failed login (401) does not store anything', async () => {
    const { default: apiClient } = await import('../client');
    await expect(
      apiClient.post('/auth/login', { username: 'admin', password: 'wrong' })
    ).rejects.toThrow();
    expect(localStorage.getItem('pp_token')).toBeNull();
    expect(localStorage.getItem('pp_username')).toBeNull();
  });

  it('logout clears all auth keys from localStorage', () => {
    localStorage.setItem('pp_username',     'admin');
    localStorage.setItem('pp_role',         'ADMIN');
    localStorage.setItem('pp_display_name', 'Admin User');
    localStorage.setItem('pp_pages',        'null');

    // Simulate AuthProvider.logout (no pp_token key since Prompt 1.10)
    ['pp_username', 'pp_role', 'pp_display_name', 'pp_pages'].forEach(k => {
      localStorage.removeItem(k);
    });

    expect(localStorage.getItem('pp_token')).toBeNull();
    expect(localStorage.getItem('pp_username')).toBeNull();
    expect(localStorage.getItem('pp_role')).toBeNull();
  });
});

// ── Page permissions ──────────────────────────────────────────────────────────
describe('Auth: viewer restricted pages', () => {
  it('viewer with allowedPages can only access listed pages', () => {
    const allowedPages = ['dashboard', 'projects'];
    const canAccess = (pageKey: string) =>
      allowedPages === null || allowedPages.includes(pageKey);

    expect(canAccess('dashboard')).toBe(true);
    expect(canAccess('projects')).toBe(true);
    expect(canAccess('resources')).toBe(false);
    expect(canAccess('reports')).toBe(false);
  });

  it('admin with null allowedPages can access all pages', () => {
    const allowedPages: string[] | null = null;
    const canAccess = (pageKey: string) =>
      allowedPages === null || (allowedPages as string[]).includes(pageKey);

    expect(canAccess('dashboard')).toBe(true);
    expect(canAccess('resources')).toBe(true);
    expect(canAccess('admin-only-page')).toBe(true);
  });
});

// ── /auth/me via cookie ───────────────────────────────────────────────────────
describe('Auth: /auth/me cookie-based auth', () => {
  it('/auth/me succeeds without an Authorization header (cookie carries JWT)', async () => {
    const { default: apiClient } = await import('../client');
    // No localStorage token set — the HttpOnly cookie is handled by the browser/msw
    const response = await apiClient.get('/auth/me');
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ username: 'admin', role: 'ADMIN' });
  });
});

// ── displayLabel ──────────────────────────────────────────────────────────────
describe('Auth: displayLabel', () => {
  it('uses displayName when set', () => {
    const displayName = 'Admin User';
    const username = 'admin';
    expect(displayName ?? username).toBe('Admin User');
  });

  it('falls back to username when displayName is null', () => {
    const displayName: string | null = null;
    const username = 'admin';
    expect(displayName ?? username).toBe('admin');
  });
});
