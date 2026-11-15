import { CHAT_NAMESPACE, ChatEvent, CSRF_HEADER } from '@ers/shared';
import { io, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppLogService } from '../../src/modules/app-logs/app-log.service.js';
import { AI_CLIENT } from '../../src/modules/chat/chat-answer.service.js';
import { ChatGateway } from '../../src/modules/chat/chat.gateway.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { TEST_ENV } from '../helpers/test-env.js';

import type { Role, ChatChunk, ChatDone, ChatError } from '@ers/shared';
import type { INestApplication } from '@nestjs/common';

const ADMIN_ORIGIN = TEST_ENV.ADMIN_ORIGIN ?? '';
const WAIT_MS = 2000;

/** A fake model: streams fixed words, or waits until the answer is cancelled. */
const model = {
  words: ['Seats ', 'left.'],
  hang: false,
  isDown: false,
  prompts: [] as { system: string }[],
};
const fakeAiClient = {
  chat: {
    completions: {
      create: (
        params: { messages: { role: string; content: string }[] },
        options: { signal: AbortSignal },
      ) => {
        model.prompts.push({ system: params.messages[0]?.content ?? '' });
        return Promise.resolve({
          async *[Symbol.asyncIterator]() {
            if (model.isDown) throw new Error('provider is down');
            for (const text of model.words) {
              yield { choices: [{ delta: { content: text }, finish_reason: null }] };
            }
            if (model.hang) {
              await new Promise((resolve) => {
                options.signal.addEventListener('abort', resolve);
              });
              throw new Error('aborted');
            }
            yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
          },
        });
      },
    },
  },
};

describe('chat gateway', () => {
  let app: INestApplication;
  let url: string;
  const open: Socket[] = [];

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [{ provide: AI_CLIENT, useValue: fakeAiClient }],
    });
    await app.listen(0);
    url = `${await app.getUrl()}${CHAT_NAMESPACE}`.replace('[::1]', 'localhost');
  });

  afterEach(() => {
    for (const socket of open.splice(0)) socket.disconnect();
    model.words = ['Seats ', 'left.'];
    model.hang = false;
    model.isDown = false;
    model.prompts = [];
  });

  afterAll(async () => {
    await app.close();
  });

  async function ticketFor(agent: SignedInAgent): Promise<string> {
    const response = await agent.agent
      .post('/api/chat/ticket')
      .set(CSRF_HEADER, agent.csrfToken)
      .expect(200);
    return (response.body as { ticket: string }).ticket;
  }

  function connect(ticket: string | undefined, origin = ADMIN_ORIGIN): Socket {
    const socket = io(url, {
      transports: ['websocket'],
      auth: ticket === undefined ? {} : { ticket },
      extraHeaders: { origin },
      reconnection: false,
      forceNew: true,
    });
    open.push(socket);
    return socket;
  }

  function connected(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.once('connect', () => {
        resolve();
      });
      socket.once('connect_error', reject);
    });
  }

  function refused(socket: Socket): Promise<string> {
    return new Promise((resolve, reject) => {
      socket.once('connect_error', (error) => {
        resolve(error.message);
      });
      socket.once('connect', () => {
        reject(new Error('connected but should have been refused'));
      });
    });
  }

  async function connectAs(role: Role): Promise<{ socket: Socket; agent: SignedInAgent }> {
    const agent = await signedInAgent(app, role);
    const socket = connect(await ticketFor(agent));
    await connected(socket);
    return { socket, agent };
  }

  /** Collects one answer: its chunks, then done or an error. */
  function answer(
    socket: Socket,
    id: string,
  ): Promise<{ text: string; done?: ChatDone; error?: ChatError }> {
    return new Promise((resolve) => {
      let text = '';
      socket.on(ChatEvent.CHUNK, (chunk: ChatChunk) => {
        if (chunk.id === id) text += chunk.text;
      });
      socket.once(ChatEvent.DONE, (done: ChatDone) => {
        resolve({ text, done });
      });
      socket.once(ChatEvent.ERROR, (error: ChatError) => {
        resolve({ text, error });
      });
    });
  }

  it('streams an answer about a screen the role may open', async () => {
    const { socket } = await connectAs('ORGANIZER');

    const result = answer(socket, 'q1');
    socket.emit(ChatEvent.ASK, {
      id: 'q1',
      resource: 'sessions',
      field: 'capacity',
      question: 'What is this?',
    });

    expect(await result).toEqual({ text: 'Seats left.', done: { id: 'q1', cancelled: false } });
    expect(model.prompts[0]?.system).toContain('(the field in focus)');
  });

  it('refuses a socket without a ticket', async () => {
    expect(await refused(connect(undefined))).toBe('not allowed');
  });

  it('refuses a ticket used a second time', async () => {
    const agent = await signedInAgent(app, 'CUSTOMER');
    const ticket = await ticketFor(agent);
    await connected(connect(ticket));

    expect(await refused(connect(ticket))).toBe('not allowed');
  });

  it('refuses a socket from another origin, even with a valid ticket', async () => {
    const agent = await signedInAgent(app, 'CUSTOMER');

    expect(await refused(connect(await ticketFor(agent), 'https://evil.example'))).toBe(
      'not allowed',
    );
  });

  it('refuses a ticket whose session was signed out before connecting', async () => {
    const agent = await signedInAgent(app, 'CUSTOMER');
    const ticket = await ticketFor(agent);
    await app.get(PrismaService).authSession.deleteMany({ where: { userId: agent.userId } });

    expect(await refused(connect(ticket))).toBe('not allowed');
  });

  it('ends the connection when the session is signed out, on the next question', async () => {
    const { socket, agent } = await connectAs('CUSTOMER');
    await app.get(PrismaService).authSession.deleteMany({ where: { userId: agent.userId } });
    const disconnected = new Promise((resolve) => socket.once('disconnect', resolve));

    const result = answer(socket, 'q1');
    socket.emit(ChatEvent.ASK, { id: 'q1', resource: 'catalog', question: 'Can I book?' });

    expect((await result).error?.code).toBe('UNAUTHENTICATED');
    await disconnected;
  });

  it('closes connections of ended sessions in the periodic sweep', async () => {
    const { socket, agent } = await connectAs('CUSTOMER');
    await app.get(PrismaService).authSession.deleteMany({ where: { userId: agent.userId } });
    const disconnected = new Promise((resolve) => socket.once('disconnect', resolve));

    await app.get(ChatGateway).sweepEndedSessions();

    await disconnected;
  });

  it('refuses help with a screen the role may not open', async () => {
    const { socket } = await connectAs('CUSTOMER');

    const result = answer(socket, 'q1');
    socket.emit(ChatEvent.ASK, { id: 'q1', resource: 'users', question: 'Roles?' });

    expect((await result).error).toMatchObject({ id: 'q1', code: 'FORBIDDEN' });
    expect(model.prompts).toHaveLength(0);
  });

  it.each([
    ['a payload that is not an object', 'hello'],
    ['a missing id', { resource: 'events', question: 'Hi?' }],
    ['an empty question', { id: 'q1', resource: 'events', question: '   ' }],
    ['a question over the limit', { id: 'q1', resource: 'events', question: 'x'.repeat(1001) }],
  ])('refuses %s without calling the model', async (_case, payload) => {
    const { socket } = await connectAs('ADMIN');

    const error = new Promise<ChatError>((resolve) => socket.once(ChatEvent.ERROR, resolve));
    socket.emit(ChatEvent.ASK, payload);

    expect((await error).code).toBe('VALIDATION_FAILED');
    expect(model.prompts).toHaveLength(0);
  });

  it('tells the user the assistant is unavailable and journals the provider failure for admins', async () => {
    model.isDown = true;
    const { socket, agent } = await connectAs('ORGANIZER');

    const result = answer(socket, 'q1');
    socket.emit(ChatEvent.ASK, { id: 'q1', resource: 'events', question: 'secret question text' });

    expect((await result).error).toMatchObject({ id: 'q1', code: 'SERVICE_UNAVAILABLE' });
    await app.get(AppLogService).flush();
    const entry = await app
      .get(PrismaService)
      .appLog.findFirstOrThrow({ where: { userId: agent.userId, category: 'ERROR' } });
    expect(entry).toMatchObject({
      level: 'ERROR',
      route: CHAT_NAMESPACE,
      errorCode: 'SERVICE_UNAVAILABLE',
    });
    expect(entry.message).toContain('provider is down');
    expect(JSON.stringify(entry)).not.toContain('secret question text');
  });

  it('stops an answer when the user cancels', async () => {
    model.hang = true;
    const { socket } = await connectAs('ORGANIZER');

    const result = answer(socket, 'q1');
    socket.emit(ChatEvent.ASK, { id: 'q1', resource: 'events', question: 'Explain publishing' });
    await new Promise((resolve) => socket.once(ChatEvent.CHUNK, resolve));
    socket.emit(ChatEvent.CANCEL);

    expect((await result).done).toEqual({ id: 'q1', cancelled: true });
  });

  it(
    'limits how many questions one user may ask a minute',
    async () => {
      const { socket } = await connectAs('ADMIN');
      const errors: ChatError[] = [];
      socket.on(ChatEvent.ERROR, (error: ChatError) => errors.push(error));

      for (let index = 0; index < 11; index += 1) {
        const result = answer(socket, `q${String(index)}`);
        socket.emit(ChatEvent.ASK, { id: `q${String(index)}`, resource: 'tags', question: 'Why?' });
        await result;
      }

      expect(errors.map((error) => error.code)).toEqual(['RATE_LIMITED']);
    },
    WAIT_MS * 5,
  );
});
