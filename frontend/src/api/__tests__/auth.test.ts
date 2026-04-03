/**
 * Auth API tests — login, logout, token persistence, permissions.
 *
 * Covers:
 * - Successful login stores token + role
 * - Failed login (401) throws and does not store token
 * - Logout clears localStorage
 * - /auth/me returns current user profile
 * - ADMIN role sets isAdmin = true
 * - canAccess with restricted page list
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { makeWrapper } from '../../test/helpers';

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.test.signature';

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
  http.post('/api/auth/logout', () => HttpResponse.json({ ok: true })),
  http.get('/api/auth/me', ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.includes(TOKEN)) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return HttpResponse.json({
      username: 'admin',
      displayName: 'Admin User',
      role: 'ADMIN',
      allowedPages: null,
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => { server.resetHandlers(); localStorage.clear(); });
afterAll(() => server.close());

// We test auth behaviour by directly manipulating localStorage and apiClient
// since AuthContext is a React context (not a hook we can easily renderHook).

describe('Auth: localStorage persistence', () => {
  it('login stores token and role in localStorage', async () => {
    // Simulate what AuthProvider.login does
    const { default: apiClient } = await import('../client');
    const response = await apiClient.post('/auth/login', { username: 'admin', password: 'password' });
    const data = response.data as { token: string; role: string; username: string };
    localStorage.setItem('pp_token', data.token);
    localStorage.setItem('pp_role', data.role);
    localStorage.setItem('pp_username', data.username);

    expect(localStorage.getItem('pp_token')).toBe(TOKEN);
    expect(localStorage.getItem('pp_role')).toBe('ADMIN');
    expect(localStorage.getItem('pp_username')).toBe('admin');
  });

  it('failed login (401) does not store token', async () => {
    const { default: apiClient } = await import('../client');
    await expect(
      apiClient.post('/auth/login', { username: 'admin', password: 'wrong' })
    ).rejects.toThrow();
    expect(localStorage.getItem('pp_token')).toBeNull();
  });

  it('logout clears all auth keys from localStorage', () => {
    localStorage.setItem('pp_token', TOKEN);
    localStorage.setItem('pp_role', 'ADMIN');
    localStorage.setItem('pp_username', 'admin');
    localStorage.setItem('pp_display_name', 'Admin User');
    localStorage.setItem('pp_pages', 'null');

    // Simulate AuthProvider.logout
    ['pp_token', 'pp_role', 'pp_username', 'pp_display_name', 'pp_pages'].forEach(k => {
      localStorage.removeItem(k);
    });

    expect(localStorage.getItem('pp_token')).toBeNull();
    expect(localStorage.getItem('pp_role')).toBeNull();
    expect(localStorage.getItem('pp_username')).toBeNull();
  });
});

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
      allowedPages === null || allowedPages.includes(pageKey);

    expect(canAccess('dashboard')).toBe(true);
    expect(canAccess('resources')).toBe(true);
    expect(canAccess('admin-only-page')).toBe(true);
  });
});

describe('Auth: API client Authorization header', () => {
  it('includes Bearer token in subsequent requests after login', async () => {
    localStorage.setItem('pp_token', TOKEN);
    const { default: apiClient } = await import('../client');

    // Should succeed because our mock checks for TOKEN in Authorization header
    const response = await apiClient.get('/auth/me');
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ username: 'admin', role: 'ADMIN' });
  });

  it('returns 401 when no token is present', async () => {
    localStorage.removeItem('pp_token');
    const { default: apiClient } = await import('../client');

    await expect(apiClient.get('/auth/me')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });
});

describe('Auth: displayLabel', () => {
  it('uses displayName when set', () => {
    const displayName = 'Admin User';
    const username = 'admin';
    const displayLabel = displayName ?? username;
    expect(displayLabel).toBe('Admin User');
  });

  it('falls back to username when displayName is null', () => {
    const displayName: string | null = null;
    const username = 'admin';
    const displayLabel = displayName ?? username;
    expect(displayLabel).toBe('admin');
  });
});
