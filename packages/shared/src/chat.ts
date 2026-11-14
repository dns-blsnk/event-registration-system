/** How long a chat ticket can be used to open a socket. Single use, bound to the user. */
export const CHAT_TICKET_TTL_SECONDS = 60;

/** What `POST /api/chat/ticket` returns: the one-time ticket for the socket handshake. */
export interface ChatTicket {
  ticket: string;
  expiresAt: string;
}
