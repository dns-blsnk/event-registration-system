import { ErrorCode } from '@ers/shared';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import OpenAI from 'openai';

import { DomainError } from '../../common/errors/domain-error.js';
import { SECOND_MS } from '../../common/time.js';

import { assistantEntry, readRound } from './chat-round.js';
import { ChatToolbox, type ToolOutcome } from './tools/chat-toolbox.js';

import type { AiReasoningEffort } from '../../config/config.schema.js';
import type { User } from '../../generated/prisma/client.js';
import type { ChatEntry } from './chat-history.store.js';
import type { ModelToolCall, FinishReason } from './chat-round.js';
import type { ListToOpen } from './tools/tool-navigation.js';
import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';

/** The chat-completions client, or undefined when no key is configured (the chat is then unavailable). */
export const AI_CLIENT = Symbol('AI_CLIENT');
/** Which model answers and how hard it thinks (AI_MODEL, AI_REASONING_EFFORT). */
export const CHAT_MODEL_SETTINGS = Symbol('CHAT_MODEL_SETTINGS');

export interface ChatModelSettings {
  model: string;
  reasoningEffort: AiReasoningEffort;
}

/** Just the part of the SDK client the agent uses, so tests can pass a fake. */
export type AnswerClient = Pick<OpenAI, 'chat'>;

/** Room for a few paragraphs plus whatever thinking the model does. */
const ANSWER_MAX_TOKENS = 4096;
/** Model replies per question: up to three rounds of tool calls, then one that must be text. */
export const MAX_ROUNDS = 4;
const ANSWER_TIMEOUT_SECONDS = 45;
/** Longest a whole answer may take, every round and retry included, before "took too long". */
const ANSWER_TIMEOUT_MS = ANSWER_TIMEOUT_SECONDS * SECOND_MS;

export const CHAT_MESSAGES = {
  unavailable: 'The assistant is not available right now. Please try again later.',
  busy: 'The assistant is busy. Please try again in a minute.',
  tooSlow: 'The assistant took too long to answer. Please try again.',
  /** Shown when the model declines, so the user sees an answer rather than nothing. */
  declined: 'I can’t help with that here.',
  noAnswer: 'I don’t have an answer for that.',
  /** Appended when the answer hit the length limit, so a cut-off reads as such. */
  cutShort: ' … (answer cut short)',
} as const;

export type AnswerOutcome = 'completed' | 'cancelled';

export interface AgentTurn {
  /** The instructions, the chat so far and the new question, in order. */
  messages: ChatEntry[];
  user: User;
  timeZone: string;
  signal: AbortSignal;
  onText: (text: string) => void;
  onProgress: (text: string) => void;
  onNavigate: (list: ListToOpen) => void;
}

export interface AgentResult {
  outcome: AnswerOutcome;
  /** What the model and the tools added in this turn, to keep in the chat's history. */
  entries: ChatEntry[];
}

/** Marks a failure of the caller's own callback, so it is not mistaken for a provider outage. */
class CallbackFailure extends Error {}

function guarded<T>(callback: (value: T) => void): (value: T) => void {
  return (value) => {
    try {
      callback(value);
    } catch (error) {
      throw new CallbackFailure('chat callback failed', { cause: error });
    }
  };
}

/** Keeps the underlying failure on the error for the logs; clients only ever get the message. */
function withCause(error: DomainError, cause: unknown): DomainError {
  error.cause = cause;
  return error;
}

function translate(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  const isBusy = error instanceof OpenAI.RateLimitError;
  const code = isBusy ? ErrorCode.RATE_LIMITED : ErrorCode.SERVICE_UNAVAILABLE;
  // The provider's own error stays as the cause, for the logs; the user gets the safe text.
  return withCause(
    new DomainError(code, isBusy ? CHAT_MESSAGES.busy : CHAT_MESSAGES.unavailable),
    error,
  );
}

/**
 * What to add after the final text, from how the answer ended. A stream that closes without a
 * finish reason was interrupted on the way, so the user sees it marked as cut short too.
 */
function closingText(finishReason: FinishReason, wroteText: boolean): string | undefined {
  if (finishReason === 'content_filter') return wroteText ? undefined : CHAT_MESSAGES.declined;
  if (!wroteText) return CHAT_MESSAGES.noAnswer;
  return finishReason === 'length' || finishReason === null ? CHAT_MESSAGES.cutShort : undefined;
}

/** The text of a later round starts on a new paragraph, so it does not run into the earlier one. */
const ROUND_SEPARATOR = '\n\n';

/** Passes a round's text on, opening it with a paragraph break when earlier rounds wrote text. */
function separatedAfter(wroteText: boolean, emit: (text: string) => void): (text: string) => void {
  let isFirst = true;
  return (text) => {
    if (isFirst && wroteText) emit(ROUND_SEPARATOR);
    isFirst = false;
    emit(text);
  };
}

/** A tool call's arguments, or undefined when the model sent something that is not JSON. */
function argumentsOf(call: ModelToolCall): unknown {
  try {
    return JSON.parse(call.function.arguments === '' ? '{}' : call.function.arguments) as unknown;
  } catch {
    // Recovered on purpose: the model is told and can call again with proper JSON.
    return undefined;
  }
}

/** Whether the list a search asked to show was opened, in words the model can relay. */
function listNote(outcome: { listToOpen?: unknown; notShown?: string }): { list?: string } {
  if (outcome.listToOpen !== undefined) return { list: 'Opened in the panel with these filters.' };
  if (outcome.notShown !== undefined) return { list: `Not opened: ${outcome.notShown}` };
  return {};
}

/** What the model reads back from a tool: the data or the error, and whether a list opened. */
function toolReply(outcome: ToolOutcome): string {
  if ('error' in outcome) return JSON.stringify({ error: outcome.error });
  return JSON.stringify({ result: outcome.data, ...listNote(outcome) });
}

/**
 * Answers one question with the model and the user's tools: each round streams the model's text;
 * when it asks for tools they run with the user's own permissions, their results go back, and the
 * next round follows. The last round offers no tools, so every answer ends in text. The whole
 * answer stops on the caller's signal or after the timeout. Provider failures become a DomainError
 * with a safe message and the original error as its cause.
 */
@Injectable()
export class ChatAgent {
  constructor(
    @Inject(AI_CLIENT) private readonly client: AnswerClient | undefined,
    @Inject(CHAT_MODEL_SETTINGS) private readonly settings: ChatModelSettings,
    private readonly toolbox: ChatToolbox,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ChatAgent.name);
  }

  get isAvailable(): boolean {
    return this.client !== undefined;
  }

  /** Refuses up front when no model is configured; the admin then shows "assistant unavailable". */
  assertAvailable(): void {
    if (this.client === undefined) {
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, CHAT_MESSAGES.unavailable);
    }
  }

  async run(turn: AgentTurn): Promise<AgentResult> {
    const client = this.client;
    if (client === undefined) {
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, CHAT_MESSAGES.unavailable);
    }
    const timeout = AbortSignal.timeout(ANSWER_TIMEOUT_MS);
    const signal = AbortSignal.any([turn.signal, timeout]);
    const entries: ChatEntry[] = [];
    try {
      const outcome = await this.rounds(client, turn, signal, entries);
      return { outcome, entries };
    } catch (error) {
      if (error instanceof CallbackFailure) throw error.cause;
      if (turn.signal.aborted) return { outcome: 'cancelled', entries: [] };
      if (timeout.aborted) {
        throw withCause(
          new DomainError(ErrorCode.SERVICE_UNAVAILABLE, CHAT_MESSAGES.tooSlow),
          error,
        );
      }
      throw translate(error);
    }
  }

  private async rounds(
    client: AnswerClient,
    turn: AgentTurn,
    signal: AbortSignal,
    entries: ChatEntry[],
  ): Promise<AnswerOutcome> {
    const emit = guarded(turn.onText);
    let wroteText = false;
    let toolCalls = 0;
    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
      const tools = round < MAX_ROUNDS ? this.toolbox.definitionsFor(turn.user.role) : [];
      const stream = await client.chat.completions.create(
        this.request([...turn.messages, ...entries], tools),
        { signal },
      );
      const result = await readRound(stream, separatedAfter(wroteText, emit));
      wroteText ||= result.text !== '';
      if (result.toolCalls.length === 0 || round === MAX_ROUNDS) {
        const closing = closingText(result.finishReason, result.text !== '') ?? '';
        if (closing !== '') emit(closing);
        // Calls in the last round get no replies, so they are dropped: a call without its result
        // would make every later request in this chat invalid. The closing words are kept, so the
        // chat reads later as it did live.
        entries.push(assistantEntry({ ...result, toolCalls: [], text: result.text + closing }));
        this.logger.info({ userId: turn.user.id, rounds: round, toolCalls }, 'assistant answered');
        return 'completed';
      }
      entries.push(assistantEntry(result));
      toolCalls += result.toolCalls.length;
      for (const call of result.toolCalls) {
        entries.push(await this.runTool(call, turn));
      }
    }
    return 'completed';
  }

  private async runTool(call: ModelToolCall, turn: AgentTurn): Promise<ChatEntry> {
    const args = argumentsOf(call);
    const tool = this.toolbox.progressOf(call.function.name, turn.user.role);
    if (tool !== undefined) guarded(turn.onProgress)(tool);
    const outcome: ToolOutcome =
      args === undefined
        ? { error: 'The arguments are not valid JSON.' }
        : await this.toolbox.run(call.function.name, args, {
            user: turn.user,
            timeZone: turn.timeZone,
          });
    if (!('error' in outcome) && outcome.listToOpen !== undefined) {
      guarded(turn.onNavigate)(outcome.listToOpen);
    }
    return { role: 'tool', tool_call_id: call.id, content: toolReply(outcome) };
  }

  private request(messages: ChatEntry[], tools: ChatCompletionFunctionTool[]) {
    const { model, reasoningEffort } = this.settings;
    return {
      model,
      max_completion_tokens: ANSWER_MAX_TOKENS,
      ...(reasoningEffort === 'default' ? {} : { reasoning_effort: reasoningEffort }),
      ...(tools.length === 0 ? {} : { tools }),
      stream: true as const,
      messages,
    };
  }
}
