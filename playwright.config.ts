import { defineConfig, devices } from '@playwright/test';

export const FROZEN_NOW = '2026-09-15T10:00:00+05:30';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4321' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `SV_NOW=${FROZEN_NOW} npm run build && npm run preview -- --port 4321`,
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
