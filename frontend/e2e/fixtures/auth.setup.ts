/**
 * Auth Setup — runs once, saves cookie state for all subsequent tests.
 *
 * This fixture logs in as admin and saves the HttpOnly cookie state to
 * e2e/fixtures/.auth/admin.json so all spec files can reuse it without
 * repeating the login flow.
 */
import { test as setup, expect } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';

const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    ?? 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');

  // Wait for the login form
  await page.waitForSelector('input[name="username"], input[placeholder*="Username"], input[placeholder*="username"]', {
    timeout: 15_000,
  });

  // Fill credentials
  const usernameInput = page.locator('input[name="username"]').or(
    page.locator('input[placeholder*="Username"]')
  ).or(
    page.locator('input[placeholder*="username"]')
  ).first();

  const passwordInput = page.locator('input[name="password"]').or(
    page.locator('input[type="password"]')
  ).first();

  await usernameInput.fill(ADMIN_EMAIL);
  await passwordInput.fill(ADMIN_PASSWORD);
  await passwordInput.press('Enter');

  // Wait for successful redirect (away from /login)
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 });

  // Verify we're actually logged in
  await expect(page.locator('nav, [data-testid="app-shell-nav"]').first()).toBeVisible({ timeout: 10_000 });

  // Save the authentication state
  await page.context().storageState({ path: STORAGE_STATE });
  console.log('[Auth Setup] Admin session saved to', STORAGE_STATE);
});
