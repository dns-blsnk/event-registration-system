import Anthropic from '@anthropic-ai/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../common/errors/domain-error.js';

import { ChatAnswerService, type AnswerClient } from './chat-answer.service.js';

const prompt = { system: 'You help.', question: 'What is a slug?' };

interface FakeStreamOptions {
  texts?: string[];
  stopReason?: string;
  /** Throw this instead of finishing. */
  failWith?: Error;
  /** Keep the stream open until the request signal aborts. */
  hangUntilAbort?: boolean;
}

/** A stand-in for client.messages.stream that records its arguments. */
function fakeClient(options: FakeStreamOptions = {}) {
  const calls: { params: Record<string, unknown>; signal: AbortSignal }[] = [];
  const client = {
    messages: {
      stream: (params: Record<string, unknown>, requestOptions: { signal: AbortSignal }) => {
        calls.push({ params, signal: requestOptions.signal });
        const { signal } = requestOptions;
        return {
          async *[Symbol.asyncIterator]() {
            for (const text of options.texts ?? []) {
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
            }
            if (options.failWith !== undefined) throw options.failWith;
            if (options.hangUntilAbort === true) {
              await new Promise((resolve) => {
                signal.addEventListener('abort', resolve);
              });
              throw new Error('aborted');
            }
          },
          finalMessage: () => Promise.resolve({ stop_reason: options.stopReason ?? 'end_turn' }),
        };
      },
    },
  };
  return { client: client as unknown as AnswerClient, calls };
}

async function collect(service: ChatAnswerService, signal = new AbortController().signal) {
  const texts: string[] = [];
  const outcome = await service.answer(prompt, { signal, onText: (text) => texts.push(text) });
  return { outcome, texts };
}

describe('ChatAnswerService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('streams the answer text and sends the prompt to the configured model', async () => {
    const { client, calls } = fakeClient({ texts: ['A slug ', 'is the URL name.'] });
    const service = new ChatAnswerService(client, 'claude-haiku-5-5');

    const { outcome, texts } = await collect(service);

    expect(outcome).toBe('completed');
    expect(texts).toEqual(['A slug ', 'is the URL name.']);
    expect(calls[0]?.params).toMatchObject({
      model: 'claude-haiku-5-5',
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.question }],
    });
  });

  it.each([
    [
      'declines without text',
      { stopReason: 'refusal' },
      ['I can’t help with that here. Try asking about a field on this screen.'],
    ],
    [
      'ends with no text',
      { stopReason: 'end_turn' },
      ['I don’t have an answer for that. Try asking about a field on this screen.'],
    ],
    [
      'hits the length limit',
      { texts: ['A long'], stopReason: 'max_tokens' },
      ['A long', ' … (answer cut short)'],
    ],
    ['declines after some text', { texts: ['Partly'], stopReason: 'refusal' }, ['Partly']],
  ])(
    'says something readable when the model %s',
    async (_case, options: FakeStreamOptions, expected) => {
      const { client } = fakeClient(options);

      const { texts } = await collect(new ChatAnswerService(client, 'm'));

      expect(texts).toEqual(expected);
    },
  );

  it('passes a failure of the caller’s own callback through, not as a provider outage', async () => {
    const { client } = fakeClient({ texts: ['Hi'] });
    const service = new ChatAnswerService(client, 'm');
    const callbackError = new Error('socket closed');

    const result = service.answer(prompt, {
      signal: new AbortController().signal,
      onText: () => {
        throw callbackError;
      },
    });

    await expect(result).rejects.toBe(callbackError);
  });

  it('keeps the provider error as the cause for the logs', async () => {
    const providerError = new Anthropic.InternalServerError(500, undefined, 'boom', new Headers());
    const { client } = fakeClient({ failWith: providerError });

    const error: unknown = await collect(new ChatAnswerService(client, 'm')).catch(
      (caught: unknown) => caught,
    );

    expect((error as Error).cause).toBe(providerError);
  });

  it('stops when the user cancels', async () => {
    const { client } = fakeClient({ texts: ['Part'], hangUntilAbort: true });
    const controller = new AbortController();
    const service = new ChatAnswerService(client, 'm');

    const pending = collect(service, controller.signal);
    setTimeout(() => {
      controller.abort();
    }, 0);

    expect((await pending).outcome).toBe('cancelled');
  });

  it('gives a clear error when the answer takes too long', async () => {
    const timeout = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    const { client } = fakeClient({ hangUntilAbort: true });
    const pending = collect(new ChatAnswerService(client, 'm'));
    setTimeout(() => {
      timeout.abort();
    }, 0);

    await expect(pending).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: expect.stringContaining('too long'),
    });
  });

  it('reports a busy provider as rate limited', async () => {
    const { client } = fakeClient({
      failWith: new Anthropic.RateLimitError(429, undefined, 'slow down', new Headers()),
    });

    await expect(collect(new ChatAnswerService(client, 'm'))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it.each([
    [
      'an API error',
      new Anthropic.InternalServerError(500, undefined, 'secret provider detail', new Headers()),
    ],
    ['a network failure', new Error('socket hang up')],
  ])('turns %s into a safe "unavailable" message', async (_case, failure) => {
    const { client } = fakeClient({ failWith: failure });

    const error: unknown = await collect(new ChatAnswerService(client, 'm')).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect((error as Error).message).not.toContain('secret provider detail');
  });

  it('is unavailable without an API key', async () => {
    const service = new ChatAnswerService(undefined, 'm');

    expect(service.isAvailable).toBe(false);
    await expect(collect(service)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });
});
