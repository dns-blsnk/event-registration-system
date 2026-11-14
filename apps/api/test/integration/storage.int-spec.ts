import { randomUUID } from 'node:crypto';

import { BANNER_MAX_BYTES } from '@ers/shared';
import { HttpStatus, type INestApplication } from '@nestjs/common';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { DomainError } from '../../src/common/errors/domain-error.js';
import {
  PRESIGNED_URL_TTL_SECONDS,
  StorageService,
} from '../../src/modules/storage/storage.service.js';
import { createTestApp } from '../helpers/create-test-app.js';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe('object storage', () => {
  let app: INestApplication;
  let storage: StorageService;
  const written: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    storage = app.get(StorageService);
  });

  afterEach(async () => {
    await Promise.all(written.splice(0).map(async (key) => storage.delete(key)));
  });

  afterAll(async () => {
    await app.close();
  });

  function newKey(): string {
    const key = `test/${randomUUID()}`;
    written.push(key);
    return key;
  }

  async function codeOf(run: () => Promise<unknown>): Promise<string | undefined> {
    try {
      await run();
    } catch (error) {
      return error instanceof DomainError ? error.code : 'OTHER';
    }
    return undefined;
  }

  it('stores an image with the type read from its bytes and serves it through a presigned link', async () => {
    const key = newKey();

    expect(await storage.putImage(key, PNG)).toBe('image/png');
    const url = await storage.presignedGetUrl(key);
    const downloaded = await fetch(url);

    expect(downloaded.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(PNG);
    expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe(String(PRESIGNED_URL_TTL_SECONDS));
  });

  it('deletes an object', async () => {
    const key = newKey();
    await storage.putImage(key, PNG);

    await storage.delete(key);

    expect((await fetch(await storage.presignedGetUrl(key))).status).toBe(HttpStatus.NOT_FOUND);
  });

  it('refuses to store anything that is not a supported image', async () => {
    const key = newKey();

    expect(await codeOf(() => storage.putImage(key, Buffer.from('<svg onload=alert(1)>')))).toBe(
      'VALIDATION_FAILED',
    );
    expect((await fetch(await storage.presignedGetUrl(key))).status).toBe(HttpStatus.NOT_FOUND);
  });

  it('refuses an image over the size limit before storing it', async () => {
    const oversized = new Uint8Array(BANNER_MAX_BYTES + 1);
    oversized.set(PNG);

    expect(await codeOf(() => storage.putImage(newKey(), oversized))).toBe('PAYLOAD_TOO_LARGE');
  });

  it('does not serve an object without a signature', async () => {
    const key = newKey();
    await storage.putImage(key, PNG);
    const unsigned = new URL(await storage.presignedGetUrl(key));
    unsigned.search = '';

    expect((await fetch(unsigned)).ok).toBe(false);
  });

  it('treats deleting a missing object as done', async () => {
    await expect(storage.delete(`test/${randomUUID()}`)).resolves.toBeUndefined();
  });
});
