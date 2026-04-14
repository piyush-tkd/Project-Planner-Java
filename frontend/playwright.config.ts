/**
 * Playwright E2E Configuration — Portfolio Planner
 *
 * To install: npm install -D @playwright/test && npx playwright install chromium firefox
 * To run:     npx playwright test
 * To run UI:  npx playwright test --ui
 * Report:     npx playwright show-report
 *
 * Requires:
 *  - Backend running on :8080  (mvn spring-boot:run)
 *  - Frontend dev server on :5173 (npm run dev) — OR use preview (npm run build && npm run preview)
 *  - PostgreSQL portfolioplanner_e2e database seeded (see e2e/global-setup.ts)
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const BACKEND_URL  = process.env.BACKEND_URL ?? 'http://localhost:8080';

export const STORAGE_STATE = path.join(__dirname, 'e2e/fixtures/.auth/admin.json');

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,          // sequential — backend has shared state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    /* ── Setup: login once, save cookie state ─────────────────────────── */
    {
      name: 'setup',
      testMatch: /fixtures\/auth\.setup\.ts/,
    },

    /* ── Chrome (main) ────────────────────────────────────────────────── */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },

    /* ── Firefox (smoke only on CI) ───────────────────────────────────── */
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
      grep: /@smoke/,
    },
  ],

  /* ── Auto-start dev servers ───────────────────────────────────────── */
  webServer: [
    {
      command: 'mvn -f ../pom.xml spring-boot:run -Dspring-boot.run.profiles=e2e',
      url: `${BACKEND_URL}/actuator/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        SPRING_PROFILES_ACTIVE: 'e2e',
      },
    },
    {
      command: 'npm run dev',
      url: FRONTEND_URL,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
