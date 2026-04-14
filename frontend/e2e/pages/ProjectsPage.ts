import { type Page, type Locator, expect } from '@playwright/test';

export class ProjectsPagePOM {
  readonly page: Page;
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly projectCards: Locator;
  readonly emptyState: Locator;
  readonly filterEmptyState: Locator;
  readonly searchInput: Locator;
  readonly ownerFilter: Locator;
  readonly priorityFilter: Locator;
  readonly clearFiltersButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading          = page.getByRole('heading', { name: /projects/i }).first();
    this.createButton     = page.getByRole('button', { name: /create project|new project/i }).first();
    this.projectCards     = page.locator('[data-testid="project-card"], .project-card, .mantine-Card-root').filter({ has: page.locator('h3, h4, [class*="title"]') });
    this.emptyState       = page.locator('[data-testid="empty-state"]').or(page.locator('text=/No projects yet/i')).first();
    this.filterEmptyState = page.locator('text=/No projects match/i').first();
    this.searchInput      = page.locator('input[placeholder*="Search"], input[placeholder*="project"]').first();
    this.ownerFilter      = page.locator('select[name*="owner"], [data-testid="owner-filter"]').first();
    this.priorityFilter   = page.locator('select[name*="priority"], [data-testid="priority-filter"]').first();
    this.clearFiltersButton = page.getByRole('button', { name: /clear.*filter/i }).first();
  }

  async goto() {
    await this.page.goto('/projects');
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async createProject(name: string, description?: string) {
    await this.createButton.click();
    const nameInput = this.page.locator('input[name="name"], input[placeholder*="Project name"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(name);
    if (description) {
      const descInput = this.page.locator('textarea[name="description"], textarea[placeholder*="escription"]').first();
      await descInput.fill(description);
    }
    await this.page.getByRole('button', { name: /create|save/i }).first().click();
  }

  async expectProjectCount(count: number) {
    await expect(this.projectCards).toHaveCount(count, { timeout: 8_000 });
  }

  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible({ timeout: 8_000 });
  }

  async expectFilterEmptyState() {
    await expect(this.filterEmptyState).toBeVisible({ timeout: 5_000 });
  }

  async searchFor(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // debounce
  }

  async clearFilters() {
    await this.clearFiltersButton.click();
  }
}
