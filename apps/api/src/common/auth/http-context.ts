import type { ExecutionContext } from '@nestjs/common';

/** True for HTTP requests; the session cookie, CSRF and route permissions are about HTTP. */
export function isHttpContext(context: ExecutionContext): boolean {
  return context.getType() === 'http';
}

/**
 * The deny-by-default rule for non-HTTP calls: only a socket event from a connection that passed
 * the chat handshake (one-time ticket, origin, live session) may reach a handler. Each handler
 * still checks what the user may do; RPC and any other transport are refused.
 */
export function isAuthenticatedSocket(context: ExecutionContext): boolean {
  if (context.getType() !== 'ws') {
    return false;
  }
  const client: unknown = context.switchToWs().getClient();
  const data: unknown =
    typeof client === 'object' && client !== null ? (client as { data?: unknown }).data : undefined;
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { userId?: unknown }).userId === 'string'
  );
}
