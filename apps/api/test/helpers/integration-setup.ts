import 'reflect-metadata';

import { TEST_ENV } from './test-env.js';

// Tests always run against the test database and bucket, whatever the shell exports.
// CI may point at its own test database through TEST_DATABASE_URL.
for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value;
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? TEST_ENV.DATABASE_URL;
