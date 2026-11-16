import { EVENT_STATUSES, REGISTRATION_STATUSES } from './domain.js';
import { DAY_PATTERN, LIST_TEXT_FILTER_MAX_LENGTH, UUID_PATTERN } from './lists.js';
import { Resource } from './permissions.js';
import { ALMOST_FULL_FILTER } from './sessions.js';

/**
 * How the value of one list filter looks, so the API can check what the model asks for and the
 * admin can put it in the list's URL. A `day` is a calendar day (YYYY-MM-DD) in the user's time
 * zone. Whoever uses it turns it into a moment in that zone: the admin into the first or last
 * moment of the day, as its date filters do; the API list endpoints would otherwise read a bare day
 * as a UTC day.
 */
export type ChatFilterKind =
  | { kind: 'text' }
  | { kind: 'day' }
  | { kind: 'uuid' }
  | { kind: 'enum'; values: readonly string[] };

const TEXT: ChatFilterKind = { kind: 'text' };
const DAY: ChatFilterKind = { kind: 'day' };
const UUID: ChatFilterKind = { kind: 'uuid' };

/** Below this code point are the control characters (line breaks, tabs, NUL). */
const FIRST_PRINTABLE_CODE = 0x20;
const DELETE_CODE = 0x7f;

/** Line breaks and other control characters have no place in a list filter. */
function hasControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < FIRST_PRINTABLE_CODE || code === DELETE_CODE) return true;
  }
  return false;
}
/** Longer than any IANA zone name; a cap before handing the value to Intl. */
const TIME_ZONE_MAX_LENGTH = 64;

/** A real calendar day: 2026-02-30 is refused, not rolled over to 2 March. */
function isCalendarDay(value: string): boolean {
  if (!DAY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** An IANA time zone the runtime knows, such as Europe/Tallinn. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value === '' || value.length > TIME_ZONE_MAX_LENGTH) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    // Recovered on purpose: Intl answers an unknown zone with a RangeError.
    return false;
  }
}

/**
 * The lists the assistant may open, and the filters it may set on each: the same query parameters
 * the API list endpoints accept. Whether the user may open a list at all is still the permission
 * matrix's call.
 */
export const CHAT_NAVIGATION = {
  [Resource.EVENTS]: {
    q: TEXT,
    city: TEXT,
    status: { kind: 'enum', values: EVENT_STATUSES },
    tagId: UUID,
    organizerId: UUID,
    startsFrom: DAY,
    startsTo: DAY,
  },
  [Resource.SESSIONS]: {
    q: TEXT,
    eventId: UUID,
    [ALMOST_FULL_FILTER.field]: { kind: 'enum', values: [ALMOST_FULL_FILTER.value] },
    startsFrom: DAY,
    startsTo: DAY,
  },
  [Resource.REGISTRATIONS]: {
    q: TEXT,
    status: { kind: 'enum', values: REGISTRATION_STATUSES },
    eventId: UUID,
    sessionId: UUID,
    customerId: UUID,
  },
  [Resource.CUSTOMERS]: { q: TEXT },
  [Resource.CATALOG]: { q: TEXT, city: TEXT, tagId: UUID, startsFrom: DAY, startsTo: DAY },
  [Resource.MY_REGISTRATIONS]: {
    q: TEXT,
    status: { kind: 'enum', values: REGISTRATION_STATUSES },
    startsFrom: DAY,
    startsTo: DAY,
  },
} as const satisfies Partial<Record<Resource, Record<string, ChatFilterKind>>>;

export type ChatNavigableResource = keyof typeof CHAT_NAVIGATION;

export function isChatNavigableResource(value: string): value is ChatNavigableResource {
  return Object.hasOwn(CHAT_NAVIGATION, value);
}

function fitsKind(filter: ChatFilterKind, value: string): boolean {
  switch (filter.kind) {
    case 'text': {
      const text = value.trim();
      return (
        text !== '' && text.length <= LIST_TEXT_FILTER_MAX_LENGTH && !hasControlCharacter(text)
      );
    }
    case 'day':
      return isCalendarDay(value);
    case 'uuid':
      return UUID_PATTERN.test(value);
    case 'enum':
      return filter.values.includes(value);
  }
}

/**
 * Why these filters cannot be set on this list, or undefined when every one of them is allowed
 * and well formed. A start range must not end before it begins.
 */
export function chatFiltersProblem(
  resource: ChatNavigableResource,
  filters: Readonly<Record<string, unknown>>,
): string | undefined {
  const allowed: Readonly<Record<string, ChatFilterKind>> = CHAT_NAVIGATION[resource];
  for (const [field, value] of Object.entries(filters)) {
    // Own keys only, so "constructor" or "__proto__" never look like a filter.
    const filter = Object.hasOwn(allowed, field) ? allowed[field] : undefined;
    if (filter === undefined) return `The ${resource} list has no "${field}" filter.`;
    if (typeof value !== 'string' || !fitsKind(filter, value)) {
      return `That is not a valid ${field} filter value.`;
    }
  }
  const { startsFrom, startsTo } = filters;
  if (typeof startsFrom === 'string' && typeof startsTo === 'string' && startsTo < startsFrom) {
    return 'The start range ends before it begins.';
  }
  return undefined;
}
