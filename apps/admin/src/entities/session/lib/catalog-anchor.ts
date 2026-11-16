/** The id of a session's block on its event's catalog page, so a link can lead straight to it. */
export function catalogSessionAnchor(sessionId: string): string {
  return `session-${sessionId}`;
}
