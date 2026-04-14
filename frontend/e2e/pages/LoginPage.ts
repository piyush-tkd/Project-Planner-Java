import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"]').or(
      page.locator('input[placeholder*="sername"]')
    ).first();
    this.passwordInput = page.locator('input[type="password"]').first();
    this.submitButton  = page.locator('button[type="submit"]').or(
      page.getByRole('button', { name: /sign in|log in|login/i })
    ).first();
    this.errorAlert = page.locator('[role="alert"], .mantine-Alert-root').first();
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.usernameInput).toBeVisible({ timeout: 10_000 });
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginAndWait(username: string, password: string) {
    await this.login(username, password);
    await this.page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 });
  }

  async expectError() {
    await expect(this.errorAlert).toBeVisible({ timeout: 5_000 });
  }

  async expectRedirectAway() {
    await this.page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 });
  }
}
