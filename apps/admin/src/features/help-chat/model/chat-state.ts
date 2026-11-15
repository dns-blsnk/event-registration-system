import type { ChatConnection } from './use-chat';

/** Whether the server has a model configured, as GET /chat/status answered (or failed to). */
export interface ChatAvailability {
  isLoaded: boolean;
  isFailed: boolean;
  isAvailable: boolean;
}

/** How the assistant can be reached right now, as the header's status line shows it. */
export type ChatReachability = 'online' | 'connecting' | 'offline' | 'unavailable';

/** What, if anything, keeps the user from asking right now; undefined when they can ask. */
export function blocker(
  { isLoaded, isFailed, isAvailable }: ChatAvailability,
  hasScreen: boolean,
): string | undefined {
  if (isFailed) return 'Could not reach the assistant. Close the chat and open it again to retry.';
  if (!isLoaded) return undefined;
  if (!isAvailable) return 'The assistant is not available right now.';
  return hasScreen ? undefined : 'Open a screen to ask about its fields.';
}

/** The header's status: a failed or negative status check wins over the socket's state. */
export function reachabilityOf(
  availability: ChatAvailability,
  connection: ChatConnection,
): ChatReachability {
  if (availability.isFailed) return 'unavailable';
  if (!availability.isLoaded) return 'connecting';
  return availability.isAvailable ? connection : 'unavailable';
}

/** Questions to start with: about the focused field if there is one, else about the screen. */
export function starterQuestions(fieldLabel: string | undefined): string[] {
  if (fieldLabel !== undefined) {
    return [`What does “${fieldLabel}” mean?`, `How should I fill in “${fieldLabel}”?`];
  }
  return ['What can I do on this screen?', 'Which fields are required here?'];
}
