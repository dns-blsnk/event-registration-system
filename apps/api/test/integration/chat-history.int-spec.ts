import { randomUUID } from 'node:crypto';

import { CHAT_HISTORY_TTL_MINUTES } from '@ers/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MINUTE_MS } from '../../src/common/time.js';
import {
  CHAT_HISTORY_MAX_ENTRIES,
  CHATS_PER_USER,
  ChatHistoryStore,
  type ChatEntry,
  type ChatOwner,
} from '../../src/modules/chat/chat-history.store.js';
import { RedisService } from '../../src/redis/redis.service.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

const question: ChatEntry = { role: 'user', content: 'Events in Tallinn?' };
const answer: ChatEntry = { role: 'assistant', content: 'Two events.' };
const toolResult: ChatEntry = { role: 'tool', tool_call_id: 'c1', content: '{"total":2}' };
const PARALLEL_TURNS = 12;

function newOwner(): ChatOwner {
  return { userId: randomUUID(), role: 'CUSTOMER' };
}

function indexOf({ userId, role }: ChatOwner): string {
  return `chats:${userId}:${role}`;
}

function chatOf({ userId, role }: ChatOwner, chatId: string): string {
  return `chat:${userId}:${role}:${chatId}`;
}
/** A tool call as Gemini returns it, with a field the OpenAI types do not know about. */
const geminiToolCall = {
  role: 'assistant',
  content: null,
  tool_calls: [
    {
      id: 'c1',
      type: 'function',
      function: { name: 'search_events', arguments: '{"city":"Tallinn"}' },
      extra_content: { google: { thought_signature: 'sig' } },
    },
  ],
};
const toolCall: ChatEntry = geminiToolCall as unknown as ChatEntry;

describe('ChatHistoryStore', () => {
  let app: INestApplication;
  let store: ChatHistoryStore;
  let redis: RedisService;

  beforeAll(async () => {
    app = await createTestApp();
    store = app.get(ChatHistoryStore);
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts a chat empty and gives back what was added, in order', async () => {
    const me = newOwner();
    const chatId = await store.create(me);
    expect(await store.load(me, chatId)).toEqual([]);

    await store.append(me, chatId, [question, toolCall]);

    expect(await store.load(me, chatId)).toEqual([question, toolCall]);
  });

  it('keeps the fields the model added to a tool call', async () => {
    const me = newOwner();
    const chatId = await store.create(me);
    await store.append(me, chatId, [toolCall]);

    const [loaded] = (await store.load(me, chatId)) ?? [];

    expect(JSON.stringify(loaded)).toContain('thought_signature');
  });

  it('finds nothing for another user, even with the right chat id', async () => {
    const owner = newOwner();
    const chatId = await store.create(owner);
    await store.append(owner, chatId, [question]);

    expect(await store.load(newOwner(), chatId)).toBeUndefined();
  });

  it('finds nothing for an unknown chat id', async () => {
    expect(await store.load(newOwner(), randomUUID())).toBeUndefined();
  });

  it('keeps a chat for its lifetime after the last use', async () => {
    const me = newOwner();
    const chatId = await store.create(me);
    await store.append(me, chatId, [question]);

    const left = await redis.pttl(chatOf(me, chatId));

    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(CHAT_HISTORY_TTL_MINUTES * MINUTE_MS);
  });

  it('drops whole old turns once over the limit', async () => {
    const me = newOwner();
    const chatId = await store.create(me);
    const turn: ChatEntry[] = [question, answer];
    for (let index = 0; index <= CHAT_HISTORY_MAX_ENTRIES / turn.length; index += 1) {
      await store.append(me, chatId, turn);
    }

    const entries = (await store.load(me, chatId)) ?? [];

    expect(entries.length).toBeLessThanOrEqual(CHAT_HISTORY_MAX_ENTRIES);
    expect(entries[0]).toMatchObject({ role: 'user' });
  });

  it('finds nothing for a chat whose lifetime is over, even while the user has other chats', async () => {
    const me = newOwner();
    const expired = await store.create(me);
    await store.create(me);
    await redis.zadd(indexOf(me), Date.now() - 1, expired);

    expect(await store.load(me, expired)).toBeUndefined();
  });

  it('writes nothing to a chat the user does not have', async () => {
    const me = newOwner();
    const chatId = randomUUID();

    expect(await store.append(me, chatId, [question])).toBe(false);
    expect(await redis.exists(chatOf(me, chatId))).toBe(0);
  });

  it('never cuts a turn apart when answers are saved at the same time', async () => {
    const me = newOwner();
    const chatId = await store.create(me);

    await Promise.all(
      Array.from({ length: PARALLEL_TURNS }, () =>
        store.append(me, chatId, [question, toolCall, toolResult, answer]),
      ),
    );

    const entries = (await store.load(me, chatId)) ?? [];
    expect(entries.length).toBeLessThanOrEqual(CHAT_HISTORY_MAX_ENTRIES);
    expect(entries[0]).toMatchObject({ role: 'user' });
    entries.forEach((entry, index) => {
      if (entry.role === 'tool') expect(entries[index - 1]).toMatchObject({ role: 'assistant' });
    });
  });

  it('keeps every key of a chat on an expiry', async () => {
    const me = newOwner();
    const chatId = await store.create(me);
    await store.append(me, chatId, [question]);

    expect(await redis.pttl(indexOf(me))).toBeGreaterThan(0);
    expect(await redis.pttl(chatOf(me, chatId))).toBeGreaterThan(0);
  });

  it('keeps a bounded number of chats per user, dropping the one used longest ago', async () => {
    const me = newOwner();
    const first = await store.create(me);
    // Chats made within one millisecond expire at the same moment; make the first one clearly older.
    await redis.zadd(indexOf(me), Date.now() + MINUTE_MS, first);
    for (let index = 0; index < CHATS_PER_USER; index += 1) await store.create(me);

    expect(await redis.zcard(indexOf(me))).toBe(CHATS_PER_USER);
    expect(await store.load(me, first)).toBeUndefined();
  });

  it('starts over when a stored entry is damaged', async () => {
    const me = newOwner();
    const chatId = await store.create(me);
    await store.append(me, chatId, [question]);
    await redis.rpush(chatOf(me, chatId), 'not json');

    expect(await store.load(me, chatId)).toBeUndefined();
  });

  it('keeps a chat out of reach under another role of the same user', async () => {
    const organizer: ChatOwner = { userId: randomUUID(), role: 'ORGANIZER' };
    const chatId = await store.create(organizer);
    await store.append(organizer, chatId, [question]);

    expect(await store.load({ ...organizer, role: 'CUSTOMER' }, chatId)).toBeUndefined();
  });

  it('forgets one chat', async () => {
    const me = newOwner();
    const chatId = await store.create(me);
    await store.append(me, chatId, [question]);

    await store.remove(me, chatId);

    expect(await store.load(me, chatId)).toBeUndefined();
  });

  it('forgets all of a user’s chats and nobody else’s', async () => {
    const me = newOwner();
    const other = newOwner();
    const first = await store.create(me);
    const second = await store.create(me);
    const kept = await store.create(other);
    await store.append(me, first, [question]);
    await store.append(other, kept, [question]);

    await store.removeAll(me.userId);

    expect(await store.load(me, first)).toBeUndefined();
    expect(await store.load(me, second)).toBeUndefined();
    expect(await store.load(other, kept)).toEqual([question]);
  });
});
