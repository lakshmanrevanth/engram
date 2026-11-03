import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { STORAGE_STATE } from './e2e/paths';

// Load .env / .env.local the same way Next does, so global setup sees the app's DATABASE_URL.
// On CI the variables come from the workflow environment instead.
loadEnvConfig(process.cwd());

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const isCI = !!process.env.CI;
// Machines without downloaded Playwright browsers can use an installed one, e.g. PW_CHANNEL=msedge.
const channel = process.env.PW_CHANNEL || undefined;


export default defineConfig({
  testDir: 'e2e',
  // One worker: every spec shares the same database and test user.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [['list'], ['html', { open: 'never' }], ['github']] : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The dev server compiles routes on first hit; give navigations room.
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], channel },
    },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], channel, storageState: STORAGE_STATE },
    },
  ],
  webServer:
    process.env.E2E_START_SERVER === '1'
      ? {
          command: 'npm run start',
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        }
      : undefined,
});
