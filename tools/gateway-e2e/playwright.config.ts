import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const demo = process.env['GATEWAY_DEMO'] === '1';
const operations = process.env['GATEWAY_OPERATIONS'] === '1';

export default defineConfig({
  testDir: '.',
  testMatch: operations ? 'operations.spec.ts' : 'gateway.spec.ts',
  globalSetup: './global-setup.ts',
  tsconfig: './tsconfig.json',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env['CI'],
  timeout: operations ? 300_000 : demo ? 240_000 : 90_000,
  globalTimeout: operations ? 420_000 : demo ? 300_000 : 180_000,
  expect: { timeout: 8000 },
  outputDir: resolve('.gateway/e2e-results'),
  reporter: [['list', { printSteps: true }]],
  use: {
    browserName: 'chromium',
    headless: !demo || process.env['GATEWAY_DEMO_HEADLESS'] === '1',
    viewport: { width: 1440, height: 1000 },
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    // Las trazas pueden incluir JWT y credenciales; no se guardan sesiones ni tráfico de login.
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'], slowMo: demo ? 200 : 0 },
  },
});
