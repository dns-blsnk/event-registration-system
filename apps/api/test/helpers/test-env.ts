/** A complete, valid environment for tests. Values are local-only. */
export const TEST_ENV: Readonly<Record<string, string>> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  API_PORT: '3000',
  ADMIN_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://ers:ers_local_only@localhost:5443/ers_test',
  SESSION_SECRET: 'test-session-secret-that-is-long-enough-123',
  S3_ENDPOINT: 'http://localhost:8333',
  S3_REGION: 'auto',
  S3_BUCKET: 'ers-uploads-test',
  S3_ACCESS_KEY_ID: 'ers_local_key',
  S3_SECRET_ACCESS_KEY: 'ers_local_only_secret',
  S3_FORCE_PATH_STYLE: 'true',
};
