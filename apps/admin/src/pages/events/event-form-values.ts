import { fromInputDateTime, toInputDateTime } from '../../components/date-input';

import type { EventDetail, TagRef } from '@ers/shared';

/** What the event form edits; dates are `datetime-local` strings in the viewer's time zone. */
export interface EventFormValues {
  title: string;
  description: string;
  city: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  tags: TagRef[];
}

/** What the API accepts for create and update. */
export interface EventPayload {
  title: string;
  description: string;
  city: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  tagIds: string[];
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: '',
  description: '',
  city: '',
  venue: '',
  startsAt: '',
  endsAt: '',
  tags: [],
};

export function toEventFormValues(event: EventDetail): EventFormValues {
  return {
    title: event.title,
    description: event.description,
    city: event.city,
    venue: event.venue,
    startsAt: toInputDateTime(event.startsAt),
    endsAt: toInputDateTime(event.endsAt),
    tags: event.tags,
  };
}

export function toEventPayload(values: EventFormValues): EventPayload {
  return {
    title: values.title,
    description: values.description,
    city: values.city,
    venue: values.venue,
    startsAt: fromInputDateTime(values.startsAt),
    endsAt: fromInputDateTime(values.endsAt),
    tagIds: values.tags.map((tag) => tag.id),
  };
}

const sameTags = (a: readonly TagRef[], b: readonly TagRef[]): boolean =>
  a.length === b.length && a.every((tag, index) => tag.id === b[index]?.id);

/**
 * Only the fields that differ from the loaded event, so untouched dates are never re-sent (a
 * datetime-local input drops seconds, and re-sending a rounded past start would be refused).
 */
export function toEventPatch(
  values: EventFormValues,
  original: EventFormValues,
): Partial<EventPayload> {
  const full = toEventPayload(values);
  const patch: Partial<EventPayload> = {};
  if (values.title !== original.title) patch.title = full.title;
  if (values.description !== original.description) patch.description = full.description;
  if (values.city !== original.city) patch.city = full.city;
  if (values.venue !== original.venue) patch.venue = full.venue;
  if (values.startsAt !== original.startsAt) patch.startsAt = full.startsAt;
  if (values.endsAt !== original.endsAt) patch.endsAt = full.endsAt;
  if (!sameTags(values.tags, original.tags)) patch.tagIds = full.tagIds;
  return patch;
}
