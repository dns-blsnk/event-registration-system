import { fromInputDateTime, toInputDateTime } from '../../components/date-input';

import type { SessionListItem } from '@ers/shared';

/** What the session form edits; dates are `datetime-local` strings, capacity is the input's text. */
export interface SessionFormValues {
  title: string;
  speaker: string;
  room: string;
  startsAt: string;
  endsAt: string;
  capacity: string;
}

export interface SessionCreatePayload {
  eventId: string;
  title: string;
  speaker?: string;
  room?: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
}

/** A partial update; null clears the optional speaker or room. */
export interface SessionPatch {
  title?: string;
  speaker?: string | null;
  room?: string | null;
  startsAt?: string;
  endsAt?: string;
  capacity?: number;
}

export const EMPTY_SESSION_FORM: SessionFormValues = {
  title: '',
  speaker: '',
  room: '',
  startsAt: '',
  endsAt: '',
  capacity: '',
};

export function toSessionFormValues(session: SessionListItem): SessionFormValues {
  return {
    title: session.title,
    speaker: session.speaker ?? '',
    room: session.room ?? '',
    startsAt: toInputDateTime(session.startsAt),
    endsAt: toInputDateTime(session.endsAt),
    capacity: String(session.capacity),
  };
}

export function toSessionCreatePayload(
  values: SessionFormValues,
  eventId: string,
): SessionCreatePayload {
  const speaker = values.speaker.trim();
  const room = values.room.trim();
  return {
    eventId,
    title: values.title.trim(),
    ...(speaker === '' ? {} : { speaker }),
    ...(room === '' ? {} : { room }),
    startsAt: fromInputDateTime(values.startsAt),
    endsAt: fromInputDateTime(values.endsAt),
    capacity: Number(values.capacity),
  };
}

const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

/**
 * Only the fields that differ from the loaded session, so untouched dates are never re-sent (a
 * datetime-local input drops seconds) and an emptied speaker or room is cleared with null.
 */
export function isEmptyPatch(patch: SessionPatch): boolean {
  return Object.keys(patch).length === 0;
}

export function toSessionPatch(
  values: SessionFormValues,
  original: SessionFormValues,
): SessionPatch {
  const patch: SessionPatch = {};
  if (values.title !== original.title) patch.title = values.title.trim();
  if (values.speaker !== original.speaker) patch.speaker = orNull(values.speaker);
  if (values.room !== original.room) patch.room = orNull(values.room);
  if (values.startsAt !== original.startsAt) patch.startsAt = fromInputDateTime(values.startsAt);
  if (values.endsAt !== original.endsAt) patch.endsAt = fromInputDateTime(values.endsAt);
  if (values.capacity !== original.capacity) patch.capacity = Number(values.capacity);
  return patch;
}
