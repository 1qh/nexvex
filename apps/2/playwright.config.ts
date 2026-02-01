import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://localhost:3000',
  isCI = Boolean(process.env.CI) // eslint-disable-line no-restricted-properties

export default defineConfig({
  expect: { timeout: 5000 },
  forbidOnly: isCI,
  fullyParallel: true,
  outputDir: './test-results',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure'
      }
    }
  ],
  reporter: [['html', { open: 'never' }], ['list']],
  retries: isCI ? 2 : 1,
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL },
  webServer: {
    command: 'dotenv -e ../../.env -- next dev --turbo',
    reuseExistingServer: !isCI,
    stdout: 'pipe',
    timeout: 120_000,
    url: `${baseURL}/chat`
  },
  workers: isCI ? 1 : undefined
})
