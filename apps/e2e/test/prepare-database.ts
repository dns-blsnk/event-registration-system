import { execFileSync } from 'node:child_process';

import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';

import { ADMIN_DATABASE_URL, E2E_BUCKET, E2E_DATABASE, E2E_ENV } from './e2e-env.ts';

/** Drops and recreates `ers_e2e`, only ever this throwaway database on the test server. */
async function recreateDatabase(): Promise<void> {
  const client = new pg.Client({ connectionString: ADMIN_DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${E2E_DATABASE} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${E2E_DATABASE}`);
  } finally {
    await client.end();
  }
}

/** Empties the e2e bucket, so the banners each seed uploads do not pile up across runs. */
async function emptyBucket(): Promise<void> {
  const s3 = new S3Client({
    endpoint: E2E_ENV.S3_ENDPOINT ?? '',
    region: E2E_ENV.S3_REGION ?? '',
    forcePathStyle: true,
    credentials: {
      accessKeyId: E2E_ENV.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: E2E_ENV.S3_SECRET_ACCESS_KEY ?? '',
    },
  });
  let page = await s3.send(new ListObjectsV2Command({ Bucket: E2E_BUCKET }));
  while ((page.Contents ?? []).length > 0) {
    const objects = (page.Contents ?? []).map(({ Key }) => ({ Key }));
    await s3.send(new DeleteObjectsCommand({ Bucket: E2E_BUCKET, Delete: { Objects: objects } }));
    page = await s3.send(new ListObjectsV2Command({ Bucket: E2E_BUCKET }));
  }
}

// A fresh database and bucket for every run, then migrations and the demo data.
await Promise.all([recreateDatabase(), emptyBucket()]);
const env = { ...process.env, ...E2E_ENV };
for (const script of ['db:deploy', 'db:seed']) {
  execFileSync('pnpm', ['--filter', '@ers/api', script], { env, stdio: 'inherit' });
}
