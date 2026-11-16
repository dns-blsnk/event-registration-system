import {
  CHAT_HISTORY_REQUEST_ID,
  ChatEvent,
  type ChatChunk,
  type ChatDone,
  type ChatError,
  type ChatHistory,
  type ChatProgress,
  type ChatQuestion,
  type ChatResume,
} from '@ers/shared';
import { useEffect, useRef, useState } from 'react';

import { openChatSocket } from '../api/chat-socket';

import { forgetChatId, keepChatId, readChatId } from './chat-id';

import type { Socket } from 'socket.io-client';

export type ChatMessageState = 'streaming' | 'done' | 'cancelled' | 'failed';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  state: ChatMessageState;
  /** What the assistant is doing while it streams, e.g. "Searching events…"; gone once it writes. */
  progress?: string;
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

/** The message once the assistant writes or ends: what it was doing no longer applies. */
function withoutProgress(message: ChatMessage): ChatMessage {
  const copy = { ...message };
  delete copy.progress;
  return copy;
}

/** Keeps the part of an answer that already arrived, with the error after it. */
function withError(answered: string, error: string): string {
  return answered === '' ? error : `${answered}\n\n${error}`;
}

/** Ends every answer still streaming, e.g. when the connection drops mid-answer. */
function failStreaming(messages: ChatMessage[], error: string): ChatMessage[] {
  return messages.map((message) =>
    message.state === 'streaming'
      ? { ...withoutProgress(message), state: 'failed', text: withError(message.text, error) }
      : message,
  );
}

/** The browser's time zone, so "next week" means the user's week; the server checks it. */
function browserTimeZone(): Pick<ChatQuestion, 'timeZone'> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone === '' ? {} : { timeZone };
}

/** A question with what the server needs beside it: this tab's chat and the user's time zone. */
function withContext(question: ChatQuestion): ChatQuestion {
  return { ...question, ...currentChat(), ...browserTimeZone() };
}

/** The chat as the server kept it; each question and its answer share an id, as when asked. */
function fromHistory({ messages }: ChatHistory): ChatMessage[] {
  let id = '';
  return messages.map(({ role, text }, index) => {
    if (role === 'user' || id === '') id = `history-${String(index)}`;
    return { id, role, text, state: 'done' };
  });
}

/** This tab's chat, for the messages that name it; nothing before the server issued one. */
function currentChat(): ChatResume {
  const chatId = readChatId();
  return chatId === undefined ? {} : { chatId };
}

type SetConnection = (state: ChatConnection) => void;

/** A failure to load or start the chat, shown as an assistant message the user can read. */
function historyFailure(error: string): ChatMessage {
  return { id: CHAT_HISTORY_REQUEST_ID, role: 'assistant', text: error, state: 'failed' };
}

/**
 * Follows the connection; returns how to stop the retry timer. On every connection the tab asks
 * to resume its chat, and only counts as online once the history is in: a question sent before
 * that could name a chat the server has already replaced.
 */
function listenToConnection(
  socket: Socket,
  setMessages: SetMessages,
  setConnection: SetConnection,
): () => void {
  let retry: ReturnType<typeof setTimeout> | undefined;
  socket.on('connect', () => {
    socket.emit(ChatEvent.RESUME, currentChat());
  });
  socket.on(ChatEvent.HISTORY, (history: ChatHistory) => {
    const isSameChat = readChatId() === history.chatId;
    keepChatId(history.chatId);
    // Back in the same chat after a drop, the screen already shows everything the server kept,
    // plus what it never will: the question cut off by the drop and its error.
    setMessages((current) => (isSameChat && current.length > 0 ? current : fromHistory(history)));
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
  return () => {
    clearTimeout(retry);
  };
}

/**
 * Follows the answers: their text, how they ended and the errors about them or the chat.
 * `askedHere` holds the questions asked in the current chat: only their answers may move the tab
 * to another chat, so a late answer from before "new chat" cannot bring the old one back.
 */
function listenToAnswers(
  socket: Socket,
  setMessages: SetMessages,
  setConnection: SetConnection,
  askedHere: Set<string>,
) {
  socket.on(ChatEvent.CHUNK, ({ id, text }: ChatChunk) => {
    setMessages((current) =>
      update(current, id, (message) => ({
        ...withoutProgress(message),
        text: message.text + text,
      })),
    );
  });
  socket.on(ChatEvent.PROGRESS, ({ id, text }: ChatProgress) => {
    setMessages((current) =>
      update(current, id, (message) =>
        message.state === 'streaming' ? { ...message, progress: text } : message,
      ),
    );
  });
  socket.on(ChatEvent.DONE, ({ id, cancelled, chatId }: ChatDone) => {
    // The server moved the answer to a new chat when the one this tab kept had expired.
    if (chatId !== undefined && askedHere.has(id)) keepChatId(chatId);
    askedHere.delete(id);
    setMessages((current) =>
      update(current, id, (message) => ({
        ...withoutProgress(message),
        state: cancelled ? 'cancelled' : 'done',
      })),
    );
  });
  socket.on(ChatEvent.ERROR, ({ id, message: error }: ChatError) => {
    if (id === CHAT_HISTORY_REQUEST_ID) {
      // Asking still works without the old chat: the server keeps the answer in a new one.
      // One failure on screen at a time; a newer one replaces it.
      setMessages((current) => [
        ...current.filter((message) => message.id !== CHAT_HISTORY_REQUEST_ID),
        historyFailure(error),
      ]);
      setConnection('online');
      return;
    }
    setMessages((current) =>
      id === ''
        ? failStreaming(current, error)
        : update(current, id, (message) => ({
            ...withoutProgress(message),
            state: 'failed',
            text: withError(message.text, error),
          })),
    );
  });
}

/**
 * Starts a new chat. The tab forgets the old id at once, so even if the server cannot start the
 * new one, the next question opens a fresh chat rather than going on in the old. Connected, the
 * server forgets the old chat and sends the new id in HISTORY; until then nothing may be asked.
 */
function startNewChat(
  socket: Socket | undefined,
  askedHere: Set<string>,
  setConnection: SetConnection,
): void {
  const previous = currentChat();
  forgetChatId();
  askedHere.clear();
  if (socket?.connected !== true) return;
  setConnection('connecting');
  socket.emit(ChatEvent.NEW_CHAT, previous);
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
  // One set for the hook's lifetime, filled and cleared by the socket handlers, never rendered.
  const [askedHere] = useState(() => new Set<string>());

  useEffect(() => {
    if (!enabled) return undefined;
    const socket = openChatSocket();
    socketRef.current = socket;
    const stopRetrying = listenToConnection(socket, setMessages, setConnection);
    listenToAnswers(socket, setMessages, setConnection, askedHere);
    return () => {
      stopRetrying();
      socket.disconnect();
      socketRef.current = undefined;
      // The next opening starts by connecting again.
      setConnection('connecting');
    };
  }, [enabled, askedHere]);

  const ask = (question: Omit<ChatQuestion, 'id'>): void => {
    const id = crypto.randomUUID();
    const socket = socketRef.current;
    // Never buffered for later: a question sent while offline, or before the chat is loaded,
    // fails now, visibly.
    const isConnected = connection === 'online' && socket?.connected === true;
    setMessages((current) => [
      ...current,
      { id, role: 'user', text: question.question, state: 'done' },
      isConnected
        ? { id, role: 'assistant', text: '', state: 'streaming' }
        : { id, role: 'assistant', text: NOT_CONNECTED, state: 'failed' },
    ]);
    if (!isConnected) return;
    askedHere.add(id);
    socket.emit(ChatEvent.ASK, withContext({ id, ...question }));
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
      setMessages([]);
      startNewChat(socketRef.current, askedHere, setConnection);
    },
  };
}
