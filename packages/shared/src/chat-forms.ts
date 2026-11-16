import { BOOKING_RULES_TEXT, EVENT_TRANSITIONS, EventStatus } from './domain.js';
import { EVENT_STATUS_LABELS } from './field-descriptions.js';
import {
  APP_LOG_FIELDS,
  APP_LOG_LIST_CONTROLS,
  CATALOG_FIELDS,
  CUSTOMER_FIELDS,
  CUSTOMER_LIST_CONTROLS,
  EVENT_FIELDS,
  EVENT_LIST_CONTROLS,
  MY_REGISTRATION_FIELDS,
  MY_REGISTRATION_LIST_CONTROLS,
  REGISTRATION_FIELDS,
  REGISTRATION_LIST_CONTROLS,
  SESSION_FIELDS,
  SESSION_LIST_CONTROLS,
  TAG_FIELDS,
  TAG_LIST_CONTROLS,
  USER_FIELDS,
  USER_LIST_CONTROLS,
  type FieldDescription,
} from './field-descriptions.js';
import { Resource } from './permissions.js';

type FormFields = Readonly<Record<string, FieldDescription>>;

/**
 * The fields and filters of each admin screen, as the help chat explains them. They are the same
 * descriptions the screens show, so the chat and the screen never disagree. Customer screens use
 * customer wording only.
 */
export const CHAT_FORM_FIELDS: Readonly<Record<Resource, FormFields>> = {
  [Resource.EVENTS]: { ...EVENT_FIELDS, ...EVENT_LIST_CONTROLS },
  [Resource.SESSIONS]: { ...SESSION_FIELDS, ...SESSION_LIST_CONTROLS },
  [Resource.REGISTRATIONS]: { ...REGISTRATION_FIELDS, ...REGISTRATION_LIST_CONTROLS },
  [Resource.TAGS]: { ...TAG_FIELDS, ...TAG_LIST_CONTROLS },
  [Resource.CUSTOMERS]: { ...CUSTOMER_FIELDS, ...CUSTOMER_LIST_CONTROLS },
  [Resource.USERS]: { ...USER_FIELDS, ...USER_LIST_CONTROLS },
  [Resource.APP_LOGS]: { ...APP_LOG_FIELDS, ...APP_LOG_LIST_CONTROLS },
  [Resource.CATALOG]: CATALOG_FIELDS,
  [Resource.MY_REGISTRATIONS]: { ...MY_REGISTRATION_FIELDS, ...MY_REGISTRATION_LIST_CONTROLS },
};

/** The event lifecycle in words, built from the transition table itself so it cannot drift. */
function lifecycleText(): string {
  const moves = Object.values(EventStatus)
    .filter((from) => EVENT_TRANSITIONS[from].length > 0)
    .map(
      (from) =>
        `${EVENT_STATUS_LABELS[from]} can become ${EVENT_TRANSITIONS[from].map((to) => EVENT_STATUS_LABELS[to]).join(' or ')}`,
    );
  return `Event statuses: ${moves.join('; ')}. Cancelling an event cancels all its bookings.`;
}

/**
 * The rules a screen needs explained, one item per rule, so a text that explains several screens
 * can be stated once; screens without booking logic get none.
 */
export const CHAT_FORM_RULES: Readonly<Partial<Record<Resource, readonly string[]>>> = {
  [Resource.EVENTS]: [lifecycleText(), BOOKING_RULES_TEXT],
  [Resource.SESSIONS]: [BOOKING_RULES_TEXT],
  [Resource.REGISTRATIONS]: [BOOKING_RULES_TEXT],
  [Resource.CATALOG]: [BOOKING_RULES_TEXT],
  [Resource.MY_REGISTRATIONS]: [BOOKING_RULES_TEXT],
};
