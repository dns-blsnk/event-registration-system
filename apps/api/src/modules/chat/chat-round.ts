import type { ChatEntry } from './chat-history.store.js';
import type {
  ChatCompletionChunk,
  ChatCompletionMessageFunctionToolCall,
} from 'openai/resources/chat/completions';

export type FinishReason = ChatCompletionChunk.Choice['finish_reason'];

/** A tool call as the model sent it, extra fields kept: Gemini needs its thought signature back. */
export type ModelToolCall = ChatCompletionMessageFunctionToolCall & Record<string, unknown>;

/** What a reply cost, as the provider counted it; cached tokens are billed at a discount. */
export interface RoundUsage {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
}

export interface RoundResult {
  text: string;
  toolCalls: ModelToolCall[];
  finishReason: FinishReason;
  /** Fields the model put on its message beside the text (Gemini: `extra_content`). */
  extras: Record<string, unknown>;
  /** Present when the provider reported it (requested with `stream_options.include_usage`). */
  usage?: RoundUsage;
}

export const NO_USAGE: RoundUsage = { promptTokens: 0, completionTokens: 0, cachedTokens: 0 };

/** The tokens of all rounds so far; a round the provider did not count adds nothing. */
export function addUsage(total: RoundUsage, round: RoundUsage | undefined): RoundUsage {
  if (round === undefined) return total;
  return {
    promptTokens: total.promptTokens + round.promptTokens,
    completionTokens: total.completionTokens + round.completionTokens,
    cachedTokens: total.cachedTokens + round.cachedTokens,
  };
}

/** A count from the provider; compatible APIs may leave one out, which then counts as none. */
function countOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Keeps the counts of a piece that has them; most pieces have none. */
function keepUsage(result: RoundResult, usage: ChatCompletionChunk['usage']): void {
  if (usage === undefined || usage === null) return;
  result.usage = {
    promptTokens: countOf(usage.prompt_tokens),
    completionTokens: countOf(usage.completion_tokens),
    cachedTokens: countOf(usage.prompt_tokens_details?.cached_tokens),
  };
}

/** Fields of a streamed piece that are not its content or tool calls, kept for the next request. */
const KNOWN_DELTA_FIELDS = new Set(['role', 'content', 'tool_calls', 'refusal']);
const KNOWN_CALL_FIELDS = new Set(['index', 'id', 'type', 'function']);
/** Keys that would reach the prototype instead of a field when assigned. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** The extra fields of a streamed object: neither known ones nor ones that touch the prototype. */
function extraFields(source: object, known: ReadonlySet<string>): [string, unknown][] {
  return Object.entries(source).filter(([key]) => !known.has(key) && !UNSAFE_KEYS.has(key));
}

type StreamedToolCall = NonNullable<ChatCompletionChunk.Choice.Delta['tool_calls']>[number];
/** OpenAI streams a call in indexed pieces; Gemini sends each call whole, with no index. */
type ToolCallDelta = Omit<StreamedToolCall, 'index'> & { index?: number };

/** Which call a piece belongs to: its index, else a new call when it has an id, else the last one. */
function positionOf(calls: ModelToolCall[], delta: ToolCallDelta): number {
  if (delta.index !== undefined) return delta.index;
  return delta.id !== undefined ? calls.length : Math.max(calls.length - 1, 0);
}

/** Adds one streamed piece of a tool call to the call it belongs to. */
function mergeCall(calls: ModelToolCall[], delta: ToolCallDelta): void {
  const index = positionOf(calls, delta);
  const call = (calls[index] ??= {
    id: '',
    type: 'function',
    function: { name: '', arguments: '' },
  } as ModelToolCall);
  if (delta.id !== undefined) call.id = delta.id;
  if (delta.function?.name !== undefined) call.function.name += delta.function.name;
  if (delta.function?.arguments !== undefined) call.function.arguments += delta.function.arguments;
  for (const [key, value] of extraFields(delta, KNOWN_CALL_FIELDS)) call[key] = value;
}

/**
 * Reads one streamed model reply: text goes to `onText` as it arrives; tool calls and any extra
 * fields are collected whole. Whether the round asked for tools is read from the calls, not the
 * finish reason, which Gemini reports as "stop" either way.
 */
export async function readRound(
  stream: AsyncIterable<ChatCompletionChunk>,
  onText: (text: string) => void,
): Promise<RoundResult> {
  const result: RoundResult = { text: '', toolCalls: [], finishReason: null, extras: {} };
  for await (const chunk of stream) {
    // OpenAI sends the counts in a last piece with no choices; Gemini puts them on its last choice.
    keepUsage(result, chunk.usage);
    const choice = chunk.choices[0];
    if (choice === undefined) continue;
    result.finishReason = choice.finish_reason ?? result.finishReason;
    const { delta } = choice;
    if (typeof delta.content === 'string' && delta.content !== '') {
      result.text += delta.content;
      onText(delta.content);
    }
    for (const call of delta.tool_calls ?? []) mergeCall(result.toolCalls, call);
    for (const [key, value] of extraFields(delta, KNOWN_DELTA_FIELDS)) result.extras[key] = value;
  }
  result.toolCalls = result.toolCalls.filter((call) => call.id !== '' || call.function.name !== '');
  return result;
}

/** The model's message as the next request must repeat it, extra fields included. */
export function assistantEntry({ text, toolCalls, extras }: RoundResult): ChatEntry {
  return {
    ...extras,
    role: 'assistant',
    content: text === '' ? null : text,
    ...(toolCalls.length === 0 ? {} : { tool_calls: toolCalls }),
  };
}
