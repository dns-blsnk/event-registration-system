import type { ChatChunk, ChatDone, ChatError, ChatEvent, ChatHistory, Role } from '@ers/shared';
import type { Socket } from 'socket.io';

/** Who a connected socket acts as, set once at the handshake. */
export interface ChatSocketData {
  userId: string;
  sessionId: string;
  role: Role;
}

/** What the server sends; the client's events are read as untrusted payloads instead. */
export interface ChatServerEvents {
  [ChatEvent.HISTORY]: (history: ChatHistory) => void;
  [ChatEvent.CHUNK]: (chunk: ChatChunk) => void;
  [ChatEvent.DONE]: (done: ChatDone) => void;
  [ChatEvent.ERROR]: (error: ChatError) => void;
}

export type ChatSocket = Socket<
  Record<string, never>,
  ChatServerEvents,
  Record<string, never>,
  ChatSocketData
>;
