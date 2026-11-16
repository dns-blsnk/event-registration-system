import { describe, expect, it } from 'vitest';

import { readRound } from './chat-round.js';

import type { ChatCompletionChunk } from 'openai/resources/chat/completions';

type Delta = ChatCompletionChunk.Choice['delta'] & Record<string, unknown>;

function chunk(delta: Delta, finishReason: ChatCompletionChunk.Choice['finish_reason'] = null) {
  return {
    choices: [{ delta, finish_reason: finishReason, index: 0 }],
  } as unknown as ChatCompletionChunk;
}

async function* stream(...chunks: ChatCompletionChunk[]) {
  for (const item of chunks) {
    await Promise.resolve();
    yield item;
  }
}

function read(...chunks: ChatCompletionChunk[]) {
  const text: string[] = [];
  return readRound(stream(...chunks), (piece) => text.push(piece)).then((result) => ({
    result,
    text,
  }));
}

describe('readRound', () => {
  it('streams text pieces as they arrive and keeps the finish reason', async () => {
    const { result, text } = await read(
      chunk({ role: 'assistant', content: 'Hel' }),
      chunk({ content: 'lo' }, 'stop'),
    );

    expect(text).toEqual(['Hel', 'lo']);
    expect(result).toMatchObject({ text: 'Hello', toolCalls: [], finishReason: 'stop' });
  });

  it('merges a tool call streamed in indexed pieces, as OpenAI sends it', async () => {
    const { result } = await read(
      chunk({
        tool_calls: [
          {
            index: 0,
            id: 'c1',
            type: 'function',
            function: { name: 'search_', arguments: '{"a"' },
          },
        ],
      }),
      chunk({ tool_calls: [{ index: 0, function: { name: 'events', arguments: ':1}' } }] }),
      chunk({}, 'tool_calls'),
    );

    expect(result.toolCalls).toEqual([
      { id: 'c1', type: 'function', function: { name: 'search_events', arguments: '{"a":1}' } },
    ]);
  });

  it('collects a whole tool call that comes without an index, as Gemini sends it', async () => {
    const { result } = await read(
      chunk({
        role: 'assistant',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'search_events', arguments: '{"status":"PUBLISHED"}' },
            extra_content: { google: { thought_signature: 'sig' } },
          } as never,
        ],
      }),
      chunk({ role: 'assistant' }, 'stop'),
    );

    expect(result.text).toBe('');
    expect(result.toolCalls).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'search_events', arguments: '{"status":"PUBLISHED"}' },
        extra_content: { google: { thought_signature: 'sig' } },
      },
    ]);
  });

  it('keeps several unindexed tool calls apart', async () => {
    const { result } = await read(
      chunk({
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'get_event', arguments: '{"id":1}' },
          } as never,
          {
            id: 'call_2',
            type: 'function',
            function: { name: 'list_tags', arguments: '{}' },
          } as never,
        ],
      }),
      chunk({}, 'stop'),
    );

    expect(result.toolCalls.map((call) => call.id)).toEqual(['call_1', 'call_2']);
    expect(result.toolCalls.map((call) => call.function.name)).toEqual(['get_event', 'list_tags']);
  });

  it('keeps extra message fields for the next request', async () => {
    const { result } = await read(
      chunk({ content: 'Hi', extra_content: { google: { thought_signature: 'sig' } } }, 'stop'),
    );

    expect(result.extras).toEqual({ extra_content: { google: { thought_signature: 'sig' } } });
  });

  it('keeps the token counts the provider sends in a last piece without choices', async () => {
    const { result } = await read(chunk({ content: 'Hi' }, 'stop'), {
      choices: [],
      usage: {
        prompt_tokens: 2750,
        completion_tokens: 12,
        total_tokens: 2762,
        prompt_tokens_details: { cached_tokens: 2048 },
      },
    } as unknown as ChatCompletionChunk);

    expect(result.usage).toEqual({ promptTokens: 2750, completionTokens: 12, cachedTokens: 2048 });
  });

  it('counts no cached tokens when the provider does not report them', async () => {
    const { result } = await read({
      choices: [{ delta: { content: 'Hi' }, finish_reason: 'stop', index: 0 }],
      usage: { prompt_tokens: 3, completion_tokens: 9, total_tokens: 12 },
    } as unknown as ChatCompletionChunk);

    expect(result.usage).toEqual({ promptTokens: 3, completionTokens: 9, cachedTokens: 0 });
  });

  it('counts a token count the provider left out as none', async () => {
    const { result } = await read({
      choices: [{ delta: { content: 'Hi' }, finish_reason: 'stop', index: 0 }],
      usage: { prompt_tokens: 2700, total_tokens: 2700 },
    } as unknown as ChatCompletionChunk);

    expect(result.usage).toEqual({ promptTokens: 2700, completionTokens: 0, cachedTokens: 0 });
  });

  it('has no token counts when the provider sends none', async () => {
    const { result } = await read(chunk({ content: 'Hi' }, 'stop'));

    expect(result.usage).toBeUndefined();
  });
});
