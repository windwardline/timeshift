import { defineConfig, devices } from '@playwright/test';

// Demo-morning smoke test against the DEPLOYED app (CLAUDE.md §8.B — "opens the
// deployed app"). Runs ONLY the headline-number regression, never the coach spec:
// prod serves live, non-deterministic AI, whereas the regression asserts the
// engine's deterministic output, which must hold on the real deployment.
//
// No webServer and no globalSetup: prod is already running and already seeded
// with the showcase trip. Point elsewhere with PROD_URL=... npm run test:e2e:prod.
export default defineConfig({
  testDir: './e2e',
  testMatch: /regression\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1, // tolerate a single cold-start/network blip against the live site
  reporter: 'list',
  use: {
    baseURL: process.env.PROD_URL ?? 'https://timeshift.windwardline.com',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
