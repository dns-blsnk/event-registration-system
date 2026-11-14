import type { ErrorCode } from './errors.js';
import type { Resource } from './permissions.js';

/** Socket.IO namespace of the help chat; the admin connects to the API host directly. */
export const CHAT_NAMESPACE = '/chat';

/** How long a chat ticket can be used to open a socket. Single use, bound to the user. */
export const CHAT_TICKET_TTL_SECONDS = 60;

/** What `POST /api/chat/ticket` returns: the one-time ticket for the socket handshake. */
export interface ChatTicket {
  ticket: string;
  expiresAt: string;
}

/** Longest question the help chat accepts, in characters. */
export const CHAT_QUESTION_MAX_LENGTH = 1000;

/** Events between the admin and the chat gateway. */
export const ChatEvent = {
  /** Client: ask a question about the screen being used. */
  ASK: 'ask',
  /** Client: stop the answer being streamed. */
  CANCEL: 'cancel',
  /** Server: the next piece of the answer. */
  CHUNK: 'chunk',
  /** Server: the answer is complete, or was cancelled. */
  DONE: 'done',
  /** Server: the answer failed. Not "error", which Socket.IO uses for its own failures. */
  ERROR: 'chat_error',
} as const;
export type ChatEvent = (typeof ChatEvent)[keyof typeof ChatEvent];

/** A question about one screen; `id` is chosen by the client to match the answer to it. */
export interface ChatQuestion {
  id: string;
  resource: Resource;
  field?: string;
  question: string;
}

export interface ChatChunk {
  id: string;
  text: string;
}

export interface ChatDone {
  id: string;
  cancelled: boolean;
}

export interface ChatError {
  id: string;
  code: ErrorCode;
  message: string;
}
