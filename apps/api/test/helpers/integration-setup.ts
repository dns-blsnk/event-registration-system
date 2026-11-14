import 'reflect-metadata';

import { TEST_ENV, testDatabaseUrl } from './test-env.js';

// Tests always run against the test database and bucket, whatever the shell exports.
const databaseUrl = testDatabaseUrl(process.env);
for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value;
}
process.env.DATABASE_URL = databaseUrl;
