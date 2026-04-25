import { defineConfig, devices } from '@playwright/test'

// Functional e2e tests run across browsers by default.
// Benchmarks live in browser-bench.spec.ts and run only when BENCH=1 is set
// (via `bun run bench:browser`). Keeping them separate avoids polluting CI
// runtime and adding measurement variance to functional test reports.
const IS_BENCH = process.env.BENCH === '1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !IS_BENCH,
  forbidOnly: !!process.env.CI,
  // Benches: one worker, no retries — results must be deterministic.
  retries: IS_BENCH ? 0 : process.env.CI ? 2 : 0,
  workers: IS_BENCH ? 1 : process.env.CI ? 1 : undefined,
  reporter: IS_BENCH ? 'list' : 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: IS_BENCH ? 'off' : 'on-first-retry',
  },
  webServer: {
    command: 'npx vite --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  projects: IS_BENCH
    ? [
        {
          name: 'bench',
          testMatch: /browser-bench\.spec\.ts/,
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'chromium',
          testIgnore: /browser-bench\.spec\.ts/,
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          testIgnore: /browser-bench\.spec\.ts/,
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          testIgnore: /browser-bench\.spec\.ts/,
          use: { ...devices['Desktop Safari'] },
        },
        {
          name: 'mobile-chrome',
          testIgnore: /browser-bench\.spec\.ts/,
          use: { ...devices['Pixel 5'] },
        },
        {
          name: 'mobile-safari',
          testIgnore: /browser-bench\.spec\.ts/,
          use: { ...devices['iPhone 12'] },
        },
      ],
})
