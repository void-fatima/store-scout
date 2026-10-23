import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './browser',
  testMatch: '**/*.browser.ts',
  outputDir: './ui-artifacts/results',
  reporter: [['list'], ['html', { outputFolder: 'ui-artifacts/report', open: 'never' }]],
  workers: 2,
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    launchOptions: process.env.STORE_SCOUT_CHROMIUM ? { executablePath: process.env.STORE_SCOUT_CHROMIUM } : {},
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
})
