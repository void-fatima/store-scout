import { defineConfig } from '@playwright/test'

/** Separate server/port so parallel frontend sessions keep their own checkout. */
export default defineConfig({
  testDir: './browser', testMatch: '**/*.browser.ts', workers: 2,
  outputDir: './ui-artifacts/intent/results',
  reporter: [['list'], ['html', { outputFolder: 'ui-artifacts/intent/report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5189', browserName: 'chromium', reducedMotion: 'reduce',
    launchOptions: process.env.STORE_SCOUT_CHROMIUM ? { executablePath: process.env.STORE_SCOUT_CHROMIUM } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5189 --strictPort',
    url: 'http://127.0.0.1:5189', reuseExistingServer: false,
  },
})
