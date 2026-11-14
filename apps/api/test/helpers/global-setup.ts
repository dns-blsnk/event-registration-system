import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { testDatabaseUrl } from './test-env.js';

const API_ROOT = resolve(import.meta.dirname, '../..');

/** Applies migrations to the test database once before the integration suite. */
export default function setup(): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl(process.env) },
    stdio: 'pipe',
  });
}
