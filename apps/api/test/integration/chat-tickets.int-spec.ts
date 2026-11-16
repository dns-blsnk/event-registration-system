import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import { CHAT_TICKET_TTL_SECONDS } from '@ers/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ChatTicketStore } from '../../src/modules/chat/chat-tickets.js';
import { hashSessionToken } from '../../src/modules/identity/session-tokens.js';
import { RedisService } from '../../src/redis/redis.service.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

const holder = { userId: randomUUID(), sessionId: randomUUID() };
const EXPIRY_WAIT_MS = 20;

function keyOf(ticket: string): string {
  return `chat-ticket:${hashSessionToken(ticket)}`;
}

describe('chat tickets in Redis', () => {
  let app: INestApplication;
  let store: ChatTicketStore;
  let redis: RedisService;

  beforeAll(async () => {
    app = await createTestApp();
    store = app.get(ChatTicketStore);
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets a fresh ticket open one socket for its holder', async () => {
    const { ticket } = await store.issue(holder);

    expect(await store.consume(ticket)).toEqual(holder);
  });

  it('refuses a ticket used a second time', async () => {
    const { ticket } = await store.issue(holder);
    await store.consume(ticket);

    expect(await store.consume(ticket)).toBeUndefined();
  });

  it('lets only one of two sockets racing with the same ticket in', async () => {
    const { ticket } = await store.issue(holder);

    const results = await Promise.all([store.consume(ticket), store.consume(ticket)]);

    expect(results.filter((result) => result !== undefined)).toEqual([holder]);
  });

  it('refuses an expired ticket', async () => {
    const { ticket } = await store.issue(holder);
    await redis.pexpire(keyOf(ticket), 1);
    await sleep(EXPIRY_WAIT_MS);

    expect(await store.consume(ticket)).toBeUndefined();
  });

  it.each([
    ['an unknown ticket', 'not-a-ticket'],
    ['an empty ticket', ''],
    ['a ticket that is not a string', 42],
  ])('refuses %s', async (_case, ticket) => {
    expect(await store.consume(ticket)).toBeUndefined();
  });

  it('issues a different ticket every time', async () => {
    const [first, second] = await Promise.all([store.issue(holder), store.issue(holder)]);

    expect(first.ticket).not.toBe(second.ticket);
  });

  it('tells the admin when the ticket expires: one lifetime from now', async () => {
    const before = Date.now();
    const { expiresAt } = await store.issue(holder);

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + CHAT_TICKET_TTL_SECONDS * 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + CHAT_TICKET_TTL_SECONDS * 1000);
  });

  it('refuses a stored value it did not write, without treating it as an outage', async () => {
    const ticket = 'planted-ticket';
    await redis.set(keyOf(ticket), 'not json', 'EX', CHAT_TICKET_TTL_SECONDS);

    expect(await store.consume(ticket)).toBeUndefined();
  });

  it('lets Redis drop a ticket once its lifetime is over', async () => {
    const { ticket } = await store.issue(holder);

    const ttl = await redis.ttl(keyOf(ticket));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(CHAT_TICKET_TTL_SECONDS);
  });

  it('stores only the ticket hash, so reading Redis does not reveal a usable ticket', async () => {
    const { ticket } = await store.issue(holder);

    expect(await redis.exists(`chat-ticket:${ticket}`)).toBe(0);
    expect(await redis.get(keyOf(ticket))).not.toContain(ticket);
  });
});

describe('chat tickets across API instances', () => {
  const sharedPrefix = `test:${randomUUID()}:`;
  let issuing: INestApplication;
  let connecting: INestApplication;
  let unrelated: INestApplication;

  beforeAll(async () => {
    issuing = await createTestApp({ redisKeyPrefix: sharedPrefix });
    connecting = await createTestApp({ redisKeyPrefix: sharedPrefix });
    unrelated = await createTestApp();
  });

  afterAll(async () => {
    await Promise.all([issuing.close(), connecting.close(), unrelated.close()]);
  });

  it('accepts on one instance a ticket another instance issued, once', async () => {
    const { ticket } = await issuing.get(ChatTicketStore).issue(holder);

    expect(await connecting.get(ChatTicketStore).consume(ticket)).toEqual(holder);
    expect(await issuing.get(ChatTicketStore).consume(ticket)).toBeUndefined();
  });

  it('does not see tickets of an app with another key namespace', async () => {
    const { ticket } = await issuing.get(ChatTicketStore).issue(holder);

    expect(await unrelated.get(ChatTicketStore).consume(ticket)).toBeUndefined();
  });
});
