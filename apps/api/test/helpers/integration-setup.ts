import 'reflect-metadata';

import { TEST_ENV, testDatabaseUrl, testRedisUrl } from './test-env.js';

// Tests always run against the test database and bucket, whatever the shell exports.
const databaseUrl = testDatabaseUrl(process.env);
const redisUrl = testRedisUrl(process.env);
for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value;
}
process.env.DATABASE_URL = databaseUrl;
process.env.REDIS_URL = redisUrl;
