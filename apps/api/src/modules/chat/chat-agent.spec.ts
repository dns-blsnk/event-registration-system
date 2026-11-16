import OpenAI from 'openai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../common/errors/domain-error.js';

import { ChatAgent, MAX_ROUNDS, type AgentTurn, type AnswerClient } from './chat-agent.js';

import type { User } from '../../generated/prisma/client.js';
import type { ChatToolbox, ToolOutcome } from './tools/chat-toolbox.js';
import type { PinoLogger } from 'nestjs-pino';

/** What one model reply streams: text, a tool call, how it ends, or a failure. */
interface Reply {
  texts?: readonly string[];
  call?: { name: string; arguments: string };
  finishReason?: 'stop' | 'length' | 'content_filter' | null;
  failWith?: Error;
  hangUntilAbort?: boolean;
}

const user = { id: 'u1', role: 'ADMIN' } as User;

function fakeClient(replies: Reply[]) {
  const requests: { params: Record<string, unknown>; signal: AbortSignal }[] = [];
  const client = {
    chat: {
      completions: {
        create: (params: Record<string, unknown>, { signal }: { signal: AbortSignal }) => {
          requests.push({ params, signal });
          const reply = replies.shift() ?? { texts: ['Done.'] };
          return Promise.resolve({
            async *[Symbol.asyncIterator]() {
              for (const text of reply.texts ?? []) {
                yield { choices: [{ delta: { content: text }, finish_reason: null }] };
              }
              if (reply.call !== undefined) {
                const call = { index: 0, id: 'c1', type: 'function', function: reply.call };
                yield { choices: [{ delta: { tool_calls: [call] }, finish_reason: null }] };
              }
              if (reply.failWith !== undefined) throw reply.failWith;
              if (reply.hangUntilAbort === true) {
                await new Promise((resolve) => {
                  signal.addEventListener('abort', resolve);
                });
                throw new Error('aborted');
              }
              if (reply.finishReason === null) return;
              yield { choices: [{ delta: {}, finish_reason: reply.finishReason ?? 'stop' }] };
            },
          });
        },
      },
    },
  };
  return { client: client as unknown as AnswerClient, requests };
}

function fakeToolbox(outcome: ToolOutcome = { data: { total: 0 } }) {
  const run = vi.fn(() => Promise.resolve(outcome));
  const toolbox = {
    definitionsFor: () => [
      { type: 'function', function: { name: 'search_events', parameters: {} } },
    ],
    progressOf: () => 'Searching events…',
    run,
  } as unknown as ChatToolbox;
  return { toolbox, run };
}

const logger = { setContext: vi.fn(), info: vi.fn() } as unknown as PinoLogger;

function agentWith(replies: Reply[], outcome?: ToolOutcome) {
  const { client, requests } = fakeClient(replies);
  const { toolbox, run } = fakeToolbox(outcome);
  const agent = new ChatAgent(client, { model: 'm', reasoningEffort: 'low' }, toolbox, logger);
  return { agent, requests, run };
}

async function ask(agent: ChatAgent, signal = new AbortController().signal) {
  const texts: string[] = [];
  const progress: string[] = [];
  const lists: unknown[] = [];
  const turn: AgentTurn = {
    messages: [
      { role: 'system', content: 'rules' },
      { role: 'user', content: 'Events?' },
    ],
    user,
    timeZone: 'UTC',
    signal,
    onText: (text) => texts.push(text),
    onProgress: (text) => progress.push(text),
    onNavigate: (list) => lists.push(list),
  };
  const result = await agent.run(turn);
  return { ...result, texts, progress, lists };
}

describe('ChatAgent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('streams a plain answer and offers the role’s tools', async () => {
    const { agent, requests } = agentWith([{ texts: ['Two ', 'events.'] }]);

    const { outcome, texts, entries } = await ask(agent);

    expect(outcome).toBe('completed');
    expect(texts).toEqual(['Two ', 'events.']);
    expect(entries).toEqual([{ role: 'assistant', content: 'Two events.' }]);
    expect(requests[0]?.params).toMatchObject({
      model: 'm',
      reasoning_effort: 'low',
      stream: true,
    });
    expect(requests[0]?.params.tools).toHaveLength(1);
  });

  it('runs a tool the model asks for, then answers with its result', async () => {
    const { agent, requests, run } = agentWith([
      { call: { name: 'search_events', arguments: '{"city":"Tallinn"}' } },
      { texts: ['None.'] },
    ]);

    const { texts, progress, entries } = await ask(agent);

    expect(run).toHaveBeenCalledWith(
      'search_events',
      { city: 'Tallinn' },
      { user, timeZone: 'UTC' },
    );
    expect(progress).toEqual(['Searching events…']);
    expect(texts).toEqual(['None.']);
    expect(entries.map((entry) => entry.role)).toEqual(['assistant', 'tool', 'assistant']);
    expect(requests[1]?.params.messages).toHaveLength(4);
  });

  it('opens the list a search asked to show and tells the model it did', async () => {
    const list = { resource: 'events' as const, filters: { city: 'Tallinn' } };
    const { agent } = agentWith(
      [{ call: { name: 'search_events', arguments: '{"show":true}' } }, { texts: ['Opened.'] }],
      { data: { total: 1 }, listToOpen: list },
    );

    const { lists, entries } = await ask(agent);

    expect(lists).toEqual([list]);
    expect(entries[1]).toMatchObject({
      role: 'tool',
      content: expect.stringContaining('Opened in the panel'),
    });
  });

  it('tells the model when its arguments are not JSON, without running the tool', async () => {
    const { agent, run } = agentWith([
      { call: { name: 'search_events', arguments: '{city:' } },
      { texts: ['Sorry.'] },
    ]);

    const { entries } = await ask(agent);

    expect(run).not.toHaveBeenCalled();
    expect(entries[1]).toMatchObject({ content: expect.stringContaining('not valid JSON') });
  });

  it('offers no tools in the last round, so every answer ends in text', async () => {
    const call = { call: { name: 'search_events', arguments: '{}' } };
    const { agent, requests } = agentWith(Array.from({ length: MAX_ROUNDS }, () => call));

    const { texts } = await ask(agent);

    expect(requests).toHaveLength(MAX_ROUNDS);
    expect(requests.at(-1)?.params).not.toHaveProperty('tools');
    expect(texts).toEqual(['I don’t have an answer for that.']);
  });

  it('keeps no tool call from the last round, since it never gets a result', async () => {
    const call = { call: { name: 'search_events', arguments: '{}' } };
    const { agent } = agentWith(Array.from({ length: MAX_ROUNDS }, () => call));

    const { entries } = await ask(agent);

    expect(entries.at(-1)).toEqual({
      role: 'assistant',
      content: 'I don’t have an answer for that.',
    });
    const calls = entries.filter((entry) => 'tool_calls' in entry).length;
    expect(entries.filter((entry) => entry.role === 'tool')).toHaveLength(calls);
  });

  it('keeps the closing words with the answer, so the chat reads later as it did live', async () => {
    const { agent } = agentWith([{ texts: ['A long'], finishReason: 'length' }]);

    const { entries } = await ask(agent);

    expect(entries).toEqual([{ role: 'assistant', content: 'A long … (answer cut short)' }]);
  });

  it('starts the text of a later round on a new paragraph', async () => {
    const { agent } = agentWith([
      { texts: ['Let me look.'], call: { name: 'search_events', arguments: '{}' } },
      { texts: ['None.'] },
    ]);

    const { texts } = await ask(agent);

    expect(texts.join('')).toBe('Let me look.\n\nNone.');
  });

  it.each([
    ['declines without text', { finishReason: 'content_filter' }, ['I can’t help with that here.']],
    ['ends with no text', { finishReason: 'stop' }, ['I don’t have an answer for that.']],
    [
      'hits the length limit',
      { texts: ['A long'], finishReason: 'length' },
      ['A long', ' … (answer cut short)'],
    ],
    [
      'stops streaming without a finish reason',
      { texts: ['Half'], finishReason: null },
      ['Half', ' … (answer cut short)'],
    ],
  ] as const)('says something readable when the model %s', async (_case, reply, expected) => {
    const { agent } = agentWith([reply]);

    expect((await ask(agent)).texts).toEqual(expected);
  });

  it('stops when the user cancels and keeps nothing of the answer', async () => {
    const { agent } = agentWith([{ texts: ['Part'], hangUntilAbort: true }]);
    const controller = new AbortController();

    const pending = ask(agent, controller.signal);
    setTimeout(() => {
      controller.abort();
    }, 0);

    expect(await pending).toMatchObject({ outcome: 'cancelled', entries: [] });
  });

  it('gives a clear error when the answer takes too long', async () => {
    const timeout = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    const { agent } = agentWith([{ hangUntilAbort: true }]);
    const pending = ask(agent);
    setTimeout(() => {
      timeout.abort();
    }, 0);

    await expect(pending).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: expect.stringContaining('too long'),
    });
  });

  it('reports a busy provider as rate limited', async () => {
    const busy = new OpenAI.RateLimitError(429, undefined, 'slow down', new Headers());
    const { agent } = agentWith([{ failWith: busy }]);

    await expect(ask(agent)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('turns a provider failure into a safe message that keeps the cause for the logs', async () => {
    const failure = new OpenAI.InternalServerError(500, undefined, 'secret detail', new Headers());
    const { agent } = agentWith([{ failWith: failure }]);

    const error: unknown = await ask(agent).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect((error as Error).message).not.toContain('secret detail');
    expect((error as Error).cause).toBe(failure);
  });

  it('passes a failure of the caller’s own callback through, not as a provider outage', async () => {
    const { agent } = agentWith([{ texts: ['Hi'] }]);
    const callbackError = new Error('socket closed');

    const result = agent.run({
      messages: [],
      user,
      timeZone: 'UTC',
      signal: new AbortController().signal,
      onText: () => {
        throw callbackError;
      },
      onProgress: () => undefined,
      onNavigate: () => undefined,
    });

    await expect(result).rejects.toBe(callbackError);
  });

  it('is unavailable without an API key', async () => {
    const { toolbox } = fakeToolbox();
    const agent = new ChatAgent(undefined, { model: 'm', reasoningEffort: 'low' }, toolbox, logger);

    expect(agent.isAvailable).toBe(false);
    await expect(ask(agent)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });
});
