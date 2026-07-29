import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Look for tests in tests/e2e/
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',

  // Timeouts
  timeout: 30_000,
  expect: { timeout: 10_000 },

  // Prevent accidental .only commits from passing CI
  forbidOnly: !!process.env.CI,

  // Retry once on CI to handle flakiness
  retries: process.env.CI ? 1 : 0,

  // Parallel workers — 1 on CI for stability, auto locally
  workers: process.env.CI ? 1 : undefined,

  // Reporters — HTML for local, GitHub-friendly for CI
  reporter: process.env.CI
    ? [['html'], ['github']]
    : [['html'], ['list']],

  use: {
    // Base URL for tests that navigate to the app (overridable via env)
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',

    // Capture screenshot + trace on first failure for debugging
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',

    // Default browser
    ...devices['Desktop Chrome'],
  },

  // No webServer needed — current e2e tests use page.route() mocks.
  // When tests that need a live server are added, uncomment:
  // webServer: {
  //   command: 'npm run dev -- -p 3000',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
