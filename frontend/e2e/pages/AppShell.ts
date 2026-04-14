/**
 * AppShell Page Object Model
 *
 * Wraps the persistent shell (sidebar nav, header, command palette, keyboard shortcuts)
 * so individual spec files don't repeat selector logic.
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class AppShellPOM {
  readonly page: Page;

  // Header
  readonly headerSearchBar: Locator;
  readonly notificationBell: Locator;
  readonly versionLabel: Locator;

  // Sidebar
  readonly sidebar: Locator;
  readonly navLinks: Locator;
  readonly shortcutsHelpBtn: Locator;
  readonly cmdKSidebarBtn: Locator;

  // Command Palette
  readonly commandPalette: Locator;
  readonly commandInput: Locator;

  // Keyboard shortcuts modal
  readonly shortcutsModal: Locator;

  // Breadcrumb
  readonly breadcrumb: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.headerSearchBar    = page.locator('[data-testid="cmd-search-bar"]').or(
      page.locator('button').filter({ hasText: /Search pages/ })
    ).first();
    this.notificationBell   = page.locator('[aria-label*="bell"], [data-testid="notification-bell"]').first();
    this.versionLabel       = page.locator('text=/v\\d+\\.\\d+/').first();

    // Sidebar
    this.sidebar           = page.locator('nav, [data-testid="app-shell-nav"]').first();
    this.navLinks          = page.locator('.mantine-NavLink-root');
    this.shortcutsHelpBtn  = page.locator('button[title*="keyboard shortcut"], button[aria-label*="shortcut"]').or(
      page.locator('[data-testid="shortcuts-help-btn"]')
    ).first();
    this.cmdKSidebarBtn    = page.locator('button[title*="Command palette"], button[aria-label*="palette"]').or(
      page.locator('[data-testid="cmd-palette-btn"]')
    ).first();

    // Command Palette
    this.commandPalette = page.locator('[cmdk-root], [role="dialog"]').filter({ hasText: /Search pages/ }).first();
    this.commandInput   = page.locator('[cmdk-input], input[placeholder*="Search pages"]').first();

    // Shortcuts modal
    this.shortcutsModal = page.locator('[role="dialog"]').filter({ hasText: /keyboard shortcut/i }).first();

    // Breadcrumb
    this.breadcrumb = page.locator('[data-testid="global-breadcrumb"], .mantine-Breadcrumbs-root').first();
  }

  /* ── Command Palette ────────────────────────────────────────────────── */

  async openCommandPaletteViaKeyboard() {
    await this.page.keyboard.press('Meta+k');
    await expect(this.commandInput).toBeVisible({ timeout: 5_000 });
  }

  async openCommandPaletteViaSearchBar() {
    await this.headerSearchBar.click();
    await expect(this.commandInput).toBeVisible({ timeout: 5_000 });
  }

  async searchInCommandPalette(query: string) {
    await this.commandInput.fill(query);
  }

  async closeCommandPalette() {
    await this.page.keyboard.press('Escape');
    await expect(this.commandInput).not.toBeVisible({ timeout: 3_000 });
  }

  async navigateViaCommandPalette(query: string, itemLabel: string) {
    await this.openCommandPaletteViaKeyboard();
    await this.searchInCommandPalette(query);
    await this.page.locator('[cmdk-item]').filter({ hasText: itemLabel }).first().click();
  }

  /* ── Keyboard Shortcuts ─────────────────────────────────────────────── */

  async openShortcutsModal() {
    await this.page.keyboard.press('?');
    await expect(this.shortcutsModal).toBeVisible({ timeout: 5_000 });
  }

  async closeShortcutsModal() {
    await this.page.keyboard.press('Escape');
    await expect(this.shortcutsModal).not.toBeVisible({ timeout: 3_000 });
  }

  /* ── G+Key navigation ───────────────────────────────────────────────── */

  async pressGKey(letter: string) {
    await this.page.keyboard.press('g');
    await this.page.keyboard.press(letter);
  }

  async gotoViaNShortcut(letter: string, expectedPath: string) {
    await this.pressGKey(letter);
    await this.page.waitForURL(`**${expectedPath}`, { timeout: 8_000 });
  }

  /* ── Nav assertions ─────────────────────────────────────────────────── */

  async expectNavGroupExists(groupName: string) {
    const group = this.page.locator('.mantine-NavLink-root, [data-testid="nav-group"]').filter({ hasText: groupName });
    await expect(group.first()).toBeVisible();
  }

  async expectActiveNavItem(label: string) {
    const active = this.navLinks.filter({ hasText: label }).filter({ has: this.page.locator('[data-active="true"]') });
    await expect(active.first()).toBeVisible();
  }

  /* ── Version ────────────────────────────────────────────────────────── */

  async getVersion(): Promise<string> {
    try {
      return (await this.versionLabel.textContent()) ?? '';
    } catch {
      return '';
    }
  }

  async expectVersionVisible() {
    await expect(this.versionLabel).toBeVisible();
  }

  /* ── Logout ─────────────────────────────────────────────────────────── */

  async logout() {
    const userMenu = this.page.locator('[data-testid="user-menu"], button[aria-label*="user"]').first();
    await userMenu.click();
    await this.page.getByRole('menuitem', { name: /logout|sign out/i }).click();
    await this.page.waitForURL('**/login', { timeout: 10_000 });
  }
}
