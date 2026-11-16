import argon2 from 'argon2';
import { describe, expect, it, vi } from 'vitest';

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

  it.each([null, undefined, 'not-an-argon2-hash'])(
    'still runs a full argon2 verification for an unusable hash (%p), so timing does not reveal accounts',
    async (hash) => {
      const verify = vi.spyOn(argon2, 'verify');

      expect(await service.verify(hash, 'whatever')).toBe(false);

      // Same algorithm and cost as a real check: a dummy argon2id hash with the OWASP parameters.
      expect(verify).toHaveBeenCalledOnce();
      expect(verify.mock.calls[0]?.[0]).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      verify.mockRestore();
    },
  );
});
