import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashSessionToken } from '../../src/modules/auth/session/session-tokens.js';
import {
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
  SESSION_TTL_MS,
  SessionService,
} from '../../src/modules/auth/session/session.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createUser } from '../helpers/factories.js';

import type { User } from '../../src/generated/prisma/client.js';
import type { INestApplication } from '@nestjs/common';

describe('SessionService', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: SessionService;
  let user: User;
  const now = new Date();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sessions = app.get(SessionService);
    user = await createUser(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a session and resolves its user from the token', async () => {
    const { token, csrfToken, expiresAt } = await sessions.create(user.id, { ip: '1.2.3.4' }, now);

    const result = await sessions.validate(token, now);

    expect(result?.user.id).toBe(user.id);
    expect(result?.session.csrfToken).toBe(csrfToken);
    expect(expiresAt.getTime()).toBe(now.getTime() + SESSION_TTL_MS);
  });

  it('stores only the token hash, never the token', async () => {
    const { token } = await sessions.create(user.id, {}, now);

    const stored = await prisma.authSession.findMany({ where: { userId: user.id } });

    expect(stored.some((row) => row.tokenHash === hashSessionToken(token))).toBe(true);
    expect(stored.some((row) => row.tokenHash === token)).toBe(false);
  });

  it('rejects an unknown token', async () => {
    expect(await sessions.validate('unknown-token', now)).toBeNull();
  });

  it('rejects and deletes a session past its absolute lifetime', async () => {
    const { token } = await sessions.create(user.id, {}, now);
    const later = new Date(now.getTime() + SESSION_TTL_MS);

    expect(await sessions.validate(token, later)).toBeNull();
    expect(await prisma.authSession.count({ where: { tokenHash: hashSessionToken(token) } })).toBe(
      0,
    );
  });

  it('rejects a session idle for longer than the idle timeout', async () => {
    const { token } = await sessions.create(user.id, {}, now);

    expect(
      await sessions.validate(token, new Date(now.getTime() + SESSION_IDLE_TIMEOUT_MS)),
    ).toBeNull();
  });

  it('extends the idle window only when the session is used after the touch interval', async () => {
    const { token } = await sessions.create(user.id, {}, now);
    const soon = new Date(now.getTime() + SESSION_TOUCH_INTERVAL_MS - 1);
    const later = new Date(now.getTime() + SESSION_TOUCH_INTERVAL_MS);

    await sessions.validate(token, soon);
    const untouched = await prisma.authSession.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(token) },
    });
    await sessions.validate(token, later);
    const touched = await prisma.authSession.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(token) },
    });

    expect(untouched.lastSeenAt.getTime()).toBe(now.getTime());
    expect(touched.lastSeenAt.getTime()).toBe(later.getTime());
  });

  it('revokes a single session', async () => {
    const { token } = await sessions.create(user.id, {}, now);

    await sessions.revoke(token);

    expect(await sessions.validate(token, now)).toBeNull();
  });

  it('revokes all sessions of a user except the current one', async () => {
    const other = await createUser(prisma);
    const current = await sessions.create(other.id, {}, now);
    const second = await sessions.create(other.id, {}, now);
    const currentSession = await sessions.validate(current.token, now);

    const revoked = await sessions.revokeAllForUser(other.id, currentSession?.session.id);

    expect(revoked).toBe(1);
    expect(await sessions.validate(current.token, now)).not.toBeNull();
    expect(await sessions.validate(second.token, now)).toBeNull();
  });

  it('removes sessions when their user is deleted', async () => {
    const doomed = await createUser(prisma);
    const { token } = await sessions.create(doomed.id, {}, now);

    await prisma.user.delete({ where: { id: doomed.id } });

    expect(await sessions.validate(token, now)).toBeNull();
  });

  it('clips oversized client headers instead of failing the login', async () => {
    const { token } = await sessions.create(
      user.id,
      { ip: '1'.repeat(200), userAgent: 'u'.repeat(5000) },
      now,
    );

    const stored = await prisma.authSession.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(token) },
    });

    expect(stored.ip).toHaveLength(64);
    expect(stored.userAgent).toHaveLength(512);
  });

  it('purges sessions that are idle but still within their lifetime', async () => {
    const owner = await createUser(prisma);
    const { token } = await sessions.create(owner.id, {}, now);
    await prisma.authSession.updateMany({
      where: { tokenHash: hashSessionToken(token) },
      data: { lastSeenAt: new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS - 1) },
    });

    await sessions.purgeExpired(now);

    expect(await prisma.authSession.count({ where: { userId: owner.id } })).toBe(0);
  });

  it('purges expired and idle sessions', async () => {
    const owner = await createUser(prisma);
    const old = new Date(now.getTime() - SESSION_TTL_MS - 1);
    await sessions.create(owner.id, {}, old);
    const fresh = await sessions.create(owner.id, {}, now);

    await sessions.purgeExpired(now);

    expect(await prisma.authSession.count({ where: { userId: owner.id } })).toBe(1);
    expect(await sessions.validate(fresh.token, now)).not.toBeNull();
  });
});
