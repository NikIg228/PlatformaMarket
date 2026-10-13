import { defineConfig, devices } from '@playwright/test';
import { e2eJwtSecret } from './fixtures/workspace-session';
import { resolve } from 'node:path';
const target = new URL(process.env.DATABASE_URL ?? 'invalid:');
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/dentmarket_audit_20260914' || target.port !== '5432' || target.search !== '?schema=public') throw new Error('Use db:test and the approved isolated audit database');
process.env.JWT_SECRET = e2eJwtSecret;
export default defineConfig({ testDir: './tests', testMatch: 'admin-messages-live.spec.ts', workers: 1, retries: 0, timeout: 150000,
  expect: { timeout: 12000 }, reporter: [['list'], ['json', { outputFile: '../../output/playwright/admin-messages-live/results.json' }]],
  outputDir: '../../output/playwright/admin-messages-live/artifacts',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3000', serviceWorkers: 'block', screenshot: 'off', trace: 'off' },
  webServer: { command: 'npm run start --workspace=@marketplace/api', cwd: '../..', url: 'http://127.0.0.1:4412/api/health/ready', reuseExistingServer: false, timeout: 120000,
    env: { DATABASE_URL: process.env.DATABASE_URL!, API_HOST: '127.0.0.1', API_PORT: '4412', NODE_ENV: 'test', AUTH_MODE: 'jwt', JWT_SECRET: e2eJwtSecret,
      DEPLOYMENT_PROFILE: 'pilot', PROCESS_ROLE: 'api', BACKGROUND_QUEUE_ENABLED: 'false', PAYMENT_PROVIDER_MODE: 'mock', OBJECT_STORAGE_DRIVER: 'local', AV_SCAN_MODE: 'disabled',
      LOCAL_STORAGE_PATH: resolve('.tmp/messages-audit-2026-10-13/storage'), AUTH_LOCAL_MAIL_ENABLED: 'false', LOCAL_OPERATOR_PASSWORD_LOGIN_ENABLED: 'false' } }
});
