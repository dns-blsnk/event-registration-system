import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CHAT_RETRY_MS, useChat } from './use-chat';

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

describe('useChat', () => {
  beforeEach(() => {
    sockets.length = 0;
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
    socket.serve('connect');
    expect(result.current.connection).toBe('online');

    act(() => {
      result.current.ask({ resource: 'sessions', field: 'capacity', question: 'What is this?' });
    });
    const id = askedId(socket);
    expect(socket.emitted[0]?.payload).toEqual({
      id,
      resource: 'sessions',
      field: 'capacity',
      question: 'What is this?',
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

  it('cancels the answer being streamed', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
    act(() => {
      result.current.ask({ resource: 'events', question: 'Publishing?' });
    });
    const id = askedId(socket);

    act(() => {
      result.current.cancel();
    });
    socket.serve('done', { id, cancelled: true });

    expect(socket.emitted.map((entry) => entry.event)).toEqual(['ask', 'cancel']);
    expect(result.current.messages.at(-1)?.state).toBe('cancelled');
  });

  it('keeps the part of an answer that arrived before an error, with the error after it', () => {
    const { result } = renderHook(() => useChat(true));
    const socket = currentSocket();
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

  it('marks the connection offline when the handshake is refused', () => {
    const { result } = renderHook(() => useChat(true));

    currentSocket().serve('connect_error');

    expect(result.current.connection).toBe('offline');
  });
});
