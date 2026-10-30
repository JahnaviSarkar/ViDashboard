import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './frontend/tests/e2e',
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: 'npx vite preview frontend --port 5173 --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 30000,
  },
});

