import {
  ChatEvent,
  type ChatChunk,
  type ChatDone,
  type ChatError,
  type ChatQuestion,
} from '@ers/shared';
import { useEffect, useRef, useState } from 'react';

import { openChatSocket } from './chat-socket';

import type { Socket } from 'socket.io-client';

export type ChatMessageState = 'streaming' | 'done' | 'cancelled' | 'failed';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  state: ChatMessageState;
}

export type ChatConnection = 'connecting' | 'online' | 'offline';

const CONNECTION_LOST = 'The connection dropped. Ask again once it is back.';
const NOT_CONNECTED = 'Not connected to the assistant yet. Try again in a moment.';
/** A refused handshake is final for Socket.IO; the hook tries again after this pause. */
export const CHAT_RETRY_MS = 5000;

type SetMessages = (change: (current: ChatMessage[]) => ChatMessage[]) => void;

function update(
  messages: ChatMessage[],
  id: string,
  change: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  return messages.map((message) =>
    message.role === 'assistant' && message.id === id ? change(message) : message,
  );
}

/** Keeps the part of an answer that already arrived, with the error after it. */
function withError(answered: string, error: string): string {
  return answered === '' ? error : `${answered}\n\n${error}`;
}

/** Ends every answer still streaming, e.g. when the connection drops mid-answer. */
function failStreaming(messages: ChatMessage[], error: string): ChatMessage[] {
  return messages.map((message) =>
    message.state === 'streaming'
      ? { ...message, state: 'failed', text: withError(message.text, error) }
      : message,
  );
}

/** Keeps the conversation in step with the socket; returns how to stop the retry timer. */
function listen(
  socket: Socket,
  setMessages: SetMessages,
  setConnection: (state: ChatConnection) => void,
): () => void {
  let retry: ReturnType<typeof setTimeout> | undefined;
  socket.on('connect', () => {
    setConnection('online');
  });
  socket.io.on('reconnect_attempt', () => {
    setConnection('connecting');
  });
  socket.on('disconnect', () => {
    setConnection('offline');
    setMessages((current) => failStreaming(current, CONNECTION_LOST));
  });
  socket.on('connect_error', () => {
    setConnection('offline');
    // A refused handshake (no ticket, ended session) is not retried by Socket.IO itself.
    if (!socket.active) {
      retry = setTimeout(() => {
        setConnection('connecting');
        socket.connect();
      }, CHAT_RETRY_MS);
    }
  });
  socket.on(ChatEvent.CHUNK, ({ id, text }: ChatChunk) => {
    setMessages((current) =>
      update(current, id, (message) => ({ ...message, text: message.text + text })),
    );
  });
  socket.on(ChatEvent.DONE, ({ id, cancelled }: ChatDone) => {
    setMessages((current) =>
      update(current, id, (message) => ({ ...message, state: cancelled ? 'cancelled' : 'done' })),
    );
  });
  socket.on(ChatEvent.ERROR, ({ id, message: error }: ChatError) => {
    setMessages((current) =>
      id === ''
        ? failStreaming(current, error)
        : update(current, id, (message) => ({
            ...message,
            state: 'failed',
            text: withError(message.text, error),
          })),
    );
  });
  return () => {
    clearTimeout(retry);
  };
}

/**
 * The help chat's conversation and connection. The socket is opened only while `enabled` (the
 * widget is open and a model is configured) and closed again after, so idle tabs hold no socket.
 */
export function useChat(enabled: boolean): {
  messages: ChatMessage[];
  connection: ChatConnection;
  isAnswering: boolean;
  ask: (question: Omit<ChatQuestion, 'id'>) => void;
  cancel: () => void;
  /** Starts a new conversation; an answer still streaming is stopped first. */
  reset: () => void;
} {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connection, setConnection] = useState<ChatConnection>('connecting');
  const socketRef = useRef<Socket | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return undefined;
    const socket = openChatSocket();
    socketRef.current = socket;
    const stopRetrying = listen(socket, setMessages, setConnection);
    return () => {
      stopRetrying();
      socket.disconnect();
      socketRef.current = undefined;
      // The next opening starts by connecting again.
      setConnection('connecting');
    };
  }, [enabled]);

  const ask = (question: Omit<ChatQuestion, 'id'>): void => {
    const id = crypto.randomUUID();
    const socket = socketRef.current;
    // Never buffered for later: a question sent while offline fails now, visibly.
    const isConnected = socket?.connected === true;
    setMessages((current) => [
      ...current,
      { id, role: 'user', text: question.question, state: 'done' },
      isConnected
        ? { id, role: 'assistant', text: '', state: 'streaming' }
        : { id, role: 'assistant', text: NOT_CONNECTED, state: 'failed' },
    ]);
    if (isConnected) socket.emit(ChatEvent.ASK, { id, ...question } satisfies ChatQuestion);
  };

  const cancel = (): void => {
    if (socketRef.current?.connected === true) socketRef.current.emit(ChatEvent.CANCEL);
  };

  const isAnswering = messages.some((message) => message.state === 'streaming');

  return {
    messages,
    connection,
    isAnswering,
    ask,
    cancel,
    reset: () => {
      if (isAnswering) cancel();
      // Every question goes to the server on its own, so forgetting them here is the whole reset.
      setMessages([]);
    },
  };
}
