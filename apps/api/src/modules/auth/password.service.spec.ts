import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id using the OWASP parameters', async () => {
    const hash = await service.hash('correct horse battery staple');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain('correct horse');
  });

  it('salts every hash', async () => {
    expect(await service.hash('same')).not.toBe(await service.hash('same'));
  });

  it('verifies the right password', async () => {
    const hash = await service.hash('s3cret-pass');

    expect(await service.verify(hash, 's3cret-pass')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('s3cret-pass');

    expect(await service.verify(hash, 'S3cret-pass')).toBe(false);
  });

  it.each([null, undefined])('rejects any password when there is no hash (%s)', async (hash) => {
    expect(await service.verify(hash, 'dummy-password-for-timing-equalisation')).toBe(false);
  });

  it.each(['not-a-hash', '', '$argon2id$broken'])(
    'treats a malformed stored hash (%p) as a failed login',
    async (hash) => {
      expect(await service.verify(hash, 'anything')).toBe(false);
    },
  );

  it('spends real hashing work on a missing hash, so timing does not reveal accounts', async () => {
    const started = performance.now();
    await service.verify(null, 'whatever');
    const missingMs = performance.now() - started;

    const hash = await service.hash('whatever');
    const startedReal = performance.now();
    await service.verify(hash, 'nope');
    const realMs = performance.now() - startedReal;

    expect(missingMs).toBeGreaterThan(realMs / 3);
  });
});
