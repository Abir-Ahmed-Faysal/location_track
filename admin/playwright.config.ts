import { defineConfig, devices } from '@playwright/test';

const e2ePort = Number(process.env.E2E_ADMIN_PORT ?? 5173);
const e2eHost = process.env.E2E_ADMIN_HOST ?? '127.0.0.1';
const e2eUrl = process.env.E2E_ADMIN_URL ?? `http://${e2eHost}:${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: e2eUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `pnpm exec vite --host ${e2eHost} --port ${e2ePort} --strictPort`,
    url: e2eUrl,
    env: { VITE_API_BASE_URL: process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:5173/api/v1' },
    reuseExistingServer: true,
    timeout: 30 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
