import { randomUUID } from 'node:crypto';

import { CHAT_HISTORY_TTL_MINUTES, ROLES, type ChatHistoryMessage, type Role } from '@ers/shared';
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { MINUTE_MS } from '../../common/time.js';
import { RedisService } from '../../redis/redis.service.js';
import { execOrThrow } from '../../redis/transaction.js';
import { SignOutHooks } from '../identity/index.js';

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
 * Whose chats these are. The role is part of the keys: a chat holds what that role could look up,
 * so after a role change the old chats are out of reach even if wiping them failed.
 */
export interface ChatOwner {
  userId: string;
  role: Role;
}

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

/**
 * KEYS: index. ARGV: the full name every chat key of that index starts with. Deletes the chats and
 * the index in one step, so a chat started meanwhile cannot slip through.
 */
const REMOVE_ALL_SCRIPT = `
for _, chatId in ipairs(redis.call('ZRANGE', KEYS[1], 0, -1)) do
  redis.call('DEL', ARGV[1] .. chatId)
end
redis.call('DEL', KEYS[1])
`;

/** Scripts that touch a chat get two keys: the user's chat index, then the chat. */
const CHAT_SCRIPT_KEYS = 2;

function chatKeyPrefix({ userId, role }: ChatOwner): string {
  return `chat:${userId}:${role}:`;
}

function chatKey(owner: ChatOwner, chatId: string): string {
  return `${chatKeyPrefix(owner)}${chatId}`;
}

function indexKey({ userId, role }: ChatOwner): string {
  return `chats:${userId}:${role}`;
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

/** How the texts of one answer's rounds are joined, as the user saw them stream. */
const ROUND_SEPARATOR = '\n\n';

/**
 * The chat as the user saw it: each question, then everything the assistant wrote in answer to it
 * across its rounds, as one message. Tool calls and results are left out.
 */
export function toDisplayMessages(entries: readonly ChatEntry[]): ChatHistoryMessage[] {
  const messages: ChatHistoryMessage[] = [];
  let answer: string[] = [];
  const closeAnswer = () => {
    if (answer.length > 0) messages.push({ role: 'assistant', text: answer.join(ROUND_SEPARATOR) });
    answer = [];
  };
  for (const entry of entries) {
    if (entry.role === 'user' && typeof entry.content === 'string') {
      closeAnswer();
      messages.push({ role: 'user', text: entry.content });
    } else if (
      entry.role === 'assistant' &&
      typeof entry.content === 'string' &&
      entry.content !== ''
    ) {
      answer.push(entry.content);
    }
  }
  closeAnswer();
  return messages;
}

/**
 * Each user's chats, kept in Redis for CHAT_HISTORY_TTL_MINUTES after their last use. A chat is
 * found only under the user who owns it, so another user's chat id finds nothing. Reads and writes
 * are single scripts, so parallel answers cannot cut a chat mid-turn or leave a key without expiry.
 * The text is never logged.
 */
@Injectable()
export class ChatHistoryStore implements OnModuleInit {
  constructor(
    private readonly redis: RedisService,
    private readonly signOutHooks: SignOutHooks,
  ) {}

  /** A user who signs out, or loses all sessions on a role change, loses their chats too. */
  onModuleInit(): void {
    this.signOutHooks.register((userId) => this.removeAll(userId));
  }

  /** A new, empty chat for the user; its id is what the browser keeps. */
  async create(owner: ChatOwner): Promise<string> {
    const chatId = randomUUID();
    await this.redis.eval(
      CREATE_SCRIPT,
      1,
      indexKey(owner),
      chatId,
      Date.now(),
      CHAT_TTL_MS,
      CHATS_PER_USER,
    );
    return chatId;
  }

  /** The chat's entries, oldest first; undefined when the user has no such live chat. */
  async load(owner: ChatOwner, chatId: string): Promise<ChatEntry[] | undefined> {
    const raw: unknown = await this.redis.eval(
      LOAD_SCRIPT,
      CHAT_SCRIPT_KEYS,
      indexKey(owner),
      chatKey(owner, chatId),
      chatId,
      Date.now(),
      CHAT_TTL_MS,
    );
    if (!Array.isArray(raw)) return undefined;
    return parseEntries(raw.filter((entry): entry is string => typeof entry === 'string'));
  }

  /** Adds entries to a live chat of the user; false when there is no such chat any more. */
  async append(owner: ChatOwner, chatId: string, entries: readonly ChatEntry[]): Promise<boolean> {
    if (entries.length === 0) return true;
    const appended: unknown = await this.redis.eval(
      APPEND_SCRIPT,
      CHAT_SCRIPT_KEYS,
      indexKey(owner),
      chatKey(owner, chatId),
      chatId,
      Date.now(),
      CHAT_TTL_MS,
      CHAT_HISTORY_MAX_ENTRIES,
      ...entries.map((entry) => JSON.stringify(entry)),
    );
    return appended === 1;
  }

  async remove(owner: ChatOwner, chatId: string): Promise<void> {
    await execOrThrow(this.redis.multi().del(chatKey(owner, chatId)).zrem(indexKey(owner), chatId));
  }

  /** Every chat of the user under every role, e.g. on sign-out or when their role changes. */
  async removeAll(userId: string): Promise<void> {
    // A script builds the chat key names itself, so it needs the namespace the client adds.
    const namespace = this.redis.options.keyPrefix ?? '';
    for (const role of ROLES) {
      const owner = { userId, role };
      await this.redis.eval(
        REMOVE_ALL_SCRIPT,
        1,
        indexKey(owner),
        `${namespace}${chatKeyPrefix(owner)}`,
      );
    }
  }
}
