import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  testDir: '.', testMatch: 'location.browser.ts',
  outputDir: fileURLToPath(new URL('../../../../ui-artifacts/location/results', import.meta.url)),
  reporter: 'list', workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5187', browserName: 'chromium',
    launchOptions: process.env.STORE_SCOUT_CHROMIUM ? { executablePath: process.env.STORE_SCOUT_CHROMIUM } : {},
    trace: 'retain-on-failure', reducedMotion: 'reduce',
  },
  webServer: {
    cwd: fileURLToPath(new URL('../../../../', import.meta.url)),
    command: 'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',
    url: 'http://127.0.0.1:5187/src/features/location/preview/index.html',
    reuseExistingServer: false,
  },
})
