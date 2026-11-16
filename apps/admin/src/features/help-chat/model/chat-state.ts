import type { ChatConnection } from './use-chat';
import type { Role } from '@ers/shared';

/** Whether the server has a model configured, as GET /chat/status answered (or failed to). */
export interface ChatAvailability {
  isLoaded: boolean;
  isFailed: boolean;
  isAvailable: boolean;
}

/** How the assistant can be reached right now, as the header's status line shows it. */
export type ChatReachability = 'online' | 'connecting' | 'offline' | 'unavailable';

/** What, if anything, keeps the user from asking right now; undefined when they can ask. */
export function blocker({ isLoaded, isFailed, isAvailable }: ChatAvailability): string | undefined {
  if (isFailed) return 'Could not reach the assistant. Close the chat and open it again to retry.';
  if (!isLoaded || isAvailable) return undefined;
  return 'The assistant is not available right now.';
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

/** Admins and super admins see the same data, so they start from the same searches. */
const ADMIN_STARTERS = [
  'Which events are published for the next two weeks?',
  'Which sessions are almost full?',
] as const;

/** What each role can ask about with one click: searches its own tools can answer. */
const ROLE_STARTERS: Readonly<Record<Role, readonly string[]>> = {
  CUSTOMER: ['Which events are on next week?', 'Show my upcoming bookings'],
  ORGANIZER: ['Which of my sessions are almost full?', 'Show my events this month'],
  ADMIN: ADMIN_STARTERS,
  SUPER_ADMIN: ADMIN_STARTERS,
};

/**
 * Questions to start with: about the focused field if there is one, else searches for the role
 * (none until the role is known).
 */
export function starterQuestions(
  role: Role | undefined,
  fieldLabel: string | undefined,
): readonly string[] {
  if (fieldLabel !== undefined) {
    return [`What does “${fieldLabel}” mean?`, `How should I fill in “${fieldLabel}”?`];
  }
  return role === undefined ? [] : ROLE_STARTERS[role];
}
