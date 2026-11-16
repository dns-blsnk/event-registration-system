import { UUID_PATTERN, type ChatHistory } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import {
  buildAssistantInstructions,
  resolveTimeZone,
  withPanelNote,
  type AssistantScreen,
} from '../../domain/assistant-prompt.js';

import { ChatAgent, type AgentTurn, type AnswerOutcome } from './chat-agent.js';
import {
  ChatHistoryStore,
  toDisplayMessages,
  type ChatEntry,
  type ChatOwner,
} from './chat-history.store.js';
import { compactOldToolResults } from './tool-reply.js';

import type { User } from '../../generated/prisma/client.js';

/** A chat id from the browser: only something the server could have issued is looked up. */
function chatIdOf(raw: unknown): string | undefined {
  return typeof raw === 'string' && UUID_PATTERN.test(raw) ? raw : undefined;
}

export interface AssistantQuestion {
  user: User;
  question: string;
  chatId?: unknown;
  timeZone?: unknown;
  screen?: AssistantScreen | undefined;
}

/**
 * A user's conversations with the assistant: resuming one, starting a new one, answering in it.
 * Every lookup is by the user who asks, so another user's chat id behaves like an unknown one.
 */
@Injectable()
export class ChatConversations {
  constructor(
    private readonly history: ChatHistoryStore,
    private readonly agent: ChatAgent,
  ) {}

  /** The chat the browser kept, as the user sees it; a new empty one when it is gone or foreign. */
  async resume(owner: ChatOwner, rawChatId: unknown): Promise<ChatHistory> {
    const chatId = chatIdOf(rawChatId);
    const entries = chatId === undefined ? undefined : await this.history.load(owner, chatId);
    if (chatId === undefined || entries === undefined) {
      return { chatId: await this.history.create(owner), messages: [] };
    }
    return { chatId, messages: toDisplayMessages(entries) };
  }

  /**
   * Starts an empty chat and then forgets the current one, if it is the user's; in that order, so
   * a failure never leaves the user without a chat.
   */
  async startNew(owner: ChatOwner, rawCurrentId: unknown): Promise<ChatHistory> {
    const chatId = await this.history.create(owner);
    const current = chatIdOf(rawCurrentId);
    if (current !== undefined) await this.history.remove(owner, current);
    return { chatId, messages: [] };
  }

  /**
   * Answers a question in the user's chat: the model sees the instructions for the user's current
   * role, the chat so far with older tool data left out, and the question with the panel's note.
   * The chat in Redis stays whole and keeps the bare question, so what the model reads changes from
   * one question to the next only where tool data was just left out, and the provider can reuse
   * everything before that point.
   * A finished answer is added to the chat; a cancelled one is not, so the chat never holds half an
   * answer. When the chat the browser kept is gone, a new one starts with this answer, and its id
   * comes back for the browser to keep instead.
   */
  async answer(
    ask: AssistantQuestion,
    callbacks: Pick<AgentTurn, 'signal' | 'onText' | 'onProgress' | 'onNavigate'>,
  ): Promise<{ outcome: AnswerOutcome; chatId?: string }> {
    const owner = { userId: ask.user.id, role: ask.user.role };
    const chatId = chatIdOf(ask.chatId);
    const kept = chatId === undefined ? undefined : await this.history.load(owner, chatId);
    const timeZone = resolveTimeZone(ask.timeZone);
    const instructions = buildAssistantInstructions({ role: ask.user.role });
    const asked = withPanelNote({
      question: ask.question,
      role: ask.user.role,
      now: new Date(),
      timeZone,
      screen: ask.screen,
    });
    const question: ChatEntry = { role: 'user', content: ask.question };
    const { outcome, entries } = await this.agent.run({
      ...callbacks,
      messages: [
        { role: 'system', content: instructions },
        ...compactOldToolResults(kept ?? []),
        { role: 'user', content: asked },
      ],
      user: ask.user,
      timeZone,
    });
    if (outcome === 'cancelled') return { outcome };
    const keptIn =
      chatId !== undefined && kept !== undefined ? chatId : await this.history.create(owner);
    await this.history.append(owner, keptIn, [question, ...entries]);
    return { outcome, chatId: keptIn };
  }
}
