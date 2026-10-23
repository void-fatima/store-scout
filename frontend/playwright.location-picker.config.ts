import { defineConfig } from '@playwright/test'

/** Own server; never attach to another checkout/session's process. */
export default defineConfig({
  testDir: './browser', testMatch: '**/*.browser.ts', workers: 2,
  outputDir: './ui-artifacts/location-picker/results',
  reporter: [['list'], ['html', { outputFolder: 'ui-artifacts/location-picker/report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5196', browserName: 'chromium', reducedMotion: 'reduce',
    launchOptions: process.env.STORE_SCOUT_CHROMIUM ? { executablePath: process.env.STORE_SCOUT_CHROMIUM } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5196 --strictPort',
    url: 'http://127.0.0.1:5196', reuseExistingServer: false,
  },
})
