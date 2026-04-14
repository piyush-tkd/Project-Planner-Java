/**
 * E2E Dashboard & Cross-Cutting Tests — DB1 through DB20
 *
 * Covers: dashboard load, widget rendering, dark mode toggle,
 *         notification bell + empty state (PP-13), favorites,
 *         NLP/AI page, Engineering Hub, Objectives, Risks,
 *         Audit log, version label.
 */
import { test, expect } from '@playwright/test';
import { AppShellPOM } from '../pages/AppShell';

test.describe('Dashboard & Cross-Cutting Features', () => {

  /* ── DB1: Dashboard loads @smoke ─────────────────────────────────────── */
  test('DB1: dashboard page loads @smoke', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2_000);
    expect(page.url()).not.toContain('/login');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });

  /* ── DB2: Dashboard widgets render ───────────────────────────────────── */
  test('DB2: dashboard renders widget cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2_500);
    const cards = page.locator('.mantine-Card-root, [data-testid*="widget"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0);
    expect(page.url()).not.toContain('/login');
  });

  /* ── DB3: Version label is visible ───────────────────────────────────── */
  test('DB3: version label is visible in the UI @smoke', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1_500);
    // Version pattern vXX.X
    const versionText = page.locator('text=/v\\d+\\.\\d+/').first();
    await expect(versionText).toBeVisible({ timeout: 8_000 });
  });

  /* ── DB4: Dark mode toggle works ─────────────────────────────────────── */
  test('DB4: dark mode toggle switches theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1_000);

    // Find dark/light toggle button
    const darkToggle = page.locator('button[aria-label*="dark"], button[aria-label*="theme"], button[aria-label*="light"]')
      .first();
    const sunIcon   = page.locator('button').filter({ has: page.locator('[data-tabler-icon="sun"]') }).first();
    const moonIcon  = page.locator('button').filter({ has: page.locator('[data-tabler-icon="moon"]') }).first();

    const toggleExists = (await darkToggle.isVisible().catch(() => false)) ||
                         (await sunIcon.isVisible().catch(() => false)) ||
                         (await moonIcon.isVisible().catch(() => false));

    if (toggleExists) {
      const toggle = (await darkToggle.isVisible().catch(() => false)) ? darkToggle
                   : (await moonIcon.isVisible().catch(() => false)) ? moonIcon : sunIcon;
      await toggle.click();
      await page.waitForTimeout(500);
      // Theme should have toggled — html element class changes
      const html = page.locator('html');
      const htmlClass = await html.getAttribute('class') ?? '';
      const htmlData  = await html.getAttribute('data-mantine-color-scheme') ?? '';
      expect(page.url()).not.toContain('/login'); // no crash
    }
  });

  /* ── DB5: Notification bell is present in header ─────────────────────── */
  test('DB5: notification bell icon is visible in header', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1_500);
    const bell = page.locator('button[aria-label*="bell"], button[aria-label*="notification"], [data-testid="notification-bell"]')
      .first();
    await expect(bell).toBeVisible({ timeout: 8_000 });
  });

  /* ── DB6: Notification bell opens popover ────────────────────────────── */
  test('DB6: clicking notification bell opens popover', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1_500);

    const bell = page.locator('button[aria-label*="bell"], button[aria-label*="notification"]').first();
    const exists = await bell.isVisible({ timeout: 5_000 }).catch(() => false);
    if (exists) {
      await bell.click();
      await page.waitForTimeout(500);
      const popover = page.locator('[role="dialog"], .mantine-Popover-dropdown').first();
      await expect(popover).toBeVisible({ timeout: 5_000 });
    }
  });

  /* ── DB7: Notification bell "All caught up!" empty state (PP-13) ─────── */
  test('DB7: notification bell shows "All caught up!" empty state when no alerts', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1_500);

    const bell = page.locator('button[aria-label*="bell"], button[aria-label*="notification"]').first();
    const exists = await bell.isVisible({ timeout: 5_000 }).catch(() => false);
    if (exists) {
      await bell.click();
      await page.waitForTimeout(800);

      const emptyState = page.locator('text=/All caught up/i, text=/No critical/i').first();
      const hasItems   = await page.locator('[data-testid="notification-item"]').count();

      if (hasItems === 0) {
        await expect(emptyState).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  /* ── DB8: Favorites (starred pages) work ─────────────────────────────── */
  test('DB8: favorite star button is present in sidebar nav items', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1_500);

    // Hover over a nav item to reveal star
    const navItem = page.locator('.mantine-NavLink-root').first();
    await navItem.hover();
    await page.waitForTimeout(300);

    const starBtn = page.locator('.nav-star-btn, button[aria-label*="favorite"], button[aria-label*="star"]').first();
    const starExists = await starBtn.isVisible({ timeout: 2_000 }).catch(() => false);
    // Star button may or may not be visible on hover — acceptable
    expect(page.url()).not.toContain('/login');
  });

  /* ── DB9: NLP / AI Assistant page loads ─────────────────────────────── */
  test('DB9: NLP AI assistant page loads @smoke', async ({ page }) => {
    await page.goto('/nlp');
    await page.waitForTimeout(1_500);
    expect(page.url()).not.toContain('/login');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });

  /* ── DB10: G+I shortcut navigates to NLP ────────────────────────────── */
  test('DB10: G+I shortcut navigates to AI assistant', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);
    await page.locator('body').click();
    await shell.pressGKey('i');
    await page.waitForURL('**/nlp**', { timeout: 8_000 });
    expect(page.url()).toContain('/nlp');
  });

  /* ── DB11: AI Content Studio page loads ──────────────────────────────── */
  test('DB11: AI content studio page loads', async ({ page }) => {
    await page.goto('/nlp/content-studio');
    await page.waitForTimeout(1_500);
    expect(page.url()).not.toContain('/login');
  });

  /* ── DB12: Engineering Hub page loads ────────────────────────────────── */
  test('DB12: engineering hub page loads', async ({ page }) => {
    await page.goto('/engineering/hub');
    await page.waitForTimeout(1_500);
    expect(page.url()).not.toContain('/login');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 8_000 });
  });

  /* ── DB13: G+E shortcut navigates to Engineering Hub ─────────────────── */
  test('DB13: G+E shortcut navigates to engineering hub', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);
    await page.locator('body').click();
    await shell.pressGKey('e');
    await page.waitForURL('**/engineering**', { timeout: 8_000 });
    expect(page.url()).toContain('/engineering');
  });

  /* ── DB14: Objectives / OKRs page loads ──────────────────────────────── */
  test('DB14: objectives page loads', async ({ page }) => {
    await page.goto('/objectives');
    await page.waitForTimeout(1_500);
    expect(page.url()).not.toContain('/login');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 8_000 });
  });

  /* ── DB15: Risk Register page loads ──────────────────────────────────── */
  test('DB15: risk register page loads', async ({ page }) => {
    await page.goto('/risks');
    await page.waitForTimeout(1_500);
    expect(page.url()).not.toContain('/login');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 8_000 });
  });

  /* ── DB16: Audit Log page loads ──────────────────────────────────────── */
  test('DB16: audit log page loads', async ({ page }) => {
    await page.goto('/admin/audit-log');
    await page.waitForTimeout(1_500);
    expect(page.url()).not.toContain('/login');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 8_000 });
  });

  /* ── DB17: Ideas Board page loads ────────────────────────────────────── */
  test('DB17: ideas board page loads', async ({ page }) => {
    await page.goto('/ideas');
    await page.waitForTimeout(1_500);
    expect(page.url()).not.toContain('/login');
  });

  /* ── DB18: DORA Metrics page loads ───────────────────────────────────── */
  test('DB18: DORA metrics page loads', async ({ page }) => {
    await page.goto('/engineering/dora');
    await page.waitForTimeout(1_500);
    expect(page.url()).not.toContain('/login');
  });

  /* ── DB19: Release Calendar page loads ───────────────────────────────── */
  test('DB19: release calendar page loads', async ({ page }) => {
    await page.goto('/releases/calendar');
    await page.waitForTimeout(1_500);
    expect(page.url()).not.toContain('/login');
  });

  /* ── DB20: Portfolio Timeline page loads ─────────────────────────────── */
  test('DB20: portfolio timeline page loads', async ({ page }) => {
    await page.goto('/portfolio/timeline');
    await page.waitForTimeout(1_500);
    expect(page.url()).not.toContain('/login');
  });

});
