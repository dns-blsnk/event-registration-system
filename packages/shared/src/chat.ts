import type { ChatNavigableResource } from './chat-navigation.js';
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

/** What `GET /api/chat/status` returns: whether a model is configured, so the widget can say so. */
export interface ChatStatus {
  isAvailable: boolean;
}

/** How long a chat's history is kept after its last message; reopening within it resumes it. */
export const CHAT_HISTORY_TTL_MINUTES = 30;

/** Events between the admin and the chat gateway. */
export const ChatEvent = {
  /** Client: continue the chat whose id this tab kept, or start one; answered by HISTORY. */
  RESUME: 'resume',
  /** Client: forget the current chat and start a new one; answered by HISTORY. */
  NEW_CHAT: 'new_chat',
  /** Server: the chat id to keep and the messages so far (none for a new chat). */
  HISTORY: 'history',
  /** Client: ask a question. */
  ASK: 'ask',
  /** Client: stop the answer being streamed. */
  CANCEL: 'cancel',
  /** Server: the next piece of the answer. */
  CHUNK: 'chunk',
  /** Server: what the assistant is doing while no text is coming, e.g. "Searching events…". */
  PROGRESS: 'progress',
  /** Server: open a list with these filters, as the answer suggests. */
  NAVIGATE: 'navigate',
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
  /**
   * The chat the question belongs to, as the server issued it in HISTORY. The server looks it up
   * only among the socket user's own chats, so another user's id finds nothing.
   */
  chatId?: string;
  /** The user's IANA time zone, so "next week" means their week; checked with isTimeZone. */
  timeZone?: string;
}

/** The chat id this tab kept, if any; an unknown, expired or foreign one starts a new chat. */
export interface ChatResume {
  chatId?: string;
}

/** One message of a chat as the user sees it. */
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatHistory {
  chatId: string;
  messages: ChatHistoryMessage[];
}

export interface ChatProgress {
  id: string;
  text: string;
}

/** A list to open: filter values as CHAT_NAVIGATION describes them (days, not instants). */
export interface ChatNavigation {
  id: string;
  resource: ChatNavigableResource;
  filters: Record<string, string>;
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
