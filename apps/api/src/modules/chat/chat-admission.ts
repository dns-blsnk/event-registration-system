import { Injectable } from '@nestjs/common';

import { MINUTE_MS } from '../../common/time.js';
import { countHits } from '../../redis/fixed-window.js';
import { RedisService } from '../../redis/redis.service.js';
import { SessionService, type ValidSession } from '../identity/session.service.js';

/** A person asks a few questions a minute; more is a script spending the model budget. */
export const MESSAGES_PER_MINUTE = 10;
const MESSAGES_KEY_PREFIX = 'chat-messages:';

/**
 * Whether a connected socket may still be served: within its user's message limit, and backed by
 * a live session. Checked on every message, since a session can end and a role can change while
 * the socket stays open.
 */
@Injectable()
export class ChatAdmission {
  constructor(
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
  ) {}

  /** Counts this message against the user's limit; false once over it. Shared by all instances. */
  async isWithinLimit(userId: string): Promise<boolean> {
    const [count = 0] = await countHits(this.redis, [`${MESSAGES_KEY_PREFIX}${userId}`], MINUTE_MS);
    return count <= MESSAGES_PER_MINUTE;
  }

  /** The session with the user's current role, or null once it has ended. */
  async liveSession(sessionId: string): Promise<ValidSession | null> {
    return this.sessions.findLiveById(sessionId);
  }

  /** Which of these sessions are still live, for closing the sockets of the rest. */
  async liveSessionIds(sessionIds: readonly string[]): Promise<Set<string>> {
    return this.sessions.liveIds(sessionIds);
  }
}
