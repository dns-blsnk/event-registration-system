import { Role } from '@ers/shared';

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

/** Zones named after a city ("Europe/Berlin"); "UTC" and "Etc/GMT+2" name none. */
const CITY_ZONE =
  /^(?:Africa|America|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/(?:[^/]+\/)?([^/]+)$/;

/** Old zone names browsers still report, under the city's current name as events spell it. */
const RENAMED_ZONE_CITIES: Readonly<Record<string, string>> = {
  Kiev: 'Kyiv',
  Calcutta: 'Kolkata',
  Saigon: 'Ho Chi Minh',
  Rangoon: 'Yangon',
};

/**
 * The city the viewer's time zone is named after ("Europe/Kyiv" -> "Kyiv"): a hint of where they
 * are without asking the browser for their location.
 */
export function cityOfTimeZone(timeZone: string): string | undefined {
  const city = CITY_ZONE.exec(timeZone)?.[1]?.replaceAll('_', ' ');
  return city === undefined ? undefined : (RENAMED_ZONE_CITIES[city] ?? city);
}

/** The viewer's city as their browser's time zone names it, if it names one. */
export function viewerCity(): string | undefined {
  return cityOfTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/** What each role can ask about with one click: searches its own tools can answer. */
function roleStarters(role: Role, city: string | undefined): readonly string[] {
  const where = city === undefined ? '' : ` in ${city}`;
  switch (role) {
    case Role.CUSTOMER:
      return [`What's on${where} in the next two weeks?`, 'Show my upcoming bookings'];
    case Role.ORGANIZER:
      return ['Which of my sessions are almost full?', 'Show my events this month'];
    // Admins and super admins see the same data, so they start from the same searches.
    case Role.ADMIN:
    case Role.SUPER_ADMIN:
      return [
        `Which events${where} are published for the next two weeks?`,
        'Which sessions are almost full?',
      ];
  }
}

/**
 * Questions to start with: about the focused field if there is one, else searches for the role
 * (none until the role is known), near the viewer's city when it is known.
 */
export function starterQuestions(
  role: Role | undefined,
  fieldLabel: string | undefined,
  city: string | undefined,
): readonly string[] {
  if (fieldLabel !== undefined) {
    return [`What does “${fieldLabel}” mean?`, `How should I fill in “${fieldLabel}”?`];
  }
  return role === undefined ? [] : roleStarters(role, city);
}
