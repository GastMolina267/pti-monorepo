import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: '.',
  testMatch: 'gateway.spec.ts',
  tsconfig: './tsconfig.json',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env['CI'],
  timeout: 90_000,
  globalTimeout: 180_000,
  expect: { timeout: 8000 },
  outputDir: resolve('.gateway/e2e-results'),
  reporter: [['list', { printSteps: true }]],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    // Las trazas pueden incluir JWT y credenciales; no se guardan sesiones ni tráfico de login.
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
});
