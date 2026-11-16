import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { keepChatId, readChatId } from './chat-id';
import { CHAT_RETRY_MS, useChat } from './use-chat';

import type { OpenList } from './list-to-open';

type Handler = (payload?: unknown) => void;

/** A stand-in socket: records what the hook emits and lets a test play server events. */
class FakeSocket {
  readonly emitted: { event: string; payload: unknown }[] = [];
  isDisconnected = false;
  connected = true;
  active = true;
  connectCalls = 0;
  private readonly handlers = new Map<string, Handler>();
  /** The Manager: only its reconnect_attempt event is used. */
  readonly io = {
    on: (event: string, handler: Handler) => {
      this.handlers.set(`io:${event}`, handler);
    },
  };

  connect(): this {
    this.connectCalls += 1;
    return this;
  }

  on(event: string, handler: Handler): this {
    this.handlers.set(event, handler);
    return this;
  }

  emit(event: string, payload?: unknown): this {
    this.emitted.push({ event, payload });
    return this;
  }

  disconnect(): this {
    this.isDisconnected = true;
    return this;
  }

  /** Plays an event as if the server sent it. */
  serve(event: string, payload?: unknown): void {
    act(() => {
      this.handlers.get(event)?.(payload);
    });
  }
}

const sockets: FakeSocket[] = [];

vi.mock('../api/chat-socket', () => ({
  openChatSocket: () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  },
}));

function currentSocket(): FakeSocket {
  const socket = sockets.at(-1);
  if (socket === undefined) throw new Error('no socket was opened');
  return socket;
}

function askedId(socket: FakeSocket): string {
  const ask = socket.emitted.find((entry) => entry.event === 'ask');
  return (ask?.payload as { id: string }).id;
}

const CHAT = '11111111-1111-4111-8111-111111111111';
const NEXT_CHAT = '22222222-2222-4222-8222-222222222222';

/** Connects the socket and plays the server's answer to RESUME. */
function connectWith(socket: FakeSocket, history: { chatId: string; messages: unknown[] }) {
  socket.serve('connect');
  socket.serve('history', history);
}

describe('useChat', () => {
  beforeEach(() => {
    sockets.length = 0;
    sessionStorage.clear();
  });

  it('opens no socket while disabled', () => {
    renderHook(() => useChat(false));

    expect(sockets).toHaveLength(0);
  });

  it('opens a socket when enabled and closes it when disabled again', () => {
    const { rerender } = renderHook(({ enabled }) => useChat(enabled), {
      initialProps: { enabled: true },
    });
    const socket = currentSocket();

    rerender({ enabled: false });

    expect(socket.isDisconnected).toBe(true);
  });

  it('asks with the screen and field, then shows the answer as it streams', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    expect(result.current.connection).toBe('online');

    act(() => {
      result.current.ask({ resource: 'sessions', field: 'capacity', question: 'What is this?' });
    });
    const id = askedId(socket);
    expect(socket.emitted.at(-1)?.payload).toEqual({
      id,
      resource: 'sessions',
      field: 'capacity',
      question: 'What is this?',
      chatId: CHAT,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    expect(result.current.isAnswering).toBe(true);

    socket.serve('chunk', { id, text: 'Seats ' });
    socket.serve('chunk', { id, text: 'available.' });
    socket.serve('done', { id, cancelled: false });

    expect(result.current.messages).toEqual([
      { id, role: 'user', text: 'What is this?', state: 'done' },
      { id, role: 'assistant', text: 'Seats available.', state: 'done' },
    ]);
    expect(result.current.isAnswering).toBe(false);
  });

  it('shows what the assistant is doing until the answer goes on', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ question: 'Events in Tallinn?' });
    });
    const id = askedId(socket);

    socket.serve('progress', { id, text: 'Searching events…' });
    expect(result.current.messages.at(-1)?.progress).toBe('Searching events…');
    socket.serve('chunk', { id, text: 'Two.' });

    expect(result.current.messages.at(-1)).not.toHaveProperty('progress');
  });

  it('drops what the assistant was doing when the answer fails', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ question: 'Events?' });
    });
    const id = askedId(socket);
    socket.serve('progress', { id, text: 'Searching events…' });

    socket.serve('chat_error', { id, code: 'SERVICE_UNAVAILABLE', message: 'Try later.' });

    expect(result.current.messages.at(-1)).not.toHaveProperty('progress');
  });

  it('opens the list the assistant asks for and keeps it on the answer', async () => {
    const onNavigate = vi.fn<OpenList>(() => Promise.resolve('opened'));
    const { result } = renderHook(() => useChat(true, onNavigate));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ question: 'Events in Tallinn?' });
    });
    const id = askedId(socket);

    socket.serve('navigate', { id, resource: 'events', filters: { city: 'Tallinn' } });

    const target = { resource: 'events', filters: { city: 'Tallinn' } };
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(target, {
      automatic: true,
      isWanted: expect.any(Function),
    });
    await waitFor(() => {
      expect(result.current.messages.at(-1)?.list).toEqual({ target, isOpened: true });
    });
  });

  it('leaves no link on the answer when the list did not open', async () => {
    const onNavigate = vi.fn<OpenList>(() => Promise.resolve('skipped'));
    const { result } = renderHook(() => useChat(true, onNavigate));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ question: 'Users?' });
    });

    socket.serve('navigate', { id: askedId(socket), resource: 'events', filters: {} });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.messages.at(-1)).not.toHaveProperty('list');
  });

  it('keeps a held-back list on the answer as a link to open', async () => {
    const onNavigate = vi.fn<OpenList>(() => Promise.resolve('held'));
    const { result } = renderHook(() => useChat(true, onNavigate));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ question: 'Events?' });
    });

    socket.serve('navigate', { id: askedId(socket), resource: 'events', filters: {} });

    await waitFor(() => {
      expect(result.current.messages.at(-1)?.list).toMatchObject({ isOpened: false });
    });
  });

  it('no longer wants a list once the user stopped the answer, even mid-check', () => {
    const onNavigate = vi.fn<OpenList>(() => Promise.resolve('opened'));
    const { result } = renderHook(() => useChat(true, onNavigate));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ question: 'Events?' });
    });
    socket.serve('navigate', { id: askedId(socket), resource: 'events', filters: {} });
    const { isWanted } = onNavigate.mock.calls[0]?.[1] ?? { isWanted: () => true };
    expect(isWanted()).toBe(true);

    act(() => {
      result.current.cancel();
    });

    expect(isWanted()).toBe(false);
  });

  it('opens no list for an answer that is no longer awaited in this chat', () => {
    const onNavigate = vi.fn<OpenList>(() => Promise.resolve('opened'));
    const { result } = renderHook(() => useChat(true, onNavigate));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ question: 'Events?' });
    });
    const id = askedId(socket);
    act(() => {
      result.current.reset();
    });

    socket.serve('navigate', { id, resource: 'events', filters: {} });
    socket.serve('navigate', { id: 'never-asked', resource: 'events', filters: {} });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('cancels the answer being streamed', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ resource: 'events', question: 'Publishing?' });
    });
    const id = askedId(socket);

    act(() => {
      result.current.cancel();
    });
    socket.serve('done', { id, cancelled: true });

    expect(socket.emitted.map((entry) => entry.event)).toEqual(['resume', 'ask', 'cancel']);
    expect(result.current.messages.at(-1)?.state).toBe('cancelled');
  });

  it('keeps the part of an answer that arrived before an error, with the error after it', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ resource: 'events', question: 'Explain' });
    });
    const id = askedId(socket);
    socket.serve('chunk', { id, text: 'Partly' });

    socket.serve('chat_error', { id, code: 'SERVICE_UNAVAILABLE', message: 'Took too long.' });

    expect(result.current.messages.at(-1)).toMatchObject({
      state: 'failed',
      text: 'Partly\n\nTook too long.',
    });
  });

  it('fails a question asked while offline at once instead of sending it later', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    socket.connected = false;

    act(() => {
      result.current.ask({ resource: 'events', question: 'Hello?' });
      result.current.cancel();
    });

    expect(socket.emitted).toEqual([]);
    expect(result.current.messages.at(-1)?.state).toBe('failed');
    expect(result.current.isAnswering).toBe(false);
  });

  it('tries again after a refused handshake, which Socket.IO does not retry itself', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useChat(true));
      const socket = currentSocket();
      socket.active = false;

      socket.serve('connect_error');
      expect(result.current.connection).toBe('offline');
      act(() => {
        vi.advanceTimersByTime(CHAT_RETRY_MS);
      });

      expect(socket.connectCalls).toBe(1);
      expect(result.current.connection).toBe('connecting');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows "connecting" again while reconnecting after a drop', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    socket.serve('connect');
    socket.serve('disconnect');

    socket.serve('io:reconnect_attempt');

    expect(result.current.connection).toBe('connecting');
  });

  it('shows the server’s error for a question', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ resource: 'users', question: 'Roles?' });
    });

    socket.serve('chat_error', {
      id: askedId(socket),
      code: 'FORBIDDEN',
      message: 'You cannot get help with this screen.',
    });

    expect(result.current.messages.at(-1)).toMatchObject({
      state: 'failed',
      text: 'You cannot get help with this screen.',
    });
  });

  it('ends an answer cut off by a dropped connection, keeping what arrived', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ resource: 'events', question: 'Explain' });
    });
    socket.serve('chunk', { id: askedId(socket), text: 'Partly' });

    socket.serve('disconnect');

    expect(result.current.connection).toBe('offline');
    expect(result.current.messages.at(-1)).toMatchObject({
      state: 'failed',
      text: 'Partly\n\nThe connection dropped. Ask again once it is back.',
    });
  });

  it('asks to resume no chat in a fresh tab, and keeps the one the server starts', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();

    socket.serve('connect');
    expect(socket.emitted).toEqual([{ event: 'resume', payload: {} }]);
    expect(result.current.connection).toBe('connecting');
    socket.serve('history', { chatId: CHAT, messages: [] });

    expect(result.current.connection).toBe('online');
    expect(readChatId()).toBe(CHAT);
  });

  it('resumes the tab’s chat after a reload and shows what was said', () => {
    keepChatId(CHAT);
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();

    connectWith(socket, {
      chatId: CHAT,
      messages: [
        { role: 'user', text: 'Events in Tallinn?' },
        { role: 'assistant', text: 'Two.' },
      ],
    });

    expect(socket.emitted[0]).toEqual({ event: 'resume', payload: { chatId: CHAT } });
    expect(result.current.messages).toEqual([
      { id: 'history-0', role: 'user', text: 'Events in Tallinn?', state: 'done' },
      { id: 'history-0', role: 'assistant', text: 'Two.', state: 'done' },
    ]);
  });

  it('starts a new chat on the server, waiting for it before anything can be asked', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [{ role: 'user', text: 'Hi' }] });

    act(() => {
      result.current.reset();
    });
    expect(result.current.messages).toEqual([]);
    expect(result.current.connection).toBe('connecting');
    expect(socket.emitted.at(-1)).toEqual({ event: 'new_chat', payload: { chatId: CHAT } });
    socket.serve('history', { chatId: NEXT_CHAT, messages: [] });

    expect(result.current.connection).toBe('online');
    expect(readChatId()).toBe(NEXT_CHAT);
  });

  it('opens a fresh chat with the next question when the server could not start a new one', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.reset();
    });
    socket.serve('chat_error', { id: 'history', code: 'RATE_LIMITED', message: 'Slow down.' });

    act(() => {
      result.current.ask({ question: 'Hi?' });
    });

    expect(result.current.connection).toBe('online');
    expect(socket.emitted.at(-1)?.payload).not.toHaveProperty('chatId');
  });

  it('never moves back to the old chat for an answer that ends after "new chat"', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ question: 'Hi?' });
    });
    const id = askedId(socket);
    act(() => {
      result.current.reset();
    });
    socket.serve('history', { chatId: NEXT_CHAT, messages: [] });

    socket.serve('done', { id, cancelled: false, chatId: CHAT });

    expect(readChatId()).toBe(NEXT_CHAT);
  });

  it('fails a question asked before the chat is loaded instead of naming a stale chat', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    socket.serve('connect');

    act(() => {
      result.current.ask({ question: 'Hi?' });
    });

    expect(socket.emitted.map((entry) => entry.event)).toEqual(['resume']);
    expect(result.current.messages.at(-1)?.state).toBe('failed');
  });

  it('keeps what the screen shows when it reconnects to the same chat, the cut-off question too', () => {
    keepChatId(CHAT);
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ question: 'Hi?' });
    });
    socket.serve('disconnect');

    connectWith(socket, { chatId: CHAT, messages: [] });

    expect(result.current.messages.map((message) => message.text)).toEqual([
      'Hi?',
      'The connection dropped. Ask again once it is back.',
    ]);
  });

  it('forgets the chat when starting a new one offline, so the next connection does not resume it', () => {
    keepChatId(CHAT);
    const { result } = renderHook(() => useChat(true));
    currentSocket().connected = false;

    act(() => {
      result.current.reset();
    });

    expect(readChatId()).toBeUndefined();
  });

  it('keeps the new chat the server moved an answer to when the old one had expired', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    connectWith(socket, { chatId: CHAT, messages: [] });
    act(() => {
      result.current.ask({ question: 'Hi?' });
    });

    socket.serve('done', { id: askedId(socket), cancelled: false, chatId: NEXT_CHAT });

    expect(readChatId()).toBe(NEXT_CHAT);
  });

  it('shows a chat that could not be loaded as an error, and still lets the user ask', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    socket.serve('connect');

    socket.serve('chat_error', {
      id: 'history',
      code: 'SERVICE_UNAVAILABLE',
      message: 'Try later.',
    });

    expect(result.current.connection).toBe('online');
    expect(result.current.messages).toEqual([
      { id: 'history', role: 'assistant', text: 'Try later.', state: 'failed' },
    ]);
  });

  it('shows only the latest failure to load the chat', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    socket.serve('connect');

    socket.serve('chat_error', { id: 'history', code: 'SERVICE_UNAVAILABLE', message: 'First.' });
    socket.serve('chat_error', { id: 'history', code: 'SERVICE_UNAVAILABLE', message: 'Second.' });

    expect(result.current.messages.map((message) => message.text)).toEqual(['Second.']);
  });

  it('marks the connection offline when the handshake is refused', () => {
    const { result } = renderHook(() => useChat(true));

    currentSocket().serve('connect_error');

    expect(result.current.connection).toBe('offline');
  });
});
