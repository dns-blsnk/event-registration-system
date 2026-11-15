import { defineConfig, devices } from '@playwright/test';

import { ADMIN_ORIGIN, API_PORT, E2E_ENV } from './test/e2e-env.ts';

const STARTUP_TIMEOUT_MS = 180_000;
const isCi = (process.env.CI ?? 'false') !== 'false' && process.env.CI !== '';

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.e2e-spec.ts',
  // One shared database: tests create their own records, but run one at a time to stay predictable.
  workers: 1,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: ADMIN_ORIGIN,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Fresh database, then the built API as in production (`pnpm test:e2e` builds it first).
      command: 'node test/prepare-database.ts && node ../api/dist/main.js',
      url: `http://localhost:${String(API_PORT)}/api/health`,
      env: E2E_ENV,
      timeout: STARTUP_TIMEOUT_MS,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @ers/admin dev',
      url: ADMIN_ORIGIN,
      env: E2E_ENV,
      timeout: STARTUP_TIMEOUT_MS,
      reuseExistingServer: false,
    },
  ],
});
