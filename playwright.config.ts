import { defineConfig, devices } from '@playwright/test';

// E2E regression harness (CLAUDE.md §8.B). A single spec opens the running app,
// drives it to a known itinerary (the seeded showcase trip), and ASSERTS the
// engine's headline numbers — it is a regression test, not just a screenshotter.
// globalSetup seeds the demo trip first so the home page has deterministic data
// even when an existing dev server is reused.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
