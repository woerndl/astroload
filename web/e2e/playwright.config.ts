import { defineConfig } from '@playwright/test'

import { env, preflight, webEnv } from './fixtures'

// Runs against a seeded Mongo, the CMS and the built web app. The setup is
// documented in docs/astroload/conventions.md.
//
// Files run one at a time in name order because they share one CMS. The 00-
// prefix runs the deploy webhook test before any other test publishes: after
// a deploy webhook POST, the CMS sends no further POST for five minutes.
preflight()

export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.ts',
  workers: 1,
  timeout: 60_000,
  outputDir: '../.playwright/results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../.playwright/report' }]],
  use: { trace: 'retain-on-failure' },
  // Playwright starts each server after the previous one answers, so the web build can read from the CMS.
  webServer: [
    {
      name: 'cms',
      command: 'pnpm dev',
      cwd: '../../cms',
      url: `${env.cmsUrl}/api/health`,
      env: { PORT: new URL(env.cmsUrl).port },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      name: 'web',
      command: 'pnpm build && pnpm start',
      cwd: '..',
      url: env.websiteUrl,
      // server.mjs does not load .env, so the parsed file goes into its environment.
      env: { ...webEnv, PORT: new URL(env.websiteUrl).port },
      reuseExistingServer: !process.env.CI,
      timeout: 600_000,
    },
  ],
})
