import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: 'http://127.0.0.1:5500',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'desktop-fullhd',
      use: {
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false
      }
    },
    {
      name: 'mobile-s25',
      use: {
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true
      }
    }
  ],
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ]
});