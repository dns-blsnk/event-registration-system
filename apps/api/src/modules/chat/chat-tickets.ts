import { CHAT_TICKET_TTL_SECONDS } from '@ers/shared';

import { SECOND_MS } from '../../common/time.js';
import { generateSessionToken, hashSessionToken } from '../auth/session-tokens.js';

const TICKET_TTL_MS = CHAT_TICKET_TTL_SECONDS * SECOND_MS;
/** Hard cap on unspent tickets, so a flood cannot grow memory without bound. */
const MAX_STORED_TICKETS = 10_000;

/**
 * Who a ticket was issued to. The gateway must still check that this session is alive when the
 * socket connects: a ticket does not outlive a logout or a revoked session.
 */
export interface TicketHolder {
  userId: string;
  sessionId: string;
}

interface StoredTicket extends TicketHolder {
  expiresAt: number;
}

/**
 * One-time chat tickets. The browser cannot send the HttpOnly session cookie to the API host
 * cross-site, so it trades a CSRF-checked REST call for a short-lived random ticket and puts that in
 * the socket handshake. Only hashes are kept, in memory: the API runs as one instance, and a
 * restart only makes the admin fetch a new ticket.
 */
export class ChatTicketStore {
  private readonly tickets = new Map<string, StoredTicket>();
  private lastSweep = 0;

  issue(holder: TicketHolder, now: number = Date.now()): { ticket: string; expiresAt: Date } {
    this.sweep(now);
    const ticket = generateSessionToken();
    const expiresAt = now + TICKET_TTL_MS;
    this.tickets.set(hashSessionToken(ticket), { ...holder, expiresAt });
    this.evictOverflow();
    return { ticket, expiresAt: new Date(expiresAt) };
  }

  /** The holder of a valid ticket, which is spent by this call; undefined for unknown or expired. */
  consume(ticket: unknown, now: number = Date.now()): TicketHolder | undefined {
    if (typeof ticket !== 'string' || ticket === '') {
      return undefined;
    }
    const key = hashSessionToken(ticket);
    const stored = this.tickets.get(key);
    this.tickets.delete(key);
    if (stored === undefined || stored.expiresAt <= now) {
      return undefined;
    }
    return { userId: stored.userId, sessionId: stored.sessionId };
  }

  /** Drops expired tickets at most once per ticket lifetime, so issuing stays cheap. */
  private sweep(now: number): void {
    if (now - this.lastSweep < TICKET_TTL_MS) {
      return;
    }
    this.lastSweep = now;
    for (const [key, stored] of this.tickets) {
      if (stored.expiresAt <= now) {
        this.tickets.delete(key);
      }
    }
  }

  /** Over the cap, the oldest tickets go first (a Map keeps insertion order). */
  private evictOverflow(): void {
    for (const key of this.tickets.keys()) {
      if (this.tickets.size <= MAX_STORED_TICKETS) {
        return;
      }
      this.tickets.delete(key);
    }
  }
}
