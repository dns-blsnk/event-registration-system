import { CHAT_NAMESPACE, type ChatTicket } from '@ers/shared';
import { io, type Socket } from 'socket.io-client';

import { http } from '../api/http';

/**
 * Where the chat socket connects: the API's public URL in production (Vercel does not proxy
 * WebSockets), or this origin in development, where Vite proxies it.
 */
const CHAT_URL: string = import.meta.env.VITE_CHAT_URL ?? '';

/**
 * Opens the help chat socket. Every connection, reconnections included, first fetches a fresh
 * one-time ticket through the CSRF-protected API, since a ticket works only once.
 */
export function openChatSocket(): Socket {
  return io(`${CHAT_URL}${CHAT_NAMESPACE}`, {
    transports: ['websocket'],
    auth: (send) => {
      void http.post<ChatTicket>('/chat/ticket').then(
        ({ data }) => {
          send({ ticket: data.ticket });
        },
        // No ticket: the handshake is refused; useChat retries the connection after a pause.
        () => {
          send({});
        },
      );
    },
  });
}
