import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'prisma/config';

// The Prisma CLI reads DATABASE_URL; locally it comes from the repo-root .env.
const LOCAL_ENV_FILE = resolve(import.meta.dirname, '../../.env');
if (process.env.DATABASE_URL === undefined && existsSync(LOCAL_ENV_FILE)) {
  process.loadEnvFile(LOCAL_ENV_FILE);
}

export default defineConfig({
  schema: resolve(import.meta.dirname, 'prisma/schema.prisma'),
  migrations: { path: resolve(import.meta.dirname, 'prisma/migrations') },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
