import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';

import { clip } from '../../common/text.js';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '../../common/time.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import { generateCsrfToken, generateSessionToken, hashSessionToken } from './session-tokens.js';

import type { AuthSession, Prisma, User } from '../../generated/prisma/client.js';

const SESSION_TTL_DAYS = 7;
const SESSION_IDLE_HOURS = 24;
const SESSION_TOUCH_MINUTES = 5;
const IP_MAX_LENGTH = 64;
const USER_AGENT_MAX_LENGTH = 512;
export const SESSION_PURGE_BATCH_SIZE = 5000;

/** Absolute lifetime: a stolen cookie stops working after this, whatever happens. */
export const SESSION_TTL_MS = SESSION_TTL_DAYS * DAY_MS;
/**
 * Idle timeout. Measured from the last recorded touch, and touches are written at most every
 * SESSION_TOUCH_INTERVAL_MS, so in practice a session expires 23h55m to 24h after real activity.
 */
export const SESSION_IDLE_TIMEOUT_MS = SESSION_IDLE_HOURS * HOUR_MS;
/** lastSeenAt is refreshed at most this often, to avoid a write on every request. */
export const SESSION_TOUCH_INTERVAL_MS = SESSION_TOUCH_MINUTES * MINUTE_MS;

export interface SessionMeta {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface CreatedSession {
  token: string;
  csrfToken: string;
  expiresAt: Date;
}

export interface ValidSession {
  session: AuthSession;
  user: User;
}

/** Why a token did not resolve: never issued (possibly forged) or a real session that ran out. */
export type SessionLookup =
  { status: 'valid'; value: ValidSession } | { status: 'unknown' } | { status: 'expired' };

export function isExpired(
  session: Pick<AuthSession, 'expiresAt' | 'lastSeenAt'>,
  now: Date,
): boolean {
  return (
    session.expiresAt.getTime() <= now.getTime() ||
    now.getTime() - session.lastSeenAt.getTime() >= SESSION_IDLE_TIMEOUT_MS
  );
}

@Injectable()
export class SessionService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SessionService.name);
  }

  /** Also purges at startup: free hosting sleeps when idle, so the nightly cron can be missed. */
  onApplicationBootstrap(): void {
    void this.purgeExpired(); // purgeExpired() never rejects; errors are logged inside
  }

  async create(userId: string, meta: SessionMeta, now: Date = new Date()): Promise<CreatedSession> {
    const token = generateSessionToken();
    const csrfToken = generateCsrfToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await this.prisma.authSession.create({
      data: {
        tokenHash: hashSessionToken(token),
        csrfToken,
        userId,
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
        // Client-controlled headers: clipped so an oversized value cannot break the login.
        ip: meta.ip === undefined ? null : clip(meta.ip, IP_MAX_LENGTH),
        userAgent:
          meta.userAgent === undefined ? null : clip(meta.userAgent, USER_AGENT_MAX_LENGTH),
      },
    });
    return { token, csrfToken, expiresAt };
  }

  /** Returns the session and its user, or null if the token is unknown, expired or idle too long. */
  async validate(token: string, now: Date = new Date()): Promise<ValidSession | null> {
    const lookup = await this.lookup(token, now);
    return lookup.status === 'valid' ? lookup.value : null;
  }

  /** Like validate(), but says why a token did not resolve. */
  async lookup(token: string, now: Date = new Date()): Promise<SessionLookup> {
    const found = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    });
    if (found === null) {
      return { status: 'unknown' };
    }
    if (isExpired(found, now)) {
      await this.prisma.authSession.deleteMany({ where: { id: found.id } });
      return { status: 'expired' };
    }
    const { user, ...session } = found;
    if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
      // updateMany: the session may be revoked concurrently (logout); that is not an error.
      const { count } = await this.prisma.authSession.updateMany({
        where: { id: session.id },
        data: { lastSeenAt: now },
      });
      if (count === 0) {
        return { status: 'expired' };
      }
      session.lastSeenAt = now;
    }
    return { status: 'valid', value: { session, user } };
  }

  /**
   * A live session by id, for connections that authenticated another way (a chat ticket) and must
   * stop working once the session is signed out or runs out. Read-only: it does not count as activity.
   */
  async findLiveById(id: string, now: Date = new Date()): Promise<ValidSession | null> {
    const found = await this.prisma.authSession.findUnique({
      where: { id },
      include: { user: true },
    });
    if (found === null || isExpired(found, now)) {
      return null;
    }
    const { user, ...session } = found;
    return { session, user };
  }

  /** Which of these session ids are still live; one query for many open connections. */
  async liveIds(ids: readonly string[], now: Date = new Date()): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }
    const found = await this.prisma.authSession.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, expiresAt: true, lastSeenAt: true },
    });
    return new Set(
      found.filter((session) => !isExpired(session, now)).map((session) => session.id),
    );
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  /**
   * Signs the user out everywhere, e.g. after a password or role change. Pass `tx` to make it part
   * of the caller's transaction.
   */
  async revokeAllForUser(
    userId: string,
    exceptSessionId?: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const { count } = await tx.authSession.deleteMany({
      where: { userId, ...(exceptSessionId === undefined ? {} : { id: { not: exceptSessionId } }) },
    });
    return count;
  }

  /** Deletes expired and idle sessions in batches to keep locks short. Never throws. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const idleCutoff = new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS);
    let total = 0;
    try {
      for (;;) {
        const deleted = await this.prisma.$executeRaw`
          DELETE FROM auth_sessions
          WHERE id IN (
            SELECT id FROM auth_sessions
            WHERE expires_at <= ${now} OR last_seen_at <= ${idleCutoff}
            LIMIT ${SESSION_PURGE_BATCH_SIZE})`;
        total += deleted;
        if (deleted < SESSION_PURGE_BATCH_SIZE) {
          break;
        }
      }
      this.logger.info({ deleted: total }, 'expired sessions purged');
    } catch (error) {
      this.logger.warn({ err: error, deleted: total }, 'session purge failed, will retry next run');
    }
    return total;
  }
}
