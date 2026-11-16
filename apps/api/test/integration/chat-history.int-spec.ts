import { randomUUID } from 'node:crypto';

import { CHAT_HISTORY_TTL_MINUTES } from '@ers/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MINUTE_MS } from '../../src/common/time.js';
import {
  CHAT_HISTORY_MAX_ENTRIES,
  CHATS_PER_USER,
  ChatHistoryStore,
  type ChatEntry,
} from '../../src/modules/chat/chat-history.store.js';
import { RedisService } from '../../src/redis/redis.service.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

const question: ChatEntry = { role: 'user', content: 'Events in Tallinn?' };
const answer: ChatEntry = { role: 'assistant', content: 'Two events.' };
const toolResult: ChatEntry = { role: 'tool', tool_call_id: 'c1', content: '{"total":2}' };
const PARALLEL_TURNS = 12;
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
    const userId = randomUUID();
    const chatId = await store.create(userId);
    expect(await store.load(userId, chatId)).toEqual([]);

    await store.append(userId, chatId, [question, toolCall]);

    expect(await store.load(userId, chatId)).toEqual([question, toolCall]);
  });

  it('keeps the fields the model added to a tool call', async () => {
    const userId = randomUUID();
    const chatId = await store.create(userId);
    await store.append(userId, chatId, [toolCall]);

    const [loaded] = (await store.load(userId, chatId)) ?? [];

    expect(JSON.stringify(loaded)).toContain('thought_signature');
  });

  it('finds nothing for another user, even with the right chat id', async () => {
    const owner = randomUUID();
    const chatId = await store.create(owner);
    await store.append(owner, chatId, [question]);

    expect(await store.load(randomUUID(), chatId)).toBeUndefined();
  });

  it('finds nothing for an unknown chat id', async () => {
    expect(await store.load(randomUUID(), randomUUID())).toBeUndefined();
  });

  it('keeps a chat for its lifetime after the last use', async () => {
    const userId = randomUUID();
    const chatId = await store.create(userId);
    await store.append(userId, chatId, [question]);

    const left = await redis.pttl(`chat:${userId}:${chatId}`);

    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(CHAT_HISTORY_TTL_MINUTES * MINUTE_MS);
  });

  it('drops whole old turns once over the limit', async () => {
    const userId = randomUUID();
    const chatId = await store.create(userId);
    const turn: ChatEntry[] = [question, answer];
    for (let index = 0; index <= CHAT_HISTORY_MAX_ENTRIES / turn.length; index += 1) {
      await store.append(userId, chatId, turn);
    }

    const entries = (await store.load(userId, chatId)) ?? [];

    expect(entries.length).toBeLessThanOrEqual(CHAT_HISTORY_MAX_ENTRIES);
    expect(entries[0]).toMatchObject({ role: 'user' });
  });

  it('finds nothing for a chat whose lifetime is over, even while the user has other chats', async () => {
    const userId = randomUUID();
    const expired = await store.create(userId);
    await store.create(userId);
    await redis.zadd(`chats:${userId}`, Date.now() - 1, expired);

    expect(await store.load(userId, expired)).toBeUndefined();
  });

  it('writes nothing to a chat the user does not have', async () => {
    const userId = randomUUID();
    const chatId = randomUUID();

    expect(await store.append(userId, chatId, [question])).toBe(false);
    expect(await redis.exists(`chat:${userId}:${chatId}`)).toBe(0);
  });

  it('never cuts a turn apart when answers are saved at the same time', async () => {
    const userId = randomUUID();
    const chatId = await store.create(userId);

    await Promise.all(
      Array.from({ length: PARALLEL_TURNS }, () =>
        store.append(userId, chatId, [question, toolCall, toolResult, answer]),
      ),
    );

    const entries = (await store.load(userId, chatId)) ?? [];
    expect(entries.length).toBeLessThanOrEqual(CHAT_HISTORY_MAX_ENTRIES);
    expect(entries[0]).toMatchObject({ role: 'user' });
    entries.forEach((entry, index) => {
      if (entry.role === 'tool') expect(entries[index - 1]).toMatchObject({ role: 'assistant' });
    });
  });

  it('keeps every key of a chat on an expiry', async () => {
    const userId = randomUUID();
    const chatId = await store.create(userId);
    await store.append(userId, chatId, [question]);

    expect(await redis.pttl(`chats:${userId}`)).toBeGreaterThan(0);
    expect(await redis.pttl(`chat:${userId}:${chatId}`)).toBeGreaterThan(0);
  });

  it('keeps a bounded number of chats per user, dropping the one used longest ago', async () => {
    const userId = randomUUID();
    const first = await store.create(userId);
    for (let index = 0; index < CHATS_PER_USER; index += 1) await store.create(userId);

    expect(await redis.zcard(`chats:${userId}`)).toBe(CHATS_PER_USER);
    expect(await store.load(userId, first)).toBeUndefined();
  });

  it('starts over when a stored entry is damaged', async () => {
    const userId = randomUUID();
    const chatId = await store.create(userId);
    await store.append(userId, chatId, [question]);
    await redis.rpush(`chat:${userId}:${chatId}`, 'not json');

    expect(await store.load(userId, chatId)).toBeUndefined();
  });

  it('forgets one chat', async () => {
    const userId = randomUUID();
    const chatId = await store.create(userId);
    await store.append(userId, chatId, [question]);

    await store.remove(userId, chatId);

    expect(await store.load(userId, chatId)).toBeUndefined();
  });

  it('forgets all of a user’s chats and nobody else’s', async () => {
    const userId = randomUUID();
    const other = randomUUID();
    const first = await store.create(userId);
    const second = await store.create(userId);
    const kept = await store.create(other);
    await store.append(userId, first, [question]);
    await store.append(other, kept, [question]);

    await store.removeAll(userId);

    expect(await store.load(userId, first)).toBeUndefined();
    expect(await store.load(userId, second)).toBeUndefined();
    expect(await store.load(other, kept)).toEqual([question]);
  });
});
