import { ErrorCode } from '@ers/shared';
import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';

import { DomainError } from '../../common/errors/domain-error.js';
import { SECOND_MS } from '../../common/time.js';

import type { AiReasoningEffort } from '../../config/config.schema.js';
import type { ChatPrompt } from '../../domain/chat-prompt.js';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';

/** The chat-completions client, or undefined when no key is configured (the chat is then unavailable). */
export const AI_CLIENT = Symbol('AI_CLIENT');
/** The model id from config (AI_MODEL). */
export const CHAT_MODEL = Symbol('CHAT_MODEL');
/** The reasoning effort from config (AI_REASONING_EFFORT). */
export const CHAT_REASONING_EFFORT = Symbol('CHAT_REASONING_EFFORT');

/** Room for a few paragraphs plus whatever thinking the model does. */
const ANSWER_MAX_TOKENS = 4096;
const ANSWER_TIMEOUT_SECONDS = 30;
/** Longest an answer may take, retries included, before the user gets "took too long". */
const ANSWER_TIMEOUT_MS = ANSWER_TIMEOUT_SECONDS * SECOND_MS;

export const CHAT_MESSAGES = {
  unavailable: 'The assistant is not available right now. Please try again later.',
  busy: 'The assistant is busy. Please try again in a minute.',
  tooSlow: 'The assistant took too long to answer. Please try again.',
  /** Shown when the model declines, so the user sees an answer rather than nothing. */
  declined: 'I can’t help with that here. Try asking about a field on this screen.',
  noAnswer: 'I don’t have an answer for that. Try asking about a field on this screen.',
  /** Appended when the answer hit the length limit, so a cut-off reads as such. */
  cutShort: ' … (answer cut short)',
} as const;

export type AnswerOutcome = 'completed' | 'cancelled';

/** Just the part of the SDK client the service uses, so tests can pass a fake. */
export type AnswerClient = Pick<OpenAI, 'chat'>;

type FinishReason = ChatCompletionChunk.Choice['finish_reason'];

/** Marks a failure of the caller's own callback, so it is not mistaken for a provider outage. */
class CallbackFailure extends Error {}

/** Keeps the underlying failure on the error for the logs; clients only ever get the message. */
function withCause(error: DomainError, cause: unknown): DomainError {
  error.cause = cause;
  return error;
}

function translate(error: unknown): DomainError {
  if (error instanceof DomainError) {
    return error;
  }
  const code =
    error instanceof OpenAI.RateLimitError ? ErrorCode.RATE_LIMITED : ErrorCode.SERVICE_UNAVAILABLE;
  const message = code === ErrorCode.RATE_LIMITED ? CHAT_MESSAGES.busy : CHAT_MESSAGES.unavailable;
  // The provider's own error stays as the cause, for the logs; the user gets the safe text.
  return withCause(new DomainError(code, message), error);
}

/** Forwards each text delta to `emit` and remembers how the model ended. */
async function readStream(
  stream: AsyncIterable<ChatCompletionChunk>,
  emit: (text: string) => void,
): Promise<{ wroteText: boolean; finishReason: FinishReason }> {
  let wroteText = false;
  let finishReason: FinishReason = null;
  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (choice === undefined) continue;
    finishReason = choice.finish_reason ?? finishReason;
    const text = choice.delta.content;
    if (text !== null && text !== undefined && text !== '') {
      wroteText = true;
      emit(text);
    }
  }
  return { wroteText, finishReason };
}

/**
 * What to add after the streamed text, from how the answer ended. A stream that closes without a
 * finish reason was interrupted on the way, so the user sees it marked as cut short too.
 */
function closingText(finishReason: FinishReason, wroteText: boolean): string | undefined {
  if (finishReason === 'content_filter') return wroteText ? undefined : CHAT_MESSAGES.declined;
  if (!wroteText) return CHAT_MESSAGES.noAnswer;
  return finishReason === 'length' || finishReason === null ? CHAT_MESSAGES.cutShort : undefined;
}

/**
 * Streams one help answer from the model. Text arrives through `onText` as it is generated; the
 * caller stops it with `signal` (one per question), and it stops on its own after the timeout.
 * Provider failures become a DomainError with a safe message and the original error as its cause.
 */
@Injectable()
export class ChatAnswerService {
  constructor(
    @Inject(AI_CLIENT) private readonly client: AnswerClient | undefined,
    @Inject(CHAT_MODEL) private readonly model: string,
    @Inject(CHAT_REASONING_EFFORT) private readonly reasoningEffort: AiReasoningEffort,
  ) {}

  get isAvailable(): boolean {
    return this.client !== undefined;
  }

  /** Refuses up front when no model is configured; the admin then shows "assistant unavailable". */
  assertAvailable(): void {
    if (this.client === undefined) {
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, CHAT_MESSAGES.unavailable);
    }
  }

  async answer(
    prompt: ChatPrompt,
    { signal, onText }: { signal: AbortSignal; onText: (text: string) => void },
  ): Promise<AnswerOutcome> {
    if (this.client === undefined) {
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, CHAT_MESSAGES.unavailable);
    }
    const timeout = AbortSignal.timeout(ANSWER_TIMEOUT_MS);
    const emit = (text: string): void => {
      try {
        onText(text);
      } catch (error) {
        throw new CallbackFailure('chat answer callback failed', { cause: error });
      }
    };
    try {
      const stream = await this.client.chat.completions.create(
        {
          model: this.model,
          max_completion_tokens: ANSWER_MAX_TOKENS,
          ...(this.reasoningEffort === 'default' ? {} : { reasoning_effort: this.reasoningEffort }),
          stream: true,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.question },
          ],
        },
        { signal: AbortSignal.any([signal, timeout]) },
      );
      const { wroteText, finishReason } = await readStream(stream, emit);
      const closing = closingText(finishReason, wroteText);
      if (closing !== undefined) emit(closing);
      return 'completed';
    } catch (error) {
      if (error instanceof CallbackFailure) throw error.cause;
      if (signal.aborted) return 'cancelled';
      if (timeout.aborted) {
        throw withCause(
          new DomainError(ErrorCode.SERVICE_UNAVAILABLE, CHAT_MESSAGES.tooSlow),
          error,
        );
      }
      throw translate(error);
    }
  }
}
