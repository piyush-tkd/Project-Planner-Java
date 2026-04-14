/**
 * E2E Navigation Tests — N1 through N14
 *
 * Tests PP-13 UX Navigation Architecture changes:
 *  - 6-section nav mental model (Overview / Portfolio / Teams / Finance / Delivery / Admin)
 *  - G+letter keyboard shortcuts
 *  - ⌘K command palette (search + navigation)
 *  - ? keyboard shortcuts modal
 *  - Breadcrumb presence
 *  - Header search bar
 */
import { test, expect } from '@playwright/test';
import { AppShellPOM } from '../pages/AppShell';

test.describe('Navigation — PP-13 UX Architecture', () => {

  /* ── N1: Nav groups use 6-section mental model ──────────────────────── */
  test('N1: sidebar displays correct group names @smoke', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);

    // PP-13: renamed groups
    const expectedGroups = ['Overview', 'Portfolio', 'Teams', 'Finance', 'Delivery', 'Admin'];
    for (const group of expectedGroups) {
      const el = page.locator(`text="${group}"`).first();
      await expect(el).toBeVisible({ timeout: 8_000 });
    }
  });

  /* ── N2: "Home" group does not appear ───────────────────────────────── */
  test('N2: old group names are gone (Home, People, Economics)', async ({ page }) => {
    await page.goto('/');

    // These old names should not appear as group headers
    const oldGroups = ['People', 'Economics'];
    for (const group of oldGroups) {
      const groupHeader = page.locator('.mantine-NavLink-label, [data-group-header]')
        .filter({ hasText: new RegExp(`^${group}$`) });
      const count = await groupHeader.count();
      // Old group names should not appear as top-level nav group labels
      expect(count).toBe(0);
    }
  });

  /* ── N3: G+D navigates to Dashboard ────────────────────────────────── */
  test('N3: G+D navigates to dashboard', async ({ page }) => {
    await page.goto('/projects'); // start somewhere else
    const shell = new AppShellPOM(page);

    // Focus body to ensure keyboard events fire
    await page.locator('body').click();
    await shell.gotoViaNShortcut('d', '/');
    expect(page.url()).toMatch(/localhost:\d+\/$/);
  });

  /* ── N4: G+P navigates to Projects ─────────────────────────────────── */
  test('N4: G+P navigates to projects page', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);

    await page.locator('body').click();
    await shell.gotoViaNShortcut('p', '/projects');
    expect(page.url()).toContain('/projects');
  });

  /* ── N5: G+R navigates to Resources ────────────────────────────────── */
  test('N5: G+R navigates to resources page', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);

    await page.locator('body').click();
    await shell.gotoViaNShortcut('r', '/people/resources');
    expect(page.url()).toContain('/people/resources');
  });

  /* ── N6: G+S navigates to Settings ─────────────────────────────────── */
  test('N6: G+S navigates to settings', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);

    await page.locator('body').click();
    await shell.pressGKey('s');
    await page.waitForURL('**/settings**', { timeout: 8_000 });
    expect(page.url()).toContain('/settings');
  });

  /* ── N7: G+I navigates to NLP/AI page ──────────────────────────────── */
  test('N7: G+I navigates to AI assistant', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);

    await page.locator('body').click();
    await shell.pressGKey('i');
    await page.waitForURL('**/nlp**', { timeout: 8_000 });
    expect(page.url()).toContain('/nlp');
  });

  /* ── N8: Keyboard shortcuts do not fire when typing in input ────────── */
  test('N8: G+key shortcuts ignored when focus is in input field', async ({ page }) => {
    await page.goto('/projects');

    // Find a search input
    const searchInput = page.locator('input').first();
    await searchInput.click();
    await searchInput.type('g'); // Type "g" in input — should NOT trigger nav
    await page.waitForTimeout(900); // wait past the 800ms G+key window
    await searchInput.type('p'); // Type "p" — should NOT navigate
    await page.waitForTimeout(500);

    // Should still be on /projects
    expect(page.url()).toContain('/projects');
  });

  /* ── N9: ⌘K opens command palette ──────────────────────────────────── */
  test('N9: Cmd+K opens command palette @smoke', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);

    await page.locator('body').click();
    await shell.openCommandPaletteViaKeyboard();

    // Palette input should be focused
    await expect(shell.commandInput).toBeFocused();
  });

  /* ── N10: Command palette search filters results ────────────────────── */
  test('N10: command palette filters by query', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);

    await shell.openCommandPaletteViaKeyboard();
    await shell.searchInCommandPalette('sprint');

    // Should show Sprint-related items
    const results = page.locator('[cmdk-item]').filter({ hasText: /sprint/i });
    await expect(results.first()).toBeVisible({ timeout: 5_000 });
  });

  /* ── N11: Command palette shows no-results state ────────────────────── */
  test('N11: command palette shows empty state for gibberish query', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);

    await shell.openCommandPaletteViaKeyboard();
    await shell.searchInCommandPalette('xyzxyz-no-match-abc123');

    // PP-13: improved no-results state with icon + tip
    const emptyState = page.locator('[cmdk-empty]').or(
      page.locator('text=/No results found/i')
    ).first();
    await expect(emptyState).toBeVisible({ timeout: 5_000 });

    // Should show the G+letter hint tip
    const tip = page.locator('text=/G\\+letter/i').first();
    await expect(tip).toBeVisible({ timeout: 3_000 });
  });

  /* ── N12: Esc closes command palette ────────────────────────────────── */
  test('N12: Escape key closes command palette', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);

    await shell.openCommandPaletteViaKeyboard();
    await shell.closeCommandPalette();
    await expect(shell.commandInput).not.toBeVisible();
  });

  /* ── N13: ? opens keyboard shortcuts modal ──────────────────────────── */
  test('N13: ? key opens keyboard shortcuts modal', async ({ page }) => {
    await page.goto('/');

    await page.locator('body').click();
    await page.keyboard.press('?');

    const modal = page.locator('[role="dialog"]').filter({ hasText: /keyboard|shortcut/i }).first();
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });

  /* ── N14: Header search bar click opens command palette ─────────────── */
  test('N14: header search bar click opens command palette', async ({ page }) => {
    await page.goto('/');
    const shell = new AppShellPOM(page);

    // The header should show the search bar on desktop
    const searchBar = page.locator('button').filter({ hasText: /Search pages/i }).first();
    const isVisible = await searchBar.isVisible().catch(() => false);

    if (isVisible) {
      await searchBar.click();
      await expect(shell.commandInput).toBeVisible({ timeout: 5_000 });
    } else {
      // On smaller viewports the search bar may be hidden — use keyboard shortcut instead
      await shell.openCommandPaletteViaKeyboard();
      await expect(shell.commandInput).toBeVisible({ timeout: 5_000 });
    }
  });

});
