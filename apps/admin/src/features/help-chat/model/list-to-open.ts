import {
  ALMOST_FULL_FILTER,
  CHAT_NAVIGATION,
  EVENT_LIST_CONTROLS,
  EVENT_STATUS_LABELS,
  REGISTRATION_FIELDS,
  REGISTRATION_STATUS_LABELS,
  Resource,
  SESSION_LIST_CONTROLS,
  type ChatFilterKind,
  type ChatNavigableResource,
  type ChatNavigation,
} from '@ers/shared';
import dayjs from 'dayjs';

import { dayToInstant, type DayBound } from '@/shared/ui/date-filter';

/** A list the assistant asked to open: which one, and its filters as the server checked them. */
export type ListToOpen = Omit<ChatNavigation, 'id'>;

/**
 * How opening a list went: opened; held back because the page has unsaved changes (the user can
 * open it from the chat, past the usual warning); or not opened at all (not allowed, not wanted).
 */
export type ListOpening = 'opened' | 'held' | 'skipped';

/**
 * Opens a list. `automatic` is an assistant's request rather than the user's click; `isWanted`
 * is asked again just before moving, since the user may have moved on while access was checked.
 */
export type OpenList = (
  list: ListToOpen,
  options: { automatic: boolean; isWanted: () => boolean },
) => Promise<ListOpening>;

/** Every filter name the assistant may set on some list. */
type ChatFilterField = {
  [R in ChatNavigableResource]: keyof (typeof CHAT_NAVIGATION)[R];
}[ChatNavigableResource];

/** How a filter reads in the chat, with the labels the lists' own filter controls use. */
const FILTER_LABELS: Readonly<Record<ChatFilterField, string>> = {
  q: EVENT_LIST_CONTROLS.search.label,
  city: EVENT_LIST_CONTROLS.city.label,
  status: REGISTRATION_FIELDS.status.label,
  tagId: EVENT_LIST_CONTROLS.tag.label,
  organizerId: EVENT_LIST_CONTROLS.organizer.label,
  eventId: REGISTRATION_FIELDS.event.label,
  sessionId: REGISTRATION_FIELDS.session.label,
  customerId: REGISTRATION_FIELDS.customer.label,
  [ALMOST_FULL_FILTER.field]: SESSION_LIST_CONTROLS.almostFull.label,
  startsFrom: EVENT_LIST_CONTROLS.startsFrom.label,
  startsTo: EVENT_LIST_CONTROLS.startsTo.label,
};

/** Which end of its day a day filter stands for, as the lists' own date filters read it. */
const DAY_BOUNDS: Readonly<Record<string, DayBound>> = { startsFrom: 'start', startsTo: 'end' };

const SHOWN_DAY = 'D MMM YYYY';

function kindOf({ resource }: ListToOpen, field: string): ChatFilterKind | undefined {
  const filters: Readonly<Record<string, ChatFilterKind>> = CHAT_NAVIGATION[resource];
  return Object.hasOwn(filters, field) ? filters[field] : undefined;
}

/**
 * The list's filter values as its URL carries them. A day becomes the first or last moment of that
 * day in the viewer's time zone, the zone the server read it in, as the lists' date filters do.
 */
export function listFilterValues(list: ListToOpen): Record<string, string> {
  return Object.fromEntries(
    Object.entries(list.filters).map(([field, value]) => {
      const bound = DAY_BOUNDS[field];
      const isDay = kindOf(list, field)?.kind === 'day' && bound !== undefined;
      return [field, isDay ? dayToInstant(value, bound) : value];
    }),
  );
}

function statusLabel(resource: ChatNavigableResource, value: string): string {
  const labels: Readonly<Record<string, string>> =
    resource === Resource.EVENTS ? EVENT_STATUS_LABELS : REGISTRATION_STATUS_LABELS;
  return Object.hasOwn(labels, value) ? (labels[value] ?? value) : value;
}

/** One filter in words; an id or a yes-only filter is named, not shown as its value. */
function describeFilter(list: ListToOpen, field: string, value: string): string {
  const label = Object.hasOwn(FILTER_LABELS, field)
    ? FILTER_LABELS[field as ChatFilterField]
    : field;
  const kind = kindOf(list, field)?.kind;
  if (kind === 'uuid' || field === ALMOST_FULL_FILTER.field) return label;
  if (kind === 'day') return `${label} ${dayjs(value).format(SHOWN_DAY)}`;
  if (field === 'status') return `${label}: ${statusLabel(list.resource, value)}`;
  return `${label}: ${value}`;
}

/** The filters in words, e.g. "City: Tallinn, Starts from 16 Nov 2026"; empty without any. */
export function describeFilters(list: ListToOpen): string {
  return Object.entries(list.filters)
    .map(([field, value]) => describeFilter(list, field, value))
    .join(', ');
}

/** How the chat names a list, e.g. "Events: City: Tallinn", with the menu's name of the list. */
export function describeList(list: ListToOpen, listName: string): string {
  const filters = describeFilters(list);
  return filters === '' ? listName : `${listName}: ${filters}`;
}
