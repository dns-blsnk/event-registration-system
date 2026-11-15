import { randomUUID } from 'node:crypto';

import { TEST_ENV, testDatabaseUrl, testRedisUrl } from '../../api/test/helpers/test-env.ts';

/**
 * The whole stack for browser tests. It reuses the integration-test settings (same throwaway
 * Postgres, storage and keys, so they change together) with its own database, bucket and ports,
 * which do not clash with `pnpm dev` or the integration tests.
 */
export const API_PORT = 3100;
export const ADMIN_ORIGIN = 'http://localhost:5174';
export const DEMO_PASSWORD = 'e2e-demo-password';
export const E2E_DATABASE = 'ers_e2e';
export const E2E_BUCKET = 'ers-uploads-e2e';

const testServer = new URL(testDatabaseUrl(process.env));

function onTestServer(database: string): string {
  const url = new URL(testServer);
  url.pathname = `/${database}`;
  return url.toString();
}

/** Where the e2e database is dropped and created. */
export const ADMIN_DATABASE_URL = onTestServer('postgres');

export const E2E_ENV: Readonly<Record<string, string>> = {
  ...TEST_ENV,
  LOG_LEVEL: 'warn',
  API_PORT: String(API_PORT),
  ADMIN_ORIGIN,
  DATABASE_URL: onTestServer(E2E_DATABASE),
  S3_BUCKET: E2E_BUCKET,
  REDIS_URL: testRedisUrl(process.env),
  // A fresh namespace each run, like the fresh database: no counters or tickets from the last one.
  REDIS_KEY_PREFIX: `e2e:${randomUUID()}:`,
  SEED_DEMO_PASSWORD: DEMO_PASSWORD,
  // Set explicitly, so a developer's .env (which Vite also reads) cannot point the admin elsewhere.
  VITE_CHAT_URL: '',
};
