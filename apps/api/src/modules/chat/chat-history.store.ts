import { randomUUID } from 'node:crypto';

import { CHAT_HISTORY_TTL_MINUTES, type ChatHistoryMessage } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { MINUTE_MS } from '../../common/time.js';
import { RedisService } from '../../redis/redis.service.js';
import { execOrThrow } from '../../redis/transaction.js';

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const CHAT_TTL_MS = CHAT_HISTORY_TTL_MINUTES * MINUTE_MS;
/**
 * Entries kept per chat: questions, answers, tool calls and their results. About ten questions
 * with a search each; older turns are dropped whole, so a tool call never loses its result.
 */
export const CHAT_HISTORY_MAX_ENTRIES = 40;
/** Live chats per user; starting another drops the one used longest ago. */
export const CHATS_PER_USER = 20;

/** One entry as the model saw or wrote it, extra fields included (Gemini's thought signatures). */
export type ChatEntry = ChatCompletionMessageParam;

/**
 * The user's chats are a sorted set of chat id → the moment the chat expires. A chat is alive while
 * its moment is in the future; every use moves it a full lifetime ahead, together with the expiry
 * of the keys themselves.
 */
const LIVE_CHAT = `
local function isLive(index, chatId, now)
  local expires = redis.call('ZSCORE', index, chatId)
  return expires and tonumber(expires) > now
end
local function touch(index, chat, chatId, now, ttl)
  redis.call('ZADD', index, now + ttl, chatId)
  redis.call('PEXPIRE', index, ttl)
  redis.call('PEXPIRE', chat, ttl)
end
`;

/** KEYS: index. ARGV: chat id, now, ttl, chats per user. */
const CREATE_SCRIPT = `
local now, ttl = tonumber(ARGV[2]), tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZADD', KEYS[1], now + ttl, ARGV[1])
local extra = redis.call('ZCARD', KEYS[1]) - tonumber(ARGV[4])
if extra > 0 then redis.call('ZREMRANGEBYRANK', KEYS[1], 0, extra - 1) end
redis.call('PEXPIRE', KEYS[1], ttl)
`;

/** KEYS: index, chat. ARGV: chat id, now, ttl. The entries, or nil for no live chat. */
const LOAD_SCRIPT = `${LIVE_CHAT}
local now, ttl = tonumber(ARGV[2]), tonumber(ARGV[3])
if not isLive(KEYS[1], ARGV[1], now) then return false end
touch(KEYS[1], KEYS[2], ARGV[1], now, ttl)
return redis.call('LRANGE', KEYS[2], 0, -1)
`;

/**
 * KEYS: index, chat. ARGV: chat id, now, ttl, max entries, entries... Appends only to a live chat
 * (1), else does nothing (0). Over the limit it cuts at the first question among the newest
 * entries, or keeps the whole current turn if that alone is longer.
 */
const APPEND_SCRIPT = `${LIVE_CHAT}
local now, ttl, max = tonumber(ARGV[2]), tonumber(ARGV[3]), tonumber(ARGV[4])
if not isLive(KEYS[1], ARGV[1], now) then return 0 end
local length = redis.call('RPUSH', KEYS[2], unpack(ARGV, 5))
local function isQuestion(index)
  return cjson.decode(redis.call('LINDEX', KEYS[2], index)).role == 'user'
end
if length > max then
  local cut = 0
  for index = length - max, length - 1 do
    if isQuestion(index) then cut = index break end
  end
  if cut == 0 then
    for index = length - max - 1, 1, -1 do
      if isQuestion(index) then cut = index break end
    end
  end
  if cut > 0 then redis.call('LTRIM', KEYS[2], cut, -1) end
end
touch(KEYS[1], KEYS[2], ARGV[1], now, ttl)
return 1
`;

/** Scripts that touch a chat get two keys: the user's chat index, then the chat. */
const CHAT_SCRIPT_KEYS = 2;

function chatKey(userId: string, chatId: string): string {
  return `chat:${userId}:${chatId}`;
}

function indexKey(userId: string): string {
  return `chats:${userId}`;
}

/** What load() read back; a value the store did not write makes the whole chat unusable. */
function parseEntries(raw: readonly string[]): ChatEntry[] | undefined {
  try {
    return raw.map((entry) => JSON.parse(entry) as ChatEntry);
  } catch {
    // Recovered on purpose: a damaged chat starts over instead of failing every question.
    return undefined;
  }
}

/** The chat as the user sees it: their questions and the final answers, no tool traffic. */
export function toDisplayMessages(entries: readonly ChatEntry[]): ChatHistoryMessage[] {
  return entries.flatMap((entry): ChatHistoryMessage[] => {
    if (entry.role === 'user' && typeof entry.content === 'string') {
      return [{ role: 'user', text: entry.content }];
    }
    if (entry.role !== 'assistant' || (entry.tool_calls ?? []).length > 0) return [];
    const text = entry.content;
    return typeof text === 'string' && text !== '' ? [{ role: 'assistant', text }] : [];
  });
}

/**
 * Each user's chats, kept in Redis for CHAT_HISTORY_TTL_MINUTES after their last use. A chat is
 * found only under the user who owns it, so another user's chat id finds nothing. Reads and writes
 * are single scripts, so parallel answers cannot cut a chat mid-turn or leave a key without expiry.
 * The text is never logged.
 */
@Injectable()
export class ChatHistoryStore {
  constructor(private readonly redis: RedisService) {}

  /** A new, empty chat for the user; its id is what the browser keeps. */
  async create(userId: string): Promise<string> {
    const chatId = randomUUID();
    await this.redis.eval(
      CREATE_SCRIPT,
      1,
      indexKey(userId),
      chatId,
      Date.now(),
      CHAT_TTL_MS,
      CHATS_PER_USER,
    );
    return chatId;
  }

  /** The chat's entries, oldest first; undefined when the user has no such live chat. */
  async load(userId: string, chatId: string): Promise<ChatEntry[] | undefined> {
    const raw: unknown = await this.redis.eval(
      LOAD_SCRIPT,
      CHAT_SCRIPT_KEYS,
      indexKey(userId),
      chatKey(userId, chatId),
      chatId,
      Date.now(),
      CHAT_TTL_MS,
    );
    if (!Array.isArray(raw)) return undefined;
    return parseEntries(raw.filter((entry): entry is string => typeof entry === 'string'));
  }

  /** Adds entries to a live chat of the user; false when there is no such chat any more. */
  async append(userId: string, chatId: string, entries: readonly ChatEntry[]): Promise<boolean> {
    if (entries.length === 0) return true;
    const appended: unknown = await this.redis.eval(
      APPEND_SCRIPT,
      CHAT_SCRIPT_KEYS,
      indexKey(userId),
      chatKey(userId, chatId),
      chatId,
      Date.now(),
      CHAT_TTL_MS,
      CHAT_HISTORY_MAX_ENTRIES,
      ...entries.map((entry) => JSON.stringify(entry)),
    );
    return appended === 1;
  }

  async remove(userId: string, chatId: string): Promise<void> {
    await execOrThrow(
      this.redis.multi().del(chatKey(userId, chatId)).zrem(indexKey(userId), chatId),
    );
  }

  /** Every chat of the user, e.g. on sign-out or when their role changes. */
  async removeAll(userId: string): Promise<void> {
    const chatIds = await this.redis.zrange(indexKey(userId), '0', '-1');
    await this.redis.del(indexKey(userId), ...chatIds.map((chatId) => chatKey(userId, chatId)));
  }
}
