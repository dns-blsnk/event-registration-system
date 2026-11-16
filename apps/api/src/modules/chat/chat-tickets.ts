import { CHAT_TICKET_TTL_SECONDS } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { SECOND_MS } from '../../common/time.js';
import { RedisService } from '../../redis/redis.service.js';
import { generateSessionToken, hashSessionToken } from '../identity/session-tokens.js';

const TICKET_KEY_PREFIX = 'chat-ticket:';

/**
 * Who a ticket was issued to. The gateway must still check that this session is alive when the
 * socket connects: a ticket does not outlive a logout or a revoked session.
 */
export interface TicketHolder {
  userId: string;
  sessionId: string;
}

function keyOf(ticket: string): string {
  return `${TICKET_KEY_PREFIX}${hashSessionToken(ticket)}`;
}

/** Reads back what `issue` stored; anything else in the key is treated as no ticket. */
function parseHolder(stored: string | null): TicketHolder | undefined {
  if (stored === null) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    // Recovered on purpose: a value issue() did not write is a refusal, not an outage.
    return undefined;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'userId' in value &&
    'sessionId' in value &&
    typeof value.userId === 'string' &&
    typeof value.sessionId === 'string'
  ) {
    return { userId: value.userId, sessionId: value.sessionId };
  }
  return undefined;
}

/**
 * One-time chat tickets. The browser cannot send the HttpOnly session cookie to the API host
 * cross-site, so it trades a CSRF-checked REST call for a short-lived random ticket and puts that in
 * the socket handshake. Kept in Redis, so a ticket issued by one API instance opens a socket on
 * another; only its hash is stored, and Redis drops it when it expires.
 */
@Injectable()
export class ChatTicketStore {
  constructor(private readonly redis: RedisService) {}

  async issue(holder: TicketHolder): Promise<{ ticket: string; expiresAt: Date }> {
    // Taken before the write, so the expiry the admin sees is never later than Redis's.
    const expiresAt = new Date(Date.now() + CHAT_TICKET_TTL_SECONDS * SECOND_MS);
    const ticket = generateSessionToken();
    const value = JSON.stringify({ userId: holder.userId, sessionId: holder.sessionId });
    await this.redis.set(keyOf(ticket), value, 'EX', CHAT_TICKET_TTL_SECONDS);
    return { ticket, expiresAt };
  }

  /**
   * The holder of a valid ticket, which is spent by this call; undefined for unknown or expired.
   * GETDEL reads and deletes in one step, so two sockets racing with one ticket cannot both pass.
   */
  async consume(ticket: unknown): Promise<TicketHolder | undefined> {
    if (typeof ticket !== 'string' || ticket === '') return undefined;
    return parseHolder(await this.redis.getdel(keyOf(ticket)));
  }
}
