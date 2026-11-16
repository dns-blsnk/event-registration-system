import { UUID_PATTERN, type ChatHistory } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { ChatAnswerService, type AnswerOutcome } from './chat-answer.service.js';
import { ChatHistoryStore, toDisplayMessages, type ChatOwner } from './chat-history.store.js';

import type { ChatPrompt } from '../../domain/chat-prompt.js';

/** A chat id from the browser: only something the server could have issued is looked up. */
function chatIdOf(raw: unknown): string | undefined {
  return typeof raw === 'string' && UUID_PATTERN.test(raw) ? raw : undefined;
}

/**
 * A user's conversations with the assistant: resuming one, starting a new one, answering in it.
 * Every lookup is by the socket's own user, so another user's chat id behaves like an unknown one.
 */
@Injectable()
export class ChatConversations {
  constructor(
    private readonly history: ChatHistoryStore,
    private readonly answers: ChatAnswerService,
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

  /** Streams one answer. The assistant phase makes this read and extend the chat's history. */
  async answer(
    prompt: ChatPrompt,
    options: { signal: AbortSignal; onText: (text: string) => void },
  ): Promise<AnswerOutcome> {
    return this.answers.answer(prompt, options);
  }
}
