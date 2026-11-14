import { CHAT_TICKET_TTL_SECONDS } from '@ers/shared';
import { describe, expect, it } from 'vitest';

import { SECOND_MS } from '../../common/time.js';

import { ChatTicketStore } from './chat-tickets.js';

const holder = { userId: 'u1', sessionId: 's1' };
const NOW = 1_000_000;
const TTL_MS = CHAT_TICKET_TTL_SECONDS * SECOND_MS;
const MAX_STORED_TICKETS = 10_000;

describe('ChatTicketStore', () => {
  it('lets a fresh ticket open one socket for its holder', () => {
    const store = new ChatTicketStore();
    const { ticket, expiresAt } = store.issue(holder, NOW);

    expect(expiresAt.getTime()).toBe(NOW + TTL_MS);
    expect(store.consume(ticket, NOW + 1)).toEqual(holder);
  });

  it('refuses a ticket used a second time', () => {
    const store = new ChatTicketStore();
    const { ticket } = store.issue(holder, NOW);
    store.consume(ticket, NOW);

    expect(store.consume(ticket, NOW)).toBeUndefined();
  });

  it('refuses an expired ticket', () => {
    const store = new ChatTicketStore();
    const { ticket } = store.issue(holder, NOW);

    expect(store.consume(ticket, NOW + TTL_MS)).toBeUndefined();
  });

  it.each([undefined, '', 42, 'made-up-ticket'])('refuses %p', (ticket) => {
    expect(new ChatTicketStore().consume(ticket, NOW)).toBeUndefined();
  });

  it('issues a different ticket every time', () => {
    const store = new ChatTicketStore();

    expect(store.issue(holder, NOW).ticket).not.toBe(store.issue(holder, NOW).ticket);
  });

  it('forgets tickets that expired unused when issuing new ones', () => {
    const store = new ChatTicketStore();
    store.issue(holder, NOW);
    const { ticket: old } = store.issue(holder, NOW + TTL_MS + 1);
    store.issue(holder, NOW + 3 * TTL_MS);

    expect(store.consume(old, NOW + TTL_MS + 2)).toBeUndefined();
  });

  it('keeps at most a fixed number of unspent tickets, dropping the oldest', () => {
    const store = new ChatTicketStore();
    const { ticket: oldest } = store.issue(holder, NOW);
    let newest = '';
    for (let index = 0; index < MAX_STORED_TICKETS; index += 1) {
      newest = store.issue(holder, NOW).ticket;
    }

    expect(store.consume(oldest, NOW)).toBeUndefined();
    expect(store.consume(newest, NOW)).toEqual(holder);
  });
});
