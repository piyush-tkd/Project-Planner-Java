/**
 * E2E Keyboard Shortcut Tests — K1 through K12
 *
 * Covers all G+letter navigation, ⌘K palette, ? modal,
 * and input-field safety (shortcuts don't fire in inputs).
 */
import { test, expect } from '@playwright/test';
import { AppShellPOM } from '../pages/AppShell';

test.describe('Keyboard Shortcuts', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Ensure body has focus (not an input)
    await page.locator('body').click();
  });

  /* ── K1: G+D → Dashboard ────────────────────────────────────────────── */
  test('K1: G+D goes to dashboard', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('body').click();
    await page.keyboard.press('g');
    await page.keyboard.press('d');
    await page.waitForURL(url => url.pathname === '/' || url.pathname === '/dashboard', { timeout: 8_000 });
    const url = page.url();
    expect(url.endsWith('/') || url.includes('/dashboard')).toBeTruthy();
  });

  /* ── K2: G+P → Projects ─────────────────────────────────────────────── */
  test('K2: G+P goes to projects', async ({ page }) => {
    await page.keyboard.press('g');
    await page.keyboard.press('p');
    await page.waitForURL('**/projects', { timeout: 8_000 });
    expect(page.url()).toContain('/projects');
  });

  /* ── K3: G+R → Resources ────────────────────────────────────────────── */
  test('K3: G+R goes to resources', async ({ page }) => {
    await page.keyboard.press('g');
    await page.keyboard.press('r');
    await page.waitForURL('**/people/resources', { timeout: 8_000 });
    expect(page.url()).toContain('/people/resources');
  });

  /* ── K4: G+O → PODs ─────────────────────────────────────────────────── */
  test('K4: G+O goes to PODs', async ({ page }) => {
    await page.keyboard.press('g');
    await page.keyboard.press('o');
    await page.waitForURL('**/pods', { timeout: 8_000 });
    expect(page.url()).toContain('/pods');
  });

  /* ── K5: G+C → Capacity ─────────────────────────────────────────────── */
  test('K5: G+C goes to capacity planner', async ({ page }) => {
    await page.keyboard.press('g');
    await page.keyboard.press('c');
    await page.waitForURL('**/people/capacity', { timeout: 8_000 });
    expect(page.url()).toContain('/people/capacity');
  });

  /* ── K6: G+B → Financial Intelligence ──────────────────────────────── */
  test('K6: G+B goes to financial intelligence', async ({ page }) => {
    await page.keyboard.press('g');
    await page.keyboard.press('b');
    await page.waitForURL('**/financial-intelligence', { timeout: 8_000 });
    expect(page.url()).toContain('/financial-intelligence');
  });

  /* ── K7: G+S → Settings ─────────────────────────────────────────────── */
  test('K7: G+S goes to settings', async ({ page }) => {
    await page.keyboard.press('g');
    await page.keyboard.press('s');
    await page.waitForURL('**/settings**', { timeout: 8_000 });
    expect(page.url()).toContain('/settings');
  });

  /* ── K8: G+I → NLP/AI ───────────────────────────────────────────────── */
  test('K8: G+I goes to AI assistant', async ({ page }) => {
    await page.keyboard.press('g');
    await page.keyboard.press('i');
    await page.waitForURL('**/nlp**', { timeout: 8_000 });
    expect(page.url()).toContain('/nlp');
  });

  /* ── K9: G+K → opens command palette ───────────────────────────────── */
  test('K9: G+K opens command palette', async ({ page }) => {
    const shell = new AppShellPOM(page);
    await page.keyboard.press('g');
    await page.keyboard.press('k');
    await expect(shell.commandInput).toBeVisible({ timeout: 5_000 });
  });

  /* ── K10: ⌘K opens command palette ─────────────────────────────────── */
  test('K10: Cmd+K opens command palette', async ({ page }) => {
    const shell = new AppShellPOM(page);
    await shell.openCommandPaletteViaKeyboard();
    await expect(shell.commandInput).toBeVisible();
    await expect(shell.commandInput).toBeFocused();
  });

  /* ── K11: ? opens shortcuts modal ──────────────────────────────────── */
  test('K11: ? opens keyboard shortcuts modal', async ({ page }) => {
    await page.keyboard.press('?');
    const modal = page.locator('[role="dialog"]').filter({ hasText: /shortcut/i }).first();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Escape closes it
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });

  /* ── K12: G+key ignored in input fields ─────────────────────────────── */
  test('K12: G+letter does nothing when focused in an input', async ({ page }) => {
    // Navigate to a page with an input
    await page.goto('/projects');
    const anyInput = page.locator('input').first();
    await anyInput.click();

    const urlBefore = page.url();

    // Type g then p while input is focused
    await anyInput.press('g');
    await page.waitForTimeout(100);
    await anyInput.press('p');
    await page.waitForTimeout(900); // past 800ms G+key window

    // URL should not have changed
    expect(page.url()).toBe(urlBefore);

    // Input value should contain the typed characters (they went into the input)
    const val = await anyInput.inputValue();
    expect(val).toContain('g');
  });

});
