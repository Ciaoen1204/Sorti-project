import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: 45000,
  use: {
    baseURL: process.env.PWA_TEST_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
    { name: 'webkit-iphone', use: { ...devices['iPhone 13'] } },
  ],
});
